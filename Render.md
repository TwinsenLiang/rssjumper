# RSSJumper 部署到 Render 完整指南

## 目录
1. [为什么选择Render](#为什么选择render)
2. [注册Render账号](#注册render账号)
3. [推送代码到GitHub](#推送代码到github)
4. [在Render创建Web Service](#在render创建web-service)
5. [配置环境变量](#配置环境变量)
6. [部署和验证](#部署和验证)
7. [自定义域名（可选）](#自定义域名可选)
8. [故障排查](#故障排查)

---

## 为什么选择Render

- ✅ **免费套餐稳定**：750小时/月的免费运行时间
- ✅ **部署简单**：连接GitHub自动部署
- ✅ **国内访问较好**：相比Vercel，国内访问更稳定
- ✅ **零配置**：自动识别Node.js项目
- ✅ **持续运行**：不像Vercel是serverless，Render是真正的服务器

---

## 注册Render账号

### 步骤1：访问Render官网

打开浏览器访问：**https://render.com**

### 步骤2：注册账号

有两种注册方式：

#### 方式A：使用GitHub账号注册（推荐）

1. 点击 **"Get Started For Free"** 或 **"Sign Up"**
2. 选择 **"Sign up with GitHub"**
3. 授权Render访问你的GitHub账号
4. 完成！

#### 方式B：使用邮箱注册

1. 点击 **"Get Started For Free"**
2. 选择 **"Sign up with Email"**
3. 输入邮箱地址和密码
4. 验证邮箱（检查收件箱点击验证链接）
5. 完成注册

### 步骤3：验证登录

注册完成后，你会看到Render的Dashboard（控制面板）。

---

## 推送代码到GitHub

### 如果项目已经在GitHub

跳过这一步，直接进入[在Render创建Web Service](#在render创建web-service)

### 如果项目还没推送到GitHub

#### 步骤1：创建GitHub仓库

1. 访问 **https://github.com**
2. 点击右上角 **"+"** → **"New repository"**
3. 填写信息：
   - Repository name: `rssjumper`
   - Description: `RSS proxy service for accessing blocked RSS feeds`
   - 选择 **Public** 或 **Private**（免费版Render两者都支持）
4. **不要**勾选 "Initialize this repository with a README"
5. 点击 **"Create repository"**

#### 步骤2：推送本地代码到GitHub

在项目目录执行以下命令：

```bash
# 进入项目目录
cd /Users/twinsenliang/Sites/rssjumper

# 初始化git（如果还没有）
git init

# 添加远程仓库（替换成你的GitHub用户名）
git remote add origin https://github.com/你的用户名/rssjumper.git

# 添加所有文件
git add .

# 提交
git commit -m "迁移到Render：添加server.js和配置文件"

# 推送到GitHub
git push -u origin main
```

如果推送失败提示分支名称问题，尝试：
```bash
git branch -M main
git push -u origin main
```

---

## 在Render创建Web Service

### 步骤1：创建新服务

1. 登录 **https://dashboard.render.com**
2. 点击右上角 **"New +"** 按钮
3. 选择 **"Web Service"**

### 步骤2：连接GitHub仓库

#### 首次连接GitHub

1. 点击 **"Connect GitHub"**
2. 授权Render访问GitHub
3. 选择要授权的仓库：
   - 可以选择 **"All repositories"**（所有仓库）
   - 或选择 **"Only select repositories"**（只选择rssjumper）
4. 点击 **"Install"**

#### 选择仓库

1. 在仓库列表中找到 **rssjumper**
2. 点击 **"Connect"**

### 步骤3：配置服务

填写以下信息：

| 配置项 | 填写内容 | 说明 |
|--------|----------|------|
| **Name** | `rssjumper` | 服务名称，会影响免费域名 |
| **Region** | `Singapore` | 选择新加坡节点（离国内最近） |
| **Branch** | `main` | 代码分支 |
| **Root Directory** | 留空 | 项目根目录 |
| **Environment** | `Node` | 自动检测 |
| **Build Command** | `npm install` | 自动检测 |
| **Start Command** | `npm start` | 自动检测 |

### 步骤4：选择套餐

- 选择 **"Free"** 套餐
- 免费套餐限制：
  - 750小时/月运行时间
  - 512MB内存
  - 如果15分钟没有请求会休眠（下次请求会唤醒，约需要30秒）

### 步骤5：高级设置（可选）

点击 **"Advanced"** 展开高级设置：

- **Auto-Deploy**: 保持开启（代码推送自动部署）
- **Health Check Path**: 填写 `/`（检查服务是否运行）

点击 **"Create Web Service"** 开始部署！

---

## 配置环境变量

### 为什么需要环境变量？

环境变量用于保存敏感信息（如GitHub Token、密码），不会暴露在代码中。

### 步骤1：进入环境变量设置

1. 在服务部署页面，点击左侧导航 **"Environment"**
2. 或等待首次部署完成后再设置

### 步骤2：添加必需的环境变量

点击 **"Add Environment Variable"** 添加以下变量：

#### 必需变量

| Key | Value | 说明 |
|-----|-------|------|
| `GITHUB_TOKEN` | 你的GitHub Token | [如何获取](#获取github-token) |
| `GIST_ID` | 你的Gist ID | [如何获取](#获取gist-id) |
| `PASSWORD` | 设置一个强密码 | 管理后台密码 |

#### 可选变量

| Key | Value | 说明 |
|-----|-------|------|
| `RATE_LIMIT` | `60` | 每分钟请求限制 |
| `NODE_ENV` | `production` | 生产环境标识 |

### 获取GitHub Token

1. 访问 **https://github.com/settings/tokens**
2. 点击 **"Generate new token (classic)"**
3. 填写：
   - Note: `RSSJumper Render`
   - Expiration: `No expiration`（或选择有效期）
   - 勾选权限：**`gist`**（只需要这一个）
4. 点击 **"Generate token"**
5. **复制生成的token**（只显示一次，务必保存！）

### 获取Gist ID

1. 访问 **https://gist.github.com**
2. 点击 **"Create gist"**
3. 填写：
   - Filename: `rssjumper-cache.json`
   - Content: `{}`（只需要两个大括号）
4. 选择 **"Create public gist"** 或 **"Create secret gist"**
5. 创建后，浏览器地址栏的URL最后一段就是Gist ID
   - 例如：`https://gist.github.com/username/abc123def456`
   - Gist ID就是：`abc123def456`

### 步骤3：保存环境变量

添加完所有环境变量后，点击 **"Save Changes"**

服务会自动重新部署以应用新的环境变量。

---

## 部署和验证

### 步骤1：等待部署完成

1. 在 **"Logs"** 标签页可以查看部署日志
2. 看到以下信息说明部署成功：
   ```
   🚀 RSSJumper 服务器已启动
   监听地址: 0.0.0.0:10000
   ```
3. 部署通常需要 1-3 分钟

### 步骤2：获取服务URL

部署成功后，在页面顶部会显示你的服务URL：

```
https://rssjumper.onrender.com
```

（实际URL会根据你的服务名称不同）

### 步骤3：测试服务

#### 测试1：访问首页

在浏览器打开：
```
https://rssjumper.onrender.com
```

应该能看到 RSSJumper 的首页。

#### 测试2：测试RSS代理

访问（以GitHub Blog技术资讯为例）：
```
https://rssjumper.onrender.com/?url=https://github.blog/feed/
```

应该能看到XML格式的RSS内容。

#### 测试3：访问管理后台

1. 访问首页：`https://rssjumper.onrender.com/`
2. 点击页面底部的 **🔒 管理后台** 按钮
3. 输入你设置的密码登录

应该能看到管理后台界面。

---

## 自定义域名（可选）

如果你有自己的域名，可以绑定到Render服务。

### 步骤1：在Render添加域名

1. 在服务页面，点击 **"Settings"**
2. 滚动到 **"Custom Domain"** 部分
3. 点击 **"Add Custom Domain"**
4. 输入你的域名，例如：`rss.yourdomain.com`
5. 点击 **"Save"**

### 步骤2：配置DNS记录

Render会显示需要添加的DNS记录：

| 类型 | 名称 | 值 |
|------|------|-----|
| CNAME | rss | rssjumper.onrender.com |

在你的域名DNS管理面板（如Cloudflare、阿里云等）添加这条记录。

### 步骤3：等待生效

- DNS记录生效通常需要几分钟到几小时
- Render会自动配置HTTPS证书（Let's Encrypt）
- 证书配置完成后，就可以通过 `https://rss.yourdomain.com` 访问了

---

## 故障排查

### 问题1：部署失败

**现象**：部署过程中出现错误

**解决方案**：
1. 检查 **Logs** 查看错误信息
2. 常见原因：
   - `package.json` 配置错误
   - 依赖安装失败：可能是网络问题，重试部署
   - 代码语法错误：检查 `server.js` 是否正确

### 问题2：服务启动失败

**现象**：部署成功但服务无法访问

**解决方案**：
1. 检查 **Environment** 确保环境变量配置正确
2. 检查 **Logs** 查看启动日志
3. 确认 `PORT` 环境变量被正确使用（Render会自动设置）

### 问题3：首次访问很慢

**现象**：打开网站需要等待30秒

**原因**：免费套餐15分钟无请求会休眠

**解决方案**：
1. 升级到付费套餐（$7/月）可保持长期运行
2. 使用监控服务定期访问（如UptimeRobot）保持服务活跃
3. 接受免费版的限制（适合个人使用）

### 问题4：RSS源抓取失败

**现象**：访问代理URL返回错误

**解决方案**：
1. 检查原始RSS源是否可访问
2. 检查 `GITHUB_TOKEN` 和 `GIST_ID` 是否配置正确
3. 查看日志了解具体错误信息

### 问题5：管理后台无法访问

**现象**：输入密码后还是无法进入

**解决方案**：
1. 检查 `PASSWORD` 环境变量是否设置
2. 确认密码输入正确（区分大小写）
3. 查看日志确认密码长度是否被正确识别

### 问题6：国内树莓派无法访问Render

**现象**：树莓派访问 `.onrender.com` 域名打不开

**解决方案**：

**方案A：使用自定义域名**
- 绑定国内可访问的域名
- 使用国内DNS解析

**方案B：使用其他部署平台**
- Railway: https://railway.app
- Fly.io: https://fly.io
- Zeabur: https://zeabur.com（国内友好）

**方案C：本地部署（推荐给树莓派）**
如果Render在树莓派网络环境下不可用，可以考虑：
1. 在有良好网络环境的服务器部署（如国外VPS）
2. 或者在本地Mac运行，树莓派通过局域网访问

---

## 后续维护

### 更新代码

代码推送到GitHub后，Render会自动部署（如果开启了Auto-Deploy）：

```bash
# 修改代码后
git add .
git commit -m "更新说明"
git push
```

### 查看日志

随时在Render Dashboard → Logs 查看服务运行日志

### 监控服务

- Render提供基础的监控（CPU、内存、请求数）
- 可在 **Metrics** 标签页查看

---

## 成本说明

### 免费套餐

- **价格**：$0/月
- **限制**：
  - 750小时/月（约31天）
  - 512MB RAM
  - 15分钟无请求会休眠
  - 共享CPU
- **适合**：个人使用、轻量级应用

### 付费套餐（可选）

- **Starter**: $7/月
  - 持续运行（不休眠）
  - 512MB RAM
  - 0.5 CPU
- **适合**：需要稳定运行的应用

---

## 总结

完成以上步骤后，你的 RSSJumper 就成功部署到 Render 了！

**你的服务地址：**
```
https://rssjumper.onrender.com
```

**在MagicMirror中使用（技术资讯示例）：**
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
        showPublishDate: true
    }
}
```

**遇到问题？**
- 查看[故障排查](#故障排查)部分
- 检查Render的Logs日志
- 访问 Render 官方文档：https://render.com/docs

---

*文档更新时间：2025-11-20*
