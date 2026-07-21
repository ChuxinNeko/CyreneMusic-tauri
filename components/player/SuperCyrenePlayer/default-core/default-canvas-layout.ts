import type { Line, Theme } from './default-types';
import { layoutWithLines, prepareWithSegments, type PreparedTextWithSegments, type LayoutCursor, type PrepareOptions } from '@chenglou/pretext';
import type { SegmentMeta, WordRange, RenderLineSlice, RenderSegmentSlice, DefaultBlock, DefaultArticleLayout, DefaultLayoutAttemptTiming } from './default-canvas-types';
import { DEFAULT_PRETEXT_OPTIONS } from './default-canvas-types';
import { clamp, splitGraphemes, isCJK, seeded, hashString, mix, nowMs, roundMs, createDefaultLayoutTiming } from './default-canvas-utils';
import { buildSegmentMetas, buildWordRangesFromWords } from './default-canvas-style';
import { buildWordGraphemeTimings } from './graphemeTiming';
import { resolveThemeFontStack } from './fontStacks';
import { getLineRenderEndTime } from './renderHints';

export const cursorToGlobalOffset = (cursor: LayoutCursor, segmentMetas: SegmentMeta[]) => {
    if (segmentMetas.length === 0) return 0;
    const segment = segmentMetas[cursor.segmentIndex];

    if (!segment) {
        return segmentMetas[segmentMetas.length - 1]!.graphemeEnd;
    }

    return clamp(segment.graphemeStart + cursor.graphemeIndex, segment.graphemeStart, segment.graphemeEnd);
};

export const getPartialSegmentWidth = (
    prepared: PreparedTextWithSegments,
    segmentIndex: number,
    segmentMeta: SegmentMeta,
    startOffset: number,
    endOffset: number,
) => {
    const localStart = clamp(startOffset - segmentMeta.graphemeStart, 0, segmentMeta.graphemeCount);
    const localEnd = clamp(endOffset - segmentMeta.graphemeStart, 0, segmentMeta.graphemeCount);

    if (localEnd <= localStart) return 0;
    if (localStart === 0 && localEnd === segmentMeta.graphemeCount) {
        return prepared.widths[segmentIndex] ?? 0;
    }

    const breakableFitAdvances = prepared.breakableFitAdvances[segmentIndex];
    if (breakableFitAdvances && breakableFitAdvances.length > 0) {
        let width = 0;
        for (let index = localStart; index < localEnd; index += 1) {
            width += breakableFitAdvances[index] ?? 0;
        }
        return width;
    }

    const fullWidth = prepared.widths[segmentIndex] ?? 0;
    if (segmentMeta.graphemeCount === 0) return fullWidth;
    return fullWidth * ((localEnd - localStart) / segmentMeta.graphemeCount);
};

export const widthBetweenOffsets = (
    prepared: PreparedTextWithSegments,
    segmentMetas: SegmentMeta[],
    startOffset: number,
    endOffset: number,
) => {
    if (endOffset <= startOffset) return 0;

    let width = 0;

    for (let segmentIndex = 0; segmentIndex < segmentMetas.length; segmentIndex += 1) {
        const meta = segmentMetas[segmentIndex]!;
        if (endOffset <= meta.graphemeStart) break;
        if (startOffset >= meta.graphemeEnd) continue;

        const sliceStart = Math.max(startOffset, meta.graphemeStart);
        const sliceEnd = Math.min(endOffset, meta.graphemeEnd);
        width += getPartialSegmentWidth(prepared, segmentIndex, meta, sliceStart, sliceEnd);
    }

    return width;
};

export const buildGlyphOffsets = (
    prepared: PreparedTextWithSegments,
    segmentMetas: SegmentMeta[],
    startOffset: number,
    graphemeCount: number,
) => {
    const offsets = new Array<number>(graphemeCount);
    for (let index = 0; index < graphemeCount; index += 1) {
        offsets[index] = widthBetweenOffsets(
            prepared,
            segmentMetas,
            startOffset,
            startOffset + index,
        );
    }
    return offsets;
};

export const resolveGlyphAdvance = (
    renderLine: RenderLineSlice,
    graphemeIndex: number,
) => {
    const currentOffset = renderLine.glyphOffsets[graphemeIndex] ?? 0;
    const nextOffset = graphemeIndex < renderLine.graphemes.length - 1
        ? (renderLine.glyphOffsets[graphemeIndex + 1] ?? renderLine.width)
        : renderLine.width;
    return Math.max(nextOffset - currentOffset, 0);
};

export const buildRenderSegments = (
    prepared: PreparedTextWithSegments,
    segmentMetas: SegmentMeta[],
    lineStart: number,
    lineEnd: number,
    fontSpec: string,
) => {
    const segments: RenderSegmentSlice[] = [];

    for (let segmentIndex = 0; segmentIndex < segmentMetas.length; segmentIndex += 1) {
        const meta = segmentMetas[segmentIndex]!;
        if (lineEnd <= meta.graphemeStart) {
            break;
        }
        if (lineStart >= meta.graphemeEnd) {
            continue;
        }

        const start = Math.max(lineStart, meta.graphemeStart);
        const end = Math.min(lineEnd, meta.graphemeEnd);
        if (end <= start) {
            continue;
        }

        const localStart = start - lineStart;
        const localEnd = end - lineStart;
        const segmentText = prepared.segments[segmentIndex] ?? '';
        const segmentGraphemes = splitGraphemes(segmentText);
        const text = start === meta.graphemeStart && end === meta.graphemeEnd
            ? segmentText
            : segmentGraphemes.slice(start - meta.graphemeStart, end - meta.graphemeStart).join('');
        const measuredGlyphOffsets = measureSegmentGlyphOffsets(text, fontSpec);

        segments.push({
            text,
            start,
            end,
            localStart,
            localEnd,
            x: widthBetweenOffsets(prepared, segmentMetas, lineStart, start),
            width: widthBetweenOffsets(prepared, segmentMetas, start, end),
            isFullSegment: start === meta.graphemeStart && end === meta.graphemeEnd,
            measuredGlyphOffsets,
        });
    }

    return segments;
};

export const buildFontSpec = (
    fontPx: number,
    variant: 'body' | 'hero',
    fontFamily: string,
) => {
    const fontWeight = variant === 'hero' ? 780 : 640;
    return `${fontWeight} ${fontPx}px ${fontFamily}`;
};

let segmentMeasureCanvas: HTMLCanvasElement | null = null;
const segmentMeasureCache = new Map<string, number[]>();

export const measureSegmentGlyphOffsets = (
    text: string,
    fontSpec: string,
) => {
    const cacheKey = `${fontSpec}__${text}`;
    const cached = segmentMeasureCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const graphemes = splitGraphemes(text);
    const offsets = new Array<number>(graphemes.length + 1).fill(0);
    if (typeof document === 'undefined') {
        return offsets;
    }

    if (!segmentMeasureCanvas) {
        segmentMeasureCanvas = document.createElement('canvas');
    }

    const context = segmentMeasureCanvas.getContext('2d');
    if (!context) {
        return offsets;
    }

    context.font = fontSpec;
    for (let index = 1; index <= graphemes.length; index += 1) {
        offsets[index] = context.measureText(graphemes.slice(0, index).join('')).width;
    }

    segmentMeasureCache.set(cacheKey, offsets);
    return offsets;
};

export const buildWordRangeIndexByOffset = (
    graphemeCount: number,
    wordRanges: WordRange[],
    rangeKind: 'timing' | 'color' = 'timing',
) => {
    const indices = new Array<number>(graphemeCount).fill(-1);
    for (let rangeIndex = 0; rangeIndex < wordRanges.length; rangeIndex += 1) {
        const range = wordRanges[rangeIndex]!;
        const start = rangeKind === 'color' ? range.colorStart : range.start;
        const end = rangeKind === 'color' ? range.colorEnd : range.end;
        for (let offset = start; offset < end && offset < graphemeCount; offset += 1) {
            indices[offset] = rangeIndex;
        }
    }
    return indices;
};

export const countRenderableGraphemes = (text: string) => (
    splitGraphemes(text).filter(value => value.trim().length > 0).length
);

export const chooseNaturalBlockVariant = (line: Line, index: number, total: number) => {
    const graphemeCount = countRenderableGraphemes(line.fullText);
    if (graphemeCount === 0) {
        return 'body' as const;
    }

    if (line.isChorus && graphemeCount <= 22) {
        return 'hero' as const;
    }

    const shortEnough = graphemeCount >= 4 && graphemeCount <= 28;
    const centered = Math.abs(index - total / 2) / Math.max(total, 1);
    const random = seeded(`${line.fullText}:${index}`);
    return shortEnough && centered < 0.72 && ((index + 1) % 6 === 0 || random > 0.965)
        ? 'hero'
        : 'body';
};

export const chooseFallbackHeroBlockIndex = (
    entries: Array<{ line: Line; index: number; }>,
) => {
    if (entries.length === 0) {
        return -1;
    }

    const hasNaturalHero = entries.some(({ line }, blockIndex) => (
        chooseNaturalBlockVariant(line, blockIndex, entries.length) === 'hero'
    ));
    if (hasNaturalHero) {
        return -1;
    }

    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    entries.forEach(({ line }, blockIndex) => {
        const graphemeCount = countRenderableGraphemes(line.fullText);
        if (graphemeCount === 0) {
            return;
        }

        const isComfortableHeroLength = graphemeCount >= 4 && graphemeCount <= 28;
        const isAcceptableFallbackLength = graphemeCount <= 36;
        if (!isComfortableHeroLength && !isAcceptableFallbackLength) {
            return;
        }

        const centered = Math.abs(blockIndex - entries.length / 2) / Math.max(entries.length, 1);
        const centerScore = 1 - centered;
        const lengthScore = graphemeCount >= 6 && graphemeCount <= 22
            ? 1
            : graphemeCount <= 28
                ? 0.72
                : 0.36;
        const chorusScore = line.isChorus ? 0.28 : 0;
        const stableJitter = seeded(`${line.fullText}:${blockIndex}:fallback-hero`) * 0.04;
        const score = centerScore * 0.62 + lengthScore * 0.34 + chorusScore + stableJitter;

        if (score > bestScore) {
            bestScore = score;
            bestIndex = blockIndex;
        }
    });

    if (bestIndex >= 0) {
        return bestIndex;
    }

    let shortestIndex = -1;
    let shortestCount = Number.POSITIVE_INFINITY;
    entries.forEach(({ line }, blockIndex) => {
        const graphemeCount = countRenderableGraphemes(line.fullText);
        if (graphemeCount > 0 && graphemeCount < shortestCount) {
            shortestCount = graphemeCount;
            shortestIndex = blockIndex;
        }
    });

    return shortestIndex;
};

export const chooseBlockVariant = (
    line: Line,
    index: number,
    total: number,
    forcedHeroIndex: number,
) => (
    index === forcedHeroIndex
        ? 'hero'
        : chooseNaturalBlockVariant(line, index, total)
);

export const chooseFontPx = (
    line: Line,
    variant: 'body' | 'hero',
    width: number,
    lyricsFontScale: number,
    densityScale: number,
) => {
    const graphemeCount = Math.max(countRenderableGraphemes(line.fullText), 1);
    const density = graphemeCount + line.words.length * 1.4;
    const base = variant === 'hero'
        ? width / Math.max(Math.sqrt(density) * 1.5, 4.5)
        : width / Math.max(Math.sqrt(density) * 2.25, 7);

    const scaled = base * lyricsFontScale * densityScale;
    return variant === 'hero'
        ? clamp(scaled, 24, 54)
        : clamp(scaled, 14, 28);
};

export const buildPreparedSingleLine = (
    text: string,
    fontFamily: string,
    width: number,
    variant: 'body' | 'hero',
    lyricsFontScale: number,
    densityScale: number,
    heroScale: number,
) => {
    let low = variant === 'hero' ? 18 : 10;
    let high = variant === 'hero' ? 58 : 30;
    let best: {
        fontPx: number;
        prepared: PreparedTextWithSegments;
        layout: ReturnType<typeof layoutWithLines>;
    } | null = null;

    // Default really wants most blocks to stay single-line when possible.
    // So do a tiny binary search for a font size that still fits before falling back.
    for (let iteration = 0; iteration < 8; iteration += 1) {
        const candidateFontPx = ((low + high) / 2)
            * lyricsFontScale
            * densityScale
            * (variant === 'hero' ? heroScale : 1);
        const fontSpec = buildFontSpec(candidateFontPx, variant, fontFamily);
        const prepared = prepareWithSegments(text, fontSpec, DEFAULT_PRETEXT_OPTIONS);
        const layout = layoutWithLines(prepared, width, Math.round(candidateFontPx * (variant === 'hero' ? 1.02 : 1.06)));

        if (layout.lineCount <= 1) {
            best = {
                fontPx: candidateFontPx,
                prepared,
                layout,
            };
            low = (low + high) / 2;
        } else {
            high = (low + high) / 2;
        }
    }

    if (best) {
        return best;
    }

    const fallbackFontPx = (variant === 'hero' ? 18 : 10)
        * lyricsFontScale
        * densityScale
        * (variant === 'hero' ? heroScale : 1);
    const fontSpec = buildFontSpec(fallbackFontPx, variant, fontFamily);
    const prepared = prepareWithSegments(text, fontSpec, DEFAULT_PRETEXT_OPTIONS);
    return {
        fontPx: fallbackFontPx,
        prepared,
        layout: layoutWithLines(prepared, width, Math.round(fallbackFontPx * (variant === 'hero' ? 1.02 : 1.06))),
    };
};

export const buildLayoutCacheKey = (
    lines: Line[],
    viewport: { width: number; height: number },
    layoutTheme: Pick<Theme, 'name' | 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>,
    lyricsFontScale: number,
    defaultTuning: { heroScale: number },
) => {
    // Layout cache key intentionally ignores short-lived playback state.
    // Only geometry-affecting inputs should invalidate the whole article layout.
    let linesHash = 2166136261;
    for (const line of lines) {
        const lineKey = `${line.startTime}:${line.endTime}:${line.fullText}:${line.words.length}:${line.isChorus ? 1 : 0}`;
        linesHash ^= hashString(lineKey);
        linesHash = Math.imul(linesHash, 16777619);
    }

    return [
        Math.round(viewport.width),
        Math.round(viewport.height),
        layoutTheme.fontStyle,
        layoutTheme.fontFamily ?? '',
        layoutTheme.fontFamilyStack?.join(',') ?? '',
        layoutTheme.name,
        lyricsFontScale.toFixed(4),
        defaultTuning.heroScale.toFixed(4),
        lines.length,
        linesHash >>> 0,
    ].join('|');
};