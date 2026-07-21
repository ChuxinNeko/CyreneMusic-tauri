import type { PropsWithChildren } from "react"
import type { MotionValue } from "framer-motion"
import type { AudioBands, Theme } from "./default-types"
import type { VisualizerSharedProps } from "./default-definition"

interface DefaultShellProps extends PropsWithChildren {
  theme: Theme
  audioPower: MotionValue<number>
  audioBands: AudioBands
  sharedProps?: Partial<VisualizerSharedProps>
}

export default function DefaultShell({ children }: DefaultShellProps) {
  return <div className="relative h-full w-full overflow-hidden bg-transparent">{children}</div>
}