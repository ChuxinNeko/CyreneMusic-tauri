import { LyricLineData, WordData } from './types'
import { INTRO_DELAY } from './constants'

export function parseLyrics(track: { yrc?: string; lyric?: string; tlyric?: string; ytlrc?: string; source?: string } | null | undefined): LyricLineData[] {
    const hasYrc = track?.yrc && track.yrc.trim().length > 0;
    const lyricSource = hasYrc ? track.yrc : (track?.lyric || "");
    console.log("[LyricParser] Init parsing", { hasYrc, yrcLength: track?.yrc?.length, hasLyric: !!track?.lyric });
    if (!lyricSource) {
        return [];
    }

    try {
        const rawLines = lyricSource.split('\n').filter(l => l.trim());
        console.log(`[LyricParser] Parsing ${rawLines.length} lines. First line:`, rawLines[0]);
        const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        const yrcLineRegex = /^\[(\d+),(\d+)\]/;
        const yrcWordRegex = /\((\d+),(\d+),\d+\)([^(\[]+)/g;

        const processed = rawLines.map((lineStr, i) => {
            let timeMs = 0;
            let words: WordData[] = [];
            let endTime = 0;

            // 1. Try JSON format (Metadata/Credits)
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

            // 2. Try YRC/QRC format (Verbatim)
            const yrcMatch = lineStr.match(yrcLineRegex);
            if (yrcMatch) {
                const lineStart = parseInt(yrcMatch[1]);
                const lineDuration = parseInt(yrcMatch[2]);
                timeMs = lineStart + INTRO_DELAY;
                endTime = timeMs + lineDuration;

                let wordMatch;

                // 判断是否真的像是带有逐字格式的行（包含圆括号且格式形如 (start,dur) 或 (start,dur,0)）
                const hasVerbatimData = lineStr.includes('(') && lineStr.includes(')');

                if (hasVerbatimData) {
                    if (track?.source === 'netease' || !track?.source) {
                        // 网易云 YRC 格式: (startMs,durationMs,0)text
                        yrcWordRegex.lastIndex = 0;
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

                    if ((track?.source === 'qq' || !track?.source) && words.length === 0) {
                        // QQ QRC 格式: text(startMs,durationMs)
                        const qrcWordRegex = /([^(]+)\((\d+),(\d+)\)/g;
                        qrcWordRegex.lastIndex = 0;
                        // 跳过行头 [start,dur]
                        const lineBody = lineStr.replace(yrcLineRegex, '');
                        while ((wordMatch = qrcWordRegex.exec(lineBody)) !== null) {
                            const wText = wordMatch[1];
                            const wStart = parseInt(wordMatch[2]) + INTRO_DELAY;
                            const wDur = parseInt(wordMatch[3]);
                            words.push({
                                text: wText,
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

            // 3. Try LRC format (Standard)
            const lrcMatch = lineStr.match(lrcRegex);
            if (lrcMatch) {
                const mins = parseInt(lrcMatch[1]);
                const secs = parseInt(lrcMatch[2]);
                const ms = parseInt(lrcMatch[3].padEnd(3, '0').slice(0, 3));
                timeMs = (mins * 60 + secs) * 1000 + ms + INTRO_DELAY;
                words = [{
                    text: lrcMatch[4].trim(),
                    startTime: timeMs,
                    endTime: timeMs + 2000,
                    duration: 2000
                }];
                return { time: timeMs, startTime: timeMs, endTime: timeMs + 2000, words, isVerbatim: false };
            }

            return null;
        }).filter(l => l !== null) as LyricLineData[];

        // Refine timings for non-verbatim (LRC/JSON)
        processed.sort((a, b) => a.time - b.time);
        processed.forEach((line, i) => {
            const nextLine = processed[i + 1];
            const nextTime = nextLine ? nextLine.time : line.time + 3000;

            // Only auto-distribute if it looks like standard LRC (single word)
            if (line.words.length === 1 && line.words[0].duration === 2000) {
                const rawDuration = nextTime - line.time;
                let lineDuration = rawDuration;
                if (rawDuration > 4000) {
                    lineDuration = Math.max(2000, rawDuration - 2500);
                }
                line.endTime = line.time + lineDuration;
                line.words[0].endTime = line.endTime;
                line.words[0].duration = lineDuration;
            }
        });

        console.log(`[LyricParser] Parse success. Verbatim lines: ${processed.filter(l => l.isVerbatim).length}/${processed.length}`);

        // 解析翻译歌词并按时间匹配
        const translationSource = hasYrc ? track?.ytlrc : track?.tlyric;
        if (translationSource && translationSource.trim().length > 0) {
            const tLines = translationSource.split('\n').filter(l => l.trim());
            const tLrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
            const translationMap: { time: number, text: string }[] = [];

            for (const tLine of tLines) {
                const m = tLine.match(tLrcRegex);
                if (m) {
                    const mins = parseInt(m[1]);
                    const secs = parseInt(m[2]);
                    const ms = parseInt(m[3].padEnd(3, '0').slice(0, 3));
                    const tMs = (mins * 60 + secs) * 1000 + ms + INTRO_DELAY;
                    const text = m[4].trim();
                    if (text) translationMap.push({ time: tMs, text });
                }
            }

            // 按时间匹配翻译到主歌词行（容差500ms）
            for (const lyricLine of processed) {
                let bestMatch: { time: number, text: string } | null = null;
                let bestDiff = Infinity;
                for (const t of translationMap) {
                    const diff = Math.abs(t.time - lyricLine.time);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestMatch = t;
                    }
                }
                if (bestMatch && bestDiff < 500) {
                    lyricLine.translation = bestMatch.text;
                }
            }
            console.log(`[LyricParser] Translations matched: ${processed.filter(l => l.translation).length}/${processed.length}`);
        }

        return processed;
    } catch (error) {
        console.error("Lyric parsing error:", error);
        return [];
    }
}
