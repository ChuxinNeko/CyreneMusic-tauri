import * as THREE from 'three'
import { seededRandom } from './galaxy-math'

/**
 * 螺旋星系背景星尘
 *
 * 使用 THREE.Points + 自定义 ShaderMaterial：
 * - 顶点着色器：缓慢旋转 + 音频驱动的径向脉动
 * - 片元着色器：圆形软粒子 + 闪烁 + 距离衰减
 */

export const STARFIELD_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uRotation;
  attribute float aSize;
  attribute float aPhase;
  attribute float aRadius;
  varying float vAlpha;
  varying float vPhase;

  void main() {
    // 绕 Y 轴缓慢旋转，内圈快、外圈慢（较差自转，模拟星系）
    float angularSpeed = uRotation / max(aRadius, 0.8);
    float angle = angularSpeed * uTime;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec3 pos = position;
    pos.xz = mat2(cosA, -sinA, sinA, cosA) * position.xz;

    // 低频脉动：bass 驱动径向呼吸
    float pulse = 1.0 + uBass * 0.12 * sin(aPhase * 6.2831 + uTime * 2.0);
    pos *= pulse;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mvPosition.z;
    gl_PointSize = aSize * (140.0 / dist);
    gl_Position = projectionMatrix * mvPosition;

    // 距离衰减 + 闪烁预计算
    vAlpha = smoothstep(60.0, 8.0, dist) * (0.55 + 0.45 * sin(aPhase * 6.2831 + uTime * (1.2 + aPhase)));
    vPhase = aPhase;
  }
`

export const STARFIELD_FRAGMENT = /* glsl */ `
  uniform vec3 uColorInner;
  uniform vec3 uColorOuter;
  varying float vAlpha;
  varying float vPhase;

  void main() {
    // 圆形软粒子
    float d = length(gl_PointCoord - vec2(0.5));
    float circle = smoothstep(0.5, 0.08, d);
    if (circle < 0.01) discard;

    // 内外圈颜色混合（暖色核心 → 冷色外围）
    vec3 color = mix(uColorInner, uColorOuter, vPhase);
    gl_FragColor = vec4(color, circle * vAlpha * 0.62);
  }
`

export interface StarfieldUniforms {
  uTime: { value: number }
  uBass: { value: number }
  uRotation: { value: number }
  uColorInner: { value: THREE.Color }
  uColorOuter: { value: THREE.Color }
}

/**
 * 创建星尘几何体：粒子分布在扁球壳 + 旋臂密度调制中。
 *
 * 密度函数模拟旋臂：在两条对数螺旋臂附近粒子更密集。
 */
export const createStarfieldGeometry = (count: number, seed: number): THREE.BufferGeometry => {
  const rng = seededRandom(seed)
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const radii = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // 半径分布：幂律偏向内侧（星系亮度集中）
    const r = 2.0 + Math.pow(rng(), 0.65) * 26.0
    // 角度：旋臂密度调制 —— 两条臂
    const armAngle = Math.log(r / 2.6) / 0.5 // 对数螺旋反解 θ
    const armOffset = Math.sin(armAngle * 2.0) * 0.55 // 双臂
    const theta = rng() * Math.PI * 2 + armOffset * (rng() < 0.62 ? 1 : 0)

    // 垂直方向：越外围越薄（银盘）
    const thickness = Math.max(0.25, 2.2 - r * 0.06)
    const y = (rng() - 0.5) * 2 * thickness * (0.3 + 0.7 * rng())

    positions[i * 3] = r * Math.cos(theta)
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = r * Math.sin(theta)

    sizes[i] = 0.6 + rng() * 2.4
    phases[i] = rng()
    radii[i] = r
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1))
  return geometry
}

/** 创建星尘材质 */
export const createStarfieldMaterial = (
  colorInner: THREE.Color,
  colorOuter: THREE.Color,
  rotationSpeed: number,
): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    vertexShader: STARFIELD_VERTEX,
    fragmentShader: STARFIELD_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uRotation: { value: rotationSpeed },
      uColorInner: { value: colorInner },
      uColorOuter: { value: colorOuter },
    } as StarfieldUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })