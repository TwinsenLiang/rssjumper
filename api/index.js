const axios = require('axios');

// 内存存储（注意：Vercel无服务器环境会定期清空）
const cache = new Map(); // 缓存RSS内容
const accessLog = []; // 访问历史
const rateLimitMap = new Map(); // IP访问频率记录

// 配置
const PASSWORD = process.env.PASSWORD || 'fUgvef-fofzu7-pifjic'; // 请修改为您的密码，建议使用环境变量
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 2; // 每分钟最多访问次数，建议使用环境变量
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

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

  // 检查缓存
  const cached = cache.get(url);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return {
      data: cached.data,
      fromCache: true
    };
  }

  // 抓取RSS
  try {
    const response = await axios.get(url, {
      timeout: 10000,
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

    // 存入缓存
    cache.set(url, {
      data: response.data,
      timestamp: now
    });

    // 记录访问历史（最多保留100条）
    accessLog.push({
      url,
      timestamp: now,
      date: new Date(now).toISOString()
    });
    if (accessLog.length > 100) {
      accessLog.shift();
    }

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 安全HTTP头
  res.setHeader('X-Content-Type-Options', 'nosniff'); // 防止MIME类型嗅探
  res.setHeader('X-Frame-Options', 'DENY'); // 防止点击劫持
  res.setHeader('X-XSS-Protection', '1; mode=block'); // XSS防护
  res.setHeader('Referrer-Policy', 'no-referrer'); // 不发送referrer信息
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'"); // 内容安全策略（允许内联样式）

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许GET请求
  if (req.method !== 'GET') {
    res.status(405).json({ error: '只允许GET请求' });
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');
    const password = url.searchParams.get('password');

    // 查看访问历史（需要密码）
    if (url.pathname === '/list' || password) {
      if (password !== PASSWORD) {
        res.status(403).json({ error: '密码错误' });
        return;
      }

      res.status(200).json({
        total: accessLog.length,
        logs: accessLog.map(log => ({
          url: log.url,
          date: log.date
        }))
      });
      return;
    }

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
    <li>✅ 5分钟智能缓存</li>
    <li>✅ 访问历史记录</li>
  </ul>

  <div class="warning">
    <strong>⚠️ 注意事项：</strong><br>
    - 请勿滥用此服务<br>
    - 仅用于访问RSS订阅源<br>
    - 请遵守目标网站的使用条款
  </div>

  <h2>查看访问历史</h2>
  <p>访问 <code>/?password=您的密码</code> 查看历史记录</p>
</body>
</html>
      `);
      return;
    }

    // 验证URL格式
    if (!isValidRssUrl(targetUrl)) {
      res.status(400).json({ error: '无效的URL格式，只支持http/https协议的RSS源' });
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
    const result = await fetchRss(targetUrl);

    // 返回RSS内容（保持XML格式）
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-RSSJumper-Cache', result.fromCache ? 'HIT' : 'MISS');
    res.status(200).send(result.data);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
};
