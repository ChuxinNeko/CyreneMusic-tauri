
export interface LxMusicConfig {
    id: string; // 唯一标识，通常基于脚本名称的 hash
    name: string;
    version: string;
    apiUrl: string;
    apiKey: string;
    author: string;
    description: string;
    homepage: string;
    scriptContent: string;
    urlPathTemplate: string;
    isActive?: boolean;
}

class LxMusicSourceService {
    private static instance: LxMusicSourceService;

    private constructor() { }

    public static getInstance(): LxMusicSourceService {
        if (!LxMusicSourceService.instance) {
            LxMusicSourceService.instance = new LxMusicSourceService();
        }
        return LxMusicSourceService.instance;
    }

    /**
     * Parse script content to extract metadata and configuration
     */
    public parseScript(scriptContent: string): LxMusicConfig | null {
        try {
            // Extract header metadata (JSDoc style)
            const headerMetadata = this.parseHeaderMetadata(scriptContent);

            // Extract core fields using regex (Faithfully migrated from Dart prototype)
            const name = headerMetadata.name || this.extractRegex(scriptContent, [
                /name\s*:\s*['"]([^'"]+)['"]/,
                /['"]name['"]\s*:\s*['"]([^'"]+)['"]/,
                /"name"\s*:\s*"([^"]+)"/
            ]) || '洛雪音源';

            const version = headerMetadata.version || this.extractRegex(scriptContent, [
                /version\s*:\s*['"]([^'"]+)['"]/,
                /['"]version['"]\s*:\s*['"]([^'"]+)['"]/,
                /"version"\s*:\s*"([^"]+)"/
            ]) || '1.0.0';

            const author = headerMetadata.author || this.extractRegex(scriptContent, [
                /author\s*:\s*['"]([^'"]+)['"]/,
                /['"]author['"]\s*:\s*['"]([^'"]+)['"]/,
                /@author\s+(.+)/
            ]) || '';

            const description = headerMetadata.description || this.extractRegex(scriptContent, [
                /description\s*:\s*['"]([^'"]+)['"]/,
                /['"]description['"]\s*:\s*['"]([^'"]+)['"]/,
                /@description\s+(.+)/
            ]) || '';

            const homepage = headerMetadata.homepage || this.extractRegex(scriptContent, [
                /homepage\s*:\s*['"]([^'"]+)['"]/,
                /@homepage\s+(.+)/
            ]) || '';

            const apiUrl = this.extractApiUrl(scriptContent);

            const apiKey = this.extractRegex(scriptContent, [
                /apiKey\s*[:=]\s*['"]([^'"]+)['"]/,
                /api[_-]?key\s*[:=]\s*['"]([^'"]+)['"]/,
                /key\s*[:=]\s*['"]([^'"]+)['"]/,
                /token\s*[:=]\s*['"]([^'"]+)['"]/,
                /['"]key['"]\s*:\s*['"]([^'"]+)['"]/
            ]) || '';

            const urlPathTemplate = this.extractRegex(scriptContent, [
                /urlPath\s*[:=]\s*['"]([^'"]+)['"]/,
                /path\s*[:=]\s*['"]([^'"]+)['"]/,
                /\/url\/\{?[a-zA-Z]+\}?\/\{?[a-zA-Z]+\}?\/\{?[a-zA-Z]+\}?/
            ]) || '/url/{source}/{songId}/{quality}';

            const id = `lx_${name}_${version}`.replace(/\s+/g, '_');

            return {
                id,
                name,
                version,
                author,
                description,
                homepage,
                apiUrl,
                apiKey,
                scriptContent,
                urlPathTemplate
            };
        } catch (error) {
            console.error('[LxMusicSourceService] Failed to parse script:', error);
            return null;
        }
    }

    /**
     * Fetch script from URL and parse it
     */
    public async fetchAndParse(url: string): Promise<LxMusicConfig | null> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const content = await response.text();
            return this.parseScript(content);
        } catch (error) {
            console.error('[LxMusicSourceService] Failed to fetch script:', error);
            return null;
        }
    }

    private extractRegex(content: string, patterns: RegExp[]): string | null {
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            } else if (match && match[0] && !pattern.source.includes('(')) {
                return match[0].trim();
            }
        }
        return null;
    }

    private extractApiUrl(script: string): string {
        const urlPatterns = [
            /apiUrl\s*[:=]\s*['"]([^'"]+)['"]/,
            /api[_-]?url\s*[:=]\s*['"]([^'"]+)['"]/,
            /host\s*[:=]\s*['"]([^'"]+)['"]/,
            /baseUrl\s*[:=]\s*['"]([^'"]+)['"]/,
            /['"]?((?:https?|http):\/\/[a-zA-Z0-9\-._~:/?#\[\]@!$&()*+,;=%]+)['"]?/g
        ];

        for (const pattern of urlPatterns) {
            if (pattern.global) {
                const matches = script.matchAll(pattern);
                for (const match of matches) {
                    const matchedUrl = match[1] || match[0];
                    if (this.isValidApiUrl(matchedUrl)) {
                        const cleaned = this.cleanUrl(matchedUrl);
                        if (cleaned) return cleaned;
                    }
                }
            } else {
                const match = script.match(pattern);
                if (match) {
                    const matchedUrl = match[1] || match[0];
                    if (this.isValidApiUrl(matchedUrl)) {
                        return this.cleanUrl(matchedUrl);
                    }
                }
            }
        }
        return '';
    }

    private isValidApiUrl(url: string): boolean {
        const excludePatterns = [
            'github.com',
            'jsdelivr.net',
            'cdnjs.com',
            'unpkg.com',
            'example.com',
            'localhost',
        ];

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return false;
        }

        return !excludePatterns.some(pattern => url.includes(pattern));
    }

    private cleanUrl(url: string): string {
        let cleaned = url.trim();
        while (cleaned.startsWith("'") || cleaned.startsWith('"')) {
            cleaned = cleaned.substring(1);
        }
        while (cleaned.endsWith("'") || cleaned.endsWith('"')) {
            cleaned = cleaned.substring(0, cleaned.length - 1);
        }
        return cleaned;
    }

    private parseHeaderMetadata(script: string): Record<string, string> {
        const metadata: Record<string, string> = {};
        const commentBlockMatch = script.match(/\/\*[\s\S]*?\*\//);
        if (!commentBlockMatch) return metadata;

        const commentContent = commentBlockMatch[0];
        const patterns: Record<string, RegExp> = {
            name: /@name\s+(.+)/,
            author: /@author\s+(.+)/,
            version: /@version\s+(.+)/,
            description: /@description\s+(.+)/,
            homepage: /@homepage\s+(.+)/
        };

        for (const [key, pattern] of Object.entries(patterns)) {
            const match = commentContent.match(pattern);
            if (match && match[1]) {
                let value = match[1].trim();
                // Handle JSDoc style with *
                if (value.startsWith('*')) {
                    value = value.substring(1).trim();
                }
                if (value) metadata[key] = value;
            }
        }

        return metadata;
    }
}

export const lxMusicSourceService = LxMusicSourceService.getInstance();
