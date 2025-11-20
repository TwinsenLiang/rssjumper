const axios = require('axios');
const crypto = require('crypto');

// 版本号
const VERSION = '1.0.0';

// GitHub Gist配置（用于缓存和访问记录）
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const CACHE_TTL = 15 * 60 * 1000; // 15分钟缓存
const ACCESS_LOG_FILE = 'rssjumper-access-log.json'; // 访问记录文件名
const BLACKLIST_FILE = 'rssjumper-blacklist.json'; // 黑名单文件名
const BANNED_IPS_FILE = 'rssjumper-banned-ips.json'; // 封禁IP文件名

// 管理后台密码（必须通过环境变量 PASSWORD 设置）
const PASSWORD = process.env.PASSWORD;
if (PASSWORD) {
  console.log('[管理后台] 密码已配置（长度）:', PASSWORD.length);
} else {
  console.log('[管理后台] ⚠️  未配置PASSWORD环境变量，管理后台将无法访问');
}

// 频率限制配置
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 60; // 每分钟请求限制，默认60
const BAN_DURATION = 5 * 60 * 1000; // 封禁时长：5分钟
console.log(`[频率限制] 每分钟限制: ${RATE_LIMIT} 次请求`);

// 访问记录存储（内存）
const accessLog = new Map(); // url -> { count, firstAccess, lastAccess }

// 黑名单存储（内存）
const blacklist = new Set(); // 黑名单URL集合

// IP访问记录和封禁列表（内存）
const ipAccessLog = new Map(); // ip -> [timestamp1, timestamp2, ...]
const bannedIPs = new Map(); // ip -> bannedUntil (timestamp)

/**
 * 生成URL的MD5哈希值（用作缓存文件名）
 */
function getUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * 从Gist加载访问记录
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
 * 保存访问记录到Gist（立即异步保存，不阻塞响应）
 */
async function saveAccessLog() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return;
  }

  try {
    console.log('[访问记录] 保存到Gist...');

    // 先从Gist读取现有数据，合并后再保存
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
 * 记录一次访问
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
 * 清零访问记录
 */
async function resetAccessLog() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return;
  }

  try {
    console.log('[访问记录] 清零访问记录...');

    // 清空内存中的访问记录
    accessLog.clear();

    // 清空Gist中的访问记录文件
    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [ACCESS_LOG_FILE]: {
            content: JSON.stringify({}, null, 2)
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

    console.log('[访问记录] 清零成功');
  } catch (error) {
    console.log(`[访问记录] 清零失败: ${error.message}`);
    throw error;
  }
}

/**
 * 从Gist读取访问记录（用于管理后台显示）
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
      blacklisted: blacklist.has(url)
    }));
  } catch (error) {
    console.log(`[管理后台] 读取访问记录失败: ${error.message}`);
    return [];
  }
}

/**
 * 从Gist加载黑名单
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
 * 保存黑名单到Gist
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
 * 添加URL到黑名单
 */
async function addToBlacklist(url) {
  blacklist.add(url);
  await saveBlacklist();
  console.log(`[黑名单] 已添加: ${url}`);
}

/**
 * 从黑名单移除URL
 */
async function removeFromBlacklist(url) {
  blacklist.delete(url);
  await saveBlacklist();
  console.log(`[黑名单] 已移除: ${url}`);
}

/**
 * 从Gist加载封禁IP列表
 */
async function loadBannedIPs() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[频率限制] 未配置GITHUB_TOKEN或GIST_ID，跳过加载封禁IP');
    return;
  }

  try {
    console.log('[频率限制] 从Gist加载封禁IP列表...');

    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 5000
    });

    const file = response.data.files[BANNED_IPS_FILE];
    if (file && file.content) {
      const data = JSON.parse(file.content);
      const now = Date.now();

      // 加载封禁IP，同时清理过期的
      Object.entries(data).forEach(([ip, bannedUntil]) => {
        if (bannedUntil > now) {
          bannedIPs.set(ip, bannedUntil);
        }
      });

      console.log(`[频率限制] 加载成功，当前封禁 ${bannedIPs.size} 个IP`);
    } else {
      console.log('[频率限制] Gist中没有封禁IP文件');
    }
  } catch (error) {
    console.log(`[频率限制] 加载封禁IP失败: ${error.message}`);
  }
}

/**
 * 保存封禁IP到Gist
 */
async function saveBannedIPs() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return;
  }

  try {
    console.log('[频率限制] 保存封禁IP到Gist...');

    const data = Object.fromEntries(bannedIPs);

    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [BANNED_IPS_FILE]: {
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

    console.log('[频率限制] 封禁IP保存成功');
  } catch (error) {
    console.log(`[频率限制] 保存封禁IP失败: ${error.message}`);
  }
}

/**
 * 检查IP频率限制
 * @returns {boolean} true表示通过，false表示被限制
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  // 检查是否在封禁列表中
  if (bannedIPs.has(ip)) {
    const bannedUntil = bannedIPs.get(ip);
    if (bannedUntil > now) {
      const remainingSeconds = Math.ceil((bannedUntil - now) / 1000);
      console.log(`[频率限制] IP ${ip} 仍在封禁中，剩余 ${remainingSeconds} 秒`);
      return false;
    } else {
      // 封禁时间已过，解除封禁
      bannedIPs.delete(ip);
      console.log(`[频率限制] IP ${ip} 封禁已解除`);
    }
  }

  // 获取该IP的访问记录
  if (!ipAccessLog.has(ip)) {
    ipAccessLog.set(ip, []);
  }

  const accessTimes = ipAccessLog.get(ip);

  // 清理1分钟前的记录
  const recentAccess = accessTimes.filter(time => time > oneMinuteAgo);

  // 检查是否超过限制
  if (recentAccess.length >= RATE_LIMIT) {
    // 超过限制，封禁5分钟
    const bannedUntil = now + BAN_DURATION;
    bannedIPs.set(ip, bannedUntil);
    console.log(`[频率限制] IP ${ip} 超过限制 (${recentAccess.length}/${RATE_LIMIT})，封禁5分钟`);

    // 异步保存到Gist
    saveBannedIPs().catch(err => {
      console.log(`[频率限制] 保存封禁IP失败: ${err.message}`);
    });

    return false;
  }

  // 记录本次访问
  recentAccess.push(now);
  ipAccessLog.set(ip, recentAccess);

  return true;
}

/**
 * 获取Gist中的所有缓存文件列表
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

          // 判断缓存状态（四色状态）
          let cacheStatus = 'fresh';  // 默认新鲜
          let cacheStatusText = '新鲜';

          // 检查是否是"不可用"占位符（通过检查RSS内容）
          const isUnavailable = content.content &&
            (content.content.includes('RSS源暂时不可用') ||
             content.content.includes('RSS已失效'));

          if (isUnavailable) {
            // 状态4: RSS已失效（红色）
            cacheStatus = 'unavailable';
            cacheStatusText = 'RSS已失效';
          } else if (expired) {
            // 状态3: 已过期（黄色）
            cacheStatus = 'stale';
            cacheStatusText = '旧';
          } else if (age > CACHE_TTL / 2) {
            // 状态2: 缓存已过半（蓝色）
            cacheStatus = 'normal';
            cacheStatusText = '普通';
          } else {
            // 状态1: 新鲜（绿色）
            cacheStatus = 'fresh';
            cacheStatusText = '新鲜';
          }

          cacheFiles.push({
            filename,
            url: content.url,
            size: fileData.size,
            cachedAt: new Date(content.cachedAt).toLocaleString('zh-CN'),
            expiresAt: new Date(content.expiresAt).toLocaleString('zh-CN'),
            age: Math.floor(age / 1000 / 60) + '分钟前',
            expired: expired,
            cacheStatus: cacheStatus,
            cacheStatusText: cacheStatusText,
            blacklisted: blacklist.has(content.url)
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
 * 从Gist读取RSS缓存
 * @param {string} targetUrl - RSS源URL
 * @param {boolean} allowExpired - 是否允许返回过期的缓存（默认false）
 * @returns {object|null} 缓存数据或null
 */
async function readRSSCacheFromGist(targetUrl, allowExpired = false) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[Gist缓存] 未配置GITHUB_TOKEN或GIST_ID，跳过');
    return null;
  }

  const cacheKey = `rss-cache-${getUrlHash(targetUrl)}.json`;

  try {
    console.log(`[Gist缓存] 尝试读取缓存: ${cacheKey}${allowExpired ? ' (允许过期)' : ''}`);

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
    const expired = !cache.expiresAt || cache.expiresAt <= now;

    // 检查是否过期
    if (!expired) {
      console.log(`[Gist缓存] 命中！剩余时间: ${Math.round((cache.expiresAt - now) / 1000)}秒`);
      return {
        data: cache.content,
        contentType: cache.contentType || 'application/xml; charset=utf-8',
        fromCache: true,
        expired: false
      };
    } else if (allowExpired) {
      const age = Math.round((now - cache.cachedAt) / 1000 / 60);
      console.log(`[Gist缓存] 返回过期缓存（已过期 ${age} 分钟）`);
      return {
        data: cache.content,
        contentType: cache.contentType || 'application/xml; charset=utf-8',
        fromCache: true,
        expired: true
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
 * 生成"RSS已失效"的占位符RSS内容
 * @param {string} targetUrl - RSS源URL
 * @returns {string} RSS格式的占位符内容
 */
function generateUnavailableRSS(targetUrl) {
  const now = new Date();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RSS源暂时不可用</title>
    <link>${targetUrl}</link>
    <description>RSSJumper - RSS代理服务</description>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <item>
      <title>⚠️ ${targetUrl} 的RSS已失效</title>
      <link>${targetUrl}</link>
      <description>此RSS源暂时无法访问，已尝试多次获取但均失败。RSSJumper将继续尝试获取最新内容，请稍后再试。</description>
      <pubDate>${now.toUTCString()}</pubDate>
      <guid isPermaLink="false">rssjumper-unavailable-${Date.now()}</guid>
    </item>
  </channel>
</rss>`;
}

/**
 * 渐进式重试获取RSS（最多3次，超时时间递增：1秒、3秒、5秒）
 * @param {string} targetUrl - RSS源URL
 * @returns {object|null} 成功返回RSS数据，失败返回null
 */
async function fetchRSSWithRetry(targetUrl) {
  const retryConfig = [
    { attempt: 1, timeout: 1000 },  // 第1次：1秒超时
    { attempt: 2, timeout: 3000 },  // 第2次：3秒超时
    { attempt: 3, timeout: 5000 }   // 第3次：5秒超时
  ];

  for (const config of retryConfig) {
    try {
      console.log(`[RSS获取] 第 ${config.attempt} 次尝试，超时: ${config.timeout}ms`);

      const response = await axios.get(targetUrl, {
        timeout: config.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSSJumper/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        responseType: 'text'
      });

      console.log(`[RSS获取] 第 ${config.attempt} 次成功！大小: ${response.data.length} 字节`);

      return {
        data: response.data,
        contentType: response.headers['content-type'] || 'application/xml; charset=utf-8'
      };
    } catch (error) {
      console.log(`[RSS获取] 第 ${config.attempt} 次失败: ${error.message}`);

      // 如果是最后一次尝试，返回null
      if (config.attempt === retryConfig.length) {
        console.log(`[RSS获取] 所有尝试均失败`);
        return null;
      }

      // 否则继续下一次尝试
    }
  }

  return null;
}

/**
 * 将RSS缓存写入Gist
 */
async function writeRSSCacheToGist(targetUrl, content, contentType) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[Gist缓存] 未配置，跳过写入');
    return;
  }

  const cacheKey = `rss-cache-${getUrlHash(targetUrl)}.json`;
  const now = Date.now();

  const cacheData = {
    url: targetUrl,
    content: content,
    contentType: contentType,
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
 * 从Gist删除指定URL的RSS缓存
 */
async function deleteRSSCacheFromGist(targetUrl) {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.log('[Gist缓存] 未配置，跳过删除');
    return false;
  }

  const cacheKey = `rss-cache-${getUrlHash(targetUrl)}.json`;

  try {
    console.log(`[Gist缓存] 删除缓存: ${cacheKey}`);

    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          [cacheKey]: null  // 设置为null表示删除
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

    console.log('[Gist缓存] 删除成功');
    return true;
  } catch (error) {
    console.log(`[Gist缓存] 删除失败: ${error.message}`);
    return false;
  }
}

/**
 * RSS代理函数（优雅降级策略）
 * 功能：抓取RSS源并返回，支持Gist缓存和访问历史记录
 *
 * 策略：
 * 1. 先尝试读取未过期的缓存，如果有就直接返回
 * 2. 如果没有未过期的缓存，进行渐进式重试获取最新RSS（3次，1s/3s/5s超时）
 * 3. 如果获取成功，写入缓存并返回
 * 4. 如果获取失败，尝试读取过期的缓存，如果有就返回过期缓存
 * 5. 如果连过期缓存都没有，生成"RSS已失效"的占位符并缓存，返回占位符
 */
async function proxyRSS(targetUrl) {
  // 记录访问
  recordAccess(targetUrl);

  console.log(`[RSS代理] 开始处理: ${targetUrl}`);

  // ========== 步骤1: 尝试读取未过期的缓存 ==========
  const freshCache = await readRSSCacheFromGist(targetUrl, false);
  if (freshCache && !freshCache.expired) {
    console.log(`[RSS代理] 使用新鲜缓存`);
    return {
      success: true,
      data: freshCache.data,
      contentType: freshCache.contentType,
      fromCache: true,
      cacheStatus: 'fresh'
    };
  }

  // ========== 步骤2: 渐进式重试获取最新RSS ==========
  console.log(`[RSS代理] 缓存已过期或不存在，开始获取最新RSS`);
  const fetchResult = await fetchRSSWithRetry(targetUrl);

  if (fetchResult) {
    // ========== 步骤3: 获取成功，写入缓存并返回 ==========
    console.log(`[RSS代理] 成功获取最新RSS`);

    // 异步写入Gist缓存（不阻塞响应）
    writeRSSCacheToGist(targetUrl, fetchResult.data, fetchResult.contentType).catch(err => {
      console.log(`[Gist缓存] 异步写入失败: ${err.message}`);
    });

    return {
      success: true,
      data: fetchResult.data,
      contentType: fetchResult.contentType,
      fromCache: false,
      cacheStatus: 'updated'
    };
  }

  // ========== 步骤4: 获取失败，尝试读取过期缓存 ==========
  console.log(`[RSS代理] 获取最新RSS失败，尝试使用过期缓存`);
  const expiredCache = await readRSSCacheFromGist(targetUrl, true);

  if (expiredCache) {
    console.log(`[RSS代理] 使用过期缓存作为降级方案`);
    return {
      success: true,
      data: expiredCache.data,
      contentType: expiredCache.contentType,
      fromCache: true,
      cacheStatus: 'stale'
    };
  }

  // ========== 步骤5: 无缓存可用，生成"RSS已失效"占位符 ==========
  console.log(`[RSS代理] 无任何缓存可用，生成占位符RSS`);
  const unavailableRSS = generateUnavailableRSS(targetUrl);

  // 将占位符缓存起来（避免频繁重试）
  writeRSSCacheToGist(targetUrl, unavailableRSS, 'application/xml; charset=utf-8').catch(err => {
    console.log(`[Gist缓存] 异步写入占位符失败: ${err.message}`);
  });

  return {
    success: false,
    data: unavailableRSS,
    contentType: 'application/xml; charset=utf-8',
    fromCache: false,
    cacheStatus: 'unavailable'
  };
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

// 启动时加载数据（异步，不阻塞）
loadAccessLog().catch(err => {
  console.log(`[访问记录] 启动加载失败: ${err.message}`);
});

loadBlacklist().catch(err => {
  console.log(`[黑名单] 启动加载失败: ${err.message}`);
});

loadBannedIPs().catch(err => {
  console.log(`[频率限制] 启动加载封禁IP失败: ${err.message}`);
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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('url');

    // RSS代理功能
    if (targetUrl) {
      // RSS代理只接受GET请求
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'RSS代理只支持GET请求' });
        return;
      }

      console.log(`[请求] RSS代理: ${targetUrl}`);

      // 获取客户端IP并检查频率限制
      const clientIP = req.headers['x-forwarded-for']?.split(',')[0] ||
                      req.headers['x-real-ip'] ||
                      req.connection?.remoteAddress ||
                      'unknown';

      if (!checkRateLimit(clientIP)) {
        res.status(429).json({
          error: '请求过于频繁',
          message: `您的IP已被暂时封禁，请稍后再试`
        });
        return;
      }

      // 验证URL
      if (!isValidUrl(targetUrl)) {
        res.status(400).json({
          error: '无效的URL',
          message: '只支持http/https协议，不支持访问内网地址'
        });
        return;
      }

      // 检查黑名单
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
      res.setHeader('X-RSSJumper-Version', VERSION);
      res.setHeader('X-RSSJumper-Status', result.success ? 'success' : 'error');
      res.setHeader('X-RSSJumper-Cache', result.fromCache ? 'HIT' : 'MISS');
      // 缓存状态: fresh(新鲜), updated(已更新), stale(过期但可用), unavailable(不可用)
      res.setHeader('X-RSSJumper-Cache-Status', result.cacheStatus || 'unknown');

      // 返回RSS内容
      res.status(200).send(result.data);
      return;
    }

    // 管理后台
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
        try {
          const data = req.body || {};

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
            // 添加到黑名单
            if (!data.url) {
              res.status(400).json({ success: false, message: '缺少URL参数' });
              return;
            }
            await addToBlacklist(data.url);
            res.status(200).json({ success: true, message: '已添加到黑名单' });
          } else if (data.action === 'removeBlacklist') {
            // 从黑名单移除
            if (!data.url) {
              res.status(400).json({ success: false, message: '缺少URL参数' });
              return;
            }
            await removeFromBlacklist(data.url);
            res.status(200).json({ success: true, message: '已从黑名单移除' });
          } else if (data.action === 'resetAccessCount') {
            // 清零访问记录
            await resetAccessLog();
            res.status(200).json({ success: true, message: '访问记录已清零' });
          } else if (data.action === 'clearCache') {
            // 清除指定URL的缓存
            if (!data.url) {
              res.status(400).json({ success: false, message: '缺少URL参数' });
              return;
            }
            const success = await deleteRSSCacheFromGist(data.url);
            if (success) {
              res.status(200).json({ success: true, message: '缓存已清除' });
            } else {
              res.status(500).json({ success: false, message: '清除缓存失败' });
            }
          } else if (data.action === 'refreshCache') {
            // 手动刷新指定URL的缓存
            if (!data.url) {
              res.status(400).json({ success: false, message: '缺少URL参数' });
              return;
            }

            // 先删除旧缓存
            await deleteRSSCacheFromGist(data.url);

            // 获取最新RSS
            const fetchResult = await fetchRSSWithRetry(data.url);

            if (fetchResult) {
              // 写入新缓存
              await writeRSSCacheToGist(data.url, fetchResult.content, fetchResult.contentType);
              res.status(200).json({ success: true, message: '缓存更新成功' });
            } else {
              res.status(500).json({ success: false, message: '获取RSS失败，无法更新缓存' });
            }
          } else {
            res.status(400).json({ success: false, message: '未知操作' });
          }
        } catch (error) {
          console.error('[管理后台] POST请求处理错误:', error);
          res.status(400).json({ success: false, message: '请求数据格式错误: ' + error.message });
        }
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
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div>
            <div class="stat-value" id="stat-access">-</div>
            <div class="stat-label">今日访问总数</div>
          </div>
          <button onclick="resetAccessCount()" style="background: none; border: none; cursor: pointer; font-size: 1.5em; padding: 10px; color: #dc3545; transition: transform 0.2s;" title="清零访问记录" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">🔄</button>
        </div>
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
          '<table><thead><tr><th>RSS URL</th><th>文件大小</th><th>缓存时间</th><th>缓存年龄</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
          data.cacheFiles.map(file => {
            const escapedUrl = escapeHtml(file.url);
            const encodedUrl = encodeURIComponent(file.url);

            // 生成四色状态按钮（样式与访问记录的操作按钮一致）
            let statusButton = '';
            switch(file.cacheStatus) {
              case 'fresh':
                // 新鲜 - 绿色，不可点击
                statusButton = '<span class="action-btn" style="background: #28a745; cursor: default;">' + file.cacheStatusText + '</span>';
                break;
              case 'normal':
                // 普通 - 蓝色，可点击
                statusButton = '<button class="action-btn" style="background: #007bff;" onclick="refreshCache(\'' + encodedUrl + '\')">' + file.cacheStatusText + '</button>';
                break;
              case 'stale':
                // 旧 - 黄色，可点击
                statusButton = '<button class="action-btn" style="background: #ffc107; color: #000;" onclick="refreshCache(\'' + encodedUrl + '\')">' + file.cacheStatusText + '</button>';
                break;
              case 'unavailable':
                // 失效 - 红色，可点击
                statusButton = '<button class="action-btn" style="background: #dc3545;" onclick="refreshCache(\'' + encodedUrl + '\')">' + file.cacheStatusText + '</button>';
                break;
              default:
                statusButton = '<span class="action-btn" style="background: #6c757d;">' + file.cacheStatusText + '</span>';
            }

            return '<tr>' +
              '<td class="url-cell" title="' + escapedUrl + '">' + escapedUrl + '</td>' +
              '<td>' + (file.size / 1024).toFixed(2) + ' KB</td>' +
              '<td>' + file.cachedAt + '</td>' +
              '<td>' + file.age + '</td>' +
              '<td>' + statusButton + '</td>' +
              '<td>' +
                '<button class="action-btn delete-btn" onclick="clearCache(\'' + encodedUrl + '\')">清除</button>' +
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

    // 切换黑名单状态
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

    // 清零访问记录
    async function resetAccessCount() {
      if (!confirm('确定要清零所有访问记录吗？此操作不可恢复！')) {
        return;
      }

      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resetAccessCount' })
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

    // 手动刷新缓存（拉取最新内容）
    async function refreshCache(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要手动拉取并更新这个URL的缓存吗？\n\n' + url)) {
        return;
      }

      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refreshCache', url })
        });

        const result = await response.json();
        if (result.success) {
          alert('缓存更新成功！');
          loadData(); // 刷新数据
        } else {
          alert('缓存更新失败: ' + (result.message || '未知错误'));
        }
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 清除缓存
    async function clearCache(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要清除这个URL的缓存吗？\n\n' + url)) {
        return;
      }

      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clearCache', url })
        });

        const result = await response.json();
        if (result.success) {
          alert('缓存已清除！');
          loadData(); // 刷新数据
        } else {
          alert('清除缓存失败: ' + (result.message || '未知错误'));
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

    // 首页显示
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
        <div class="feature-icon">🎯</div>
        <div class="feature-title">RSS代理</div>
        <div class="feature-desc">突破限制访问订阅源</div>
      </div>
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <div class="feature-title">智能缓存</div>
        <div class="feature-desc">15分钟快速响应</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🛡️</div>
        <div class="feature-title">安全防护</div>
        <div class="feature-desc">频率限制+黑名单</div>
      </div>
    </div>

    <div class="usage">
      <h2>使用方法</h2>
      <div class="example">
        <strong>格式：</strong><br>
        <code>https://your-domain.com/?url=RSS源地址</code>
      </div>
      <div class="example">
        <strong>示例：</strong><br>
        <code>https://your-domain.com/?url=https://example.com/rss/feed.xml</code>
      </div>
      <p style="margin-top: 10px; color: #999; font-size: 0.9em;text-align: center;">
        ⚠️ 注意：此服务仅支持RSS/Atom订阅源，不支持普通网页
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
