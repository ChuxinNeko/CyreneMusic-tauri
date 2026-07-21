import type { Line, Theme } from './default-types';
import type { SegmentMeta, WordRange } from './default-canvas-types';
import type { PreparedTextWithSegments } from '@chenglou/pretext';
import { clamp, easeInCubic, splitGraphemes } from './default-canvas-utils';
import { getLineRenderEndTime } from './renderHints';
import { buildWordGraphemeTimings } from './graphemeTiming';

// ---------------------------------------------------------------------------
// Module-level cache for resolveDefaultPassedFadeDuration
// ---------------------------------------------------------------------------

let lastDefaultPassedFadeDurationCache: {
    key: string;
    duration: number;
} | null = null;

// ---------------------------------------------------------------------------
// Internal helpers (not exported – used only within DefaultCanvas.tsx context)
// ---------------------------------------------------------------------------

export const resolvePassedTextStyle = (
    variant: 'body' | 'hero',
    textHoldStyle: 'standard' | 'dimmed',
) => (
    textHoldStyle === 'dimmed'
        ? {
            opacity: variant === 'hero' ? 0.11 : 0.075,
            glowMultiplier: 0,
            shadowAlphaBase: 0,
            shadowAlphaTrail: 0,
        }
        : {
            opacity: variant === 'hero' ? 0.74 : 0.58,
            glowMultiplier: 1,
            shadowAlphaBase: 0.1,
            shadowAlphaTrail: 0.16,
        }
);

export const resolvePassedDimAmount = (
    currentTimeValue: number,
    passedAt: number,
    fadeDuration: number,
) => {
    if (!Number.isFinite(currentTimeValue) || !Number.isFinite(passedAt) || !Number.isFinite(fadeDuration) || fadeDuration <= 0) {
        return 1;
    }

    const passedAge = Math.max(currentTimeValue - passedAt, 0);
    return easeInCubic(clamp(passedAge / fadeDuration, 0, 1));
};

export const resolveDefaultPassedFadeDuration = (lines: Line[], textHoldRatio: number) => {
    if (textHoldRatio >= 1) {
        return Number.POSITIVE_INFINITY;
    }

    const timedLines = lines
        .map(line => ({
            startTime: line.startTime,
            endTime: getLineRenderEndTime(line),
        }))
        .filter(line => (
            Number.isFinite(line.startTime)
            && Number.isFinite(line.endTime)
            && line.endTime >= line.startTime
        ))
        .sort((left, right) => left.startTime - right.startTime);
    const cacheKey = timedLines
        .map(line => `${line.startTime.toFixed(3)}:${line.endTime.toFixed(3)}`)
        .join('|') + `:${textHoldRatio.toFixed(3)}`;

    if (lastDefaultPassedFadeDurationCache?.key === cacheKey) {
        return lastDefaultPassedFadeDurationCache.duration;
    }

    if (timedLines.length <= 1) {
        const duration = clamp(8 * textHoldRatio, 2.4, 130);
        lastDefaultPassedFadeDurationCache = { key: cacheKey, duration };
        return duration;
    }

    const first = timedLines[0]!;
    const last = timedLines[timedLines.length - 1]!;
    const totalDuration = Math.max(last.endTime - first.startTime, 0);
    const duration = clamp(totalDuration * textHoldRatio, 2.4, 130);
    lastDefaultPassedFadeDurationCache = { key: cacheKey, duration };
    return duration;
};

export const buildSegmentMetas = (prepared: PreparedTextWithSegments) => {
    const segmentMetas: SegmentMeta[] = [];
    const graphemes: string[] = [];
    let graphemeCursor = 0;

    for (const segment of prepared.segments) {
        const segmentGraphemes = splitGraphemes(segment);
        segmentMetas.push({
            graphemeStart: graphemeCursor,
            graphemeEnd: graphemeCursor + segmentGraphemes.length,
            graphemeCount: segmentGraphemes.length,
        });
        graphemes.push(...segmentGraphemes);
        graphemeCursor += segmentGraphemes.length;
    }

    return { graphemes, segmentMetas };
};

const resolveWordRevealProgress = (
    range: WordRange,
    currentTimeValue: number,
) => {
    if (range.word.endTime <= range.word.startTime) {
        return currentTimeValue >= range.word.endTime ? 1 : 0;
    }

    const duration = Math.max(range.word.endTime - range.word.startTime, 0.08);
    return clamp((currentTimeValue - range.word.startTime) / duration, 0, 1);
};

const resolvePrintedGlyphsInRange = (
    range: WordRange,
    currentTimeValue: number,
) => {
    const length = Math.max(range.end - range.start, 0);
    if (length === 0) {
        return 0;
    }

    if (currentTimeValue < range.word.startTime) {
        return 0;
    }

    const timedGlyphCount = range.word.syllables?.length ? Math.min(range.graphemeTimings.length, length) : 0;
    if (timedGlyphCount > 0) {
        if (currentTimeValue >= range.word.endTime) {
            return length;
        }

        let printed = 0;
        for (let index = 0; index < timedGlyphCount; index += 1) {
            if (currentTimeValue >= range.graphemeTimings[index]!.startTime) {
                printed = index + 1;
            }
        }
        return clamp(printed, 0, length);
    }

    const progress = resolveWordRevealProgress(range, currentTimeValue);
    if (progress >= 1) {
        return length;
    }

    return clamp(
        Math.floor(progress * length + 0.2),
        progress > 0 ? 1 : 0,
        length,
    );
};

const hasRevealCompletedByLineEnd = (
    line: Line,
    currentTimeValue: number,
) => currentTimeValue >= line.endTime;

export const resolveLinePassCutoffTime = (
    line: Line,
    nextLineStartTime: number | null | undefined,
) => {
    const renderEndTime = getLineRenderEndTime(line);
    if (typeof nextLineStartTime !== 'number' || !Number.isFinite(nextLineStartTime)) {
        return renderEndTime;
    }

    return Math.min(renderEndTime, nextLineStartTime);
};

export const resolveVisualProgressWithCutoff = (
    startedAt: number,
    duration: number,
    currentTimeValue: number,
    cutoffTime: number,
) => {
    const nominalEndTime = startedAt + Math.max(duration, 0.001);
    const effectiveEndTime = Math.max(
        startedAt + 0.001,
        Math.min(nominalEndTime, cutoffTime),
    );

    return clamp(
        (currentTimeValue - startedAt) / Math.max(effectiveEndTime - startedAt, 0.001),
        0,
        1,
    );
};

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

export const buildWordRangesFromWords = (line: Line, graphemes: string[]) => {
    if (line.words.length === 0 || graphemes.length === 0) {
        return [] as WordRange[];
    }

    const rangedWords = line.words.filter(word => splitGraphemes(word.text).length > 0);
    if (rangedWords.length === 0) {
        return [] as WordRange[];
    }
    const ranges: WordRange[] = [];
    let cursor = 0;

    for (let wordIndex = 0; wordIndex < rangedWords.length; wordIndex += 1) {
        const word = rangedWords[wordIndex]!;
        const wordGraphemes = splitGraphemes(word.text);
        const start = clamp(cursor, 0, graphemes.length);
        let end = clamp(start + wordGraphemes.length, start, graphemes.length);

        // Some lyric payloads omit inter-word spaces from word.text while fullText keeps them.
        // In that case, keep the visual stream contiguous by attaching immediately following
        // whitespace to the current word range instead of shifting every later word left.
        while (end < graphemes.length && /\s/.test(graphemes[end] ?? '')) {
            end += 1;
        }

        ranges.push({
            wordIndex,
            word,
            start,
            end,
            colorStart: start,
            colorEnd: end,
            graphemeTimings: buildWordGraphemeTimings(word),
        });
        cursor = end;
    }

    return ranges;
};

export const resolvePrintedGraphemeCount = (
    line: Line,
    wordRanges: WordRange[],
    graphemeCount: number,
    currentTimeValue: number,
) => {
    if (graphemeCount === 0) {
        return 0;
    }

    if (currentTimeValue < line.startTime) {
        return 0;
    }

    if (hasRevealCompletedByLineEnd(line, currentTimeValue)) {
        return graphemeCount;
    }

    if (wordRanges.length === 0) {
        const duration = Math.max(line.endTime - line.startTime, 0.12);
        const progress = clamp((currentTimeValue - line.startTime) / duration, 0, 1);
        return clamp(Math.floor(progress * graphemeCount + (progress > 0 ? 1 : 0)), 0, graphemeCount);
    }

    let printed = 0;
    for (let index = 0; index < wordRanges.length; index += 1) {
        const range = wordRanges[index]!;
        const partial = resolvePrintedGlyphsInRange(range, currentTimeValue);
        printed = range.start + partial;

        if (partial < range.end - range.start) {
            return clamp(printed, 0, graphemeCount);
        }
    }

    return clamp(printed, 0, graphemeCount);
};

export const resolvePrintedGraphemeProgress = (
    line: Line,
    wordRanges: WordRange[],
    graphemeCount: number,
    currentTimeValue: number,
) => {
    if (graphemeCount === 0) {
        return 0;
    }

    if (currentTimeValue < line.startTime) {
        return 0;
    }

    if (hasRevealCompletedByLineEnd(line, currentTimeValue)) {
        return graphemeCount;
    }

    if (wordRanges.length === 0) {
        const duration = Math.max(line.endTime - line.startTime, 0.12);
        const progress = clamp((currentTimeValue - line.startTime) / duration, 0, 1);
        return clamp(progress * graphemeCount, 0, graphemeCount);
    }

    let printed = 0;
    for (let index = 0; index < wordRanges.length; index += 1) {
        const range = wordRanges[index]!;
        if (currentTimeValue < range.word.startTime) {
            return clamp(printed, 0, graphemeCount);
        }

        const progress = resolveWordRevealProgress(range, currentTimeValue);
        const length = Math.max(range.end - range.start, 0);
        printed = range.start + progress * length;

        if (progress < 1) {
            return clamp(printed, 0, graphemeCount);
        }
    }

    return clamp(printed, 0, graphemeCount);
};