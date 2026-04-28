# BeamIt - 网页视频投屏 Chrome 扩展

> 一款简洁但强大的 Chrome 扩展：**提取网页中的视频流，一键投屏到电视**。
> 支持 HTML5 视频、HLS 流、DASH 流和 iframe 嵌入播放器的检测和投屏。

## 功能特性

| 特性 | 状态 | 说明 |
|------|------|------|
| 🎬 **智能视频检测** | ✅ 已完成 | 自动检测 HTML5 视频、HLS (.m3u8)、DASH (.mpd) 流 |
| 📺 **DLNA 投屏** | ✅ 已完成 | 通过 SSDP/UPnP 发现设备并进行投屏 |
| 📡 **设备管理** | ✅ 已完成 | 设备历史记录、使用频率排序、推荐算法 |
| 🎯 **视频源选择** | ✅ 已完成 | 按类型分组、优先级排序、推荐最佳源 |
| 📊 **测试覆盖** | ✅ 已完成 | 424+ 项单元/集成测试，覆盖全部核心逻辑 |

## 项目状态

### 分支结构

| 分支 | 用途 |
|------|------|
| `main` | 稳定版本，CI/CD 主分支 |
| `001-video-casting` | 功能开发分支 |
| `gh-pages` | 测试报告静态页面 |

### Git Worktree 并行开发

项目支持使用 `git worktree` 进行多分支并行开发：

```bash
# 创建新的 worktree
git worktree add ../beamit-worktree-feature -b worktree/feature/video-detection

# 查看当前 worktree
git worktree list

# 清理已完成的 worktree
git worktree remove ../beamit-worktree-feature
```

### CI/CD 工作流

| 工作流 | 触发条件 | 说明 |
|--------|----------|------|
| `ci.yml` | PR、push | 单元测试、集成测试、Lint、类型检查 |
| `test-report.yml` | 合并到 main | 生成 HTML 测试报告，部署到 gh-pages |

### GitHub Projects

项目使用 GitHub Projects (Kanban) 管理任务：

- **待办 (Backlog)**：功能需求、bug 修复、技术改进
- **进行中 (In Progress)**：当前正在开发的任务
- **待 review (In Review)**：PR 待审查
- **已完成 (Done)**：已完成的任务

### GitHub Issues

每个功能需求、bug 或改进都创建独立 Issue，关联对应分支和 PR。

## 技术栈

- **框架**：Plasmo (Chrome Extension Framework) + MV3
- **语言**：TypeScript 5.x
- **UI**：React 18 + Tailwind CSS
- **测试**：Vitest + Playwright
- **构建**：Vite
- **报告**：Allure Framework

## 开发指南

### 环境要求

- Node.js >= 18.x
- pnpm >= 8.x
- Chrome 浏览器（最新版本）

### 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 运行测试（监听模式）
pnpm test:watch

# 生成测试覆盖率报告
pnpm test:coverage

# 生成 Allure 测试报告
pnpm test:report
pnpm test:open

# 构建生产版本
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

### 加载扩展到 Chrome

1. 运行 `pnpm dev` 启动开发服务器
2. 打开 `chrome://extensions/`
3. 开启**开发者模式**
4. 点击**加载已解压的扩展程序**
5. 选择项目根目录下的 `build/chrome-mv3-dev` 目录

## 项目结构

```
src/
├── background.ts              # 后台 Service Worker
├── popup.tsx                  # Popup 入口
├── background-utils/
│   ├── casting/               # 投屏控制模块
│   │   ├── dlna-player.ts     # DLNA 播放器实现
│   │   └── playback-controller.ts  # 播放状态机
│   └── devices/               # 设备管理模块
│       ├── device-manager.ts  # 设备管理器
│       ├── device-history.ts  # 设备历史记录
│       ├── device-recommender.ts  # 设备推荐算法
│       └── dlna-discover.ts   # SSDP/DLNA 设备发现
├── popup/
│   ├── components/
│   │   ├── VideoList.tsx      # 视频源列表组件
│   │   ├── VideoSelector.tsx  # 视频源选择器
│   │   └── DeviceList.tsx     # 设备列表组件
│   └── styles/
│       └── global.css         # 全局样式
├── shared/
│   ├── constants.ts           # 常量定义
│   ├── detectors/
│   │   ├── video-detector.ts       # 视频检测核心
│   │   └── video-source-selector.ts # 视频源选择逻辑
│   ├── storage.ts             # 存储层
│   ├── types.ts               # 类型定义
│   └── utils.ts               # 工具函数
└── tests/
    ├── setup.ts               # 测试环境配置
    ├── integration/           # 集成测试
    │   └── dlna-player.test.ts
    └── unit/                  # 单元测试
        ├── detectors/
        │   ├── media-detector.test.ts
        │   ├── video-detector.test.ts
        │   └── video-source-selector.test.ts
        └── devices/
            ├── device-history.test.ts
            ├── device-recommender.test.ts
            └── dlna-discover.test.ts
```

## 项目文档

- [功能规格](./specs/001-video-casting/spec.md)
- [实施计划](./specs/001-video-casting/plan.md)
- [技术调研](./specs/001-video-casting/research.md)
- [数据模型](./specs/001-video-casting/data-model.md)
- [快速入门](./specs/001-video-casting/quickstart.md)
- [项目章程](./.specify/memory/constitution.md)

## 测试

### 测试策略

项目采用 TDD（测试驱动开发）方法，包含：

- **单元测试**：覆盖所有核心业务逻辑（检测器、选择器、设备管理、推荐算法）
- **集成测试**：覆盖 DLNA 播放器和跨模块协作场景
- **Allure 报告**：每次测试运行生成可视化报告

### 当前覆盖

- **18 个测试文件**，**424 项测试用例**
- 核心模块覆盖率：检测逻辑 ✓、选择逻辑 ✓、设备历史 ✓、推荐算法 ✓、DLNA 发现 ✓、投屏控制 ✓、背景服务 ✓、Popup UI ✓

## 测试报告

测试报告部署在 GitHub Pages：

```
https://[username].github.io/beamit-chrome-ext/test-report/
```

测试报告由 `test-report.yml` 工作流在每次合并到 main 分支时自动生成和部署。

## 许可证

MIT
