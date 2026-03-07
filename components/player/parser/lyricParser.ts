import { LyricLineData, WordData } from './types'
import { INTRO_DELAY } from './constants'

// 简单的 LRU 缓存，避免重复解析同一首歌的复杂歌词
const parserCache = new Map<string, LyricLineData[]>();
const MAX_CACHE_SIZE = 10;

export function parseLyrics(track: { id?: string | number; yrc?: string; lyric?: string; tlyric?: string; ytlrc?: string; source?: string } | null | undefined): LyricLineData[] {
    const hasYrc = track?.yrc && track.yrc.trim().length > 0;
    const lyricSource = hasYrc ? track.yrc : (track?.lyric || "");

    // 生成缓存 Key (id + 歌词长度 + 翻译存在性)
    const cacheKey = `${track?.id || 'null'}_${lyricSource?.length || 0}_${!!(track?.tlyric || track?.ytlrc)}`;

    if (parserCache.has(cacheKey)) {
        return parserCache.get(cacheKey)!;
    }

    if (!lyricSource) {
        return [];
    }

    try {
        const rawLines = lyricSource.split('\n').filter(l => l.trim());
        const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        const yrcLineRegex = /^\[(\d+),(\d+)\]/;
        const yrcWordRegex = /\((\d+),(\d+),\d+\)([^(\[]+)/g;

        let globalOffset = 0;
        const offsetMatch = lyricSource.match(/\[offset:\s*(-?\d+)\]/);
        if (offsetMatch) {
            globalOffset = parseInt(offsetMatch[1]);
        }

        const processed = rawLines.map((lineStr) => {
            let timeMs = 0;
            let words: WordData[] = [];
            let endTime = 0;

            if (lineStr.startsWith('{')) {
                try {
                    const json = JSON.parse(lineStr);
                    timeMs = json.t + INTRO_DELAY;
                    words = json.c.map((segment: any) => ({
                        text: segment.tx,
                        startTime: timeMs,
                        endTime: timeMs + 1000,
                        duration: 1000
                    }));
                    return { time: timeMs, startTime: timeMs, endTime: timeMs + 1000, words, isVerbatim: false };
                } catch (e) { return null; }
            }

            const lrcMatch = lineStr.match(lrcRegex);
            if (lrcMatch) {
                const mins = parseInt(lrcMatch[1]);
                const secs = parseInt(lrcMatch[2]);
                const ms = parseInt(lrcMatch[3].padEnd(3, '0').slice(0, 3));
                timeMs = (mins * 60 + secs) * 1000 + ms + INTRO_DELAY + globalOffset;
                return { time: timeMs, startTime: timeMs, endTime: timeMs + 2000, words: [{ text: lrcMatch[4].trim(), startTime: timeMs, endTime: timeMs + 2000, duration: 2000 }], isVerbatim: false };
            }

            const yrcMatch = lineStr.match(yrcLineRegex);
            if (yrcMatch) {
                const lineStart = parseInt(yrcMatch[1]);
                const lineDuration = parseInt(yrcMatch[2]);
                timeMs = lineStart + INTRO_DELAY;
                endTime = timeMs + lineDuration;

                const hasVerbatimData = lineStr.includes('(') && lineStr.includes(')');
                if (hasVerbatimData) {
                    if (track?.source === 'netease' || !track?.source) {
                        yrcWordRegex.lastIndex = 0;
                        let wordMatch;
                        while ((wordMatch = yrcWordRegex.exec(lineStr)) !== null) {
                            const wStart = parseInt(wordMatch[1]) + INTRO_DELAY;
                            const wDur = parseInt(wordMatch[2]);
                            words.push({
                                text: wordMatch[3],
                                startTime: wStart,
                                endTime: wStart + wDur,
                                duration: wDur
                            });
                        }
                    }
                }

                if (words.length > 0) {
                    return { time: timeMs, startTime: timeMs, endTime, words, isVerbatim: true };
                }
            }

            return null;
        }).filter(l => l !== null) as LyricLineData[];

        processed.sort((a, b) => a.time - b.time);

        const translationSource = hasYrc ? track?.ytlrc : track?.tlyric;
        if (translationSource && translationSource.trim().length > 0) {
            const tLines = translationSource.split('\n').filter(l => l.trim());
            const tLrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
            const translationMap: { time: number, text: string }[] = [];

            for (const tLine of tLines) {
                const m = tLine.match(tLrcRegex);
                if (m) {
                    const ms = parseInt(m[3].padEnd(3, '0').slice(0, 3));
                    const tMs = (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + ms + INTRO_DELAY + globalOffset;
                    translationMap.push({ time: tMs, text: m[4].trim() });
                }
            }

            for (const lyricLine of processed) {
                let bestMatch = null, bestDiff = Infinity;
                for (const t of translationMap) {
                    const diff = Math.abs(t.time - lyricLine.time);
                    if (diff < bestDiff) { bestDiff = diff; bestMatch = t; }
                }
                if (bestMatch && bestDiff < 500) lyricLine.translation = bestMatch.text;
            }
        }

        // 管理缓存容量
        if (parserCache.size >= MAX_CACHE_SIZE) {
            const firstKey = parserCache.keys().next().value;
            if (firstKey !== undefined) parserCache.delete(firstKey);
        }
        parserCache.set(cacheKey, processed);

        return processed;
    } catch (error) {
        console.error("Lyric parsing error:", error);
        return [];
    }
}
