# 🦘 RSSJumper - RSS代理服务

一个轻量级的RSS订阅源代理服务，专为MagicMirror智能镜显示技术资讯而设计。

## ⚠️ 重要声明

**本项目仅供开发者学习和获取互联网技术资讯使用，禁止用于其他用途。**

- ✅ **适用场景**：MagicMirror等智能家居设备显示技术新闻（如GitHub Blog、Hacker News等）
- ✅ **合法用途**：学习RSS代理技术、获取开发者技术资讯
- ❌ **禁止用途**：访问新闻媒体、政治内容、侵犯版权内容
- ⚖️ **免责声明**：使用本工具产生的任何法律责任由使用者自行承担

**请遵守当地法律法规，仅用于技术学习和开发目的。**

## ✨ 功能特性

### 🎯 核心功能
- ✅ **RSS代理服务**: 突破网络限制，访问被阻挡的RSS订阅源
- ✅ **广泛兼容**: 支持所有标准RSS/Atom格式

### ⚡ 性能优化
- ✅ **智能缓存系统**: 15分钟GitHub Gist缓存，减少源服务器压力
- ✅ **异步处理**: 缓存写入和访问记录保存不阻塞主请求
- ✅ **快速响应**: 缓存命中时毫秒级响应
- ✅ **跨实例共享**: 所有部署实例共享同一份缓存

### 🛡️ 安全防护
- ✅ **IP频率限制**: 可配置限流（默认60次/分钟），防止滥用
- ✅ **自动封禁机制**: 超限IP自动封禁5分钟，持久化存储
- ✅ **URL黑名单**: 支持禁用特定RSS源
- ✅ **SSRF防护**: 阻止访问内网地址，防止安全漏洞
- ✅ **协议限制**: 仅支持http/https，拒绝其他协议

### 📊 管理功能
- ✅ **完整管理后台**: 密码保护的管理界面
- ✅ **访问统计**: 按日统计每个RSS源的访问次数
- ✅ **黑名单管理**: 一键加黑/解绑RSS源
- ✅ **缓存管理**: 查看所有缓存文件状态
- ✅ **实时监控**: 30秒自动刷新数据

### 🚀 部署优势
- ✅ **多平台支持**: Vercel无服务器 + Render传统服务器
- ✅ **零数据库**: 使用GitHub Gist作为免费持久化存储
- ✅ **环境变量配置**: 灵活配置密码、限流等参数
- ✅ **完全免费**: 可使用免费服务运行

### 💎 用户体验
- ✅ **简洁UI**: 渐变色设计，现代化界面
- ✅ **友好错误**: RSS格式错误信息，便于调试
- ✅ **详细日志**: 便于问题诊断和性能分析

## 🚀 快速开始

### 部署方式（推荐Render）

**推荐方案：Render部署**
- ✅ 免费750小时/月
- ✅ 国内访问稳定
- ✅ 持续运行服务
- 📖 详细教程：[Render部署指南](./Render.md)

**备选方案：Vercel部署**
- ✅ Serverless架构
- ✅ 全球CDN加速
- ✅ 按需运行
- 📖 详细教程：见下文[Vercel部署](#部署到vercel完全免费)

### 使用方法

访问你的部署地址，并通过 `url` 参数传递RSS源：

```bash
# Render部署示例（以GitHub Blog技术资讯为例）
https://rssjumper.onrender.com/?url=https://github.blog/feed/

# Vercel部署示例（以GitHub Blog技术资讯为例）
https://rssjumper.vercel.app/?url=https://github.blog/feed/
```

### 管理后台

访问管理后台需要通过安全的Token认证方式：

**访问步骤：**
1. 访问首页
2. 点击页面底部的 **🔒 管理后台** 按钮
3. 在弹出的登录框中输入密码
4. 登录成功后自动跳转到管理后台页面

**安全特性：**
- ✅ 基于Token的身份验证（POST请求，非URL密码参数）
- ✅ Token有效期1小时，自动过期
- ✅ 自动清理过期Token，防止未授权访问
- ✅ 密码通过环境变量配置，不暴露在代码中

管理后台功能：

**访问历史管理**
- 查看所有被代理的RSS源地址
- 显示每个源的今日访问次数（每天自动重置）
- 显示首次访问时间、最后访问时间
- 一键加入/移除黑名单
- 黑名单实时同步到Gist，跨实例生效

**缓存文件管理**
- 查看所有缓存的RSS文件
- 显示缓存文件大小、缓存时间、缓存年龄
- 四色缓存状态系统：
  - 🟢 新鲜（Fresh）：缓存在有效期内
  - 🔵 普通（Normal）：缓存超过一半有效期，可点击刷新
  - 🟡 旧（Stale）：缓存已过期但可用，可点击刷新
  - 🔴 失效（Unavailable）：RSS源不可访问，可点击刷新重试
- 手动刷新缓存：点击状态按钮立即拉取最新RSS内容
- 一键清除缓存：删除指定RSS源的缓存文件

**数据持久化**
- 所有数据存储在GitHub Gist
- 支持跨实例共享数据（Render/Vercel均可）
- 访问历史自动累计，不会丢失

## 🌐 免费域名申请与绑定

使用免费域名可以让你的RSS代理服务拥有更易记的访问地址，而不是使用平台默认域名（如`*.onrender.com`或`*.vercel.app`）。以下是两个推荐的稳定免费域名服务。

### 方案一：FreeDNS (afraid.org) - 推荐首选

**优势：** 老牌服务，稳定可靠，注册快速，无需审批

#### 1. 注册FreeDNS账号

1. 访问 [https://freedns.afraid.org](https://freedns.afraid.org)
2. 点击右上角 **Sign Up** 注册账号
3. 填写用户名、邮箱、密码
4. 检查邮箱，点击确认链接激活账号

#### 2. 申请免费子域名

1. 登录后，点击顶部菜单 **Subdomains** → **Add**
2. 选择一个公共域名（推荐选择）：
   - `mooo.com` - 适合个人项目
   - `chickenkiller.com` - 创意域名
   - `servehttp.com` - 适合web服务
   - `web.app` - 现代化域名
3. 在 **Subdomain** 输入框填写你想要的子域名，例如：`myrss`
4. 在 **Destination** 填写你的Vercel域名（稍后获取）
5. 类型选择 **CNAME**
6. 点击 **Save!** 完成创建

**示例：** 如果你选择 `mooo.com` 并输入 `myrss`，你的域名将是：`myrss.mooo.com`

#### 3. 配置DNS记录（稍后在Vercel绑定后完成）

DNS记录会自动生效，通常在几分钟内即可访问。

### 方案二：is-a.dev - 面向开发者

**优势：** 专业的开发者域名，完全免费，基于GitHub管理

#### 1. 前置要求

- GitHub账号
- 基本的Git操作知识

#### 2. 申请.is-a.dev域名

1. 访问 [https://github.com/is-a-dev/register](https://github.com/is-a-dev/register)
2. Fork该仓库到你的GitHub账号
3. 在你的Fork仓库中，进入 `domains` 文件夹
4. 创建一个新文件，文件名为你想要的域名，例如：`myrss.json`
5. 文件内容格式：

```json
{
  "description": "My RSS Proxy Service",
  "repo": "https://github.com/你的用户名/rssjumper",
  "owner": {
    "username": "你的GitHub用户名",
    "email": "你的邮箱"
  },
  "record": {
    "CNAME": "你的vercel域名.vercel.app"
  }
}
```

6. 提交更改并创建 Pull Request
7. 等待审核（通常1-3天），批准后域名即可使用

**示例：** 文件名 `myrss.json` 将创建域名 `myrss.is-a.dev`

### 绑定自定义域名到部署平台

完成上述任一免费域名申请后，需要在部署平台中绑定：

#### 在Render绑定（推荐）

详细步骤请参考：[Render部署指南 - 自定义域名](./Render.md#自定义域名可选)

**简要步骤：**
1. 在Render服务页面 → Settings → Custom Domain
2. 添加你的域名（如 `myrss.mooo.com`）
3. 在FreeDNS中配置CNAME指向 `rssjumper.onrender.com`
4. 等待DNS生效（5-30分钟）
5. Render自动配置HTTPS证书

#### 在Vercel绑定（备选）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入项目 → Settings → Domains
3. 添加你的域名（如 `myrss.mooo.com`）
4. 在FreeDNS中配置CNAME指向 `cname.vercel-dns.com`
5. 等待DNS生效

**验证绑定成功：**
```bash
# 测试访问
https://myrss.mooo.com

# 测试RSS代理（以GitHub Blog技术资讯为例）
https://myrss.mooo.com/?url=https://github.blog/feed/
```

### 域名配置故障排查

#### 问题1：DNS未生效

**症状：** 访问域名显示"DNS_PROBE_FINISHED_NXDOMAIN"

**解决方法：**
1. 检查域名DNS配置是否正确
2. 等待更长时间（最多48小时）
3. 使用DNS检测工具：[https://dnschecker.org](https://dnschecker.org)

#### 问题2：Vercel提示"Invalid Configuration"

**症状：** Vercel显示域名配置无效

**解决方法：**
1. 确认CNAME记录指向 `cname.vercel-dns.com`
2. 删除任何A记录（只保留CNAME）
3. 等待5-10分钟后重新检查

#### 问题3：证书错误

**症状：** 访问时显示HTTPS证书错误

**解决方法：**
1. Vercel会自动颁发SSL证书，通常需要几分钟
2. 在Vercel的 **Settings** → **Domains** 中检查SSL状态
3. 如果超过1小时仍未生效，尝试删除域名重新添加

### 域名管理建议

1. **定期检查：** 每3个月检查一次域名和服务是否正常
2. **备份配置：** 记录你的域名和DNS配置
3. **多个域名：** 可以同时绑定多个免费域名作为备份
4. **邮箱验证：** 确保域名服务的注册邮箱始终有效

## 📦 部署到Render（推荐方案）

**详细部署指南请参考：[Render.md](./Render.md)**

Render提供750小时/月的免费运行时间，国内访问稳定，适合长期运行的RSS代理服务。

---

## 📦 部署到Vercel（备选方案）

Vercel提供Serverless架构，按需运行，全球CDN加速。以下是简要部署步骤：

### 前置要求

1. GitHub账号
2. Vercel账号（可用GitHub登录）
3. Node.js（本地测试可选）

### 步骤1: 注册Vercel

1. 访问 [https://vercel.com](https://vercel.com)
2. 点击右上角 **Sign Up**
3. 选择 **Continue with GitHub** 使用GitHub账号登录
4. 授权Vercel访问你的GitHub仓库

### 步骤2: 准备代码

#### 方式A: 使用现有代码（推荐）

1. 将rssjumper项目推送到GitHub：

```bash
cd /Users/twinsenliang/Sites/rssjumper
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

2. 在GitHub创建新仓库（不要初始化README）：
   - 访问 https://github.com/new
   - 仓库名: `rssjumper`
   - 设置为 **Private**（私有，保护你的代码）
   - 点击 **Create repository**

3. 推送代码：

```bash
git remote add origin https://github.com/你的用户名/rssjumper.git
git push -u origin main
```

#### 方式B: 直接在Vercel导入

如果不想使用GitHub，可以直接上传文件到Vercel（需要安装Vercel CLI）。

### 步骤3: 在Vercel部署

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New** → **Project**
3. 选择 **Import Git Repository**
4. 找到你的 `rssjumper` 仓库，点击 **Import**
5. 配置项目：
   - **Framework Preset**: 选择 `Other`
   - **Root Directory**: 保持默认 `./`
   - **Build Command**: 留空
   - **Output Directory**: 留空
6. 点击 **Deploy**

### 步骤4: 等待部署完成

- 大约需要30-60秒
- 部署成功后会显示一个类似 `https://jumper-xxxx.vercel.app` 的地址
- 这就是你的RSS代理服务地址

### 步骤5: 测试服务

访问你的域名测试：

```bash
# 访问首页（查看使用说明）
https://your-domain.vercel.app/

# 测试代理RSS（以GitHub Blog技术资讯为例）
https://your-domain.vercel.app/?url=https://github.blog/feed/

# 访问管理后台（点击首页的"管理后台"按钮，输入密码登录）
https://your-domain.vercel.app/
```

## 🔧 本地开发测试（可选）

如果想在本地测试，按以下步骤：

1. **安装依赖**：

```bash
cd /Users/twinsenliang/Sites/rssjumper
npm install
```

2. **安装Vercel CLI**：

```bash
npm install -g vercel
```

3. **本地运行**：

```bash
vercel dev
```

4. **访问测试**：

打开浏览器访问 `http://localhost:3000`

## 🌐 其他免费部署平台

如果Vercel不可用，还可以选择以下平台：

### 1. Cloudflare Workers（推荐备选）

- 免费额度: 100,000次/天
- 全球CDN
- 部署教程: [workers.cloudflare.com](https://workers.cloudflare.com)

### 2. Railway

- 免费额度: $5/月
- 支持多种语言
- 网址: [railway.app](https://railway.app)

### 3. Render

- 免费tier（有限制）
- 支持自动部署
- 网址: [render.com](https://render.com)

### 4. Fly.io

- 免费额度: 3个共享CPU
- 全球部署
- 网址: [fly.io](https://fly.io)

## ⚙️ 自定义配置

### 配置管理后台密码

管理后台密码用于Token身份验证，必须通过环境变量配置。

**在Render配置（推荐）：**
1. 进入Render Dashboard → 你的服务 → Environment
2. 添加：`PASSWORD` = `你的强密码`
3. 点击 Save Changes，服务自动重新部署

**在Vercel配置（备选）：**
1. 进入Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 添加：`PASSWORD` = `你的强密码`
3. 重新部署项目生效

**重要提示：**
- ⚠️ 未配置 `PASSWORD` 环境变量时，管理后台将无法访问
- ✅ 密码用于生成访问Token（有效期1小时）
- ✅ 不建议在代码中硬编码密码

### 本地测试环境变量配置

也可以复制 `.env.example` 为 `.env` 并修改（仅用于本地测试）：

```bash
cp .env.example .env
# 编辑 .env 文件，添加以下配置：
# PASSWORD=你的密码
# RATE_LIMIT=5
# CACHE_TTL=900000
```

**支持的环境变量列表：**

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `PASSWORD` | 管理后台Token认证密码 | 无 | ✅ 是 |
| `GITHUB_TOKEN` | GitHub Personal Access Token (gist权限) | 无 | ✅ 是 |
| `GIST_ID` | 存储数据的Gist ID | 无 | ✅ 是 |
| `RATE_LIMIT` | 每分钟请求次数限制 | 60 | ❌ 否 |
| `CACHE_TTL` | 缓存时长（毫秒） | 900000 (15分钟) | ❌ 否 |

**GitHub Gist存储的数据：**
- 访问记录（rssjumper-access-log.json）- 每日统计
- 黑名单（rssjumper-blacklist.json）- 实时同步
- 封禁IP列表（rssjumper-banned-ips.json）- 自动过期
- RSS缓存文件（rss-cache-*.json）- 15分钟TTL

注意：`.env` 文件仅在本地开发时生效，Render/Vercel部署需要在平台Dashboard中配置环境变量。

### 修改频率限制

**方法1：使用环境变量（推荐）**

在Vercel项目设置中添加环境变量：
1. 进入Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 添加：`RATE_LIMIT` = `100`（表示每分钟最多100次访问）
3. 重新部署项目生效

**频率限制说明：**
- 默认值：60次/分钟
- 超限处理：超过限制的IP将被封禁5分钟
- 封禁存储：封禁IP存储在Gist，跨实例生效
- 自动解封：5分钟后自动解除封禁

### 修改缓存时间

**方法1：使用环境变量（推荐）**

在Vercel项目设置中添加环境变量：
1. 进入Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 添加：`CACHE_TTL` = `1200000`（单位：毫秒，1200000 = 20分钟）
3. 重新部署项目生效

### 缓存机制说明

RSSJumper使用GitHub Gist智能缓存机制：

1. **缓存位置**: GitHub Gist（云端存储，跨实例共享）
2. **缓存时长**: 默认15分钟（900000毫秒），可通过CACHE_TTL环境变量配置
3. **缓存文件名**: `rss-cache-{URL的MD5哈希}.json`
4. **缓存策略**:
   - 缓存未过期时直接返回缓存内容（响应头 `X-RSSJumper-Cache: HIT`）
   - 缓存过期后重新获取并异步更新缓存（响应头 `X-RSSJumper-Cache: MISS`）
5. **缓存优势**:
   - 永久存储，不会因实例回收而丢失
   - 跨实例共享，所有请求都能命中缓存
   - 异步更新，不阻塞响应
6. **错误处理**: 如果源站无法访问，返回RSS格式的错误信息

### 数据持久化说明

RSSJumper使用GitHub Gist作为永久存储方案：

**存储的数据：**
- ✅ **访问记录**：每个RSS源的访问次数、首次/最后访问时间、每日访问统计
- ✅ **黑名单**：禁用的RSS源URL列表
- ✅ **封禁IP**：频率限制触发的IP封禁列表（自动过期）
- ✅ **RSS缓存**：缓存的RSS内容（15分钟过期）

**技术优势：**
- ✅ **永久保存**：数据存储在GitHub，不会因实例回收而丢失
- ✅ **跨实例共享**：所有Vercel函数实例共享同一份数据
- ✅ **完全免费**：GitHub Gist免费，API限额充足（5000次/小时）
- ✅ **异步保存**：写入操作不阻塞响应，保证性能
- ✅ **数据合并**：访问记录自动累计，防止并发覆盖

**配置要求：**
- 必须配置 `GITHUB_TOKEN` 和 `GIST_ID` 环境变量
- 未配置时服务仍可运行，但数据仅保存在内存中（实例回收后丢失）

### 配置修改后如何生效

**如果修改环境变量：**
1. 在Vercel Dashboard中修改环境变量后
2. 点击项目的 **Deployments** 标签
3. 点击最新部署右侧的三个点 → **Redeploy**
4. 或者等待下次代码提交时自动部署

**如果修改代码：**

```bash
git add .
git commit -m "Update config"
git push
```

Vercel会自动重新部署。

## 📊 Vercel免费额度说明

Vercel免费计划（Hobby Plan）包括：

- ✅ 每月100GB带宽
- ✅ 无限请求次数
- ✅ 100个部署/天
- ✅ 无服务器函数：每月100GB-Hours
- ✅ 自动HTTPS
- ✅ 自动CDN

对于个人RSS代理使用，完全足够！

## 🛡️ 安全说明

1. **密码保护**: 管理后台访问需要配置PASSWORD环境变量
2. **SSRF防护**: 禁止访问内网地址（localhost、127.0.0.1、192.168.x.x、10.x.x.x等）
3. **协议限制**: 仅支持http/https协议，拒绝其他协议
4. **频率限制**: 可配置的每分钟请求限制（默认60次），超限自动封禁5分钟
5. **IP封禁持久化**: 封禁IP存储在Gist，跨实例生效
6. **URL验证**: 严格验证URL格式，防止恶意请求
7. **私有仓库**: 建议将GitHub仓库设为私有，保护环境变量

## 🔍 故障排查

### 部署失败

1. 检查 `package.json` 和 `vercel.json` 文件是否正确
2. 查看Vercel部署日志中的错误信息
3. 确认文件结构正确：
   ```
   jumper/
   ├── api/
   │   └── index.js
   ├── package.json
   ├── vercel.json
   └── README.md
   ```

### 访问返回500错误

1. 检查目标RSS源是否可访问
2. 查看Vercel函数日志（Dashboard → Functions → Logs）
3. 确认URL参数格式正确

### 频率限制问题

如果遇到429错误（Too Many Requests）：
1. **等待5分钟**：IP被封禁后需要等待5分钟自动解封
2. **检查访问频率**：默认限制为60次/分钟
3. **多设备共享IP**：如果多个设备共享同一公网IP，可能更容易触发限制
4. **调整限制**：可以通过配置 `RATE_LIMIT` 环境变量调高限制

**错误响应示例：**
```json
{
  "error": "请求过于频繁",
  "message": "您的IP已被暂时封禁，请稍后再试"
}
```

## 🪞 MagicMirror集成

本项目专为MagicMirror智能镜设计，用于在镜面上显示技术资讯。

### 配置示例

在MagicMirror的`config/config.js`中配置newsfeed模块：

```javascript
{
    module: "newsfeed",
    position: "bottom_bar",
    config: {
        feeds: [
            {
                title: "GitHub Blog",
                url: "https://rssjumper.onrender.com/?url=https://github.blog/feed/"
            },
            {
                title: "Hacker News",
                url: "https://rssjumper.onrender.com/?url=https://hnrss.org/frontpage"
            }
        ],
        showSourceTitle: true,
        showPublishDate: true,
        broadcastNewsFeeds: true,
        broadcastNewsUpdates: true
    }
}
```

### 推荐技术RSS源

- **GitHub Blog**: `https://github.blog/feed/` - GitHub官方技术博客
- **Hacker News**: `https://hnrss.org/frontpage` - 技术新闻聚合
- **Dev.to**: `https://dev.to/feed` - 开发者社区
- **CSS-Tricks**: `https://css-tricks.com/feed/` - 前端技术
- **Smashing Magazine**: `https://www.smashingmagazine.com/feed/` - Web设计与开发

## 📝 使用限制

1. ✅ **仅用于技术RSS源**：GitHub、Stack Overflow、开发者博客等技术内容
2. ❌ **禁止访问新闻媒体**：不得用于政治新闻、时事报道等内容
3. ⚖️ **遵守法律法规**：请遵守当地法律及目标网站的robots.txt和使用条款
4. 🏠 **个人使用**：适合个人学习和家庭智能设备，不要分享给太多人使用
5. 💰 **非商业用途**：仅供学习和个人使用，禁止商业化

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**享受无阻碍的RSS订阅体验！** 🎉
