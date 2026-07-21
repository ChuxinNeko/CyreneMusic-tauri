import { type DioramaGeometryVisibility } from './pixel-types';
import { DIORAMA_PARTICLE_AUDIO_SCALE_MAX, type DioramaShapePlacement } from './pixel-cameraPath';

export interface DioramaParticleClusterAnchor extends DioramaShapePlacement {
    key: string;
    sourceLine: number;
    particleSeed: string | number;
    role: 'formation';
}

const isKindVisible = (
    kind: DioramaShapePlacement['kind'],
    visibility: DioramaGeometryVisibility,
): boolean => {
    if (kind === 'box') return visibility.strands;
    if (kind === 'sphere') return visibility.blobs;
    if (kind === 'cone') return visibility.ribbons;
    return visibility.rings;
};

const getClusterRadius = (shape: DioramaShapePlacement): number => {
    const familyRadius = shape.kind === 'box' ? 0.5 : shape.kind === 'sphere' ? 0.74 : shape.kind === 'cone' ? 0.68 : 0.9;
    return shape.scale * Math.max(familyRadius, shape.stretchY * 0.55) * DIORAMA_PARTICLE_AUDIO_SCALE_MAX;
};

const distanceBetween = (a: DioramaShapePlacement, b: DioramaShapePlacement): number => Math.hypot(
    a.position.x - b.position.x,
    a.position.y - b.position.y,
    a.position.z - b.position.z,
);

export const DIORAMA_CLUSTER_COLLISION_LINE_SPAN = 2;

export const selectVisibleDioramaClusters = (
    shapes: DioramaParticleClusterAnchor[],
    visibility: DioramaGeometryVisibility,
): DioramaParticleClusterAnchor[] => {
    if (!visibility.enabled || visibility.mode !== 'clouds') return [];
    const candidates = shapes.filter((shape) => isKindVisible(shape.kind, visibility));
    return candidates.filter((candidate, index) => {
        const candidateRadius = getClusterRadius(candidate);
        for (let rivalIndex = index - 1; rivalIndex >= 0; rivalIndex -= 1) {
            const rival = candidates[rivalIndex];
            if (candidate.sourceLine - rival.sourceLine > DIORAMA_CLUSTER_COLLISION_LINE_SPAN) break;
            if (rival.sourceLine === candidate.sourceLine) continue;
            const clearance = Math.max(1.8, (getClusterRadius(rival) + candidateRadius) * 1.18);
            if (distanceBetween(rival, candidate) < clearance) return false;
        }
        return true;
    });
};