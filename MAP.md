# Cyrene Music Tauri 项目地图

## 项目概述

这是一个基于 **Tauri + Next.js** 的跨平台音乐播放器应用，支持桌面端（Windows/macOS/Linux）和移动端（Android/iOS）。

## 技术栈

- **前端框架**: Next.js 16 + React 19
- **桌面框架**: Tauri 2.x
- **UI 组件**: Radix UI + Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **音频播放**: Howler.js
- **动画**: Framer Motion
- **构建工具**: Next.js 内置构建 + Tauri CLI

## 目录结构

```
cyrene_music_tauri/
├── app/                    # Next.js App Router 路由页面
├── components/             # React 组件
├── hooks/                  # 自定义 React Hooks
├── lib/                    # 核心库和服务
├── stores/                 # 全局状态管理
├── src-tauri/              # Tauri 后端 (Rust)
├── public/                 # 静态资源
├── docs/                   # 文档
├── .vscode/                # VS Code 配置
├── package.json            # 前端依赖
└── next.config.ts          # Next.js 配置
```

## 核心目录详解

### `app/` - 路由页面

基于 Next.js App Router 的页面路由：

| 路由 | 功能 |
|------|------|
| `discover/` | 发现页面 |
| `local/` | 本地音乐 |
| `search/` | 搜索 |
| `history/` | 播放历史 |
| `album/` | 专辑详情 |
| `artist/` | 歌手详情 |
| `profile/` | 用户资料 |
| `settings/` | 设置 |
| `support/` | 支持/捐赠 |
| `dev/` | 开发工具 |
| `tray/` | 系统托盘窗口 |
| `desktop-lyric/` | 桌面歌词窗口 |

### `components/` - 组件库

```
components/
├── player/                 # 播放器核心组件
│   ├── parser/             # 歌词解析器
│   └── song-info/          # 歌曲信息展示
├── discovery/              # 发现页组件
├── layout/                 # 布局组件
├── auth/                   # 认证组件
├── settings/               # 设置组件
├── profile/                # 用户资料组件
├── support/                # 支持/捐赠组件
├── providers/              # Context Providers
├── setup/                  # 初始化向导
├── ui/                     # 基础 UI 组件 (shadcn)
└── common/                 # 通用组件
```

#### 播放器组件 (`components/player/`)

| 文件 | 功能 |
|------|------|
| `FullscreenPlayer.tsx` | 全屏播放器，支持歌词显示、播放控制、音量调节、音频可视化 |
| `PlayerBar.tsx` | 底部播放控制栏，显示当前播放歌曲、进度条、播放控制按钮 |
| `LyricPlayer.tsx` | 歌词显示组件，支持逐字歌词、翻译歌词、滚动同步 |
| `PlaylistPanel.tsx` | 播放列表面板，显示当前播放队列，支持搜索和删除 |
| `AudioVisualizer.tsx` | 音频可视化组件，基于音频频谱显示动态效果 |
| `WebGLBackground.tsx` | WebGL 背景渲染组件，用于全屏播放器的动态背景 |
| `EqualizerPanel.tsx` | 均衡器面板，支持多频段调节、预设选择、空间音频 |
| `AddToPlaylistDialog.tsx` | 添加到播放列表对话框，支持创建新列表和选择已有列表 |

**歌词解析器 (`components/player/parser/`)**

| 文件 | 功能 |
|------|------|
| `lrcParser.ts` | LRC 格式歌词解析 |
| `krcParser.ts` | KRC 格式歌词解析（酷狗） |
| `ttmlParser.ts` | TTML 格式歌词解析 |
| `qrcParser.ts` | QRC 格式歌词解析（QQ音乐） |

**歌曲信息 (`components/player/song-info/`)**

| 文件 | 功能 |
|------|------|
| `SongInfoPanel.tsx` | 歌曲信息主面板 |
| `SongBasicInfo.tsx` | 歌曲基本信息（名称、歌手、专辑） |
| `SongLyrics.tsx` | 歌词显示区域 |
| `SongWiki.tsx` | 歌曲百科信息 |
| `SongSimilarSongs.tsx` | 相似歌曲推荐 |
| `SongRelatedPlaylists.tsx` | 相关歌单 |
| `ArtistWorks.tsx` | 歌手作品列表 |

#### 发现页组件 (`components/discovery/`)

| 文件 | 功能 |
|------|------|
| `HeroSection.tsx` | 首页顶部英雄区，显示每日推荐和私人FM |
| `GreetingHeader.tsx` | 问候语头部，根据时间显示不同问候 |
| `DiscoverGrid.tsx` | 发现页网格布局，展示推荐歌单 |
| `DiscoveryCard.tsx` | 歌单卡片组件 |
| `CategorySelector.tsx` | 分类选择器，支持歌单标签筛选 |
| `LeaderboardHero.tsx` | 排行榜英雄区，显示热门歌曲 |
| `PlaylistDetailView.tsx` | 歌单详情页，显示歌单信息和歌曲列表 |

#### 布局组件 (`components/layout/`)

| 文件 | 功能 |
|------|------|
| `MainLayout.tsx` | 主布局组件，整合侧边栏、标题栏、播放器 |
| `Sidebar.tsx` | 侧边栏导航，支持展开/收起 |
| `TitleBar.tsx` | 自定义标题栏，包含窗口控制按钮和搜索框 |
| `MobileNav.tsx` | 移动端底部导航栏 |
| `SearchBox.tsx` | 搜索框组件 |
| `MoreMenuSheet.tsx` | 更多菜单抽屉 |

#### 认证组件 (`components/auth/`)

| 文件 | 功能 |
|------|------|
| `AuthDialog.tsx` | 登录/注册对话框 |
| `AuthForm.tsx` | 登录/注册表单，支持邮箱、手机号、二维码登录 |
| `UserCard.tsx` | 用户信息卡片，显示头像、用户名、退出登录 |

#### 设置组件 (`components/settings/`)

| 文件 | 功能 |
|------|------|
| `AppearanceSettingsManager.tsx` | 外观设置，主题切换、窗口材质选择 |
| `AudioSourceManager.tsx` | 音源管理，支持添加/删除/编辑自定义音源 |
| `AccountBindingManager.tsx` | 账号绑定管理，网易云、酷狗账号绑定/解绑 |
| `BindingCard.tsx` | 绑定状态卡片 |
| `QRCodeDialog.tsx` | 二维码扫描登录对话框 |
| `QualitySettingsDialog.tsx` | 音质设置对话框 |

#### 用户资料组件 (`components/profile/`)

| 文件 | 功能 |
|------|------|
| `ProfileHeader.tsx` | 用户资料头部，显示头像、用户名、会员状态 |
| `ProfileStats.tsx` | 听歌统计数据卡片 |
| `PlaylistSection.tsx` | 播放列表管理区域 |
| `TopRankingSection.tsx` | 播放排行榜 |
| `ImportPlaylistDialog.tsx` | 导入歌单对话框，支持网易云、QQ音乐、酷狗 |

#### 支持/捐赠组件 (`components/support/`)

| 文件 | 功能 |
|------|------|
| `DonateDialog.tsx` | 捐赠对话框，支持自定义金额和支付方式 |
| `SponsorWall.tsx` | 赞助墙，显示捐赠者列表 |

#### 通用组件 (`components/common/`)

| 文件 | 功能 |
|------|------|
| `AsyncImage.tsx` | 异步图片加载组件，支持懒加载和错误处理 |
| `UpdateDialog.tsx` | 应用更新对话框 |
| `UserAgreementContent.tsx` | 用户协议内容 |

#### 基础 UI 组件 (`components/ui/`)

基于 shadcn/ui 的基础组件库，包含：button、card、dialog、input、select、slider、tabs、tooltip、sheet、dropdown-menu 等标准组件。

#### 其他组件

| 文件 | 功能 |
|------|------|
| `theme-provider.tsx` | 主题提供者，管理深色/浅色模式切换 |
| `providers/LogProvider.tsx` | 日志提供者，管理应用日志 |
| `setup/SetupWizard.tsx` | 初始化向导，首次运行引导 |

### `lib/` - 核心库

```
lib/
├── services/               # 服务层 (22个服务模块)
├── models/                 # 数据模型定义
├── store/                  # Zustand 状态管理
│   ├── usePlayerStore.ts   # 播放器状态
│   ├── useAuthStore.ts     # 认证状态
│   ├── useLayoutStore.ts   # 布局状态
│   ├── useAudioSourceStore.ts # 音源状态
│   └── useWindowMaterialStore.ts # 窗口材质状态
└── utils/                  # 工具函数
    └── background/         # 背景渲染相关
```

### `src-tauri/` - Tauri 后端

```
src-tauri/
├── src/
│   ├── main.rs             # 入口文件
│   └── lib.rs              # 库文件
├── icons/                  # 应用图标
├── gen/                    # 平台生成文件
│   └── android/            # Android 构建文件
├── capabilities/           # Tauri 权限配置
├── Cargo.toml              # Rust 依赖
└── tauri.conf.json         # Tauri 配置
```

## 关键功能模块

### 1. 音频播放系统
- **位置**: `components/player/`, `lib/store/usePlayerStore.ts`
- **技术**: Howler.js 音频引擎
- **功能**: 播放控制、播放列表、歌词显示、音频可视化

### 2. 歌词解析
- **位置**: `components/player/parser/`
- **功能**: LRC 格式解析、逐字歌词、翻译歌词

### 3. 多音源支持
- **位置**: `lib/services/`
- **功能**: 网易云音乐、酷狗音乐等多平台音源

### 4. 用户系统
- **位置**: `components/auth/`, `lib/store/useAuthStore.ts`
- **功能**: 登录、用户信息、收藏同步

### 5. 桌面歌词
- **位置**: `app/desktop-lyric/`
- **功能**: 独立歌词窗口、桌面歌词显示

## 开发命令

```bash
# 开发模式
npm run dev

# 构建 Next.js
npm run build

# Tauri 开发
npm run tauri dev

# Tauri 构建
npm run tauri build
```

## 配置文件

- `package.json` - 前端依赖和脚本
- `next.config.ts` - Next.js 配置
- `tsconfig.json` - TypeScript 配置
- `src-tauri/tauri.conf.json` - Tauri 应用配置
- `src-tauri/Cargo.toml` - Rust 依赖配置
- `components.json` - shadcn/ui 配置
- `postcss.config.mjs` - PostCSS 配置