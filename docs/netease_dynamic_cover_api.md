# 网易云音乐动态封面 API 接入指南

本指南详细说明了如何不依赖第三方库，从零开始抓取和调用网易云音乐的“动态封面（Dynamic Cover）”接口。

## 📍 1. 接口基础信息
- **真实请求地址**: `https://interface.music.163.com/eapi/songplay/dynamic-cover` （有时也用 `interface3.music.163.com`）
- **请求方式**: `POST`
- **加密方式**: `eapi` (APP 端特有加密算法，安全性高于网页版的 `weapi`)
- **Content-Type**: `application/x-www-form-urlencoded`

## 📦 2. 请求参数体 (Payload 构造)

网易云 EAPI 接口的明文参数是一个 JSON 对象，其中必须包含接口本身需要的参数（如 `songId`），以及用于伪装设备的 `header` 对象。

```json
{
  "songId": "12345678", // 填入你需要查询的 歌曲ID
  "header": {
    "osver": "16.2",              // 操作系统版本号
    "deviceId": "a_random_device_id_string", // 随机设备指纹
    "os": "iPhone OS",           // 声明操作系统环境
    "appver": "9.0.90",          // 声明模拟的官方APP版本号
    "versioncode": "140",
    "mobilename": "",
    "buildver": "1672322300",
    "resolution": "1920x1080",
    "__csrf": "",                // 如果无登录态留空即可
    "channel": "distribution",
    "requestId": "1672322300_1234" // 格式通常为：当前时间戳_4位随机数
  },
  "e_r": true // 关键字段：表示期望服务器同样以 EAPI 格式加密返回结果
}
```

## 🛡️ 3. 加密与发送 (EAPI 核心机制)

网易网关不接受上面的明文 JSON，必须使用 **AES-128-ECB** 进行加密。具体步骤如下：

### 核心密钥
- **EAPI Key**: `e82ckenh8dicaqo8`

### 发送步骤：
1. **序列化数据**: 将上面的 JSON 对象转为字符串 `json_str`。
2. **拼接特征串**: `{URI}-36cd479b6b5-{JSON_STR}`。
   - 注意这里的 URI 是真实的路由，例如：`/api/songplay/dynamic-cover-36cd479b6b5-{"songId":"...`
3. **AES 加密**: 使用 `AES-128-ECB` 模式，配合上面的 Key 对拼接后的特征串进行加密。记得设定填充模式为 `PKCS7` 或 `PKCS5`。
4. **Hex 编码**: 将加密产生的二进制流（Buffer）转化为大写的十六进制字符串（Hex String）。
5. **组装 POST BODY**: 最终发送出去的实际 HTTP Body 只有一个参数：`params={大写十六进制字符串}`。

## 🎭 4. HTTP Headers 设置

只通过加密还不够，你的请求头（Header）必须看起来像一个真正的网易云 APP，特别是以下两项：

- **User-Agent**: 必须和你 JSON `header` 字段里设定的系统完全吻合。
  - *iOS 示例*: `NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)`
- **Cookie**: 需要植入必要的设备和系统标识，例如：
  - `os=iPhone OS; appver=9.0.90; resolution=1920x1080; ...`

## 🔓 5. 响应处理与解密

因为我们在请求体加了 `"e_r": true`，网易云服务器看懂暗号后，会返回一整串加密过的十六进制字符串（用于防恶意抓包）。我们需要逆向解开它：

1. 拿到 HTTP Response Body 的 Hex 字符串。
2. 转换为字节数组 / Buffer。
3. 使用同一把 EAPI Key (`e82ckenh8dicaqo8`)，通过 **AES-128-ECB** 进行解密。
4. 移除末尾多余的 Padding 后，再进行 UTF-8 解码。
5. 解析为最终的明文 JSON。

### 🎉 成功解密后的 JSON 示例

如果一切顺利，解开的 JSON 数据中就会包含包含动态封面的直链地址：

```json
{
  "code": 200,
  "data": {
    "dynamicCover": {
      // ↓ 这就是你可以放进 <video> 等播放器组件里的视频直链
      "coverUrl": "https://vodkpeywnpt.vod.126.net/vodkpeywnpt/abcdefg_xxx.mp4?wsSecret=...&wsTime=...",
      "type": "mp4",
      "width": 1080,
      "height": 1080
    },
    // ... 可能还会包含一些其他附加视觉效果数据
  }
}
```

## ⚠️ 6. 注意事项与避坑指南

1. **防盗链与鉴权**: 接口提取出来的 `coverUrl` 通常带有 `wsSecret` 和 `wsTime` 的 URL 参数。网易为了防盗链，这个链接往往是**高度时效性**的。**建议现查现播，绝不要把这个 `.mp4` 链接保存到你的数据库永久使用**，否则几小时后链接就会变成 403 Forbidden。
2. **并非所有歌都有**: 动效封面需要官方美工人工制作并在后台挂载，因此很多冷门歌曲或者老歌调这个接口只会返回 `null` 或没有 `dynamicCover` 字段，客户端需要做好兜底（展示静态专辑图）。
3. **接口鉴权变动风险**: User-Agent 和 EAPI Key 在网易云 APP 彻底大版本升级时可能会更替（即便目前这个 Key 存活了数年）。调用不通时首要怀疑你的伪装头不够像、或者 IP 触发了风控。
