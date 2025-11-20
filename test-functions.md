# RSSJumper 功能测试清单

## 1. RSS代理功能（核心功能）
- [ ] 测试1: `/?url=https://github.blog/feed/`
  - 预期：返回XML格式的RSS内容
  - 检查：Content-Type: application/xml
  - 检查：X-RSSJumper-Cache: HIT或MISS

- [ ] 测试2: URL参数编码测试
  - 输入：`/?url=https%3A%2F%2Fgithub.blog%2Ffeed%2F`
  - 预期：自动解码并正常返回RSS

- [ ] 测试3: 无效URL
  - 输入：`/?url=ftp://example.com/rss.xml`
  - 预期：返回错误JSON

- [ ] 测试4: 内网地址SSRF防护
  - 输入：`/?url=http://localhost/rss.xml`
  - 预期：返回错误JSON

## 2. 缓存功能
- [ ] 测试5: 首次访问
  - 检查：X-RSSJumper-Cache: MISS
  - 检查：/tmp/rssjumper-cache/目录下有缓存文件

- [ ] 测试6: 15分钟内再次访问
  - 检查：X-RSSJumper-Cache: HIT
  - 检查：响应速度明显加快

## 3. 黑名单功能
- [ ] 测试7: 添加到黑名单
  - POST `/?password=xxx` body: `{"action":"blacklist","url":"..."}`
  - 预期：返回成功消息

- [ ] 测试8: 访问黑名单URL
  - 预期：返回RSS格式错误信息，包含"黑名单"字样

## 4. 管理后台
- [ ] 测试9: 访问管理页面
  - GET `/api/admin?password=正确密码`
  - 预期：显示Tailwind CSS样式的管理界面

- [ ] 测试10: 错误密码
  - GET `/api/admin?password=错误密码`
  - 预期：返回403错误

- [ ] 测试11: 获取管理数据
  - POST `/?password=xxx` body: `{"action":"getData"}`
  - 预期：返回JSON格式的访问历史和缓存列表

## 5. 首页显示
- [ ] 测试12: 访问根路径
  - GET `/`
  - 预期：显示使用说明HTML页面

## 6. 频率限制
- [ ] 测试13: 快速连续访问超过2次/分钟
  - 预期：返回429错误

## 7. 安全头
- [ ] 测试14: 检查所有响应的安全HTTP头
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY或SAMEORIGIN
  - X-XSS-Protection: 1; mode=block
