# Cyrene Music Tauri 项目地图

> 版本对照：`package.json` **0.5.2** · 文档随代码结构维护

## 项目概述

这是一个基于 **Tauri v2 + Next.js** 的跨平台音乐播放器应用，支持桌面端（Windows/macOS/Linux）和移动端（Android/iOS）。

核心能力：本地 + 在线多音源播放、多风格歌词、全屏/桌面/任务栏多窗口播放器、听歌足迹、歌单导入、自动更新、Windows 深度系统集成。

## 技术栈

- **前端框架**: Next.js 16 + React 19
- **桌面框架**: Tauri 2.x
- **UI 组件**: Radix UI + Tailwind CSS 4 + shadcn/ui；可选 Fluent UI / react-windows-ui
- **状态管理**: Zustand（`lib/store/` + `stores/logStore.ts`）
- **音频播放**: Howler.js + 自研 EQ / Analyser
- **歌词**: 统一解析器 + `@applemusic-like-lyrics`（AMLL 滚动歌词）
- **动画 / 视觉**: Framer Motion、Pixi、Three.js（背景与粒子封面）
- **构建工具**: Next.js 内置构建 + Tauri CLI（开发默认 `bun`，端口 `3456`）

## 目录结构

```
cyrene_music_tauri/
├── app/                    # Next.js App Router 路由页面（含多窗口页）
├── components/             # React 组件
├── hooks/                  # 自定义 React Hooks
├── lib/                    # 核心库：services / store / models / utils
├── stores/                 # 全局日志等独立 store
├── src-tauri/              # Tauri 后端 (Rust)
├── public/                 # 静态资源
├── docs/                   # 技术文档
├── styles/                 # 额外样式（rwui 等）
├── package.json            # 前端依赖
├── next.config.ts          # Next.js 配置
└── MAP.md                  # 本项目地图
```

## 核心目录详解

### `app/` - 路由页面

基于 Next.js App Router 的页面路由：

| 路由 | 功能 |
|------|------|
| `/` (`page.tsx`) | 根入口 |
| `discover/` | 发现页面 |
| `local/` | 本地音乐 |
| `search/` | 搜索 |
| `history/` | 播放历史 |
| `footprint/` | 听歌足迹（统计、周专辑墙、语种分布） |
| `album/` | 专辑详情 |
| `artist/` | 歌手详情 |
| `profile/` | 用户资料 / 歌单 |
| `settings/` | 设置 |
| `support/` | 支持/捐赠 |
| `dev/` | 开发工具 |
| `tray/` | 系统托盘窗口 |
| `desktop-lyric/` | 桌面歌词窗口 |
| `desktop-player/` | 桌面播放器窗口（独立歌词设置） |
| `desktop-player-bar/` | 桌面播放控制条窗口 |
| `tableplayer/` | 独立侧栏/桌面小组件播放器窗口 |
| `taskbar/` | Windows 任务栏悬浮播放器 |
| `taskbar-drop-zone/` | 任务栏拖放落点辅助窗口 |
| `song-recommend/` | 歌曲推荐独立窗口（由主窗调度） |

### `components/` - 组件库

```
components/
├── player/                 # 播放器核心
│   ├── parser/             # 歌词解析（统一入口）
│   ├── song-info/          # 全屏右侧歌曲信息面板
│   └── SuperCyrenePlayer/  # SuperCyrene 全屏风格（粒子封面）
├── discovery/              # 发现页
├── layout/                 # 主布局 / 侧边栏 / 沉浸背景
├── auth/                   # 认证
├── settings/               # 设置页模块
├── profile/                # 用户资料与足迹相关 UI
├── support/                # 支持/捐赠
├── providers/              # Context Providers
├── setup/                  # 初始化向导
├── common/                 # 通用组件
├── rwui/                   # react-windows-ui 封装控件
├── ui/                     # 基础 UI (shadcn)
└── theme-provider.tsx      # 深色/浅色主题
```

#### 播放器组件 (`components/player/`)

| 文件 | 功能 |
|------|------|
| `FullscreenPlayer.tsx` | 主全屏播放器：歌词、控制、背景、歌曲信息面板、可视化 |
| `CapsulePlayerBar.tsx` | 全屏底部胶囊控制条（沉浸模式友好） |
| `PlayerBar.tsx` | 主窗口底部播放栏 |
| `DesktopPlayerBar.tsx` | 独立桌面控制条 UI（配合 `desktop-player-bar` 路由） |
| `LyricPlayer.tsx` | 自研滚动歌词 |
| `LyricPlayerRoulette.tsx` | 轮盘/圆弧歌词样式 |
| `LyricPlayerSingleLine.tsx` | 单行歌词样式 |
| `AMLLLyricPlayer.tsx` | Apple Music-like 歌词播放器 |
| `AMLLBackground.tsx` | AMLL 风格动态背景 |
| `LyricSettingsContext.tsx` | 全屏 / 桌面两套歌词设置统一注入（避免 store 串台） |
| `PlayerSettingsMenu.tsx` | 播放器设置菜单（全屏 / 桌面 scope） |
| `BackgroundSettingsDialog.tsx` | 播放器背景设置（WebGL / 图片 / 壁纸） |
| `DesktopLyricEffectDialog.tsx` | 桌面歌词视觉效果设置 |
| `PlaylistPanel.tsx` | 播放队列面板 |
| `AudioVisualizer.tsx` | 频谱可视化 |
| `FireVisualizer.tsx` | 火焰可视化 |
| `SmokeVisualizer.tsx` | 烟雾可视化 |
| `WebGLBackground.tsx` | WebGL Mesh 背景 |
| `WallpaperBackground.tsx` | Wallpaper Engine 当前壁纸背景 |
| `EqualizerPanel.tsx` | 均衡器面板 |
| `AddToPlaylistDialog.tsx` | 添加到播放列表 |

**SuperCyrene 播放器 (`components/player/SuperCyrenePlayer/`)**

| 文件 | 功能 |
|------|------|
| `SuperCyreneFullscreen.tsx` | SuperCyrene 风格全屏播放器 |
| `ParticleAlbumCover.tsx` | 基于噪声/粒子的专辑封面渲染 |

**歌词解析器 (`components/player/parser/`)**

> 旧版分散的 `lrc/krc/qrc/ttml` 解析文件已收敛为统一入口。

| 文件 | 功能 |
|------|------|
| `lyricParser.ts` | 统一歌词解析（LRC / YRC / 翻译 / offset / LRU 缓存） |
| `toAmllLyricLines.ts` | 转为 AMLL 所需行数据结构 |
| `types.ts` / `constants.ts` | 行/词类型与常量 |
| `index.ts` | 导出入口 |

**歌曲信息 (`components/player/song-info/`)**

| 文件 | 功能 |
|------|------|
| `SongInfoPanel.tsx` | 信息面板容器 |
| `SongBasicInfo.tsx` | 歌名 / 歌手 / 专辑 |
| `SongWiki.tsx` | 网易云百科（曲风、语种、BPM 等） |
| `SongComments.tsx` | 歌曲评论（网易云 / QQ） |
| `SongListeningStats.tsx` | 当前曲听歌足迹统计 |
| `SongSimilarSongs.tsx` | 相似歌曲（网易云） |
| `SongRelatedPlaylists.tsx` | 相关歌单（网易云） |
| `ArtistWorks.tsx` | 歌手代表作 |

#### 发现页组件 (`components/discovery/`)

| 文件 | 功能 |
|------|------|
| `HeroSection.tsx` | 每日推荐 / 私人 FM 等英雄区 |
| `GreetingHeader.tsx` | 时段问候 |
| `DiscoverGrid.tsx` | 推荐歌单网格 |
| `DiscoveryCard.tsx` | 歌单卡片 |
| `CategorySelector.tsx` | 标签分类筛选 |
| `LeaderboardHero.tsx` | 排行榜区 |
| `PlaylistDetailView.tsx` | 歌单详情 |
| `PlaylistComments.tsx` | 歌单评论 |

#### 布局组件 (`components/layout/`)

| 文件 | 功能 |
|------|------|
| `MainLayout.tsx` | 主布局：侧栏、标题栏、播放器、多窗口入口 |
| `Sidebar.tsx` | 侧边栏入口（按 UI 主题分发） |
| `ShadcnSidebar.tsx` | Shadcn 风格侧栏 |
| `FluentSidebar.tsx` | Fluent 风格侧栏 |
| `RightSidebarPlayer.tsx` | 右侧栏播放器（歌词/信息/控制） |
| `TitleBar.tsx` | 无边框自定义标题栏 |
| `MobileNav.tsx` | 移动端底部导航 |
| `SearchBox.tsx` | 搜索框 |
| `MoreMenuSheet.tsx` | 更多菜单抽屉 |
| `PlaybackImmersiveBackground.tsx` | 主界面随当前曲沉浸背景 |
| `LiquidGlassOverlay.tsx` | 液态玻璃叠加层 |

#### 认证组件 (`components/auth/`)

| 文件 | 功能 |
|------|------|
| `AuthDialog.tsx` | 登录/注册对话框 |
| `AuthForm.tsx` | 邮箱 / 手机 / 二维码等登录表单 |
| `UserCard.tsx` | 用户信息卡片 |

#### 设置组件 (`components/settings/`)

| 文件 | 功能 |
|------|------|
| `AppearanceSettingsManager.tsx` | 外观、主题、窗口材质、UI 主题（shadcn/fluent） |
| `PlayerSettingsManager.tsx` | 播放相关偏好设置 |
| `AudioSourceManager.tsx` | 音源管理（含 LX 音乐脚本等） |
| `CacheSettingsManager.tsx` | 音频缓存开关与目录 |
| `AccountBindingManager.tsx` | 网易云 / 酷狗等账号绑定 |
| `BindingCard.tsx` | 绑定状态卡片 |
| `QRCodeDialog.tsx` | 二维码登录 |
| `QualitySettingsDialog.tsx` | 音质设置 |

#### 用户资料 / 足迹组件 (`components/profile/`)

| 文件 | 功能 |
|------|------|
| `ProfileHeader.tsx` | 资料头部 |
| `ProfileStats.tsx` | 听歌统计卡片 |
| `PlaylistSection.tsx` | 歌单列表与管理 |
| `TopRankingSection.tsx` | 播放排行 |
| `WeeklyAlbumWall.tsx` | 周专辑墙 |
| `LanguageStatsSection.tsx` | 语种统计 |
| `ImportPlaylistDialog.tsx` | 外部歌单导入（网易云 / QQ / 酷狗） |
| `PosterDialog.tsx` | 听歌海报生成/分享 |

#### 支持/捐赠 (`components/support/`)

| 文件 | 功能 |
|------|------|
| `DonateDialog.tsx` | 捐赠对话框 |
| `SponsorWall.tsx` | 赞助墙 |

#### 通用组件 (`components/common/`)

| 文件 | 功能 |
|------|------|
| `AsyncImage.tsx` | 异步图片（含本地/跨域处理） |
| `UpdateDialog.tsx` | 应用更新对话框 |
| `AnnouncementDialog.tsx` | 公告弹窗 |
| `SongRecommendPopup.tsx` | 主窗内推荐窗口调度器（无 UI，发事件/开窗） |
| `UserAgreementContent.tsx` | 用户协议 |

#### 其他组件

| 路径 | 功能 |
|------|------|
| `theme-provider.tsx` | 深色/浅色 |
| `providers/LogProvider.tsx` | 日志 Provider |
| `setup/SetupWizard.tsx` | 首次运行引导 |
| `rwui/*` | Fluent 场景下的 Select / Slider / Switch |
| `ui/*` | shadcn 基础组件 + LiquidGlass 等 |

### `hooks/`

| 文件 | 功能 |
|------|------|
| `use-mobile.ts` | 移动端断点判断 |
| `useRemotePlayerSync.ts` | 子窗口同步主窗播放状态 / 进度 / 频谱（Tauri 事件） |

### `lib/` - 核心库

```
lib/
├── constants/              # 常量（如歌词字体）
├── models/                 # Track / Playlist / Search / AudioSourceConfig
├── services/               # 业务服务层（~31 个模块）
├── store/                  # Zustand 状态
└── utils/                  # 工具与 WebGL 背景管线
    └── background/         # mesh / shader / 封面取色生成等
```

#### 状态管理 (`lib/store/`)

| 文件 | 职责 | 持久化 key（若有） |
|------|------|-------------------|
| `usePlayerStore.ts` | 当前曲、队列、播放态、循环模式、心动模式等 | 播放相关 |
| `useFullscreenSettingsStore.ts` | **全屏播放器**歌词/背景显示设置（与桌面窗隔离） | `fullscreen-settings-storage` |
| `useDesktopPlayerStore.ts` | **桌面播放器**独立歌词/3D/偏移设置 | `desktop-player-storage` |
| `useAuthStore.ts` | 登录态、token、全局登录弹窗开关 | `auth-storage`（不含弹窗） |
| `useLayoutStore.ts` | 侧栏、布局、推荐窗等 UI 状态 | |
| `useAudioSourceStore.ts` | 当前音源配置 | |
| `useWindowMaterialStore.ts` | 窗口材质（Mica/Acrylic 等） | |
| `useUIThemeStore.ts` | UI 主题 `shadcn` / `fluent` | |
| `useCacheStore.ts` | 缓存开关与目录 | `cyrene-cache-storage` |
| `useSearchPreferencesStore.ts` | 搜索启用的平台列表 | |

> 设计要点：全屏与桌面窗**不再共用**歌词字号等显示设置，避免多窗口 `persist` 互相覆盖。

#### 数据模型 (`lib/models/`)

| 文件 | 内容 |
|------|------|
| `track.ts` | `Track`、`MergedTrack` |
| `playlist.ts` | 歌单与同步结果 |
| `search.ts` | 搜索结果结构 |
| `audioSourceConfig.ts` | 音源配置结构 |

#### 服务层 (`lib/services/`) 概览

| 服务 | 功能 |
|------|------|
| `playerService.ts` | 播放核心：Howler、切歌、跨窗事件、安卓通知/歌词联动 |
| `apiClient.ts` | 带鉴权感知的 fetch；401/403 / body 鉴权失败时清登录态并提示重新登录 |
| `audioSourceService.ts` | 音质 / 音源枚举与解析 |
| `urlService.ts` | 后端 base URL 与源类型 |
| `audioProxyService.ts` | 音频代理（配合 Rust） |
| `audioAnalyser.ts` | 实时频谱 / 低频中频 |
| `audioEqService.ts` | 10 段 EQ 与预设 |
| `cacheService.ts` | 本地音频缓存读写 |
| `localMusicService.ts` | 本地曲库（调 Rust 扫描） |
| `searchService.ts` | 多平台搜索 |
| `discoveryService.ts` | 发现页 / 推荐 / 歌单详情 |
| `playlistService.ts` | 用户歌单 |
| `playlistImportService.ts` | 外部歌单导入 |
| `historyService.ts` | 播放历史 |
| `listeningStatsService.ts` | 听歌足迹统计 |
| `heartModeService.ts` | 心动模式推荐队列 |
| `albumService.ts` / `artistService.ts` | 专辑 / 歌手详情 |
| `authService.ts` / `accountService.ts` | 登录与账号绑定 |
| `neteaseSongWikiService.ts` | 网易云歌曲百科 |
| `neteaseCommentService.ts` / `qqCommentService.ts` | 评论 |
| `lxMusicSourceService.ts` / `lxMusicRuntimeService.ts` | LX 音乐脚本音源 |
| `backgroundService.ts` | 背景相关资源 |
| `androidMediaNotificationService.ts` | Android 媒体通知 |
| `androidLyricService.ts` | Android 歌词推送 |
| `updateService.ts` | 检查更新 / 触发下载 |
| `announcementService.ts` | 公告 |
| `sponsorService.ts` | 赞助列表 |
| `cyreneConfigService.ts` | 远端/应用配置 |

#### 工具 (`lib/utils/`)

| 路径 | 功能 |
|------|------|
| `extractColors.ts` | 封面取色 |
| `spring.ts` | 弹簧动画工具 |
| `androidBack.ts` | Android 返回键处理 |
| `background/*` | WebGL mesh 背景、shader、封面生成预设 |

### `src-tauri/` - Tauri 后端

```
src-tauri/
├── src/
│   ├── main.rs              # 入口
│   ├── lib.rs               # 命令注册、窗口、更新下载、系统集成
│   ├── local_music.rs       # 本地扫描与元数据（lofty）
│   ├── audio_proxy.rs       # 音频 HTTP 代理
│   ├── desktop_player.rs    # 桌面播放器窗口（Windows WorkerW 等）
│   ├── taskbar_player.rs    # 任务栏播放器窗口
│   ├── thumbbar.rs          # Windows 缩略图工具栏
│   └── wallpaper_engine.rs  # 读取 Wallpaper Engine 当前壁纸
├── icons/                   # 应用图标
├── gen/android/             # Android 生成工程
├── capabilities/            # 权限：default / desktop
├── Cargo.toml
└── tauri.conf.json          # 产品名 CyreneMusicNext，无边框透明主窗
```

## 关键功能模块

### 1. 音频播放系统
- **位置**: `components/player/`、`lib/services/playerService.ts`、`lib/store/usePlayerStore.ts`
- **技术**: Howler.js + 可选缓存/代理
- **功能**: 队列、循环/随机、心动模式、跨窗口状态同步、EQ、频谱

### 2. 多窗口播放生态
- **主窗**: 全屏播放器 + 底栏 + 右侧栏播放器
- **桌面播放器** (`desktop-player`): 独立设置 store + `useRemotePlayerSync`
- **桌面控制条** (`desktop-player-bar`)
- **桌面歌词** (`desktop-lyric`)
- **任务栏播放器** (`taskbar` + Rust `taskbar_player`)
- **推荐窗** (`song-recommend` + `SongRecommendPopup`)
- **tableplayer**: 桌面小组件式播放器

同步通道：Tauri 事件 `player:state-change` / `player:time-sync` / 频谱相关事件。

### 3. 歌词系统
- **解析**: `parser/lyricParser.ts`（LRC/YRC/翻译/offset）
- **展示**: 滚动 / 轮盘 / 单行 / AMLL
- **设置隔离**: `useFullscreenSettingsStore` vs `useDesktopPlayerStore`，经 `LyricSettingsContext` 注入

### 4. 播放器背景
- WebGL mesh（`WebGLBackground` + `lib/utils/background`）
- 自定义图片（模糊/亮度/缩放/遮罩）
- Wallpaper Engine（Rust `wallpaper_engine` → `WallpaperBackground`）

### 5. 多音源
- 网易云、QQ、酷狗、酷我等（视当前音源配置）
- 自定义音源 + LX 音乐脚本运行时
- 搜索平台可在 `useSearchPreferencesStore` 中筛选

### 6. 本地音乐
- 前端 `localMusicService` + Rust `local_music`（扫描、元数据、封面）

### 7. 用户系统与歌单
- 登录 / 绑定 / 用户歌单同步
- 外部平台歌单导入
- 收藏与添加到歌单

### 8. 听歌足迹
- **页面**: `app/footprint/`
- **服务**: `listeningStatsService`
- **UI**: `ProfileStats`、`TopRankingSection`、`WeeklyAlbumWall`、`LanguageStatsSection`、`PosterDialog`
- 全屏信息面板内嵌 `SongListeningStats`

### 9. 全屏播放器歌曲信息（百科语种等）
- **位置**: `SongWiki.tsx`、`neteaseSongWikiService.ts`
- **触发**: 全屏切换到歌曲信息 → `SongInfoPanel`
- **数据流**:
  ```
  SongInfoPanel → SongWiki → neteaseSongWikiService.fetchSongWiki(trackId)
    → HTTP GET /song/wiki/summary?id={trackId}
      → blocks[].creatives[]
        → creativeType === 'language' → textLinks[0].text
  ```
- **字段**: `songTag`(曲风)、`language`(语种)、`bpm`(节奏)
- **限制**: 百科类能力主要依赖网易云（`track.source === 'netease'`）；评论支持网易云 / QQ

### 10. 心动模式
- **服务**: `heartModeService`
- 基于用户歌单/喜好拉推荐队列，与 `usePlayerStore.heartMode` 联动

### 11. 缓存与更新
- 缓存：`cacheService` + `CacheSettingsManager` + `useCacheStore`
- 更新：`updateService` + Rust `download_update` + `UpdateDialog`

### 12. 移动端集成
- Android 媒体通知、歌词服务、返回键（`androidBack`）
- 状态栏颜色插件

## 开发命令

```bash
# 仅前端（端口 3456）
npm run dev
# 或 bun run dev

# 构建 Next.js 静态产物（Tauri beforeBuild）
npm run build

# 桌面联调 / 打包
npm run tauri dev
npm run tauri build

# 移动端
npm run tauri android dev
npm run tauri ios dev
```

## 配置文件

| 文件 | 说明 |
|------|------|
| `package.json` | 前端依赖与脚本（版本号） |
| `next.config.ts` | Next 配置 / 静态导出相关 |
| `tsconfig.json` | TypeScript 路径别名等 |
| `src-tauri/tauri.conf.json` | 产品名、窗口、构建命令 |
| `src-tauri/Cargo.toml` | Rust 依赖 |
| `src-tauri/capabilities/*` | 权限 |
| `components.json` | shadcn/ui |
| `postcss.config.mjs` | PostCSS / Tailwind |
| `docs/netease_dynamic_cover_api.md` | 网易云动态封面 API 说明 |

## 维护说明

新增功能时建议同步更新本文件：

1. `app/` 新路由 → 路由表
2. 新组件目录/核心文件 → 对应表格
3. 新 `lib/services/*` 或 `lib/store/*` → 服务/状态表
4. 新 Rust 模块 → `src-tauri` 树与关键功能章节
5. 跨窗口事件名或 store 隔离策略有变 → 在「多窗口 / 歌词设置」处注明