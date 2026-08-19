// 本地静态服务器 — 用于以 http 方式运行生产构建的 PWA（build/ 目录）
// 用法: node serve.js [端口]   默认端口 8080
// 说明: PWA 的 manifest 与 service worker 必须在 http/https 下才能生效，
//       file:// 双击打开无法安装/离线。
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, 'build');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.woff2': 'font/woff2',
    '.hex': 'application/octet-stream',
    '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
    try {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        // 防目录穿越
        const filePath = path.normalize(path.join(ROOT, urlPath));
        if (!filePath.startsWith(ROOT)) {
            res.writeHead(403); res.end('Forbidden'); return;
        }
        fs.stat(filePath, (err, stat) => {
            if (err || !stat.isFile()) {
                // SPA 回退：未知路径返回 index.html（仅对导航）
                if (!path.extname(urlPath)) {
                    const fb = path.join(ROOT, 'index.html');
                    if (fs.existsSync(fb)) {
                        res.writeHead(200, {'Content-Type': MIME['.html']});
                        fs.createReadStream(fb).pipe(res);
                        return;
                    }
                }
                res.writeHead(404); res.end('Not found: ' + urlPath); return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
            fs.createReadStream(filePath).pipe(res);
        });
    } catch (e) {
        res.writeHead(500); res.end('Server error');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('扩展编辑器 PWA 已启动: http://localhost:' + PORT + '/');
    console.log('构建目录: ' + ROOT);
});
