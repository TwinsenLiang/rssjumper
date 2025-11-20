#!/usr/bin/env node

/**
 * 测试axios对响应的处理
 * 检查是否需要禁用transformResponse
 */

const axios = require('axios');

async function test() {
  const testUrl = 'https://rssjumper.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml';

  console.log('测试1: 默认配置（responseType: text）');
  try {
    const resp1 = await axios.get(testUrl, {
      responseType: 'text',
      timeout: 15000
    });
    console.log('Content-Type:', resp1.headers['content-type']);
    console.log('Data类型:', typeof resp1.data);
    console.log('Data前100字符:', resp1.data.substring(0, 100));
    console.log('是否包含中文:', /[\u4e00-\u9fa5]/.test(resp1.data) ? '是' : '否');
  } catch (e) {
    console.error('错误:', e.message);
  }

  console.log('\n测试2: 禁用transformResponse');
  try {
    const resp2 = await axios.get(testUrl, {
      responseType: 'text',
      transformResponse: [(data) => data], // 不做任何转换
      timeout: 15000
    });
    console.log('Content-Type:', resp2.headers['content-type']);
    console.log('Data类型:', typeof resp2.data);
    console.log('Data前100字符:', resp2.data.substring(0, 100));
    console.log('是否包含中文:', /[\u4e00-\u9fa5]/.test(resp2.data) ? '是' : '否');
  } catch (e) {
    console.error('错误:', e.message);
  }

  console.log('\n测试3: 使用arraybuffer');
  try {
    const resp3 = await axios.get(testUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    const data = Buffer.from(resp3.data).toString('utf-8');
    console.log('Content-Type:', resp3.headers['content-type']);
    console.log('Data类型:', resp3.data.constructor.name);
    console.log('转UTF-8后前100字符:', data.substring(0, 100));
    console.log('是否包含中文:', /[\u4e00-\u9fa5]/.test(data) ? '是' : '否');
  } catch (e) {
    console.error('错误:', e.message);
  }
}

test();
