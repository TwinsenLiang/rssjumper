#!/usr/bin/env node

/**
 * 调试第1-2步：检查RSS代理是否正常工作
 */

const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('========================================');
  console.log('调试第1-2步：RSS代理功能测试');
  console.log('========================================\n');

  const baseUrl = 'https://rssjumper.vercel.app';
  const rssUrl = 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml';
  const encodedRssUrl = encodeURIComponent(rssUrl);

  // 测试1：访问首页
  console.log('【测试1】访问首页...');
  try {
    const result = await httpGet(baseUrl);
    console.log(`状态码: ${result.statusCode}`);
    console.log(`Content-Type: ${result.headers['content-type']}`);

    if (result.statusCode === 200 && result.body.includes('RSSJumper')) {
      console.log('✓ 首页正常\n');
    } else {
      console.log('✗ 首页异常');
      console.log(`响应内容（前500字符）:\n${result.body.substring(0, 500)}\n`);
    }
  } catch (error) {
    console.log(`✗ 首页访问失败: ${error.message}\n`);
  }

  // 测试2：测试RSS代理（URL编码格式）
  console.log('【测试2】RSS代理（URL编码）...');
  const testUrl = `${baseUrl}/?url=${encodedRssUrl}`;
  console.log(`测试URL: ${testUrl}\n`);

  try {
    const result = await httpGet(testUrl);
    console.log(`状态码: ${result.statusCode}`);
    console.log(`Content-Type: ${result.headers['content-type']}`);
    console.log(`X-RSSJumper-Status: ${result.headers['x-rssjumper-status'] || '(无)'}`);
    console.log(`响应大小: ${result.body.length} 字节`);

    // 检查内容
    const isXML = result.body.includes('<?xml') || result.body.includes('<rss');
    const isError = result.body.includes('错误提示');

    console.log(`\n内容分析:`);
    console.log(`- 是XML格式: ${isXML ? '是' : '否'}`);
    console.log(`- 是错误信息: ${isError ? '是' : '否'}`);

    if (result.body.length < 2000) {
      console.log(`\n完整响应内容:\n${result.body}`);
    } else {
      console.log(`\n响应内容（前1000字符）:\n${result.body.substring(0, 1000)}`);
    }

    if (result.statusCode === 200 && isXML && !isError) {
      console.log('\n✓ RSS代理成功！');
    } else {
      console.log('\n✗ RSS代理异常');
    }
  } catch (error) {
    console.log(`✗ RSS代理失败: ${error.message}`);
  }

  console.log('\n========================================');
}

test().catch(console.error);
