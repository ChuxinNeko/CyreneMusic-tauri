// 预设的歌词字体选项（font-family）
// 依赖用户系统已安装的字体，未安装时浏览器自动 fallback 到列表中的下一个
export interface LyricFontOption {
    label: string
    value: string
}

export const LYRIC_FONT_OPTIONS: LyricFontOption[] = [
    { label: "MiSans（默认）", value: "'MiSans', sans-serif" },
    { label: "思源黑体", value: "'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif" },
    { label: "苹方", value: "'PingFang SC', -apple-system, sans-serif" },
    { label: "微软雅黑", value: "'Microsoft YaHei', sans-serif" },
    { label: "黑体", value: "'SimHei', 'Heiti SC', sans-serif" },
    { label: "宋体", value: "'SimSun', 'Songti SC', serif" },
    { label: "等线", value: "'DengXian', sans-serif" },
    { label: "楷体", value: "'KaiTi', 'STKaiti', serif" },
    { label: "系统默认", value: "sans-serif" },
]

// 默认字体（与首个选项保持一致）
export const DEFAULT_LYRIC_FONT = LYRIC_FONT_OPTIONS[0].value
