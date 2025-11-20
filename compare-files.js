#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(60));
console.log('RSS内容对比工具');
console.log('='.repeat(60));

console.log('\n使用方法：');
console.log('1. 在浏览器中访问原始RSS，右键"另存为" original.xml');
console.log('2. 在浏览器中访问代理RSS，右键"另存为" proxy.xml');
console.log('3. 将两个文件放在当前目录');
console.log('4. 运行: node compare-files.js original.xml proxy.xml\n');

const file1 = process.argv[2] || 'original.xml';
const file2 = process.argv[3] || 'proxy.xml';

if (!fs.existsSync(file1)) {
  console.error(`错误: 文件不存在: ${file1}`);
  process.exit(1);
}

if (!fs.existsSync(file2)) {
  console.error(`错误: 文件不存在: ${file2}`);
  process.exit(1);
}

console.log(`对比文件:`);
console.log(`  文件1: ${file1}`);
console.log(`  文件2: ${file2}\n`);

const content1 = fs.readFileSync(file1, 'utf8');
const content2 = fs.readFileSync(file2, 'utf8');

console.log('========== 基本信息 ==========');
console.log(`文件1长度: ${content1.length} 字符`);
console.log(`文件2长度: ${content2.length} 字符`);
console.log(`长度差异: ${Math.abs(content1.length - content2.length)} 字符`);
console.log(`内容完全相同: ${content1 === content2 ? '✅ 是' : '❌ 否'}\n`);

if (content1 === content2) {
  console.log('两个文件内容完全一致！');
  process.exit(0);
}

console.log('========== XML声明对比 ==========');
const xml1Decl = content1.match(/<\?xml[^?]*\?>/);
const xml2Decl = content2.match(/<\?xml[^?]*\?>/);
console.log(`文件1: ${xml1Decl ? xml1Decl[0] : '未找到'}`);
console.log(`文件2: ${xml2Decl ? xml2Decl[0] : '未找到'}\n`);

console.log('========== 前500字符对比 ==========');
console.log('文件1:');
console.log(content1.substring(0, 500));
console.log('\n文件2:');
console.log(content2.substring(0, 500));
console.log();

console.log('========== 字符差异详情（前20处）==========');
let diffCount = 0;
const maxDiff = 20;
for (let i = 0; i < Math.min(content1.length, content2.length) && diffCount < maxDiff; i++) {
  if (content1[i] !== content2[i]) {
    const c1 = content1[i];
    const c2 = content2[i];
    const code1 = c1.charCodeAt(0);
    const code2 = c2.charCodeAt(0);

    console.log(`位置 ${i}:`);
    console.log(`  文件1: '${c1}' (Unicode: U+${code1.toString(16).toUpperCase().padStart(4, '0')}, 十进制: ${code1})`);
    console.log(`  文件2: '${c2}' (Unicode: U+${code2.toString(16).toUpperCase().padStart(4, '0')}, 十进制: ${code2})`);
    console.log(`  上下文: ...${content1.substring(Math.max(0, i-10), i+10)}...`);
    console.log();
    diffCount++;
  }
}

if (diffCount === 0 && content1.length !== content2.length) {
  console.log('前面部分相同，但长度不同（一个文件可能被截断）');
  console.log(`文件1末尾: ...${content1.substring(content1.length - 100)}`);
  console.log(`文件2末尾: ...${content2.substring(content2.length - 100)}`);
}

// 写入diff文件
const diffLines = [];
const lines1 = content1.split('\n');
const lines2 = content2.split('\n');
const maxLines = Math.max(lines1.length, lines2.length);

console.log(`\n========== 行差异对比（总共${maxLines}行）==========`);
let lineDiffCount = 0;
for (let i = 0; i < Math.min(maxLines, 50); i++) {
  const line1 = lines1[i] || '';
  const line2 = lines2[i] || '';
  if (line1 !== line2) {
    lineDiffCount++;
    if (lineDiffCount <= 10) {
      console.log(`\n行 ${i + 1} 不同:`);
      console.log(`  文件1: ${line1.substring(0, 100)}${line1.length > 100 ? '...' : ''}`);
      console.log(`  文件2: ${line2.substring(0, 100)}${line2.length > 100 ? '...' : ''}`);
    }
  }
}

console.log(`\n共发现 ${lineDiffCount} 行不同`);
