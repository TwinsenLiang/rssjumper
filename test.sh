#!/bin/bash

# RSSJumper 自动化测试脚本
# 使用方法: bash test.sh [base_url] [password]
# 示例: bash test.sh https://rssjumper.vercel.app fUgvef-fofzu7-pifjic

BASE_URL="${1:-http://localhost:3000}"
PASSWORD="${2:-fUgvef-fofzu7-pifjic}"

echo "========================================="
echo "RSSJumper 功能测试"
echo "Base URL: $BASE_URL"
echo "========================================="
echo ""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
PASS=0
FAIL=0

# 测试函数
test_case() {
  local name="$1"
  local command="$2"
  local expected="$3"

  echo -n "[$((PASS + FAIL + 1))] $name ... "

  result=$(eval "$command" 2>&1)

  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  Expected: $expected"
    echo "  Got: $result"
    ((FAIL++))
  fi
}

echo "1. 核心RSS代理功能测试"
echo "-------------------"

# 测试1: 访问首页
test_case "访问首页" \
  "curl -s '$BASE_URL/' | head -20" \
  "RSSJumper RSS代理服务"

# 测试2: RSS代理 - 未编码URL
test_case "RSS代理(未编码URL)" \
  "curl -s '$BASE_URL/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml' | head -5" \
  "<?xml"

# 测试3: RSS代理 - 编码URL
test_case "RSS代理(编码URL)" \
  "curl -s '$BASE_URL/?url=https%3A%2F%2Frthk9.rthk.hk%2Frthk%2Fnews%2Frss%2Fc_expressnews_cfinance.xml' | head -5" \
  "<?xml"

# 测试4: 检查缓存头
test_case "RSS缓存头检查" \
  "curl -sI '$BASE_URL/?url=https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml'" \
  "X-RSSJumper-Cache"

# 测试5: 无效协议
test_case "SSRF防护-无效协议" \
  "curl -s '$BASE_URL/?url=ftp://example.com/rss.xml'" \
  "无效的URL格式"

# 测试6: 内网地址防护
test_case "SSRF防护-内网地址" \
  "curl -s '$BASE_URL/?url=http://localhost/rss.xml'" \
  "无效的URL格式"

# 测试7: 私有IP防护
test_case "SSRF防护-私有IP" \
  "curl -s '$BASE_URL/?url=http://192.168.1.1/rss.xml'" \
  "无效的URL格式"

echo ""
echo "2. 管理功能测试"
echo "-------------------"

# 测试8: 管理页面访问
test_case "管理页面访问" \
  "curl -s '$BASE_URL/api/admin?password=$PASSWORD' | head -20" \
  "RSSJumper 管理后台"

# 测试9: 错误密码
test_case "错误密码访问" \
  "curl -s '$BASE_URL/api/admin?password=wrong'" \
  "密码错误"

# 测试10: 获取管理数据
test_case "获取管理数据API" \
  "curl -s -X POST '$BASE_URL/?password=$PASSWORD' -H 'Content-Type: application/json' -d '{\"action\":\"getData\"}'" \
  "logs"

echo ""
echo "3. 安全头测试"
echo "-------------------"

# 测试11: X-Content-Type-Options
test_case "安全头-X-Content-Type-Options" \
  "curl -sI '$BASE_URL/'" \
  "X-Content-Type-Options: nosniff"

# 测试12: X-Frame-Options
test_case "安全头-X-Frame-Options" \
  "curl -sI '$BASE_URL/'" \
  "X-Frame-Options:"

# 测试13: X-XSS-Protection
test_case "安全头-X-XSS-Protection" \
  "curl -sI '$BASE_URL/'" \
  "X-XSS-Protection:"

echo ""
echo "========================================="
echo "测试完成"
echo "通过: ${GREEN}$PASS${NC}"
echo "失败: ${RED}$FAIL${NC}"
echo "总计: $((PASS + FAIL))"
echo "========================================="

# 返回非零状态如果有失败
[ $FAIL -eq 0 ] && exit 0 || exit 1
