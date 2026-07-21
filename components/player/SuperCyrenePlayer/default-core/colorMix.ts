// src/components/visualizer/colorMix.ts
// Shared color helpers for visualizer renderers.
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const FALLBACK_RGB = { r: 255, g: 255, b: 255 };

const isFiniteChannel = (value: number) => Number.isFinite(value);

// Color channel parsing cache — theme colors (primary/accent/secondary) are constant
// during a rendering session, so caching avoids repeated regex+parseInt per grapheme per frame.
const _channelCache = new Map<string, { r: number; g: number; b: number } | null>();
const CHANNEL_CACHE_MAX = 128;

const _parseColorChannelsInner = (normalizedColor: string): { r: number; g: number; b: number } | null => {
    if (normalizedColor.startsWith('#')) {
        const hex = normalizedColor.slice(1);
        const parse = (value: string) => Number.parseInt(value, 16);

        if (/^[0-9a-fA-F]{3}$/.test(hex)) {
            return {
                r: parse(hex[0] + hex[0]),
                g: parse(hex[1] + hex[1]),
                b: parse(hex[2] + hex[2]),
            };
        }

        if (/^[0-9a-fA-F]{6}$/.test(hex)) {
            return {
                r: parse(hex.slice(0, 2)),
                g: parse(hex.slice(2, 4)),
                b: parse(hex.slice(4, 6)),
            };
        }

        return null;
    }

    const rgbMatch = normalizedColor.match(/^rgba?\(([^)]+)\)$/);
    if (rgbMatch) {
        const [r, g, b] = rgbMatch[1].split(',').slice(0, 3).map(part => Number.parseFloat(part.trim()));
        if ([r, g, b].every(isFiniteChannel)) {
            return { r, g, b };
        }
    }

    return null;
};

const _resolveCachedChannels = (color: string): { r: number; g: number; b: number } | null => {
    const key = typeof color === 'string' ? color.trim() : '';
    if (!key) return null;

    const cached = _channelCache.get(key);
    if (cached !== undefined) return cached;

    const parsed = _parseColorChannelsInner(key);
    if (_channelCache.size >= CHANNEL_CACHE_MAX) _channelCache.clear();
    _channelCache.set(key, parsed);
    return parsed;
};

/** Clear the color channel parse cache (call on theme change). */
export const clearColorCache = () => { _channelCache.clear(); };

const formatRgba = (channels: { r: number; g: number; b: number }, alpha: number) => (
    `rgba(${Math.round(clamp(channels.r, 0, 255))}, ${Math.round(clamp(channels.g, 0, 255))}, ${Math.round(clamp(channels.b, 0, 255))}, ${alpha})`
);

export const colorWithAlpha = (color: string, alpha: number) => {
    const normalizedAlpha = clamp(alpha, 0, 1);
    const normalizedColor = typeof color === 'string' ? color.trim() : '';
    if (!normalizedColor) {
        return formatRgba(FALLBACK_RGB, normalizedAlpha);
    }

    const channels = _resolveCachedChannels(normalizedColor);
    if (channels) {
        return formatRgba(channels, normalizedAlpha);
    }

    return normalizedColor;
};

export const parseColorChannels = (color: string) => {
    const normalizedColor = typeof color === 'string' ? color.trim() : '';
    if (!normalizedColor) {
        return null;
    }

    return _resolveCachedChannels(normalizedColor);
};

export const mixColors = (from: string, to: string, amount: number, alpha = 1) => {
    const normalizedAmount = clamp(amount, 0, 1);
    const fromChannels = _resolveCachedChannels(from);
    const toChannels = _resolveCachedChannels(to);

    if (!fromChannels || !toChannels) {
        return colorWithAlpha(normalizedAmount >= 0.5 ? to : from, alpha);
    }

    return `rgba(${Math.round(mix(fromChannels.r, toChannels.r, normalizedAmount))}, ${Math.round(mix(fromChannels.g, toChannels.g, normalizedAmount))}, ${Math.round(mix(fromChannels.b, toChannels.b, normalizedAmount))}, ${clamp(alpha, 0, 1)})`;
};
