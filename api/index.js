const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 内存存储
const accessLog = new Map(); // 访问历史：url -> {count, lastAccess, firstAccess}
const rateLimitMap = new Map(); // IP访问频率记录
const blacklist = new Set(); // 黑名单URL列表

// 配置
const PASSWORD = process.env.PASSWORD || 'fUgvef-fofzu7-pifjic';
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 2;
const RATE_LIMIT_WINDOW = 60 * 1000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 15 * 60 * 1000;
const CACHE_DIR = process.env.CACHE_DIR || '/tmp/rssjumper-cache';

// GitHub Gist配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const GIST_ACCESS_LOG_FILE = process.env.GIST_ACCESS_LOG_FILE || 'rssjumper-access-log.json';
const GIST_BLACKLIST_FILE = process.env.GIST_BLACKLIST_FILE || 'rssjumper-blacklist.json';

// 数据更新防抖
let saveTimer = null;
let dataChanged = false;

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * 从GitHub Gist读取文件内容
 */
async function readGistFile(filename) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('GitHub Gist未配置，跳过远程加载');
    return null;
  }

  try {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000
    });

    const file = response.data.files[filename];
    if (file && file.content) {
      return JSON.parse(file.content);
    }
    return null;
  } catch (error) {
    console.error(`读取Gist文件 ${filename} 失败:`, error.message);
    return null;
  }
}

/**
 * 更新GitHub Gist文件内容
 */
async function updateGistFile(filename, content) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return;
  }

  try {
    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [filename]: {
            content: JSON.stringify(content, null, 2)
          }
        }
      },
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      }
    );
    console.log(`已同步 ${filename} 到Gist`);
  } catch (error) {
    console.error(`更新Gist文件 ${filename} 失败:`, error.message);
  }
}

/**
 * 从GitHub Gist加载访问历史
 */
async function loadAccessLog() {
  try {
    const data = await readGistFile(GIST_ACCESS_LOG_FILE);
    if (data) {
      Object.entries(data).forEach(([url, record]) => {
        accessLog.set(url, record);
      });
      console.log(`已从Gist加载 ${accessLog.size} 条访问历史`);
    }
  } catch (error) {
    console.error('加载访问历史失败:', error.message);
  }
}

/**
 * 保存访问历史到GitHub Gist（防抖）
 */
function saveAccessLog() {
  dataChanged = true;

  // 清除旧定时器
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  // 60秒后批量保存，避免频繁API调用
  saveTimer = setTimeout(async () => {
    if (dataChanged) {
      const accessData = Object.fromEntries(accessLog);
      const blacklistData = Array.from(blacklist);

      // 同时更新两个文件
      await Promise.all([
        updateGistFile(GIST_ACCESS_LOG_FILE, accessData),
        updateGistFile(GIST_BLACKLIST_FILE, blacklistData)
      ]);

      dataChanged = false;
    }
  }, 60000); // 60秒防抖
}

/**
 * 从GitHub Gist加载黑名单
 */
async function loadBlacklist() {
  try {
    const data = await readGistFile(GIST_BLACKLIST_FILE);
    if (data && Array.isArray(data)) {
      data.forEach(url => blacklist.add(url));
      console.log(`已从Gist加载 ${blacklist.size} 条黑名单`);
    }
  } catch (error) {
    console.error('加载黑名单失败:', error.message);
  }
}

/**
 * 保存黑名单到GitHub Gist（立即保存，因为操作不频繁）
 */
async function saveBlacklist() {
  const data = Array.from(blacklist);
  await updateGistFile(GIST_BLACKLIST_FILE, data);
}

// 数据加载状态
let dataLoaded = false;
let dataLoading = false;

/**
 * 懒加载持久化数据（首次请求时加载，带超时保护）
 */
async function ensureDataLoaded() {
  if (dataLoaded || dataLoading) {
    return;
  }

  dataLoading = true;

  try {
    // 5秒超时保护，避免阻塞请求
    await Promise.race([
      Promise.all([loadAccessLog(), loadBlacklist()]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gist加载超时')), 5000)
      )
    ]);
    dataLoaded = true;
    console.log('持久化数据加载成功');
  } catch (error) {
    console.warn('持久化数据加载失败，使用内存存储:', error.message);
    // 加载失败不影响服务，继续使用内存存储
    dataLoaded = true; // 标记为已加载，避免重试
  } finally {
    dataLoading = false;
  }
}

/**
 * 生成URL的hash作为缓存文件名
 */
function getCacheFileName(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  return path.join(CACHE_DIR, `${hash}.xml`);
}

/**
 * 生成RSS格式的错误信息
 */
function generateErrorRSS(url, errorMessage) {
  const now = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RSSJumper - 错误提示</title>
    <link>https://github.com/rssjumper</link>
    <description>RSSJumper RSS代理服务</description>
    <lastBuildDate>${now}</lastBuildDate>
    <item>
      <title>RSSJumper已成功，但你请求的地址出错了</title>
      <link>${url}</link>
      <description>RSSJumper代理服务运行正常，但在获取RSS源时遇到问题。请求的URL: ${url}。错误信息: ${errorMessage}</description>
      <pubDate>${now}</pubDate>
      <guid isPermaLink="false">rssjumper-error-${Date.now()}</guid>
    </item>
  </channel>
</rss>`;
}


/**
 * 检查是否为内网地址（防止SSRF攻击）
 */
function isPrivateIP(hostname) {
  // 检查是否为localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  // 检查是否为内网IP段
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const [, a, b, c, d] = match.map(Number);

    // 检查IP是否有效
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return true; // 无效IP视为内网
    }

    // 私有IP地址段
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // 224.0.0.0+ (multicast and reserved)
  }

  // 检查IPv6内网地址
  if (hostname.includes(':')) {
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.startsWith('fc') || lowerHostname.startsWith('fd')) {
      return true; // fc00::/7 (unique local)
    }
    if (lowerHostname.startsWith('fe80')) {
      return true; // fe80::/10 (link-local)
    }
  }

  return false;
}

/**
 * 验证是否为有效的RSS URL
 */
function isValidRssUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // 只允许http/https协议
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // 防止SSRF攻击：检查是否为内网地址
    if (isPrivateIP(parsedUrl.hostname)) {
      return false;
    }

    // 简单验证是否可能是RSS源（检查文件扩展名）
    const pathname = parsedUrl.pathname.toLowerCase();
    if (pathname.includes('.xml') || pathname.includes('rss') || pathname.includes('feed')) {
      return true;
    }
    return true; // 允许其他可能的RSS路径
  } catch {
    return false;
  }
}

/**
 * 获取客户端IP
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

/**
 * 检查访问频率限制
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const userAccess = rateLimitMap.get(ip) || [];

  // 清理过期记录
  const recentAccess = userAccess.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (recentAccess.length >= RATE_LIMIT) {
    return false; // 超过频率限制
  }

  // 记录本次访问
  recentAccess.push(now);
  rateLimitMap.set(ip, recentAccess);

  return true;
}

/**
 * 从缓存获取或抓取RSS
 */
async function fetchRss(url) {
  const now = Date.now();
  const cacheFile = getCacheFileName(url);

  // 检查文件缓存
  try {
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const cacheAge = now - stats.mtimeMs;

      // 如果缓存未过期（15分钟内）
      if (cacheAge < CACHE_TTL) {
        const cachedData = fs.readFileSync(cacheFile, 'utf8');
        console.log(`缓存命中: ${url}, 剩余时间: ${Math.round((CACHE_TTL - cacheAge) / 1000)}秒`);

        // 记录访问历史（缓存命中时也记录）
        if (accessLog.has(url)) {
          const record = accessLog.get(url);
          record.count++;
          record.lastAccess = now;
        } else {
          accessLog.set(url, {
            count: 1,
            firstAccess: now,
            lastAccess: now
          });
        }
        saveAccessLog(); // 保存到文件

        return {
          data: cachedData,
          fromCache: true
        };
      } else {
        console.log(`缓存过期: ${url}, 将重新获取`);
      }
    }
  } catch (error) {
    console.error('读取缓存文件失败:', error.message);
  }

  // 抓取RSS（超时15秒以处理网络延时）
  try {
    const response = await axios.get(url, {
      timeout: 15000, // 15秒超时
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSJumper RSS Proxy/1.0)'
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    // 验证返回的内容是否为XML格式
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('xml') && !contentType.includes('rss')) {
      // 简单检查内容是否包含XML标签
      const content = response.data.toString().substring(0, 500);
      if (!content.includes('<?xml') && !content.includes('<rss') && !content.includes('<feed')) {
        throw new Error('返回的内容不是有效的RSS/XML格式');
      }
    }

    // 写入缓存文件
    try {
      fs.writeFileSync(cacheFile, response.data, 'utf8');
      console.log(`缓存已更新: ${url}`);
    } catch (error) {
      console.error('写入缓存文件失败:', error.message);
    }

    // 记录访问历史
    if (accessLog.has(url)) {
      const record = accessLog.get(url);
      record.count++;
      record.lastAccess = now;
    } else {
      accessLog.set(url, {
        count: 1,
        firstAccess: now,
        lastAccess: now
      });
    }
    saveAccessLog(); // 保存到文件

    return {
      data: response.data,
      fromCache: false
    };
  } catch (error) {
    throw new Error(`抓取RSS失败: ${error.message}`);
  }
}

/**
 * 主处理函数
 */
module.exports = async (req, res) => {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 允许GET和POST请求
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: '只允许GET和POST请求' });
    return;
  }

  // 懒加载持久化数据（不阻塞关键请求）
  ensureDataLoaded().catch(err => {
    console.error('数据加载异常:', err.message);
  });

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');
    const password = url.searchParams.get('password');

    // 优先处理RSS代理请求
    if (targetUrl) {
      // 安全HTTP头（用于RSS代理）
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'");

      // 验证URL格式
      if (!isValidRssUrl(targetUrl)) {
        res.status(400).json({ error: '无效的URL格式，只支持http/https协议的RSS源' });
        return;
      }

      // 检查是否在黑名单中
      if (blacklist.has(targetUrl)) {
        const errorRSS = generateErrorRSS(targetUrl, '你访问的URL已被列入黑名单');
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('X-RSSJumper-Blacklisted', 'true');
        res.status(200).send(errorRSS);
        return;
      }

      // 检查访问频率
      const clientIp = getClientIp(req);
      if (!checkRateLimit(clientIp)) {
        res.status(429).json({
          error: '访问频率超限，请稍后再试',
          limit: `${RATE_LIMIT}次/分钟`
        });
        return;
      }

      // 抓取RSS
      let result;
      try {
        result = await fetchRss(targetUrl);
      } catch (fetchError) {
        console.error('RSS获取失败:', fetchError);
        const errorRSS = generateErrorRSS(targetUrl, fetchError.message);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('X-RSSJumper-Error', 'true');
        res.status(200).send(errorRSS);
        return;
      }

      // 返回RSS内容
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('X-RSSJumper-Cache', result.fromCache ? 'HIT' : 'MISS');
      res.status(200).send(result.data);
      return;
    }

    // 管理页面和API（需要密码，且没有url参数）
    if (password) {
      if (password !== PASSWORD) {
        res.status(403).json({ error: '密码错误' });
        return;
      }

      // 为管理页面设置宽松的CSP，允许加载Tailwind CSS和内联脚本
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'self'; img-src 'self' data:; font-src 'self' data:");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'no-referrer');

      // 处理POST请求（管理操作）
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);

            if (data.action === 'blacklist') {
              // 添加到黑名单
              blacklist.add(data.url);
              await saveBlacklist(); // 立即保存到Gist
              res.status(200).json({ success: true, message: 'URL已加入黑名单' });
            } else if (data.action === 'unblacklist') {
              // 从黑名单移除
              blacklist.delete(data.url);
              await saveBlacklist(); // 立即保存到Gist
              res.status(200).json({ success: true, message: 'URL已从黑名单移除' });
            } else if (data.action === 'clearCache') {
              // 清除缓存
              const cacheFile = getCacheFileName(data.url);
              try {
                if (fs.existsSync(cacheFile)) {
                  fs.unlinkSync(cacheFile);
                  res.status(200).json({ success: true, message: '缓存已清除' });
                } else {
                  res.status(404).json({ success: false, message: '缓存文件不存在' });
                }
              } catch (error) {
                res.status(500).json({ success: false, message: '清除缓存失败: ' + error.message });
              }
            } else if (data.action === 'getData') {
              // 获取管理数据（用于AJAX刷新）
              const logs = Array.from(accessLog.entries()).map(([url, record]) => ({
                url,
                count: record.count,
                firstAccess: new Date(record.firstAccess).toLocaleString('zh-CN'),
                lastAccess: new Date(record.lastAccess).toLocaleString('zh-CN'),
                isBlacklisted: blacklist.has(url)
              }));

              // 获取缓存文件列表
              const cacheFiles = [];
              try {
                if (fs.existsSync(CACHE_DIR)) {
                  const files = fs.readdirSync(CACHE_DIR);
                  files.forEach(file => {
                    const filePath = path.join(CACHE_DIR, file);
                    const stats = fs.statSync(filePath);

                    // 从访问日志中找到对应的URL
                    let foundUrl = null;
                    for (const [url, record] of accessLog.entries()) {
                      if (getCacheFileName(url) === filePath) {
                        foundUrl = url;
                        break;
                      }
                    }

                    if (foundUrl) {
                      const cacheAge = Date.now() - stats.mtimeMs;
                      cacheFiles.push({
                        url: foundUrl,
                        lastModified: new Date(stats.mtimeMs).toLocaleString('zh-CN'),
                        size: (stats.size / 1024).toFixed(2) + ' KB',
                        age: Math.floor(cacheAge / 1000 / 60) + ' 分钟前',
                        expired: cacheAge > CACHE_TTL
                      });
                    }
                  });
                }
              } catch (error) {
                console.error('读取缓存目录失败:', error);
              }

              res.status(200).json({
                logs,
                cacheFiles,
                stats: {
                  totalAccess: logs.length,
                  totalBlacklisted: blacklist.size,
                  totalCached: cacheFiles.length
                }
              });
            } else {
              res.status(400).json({ success: false, message: '未知操作' });
            }
          } catch (error) {
            res.status(400).json({ success: false, message: '请求数据格式错误' });
          }
        });
        return;
      }

      // GET请求 - 重定向到独立管理页面
      res.redirect(302, `/api/admin?password=${encodeURIComponent(password)}`);
      return;
    }

    // 安全HTTP头（用于RSS代理和首页）
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'");

    // RSS代理功能
    if (!targetUrl) {
      res.status(200).send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSSJumper RSS代理服务</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    .example { background: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0; }
    .warning { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>🦘 RSSJumper RSS代理服务</h1>
  <p>用于访问被阻挡的RSS订阅源</p>

  <h2>使用方法</h2>
  <div class="example">
    <strong>格式：</strong><br>
    <code>https://your-domain.vercel.app/?url=RSS订阅源地址</code>
  </div>

  <div class="example">
    <strong>示例：</strong><br>
    <code>https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml</code>
  </div>

  <h2>功能特性</h2>
  <ul>
    <li>✅ 仅支持RSS/XML订阅源</li>
    <li>✅ 访问频率限制：2次/分钟/IP</li>
    <li>✅ 15分钟文件缓存</li>
    <li>✅ 15秒网络超时处理</li>
    <li>✅ RSS格式错误提示</li>
    <li>✅ 访问历史记录</li>
  </ul>

  <div class="warning">
    <strong>⚠️ 注意事项：</strong><br>
    - 请勿滥用此服务<br>
    - 仅用于访问RSS订阅源<br>
    - 请遵守目标网站的使用条款
  </div>

  <h2>管理后台</h2>
  <p>访问 <code>/api/admin?password=您的密码</code> 查看管理后台</p>
</body>
</html>
      `);
      return;
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
};
