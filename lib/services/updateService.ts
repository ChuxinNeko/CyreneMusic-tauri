
import { urlService } from "./urlService";

export interface UpdateInfo {
    version: string;
    changelog: string;
    force_update: boolean;
}

class UpdateService {
    private static instance: UpdateService;
    public readonly CURRENT_VERSION = "1.0.0";

    private constructor() {}

    public static getInstance(): UpdateService {
        if (!UpdateService.instance) {
            UpdateService.instance = new UpdateService();
        }
        return UpdateService.instance;
    }

    /**
     * 检查是否有新版本
     * @returns 如果有新版本则返回更新信息，否则返回 null
     */
    public async checkUpdate(): Promise<UpdateInfo | null> {
        try {
            const response = await fetch(urlService.latestNextVersionUrl);
            const result = await response.json();
            
            if (result.status === 200 && result.data) {
                const latestVersion = result.data.version;
                if (this.compareVersions(latestVersion, this.CURRENT_VERSION) > 0) {
                    return result.data;
                }
            }
        } catch (error) {
            console.error("[UpdateService] 检查更新失败:", error);
        }
        return null;
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
