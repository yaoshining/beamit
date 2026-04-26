# 🌊 Beam It – 网页视频流 → 电视投屏

> 一款简洁但强大的 Chrome 扩展：**提取网页中的视频流，一键投屏到电视**。  
> 无需下载、无需转码，直接抓取页面中的视频链接，通过 DLNA / Chromecast 推送到大屏幕。

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-扩展-blue)](https://chrome.google.com/webstore) 
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/yourname/beamit/pulls)

---

## ✨ 特性

- 🎯 **智能提取**：自动检测页面中的主流视频流（`m3u8`, `mp4`, `webm`, `flv` 等），无需手动寻找地址。
- 📺 **一键投屏**：点击扩展图标，选择局域网内的电视 / 盒子 / 投屏接收器，视频立即在大屏播放。
- 🧩 轻量无侵入：不修改网页内容，只在需要时抓取视频元数据。
- 🔒 隐私友好：不收集任何浏览数据，所有检测逻辑在本地完成。
- ⚡ 支持常见投屏协议：DLNA（大多数智能电视）、Chromecast（Google 电视棒）、部分 AirPlay 设备。

---

## 🔧 安装方式

### 1. 从 Chrome 网上应用店安装（即将上线）
> 待发布后，点击链接一键安装。

### 2. 开发者模式（加载未打包的扩展）
```bash
git clone https://github.com/yourname/beamit.git
cd beam-it