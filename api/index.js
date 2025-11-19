const axios = require('axios');

/**
 * 【第1步】独立的RSS代理函数
 * 功能：抓取RSS源并返回，不受任何其他功能干扰
 */
async function proxyRSS(targetUrl) {
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

    return {
      success: true,
      data: response.data,
      contentType: response.headers['content-type'] || 'application/xml; charset=utf-8'
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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');

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
