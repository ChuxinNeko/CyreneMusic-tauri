type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" &&
  Boolean((window as TauriWindow).__TAURI_INTERNALS__)

const userAgentMatches = (pattern: RegExp): boolean =>
  typeof navigator !== "undefined" && pattern.test(navigator.userAgent)

export const isAndroidTauriRuntime = (): boolean =>
  isTauriRuntime() && userAgentMatches(/Android/i)

export const isWindowsTauriRuntime = (): boolean =>
  isTauriRuntime() && userAgentMatches(/Windows/i)