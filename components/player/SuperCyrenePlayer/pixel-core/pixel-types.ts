// pixel-core 的 diorama 类型子集
// 从 folia 项目移植，确保 pixel-core 自包含、不依赖 folia 的完整类型树

export interface Word {
  text: string
  startTime: number
  endTime: number
  syllables?: { text: string; startTime: number; endTime: number }[]
}

export interface Line {
  words: Word[]
  startTime: number
  endTime: number
  fullText: string
  translation?: string
  id?: string
  songPart?: string
  blockIndex?: number
  isChorus?: boolean
}

export interface Theme {
  name: string
  backgroundColor: string
  primaryColor: string
  accentColor: string
  secondaryColor: string
  fontStyle: 'sans' | 'serif' | 'mono'
  fontFamily?: string
  fontFamilyStack?: string[]
  animationIntensity: 'calm' | 'normal' | 'chaotic'
  wordColors?: { word: string; color: string }[]
}

export type DioramaGeometryMode = 'clouds' | 'corridor'

export interface DioramaGeometryVisibility {
  enabled: boolean
  mode: DioramaGeometryMode
  strands: boolean
  blobs: boolean
  ribbons: boolean
  rings: boolean
}

export const DEFAULT_DIORAMA_GEOMETRY_VISIBILITY: DioramaGeometryVisibility = {
  enabled: true,
  mode: 'clouds',
  strands: true,
  blobs: true,
  ribbons: true,
  rings: true,
}

export interface DioramaTuning {
  cameraSpeed: number
  motionAmount: number
  audioReactivity: number
  geometryVisibility: DioramaGeometryVisibility
  particleDensity: number
  particleScale: number
  particleGlowEnabled: boolean
  particleGlowIntensity: number
  showParticles: boolean
  backgroundParticleCircumference: number
  backgroundParticleRadial: number
  glowEnabled: boolean
  glowIntensity: number
  soulEnabled: boolean
  soulIntensity: number
  soulActiveEnabled: boolean
  gradientEnabled: boolean
  gradientIntensity: number
  keywordColoringEnabled: boolean
}

export const DEFAULT_DIORAMA_TUNING: DioramaTuning = {
  cameraSpeed: 1,
  motionAmount: 1,
  audioReactivity: 1,
  geometryVisibility: DEFAULT_DIORAMA_GEOMETRY_VISIBILITY,
  particleDensity: 288,
  particleScale: 1,
  particleGlowEnabled: false,
  particleGlowIntensity: 0.65,
  showParticles: true,
  backgroundParticleCircumference: 18,
  backgroundParticleRadial: 2,
  glowEnabled: true,
  glowIntensity: 1,
  soulEnabled: false,
  soulIntensity: 1,
  soulActiveEnabled: false,
  gradientEnabled: false,
  gradientIntensity: 1,
  keywordColoringEnabled: true,
}

export const DIORAMA_PARTICLE_DENSITY_MIN = 96;
export const DIORAMA_PARTICLE_DENSITY_MAX = 1536;
export const DIORAMA_PARTICLE_DENSITY_STEP = 24;
export const DIORAMA_MOTE_CIRCUMFERENCE_MIN = 4;
export const DIORAMA_MOTE_CIRCUMFERENCE_MAX = 48;
export const DIORAMA_MOTE_CIRCUMFERENCE_STEP = 2;
export const DIORAMA_MOTE_RADIAL_MIN = 1;
export const DIORAMA_MOTE_RADIAL_MAX = 4;
export const DIORAMA_MOTE_RADIAL_STEP = 1;
export const DIORAMA_PARTICLE_SCALE_MIN = 0.65;
export const DIORAMA_PARTICLE_SCALE_MAX = 1.6;
export const DIORAMA_PARTICLE_SCALE_STEP = 0.05;
export const DIORAMA_PARTICLE_SIZE_MIN = DIORAMA_PARTICLE_SCALE_MIN;
export const DIORAMA_PARTICLE_SIZE_MAX = DIORAMA_PARTICLE_SCALE_MAX;
export const DIORAMA_PARTICLE_SIZE_STEP = DIORAMA_PARTICLE_SCALE_STEP;
export const DIORAMA_PARTICLE_GLOW_INTENSITY_MIN = 0.1;
export const DIORAMA_PARTICLE_GLOW_INTENSITY_MAX = 1.5;
export const DIORAMA_PARTICLE_GLOW_INTENSITY_STEP = 0.05;

export interface AudioBands {
  bass: import('framer-motion').MotionValue<number>
  lowMid: import('framer-motion').MotionValue<number>
  mid: import('framer-motion').MotionValue<number>
  vocal: import('framer-motion').MotionValue<number>
  treble: import('framer-motion').MotionValue<number>
}