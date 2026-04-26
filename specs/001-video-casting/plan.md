# 实施计划：视频投屏

**分支**：`001-video-casting` | **日期**：2026-04-26 | **规格**：[spec.md](./spec.md)
**输入**：功能规格说明书 `/specs/001-video-casting/spec.md`

## 概述

创建一个 Chrome 扩展应用，用于抓取网页中的视频流并投屏到电视。通过全量视频检测（media 元素、HLS、DASH、iframe）发现视频源，使用 DLNA 协议投屏到智能电视。

## 技术上下文

**语言/版本**：TypeScript 5.x
**主要依赖**：
- Plasmo Framework（Chrome 扩展开发框架）
- React 18（UI 组件）
- Tailwind CSS（样式）
- Vite（构建工具）
- Vitest（测试框架）
- Allure（测试报告生成）
**存储**：chrome.storage.local（扩展配置）、chrome.storage.session（会话数据）
**测试**：Vitest（单元测试 + 集成测试）+ Playwright（E2E）+ Allure（报告）
**目标平台**：Chrome 浏览器（Manifest V3）
**项目类型**：Chrome 扩展应用
**性能目标**：
- 扩展激活 ≤ 500ms
- 视频检测 ≤ 2s
- 设备发现 ≤ 5s
- 内存占用 ≤ 50MB
**约束**：
- Manifest V3 规范
- Service Worker 生命周期限制
- Popup UI 内存限制
**规模/范围**：
- 核心功能：视频检测 + DLNA 投屏
- UI 页面：Popup（设备列表、视频源选择）
- 测试覆盖：≥ 80% 核心业务逻辑

## 章程检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| TypeScript 类型安全 | ✅ | 使用 TypeScript 5.x，无 any 类型 |
| 测试驱动开发 | ✅ | Vitest + TDD 工作流 |
| 代码审查 | ⚠️ | MVP 阶段可简化，正式发布前需完善 |
| 性能要求 | ✅ | 内存 ≤ 50MB，启动 ≤ 500ms |
| 安全与隐私 | ✅ | 数据本地化，权限最小化 |
| CI/CD 工作流 | ✅ | GitHub Actions 自动测试 |
| 测试报告 | ✅ | Allure 报告，历史保留在 gh-pages |

*GATE：必须在 Phase 0 研究前通过。Phase 1 设计后重新检查。*

## 项目结构

### 文档（此功能）

```text
specs/001-video-casting/
├── plan.md              # 本文件
├── spec.md              # 功能规格说明书
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出（如需要）
└── tasks.md             # Phase 2 输出（/speckit.tasks 命令）
```

### 源代码（仓库根目录）

```text
beamit-chrome-ext/
├── package.json           # 项目配置
├── plasmo.config.ts       # Plasmo 配置
├── tailwind.config.js     # Tailwind CSS 配置
├── tsconfig.json          # TypeScript 配置
├── vitest.config.ts       # Vitest 测试配置
├── allure.properties      # Allure 报告配置
│
├── src/
│   ├── manifest.ts        # 扩展清单（Vite 入口）
│   │
│   ├── background/       # Service Worker
│   │   ├── index.ts      # Background 入口
│   │   ├── devices/      # 设备发现模块
│   │   │   ├── dlna-discover.ts
│   │   │   └── device-manager.ts
│   │   └── casting/      # 投屏控制模块
│   │       ├── dlna-player.ts
│   │       └── playback-controller.ts
│   │
│   ├── content/          # Content Script
│   │   ├── index.ts      # Content Script 入口
│   │   └── detectors/    # 视频检测器
│   │       ├── media-detector.ts
│   │       ├── hls-detector.ts
│   │       ├── dash-detector.ts
│   │       └── iframe-detector.ts
│   │
│   ├── popup/            # 弹窗 UI（React）
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── VideoList.tsx
│   │   │   ├── DeviceList.tsx
│   │   │   ├── CastingStatus.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── hooks/
│   │   │   ├── useVideoDetection.ts
│   │   │   ├── useDeviceDiscovery.ts
│   │   │   └── useCasting.ts
│   │   └── styles/
│   │       └── global.css
│   │
│   ├── shared/           # 共享模块
│   │   ├── types.ts      # 类型定义
│   │   ├── constants.ts  # 常量
│   │   └── utils.ts      # 工具函数
│   │
│   └── tests/            # 测试文件
│       ├── unit/
│       │   ├── detectors/
│       │   └── casting/
│       └── integration/
│
├── assets/               # 静态资源
│   └── icon.png
│
└── docs/                 # 文档
    └── development.md
```

**结构决策**：使用 Plasmo 框架的标准目录结构，background/ 和 content/ 作为独立入口点，popup/ 使用 React SPA 模式。

## 测试报告配置

### Allure 报告设置

测试报告使用 Allure 3 风格，保留历史记录：
- **报告访问**：`https://[username].github.io/beamit-chrome-ext/allure/`
- **历史保留**：通过 GitHub Actions 上传 allure-results/history 到 artifact
- **保留策略**：最近 30 次成功的测试报告历史

### 报告生成流程

```
Vitest 运行测试 → 生成 JUnit XML → Allure generate → 上传到 gh-pages
                                      ↑
                           下载上次的 history → 合并到当前报告
```

### npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run test:report` | 运行测试并生成 Allure 报告 |
| `npm run test:report:allure` | 只生成 Allure 报告（需要先运行测试） |
| `npm run test:open` | 打开 Allure 报告预览 |

## 复杂度跟踪

> **仅在章程检查有违规需要论证时填写**

| 违规项 | 必要原因 | 被拒绝的更简单替代方案 |
|--------|----------|----------------------|
| 无 | MVP 阶段保持简单 | - |

## 实施阶段

### Phase 0：研究和发现

1. 研究 Plasmo 框架的 Service Worker 和 Content Script 配置
2. 研究 DLNA 协议在浏览器环境中的实现方式
3. 研究视频流检测的最佳实践（HLS/DASH 解析）
4. 研究 Allure 测试报告集成

### Phase 1：设计和合约

1. 定义数据类型模型（视频源、投屏设备、投屏会话）
2. 定义组件接口合约
3. 创建开发快速入门文档
4. 更新代理上下文

### Phase 2：任务分解

（由 `/speckit.tasks` 命令生成）
