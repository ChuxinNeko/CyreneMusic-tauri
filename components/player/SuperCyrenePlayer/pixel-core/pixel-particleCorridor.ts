import { DIORAMA_STEP_DISTANCE, getFrame, type DioramaFrame, type DioramaVec } from './pixel-cameraPath';
import { extendDioramaFrame } from './pixel-moteField';
import { resolveGlobal, type SequencerState } from './pixel-sequencer';

export const DIORAMA_PARTICLE_CORRIDOR_RADIUS = 7.4;

export interface DioramaParticleCorridorSpan {
    start: DioramaVec;
    end: DioramaVec;
    startRight: DioramaVec;
    endRight: DioramaVec;
    startUp: DioramaVec;
    endUp: DioramaVec;
    pathStart: number;
    enabled: boolean;
}

export const buildDioramaParticleCorridorSpan = (
    frame: DioramaFrame,
    nextFrame: DioramaFrame | null,
    pathStart: number,
    enabled: boolean,
): DioramaParticleCorridorSpan => {
    const start = { ...frame.position };
    const end = nextFrame != null
        ? { ...nextFrame.position }
        : {
            x: start.x + frame.forward.x * DIORAMA_STEP_DISTANCE,
            y: start.y + frame.forward.y * DIORAMA_STEP_DISTANCE,
            z: start.z + frame.forward.z * DIORAMA_STEP_DISTANCE,
        };
    return {
        start, end,
        startRight: frame.right,
        endRight: nextFrame ? nextFrame.right : frame.right,
        startUp: frame.up,
        endUp: nextFrame ? nextFrame.up : frame.up,
        pathStart, enabled,
    };
};

export const buildDioramaParticleCorridorWindow = (
    sequencer: SequencerState,
    center: number,
    behind: number,
    ahead: number,
): DioramaParticleCorridorSpan[] => {
    const anchor = resolveGlobal(sequencer, center);
    if (!anchor) return [];
    const { segment } = anchor;
    const first = segment.globalStart;
    const last = segment.globalStart + segment.span - 1;
    const frameAt = (index: number): DioramaFrame => {
        const clamped = Math.min(Math.max(index, first), last);
        return extendDioramaFrame(getFrame(segment.frames, clamped - first), index - clamped);
    };
    const spans: DioramaParticleCorridorSpan[] = [];
    for (let i = center - behind; i <= center + ahead; i += 1) {
        spans.push(buildDioramaParticleCorridorSpan(frameAt(i), frameAt(i + 1), i, true));
    }
    return spans;
};