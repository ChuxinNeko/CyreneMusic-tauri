import type { Line } from "../default-core/default-types"

/**
 * 将 TTML agent id 解析为稳定的对话聊天发送方（左/右 + 头像索引）。
 * 直接移植自 folia cappella，未改逻辑。
 */

export type ChatSide = "left" | "right"

export interface ChatMessageSender {
  side: ChatSide
  avatarIndex: number
}

interface ChatAgentSenderOptions {
  rightAvatarIndex: number
  leftAvatarCount: number
}

export interface ChatAgentSenderResolver {
  resolve: (line: Pick<Line, "agentId">) => ChatMessageSender | null
}

const normalizeAgentId = (agentId: string | undefined): string | null => {
  const trimmed = agentId?.trim()
  return trimmed ? trimmed : null
}

const collectDistinctAgentIds = (lines: Array<Pick<Line, "agentId">>): string[] => {
  const ids: string[] = []
  const seen = new Set<string>()

  lines.forEach((line) => {
    const agentId = normalizeAgentId(line.agentId)
    if (!agentId || seen.has(agentId)) {
      return
    }

    seen.add(agentId)
    ids.push(agentId)
  })

  return ids
}

export const createChatAgentSenderResolver = (
  lines: Array<Pick<Line, "agentId">>,
  options: ChatAgentSenderOptions,
): ChatAgentSenderResolver | null => {
  const agentIds = collectDistinctAgentIds(lines)
  if (agentIds.length < 2) {
    return null
  }

  const rightAgentId = agentIds[0]
  const leftAvatarCount = Math.max(1, options.leftAvatarCount)
  const senderByAgentId = new Map<string, ChatMessageSender>()

  agentIds.forEach((agentId, index) => {
    senderByAgentId.set(agentId, agentId === rightAgentId
      ? {
        side: "right",
        avatarIndex: options.rightAvatarIndex,
      }
      : {
        side: "left",
        avatarIndex: (index - 1) % leftAvatarCount,
      })
  })

  return {
    resolve: (line) => {
      const agentId = normalizeAgentId(line.agentId)
      return agentId ? senderByAgentId.get(agentId) ?? null : null
    },
  }
}