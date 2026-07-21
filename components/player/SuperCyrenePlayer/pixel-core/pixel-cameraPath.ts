import {
    DEFAULT_DIORAMA_TUNING,
    type DioramaTuning,
    type Line,
    type Theme,
} from './pixel-types';

/** Distance advanced along the path per lyric line. */
export const DIORAMA_STEP_DISTANCE = 8;
export const DIORAMA_MAX_YAW = 0.5;
export const DIORAMA_MAX_PITCH = 0.32;
export const DIORAMA_HERO_DISTANCE = 5.2;
export const DIORAMA_CAMERA_LIFT = 0.5;
export const DIORAMA_SAFE_FRAME_FRACTION = 0.92;
export const DIORAMA_SWAY_AMP = 0.4;
export const DIORAMA_LIFT_AMP = 0.4;
export const DIORAMA_DIST_AMP = 0.5;
export const DIORAMA_SNAP_DISTANCE = 24;
export const DIORAMA_TEXT_OFFSET_R = 1.8;
export const DIORAMA_TEXT_OFFSET_U = 1.2;
export const DIORAMA_TEXT_ROLL = 0.2;
export const DIORAMA_TEXT_YAW = 0.16;
export const DIORAMA_TEXT_LOOK = 1.1;
export const DIORAMA_SHAPE_FADE_IN_START = 20;
export const DIORAMA_SHAPE_FADE_IN_END = 27;
export const DIORAMA_SHAPE_DISSOLVE_START = 3.0;
export const DIORAMA_SHAPE_DISSOLVE_END = 1.2;

const DEG_TO_RAD = Math.PI / 180;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export interface DioramaVec { x: number; y: number; z: number; }
export type DioramaWaypoint = DioramaVec;

const vsub = (a: DioramaVec, b: DioramaVec): DioramaVec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vcross = (a: DioramaVec, b: DioramaVec): DioramaVec => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
});
const vnorm = (a: DioramaVec): DioramaVec => {
    const len = Math.hypot(a.x, a.y, a.z) || 1;
    return { x: a.x / len, y: a.y / len, z: a.z / len };
};
const vadd = (a: DioramaVec, b: DioramaVec): DioramaVec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const seededUnit = (seed: number): number => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

export const hashSeed = (seed: string | number | undefined): number => {
    if (typeof seed === 'number') return seed;
    if (!seed) return 1;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
    }
    return hash || 1;
};

export const smoothDamp = (
    current: number,
    target: number,
    velocity: number,
    smoothTime: number,
    deltaSeconds: number
): { value: number; velocity: number } => {
    const t = Math.max(0.0001, smoothTime);
    const omega = 2 / t;
    const x = omega * deltaSeconds;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velocity + omega * change) * deltaSeconds;
    const newVelocity = (velocity - omega * temp) * exp;
    const value = target + (change + temp) * exp;
    return { value, velocity: newVelocity };
};

export const frameHalfWidth = (distance: number, verticalFovDeg: number, aspect: number): number =>
    distance * Math.tan((verticalFovDeg * DEG_TO_RAD) / 2) * aspect;

export type DioramaSubMode = 'calm' | 'normal' | 'chaotic';

export interface DioramaMotionParams {
    moveScale: number;
    driftScale: number;
    smoothTime: number;
    audioLevel: number;
    weaveScale: number;
    subMode: DioramaSubMode;
}

const DIORAMA_SUB_MODE_PRESETS = {
    normal: { move: 0.9, drift: 0.18, smooth: 0.48, audio: 1, weave: 1 },
    calm: { move: 0.6, drift: 0.4, smooth: 0.56, audio: 0.5, weave: 0.5 },
    chaotic: { move: 1.35, drift: 0.85, smooth: 0.33, audio: 1.35, weave: 1.35 },
} as const;

export const resolveDioramaMotionParams = (
    tuning: DioramaTuning | undefined,
    themeIntensity?: Theme['animationIntensity']
): DioramaMotionParams => {
    const t = tuning ?? DEFAULT_DIORAMA_TUNING;
    const mode: DioramaSubMode = themeIntensity === 'calm' ? 'calm' : themeIntensity === 'chaotic' ? 'chaotic' : 'normal';
    const preset = DIORAMA_SUB_MODE_PRESETS[mode];
    const motion = clamp(t.motionAmount, 0.4, 1.6);
    const speed = clamp(t.cameraSpeed, 0.55, 1.85);
    const audio = clamp(t.audioReactivity, 0, 1.5);
    return {
        moveScale: preset.move * motion,
        driftScale: preset.drift * motion,
        smoothTime: preset.smooth / speed,
        audioLevel: preset.audio * audio,
        weaveScale: preset.weave * motion,
        subMode: mode,
    };
};

export interface DioramaFrame {
    position: DioramaVec;
    forward: DioramaVec;
    right: DioramaVec;
    up: DioramaVec;
}

const WORLD_UP: DioramaVec = { x: 0, y: 1, z: 0 };
const DEFAULT_FRAME: DioramaFrame = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
};

export const buildDioramaPath = (count: number, seed?: string | number): DioramaFrame[] => {
    const base = hashSeed(seed);
    const n = Math.max(count, 1);
    const positions: DioramaVec[] = [];
    let pos: DioramaVec = { x: 0, y: 0, z: 0 };
    for (let i = 0; i <= n; i += 1) {
        positions.push({ ...pos });
        const yaw = DIORAMA_MAX_YAW * (Math.sin(i * 0.23 + base * 0.017) * 0.62 + Math.sin(i * 0.11 + base * 0.041 + 1.3) * 0.38);
        const pitch = DIORAMA_MAX_PITCH * Math.sin(i * 0.17 + base * 0.029 + 0.7);
        const cp = Math.cos(pitch);
        const dir: DioramaVec = { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
        pos = {
            x: pos.x + dir.x * DIORAMA_STEP_DISTANCE,
            y: pos.y + dir.y * DIORAMA_STEP_DISTANCE,
            z: pos.z + dir.z * DIORAMA_STEP_DISTANCE,
        };
    }
    const frames: DioramaFrame[] = [];
    for (let i = 0; i < n; i += 1) {
        const forward = vnorm(vsub(positions[i + 1], positions[i]));
        const right = vnorm(vcross(forward, WORLD_UP));
        const up = vnorm(vcross(right, forward));
        frames.push({ position: positions[i], forward, right, up });
    }
    return frames;
};

export const getFrame = (frames: DioramaFrame[], index: number): DioramaFrame => {
    if (frames.length === 0) return DEFAULT_FRAME;
    const i = Math.min(Math.max(index, 0), frames.length - 1);
    return frames[i] ?? DEFAULT_FRAME;
};

export const translateFrames = (frames: DioramaFrame[], offset: DioramaVec): DioramaFrame[] =>
    frames.map((f) => ({ position: vadd(f.position, offset), forward: f.forward, right: f.right, up: f.up }));

export const composeLocal = (frame: DioramaFrame, right: number, up: number, depth: number): DioramaVec => ({
    x: frame.position.x + frame.right.x * right + frame.up.x * up + frame.forward.x * depth,
    y: frame.position.y + frame.right.y * right + frame.up.y * up + frame.forward.y * depth,
    z: frame.position.z + frame.right.z * right + frame.up.z * up + frame.forward.z * depth,
});

export const resolveReadHeadTruck = (
    wordProgress: number,
    trackWidth: number,
    visibleHalfWidth: number
): number => {
    if (trackWidth <= 0) return 0;
    const wordOffset = (clamp01(wordProgress) - 0.5) * trackWidth;
    const allowed = Math.max(Math.abs(visibleHalfWidth - trackWidth / 2), 0.001);
    return allowed * Math.tanh(wordOffset / allowed);
};

export interface DioramaTextPlacement {
    offsetR: number;
    offsetU: number;
    scale: number;
    roll: number;
    yaw: number;
    lookR: number;
}

export const getDioramaTextPlacement = (
    lineIndex: number,
    seed: string | number | undefined,
    weave = 1
): DioramaTextPlacement => {
    const base = hashSeed(seed);
    const i = Math.max(lineIndex, 0);
    const jitterR = (seededUnit(base + i * 11 + 2) - 0.5) * 0.6;
    const jitterU = (seededUnit(base + i * 11 + 4) - 0.5) * 0.6;
    const wanderR = Math.sin(i * 0.47 + base * 0.019) * 0.7 + jitterR;
    const wanderU = Math.sin(i * 0.29 + base * 0.027 + 0.9) * 0.7 + jitterU;
    return {
        offsetR: wanderR * DIORAMA_TEXT_OFFSET_R * weave,
        offsetU: wanderU * DIORAMA_TEXT_OFFSET_U * weave,
        scale: 0.82 + seededUnit(base + i * 11 + 5) * 0.46,
        roll: (seededUnit(base + i * 11 + 6) - 0.5) * 2 * DIORAMA_TEXT_ROLL * weave,
        yaw: (seededUnit(base + i * 11 + 7) - 0.5) * 2 * DIORAMA_TEXT_YAW * weave,
        lookR: (seededUnit(base + i * 11 + 8) - 0.5) * 2 * DIORAMA_TEXT_LOOK * weave,
    };
};

export type DioramaShotKind =
    | 'pushIn' | 'pullBack' | 'orbit' | 'track' | 'crane' | 'hold'
    | 'swell' | 'spiral' | 'pendulum' | 'flyby' | 'arc' | 'float' | 'glide';

const SHOT_KINDS: DioramaShotKind[] = [
    'pushIn', 'pullBack', 'orbit', 'track', 'crane', 'hold', 'swell', 'spiral', 'pendulum', 'flyby',
    'arc', 'float', 'glide',
];

const easeInOut = (p: number): number => {
    const c = clamp01(p);
    return c * c * (3 - 2 * c);
};

type ShotWeights = Record<DioramaShotKind, number>;
const CHORUS_PART = /chorus|hook|refrain|drop/i;

const getShotDir = (lineIndex: number, seed: string | number | undefined): 1 | -1 =>
    seededUnit(hashSeed(seed) + lineIndex * 7 + 3) < 0.5 ? -1 : 1;

const getLineNoteProfile = (line: Line | undefined): { maxNote: number; avgNote: number; noteCount: number } => {
    let maxNote = 0;
    let sum = 0;
    let noteCount = 0;
    for (const word of line?.words ?? []) {
        const d = word.endTime - word.startTime;
        if (d > 0) {
            maxNote = Math.max(maxNote, d);
            sum += d;
            noteCount += 1;
        }
    }
    return { maxNote, avgNote: noteCount > 0 ? sum / noteCount : 0, noteCount };
};

const computeShotWeights = (lineIndex: number, lines: Line[], subMode: DioramaSubMode = 'normal'): ShotWeights => {
    const line = lines[lineIndex];
    const prev = lineIndex > 0 ? lines[lineIndex - 1] : undefined;
    const wordCount = line?.words?.length ?? 0;
    const isChorus = !!line?.isChorus || CHORUS_PART.test(line?.songPart ?? '');
    const sectionStart = !!line && !!prev && (line.blockIndex !== prev.blockIndex || (line.songPart ?? '') !== (prev.songPart ?? ''));
    const { maxNote, avgNote, noteCount } = getLineNoteProfile(line);
    const hasLongNote = maxNote >= 1.3;
    const staccato = noteCount >= 4 && avgNote > 0 && avgNote <= 0.34;
    const w: ShotWeights = {
        pushIn: 1, pullBack: 1, orbit: 1, track: 1, crane: 1, hold: 1, swell: 0.85,
        spiral: 0.9, pendulum: 1, flyby: 0.9, arc: 1, float: 0.9, glide: 1,
    };
    if (isChorus) {
        w.orbit += 2.4; w.pushIn += 1.8; w.spiral += 1.2; w.crane += 0.8; w.flyby += 0.6; w.arc += 1.0; w.glide += 0.6; w.hold -= 0.6; w.track -= 0.2;
    } else {
        w.track += 1.1; w.crane += 0.9; w.hold += 0.9; w.pendulum += 0.8; w.float += 0.8; w.glide += 0.6; w.arc += 0.4;
    }
    if (wordCount >= 8) { w.track += 1.6; w.pullBack += 1; w.orbit -= 0.4; w.pushIn -= 0.3; }
    else if (wordCount <= 3) { w.pushIn += 1.4; w.orbit += 0.9; w.hold += 0.5; w.track -= 0.8; }
    if (sectionStart) { w.pullBack += 2.2; w.crane += 1.4; w.glide += 1.0; w.pushIn -= 0.4; }
    if (hasLongNote) { w.swell += 2.4; w.spiral += 1.0; w.float += 1.2; w.pendulum += 0.6; w.orbit += 0.8; w.arc += 0.6; w.hold += 0.3; w.track -= 0.5; }
    if (staccato) { w.track += 1.4; w.flyby += 1.5; w.pushIn += 0.8; w.swell -= 1.6; w.hold -= 0.8; w.crane -= 0.4; }
    if (subMode === 'calm') {
        w.hold += 1.4; w.float += 1.3; w.swell += 0.9; w.glide += 0.8; w.arc += 0.5; w.crane += 0.4;
        w.orbit *= 0.4; w.spiral *= 0.35; w.flyby *= 0.3; w.pendulum *= 0.5; w.pushIn *= 0.7;
    } else if (subMode === 'chaotic') {
        w.orbit += 1.3; w.spiral += 1.3; w.flyby += 1.2; w.pendulum += 1.0; w.pushIn += 0.8; w.arc += 0.6; w.crane += 0.4;
        w.hold *= 0.35; w.float *= 0.55; w.swell *= 0.7;
    }
    SHOT_KINDS.forEach((key) => { w[key] = Math.max(0.05, w[key]); });
    return w;
};

const weightedPickShot = (weights: ShotWeights, u: number): DioramaShotKind => {
    const total = SHOT_KINDS.reduce((sum, k) => sum + weights[k], 0);
    let acc = clamp01(u) * total;
    for (const k of SHOT_KINDS) {
        acc -= weights[k];
        if (acc <= 0) return k;
    }
    return 'hold';
};

const basePickShot = (
    lineIndex: number, lines: Line[], seed: string | number | undefined, subMode: DioramaSubMode = 'normal'
): DioramaShotKind => {
    if (!lines[lineIndex]) return 'hold';
    const u = seededUnit(hashSeed(seed) + lineIndex * 101 + 7);
    return weightedPickShot(computeShotWeights(lineIndex, lines, subMode), u);
};

export const getDioramaShot = (
    lineIndex: number, lines: Line[], seed?: string | number, subMode: DioramaSubMode = 'normal'
): DioramaShotKind => {
    const pick = basePickShot(lineIndex, lines, seed, subMode);
    const prev1 = lineIndex > 0 ? basePickShot(lineIndex - 1, lines, seed, subMode) : null;
    const prev2 = lineIndex > 1 ? basePickShot(lineIndex - 2, lines, seed, subMode) : null;
    if (pick === prev1 || pick === prev2) {
        const others = SHOT_KINDS.filter((k) => k !== pick && k !== prev1 && k !== prev2);
        const pool = others.length > 0 ? others : SHOT_KINDS.filter((k) => k !== pick);
        const alt = seededUnit(hashSeed(seed) + lineIndex * 53 + 19);
        return pool[Math.floor(clamp01(alt) * pool.length) % pool.length];
    }
    return pick;
};

export interface DioramaShotOffset { right: number; up: number; back: number; }

export interface DioramaShotContext {
    progress: number;
    wordProgress: number;
    hero: number;
    lift: number;
    seed?: string | number;
    lineIndex: number;
    moveScale: number;
}

export const resolveShotOffset = (kind: DioramaShotKind, ctx: DioramaShotContext): DioramaShotOffset => {
    const { hero, lift, seed, lineIndex } = ctx;
    const e = easeInOut(ctx.progress);
    const dir = getShotDir(lineIndex, seed);
    let right = 0;
    let up = lift;
    let back = hero;
    switch (kind) {
        case 'pushIn': back = hero * (1.5 - 0.8 * e); up = lift * (1.2 - 0.5 * e) + 0.15; break;
        case 'pullBack': back = hero * (0.85 + 1.15 * e); up = lift + 1.7 * e; break;
        case 'orbit': { const theta = dir * 0.55 * (2 * e - 1); right = hero * Math.sin(theta); back = hero * Math.cos(theta); up = lift + 0.4; break; }
        case 'track': right = dir * hero * 0.34 * Math.sin(Math.PI * clamp01(ctx.wordProgress)); back = hero * 1.06; up = lift + 0.12; break;
        case 'crane': { const from = dir > 0 ? -1.5 : 2.4; const to = dir > 0 ? 2.4 : -1.4; up = from + (to - from) * e; back = hero * 1.05; break; }
        case 'swell': { const theta = dir * 0.4 * e; right = hero * Math.sin(theta) * 1.1; back = hero * (1.0 + 0.35 * e); up = lift + 1.2 * e + 0.3; break; }
        case 'spiral': { const theta = dir * 0.7 * (2 * e - 1); right = hero * Math.sin(theta) * 0.85; back = hero * (1.05 - 0.1 * e); up = lift - 0.8 + 2.4 * e; break; }
        case 'pendulum': { right = dir * hero * 0.45 * (2 * e - 1); up = lift + 0.9 - 0.9 * Math.sin(Math.PI * e); back = hero * 1.02; break; }
        case 'flyby': { right = dir * hero * (0.7 - 1.4 * e); back = hero * (0.78 + 0.12 * Math.sin(Math.PI * e)); up = lift + 0.05; break; }
        case 'arc': { const theta = dir * 0.5 * Math.sin(Math.PI * e); right = hero * Math.sin(theta) * 1.3; back = hero * (1.05 + 0.12 * (1 - Math.cos(theta))); up = lift + 0.5 * Math.sin(Math.PI * e); break; }
        case 'float': { right = dir * hero * 0.16 * Math.sin(e * Math.PI * 2); up = lift + 0.6 + 0.5 * Math.sin(e * Math.PI * 2 + 1.0); back = hero * (1.05 + 0.06 * Math.sin(e * Math.PI)); break; }
        case 'glide': { right = dir * hero * 0.22 * e; up = lift + 1.4 * e; back = hero * (1.15 - 0.25 * e); break; }
        case 'hold': default: up = lift + 0.3 * Math.sin(ctx.progress * Math.PI); back = hero; break;
    }
    const m = ctx.moveScale;
    return { right: right * m, up: lift + (up - lift) * m, back: hero + (back - hero) * m };
};

export interface DioramaCameraDrift { swayX: number; swayY: number; lift: number; dist: number; }

export const resolveCameraDrift = (time: number, seed: string | number | undefined, scale: number): DioramaCameraDrift => {
    const ph = hashSeed(seed) * 0.017;
    return {
        swayX: (Math.sin(time * 0.11 + ph) * 0.6 + Math.sin(time * 0.047 + ph * 1.7) * 0.4) * DIORAMA_SWAY_AMP * scale,
        swayY: Math.sin(time * 0.09 + ph * 0.7) * DIORAMA_SWAY_AMP * 0.5 * scale,
        lift: (Math.sin(time * 0.13 + ph * 1.3) * 0.6 + Math.sin(time * 0.061 + ph * 2.1) * 0.4) * DIORAMA_LIFT_AMP * scale,
        dist: Math.sin(time * 0.05 + ph * 1.1) * DIORAMA_DIST_AMP * scale,
    };
};

export interface DioramaShapePlacement {
    kind: 'box' | 'sphere' | 'cone' | 'torus';
    position: DioramaVec;
    scale: number;
    stretchY: number;
    upright: boolean;
    spinSpeed: number;
    colorSlot: 0 | 1;
    layer: 'near' | 'far';
}

export const DIORAMA_PARTICLE_AUDIO_SCALE_MAX = 1.44;

interface FormationSpec {
    kind: DioramaShapePlacement['kind'];
    r: number; u: number; d: number;
    scale: number; stretchY: number; upright: boolean; colorSlot?: 0 | 1;
}

const getSpecClearanceRadius = (spec: FormationSpec): number => {
    const familyRadius = spec.kind === 'box' ? 0.5 : spec.kind === 'sphere' ? 0.74 : spec.kind === 'cone' ? 0.68 : 0.9;
    return spec.scale * Math.max(familyRadius, spec.stretchY * 0.55);
};

const separateSpecs = (specs: FormationSpec[]): void => {
    for (let iter = 0; iter < 6; iter += 1) {
        for (let a = 0; a < specs.length; a += 1) {
            for (let b = a + 1; b < specs.length; b += 1) {
                const A = specs[a]; const B = specs[b];
                const minDist = (getSpecClearanceRadius(A) + getSpecClearanceRadius(B)) * 1.3;
                let dr = B.r - A.r; let du = B.u - A.u; let dd = B.d - A.d;
                let dist = Math.hypot(dr, du, dd);
                if (dist >= minDist) continue;
                if (dist < 0.001) { dr = 1; du = 0.5; dd = 0.25; dist = Math.hypot(dr, du, dd); }
                const push = (minDist - dist) / 2 / dist;
                A.r -= dr * push; A.u -= du * push; A.d -= dd * push;
                B.r += dr * push; B.u += du * push; B.d += dd * push;
            }
        }
    }
    specs.forEach((s) => { s.d = Math.max(s.d, 1); });
};

const TEXT_CLEAR_LATERAL = 5.2;
const TEXT_CLEAR_VERTICAL = 1.4;
const enforceTextClearance = (specs: FormationSpec[]): void => {
    specs.forEach((s, i) => {
        const radius = getSpecClearanceRadius(s) * DIORAMA_PARTICLE_AUDIO_SCALE_MAX;
        if (Math.abs(s.u) - radius < TEXT_CLEAR_VERTICAL && Math.abs(s.r) - radius < TEXT_CLEAR_LATERAL) {
            const side = s.r === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(s.r);
            s.r = side * (TEXT_CLEAR_LATERAL + radius + 0.35);
        }
    });
};

const enforceRailClearance = (specs: FormationSpec[]): void => {
    specs.forEach((s, i) => {
        const radius = getSpecClearanceRadius(s) * DIORAMA_PARTICLE_AUDIO_SCALE_MAX;
        const minimum = 2.8 + radius;
        const distance = Math.hypot(s.r, s.u);
        if (distance >= minimum) return;
        const fallbackAngle = (i % 2 === 0 ? 1 : -1) * Math.PI * 0.16;
        const directionR = distance > 0.001 ? s.r / distance : Math.cos(fallbackAngle);
        const directionU = distance > 0.001 ? s.u / distance : Math.sin(fallbackAngle);
        s.r = directionR * minimum; s.u = directionU * minimum;
    });
};

export const buildFormation = (
    lineIndex: number, seed: string | number | undefined, shot: DioramaShotKind,
    frame: DioramaFrame, placement: DioramaTextPlacement, volumeScale = 1
): DioramaShapePlacement[] => {
    const salt = hashSeed(seed) + lineIndex * 97;
    const rnd = (k: number): number => seededUnit(salt + k);
    const dir = getShotDir(lineIndex, seed);
    const specs: FormationSpec[] = [];
    const safeVolumeScale = Math.min(1.6, Math.max(0.65, volumeScale));
    const add = (kind: DioramaShapePlacement['kind'], r: number, u: number, d: number, scale: number, stretchY = 1, colorSlot?: 0 | 1): void => {
        specs.push({ kind, r, u, d, scale: scale * safeVolumeScale, stretchY, upright: stretchY > 1.2, colorSlot });
    };
    const addPair = (kind: DioramaShapePlacement['kind'], lateral: number, u: number, d: number, scale: number, stretchY = 1, colorSlot: 0 | 1 = 0): void => {
        add(kind, -Math.abs(lateral), u, d, scale, stretchY, colorSlot);
        add(kind, Math.abs(lateral), u, d, scale, stretchY, colorSlot);
    };
    switch (shot) {
        case 'orbit': { const count = 6; const radius = 4.4 + rnd(1) * 0.6; for (let j = 0; j < count; j += 1) { const a = (j / count) * Math.PI * 2 + rnd(2) * 0.6; add(j === 0 ? 'torus' : 'sphere', Math.cos(a) * radius, Math.sin(a) * radius, 0.6 + rnd(10 + j) * 1.4, 0.42 + rnd(20 + j) * 0.32); } break; }
        case 'pushIn': { const gate = 4.3 + rnd(1) * 0.5; [-1, 1].forEach((side, idx) => { add('box', side * gate, -0.6, 0.5 + rnd(idx) * 0.5, 0.55 + rnd(2 + idx) * 0.2, 2.8 + rnd(6 + idx) * 0.8); add('box', side * (gate + 1.6), 0.6, 4.5 + rnd(3 + idx) * 2, 0.7 + rnd(4 + idx) * 0.3, 3.4); }); break; }
        case 'track': { for (let si = 0; si < 2; si += 1) { const side = si === 0 ? -1 : 1; for (let j = 0; j < 3; j += 1) { add('box', side * (4.2 + rnd(si * 5 + j) * 0.4), -0.4 + (rnd(si * 7 + j) - 0.5) * 0.6, 0.5 + j * 2.4, 0.5 + rnd(si * 3 + j) * 0.15, 2.6 + rnd(si + j) * 0.6); } } break; }
        case 'crane': { const count = 5; const radius = 3.6 + rnd(1) * 0.5; for (let j = 0; j < count; j += 1) { const a = Math.PI * (0.15 + 0.7 * (j / (count - 1))); add('box', Math.cos(a) * radius, Math.abs(Math.sin(a)) * radius + 1.2, 0.6 + rnd(30 + j) * 0.8, 0.45 + rnd(40 + j) * 0.25, 1.4); } break; }
        case 'swell': { const lat = 4.2 + rnd(2) * 0.5; for (let j = 0; j < 2; j += 1) { addPair('box', lat, -1.5 + j * 2.1, 1 + j * 1.2, 0.48 - j * 0.06, 1.45, (j % 2) as 0 | 1); } addPair('sphere', lat, 2.65, 3.4, 0.5, 1, 0); break; }
        case 'spiral': { const count = 7; const radius = 4.3; for (let j = 0; j < count; j += 1) { const frac = j / (count - 1); const a = dir * frac * Math.PI * 2.2 + rnd(1) * 0.5; add('sphere', Math.cos(a) * radius, -2.2 + frac * 5.2, 0.5 + frac * 2.2, 0.32 + rnd(20 + j) * 0.2); } break; }
        case 'pendulum': { for (let j = 0; j < 4; j += 1) { add('box', -3.9 + j * 2.6 + (rnd(j) - 0.5) * 0.5, 3.0 + rnd(j * 2) * 1.2, 0.5 + rnd(j * 3) * 1.2, 0.3 + rnd(j * 4) * 0.12, 2.2 + rnd(j * 5) * 0.8); } break; }
        case 'flyby': { for (let j = 0; j < 3; j += 1) { addPair('box', 4.25 + rnd(j) * 0.25, -0.45 + j * 0.45, 1 + j * 2.1, 0.42 + rnd(j * 3) * 0.1, 2.2, (j % 2) as 0 | 1); } break; }
        case 'pullBack': { addPair('sphere', 5.8 + rnd(9) * 0.5, 1.25, 6.8 + rnd(11), 1.25 + rnd(12) * 0.25, 1, 0); for (let j = 0; j < 2; j += 1) { addPair(j === 0 ? 'box' : 'cone', 4.4 + j * 1.15, -1.4 + j * 2.2, 2.2 + j * 2.1, 0.58 + rnd(j * 4) * 0.18, j === 0 ? 1.5 : 1, 1); } break; }
        case 'arc': { const count = 5; const radius = 5.2 + rnd(1) * 0.6; for (let j = 0; j < count; j += 1) { const a = (-0.5 + j / (count - 1)) * 1.5 * dir; add(j === Math.floor(count / 2) ? 'torus' : 'sphere', Math.sin(a) * radius, 0.3 + Math.cos(a) * 0.7, 1.0 + rnd(20 + j) * 1.6, 0.45 + rnd(30 + j) * 0.32); } break; }
        case 'float': { for (let j = 0; j < 3; j += 1) { addPair('sphere', 4.1 + j * 0.85, -1.2 + j * 1.35, 1.2 + j * 1.55, 0.42 + rnd(j * 4) * 0.22, 1, (j % 2) as 0 | 1); } break; }
        case 'glide': { for (let j = 0; j < 3; j += 1) { addPair('box', 4.25 + rnd(j) * 0.3, -1.5 + j * 1.7, 1 + j * 1.7, 0.46 + rnd(j * 2) * 0.12, 1.85, (j % 2) as 0 | 1); } break; }
        case 'hold': default: { addPair('torus', 5.6, 1.55, 7.2 + rnd(1), 1.05 + rnd(2) * 0.2, 1, 0); addPair('sphere', 4.45, -1.1, 2.1 + rnd(4), 0.58 + rnd(5) * 0.16, 1, 1); break; }
    }
    enforceRailClearance(specs); enforceTextClearance(specs); separateSpecs(specs); enforceRailClearance(specs); enforceTextClearance(specs);
    return specs.map((s, j) => ({
        kind: s.kind,
        position: composeLocal(frame, placement.offsetR + s.r, placement.offsetU + s.u, s.d),
        scale: s.scale, stretchY: s.stretchY, upright: s.upright,
        spinSpeed: 0.04 + rnd(j * 13 + 5) * 0.1,
        colorSlot: s.colorSlot ?? (j % 2) as 0 | 1,
        layer: s.d > 3.5 ? 'far' : 'near',
    }));
};

export const resolveShapeLifeOpacity = (distanceToCamera: number): number => {
    const farT = clamp01((DIORAMA_SHAPE_FADE_IN_END - distanceToCamera) / (DIORAMA_SHAPE_FADE_IN_END - DIORAMA_SHAPE_FADE_IN_START));
    const nearT = clamp01((distanceToCamera - DIORAMA_SHAPE_DISSOLVE_END) / (DIORAMA_SHAPE_DISSOLVE_START - DIORAMA_SHAPE_DISSOLVE_END));
    const farS = farT * farT * (3 - 2 * farT);
    const nearS = nearT * nearT * (3 - 2 * nearT);
    return farS * nearS;
};