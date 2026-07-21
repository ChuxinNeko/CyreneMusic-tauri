import type { layoutWithLines, PreparedTextWithSegments, PrepareOptions } from '@chenglou/pretext';
import type { Line, Word as WordType } from './default-types';
import type { GraphemeTiming } from './graphemeTiming';

export type VisualizerProps = import('./default-definition').VisualizerSharedProps;

export interface ViewportSize {
    width: number;
    height: number;
}

export const DEFAULT_PRETEXT_OPTIONS = { whiteSpace: 'pre-wrap' } satisfies PrepareOptions;

export interface SegmentMeta {
    graphemeStart: number;
    graphemeEnd: number;
    graphemeCount: number;
}

export interface WordRange {
    wordIndex: number;
    word: WordType;
    start: number;
    end: number;
    colorStart: number;
    colorEnd: number;
    graphemeTimings: GraphemeTiming[];
}

export interface RenderLineSlice {
    id: string;
    text: string;
    start: number;
    end: number;
    graphemes: string[];
    glyphOffsets: number[];
    segments: RenderSegmentSlice[];
    left: number;
    top: number;
    width: number;
}

export interface RenderSegmentSlice {
    text: string;
    start: number;
    end: number;
    localStart: number;
    localEnd: number;
    x: number;
    width: number;
    isFullSegment: boolean;
    measuredGlyphOffsets: number[];
}

export interface DefaultBlock {
    id: string;
    sourceLineIndex: number;
    line: Line;
    variant: 'body' | 'hero';
    x: number;
    y: number;
    width: number;
    height: number;
    innerWidth: number;
    fontPx: number;
    lineHeight: number;
    prepared: PreparedTextWithSegments;
    layout: ReturnType<typeof layoutWithLines>;
    graphemes: string[];
    segmentMetas: SegmentMeta[];
    wordRanges: WordRange[];
    wordRangeIndexByOffset: number[];
    colorRangeIndexByOffset: number[];
    renderLines: RenderLineSlice[];
}

export interface DefaultPaperBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface DefaultArticleLayout {
    width: number;
    height: number;
    viewportHeight: number;
    columns: number;
    gap: number;
    paperBounds: DefaultPaperBounds;
    blocks: DefaultBlock[];
    blockBySourceLineIndex: Map<number, DefaultBlock>;
    chronologicalBlocks: DefaultBlock[];
    firstRenderableStartTime: number;
    lastChronologicalRenderEndTime: number;
}

export interface DefaultArticleLayoutMetrics {
    width: number;
    height: number;
    viewportHeight: number;
    columns: number;
    gap: number;
    paperBounds: DefaultPaperBounds;
}

export interface StaticBlockSnapshot {
    canvas: HTMLCanvasElement;
    padding: number;
}

export interface DefaultLayoutAttemptOptions {
    paperWidth: number;
    viewportHeight: number;
    columns: number;
    gap: number;
    densityScale: number;
    seedKey: string;
    mode?: 'measure' | 'render';
    timing?: DefaultLayoutAttemptTiming;
}

export interface DefaultLayoutAttemptTiming {
    lines: number;
    prepareLayoutMs: number;
    placementMs: number;
    renderDetailsMs: number;
}

export interface CameraTarget {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    focusX: number;
    focusY: number;
    scale: number;
    velocityScale: number;
    focusScale: number;
}

export interface CameraRetargetState {
    sourceLineIndex: number;
    startedAt: number;
    duration: number;
    fromX: number;
    fromY: number;
    fromScale: number;
    bridgeMode: 'none' | 'direct' | 'overview';
    bridgeWaypointX: number;
    bridgeWaypointY: number;
    bridgeWaypointScale: number;
    bridgeWaypointPhase: number;
}

export interface CameraViewTarget {
    x: number;
    y: number;
    scale: number;
}

// Camera & background constants
export const CAMERA_SCALE_MIN = 0.22;
export const CAMERA_SCALE_MAX = 2.24;
export const OVERVIEW_CAMERA_SOURCE = -2;
export const LAYOUT_REBUILD_DEBOUNCE_MS = 96;
export const DEFAULT_BACKGROUND_PARALLAX_X = 0.9;
export const DEFAULT_BACKGROUND_PARALLAX_Y = 0.74;
export const DEFAULT_BACKGROUND_SCALE_FACTOR = 0.94;
export const DEFAULT_BACKGROUND_VERTICAL_OFFSET_RATIO = 0.22;
export const DEFAULT_CAMERA_TELEPORT_TRIGGER_SCREENS = 2.75;