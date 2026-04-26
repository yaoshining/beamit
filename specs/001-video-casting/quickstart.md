# 快速入门：视频投屏 Chrome 扩展

**分支**：`001-video-casting` | **日期**：2026-04-26

## 环境要求

- Node.js >= 18.x
- pnpm >= 8.x 或 npm >= 9.x
- Chrome 浏览器（最新版本）

## 安装步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd beamit-chrome-ext

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 加载扩展到 Chrome
# - 打开 chrome://extensions/
# - 开启"开发者模式"
# - 点击"加载已解压的扩展程序"
# - 选择 src 目录
```

## 项目结构

```
beamit-chrome-ext/
├── src/
│   ├── manifest.ts           # 扩展清单入口
│   ├── background/           # Service Worker
│   │   ├── index.ts
│   │   ├── devices/
│   │   └── casting/
│   ├── content/              # Content Script
│   │   ├── index.ts
│   │   └── detectors/
│   ├── popup/                # React UI
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   └── shared/               # 共享代码
│       ├── types.ts
│       ├── constants.ts
│       └── utils.ts
├── package.json
├── plasmo.config.ts
├── tailwind.config.js
└── vitest.config.ts
```

## 开发工作流

### 1. 编写测试（TDD）

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage
```

### 2. 实现功能

按照以下模块顺序开发：

1. **类型定义** (`src/shared/types.ts`)
2. **视频检测器** (`src/content/detectors/`)
3. **DLNA 设备发现** (`src/background/devices/`)
4. **DLNA 播放器控制** (`src/background/casting/`)
5. **React UI 组件** (`src/popup/`)

### 3. 构建发布

```bash
# 构建生产版本
pnpm build

# 打包为 .zip
pnpm package
```

## 测试策略

### 单元测试

```typescript
// src/tests/unit/detectors/media-detector.test.ts
import { describe, it, expect } from 'vitest';
import { MediaDetector } from '../../content/detectors/media-detector';

describe('MediaDetector', () => {
  it('should detect video element with src', () => {
    // Arrange
    const html = '<video src="https://example.com/video.mp4"></video>';
    
    // Act
    const result = MediaDetector.detect(html);
    
    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/video.mp4');
  });
});
```

### 集成测试

```typescript
// src/tests/integration/video-detection.test.ts
import { describe, it, expect } from 'vitest';
import { VideoDetector } from '../../content/detectors';

describe('Video Detection Integration', () => {
  it('should detect all video types in a complex page', async () => {
    // Simulate a page with multiple video sources
    const page = createMockPage({
      videos: [{ src: 'test.mp4' }],
      scripts: ['player.js'],
      iframes: [{ src: 'https://youtube.com/embed/123' }]
    });
    
    const detector = new VideoDetector();
    const results = await detector.detect(page);
    
    expect(results).toHaveLength(3);
  });
});
```

## 调试技巧

### Chrome DevTools

1. **Popup UI**：右键点击扩展图标 → 检查弹出内容
2. **Service Worker**：在扩展页面点击 "service-worker" 链接
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
A: 在 chrome://extensions/ 页面点击"重新加载"按钮，或关闭并重新打开扩展。

### Q: 视频检测不到？
A: 检查页面是否有动态加载的视频，确保 content script 已正确注入。

### Q: 设备发现失败？
A: 确保电视/设备与电脑在同一个局域网内，且已开启投屏功能。

## 下一步

运行 `/speckit.tasks` 生成详细的任务列表。