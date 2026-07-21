import * as THREE from 'three';
import {
    DIORAMA_PARTICLE_DENSITY_MAX,
    DIORAMA_PARTICLE_DENSITY_MIN,
    DIORAMA_PARTICLE_DENSITY_STEP,
} from './pixel-types';
import {
    DIORAMA_PARTICLE_AUDIO_SCALE_MAX,
    DIORAMA_STEP_DISTANCE,
    hashSeed,
    seededUnit,
    type DioramaVec,
} from './pixel-cameraPath';
import { type DioramaParticleClusterAnchor } from './pixel-geometry';
import {
    DIORAMA_PARTICLE_CORRIDOR_RADIUS,
    type DioramaParticleCorridorSpan,
} from './pixel-particleCorridor';
import { buildDioramaStructuredSurface } from './pixel-particleSurfaces';
import { KAOMOJI_LIST } from './pixel-kaomoji';

export const DIORAMA_MAX_PARTICLE_POINTS = 65536;
const DIORAMA_MAX_CLOUD_POINTS_PER_CLUSTER = 1024;
const DIORAMA_MAX_CORRIDOR_POINTS_PER_SPAN = 2048;

const FAMILY_INDEX: Record<DioramaParticleClusterAnchor['kind'], number> = {
    box: 0, sphere: 1, cone: 2, torus: 3,
};

export interface DioramaParticleGeometryData {
    positions: Float32Array;
    normals: Float32Array;
    anchors: Float32Array;
    scales: Float32Array;
    phases: Float32Array;
    styles: Float32Array;
    waves: Float32Array;
    kaomojiIndices: Float32Array;
    pointCount: number;
    pointsPerUnit: number;
    spacing: number;
}

const normalizeDensity = (density: number): number => {
    const clamped = Math.min(DIORAMA_PARTICLE_DENSITY_MAX, Math.max(DIORAMA_PARTICLE_DENSITY_MIN, density));
    return Math.max(
        DIORAMA_PARTICLE_DENSITY_MIN,
        Math.floor(clamped / DIORAMA_PARTICLE_DENSITY_STEP) * DIORAMA_PARTICLE_DENSITY_STEP,
    );
};

export const resolveWaveNumberMax = (spacing: number): number =>
    (Math.PI * 2) / Math.max(1e-4, spacing * 4);

const allocate = (pointCount: number, pointsPerUnit: number, spacing: number): DioramaParticleGeometryData => ({
    positions: new Float32Array(pointCount * 3),
    normals: new Float32Array(pointCount * 3),
    anchors: new Float32Array(pointCount * 3),
    scales: new Float32Array(pointCount * 3),
    phases: new Float32Array(pointCount),
    styles: new Float32Array(pointCount * 3),
    waves: new Float32Array(pointCount * 2),
    kaomojiIndices: new Float32Array(pointCount),
    pointCount, pointsPerUnit, spacing,
});

const writeStyle = (data: DioramaParticleGeometryData, index: number, family: number, colorSlot: number, isFar: number) => {
    const offset = index * 3;
    data.styles[offset] = family;
    data.styles[offset + 1] = colorSlot;
    data.styles[offset + 2] = isFar;
};

export const buildDioramaCloudGeometryData = (
    clusters: DioramaParticleClusterAnchor[],
    _density: number,
): DioramaParticleGeometryData => {
    const pointCount = clusters.length;
    const data = allocate(pointCount, 1, 1);
    clusters.forEach((cluster, target) => {
        const v = target * 3;
        const s = target * 3;
        const seed = hashSeed(`${cluster.particleSeed}|${cluster.kind}`);
        const phase = seededUnit(seed + 31) * Math.PI * 2;
        data.positions[v] = 0; data.positions[v + 1] = 0; data.positions[v + 2] = 0;
        data.normals[v] = 0; data.normals[v + 1] = 1; data.normals[v + 2] = 0;
        data.anchors[v] = cluster.position.x;
        data.anchors[v + 1] = cluster.position.y;
        data.anchors[v + 2] = cluster.position.z;
        data.scales[s] = cluster.scale;
        data.scales[s + 1] = cluster.stretchY;
        data.scales[s + 2] = 1;
        data.phases[target] = phase;
        data.waves[target * 2] = phase;
        data.waves[target * 2 + 1] = phase * 0.7;
        data.kaomojiIndices[target] = Math.floor(seededUnit(seed + target * 17) * KAOMOJI_LIST.length);
        writeStyle(data, target, FAMILY_INDEX[cluster.kind], cluster.colorSlot, cluster.layer === 'far' ? 1 : 0);
    });
    return data;
};

const normalizeVec = (x: number, y: number, z: number): DioramaVec => {
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
};

const resolveRingSegments = (pointsPerSpan: number): number =>
    Math.max(12, Math.min(256, Math.round(Math.sqrt(pointsPerSpan * 2.4))));

export const buildDioramaCorridorGeometryData = (
    spans: DioramaParticleCorridorSpan[],
    _density: number,
    _radius = DIORAMA_PARTICLE_CORRIDOR_RADIUS,
): DioramaParticleGeometryData => {
    const activeSpans = spans.filter((span) => span.enabled);
    const pointCount = activeSpans.length;
    const data = allocate(pointCount, 1, 1);
    activeSpans.forEach((span, target) => {
        const v = target * 3;
        const s = target * 3;
        const cx = (span.start.x + span.end.x) / 2;
        const cy = (span.start.y + span.end.y) / 2;
        const cz = (span.start.z + span.end.z) / 2;
        const seed = hashSeed(`corridor:${span.pathStart}`);
        const phase = seededUnit(seed + 31) * Math.PI * 2;
        data.positions[v] = 0; data.positions[v + 1] = 0; data.positions[v + 2] = 0;
        data.normals[v] = 0; data.normals[v + 1] = 1; data.normals[v + 2] = 0;
        data.anchors[v] = cx; data.anchors[v + 1] = cy; data.anchors[v + 2] = cz;
        data.scales[s] = 1; data.scales[s + 1] = 1; data.scales[s + 2] = 1;
        data.phases[target] = phase;
        data.waves[target * 2] = span.pathStart;
        data.waves[target * 2 + 1] = phase;
        data.kaomojiIndices[target] = Math.floor(seededUnit(seed + target * 17) * KAOMOJI_LIST.length);
        writeStyle(data, target, 3, Math.round(span.pathStart) % 2, 0);
    });
    return data;
};

export const createDioramaBufferGeometry = (data: DioramaParticleGeometryData): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute('aAnchor', new THREE.BufferAttribute(data.anchors, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(data.scales, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(data.phases, 1));
    geometry.setAttribute('aStyle', new THREE.BufferAttribute(data.styles, 3));
    geometry.setAttribute('aWave', new THREE.BufferAttribute(data.waves, 2));
    geometry.setAttribute('aKaomojiIndex', new THREE.BufferAttribute(data.kaomojiIndices, 1));
    geometry.setDrawRange(0, data.pointCount);
    return geometry;
};

export const stepDioramaEnvelope = (
    current: number, target: number, attack: number, release: number, delta: number,
): number => current + (target - current) * (1 - Math.exp(-(target > current ? attack : release) * delta));

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export interface DioramaBandTracker {
    fast: number; floor: number; peak: number; armed: boolean; primed: boolean;
}

export const createDioramaBandTracker = (): DioramaBandTracker => ({
    fast: 0, floor: 0, peak: 0, armed: false, primed: false,
});

const FAST_ATTACK = 22;
const FAST_RELEASE = 7;
const FLOOR_RISE = 2.5;
const FLOOR_FALL = 4;
const PEAK_RISE = 9;
const PEAK_FALL = 0.28;
const MIN_RANGE = 0.12;
const MIN_PEAK = 0.22;
const TRIGGER_HIGH = 0.42;
const TRIGGER_LOW = 0.2;

export interface DioramaBandSignal {
    transient: number;
    sustained: number;
    onset: boolean;
}

export const stepDioramaBandTracker = (
    state: DioramaBandTracker, level: number, delta: number,
): DioramaBandSignal => {
    const safe = clamp01(level);
    if (!state.primed) {
        state.fast = safe; state.floor = safe; state.peak = safe; state.primed = true;
    } else {
        state.fast = stepDioramaEnvelope(state.fast, safe, FAST_ATTACK, FAST_RELEASE, delta);
        state.floor = stepDioramaEnvelope(state.floor, safe, FLOOR_RISE, FLOOR_FALL, delta);
        state.peak = stepDioramaEnvelope(state.peak, safe, PEAK_RISE, PEAK_FALL, delta);
    }
    const range = Math.max(MIN_RANGE, state.peak - state.floor);
    const transient = clamp01((state.fast - state.floor) / range);
    const sustained = clamp01(state.fast / Math.max(MIN_PEAK, state.peak));
    let onset = false;
    if (!state.armed && transient >= TRIGGER_HIGH) { state.armed = true; onset = true; }
    else if (state.armed && transient <= TRIGGER_LOW) { state.armed = false; }
    return { transient, sustained, onset };
};

export const RIPPLE_BANDS = [
    { band: 'bass' as const, strength: 1.45, speed: 0.9, width: 0.66, wavenumber: 3.4 },
    { band: 'mid' as const, strength: 0.9, speed: 1.6, width: 0.36, wavenumber: 5.5 },
    { band: 'treble' as const, strength: 0.5, speed: 2.5, width: 0.22, wavenumber: 9 },
];

export const RIPPLE_SLOTS_PER_BAND = 3;
export const DIORAMA_RIPPLE_COUNT = RIPPLE_BANDS.length * RIPPLE_SLOTS_PER_BAND;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
    const amount = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return amount * amount * (3 - 2 * amount);
};

export interface DioramaParticleAudioResponse {
    flowSpeed: number;
    clusterPulse: number;
}

export const resolveDioramaParticleAudioResponse = (
    bass: DioramaBandSignal, mid: DioramaBandSignal,
): DioramaParticleAudioResponse => ({
    flowSpeed: Math.min(1.55, 0.3 + clamp01(bass.sustained) * 1.25),
    clusterPulse: Math.min(
        DIORAMA_PARTICLE_AUDIO_SCALE_MAX,
        1 + smoothstep(0.1, 0.9, bass.transient) * 0.14 + smoothstep(0.15, 0.95, mid.transient) * 0.05,
    ),
});

export const DIORAMA_CORRIDOR_PULSE_SHARE = 0.12;

export const resolveDioramaPulseTarget = (
    clusterPulse: number, gain: number, isCorridor: boolean,
): number => 1 + (clusterPulse - 1) * gain * (isCorridor ? DIORAMA_CORRIDOR_PULSE_SHARE : 1);

export interface DioramaParticleElasticState {
    value: number;
    velocity: number;
}

export const createDioramaParticleElasticState = (): DioramaParticleElasticState => ({
    value: 1, velocity: 0,
});

export const stepDioramaParticleElasticResponse = (
    state: DioramaParticleElasticState, target: number, delta: number,
): number => {
    let remaining = Math.min(0.1, Math.max(0, delta));
    const safeTarget = Math.min(DIORAMA_PARTICLE_AUDIO_SCALE_MAX, Math.max(0.9, target));
    while (remaining > 0) {
        const step = Math.min(1 / 240, remaining);
        const acceleration = (safeTarget - state.value) * 150 - state.velocity * 15;
        state.velocity += acceleration * step;
        state.value += state.velocity * step;
        remaining -= step;
    }
    state.value = Math.min(DIORAMA_PARTICLE_AUDIO_SCALE_MAX, Math.max(0.9, state.value));
    return state.value;
};