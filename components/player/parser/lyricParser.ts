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
        // 兼容 QQ 等平台的时间戳分隔符：毫秒前可能是 '.' 或 ':'，且毫秒部分可缺省
        // 例如标准 [00:17.32]、QQ 纯音乐占位 [00:00:00]、无毫秒 [00:17]
        const lrcRegex = /^\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\](.*)/;
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
                const ms = lrcMatch[3] ? parseInt(lrcMatch[3].padEnd(3, '0').slice(0, 3)) : 0;
                timeMs = (mins * 60 + secs) * 1000 + ms + INTRO_DELAY + globalOffset;
                const text = lrcMatch[4].trim();
                if (!text) return null;
                return { time: timeMs, startTime: timeMs, endTime: timeMs + 2000, words: [{ text, startTime: timeMs, endTime: timeMs + 2000, duration: 2000 }], isVerbatim: false };
            }

            const yrcMatch = lineStr.match(yrcLineRegex);
            if (yrcMatch) {
                const lineStart = parseInt(yrcMatch[1]);
                const lineDuration = parseInt(yrcMatch[2]);
                timeMs = lineStart + INTRO_DELAY;
                endTime = timeMs + lineDuration;

                // 汽水音乐逐字格式: <offset,duration,flag>word（offset 相对行起始）
                const hasQishuiVerbatim = lineStr.includes('<') && lineStr.includes('>');
                if (hasQishuiVerbatim) {
                    const qishuiWordRegex = /<(\d+),(\d+),\d+>([^<\[\n]+)/g;
                    let qMatch;
                    while ((qMatch = qishuiWordRegex.exec(lineStr)) !== null) {
                        const wOffset = parseInt(qMatch[1]);
                        const wDur = parseInt(qMatch[2]);
                        const wStart = timeMs + wOffset;
                        words.push({
                            text: qMatch[3],
                            startTime: wStart,
                            endTime: wStart + wDur,
                            duration: wDur
                        });
                    }
                }

                // QQ QRC 逐字格式: word(startMs,durMs)（文字在前、括号在后、2 个绝对毫秒）
                // 仅对 QQ 生效（source 守卫），网易云 YRC 与汽水逐字逻辑不受影响。
                // QRC 的 startMs 是绝对时间，与 YRC 一致，不叠加行内 offset。
                const hasQrcVerbatim = track?.source === 'qq' && /\([^()]*\d+,\d+[^()]*\)/.test(lineStr);
                if (hasQrcVerbatim && words.length === 0) {
                    const qrcWordRegex = /([^(<\[\]]*?)\((\d+),(\d+)\)/g;
                    let qrcMatch;
                    while ((qrcMatch = qrcWordRegex.exec(lineStr)) !== null) {
                        const wText = qrcMatch[1];
                        if (!wText || !wText.trim()) continue;
                        const wStart = parseInt(qrcMatch[2]) + INTRO_DELAY;
                        const wDur = parseInt(qrcMatch[3]);
                        words.push({
                            text: wText,
                            startTime: wStart,
                            endTime: wStart + wDur,
                            duration: wDur
                        });
                    }
                }

                // 网易云 YRC 逐字格式: (absTime,duration,flag)word（absTime 是绝对时间）
                const hasVerbatimData = lineStr.includes('(') && lineStr.includes(')');
                if (hasVerbatimData && words.length === 0) {
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

        // 后处理：为普通 LRC 歌词行设置正确的 endTime（= 下一行的 startTime）
        for (let i = 0; i < processed.length; i++) {
            if (!processed[i].isVerbatim) {
                const nextTime = i + 1 < processed.length
                    ? processed[i + 1].time
                    : processed[i].time + 5000;
                processed[i].endTime = nextTime;
                processed[i].words.forEach(w => {
                    w.endTime = nextTime;
                    w.duration = nextTime - w.startTime;
                });
            }
        }

        const translationSource = hasYrc ? track?.ytlrc : track?.tlyric;
        if (translationSource && translationSource.trim().length > 0) {
            const tLines = translationSource.split('\n').filter(l => l.trim());
            const tLrcRegex = /^\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\](.*)/;
            const translationMap: { time: number, text: string }[] = [];

            for (const tLine of tLines) {
                const m = tLine.match(tLrcRegex);
                if (m) {
                    const ms = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3)) : 0;
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
