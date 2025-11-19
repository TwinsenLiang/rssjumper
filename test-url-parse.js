#!/usr/bin/env node

/**
 * 测试URL参数解析逻辑
 */

// 模拟不同的URL情况
const testCases = [
  {
    name: '编码格式',
    reqUrl: '/?url=https%3A%2F%2Frthk9.rthk.hk%2Frthk%2Fnews%2Frss%2Fc_expressnews_clocal.xml',
    host: 'rssjumper.vercel.app'
  },
  {
    name: '非编码格式',
    reqUrl: '/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml',
    host: 'rssjumper.vercel.app'
  },
  {
    name: 'Vercel可能的路由格式1',
    reqUrl: '/api/index?url=https%3A%2F%2Frthk9.rthk.hk%2Frthk%2Fnews%2Frss%2Fc_expressnews_clocal.xml',
    host: 'rssjumper.vercel.app'
  },
  {
    name: 'Vercel可能的路由格式2',
    reqUrl: '?url=https%3A%2F%2Frthk9.rthk.hk%2Frthk%2Fnews%2Frss%2Fc_expressnews_clocal.xml',
    host: 'rssjumper.vercel.app'
  }
];

console.log('========================================');
console.log('测试URL参数解析逻辑');
console.log('========================================\n');

testCases.forEach((testCase, index) => {
  console.log(`【测试 ${index + 1}】${testCase.name}`);
  console.log(`req.url: ${testCase.reqUrl}`);
  console.log(`req.headers.host: ${testCase.host}`);

  try {
    const url = new URL(testCase.reqUrl, `http://${testCase.host}`);
    const targetUrl = url.searchParams.get('url');

    console.log(`解析结果: ${targetUrl}`);

    if (targetUrl) {
      console.log('✓ targetUrl存在，会进入RSS代理逻辑');
    } else {
      console.log('✗ targetUrl为null，会显示首页');
    }
  } catch (error) {
    console.log(`✗ 解析失败: ${error.message}`);
  }

  console.log('');
});

console.log('========================================');
