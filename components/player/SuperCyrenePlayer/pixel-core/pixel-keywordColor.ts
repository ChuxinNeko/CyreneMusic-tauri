import * as THREE from 'three';
import type { Theme } from './pixel-types';
import {
    buildWordColorRangesFromMatchers,
    prepareWordColorMatchers,
    resolveTokenColorMap,
    type WordColorMatcher,
} from '../default-core/wordColoring';

const ACTIVE_LINE_OPACITY = 0.92;
const KEYWORD_MIN_BG_CONTRAST = 4.5;
const KEYWORD_MIN_PRIMARY_SEPARATION = 0.4;

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

const separationFromPrimary = (color: THREE.Color, primary: THREE.Color): number =>
    Math.abs(color.r - primary.r) + Math.abs(color.g - primary.g) + Math.abs(color.b - primary.b);

const asDisplayedText = (color: THREE.Color, background: THREE.Color): THREE.Color => {
    const src = color.clone().convertLinearToSRGB();
    const dst = background.clone().convertLinearToSRGB();
    const blend = (s: number, d: number) => s * ACTIVE_LINE_OPACITY + d * (1 - ACTIVE_LINE_OPACITY);
    return new THREE.Color(blend(src.r, dst.r), blend(src.g, dst.g), blend(src.b, dst.b))
        .convertSRGBToLinear();
};

export const getDioramaKeywordDisplayedContrastRatio = (
    color: THREE.Color,
    background: THREE.Color,
): number => getDioramaParticleContrastRatio(asDisplayedText(color, background), background);

const nudgeUntil = (
    color: THREE.Color,
    target: THREE.Color,
    minimum: number,
    measure: (candidate: THREE.Color) => number,
): THREE.Color => {
    if (measure(color) >= minimum) return color.clone();
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 10; iteration += 1) {
        const amount = (low + high) * 0.5;
        if (measure(color.clone().lerp(target, amount)) >= minimum) high = amount;
        else low = amount;
    }
    return color.clone().lerp(target, high);
};

export const resolveDioramaKeywordColor = (
    keyword: THREE.Color,
    primary: THREE.Color,
    accent: THREE.Color,
    background: THREE.Color,
): THREE.Color => {
    const separated = nudgeUntil(
        keyword, accent, KEYWORD_MIN_PRIMARY_SEPARATION,
        (candidate) => separationFromPrimary(candidate, primary),
    );
    const lightTarget = new THREE.Color(0xffffff);
    const darkTarget = new THREE.Color(0x050505);
    const pole = getDioramaKeywordDisplayedContrastRatio(lightTarget, background)
        >= getDioramaKeywordDisplayedContrastRatio(darkTarget, background)
        ? lightTarget
        : darkTarget;
    return nudgeUntil(
        separated, pole, KEYWORD_MIN_BG_CONTRAST,
        (candidate) => getDioramaKeywordDisplayedContrastRatio(candidate, background),
    );
};

export const prepareDioramaKeywordMatchers = (
    wordColors: Theme['wordColors'],
    enabled: boolean,
): WordColorMatcher[] => prepareWordColorMatchers(wordColors, enabled);

export const resolveDioramaKeywordUnitColors = (
    lineText: string,
    units: { charStart: number; charEnd: number }[],
    matchers: WordColorMatcher[],
    primary: THREE.Color,
    accent: THREE.Color,
    background: THREE.Color,
): Map<number, THREE.Color> => {
    const resolved = new Map<number, THREE.Color>();
    if (!lineText || units.length === 0 || matchers.length === 0) return resolved;
    const ranges = buildWordColorRangesFromMatchers(lineText, matchers);
    if (ranges.length === 0) return resolved;
    const colorByKey = resolveTokenColorMap(
        units.map((unit, index) => ({
            key: String(index),
            timed: true,
            startOffset: unit.charStart,
            endOffset: unit.charEnd,
        })),
        ranges,
    );
    const adapted = new Map<string, THREE.Color>();
    colorByKey.forEach((hex, key) => {
        let color = adapted.get(hex);
        if (!color) {
            color = resolveDioramaKeywordColor(new THREE.Color(hex), primary, accent, background);
            adapted.set(hex, color);
        }
        resolved.set(Number(key), color);
    });
    return resolved;
};