<!--
Sync Impact Report:
- Version change: 0.1.0 → 1.0.0 (MAJOR - initial constitution creation)
- Added sections: Core Principles (5), Quality Standards, Development Workflow, Governance
- Removed sections: None (new constitution)
- Templates requiring updates: ✅ plan-template.md (checked), ✅ spec-template.md (checked), ✅ tasks-template.md (checked), ✅ commands/*.md (checked)
- Deferred items: None
-->

# BeamIt 章程

> BeamIt 是一个 Chrome 扩展项目，用于将网页视频流投屏到电视设备。

## 核心原则

### I. 代码质量优先
所有代码必须符合以下标准：
- **类型安全**：优先使用 TypeScript，避免使用 `any` 类型
- **代码风格**：遵循项目统一的 ESLint + Prettier 配置
- **模块化**：每个模块职责单一，控制在 200 行以内
- **可维护性**：代码注释使用中文，复杂逻辑必须有解释

### II. 测试驱动开发（强制）
测试是交付的强制要求：
- **单元测试覆盖率**：核心业务逻辑 ≥ 80%
- **集成测试**：DLNA/Chromecast 协议交互必须测试
- **手动测试清单**：每个功能必须提供可执行的手动测试步骤
- **测试工具**：使用 Vitest + Playwright

### III. 用户体验一致性
投屏功能必须保证一致的体验：
- **响应时间**：UI 操作反馈 ≤ 100ms
- **状态可见**：每个操作必须有明确的加载/成功/失败状态
- **错误处理**：用户可理解的错误提示，不暴露技术细节
- **设备发现**：局域网设备搜索超时控制在 5 秒内

### IV. 性能要求
扩展性能直接影响用户体验：
- **内存占用**：空闲状态 ≤ 50MB
- **CPU 占用**：后台 idle ≤ 1%
- **启动时间**：扩展激活 ≤ 500ms
- **网络请求**：设备发现使用缓存，避免频繁轮询

### V. 安全与隐私
保护用户数据安全：
- **数据本地化**：所有处理在本地完成，不上传用户数据
- **权限最小化**：仅申请功能必需的 Chrome 权限
- **安全审计**：依赖包必须通过 npm audit

## 质量标准

### 代码审查
- 所有 PR 必须经过至少 1 人审查
- 审查重点：测试覆盖、类型安全、用户体验一致性
- 合并前必须通过所有 CI 检查

### 发布标准
- 版本号遵循 semver 规范
- 每次发布必须包含更新日志
- 手动验证投屏功能（不同协议）

## 开发工作流

### 分支策略
- `main`：稳定版本
- `feature/*`：功能开发分支
- `fix/*`：bug 修复分支

### 提交流息
- 使用中文撰写提交信息
- 格式：`type: 描述`（type: feat/fix/docs/refactor/test）

### 开发指南
- 运行时开发指导见 `docs/development.md`
- 使用 `npm run dev` 启动开发模式
- 使用 `npm test` 运行测试

## 治理

### 章程优先级
本章程优先于其他开发实践。

### 修订程序
- 修订需要文档化并提供迁移方案
- 重大变更需经过团队讨论
- 版本号根据变更类型递增

**版本**: 1.0.0 | **批准日期**: 2026-04-26 | **最后修订**: 2026-04-26
