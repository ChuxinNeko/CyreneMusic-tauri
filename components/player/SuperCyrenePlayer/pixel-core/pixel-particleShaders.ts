import {
    DIORAMA_SHAPE_DISSOLVE_END,
    DIORAMA_SHAPE_DISSOLVE_START,
    DIORAMA_SHAPE_FADE_IN_END,
    DIORAMA_SHAPE_FADE_IN_START,
} from './pixel-cameraPath';
import { DIORAMA_RIPPLE_COUNT } from './pixel-particleModel';

export const DIORAMA_PARTICLE_VERTEX_SHADER = `
#define RIPPLE_COUNT ${DIORAMA_RIPPLE_COUNT}

attribute vec3 aNormal;
attribute vec3 aAnchor;
attribute vec3 aScale;
attribute float aPhase;
attribute vec3 aStyle;
attribute vec2 aWave;
attribute float aKaomojiIndex;

uniform float uTime;
uniform float uCorridor;
uniform float uAmplitude;
uniform float uMaxSwell;
uniform float uWaveNumberMax;
uniform float uDetail;
uniform vec4 uRippleSource[RIPPLE_COUNT];
uniform vec4 uRippleShape[RIPPLE_COUNT];
uniform float uOffsetGain;
uniform float uFlow;
uniform float uFormation;
uniform float uScatter;
uniform float uPulse;
uniform float uSpectralCentroid;
uniform float uViewportHeight;
uniform float uSizeBase;
uniform float uSizeGain;
uniform float uGlow;
uniform float uGlowPass;
uniform float uKaomojiCount;
uniform vec3 uPrimaryColor;
uniform vec3 uAccentColor;
uniform vec3 uSecondaryColor;

varying vec3 vColor;
varying float vAlpha;
varying float vReaction;
varying float vKaomojiIndex;

float hermite(float value) { return value * value * (3.0 - 2.0 * value); }
float hash11(float n) { return fract(sin(n) * 43758.5453123); }

float resolveLife(float distanceToCamera) {
    float farT = clamp((${DIORAMA_SHAPE_FADE_IN_END.toFixed(1)} - distanceToCamera) / ${(
        DIORAMA_SHAPE_FADE_IN_END - DIORAMA_SHAPE_FADE_IN_START
    ).toFixed(1)}, 0.0, 1.0);
    float nearT = clamp((distanceToCamera - ${DIORAMA_SHAPE_DISSOLVE_END.toFixed(1)}) / ${(
        DIORAMA_SHAPE_DISSOLVE_START - DIORAMA_SHAPE_DISSOLVE_END
    ).toFixed(1)}, 0.0, 1.0);
    return hermite(farT) * hermite(nearT);
}

float ripplePacket(float r, float age, vec4 shape) {
    float dr = r - age * shape.y;
    float k = min(shape.w, uWaveNumberMax);
    float packet = exp(-(dr * dr) / (shape.z * shape.z)) * sin(dr * k);
    return shape.x * packet * exp(-age * 1.15) * exp(-r * 0.35);
}

float cloudRipples(vec3 unitPos, float phase) {
    float spin = cos(phase);
    float spun = sin(phase);
    float total = 0.0;
    for (int i = 0; i < RIPPLE_COUNT; i += 1) {
        vec4 source = uRippleSource[i];
        vec4 shape = uRippleShape[i];
        float age = uTime - source.w;
        if (shape.x <= 0.0 || age < 0.0) continue;
        vec3 origin = vec3(
            source.x * spin - source.z * spun,
            source.y,
            source.x * spun + source.z * spin
        );
        total += ripplePacket(distance(unitPos, origin), age, shape);
    }
    return total;
}

vec2 corridorSurfaceDelta(vec2 w, vec2 origin) {
    float dAngle = w.y - origin.y;
    return vec2(w.x - origin.x, atan(sin(dAngle), cos(dAngle)));
}

float corridorRipples(vec2 w) {
    float total = 0.0;
    for (int i = 0; i < RIPPLE_COUNT; i += 1) {
        vec4 source = uRippleSource[i];
        vec4 shape = uRippleShape[i];
        float age = uTime - source.w;
        if (shape.x <= 0.0 || age < 0.0) continue;
        total += ripplePacket(length(corridorSurfaceDelta(w, source.xy)), age, shape);
    }
    return total;
}

float cloudIdle(vec3 unitPos) {
    return 0.11 * sin(unitPos.x * 1.7 + uTime * 0.5) * cos(unitPos.z * 1.4 - uTime * 0.37)
         + 0.06 * sin(unitPos.y * 2.1 - uTime * 0.66);
}

float corridorIdle(vec2 w) {
    float t = uTime * uFlow;
    float region = 0.6 + 0.4 * sin(w.x * 0.42 - t * 0.33);
    float ripple = 0.62 * sin(w.x * 1.25 - t * 1.15)
                 + 0.30 * sin(w.x * 0.8 + w.y * 2.0 - t * 0.8)
                 + 0.08 * sin(w.y * 3.0 + t * 0.5);
    return region * ripple;
}

float cloudDetail(vec3 p) {
    float k = uWaveNumberMax * 0.7;
    return sin(p.x * k + uTime * 3.1)
         * sin(p.y * k - uTime * 2.6)
         * sin(p.z * k + uTime * 2.2);
}

float corridorDetail(vec2 w) {
    float k = uWaveNumberMax * 0.7;
    float n = max(1.0, floor(k));
    return sin(w.x * k + uTime * 3.1) * sin(w.y * n - uTime * 2.4);
}

void main() {
    float colorSlot = aStyle.y;
    float isFar = aStyle.z;
    vec3 normalDir = normalize(aNormal);
    float localRadius = aScale.z;
    vec3 basePos = position;
    basePos.y *= aScale.y;
    vec3 unitPos = position / localRadius;
    bool corridor = uCorridor > 0.5;
    float audio = corridor ? corridorRipples(aWave) : cloudRipples(unitPos, aPhase);
    float idle = corridor ? corridorIdle(aWave) : cloudIdle(unitPos);
    float detail = uDetail * smoothstep(0.06, 0.45, abs(audio));
    audio += (corridor ? corridorDetail(aWave) : cloudDetail(unitPos)) * detail * 0.3;
    float swell = clamp(audio + idle, -1.6, 1.6) * uAmplitude;
    vec3 displaced = basePos + normalDir * (swell * localRadius);
    float d = clamp(abs(clamp(audio, -1.6, 1.6) * uAmplitude) / max(uMaxSwell, 0.0001), 0.0, 1.0);
    displaced.z += sin(uTime * 0.6 + aPhase) * 0.12 * uOffsetGain * localRadius;
    float scatter = 1.0 - uFormation;
    if (scatter > 0.001) {
        float r1 = hash11(aPhase * 12.9898 + aWave.x * 78.233);
        float r2 = hash11(aPhase * 39.346 + aWave.y * 11.135 + 3.7);
        float r3 = hash11(r1 * 91.7 + r2 * 47.3);
        vec3 spread = normalize(normalDir * 0.75 + vec3(r1 - 0.5, r2 - 0.5, r3 - 0.5) * 1.6);
        displaced += spread * (scatter * scatter * uScatter * (0.55 + r3 * 0.9));
    }
    displaced *= aScale.x * uPulse;
    vec3 worldPosition = aAnchor + displaced;
    float life = resolveLife(distance(worldPosition, cameraPosition));
    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    float glowScale = mix(1.0, 1.9 + uGlow * 1.3, uGlowPass);
    float sizeWorld = (0.4 + (pow(d, 3.0) + detail * 0.35) * uSizeGain) * glowScale;
    float projected = sizeWorld * uViewportHeight * projectionMatrix[1][1] * 0.5 / max(-mvPosition.z, 0.1);
    gl_PointSize = clamp(projected, mix(24.0, 32.0, uGlowPass), mix(128.0, 192.0, uGlowPass));
    gl_Position = projectionMatrix * mvPosition;
    float gradientPhase = (
        dot(basePos, vec3(0.2, 0.16, 0.13))
        + aPhase * 0.05
        + colorSlot * 0.5
        + uTime * 0.02
        + uSpectralCentroid * 0.3
    ) * 6.283;
    vec3 wgt = max(vec3(0.0), 0.5 + 0.5 * cos(gradientPhase - vec3(0.0, 2.094, 4.188)));
    wgt *= wgt; wgt /= max(wgt.x + wgt.y + wgt.z, 0.001);
    vec3 baseColor = uPrimaryColor * wgt.x + uAccentColor * wgt.y + uSecondaryColor * wgt.z;
    vec3 hotColor = mix(uAccentColor, uSecondaryColor, smoothstep(0.2, 0.9, uSpectralCentroid));
    float hot = min(1.0, smoothstep(0.1, 0.75, d) * 0.75 + detail * 0.3);
    vColor = mix(baseColor, hotColor, hot) * (0.92 + d * 0.5);
    float layerBase = mix(0.72, 0.5, isFar);
    float formed = smoothstep(0.0, 0.45, uFormation);
    vAlpha = formed * (uGlowPass > 0.5
        ? life * smoothstep(0.1, 0.8, d) * 1.15
        : life * min(1.0, layerBase + d * 0.28));
    vReaction = d;
    vKaomojiIndex = aKaomojiIndex;
}
`;

export const DIORAMA_PARTICLE_FRAGMENT_SHADER = `
uniform float uGlow;
uniform float uGlowPass;
uniform sampler2D uKaomojiAtlas;
uniform float uAtlasCols;
uniform float uAtlasRows;
uniform float uKaomojiCount;

varying vec3 vColor;
varying float vAlpha;
varying float vReaction;
varying float vKaomojiIndex;

vec3 dioramaLinearToSRGB(vec3 linear) {
    vec3 safe = max(linear, vec3(0.0));
    return mix(
        pow(safe, vec3(0.41666)) * 1.055 - vec3(0.055),
        safe * 12.92,
        vec3(lessThanEqual(safe, vec3(0.0031308)))
    );
}

void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);

    float clampedIndex = mod(floor(vKaomojiIndex + 0.5), uKaomojiCount);
    float col = mod(clampedIndex, uAtlasCols);
    float row = floor(clampedIndex / uAtlasCols);
    vec2 cellSize = vec2(1.0 / uAtlasCols, 1.0 / uAtlasRows);
    vec2 flippedCoord = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
    vec2 cellOffset = vec2(col * cellSize.x, row * cellSize.y);
    vec2 atlasUv = cellOffset + flippedCoord * cellSize;
    vec4 kaomojiTexel = texture2D(uKaomojiAtlas, atlasUv);

    if (uGlowPass > 0.5) {
        float halo = pow(clamp(1.0 - radius * 2.0, 0.0, 1.0), 1.7);
        float alpha = min(0.5, halo * vAlpha * uGlow * 0.4);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(dioramaLinearToSRGB(vColor * (1.0 + uGlow * 0.25)), alpha);
        return;
    }

    float alpha = kaomojiTexel.a * vAlpha;
    if (alpha < 0.01) discard;
    float emission = 0.95 + vReaction * 0.22;
    vec3 tinted = vColor * kaomojiTexel.rgb;
    gl_FragColor = vec4(dioramaLinearToSRGB(tinted * emission), alpha);
}
`;