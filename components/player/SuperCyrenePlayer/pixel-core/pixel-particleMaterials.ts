import * as THREE from 'three';
import { DIORAMA_RIPPLE_COUNT } from './pixel-particleModel';
import {
    DIORAMA_PARTICLE_FRAGMENT_SHADER,
    DIORAMA_PARTICLE_VERTEX_SHADER,
} from './pixel-particleShaders';
import { buildKaomojiAtlas } from './pixel-kaomoji';

export interface DioramaParticleColors {
    primary: THREE.Color;
    accent: THREE.Color;
    secondary: THREE.Color;
}

const relativeLuminance = (color: THREE.Color): number =>
    0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

export const getDioramaParticleContrastRatio = (
    foreground: THREE.Color,
    background: THREE.Color,
): number => {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
};

const CALM_EMISSION = 0.92 * 0.95;
const CONTRAST_LAYER_ALPHA = 0.72;

const asDisplayed = (color: THREE.Color, background: THREE.Color): THREE.Color => {
    const src = color.clone().multiplyScalar(CALM_EMISSION).convertLinearToSRGB();
    const dst = background.clone().convertLinearToSRGB();
    const blend = (s: number, d: number) => s * CONTRAST_LAYER_ALPHA + d * (1 - CONTRAST_LAYER_ALPHA);
    return new THREE.Color(blend(src.r, dst.r), blend(src.g, dst.g), blend(src.b, dst.b))
        .convertSRGBToLinear();
};

export const getDioramaParticleDisplayedContrastRatio = (
    color: THREE.Color, background: THREE.Color,
): number => getDioramaParticleContrastRatio(asDisplayed(color, background), background);

const adaptColorToBackground = (
    color: THREE.Color,
    background: THREE.Color,
    minimumContrast: number,
): THREE.Color => {
    if (getDioramaParticleDisplayedContrastRatio(color, background) >= minimumContrast) {
        return color.clone();
    }
    const lightTarget = new THREE.Color(0xffffff);
    const darkTarget = new THREE.Color(0x050505);
    const target = getDioramaParticleDisplayedContrastRatio(lightTarget, background)
        >= getDioramaParticleDisplayedContrastRatio(darkTarget, background)
        ? lightTarget
        : darkTarget;
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 10; iteration += 1) {
        const amount = (low + high) * 0.5;
        const candidate = color.clone().lerp(target, amount);
        if (getDioramaParticleDisplayedContrastRatio(candidate, background) >= minimumContrast) {
            high = amount;
        } else {
            low = amount;
        }
    }
    return color.clone().lerp(target, high);
};

export const resolveDioramaParticleContrastColors = (
    colors: DioramaParticleColors,
    background: THREE.Color,
): DioramaParticleColors => ({
    primary: adaptColorToBackground(colors.primary, background, 4.6),
    accent: adaptColorToBackground(colors.accent, background, 4.1),
    secondary: adaptColorToBackground(colors.secondary, background, 4.6),
});

const buildUniforms = (colors: DioramaParticleColors, glowPass: number, glowIntensity: number) => {
    const atlas = buildKaomojiAtlas();
    return {
        uTime: { value: 0 },
        uCorridor: { value: 0 },
        uAmplitude: { value: 0.34 },
        uMaxSwell: { value: 0.29 },
        uWaveNumberMax: { value: 8 },
        uDetail: { value: 0 },
        uRippleSource: { value: new Float32Array(DIORAMA_RIPPLE_COUNT * 4) },
        uRippleShape: { value: new Float32Array(DIORAMA_RIPPLE_COUNT * 4) },
        uOffsetGain: { value: 0 },
        uFlow: { value: 1 },
        uFormation: { value: 1 },
        uScatter: { value: 4 },
        uSizeBase: { value: 0.052 },
        uSizeGain: { value: 0.3 },
        uPulse: { value: 1 },
        uSpectralCentroid: { value: 0.5 },
        uViewportHeight: { value: 1 },
        uGlow: { value: glowIntensity },
        uGlowPass: { value: glowPass },
        uPrimaryColor: { value: colors.primary.clone() },
        uAccentColor: { value: colors.accent.clone() },
        uSecondaryColor: { value: colors.secondary.clone() },
        uKaomojiAtlas: { value: atlas.texture },
        uAtlasCols: { value: atlas.cols },
        uAtlasRows: { value: atlas.rows },
        uKaomojiCount: { value: atlas.count },
    };
};

export const createDioramaParticleMaterial = (
    colors: DioramaParticleColors,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    vertexShader: DIORAMA_PARTICLE_VERTEX_SHADER,
    fragmentShader: DIORAMA_PARTICLE_FRAGMENT_SHADER,
    uniforms: buildUniforms(colors, 0, 0),
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
});

export const createDioramaParticleGlowMaterial = (
    colors: DioramaParticleColors,
    glowIntensity: number,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    vertexShader: DIORAMA_PARTICLE_VERTEX_SHADER,
    fragmentShader: DIORAMA_PARTICLE_FRAGMENT_SHADER,
    uniforms: buildUniforms(colors, 1, glowIntensity),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
});

export const lerpDioramaParticleMaterialColors = (
    material: THREE.ShaderMaterial,
    colors: DioramaParticleColors,
    amount: number,
): void => {
    (material.uniforms.uPrimaryColor.value as THREE.Color).lerp(colors.primary, amount);
    (material.uniforms.uAccentColor.value as THREE.Color).lerp(colors.accent, amount);
    (material.uniforms.uSecondaryColor.value as THREE.Color).lerp(colors.secondary, amount);
};