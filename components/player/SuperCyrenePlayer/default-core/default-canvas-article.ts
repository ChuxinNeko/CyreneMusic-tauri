import type { Line, Theme, DefaultTuning } from './default-types';
import type { layoutWithLines, PreparedTextWithSegments } from '@chenglou/pretext';
import type {
    DefaultBlock, DefaultPaperBounds, DefaultArticleLayout, DefaultArticleLayoutMetrics,
    DefaultLayoutAttemptOptions, DefaultLayoutAttemptTiming, ViewportSize
} from './default-canvas-types';
import { DEFAULT_PRETEXT_OPTIONS } from './default-canvas-types';
import {
    clamp, splitGraphemes, isCJK, seeded, hashString, mix, nowMs, roundMs,
    createDefaultLayoutTiming
} from './default-canvas-utils';
import { buildSegmentMetas, buildWordRangesFromWords } from './default-canvas-style';
import {
    buildGlyphOffsets, buildRenderSegments, buildFontSpec, buildWordRangeIndexByOffset,
    countRenderableGraphemes, chooseBlockVariant, chooseFallbackHeroBlockIndex,
    chooseFontPx, buildPreparedSingleLine, buildLayoutCacheKey,
    cursorToGlobalOffset, widthBetweenOffsets
} from './default-canvas-layout';
import { resolveThemeFontStack } from './fontStacks';
import { getLineRenderEndTime } from './renderHints';

export let lastDefaultLayoutCache: {
    key: string;
    article: DefaultArticleLayout | null;
} | null = null;

export const setLayoutCache = (cache: { key: string; article: DefaultArticleLayout | null } | null) => {
    lastDefaultLayoutCache = cache;
};

function buildArticleLayoutAttempt(
    lines: Line[],
    viewport: ViewportSize,
    layoutTheme: Pick<Theme, 'name' | 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>,
    lyricsFontScale: number,
    defaultTuning: DefaultTuning,
    options: DefaultLayoutAttemptOptions & { mode: 'measure' },
): DefaultArticleLayoutMetrics | null;
function buildArticleLayoutAttempt(
    lines: Line[],
    viewport: ViewportSize,
    layoutTheme: Pick<Theme, 'name' | 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>,
    lyricsFontScale: number,
    defaultTuning: DefaultTuning,
    options: DefaultLayoutAttemptOptions & { mode?: 'render' },
): DefaultArticleLayout | null;
function buildArticleLayoutAttempt(
    lines: Line[],
    viewport: ViewportSize,
    layoutTheme: Pick<Theme, 'name' | 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>,
    lyricsFontScale: number,
    defaultTuning: DefaultTuning,
    options: DefaultLayoutAttemptOptions,
): DefaultArticleLayout | DefaultArticleLayoutMetrics | null {
    if (viewport.width <= 0 || viewport.height <= 0 || lines.length === 0) {
        return null;
    }

    const {
        paperWidth,
        viewportHeight,
        columns,
        gap,
        densityScale,
        seedKey,
        mode = 'render',
        timing,
    } = options;
    const shouldBuildRenderDetails = mode === 'render';
    const horizontalMargin = Math.max(viewport.width * 0.86, 280);
    const verticalMargin = Math.max(viewport.height * 0.82, 220);
    const columnWidth = (paperWidth - gap * (columns - 1)) / columns;
    const fontFamily = resolveThemeFontStack(layoutTheme);
    // Empty lines do not help the article layout.
    // Also shuffle placement order deterministically so the paper feels composed rather than strictly chronological.
    const filteredLines = lines
        .map((line, index) => ({ line, index }))
        .filter(entry => entry.line.fullText.trim().length > 0)
        .sort((left, right) => {
            const leftSeed = seeded(`${seedKey}:${left.index}:${left.line.fullText}`);
            const rightSeed = seeded(`${seedKey}:${right.index}:${right.line.fullText}`);
            return leftSeed - rightSeed;
        });

    const blocks: DefaultBlock[] = [];
    const columnHeights = Array.from({ length: columns }, () => verticalMargin);
    let bodyColumnTieCursor = 0;
    let heroPlacementTieCursor = 0;
    const forcedHeroIndex = chooseFallbackHeroBlockIndex(filteredLines);

    filteredLines.forEach(({ line, index }, blockIndex) => {
        timing && (timing.lines += 1);
        const variant = chooseBlockVariant(line, blockIndex, filteredLines.length, forcedHeroIndex);
        // Hero blocks are allowed to claim more visual territory.
        // Body blocks should stay narrow so the article still reads like columns.
        const heroSpanColumns = variant === 'hero'
            ? Math.min(columns, columns <= 1 ? 1 : 2)
            : 1;
        const heroSpanWidth = heroSpanColumns > 1
            ? columnWidth * heroSpanColumns + gap * (heroSpanColumns - 1)
            : paperWidth;
        const blockWidth = variant === 'hero'
            ? heroSpanColumns === 1
                ? paperWidth
                : columns === 2
                    ? columnWidth * 1.5 + gap * 0.5
                    : heroSpanWidth
            : columnWidth;
        const paddingX = 0;
        const paddingY = 0;
        const innerWidth = Math.max(blockWidth - paddingX * 2, 120);
        const prepareLayoutStart = timing ? nowMs() : 0;
        const preparedSingleLine = buildPreparedSingleLine(
            line.fullText,
            fontFamily,
            innerWidth,
            variant,
            lyricsFontScale,
            densityScale,
            defaultTuning.heroScale,
        );
        if (timing) {
            timing.prepareLayoutMs += nowMs() - prepareLayoutStart;
        }
        const fontPx = preparedSingleLine.fontPx;
        const lineHeight = Math.round(fontPx * (variant === 'hero' ? 1.02 : 1.06));
        const layout = preparedSingleLine.layout;
        const blockGap = variant === 'hero'
            ? Math.max(Math.round(lineHeight * 0.2), 6)
            : Math.max(Math.round(lineHeight * 0.08), 2);
        const blockHeight = paddingY * 2 + layout.lines.length * lineHeight;
        let x = 0;
        let y = 0;
        const placementStart = timing ? nowMs() : 0;

        if (variant === 'hero') {
            // Hero placement tries to find the calmest large slot across multiple columns.
            if (heroSpanColumns === 1) {
                y = Math.max(...columnHeights);
                x = horizontalMargin;
                columnHeights[0] = y + blockHeight + blockGap;
            } else {
                let bestHeight = Number.POSITIVE_INFINITY;
                let candidateStarts: number[] = [];

                for (let startColumn = 0; startColumn <= columns - heroSpanColumns; startColumn += 1) {
                    let coveredHeight = 0;
                    for (let columnIndex = startColumn; columnIndex < startColumn + heroSpanColumns; columnIndex += 1) {
                        coveredHeight = Math.max(coveredHeight, columnHeights[columnIndex] ?? 0);
                    }

                    if (coveredHeight < bestHeight) {
                        bestHeight = coveredHeight;
                        candidateStarts = [startColumn];
                    } else if (coveredHeight === bestHeight) {
                        candidateStarts.push(startColumn);
                    }
                }

                const targetStart = candidateStarts.length > 0
                    ? candidateStarts[heroPlacementTieCursor % candidateStarts.length]!
                    : 0;
                heroPlacementTieCursor += 1;
                y = bestHeight;
                x = horizontalMargin
                    + targetStart * (columnWidth + gap)
                    + Math.max((heroSpanWidth - blockWidth) * 0.5, 0);

                for (let columnIndex = targetStart; columnIndex < targetStart + heroSpanColumns; columnIndex += 1) {
                    columnHeights[columnIndex] = y + blockHeight + blockGap;
                }
            }
        } else {
            // Body placement is simpler: drop into the currently shortest column.
            let targetColumn = 0;
            let minHeight = columnHeights[0] ?? 0;
            const candidateColumns = [0];

            for (let columnIndex = 1; columnIndex < columns; columnIndex += 1) {
                const height = columnHeights[columnIndex] ?? 0;

                if (height < minHeight) {
                    minHeight = height;
                    candidateColumns.length = 0;
                    candidateColumns.push(columnIndex);
                } else if (height === minHeight) {
                    candidateColumns.push(columnIndex);
                }
            }

            targetColumn = candidateColumns[bodyColumnTieCursor % candidateColumns.length] ?? 0;
            bodyColumnTieCursor += 1;
            x = horizontalMargin + targetColumn * (columnWidth + gap);
            y = columnHeights[targetColumn]!;
            columnHeights[targetColumn] = y + blockHeight + blockGap;
        }
        if (timing) {
            timing.placementMs += nowMs() - placementStart;
        }

        if (shouldBuildRenderDetails) {
            // Measure-only passes stop before this point.
            // Render passes continue and build every structure needed for glyph printing and per-line focus.
            const renderDetailsStart = timing ? nowMs() : 0;
            const prepared = preparedSingleLine.prepared;
            const fontSpec = buildFontSpec(fontPx, variant, fontFamily);
            const { graphemes, segmentMetas } = buildSegmentMetas(prepared);
            const wordRanges = buildWordRangesFromWords(line, graphemes);
            const wordRangeIndexByOffset = buildWordRangeIndexByOffset(graphemes.length, wordRanges);
            const colorRangeIndexByOffset = buildWordRangeIndexByOffset(graphemes.length, wordRanges, 'color');
            const renderLines = layout.lines.map((layoutLine, lineIndex) => {
                const start = cursorToGlobalOffset(layoutLine.start, segmentMetas);
                const end = cursorToGlobalOffset(layoutLine.end, segmentMetas);
                const lineGraphemes = splitGraphemes(layoutLine.text);

                return {
                    id: `${line.startTime}-${lineIndex}`,
                    text: layoutLine.text,
                    start,
                    end,
                    graphemes: lineGraphemes,
                    glyphOffsets: buildGlyphOffsets(
                        prepared,
                        segmentMetas,
                        start,
                        lineGraphemes.length,
                    ),
                    segments: buildRenderSegments(
                        prepared,
                        segmentMetas,
                        start,
                        end,
                        fontSpec,
                    ),
                    left: variant === 'hero'
                        ? Math.max((blockWidth - layoutLine.width) * 0.08, 0)
                        : 0,
                    top: paddingY + lineIndex * lineHeight,
                    width: layoutLine.width,
                };
            });

            blocks.push({
                id: `default-${line.startTime}-${index}`,
                sourceLineIndex: index,
                line,
                variant,
                x,
                y,
                width: blockWidth,
                height: blockHeight,
                innerWidth,
                fontPx,
                lineHeight,
                prepared,
                layout,
                graphemes,
                segmentMetas,
                wordRanges,
                wordRangeIndexByOffset,
                colorRangeIndexByOffset,
                renderLines,
            });
            if (timing) {
                timing.renderDetailsMs += nowMs() - renderDetailsStart;
            }
        }
    });

    const articleHeight = Math.max(0, ...columnHeights) + verticalMargin;

    const metrics = {
        width: paperWidth + horizontalMargin * 2,
        height: articleHeight,
        viewportHeight,
        columns,
        gap,
        paperBounds: {
            left: horizontalMargin,
            top: verticalMargin,
            right: horizontalMargin + paperWidth,
            bottom: Math.max(articleHeight - verticalMargin, verticalMargin),
        },
    };

    if (!shouldBuildRenderDetails) {
        return metrics;
    }

    const chronologicalBlocks = [...blocks].sort((left, right) => left.sourceLineIndex - right.sourceLineIndex);
    const blockBySourceLineIndex = new Map<number, DefaultBlock>();
    for (const block of chronologicalBlocks) {
        blockBySourceLineIndex.set(block.sourceLineIndex, block);
    }
    const firstRenderableStartTime = chronologicalBlocks[0]?.line.startTime ?? Number.POSITIVE_INFINITY;
    const lastChronologicalRenderEndTime = chronologicalBlocks.length > 0
        ? getLineRenderEndTime(chronologicalBlocks[chronologicalBlocks.length - 1]!.line)
        : Number.NEGATIVE_INFINITY;

    return {
        ...metrics,
        blocks,
        blockBySourceLineIndex,
        chronologicalBlocks,
        firstRenderableStartTime,
        lastChronologicalRenderEndTime,
    };
}

export const buildArticleLayout = (
    lines: Line[],
    viewport: ViewportSize,
    layoutTheme: Pick<Theme, 'name' | 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>,
    lyricsFontScale: number,
    defaultTuning: DefaultTuning,
): DefaultArticleLayout | null => {
    if (viewport.width <= 0 || viewport.height <= 0 || lines.length === 0) {
        return null;
    }

    const paperWidth = clamp(Math.max(viewport.width * 1.95, viewport.width + 520), 920, 2400);
    const viewportHeight = Math.max(viewport.height, 240);
    const maxColumns = paperWidth >= 1120 ? 4 : paperWidth >= 760 ? 3 : paperWidth >= 500 ? 2 : 1;
    const targetHeight = viewportHeight * 2.45;
    const layoutSeedKey = layoutTheme.name;

    let bestOptions: (DefaultLayoutAttemptOptions & { mode: 'render' }) | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestHeight = 0;
    const totalStart = nowMs();
    const measureTiming = createDefaultLayoutTiming();
    const renderTiming = createDefaultLayoutTiming();
    const measureColumnTimings = new Map<number, DefaultLayoutAttemptTiming>();
    let measureAttemptCount = 0;

    // Try a few column counts and density scales, then keep the article that lands closest to the target height.
    // This is why the mode feels "composed" instead of hardcoding one layout recipe for every song.
    for (let columns = maxColumns; columns >= 1; columns -= 1) {
        let low = 0.82;
        let high = 1.42;
        const gap = clamp(Math.round(paperWidth * (columns >= 4 ? 0.0065 : columns === 3 ? 0.0085 : 0.0115)), 6, 14);
        const columnTiming = createDefaultLayoutTiming();
        measureColumnTimings.set(columns, columnTiming);

        for (let iteration = 0; iteration < 8; iteration += 1) {
            const densityScale = (low + high) / 2;
            measureAttemptCount += 1;
            const attemptOptions: DefaultLayoutAttemptOptions & { mode: 'measure' } = {
                paperWidth,
                viewportHeight,
                columns,
                gap,
                densityScale,
                seedKey: `${layoutSeedKey}:${columns}:${paperWidth}`,
                mode: 'measure',
                timing: columnTiming,
            };
            const layout = buildArticleLayoutAttempt(lines, viewport, layoutTheme, lyricsFontScale, defaultTuning, attemptOptions);

            if (!layout) {
                continue;
            }

            const coveragePenalty = Math.abs(layout.height - targetHeight);
            const overflowPenalty = layout.height < targetHeight ? 0 : (layout.height - targetHeight) * 0.14;
            const score = coveragePenalty + overflowPenalty;

            if (score < bestScore) {
                bestScore = score;
                bestHeight = layout.height;
                bestOptions = {
                    paperWidth,
                    viewportHeight,
                    columns,
                    gap,
                    densityScale,
                    seedKey: `${layoutSeedKey}:${columns}:${paperWidth}`,
                    mode: 'render',
                    timing: renderTiming,
                };
            }

            if (layout.height < targetHeight) {
                low = densityScale;
            } else {
                high = densityScale;
            }
        }

        measureTiming.lines += columnTiming.lines;
        measureTiming.prepareLayoutMs += columnTiming.prepareLayoutMs;
        measureTiming.placementMs += columnTiming.placementMs;
        measureTiming.renderDetailsMs += columnTiming.renderDetailsMs;
    }

    const renderStart = nowMs();
    const article = bestOptions
        ? buildArticleLayoutAttempt(lines, viewport, layoutTheme, lyricsFontScale, defaultTuning, bestOptions)
        : null;
    const renderMs = nowMs() - renderStart;
    const totalMs = nowMs() - totalStart;

    if (process.env.NODE_ENV === 'development') {
        console.info('[VisualizerDefault] layout timing', {
            totalMs: roundMs(totalMs),
            measureMs: roundMs(measureTiming.prepareLayoutMs + measureTiming.placementMs),
            renderMs: roundMs(renderMs),
            attempts: measureAttemptCount,
            measuredLines: measureTiming.lines,
            renderedLines: renderTiming.lines,
            inputLines: lines.length,
            blocks: article?.blocks.length ?? 0,
            heroBlocks: article?.blocks.filter(block => block.variant === 'hero').length ?? 0,
            viewport: `${Math.round(viewport.width)}x${Math.round(viewport.height)}`,
            paperWidth: Math.round(paperWidth),
            targetHeight: Math.round(targetHeight),
            bestHeight: Math.round(bestHeight),
            finalHeight: Math.round(article?.height ?? 0),
            heightDelta: Math.round((article?.height ?? 0) - targetHeight),
            bestColumns: bestOptions?.columns ?? null,
            bestDensityScale: bestOptions ? Number(bestOptions.densityScale.toFixed(4)) : null,
            measureBreakdown: {
                prepareLayoutMs: roundMs(measureTiming.prepareLayoutMs),
                placementMs: roundMs(measureTiming.placementMs),
                renderDetailsMs: roundMs(measureTiming.renderDetailsMs),
            },
            renderBreakdown: {
                prepareLayoutMs: roundMs(renderTiming.prepareLayoutMs),
                placementMs: roundMs(renderTiming.placementMs),
                renderDetailsMs: roundMs(renderTiming.renderDetailsMs),
            },
            measureByColumns: Array.from(measureColumnTimings.entries()).map(([columns, timing]) => ({
                columns,
                lines: timing.lines,
                prepareLayoutMs: roundMs(timing.prepareLayoutMs),
                placementMs: roundMs(timing.placementMs),
            })),
        });
    }

    return article;
};