# 开发指南

> BeamIt Chrome 扩展开发文档

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Plasmo | 0.89.x | Chrome 扩展框架 (MV3) |
| React | 18.x | UI 组件 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 3.x | 样式 |
| Vitest | 1.x | 测试框架 |
| pnpm | 10.x | 包管理器 |

## 项目架构

```
src/
├── background.ts              # Service Worker：消息路由、会话管理
├── content.ts                 # Content Script：DOM 视频检测
├── popup.tsx                  # Popup 入口：视图状态机
├── background-utils/
│   ├── casting/
│   │   ├── dlna-player.ts     # DLNA SOAP 协议实现
│   │   └── playback-controller.ts  # 播放状态机
│   └── devices/
│       ├── device-manager.ts  # 设备发现生命周期管理
│       ├── device-history.ts  # 设备使用历史持久化
│       ├── device-recommender.ts  # 混合评分推荐算法
│       └── dlna-discover.ts   # SSDP/UPnP 多播发现
├── popup/
│   ├── components/
│   │   ├── VideoList.tsx      # 视频源列表
│   │   ├── VideoSelector.tsx  # 视频源选择器
│   │   └── DeviceList.tsx     # 设备列表
│   └── styles/
│       └── global.css         # 全局样式
└── shared/
    ├── detectors/
    │   ├── video-detector.ts       # 视频检测核心
    │   └── video-source-selector.ts # 视频源选择逻辑
    ├── constants.ts           # 常量定义
    ├── storage.ts             # chrome.storage 封装
    ├── types.ts               # 共享类型定义
    └── utils.ts               # 工具函数
```

## 消息流

```
Popup (popup.tsx)
  │  sendMessage({ type: 'DETECT_VIDEOS' })
  ▼
Background (background.ts)
  │  chrome.tabs.sendMessage(tabId, { type: 'DETECT_VIDEOS' })
  ▼
Content Script (content.ts)
  │  detectVideoSources() → VideoSource[]
  │  sendResponse(videos)
  ▼
Background → Popup (响应)
```

## 模块说明

### 视频检测 (video-detector.ts)

- `detectVideoSources()` — 从 DOM 检测 HTML5 `<video>`、`<source>`、`<iframe>` 元素
- `detectStreamUrls()` — 从 URL 列表检测 HLS (.m3u8)、DASH (.mpd) 流
- 支持 Option 级别的细粒度控制（detectMediaElements/detectHLS/detectDASH）

### 设备发现 (dlna-discover.ts)

- SSDP M-SEARCH 多播到 `239.255.250.250:1900`
- 解析 SSDP 响应提取设备信息（名称、类型、IP、端口）
- **注意**：Chrome MV3 不直接支持 UDP socket；当前实现为模拟/占位
- 发现结果缓存在 `chrome.storage.session` 中

### 设备管理 (device-manager.ts)

- `startDiscovery()` — 启动设备发现，返回 `CastingDevice[]`
- `selectDevice()` — 选择设备并记录使用历史
- `getRecentlyUsedDevices()` — 获取最近使用的在线设备
- 发现完成的设备自动缓存到 session storage

### 投屏控制 (playback-controller.ts)

- 状态机：`idle → playing → paused → playing → idle`
- `startPlayback(device, video)` — 启动投屏会话
- `stopPlayback()` — 停止投屏
- 自动轮询播放位置（每 5 秒）

## 测试

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 带覆盖率报告
pnpm test:coverage

# Allure 报告
pnpm test:report
pnpm test:open
```

### 测试文件结构

```
src/tests/
├── setup.ts                         # 全局测试配置 (chrome API mock)
├── integration/
│   └── dlna-player.test.ts          # 集成测试 (1 文件)
└── unit/
    ├── background.test.ts           # 背景服务 (13 tests)
    ├── casting/
    │   ├── dlna-player.test.ts      # DLNA 播放器 (26 tests)
    │   └── playback-controller.test.ts  # 播放控制 (24 tests)
    ├── detectors/
    │   ├── media-detector.test.ts   # 媒体检测器
    │   ├── video-detector.test.ts   # 视频检测器 (75 tests)
    │   └── video-source-selector.test.ts  # 视频源选择
    ├── devices/
    │   ├── device-history.test.ts   # 设备历史 (15 tests)
    │   ├── device-manager.test.ts   # 设备管理器 (21 tests)
    │   ├── device-recommender.test.ts  # 推荐算法
    │   └── dlna-discover.test.ts    # DLNA 发现 (20 tests)
    ├── popup/
    │   ├── popup.test.tsx           # Popup 组件 (11 tests)
    │   ├── DeviceList.test.tsx      # 设备列表 (20 tests)
    │   ├── VideoList.test.tsx       # 视频列表 (18 tests)
    │   └── VideoSelector.test.tsx   # 视频选择器 (17 tests)
    └── shared/
        ├── storage.test.ts          # 存储层
        ├── types.test.ts            # 类型验证
        └── utils.test.ts            # 工具函数
```

### 编写测试规范

1. 使用 `vi.mock()` 模拟 Chrome API 和外部依赖
2. 每个 `describe()` 块测试一个模块或组件
3. 使用 `@testing-library/react` 测试 React 组件
4. 所有测试文件命名：`*.test.ts` 或 `*.test.tsx`

## 调试

```bash
# 启动开发服务器（热重载）
pnpm dev

# 查看 Chrome 扩展日志
# chrome://extensions/ → 点击"背景页" → Console
# 右键 popup → 检查 → Console

# 类型检查
pnpm typecheck

# Lint
pnpm lint
```

## 构建

```bash
# 开发构建
pnpm dev

# 生产构建
pnpm build

# 产物在 build/chrome-mv3-prod/
```
