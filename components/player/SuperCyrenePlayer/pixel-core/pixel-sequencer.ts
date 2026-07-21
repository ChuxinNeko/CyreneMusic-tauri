import { type Line } from './pixel-types';
import {
    buildDioramaPath,
    type DioramaFrame,
    type DioramaVec,
    getFrame,
    translateFrames,
} from './pixel-cameraPath';

export interface CorridorSegment {
    key: string;
    seed: string | number;
    round: number;
    lines: Line[];
    frames: DioramaFrame[];
    globalStart: number;
    span: number;
    placementOrigin: DioramaVec;
    linesEpoch: number;
}

export interface SequencerState {
    segments: CorridorSegment[];
    nextGlobalStart: number;
}

export interface ResolvedGlobalLine {
    segment: CorridorSegment;
    localIndex: number;
    frame: DioramaFrame;
    line: Line | null;
}

export const createSequencerState = (): SequencerState => ({ segments: [], nextGlobalStart: 0 });

export const activeSegment = (state: SequencerState): CorridorSegment | null =>
    state.segments[state.segments.length - 1] ?? null;

export const appendSegment = (
    state: SequencerState,
    input: { seed: string | number; lines: Line[]; round: number; placementOrigin: DioramaVec }
): CorridorSegment => {
    const raw = buildDioramaPath(input.lines.length, input.seed);
    const frames = translateFrames(raw, input.placementOrigin);
    const span = Math.max(input.lines.length, 1);
    const segment: CorridorSegment = {
        key: `${String(input.seed)}#${input.round}`,
        seed: input.seed,
        round: input.round,
        lines: input.lines,
        frames,
        globalStart: state.nextGlobalStart,
        span,
        placementOrigin: input.placementOrigin,
        linesEpoch: 0,
    };
    state.segments.push(segment);
    state.nextGlobalStart += span;
    return segment;
};

export const updateActiveSegmentLines = (state: SequencerState, lines: Line[]): void => {
    const seg = state.segments[state.segments.length - 1];
    if (!seg) return;
    const raw = buildDioramaPath(lines.length, seg.seed);
    const span = Math.max(lines.length, 1);
    state.nextGlobalStart += span - seg.span;
    seg.lines = lines;
    seg.frames = translateFrames(raw, seg.placementOrigin);
    seg.span = span;
    seg.linesEpoch += 1;
};

export const totalGlobalLines = (state: SequencerState): number => state.nextGlobalStart;

export const resolveGlobal = (state: SequencerState, globalIndex: number): ResolvedGlobalLine | null => {
    for (const segment of state.segments) {
        const localIndex = globalIndex - segment.globalStart;
        if (localIndex >= 0 && localIndex < segment.span) {
            return {
                segment,
                localIndex,
                frame: getFrame(segment.frames, localIndex),
                line: segment.lines[localIndex] ?? null,
            };
        }
    }
    return null;
};

export const pruneSegments = (state: SequencerState, keepFromGlobal: number): void => {
    if (state.segments.length <= 1) return;
    state.segments = state.segments.filter(
        (segment) => segment.globalStart + segment.span - 1 >= keepFromGlobal
    );
};