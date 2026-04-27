# BeamIt - 网页视频投屏 Chrome 扩展

> 一款简洁但强大的 Chrome 扩展：**提取网页中的视频流，一键投屏到电视**。

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

- **框架**：Plasmo (Chrome Extension Framework)
- **语言**：TypeScript 5.x
- **UI**：React 18 + Tailwind CSS
- **测试**：Vitest + Playwright
- **构建**：Vite

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

# 构建生产版本
pnpm build
```

### 加载扩展到 Chrome

1. 打开 `chrome://extensions/`
2. 开启**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择 `src` 目录

## 项目文档

- [功能规格](./specs/001-video-casting/spec.md)
- [实施计划](./specs/001-video-casting/plan.md)
- [技术调研](./specs/001-video-casting/research.md)
- [数据模型](./specs/001-video-casting/data-model.md)
- [快速入门](./specs/001-video-casting/quickstart.md)
- [项目章程](./.specify/memory/constitution.md)

## 测试报告

测试报告部署在 GitHub Pages：

```
https://[username].github.io/beamit-chrome-ext/test-report/
```

测试报告由 `test-report.yml` 工作流在每次合并到 main 分支时自动生成和部署。

## 许可证

MIT