const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 隐藏默认菜单栏（与网页版一致）
Menu.setApplicationMenu(null);

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.eot':  'application/vnd.ms-fontobject',
  '.map':  'application/json',
  '.wasm': 'application/wasm',
};

const ROOT = __dirname;
const PORT = 18790;

// 简单静态文件服务器（仅监听 localhost，供 hCaptcha 等 HTTP-origin 服务使用）
function createServer() {
  return http.createServer((req, res) => {
    // 安全：只接受来自本机的请求
    if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::1' && req.socket.remoteAddress !== '::ffff:127.0.0.1') {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let urlPath = decodeURI(req.url);
    // 去掉查询字符串和锚点
    const qi = urlPath.indexOf('?');
    if (qi !== -1) urlPath = urlPath.substring(0, qi);
    const hi = urlPath.indexOf('#');
    if (hi !== -1) urlPath = urlPath.substring(0, hi);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = path.join(ROOT, urlPath);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + req.url);
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
}

async function createWindow() {
  await app.whenReady();

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'favicon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    }
  });

  win.loadURL('http://127.0.0.1:' + PORT + '/index.html');

  // 首次启动（或快捷方式不存在时）自动创建桌面快捷方式
  ensureDesktopShortcut();

  // 窗口关闭时停止服务器
  win.on('closed', () => server.close());
}

// 创建桌面快捷方式（幂等：已存在则跳过）
function ensureDesktopShortcut() {
  const { shell } = require('electron');
  const desktopPath = app.getPath('desktop');
  const shortcutPath = path.join(desktopPath, 'scratch-extension-editor.lnk');
  if (!fs.existsSync(shortcutPath)) {
    try {
      shell.writeShortcutLink(shortcutPath, 'target', [
        path.join(process.resourcesPath, 'app', 'scratch-extension-editor.exe')
      ].join(''));
    } catch (e) {
      // 静默失败，不影响主功能
    }
  }
}

createWindow();

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
