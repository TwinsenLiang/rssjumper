#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

async function fetchAndCompare() {
  const originalUrl = 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml';
  const proxyUrl = 'https://rssjumper.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml';

  console.log('开始获取两个URL的内容...\n');

  try {
    // 获取原始RSS
    console.log('1. 获取原始RSS...');
    const originalResponse = await axios.get(originalUrl, {
      timeout: 15000,
      responseType: 'text',
      transformResponse: [(data) => data] // 不做任何转换
    });

    // 获取代理RSS
    console.log('2. 获取代理RSS...');
    const proxyResponse = await axios.get(proxyUrl, {
      timeout: 15000,
      responseType: 'text',
      transformResponse: [(data) => data] // 不做任何转换
    });

    console.log('\n========== 响应头对比 ==========');
    console.log('\n【原始RSS】');
    console.log('Content-Type:', originalResponse.headers['content-type']);
    console.log('Content-Length:', originalResponse.headers['content-length']);
    console.log('Content-Encoding:', originalResponse.headers['content-encoding']);
    console.log('Transfer-Encoding:', originalResponse.headers['transfer-encoding']);

    console.log('\n【代理RSS】');
    console.log('Content-Type:', proxyResponse.headers['content-type']);
    console.log('Content-Length:', proxyResponse.headers['content-length']);
    console.log('Content-Encoding:', proxyResponse.headers['content-encoding']);
    console.log('X-RSSJumper-Cache:', proxyResponse.headers['x-rssjumper-cache']);
    console.log('X-RSSJumper-Status:', proxyResponse.headers['x-rssjumper-status']);

    console.log('\n========== 内容对比 ==========');
    const originalContent = originalResponse.data;
    const proxyContent = proxyResponse.data;

    console.log('原始内容长度:', originalContent.length, '字节');
    console.log('代理内容长度:', proxyContent.length, '字节');
    console.log('内容相同:', originalContent === proxyContent ? '✅ 是' : '❌ 否');

    // 保存到文件
    fs.writeFileSync('original-rss.xml', originalContent, 'utf8');
    fs.writeFileSync('proxy-rss.xml', proxyContent, 'utf8');
    console.log('\n已保存到文件：');
    console.log('  - original-rss.xml');
    console.log('  - proxy-rss.xml');

    if (originalContent !== proxyContent) {
      console.log('\n========== 差异分析 ==========');

      // 检查前100个字符
      console.log('\n【原始RSS前200字符】');
      console.log(originalContent.substring(0, 200));
      console.log('\n【代理RSS前200字符】');
      console.log(proxyContent.substring(0, 200));

      // 检查字节差异
      console.log('\n字节差异位置（前10个）:');
      let diffCount = 0;
      for (let i = 0; i < Math.min(originalContent.length, proxyContent.length) && diffCount < 10; i++) {
        if (originalContent[i] !== proxyContent[i]) {
          console.log(`位置 ${i}: 原始='${originalContent[i]}' (0x${originalContent.charCodeAt(i).toString(16)}) vs 代理='${proxyContent[i]}' (0x${proxyContent.charCodeAt(i).toString(16)})`);
          diffCount++;
        }
      }

      // 检查编码
      console.log('\n【编码检测】');
      const originalEncoding = originalContent.match(/encoding=["']([^"']+)["']/i);
      const proxyEncoding = proxyContent.match(/encoding=["']([^"']+)["']/i);
      console.log('原始声明编码:', originalEncoding ? originalEncoding[1] : '未找到');
      console.log('代理声明编码:', proxyEncoding ? proxyEncoding[1] : '未找到');
    }

    console.log('\n========== XML解析测试 ==========');

    // 尝试解析XML
    try {
      const { DOMParser } = require('@xmldom/xmldom');
      const parser = new DOMParser();

      const originalDoc = parser.parseFromString(originalContent, 'text/xml');
      const proxyDoc = parser.parseFromString(proxyContent, 'text/xml');

      const originalItems = originalDoc.getElementsByTagName('item').length;
      const proxyItems = proxyDoc.getElementsByTagName('item').length;

      console.log('原始RSS item数量:', originalItems);
      console.log('代理RSS item数量:', proxyItems);
      console.log('Item数量相同:', originalItems === proxyItems ? '✅ 是' : '❌ 否');
    } catch (xmlError) {
      console.log('XML解析失败（可能需要安装 @xmldom/xmldom）');
      console.log('运行: npm install @xmldom/xmldom');
    }

  } catch (error) {
    console.error('错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data.substring(0, 500));
    }
  }
}

fetchAndCompare();
