"use client"

import { useRef, useEffect, useCallback } from "react"
import * as THREE from "three"

/**
 * Vertex Shader — 丝绸预设: 粒子铺在 XY 平面, Z 轴随音频起伏
 * 灵感来自 Mineradio 的 SILK preset, 适配 Cyrene 的数据模型
 */
const vertexShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform float uIntensity;
uniform float uPixel;
uniform float uHasCover;
uniform sampler2D uCoverTex;

attribute vec2 aUv;
attribute float aRand;

varying vec3 vColor;
varying float vBright;
varying float vAlpha;

// Simplex noise 3D (Ashima)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 perm(vec4 x) { return mod289v(((x * 34.0) + 1.0) * x); }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = perm(perm(perm(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = inversesqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
  float t = uTime;
  vec3 pos = position;
  vec2 uv = aUv;

  // 封面颜色 — 从纹理采样
  vec2 safeUv = clamp(aUv, vec2(0.002), vec2(0.998));
  vec3 coverColor = texture2D(uCoverTex, safeUv).rgb;
  // 无封面时的默认渐变
  vec3 defaultColor = mix(
    vec3(0.26, 0.18, 0.62),
    mix(vec3(0.75, 0.45, 0.88), vec3(0.35, 0.68, 0.88), uv.x),
    uv.y
  );
  vColor = mix(defaultColor, coverColor, uHasCover);

  float K = uIntensity * 1.6;

  // ---- SILK: 丝绸模式 ----
  // 低频: 大幅呼吸起伏
  float bassBreath = snoise(vec3(pos.x * 0.35, pos.y * 0.35, t * 0.4)) * uBass * 0.55 * K;
  // 中频: 缓慢波浪
  float midN = snoise(vec3(pos.x * 1.4, pos.y * 1.4, t * 0.55)) * 0.6
             + snoise(vec3(pos.x * 2.8 + 5.0, pos.y * 2.8 - 3.0, t * 0.85)) * 0.4;
  float midMask = 0.55 + 0.45 * snoise(vec3(pos.x * 0.4, pos.y * 0.4, t * 0.18));
  float midDisp = midN * uMid * 0.65 * midMask * K;
  // 高频: 细碎抖动
  float trebleJ = snoise(vec3(pos.x * 6.5, pos.y * 6.5, t * 3.5 + aRand * 4.0)) * uTreble * 0.22 * K;

  // 节拍脉冲: 中心凸起
  float beatPulse = uBeat * 0.35 * K;

  pos.z = bassBreath + midDisp + trebleJ + beatPulse;

  // 鼠标交互: 推开
  // (通过 uMouseXY 在 JS 端传入, 这里用 uniform)
  // 为了简化, 鼠标交互在 JS 端通过粒子组旋转实现

  // 颜色增强
  vColor = pow(max(vColor, vec3(0.0)), vec3(1.0 / 1.1));

  // 亮度
  vBright = 0.88 + bassBreath * 0.15 + midDisp * 0.10 + uBeat * 0.25 + uTreble * 0.08;
  vAlpha = 1.0;

  // 粒子大小: 深度感知 + 音频增强
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  float depthSize = 42.0 / max(0.5, -mvPos.z);
  float audioBoost = 1.0 + uBeat * 0.35 + uTreble * 0.15;
  float sz = clamp(depthSize * audioBoost, 1.2, 5.5);

  gl_PointSize = sz * uPixel;
  gl_Position = projectionMatrix * mvPos;
}
`

const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uDotTex;
uniform float uAlpha;

varying vec3 vColor;
varying float vBright;
varying float vAlpha;

void main() {
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.02) discard;

  vec3 col = vColor * vBright;
  col = clamp(col, vec3(0.0), vec3(1.8));

  gl_FragColor = vec4(col, tex.a * uAlpha * vAlpha);
}
`

/**
 * 辉光层 — 更大的粒子 + 加法混合
 */
const bloomVertexShader = vertexShader.replace(
  "gl_PointSize = sz * uPixel;",
  "gl_PointSize = sz * uPixel * 2.6;"
)

const bloomFragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uDotTex;
uniform float uAlpha;
varying vec3 vColor;
varying float vBright;
varying float vAlpha;
void main() {
  vec4 tex = texture2D(uDotTex, gl_PointCoord);
  if (tex.a < 0.01) discard;
  vec3 col = vColor * vBright * 0.35;
  gl_FragColor = vec4(col, tex.a * uAlpha * vAlpha * 0.18);
}
`

// ---- 粒子网格参数 ----
const GRID = 120
const PCOUNT = GRID * GRID
const PLANE_SIZE = 4.8

function makeDotTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas")
  cv.width = cv.height = 64
  const ctx = cv.getContext("2d")!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31)
  g.addColorStop(0.0, "rgba(255,255,255,0.96)")
  g.addColorStop(0.42, "rgba(255,255,255,0.78)")
  g.addColorStop(0.72, "rgba(255,255,255,0.22)")
  g.addColorStop(1.0, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(cv)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

function buildGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(PCOUNT * 3)
  const uvs = new Float32Array(PCOUNT * 2)
  const rands = new Float32Array(PCOUNT)
  const step = 1 / GRID

  for (let i = 0; i < PCOUNT; i++) {
    const gx = i % GRID
    const gy = Math.floor(i / GRID)
    const u = (gx + 0.5) * step
    const v = (gy + 0.5) * step
    positions[i * 3] = (gx / (GRID - 1) - 0.5) * PLANE_SIZE
    positions[i * 3 + 1] = (gy / (GRID - 1) - 0.5) * PLANE_SIZE
    positions[i * 3 + 2] = 0
    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
    rands[i] = Math.random()
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1))
  return geo
}

/** 把封面图片绘制到 Canvas 并提取像素, 更新封面纹理 */
function updateCoverTexture(
  texture: THREE.CanvasTexture,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  imageUrl: string
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      texture.needsUpdate = true
      resolve()
    }
    img.onerror = () => resolve()
    img.src = imageUrl
  })
}

export interface ParticleAlbumCoverProps {
  /** 封面图片 URL */
  coverUrl: string | null
  /** 音频频谱数据 */
  frequency: { bass: number; mid: number; treble: number }
  /** 节拍强度 0~1 */
  beat: number
  /** 是否正在播放 */
  isPlaying: boolean
}

export function ParticleAlbumCover({
  coverUrl,
  frequency,
  beat,
  isPlaying,
}: ParticleAlbumCoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const particlesRef = useRef<THREE.Points | null>(null)
  const bloomRef = useRef<THREE.Points | null>(null)
  const uniformsRef = useRef<Record<string, THREE.IUniform> | null>(null)
  const coverTexRef = useRef<THREE.CanvasTexture | null>(null)
  const coverCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const coverCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const currentCoverRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef(performance.now())

  // 拖拽旋转状态
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    rotX: 0,
    rotY: 0,
  })

  // 频率数据 ref (避免闭包陷阱)
  const freqRef = useRef(frequency)
  freqRef.current = frequency
  const beatRef = useRef(beat)
  beatRef.current = beat
  const playingRef = useRef(isPlaying)
  playingRef.current = isPlaying
  const coverUrlRef = useRef<string | null>(coverUrl)
  coverUrlRef.current = coverUrl

  // 初始化 Three.js 场景
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 场景
    const scene = new THREE.Scene()
    scene.background = null

    // 相机
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 6.6

    // 渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.domElement.style.background = "transparent"
    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    container.appendChild(renderer.domElement)

    // 封面纹理
    const coverCanvas = document.createElement("canvas")
    coverCanvas.width = coverCanvas.height = 256
    const coverCtx = coverCanvas.getContext("2d")!
    coverCtx.fillStyle = "#1c1c28"
    coverCtx.fillRect(0, 0, 256, 256)
    const coverTex = new THREE.CanvasTexture(coverCanvas)
    coverTex.minFilter = THREE.LinearFilter
    coverTex.magFilter = THREE.LinearFilter

    coverTexRef.current = coverTex
    coverCanvasRef.current = coverCanvas
    coverCtxRef.current = coverCtx

    // 点纹理
    const dotTex = makeDotTexture()

    // 粒子几何
    const geo = buildGeometry()

    // Uniforms
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uIntensity: { value: 0.85 },
      uPixel: { value: renderer.getPixelRatio() },
      uAlpha: { value: 0 },
      uHasCover: { value: 0 },
      uDotTex: { value: dotTex },
      uCoverTex: { value: coverTex },
    }
    uniformsRef.current = uniforms

    // 主粒子材质
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    // 辉光粒子材质
    const bloomMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: bloomVertexShader,
      fragmentShader: bloomFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // 粒子网格
    const particles = new THREE.Points(geo, material)
    const bloom = new THREE.Points(geo, bloomMaterial)

    scene.add(particles)
    scene.add(bloom)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    particlesRef.current = particles
    bloomRef.current = bloom

    // 初始淡入
    uniforms.uAlpha.value = 0

    // 如果已有封面 URL，立即加载（处理进入播放器时已有歌曲的场景）
    const pendingCover = coverUrlRef.current
    if (pendingCover) {
      currentCoverRef.current = pendingCover
      updateCoverTexture(coverTex, coverCanvas, coverCtx, pendingCover).then(() => {
        uniforms.uHasCover.value = 1
      })
    }

    // 动画循环
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)

      const now = performance.now()
      const t = (now - startTimeRef.current) / 1000
      const freq = freqRef.current
      const beatVal = beatRef.current
      const playing = playingRef.current

      // 更新 uniforms
      uniforms.uTime.value = t
      // 平滑过渡音频值
      uniforms.uBass.value += (freq.bass - uniforms.uBass.value) * 0.25
      uniforms.uMid.value += (freq.mid - uniforms.uMid.value) * 0.25
      uniforms.uTreble.value += (freq.treble - uniforms.uTreble.value) * 0.25
      uniforms.uBeat.value += (beatVal - uniforms.uBeat.value) * 0.35

      // 淡入
      const targetAlpha = playing ? 1.0 : 0.4
      uniforms.uAlpha.value += (targetAlpha - uniforms.uAlpha.value) * 0.06

      // 松手后才继续累积惯性；拖拽中旋转值已在指针事件内直接更新。
      const drag = dragRef.current
      if (!drag.isDragging) {
        drag.vx *= 0.94
        drag.vy *= 0.94
        if (Math.abs(drag.vx) < 0.0001) drag.vx = 0
        if (Math.abs(drag.vy) < 0.0001) drag.vy = 0
        drag.rotY += drag.vx
        drag.rotX += drag.vy
      }

      // 应用旋转到粒子组
      particles.rotation.x = drag.rotX
      particles.rotation.y = drag.rotY
      bloom.rotation.x = drag.rotX
      bloom.rotation.y = drag.rotY

      renderer.render(scene, camera)
    }

    animate()

    // Resize
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      uniforms.uPixel.value = renderer.getPixelRatio()
    }

    const ro = new ResizeObserver(onResize)
    ro.observe(container)
    onResize()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      container.removeChild(renderer.domElement)
      renderer.dispose()
      geo.dispose()
      material.dispose()
      bloomMaterial.dispose()
      dotTex.dispose()
      coverTex.dispose()
    }
  }, [])

  // 更新封面纹理
  useEffect(() => {
    if (!coverUrl || coverUrl === currentCoverRef.current) return
    currentCoverRef.current = coverUrl
    const tex = coverTexRef.current
    const canvas = coverCanvasRef.current
    const ctx = coverCtxRef.current
    if (tex && canvas && ctx) {
      updateCoverTexture(tex, canvas, ctx, coverUrl).then(() => {
        if (uniformsRef.current) {
          uniformsRef.current.uHasCover.value = 1
        }
      })
    }
  }, [coverUrl])

  // 鼠标/触摸拖拽
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    drag.isDragging = true
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    drag.vx = 0
    drag.vy = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag.isDragging) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    const sensitivity = 0.006

    // 水平拖动绕 Y 轴旋转，垂直拖动绕 X 轴旋转；两者均与指针方向一致。
    drag.rotY += dx * sensitivity
    drag.rotX += dy * sensitivity
    drag.vx = dx * sensitivity
    drag.vy = dy * sensitivity
    drag.lastX = e.clientX
    drag.lastY = e.clientY
  }, [])

  const onPointerUp = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: "none", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}