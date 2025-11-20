const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// 导入Vercel serverless函数
const indexHandler = require('./api/index.js');
const adminHandler = require('./api/admin.js');

// 端口配置
const PORT = process.env.PORT || 3000;

/**
 * 包装Vercel函数为标准HTTP服务器
 */
function wrapVercelFunction(handler) {
  return async (req, res) => {
    // 解析URL和查询参数
    const parsedUrl = url.parse(req.url, true);
    req.query = parsedUrl.query;
    req.path = parsedUrl.pathname;

    // 收集POST数据
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          // 尝试解析JSON
          if (req.headers['content-type']?.includes('application/json')) {
            req.body = JSON.parse(body);
          } else {
            req.body = querystring.parse(body);
          }
          await handler(req, res);
        } catch (error) {
          await handler(req, res);
        }
      });
    } else {
      // GET请求直接处理
      await handler(req, res);
    }
  };
}

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;

  // 添加必要的响应方法（兼容Vercel函数）
  if (!res.json) {
    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
    };
  }

  if (!res.status) {
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
  }

  if (!res.send) {
    res.send = function(data) {
      if (typeof data === 'object') {
        this.json(data);
      } else {
        this.end(data);
      }
    };
  }

  try {
    // 静态文件处理
    if (pathname.startsWith('/css/') || pathname.startsWith('/public/')) {
      const filePath = pathname.startsWith('/css/')
        ? path.join(__dirname, 'public', pathname)
        : path.join(__dirname, pathname);

      // 检查文件是否存在
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentType = {
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.html': 'text/html',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        }[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    // 路由处理
    if (pathname === '/api/admin' || pathname === '/admin') {
      await wrapVercelFunction(adminHandler)(req, res);
    } else {
      // 默认路由到主处理函数
      await wrapVercelFunction(indexHandler)(req, res);
    }
  } catch (error) {
    console.error('[服务器错误]', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: '服务器内部错误',
        message: error.message
      });
    }
  }
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     🚀 RSSJumper 服务器已启动              ║
║                                            ║
║     监听地址: 0.0.0.0:${PORT.toString().padEnd(4)}                 ║
║     本地访问: http://localhost:${PORT}        ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
