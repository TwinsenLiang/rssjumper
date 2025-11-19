# 🦘 RSSJumper - RSS代理服务

一个轻量级的RSS订阅源代理服务，用于访问被阻挡的RSS订阅源。

## ✨ 功能特性

- ✅ **RSS代理**: 通过URL参数代理访问任何RSS订阅源
- ✅ **频率限制**: 单个IP限制为2次/分钟，防止滥用
- ✅ **文件缓存**: 15分钟内相同源不重复请求，使用文件系统缓存，减少服务器压力
- ✅ **网络容错**: 15秒超时设置，处理网络延时情况
- ✅ **错误提示**: 以RSS格式返回错误信息，便于调试和问题定位
- ✅ **管理后台**: Tailwind CSS设计的美观管理界面，支持访问历史和缓存管理
- ✅ **黑名单功能**: 禁用特定URL，被禁用的URL以RSS格式返回错误信息
- ✅ **缓存管理**: 查看和清除缓存文件，实时监控缓存状态
- ✅ **访问统计**: 记录每个RSS源的访问次数和时间
- ✅ **安全验证**: 仅处理RSS/XML格式，拒绝其他文件类型，防止SSRF攻击
- ✅ **免费部署**: 完全基于Vercel免费额度

## 🚀 快速开始

### 使用方法

访问你的部署地址，并通过 `url` 参数传递RSS源：

```
https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml
```

### 管理后台

使用密码参数访问管理后台，查看和管理RSS代理服务：

```
https://your-domain.vercel.app/api/admin?password=[你的密码]
```

管理后台功能：

**访问历史管理**
- 查看所有被代理的RSS源地址
- 显示每个源的访问次数、首次访问时间、最后访问时间
- 禁用特定URL（黑名单功能）
- 已禁用的URL会以RSS格式返回错误提示

**缓存文件管理**
- 查看所有缓存的RSS文件
- 显示缓存文件大小、缓存时间、缓存年龄
- 清除特定URL的缓存
- 查看缓存是否过期

管理后台使用Tailwind CSS设计，界面美观易用。

## 🌐 免费域名申请与绑定

使用免费域名可以让你的RSS代理服务拥有更易记的访问地址，而不是使用Vercel默认的随机域名。以下是两个推荐的稳定免费域名服务。

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

### 在Vercel绑定自定义域名

完成上述任一免费域名申请后，需要在Vercel中绑定：

#### 步骤1：获取Vercel项目域名

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入你的 `rssjumper` 项目
3. 点击顶部 **Settings** → **Domains**
4. 你会看到默认域名，类似：`rssjumper-xxxx.vercel.app`

#### 步骤2：添加自定义域名

1. 在 **Domains** 页面，找到 **Add Domain** 输入框
2. 输入你申请的免费域名，例如：
   - `myrss.mooo.com` (FreeDNS)
   - `myrss.is-a.dev` (is-a.dev)
3. 点击 **Add**

#### 步骤3：验证域名配置

Vercel会显示DNS配置要求：

**对于FreeDNS：**
1. 回到 FreeDNS 网站
2. 进入 **Subdomains** → 找到你的域名
3. 点击 **Edit**
4. 在 **Destination** 填写 `cname.vercel-dns.com`
5. 保存更改

**对于is-a.dev：**
- 在你的PR中已经配置了CNAME，等待DNS生效即可

#### 步骤4：等待DNS生效

1. DNS传播通常需要 **5分钟 - 48小时**
2. FreeDNS通常 **5-30分钟** 即可生效
3. is-a.dev通常在PR合并后 **1-2小时** 生效

#### 步骤5：验证绑定成功

1. 在Vercel的 **Domains** 页面，你的域名旁边会显示 **✓ Valid Configuration**
2. 访问你的自定义域名测试：

```bash
# 测试访问
https://myrss.mooo.com

# 测试RSS代理
https://myrss.mooo.com/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml
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

## 📦 部署到Vercel（完全免费）

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

# 测试代理RSS
https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml

# 访问管理后台
https://your-domain.vercel.app/api/admin?password=[你的密码]
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

### 修改访问密码

**方法1：使用环境变量（推荐）**

在Vercel项目设置中添加环境变量：
1. 进入Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 添加：`PASSWORD` = `你的新密码`
3. 重新部署项目生效

**方法2：直接修改代码**

编辑 `api/index.js` 文件第9行：

```javascript
const PASSWORD = process.env.PASSWORD || '你的新密码'; // 请修改为您的密码
```

**本地测试环境变量配置**

也可以复制 `.env.example` 为 `.env` 并修改（仅用于本地测试）：

```bash
cp .env.example .env
# 编辑 .env 文件，添加以下配置：
# PASSWORD=你的密码
# RATE_LIMIT=5
# CACHE_TTL=900000
```

**支持的环境变量列表：**
- `PASSWORD` - 访问历史查看密码
- `RATE_LIMIT` - 每分钟访问次数限制（默认：2）
- `CACHE_TTL` - 缓存时长，单位毫秒（默认：900000，即15分钟）
- `CACHE_DIR` - 缓存目录路径（默认：`/tmp/rssjumper-cache`）

**GitHub Gist持久化存储（可选，推荐）：**
- `GITHUB_TOKEN` - GitHub Personal Access Token（需要gist权限）
- `GIST_ID` - 存储数据的Gist ID
- `GIST_ACCESS_LOG_FILE` - 访问历史文件名（默认：rssjumper-access-log.json）
- `GIST_BLACKLIST_FILE` - 黑名单文件名（默认：rssjumper-blacklist.json）

**详细配置说明请查看：[GIST_SETUP.md](GIST_SETUP.md)**

注意：`.env` 文件仅在本地开发时生效，Vercel部署需要在Dashboard中配置环境变量。

### 修改频率限制

**方法1：使用环境变量（推荐）**

在Vercel项目设置中添加环境变量：
1. 进入Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 添加：`RATE_LIMIT` = `5`（表示每分钟最多5次访问）
3. 重新部署项目生效

**方法2：直接修改代码**

编辑 `api/index.js` 文件第10行：

```javascript
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 5; // 改为5次/分钟
```

### 修改缓存时间

**方法1：使用环境变量（推荐）**

在Vercel项目设置中添加环境变量：
1. 进入Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 添加：`CACHE_TTL` = `900000`（单位：毫秒，900000 = 15分钟）
3. 重新部署项目生效

**方法2：直接修改代码**

编辑 `api/index.js` 文件第14行：

```javascript
const CACHE_TTL = 20 * 60 * 1000; // 改为20分钟
```

### 缓存机制说明

RSSJumper使用文件系统缓存机制：

1. **缓存位置**: `/tmp/rssjumper-cache/` 目录（Vercel环境）
2. **缓存时长**: 默认15分钟，可通过环境变量配置
3. **缓存文件名**: 使用URL的MD5哈希值作为文件名
4. **缓存更新**:
   - 缓存未过期时直接返回缓存内容（响应头 `X-RSSJumper-Cache: HIT`）
   - 缓存过期后重新获取并更新缓存（响应头 `X-RSSJumper-Cache: MISS`）
5. **错误处理**: 如果源站无法访问，返回RSS格式的错误信息

### 数据持久化说明

**重要**：Vercel serverless函数的`/tmp`目录会在函数实例回收时清空，导致访问历史和黑名单丢失。

**解决方案**：使用GitHub Gist永久存储数据

- ✅ **永久保存**：数据存储在GitHub，不会丢失
- ✅ **跨实例共享**：所有函数实例共享同一份数据
- ✅ **完全免费**：GitHub Gist免费，API限额充足（5000次/小时）
- ✅ **性能优化**：60秒防抖批量保存，避免频繁API调用

**配置方法**：参见 [GIST_SETUP.md](GIST_SETUP.md) 详细教程

**不配置的影响**：
- 访问历史可能在函数冷启动后丢失（低流量时更频繁）
- 黑名单可能丢失
- RSS缓存不受影响（缓存文件会保留更久）

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

1. **密码保护**: 访问历史查看功能需要密码
2. **格式验证**: 仅允许RSS/XML格式，拒绝其他文件
3. **频率限制**: 防止单个IP滥用
4. **协议限制**: 仅支持http/https协议
5. **私有仓库**: 建议将GitHub仓库设为私有

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

如果频繁遇到429错误：
1. 等待1分钟后重试
2. 检查是否有多个设备共享同一IP
3. 可以适当调高 `RATE_LIMIT` 配置

## 📝 使用限制

1. 仅用于访问RSS订阅源
2. 请遵守目标网站的robots.txt和使用条款
3. 不要用于商业用途
4. 不要分享给太多人使用（避免超出免费额度）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**享受无阻碍的RSS订阅体验！** 🎉
