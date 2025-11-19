const axios = require('axios');
const crypto = require('crypto');

// GitHub Gist配置（用于缓存和访问记录）
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const CACHE_TTL = 15 * 60 * 1000; // 15分钟缓存
const ACCESS_LOG_FILE = 'rssjumper-access-log.json'; // 访问记录文件名
const BLACKLIST_FILE = 'rssjumper-blacklist.json'; // 黑名单文件名

// 管理后台密码（必须通过环境变量 PASSWORD 设置）
const PASSWORD = process.env.PASSWORD;
if (PASSWORD) {
  console.log('[管理后台] 密码已配置（长度）:', PASSWORD.length);
} else {
  console.log('[管理后台] ⚠️  未配置PASSWORD环境变量，管理后台将无法访问');
}

// 【第4步】访问记录存储（内存）
const accessLog = new Map(); // url -> { count, firstAccess, lastAccess }

// 【第1步-B】黑名单存储（内存）
const blacklist = new Set(); // 黑名单URL集合

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
 * 【第4步】保存访问记录到Gist（立即异步保存，不阻塞响应）
 */
async function saveAccessLog() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return;
  }

  try {
    console.log('[访问记录] 保存到Gist...');

    // 【修复】先从Gist读取现有数据，合并后再保存
    let existingData = {};
    try {
      const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });

      const file = response.data.files[ACCESS_LOG_FILE];
      if (file && file.content) {
        existingData = JSON.parse(file.content);
      }
    } catch (error) {
      console.log('[访问记录] 读取现有数据失败，将创建新文件');
    }

    // 合并数据：将内存中的数据合并到现有数据
    const memoryData = Object.fromEntries(accessLog);
    Object.entries(memoryData).forEach(([url, record]) => {
      if (existingData[url]) {
        // URL已存在，累加访问次数
        existingData[url].count += record.count;
        existingData[url].lastAccess = Math.max(existingData[url].lastAccess, record.lastAccess);
        existingData[url].firstAccess = Math.min(existingData[url].firstAccess, record.firstAccess);
        // 合并每日访问数据
        if (record.daily) {
          if (!existingData[url].daily) existingData[url].daily = {};
          Object.entries(record.daily).forEach(([date, count]) => {
            existingData[url].daily[date] = (existingData[url].daily[date] || 0) + count;
          });
        }
      } else {
        // 新URL
        existingData[url] = record;
      }
    });

    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [ACCESS_LOG_FILE]: {
            content: JSON.stringify(existingData, null, 2)
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
  } catch (error) {
    console.log(`[访问记录] 保存失败: ${error.message}`);
  }
}

/**
 * 【第4步】记录一次访问
 */
function recordAccess(url) {
  const now = Date.now();
  const today = new Date(now).toLocaleDateString('zh-CN');

  if (accessLog.has(url)) {
    const record = accessLog.get(url);
    record.count++;
    record.lastAccess = now;
    // 记录今日访问次数
    if (!record.daily) record.daily = {};
    record.daily[today] = (record.daily[today] || 0) + 1;
  } else {
    accessLog.set(url, {
      count: 1,
      firstAccess: now,
      lastAccess: now,
      daily: {
        [today]: 1
      }
    });
  }

  console.log(`[访问记录] ${url} - 本次实例访问次数: ${accessLog.get(url).count}`);

  // 异步保存到Gist（不阻塞响应）
  saveAccessLog().catch(err => {
    console.log(`[访问记录] 异步保存失败: ${err.message}`);
  });
}

/**
 * 【第1步-A】从Gist读取访问记录（用于管理后台显示）
 */
async function getAccessLogFromGist() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return [];
  }

  try {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 5000
    });

    const file = response.data.files[ACCESS_LOG_FILE];
    if (!file || !file.content) {
      return [];
    }

    const data = JSON.parse(file.content);
    const today = new Date().toLocaleDateString('zh-CN');

    return Object.entries(data).map(([url, record]) => ({
      url,
      count: (record.daily && record.daily[today]) || 0, // 今日访问次数
      firstAccess: new Date(record.firstAccess).toLocaleString('zh-CN'),
      lastAccess: new Date(record.lastAccess).toLocaleString('zh-CN'),
      blacklisted: blacklist.has(url) // 【第1步-B】添加黑名单状态
    }));
  } catch (error) {
    console.log(`[管理后台] 读取访问记录失败: ${error.message}`);
    return [];
  }
}

/**
 * 【第1步-B】从Gist加载黑名单
 */
async function loadBlacklist() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[黑名单] 未配置GITHUB_TOKEN或GIST_ID，跳过加载');
    return;
  }

  try {
    console.log('[黑名单] 从Gist加载黑名单...');

    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 5000
    });

    const file = response.data.files[BLACKLIST_FILE];
    if (file && file.content) {
      const data = JSON.parse(file.content);
      data.urls.forEach(url => blacklist.add(url));
      console.log(`[黑名单] 加载成功，共 ${blacklist.size} 条记录`);
    } else {
      console.log('[黑名单] Gist中没有黑名单文件');
    }
  } catch (error) {
    console.log(`[黑名单] 加载失败: ${error.message}`);
  }
}

/**
 * 【第1步-B】保存黑名单到Gist
 */
async function saveBlacklist() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return;
  }

  try {
    console.log('[黑名单] 保存到Gist...');

    const data = {
      urls: Array.from(blacklist),
      updatedAt: Date.now()
    };

    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [BLACKLIST_FILE]: {
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

    console.log('[黑名单] 保存成功');
  } catch (error) {
    console.log(`[黑名单] 保存失败: ${error.message}`);
  }
}

/**
 * 【第1步-B】添加URL到黑名单
 */
async function addToBlacklist(url) {
  blacklist.add(url);
  await saveBlacklist();
  console.log(`[黑名单] 已添加: ${url}`);
}

/**
 * 【第1步-B】从黑名单移除URL
 */
async function removeFromBlacklist(url) {
  blacklist.delete(url);
  await saveBlacklist();
  console.log(`[黑名单] 已移除: ${url}`);
}

/**
 * 【第1步-A】获取Gist中的所有缓存文件列表
 */
async function getCacheFilesList() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return [];
  }

  try {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 5000
    });

    const cacheFiles = [];
    const files = response.data.files;

    Object.entries(files).forEach(([filename, fileData]) => {
      // 只处理缓存文件（以rss-cache-开头）
      if (filename.startsWith('rss-cache-')) {
        try {
          const content = JSON.parse(fileData.content);
          const now = Date.now();
          const age = now - content.cachedAt;
          const expired = age > CACHE_TTL;

          cacheFiles.push({
            filename,
            url: content.url,
            size: fileData.size,
            cachedAt: new Date(content.cachedAt).toLocaleString('zh-CN'),
            expiresAt: new Date(content.expiresAt).toLocaleString('zh-CN'),
            age: Math.floor(age / 1000 / 60) + '分钟前',
            expired: expired,
            blacklisted: blacklist.has(content.url) // 【第1步-B】黑名单状态
          });
        } catch (e) {
          // 解析失败跳过
        }
      }
    });

    return cacheFiles;
  } catch (error) {
    console.log(`[管理后台] 获取缓存列表失败: ${error.message}`);
    return [];
  }
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
 * 【第1步-B】启动时加载黑名单（异步，不阻塞）
 */
loadBlacklist().catch(err => {
  console.log(`[黑名单] 启动加载失败: ${err.message}`);
});

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
      // RSS代理只接受GET请求
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'RSS代理只支持GET请求' });
        return;
      }

      console.log(`[请求] RSS代理: ${targetUrl}`);

      // 验证URL
      if (!isValidUrl(targetUrl)) {
        res.status(400).json({
          error: '无效的URL',
          message: '只支持http/https协议，不支持访问内网地址'
        });
        return;
      }

      // 【第1步-B】检查黑名单
      if (blacklist.has(targetUrl)) {
        console.log(`[黑名单] 拒绝访问: ${targetUrl}`);
        res.status(403).json({
          error: '该RSS源已被禁用',
          message: '此RSS源在黑名单中，无法访问'
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
    // 【第1步-A】管理后台
    // ==========================================
    const password = url.searchParams.get('password');

    if (password) {
      // 验证密码
      if (password !== PASSWORD) {
        res.status(403).json({ error: '密码错误' });
        return;
      }

      console.log(`[请求] 访问管理后台`);

      // 处理POST请求（获取数据）
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);

            if (data.action === 'getData') {
              // 从Gist读取访问记录（而不是从内存Map读取）
              const logs = await getAccessLogFromGist();

              // 获取缓存列表
              const cacheFiles = await getCacheFilesList();

              res.status(200).json({
                success: true,
                logs,
                cacheFiles,
                stats: {
                  totalAccess: logs.length,
                  totalCached: cacheFiles.length
                }
              });
            } else if (data.action === 'addBlacklist') {
              // 【第1步-B】添加到黑名单
              if (!data.url) {
                res.status(400).json({ success: false, message: '缺少URL参数' });
                return;
              }
              await addToBlacklist(data.url);
              res.status(200).json({ success: true, message: '已添加到黑名单' });
            } else if (data.action === 'removeBlacklist') {
              // 【第1步-B】从黑名单移除
              if (!data.url) {
                res.status(400).json({ success: false, message: '缺少URL参数' });
                return;
              }
              await removeFromBlacklist(data.url);
              res.status(200).json({ success: true, message: '已从黑名单移除' });
            } else {
              res.status(400).json({ success: false, message: '未知操作' });
            }
          } catch (error) {
            res.status(400).json({ success: false, message: '请求数据格式错误' });
          }
        });
        return;
      }

      // GET请求 - 返回管理后台页面
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理后台 - RSSJumper</title>
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body>
  <div class="container">
    <h1>🛠️ RSSJumper 管理后台</h1>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value" id="stat-access">-</div>
        <div class="stat-label">今日访问总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-cache">-</div>
        <div class="stat-label">缓存文件数</div>
      </div>
    </div>

    <div class="section">
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('access-log')">📊 访问记录</button>
        <button class="tab-btn" onclick="switchTab('cache-files')">💾 缓存文件</button>
      </div>

      <div id="access-log-tab" class="tab-content active">
        <div id="access-log-table">
          <div class="loading">正在加载...</div>
        </div>
      </div>

      <div id="cache-files-tab" class="tab-content">
        <div id="cache-files-table">
          <div class="loading">正在加载...</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const password = new URLSearchParams(window.location.search).get('password');

    // HTML属性转义函数
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Tab切换函数
    function switchTab(tabName) {
      // 移除所有active类
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      // 添加active类到当前tab
      event.target.classList.add('active');
      document.getElementById(tabName + '-tab').classList.add('active');
    }

    async function loadData() {
      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getData' })
        });

        const data = await response.json();

        if (!data.success) {
          alert('加载数据失败: ' + data.message);
          return;
        }

        // 更新统计
        // 计算今日访问总数（所有记录的今日访问次数之和）
        const totalTodayAccess = data.logs.reduce((sum, log) => sum + log.count, 0);
        document.getElementById('stat-access').textContent = totalTodayAccess;
        document.getElementById('stat-cache').textContent = data.stats.totalCached;

        // 更新访问记录表格
        const accessLogHtml = data.logs.length > 0 ?
          '<table><thead><tr><th>RSS URL</th><th>今日访问次数</th><th>首次访问</th><th>最后访问</th><th>操作</th></tr></thead><tbody>' +
          data.logs.map(log => {
            const escapedUrl = escapeHtml(log.url);
            return '<tr>' +
              '<td class="url-cell" title="' + escapedUrl + '">' + escapedUrl + '</td>' +
              '<td>' + log.count + '</td>' +
              '<td>' + log.firstAccess + '</td>' +
              '<td>' + log.lastAccess + '</td>' +
              '<td>' +
                (log.blacklisted ?
                  '<button class="action-btn unblock-btn" data-url="' + escapedUrl + '" onclick="toggleBlacklist(this.dataset.url, false)">解绑</button>' :
                  '<button class="action-btn block-btn" data-url="' + escapedUrl + '" onclick="toggleBlacklist(this.dataset.url, true)">加黑</button>') +
              '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table>' :
          '<div class="loading">暂无访问记录</div>';

        document.getElementById('access-log-table').innerHTML = accessLogHtml;

        // 更新缓存文件表格
        const cacheFilesHtml = data.cacheFiles.length > 0 ?
          '<table><thead><tr><th>RSS URL</th><th>文件大小</th><th>缓存时间</th><th>过期时间</th><th>状态</th></tr></thead><tbody>' +
          data.cacheFiles.map(file => {
            const escapedUrl = escapeHtml(file.url);
            return '<tr>' +
              '<td class="url-cell" title="' + escapedUrl + '">' + escapedUrl + '</td>' +
              '<td>' + (file.size / 1024).toFixed(2) + ' KB</td>' +
              '<td>' + file.cachedAt + '</td>' +
              '<td>' + file.expiresAt + '</td>' +
              '<td class="' + (file.expired ? 'expired' : 'valid') + '">' +
                (file.expired ? '已过期' : '有效') +
              '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table>' :
          '<div class="loading">暂无缓存文件</div>';

        document.getElementById('cache-files-table').innerHTML = cacheFilesHtml;

      } catch (error) {
        alert('加载数据失败: ' + error.message);
      }
    }

    // 【第1步-B】切换黑名单状态
    async function toggleBlacklist(url, addToBlacklist) {
      try {
        const action = addToBlacklist ? 'addBlacklist' : 'removeBlacklist';
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, url })
        });

        const result = await response.json();
        if (result.success) {
          alert(result.message);
          loadData(); // 刷新数据
        } else {
          alert('操作失败: ' + result.message);
        }
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 页面加载时自动获取数据
    loadData();

    // 每30秒自动刷新
    setInterval(loadData, 30000);
  </script>
</body>
</html>`);
      return;
    }

    // ==========================================
    // 【第2步】首页显示
    // ==========================================
    // 首页只接受GET请求
    if (req.method !== 'GET') {
      res.status(405).json({ error: '首页只支持GET请求' });
      return;
    }

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

    <div class="usage">
      <h2>🛠️ 管理后台</h2>
      <div class="example">
        <strong>访问地址：</strong><br>
        <code>https://your-domain.vercel.app/?password=你的密码</code>
      </div>
      <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
        密码需通过环境变量 <code>PASSWORD</code> 设置
      </p>
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
