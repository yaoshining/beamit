# 任务列表：视频投屏 Chrome 扩展

**输入**：设计文档来自 `/specs/001-video-casting/`
**前置条件**：plan.md（必填）、spec.md（必填，用于用户故事）、research.md、data-model.md

**测试**：项目要求 TDD 开发，所有用户故事需要先编写测试

**组织**：任务按用户故事分组，以实现每个故事的独立实现和测试

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可以并行运行（不同文件，无依赖）
- **[Story]**：属于哪个用户故事（如 US1、US2、US3）
- 描述中包含完整文件路径

---

## Phase 1：设置（项目初始化）

**目的**：项目初始化和基础结构

- [ ] T001 初始化 Plasmo 项目，创建 package.json 和基本配置文件
- [ ] T002 配置 TypeScript (tsconfig.json)
- [ ] T003 [P] 配置 ESLint 和 Prettier
- [ ] T004 [P] 配置 Tailwind CSS
- [ ] T005 配置 Vitest 测试框架 (vitest.config.ts)
- [ ] T006 [P] 配置 Allure 测试报告
- [ ] T007 创建项目目录结构 per plan.md

---

## Phase 2：基础设施（阻塞前置条件）

**目的**：所有用户故事必须依赖的核心基础设施

**⚠️ 关键**：在进入用户故事阶段前必须完成此阶段

- [ ] T008 创建共享类型定义 in src/shared/types.ts
- [ ] T009 [P] 创建常量定义 in src/shared/constants.ts
- [ ] T010 [P] 创建工具函数 in src/shared/utils.ts
- [ ] T011 配置 Plasmo manifest.ts 入口
- [ ] T012 配置 chrome.storage.local 和 chrome.storage.session
- [ ] T013 创建 VideoSource 类型和验证函数
- [ ] T014 创建 CastingDevice 类型和验证函数
- [ ] T015 创建 CastingSession 类型和状态机
- [ ] T016 创建 DeviceHistory 类型和存储逻辑

**检查点**：基础设施就绪 - 用户故事实现可以开始

---

## Phase 3：用户故事 1 - 一键投屏到电视（优先级：P1）🎯 MVP

**目标**：用户点击扩展图标，扩展自动检测页面中的视频流，列出可用的 DLNA 设备，用户选择电视后视频立即在大屏播放

**独立测试**：可以通过模拟视频源和虚拟 DLNA 设备完全测试

### US1 测试（TDD - 先编写测试，确保失败）

- [ ] T017 [P] [US1] 创建 VideoSource 检测测试 in src/tests/unit/detectors/media-detector.test.ts
- [ ] T018 [P] [US1] 创建 DLNA 设备发现测试 in src/tests/unit/devices/dlna-discover.test.ts
- [ ] T019 [US1] 创建 DLNA 播放控制集成测试 in src/tests/integration/dlna-player.test.ts

### US1 实现

- [ ] T020 [P] [US1] 实现 MediaDetector（检测 video/audio 标签）in src/content/detectors/media-detector.ts
- [ ] T021 [P] [US1] 实现 HlsDetector（检测 m3u8）in src/content/detectors/hls-detector.ts
- [ ] T022 [P] [US1] 实现 DashDetector（检测 mpd）in src/content/detectors/dash-detector.ts
- [ ] T023 [P] [US1] 实现 IframeDetector（检测内嵌播放器）in src/content/detectors/iframe-detector.ts
- [ ] T024 [US1] 实现 VideoDetector 聚合器 in src/content/detectors/index.ts
- [ ] T025 [US1] 实现 DLNA 设备发现服务 in src/background/devices/dlna-discover.ts
- [ ] T026 [US1] 实现 DeviceManager（设备状态管理）in src/background/devices/device-manager.ts
- [ ] T027 [US1] 实现 DLNA 播放器控制 in src/background/casting/dlna-player.ts
- [ ] T028 [US1] 实现 PlaybackController（播放状态控制）in src/background/casting/playback-controller.ts
- [ ] T029 [US1] 创建 Content Script 入口 in src/content/index.ts
- [ ] T030 [US1] 创建 Background Service Worker 入口 in src/background/index.ts
- [ ] T031 [US1] 实现消息传递机制（content ↔ background）
- [ ] T032 [US1] 添加错误处理和日志记录

**检查点**：此时用户故事 1 应该完全可用且可独立测试

---

## Phase 4：用户故事 2 - 智能视频流检测（优先级：P2）

**目标**：扩展能够自动识别并列出所有可用的视频流，用户可以选择其中一个进行投屏

**独立测试**：可以通过注入测试视频元素到页面来验证检测能力

### US2 测试

- [ ] T033 [P] [US2] 创建多视频源检测测试 in src/tests/unit/detectors/video-detector.test.ts
- [ ] T034 [P] [US2] 创建视频源选择逻辑测试 in src/tests/unit/detectors/video-source-selector.test.ts

### US2 实现

- [ ] T035 [P] [US2] 扩展 MediaDetector 支持更多格式（webm、flv）
- [ ] T036 [P] [US2] 优化 HlsDetector 正则表达式匹配
- [ ] T037 [US2] 实现视频源去重和排序逻辑
- [ ] T038 [US2] 实现视频源列表 UI 组件 in src/popup/components/VideoList.tsx
- [ ] T039 [US2] 实现视频源选择下拉菜单 in src/popup/components/VideoSelector.tsx
- [ ] T040 [US2] 集成视频源选择到 Popup App in src/popup/App.tsx

**检查点**：此时用户故事 1 和 2 都应该独立工作

---

## Phase 5：用户故事 3 - 投屏设备管理（优先级：P3）

**目标**：用户可以在扩展中查看最近使用过的投屏设备，并快速重新连接常用设备

**独立测试**：可以通过模拟设备历史记录来测试

### US3 测试

- [ ] T041 [P] [US3] 创建设备历史存储测试 in src/tests/unit/devices/device-history.test.ts
- [ ] T042 [P] [US3] 创建设备排序和推荐逻辑测试 in src/tests/unit/devices/device-recommender.test.ts

### US3 实现

- [ ] T043 [P] [US3] 实现 DeviceHistory 存储逻辑 in src/background/devices/device-history.ts
- [ ] T044 [P] [US3] 实现设备推荐逻辑（按使用频率）in src/background/devices/device-recommender.ts
- [ ] T045 [US3] 创建设备列表 UI 组件 in src/popup/components/DeviceList.tsx
- [ ] T046 [US3] 实现最近设备快捷访问功能
- [ ] T047 [US3] 实现离线设备状态显示
- [ ] T048 [US3] 优化设备搜索超时体验（5秒内完成）

**检查点**：所有用户故事都应该独立可用

---

## Phase 6：打磨和跨领域关注点

**目的**：影响多个用户故事的改进

- [ ] T049 [P] 更新 README.md 和开发文档 in docs/development.md
- [ ] T050 [P] 代码清理和重构
- [ ] T051 性能优化（内存占用 ≤ 50MB，启动 ≤ 500ms）
- [ ] T052 [P] 添加更多单元测试（覆盖率 ≥ 80%）
- [ ] T053 安全加固（权限最小化、npm audit）
- [ ] T054 运行 quickstart.md 验证流程
- [ ] T055 配置 GitHub Actions CI/CD

---

## 依赖关系和执行顺序

### Phase 依赖

- **Phase 1：设置**：无依赖 - 可以立即开始
- **Phase 2：基础设施**：取决于设置完成 - 阻塞所有用户故事
- **Phase 3-5：用户故事**：都取决于基础设施完成
  - 用户故事可以并行（如果有团队资源）
  - 或按优先级顺序（US1 → US2 → US3）
- **Phase 6：打磨**：取决于所有用户故事完成

### 用户故事依赖

- **用户故事 1（P1）**：基础设施完成后即可开始 - 不依赖其他故事
- **用户故事 2（P2）**：基础设施完成后即可开始 - 可能与 US1 集成但应独立测试
- **用户故事 3（P3）**：基础设施完成后即可开始 - 可能与 US1/US2 集成但应独立测试

### 每个用户故事内部

1. 测试必须先编写并失败，然后实现
2. 模型在服务之前
3. 服务在端点之前
4. 核心实现先于集成
5. 故事完成后再进入下一个优先级

### 并行机会

- 所有标记 [P] 的设置任务可以并行
- 所有标记 [P] 的基础设施任务可以并行（在 Phase 2 内）
- 一旦基础设施完成，所有用户故事可以并行开始（如果有团队能力）
- 所有标记 [P] 的用户故事测试可以并行
- 故事内的模型标记 [P] 可以并行
- 不同用户故事可以由不同团队成员并行开发

---

## 并行示例：用户故事 1

```bash
# 同时启动所有 US1 测试（如果测试被要求）：
Task: "创建 VideoSource 检测测试 in src/tests/unit/detectors/media-detector.test.ts"
Task: "创建 DLNA 设备发现测试 in src/tests/unit/devices/dlna-discover.test.ts"

# 同时启动所有 US1 模型：
Task: "实现 MediaDetector in src/content/detectors/media-detector.ts"
Task: "实现 HlsDetector in src/content/detectors/hls-detector.ts"
Task: "实现 DashDetector in src/content/detectors/dash-detector.ts"
Task: "实现 IframeDetector in src/content/detectors/iframe-detector.ts"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成 Phase 1：设置
2. 完成 Phase 2：基础设施（关键 - 阻塞所有故事）
3. 完成 Phase 3：用户故事 1
4. **停止并验证**：独立测试用户故事 1
5. 如果准备好则部署/演示

### 增量交付

1. 完成设置 + 基础设施 → 基础设施就绪
2. 添加用户故事 1 → 独立测试 → 部署/演示（MVP！）
3. 添加用户故事 2 → 独立测试 → 部署/演示
4. 添加用户故事 3 → 独立测试 → 部署/演示
5. 每个故事增加价值且不破坏之前的故事

### 并行团队策略

多个开发者时：

1. 团队一起完成设置 + 基础设施
2. 一旦基础设施完成：
   - 开发者 A：用户故事 1
   - 开发者 B：用户故事 2
   - 开发者 C：用户故事 3
3. 故事独立完成和集成

---

## 任务统计

| 阶段 | 任务数 | 说明 |
|------|--------|------|
| Phase 1：设置 | 7 | 项目初始化 |
| Phase 2：基础设施 | 9 | 核心依赖 |
| Phase 3：US1 | 16 | 一键投屏（MVP） |
| Phase 4：US2 | 8 | 智能视频流检测 |
| Phase 5：US3 | 8 | 投屏设备管理 |
| Phase 6：打磨 | 7 | 跨领域改进 |
| **总计** | **55** | |

### 每个用户故事的任务数

- **US1**：16 个任务（测试 + 实现）
- **US2**：8 个任务
- **US3**：8 个任务

### 识别的并行机会

- Phase 1 所有 [P] 任务可并行（7 个任务）
- Phase 2 所有 [P] 任务可并行（5 个任务）
- US1 实现中 4 个检测器可并行实现
- US2/US3 的模型实现可并行

### MVP 范围

MVP = Phase 1 + Phase 2 + Phase 3（用户故事 1）
- 约 32 个任务
- 完成后可独立测试一键投屏功能