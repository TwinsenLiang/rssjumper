#!/usr/bin/env node

/**
 * 本地逻辑测试 - 不依赖网络连接
 * 验证路由优先级和参数解析
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

log('cyan', '\n========================================');
log('cyan', 'RSSJumper 本地逻辑测试');
log('cyan', '========================================\n');

// 模拟URL解析
function testUrlParsing() {
  log('blue', '【测试1】URL参数解析');

  const testCases = [
    {
      desc: 'URL编码格式',
      url: '/?url=https%3A%2F%2Frthk9.rthk.hk%2Frthk%2Fnews%2Frss%2Fc_expressnews_clocal.xml',
      expectedUrl: 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
      expectedPassword: null
    },
    {
      desc: '非编码格式',
      url: '/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
      expectedUrl: 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
      expectedPassword: null
    },
    {
      desc: '带密码参数',
      url: '/api/admin?password=test123',
      expectedUrl: null,
      expectedPassword: 'test123'
    },
    {
      desc: '同时有url和password（url应优先）',
      url: '/?url=https://test.com/rss.xml&password=test123',
      expectedUrl: 'https://test.com/rss.xml',
      expectedPassword: 'test123'
    }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const fullUrl = `http://localhost:3000${testCase.url}`;
    const parsedUrl = new URL(fullUrl);
    const targetUrl = parsedUrl.searchParams.get('url');
    const password = parsedUrl.searchParams.get('password');

    const urlMatch = targetUrl === testCase.expectedUrl;
    const passwordMatch = password === testCase.expectedPassword;

    if (urlMatch && passwordMatch) {
      log('green', `  ✓ ${testCase.desc}`);
      log('green', `    解析URL: ${targetUrl || '(null)'}`);
      if (password) log('green', `    解析密码: ${password}`);
      passed++;
    } else {
      log('red', `  ✗ ${testCase.desc}`);
      log('red', `    期望URL: ${testCase.expectedUrl}, 实际: ${targetUrl}`);
      log('red', `    期望密码: ${testCase.expectedPassword}, 实际: ${password}`);
      failed++;
    }
  });

  console.log('');
  return { passed, failed };
}

// 测试路由优先级逻辑
function testRoutingPriority() {
  log('blue', '【测试2】路由优先级逻辑模拟');

  const testCases = [
    {
      desc: '只有url参数 -> 应走RSS代理',
      url: '/?url=https://test.com/rss.xml',
      expectedRoute: 'RSS代理'
    },
    {
      desc: '只有password参数 -> 应走管理后台',
      url: '/?password=test123',
      expectedRoute: '管理后台'
    },
    {
      desc: 'url和password都有 -> url优先，应走RSS代理',
      url: '/?url=https://test.com/rss.xml&password=test123',
      expectedRoute: 'RSS代理'
    },
    {
      desc: '都没有 -> 应显示首页',
      url: '/',
      expectedRoute: '首页'
    }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase) => {
    const fullUrl = `http://localhost:3000${testCase.url}`;
    const parsedUrl = new URL(fullUrl);
    const targetUrl = parsedUrl.searchParams.get('url');
    const password = parsedUrl.searchParams.get('password');

    // 模拟api/index.js的路由逻辑（第424-599行）
    let actualRoute;
    if (targetUrl) {
      actualRoute = 'RSS代理';
    } else if (password) {
      actualRoute = '管理后台';
    } else {
      actualRoute = '首页';
    }

    if (actualRoute === testCase.expectedRoute) {
      log('green', `  ✓ ${testCase.desc}`);
      log('green', `    路由到: ${actualRoute}`);
      passed++;
    } else {
      log('red', `  ✗ ${testCase.desc}`);
      log('red', `    期望: ${testCase.expectedRoute}, 实际: ${actualRoute}`);
      failed++;
    }
  });

  console.log('');
  return { passed, failed };
}

// 测试URL验证逻辑
function testUrlValidation() {
  log('blue', '【测试3】URL验证逻辑');

  // 从api/index.js复制的验证函数
  function isPrivateIP(hostname) {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (match) {
      const [, a, b, c, d] = match.map(Number);

      if (a > 255 || b > 255 || c > 255 || d > 255) {
        return true;
      }

      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
      if (a >= 224) return true;
    }

    if (hostname.includes(':')) {
      const lowerHostname = hostname.toLowerCase();
      if (lowerHostname.startsWith('fc') || lowerHostname.startsWith('fd')) {
        return true;
      }
      if (lowerHostname.startsWith('fe80')) {
        return true;
      }
    }

    return false;
  }

  function isValidRssUrl(url) {
    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      if (isPrivateIP(parsedUrl.hostname)) {
        return false;
      }

      const pathname = parsedUrl.pathname.toLowerCase();
      if (pathname.includes('.xml') || pathname.includes('rss') || pathname.includes('feed')) {
        return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  const testCases = [
    { url: 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml', expected: true, desc: '正常RSS URL' },
    { url: 'http://example.com/feed.xml', expected: true, desc: 'HTTP协议RSS' },
    { url: 'ftp://example.com/rss.xml', expected: false, desc: 'FTP协议（应拒绝）' },
    { url: 'https://127.0.0.1/rss.xml', expected: false, desc: '本地IP（应拒绝）' },
    { url: 'https://192.168.1.1/rss.xml', expected: false, desc: '内网IP（应拒绝）' },
    { url: 'https://10.0.0.1/rss.xml', expected: false, desc: '内网IP 10.x（应拒绝）' },
    { url: 'https://localhost/rss.xml', expected: false, desc: 'localhost（应拒绝）' },
    { url: 'not-a-url', expected: false, desc: '无效URL格式' }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase) => {
    const result = isValidRssUrl(testCase.url);
    if (result === testCase.expected) {
      log('green', `  ✓ ${testCase.desc}`);
      log('green', `    URL: ${testCase.url}`);
      log('green', `    验证结果: ${result ? '通过' : '拒绝'}`);
      passed++;
    } else {
      log('red', `  ✗ ${testCase.desc}`);
      log('red', `    URL: ${testCase.url}`);
      log('red', `    期望: ${testCase.expected}, 实际: ${result}`);
      failed++;
    }
  });

  console.log('');
  return { passed, failed };
}

// 运行所有测试
const results = [];

results.push(testUrlParsing());
results.push(testRoutingPriority());
results.push(testUrlValidation());

// 汇总结果
const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

log('cyan', '========================================');
if (totalFailed === 0) {
  log('green', `✓ 所有测试通过 (${totalPassed}/${totalPassed + totalFailed})`);
  log('green', '本地逻辑验证成功！');
} else {
  log('red', `✗ 有 ${totalFailed} 个测试失败`);
  log('yellow', `通过: ${totalPassed}, 失败: ${totalFailed}`);
}
log('cyan', '========================================\n');

process.exit(totalFailed === 0 ? 0 : 1);
