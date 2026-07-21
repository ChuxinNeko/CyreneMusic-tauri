import {
    DEFAULT_DIORAMA_TUNING,
    DIORAMA_MOTE_CIRCUMFERENCE_MAX,
    DIORAMA_MOTE_CIRCUMFERENCE_MIN,
    DIORAMA_MOTE_RADIAL_MAX,
    DIORAMA_MOTE_RADIAL_MIN,
} from './pixel-types';
import {
    composeLocal,
    DIORAMA_STEP_DISTANCE,
    hashSeed,
    seededUnit,
    type DioramaFrame,
} from './pixel-cameraPath';

// 颜文字图集中可选的颜文字数量上限（buildKaomojiAtlas 中定义）
import { KAOMOJI_LIST } from './pixel-kaomoji';

export const DIORAMA_MOTE_LINES_BEHIND = 2;
export const DIORAMA_MOTE_LINES_AHEAD = 5;
export const DIORAMA_MOTE_WINDOW_LINES = DIORAMA_MOTE_LINES_BEHIND + DIORAMA_MOTE_LINES_AHEAD + 1;
export const DIORAMA_MOTE_MAX_POINTS = DIORAMA_MOTE_WINDOW_LINES
    * DIORAMA_MOTE_CIRCUMFERENCE_MAX * DIORAMA_MOTE_RADIAL_MAX;

export const resolveDioramaMoteCircumference = (requested: number): number =>
    Math.round(Math.min(
        DIORAMA_MOTE_CIRCUMFERENCE_MAX,
        Math.max(DIORAMA_MOTE_CIRCUMFERENCE_MIN, Number.isFinite(requested) ? requested : DEFAULT_DIORAMA_TUNING.backgroundParticleCircumference),
    ));

export const resolveDioramaMoteRadial = (requested: number): number =>
    Math.round(Math.min(
        DIORAMA_MOTE_RADIAL_MAX,
        Math.max(DIORAMA_MOTE_RADIAL_MIN, Number.isFinite(requested) ? requested : DEFAULT_DIORAMA_TUNING.backgroundParticleRadial),
    ));

export const dioramaMoteSlot = (line: number): number =>
    ((line % DIORAMA_MOTE_WINDOW_LINES) + DIORAMA_MOTE_WINDOW_LINES) % DIORAMA_MOTE_WINDOW_LINES;

const MOTE_INNER_RADIUS = 2.4;
const MOTE_RADIAL_SPAN = 5.2;
const MOTE_VERTICAL_SQUASH = 0.64;

const radicalInverse = (index: number, base: number): number => {
    let result = 0;
    let fraction = 1 / base;
    let i = index;
    while (i > 0) {
        result += (i % base) * fraction;
        i = Math.floor(i / base);
        fraction /= base;
    }
    return result;
};

export const extendDioramaFrame = (frame: DioramaFrame, steps: number): DioramaFrame =>
    steps === 0 ? frame : {
        position: {
            x: frame.position.x + frame.forward.x * DIORAMA_STEP_DISTANCE * steps,
            y: frame.position.y + frame.forward.y * DIORAMA_STEP_DISTANCE * steps,
            z: frame.position.z + frame.forward.z * DIORAMA_STEP_DISTANCE * steps,
        },
        forward: frame.forward,
        right: frame.right,
        up: frame.up,
    };

const KAOMOJI_COUNT = KAOMOJI_LIST.length;

/**
 * 写入一行 mote 粒子的位置 + 颜文字索引 + 相位。
 *
 * 三个数组共享同一套循环参数，每个粒子的 kaomojiIndex 和 phase
 * 由其 (line, ri, ci) 确定性派生，保证换行/重写时结果一致。
 */
export const writeDioramaMoteLine = (
    outPositions: Float32Array,
    outKaomoji: Float32Array,
    outPhase: Float32Array,
    frame: DioramaFrame,
    line: number,
    circumference: number,
    radial: number,
    seed: string | number | undefined,
): void => {
    const base = hashSeed(seed);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const twoPi = Math.PI * 2;
    const phase = seededUnit(base + 991) * twoPi;
    const total = circumference * radial;
    const slotStart = dioramaMoteSlot(line) * total;
    let write3 = slotStart * 3;
    let write1 = slotStart;
    for (let ri = 0; ri < radial; ri += 1) {
        for (let ci = 0; ci < circumference; ci += 1) {
            const p = ri * circumference + ci;
            const s = base + line * 131 + p * 17;
            const stratum = (ri + 0.35 + seededUnit(s + 4) * 0.3) / radial;
            const radius = MOTE_INNER_RADIUS + Math.sqrt(stratum) * MOTE_RADIAL_SPAN;
            const angle = phase + (line + ri) * goldenAngle
                + (ci / circumference) * twoPi
                + (seededUnit(s + 3) - 0.5) * (twoPi / circumference);
            const depth = (radicalInverse(p + 1, 2) + (seededUnit(s + 2) - 0.5) / total - 0.5)
                * DIORAMA_STEP_DISTANCE;
            const point = composeLocal(
                frame,
                Math.cos(angle) * radius,
                Math.sin(angle) * radius * MOTE_VERTICAL_SQUASH,
                depth,
            );
            outPositions[write3] = point.x;
            outPositions[write3 + 1] = point.y;
            outPositions[write3 + 2] = point.z;
            write3 += 3;

            outKaomoji[write1] = Math.floor(seededUnit(s + 7) * KAOMOJI_COUNT);
            outPhase[write1] = seededUnit(s + 11) * twoPi;
            write1 += 1;
        }
    }
};