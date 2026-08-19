# Scratch 扩展编辑器 (scratch-extension-editor)

基于 [TurboWarp/scratch-gui](https://github.com/TurboWarp/scratch-gui) 深度定制的 **Scratch 扩展编辑器**，内置完整的扩展构建器（ExtensionBuilder），支持图形化积木编辑、JS 扩展导入导出、自定义插件、账号与云存档、跨站同步等功能。

## ✨ 功能特性

- **积木扩展编辑器（ExtensionBuilder）**：图形化创建自定义积木（帽子 / C 形 / 布尔 / 命令 / 报告器），类别颜色与形状和官方 Scratch 3.0 / TurboWarp 完全一致
- **JS 文件导入 / 导出**：一键生成可在 TurboWarp 加载的扩展 JS 文件
- **自定义插件系统**：导入本地 `.js` 文件作为编辑器插件，立即生效、可随时开关
- **开发教程页面**：`static/ext-addons-doc.html`，插件开发与使用完整文档（编辑器内「开发教程」按钮直达）
- **账号系统**：注册 / 登录 / 登出，密码 SHA-256 + 盐加密
- **云存档**：按账号分区存储项目（可接 Supabase 云端同步）
- **跨站互通**：`#sync=` 同步链接，在任意部署之间转移账号与存档
- **本地化**：中文界面，积木与代码区采用官方 LLK/scratch-l10n 中文翻译

## 🚀 快速开始

```bash
# 安装依赖（如已安装可跳过）
npm install

# 启动开发服务器（默认端口 8601）
npm start
# 打开 http://localhost:8601/editor.html
```

生产构建：

```bash
npx webpack --colors --bail
# 产物输出到 build/ 目录
```

> 提示：项目内 `npm run build` 中的清理步骤可能被本机安全软件拦截，可直接用 `npx webpack --colors --bail` 构建。

## 📁 目录结构

```
src/extension-builder/
├── components/ExtensionBuilder.jsx   # 主组件（菜单 / Blockly 工作区 / 代码面板 / 弹窗）
├── lib/
│   ├── block-definitions.js          # 积木定义与代码生成器
│   ├── extforge-runtime.js           # ExtForge 运行时（注入导出代码）
│   ├── ext-addons.js                 # 编辑器插件系统（内置 + 自定义插件）
│   ├── auth.js / saves.js / sync.js  # 账号 / 存档 / 跨站同步
│   └── tw-lazy-scratch-blocks.js     # scratch-blocks 懒加载
└── styles/extension-builder.css      # 样式（CSS Modules + :global 前缀）
static/ext-addons-doc.html            # 插件开发与使用教程（独立页面）
```

## 🧩 自定义插件

在「🧩 编辑器插件」面板中点击「导入插件」，选择 `.js` 文件即可。插件结构：

```js
export default {
  id: 'my-addon',          // 唯一标识
  name: '我的插件',         // 显示名称
  description: '说明',
  css: '.blocklyMainBackground {}',  // 可选：自动注入 CSS
  setup: function (ctx) {  // 必填：初始化，返回清理函数
    const B = ctx.Blockly;
    const ws = ctx.getWorkspace();
    // ...
    return function cleanup () {};
  }
};
```

完整文档见独立页面 **ext-addons-doc.html**（编辑器内「开发教程」按钮直达，或访问 `http://localhost:8601/ext-addons-doc.html`）。

## ⚖️ 版权与致谢

- 本项目基于 [TurboWarp/scratch-gui](https://github.com/TurboWarp/scratch-gui)（GPL-3.0）二次开发，`LICENSE` 文件保留其原始许可证
- 积木外观与翻译遵循 Scratch 3.0 / TurboWarp 设计规范
- 感谢 [TurboWarp](https://turbowarp.org) 与 [Scratch 基金会](https://scratch.mit.edu) 的开源贡献
