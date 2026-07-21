import { hashSeed, seededUnit, type DioramaVec } from './pixel-cameraPath';

export const TRANSITION_DURATION = 3.2;
export const TRANSITION_DISTANCE = 46;
export const TRANSITION_BANK = 0.14;
export const TRANSITION_AIM_SWEEP = 0.14;

export const flightPerp = (from: DioramaVec, to: DioramaVec): DioramaVec => {
    const perp = { x: to.z - from.z, y: 0, z: -(to.x - from.x) };
    const l = Math.hypot(perp.x, perp.y, perp.z);
    return l < 1e-3 ? { x: 1, y: 0, z: 0 } : { x: perp.x / l, y: perp.y / l, z: perp.z / l };
};

export const flightSide = (seed: string | number | undefined, epoch: number): 1 | -1 =>
    seededUnit(hashSeed(seed) + epoch * 17) < 0.5 ? -1 : 1;

const len = (a: DioramaVec): number => Math.hypot(a.x, a.y, a.z);
const scaleTo = (a: DioramaVec, target: number): DioramaVec => {
    const l = len(a) || 1;
    return { x: (a.x / l) * target, y: (a.y / l) * target, z: (a.z / l) * target };
};

export const pickTransitionOffset = (seed: string | number | undefined, epoch: number): DioramaVec => {
    const base = hashSeed(seed) + epoch * 131;
    const azimuth = seededUnit(base + 1) * Math.PI * 2;
    const elevation = (seededUnit(base + 2) - 0.35) * 1.3;
    const ce = Math.cos(elevation);
    const dir: DioramaVec = {
        x: Math.sin(azimuth) * ce,
        y: Math.sin(elevation),
        z: -Math.abs(Math.cos(azimuth) * ce) - 0.35,
    };
    return scaleTo(dir, TRANSITION_DISTANCE);
};

export const transitionEase = (t: number): number => {
    const c = Math.min(1, Math.max(0, t));
    return c * c * c * (c * (c * 6 - 15) + 10);
};