#!/usr/bin/env node

/**
 * RSS代理服务诊断测试脚本
 * 用于排查代理失效问题
 */

const https = require('https');
const http = require('http');

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

function httpRequest(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const startTime = Date.now();

    const req = protocol.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          duration
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('请求超时（20秒）'));
    });
  });
}

async function runTests() {
  log('cyan', '\n========================================');
  log('cyan', 'RSSJumper 代理服务诊断测试');
  log('cyan', '========================================\n');

  const baseUrl = 'https://rssjumper.vercel.app';
  const testRssUrl = 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml';

  // 测试1: 访问首页
  log('blue', '【测试1】访问服务首页...');
  try {
    const result = await httpRequest(baseUrl);
    if (result.statusCode === 200 && result.body.includes('RSSJumper')) {
      log('green', `✓ 首页访问成功 (${result.duration}ms)`);
      log('green', `  状态码: ${result.statusCode}`);
    } else {
      log('red', `✗ 首页内容异常`);
      log('yellow', `  状态码: ${result.statusCode}`);
      log('yellow', `  内容预览: ${result.body.substring(0, 200)}`);
    }
  } catch (error) {
    log('red', `✗ 首页访问失败: ${error.message}`);
  }

  console.log('');

  // 测试2: 测试源RSS是否可访问
  log('blue', '【测试2】检查源RSS是否可访问...');
  try {
    const result = await httpRequest(testRssUrl);
    if (result.statusCode === 200 && (result.body.includes('<?xml') || result.body.includes('<rss'))) {
      log('green', `✓ 源RSS可访问 (${result.duration}ms)`);
      log('green', `  状态码: ${result.statusCode}`);
      log('green', `  Content-Type: ${result.headers['content-type']}`);
    } else {
      log('red', `✗ 源RSS响应异常`);
      log('yellow', `  状态码: ${result.statusCode}`);
    }
  } catch (error) {
    log('red', `✗ 源RSS访问失败: ${error.message}`);
  }

  console.log('');

  // 测试3: 测试RSS代理（URL编码格式）
  log('blue', '【测试3】测试RSS代理（URL编码格式）...');
  const encodedUrl = encodeURIComponent(testRssUrl);
  const proxyUrl1 = `${baseUrl}/?url=${encodedUrl}`;
  log('yellow', `  测试URL: ${proxyUrl1}`);

  try {
    const result = await httpRequest(proxyUrl1);
    log('yellow', `  响应状态码: ${result.statusCode}`);
    log('yellow', `  Content-Type: ${result.headers['content-type']}`);
    log('yellow', `  响应时长: ${result.duration}ms`);

    // 检查自定义响应头
    if (result.headers['x-rssjumper-cache']) {
      log('cyan', `  缓存状态: ${result.headers['x-rssjumper-cache']}`);
    }
    if (result.headers['x-rssjumper-error']) {
      log('red', `  错误标记: ${result.headers['x-rssjumper-error']}`);
    }
    if (result.headers['x-rssjumper-blacklisted']) {
      log('red', `  黑名单标记: ${result.headers['x-rssjumper-blacklisted']}`);
    }

    // 检查响应内容
    const body = result.body;
    const isXml = body.includes('<?xml') || body.includes('<rss') || body.includes('<feed');
    const isError = body.includes('RSSJumper - 错误提示');
    const isJson = result.headers['content-type']?.includes('json');

    if (result.statusCode === 200 && isXml && !isError) {
      log('green', `✓ RSS代理成功返回XML内容`);
      log('green', `  内容长度: ${body.length} 字节`);

      // 提取标题验证
      const titleMatch = body.match(/<title>(.*?)<\/title>/);
      if (titleMatch) {
        log('green', `  RSS标题: ${titleMatch[1]}`);
      }
    } else if (isError) {
      log('red', `✗ RSS代理返回错误RSS`);
      const errorMatch = body.match(/<description>(.*?)<\/description>/);
      if (errorMatch) {
        log('red', `  错误信息: ${errorMatch[1]}`);
      }
      log('yellow', `\n完整响应内容:\n${body}\n`);
    } else if (isJson) {
      log('red', `✗ RSS代理返回JSON错误`);
      try {
        const json = JSON.parse(body);
        log('red', `  错误: ${JSON.stringify(json, null, 2)}`);
      } catch (e) {
        log('red', `  响应: ${body}`);
      }
    } else {
      log('red', `✗ RSS代理响应异常`);
      log('yellow', `  内容预览: ${body.substring(0, 500)}`);
    }
  } catch (error) {
    log('red', `✗ RSS代理请求失败: ${error.message}`);
  }

  console.log('');

  // 测试4: 测试RSS代理（非编码格式）
  log('blue', '【测试4】测试RSS代理（非编码格式）...');
  const proxyUrl2 = `${baseUrl}/?url=${testRssUrl}`;
  log('yellow', `  测试URL: ${proxyUrl2}`);

  try {
    const result = await httpRequest(proxyUrl2);
    log('yellow', `  响应状态码: ${result.statusCode}`);
    log('yellow', `  Content-Type: ${result.headers['content-type']}`);

    const body = result.body;
    const isXml = body.includes('<?xml') || body.includes('<rss') || body.includes('<feed');
    const isError = body.includes('RSSJumper - 错误提示');

    if (result.statusCode === 200 && isXml && !isError) {
      log('green', `✓ RSS代理（非编码）成功`);
    } else if (isError) {
      log('red', `✗ RSS代理（非编码）返回错误`);
      const errorMatch = body.match(/<description>(.*?)<\/description>/);
      if (errorMatch) {
        log('red', `  错误信息: ${errorMatch[1]}`);
      }
    } else {
      log('red', `✗ RSS代理（非编码）响应异常`);
    }
  } catch (error) {
    log('red', `✗ RSS代理（非编码）请求失败: ${error.message}`);
  }

  console.log('');

  // 测试5: 测试无效URL处理
  log('blue', '【测试5】测试无效URL处理...');
  const invalidUrl = `${baseUrl}/?url=ftp://invalid.url`;
  try {
    const result = await httpRequest(invalidUrl);
    if (result.statusCode === 400) {
      log('green', `✓ 无效URL正确拦截 (400)`);
    } else {
      log('yellow', `  状态码: ${result.statusCode} (期望: 400)`);
    }
  } catch (error) {
    log('red', `✗ 测试失败: ${error.message}`);
  }

  console.log('');
  log('cyan', '========================================');
  log('cyan', '测试完成');
  log('cyan', '========================================\n');
}

// 运行测试
runTests().catch(error => {
  log('red', `测试脚本执行失败: ${error.message}`);
  process.exit(1);
});
