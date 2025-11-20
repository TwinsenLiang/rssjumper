#!/bin/bash

# RSS实时对比诊断工具
# 使用curl实时获取两个URL并对比

echo "============================================================"
echo "RSS实时对比诊断工具"
echo "============================================================"

if [ $# -ne 2 ]; then
    echo ""
    echo "使用方法:"
    echo "  $0 <原始RSS URL> <代理RSS URL>"
    echo ""
    echo "示例:"
    echo "  $0 \\"
    echo "    'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml' \\"
    echo "    'https://rssjumper.vercel.app/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_clocal.xml'"
    exit 1
fi

ORIGINAL_URL="$1"
PROXY_URL="$2"
TEMP_DIR=$(mktemp -d)
ORIGINAL_FILE="$TEMP_DIR/original.xml"
PROXY_FILE="$TEMP_DIR/proxy.xml"
ORIGINAL_HEADERS="$TEMP_DIR/original-headers.txt"
PROXY_HEADERS="$TEMP_DIR/proxy-headers.txt"

echo ""
echo "[1/4] 获取原始RSS..."
curl -k -s -D "$ORIGINAL_HEADERS" "$ORIGINAL_URL" > "$ORIGINAL_FILE"
if [ $? -ne 0 ]; then
    echo "✗ 获取原始RSS失败"
    rm -rf "$TEMP_DIR"
    exit 1
fi
echo "✓ 状态码: $(grep -E '^HTTP' "$ORIGINAL_HEADERS" | tail -1)"
echo "✓ Content-Type: $(grep -i '^Content-Type' "$ORIGINAL_HEADERS" | cut -d' ' -f2-)"
echo "✓ 内容长度: $(wc -c < "$ORIGINAL_FILE" | xargs) 字节"

echo ""
echo "[2/4] 获取代理RSS..."
curl -k -s -D "$PROXY_HEADERS" "$PROXY_URL" > "$PROXY_FILE"
if [ $? -ne 0 ]; then
    echo "✗ 获取代理RSS失败"
    rm -rf "$TEMP_DIR"
    exit 1
fi
echo "✓ 状态码: $(grep -E '^HTTP' "$PROXY_HEADERS" | tail -1)"
echo "✓ Content-Type: $(grep -i '^Content-Type' "$PROXY_HEADERS" | cut -d' ' -f2-)"
echo "✓ 缓存状态: $(grep -i '^X-RSSJumper-Cache' "$PROXY_HEADERS" | cut -d' ' -f2- || echo 'N/A')"
echo "✓ 内容长度: $(wc -c < "$PROXY_FILE" | xargs) 字节"

echo ""
echo "[3/4] 提取pubDate..."
ORIGINAL_PUBDATE=$(grep -oE '<pubDate>.*</pubDate>' "$ORIGINAL_FILE" | head -1 | sed 's/<[^>]*>//g')
PROXY_PUBDATE=$(grep -oE '<pubDate>.*</pubDate>' "$PROXY_FILE" | head -1 | sed 's/<[^>]*>//g')

echo "  原始RSS: $ORIGINAL_PUBDATE"
echo "  代理RSS: $PROXY_PUBDATE"

echo ""
echo "[4/4] 对比分析..."
if cmp -s "$ORIGINAL_FILE" "$PROXY_FILE"; then
    echo "✓ 两个RSS内容完全一致，没有问题！"
else
    echo "⚠️  两个RSS内容存在差异"

    if [ "$ORIGINAL_PUBDATE" != "$PROXY_PUBDATE" ]; then
        echo "   - pubDate不同"
    fi

    CACHE_STATUS=$(grep -i '^X-RSSJumper-Cache' "$PROXY_HEADERS" | cut -d' ' -f2- | tr -d '\r\n' || echo '')
    if [ "$CACHE_STATUS" = "HIT" ]; then
        echo "   可能原因: 代理返回的是缓存版本（X-RSSJumper-Cache: HIT）"
        echo "   建议: 等待15分钟缓存过期后重试，或修改缓存策略"
    elif [ "$CACHE_STATUS" = "MISS" ]; then
        echo "   可能原因: 代理实时抓取但内容仍有差异"
        echo "   建议: 检查代理代码是否修改了RSS内容"
    fi
fi

echo ""
echo "============================================================"
echo "诊断结论"
echo "============================================================"

# 显示缓存状态的详细信息
CACHE_STATUS=$(grep -i '^X-RSSJumper-Cache' "$PROXY_HEADERS" | cut -d' ' -f2- | tr -d '\r\n' || echo 'UNKNOWN')
echo "代理缓存状态: $CACHE_STATUS"

if [ "$CACHE_STATUS" = "HIT" ]; then
    echo ""
    echo "✓ 确认问题: 代理使用了缓存，导致pubDate是旧的"
    echo "  这是正常行为，缓存TTL为15分钟"
    echo ""
    echo "解决方案："
    echo "  1. [推荐] 接受这个行为，缓存可以减少源站压力"
    echo "  2. 等待15分钟缓存过期后重新测试"
    echo "  3. 修改代码缩短CACHE_TTL时间"
fi

# 清理临时文件
rm -rf "$TEMP_DIR"

echo ""
echo "检查完成"
echo "============================================================"
