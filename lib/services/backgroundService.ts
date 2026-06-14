import { readFile, writeFile, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';

/**
 * 自定义播放器背景图片服务
 * 负责把用户选择的本地图片复制到应用数据目录下统一管理，
 * 避免源文件被移动/删除后背景失效。
 */
class BackgroundService {
    private static instance: BackgroundService;

    private constructor() {}

    public static getInstance(): BackgroundService {
        if (!BackgroundService.instance) {
            BackgroundService.instance = new BackgroundService();
        }
        return BackgroundService.instance;
    }

    /**
     * 获取背景图片存储主目录
     */
    public async getBackgroundDir(): Promise<string> {
        const localDataDir = await appLocalDataDir();
        const dir = await join(localDataDir, 'cyrene_music_backgrounds');
        if (!(await exists(dir))) {
            await mkdir(dir, { recursive: true });
        }
        return dir;
    }

    /**
     * 将用户选择的源图片复制到背景目录，返回存储后的绝对路径
     * 每次都覆盖旧文件（只保留单张当前背景）
     */
    public async saveBackground(sourcePath: string): Promise<string> {
        const dir = await this.getBackgroundDir();
        // 从源路径提取扩展名（保留原格式）
        const ext = this.extractExtension(sourcePath);
        const targetPath = await join(dir, `background${ext}`);

        const data = await readFile(sourcePath);
        await writeFile(targetPath, data);

        return targetPath;
    }

    /**
     * 删除指定背景文件（如果存在）
     */
    public async deleteBackground(path: string | null): Promise<void> {
        if (!path) return;
        try {
            if (await exists(path)) {
                await remove(path);
            }
        } catch (e) {
            console.warn('[BackgroundService] 删除背景失败:', e);
        }
    }

    private extractExtension(path: string): string {
        const idx = path.lastIndexOf('.');
        if (idx === -1) return '.png';
        const ext = path.slice(idx).toLowerCase();
        // 仅允许常见图片扩展名
        if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
            return ext;
        }
        return '.png';
    }
}

export const backgroundService = BackgroundService.getInstance();
