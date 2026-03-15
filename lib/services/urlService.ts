
"use client"

// Backend Source Type Enum
export enum BackendSourceType {
    Official = "official",
    Custom = "custom",
}

class UrlService {
    private static instance: UrlService;

    // Default configuration
    private readonly STORAGE_KEY_SOURCE_TYPE = "backend_source_type";
    private readonly STORAGE_KEY_CUSTOM_URL = "custom_base_url";
    public readonly OFFICIAL_BASE_URL = "https://server.cyrene.cyou:4449";

    // State
    private _sourceType: BackendSourceType = BackendSourceType.Official;
    private _customBaseUrl: string = "";
    private _isInitialized: boolean = false;

    // Event listeners for state changes
    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== "undefined") {
            this.loadSettings();
        }
    }

    public static getInstance(): UrlService {
        if (!UrlService.instance) {
            UrlService.instance = new UrlService();
        }
        return UrlService.instance;
    }

    private loadSettings() {
        if (typeof window === "undefined") return;

        try {
            const storedType = localStorage.getItem(this.STORAGE_KEY_SOURCE_TYPE);
            if (storedType === BackendSourceType.Custom) {
                this._sourceType = BackendSourceType.Custom;
            } else {
                this._sourceType = BackendSourceType.Official;
            }

            const storedUrl = localStorage.getItem(this.STORAGE_KEY_CUSTOM_URL);
            this._customBaseUrl = storedUrl || "";

            this._isInitialized = true;
            this.notifyListeners();
        } catch (e) {
            console.error("[UrlService] Failed to load settings:", e);
        }
    }

    private saveSettings() {
        if (typeof window === "undefined") return;

        try {
            localStorage.setItem(this.STORAGE_KEY_SOURCE_TYPE, this._sourceType);
            localStorage.setItem(this.STORAGE_KEY_CUSTOM_URL, this._customBaseUrl);
        } catch (e) {
            console.error("[UrlService] Failed to save settings:", e);
        }
    }

    public get sourceType(): BackendSourceType {
        return this._sourceType;
    }

    public get customBaseUrl(): string {
        return this._customBaseUrl;
    }

    public get baseUrl(): string {
        if (this._sourceType === BackendSourceType.Official) {
            return this.OFFICIAL_BASE_URL;
        }
        return this._customBaseUrl || this.OFFICIAL_BASE_URL;
    }

    public setSourceType(type: BackendSourceType) {
        if (this._sourceType !== type) {
            this._sourceType = type;
            this.saveSettings();
            this.notifyListeners();
        }
    }

    public setCustomBaseUrl(url: string) {
        // Remove trailing slash
        const cleanUrl = url.trim().replace(/\/$/, "");

        if (this._customBaseUrl !== cleanUrl) {
            this._customBaseUrl = cleanUrl;
            this.saveSettings();
            this.notifyListeners();
        }
    }

    public isValidUrl(url: string): boolean {
        if (!url) return false;
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === "http:" || urlObj.protocol === "https:";
        } catch {
            return false;
        }
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    // ==================== API 端点 ====================

    // Netease API
    public get searchUrl(): string { return `${this.baseUrl}/search`; }
    public get songUrl(): string { return `${this.baseUrl}/song`; }
    public get toplistsUrl(): string { return `${this.baseUrl}/toplists`; }

    // QQ Music API
    public get qqSearchUrl(): string { return `${this.baseUrl}/qq/search`; }
    public get qqSongUrl(): string { return `${this.baseUrl}/qq/song`; }

    // Kugou API
    public get kugouSearchUrl(): string { return `${this.baseUrl}/kugou/search`; }
    public get kugouSongUrl(): string { return `${this.baseUrl}/kugou/song`; }

    // Kuwo API
    public get kuwoSearchUrl(): string { return `${this.baseUrl}/kuwo/search`; }
    public get kuwoSongUrl(): string { return `${this.baseUrl}/kuwo/song`; }

    // Apple Music API
    public get appleSearchUrl(): string { return `${this.baseUrl}/apple/search`; }

    // Spotify API
    public get spotifySearchUrl(): string { return `${this.baseUrl}/spotify/search`; }

    // Update API
    public get latestNextVersionUrl(): string { return `${this.baseUrl}/version/next/latest`; }
}

export const urlService = UrlService.getInstance();
