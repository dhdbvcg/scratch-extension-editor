// extedit-ai：AI 助手面板（悬浮框 UI 开关）
// 该插件不修改 Blockly 原型，仅作为一个内置开关：
// addonState['extedit-ai'] 为 true 时，编辑器顶部显示「AI」按钮，
// 并渲染 <AIAssistant /> 悬浮面板。
// setup 返回空清理函数（无需改装逻辑）。
export default {
    id: 'extedit-ai',
    name: 'AI 助手',
    description: '内置 AI 助手面板，可对话、解释积木逻辑、分析代码与附件。',
    category: '编辑器',
    builtin: true,
    // 无 Blockly 改装需求，setup 仅占位
    setup() {
        return function cleanup() { /* no-op */ };
    },
};
