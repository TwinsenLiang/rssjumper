#!/usr/bin/env python3
"""
RSS内容对比诊断工具
用于检查原始RSS和代理RSS的差异
"""

import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
import difflib
import ssl

def fetch_rss(url):
    """获取RSS内容并返回原始文本和响应头"""
    print(f"\n{'='*60}")
    print(f"正在获取: {url}")
    print('='*60)

    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')

    # 禁用SSL验证（仅用于测试）
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
            content = response.read().decode('utf-8')
            headers = dict(response.headers)

            print(f"✓ 状态码: {response.status}")
            print(f"✓ Content-Type: {headers.get('Content-Type', 'N/A')}")
            print(f"✓ 缓存状态: {headers.get('X-Rssjumper-Cache', 'N/A')}")
            print(f"✓ 内容长度: {len(content)} 字符")

            return content, headers
    except Exception as e:
        print(f"✗ 错误: {e}")
        return None, None

def extract_pubdate(xml_content):
    """从RSS内容中提取pubDate"""
    try:
        root = ET.fromstring(xml_content)
        # 查找channel下的pubDate
        pubdate = root.find('.//channel/pubDate')
        if pubdate is not None:
            return pubdate.text
        return None
    except Exception as e:
        print(f"⚠️  解析XML失败: {e}")
        return None

def compare_content(content1, content2):
    """对比两个内容并显示差异"""
    print(f"\n{'='*60}")
    print("内容对比分析")
    print('='*60)

    # 基本信息
    print(f"文件1长度: {len(content1)} 字符")
    print(f"文件2长度: {len(content2)} 字符")
    print(f"长度差异: {abs(len(content1) - len(content2))} 字符")
    print(f"内容完全相同: {'✓ 是' if content1 == content2 else '✗ 否'}")

    # 提取pubDate
    pubdate1 = extract_pubdate(content1)
    pubdate2 = extract_pubdate(content2)

    print(f"\npubDate对比:")
    print(f"  文件1: {pubdate1 or '未找到'}")
    print(f"  文件2: {pubdate2 or '未找到'}")

    if pubdate1 and pubdate2 and pubdate1 != pubdate2:
        print(f"  ⚠️  pubDate不同！")
    elif pubdate1 == pubdate2:
        print(f"  ✓ pubDate相同")

    # 字符级差异统计
    if content1 != content2:
        diff_count = sum(1 for c1, c2 in zip(content1, content2) if c1 != c2)
        print(f"\n字符差异: {diff_count} 处")

        # 显示前5处差异
        print(f"\n前5处字符差异:")
        diff_found = 0
        for i, (c1, c2) in enumerate(zip(content1, content2)):
            if c1 != c2 and diff_found < 5:
                context_start = max(0, i - 15)
                context_end = min(len(content1), i + 15)
                print(f"\n  位置 {i}:")
                print(f"    文件1: '{c1}' (在上下文: ...{content1[context_start:context_end]}...)")
                print(f"    文件2: '{c2}' (在上下文: ...{content2[context_start:context_end]}...)")
                diff_found += 1

def main():
    """主函数"""
    print("="*60)
    print("RSS内容对比诊断工具")
    print("="*60)

    if len(sys.argv) != 3:
        print("\n使用方法:")
        print(f"  {sys.argv[0]} <原始RSS URL> <代理RSS URL>")
        print("\n示例:")
        print(f"  {sys.argv[0]} \\")
        print(f"    'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml' \\")
        print(f"    'https://rssjumper.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml'")
        sys.exit(1)

    original_url = sys.argv[1]
    proxy_url = sys.argv[2]

    # 获取原始RSS
    print("\n[1/2] 获取原始RSS")
    content1, headers1 = fetch_rss(original_url)
    if content1 is None:
        print("✗ 无法获取原始RSS，退出")
        sys.exit(1)

    # 获取代理RSS
    print("\n[2/2] 获取代理RSS")
    content2, headers2 = fetch_rss(proxy_url)
    if content2 is None:
        print("✗ 无法获取代理RSS，退出")
        sys.exit(1)

    # 对比内容
    compare_content(content1, content2)

    # 检查缓存状态
    cache_status = headers2.get('X-Rssjumper-Cache', 'UNKNOWN')
    print(f"\n{'='*60}")
    print("诊断结论")
    print('='*60)

    if content1 == content2:
        print("✓ 两个RSS内容完全一致，没有问题！")
    else:
        print("⚠️  两个RSS内容存在差异")
        if cache_status == 'HIT':
            print("   可能原因: 代理返回的是缓存版本（X-RSSJumper-Cache: HIT）")
            print("   建议: 等待15分钟缓存过期后重试，或修改缓存策略")
        elif cache_status == 'MISS':
            print("   可能原因: 代理实时抓取但内容仍有差异")
            print("   建议: 检查代理代码是否修改了RSS内容")
        else:
            print(f"   缓存状态未知: {cache_status}")

    print(f"\n{'='*60}")
    print("检查完成")
    print('='*60)

if __name__ == '__main__':
    main()
