# GitHub Gist持久化配置指南

## 配置完成后的优势

✓ **永久保存**：访问历史和黑名单永久存储在GitHub
✓ **跨实例共享**：所有Vercel函数实例共享同一份数据
✓ **免费**：GitHub Gist完全免费
✓ **安全**：Private Gist只有您可以访问

## GitHub API Rate Limit

- **认证请求**：5000次/小时
- **本项目优化**：
  - 访问历史：60秒防抖批量保存（每小时最多60次）
  - 黑名单：立即保存（操作不频繁）
  - 启动加载：每次冷启动1次（约每小时1-3次）
  - **预计用量**：每小时 < 70次 API调用
  - **剩余额度**：5000 - 70 = 4930次/小时（充足）

## 配置步骤

### 1. 创建GitHub Personal Access Token

1. 访问：https://github.com/settings/tokens
2. 点击 **Generate new token** → **Generate new token (classic)**
3. 配置token：
   ```
   Note: RSSJumper Storage
   Expiration: No expiration（或选择较长时间）
   Scopes: 只勾选 ✓ gist
   ```
4. 点击 **Generate token**
5. **立即复制token**（格式：ghp_xxxxxxxxxxxxxxxxxxxx）
   ⚠️ 只显示一次，复制后保存到安全地方

### 2. 创建Private Gist

1. 访问：https://gist.github.com/
2. 点击右上角 **+** → **New gist**
3. 创建两个文件：

   **文件1**:
   ```
   Filename: rssjumper-access-log.json
   Content: {}
   ```

   **文件2**:
   ```
   Filename: rssjumper-blacklist.json
   Content: []
   ```

4. 选择 **Create secret gist**（私有Gist）
5. 创建后，从URL复制Gist ID：
   ```
   https://gist.github.com/你的用户名/abc123def456
                                      ↑
                                  这就是GIST_ID
   ```

### 3. 配置Vercel环境变量

1. 访问：Vercel Dashboard → 你的rssjumper项目
2. 点击 **Settings** → **Environment Variables**
3. 依次添加以下4个变量：

   | Name | Value | Environments |
   |------|-------|--------------|
   | `GITHUB_TOKEN` | `ghp_你的token` | Production, Preview, Development |
   | `GIST_ID` | `你的gist_id` | Production, Preview, Development |
   | `GIST_ACCESS_LOG_FILE` | `rssjumper-access-log.json` | Production, Preview, Development |
   | `GIST_BLACKLIST_FILE` | `rssjumper-blacklist.json` | Production, Preview, Development |

4. 点击 **Save**

### 4. 重新部署

配置环境变量后，Vercel会自动重新部署。或手动触发：

```bash
git commit --allow-empty -m "触发重新部署"
git push origin main
```

### 5. 验证配置

部署完成后，访问管理后台查看Vercel日志：

1. Vercel Dashboard → 你的项目 → **Deployments**
2. 点击最新部署 → **Function Logs**
3. 查找以下日志确认成功：
   ```
   已从Gist加载 X 条访问历史
   已从Gist加载 X 条黑名单
   已同步 rssjumper-access-log.json 到Gist
   ```

## 数据同步机制

### 启动时（冷启动）
```
Vercel函数启动
    ↓
从Gist读取历史数据（1次API调用）
    ↓
加载到内存Map/Set
```

### 运行时（RSS访问）
```
访问RSS
    ↓
更新内存中的accessLog
    ↓
标记dataChanged = true
    ↓
60秒后批量保存到Gist（1次API调用）
```

### 管理操作（黑名单）
```
添加/删除黑名单
    ↓
立即保存到Gist（1次API调用）
    ↓
响应成功
```

## 故障排查

### 问题1：Vercel日志显示"GitHub Gist未配置"

**原因**：环境变量未正确设置

**解决**：
1. 检查Vercel环境变量是否填写正确
2. 确保所有环境（Production/Preview/Development）都勾选
3. 重新部署

### 问题2：日志显示"读取Gist文件失败"

**原因**：Token权限不足或Gist ID错误

**解决**：
1. 确认token有`gist`权限
2. 确认Gist ID正确（32位十六进制字符串）
3. 确认Gist是你账号创建的

### 问题3：历史记录仍然丢失

**原因**：防抖期间函数实例被回收

**解决**：这是正常现象，最多丢失60秒内的数据
- 重要操作（黑名单）立即保存，不会丢失
- 访问历史60秒批量保存，平衡性能和持久性

## 本地开发测试

本地测试时创建`.env`文件：

```bash
# .env
GITHUB_TOKEN=ghp_你的token
GIST_ID=你的gist_id
GIST_ACCESS_LOG_FILE=rssjumper-access-log.json
GIST_BLACKLIST_FILE=rssjumper-blacklist.json
PASSWORD=你的密码
```

然后运行：
```bash
npm install dotenv
vercel dev
```

## 安全建议

1. **定期检查Gist**：访问你的Gist查看数据是否正常
2. **备份Token**：将token保存在密码管理器中
3. **监控用量**：GitHub Settings → Developer settings → Personal access tokens → 查看token使用情况
4. **吊销重建**：如果token泄露，立即在GitHub吊销并重新创建

## API调用频率详细计算

假设：
- RSS访问：100次/小时
- 黑名单操作：5次/小时
- 函数冷启动：3次/小时

API调用：
- 冷启动加载：3次（读取2个文件，合并为1次请求）
- 访问历史保存：60次（防抖，每分钟最多1次）
- 黑名单保存：5次
- **总计**：≈ 68次/小时

**结论**：远低于5000次/小时的限制，非常安全。
