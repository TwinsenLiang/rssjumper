const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 内存存储（注意：Vercel无服务器环境会定期清空）
const accessLog = new Map(); // 访问历史：url -> {count, lastAccess, firstAccess}
const rateLimitMap = new Map(); // IP访问频率记录
const blacklist = new Set(); // 黑名单URL列表

// 配置
const PASSWORD = process.env.PASSWORD || 'fUgvef-fofzu7-pifjic'; // 请修改为您的密码，建议使用环境变量
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 2; // 每分钟最多访问次数，建议使用环境变量
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 15 * 60 * 1000; // 15分钟缓存，建议使用环境变量
const CACHE_DIR = process.env.CACHE_DIR || '/tmp/rssjumper-cache'; // 缓存目录

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
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
 * 生成管理页面HTML
 */
function generateAdminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSSJumper 管理后台</title>
  <script src="https://cdn.tailwindcss.com"><` + `/script>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">🦘 RSSJumper 管理后台</h1>
      <p class="text-gray-600">管理您的RSS代理服务</p>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div class="text-sm text-blue-600 font-medium">总访问记录</div>
        <div class="text-2xl font-bold text-blue-900" id="totalAccess">-</div>
      </div>
      <div class="bg-red-50 rounded-lg p-4 border border-red-200">
        <div class="text-sm text-red-600 font-medium">黑名单数量</div>
        <div class="text-2xl font-bold text-red-900" id="totalBlacklisted">-</div>
      </div>
      <div class="bg-green-50 rounded-lg p-4 border border-green-200">
        <div class="text-sm text-green-600 font-medium">缓存文件数</div>
        <div class="text-2xl font-bold text-green-900" id="totalCached">-</div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="bg-white rounded-lg shadow-lg">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button onclick="switchTab('history')" id="tab-history" class="tab-button active px-6 py-4 text-sm font-medium border-b-2 border-blue-500 text-blue-600">
            访问历史
          </button>
          <button onclick="switchTab('cache')" id="tab-cache" class="tab-button px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
            缓存管理
          </button>
        </nav>
      </div>

      <!-- 访问历史Tab -->
      <div id="content-history" class="tab-content p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-800">访问历史记录</h2>
          <button onclick="refreshData()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
            🔄 刷新
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSS源地址</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">访问次数</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">首次访问</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后访问</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody id="historyTableBody" class="bg-white divide-y divide-gray-200">
              <tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 缓存管理Tab -->
      <div id="content-cache" class="tab-content p-6 hidden">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-800">缓存文件列表</h2>
          <button onclick="refreshData()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
            🔄 刷新
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSS源地址</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件大小</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">缓存时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">缓存年龄</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody id="cacheTableBody" class="bg-white divide-y divide-gray-200">
              <tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Tab切换
    function switchTab(tabName) {
      // 隐藏所有内容
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-button').forEach(el => {
        el.classList.remove('border-blue-500', 'text-blue-600');
        el.classList.add('border-transparent', 'text-gray-500');
      });

      // 显示选中的内容
      document.getElementById('content-' + tabName).classList.remove('hidden');
      const tab = document.getElementById('tab-' + tabName);
      tab.classList.add('border-blue-500', 'text-blue-600');
      tab.classList.remove('border-transparent', 'text-gray-500');
    }

    // 刷新数据
    async function refreshData() {
      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getData' })
        });
        const data = await response.json();

        // 更新统计
        document.getElementById('totalAccess').textContent = data.stats.totalAccess;
        document.getElementById('totalBlacklisted').textContent = data.stats.totalBlacklisted;
        document.getElementById('totalCached').textContent = data.stats.totalCached;

        // 更新访问历史表格
        const historyBody = document.getElementById('historyTableBody');
        if (data.logs.length === 0) {
          historyBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无访问记录</td></tr>';
        } else {
          historyBody.innerHTML = data.logs.map(function(log) {
            var statusBadge = log.isBlacklisted
              ? '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">已禁用</span>'
              : '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">正常</span>';
            var actionButton = log.isBlacklisted
              ? '<button onclick="unblacklist(' + "'" + encodeURIComponent(log.url) + "'" + ')" class="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">解禁</button>'
              : '<button onclick="blacklistUrl(' + "'" + encodeURIComponent(log.url) + "'" + ')" class="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">禁用</button>';
            return '<tr class="hover:bg-gray-50">' +
              '<td class="px-6 py-4 text-sm text-gray-900 break-all max-w-md">' + log.url + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-900">' + log.count + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + log.firstAccess + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + log.lastAccess + '</td>' +
              '<td class="px-6 py-4 text-sm">' + statusBadge + '</td>' +
              '<td class="px-6 py-4 text-sm">' + actionButton + '</td>' +
              '</tr>';
          }).join('');
        }

        // 更新缓存文件表格
        const cacheBody = document.getElementById('cacheTableBody');
        if (data.cacheFiles.length === 0) {
          cacheBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无缓存文件</td></tr>';
        } else {
          cacheBody.innerHTML = data.cacheFiles.map(function(cache) {
            var statusBadge = cache.expired
              ? '<span class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">已过期</span>'
              : '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">有效</span>';
            return '<tr class="hover:bg-gray-50">' +
              '<td class="px-6 py-4 text-sm text-gray-900 break-all max-w-md">' + cache.url + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-900">' + cache.size + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + cache.lastModified + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + cache.age + '</td>' +
              '<td class="px-6 py-4 text-sm">' + statusBadge + '</td>' +
              '<td class="px-6 py-4 text-sm">' +
              '<button onclick="clearCache(' + "'" + encodeURIComponent(cache.url) + "'" + ')" class="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600">清除</button>' +
              '</td>' +
              '</tr>';
          }).join('');
        }
      } catch (error) {
        alert('刷新数据失败: ' + error.message);
      }
    }

    // 禁用URL
    async function blacklistUrl(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要禁用这个URL吗？\\n\\n' + url)) return;

      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'blacklist', url })
        });
        const data = await response.json();
        alert(data.message);
        refreshData();
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 解禁URL
    async function unblacklist(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要解禁这个URL吗？\\n\\n' + url)) return;

      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unblacklist', url })
        });
        const data = await response.json();
        alert(data.message);
        refreshData();
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 清除缓存
    async function clearCache(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要清除这个URL的缓存吗？\\n\\n' + url)) return;

      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clearCache', url })
        });
        const data = await response.json();
        alert(data.message);
        refreshData();
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 页面加载时刷新数据
    window.addEventListener('load', refreshData);
  <` + `/script>
<` + `/body>
<` + `/html>`;
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

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');
    const password = url.searchParams.get('password');

    // 管理页面和API（需要密码）
    if (password) {
      if (password !== PASSWORD) {
        res.status(403).json({ error: '密码错误' });
        return;
      }

      // 处理POST请求（管理操作）
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);

            if (data.action === 'blacklist') {
              // 添加到黑名单
              blacklist.add(data.url);
              res.status(200).json({ success: true, message: 'URL已加入黑名单' });
            } else if (data.action === 'unblacklist') {
              // 从黑名单移除
              blacklist.delete(data.url);
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

      // GET请求 - 显示管理页面HTML
      // 为管理页面设置宽松的CSP，允许加载Tailwind CSS
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'self'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.status(200).send(generateAdminHTML());
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
      // 如果是RSS获取失败，返回RSS格式的错误信息
      console.error('RSS获取失败:', fetchError);
      const errorRSS = generateErrorRSS(targetUrl, fetchError.message);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('X-RSSJumper-Error', 'true');
      res.status(200).send(errorRSS);
      return;
    }

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
