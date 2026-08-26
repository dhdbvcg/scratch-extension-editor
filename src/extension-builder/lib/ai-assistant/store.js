/**
 * AI Assistant - Store (Agent 配置 / 会话状态)
 * localStorage 持久化，兼容 ExtensionBuilder 的 auth.js 模式
 */

const STORAGE_KEY_AGENTS = 'ext_ai_agents';
const STORAGE_KEY_CURRENT_MODEL = 'ext_ai_current_model';
const STORAGE_KEY_SESSIONS = 'ext_ai_sessions';
const STORAGE_KEY_SETTINGS = 'ext_ai_settings';

// ─── 默认 Agent ───
const DEFAULT_AGENTS = [
    {
        id: 'agent-default',
        name: '我的 OpenAI',
        provider: 'openai', // openai | zhipu | deepseek | anthropic | custom | custom_anthropic
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: [
            { id: 'model-gpt4o', name: 'GPT-4o', modelId: 'gpt-4o' },
            { id: 'model-gpt4o-mini', name: 'GPT-4o Mini', modelId: 'gpt-4o-mini' },
        ],
    },
];

// ─── 提供商选项（用于设置面板下拉） ───
const PROVIDER_OPTIONS = [
    { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
    { value: 'zhipu', label: '智谱清言', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
    { value: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com' },
    { value: 'anthropic', label: 'Anthropic', defaultUrl: 'https://api.anthropic.com/v1' },
    { value: 'custom', label: '自定义 OpenAI', defaultUrl: '' },
    { value: 'custom_anthropic', label: '自定义 Anthropic', defaultUrl: '' },
];

// ─── localStorage 读写 ───
function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('AI Assistant: localStorage 写入失败', key, e);
    }
}

// ─── Agent 管理 ───
function getAgents() {
    return loadJSON(STORAGE_KEY_AGENTS, DEFAULT_AGENTS);
}

function saveAgents(agents) {
    saveJSON(STORAGE_KEY_AGENTS, agents);
}

function getCurrentModelId() {
    return loadJSON(STORAGE_KEY_CURRENT_MODEL, DEFAULT_AGENTS[0].models[0].id);
}

function setCurrentModelId(id) {
    saveJSON(STORAGE_KEY_CURRENT_MODEL, id);
}

/**
 * 获取当前选中的扁平化模型（包含所有连接信息）
 */
function getCurrentAgent() {
    const agents = getAgents();
    const currentId = getCurrentModelId();
    // 找到对应的 model
    for (const agent of agents) {
        for (const model of (agent.models || [])) {
            if (model.id === currentId) {
                return {
                    id: model.id,
                    agentId: agent.id,
                    provider: agent.provider,
                    baseUrl: agent.baseUrl,
                    apiKey: agent.apiKey,
                    modelName: model.modelId,
                    displayName: model.name,
                    maxTokens: model.maxTokens,
                };
            }
        }
    }
    // fallback: 第一个可用模型
    const firstAgent = agents[0];
    const firstModel = (firstAgent && firstAgent.models && firstAgent.models[0]) || {};
    return {
        id: firstModel.id || 'fallback',
        agentId: firstAgent ? firstAgent.id : 'unknown',
        provider: firstAgent ? firstAgent.provider : 'openai',
        baseUrl: firstAgent ? firstAgent.baseUrl : '',
        apiKey: firstAgent ? firstAgent.apiKey : '',
        modelName: firstModel.modelId || 'gpt-4o-mini',
        displayName: firstModel.name || 'Default',
        maxTokens: firstModel.maxTokens,
    };
}

/**
 * 获取所有扁平化模型列表（用于下拉选择）
 */
function getAllFlattenedModels() {
    const agents = getAgents();
    const result = [];
    for (const agent of agents) {
        for (const model of (agent.models || [])) {
            result.push({
                ...model,
                agentId: agent.id,
                provider: agent.provider,
                baseUrl: agent.baseUrl,
                apiKey: agent.apiKey,
                agentName: agent.name,
            });
        }
    }
    return result;
}

function addAgent(agent) {
    const agents = getAgents();
    const newAgent = {
        ...agent,
        id: agent.id || ('agent-' + Date.now()),
        models: agent.models || [],
    };
    agents.push(newAgent);
    saveAgents(agents);
    return newAgent;
}

function updateAgent(agentId, updates) {
    let agents = getAgents();
    agents = agents.map(a => a.id === agentId ? { ...a, ...updates } : a);
    saveAgents(agents);
}

function deleteAgent(agentId) {
    let agents = getAgents();
    if (agents.length <= 1) return false; // 至少保留一个
    agents = agents.filter(a => a.id !== agentId);
    saveAgents(agents);
    // 如果删除的是当前选中模型，切换到第一个
    const currentId = getCurrentModelId();
    const stillExists = agents.some(a => (a.models || []).some(m => m.id === currentId));
    if (!stillExists && agents.length > 0) {
        setCurrentModelId(agents[0].models[0].id);
    }
    return true;
}

// ─── 会话管理 ───
function getSessions() {
    return loadJSON(STORAGE_KEY_SESSIONS, []);
}

function saveSessions(sessions) {
    saveJSON(STORAGE_KEY_SESSIONS, sessions);
}

function createSession(title) {
    const sessions = getSessions();
    const session = {
        id: 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        title: title || '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    sessions.unshift(session); // 最新的在前面
    // 最多保留 50 个会话
    if (sessions.length > 50) sessions.length = 50;
    saveSessions(sessions);
    return session;
}

function getSession(sessionId) {
    const sessions = getSessions();
    return sessions.find(s => s.id === sessionId) || null;
}

function updateSessionMessages(sessionId, messages) {
    const sessions = getSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
        sessions[idx].messages = messages;
        sessions[idx].updatedAt = Date.now();
        // 更新标题（取第一条用户消息）
        if (!sessions[idx].title || sessions[idx].title === '新对话') {
            const firstUserMsg = messages.find(m => m.role === 'user');
            if (firstUserMsg) {
                sessions[idx].title = firstUserMsg.content.slice(0, 40).replace(/\n/g, ' ');
            }
        }
        saveSessions(sessions);
    }
    return sessions[idx] || null;
}

function deleteSession(sessionId) {
    let sessions = getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(sessions);
}

// ─── 设置 ───
function getSettings() {
    return loadJSON(STORAGE_KEY_SETTINGS, {
        showAIPanel: false,
        theme: 'light', // light | dark
        systemPrompt: `你是 Scratch/TurboWarp 扩展构建器的 AI 助手。你可以帮助用户：
1. 解释积木的功能和用法
2. 帮助编写和修改自定义积木
3. 调试代码问题
4. 优化项目结构

请用中文回复。当需要操作工作区时，使用提供的工具。`,
    });
}

function saveSettings(settings) {
    saveJSON(STORAGE_KEY_SETTINGS, settings);
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PROVIDER_OPTIONS, DEFAULT_AGENTS,
        getAgents, saveAgents, getCurrentModelId, setCurrentModelId,
        getCurrentAgent, getAllFlattenedModels,
        addAgent, updateAgent, deleteAgent,
        getSessions, saveSessions, createSession, getSession, updateSessionMessages, deleteSession,
        getSettings, saveSettings,
    };
}
