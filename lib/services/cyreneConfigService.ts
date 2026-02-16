
/**
 * Cyrene 配置文件模型
 */
export interface CyreneConfig {
    name: string;
    url: string;
    apiKey: string;
}

/**
 * Cyrene 配置文件服务
 * 
 * 用于解析和解密 .cyrene 配置文件
 */
class CyreneConfigService {
    private static instance: CyreneConfigService;

    // 加密密钥（32字节 = 256位）
    private readonly ENCRYPTION_KEY = "CyreneMusic2024SecretKey12345678";

    // 魔数标识 "CYRN"
    private readonly MAGIC_NUMBER = new Uint8Array([0x43, 0x59, 0x52, 0x4E]);

    // 支持的版本
    private readonly SUPPORTED_VERSION = 1;

    private constructor() { }

    public static getInstance(): CyreneConfigService {
        if (!CyreneConfigService.instance) {
            CyreneConfigService.instance = new CyreneConfigService();
        }
        return CyreneConfigService.instance;
    }

    /**
     * 解密 .cyrene 配置文件
     */
    public async decrypt(data: Uint8Array): Promise<CyreneConfig | null> {
        try {
            // 1. 验证基本格式
            if (!this.validateFormat(data)) {
                return null;
            }

            // 2. 解析文件结构
            // 结构: 魔数(4) + 版本(1) + IV(12) + 加密数据 + AuthTag(16)
            const iv = data.slice(5, 17);
            const authTag = data.slice(data.length - 16);
            const encryptedData = data.slice(17, data.length - 16);

            // 3. 准备解密
            // Web Crypto API 的 AES-GCM 需要将 ciphertext 和 authTag 拼接在一起
            const ciphertextWithTag = new Uint8Array(encryptedData.length + authTag.length);
            ciphertextWithTag.set(encryptedData);
            ciphertextWithTag.set(authTag, encryptedData.length);

            const keyData = new TextEncoder().encode(this.ENCRYPTION_KEY);
            const key = await window.crypto.subtle.importKey(
                "raw",
                keyData,
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            );

            // 4. 执行解密
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                    tagLength: 128,
                },
                key,
                ciphertextWithTag
            );

            // 5. 解析结果
            const decryptedBytes = new Uint8Array(decryptedBuffer);

            // 去除填充的零字节 (如果存在)
            let actualLength = decryptedBytes.length;
            while (actualLength > 0 && decryptedBytes[actualLength - 1] === 0) {
                actualLength--;
            }

            const jsonString = new TextDecoder().decode(decryptedBytes.slice(0, actualLength));
            const json = JSON.parse(jsonString);

            return {
                name: json.name || 'OmniParse',
                url: json.url || '',
                apiKey: json.apiKey || '',
            };
        } catch (e) {
            console.error('[CyreneConfigService] Decryption failed:', e);
            return null;
        }
    }

    /**
     * 验证文件格式
     */
    private validateFormat(data: Uint8Array): boolean {
        // 最小文件大小: 魔数(4) + 版本(1) + IV(12) + 最小数据(1) + AuthTag(16) = 34 字节
        if (data.length < 34) {
            return false;
        }

        // 检查魔数
        for (let i = 0; i < 4; i++) {
            if (data[i] !== this.MAGIC_NUMBER[i]) {
                return false;
            }
        }

        // 检查版本
        const version = data[4];
        if (version !== this.SUPPORTED_VERSION) {
            return false;
        }

        return true;
    }
}

export const cyreneConfigService = CyreneConfigService.getInstance();
