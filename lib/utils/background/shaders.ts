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
precision highp float;

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

/* Gradient noise from Jorge Jimenez's presentation: */
/* http://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare */
float gradientNoise(in vec2 uv) {
    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));
}

// 优化的旋转函数，避免重复计算sin/cos
vec2 rot(vec2 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// 流体扰动计算（Domain Warping），基于多个正弦波叠加创造类似流体的有机扭曲场
vec2 fluidDistortion(vec2 uv, float t, float intensity) {
    vec2 p = uv;
    for (float i = 1.0; i < 4.0; i++) {
        vec2 newP = p;
        newP.x += intensity / i * sin(i * 4.0 * p.y + t * 1.5 + 0.3);
        newP.y += intensity / i * cos(i * 4.0 * p.x + t * 1.2 + 0.3);
        p = newP;
    }
    return p;
}

void main() {
    // 低频脉冲（鼓点/bass）: 驱动呼吸式缩放
    float bassPulse = u_bass * 0.15;
    // 中频流动: 增强流体扭曲幅度
    float midFlow = 0.15 + u_mid * 0.12;
    // 高频活力: 增加旋转角速度
    float trebleEnergy = u_treble * 0.3;
    
    float volumeEffect = u_volume * 2.0;
    float timeVolume = u_time * 1.2 + u_volume;
    
    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;
    
    // 1. 应用流体扰动，中频控制扰动强度
    vec2 distortedUV = fluidDistortion(v_uv, timeVolume, midFlow);
    
    // 2. 将坐标原点移到中心并应用缩放（移除高频旋转）
    vec2 centeredUV = distortedUV - vec2(0.5);
    // 低频驱动呼吸式柔和缩放脉冲
    float scale = max(0.001, 0.8 - volumeEffect - bassPulse * 0.5);
    vec2 finalUV = centeredUV * scale + vec2(0.5);
    
    vec4 result = texture2D(u_texture, finalUV);
    
    // 低频增加微弱亮度脉冲，避免闪屏
    float brightnessPulse = 1.0 + u_bass * 0.05;
    
    float alphaVolumeFactor = u_alpha * max(0.5, 1.0 - u_volume * 0.5);
    result.rgb *= v_color * alphaVolumeFactor * brightnessPulse;
    result.a *= alphaVolumeFactor;
    
    result.rgb += vec3(dither);
    
    float dist = distance(v_uv, vec2(0.5));
    float vignette = smoothstep(0.8, 0.3, dist);
    float mask = 0.6 + vignette * 0.4;
    result.rgb *= mask;
    
    gl_FragColor = result;
}
`;
