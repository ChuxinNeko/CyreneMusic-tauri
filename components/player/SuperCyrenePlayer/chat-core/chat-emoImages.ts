import type { ChatEmojiImage } from "../default-core/default-types"

/**
 * 对话表情包加载。
 *
 * folia 原用 Vite import.meta.glob；cyrene 是 Next.js，
 * 改为从 public/cappella/emo 读取静态 URL。
 */

const EMO_FILES = [
  "1.gif",
  "2.png",
  "3.png",
  "4.png",
  "5.jpg",
  "6.png",
]

export const builtinEmoImages: ChatEmojiImage[] = EMO_FILES.map((file) => {
  const name = file.replace(/\.[^.]+$/, "")
  return {
    id: `builtin-${name}`,
    url: `/cappella/emo/${file}`,
    name,
  }
})