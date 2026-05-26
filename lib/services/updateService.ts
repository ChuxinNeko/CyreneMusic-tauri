import { invoke } from "@tauri-apps/api/core";

const GITHUB_API = "https://api.github.com/repos/ChuxinNeko/CyreneMusic-tauri/releases/latest";

export interface UpdateInfo {
    version: string;
    changelog: string;
    force_update: boolean;
    /** 主下载链接（exe） */
    download_url?: string;
    /** 各平台下载链接 */
    platform_downloads?: Record<string, string>;
    /** 全部 Android ABI 安装包，用于按设备架构挑选 */
    android_abi_downloads?: Record<string, string>;
    /** 当前运行环境识别出的 Android ABI（仅在移动端有效） */
    android_target_abi?: string;
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
}

type AndroidAbi = "arm64-v8a" | "armeabi-v7a" | "x86_64" | "x86";

const ABI_FALLBACK_ORDER: Record<AndroidAbi, AndroidAbi[]> = {
    "arm64-v8a": ["arm64-v8a", "armeabi-v7a"],
    "armeabi-v7a": ["armeabi-v7a", "arm64-v8a"],
    "x86_64": ["x86_64", "x86", "arm64-v8a", "armeabi-v7a"],
    "x86": ["x86", "x86_64", "armeabi-v7a", "arm64-v8a"],
};

const ABI_FILENAME_PATTERNS: Record<AndroidAbi, RegExp> = {
    "arm64-v8a": /arm64[-_]?v?8a?/i,
    "armeabi-v7a": /armeabi[-_]?v?7a?/i,
    "x86_64": /x86[-_]?64/i,
    "x86": /(^|[^_0-9])x86([^_0-9]|$)/i,
};

const isTauri = (): boolean => {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

const detectAbiFromUserAgent = (): AndroidAbi | null => {
    if (typeof navigator === "undefined") return null;
    const ua = navigator.userAgent || "";
    if (!/Android/i.test(ua)) return null;
    if (/arm64|aarch64/i.test(ua)) return "arm64-v8a";
    if (/armv7|arm v7|armeabi/i.test(ua)) return "armeabi-v7a";
    if (/x86_64|x64/i.test(ua)) return "x86_64";
    if (/x86|i686/i.test(ua)) return "x86";
    // Android 设备 UA 通常不带架构，绝大多数现代机型都是 arm64
    return "arm64-v8a";
};

class UpdateService {
    private static instance: UpdateService;
    public readonly CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

    private cachedAbi: AndroidAbi | null | undefined = undefined;

    private constructor() {}

    public static getInstance(): UpdateService {
        if (!UpdateService.instance) {
            UpdateService.instance = new UpdateService();
        }
        return UpdateService.instance;
    }

    /**
     * 从 GitHub Releases 获取最新版本信息
     * @returns 如果有新版本则返回更新信息，否则返回 null
     */
    public async checkUpdate(): Promise<UpdateInfo | null> {
        try {
            const response = await fetch(GITHUB_API);
            if (!response.ok) return null;

            const release = await response.json();
            const latestVersion = String(release.tag_name || "").replace(/^v/i, "");

            if (!latestVersion || this.compareVersions(latestVersion, this.CURRENT_VERSION) <= 0) {
                return null;
            }

            const assets: GitHubAsset[] = release.assets || [];
            const androidAbiDownloads = this.collectAndroidAbiDownloads(assets);
            const targetAbi = await this.resolveAndroidTargetAbi();
            const downloads = this.resolvePlatformDownloads(assets, androidAbiDownloads, targetAbi);

            return {
                version: latestVersion,
                changelog: release.body || "暂无更新说明",
                force_update: false,
                download_url: release.html_url,
                platform_downloads: downloads,
                android_abi_downloads: androidAbiDownloads,
                android_target_abi: targetAbi || undefined,
            };
        } catch (error) {
            console.error("[UpdateService] 检查更新失败:", error);
        }
        return null;
    }

    /**
     * 探测当前 Android 运行环境的 ABI。桌面端直接返回 null。
     */
    private async resolveAndroidTargetAbi(): Promise<AndroidAbi | null> {
        if (this.cachedAbi !== undefined) return this.cachedAbi;

        let abi: AndroidAbi | null = null;
        if (isTauri()) {
            try {
                const raw = await invoke<string>("get_app_target_abi");
                abi = this.normalizeAbi(raw);
            } catch (error) {
                console.warn("[UpdateService] 调用 get_app_target_abi 失败，回退至 UA 嗅探:", error);
            }
        }
        if (!abi) abi = detectAbiFromUserAgent();

        this.cachedAbi = abi;
        return abi;
    }

    private normalizeAbi(value: string | null | undefined): AndroidAbi | null {
        if (!value) return null;
        const lower = value.toLowerCase();
        if (lower.includes("arm64") || lower === "aarch64") return "arm64-v8a";
        if (lower.includes("armeabi") || lower.startsWith("armv7") || lower === "arm") return "armeabi-v7a";
        if (lower === "x86_64" || lower === "x64") return "x86_64";
        if (lower === "x86" || lower === "i686") return "x86";
        return null;
    }

    /**
     * 从 release assets 中按 ABI 收集所有 Android APK 链接
     */
    private collectAndroidAbiDownloads(assets: GitHubAsset[]): Record<string, string> {
        const map: Record<string, string> = {};
        for (const asset of assets) {
            const name = asset.name;
            if (!name.toLowerCase().endsWith(".apk")) continue;

            for (const [abi, pattern] of Object.entries(ABI_FILENAME_PATTERNS) as [AndroidAbi, RegExp][]) {
                if (pattern.test(name)) {
                    map[abi] = asset.browser_download_url;
                    break;
                }
            }
        }
        return map;
    }

    /**
     * 按设备 ABI 在 fallback 顺序中挑出最合适的 APK
     */
    private pickAndroidApkByAbi(
        abiDownloads: Record<string, string>,
        targetAbi: AndroidAbi | null,
    ): string | null {
        if (Object.keys(abiDownloads).length === 0) return null;

        const order: AndroidAbi[] = targetAbi
            ? ABI_FALLBACK_ORDER[targetAbi]
            : ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"];

        for (const abi of order) {
            if (abiDownloads[abi]) return abiDownloads[abi];
        }
        // 万一命名不在 ABI 表里，给一个最终兜底
        return Object.values(abiDownloads)[0] || null;
    }

    /**
     * 根据 release assets 生成各平台下载链接
     */
    private resolvePlatformDownloads(
        assets: GitHubAsset[],
        androidAbiDownloads: Record<string, string>,
        targetAbi: AndroidAbi | null,
    ): Record<string, string> {
        const map: Record<string, string> = {};

        for (const asset of assets) {
            const name = asset.name.toLowerCase();
            if (name.endsWith(".exe") || name.endsWith(".msi")) {
                map.windows = asset.browser_download_url;
            } else if (name.endsWith(".dmg") || name.endsWith(".app.tar.gz")) {
                map.macos = asset.browser_download_url;
            } else if (name.endsWith(".deb") || name.endsWith(".appimage") || name.endsWith(".rpm")) {
                map.linux = asset.browser_download_url;
            } else if (name.endsWith(".ipa")) {
                map.ios = asset.browser_download_url;
            }
        }

        const apk = this.pickAndroidApkByAbi(androidAbiDownloads, targetAbi);
        if (apk) map.android = apk;

        return map;
    }

    /**
     * 版本对比算法
     * @returns 1: v1 > v2, -1: v1 < v2, 0: v1 == v2
     */
    private compareVersions(v1: string, v2: string): number {
        const n1 = v1.replace(/^v/i, "").split(".").map(s => parseInt(s, 10) || 0);
        const n2 = v2.replace(/^v/i, "").split(".").map(s => parseInt(s, 10) || 0);
        const len = Math.max(n1.length, n2.length);
        
        for (let i = 0; i < len; i++) {
            const a = n1[i] || 0;
            const b = n2[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    }
}

export const updateService = UpdateService.getInstance();