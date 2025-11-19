const axios = require('axios');
const crypto = require('crypto');

// GitHub Gist配置（用于缓存和访问记录）
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const CACHE_TTL = 15 * 60 * 1000; // 15分钟缓存
const ACCESS_LOG_FILE = 'rssjumper-access-log.json'; // 访问记录文件名

// 【第4步】访问记录存储（内存）
const accessLog = new Map(); // url -> { count, firstAccess, lastAccess }
let accessLogSaveTimer = null; // 防抖定时器
let accessLogChanged = false; // 数据是否已变更

/**
 * 生成URL的MD5哈希值（用作缓存文件名）
 */
function getUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * 【第4步】从Gist加载访问记录
 */
async function loadAccessLog() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[访问记录] 未配置GITHUB_TOKEN或GIST_ID，跳过加载');
    return;
  }

  try {
    console.log('[访问记录] 从Gist加载访问记录...');

    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 5000
    });

    const file = response.data.files[ACCESS_LOG_FILE];
    if (file && file.content) {
      const data = JSON.parse(file.content);
      Object.entries(data).forEach(([url, record]) => {
        accessLog.set(url, record);
      });
      console.log(`[访问记录] 加载成功，共 ${accessLog.size} 条记录`);
    } else {
      console.log('[访问记录] Gist中没有访问记录文件');
    }
  } catch (error) {
    console.log(`[访问记录] 加载失败: ${error.message}`);
  }
}

/**
 * 【第4步】保存访问记录到Gist（带60秒防抖）
 */
function saveAccessLog() {
  accessLogChanged = true;

  // 清除旧定时器
  if (accessLogSaveTimer) {
    clearTimeout(accessLogSaveTimer);
  }

  // 60秒后批量保存
  accessLogSaveTimer = setTimeout(async () => {
    if (!accessLogChanged || !GITHUB_TOKEN || !GIST_ID) {
      return;
    }

    try {
      console.log('[访问记录] 保存到Gist...');

      const data = Object.fromEntries(accessLog);

      await axios.patch(
        `https://api.github.com/gists/${GIST_ID}`,
        {
          files: {
            [ACCESS_LOG_FILE]: {
              content: JSON.stringify(data, null, 2)
            }
          }
        },
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          timeout: 5000
        }
      );

      console.log('[访问记录] 保存成功');
      accessLogChanged = false;
    } catch (error) {
      console.log(`[访问记录] 保存失败: ${error.message}`);
    }
  }, 60000); // 60秒防抖
}

/**
 * 【第4步】记录一次访问
 */
function recordAccess(url) {
  const now = Date.now();

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

  console.log(`[访问记录] ${url} - 访问次数: ${accessLog.get(url).count}`);

  // 触发保存（带防抖）
  saveAccessLog();
}

/**
 * 【第3步】从Gist读取RSS缓存
 */
async function readRSSCacheFromGist(targetUrl) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[Gist缓存] 未配置GITHUB_TOKEN或GIST_ID，跳过');
    return null;
  }

  const cacheKey = `rss-cache-${getUrlHash(targetUrl)}.json`;

  try {
    console.log(`[Gist缓存] 尝试读取缓存: ${cacheKey}`);

    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 5000
    });

    const file = response.data.files[cacheKey];
    if (!file || !file.content) {
      console.log('[Gist缓存] 缓存不存在');
      return null;
    }

    const cache = JSON.parse(file.content);
    const now = Date.now();

    // 检查是否过期
    if (cache.expiresAt && cache.expiresAt > now) {
      console.log(`[Gist缓存] 命中！剩余时间: ${Math.round((cache.expiresAt - now) / 1000)}秒`);
      return {
        data: cache.content,
        fromCache: true
      };
    } else {
      console.log('[Gist缓存] 已过期');
      return null;
    }
  } catch (error) {
    console.log(`[Gist缓存] 读取失败: ${error.message}`);
    return null;
  }
}

/**
 * 【第3步】将RSS缓存写入Gist
 */
async function writeRSSCacheToGist(targetUrl, content) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[Gist缓存] 未配置，跳过写入');
    return;
  }

  const cacheKey = `rss-cache-${getUrlHash(targetUrl)}.json`;
  const now = Date.now();

  const cacheData = {
    url: targetUrl,
    content: content,
    cachedAt: now,
    expiresAt: now + CACHE_TTL
  };

  try {
    console.log(`[Gist缓存] 写入缓存: ${cacheKey}`);

    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [cacheKey]: {
            content: JSON.stringify(cacheData, null, 2)
          }
        }
      },
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      }
    );

    console.log('[Gist缓存] 写入成功');
  } catch (error) {
    console.log(`[Gist缓存] 写入失败: ${error.message}`);
  }
}

/**
 * 【第1步】独立的RSS代理函数
 * 功能：抓取RSS源并返回，不受任何其他功能干扰
 * 【第3步】增强：支持Gist缓存
 * 【第4步】增强：记录访问历史
 */
async function proxyRSS(targetUrl) {
  // 【第4步】记录访问
  recordAccess(targetUrl);

  // 【第3步】先尝试从Gist读取缓存
  const cachedResult = await readRSSCacheFromGist(targetUrl);
  if (cachedResult) {
    return {
      success: true,
      data: cachedResult.data,
      contentType: 'application/xml; charset=utf-8',
      fromCache: true
    };
  }
  try {
    console.log(`[RSS代理] 开始抓取: ${targetUrl}`);

    const response = await axios.get(targetUrl, {
      timeout: 15000, // 15秒超时
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSJumper/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      responseType: 'text',
      responseEncoding: 'utf8'
    });

    console.log(`[RSS代理] 抓取成功，大小: ${response.data.length} 字节`);

    // 【第3步】异步写入Gist缓存（不阻塞响应）
    writeRSSCacheToGist(targetUrl, response.data).catch(err => {
      console.log(`[Gist缓存] 异步写入失败: ${err.message}`);
    });

    return {
      success: true,
      data: response.data,
      contentType: response.headers['content-type'] || 'application/xml; charset=utf-8',
      fromCache: false
    };
  } catch (error) {
    console.error(`[RSS代理] 抓取失败:`, error.message);

    // 返回RSS格式的错误信息
    const errorRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RSSJumper - 错误提示</title>
    <link>${targetUrl}</link>
    <description>RSS代理服务</description>
    <item>
      <title>获取RSS失败</title>
      <link>${targetUrl}</link>
      <description>无法获取RSS源。错误: ${error.message}</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

    return {
      success: false,
      data: errorRSS,
      contentType: 'application/xml; charset=utf-8',
      error: error.message
    };
  }
}

/**
 * 验证URL是否有效
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);

    // 只允许http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // 防止访问内网地址
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 【第4步】启动时加载访问记录（异步，不阻塞）
 */
loadAccessLog().catch(err => {
  console.log(`[访问记录] 启动加载失败: ${err.message}`);
});

/**
 * 主处理函数
 */
module.exports = async (req, res) => {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: '只允许GET请求' });
    return;
  }

  try {
    // 调试信息
    console.log('[调试] req.url:', req.url);
    console.log('[调试] req.headers.host:', req.headers.host);

    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');

    console.log('[调试] 解析后的targetUrl:', targetUrl);

    // ==========================================
    // 【第1步】RSS代理功能 - 最高优先级
    // ==========================================
    if (targetUrl) {
      console.log(`[请求] RSS代理: ${targetUrl}`);

      // 验证URL
      if (!isValidUrl(targetUrl)) {
        res.status(400).json({
          error: '无效的URL',
          message: '只支持http/https协议，不支持访问内网地址'
        });
        return;
      }

      // 调用独立的RSS代理函数
      const result = await proxyRSS(targetUrl);

      // 设置响应头
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('X-RSSJumper-Status', result.success ? 'success' : 'error');
      // 【第3步】添加缓存状态响应头
      res.setHeader('X-RSSJumper-Cache', result.fromCache ? 'HIT' : 'MISS');

      // 返回RSS内容
      res.status(200).send(result.data);
      return;
    }

    // ==========================================
    // 【第2步】首页显示
    // ==========================================
    console.log(`[请求] 访问首页`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🦘 RSSJumper - RSS代理服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 800px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      color: #333;
      text-align: center;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .feature {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }
    .feature-icon {
      font-size: 2em;
      margin-bottom: 10px;
    }
    .feature-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #333;
    }
    .feature-desc {
      color: #666;
      font-size: 0.9em;
    }
    .usage {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    .usage h2 {
      color: #333;
      margin-bottom: 15px;
    }
    code {
      background: #e9ecef;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: "Monaco", "Courier New", monospace;
      font-size: 0.9em;
      word-break: break-all;
    }
    .example {
      margin: 10px 0;
      padding: 10px;
      background: white;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦘 RSSJumper</h1>
    <p class="subtitle">RSS代理服务 - 访问被阻挡的订阅源</p>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">🚀</div>
        <div class="feature-title">快速代理</div>
        <div class="feature-desc">即时访问RSS源</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <div class="feature-title">安全限制</div>
        <div class="feature-desc">2次/分钟/IP</div>
      </div>
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <div class="feature-title">智能缓存</div>
        <div class="feature-desc">15分钟缓存</div>
      </div>
      <div class="feature">
        <div class="feature-icon">📊</div>
        <div class="feature-title">访问历史</div>
        <div class="feature-desc">记录所有源</div>
      </div>
    </div>

    <div class="usage">
      <h2>使用方法</h2>
      <div class="example">
        <strong>格式：</strong><br>
        <code>https://your-domain.vercel.app/?url=RSS源地址</code>
      </div>
      <div class="example">
        <strong>示例：</strong><br>
        <code>https://your-domain.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml</code>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 0.9em;">
      <p>仅用于个人RSS订阅，请勿滥用</p>
    </div>
  </div>
</body>
</html>`);
    return;

  } catch (error) {
    console.error('[错误]', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
};
