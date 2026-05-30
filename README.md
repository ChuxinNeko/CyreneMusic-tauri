# Cyrene Music Next

Cyrene Music Next 是一款基于 [Tauri v2](https://v2.tauri.app/) 和 [Next.js](https://nextjs.org/) 构建的现代化跨平台本地与在线音乐播放器。它拥有精致的 UI 设计，支持本地音乐扫描、解析，在线资源播放，歌词显示（含桌面悬浮歌词），系统任务栏增强（Windows），以及全平台的无缝体验。

## ✨ 核心特性

- 🎵 **跨平台支持**：全面支持 Windows、macOS、Linux，以及移动端的 Android 和 iOS。
- 🎨 **现代化 UI**：基于 Tailwind CSS 和 shadcn/ui 构建，支持沉浸式的深色/浅色模式以及 Mica/Acrylic 材质效果（Windows端）。
- 📂 **本地音乐库**：支持扫描本地文件夹，自动解析音频元数据（封面、艺术家等）和本地歌词文件。
- 🎤 **灵活的歌词显示**：支持应用内滚动歌词以及桌面悬浮歌词窗，随心享受音乐。
- 🖥️ **深度系统集成**：
  - Windows: 任务栏控制、缩略图工具栏按钮、独特的任务栏悬浮播放器组件。
  - 移动端: 接入原生媒体控制面板与通知栏控制。
- 🔄 **自动更新**：内置全平台应用内自动更新机制，可直接获取 GitHub Releases 的最新包，并支持 Android 端的安全静默引导安装。
- ⚡ **高性能架构**：前端使用 React/Next.js 开发，后端由 Rust 驱动，占用极低，启动飞快。

## 📸 截图

*(欢迎贡献应用的运行截图！)*

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) (推荐 v18+)
- [Rust](https://www.rust-lang.org/tools/install) (最新稳定版)
- Tauri 相关的[平台依赖](https://v2.tauri.app/start/prerequisites/)（如 MSVC, Android Studio, Xcode 等，取决于你的目标构建平台）

### 安装依赖

```bash
npm install
```

### 开发运行

启动开发环境（同时启动 Next.js 和 Tauri 进程）：

```bash
# 桌面端开发调试
npm run tauri dev

# Android 端开发调试
npm run tauri android dev

# iOS 端开发调试
npm run tauri ios dev
```

### 打包构建

构建生产版本应用包：

```bash
# 构建桌面端安装包 (Windows .msi / macOS .dmg / Linux .deb)
npm run tauri build

# 构建 Android 安装包 (.apk)
npm run tauri android build

# 构建 iOS 安装包
npm run tauri ios build
```

## 🛠️ 技术栈

- **前端**: Next.js (App Router), React, Tailwind CSS, shadcn/ui, Zustand
- **后端/系统集成**: Rust, Tauri v2
- **插件**: `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog` 等

## 🤝 贡献与反馈

非常欢迎提交 Issue 或 Pull Request！如果有好的功能建议，随时在仓库反馈。

### 社区支持

- **LINUX DO**: [https://linux.do/](https://linux.do/)

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) 发布。
