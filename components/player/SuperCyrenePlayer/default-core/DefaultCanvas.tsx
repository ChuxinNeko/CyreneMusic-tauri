/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionValue } from 'framer-motion';
import { Hourglass } from 'lucide-react';
import { AudioBands, DEFAULT_DEFAULT_TUNING, DefaultTuning, Line, Theme } from './default-types';
import { getLineRenderEndTime } from './renderHints';
import { colorWithAlpha, mixColors, clearColorCache } from './colorMix';
import type { VisualizerSharedProps } from './default-definition';
import { buildDefaultBackgroundScene, drawDefaultBackground, type DefaultBackgroundAudioLevels } from './DefaultBackground';
import { getRecentCompletedLine, getUpcomingLines } from './default-runtime';
import VisualizerShell from './DefaultShell';
import VisualizerSubtitleOverlay from './DefaultSubtitleOverlay';
import { clearWordColorCache } from './wordColoring';
import { findTimelineLine } from './default-timeline';

// From extracted modules
import type {
    VisualizerProps, ViewportSize, DefaultBlock, DefaultArticleLayout,
    StaticBlockSnapshot, CameraTarget, CameraRetargetState, CameraViewTarget,
} from './default-canvas-types';
import {
    CAMERA_SCALE_MIN, CAMERA_SCALE_MAX, OVERVIEW_CAMERA_SOURCE,
    LAYOUT_REBUILD_DEBOUNCE_MS, DEFAULT_BACKGROUND_PARALLAX_X,
    DEFAULT_BACKGROUND_PARALLAX_Y, DEFAULT_BACKGROUND_SCALE_FACTOR,
    DEFAULT_BACKGROUND_VERTICAL_OFFSET_RATIO,
} from './default-canvas-types';
import {
    clamp, mix, easeInOutCubic, easeOutCubic, resolveDelayedGlowEnvelope,
    isCJK, getActiveColor, quadraticBezier,
} from './default-canvas-utils';
import {
    resolvePassedTextStyle, resolvePassedDimAmount, resolveDefaultPassedFadeDuration,
    resolveLinePassCutoffTime, resolveVisualProgressWithCutoff,
    resolvePrintedGraphemeCount, resolvePrintedGraphemeProgress,
    buildWordRangesFromWords,
} from './default-canvas-style';
import {
    buildCanvasFont, buildTextStyleKey, resolveRenderLineOffset,
    resolveSegmentGlyphOffset, resolveSegmentGlyphAdvance,
    drawRenderTextRun, createStaticBlockSnapshot,
} from './default-canvas-render';
import { buildArticleLayout, lastDefaultLayoutCache, setLayoutCache } from './default-canvas-article';
import { buildLayoutCacheKey } from './default-canvas-layout';
import {
    resolveSteppedBlockFocusPoint, resolveSmoothBlockFocusPoint,
    resolveBlockEntryFocusPoint, resolveCameraScaleForBlock,
    resolveCameraRetargetDuration, resolveOverviewRetargetDuration,
    resolveOverviewFlightBridge, resolveArticleOverviewCamera, resolveFocusBlock,
} from './default-canvas-focus';

const VisualizerDefault: React.FC<VisualizerProps> = (props) => {
    const {
        currentTime,
        currentLineIndex,
        lines,
        theme,
        subtitleTheme,
        audioPower,
        audioBands,
        showText = true,
        seed,
        staticMode = false,
        lyricsFontScale = 1,
        defaultTuning,
        subtitleOverlayOpacity,
        subtitleOverlayBackground,
        isPlayerChromeHidden = false,
        hideTranslationSubtitle = false,
        showSubtitleTranslation = true,
        paused = false,
    } = props;
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const cameraInitializedRef = useRef(false);
    const cameraRetargetRef = useRef<CameraRetargetState>({
        sourceLineIndex: -1,
        startedAt: 0,
        duration: 0.18,
        fromX: 0,
        fromY: 0,
        fromScale: 1,
        bridgeMode: 'none',
        bridgeWaypointX: 0,
        bridgeWaypointY: 0,
        bridgeWaypointScale: 1,
        bridgeWaypointPhase: 0.36,
    });
    const cameraRef = useRef<CameraTarget>({
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0,
        focusX: 0,
        focusY: 0,
        scale: 1,
        velocityScale: 0,
        focusScale: 1,
    });
    const staticBlockSnapshotCacheRef = useRef<Map<string, StaticBlockSnapshot>>(new Map());
    const layoutBuildVersionRef = useRef(0);
    const hasResolvedArticleRef = useRef(false);
    const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
    const [article, setArticle] = useState<DefaultArticleLayout | null>(null);
    const [isLayoutPending, setIsLayoutPending] = useState(false);
    const [hasPrintedContent, setHasPrintedContent] = useState(false);
    const hasPrintedContentRef = useRef(false);

    useEffect(() => {
        const element = viewportRef.current;
        if (!element) {
            return;
        }

        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) return;
            const nextWidth = entry.contentRect.width;
            const nextHeight = entry.contentRect.height;
            setViewport(previous => (
                previous.width === nextWidth && previous.height === nextHeight
                    ? previous
                    : { width: nextWidth, height: nextHeight }
            ));
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const runtime = useMemo(() => {
        const activeLine = lines[currentLineIndex] ?? null;
        const timeNow = currentTime.get();
        return {
            activeLine,
            recentCompletedLine: getRecentCompletedLine({
                lines,
                currentLineIndex,
                currentTime: timeNow,
                getLineEndTime: getLineRenderEndTime,
            }),
            nextLines: getUpcomingLines(lines, currentLineIndex, 2),
        };
    }, [currentLineIndex, lines]);
    const resolvedDefaultTuning = useMemo<DefaultTuning>(() => ({
        hidePrintSymbols: defaultTuning?.hidePrintSymbols ?? DEFAULT_DEFAULT_TUNING.hidePrintSymbols,
        disableGeometricBackground: defaultTuning?.disableGeometricBackground ?? DEFAULT_DEFAULT_TUNING.disableGeometricBackground,
        backgroundObjectOpacity: clamp(
            defaultTuning?.backgroundObjectOpacity ?? DEFAULT_DEFAULT_TUNING.backgroundObjectOpacity,
            0,
            1,
        ),
        textHoldRatio: clamp(defaultTuning?.textHoldRatio ?? DEFAULT_DEFAULT_TUNING.textHoldRatio, 0, 1),
        cameraTrackingMode: defaultTuning?.cameraTrackingMode === 'stepped' || defaultTuning?.cameraTrackingMode === 'smooth'
            ? defaultTuning.cameraTrackingMode
            : DEFAULT_DEFAULT_TUNING.cameraTrackingMode,
        cameraSpeed: clamp(defaultTuning?.cameraSpeed ?? DEFAULT_DEFAULT_TUNING.cameraSpeed, 0.55, 1.85),
        glowIntensity: clamp(defaultTuning?.glowIntensity ?? DEFAULT_DEFAULT_TUNING.glowIntensity, 0, 1.8),
        heroScale: clamp(defaultTuning?.heroScale ?? DEFAULT_DEFAULT_TUNING.heroScale, 0.82, 1.32),
    }), [defaultTuning]);
    const layoutTheme = useMemo(
        () => ({
            name: theme.name,
            fontStyle: theme.fontStyle,
            fontFamily: theme.fontFamily,
            fontFamilyStack: theme.fontFamilyStack,
        }),
        [theme.fontFamily, theme.fontFamilyStack, theme.fontStyle, theme.name],
    );
    const layoutDefaultTuning = useMemo<DefaultTuning>(() => ({
        ...DEFAULT_DEFAULT_TUNING,
        heroScale: resolvedDefaultTuning.heroScale,
    }), [resolvedDefaultTuning.heroScale]);

    useEffect(() => {
        const requestVersion = layoutBuildVersionRef.current + 1;
        layoutBuildVersionRef.current = requestVersion;

        if (viewport.width <= 0 || viewport.height <= 0 || lines.length === 0) {
            hasResolvedArticleRef.current = false;
            setArticle(null);
            setIsLayoutPending(false);
            return;
        }

        setIsLayoutPending(true);

        let rafId = 0;
        let timeoutId = 0;
        const delay = hasResolvedArticleRef.current ? LAYOUT_REBUILD_DEBOUNCE_MS : 0;

        rafId = window.requestAnimationFrame(() => {
            timeoutId = window.setTimeout(() => {
                if (layoutBuildVersionRef.current !== requestVersion) {
                    return;
                }

                const layoutCacheKey = buildLayoutCacheKey(lines, viewport, layoutTheme, lyricsFontScale, layoutDefaultTuning);
                const nextArticle = lastDefaultLayoutCache?.key === layoutCacheKey
                    ? lastDefaultLayoutCache.article
                    : buildArticleLayout(lines, viewport, layoutTheme, lyricsFontScale, layoutDefaultTuning);
                if (layoutBuildVersionRef.current !== requestVersion) {
                    return;
                }

                setLayoutCache({
                    key: layoutCacheKey,
                    article: nextArticle,
                });
                hasResolvedArticleRef.current = nextArticle !== null;
                setArticle(nextArticle);
                setIsLayoutPending(false);
            }, delay);
        });

        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(timeoutId);
        };
    }, [layoutDefaultTuning, layoutTheme, lines, lyricsFontScale, viewport]);
    const lastRenderableLine = useMemo(() => {
        for (let index = lines.length - 1; index >= 0; index -= 1) {
            const line = lines[index];
            if (line?.fullText.trim().length) {
                return line;
            }
        }
        return null;
    }, [lines]);
    const overviewStartTime = useMemo(() => {
        if (!lastRenderableLine) {
            return Number.POSITIVE_INFINITY;
        }

        const lineStartTime = lastRenderableLine.startTime;
        const lineRenderEndTime = getLineRenderEndTime(lastRenderableLine);
        return lineStartTime + Math.max(lineRenderEndTime - lineStartTime, 0) * 0.5;
    }, [lastRenderableLine]);
    const backgroundScene = useMemo(
        () => buildDefaultBackgroundScene({
            viewport,
            world: {
                width: article?.width ?? Math.max(viewport.width * 1.8, viewport.width),
                height: article?.height ?? Math.max(viewport.height * 1.8, viewport.height),
            },
            paperBounds: article?.paperBounds,
            seed: `${seed ?? 'default'}:${theme.name}`,
        }),
        [article?.height, article?.paperBounds, article?.width, seed, theme.name, viewport],
    );
    const overviewCamera = useMemo(
        () => (article ? resolveArticleOverviewCamera(article, viewport) : null),
        [article, viewport],
    );
    const cameraSpeed = resolvedDefaultTuning.cameraSpeed;
    const glowIntensity = resolvedDefaultTuning.glowIntensity;
    const backgroundObjectOpacity = resolvedDefaultTuning.backgroundObjectOpacity;
    const showPrintStamp = !resolvedDefaultTuning.hidePrintSymbols;
    const textHoldRatio = resolvedDefaultTuning.textHoldRatio;
    const passedFadeDuration = useMemo(
        () => resolveDefaultPassedFadeDuration(lines, textHoldRatio),
        [lines, textHoldRatio],
    );
    const translationFontSize = `clamp(${(1.05 * lyricsFontScale).toFixed(3)}rem, ${(2.2 * lyricsFontScale).toFixed(3)}vw, ${(1.2 * lyricsFontScale).toFixed(3)}rem)`;
    const upcomingFontSize = `clamp(${(0.875 * lyricsFontScale).toFixed(3)}rem, ${(1.8 * lyricsFontScale).toFixed(3)}vw, ${(1 * lyricsFontScale).toFixed(3)}rem)`;

    useEffect(() => {
        staticBlockSnapshotCacheRef.current.clear();
        clearColorCache();
        clearWordColorCache();
    }, [
        article,
        theme.name,
        theme.primaryColor,
        theme.secondaryColor,
        theme.accentColor,
        theme.fontStyle,
        theme.fontFamily,
        theme.fontFamilyStack,
    ]);

    useEffect(() => {
        hasPrintedContentRef.current = false;
        setHasPrintedContent(false);
    }, [article]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        const width = Math.max(Math.floor(viewport.width), 1);
        const height = Math.max(Math.floor(viewport.height), 1);
        const dpr = window.devicePixelRatio || 1;

        if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        }

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);

        if (article && !cameraInitializedRef.current) {
            cameraRef.current = {
                x: article.width * 0.5,
                y: article.height * 0.5,
                velocityX: 0,
                velocityY: 0,
                focusX: article.width * 0.5,
                focusY: article.height * 0.5,
                scale: 1.18,
                velocityScale: 0,
                focusScale: 1.18,
            };
            cameraInitializedRef.current = true;
        } else if (article) {
            cameraRef.current.x = clamp(cameraRef.current.x, 0, article.width);
            cameraRef.current.y = clamp(cameraRef.current.y, 0, article.height);
            cameraRef.current.focusX = clamp(cameraRef.current.focusX, 0, article.width);
            cameraRef.current.focusY = clamp(cameraRef.current.focusY, 0, article.height);
            cameraRef.current.scale = clamp(cameraRef.current.scale, CAMERA_SCALE_MIN, CAMERA_SCALE_MAX);
            cameraRef.current.focusScale = clamp(cameraRef.current.focusScale, CAMERA_SCALE_MIN, CAMERA_SCALE_MAX);
        } else {
            cameraInitializedRef.current = false;
        }
        let frameId = 0;
        let lastFrameAt: number | null = null;
        // Cache canvas logical size to avoid per-frame Math.floor/DPR calculations.
        let cachedCanvasW = 0;
        let cachedCanvasH = 0;
        let cachedDpr = 1;
        let logicalW = 0;
        let logicalH = 0;
        const cachedViewport: ViewportSize = { width: 0, height: 0 };
        const bgAudioLevels: DefaultBackgroundAudioLevels = {};

        const syncCanvasSize = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = Math.max(Math.floor(viewport.width), 1);
            const h = Math.max(Math.floor(viewport.height), 1);
            const cw = Math.floor(w * dpr);
            const ch = Math.floor(h * dpr);
            if (canvas.width !== cw || canvas.height !== ch || cachedDpr !== dpr) {
                canvas.width = cw;
                canvas.height = ch;
                canvas.style.width = `${w}px`;
                canvas.style.height = `${h}px`;
                cachedDpr = dpr;
            }
            logicalW = w;
            logicalH = h;
            cachedCanvasW = cw;
            cachedCanvasH = ch;
            cachedViewport.width = w;
            cachedViewport.height = h;
        };
        syncCanvasSize();

        const draw = () => {
            const now = performance.now();
            const dt = lastFrameAt === null
                ? 1 / 60
                : clamp((now - lastFrameAt) / 1000, 1 / 240, 0.05);
            lastFrameAt = now;

            // Only resync canvas size when viewport actually changes (ResizeObserver).
            if (Math.floor(viewport.width) !== logicalW || Math.floor(viewport.height) !== logicalH) {
                syncCanvasSize();
            }

            context.setTransform(cachedDpr, 0, 0, cachedDpr, 0, 0);
            context.clearRect(0, 0, logicalW, logicalH);

            const time = currentTime.get();
            const viewportCenterX = logicalW * 0.5;
            const viewportCenterY = logicalH * 0.5;
            // Reuse the same object each frame to avoid GC pressure.
            bgAudioLevels.power = audioPower.get();
            bgAudioLevels.bass = audioBands.bass.get();
            bgAudioLevels.lowMid = audioBands.lowMid.get();
            bgAudioLevels.mid = audioBands.mid.get();
            bgAudioLevels.vocal = audioBands.vocal.get();
            bgAudioLevels.treble = audioBands.treble.get();

            if (!article) {
                if (!staticMode && backgroundObjectOpacity > 0) {
                    context.save();
                    context.translate(viewportCenterX, viewportCenterY);
                    context.translate(-backgroundScene.width * 0.5, -backgroundScene.height * 0.5);
                    drawDefaultBackground({
                        context,
                        scene: backgroundScene,
                        theme,
                        time: time + now * 0.00018,
                        audioLevels: bgAudioLevels,
                        objectOpacityMultiplier: backgroundObjectOpacity * 2,
                    });
                    context.restore();
                }

                if (!paused) {
                    frameId = window.requestAnimationFrame(draw);
                }
                return;
            }

            // One-shot detection: once any block starts printing, flip hasPrintedContent
            if (!hasPrintedContentRef.current && time >= article.firstRenderableStartTime) {
                hasPrintedContentRef.current = true;
                setHasPrintedContent(true);
            }

            const focusBlock = resolveFocusBlock(article, findTimelineLine(lines, time), time);
            const shouldShowOverview = overviewCamera !== null && time >= overviewStartTime;
            let targetCameraX = article.width * 0.5;
            let targetCameraY = article.height * 0.5;
            let targetCameraScale = 1.18;
            let entryFocusPoint: { x: number; y: number; } | null = null;
            let didRetargetThisFrame = false;

            if (shouldShowOverview && overviewCamera) {
                targetCameraX = overviewCamera.x;
                targetCameraY = overviewCamera.y;
                targetCameraScale = overviewCamera.scale;

                if (cameraRetargetRef.current.sourceLineIndex !== OVERVIEW_CAMERA_SOURCE) {
                    cameraRetargetRef.current = {
                        sourceLineIndex: OVERVIEW_CAMERA_SOURCE,
                        startedAt: time,
                        duration: clamp(resolveOverviewRetargetDuration(cachedViewport) / cameraSpeed, 0.12, 1.2),
                        fromX: cameraRef.current.x,
                        fromY: cameraRef.current.y,
                        fromScale: cameraRef.current.scale,
                        bridgeMode: 'none',
                        bridgeWaypointX: 0,
                        bridgeWaypointY: 0,
                        bridgeWaypointScale: 1,
                        bridgeWaypointPhase: 0.36,
                    };
                    didRetargetThisFrame = true;
                }
            } else if (focusBlock) {
                const focusPoint = resolvedDefaultTuning.cameraTrackingMode === 'stepped'
                    ? resolveSteppedBlockFocusPoint(
                        focusBlock,
                        resolvePrintedGraphemeCount(
                            focusBlock.line,
                            focusBlock.wordRanges,
                            focusBlock.graphemes.length,
                            time,
                        ),
                    )
                    : resolveSmoothBlockFocusPoint(
                        focusBlock,
                        resolvePrintedGraphemeProgress(
                            focusBlock.line,
                            focusBlock.wordRanges,
                            focusBlock.graphemes.length,
                            time,
                        ),
                    );
                entryFocusPoint = resolveBlockEntryFocusPoint(focusBlock);
                targetCameraX = focusPoint.x;
                targetCameraY = focusPoint.y;
                targetCameraScale = resolveCameraScaleForBlock(focusBlock, cachedViewport);

                if (cameraRetargetRef.current.sourceLineIndex !== focusBlock.sourceLineIndex) {
                    cameraRetargetRef.current = {
                        sourceLineIndex: focusBlock.sourceLineIndex,
                        startedAt: time,
                        duration: clamp(resolveCameraRetargetDuration(focusBlock.line) / cameraSpeed, 0.03, 0.3),
                        fromX: cameraRef.current.x,
                        fromY: cameraRef.current.y,
                        fromScale: cameraRef.current.scale,
                        bridgeMode: 'none',
                        bridgeWaypointX: 0,
                        bridgeWaypointY: 0,
                        bridgeWaypointScale: 1,
                        bridgeWaypointPhase: 0.36,
                    };
                    didRetargetThisFrame = true;
                }
            } else if (cameraRetargetRef.current.sourceLineIndex !== -1) {
                cameraRetargetRef.current = {
                    sourceLineIndex: -1,
                    startedAt: time,
                    duration: clamp(0.18 / cameraSpeed, 0.05, 0.4),
                    fromX: cameraRef.current.x,
                    fromY: cameraRef.current.y,
                    fromScale: cameraRef.current.scale,
                    bridgeMode: 'none',
                    bridgeWaypointX: 0,
                    bridgeWaypointY: 0,
                    bridgeWaypointScale: 1,
                    bridgeWaypointPhase: 0.36,
                };
                didRetargetThisFrame = true;
            }

            const retargetElapsed = Math.max(time - cameraRetargetRef.current.startedAt, 0);
            const overviewTextRestoreProgress = shouldShowOverview && cameraRetargetRef.current.sourceLineIndex === OVERVIEW_CAMERA_SOURCE
                ? easeInOutCubic(clamp(
                    retargetElapsed / Math.max(cameraRetargetRef.current.duration, 0.001),
                    0,
                    1,
                ))
                : 0;
            const retargetPhase = clamp(
                retargetElapsed / Math.max(cameraRetargetRef.current.duration, 0.001),
                0,
                1,
            );
            const retargetBoost = 1 - easeOutCubic(retargetPhase);
            const entryFocusBias = Math.pow(retargetBoost, 0.58);

            if (entryFocusPoint) {
                targetCameraX = mix(targetCameraX, entryFocusPoint.x, entryFocusBias);
                targetCameraY = mix(targetCameraY, entryFocusPoint.y, entryFocusBias);
            }

            if (!staticMode) {
                const floatConfig = theme.animationIntensity === 'chaotic'
                    ? { distance: 24, duration: 5.8, scaleAmplitude: 0.014 }
                    : theme.animationIntensity === 'calm'
                        ? { distance: 14, duration: 8.5, scaleAmplitude: 0.008 }
                        : { distance: 18, duration: 7, scaleAmplitude: 0.011 };
                const floatPhase = (now / 1000 / floatConfig.duration) * Math.PI * 2;
                const overviewAttenuation = shouldShowOverview ? 0.36 : 1;
                const screenFloatX = Math.sin(floatPhase * 0.74 + 0.8) * floatConfig.distance * 0.34;
                const screenFloatY = (
                    Math.sin(floatPhase) * floatConfig.distance
                    + Math.sin(floatPhase * 0.5 + 1.1) * floatConfig.distance * 0.22
                ) * overviewAttenuation;
                const worldFloatDivisor = Math.max(targetCameraScale, 0.001);

                targetCameraX -= screenFloatX / worldFloatDivisor;
                targetCameraY -= screenFloatY / worldFloatDivisor;
                targetCameraScale = clamp(
                    targetCameraScale * (1 + Math.sin(floatPhase + 0.9) * floatConfig.scaleAmplitude * overviewAttenuation),
                    CAMERA_SCALE_MIN,
                    CAMERA_SCALE_MAX,
                );
            }

            if (didRetargetThisFrame) {
                const bridgeScale = Math.max(cameraRef.current.scale, targetCameraScale, 0.001);
                const screenDeltaX = Math.abs(targetCameraX - cameraRetargetRef.current.fromX) * bridgeScale;
                const screenDeltaY = Math.abs(targetCameraY - cameraRetargetRef.current.fromY) * bridgeScale;
                const screenDistance = Math.hypot(screenDeltaX, screenDeltaY);
                cameraRetargetRef.current.bridgeMode = screenDistance >= Math.min(logicalW, logicalH) * 0.42
                    ? 'direct'
                    : 'none';
                cameraRetargetRef.current.bridgeWaypointX = targetCameraX;
                cameraRetargetRef.current.bridgeWaypointY = targetCameraY;
                cameraRetargetRef.current.bridgeWaypointScale = targetCameraScale;
                cameraRetargetRef.current.bridgeWaypointPhase = 0.5;

                if (cameraRetargetRef.current.sourceLineIndex >= 0) {
                    const overviewFlightBridge = resolveOverviewFlightBridge({
                        fromX: cameraRetargetRef.current.fromX,
                        fromY: cameraRetargetRef.current.fromY,
                        fromScale: cameraRetargetRef.current.fromScale,
                        targetX: targetCameraX,
                        targetY: targetCameraY,
                        targetScale: targetCameraScale,
                        overviewCamera,
                        viewport: cachedViewport,
                    });

                    if (overviewFlightBridge) {
                        cameraRetargetRef.current.bridgeMode = 'overview';
                        cameraRetargetRef.current.bridgeWaypointX = overviewFlightBridge.waypointX;
                        cameraRetargetRef.current.bridgeWaypointY = overviewFlightBridge.waypointY;
                        cameraRetargetRef.current.bridgeWaypointScale = overviewFlightBridge.waypointScale;
                        cameraRetargetRef.current.bridgeWaypointPhase = overviewFlightBridge.waypointPhase;
                        cameraRetargetRef.current.duration = Math.max(
                            cameraRetargetRef.current.duration,
                            clamp(overviewFlightBridge.duration / cameraSpeed, 0.16, 0.9),
                        );
                    }
                }
            }

            const cameraDistance = Math.hypot(
                targetCameraX - cameraRef.current.x,
                targetCameraY - cameraRef.current.y,
            );
            const shouldUseBridge = cameraRetargetRef.current.bridgeMode !== 'none' && retargetPhase < 1;

            if (shouldUseBridge) {
                let bridgedCameraX = targetCameraX;
                let bridgedCameraY = targetCameraY;
                let bridgedCameraScale = targetCameraScale;

                if (cameraRetargetRef.current.bridgeMode === 'overview') {
                    const bridgePhase = easeOutCubic(retargetPhase);
                    bridgedCameraX = quadraticBezier(
                        cameraRetargetRef.current.fromX,
                        cameraRetargetRef.current.bridgeWaypointX,
                        targetCameraX,
                        bridgePhase,
                    );
                    bridgedCameraY = quadraticBezier(
                        cameraRetargetRef.current.fromY,
                        cameraRetargetRef.current.bridgeWaypointY,
                        targetCameraY,
                        bridgePhase,
                    );
                    bridgedCameraScale = quadraticBezier(
                        cameraRetargetRef.current.fromScale,
                        cameraRetargetRef.current.bridgeWaypointScale,
                        targetCameraScale,
                        bridgePhase,
                    );
                } else {
                    const bridgePhase = easeInOutCubic(retargetPhase);
                    bridgedCameraX = mix(cameraRetargetRef.current.fromX, targetCameraX, bridgePhase);
                    bridgedCameraY = mix(cameraRetargetRef.current.fromY, targetCameraY, bridgePhase);
                    bridgedCameraScale = mix(cameraRetargetRef.current.fromScale, targetCameraScale, bridgePhase);
                }

                const bridgeCatchUp = 1 - Math.exp(-dt * (
                    cameraRetargetRef.current.bridgeMode === 'overview'
                        ? mix(12.5, 22, 1 - retargetPhase)
                        : mix(10.5, 17.5, 1 - retargetPhase)
                ));

                cameraRef.current.focusX = bridgedCameraX;
                cameraRef.current.focusY = bridgedCameraY;
                cameraRef.current.focusScale = bridgedCameraScale;
                cameraRef.current.x += (bridgedCameraX - cameraRef.current.x) * bridgeCatchUp;
                cameraRef.current.y += (bridgedCameraY - cameraRef.current.y) * bridgeCatchUp;
                cameraRef.current.scale += (bridgedCameraScale - cameraRef.current.scale) * bridgeCatchUp;
                cameraRef.current.scale = clamp(cameraRef.current.scale, CAMERA_SCALE_MIN, CAMERA_SCALE_MAX);
                cameraRef.current.velocityX *= 0.72;
                cameraRef.current.velocityY *= 0.72;
                cameraRef.current.velocityScale *= 0.68;
            } else {
                const boostedCatchUpRate = clamp(
                    4.8 / Math.max(cameraRetargetRef.current.duration, 0.05),
                    20,
                    54,
                );
                const targetCatchUp = 1 - Math.exp(-dt * mix(11.2, boostedCatchUpRate, retargetBoost));
                cameraRef.current.focusX += (targetCameraX - cameraRef.current.focusX) * targetCatchUp;
                cameraRef.current.focusY += (targetCameraY - cameraRef.current.focusY) * targetCatchUp;
                cameraRef.current.focusScale += (targetCameraScale - cameraRef.current.focusScale)
                    * (1 - Math.exp(-dt * mix(5.4, 12.8, retargetBoost)));

                const springStrength = mix(
                    208,
                    clamp(15.8 / Math.max(cameraRetargetRef.current.duration * cameraRetargetRef.current.duration, 0.0064), 260, 780),
                    retargetBoost,
                );
                const damping = mix(
                    24,
                    clamp(Math.sqrt(springStrength) * 1.36, 24, 40),
                    retargetBoost,
                );
                const accelX = (cameraRef.current.focusX - cameraRef.current.x) * springStrength - cameraRef.current.velocityX * damping;
                const accelY = (cameraRef.current.focusY - cameraRef.current.y) * springStrength - cameraRef.current.velocityY * damping;
                cameraRef.current.velocityX += accelX * dt;
                cameraRef.current.velocityY += accelY * dt;
                const maxVelocity = mix(
                    1320,
                    clamp(cameraDistance / Math.max(cameraRetargetRef.current.duration * 0.28, 0.028), 2600, 8800),
                    retargetBoost,
                );
                cameraRef.current.velocityX = clamp(cameraRef.current.velocityX, -maxVelocity, maxVelocity);
                cameraRef.current.velocityY = clamp(cameraRef.current.velocityY, -maxVelocity, maxVelocity);
                cameraRef.current.x += cameraRef.current.velocityX * dt;
                cameraRef.current.y += cameraRef.current.velocityY * dt;

                const scaleSpringStrength = mix(54, 108, retargetBoost);
                const scaleDamping = mix(13.5, 21, retargetBoost);
                const accelScale = (cameraRef.current.focusScale - cameraRef.current.scale) * scaleSpringStrength
                    - cameraRef.current.velocityScale * scaleDamping;
                cameraRef.current.velocityScale += accelScale * dt;
                cameraRef.current.velocityScale = clamp(cameraRef.current.velocityScale, -1.6, 1.6);
                cameraRef.current.scale += cameraRef.current.velocityScale * dt;
                cameraRef.current.scale = clamp(cameraRef.current.scale, CAMERA_SCALE_MIN, CAMERA_SCALE_MAX);
            }

            const screenScale = cameraRef.current.scale;

            if (!staticMode && backgroundObjectOpacity > 0) {
                const backgroundCenterX = backgroundScene.width * 0.5;
                const backgroundCenterY = backgroundScene.height * 0.5;
                const backgroundVerticalOffset = clamp(
                    logicalH * DEFAULT_BACKGROUND_VERTICAL_OFFSET_RATIO / Math.max(screenScale, 0.001),
                    48,
                    180,
                );
                const backgroundCameraX = mix(
                    backgroundCenterX,
                    cameraRef.current.x,
                    DEFAULT_BACKGROUND_PARALLAX_X,
                );
                const backgroundCameraY = mix(
                    backgroundCenterY,
                    cameraRef.current.y,
                    DEFAULT_BACKGROUND_PARALLAX_Y,
                ) - backgroundVerticalOffset;
                const backgroundScale = clamp(
                    screenScale * DEFAULT_BACKGROUND_SCALE_FACTOR,
                    CAMERA_SCALE_MIN,
                    CAMERA_SCALE_MAX,
                );

                context.save();
                context.translate(viewportCenterX, viewportCenterY);
                context.scale(backgroundScale, backgroundScale);
                context.translate(-backgroundCameraX, -backgroundCameraY);
                drawDefaultBackground({
                    context,
                    scene: backgroundScene,
                    theme,
                    time,
                    audioLevels: bgAudioLevels,
                    objectOpacityMultiplier: backgroundObjectOpacity * 2,
                    parallax: {
                        cameraX: backgroundCameraX,
                        cameraY: backgroundCameraY,
                        originX: backgroundCenterX,
                        originY: backgroundCenterY,
                        strength: 0.72,
                    },
                });
                context.restore();
            }

            context.save();
            context.translate(viewportCenterX, viewportCenterY);
            context.scale(screenScale, screenScale);
            context.translate(-cameraRef.current.x, -cameraRef.current.y);

            const activeGlowBoost = (theme.animationIntensity === 'chaotic'
                ? 1.15
                : theme.animationIntensity === 'calm'
                    ? 0.72
                    : 0.92) * glowIntensity;
            const passedGlowBase = (theme.animationIntensity === 'chaotic'
                ? 0.95
                : theme.animationIntensity === 'calm'
                    ? 0.35
                    : 0.62) * glowIntensity;

            if (showText) {
                for (const block of article.blocks) {
                const screenLeft = viewportCenterX + (block.x - cameraRef.current.x) * screenScale;
                const screenTop = viewportCenterY + (block.y - cameraRef.current.y) * screenScale;
                const screenRight = screenLeft + block.width * screenScale;
                const screenBottom = screenTop + block.height * screenScale;
                const overscan = 180;

                if (screenRight < -overscan || screenLeft > logicalW + overscan || screenBottom < -overscan || screenTop > logicalH + overscan) {
                    continue;
                }

                const focusBlockIndex = focusBlock?.sourceLineIndex ?? -1;
                const distanceFromFocus = focusBlockIndex >= 0
                    ? Math.abs(block.sourceLineIndex - focusBlockIndex)
                    : 999;

                // Distance-based graduated opacity for 3D depth layers
                // Closer blocks to the active line appear more prominent
                const waitingBase = block.variant === 'hero' ? 0.06 : 0.035;
                const waitingOpacity = distanceFromFocus <= 0
                    ? waitingBase * 3.2
                    : distanceFromFocus <= 1
                        ? waitingBase * 2.4
                        : distanceFromFocus <= 2
                            ? waitingBase * 1.6
                            : distanceFromFocus <= 4
                                ? waitingBase * 1.1
                                : waitingBase;
                const activeOpacity = block.variant === 'hero' ? 0.985 : 0.92;
                const effectiveTextHoldStyle = textHoldRatio >= 1 ? 'standard' : 'dimmed';
                const passedStyle = resolvePassedTextStyle(block.variant, effectiveTextHoldStyle);
                // Distance-based graduated opacity for passed blocks (fade with distance)
                const passedDistanceScale = distanceFromFocus <= 1
                    ? 1.0
                    : distanceFromFocus <= 2
                        ? 0.88
                        : distanceFromFocus <= 4
                            ? 0.65
                            : distanceFromFocus <= 6
                                ? 0.42
                                : 0.28;
                const passedOpacity = passedStyle.opacity * passedDistanceScale;
                const transitionPassedStyle = resolvePassedTextStyle(block.variant, 'standard');
                const baselineOffset = block.lineHeight * (isCJK(block.line.fullText) ? 0.52 : 0.5);
                const lineEndTime = getLineRenderEndTime(block.line);
                const nextLineStartTime = lines[block.sourceLineIndex + 1]?.startTime ?? null;
                const linePassCutoffTime = resolveLinePassCutoffTime(block.line, nextLineStartTime);
                const revealCompleteTime = block.line.endTime;
                const hasRevealCompleted = time >= revealCompleteTime;
                const hasPassCutoffReached = time >= linePassCutoffTime;
                const lineDuration = Math.max(lineEndTime - block.line.startTime, 0.18);
                const colorTrailDuration = clamp(
                    lineDuration * (block.variant === 'hero' ? 0.42 : 0.52),
                    0.45,
                    1.45,
                );
                const staticState = time < block.line.startTime
                    ? 'waiting'
                    : time >= lineEndTime + colorTrailDuration
                        ? 'passed'
                        : null;

                if (staticState) {
                    const snapshotScale = clamp(window.devicePixelRatio || 1, 1, 2);
                    const cacheStyleKey = staticState === 'passed' ? effectiveTextHoldStyle : 'base';
                    // Include distance tier in cache key for graduated opacity layers
                    const distanceTier = Math.min(distanceFromFocus, 6);
                    const cacheKey = `${block.id}:${staticState}:${cacheStyleKey}:${snapshotScale}:d${distanceTier}`;
                    let snapshot = staticBlockSnapshotCacheRef.current.get(cacheKey);

                    if (!snapshot) {
                        // Subtle glow for nearby waiting blocks to enhance 3D depth
                        const waitingGlow = staticState === 'waiting' && distanceFromFocus <= 2
                            ? (2 + block.fontPx * 0.06) * (distanceFromFocus <= 1 ? 0.35 : 0.18) * activeGlowBoost
                            : 0;
                        const waitingGlowColor = staticState === 'waiting' && distanceFromFocus <= 2
                            ? colorWithAlpha(theme.accentColor, 0.12 + (distanceFromFocus <= 1 ? 0.08 : 0.03))
                            : 'transparent';
                        snapshot = createStaticBlockSnapshot(
                            block,
                            theme,
                            staticState === 'waiting'
                                ? colorWithAlpha(theme.primaryColor, waitingOpacity)
                                : colorWithAlpha(theme.primaryColor, passedOpacity),
                            staticState === 'waiting'
                                ? waitingGlow
                                : (2 + block.fontPx * 0.1) * 0.65 * passedGlowBase * passedStyle.glowMultiplier,
                            staticState === 'waiting'
                                ? waitingGlowColor
                                : colorWithAlpha(theme.primaryColor, passedStyle.shadowAlphaBase),
                        ) ?? undefined;

                        if (snapshot) {
                            staticBlockSnapshotCacheRef.current.set(cacheKey, snapshot);
                        }
                    }

                    if (snapshot) {
                        if (staticState === 'passed' && effectiveTextHoldStyle === 'dimmed') {
                            const passedAt = lineEndTime + colorTrailDuration;
                            const baseDimAmount = resolvePassedDimAmount(time, passedAt, passedFadeDuration);
                            const dimAmount = baseDimAmount * (1 - overviewTextRestoreProgress);
                            const standardStyle = resolvePassedTextStyle(block.variant, 'standard');
                            const standardCacheKey = `${block.id}:passed:standard:${snapshotScale}`;
                            let standardSnapshot = staticBlockSnapshotCacheRef.current.get(standardCacheKey);

                            if (!standardSnapshot) {
                                standardSnapshot = createStaticBlockSnapshot(
                                    block,
                                    theme,
                                    colorWithAlpha(theme.primaryColor, standardStyle.opacity),
                                    (2 + block.fontPx * 0.1) * 0.65 * passedGlowBase * standardStyle.glowMultiplier,
                                    colorWithAlpha(theme.primaryColor, standardStyle.shadowAlphaBase),
                                ) ?? undefined;

                                if (standardSnapshot) {
                                    staticBlockSnapshotCacheRef.current.set(standardCacheKey, standardSnapshot);
                                }
                            }

                            if (standardSnapshot) {
                                if (dimAmount <= 0) {
                                    context.drawImage(
                                        standardSnapshot.canvas,
                                        block.x - standardSnapshot.padding,
                                        block.y - standardSnapshot.padding,
                                        block.width + standardSnapshot.padding * 2,
                                        block.height + standardSnapshot.padding * 2,
                                    );
                                    continue;
                                }

                                if (dimAmount < 1) {
                                    const previousAlpha = context.globalAlpha;
                                    context.globalAlpha = previousAlpha * (1 - dimAmount);
                                    context.drawImage(
                                        standardSnapshot.canvas,
                                        block.x - standardSnapshot.padding,
                                        block.y - standardSnapshot.padding,
                                        block.width + standardSnapshot.padding * 2,
                                        block.height + standardSnapshot.padding * 2,
                                    );
                                    context.globalAlpha = previousAlpha * dimAmount;
                                    context.drawImage(
                                        snapshot.canvas,
                                        block.x - snapshot.padding,
                                        block.y - snapshot.padding,
                                        block.width + snapshot.padding * 2,
                                        block.height + snapshot.padding * 2,
                                    );
                                    context.globalAlpha = previousAlpha;
                                    continue;
                                }
                            }
                        }

                        context.drawImage(
                            snapshot.canvas,
                            block.x - snapshot.padding,
                            block.y - snapshot.padding,
                            block.width + snapshot.padding * 2,
                            block.height + snapshot.padding * 2,
                        );
                        continue;
                    }
                }

                const printedCount = resolvePrintedGraphemeCount(
                    block.line,
                    block.wordRanges,
                    block.graphemes.length,
                    time,
                );
                const totalGraphemeCount = block.graphemes.length;

                context.save();
                context.font = buildCanvasFont(block, theme);
                context.textAlign = 'left';
                context.textBaseline = 'middle';

                const isLineActive = time >= block.line.startTime && time <= linePassCutoffTime;
                if (isLineActive) {
                    const lineProgress = resolveVisualProgressWithCutoff(
                        block.line.startTime,
                        lineDuration,
                        time,
                        linePassCutoffTime,
                    );
                    const lineGlowEnvelope = resolveDelayedGlowEnvelope(lineProgress, 0.8);
                    const lineGlowAlpha = (
                        (block.variant === 'hero' ? 0.16 : 0.12)
                        + lineGlowEnvelope * (block.variant === 'hero' ? 0.26 : 0.2)
                    ) * glowIntensity;
                    const lineGlowBlur = Math.min(
                        ((block.variant === 'hero' ? 12 : 8)
                            + lineGlowEnvelope * (block.fontPx * (block.variant === 'hero' ? 0.7 : 0.52)))
                            * glowIntensity,
                        20,
                    );
                    const lineGlowColor = colorWithAlpha(theme.accentColor, lineGlowAlpha);

                    context.save();
                    context.fillStyle = lineGlowColor;
                    context.shadowBlur = lineGlowBlur;
                    context.shadowColor = colorWithAlpha(theme.accentColor, lineGlowAlpha * 1.35);

                    for (const renderLine of block.renderLines) {
                        const glowBaseX = block.x + renderLine.left;
                        const glowBaseY = block.y + renderLine.top + baselineOffset;

                        for (const segment of renderLine.segments) {
                            if (segment.text.trim().length === 0) {
                                continue;
                            }

                            context.fillText(segment.text, glowBaseX + segment.x, glowBaseY);
                        }
                    }

                    context.restore();
                }

                // Pre-compute activeColor per color range index to avoid repeated getActiveColor
                // calls in the per-grapheme loop (same word range → same color).
                const activeColorMap = new Map<number, string>();
                for (const wr of block.wordRanges) {
                    const ci = block.colorRangeIndexByOffset[wr.start] ?? -1;
                    const cr = ci >= 0 ? block.wordRanges[ci]! : wr;
                    if (!activeColorMap.has(ci)) {
                        activeColorMap.set(ci, getActiveColor(cr.word.text, theme));
                    }
                }

                for (const renderLine of block.renderLines) {
                    const baseX = block.x + renderLine.left;
                    const baseY = block.y + renderLine.top + baselineOffset;

                    for (const segment of renderLine.segments) {
                        let runStart = -1;
                        let runFillStyle = '';
                        let runShadowBlur = 0;
                        let runShadowColor = 'transparent';
                        let runStyleKey = '';

                        const flushRun = (segmentEnd: number) => {
                            if (runStart < 0 || !runStyleKey || segmentEnd <= runStart) {
                                return;
                            }

                            const localStart = runStart - renderLine.start;
                            const localEnd = segmentEnd - renderLine.start;
                            const runText = renderLine.graphemes.slice(localStart, localEnd).join('');
                            if (!runText || runText.trim().length === 0 && runFillStyle === '') {
                                runStart = -1;
                                runStyleKey = '';
                                return;
                            }

                            context.fillStyle = runFillStyle;
                            context.shadowBlur = runShadowBlur;
                            context.shadowColor = runShadowColor;
                            drawRenderTextRun(
                                context,
                                renderLine,
                                segment,
                                localStart,
                                localEnd,
                                baseX,
                                baseY,
                            );
                            context.shadowBlur = 0;
                            context.shadowColor = 'transparent';
                            runStart = -1;
                            runStyleKey = '';
                        };

                        for (let globalOffset = segment.start; globalOffset < segment.end; globalOffset += 1) {
                            const graphemeIndex = globalOffset - renderLine.start;
                            const grapheme = renderLine.graphemes[graphemeIndex]!;
                            const rangeIndex = block.wordRangeIndexByOffset[globalOffset] ?? -1;
                            const range = rangeIndex >= 0 ? block.wordRanges[rangeIndex]! : null;
                            const colorRangeIndex = block.colorRangeIndexByOffset[globalOffset] ?? -1;
                            const colorRange = colorRangeIndex >= 0 ? block.wordRanges[colorRangeIndex]! : range;
                            const isPrinted = hasRevealCompleted || globalOffset < printedCount;
                            const isFrontier = printedCount > 0
                                && globalOffset === printedCount
                                && printedCount < totalGraphemeCount
                                && !hasRevealCompleted
                                && !hasPassCutoffReached;

                            let alpha = isPrinted
                                ? activeOpacity
                                : isFrontier
                                    ? 0.82
                                    : waitingOpacity;
                            let shadowBlur = 0;
                            let shadowColor = 'transparent';
                            let fillStyle = colorWithAlpha(theme.primaryColor, alpha);

                            if (range) {
                                const wordDuration = Math.max(range.word.endTime - range.word.startTime, 0.08);
                                const wordProgress = clamp((time - range.word.startTime) / wordDuration, 0, 1);
                                const glyphCount = Math.max(range.end - range.start, 1);
                                const glyphIndexInRange = globalOffset - range.start;
                                const glyphTiming = range.word.syllables?.length
                                    ? range.graphemeTimings[Math.min(glyphIndexInRange, Math.max(range.graphemeTimings.length - 1, 0))]
                                    : undefined;
                                const glyphStartTime = glyphTiming?.startTime ?? (range.word.startTime + (glyphIndexInRange / glyphCount) * wordDuration);
                                const glyphEndTime = glyphTiming?.endTime ?? (range.word.startTime + ((glyphIndexInRange + 1) / glyphCount) * wordDuration);
                                const glyphDuration = Math.max(glyphEndTime - glyphStartTime, 0.001);
                                const glyphProgress = glyphTiming
                                    ? clamp((time - glyphStartTime) / glyphDuration + 0.16, 0, 1)
                                    : clamp(wordProgress * glyphCount - glyphIndexInRange + 0.16, 0, 1);
                                const easedGlyphProgress = easeOutCubic(glyphProgress);
                                const activeColor = activeColorMap.get(colorRangeIndex) ?? activeColorMap.get(rangeIndex) ?? theme.accentColor;
                                const glyphTrailStart = glyphStartTime + glyphDuration * 0.18;
                                const colorTrailPhase = resolveVisualProgressWithCutoff(
                                    glyphTrailStart,
                                    colorTrailDuration,
                                    time,
                                    linePassCutoffTime,
                                );
                                const colorTrailProgress = Math.pow(colorTrailPhase, 1.35);

                                if (hasPassCutoffReached) {
                                    alpha = mix(activeOpacity, transitionPassedStyle.opacity, colorTrailProgress);
                                    fillStyle = mixColors(activeColor, theme.primaryColor, 0.18 + colorTrailProgress * 0.82, alpha);
                                    shadowBlur = Math.min((2 + block.fontPx * 0.1) * (1 - colorTrailProgress * 0.35) * passedGlowBase * transitionPassedStyle.glowMultiplier, 16);
                                    shadowColor = colorWithAlpha(
                                        mixColors(activeColor, theme.primaryColor, 0.55 + colorTrailProgress * 0.45),
                                        transitionPassedStyle.shadowAlphaBase + (1 - colorTrailProgress) * transitionPassedStyle.shadowAlphaTrail,
                                    );
                                } else if (time < range.word.startTime) {
                                    alpha = waitingOpacity;
                                    fillStyle = colorWithAlpha(theme.primaryColor, alpha);
                                } else if (time <= glyphTrailStart) {
                                    alpha = mix(waitingOpacity, activeOpacity, easedGlyphProgress);
                                    fillStyle = mixColors(theme.primaryColor, activeColor, 0.22 + easedGlyphProgress * 0.78, alpha);
                                    shadowBlur = Math.min((4 + block.fontPx * 0.22) * easedGlyphProgress * activeGlowBoost, 16);
                                    shadowColor = colorWithAlpha(activeColor, 0.4 + easedGlyphProgress * 0.44);
                                } else {
                                    alpha = mix(activeOpacity, transitionPassedStyle.opacity, colorTrailProgress);
                                    fillStyle = mixColors(activeColor, theme.primaryColor, 0.18 + colorTrailProgress * 0.82, alpha);
                                    shadowBlur = Math.min((2 + block.fontPx * 0.1) * (1 - colorTrailProgress * 0.35) * passedGlowBase * transitionPassedStyle.glowMultiplier, 16);
                                    shadowColor = colorWithAlpha(
                                        mixColors(activeColor, theme.primaryColor, 0.55 + colorTrailProgress * 0.45),
                                        transitionPassedStyle.shadowAlphaBase + (1 - colorTrailProgress) * transitionPassedStyle.shadowAlphaTrail,
                                    );
                                }

                                if (showPrintStamp && grapheme.trim().length > 0) {
                                    const glyphWindowDuration = Math.max(wordDuration / glyphCount, 0.04);
                                    const activationLeadDuration = clamp(
                                        Math.min(glyphWindowDuration * 0.86, lineDuration * 0.16),
                                        0.055,
                                        block.variant === 'hero' ? 0.2 : 0.16,
                                    );
                                    const activationReleaseDuration = activationLeadDuration * 0.42;
                                    const activationWindowStart = glyphTrailStart - activationLeadDuration;
                                    const activationWindowEnd = glyphTrailStart + activationReleaseDuration;
                                    const glyphAdvance = resolveSegmentGlyphAdvance(segment, globalOffset);
                                    const stampProgress = resolveVisualProgressWithCutoff(
                                        activationWindowStart,
                                        activationWindowEnd - activationWindowStart,
                                        time,
                                        linePassCutoffTime,
                                    );

                                    if (stampProgress > 0 && stampProgress < 1) {
                                        const glyphTrailPhase = resolveVisualProgressWithCutoff(
                                            glyphTrailStart,
                                            Math.max(activationWindowEnd - glyphTrailStart, 0.001),
                                            time,
                                            linePassCutoffTime,
                                        );
                                        const isDropping = glyphTrailPhase <= 0;
                                        const dropProgress = isDropping
                                            ? easeOutCubic(
                                                resolveVisualProgressWithCutoff(
                                                    activationWindowStart,
                                                    Math.max(glyphTrailStart - activationWindowStart, 0.001),
                                                    time,
                                                    linePassCutoffTime,
                                                ),
                                            )
                                            : 1;
                                        const fadeProgress = isDropping
                                            ? 0
                                            : easeInOutCubic(glyphTrailPhase);
                                        const blockPulse = isDropping
                                            ? mix(0.18, 1, Math.pow(dropProgress, 0.78))
                                            : Math.pow(1 - fadeProgress, 1.2);

                                        if (glyphAdvance > 0) {
                                            const underlineX = baseX + segment.x + resolveSegmentGlyphOffset(segment, globalOffset);
                                            const underlineY = baseY + block.fontPx * 0.42;
                                            const underlineWidth = glyphAdvance;
                                            const underlineHeight = Math.max(2, block.fontPx * 0.06);
                                            const underlineAlpha = blockPulse * 0.75;

                                            // Gradient underline glow — fading at edges
                                            const grad = context.createLinearGradient(
                                                underlineX - underlineWidth * 0.3, 0,
                                                underlineX + underlineWidth * 1.3, 0,
                                            );
                                            grad.addColorStop(0, colorWithAlpha(activeColor, 0));
                                            grad.addColorStop(0.15, colorWithAlpha(activeColor, underlineAlpha * 0.6));
                                            grad.addColorStop(0.5, colorWithAlpha(activeColor, underlineAlpha));
                                            grad.addColorStop(0.85, colorWithAlpha(activeColor, underlineAlpha * 0.6));
                                            grad.addColorStop(1, colorWithAlpha(activeColor, 0));

                                            // Soft glow layer (wider, more transparent)
                                            context.fillStyle = colorWithAlpha(activeColor, underlineAlpha * 0.25);
                                            context.fillRect(
                                                underlineX - underlineWidth * 0.2,
                                                underlineY - 3,
                                                underlineWidth * 1.4,
                                                underlineHeight + 6,
                                            );

                                            // Main underline
                                            context.fillStyle = grad;
                                            context.fillRect(
                                                underlineX - underlineWidth * 0.15,
                                                underlineY,
                                                underlineWidth * 1.3,
                                                underlineHeight,
                                            );
                                        }
                                    }
                                }
                            }

                            if (alpha <= 0.002) {
                                flushRun(globalOffset);
                                continue;
                            }

                            const styleKey = buildTextStyleKey(fillStyle, shadowBlur, shadowColor);
                            if (runStart < 0) {
                                runStart = globalOffset;
                                runFillStyle = fillStyle;
                                runShadowBlur = shadowBlur;
                                runShadowColor = shadowColor;
                                runStyleKey = styleKey;
                                continue;
                            }

                            if (styleKey !== runStyleKey) {
                                flushRun(globalOffset);
                                runStart = globalOffset;
                                runFillStyle = fillStyle;
                                runShadowBlur = shadowBlur;
                                runShadowColor = shadowColor;
                                runStyleKey = styleKey;
                            }
                        }

                        flushRun(segment.end);
                    }
                }

                context.restore();
            }
            }
            context.restore();

            if (!paused) {
                frameId = window.requestAnimationFrame(draw);
            }
        };

        draw();
        return () => {
            window.cancelAnimationFrame(frameId);
            lastFrameAt = null;
        };
    }, [
        article,
        audioBands,
        audioPower,
        backgroundScene,
        backgroundObjectOpacity,
        cameraSpeed,
        currentTime,
        glowIntensity,
        passedFadeDuration,
        showPrintStamp,
        showText,
        paused,
        staticMode,
        textHoldRatio,
        theme,
        viewport.height,
        viewport.width,
    ]);

    return (
        <VisualizerShell
            theme={theme}
            audioPower={audioPower}
            audioBands={audioBands}
            sharedProps={{
                ...props,
                background: {
                    ...props.background,
                    common: {
                        ...props.background?.common,
                        disableGeometricBackground: Boolean(props.background?.common?.disableGeometricBackground)
                            || resolvedDefaultTuning.disableGeometricBackground,
                    },
                },
            }}
        >
            <div ref={viewportRef} className="relative z-10 h-full w-full pointer-events-none">
                {(article || lines.length === 0) && (
                    <div
                        className="absolute left-1/2 top-0 -translate-x-1/2"
                        style={{
                            width: viewport.width,
                            height: viewport.height,
                            opacity: hasPrintedContent ? 1 : 0,
                            transition: 'opacity 0.45s ease-out',
                        }}
                    >
                        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                    </div>
                )}

                {isLayoutPending && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div
                            className="flex min-w-40 flex-col items-center gap-4 rounded-3xl border px-6 py-5"
                            style={{
                                backgroundColor: theme.backgroundColor,
                                borderColor: colorWithAlpha(theme.secondaryColor, 0.24),
                                boxShadow: `0 18px 60px ${colorWithAlpha(theme.backgroundColor, 0.52)}`,
                            }}
                        >
                            <Hourglass
                                size={24}
                                className="animate-pulse"
                                style={{ color: colorWithAlpha(theme.primaryColor, 0.78) }}
                            />
                            <div className="flex w-28 flex-col gap-2.5">
                                <div
                                    className="h-2 rounded-full animate-pulse"
                                    style={{ backgroundColor: colorWithAlpha(theme.primaryColor, 0.32) }}
                                />
                                <div
                                    className="h-2 rounded-full animate-pulse"
                                    style={{
                                        width: '78%',
                                        backgroundColor: colorWithAlpha(theme.primaryColor, 0.22),
                                    }}
                                />
                                <div
                                    className="h-2 rounded-full animate-pulse"
                                    style={{
                                        width: '56%',
                                        backgroundColor: colorWithAlpha(theme.secondaryColor, 0.2),
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <VisualizerSubtitleOverlay
                showText={showText}
                activeLine={runtime.activeLine}
                recentCompletedLine={runtime.recentCompletedLine}
                nextLines={runtime.nextLines}
                theme={theme}
                subtitleTheme={subtitleTheme}
                translationFontSize={translationFontSize}
                upcomingFontSize={upcomingFontSize}
                subtitleOverlayOpacity={subtitleOverlayOpacity}
                subtitleOverlayBackground={subtitleOverlayBackground}
                isPlayerChromeHidden={isPlayerChromeHidden}
                hideTranslationSubtitle={hideTranslationSubtitle}
                showSubtitleTranslation={showSubtitleTranslation}
            />
        </VisualizerShell>
    );
};

export default VisualizerDefault;