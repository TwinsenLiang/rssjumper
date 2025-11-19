# 🚀 快速部署指南（5分钟搞定）

## 最简单的方式：一键部署

点击下方按钮直接部署到Vercel（需要GitHub账号）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/rssjumper)

## 手动部署步骤

### 1️⃣ 注册Vercel（1分钟）

- 访问 https://vercel.com
- 点击 "Sign Up"
- 选择 "Continue with GitHub"
- 授权登录

### 2️⃣ 上传代码到GitHub（2分钟）

在项目目录执行：

```bash
cd /Users/twinsenliang/Sites/rssjumper

# 初始化Git
git init
git add .
git commit -m "Initial commit"
git branch -M main

# 在GitHub创建仓库后，替换下方URL
git remote add origin https://github.com/你的用户名/rssjumper.git
git push -u origin main
```

**创建GitHub仓库**：
1. 访问 https://github.com/new
2. 仓库名输入: `rssjumper`
3. 选择 "Private"（私有）
4. 点击 "Create repository"
5. 复制仓库URL替换上方命令

### 3️⃣ 在Vercel部署（2分钟）

1. 登录 https://vercel.com/dashboard
2. 点击 **"Add New"** → **"Project"**
3. 点击 **"Import Git Repository"**
4. 选择你的 `rssjumper` 仓库
5. 点击 **"Import"**
6. 配置保持默认，直接点击 **"Deploy"**
7. 等待30秒，部署完成！

### 4️⃣ 测试使用

复制Vercel给你的域名（类似 `https://jumper-xxx.vercel.app`），测试：

```
# 查看首页
https://你的域名.vercel.app/

# 测试代理
https://你的域名.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml

# 查看历史（密码: [你的密码]）
https://你的域名.vercel.app/?password=[你的密码]
```

## 🎉 完成！

现在你可以在RSS阅读器中使用这个地址了！

## 💡 提示

- Vercel免费版完全够用
- 每次提交代码到GitHub，Vercel会自动重新部署
- 想修改配置？编辑 `api/index.js` 然后提交即可

## 🆘 遇到问题？

1. **部署失败**: 检查文件结构是否完整
2. **访问报错**: 查看Vercel Dashboard的日志
3. **被限流**: 等待1分钟后重试

详细文档请查看 [README.md](./README.md)
