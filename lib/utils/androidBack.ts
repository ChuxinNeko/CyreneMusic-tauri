/**
 * Android 硬件返回键统一栈。
 *
 * - Kotlin 侧覆写 onBackPressed / OnBackInvokedDispatcher 时，
 *   通过 webView.evaluateJavascript 调用 window.__cyreneOnAndroidBack()。
 * - 谁注册谁负责把布尔返回值告诉宿主：true = 消费；
 *   false = 交回原生侧，先 webView.goBack() 回退 SPA 路由，历史到底后才走系统默认（退出）。
 * - 栈顶优先：最近注册的 handler 先吃事件（符合"最上层 UI 先关闭"的常识）。
 *
 * 任何全屏覆盖层、Sheet、Dialog 都可以通过 pushAndroidBackHandler 接入。
 */

type AndroidBackHandler = () => boolean

const handlers: AndroidBackHandler[] = []

const dispatch = (): boolean => {
    for (let i = handlers.length - 1; i >= 0; i--) {
        try {
            if (handlers[i]()) return true
        } catch (error) {
            console.error("[androidBack] handler 抛错:", error)
        }
    }
    return false
}

declare global {
    interface Window {
        __cyreneOnAndroidBack?: () => boolean
    }
}

if (typeof window !== "undefined") {
    window.__cyreneOnAndroidBack = dispatch
}

/**
 * 注册一个 Android 返回键 handler，返回反注册函数。
 * handler 返回 true 表示消费事件，返回 false 表示让下层/系统继续处理。
 */
export const pushAndroidBackHandler = (handler: AndroidBackHandler): (() => void) => {
    handlers.push(handler)
    return () => {
        const idx = handlers.lastIndexOf(handler)
        if (idx >= 0) handlers.splice(idx, 1)
    }
}