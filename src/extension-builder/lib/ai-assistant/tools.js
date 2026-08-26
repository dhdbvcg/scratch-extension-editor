/**
 * AI Assistant - Workspace Tools
 * AI 可调用的工具：读取积木、搜索积木、获取代码、写入积木等
 * 通过 workspaceRef (Blockly.WorkspaceSvg) 操作
 */

/**
 * 获取工作区概览
 * @param {Blockly.WorkspaceSvg} workspace
 */
function getWorkspaceOverview(workspace) {
    if (!workspace) return { error: '工作区不可用' };
    try {
        const allBlocks = workspace.getAllBlocks ? workspace.getAllBlocks() : [];
        const realBlocks = allBlocks.filter(b => !b.isShadow && !b.disabled);
        const byType = { hat: 0, command: 0, reporter: 0, boolean: 0 };
        const blockList = [];
        realBlocks.forEach(b => {
            let type = 'command';
            if (b.outputConnection) {
                type = (b.outputConnection.check_ && b.outputConnection.check_.includes('Boolean')) ? 'boolean' : 'reporter';
            } else if (b.previousConnection === null && b.nextConnection !== null) {
                type = 'hat';
            }
            byType[type]++;
            blockList.push({
                id: b.id,
                type: b.type || '(unknown)',
                category: type,
                opcode: b.type || '',
                // 尝试获取积木显示文本
                text: getBlockText(b),
            });
        });
        return {
            totalBlocks: realBlocks.length,
            byType,
            blocks: blockList,
            topLevelBlocks: realBlocks.filter(b => !b.getSurroundParent()).length,
        };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * 获取积木的显示文本（递归拼接字段值）
 */
function getBlockText(block) {
    if (!block) return '';
    try {
        const inputList = block.inputList || [];
        let texts = [];
        for (const input of inputList) {
            if (input.connection && input.connection.targetBlock()) {
                texts.push(getBlockText(input.connection.targetBlock()));
            } else if (input.fieldRow) {
                for (const field of input.fieldRow) {
                    if (typeof field.getText === 'function') texts.push(field.getText());
                    else if (field instanceof window.ScratchFieldLabel) texts.push(field.text_ || '');
                }
            }
        }
        return texts.join(' ') || block.type || '';
    } catch (e) {
        return block.type || '';
    }
}

/**
 * 搜索积木（按 opcode 或文本内容）
 * @param {Blockly.WorkspaceSvg} workspace
 * @param {string} query
 */
function searchBlocks(workspace, query) {
    if (!workspace) return { results: [], error: '工作区不可用' };
    try {
        const q = (query || '').toLowerCase();
        const allBlocks = workspace.getAllBlocks().filter(b => !b.isShadow && !b.disabled);
        const results = allBlocks.filter(b => {
            const opcode = (b.type || '').toLowerCase();
            const text = getBlockText(b).toLowerCase();
            return opcode.includes(q) || text.includes(q);
        }).map(b => ({
            id: b.id,
            type: b.type,
            text: getBlockText(b),
            isTopLevel: !b.getSurroundParent(),
        }));
        return { query, count: results.length, results };
    } catch (e) {
        return { results: [], error: e.message };
    }
}

/**
 * 获取当前代码（通过 javascriptGenerator）
 * @param {Blockly.WorkspaceSvg} workspace
 * @param {Object} javascriptGenerator
 */
function getCurrentCode(workspace, javascriptGenerator) {
    if (!workspace) return { code: '', error: '工作区不可用' };
    try {
        let code = '';
        if (javascriptGenerator && typeof javascriptGenerator.workspaceToCode === 'function') {
            code = javascriptGenerator.workspaceToCode(workspace);
        }
        const lineCount = code.split('\n').length;
        const byteSize = new Blob([code], { type: 'text/javascript' }).size;
        return { code, lineCount, byteSize };
    } catch (e) {
        return { code: '', error: e.message };
    }
}

/**
 * 获取自定义积木定义列表
 * @param {Array} customBlocks - ExtensionBuilder 的 customBlocks state
 */
function getCustomBlocksInfo(customBlocks) {
    if (!customBlocks || !Array.isArray(customBlocks)) return { blocks: [] };
    return {
        blocks: customBlocks.map((b, i) => ({
            index: i,
            id: b.id || `block_${i}`,
            name: b.name || '(未命名)',
            type: b.blockType || 'command',
            inputs: (b.inputs || []).map(inp => ({ name: inp.name || '', type: inp.type || 'string' })),
            hasOutput: ['reporter', 'boolean'].includes(b.blockType),
        })),
        count: customBlocks.length,
    };
}

/**
 * 构建工具定义列表（OpenAI function calling 格式）
 * 返回给 AI 的工具 schema
 */
function getToolSchemas() {
    return [
        {
            type: 'function',
            function: {
                name: 'get_workspace_overview',
                description: '获取当前 Scratch/ExtensionBuilder 工作区的完整概览，包括所有积木数量、分类、每个积木的 ID 和类型。用于了解项目当前状态。',
                parameters: { type: 'object', properties: {}, required: [] },
            },
        },
        {
            type: 'function',
            function: {
                name: 'search_blocks',
                description: '在工作区中搜索积木，支持按 opcode 或积木显示文本模糊匹配。用于查找特定功能的积木。',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: '搜索关键词，如 "motion"、"移动"、"when flag" 等' },
                    },
                    required: ['query'],
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'get_current_code',
                description: '获取当前工作区生成的 JavaScript 代码（扩展格式）。用于查看和修改项目代码。',
                parameters: { type: 'object', properties: {}, required: [] },
            },
        },
        {
            type: 'function',
            function: {
                name: 'get_custom_blocks_info',
                description: '获取 ExtensionBuilder 中已定义的自定义积木列表，包括名称、类型、输入参数等。用于了解可用的自定义积木。',
                parameters: { type: 'object', properties: {}, required: [] },
            },
        },
        {
            type: 'function',
            function: {
                name: 'update_todo_list',
                description: '更新任务进度列表，让用户看到当前正在做什么。每次调用传入完整的有序任务列表。',
                parameters: {
                    type: 'object',
                    properties: {
                        todos: {
                            type: 'array',
                            description: '完整的有序任务列表',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: '稳定的任务 ID' },
                                    title: { type: 'string', description: '简短的任务标题' },
                                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
                                },
                                required: ['title', 'status'],
                            },
                        },
                    },
                    required: ['todos'],
                },
            },
        },
    ];
}

/**
 * 执行工具调用
 * @param {string} toolName
 * @param {Object} args - 解析后的参数对象
 * @param {Object} ctx - { workspace, javascriptGenerator, customBlocks }
 * @returns {Promise<Object>} 工具执行结果
 */
async function executeTool(toolName, args, ctx) {
    switch (toolName) {
        case 'get_workspace_overview':
            return getWorkspaceOverview(ctx.workspace);
        case 'search_blocks':
            return searchBlocks(ctx.workspace, args.query);
        case 'get_current_code':
            return getCurrentCode(ctx.workspace, ctx.javascriptGenerator);
        case 'get_custom_blocks_info':
            return getCustomBlocksInfo(ctx.customBlocks);
        case 'update_todo_list':
            return { success: true, todos: args.todos };
        default:
            return { error: `未知工具: ${toolName}` };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getWorkspaceOverview, searchBlocks, getCurrentCode, getCustomBlocksInfo,
        getToolSchemas, executeTool, getBlockText,
    };
}
