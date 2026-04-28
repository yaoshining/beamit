# 快速入门：视频投屏 Chrome 扩展

**分支**：`001-video-casting` | **日期**：2026-04-28 | **最后验证**：2026-04-28 ✅

## 环境要求

- Node.js >= 18.x（已验证：v25.8.1 ✅）
- pnpm >= 8.x（已验证：10.33.2 ✅）
- Chrome 浏览器（最新版本）

## 安装步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd beamit-chrome-ext

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器（热重载）
pnpm dev

# 4. 加载扩展到 Chrome
# - 打开 chrome://extensions/
# - 开启"开发者模式"
# - 点击"加载已解压的扩展程序"
# - 选择 build/chrome-mv3-dev 目录（开发模式）或 build/chrome-mv3-prod 目录（生产构建）
```

## 项目结构

```
beamit-chrome-ext/
├── src/
│   ├── background.ts                # Service Worker（入口）
│   ├── popup.tsx                    # Popup UI（React 入口）
│   ├── background-utils/            # 后台模块
│   │   ├── casting/
│   │   │   ├── dlna-player.ts       # DLNA 播放控制
│   │   │   └── playback-controller.ts # 播放状态管理
│   │   └── devices/
│   │       ├── device-manager.ts    # 设备状态管理
│   │       ├── device-recommender.ts # 设备推荐逻辑
│   │       ├── device-history.ts    # 设备历史记录
│   │       └── dlna-discover.ts     # DLNA SSDP 发现协议
│   ├── popup/
│   │   ├── components/
│   │   │   ├── DeviceList.tsx       # 设备列表组件
│   │   │   ├── VideoList.tsx        # 视频源列表组件
│   │   │   └── VideoSelector.tsx    # 视频源选择器组件
│   │   └── styles/
│   │       └── global.css
│   ├── shared/                      # 共享代码
│   │   ├── types.ts                 # 类型定义
│   │   ├── constants.ts             # 常量
│   │   ├── storage.ts               # chrome.storage 封装
│   │   ├── utils.ts                 # 工具函数
│   │   └── detectors/
│   │       ├── video-detector.ts    # 视频流检测核心
│   │       ├── video-source-selector.ts # 视频源选择
│   │       └── media-detector.ts    # 媒体元素检测（content script）
│   └── tests/                       # 测试文件
│       ├── setup.ts                 # 测试环境配置
│       ├── unit/                    # 单元测试
│       │   ├── background.test.ts
│       │   ├── casting/
│       │   ├── detectors/
│       │   ├── devices/
│       │   ├── popup/
│       │   └── shared/
│       └── integration/
├── build/                           # 构建输出
│   ├── chrome-mv3-dev/              # 开发构建
│   └── chrome-mv3-prod/             # 生产构建
├── package.json
├── plasmo.config.ts
├── tailwind.config.js
├── vitest.config.mts
└── tsconfig.json
```

## 开发工作流

### 1. 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# 类型检查
pnpm typecheck
```

### 2. 实现功能

按照以下模块顺序开发：

1. **类型定义**（[`src/shared/types.ts`](src/shared/types.ts)）
2. **视频检测器**（[`src/shared/detectors/video-detector.ts`](src/shared/detectors/video-detector.ts)）
3. **DLNA 设备发现**（`src/background-utils/devices/`）
4. **DLNA 播放器控制**（`src/background-utils/casting/`）
5. **React UI 组件**（`src/popup/components/`）

### 3. 构建发布

```bash
# 构建生产版本
pnpm build

# 打包为 .zip
pnpm package
```

## 测试策略

### 单元测试

测试文件位于 [`src/tests/unit/`](src/tests/unit/)，使用 Vitest + React Testing Library。

```typescript
// src/tests/unit/detectors/media-detector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectMediaElements } from '@shared/detectors/media-detector';

describe('MediaDetector', () => {
  it('should detect video element with src', () => {
    // 使用 @shared 路径别名导入，无需关心相对路径
    document.querySelectorAll = vi.fn().mockImplementation((selector) => {
      if (selector === 'video, audio') {
        const video = document.createElement('video');
        video.src = 'https://example.com/video.mp4';
        return [video];
      }
      return [];
    });

    const result = detectMediaElements();
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/video.mp4');
  });
});
```

### 集成测试

```typescript
// src/tests/integration/dlna-player.test.ts
import { describe, it, expect } from 'vitest';
// 集成测试验证模块间协作
```

### 测试覆盖

当前覆盖状态（已验证）：
- **测试总数**：420 个（18 个测试文件）
- **总体覆盖率**：91.94%（Stmts），92.43%（Lines）
- **核心模块**：background 100%，dlna-player 97%，playback-controller 95%
- **Popup 组件**：popup.tsx 89.7%，DeviceList 70%，VideoList 95.2%，VideoSelector 64.4%

## 调试技巧

### Chrome DevTools

1. **Popup UI**：右键点击扩展图标 → 检查弹出内容
2. **Service Worker**：在 `chrome://extensions/` 页面点击 "service-worker" 链接
3. **Content Script**：在目标页面按 F12 打开 DevTools

### 日志查看

```typescript
// 在 background script 中
console.log('[BeamIt] Device discovered:', device.name);

// 在 content script 中
console.log('[BeamIt] Video detected:', videoSource.url);
```

## 常见问题

### Q: Service Worker 未激活？
A: 在 `chrome://extensions/` 页面点击"重新加载"按钮，或关闭并重新打开扩展。

### Q: 视频检测不到？
A: 确认 content script 已正确注入到目标页面。检查 Chrome DevTools 控制台是否有 `[BeamIt]` 日志。

### Q: 设备发现失败？
A: 确保电视/设备与电脑在同一个局域网内，且已开启投屏功能。DLNA/UPnP 协议需要多播网络支持。

### Q: 构建失败？
A: 运行 `pnpm typecheck` 检查 TypeScript 错误，确保无类型问题后再构建。

## 下一步

- 运行 `/speckit.tasks` 生成详细的任务列表
- 查看 [`plan.md`](specs/001-video-casting/plan.md) 了解完整实施计划
- 查看 [`tasks.md`](specs/001-video-casting/tasks.md) 了解任务分解
