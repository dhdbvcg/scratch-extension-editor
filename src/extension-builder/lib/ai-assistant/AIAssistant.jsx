/**
 * AI Assistant - Main Chat Component
 * AI 风格的 AI 聊天面板，集成到 ExtensionBuilder
 * 
 * 功能：
 * - 左侧边栏：会话列表 + 新建对话
 * - 主区域：聊天消息（支持 Markdown + 工具调用展示）
 * - 底部：输入框 + 思考/选择积木/添加文件 按钮 + 发送
 * - 顶部：返回、标题、模型选择器、导出会话、设置按钮
 * - 设置弹窗：Agent 管理（名称/提供商/URL/API Key/模型列表）
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// 动态导入 store / provider / tools（避免循环依赖）
let Store = null, Provider = null, Tools = null;
try {
    Store = require('./store');
    Provider = require('./provider');
    Tools = require('./tools');
} catch (e) {
    console.warn('AI Assistant: 模块加载失败', e);
}

// ─── 图标 SVG ───
const ICONS = {
    send: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
    settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
    plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    export: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    bot: <svg width="32" height="32" viewBox="0 0 48 48" fill="none"><rect x="8" y="8" width="32" height="32" rx="10" fill="#E3F2FD" stroke="#1E88E5" strokeWidth="2"/><circle cx="18" cy="20" r="3" fill="#1E88E5"/><circle cx="30" cy="20" r="3" fill="#1E88E5"/><path d="M16 29c3 4 13 4 16 0" stroke="#1E88E5" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
    spinner: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.31 0l-2.83-2.83M9.76 9.76L6.93 6.93"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>,
    thinking: <svg width="14" height="14" viewBox="0 0 24 24" fill="#6366f1"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 1010 10" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>,
};

// ─── 简易 Markdown 渲染 ───
function renderMarkdown(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeContent = '';
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 代码块
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeLang = line.slice(3).trim();
                codeContent = '';
            } else {
                elements.push({ type: 'code', lang: codeLang, content: codeContent });
                inCodeBlock = false;
            }
            continue;
        }
        if (inCodeBlock) {
            codeContent += line + '\n';
            continue;
        }
        // 标题
        if (line.startsWith('### ')) { elements.push({ type: 'h3', text: line.slice(4) }); continue; }
        if (line.startsWith('## ')) { elements.push({ type: 'h2', text: line.slice(3) }); continue; }
        if (line.startsWith('# ')) { elements.push({ type: 'h1', text: line.slice(2) }); continue; }
        // 列表
        if (line.match(/^\s*[-*]\s+/)) { elements.push({ type: 'li', text: line.replace(/^\s*[-*]\s+/, '') }); continue; }
        if (line.match(/^\s*\d+\.\s+/)) { elements.push({ type: 'li', text: line.replace(/^\s*\d+\.\s+/, '') }); continue; }
        // 空行
        if (line.trim() === '') { elements.push({ type: 'spacer' }); continue; }
        // 普通段落
        elements.push({ type: 'p', text: line });
    }
    if (inCodeBlock) {
        elements.push({ type: 'code', lang: codeLang, content: codeContent });
    }
    return elements;
}

// ─── 主组件 ───
export default function AIAssistant({
    workspaceRef,
    javascriptGenerator,
    customBlocks,
    visible,
    onClose,
}) {
    // ── 状态 ──
    const [sessions, setSessions] = useState(() => Store ? Store.getSessions() : []);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [agents, setAgents] = useState(() => Store ? Store.getAgents() : []);
    const [currentModelId, setCurrentModelIdState] = useState(() => Store ? Store.getCurrentModelId() : '');
    const [settings, setSettingsState] = useState(() => Store ? Store.getSettings() : {});
    const [toolCalls, setToolCalls] = useState([]); // 当前正在展示的工具调用
    const [todos, setTodos] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // ── 悬浮框拖拽/拉伸/最小化/最大化（与实时协作一致）──
    const panelRef = useRef(null);
    const resizeLayerRef = useRef(null);
    const dragRef = useRef(null);
    const resizeRef = useRef(null);
    const minimizedRef = useRef(false);
    const maximizedRef = useRef(false);
    const savedBoundsRef = useRef(null);
    const [minimized, setMinimized] = useState(false);
    const [maximized, setMaximized] = useState(false);

    const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

    // 同步拉伸手柄层位置到面板
    const syncResizeLayer = () => {
        const panel = panelRef.current;
        const layer = resizeLayerRef.current;
        if (!panel || !layer) return;
        if (panel.style.display === 'none' || minimizedRef.current || maximizedRef.current) {
            layer.style.display = 'none';
            return;
        }
        layer.style.display = '';
        const r = panel.getBoundingClientRect();
        layer.style.left = r.left + 'px';
        layer.style.top = r.top + 'px';
        layer.style.width = r.width + 'px';
        layer.style.height = r.height + 'px';
    };

    // 标题栏拖拽
    const onTitleMouseDown = (e) => {
        if (maximizedRef.current) return;
        if (e.target.closest('.ext-ai-tb-btn')) return;
        const panel = panelRef.current;
        const rect = panel.getBoundingClientRect();
        if (getComputedStyle(panel).right !== 'auto') {
            panel.style.left = rect.left + 'px';
            panel.style.top = rect.top + 'px';
            panel.style.right = 'auto';
        }
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origLeft: rect.left,
            origTop: rect.top,
        };
        e.preventDefault();
    };

    const onWindowMouseMove = (e) => {
        const panel = panelRef.current;
        if (!panel) return;
        if (dragRef.current) {
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            let newLeft = dragRef.current.origLeft + dx;
            let newTop = dragRef.current.origTop + dy;
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 80));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - 60));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
            panel.style.transform = 'none';
            syncResizeLayer();
        }
        if (resizeRef.current) {
            const d = resizeRef.current;
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            const minW = 300, minH = 360;
            let newLeft = d.origLeft, newTop = d.origTop, newW = d.origW, newH = d.origH;
            if (d.dir.indexOf('e') !== -1) newW = Math.max(minW, d.origW + dx);
            if (d.dir.indexOf('s') !== -1) newH = Math.max(minH, d.origH + dy);
            if (d.dir.indexOf('w') !== -1) {
                newW = Math.max(minW, d.origW - dx);
                newLeft = d.origLeft + (d.origW - newW);
            }
            if (d.dir.indexOf('n') !== -1) {
                newH = Math.max(minH, d.origH - dy);
                newTop = d.origTop + (d.origH - newH);
            }
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 40));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
            panel.style.width = newW + 'px';
            panel.style.height = newH + 'px';
            panel.style.transform = 'none';
            syncResizeLayer();
        }
    };

    const onWindowMouseUp = () => {
        dragRef.current = null;
        resizeRef.current = null;
    };

    const onResizeMouseDown = (e, dir) => {
        if (maximizedRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const r = panelRef.current.getBoundingClientRect();
        resizeRef.current = {
            dir,
            startX: e.clientX,
            startY: e.clientY,
            origLeft: r.left,
            origTop: r.top,
            origW: r.width,
            origH: r.height,
        };
    };

    const handleMinimize = () => {
        if (!panelRef.current) return;
        minimizedRef.current = !minimizedRef.current;
        setMinimized(minimizedRef.current);
        syncResizeLayer();
    };

    const handleMaximize = () => {
        const panel = panelRef.current;
        if (!panel) return;
        // 最小化（display:none）时不可最大化，避免 savedBounds 捕获到 0 尺寸
        if (getComputedStyle(panel).display === 'none') return;
        if (!maximizedRef.current) {
            const rect = panel.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            savedBoundsRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            panel.style.top = '8px';
            panel.style.left = '8px';
            panel.style.right = '8px';
            panel.style.width = '';
            panel.style.height = 'calc(100vh - 16px)';
            panel.style.transform = 'none';
            maximizedRef.current = true;
            setMaximized(true);
        } else {
            const b = savedBoundsRef.current;
            if (b) {
                panel.style.top = b.top + 'px';
                panel.style.left = b.left + 'px';
                panel.style.right = 'auto';
                panel.style.width = b.width + 'px';
                panel.style.height = b.height + 'px';
                panel.style.transform = 'none';
            }
            maximizedRef.current = false;
            setMaximized(false);
        }
        syncResizeLayer();
    };

    // 注册全局拖拽/拉伸监听
    useEffect(() => {
        window.addEventListener('mousemove', onWindowMouseMove);
        window.addEventListener('mouseup', onWindowMouseUp);
        const sync = () => syncResizeLayer();
        window.addEventListener('resize', sync);
        // 初次定位拉伸层
        const t = setTimeout(syncResizeLayer, 0);
        return () => {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);
            window.removeEventListener('resize', sync);
            clearTimeout(t);
        };
    }, []);

    // 滚动到底部
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, toolCalls]);

    // 聚焦输入框
    useEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus();
        }
    }, [visible]);

    // ── 会话操作 ──
    const handleNewChat = useCallback(() => {
        if (!Store) return;
        const session = Store.createSession('新对话');
        setSessions(Store.getSessions());
        setCurrentSessionId(session.id);
        setMessages([]);
        setToolCalls([]);
        setTodos([]);
    }, []);

    const handleSelectSession = useCallback((sessionId) => {
        if (!Store) return;
        setCurrentSessionId(sessionId);
        const session = Store.getSession(sessionId);
        setMessages(session ? session.messages : []);
        setToolCalls([]);
    }, []);

    const handleDeleteSession = useCallback((e, sessionId) => {
        e.stopPropagation();
        if (!Store) return;
        Store.deleteSession(sessionId);
        setSessions(Store.getSessions());
        if (sessionId === currentSessionId) {
            const remaining = Store.getSessions();
            if (remaining.length > 0) {
                handleSelectSession(remaining[0].id);
            } else {
                handleNewChat();
            }
        }
    }, [currentSessionId, handleNewChat, handleSelectSession]);

    // ── 发送消息 ──
    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text || isLoading || !Store || !Provider || !Tools) return;

        // 创建或获取会话
        let sid = currentSessionId;
        if (!sid) {
            const session = Store.createSession(text.slice(0, 40));
            sid = session.id;
            setSessions(Store.getSessions());
            setCurrentSessionId(sid);
        }

        // 添加用户消息
        const userMsg = { id: 'msg-' + Date.now(), role: 'user', content: text };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            // 构建发送给 AI 的消息
            const apiMessages = [
                { role: 'system', content: settings.systemPrompt || '你是 Scratch 扩展构建器的 AI 助手。' },
                ...newMessages.map(m => ({ role: m.role, content: m.content })),
            ];

            // 获取当前 Agent
            const agent = Store.getCurrentAgent();

            // 获取工具定义
            const toolSchemas = Tools.getToolSchemas();

            // 工具执行上下文
            const ctx = {
                workspace: workspaceRef?.current,
                javascriptGenerator: javascriptGenerator,
                customBlocks: customBlocks,
            };

            // 流式调用
            let assistantContent = '';
            const collectedToolCalls = [];

            const result = await Provider.sendChatCompletion({
                agent,
                messages: apiMessages,
                tools: toolSchemas,
                stream: true,
                onTextDelta: (delta) => {
                    assistantContent += delta;
                    setMessages([...newMessages, {
                        id: 'msg-ai-' + Date.now(),
                        role: 'assistant',
                        content: assistantContent,
                        toolCalls: collectedToolCalls.length > 0 ? [...collectedToolCalls] : undefined,
                    }]);
                },
                onToolCallsDelta: (tcs) => {
                    collectedToolCalls.push(...tcs);
                    // 展示工具调用
                    setToolCalls(tcs.map(tc => ({
                        id: tc.id,
                        name: tc.function.name,
                        args: tc.function.arguments,
                        status: 'running',
                        result: null,
                    })));

                    // 执行工具
                    (async () => {
                        for (const tc of tcs) {
                            try {
                                let argsObj = {};
                                try { argsObj = JSON.parse(tc.function.arguments); } catch (e) { argsObj = {}; }
                                const toolResult = await Tools.executeTool(tc.function.name, argsObj, ctx);
                                // 更新工具调用状态
                                setToolCalls(prev => prev.map(t =>
                                    t.id === tc.id ? { ...t, status: 'completed', result: JSON.stringify(toolResult).slice(0, 500) } : t
                                ));
                                // 把工具结果作为消息追加
                                const toolMsg = {
                                    id: 'msg-tool-' + tc.id,
                                    role: 'tool',
                                    name: tc.function.name,
                                    content: JSON.stringify(toolResult),
                                    toolCallId: tc.id,
                                };
                                setMessages(prev => [...prev, toolMsg]);
                            } catch (e) {
                                setToolCalls(prev => prev.map(t =>
                                    t.id === tc.id ? { ...t, status: 'error', result: e.message } : t
                                ));
                            }
                        }
                    })();
                },
            });

            // 最终更新
            setMessages(prev => {
                const updated = [...prev];
                // 更新/添加最后的 assistant 消息
                const lastAiIdx = updated.findLastIndex(m => m.role === 'assistant');
                if (lastAiIdx >= 0) {
                    updated[lastAiIdx] = {
                        ...updated[lastAiIdx],
                        content: result.content || assistantContent,
                        toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
                    };
                } else if (result.content || assistantContent) {
                    updated.push({
                        id: 'msg-ai-final-' + Date.now(),
                        role: 'assistant',
                        content: result.content || assistantContent,
                    });
                }
                return updated;
            });

            // 保存会话
            const finalMessages = [...newMessages];
            if (result.content || assistantContent) {
                finalMessages.push({ role: 'assistant', content: result.content || assistantContent });
            }
            Store.updateSessionMessages(sid, finalMessages);

        } catch (e) {
            setMessages(prev => [...prev, {
                id: 'msg-err-' + Date.now(),
                role: 'assistant',
                content: '',
                error: e.message,
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, messages, currentSessionId, workspaceRef, javascriptGenerator, customBlocks, settings.systemPrompt]);

    // ── 键盘事件 ──
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // ── 设置相关 ──
    const handleSaveAgent = useCallback((agentData) => {
        if (!Store) return;
        const existing = agents.find(a => a.id === agentData.id);
        if (existing) {
            Store.updateAgent(agentData.id, agentData);
        } else {
            Store.addAgent(agentData);
        }
        setAgents(Store.getAgents());
    }, [agents]);

    const handleDeleteAgentCallback = useCallback((agentId) => {
        if (!Store) return;
        Store.deleteAgent(agentId);
        setAgents(Store.getAgents());
        const models = Store.getAllFlattenedModels();
        if (models.length > 0) {
            setCurrentModelIdState(models[0].id);
            Store.setCurrentModelId(models[0].id);
        }
    }, []);

    const handleSwitchModel = useCallback((modelId) => {
        setCurrentModelIdState(modelId);
        if (Store) Store.setCurrentModelId(modelId);
    }, []);

    // ── 导出会话 ──
    const handleExportSession = useCallback(() => {
        if (!currentSessionId || messages.length === 0) return;
        const text = messages.map(m => {
            const prefix = m.role === 'user' ? '👤 ' : m.role === 'assistant' ? '🤖 ' : '🔧 ';
            return prefix + m.content + (m.error ? '\n❌ ' + m.error : '');
        }).join('\n\n---\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }, [currentSessionId, messages]);

    // ── 渲染 ──
    if (!visible) return null;

    const allModels = Store ? Store.getAllFlattenedModels() : [];

    return (
        <>
        <div ref={panelRef} className={`ext-ai-float${minimized ? ' ext-ai-minimized' : ''}`}>
            {/* ── 窗口标题栏（可拖拽，与实时协作一致）── */}
            <div className="ext-ai-titlebar" onMouseDown={onTitleMouseDown}>
                <span className="ext-ai-titlebar-text">AI</span>
                <div className="ext-ai-titlebar-controls">
                    <button className="ext-ai-tb-btn" onClick={handleMinimize} title="最小化">{minimized ? '▢' : '─'}</button>
                    <button className="ext-ai-tb-btn" onClick={handleMaximize} title={maximized ? '还原' : '最大化'}>{maximized ? '❐' : '□'}</button>
                    <button className="ext-ai-tb-btn close" onClick={onClose} title="关闭">×</button>
                </div>
            </div>

            {/* ── 主体：侧栏 + 聊天区 ── */}
            <div className="ext-ai-body">
                {/* ── 左侧边栏 ── */}
                <div className="ext-ai-sidebar">
                    <div className="ext-ai-sb-head">
                        <div className="ext-ai-sb-brand">
                            <div className="ext-ai-sb-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="01"/></svg></div>
                            <span className="ext-ai-sb-name">AI</span>
                        </div>
                        <div className="ext-ai-sb-label">项目会话</div>
                    </div>

                    {/* 新对话 */}
                    <button onClick={handleNewChat} className="ext-ai-newchat-btn">
                        {ICONS.plus}<span>新对话</span>
                    </button>

                    {/* 最近会话 */}
                    <div className="ext-ai-sb-recent-label">最近</div>
                    <div className="ext-ai-session-list">
                        {sessions.length === 0 && (
                            <div className="ext-ai-session-empty">
                                还没有会话，开始一个新的提问吧。
                            </div>
                        )}
                        {sessions.map(s => (
                            <div key={s.id}
                                onClick={() => handleSelectSession(s.id)}
                                className={`ext-ai-session-item${s.id === currentSessionId ? ' active' : ''}`}
                            >
                                <span className="ext-ai-session-title">{s.title}</span>
                                <span onClick={(e) => handleDeleteSession(e, s.id)} className="ext-ai-session-del" title="删除">×</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── 右侧主区域 ── */}
                <div className="ext-ai-chat-area">
                    {/* 顶栏（白色，无渐变）*/}
                    <div className="ext-ai-header">
                        <button className="ext-ai-header-back" title="返回">{ICONS.back}</button>
                        <div className="ext-ai-header-info">
                            <h2 className="ext-ai-header-title">AI</h2>
                            <span className="ext-ai-header-subtitle">Scratch扩展...</span>
                        </div>

                        {/* 模型选择 */}
                        <select value={currentModelId} onChange={e => { const v = e && e.target ? e.target.value : ''; handleSwitchModel(v); }} className="ext-ai-header-model">
                            {allModels.length === 0 && <option value="">Don't use me</option>}
                            {allModels.map(m => (
                                <option key={m.id} value={m.id}>{m.displayName}</option>
                            ))}
                        </select>

                        <button onClick={handleExportSession} title="导出会话" className="ext-ai-hbtn">导出会话</button>
                        <button onClick={() => setShowSettings(true)} title="设置" className="ext-ai-hbtn">设置</button>
                    </div>

                    {/* 消息列表 */}
                    <div className="ext-ai-messages">
                        {messages.length === 0 && (
                            /* 欢迎卡片 */
                            <div className="ext-ai-welcome">
                                <div className="ext-ai-welcome-badge">AI</div>
                                <div className="ext-ai-welcome-title">把问题、需求或代码段<br/>直接进来</div>
                                <div className="ext-ai-welcome-desc">
                                    可以让它解释积木逻辑、整理上下文、分析附件，<br/>
                                    或者直接帮助你修改当前工作区内容。
                                </div>
                            </div>
                        )}

                        {/* 消息列表 */}
                        {messages.map(msg => {
                            if (msg.role === 'user') {
                                return (
                                    <div key={msg.id} className="ext-ai-msg-row user">
                                        <div className="ext-ai-user-bubble">{msg.content}</div>
                                    </div>
                                );
                            }
                            if (msg.error) {
                                return (
                                    <div key={msg.id} className="ext-ai-msg-row assistant">
                                        <div className="ext-ai-avatar ai-avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg></div>
                                        <div className="ext-ai-error-bubble"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" style={{verticalAlign:'middle',marginRight:'4px'}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{msg.error}</div>
                                    </div>
                                );
                            }
                            if (msg.role === 'tool') {
                                return null; // tool 消息合入工具卡片展示
                            }
                            /* Assistant message */
                            return (
                                <div key={msg.id} className="ext-ai-msg-row assistant">
                                    <div className="ext-ai-avatar ai-avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg></div>
                                    <div className="ext-ai-msg-bubble">
                                        {renderMarkdown(msg.content).map((block, i) => (
                                            <div key={i}>
                                                {block.type === 'h1' && <h3>{block.text}</h3>}
                                                {block.type === 'h2' && <h4>{block.text}</h4>}
                                                {block.type === 'h3' && <h5>{block.text}</h5>}
                                                {block.type === 'li' && <div className="li-style">• {block.text}</div>}
                                                {block.type === 'code' && <pre><code>{block.content}</code></pre>}
                                                {block.type === 'p' && <p>{block.text}</p>}
                                                {block.type === 'spacer' && <div className="ext-ai-spacer" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* 工具调用展示（原版卡片样式）*/}
                        {toolCalls.map(tc => (
                            <ToolCallCard key={tc.id} tc={tc} />
                        ))}

                        {/* 加载中指示器 */}
                        {isLoading && !toolCalls.some(t => t.status === 'running') && (
                            <div className="ext-ai-loading">
                                <div className="ext-ai-loading-dot" />
                                <div className="ext-ai-loading-dot" style={{animationDelay:'.15s'}} />
                                <div className="ext-ai-loading-dot" style={{animationDelay:'.3s'}} />
                                <span>正在思考...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* 输入区 */}
                    <div className="ext-ai-input-area">
                        <div className="ext-ai-input-box">
                            <textarea
                                ref={inputRef}
                                value={inputText}
                                onChange={e => { const v = e && e.target ? e.target.value : ''; setInputText(v); }}
                                onKeyDown={handleKeyDown}
                                placeholder="输入消息、修改需求或粘贴上下文...(Enter 发送，Shift+Enter 换行)"
                                rows={1}
                                className="ext-ai-textarea"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputText.trim() || isLoading}
                                className="ext-ai-send-btn"
                            >
                                ▶
                            </button>
                        </div>
                        <div className="ext-ai-input-hints">
                            <button className="ext-ai-hint-btn" title="开启深度思考模式">思考</button>
                            <button className="ext-ai-hint-btn" title="从工作区选择积木作为上下文">选择积木</button>
                            <button className="ext-ai-hint-btn" title="上传文件作为附件">添加文件</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 设置弹窗 ── */}
            {showSettings && <AISettingsModal
                agents={agents}
                currentModelId={currentModelId}
                settings={settings}
                onSaveAgent={handleSaveAgent}
                onDeleteAgent={handleDeleteAgentCallback}
                onSwitchModel={handleSwitchModel}
                onUpdateSettings={(s) => { setSettingsState(s); if (Store) Store.saveSettings(s); }}
                onClose={() => setShowSettings(false)}
            />}

            {/* 8 方向拉伸手柄层（与实时协作一致）*/}
            {!minimized && !maximized && (
                <div ref={resizeLayerRef} className="ext-ai-resize-layer">
                    {RESIZE_DIRS.map(dir => (
                        <div key={dir} className={`ext-ai-resize-handle ext-ai-rz-${dir}`} onMouseDown={(e) => onResizeMouseDown(e, dir)} />
                    ))}
                </div>
            )}
        </div>
        </>
    );
}

// ─── 工具调用卡片组件（原版样式：可展开）──
function ToolCallCard({ tc }) {
    const [expanded, setExpanded] = useState(false);
    const statusClass = tc.status === 'running' ? 'running' : tc.status === 'error' ? 'error' : '';
    const statusText = tc.status === 'running' ? '执行中' : tc.status === 'completed' ? '已完成' : '失败';
    const toolCount = tc.status === 'completed' ? 1 : (tc.status === 'running' ? 1 : 0);

    // 尝试解析 result 为结构化子项
    let subItems = [];
    if (tc.result) {
        try {
            const parsed = JSON.parse(tc.result);
            if (Array.isArray(parsed)) {
                subItems = parsed.map((item, i) => ({
                    name: item.name || `步骤${i+1}`,
                    detail: item.detail || '',
                    status: item.status || '完成',
                }));
            } else if (typeof parsed === 'object') {
                subItems = [{ name: tc.name, detail: '', status: '完成' }];
            }
        } catch (e) {
            subItems = [{ name: tc.name, detail: tc.result.slice(0, 80), status: '完成' }];
        }
    }

    return (
        <div className="ext-ai-tool-card">
            <div className="ext-ai-tool-header" onClick={() => setExpanded(v => !v)}>
                <span className={`ext-ai-tool-dot ${statusClass}`} />
                <span className="ext-ai-tool-name">{statusText}</span>
                <span className="ext-ai-tool-meta">{toolCount}次工具调用 · {toolCount}完成</span>
                {tc.status === 'completed' && <span className="ext-ai-tool-status-ok">完成</span>}
                <span className={`ext-ai-tool-expand ${expanded ? 'expanded' : ''}`}>︿</span>
            </div>
            {expanded && subItems.length > 0 && (
                <div className="ext-ai-tool-body">
                    {subItems.map((item, i) => (
                        <div key={i} className="ext-ai-tool-item">
                            <span className="ext-ai-tool-item-check">✓</span>
                            <span className="ext-ai-tool-item-name">{item.name}</span>
                            {item.detail && <span className="ext-ai-tool-item-detail">{item.detail}</span>}
                            <span className="ext-ai-tool-item-badge">{item.status}</span>
                        </div>
                    ))}
                    {tc.result && (
                        <pre className="ext-ai-tool-pre">{tc.result}</pre>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── 设置弹窗组件 ───
function AISettingsModal({ agents, currentModelId, settings, onSaveAgent, onDeleteAgent, onSwitchModel, onUpdateSettings, onClose }) {
    const [activeTab, setActiveTab] = useState('model'); // model | about
    const [editingAgent, setEditingAgent] = useState(null);
    const [newAgent, setNewAgent] = useState({
        name: '', provider: 'openai', baseUrl: 'https://api.openai.com/v1',
        apiKey: '', models: [],
    });
    const [newModelName, setNewModelName] = useState('');
    const [newModelId, setNewModelId] = useState('');

    const providerOptions = Store ? Store.PROVIDER_OPTIONS : [];

    const handleProviderChange = (provider) => {
        const found = providerOptions.find(p => p.value === provider);
        setNewAgent(prev => ({
            ...prev,
            provider,
            baseUrl: found ? found.defaultUrl : '',
        }));
    };

    const handleAddModel = () => {
        if (!newModelName || !newModelId) return;
        setNewAgent(prev => ({
            ...prev,
            models: [...(prev.models || []), {
                id: 'model-' + Date.now(),
                name: newModelName,
                modelId: newModelId,
            }],
        }));
        setNewModelName('');
        setNewModelId('');
    };

    const handleSaveNewAgent = () => {
        if (!newAgent.name || !newAgent.baseUrl) return;
        onSaveAgent(newAgent);
        setNewAgent({ name: '', provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: [] });
    };

    const allModels = Store ? Store.getAllFlattenedModels() : [];

    return (
        <div onClick={onClose} className="ext-ai-settings-overlay">
            <div onClick={e => e.stopPropagation()} className="ext-ai-settings-modal">
                {/* 头部：Bilup Nova 设置 + 窗口控制 */}
                <div className="ext-ai-settings-header">
                    <h3 className="ext-ai-settings-title">AI 设置</h3>
                    <div style={{display:'flex',gap:4}}>
                        <button className="ext-ai-settings-close" onClick={onClose}>─</button>
                        <button className="ext-ai-settings-close" onClick={onClose}>□</button>
                        <button className="ext-ai-settings-close" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="ext-ai-settings-body">
                    {/* 左侧标签（盒式）*/}
                    <div className="ext-ai-settings-tabs">
                        <button onClick={() => setActiveTab('model')} className={`ext-ai-settings-tab${activeTab === 'model' ? ' active' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:'6px'}}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>模型
                        </button>
                        <button onClick={() => setActiveTab('about')} className={`ext-ai-settings-tab${activeTab === 'about' ? ' active' : ''}`}>
                            ℹ️ 关于
                        </button>
                    </div>

                    {/* 右侧内容 */}
                    <div className="ext-ai-settings-content">
                        {activeTab === 'model' && (
                            <>
                                {/* 添加 Agent */}
                                <div className="ext-ai-settings-section">
                                    <div className="ext-ai-settings-section-title">添加 Agent</div>
                                    <div className="ext-ai-settings-desc">一个 Agent 可以包含多个模型，顶部模型选择栏会展开显示这些模型。</div>

                                    <div className="ext-ai-form-grid">
                                        <div>
                                            <label className="ext-ai-label">名称</label>
                                            <input className="ext-ai-input" value={newAgent.name} onChange={e => { const v = e && e.target ? e.target.value : ''; setNewAgent(p => ({ ...p, name: v })); }} placeholder="例如 我的 OpenAI" />
                                        </div>
                                        <div>
                                            <label className="ext-ai-label">供应商</label>
                                            <select className="ext-ai-select" value={newAgent.provider} onChange={e => { const v = e && e.target ? e.target.value : ''; handleProviderChange(v); }}>
                                                {providerOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="ext-ai-form-group">
                                        <label className="ext-ai-label">Base URL</label>
                                        <input className="ext-ai-input" value={newAgent.baseUrl} onChange={e => { const v = e && e.target ? e.target.value : ''; setNewAgent(p => ({ ...p, baseUrl: v })); }} placeholder="https://api.openai.com/v1" />
                                    </div>

                                    <div className="ext-ai-form-group">
                                        <label className="ext-ai-label">API Key</label>
                                        <input type="password" className="ext-ai-input" value={newAgent.apiKey} onChange={e => { const v = e && e.target ? e.target.value : ''; setNewAgent(p => ({ ...p, apiKey: v })); }} placeholder="sk-..." />
                                    </div>

                                    {/* 模型列表 */}
                                    <div className="ext-ai-form-group">
                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                                            <label className="ext-ai-label" style={{marginBottom:0}}>模型列表</label>
                                            <button className="ext-ai-btn" onClick={handleAddModel}>添加模型</button>
                                        </div>
                                        <div className="ext-ai-note">配置 API Key 后会自动通过 API 获取模型列表；也可以手动输入自定义模型 ID。</div>

                                        {(newAgent.models || []).map(m => (
                                            <div key={m.id} style={{display:'flex',gap:'8',marginBottom:'6',alignItems:'center'}}>
                                                <input className="ext-ai-input-sm" value={m.name} readOnly />
                                                <input className="ext-ai-input-sm" value={m.modelId} readOnly />
                                                <button className="ext-ai-btn ext-ai-btn-danger" onClick={() => setNewAgent(p => ({ ...p, models: p.models.filter(x => x.id !== m.id) }))}>删除</button>
                                            </div>
                                        ))}

                                        {/* 新模型输入 */}
                                        <div style={{display:'flex',gap:'8',marginTop:8}}>
                                            <input className="ext-ai-input-sm" value={newModelName} onChange={e => { const v = e && e.target ? e.target.value : ''; setNewModelName(v); }} placeholder="新定应模型" />
                                            <input className="ext-ai-input-sm" value={newModelId} onChange={e => { const v = e && e.target ? e.target.value : ''; setNewModelId(v); }} placeholder="gpt-4o" />
                                        </div>
                                        <div className="ext-ai-note">模型 ID 输入框支持从已获取列表选择，也支持直接输入自定义模型。</div>
                                    </div>

                                    <button className="ext-ai-btn-primary" onClick={handleSaveNewAgent}>配置 Agent</button>
                                </div>

                                {/* 已配置 Agent 列表 */}
                                <div className="ext-ai-agent-list">
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                                        <div>
                                            <div className="ext-ai-settings-section-title" style={{marginBottom:2}}>已配置 Agent</div>
                                            <div className="ext-ai-note" style={{marginTop:0}}>至少需要一个 Agent。删除与新增都会自动启用的获取到新模型。</div>
                                        </div>
                                        <button className="ext-ai-btn" onClick={() => { setEditingAgent(null); setNewAgent({name:'',provider:'openai',baseUrl:'https://api.openai.com/v1',apiKey:'',models:[]}); }}>导入 Agent</button>
                                    </div>

                                    {agents.map(agent => (
                                        <div key={agent.id} className="ext-ai-agent-item">
                                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                                                <div>
                                                    <div className="ext-ai-agent-name">{agent.name}</div>
                                                    <div className="ext-ai-note">{agent.provider || 'OpenAI'}</div>
                                                    <div className="ext-ai-note">{agent.baseUrl || 'dont-use-me'}</div>
                                                </div>
                                                <div style={{display:'flex',gap:4}}>
                                                    <button className="ext-ai-btn" onClick={() => { setEditingAgent(agent); setNewAgent(agent); }}>编辑</button>
                                                    <button className="ext-ai-btn ext-ai-btn-danger" onClick={() => onDeleteAgent(agent.id)}>删除</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeTab === 'about' && (
                            <div>
                                {/* 关于卡片 */}
                                <div className="ext-ai-about-card">
                                    <div className="ext-ai-about-title">关于 AI</div>
                                    <div className="ext-ai-about-desc">插件作者、授权协议与源码仓库信息。</div>
                                </div>

                                {/* 作者 */}
                                <div className="ext-ai-about-row">
                                    <span className="ext-ai-about-label">作者</span>
                                    <div className="ext-ai-author-tags">
                                        {['白猫@CCW','酷可@CCW','PPN-design','RyaninCn11'].map(name => (
                                            <span key={name} className="ext-ai-author-tag">{name}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* 开源协议 */}
                                <div className="ext-ai-about-row">
                                    <span className="ext-ai-about-label">开源协议</span>
                                    <span className="ext-ai-about-value">GNU Affero General Public License v3.0 or later(AGPL-3.0-or-later)</span>
                                </div>

                                {/* 开源地址 */}
                                <div className="ext-ai-about-row">
                                    <span className="ext-ai-about-label">开源地址</span>
                                    <button className="ext-ai-btn" onClick={() => window.open('https://github.com/dhdbvcg/scratch-gui','_blank')}>GitHub 仓库</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
