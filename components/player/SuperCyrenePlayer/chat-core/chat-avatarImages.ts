import type { ChatAvatarSource, ChatAvatarImage } from "../default-core/default-types"

/**
 * 对话头像加载与解析。
 *
 * folia 原实现用 Vite 的 import.meta.glob 批量加载头像；cyrene 是 Next.js，
 * 改为从 public/cappella/avatar 读取静态 URL。文件名按字典序固定列出，
 * 保证 SSR/CSR 顺序一致、选取结果确定。
 */

export type ChatAvatarSide = "left" | "right"

const AVATAR_FILES = [
  "avatar2.png", "avatar3.png", "avatar4.png", "avatar5.png", "avatar6.png",
  "avatar8.png", "avatar9.png", "avatar10.png", "avatar11.png", "avatar12.png",
  "avatar13.png", "avatar14.png", "avatar15.png", "avatar16.png", "avatar17.png",
]

export const builtinAvatarImages: ChatAvatarImage[] = AVATAR_FILES
  .slice()
  .sort((a, b) => a.localeCompare(b))
  .map((file) => {
    const name = file.replace(/\.[^.]+$/, "")
    return {
      id: `builtin-avatar-${name}`,
      name,
      url: `/cappella/avatar/${file}`,
    }
  })

interface ResolveChatAvatarUrlInput {
  avatarSource: ChatAvatarSource
  coverUrl?: string | null
  avatarIndex: number
  side: ChatAvatarSide
  seed?: string | number
  avatars?: ChatAvatarImage[]
  customAvatarImages?: ChatAvatarImage[]
}

const hashString = (input: string) => {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const getSeededIndex = (seed: string | number, side: ChatAvatarSide, length: number) =>
  hashString(`${seed}|${side}|${length}`) % length

export const pickStableBuiltinAvatarImage = (
  avatars: ChatAvatarImage[],
  avatarIndex: number,
  side: ChatAvatarSide,
  seed: string | number = "chat",
): ChatAvatarImage | null => {
  if (avatars.length === 0) return null

  const rightAvatarIndex = getSeededIndex(seed, "right", avatars.length)
  if (side === "right") {
    return avatars[rightAvatarIndex] ?? null
  }

  const leftAvatarPool = avatars.filter((_, index) => index !== rightAvatarIndex)
  if (leftAvatarPool.length === 0) {
    return avatars[rightAvatarIndex] ?? null
  }

  const leftSeedOffset = getSeededIndex(seed, "left", leftAvatarPool.length)
  const resolvedLeftIndex = Math.abs(Math.trunc(avatarIndex + leftSeedOffset)) % leftAvatarPool.length
  return leftAvatarPool[resolvedLeftIndex] ?? null
}

export const resolveChatAvatarUrl = ({
  avatarSource,
  coverUrl,
  avatarIndex,
  side,
  seed,
  avatars = builtinAvatarImages,
  customAvatarImages,
}: ResolveChatAvatarUrlInput): string | null => {
  if (avatarSource === "color") {
    return null
  }

  if (avatarSource === "cover" && coverUrl) {
    return coverUrl
  }

  if (avatarSource === "custom" && customAvatarImages && customAvatarImages.length > 0) {
    return pickStableBuiltinAvatarImage(customAvatarImages, avatarIndex, side, seed)?.url ?? null
  }

  return pickStableBuiltinAvatarImage(avatars, avatarIndex, side, seed)?.url ?? null
}