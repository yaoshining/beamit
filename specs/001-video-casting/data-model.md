# 数据模型：视频投屏

**分支**：`001-video-casting` | **日期**：2026-04-26

## 实体定义

### VideoSource（视频源）

代表网页中检测到的视频流。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识符（UUID） |
| url | string | 是 | 视频流 URL |
| type | VideoType | 是 | 视频类型 |
| pageUrl | string | 是 | 来源页面 URL |
| pageTitle | string | 否 | 来源页面标题 |
| duration | number | 否 | 时长（秒） |
| mimeType | string | 否 | MIME 类型 |
| detectedAt | number | 是 | 检测时间戳 |

**VideoType 枚举**：
- `media` - HTML5 video/audio 元素
- `hls` - HLS 流 (.m3u8)
- `dash` - DASH 流 (.mpd)
- `iframe` - 内嵌 iframe 播放器

**验证规则**：
- `url`：必须是有效的 URL 格式
- `type`：必须是 VideoType 枚举值之一

---

### CastingDevice（投屏设备）

代表局域网内发现的投屏设备。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识符（UDN） |
| name | string | 是 | 设备显示名称 |
| type | DeviceType | 是 | 设备类型 |
| protocol | Protocol | 是 | 投屏协议 |
| address | string | 是 | 设备 IP 地址 |
| port | number | 否 | 服务端口（默认 80） |
| isOnline | boolean | 是 | 在线状态 |
| lastSeen | number | 是 | 最后发现时间 |

**DeviceType 枚举**：
- `tv` - 电视
- `receiver` - AV 接收器
- `speaker` - 音箱
- `other` - 其他设备

**Protocol 枚举**：
- `dlna` - DLNA/UPnP

**验证规则**：
- `id`：必须是非空字符串
- `address`：必须是有效的 IP 或主机名

---

### CastingSession（投屏会话）

代表一次投屏操作。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识符（UUID） |
| deviceId | string | 是 | 目标设备 ID |
| videoSourceId | string | 是 | 视频源 ID |
| status | SessionStatus | 是 | 会话状态 |
| startedAt | number | 是 | 开始时间 |
| endedAt | number | 否 | 结束时间 |
| error | string | 否 | 错误信息 |

**SessionStatus 枚举**：
- `connecting` - 连接中
- `playing` - 播放中
- `paused` - 已暂停
- `stopped` - 已停止
- `error` - 错误

**验证规则**：
- `startedAt`：必须是有效的时间戳
- `endedAt`：如果存在，必须大于 `startedAt`

---

### DeviceHistory（设备历史）

记录用户使用过的设备。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | string | 是 | 设备 ID |
| lastUsed | number | 是 | 最后使用时间 |
| useCount | number | 是 | 使用次数 |

---

## 状态机

### CastingSession 状态转换

```
                    [播放]
                    ──────→ playing
                    │
[创建] ──→ connecting ──┬── [停止] ──→ stopped
                       │
                       └── [错误] ──→ error
```

---

## 数据存储

### chrome.storage.local

| Key | 类型 | 说明 |
|-----|------|------|
| `deviceHistory` | DeviceHistory[] | 设备使用历史 |
| `recentDevices` | string[] | 最近使用的设备 ID（最多 10 个） |
| `settings` | Settings | 用户设置 |

### chrome.storage.session

| Key | 类型 | 说明 |
|-----|------|------|
| `currentSession` | CastingSession | 当前投屏会话 |
| `detectedVideos` | VideoSource[] | 当前页面检测到的视频源 |
| `discoveredDevices` | CastingDevice[] | 当前发现的设备列表 |

---

## 关系图

```
VideoSource (1) ────── (0..1) CastingSession
                                        │
                                        │
CastingDevice (1) ────── (0..1) CastingSession
                                        │
                                        │
DeviceHistory (*) ────── (1) CastingDevice