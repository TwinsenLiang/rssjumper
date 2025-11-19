# RSSJumper API文档

## 基础信息

- **Base URL**: `https://your-domain.vercel.app`
- **协议**: HTTPS
- **请求方法**: GET
- **响应格式**: XML（RSS代理）或 JSON（API接口）

## API端点

### 1. 首页 / 使用说明

**端点**: `/`

**方法**: `GET`

**描述**: 返回HTML首页，显示使用说明和可视化界面

**响应**: HTML页面

**示例**:
```
GET https://your-domain.vercel.app/
```

---

### 2. RSS代理

**端点**: `/?url={RSS_URL}`

**方法**: `GET`

**参数**:
- `url` (必需): 要代理的RSS订阅源地址

**响应头**:
- `Content-Type`: `application/xml; charset=utf-8`
- `X-RSSJumper-Cache`: `HIT` (缓存命中) 或 `MISS` (实时拉取)

**限制**:
- 频率限制: 2次/分钟/IP
- 缓存时间: 5分钟
- 请求超时: 10秒

**成功响应** (200):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>示例RSS</title>
    ...
  </channel>
</rss>
```

**错误响应**:

- **400 Bad Request**: 无效的URL格式
```json
{
  "error": "无效的URL格式，只支持http/https协议的RSS源"
}
```

- **429 Too Many Requests**: 超过频率限制
```json
{
  "error": "访问频率超限，请稍后再试",
  "limit": "2次/分钟"
}
```

- **500 Internal Server Error**: 抓取失败
```json
{
  "error": "服务器错误",
  "message": "抓取RSS失败: 连接超时"
}
```

**示例**:
```bash
# 代理香港电台RSS
curl "https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml"

# 代理其他RSS源
curl "https://your-domain.vercel.app/?url=https://example.com/feed.xml"
```

---

### 3. 查看访问历史

**端点**: `/?password={PASSWORD}` 或 `/list?password={PASSWORD}`

**方法**: `GET`

**参数**:
- `password` (必需): 访问密码（默认: `fUgvef-fofzu7-pifjic`）

**响应格式**: JSON

**成功响应** (200):
```json
{
  "total": 10,
  "logs": [
    {
      "url": "https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml",
      "date": "2025-11-19T00:30:15.234Z"
    },
    {
      "url": "https://example.com/feed.xml",
      "date": "2025-11-19T00:25:10.123Z"
    }
  ]
}
```

**错误响应** (403):
```json
{
  "error": "密码错误"
}
```

**示例**:
```bash
# 查看访问历史
curl "https://your-domain.vercel.app/?password=fUgvef-fofzu7-pifjic"

# 或者使用 /list 端点
curl "https://your-domain.vercel.app/list?password=fUgvef-fofzu7-pifjic"
```

---

## 使用场景

### 场景1: RSS阅读器订阅

在RSS阅读器中添加订阅时，将原RSS地址转换为代理地址：

```
原地址:
https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml

代理地址:
https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml
```

### 场景2: 批量转换

使用脚本批量转换RSS地址：

```javascript
const baseUrl = 'https://your-domain.vercel.app';
const rssUrls = [
  'https://example1.com/feed.xml',
  'https://example2.com/rss.xml'
];

const proxyUrls = rssUrls.map(url =>
  `${baseUrl}/?url=${encodeURIComponent(url)}`
);

console.log(proxyUrls);
```

### 场景3: 监控访问情况

定期检查访问历史：

```bash
#!/bin/bash
PASSWORD="fUgvef-fofzu7-pifjic"
curl -s "https://your-domain.vercel.app/?password=$PASSWORD" | jq '.total'
```

---

## 响应状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 403 | 密码错误（访问历史） |
| 405 | 请求方法不允许（仅支持GET） |
| 429 | 访问频率超限 |
| 500 | 服务器内部错误 |

---

## 限制说明

### 频率限制

- **规则**: 每个IP地址限制为 **2次/分钟**
- **计算方式**: 滑动时间窗口
- **超限处理**: 返回429状态码，需等待后重试

### 缓存机制

- **缓存时长**: 5分钟
- **缓存键**: RSS源URL
- **缓存标识**: 响应头 `X-RSSJumper-Cache`
  - `HIT`: 返回缓存内容
  - `MISS`: 实时从源站拉取

### 请求限制

- **超时时间**: 10秒
- **最大重定向**: 5次
- **支持协议**: HTTP、HTTPS
- **文件格式**: 仅RSS/XML

### 历史记录

- **最大条数**: 100条
- **存储方式**: 内存（无服务器环境重启会清空）
- **访问控制**: 需要密码

---

## CORS支持

所有API端点支持跨域请求（CORS）：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

可以直接在前端JavaScript中调用：

```javascript
fetch('https://your-domain.vercel.app/?url=https://example.com/feed.xml')
  .then(response => response.text())
  .then(xml => {
    console.log(xml);
  });
```

---

## 错误处理

### 常见错误

**1. URL格式错误**
```
请求: /?url=ftp://example.com/feed.xml
响应: 400 - "无效的URL格式，只支持http/https协议的RSS源"
```

**2. 非RSS内容**
```
请求: /?url=https://example.com/image.png
响应: 500 - "返回的内容不是有效的RSS/XML格式"
```

**3. 源站连接失败**
```
请求: /?url=https://invalid-domain.com/feed.xml
响应: 500 - "抓取RSS失败: getaddrinfo ENOTFOUND"
```

**4. 访问超限**
```
请求: 短时间内超过2次请求
响应: 429 - "访问频率超限，请稍后再试"
```

---

## 安全建议

1. **不要公开分享**: 避免将服务地址公开到互联网
2. **定期更换密码**: 修改 `api/index.js` 中的 `PASSWORD`
3. **监控使用情况**: 定期查看访问历史
4. **设置私有仓库**: GitHub仓库设为Private
5. **遵守条款**: 确保不违反目标网站的使用条款

---

## 自定义配置

编辑 `api/index.js` 修改配置：

```javascript
// 访问密码
const PASSWORD = 'your-new-password';

// 频率限制（次/分钟）
const RATE_LIMIT = 5;

// 限制时间窗口（毫秒）
const RATE_LIMIT_WINDOW = 60 * 1000;

// 缓存时长（毫秒）
const CACHE_TTL = 10 * 60 * 1000; // 10分钟
```

修改后提交代码，Vercel会自动重新部署。

---

## 技术细节

### User-Agent

请求RSS源时使用的User-Agent：
```
Mozilla/5.0 (compatible; Jumper RSS Proxy/1.0)
```

### IP获取

支持以下方式获取客户端真实IP：
1. `x-forwarded-for` 头（取第一个）
2. `x-real-ip` 头
3. `connection.remoteAddress`

### 缓存实现

使用内存Map存储：
```javascript
{
  url: {
    data: '...RSS内容...',
    timestamp: 1700000000000
  }
}
```

注意：Vercel无服务器函数冷启动后缓存会清空。

---

**Happy RSS Reading!** 📰
