# 研究报告：视频投屏 Chrome 扩展

**分支**：`001-video-casting` | **日期**：2026-04-26

## 研究问题

### 1. Plasmo 框架配置

**问题**：如何在 Plasmo 中正确配置 Service Worker 和 Content Script？

**决策**：使用 Plasmo 官方推荐的配置方式
- `src/background/` 目录自动作为 Service Worker 入口
- `src/content/` 目录自动作为 Content Script 入口
- 使用 `plasmo link` 命令进行开发调试

**理由**：Plasmo 抽象了 Chrome 扩展的复杂配置，提供开箱即用的开发体验。

**替代方案考虑**：
- 纯 Manifest V3 配置：需要手动处理大量配置，工作量大
- wxt/samestore：功能类似，但 Plasmo 生态更成熟

---

### 2. DLNA 协议实现

**问题**：在浏览器环境中如何实现 DLNA DMR 功能？

**决策**：使用 SSDP 协议发现设备 + SOAP 控制播放

**实现方案**：
1. **设备发现**：通过 UDP 多播（239.255.255.250:1900）发送 SSDP M-SEARCH 请求
2. **设备描述**：解析设备返回的 XML 描述文件，获取 SOAP 服务地址
3. **媒体控制**：通过 HTTP POST 发送 SOAP 控制消息（AVTransport 服务）

**理由**：DLNA 是开放的协议标准，浏览器可以通过 WebSocket/UDP 实现设备发现和控制。

**技术细节**：
- Service Worker 中使用 `fetch` 发送 UDP 请求（受限于同源策略，需要使用 iframe 作为代理）
- 或者使用 Chrome 的 `chrome.sockets` API（需要额外权限）

**替代方案考虑**：
- 直接使用 mDNS/Bonjour：浏览器不支持，需要 Native Messaging
- 使用第三方库：如 node-dlna-client，但 Service Worker 环境不兼容

---

### 3. 视频流检测策略

**问题**：如何全面检测网页中的视频流？

**决策**：全量检测策略（4 种检测器）

**检测器实现**：

| 检测器 | 目标 | 实现方式 |
|--------|------|----------|
| MediaDetector | `<video>` 和 `<audio>` 标签 | 遍历 DOM，提取 src/currentSrc |
| HlsDetector | HLS 流 (.m3u8) | 正则匹配 script 标签和网络请求 |
| DashDetector | DASH 流 (.mpd) | 解析 m3u8 或直接匹配 .mpd URL |
| IframeDetector | 内嵌播放器 | 检测 iframe src 中的视频平台 |

**理由**：不同网站使用不同的视频嵌入方式，需要组合多种检测策略。

**替代方案考虑**：
- 仅检测 video 标签：漏检很多流媒体
- 使用 MutationObserver：更复杂，但对于 SPA 更好

---

### 4. Tailwind CSS 配置

**问题**：如何在 Plasmo 项目中配置 Tailwind CSS？

**决策**：使用 PostCSS + Tailwind CSS v3

**配置步骤**：
1. 安装 `tailwindcss`、`postcss`、`autoprefixer`
2. 创建 `tailwind.config.js` 和 `postcss.config.js`
3. 在 popup 入口文件中 import CSS

**理由**：Tailwind CSS 是 Plasmo 生态中广泛使用的样式方案，配置简单。

---

### 5. 性能优化策略

**问题**：如何满足扩展的性能要求（启动 ≤500ms，内存 ≤50MB）？

**决策**：
- React 使用懒加载 + suspense
- 视频检测使用 Web Worker
- 设备发现使用缓存（5 分钟有效期）

**理由**：
- Service Worker 冷启动较慢，需要通过缓存和懒加载优化
- Web Worker 可以避免阻塞主线程
- 设备列表缓存可以减少网络请求

---

## 技术栈确认

| 组件 | 技术 | 版本 |
|------|------|------|
| 框架 | Plasmo | latest |
| 语言 | TypeScript | 5.x |
| UI | React | 18.x |
| 样式 | Tailwind CSS | 3.x |
| 构建 | Vite | 5.x |
| 测试 | Vitest | latest |

## 已知限制

1. **Service Worker 生命周期**：Chrome 会在空闲时终止 Service Worker，需要使用 Alarms API 或 periodic sync 来保持活跃
2. **UDP 限制**：浏览器无法直接发送 UDP，需要使用 Chrome Socket API 或通过 Native Host
3. **CORS 限制**：某些视频源的跨域请求可能失败，需要通过 background script 代理

## 下一步

1. 初始化 Plasmo 项目
2. 配置 Tailwind CSS
3. 实现视频检测模块
4. 实现 DLNA 设备发现