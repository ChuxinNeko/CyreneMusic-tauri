
const GITHUB_API = "https://api.github.com/repos/ChuxinNeko/CyreneMusic-tauri/releases/latest";

export interface UpdateInfo {
    version: string;
    changelog: string;
    force_update: boolean;
    /** 主下载链接（exe） */
    download_url?: string;
    /** 各平台下载链接 */
    platform_downloads?: Record<string, string>;
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
}

class UpdateService {
    private static instance: UpdateService;
    public readonly CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

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
            const downloads = this.resolvePlatformDownloads(assets);

            return {
                version: latestVersion,
                changelog: release.body || "暂无更新说明",
                force_update: false,
                download_url: release.html_url,
                platform_downloads: downloads,
            };
        } catch (error) {
            console.error("[UpdateService] 检查更新失败:", error);
        }
        return null;
    }

    /**
     * 根据 release assets 生成各平台下载链接
     */
    private resolvePlatformDownloads(assets: GitHubAsset[]): Record<string, string> {
        const map: Record<string, string> = {};

        for (const asset of assets) {
            const name = asset.name.toLowerCase();
            if (name.endsWith(".exe") || name.endsWith(".msi")) {
                map.windows = asset.browser_download_url;
            } else if (name.endsWith(".dmg") || name.endsWith(".app.tar.gz")) {
                map.macos = asset.browser_download_url;
            } else if (name.endsWith(".deb") || name.endsWith(".appimage") || name.endsWith(".rpm")) {
                map.linux = asset.browser_download_url;
            } else if (name.endsWith(".apk")) {
                map.android = asset.browser_download_url;
            } else if (name.endsWith(".ipa")) {
                map.ios = asset.browser_download_url;
            }
        }

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
