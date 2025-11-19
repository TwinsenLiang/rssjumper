// 配置
const PASSWORD = process.env.PASSWORD || 'fUgvef-fofzu7-pifjic';

/**
 * 生成管理页面HTML
 */
function generateAdminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSSJumper 管理后台</title>
  <script>
    // 禁用 Tailwind CSS CDN 的生产环境警告
    window.process = { env: { NODE_ENV: 'production' } };
  <` + `/script>
  <script src="https://cdn.tailwindcss.com"><` + `/script>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">🦘 RSSJumper 管理后台</h1>
      <p class="text-gray-600">管理您的RSS代理服务</p>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div class="text-sm text-blue-600 font-medium">总访问记录</div>
        <div class="text-2xl font-bold text-blue-900" id="totalAccess">-</div>
      </div>
      <div class="bg-red-50 rounded-lg p-4 border border-red-200">
        <div class="text-sm text-red-600 font-medium">黑名单数量</div>
        <div class="text-2xl font-bold text-red-900" id="totalBlacklisted">-</div>
      </div>
      <div class="bg-green-50 rounded-lg p-4 border border-green-200">
        <div class="text-sm text-green-600 font-medium">缓存文件数</div>
        <div class="text-2xl font-bold text-green-900" id="totalCached">-</div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="bg-white rounded-lg shadow-lg">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button onclick="switchTab('history')" id="tab-history" class="tab-button active px-6 py-4 text-sm font-medium border-b-2 border-blue-500 text-blue-600">
            访问历史
          </button>
          <button onclick="switchTab('cache')" id="tab-cache" class="tab-button px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
            缓存管理
          </button>
        </nav>
      </div>

      <!-- 访问历史Tab -->
      <div id="content-history" class="tab-content p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-800">访问历史记录</h2>
          <button onclick="refreshData()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
            🔄 刷新
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSS源地址</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">访问次数</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">首次访问</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后访问</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody id="historyTableBody" class="bg-white divide-y divide-gray-200">
              <tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 缓存管理Tab -->
      <div id="content-cache" class="tab-content p-6 hidden">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-800">缓存文件列表</h2>
          <button onclick="refreshData()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
            🔄 刷新
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSS源地址</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件大小</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">缓存时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">缓存年龄</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody id="cacheTableBody" class="bg-white divide-y divide-gray-200">
              <tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Tab切换
    function switchTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-button').forEach(el => {
        el.classList.remove('border-blue-500', 'text-blue-600');
        el.classList.add('border-transparent', 'text-gray-500');
      });

      document.getElementById('content-' + tabName).classList.remove('hidden');
      const tab = document.getElementById('tab-' + tabName);
      tab.classList.add('border-blue-500', 'text-blue-600');
      tab.classList.remove('border-transparent', 'text-gray-500');
    }

    // 获取当前页面的密码参数
    const urlParams = new URLSearchParams(window.location.search);
    const password = urlParams.get('password');

    // 刷新数据
    async function refreshData() {
      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getData' })
        });
        const data = await response.json();

        document.getElementById('totalAccess').textContent = data.stats.totalAccess;
        document.getElementById('totalBlacklisted').textContent = data.stats.totalBlacklisted;
        document.getElementById('totalCached').textContent = data.stats.totalCached;

        // 更新访问历史表格
        const historyBody = document.getElementById('historyTableBody');
        if (data.logs.length === 0) {
          historyBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无访问记录</td></tr>';
        } else {
          historyBody.innerHTML = data.logs.map(function(log) {
            var statusBadge = log.isBlacklisted
              ? '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">已禁用</span>'
              : '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">正常</span>';
            var actionButton = log.isBlacklisted
              ? '<button onclick="unblacklist(' + "'" + encodeURIComponent(log.url) + "'" + ')" class="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">解禁</button>'
              : '<button onclick="blacklistUrl(' + "'" + encodeURIComponent(log.url) + "'" + ')" class="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">禁用</button>';
            return '<tr class="hover:bg-gray-50">' +
              '<td class="px-6 py-4 text-sm text-gray-900 break-all max-w-md">' + log.url + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-900">' + log.count + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + log.firstAccess + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + log.lastAccess + '</td>' +
              '<td class="px-6 py-4 text-sm">' + statusBadge + '</td>' +
              '<td class="px-6 py-4 text-sm">' + actionButton + '</td>' +
              '</tr>';
          }).join('');
        }

        // 更新缓存文件表格
        const cacheBody = document.getElementById('cacheTableBody');
        if (data.cacheFiles.length === 0) {
          cacheBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无缓存文件</td></tr>';
        } else {
          cacheBody.innerHTML = data.cacheFiles.map(function(cache) {
            var statusBadge = cache.expired
              ? '<span class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">已过期</span>'
              : '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">有效</span>';
            return '<tr class="hover:bg-gray-50">' +
              '<td class="px-6 py-4 text-sm text-gray-900 break-all max-w-md">' + cache.url + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-900">' + cache.size + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + cache.lastModified + '</td>' +
              '<td class="px-6 py-4 text-sm text-gray-500">' + cache.age + '</td>' +
              '<td class="px-6 py-4 text-sm">' + statusBadge + '</td>' +
              '<td class="px-6 py-4 text-sm">' +
              '<button onclick="clearCache(' + "'" + encodeURIComponent(cache.url) + "'" + ')" class="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600">清除</button>' +
              '</td>' +
              '</tr>';
          }).join('');
        }
      } catch (error) {
        alert('刷新数据失败: ' + error.message);
      }
    }

    // 禁用URL
    async function blacklistUrl(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要禁用这个URL吗？\\n\\n' + url)) return;

      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'blacklist', url })
        });
        const data = await response.json();
        alert(data.message);
        refreshData();
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 解禁URL
    async function unblacklist(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要解禁这个URL吗？\\n\\n' + url)) return;

      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unblacklist', url })
        });
        const data = await response.json();
        alert(data.message);
        refreshData();
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 清除缓存
    async function clearCache(encodedUrl) {
      const url = decodeURIComponent(encodedUrl);
      if (!confirm('确定要清除这个URL的缓存吗？\\n\\n' + url)) return;

      try {
        const response = await fetch('/?password=' + encodeURIComponent(password), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clearCache', url })
        });
        const data = await response.json();
        alert(data.message);
        refreshData();
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }

    // 页面加载时刷新数据
    window.addEventListener('load', refreshData);
  <` + `/script>
<` + `/body>
<` + `/html>`;
}

/**
 * 主处理函数
 */
module.exports = async (req, res) => {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 为管理页面设置宽松的CSP，允许加载Tailwind CSS和内联脚本
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'self' *; img-src 'self' data:; font-src 'self' data:");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const password = url.searchParams.get('password');

    // 验证密码
    if (password !== PASSWORD) {
      res.status(403).json({ error: '密码错误' });
      return;
    }

    // GET请求 - 显示管理页面HTML
    res.status(200).send(generateAdminHTML());

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
};
