/**
 * AI Assistant - Provider Adapters
 * 支持 OpenAI / 智谱清言(zhipu) / DeepSeek / Anthropic / 自定义 OpenAI 兼容接口
 * 基于 gandi-plugins ai-assistant providerAdapters.ts 精简适配
 */

const PROVIDER_DEFAULT_URLS = {
    openai: 'https://api.openai.com/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    anthropic: 'https://api.anthropic.com/v1',
    deepseek: 'https://api.deepseek.com',
    custom: '',
    custom_anthropic: '',
};

const OPENAI_COMPATIBLE = new Set(['openai', 'zhipu', 'deepseek', 'custom']);

/**
 * 发送聊天完成请求（流式）
 * @param {Object} opts
 * @param {Object} opts.agent - { baseUrl, apiKey, modelName, provider, maxTokens }
 * @param {Array}  opts.messages - [{role, content}, ...]
 * @param {Array}  [opts.tools] - 工具定义（OpenAI function calling 格式）
 * @param {string} [opts.toolChoice] - tool_choice 参数
 * @param {boolean} [opts.stream=true] - 是否流式
 * @param {AbortSignal} [opts.signal] - 中止信号
 * @param {Function} [opts.onTextDelta] - 文本增量回调
 * @param {Function} [opts.onToolCallsDelta] - 工具调用增量回调
 * @returns {Promise<{content:string, toolCalls:Array, usage:Object}>}
 */
async function sendChatCompletion({
    agent, messages, tools, toolChoice,
    stream = true, signal, onTextDelta, onToolCallsDelta
}) {
    if (OPENAI_COMPATIBLE.has(agent.provider)) {
        return sendOpenAICompatible({ agent, messages, tools, toolChoice, stream, signal, onTextDelta, onToolCallsDelta });
    }
    if (agent.provider === 'anthropic' || agent.provider === 'custom_anthropic') {
        return sendAnthropic({ agent, messages, tools, toolChoice, stream, signal, onTextDelta, onToolCallsDelta });
    }
    throw new Error(`不支持的提供商: ${agent.provider}`);
}

/**
 * OpenAI 兼容接口（含 智谱/DeepSeek/自定义）
 */
async function sendOpenAICompatible({ agent, messages, tools, toolChoice, stream, signal, onTextDelta, onToolCallsDelta }) {
    let url = agent.baseUrl.endsWith('/chat/completions')
        ? agent.baseUrl
        : agent.baseUrl.replace(/\/$/, '') + '/chat/completions';

    const headers = { 'Content-Type': 'application/json' };
    if (agent.apiKey) headers['Authorization'] = `Bearer ${agent.apiKey}`;

    const body = {
        model: agent.modelName,
        messages,
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
        stream,
        ...(agent.maxTokens ? { max_tokens: agent.maxTokens } : {}),
    };

    // DeepSeek thinking mode
    if (agent.provider === 'deepseek' || url.includes('deepseek')) {
        body.thinking = { type: 'enabled' };
    }

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API 错误 ${response.status}: ${errText || response.statusText}`);
    }

    if (!stream) {
        const data = await response.json();
        const msg = data?.choices?.[0]?.message || {};
        return { content: msg.content || '', toolCalls: msg.tool_calls || [], usage: data.usage };
    }

    // 流式读取
    if (!response.body) throw new Error('空响应体');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', content = '';
    const toolCalls = [];
    let usage;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            let parsed;
            try { parsed = JSON.parse(payload); } catch { continue; }
            if (parsed.error) throw new Error(parsed.error?.message || JSON.stringify(parsed.error));
            if (parsed.usage) usage = parsed.usage;
            const choice = parsed.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta;
            if (!delta) continue;
            if (delta.content) { content += delta.content; onTextDelta?.(delta.content); }
            if (Array.isArray(delta.tool_calls)) {
                for (const tcd of delta.tool_calls) {
                    const idx = tcd.index ?? toolCalls.length;
                    if (!toolCalls[idx]) {
                        toolCalls[idx] = { id: tcd.id || '', type: 'function', function: { name: tcd.function?.name || '', arguments: '' } };
                    }
                    if (tcd.id) toolCalls[idx].id = tcd.id;
                    if (tcd.function?.name) toolCalls[idx].function.name += tcd.function.name;
                    if (tcd.function?.arguments) toolCalls[idx].function.arguments += tcd.function.arguments;
                }
                onToolCallsDelta?.(toolCalls.filter(tc => tc.id || tc.function.name));
            }
        }
    }
    return { content, toolCalls: toolCalls.filter(tc => tc.id || tc.function.name), usage };
}

/**
 * Anthropic 接口适配
 */
async function sendAnthropic({ agent, messages, tools, toolChoice, stream, signal, onTextDelta, onToolCallsDelta }) {
    let url = agent.baseUrl.replace(/\/$/, '') + '/messages';
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': agent.apiKey,
        'anthropic-version': '2023-06-01',
    };
    if (signal) headers['anthropic-beta'] = 'prompt-caching-2024-07-31';

    // 转换消息格式：Anthropic 要求 system 单独传
    let systemMsg = '';
    const apiMessages = [];
    for (const msg of messages) {
        if (msg.role === 'system') { systemMsg += (systemMsg ? '\n\n' : '') + msg.content; continue; }
        apiMessages.push({ role: msg.role, content: msg.content });
    }

    const body = {
        model: agent.modelName,
        max_tokens: agent.maxTokens || 4096,
        system: systemMsg || undefined,
        messages: apiMessages,
        stream,
        ...(tools ? { tools: tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) } : {}),
        ...(toolChoice ? { tool_choice: toolChoice === 'auto' ? { type: 'auto' } : { type: 'tool', name: toolChoice } } : {}),
    };

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Anthropic API 错误 ${response.status}: ${errText || response.statusText}`);
    }

    if (!stream) {
        const data = await response.json();
        let content = '';
        const toolCalls = [];
        for (const block of data.content || []) {
            if (block.type === 'text') content += block.text;
            if (block.type === 'tool_use') toolCalls.push({ id: block.id, type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input) } });
        }
        return { content, toolCalls, usage: data.usage };
    }

    // Anthropic SSE 流
    if (!response.body) throw new Error('空响应体');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', content = '';
    const toolCallsMap = {}; // id -> {name, args}
    let usage;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            let parsed;
            try { parsed = JSON.parse(payload); } catch { continue; }
            if (parsed.type === 'error') throw new Error(parsed.error?.message || JSON.stringify(parsed));
            if (parsed.type === 'message_start') { usage = parsed.message?.usage; }
            if (parsed.type === 'content_block_delta') {
                if (parsed.delta.type === 'text_delta') { content += parsed.delta.text; onTextDelta?.(parsed.delta.text); }
                if (parsed.delta.type === 'input_json_delta') {
                    const id = parsed.index !== undefined ? Object.keys(toolCallsMap)[parsed.index] : null;
                    // 简化处理：Anthropic 工具调用在 content_block_start 中有 id
                }
            }
            if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                const cb = parsed.content_block;
                toolCallsMap[cb.id] = { name: cb.name, args: '' };
            }
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
                const blockId = parsed.content_block || '';
                // 找到对应的 tool_use block
                // 简化：通过 index 映射
            }
            if (parsed.type === 'message_delta') {
                usage = { ...usage, ...parsed.usage };
            }
        }
    }

    // 从 map 构建 toolCalls 数组
    const toolCalls = Object.entries(toolCallsMap).map(([id, v]) => ({
        id, type: 'function', function: { name: v.name, arguments: v.args }
    }));
    return { content, toolCalls, usage };
}

/**
 * 测试 API 连通性
 */
async function testConnection(agent) {
    try {
        const result = await sendChatCompletion({
            agent,
            messages: [{ role: 'user', content: '回复"OK"即可，不要其他内容。' }],
            stream: false,
        });
        return { ok: true, content: result.content, usage: result.usage };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PROVIDER_DEFAULT_URLS, sendChatCompletion, testConnection, OPENAI_COMPATIBLE };
}
