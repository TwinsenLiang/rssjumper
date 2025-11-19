# 🦘 RSSJumper - RSS代理服务

一个轻量级的RSS订阅源代理服务，用于访问被阻挡的RSS订阅源。

## ✨ 功能特性

- ✅ **RSS代理**: 通过URL参数代理访问任何RSS订阅源
- ✅ **频率限制**: 单个IP限制为2次/分钟，防止滥用
- ✅ **智能缓存**: 5分钟内相同源不重复请求，减少服务器压力
- ✅ **访问历史**: 记录所有被代理的RSS源（带密码保护）
- ✅ **安全验证**: 仅处理RSS/XML格式，拒绝其他文件类型
- ✅ **免费部署**: 完全基于Vercel免费额度

## 🚀 快速开始

### 使用方法

访问你的部署地址，并通过 `url` 参数传递RSS源：

```
https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml
```

### 查看访问历史

使用密码参数查看所有被代理过的RSS源：

```
https://your-domain.vercel.app/?password=[你的密码]
```

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

# 查看访问历史
https://your-domain.vercel.app/?password=[你的密码]
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

**配置文件方式**

也可以复制 `.env.example` 为 `.env` 并修改：

```bash
cp .env.example .env
# 编辑 .env 文件中的配置
```

### 修改频率限制

编辑 `api/index.js` 文件第12-13行：

```javascript
const RATE_LIMIT = 5; // 改为5次/分钟
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟（60000毫秒）
```

### 修改缓存时间

编辑 `api/index.js` 文件第14行：

```javascript
const CACHE_TTL = 10 * 60 * 1000; // 改为10分钟
```

修改后需要重新部署：

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
