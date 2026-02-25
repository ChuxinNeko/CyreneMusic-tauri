export const meshVertShader = `
precision highp float;

attribute vec2 a_pos;
attribute vec3 a_color;
attribute vec2 a_uv;
varying vec3 v_color;
varying vec2 v_uv;

uniform float u_aspect;

void main() {
    v_color = a_color;
    v_uv = a_uv;
    vec2 pos = a_pos;
    if (u_aspect > 1.0) {
        pos.y *= u_aspect;
    } else {
        pos.x /= u_aspect;
    }
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const meshFragShader = `
precision mediump float;

varying vec3 v_color;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_time;
uniform float u_volume;
uniform float u_alpha;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;

// 预计算常量
const float INV_255 = 1.0 / 255.0;
const float HALF_INV_255 = 0.5 / 255.0;
const float GRADIENT_NOISE_A = 52.9829189;
const vec2 GRADIENT_NOISE_B = vec2(0.06711056, 0.00583715);

float gradientNoise(in vec2 uv) {
    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));
}

// 优化的流体扰动，减少迭代次数提升性能
vec2 fluidDistortion(vec2 uv, float t, float intensity) {
    vec2 p = uv;
    for (float i = 1.0; i < 3.0; i++) {
        p.x += intensity / i * sin(i * 3.0 * p.y + t * 1.2 + 0.3);
        p.y += intensity / i * cos(i * 3.0 * p.x + t * 1.0 + 0.3);
    }
    return p;
}

void main() {
    float bassPulse = u_bass * 0.12;
    float midFlow = 0.15 + u_mid * 0.1;
    float volumeEffect = u_volume * 1.5;
    float timeVolume = u_time * 1.0 + u_volume;
    
    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;
    
    // 1. 流体扰动
    vec2 distortedUV = fluidDistortion(v_uv, timeVolume, midFlow);
    
    // 2. 呼吸式缩放
    vec2 centeredUV = distortedUV - 0.5;
    float scale = max(0.1, 0.85 - volumeEffect - bassPulse * 0.4);
    vec2 finalUV = centeredUV * scale + 0.5;
    
    vec4 result = texture2D(u_texture, finalUV);
    
    float brightnessPulse = 1.0 + u_bass * 0.04;
    float alphaFactor = u_alpha * max(0.6, 1.0 - u_volume * 0.4);
    
    result.rgb *= v_color * alphaFactor * brightnessPulse;
    result.a *= alphaFactor;
    result.rgb += dither;
    
    // Vignette 渐变优化
    float dist = distance(v_uv, vec2(0.5));
    float vignette = smoothstep(0.8, 0.4, dist);
    result.rgb *= (0.7 + vignette * 0.3);
    
    gl_FragColor = result;
}
`;
