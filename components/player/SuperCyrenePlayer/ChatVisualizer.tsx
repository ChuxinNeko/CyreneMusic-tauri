"use client"

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValueEvent, useSpring, useTransform, type MotionValue } from "framer-motion"
import { layoutWithLines, prepareWithSegments, type PrepareOptions } from "@chenglou/pretext"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DEFAULT_CHAT_TUNING,
  type ChatAvatarImage,
  type ChatEmojiImage,
  type ChatTuning,
  type Line,
  type Theme,
} from "./default-core/default-types"
import { resolveThemeFontStack } from "./default-core/fontStacks"
import {
  buildLineGraphemeTimeline,
  buildWordGraphemeTimings,
  splitLyricGraphemes,
} from "./default-core/graphemeTiming"
import { getLineRenderEndTime, getLineRenderHints } from "./default-core/renderHints"
import { mixColors } from "./default-core/colorMix"
import {
  builtinAvatarImages,
  resolveChatAvatarUrl,
} from "./chat-core/chat-avatarImages"
import {
  createChatAgentSenderResolver,
  type ChatMessageSender,
} from "./chat-core/chat-messageSenders"
import { builtinEmoImages } from "./chat-core/chat-emoImages"

// SSR 环境下 useLayoutEffect 会告警；客户端用 layout 版以在绘制前生效。
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/**
 * 对话可视化器 —— 聊天气泡式歌词。
 *
 * 移植自 folia-major 的 VisualizerChat，去除其 VisualizerShell /
 * SubtitleOverlay / runtime / i18n 外壳，改为纯 DOM 层，直接叠加在
 * SuperCyrene 的动态背景之上。核心效果（左右发言人、逐字气泡扩展、
 * 扫光、表情随机插入、三档动画强度）保持一致。
 */

interface ChatVisualizerProps {
  currentTime: MotionValue<number>
  currentLineIndex: number
  lines: Line[]
  theme: Theme
  showText?: boolean
  songTitle?: string
  coverUrl?: string | null
  seed?: string | number
  lyricsFontScale?: number
  chatTuning?: ChatTuning
  chatCustomEmojiImages?: ChatEmojiImage[]
  chatCustomAvatarImages?: ChatAvatarImage[]
  isPreviewMode?: boolean
  /** 是否正在播放；用于 CSS 逐字揭示动画的 play-state，暂停/跳转时保持与播放时钟一致 */
  isPlaying?: boolean
  /** 右侧发言人头像（登录用户头像）；提供时右侧气泡固定使用它，未登录/无头像时回退到原逻辑 */
  rightAvatarUrl?: string | null
}

type ChatSide = "left" | "right"

interface ChatLineMessage {
  id: string
  kind: "lyric"
  line: Line
  lineIndex: number
  side: ChatSide
  avatarIndex: number
}

interface ChatEmoMessage {
  id: string
  kind: "emo"
  line: Line
  lineIndex: number
  side: ChatSide
  avatarIndex: number
  emoImageUrl: string
  activationStartTime: number
  activationEndTime: number
}

interface ChatTitleMessage {
  id: string
  kind: "title"
  text: string
  side: ChatSide
  avatarIndex: number
}

// 间奏分割线：像翻聊天记录时的时间分隔条，是 cozy 版的原创记忆点。
// 非 timed 消息，仅按 lineIndex 决定何时出现。
interface ChatDividerMessage {
  id: string
  kind: "divider"
  lineIndex: number
  label: string
}

type ChatMessage = ChatTitleMessage | ChatLineMessage | ChatEmoMessage | ChatDividerMessage

type ChatTimedMessage = ChatLineMessage | ChatEmoMessage

const isTimedMessage = (m: ChatMessage): m is ChatTimedMessage =>
  m.kind === "lyric" || m.kind === "emo"

const SHORT_LINE_CHAR_LIMIT = 12
const MAX_VISIBLE_MESSAGES_DESKTOP = 20
const MAX_VISIBLE_MESSAGES_MOBILE = 8
const AVATAR_GRID_SIZE = 3
// cozy 版收敛为 2 个左侧发言人，弱化「群聊」感，偏向「双人对话」。
const LEFT_AVATAR_INDICES = [0, 4]
const RIGHT_AVATAR_INDEX = 8
// 相邻歌词间隔超过该秒数视为「间奏」，插入一条时间分割线（cozy 版原创细节）。
const CHAT_DIVIDER_GAP_SECONDS = 8
const CHAT_PREHEAT_MIN_LEAD = 0.18
const CHAT_PREHEAT_MAX_LEAD = 1.1
const CHAT_LAYOUT_CACHE_LIMIT = 32
// 气泡宽度动画约 0.2s。气泡尺寸使用提前后的时间轴，
// 让横向扩展先于字符出现启动，避免临界换行时字符短暂掉到下一行。
const CHAT_WIDTH_LOOKAHEAD_SECONDS = 0.2
const CHAT_BUBBLE_TEXT_OPTIONS = { whiteSpace: "pre-wrap" } satisfies PrepareOptions
const CHAT_BUBBLE_FONT_WEIGHT = 400

interface BubbleSize {
  width: number
  height: number
}

interface ChatIntensityConfig {
  sequencing: {
    forceRightEveryLines: number
    shortLineCarryChance: number
    sideSequence: ChatSide[]
    sideFlipChance: number
    randomEmoChance: number
    minLinesBetweenRandomEmos: number
    maxRandomEmoRatio: number
  }
  motion: {
    rowEnterY: number
    rowEnterScale: number
    rowEnterDuration: number
    rowExitY: number
    rowExitScale: number
    rowExitDuration: number
    avatarSpring: { stiffness: number; damping: number; mass: number }
    activeScale: number
    passedScale: number
    passedOpacity: number
    activeFontMultiplier: number
    inactiveFontMultiplier: number
    activePaddingX: number
    activePaddingY: number
    inactivePaddingX: number
    inactivePaddingY: number
    activeMinHeight: number
    inactiveMinHeight: number
    glowOpacity: number
    glowDuration: number
    glowRightAlpha: number
    glowLeftAlpha: number
    activeShadowAlpha: number
    emoActiveSize: number
    emoInactiveSize: number
    emoEnterScale: number
    emoSizeTransitionDuration: number
  }
}

interface PreparedBubbleMetrics {
  characters: string[]
  sizes: BubbleSize[]
  revealTimes: number[]
  bubbleTargetTimes: number[]
  timestampReadyTime: number
}

interface CharacterRevealPlan {
  characters: string[]
  fadeDurationsMs: number[]
}

const INTERLUDE_TEXT = "......"
const DEFAULT_CHAR_FADE_MS = 220
const MIN_CHAR_FADE_MS = 40

const countCompactChars = (text: string) => Array.from(text.replace(/\s/g, "")).length

const hashString = (input: string) => {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededUnit = (...parts: Array<string | number>) => hashString(parts.join("|")) / 0xffffffff

const pickStableEmoImage = (imagePool: ChatEmojiImage[], ...seedParts: Array<string | number>) => {
  if (imagePool.length === 0) {
    return null
  }
  const index = Math.floor(seededUnit(...seedParts) * imagePool.length) % imagePool.length
  return imagePool[index] ?? imagePool[0]
}

const getEffectiveRenderEndTime = (line: Line, nextLine?: Line) =>
  Math.min(getLineRenderEndTime(line), nextLine?.startTime ?? Number.POSITIVE_INFINITY)

const shouldPreheatLine = (line: Line, currentTime: number) => {
  const lead = line.startTime - currentTime
  return lead >= CHAT_PREHEAT_MIN_LEAD && lead <= CHAT_PREHEAT_MAX_LEAD
}

const getChatIntensityConfig = (animationIntensity: Theme["animationIntensity"]): ChatIntensityConfig => {
  if (animationIntensity === "calm") {
    return {
      sequencing: {
        forceRightEveryLines: 7,
        shortLineCarryChance: 0.92,
        sideSequence: ["left", "left", "right", "left", "right"],
        sideFlipChance: 0.08,
        randomEmoChance: 0,
        minLinesBetweenRandomEmos: 6,
        maxRandomEmoRatio: 0,
      },
      motion: {
        rowEnterY: 10,
        rowEnterScale: 0.994,
        rowEnterDuration: 0.42,
        rowExitY: -7,
        rowExitScale: 0.99,
        rowExitDuration: 0.34,
        avatarSpring: { stiffness: 180, damping: 34, mass: 0.9 },
        activeScale: 1.05,
        passedScale: 0.97,
        passedOpacity: 0.9,
        activeFontMultiplier: 1.18,
        inactiveFontMultiplier: 0.97,
        activePaddingX: 18,
        activePaddingY: 14,
        inactivePaddingX: 16,
        inactivePaddingY: 12,
        activeMinHeight: 58,
        inactiveMinHeight: 44,
        glowOpacity: 0.16,
        glowDuration: 4.2,
        glowRightAlpha: 0.18,
        glowLeftAlpha: 0.1,
        activeShadowAlpha: 0.2,
        emoActiveSize: 132,
        emoInactiveSize: 96,
        emoEnterScale: 0.78,
        emoSizeTransitionDuration: 0.32,
      },
    }
  }

  if (animationIntensity === "chaotic") {
    return {
      sequencing: {
        forceRightEveryLines: 3,
        shortLineCarryChance: 0.36,
        sideSequence: ["left", "right", "right", "left", "right", "left"],
        sideFlipChance: 0.42,
        randomEmoChance: 0.12,
        minLinesBetweenRandomEmos: 4,
        maxRandomEmoRatio: 1 / 12,
      },
      motion: {
        rowEnterY: 20,
        rowEnterScale: 0.98,
        rowEnterDuration: 0.46,
        rowExitY: -16,
        rowExitScale: 0.965,
        rowExitDuration: 0.36,
        avatarSpring: { stiffness: 220, damping: 30, mass: 0.82 },
        activeScale: 1.12,
        passedScale: 0.92,
        passedOpacity: 0.82,
        activeFontMultiplier: 1.3,
        inactiveFontMultiplier: 0.94,
        activePaddingX: 22,
        activePaddingY: 17,
        inactivePaddingX: 15,
        inactivePaddingY: 11,
        activeMinHeight: 68,
        inactiveMinHeight: 42,
        glowOpacity: 0.32,
        glowDuration: 2.6,
        glowRightAlpha: 0.28,
        glowLeftAlpha: 0.16,
        activeShadowAlpha: 0.32,
        emoActiveSize: 178,
        emoInactiveSize: 122,
        emoEnterScale: 0.6,
        emoSizeTransitionDuration: 0.34,
      },
    }
  }

  return {
    sequencing: {
      forceRightEveryLines: 5,
      shortLineCarryChance: 0.68,
      sideSequence: ["left", "right", "left", "right", "right"],
      sideFlipChance: 0.18,
      randomEmoChance: 0.06,
      minLinesBetweenRandomEmos: 5,
      maxRandomEmoRatio: 1 / 14,
    },
    motion: {
      rowEnterY: 14,
      rowEnterScale: 0.988,
      rowEnterDuration: 0.44,
      rowExitY: -11,
      rowExitScale: 0.98,
      rowExitDuration: 0.35,
      avatarSpring: { stiffness: 200, damping: 32, mass: 0.86 },
      activeScale: 1.08,
      passedScale: 0.95,
      passedOpacity: 0.86,
      activeFontMultiplier: 1.24,
      inactiveFontMultiplier: 0.95,
      activePaddingX: 20,
      activePaddingY: 16,
      inactivePaddingX: 16,
      inactivePaddingY: 12,
      activeMinHeight: 64,
      inactiveMinHeight: 44,
      glowOpacity: 0.22,
      glowDuration: 3.4,
      glowRightAlpha: 0.22,
      glowLeftAlpha: 0.12,
      activeShadowAlpha: 0.26,
      emoActiveSize: 160,
      emoInactiveSize: 110,
      emoEnterScale: 0.66,
      emoSizeTransitionDuration: 0.32,
    },
  }
}

// 为对话分配稳定的发言人与反应表情，保证同一首歌确定性一致。
const buildChatMessages = (
  lines: Line[],
  titleText: string,
  config: ChatIntensityConfig,
  tuning: ChatTuning,
  emoImagePool: ChatEmojiImage[],
  forcePreviewEmo: boolean,
): ChatMessage[] => {
  const messages: ChatMessage[] = [{
    id: "title",
    kind: "title",
    text: titleText,
    side: "right",
    avatarIndex: AVATAR_GRID_SIZE * AVATAR_GRID_SIZE - 1,
  }]

  const showEmoMessages = tuning.showEmoMessages && emoImagePool.length > 0

  if (lines.length === 0) {
    const fallbackEmo = showEmoMessages
      ? pickStableEmoImage(emoImagePool, "no-lyrics", titleText, config.sequencing.forceRightEveryLines)
      : null
    if (fallbackEmo && showEmoMessages) {
      messages.push({
        id: "emo-no-lyrics",
        kind: "emo",
        line: { words: [], startTime: 0, endTime: 0, fullText: INTERLUDE_TEXT },
        lineIndex: 0,
        side: "right",
        avatarIndex: AVATAR_GRID_SIZE * AVATAR_GRID_SIZE - 1,
        emoImageUrl: fallbackEmo.url,
        activationStartTime: 0,
        activationEndTime: 999999,
      })
    }
    return messages
  }

  let sideSequenceCursor = 0
  let nextLeftAvatarCursor = 0
  let lastLyricSender: ChatMessageSender | null = null
  let lyricMessagesSinceRandomEmo = Number.POSITIVE_INFINITY
  let randomEmoCount = 0
  const randomEmoCap = Math.floor(lines.length * config.sequencing.maxRandomEmoRatio)
  const agentSenderResolver = createChatAgentSenderResolver(lines, {
    rightAvatarIndex: RIGHT_AVATAR_INDEX,
    leftAvatarCount: LEFT_AVATAR_INDICES.length,
  })

  lines.forEach((line, lineIndex) => {
    const nextLine = lines[lineIndex + 1]
    const prevLine = lines[lineIndex - 1]
    // 与上一句间隔过长 → 视作间奏，插入一条时间分割线（不含开头第一句）。
    if (prevLine && line.startTime - prevLine.endTime >= CHAT_DIVIDER_GAP_SECONDS) {
      messages.push({
        id: `divider-${line.startTime}-${lineIndex}`,
        kind: "divider",
        lineIndex,
        label: formatTimestamp(line.startTime),
      })
    }
    const isShortLine = countCompactChars(line.fullText) <= SHORT_LINE_CHAR_LIMIT
    const agentSender = agentSenderResolver?.resolve(line) ?? null
    const shouldForceRight = !agentSender && (lineIndex + 1) % config.sequencing.forceRightEveryLines === 0
    const shouldCarrySender = Boolean(!agentSender
      && isShortLine
      && lastLyricSender
      && seededUnit("carry", line.startTime, lineIndex) <= config.sequencing.shortLineCarryChance)
    const baseSide = config.sequencing.sideSequence[sideSequenceCursor % config.sequencing.sideSequence.length]
    const shouldFlipSide = !shouldForceRight
      && seededUnit("flip", line.startTime, lineIndex) < config.sequencing.sideFlipChance
    const resolvedSide = shouldFlipSide
      ? (baseSide === "left" ? "right" : "left")
      : baseSide
    let sender: ChatMessageSender
    if (agentSender) {
      sender = agentSender
    } else if (shouldForceRight) {
      sender = { side: "right", avatarIndex: RIGHT_AVATAR_INDEX }
    } else if (shouldCarrySender && lastLyricSender) {
      sender = lastLyricSender
    } else {
      sender = {
        side: resolvedSide,
        avatarIndex: resolvedSide === "left" ? nextLeftAvatarCursor : RIGHT_AVATAR_INDEX,
      }
    }

    const isInterlude = line.fullText === INTERLUDE_TEXT
    const emoImage = isInterlude && showEmoMessages
      ? pickStableEmoImage(emoImagePool, "interlude", line.startTime, lineIndex)
      : null
    const effectiveRenderEndTime = getEffectiveRenderEndTime(line, nextLine)
    if (isInterlude && emoImage && showEmoMessages) {
      messages.push({
        id: `emo-${line.startTime}-${lineIndex}`,
        kind: "emo",
        line,
        lineIndex,
        side: sender.side,
        avatarIndex: sender.avatarIndex,
        emoImageUrl: emoImage.url,
        activationStartTime: line.startTime,
        activationEndTime: Math.max(line.startTime + 0.12, effectiveRenderEndTime),
      })
    } else {
      messages.push({
        id: `line-${line.startTime}-${lineIndex}`,
        kind: "lyric",
        line,
        lineIndex,
        side: sender.side,
        avatarIndex: sender.avatarIndex,
      })
    }
    lyricMessagesSinceRandomEmo += 1

    const renderHints = getLineRenderHints(line)
    const canAppendRandomEmo = !isInterlude
      && showEmoMessages
      && config.sequencing.randomEmoChance > 0
      && randomEmoCount < randomEmoCap
      && lyricMessagesSinceRandomEmo >= config.sequencing.minLinesBetweenRandomEmos
      && renderHints?.timingClass === "normal"

    if (canAppendRandomEmo) {
      const score = seededUnit("random-emo", line.startTime, line.endTime, lineIndex, config.sequencing.randomEmoChance)
      if (score < config.sequencing.randomEmoChance) {
        const reactionImage = pickStableEmoImage(emoImagePool, "reaction", line.startTime, line.endTime, lineIndex, sender.side)
        if (reactionImage) {
          messages.push({
            id: `emo-reaction-${line.startTime}-${lineIndex}`,
            kind: "emo",
            line,
            lineIndex,
            side: sender.side,
            avatarIndex: sender.avatarIndex,
            emoImageUrl: reactionImage.url,
            activationStartTime: line.endTime,
            activationEndTime: Math.max(line.endTime + 0.08, effectiveRenderEndTime),
          })
          randomEmoCount += 1
          lyricMessagesSinceRandomEmo = 0
        }
      }
    }

    if (agentSender) {
      lastLyricSender = sender
    } else if (shouldForceRight) {
      sideSequenceCursor = 0
      lastLyricSender = null
    } else if (!shouldCarrySender) {
      if (sender.side === "left") {
        nextLeftAvatarCursor += 1
      }
      sideSequenceCursor += 1
      lastLyricSender = sender
    } else {
      lastLyricSender = sender
    }
  })

  if (forcePreviewEmo && showEmoMessages && !messages.some((message) => message.kind === "emo")) {
    const previewLine = lines[0] ?? { words: [], startTime: 0, endTime: 0, fullText: INTERLUDE_TEXT }
    const previewEmo = pickStableEmoImage(emoImagePool, "preview-emo", titleText, lines.length)
    if (previewEmo) {
      messages.splice(1, 0, {
        id: "emo-preview",
        kind: "emo",
        line: previewLine,
        lineIndex: -1,
        side: "right",
        avatarIndex: RIGHT_AVATAR_INDEX,
        emoImageUrl: previewEmo.url,
        activationStartTime: 0,
        activationEndTime: Number.POSITIVE_INFINITY,
      })
    }
  }

  return messages
}

const getLineCharacters = (line: Line) => splitLyricGraphemes(line.fullText)

const getWordTextRanges = (line: Line) => {
  const ranges: Array<{ start: number; end: number } | null> = []
  let searchCursor = 0

  line.words.forEach((word) => {
    const start = line.fullText.indexOf(word.text, searchCursor)
    if (start < 0) {
      ranges.push(null)
      return
    }
    const end = start + word.text.length
    ranges.push({ start, end })
    searchCursor = end
  })

  return ranges
}

// 从 parser 的按词计时推导逐字 reveal 时间轴：显示按字符、计时按词，此处做桥接。
const buildCharacterRevealTimes = (line: Line, characters: string[]) => {
  const revealTimes = characters.map(() => Number.POSITIVE_INFINITY)
  const lineTimeline = buildLineGraphemeTimeline(line)
  if (lineTimeline.length === characters.length) {
    lineTimeline.forEach((timing, index) => {
      revealTimes[index] = timing.startTime
    })
    return revealTimes
  }

  const ranges = getWordTextRanges(line)
  let previousWordEndCharacterIndex = 0
  let lastResolvedRevealTime = line.startTime
  let hasResolvedRevealTime = false

  line.words.forEach((word, index) => {
    const range = ranges[index]
    if (!range) {
      return
    }

    const startCharacterIndex = splitLyricGraphemes(line.fullText.slice(0, range.start)).length
    const endCharacterIndex = splitLyricGraphemes(line.fullText.slice(0, range.end)).length
    const wordTimings = buildWordGraphemeTimings(word)

    for (let characterIndex = previousWordEndCharacterIndex; characterIndex < startCharacterIndex; characterIndex += 1) {
      revealTimes[characterIndex] = word.startTime
    }

    wordTimings.forEach((timing, characterIndex) => {
      const targetIndex = startCharacterIndex + characterIndex
      if (targetIndex >= revealTimes.length) {
        return
      }
      revealTimes[targetIndex] = timing.startTime
      lastResolvedRevealTime = Math.max(lastResolvedRevealTime, revealTimes[targetIndex])
      hasResolvedRevealTime = true
    })

    previousWordEndCharacterIndex = endCharacterIndex
  })

  const trailingRevealTime = hasResolvedRevealTime ? lastResolvedRevealTime : line.endTime
  for (let characterIndex = previousWordEndCharacterIndex; characterIndex < revealTimes.length; characterIndex += 1) {
    revealTimes[characterIndex] = trailingRevealTime
  }

  return revealTimes
}

// revealTimes 单调递增，用二分在 O(log n) 内解析可见字符数。
const getCharacterCountAtTime = (revealTimes: number[], currentTime: number) => {
  let low = 0
  let high = revealTimes.length

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (revealTimes[mid] <= currentTime) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

const getBubbleTargetCharacterCount = (metrics: PreparedBubbleMetrics, currentTime: number) =>
  getCharacterCountAtTime(metrics.bubbleTargetTimes, currentTime)

const getTimestampReadyTime = (metrics: PreparedBubbleMetrics | null, line: Line) =>
  metrics?.timestampReadyTime ?? line.endTime

const buildCharacterFadeDurationsMs = (line: Line, characters: string[]) => {
  const fadeDurationsMs = characters.map(() => DEFAULT_CHAR_FADE_MS)
  const lineTimeline = buildLineGraphemeTimeline(line)
  if (lineTimeline.length === characters.length) {
    lineTimeline.forEach((timing, index) => {
      fadeDurationsMs[index] = Math.max((timing.endTime - timing.startTime) * 1000, MIN_CHAR_FADE_MS)
    })
    return fadeDurationsMs
  }

  const ranges = getWordTextRanges(line)

  line.words.forEach((word, index) => {
    const range = ranges[index]
    if (!range) {
      return
    }

    const startCharacterIndex = splitLyricGraphemes(line.fullText.slice(0, range.start)).length
    const wordTimings = buildWordGraphemeTimings(word)

    for (let characterIndex = 0; characterIndex < wordTimings.length; characterIndex += 1) {
      const targetIndex = startCharacterIndex + characterIndex
      if (targetIndex >= fadeDurationsMs.length) {
        break
      }
      const timing = wordTimings[characterIndex]
      fadeDurationsMs[targetIndex] = timing
        ? Math.max((timing.endTime - timing.startTime) * 1000, MIN_CHAR_FADE_MS)
        : DEFAULT_CHAR_FADE_MS
    }
  })

  return fadeDurationsMs
}

const getTimestampReadyTimeFromMetrics = (
  line: Line,
  revealTimes: number[],
  fadeDurationsMs: number[],
) => {
  if (revealTimes.length === 0) {
    return line.endTime
  }

  return revealTimes.reduce((latest, time, index) => {
    if (!Number.isFinite(time)) {
      return latest
    }
    return Math.max(latest, time + (fadeDurationsMs[index] ?? DEFAULT_CHAR_FADE_MS) / 1000)
  }, line.startTime)
}

const getCharacterRevealPlan = (line: Line): CharacterRevealPlan => {
  const characters = Array.from(line.fullText)
  const fadeDurationsMs = buildCharacterFadeDurationsMs(line, characters)
  return { characters, fadeDurationsMs }
}

const getAvatarPosition = (avatarIndex: number) => {
  const safeIndex = ((avatarIndex % 9) + 9) % 9
  const col = safeIndex % AVATAR_GRID_SIZE
  const row = Math.floor(safeIndex / AVATAR_GRID_SIZE)

  return {
    backgroundPosition: `${col * 50}% ${row * 50}%`,
    backgroundSize: `${AVATAR_GRID_SIZE * 100}% ${AVATAR_GRID_SIZE * 100}%`,
  }
}

const getEstimatedMessageHeight = (
  message: ChatMessage,
  isActive: boolean,
  motionConfig: ChatIntensityConfig["motion"],
): number => {
  if (message.kind === "title") {
    return 40
  }
  if (message.kind === "divider") {
    return 44
  }
  if (message.kind === "emo") {
    const imageSize = isActive ? motionConfig.emoActiveSize : motionConfig.emoInactiveSize
    return imageSize + 48 + 12
  }
  const baseHeight = isActive ? motionConfig.activeMinHeight + 16 : motionConfig.inactiveMinHeight + 10
  return baseHeight + 12
}

// 根据视口高度与消息累积估算高度，动态筛选视口内展示的最新消息，防止底部溢出。
const getVisibleMessages = (
  messages: ChatMessage[],
  visibleLineIndex: number,
  viewportHeight: number,
  currentLineIndex: number,
  currentTime: number,
  motionConfig: ChatIntensityConfig["motion"],
  maxVisible: number,
) => {
  const visible = messages.filter((message) => {
    if (message.kind === "title") {
      return true
    }
    if (message.kind === "emo") {
      return currentTime >= message.activationStartTime
    }
    return message.lineIndex <= visibleLineIndex
  })

  const usableHeight = Math.max(200, viewportHeight - 240)
  let accumulatedHeight = 0
  const result: ChatMessage[] = []

  for (let i = visible.length - 1; i >= 0; i--) {
    const message = visible[i]
    const timedData = isTimedMessage(message) ? message : null
    const isActive = timedData ? getTimedMessageState(timedData, currentTime, currentLineIndex).isActive : false
    const estHeight = getEstimatedMessageHeight(message, isActive, motionConfig)

    if (accumulatedHeight + estHeight > usableHeight && result.length >= 2) {
      break
    }

    accumulatedHeight += estHeight
    result.unshift(message)

    if (result.length >= maxVisible) {
      break
    }
  }

  return result
}

const getVisibleLineIndexAtTime = (lines: Line[], currentTime: number) => {
  for (let index = lines.length - 1; index >= 0; index--) {
    if (currentTime >= lines[index].startTime) {
      return index
    }
  }
  return -1
}

const getTimedMessageState = (message: ChatTimedMessage, currentTime: number, currentLineIndex: number) => {
  if (message.kind === "emo") {
    return {
      isActive: currentTime >= message.activationStartTime && currentTime < message.activationEndTime,
      isPassed: currentTime >= message.activationEndTime,
    }
  }
  return {
    isActive: message.lineIndex === currentLineIndex,
    isPassed: message.lineIndex < currentLineIndex,
  }
}

const getBubbleColors = (message: ChatMessage, theme: Theme) => {
  if (message.side === "right") {
    return {
      backgroundColor: mixColors(theme.accentColor, theme.primaryColor, 0.18, 0.94),
      borderColor: mixColors(theme.accentColor, theme.primaryColor, 0.34, 0.3),
      textColor: theme.backgroundColor,
    }
  }

  const avatarTone = (message.avatarIndex % (AVATAR_GRID_SIZE * AVATAR_GRID_SIZE)) / (AVATAR_GRID_SIZE * AVATAR_GRID_SIZE - 1)
  const accentMix = 0.18 + avatarTone * 0.62

  return {
    backgroundColor: mixColors(theme.secondaryColor, theme.accentColor, accentMix, 1),
    borderColor: mixColors(theme.secondaryColor, theme.accentColor, Math.min(accentMix + 0.18, 1), 0.26),
    textColor: theme.primaryColor,
  }
}

const formatTimestamp = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00"
  }
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

const measureBubbleText = ({
  text,
  theme,
  fontSize,
  lineHeightPx,
  maxTextWidth,
  paddingX,
  paddingY,
}: {
  text: string
  theme: Theme
  fontSize: number
  lineHeightPx: number
  maxTextWidth: number
  paddingX: number
  paddingY: number
}) => {
  const bubbleBorderWidth = 1
  const safeText = text || " "
  const prepared = prepareWithSegments(
    safeText,
    `${CHAT_BUBBLE_FONT_WEIGHT} ${fontSize}px ${resolveThemeFontStack(theme)}`,
    CHAT_BUBBLE_TEXT_OPTIONS,
  )
  const layout = layoutWithLines(prepared, Math.max(1, maxTextWidth), Math.round(lineHeightPx))
  const textWidth = Math.max(...layout.lines.map((line) => line.width), fontSize)
  const textHeight = Math.max(layout.lines.length, 1) * lineHeightPx

  return {
    width: Math.ceil(Math.min(textWidth, maxTextWidth) + paddingX * 2 + bubbleBorderWidth * 2),
    height: Math.ceil(textHeight + paddingY * 2 + bubbleBorderWidth * 2),
  }
}

const getBubbleMetricsCacheKey = ({
  line,
  theme,
  fontSize,
  lineHeightPx,
  maxTextWidth,
  paddingX,
  paddingY,
}: {
  line: Line
  theme: Theme
  fontSize: number
  lineHeightPx: number
  maxTextWidth: number
  paddingX: number
  paddingY: number
}) => [
  line.startTime,
  line.endTime,
  line.words.length,
  theme.name,
  fontSize.toFixed(3),
  lineHeightPx.toFixed(3),
  maxTextWidth,
  paddingX,
  paddingY,
].join("|")

// 预计算一行所有前缀气泡尺寸，播放时仅做 O(1) 查表。
const getOrBuildBubbleMetrics = (
  cache: Map<string, PreparedBubbleMetrics>,
  {
    line,
    theme,
    fontSize,
    lineHeightPx,
    maxTextWidth,
    paddingX,
    paddingY,
  }: {
    line: Line
    theme: Theme
    fontSize: number
    lineHeightPx: number
    maxTextWidth: number
    paddingX: number
    paddingY: number
  },
) => {
  const cacheKey = getBubbleMetricsCacheKey({ line, theme, fontSize, lineHeightPx, maxTextWidth, paddingX, paddingY })
  const cached = cache.get(cacheKey)

  if (cached) {
    cache.delete(cacheKey)
    cache.set(cacheKey, cached)
    return cached
  }

  const characters = getLineCharacters(line)
  const revealTimes = buildCharacterRevealTimes(line, characters)
  const fadeDurationsMs = buildCharacterFadeDurationsMs(line, characters)
  const timestampReadyTime = getTimestampReadyTimeFromMetrics(line, revealTimes, fadeDurationsMs)
  const bubbleTargetTimes = revealTimes.map((time) => time - CHAT_WIDTH_LOOKAHEAD_SECONDS)
  const sizes: BubbleSize[] = []

  for (let visibleCount = 0; visibleCount <= characters.length; visibleCount += 1) {
    const measuredText = characters.slice(0, visibleCount).join("")
    sizes.push(measureBubbleText({ text: measuredText, theme, fontSize, lineHeightPx, maxTextWidth, paddingX, paddingY }))
  }

  const prepared = { characters, sizes, revealTimes, bubbleTargetTimes, timestampReadyTime }
  cache.set(cacheKey, prepared)

  if (cache.size > CHAT_LAYOUT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  return prepared
}

const ChatAvatar: React.FC<{
  avatarUrl?: string | null
  avatarIndex: number
  theme: Theme
  side: ChatSide
  useAvatarGridCrop: boolean
}> = ({ avatarUrl, avatarIndex, theme, side, useAvatarGridCrop }) => {
  const shouldUseAvatarGridCrop = useAvatarGridCrop || !avatarUrl
  const resolvedIndex = shouldUseAvatarGridCrop
    ? (side === "right" ? RIGHT_AVATAR_INDEX : LEFT_AVATAR_INDICES[avatarIndex % LEFT_AVATAR_INDICES.length])
    : avatarIndex
  const avatarPosition = getAvatarPosition(resolvedIndex)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-10 w-10 shrink-0 overflow-hidden rounded-full border shadow-lg"
      style={{
        borderColor: "rgba(255,255,255,0.24)",
        backgroundColor: theme.secondaryColor,
        backgroundImage: avatarUrl
          ? `url("${avatarUrl}")`
          : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
        backgroundClip: "padding-box",
        backgroundPosition: shouldUseAvatarGridCrop ? avatarPosition.backgroundPosition : "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: shouldUseAvatarGridCrop ? avatarPosition.backgroundSize : "cover",
      }}
    />
  )
}

const ChatText: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.kind === "title") {
    return <>{message.text}</>
  }
  if (message.kind === "emo") {
    return null
  }
  return <>{message.line.fullText}</>
}

const ChatTimestamp: React.FC<{
  line: Line
  color: string
  isVisible: boolean
  style?: React.CSSProperties
}> = ({ line, color, isVisible, style }) => {
  if (!isVisible) {
    return null
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 0.62, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="pointer-events-none absolute text-[11px] font-medium tabular-nums"
      style={{ color, ...style }}
    >
      {formatTimestamp(line.endTime)}
    </motion.span>
  )
}

const AnimatedBubbleFrame: React.FC<{
  children: React.ReactNode
  className: string
  floatingAdornment?: React.ReactNode
  targetSize?: { width: number; height: number }
  style: React.CSSProperties
  // 文字排版宽度：与 measureBubbleText 的换行宽度一致。文字在此固定宽度内排版，
  // 不随气泡外框宽度动画而 reflow，避免临界换行时单字符先掉到第二行行首（左下角）
  // 再瞬移回正确位置。气泡外框照常平滑动画，靠 overflow:hidden 裁切逐渐揭示文字。
  textLayoutWidth?: number
  // 激活歌词气泡的宽高改由 MotionValue 直接驱动（framer 直接写 DOM，零 React 重渲染，
  // 也不会每字符重启 width/height 补间）。提供时优先于 targetSize / animate。
  motionWidth?: MotionValue<number>
  motionHeight?: MotionValue<number>
}> = ({ children, className, floatingAdornment, targetSize, style, textLayoutWidth, motionWidth, motionHeight }) => {
  const useMotionSize = motionWidth != null && motionHeight != null
  const hasExplicitSize = useMotionSize || targetSize != null
  return (
    <motion.div
      className="relative shrink-0"
      animate={useMotionSize
        ? undefined
        : (targetSize ? { width: targetSize.width, height: targetSize.height } : undefined)}
      transition={{
        scale: { type: "spring", stiffness: 200, damping: 32, mass: 0.86 },
        ...(!useMotionSize && targetSize ? {
          width: { duration: 0.2, ease: "easeOut" as const },
          height: { duration: 0.2, ease: "easeOut" as const },
        } : {}),
      }}
      style={{
        width: useMotionSize ? motionWidth : (targetSize ? targetSize.width : "fit-content"),
        height: useMotionSize ? motionHeight : (targetSize ? targetSize.height : "auto"),
      }}
    >
      <div
        className={className}
        style={{
          ...style,
          height: hasExplicitSize ? "100%" : "auto",
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {textLayoutWidth != null ? (
          <div style={{ width: textLayoutWidth, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {children}
          </div>
        ) : children}
      </div>
      {floatingAdornment}
    </motion.div>
  )
}

// 逐字揭示：一次性渲染整行字符，通过 CSS animation-delay 交给浏览器合成器按时间揭示，
// 播放期间不再产生任何 per-character 的 React 重渲染（快歌词的卡顿主因）。
// anchorTime 为「行激活/跳转」时的播放时间，delay = 该字符的揭示时间 - anchorTime；
// isPlaying 映射到 animationPlayState，保证暂停/跳转时 CSS 时钟与播放时钟一致。
const ActiveChatText: React.FC<{
  line: Line
  anchorTime: number
  isPlaying: boolean
}> = ({ line, anchorTime, isPlaying }) => {
  const revealPlan = useMemo(() => getCharacterRevealPlan(line), [line])
  const revealTimes = useMemo(
    () => buildCharacterRevealTimes(line, revealPlan.characters),
    [line, revealPlan],
  )
  const playState = isPlaying ? "running" : "paused"

  return (
    <span>
      {revealPlan.characters.map((character, index) => {
        const revealTime = revealTimes[index]
        const delaySeconds = Number.isFinite(revealTime) ? revealTime - anchorTime : 0
        return (
          <span
            key={index}
            style={{
              animationName: "chat-char-fade",
              animationDuration: `${revealPlan.fadeDurationsMs[index] ?? DEFAULT_CHAR_FADE_MS}ms`,
              animationTimingFunction: "ease-out",
              animationFillMode: "both",
              animationDelay: `${delaySeconds}s`,
              animationPlayState: playState,
            }}
          >
            {character}
          </span>
        )
      })}
    </span>
  )
}

const ChatBubbleGlow: React.FC<{
  isActive: boolean
  isRight: boolean
  motionConfig: ChatIntensityConfig["motion"]
  isMobile?: boolean
}> = ({ isActive, isRight, motionConfig, isMobile = false }) => {
  if (!isActive) {
    return null
  }

  const glowAlpha = isRight ? motionConfig.glowRightAlpha : motionConfig.glowLeftAlpha
  const glowColor = `rgba(255,255,255,${glowAlpha})`

  // 移动端：扫光动画直接跳过（GPU 图层开销大），只保留静态渐变
  if (isMobile) {
    return (
      <div
        className="pointer-events-none absolute inset-y-0 left-0"
        style={{
          width: "100%",
          opacity: motionConfig.glowOpacity * 0.5,
          background: `linear-gradient(105deg, transparent 0%, ${glowColor} 30%, transparent 50%, ${glowColor} 70%, transparent 100%)`,
        }}
      />
    )
  }

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0"
      style={{
        width: "200%",
        opacity: motionConfig.glowOpacity,
        background: `linear-gradient(105deg, transparent 0%, ${glowColor} 23%, transparent 34%, transparent 50%, transparent 50%, ${glowColor} 73%, transparent 84%, transparent 100%)`,
        animation: `chat-bubble-glow-pan ${motionConfig.glowDuration}s linear infinite`,
        willChange: "transform",
      }}
    />
  )
}

// 间奏时间分割线：居中的暖色细线夹一枚时间标签，像翻聊天记录里的日期条。
const ChatDivider: React.FC<{ label: string; theme: Theme; isMobile?: boolean }> = ({ label, theme, isMobile = false }) => {
  const lineColor = mixColors(theme.secondaryColor, theme.primaryColor, 0.5, 0.24)
  const textColor = mixColors(theme.primaryColor, theme.secondaryColor, 0.4, 0.7)

  return (
    <motion.div
      layout={isMobile ? false : "position"}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeIn" } }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex w-full items-center justify-center gap-3 py-1"
    >
      <span className="h-px w-10 sm:w-16" style={{ backgroundColor: lineColor }} />
      <span
        className="text-[10px] font-medium tracking-[0.28em] tabular-nums"
        style={{ color: textColor }}
      >
        {label}
      </span>
      <span className="h-px w-10 sm:w-16" style={{ backgroundColor: lineColor }} />
    </motion.div>
  )
}

// ChatMessageRow 只渲染气泡类消息；divider 在上层分流，走 ChatDivider。
type ChatBubbleMessage = Exclude<ChatMessage, ChatDividerMessage>

interface ChatMessageRowProps {
  message: ChatBubbleMessage
  currentTime: MotionValue<number>
  currentLineIndex: number
  theme: Theme
  coverUrl?: string | null
  chatTuning: ChatTuning
  avatarSeed?: string | number
  baseFontSize: number
  maxTextWidth: number
  metricsCache: React.MutableRefObject<Map<string, PreparedBubbleMetrics>>
  intensityConfig: ChatIntensityConfig
  customAvatarImages?: ChatAvatarImage[]
  rightAvatarUrl?: string | null
  isPlaying: boolean
  isMobile: boolean
}

const ChatMessageRow = React.forwardRef<HTMLDivElement, ChatMessageRowProps>(({
  message,
  currentTime,
  currentLineIndex,
  theme,
  coverUrl,
  chatTuning,
  avatarSeed,
  baseFontSize,
  maxTextWidth,
  metricsCache,
  intensityConfig,
  customAvatarImages,
  rightAvatarUrl,
  isPlaying,
  isMobile,
}, ref) => {
  const isRight = message.side === "right"
  const timedData: ChatTimedMessage | null = isTimedMessage(message) ? message : null
  const timedState = timedData ? getTimedMessageState(timedData, currentTime.get(), currentLineIndex) : null
  const isActiveMessage = timedState?.isActive ?? false
  const isPassedMessage = timedState?.isPassed ?? false
  const isEmoMessage = message.kind === "emo"
  const motionConfig = intensityConfig.motion
  const bubbleFontSize = isActiveMessage
    ? baseFontSize * motionConfig.activeFontMultiplier
    : message.kind === "title"
      ? baseFontSize
      : baseFontSize * motionConfig.inactiveFontMultiplier
  const bubblePaddingX = isActiveMessage ? motionConfig.activePaddingX : motionConfig.inactivePaddingX
  const bubblePaddingY = isActiveMessage ? motionConfig.activePaddingY : motionConfig.inactivePaddingY
  const bubbleColors = getBubbleColors(message, theme)
  // 右侧发言人代表"当前用户"，优先使用登录用户头像；未登录/无头像时回退原解析逻辑。
  const useRightUserAvatar = isRight && Boolean(rightAvatarUrl)
  const avatarUrl = useRightUserAvatar
    ? rightAvatarUrl
    : resolveChatAvatarUrl({
      avatarSource: chatTuning.avatarSource,
      coverUrl,
      avatarIndex: message.avatarIndex,
      side: message.side,
      seed: avatarSeed,
      avatars: builtinAvatarImages,
      customAvatarImages,
    })
  // 用户头像是完整图片，按整图 cover 显示，不做封面九宫格裁剪。
  const useAvatarGridCrop = !useRightUserAvatar && chatTuning.avatarSource === "cover" && Boolean(coverUrl)
  const lineHeightPx = bubbleFontSize * 1.45
  const preparedMetrics = useMemo(
    () => isActiveLyric
      ? getOrBuildBubbleMetrics(metricsCache.current, {
        line: message.line,
        theme,
        fontSize: bubbleFontSize,
        lineHeightPx,
        maxTextWidth,
        paddingX: bubblePaddingX,
        paddingY: bubblePaddingY,
      })
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bubbleFontSize, bubblePaddingX, bubblePaddingY, isActiveLyric, lineHeightPx, maxTextWidth, message, metricsCache, theme],
  )
  const isActiveLyric = isActiveMessage && message.kind === "lyric"
  // 激活歌词的度量放进 ref，供 useTransform 的转换函数读取最新值，避免闭包过期。
  const metricsRef = useRef<PreparedBubbleMetrics | null>(null)
  metricsRef.current = preparedMetrics

  // 气泡宽高：由 currentTime 派生的 MotionValue 平滑驱动，
  // framer 直接写入 DOM，播放期间不产生 React 重渲染，也不会每字符重启补间。
  // 移动端跳过 useSpring 弹簧（每帧 rAF 物理求解开销大），直接用 useTransform 原始值驱动；
  // 桌面端保持弹簧平滑。
  const rawBubbleWidth = useTransform(currentTime, (t) => {
    const m = metricsRef.current
    if (!m || m.sizes.length === 0) return 0
    const count = getBubbleTargetCharacterCount(m, t)
    const clamped = Math.max(0, Math.min(count, m.sizes.length - 1))
    return m.sizes[clamped].width
  })
  const rawBubbleHeight = useTransform(currentTime, (t) => {
    const m = metricsRef.current
    if (!m || m.sizes.length === 0) return 0
    const count = getBubbleTargetCharacterCount(m, t)
    const clamped = Math.max(0, Math.min(count, m.sizes.length - 1))
    return m.sizes[clamped].height
  })
  const bubbleWidthSpring = useSpring(rawBubbleWidth, { stiffness: 260, damping: 34, mass: 0.8 })
  const bubbleHeightSpring = useSpring(rawBubbleHeight, { stiffness: 260, damping: 34, mass: 0.8 })
  // 移动端直接用 raw 值（无弹簧），桌面端用弹簧平滑
  const bubbleWidth = isMobile ? rawBubbleWidth : bubbleWidthSpring
  const bubbleHeight = isMobile ? rawBubbleHeight : bubbleHeightSpring

  // 逐字揭示锚点：行激活或跳转(seek)时在 render 内同步重置，供 CSS animation-delay 使用。
  // 用 ref 保证首帧即可揭示（无一帧全量文字闪烁）；seek 时另用 state 触发一次重渲染。
  const revealAnchorRef = useRef<{ epoch: number; time: number }>({ epoch: 0, time: 0 })
  const activeLyricKeyRef = useRef<string | null>(null)
  const [, forceRevealTick] = useState(0)
  const activeLyricKey = isActiveLyric ? message.id : null
  if (activeLyricKey) {
    if (activeLyricKeyRef.current !== activeLyricKey) {
      activeLyricKeyRef.current = activeLyricKey
      revealAnchorRef.current = { epoch: revealAnchorRef.current.epoch + 1, time: currentTime.get() }
    }
  } else {
    activeLyricKeyRef.current = null
  }

  // 激活瞬间把气泡尺寸弹簧跳到当前目标尺寸，避免从 0（非激活时的静息值）弹出。
  // 用 layout effect 在绘制前完成，无可见的从 0 展开帧。
  useIsoLayoutEffect(() => {
    if (!isActiveLyric) return
    const m = metricsRef.current
    if (!m || m.sizes.length === 0) return
    const count = getBubbleTargetCharacterCount(m, currentTime.get())
    const clamped = Math.max(0, Math.min(count, m.sizes.length - 1))
    // 移动端无弹簧，无需 jump
    if (!isMobile) {
      bubbleWidthSpring.jump(m.sizes[clamped].width)
      bubbleHeightSpring.jump(m.sizes[clamped].height)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveLyric, message])

  // 时间戳可见性在 render 中直接计算，切换时即时生效；仅在其翻转时触发一次重渲染。
  const latestTime = currentTime.get()
  const isTimestampVisible = timedData !== null && (
    timedData.kind === "emo"
      ? latestTime >= timedData.activationEndTime
      : isPassedMessage || latestTime >= getTimestampReadyTime(preparedMetrics, timedData.line)
  )
  const emoImageSize = isActiveMessage ? motionConfig.emoActiveSize : motionConfig.emoInactiveSize
  const targetSize = useMemo(() => {
    if (isEmoMessage) {
      return { width: emoImageSize, height: emoImageSize }
    }
    if (message.kind !== "lyric") {
      return null
    }
    // 激活歌词由 MotionValue 驱动尺寸，这里不再返回静态尺寸。
    if (isActiveMessage) {
      return null
    }
    return measureBubbleText({
      text: message.line.fullText,
      theme,
      fontSize: bubbleFontSize,
      lineHeightPx,
      maxTextWidth,
      paddingX: bubblePaddingX,
      paddingY: bubblePaddingY,
    })
  }, [
    bubbleFontSize,
    bubblePaddingX,
    bubblePaddingY,
    emoImageSize,
    isActiveMessage,
    isEmoMessage,
    lineHeightPx,
    maxTextWidth,
    message,
    theme,
  ])
  const scaleOverflow = isActiveMessage && motionConfig.activeScale > 1
    ? Math.ceil(
      Math.max(
        isEmoMessage
          ? emoImageSize
          : (message.kind === "lyric" && preparedMetrics
            ? (preparedMetrics.sizes[preparedMetrics.sizes.length - 1]?.height ?? motionConfig.activeMinHeight)
            : motionConfig.activeMinHeight),
        40,
      ) * (motionConfig.activeScale - 1),
    )
    : 0

  const lastChangeTimeRef = useRef(latestTime)
  useMotionValueEvent(currentTime, "change", (latest) => {
    // 非活跃行提前返回：不执行 seek 检测 / 时间戳比较，省掉每帧的闭包计算
    if (!isActiveLyric && !timedData) return
    // 跳转(seek)检测：时间发生大跨度突变时重设揭示锚点并重渲染一次。
    const prevTime = lastChangeTimeRef.current
    lastChangeTimeRef.current = latest
    if (isActiveLyric && Math.abs(latest - prevTime) > 0.4) {
      revealAnchorRef.current = { epoch: revealAnchorRef.current.epoch + 1, time: latest }
      forceRevealTick((t) => t + 1)
      return
    }
    // 时间戳可见性翻转时才重渲染（每行至多一次，代价极低）。
    if (timedData) {
      const nextTimestampVisible = timedData.kind === "emo"
        ? latest >= timedData.activationEndTime
        : isPassedMessage || latest >= getTimestampReadyTime(preparedMetrics, timedData.line)
      if (nextTimestampVisible !== isTimestampVisible) {
        forceRevealTick((t) => t + 1)
      }
    }
  })

  // 移动端关闭 layout="position"（FLIP 布局测量开销大），改用纯 CSS transition
  const layoutProp = isMobile ? false : "position"

  return (
    <motion.div
      ref={ref}
      layout={layoutProp}
      initial={{ opacity: 0, y: motionConfig.rowEnterY, scale: motionConfig.rowEnterScale }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: motionConfig.rowExitY,
        scale: motionConfig.rowExitScale,
        transition: { duration: motionConfig.rowExitDuration, ease: "easeIn" },
      }}
      transition={{ duration: motionConfig.rowEnterDuration, ease: "easeOut" }}
      className={`flex w-full items-end gap-3 ${isRight ? "justify-end" : "justify-start"} ${isEmoMessage ? "pt-12" : ""}`}
    >
      <motion.div
        animate={{
          opacity: isPassedMessage ? motionConfig.passedOpacity : 1,
          scale: isActiveMessage ? motionConfig.activeScale : isPassedMessage ? motionConfig.passedScale : 1,
          marginTop: scaleOverflow,
        }}
        transition={{ type: "spring", ...motionConfig.avatarSpring }}
        className={`flex w-full max-w-[78%] items-end gap-3 sm:max-w-[68%] ${isRight ? "flex-row-reverse" : "flex-row"}`}
        style={{ transformOrigin: isRight ? "100% 100%" : "0% 100%" }}
      >
        <ChatAvatar
          avatarUrl={avatarUrl}
          avatarIndex={message.avatarIndex}
          theme={theme}
          side={message.side}
          useAvatarGridCrop={useAvatarGridCrop}
        />
        {isEmoMessage
          ? (
            <motion.div
              className="relative shrink-0"
              animate={{ width: emoImageSize, height: emoImageSize }}
              transition={{
                width: { duration: motionConfig.emoSizeTransitionDuration, ease: "easeOut" as const },
                height: { duration: motionConfig.emoSizeTransitionDuration, ease: "easeOut" as const },
              }}
              style={{ width: emoImageSize, height: emoImageSize }}
            >
              {timedData && (
                <ChatTimestamp
                  line={timedData.line}
                  color={theme.secondaryColor}
                  isVisible={isTimestampVisible}
                  style={{ bottom: -2, [isRight ? "right" : "left"]: "calc(100% + 8px)" }}
                />
              )}
              <motion.div
                initial={{ opacity: 0, scale: motionConfig.emoEnterScale }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: motionConfig.rowEnterDuration, ease: "easeOut" }}
                style={{ width: "100%", height: "100%", display: "block" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.emoImageUrl}
                  alt="emo"
                  className="rounded-2xl"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    animation: "chat-emo-wiggle 1.9s ease-in-out infinite",
                    willChange: "transform",
                  }}
                />
              </motion.div>
            </motion.div>
          )
          : (
            <AnimatedBubbleFrame
              className={`relative rounded-3xl ${isMobile ? "" : "shadow-lg"} transition-[min-height,box-shadow,background-color] duration-200 ease-out ${isRight ? "rounded-br-md" : "rounded-bl-md"}`}
              floatingAdornment={timedData ? (
                <ChatTimestamp
                  line={timedData.line}
                  color={theme.secondaryColor}
                  isVisible={isTimestampVisible}
                  style={{ bottom: 4, [isRight ? "right" : "left"]: "calc(100% + 8px)" }}
                />
              ) : undefined}
              targetSize={targetSize ?? undefined}
              textLayoutWidth={maxTextWidth}
              motionWidth={isActiveLyric ? bubbleWidth : undefined}
              motionHeight={isActiveLyric ? bubbleHeight : undefined}
              style={{
                backgroundColor: bubbleColors.backgroundColor,
                border: `1px solid ${bubbleColors.borderColor}`,
                color: bubbleColors.textColor,
                fontSize: bubbleFontSize,
                fontWeight: CHAT_BUBBLE_FONT_WEIGHT,
                lineHeight: 1.45,
                maxWidth: maxTextWidth + bubblePaddingX * 2 + 2,
                minHeight: Math.max(
                  isActiveMessage ? motionConfig.activeMinHeight : motionConfig.inactiveMinHeight,
                  bubbleFontSize * 1.45 + bubblePaddingY * 2,
                ),
                minWidth: isActiveMessage ? 72 : undefined,
                padding: `${bubblePaddingY}px ${bubblePaddingX}px`,
                boxShadow: isActiveMessage && !isMobile
                  ? `0 18px 48px ${mixColors(theme.backgroundColor, theme.accentColor, 0.2, motionConfig.activeShadowAlpha)}`
                  : undefined,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
                <ChatBubbleGlow isActive={isActiveMessage} isRight={isRight} motionConfig={motionConfig} isMobile={isMobile} />
              </div>
              <span className="relative z-10">
                {message.kind === "lyric" && isActiveMessage && preparedMetrics
                  ? (
                    <ActiveChatText
                      key={revealAnchorRef.current.epoch}
                      line={message.line}
                      anchorTime={revealAnchorRef.current.time}
                      isPlaying={isPlaying}
                    />
                  )
                  : (
                    <ChatText message={message} />
                  )}
              </span>
            </AnimatedBubbleFrame>
          )}
      </motion.div>
    </motion.div>
  )
})

ChatMessageRow.displayName = "ChatMessageRow"

const ChatVisualizer: React.FC<ChatVisualizerProps> = (props) => {
  const {
    currentTime,
    currentLineIndex,
    lines,
    theme,
    showText = true,
    songTitle,
    coverUrl,
    seed,
    lyricsFontScale = 1,
    chatTuning = DEFAULT_CHAT_TUNING,
    chatCustomEmojiImages = [],
    chatCustomAvatarImages = [],
    isPreviewMode = false,
    isPlaying = true,
    rightAvatarUrl,
  } = props

  const isMobile = useIsMobile()
  const maxVisibleMessages = isMobile ? MAX_VISIBLE_MESSAGES_MOBILE : MAX_VISIBLE_MESSAGES_DESKTOP

  const [viewportSize, setViewportSize] = useState(() => (
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight }
  ))
  const bubbleMetricsCacheRef = useRef(new Map<string, PreparedBubbleMetrics>())
  const [visibleLineIndex, setVisibleLineIndex] = useState(() => getVisibleLineIndexAtTime(lines, currentTime.get()))
  const visibleLineIndexRef = useRef(visibleLineIndex)
  const titleText = songTitle?.trim() || "对话"
  const avatarSeed = seed ?? titleText
  const intensityConfig = useMemo(() => getChatIntensityConfig(theme.animationIntensity), [theme.animationIntensity])
  const resolvedChatTuning = useMemo<ChatTuning>(() => ({
    showEmoMessages: chatTuning.showEmoMessages ?? DEFAULT_CHAT_TUNING.showEmoMessages,
    emojiPackSource: (
      chatTuning.emojiPackSource === "custom" && chatCustomEmojiImages.length > 0
        ? "custom"
        : DEFAULT_CHAT_TUNING.emojiPackSource
    ),
    avatarSource: (
      chatTuning.avatarSource === "builtin" || chatTuning.avatarSource === "color" || chatTuning.avatarSource === "cover" || (chatTuning.avatarSource === "custom" && chatCustomAvatarImages.length > 0)
        ? chatTuning.avatarSource
        : DEFAULT_CHAT_TUNING.avatarSource
    ),
  }), [chatCustomEmojiImages.length, chatCustomAvatarImages.length, chatTuning.avatarSource, chatTuning.emojiPackSource, chatTuning.showEmoMessages])
  const activeEmoImages = useMemo(
    () => resolvedChatTuning.emojiPackSource === "custom" && chatCustomEmojiImages.length > 0
      ? chatCustomEmojiImages
      : builtinEmoImages,
    [chatCustomEmojiImages, resolvedChatTuning.emojiPackSource],
  )
  const customAvatarImages = useMemo(
    () => resolvedChatTuning.avatarSource === "custom" ? chatCustomAvatarImages : [],
    [chatCustomAvatarImages, resolvedChatTuning.avatarSource],
  )
  const messages = useMemo(
    () => buildChatMessages(lines, titleText, intensityConfig, resolvedChatTuning, activeEmoImages, isPreviewMode),
    [activeEmoImages, intensityConfig, isPreviewMode, lines, resolvedChatTuning, titleText],
  )
  const visibleMessages = useMemo(
    () => getVisibleMessages(
      messages,
      visibleLineIndex,
      viewportSize.height,
      currentLineIndex,
      currentTime.get(),
      intensityConfig.motion,
      maxVisibleMessages,
    ),
    [currentLineIndex, currentTime, intensityConfig.motion, messages, viewportSize.height, visibleLineIndex, maxVisibleMessages],
  )
  const baseFontSize = Math.max(15, Math.min(26, 18 * lyricsFontScale))
  const maxPanelWidth = Math.min(Math.max(viewportSize.width - 32, 1), 896)
  const bubbleGroupRatio = viewportSize.width >= 640 ? 0.68 : 0.78
  const maxTextWidth = Math.max(96, Math.floor(maxPanelWidth * bubbleGroupRatio - 56))
  const upcomingLine = lines[currentLineIndex + 1] ?? null

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const nextVisibleLineIndex = getVisibleLineIndexAtTime(lines, currentTime.get())
    visibleLineIndexRef.current = nextVisibleLineIndex
    setVisibleLineIndex(nextVisibleLineIndex)
  }, [currentTime, lines])

  useMotionValueEvent(currentTime, "change", (latest) => {
    const nextVisibleLineIndex = getVisibleLineIndexAtTime(lines, latest)

    if (nextVisibleLineIndex !== visibleLineIndexRef.current) {
      visibleLineIndexRef.current = nextVisibleLineIndex
      setVisibleLineIndex(nextVisibleLineIndex)
    }

    if (!upcomingLine || !shouldPreheatLine(upcomingLine, latest)) {
      return
    }

    getOrBuildBubbleMetrics(bubbleMetricsCacheRef.current, {
      line: upcomingLine,
      theme,
      fontSize: baseFontSize * intensityConfig.motion.activeFontMultiplier,
      lineHeightPx: baseFontSize * intensityConfig.motion.activeFontMultiplier * 1.45,
      maxTextWidth,
      paddingX: intensityConfig.motion.activePaddingX,
      paddingY: intensityConfig.motion.activePaddingY,
    })
  })

  if (!showText) {
    return null
  }

  return (
    <div className="relative z-10 flex h-full w-full items-start justify-center overflow-visible px-4 pb-36 pt-12 sm:px-8 sm:pb-40 sm:pt-16 lg:px-14 lg:pt-20">
      <div className="relative flex w-full max-w-4xl flex-col justify-start gap-3 overflow-visible">
        <AnimatePresence initial={false} mode={isMobile ? "wait" : "popLayout"}>
          {visibleMessages.map((message) => (
            message.kind === "divider" ? (
              <ChatDivider key={message.id} label={message.label} theme={theme} isMobile={isMobile} />
            ) : (
              <ChatMessageRow
                key={message.id}
                message={message}
                currentTime={currentTime}
                currentLineIndex={currentLineIndex}
                theme={theme}
                coverUrl={coverUrl}
                chatTuning={resolvedChatTuning}
                avatarSeed={avatarSeed}
                baseFontSize={baseFontSize}
                maxTextWidth={maxTextWidth}
                metricsCache={bubbleMetricsCacheRef}
                intensityConfig={intensityConfig}
                customAvatarImages={customAvatarImages}
                rightAvatarUrl={rightAvatarUrl}
                isPlaying={isPlaying}
                isMobile={isMobile}
              />
            )
          ))}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes chat-char-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes chat-bubble-glow-pan {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes chat-emo-wiggle {
          0%, 100% { transform: rotate(-1.6deg); }
          50% { transform: rotate(1.6deg); }
        }
      `}</style>
    </div>
  )
}

export default ChatVisualizer