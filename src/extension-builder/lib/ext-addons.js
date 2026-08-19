/**
 * ExtAddons — 轻量插件系统（移植自 TurboWarp addons，精选对扩展制作有用的纯 Blockly 层插件）
 *
 * 设计说明：
 * - 完整 TurboWarp addons 框架深度依赖标准 Scratch GUI（redux store、vm、
 *   stage/sprite/paint 编辑器 DOM），无法在纯 Blockly 扩展编辑器（ExtensionBuilder）
 *   中运行。
 * - 本模块只移植「对扩展制作（积木拼装/工作区编辑）有用」且「纯 Blockly /
 *   纯 CSS 层」的插件，用 localStorage 持久化开关，注入方式与官方 addons 一致。
 * - 所有插件在 Blockly 工作区注入完成后调用 applyExtAddons() 激活。
 */

const STORAGE_KEY = 'extbuilder_ext_addons';

const DEFAULT_STATE = {
    'block-duplicate': true,
    'zebra-striping': false,
    'editor-square-inputs': false,
    'editor-number-arrow-keys': true,
    'transparent-orphans': false,
    'developer-tools': true,
};

/**
 * 插件注册表。每个插件：
 *   id           唯一 id（对应 localStorage 键）
 *   name         中文名
 *   description  中文描述
 *   category     分类（编辑器 / 视觉）
 *   css          (可选) 注入的 CSS 字符串
 *   setup        (可选) async (ctx) => cleanup：在 Blockly 注入后调用，返回清理函数
 *   loadStyleOnly 仅样式类插件（无需 setup）
 */
export const EXT_ADDONS = [
    {
        id: 'block-duplicate',
        name: '快速复制积木',
        description: '按住 Alt/⌥ 拖动积木直接复制一份（无需右键）。按住 Ctrl/⌘ 拖动只复制选中的单个积木（cherry pick）。扩展拼装积木时非常好用。',
        category: '编辑器',
        setup: async (ctx) => {
            const B = ctx.Blockly;
            if (!B || !B.Gesture) return () => {};
            // 记录 Ctrl/Alt 键状态
            let ctrlOrMeta = false;
            let alt = false;
            const onMouseDown = (e) => {
                ctrlOrMeta = e.ctrlKey || e.metaKey;
                alt = e.altKey;
            };
            document.addEventListener('mousedown', onMouseDown, {capture: true});

            const origStart = B.Gesture.prototype.startDraggingBlock_;
            B.Gesture.prototype.startDraggingBlock_ = function (...args) {
                const block = this.targetBlock_;
                const isFakeEvent = !(this.mostRecentEvent_ instanceof MouseEvent);
                // block_define（"定义xxx 实现"）积木不可复制——它与左侧积木列表
                // 一一对应，复制会导致工作区与积木列表失去同步（与 setDeletable(false)
                // 同一设计约束）。注意 block 可能为 null（拖空白处），先判空。
                const isProtectedBlock = !block || block.type === 'block_define' ||
                    block.type === 'procedures_definition';
                const isDuplicating = alt && !isFakeEvent && !this.flyout_ &&
                    !this.shouldDuplicateOnDrag_ && !isProtectedBlock;
                const isCherry = ctrlOrMeta && block && !block.isShadow && !block.isShadow() && !isProtectedBlock;
                if (isDuplicating || isCherry) {
                    if (!B.Events.getGroup()) B.Events.setGroup(true);
                }
                if (isDuplicating) {
                    try {
                        this.startWorkspace_.setResizesEnabled(false);
                        B.Events.disable();
                        let newBlock = null;
                        try {
                            const xmlBlock = B.Xml.blockToDom(block);
                            newBlock = B.Xml.domToBlock(xmlBlock, this.startWorkspace_);
                            if (B.scratchBlocksUtils && B.scratchBlocksUtils.changeObscuredShadowIds) {
                                B.scratchBlocksUtils.changeObscuredShadowIds(newBlock);
                            }
                            const xy = block.getRelativeToSurfaceXY();
                            newBlock.moveBy(xy.x, xy.y);
                        } catch (e) { /* 复制失败不影响拖动 */ }
                        if (newBlock) {
                            B.Events.enable();
                            B.Events.setGroup(true);
                        }
                    } catch (e) { /* silent */ }
                }
                return origStart.call(this, ...args);
            };
            return () => {
                B.Gesture.prototype.startDraggingBlock_ = origStart;
                document.removeEventListener('mousedown', onMouseDown, {capture: true});
            };
        }
    },

    {
        id: 'zebra-striping',
        name: '斑马条纹积木',
        description: '嵌套的相同颜色积木（如 重复 里的 重复）交替明暗显示，方便看清嵌套层级。',
        category: '视觉',
        setup: async (ctx) => {
            const B = ctx.Blockly;
            if (!B || !B.BlockSvg) return () => {};
            const origRender = B.BlockSvg.prototype.render;
            B.BlockSvg.prototype.render = function (optBubble) {
                if (!this.isInFlyout && !this.isShadow() && !this.getParent()) {
                    const stripeState = new Map();
                    for (const block of this.getDescendants()) {
                        const parent = block.getSurroundParent();
                        let striped = false;
                        if (parent) {
                            if (block.isShadow()) striped = !!stripeState.get(parent);
                            else if (parent.getColour() === block.getColour()) striped = !stripeState.get(parent);
                        }
                        stripeState.set(block, striped);
                        const els = [block.svgPath_];
                        if (block.inputList) {
                            for (const input of block.inputList) {
                                if (input.outlinePath) els.push(input.outlinePath);
                                if (input.fieldRow) {
                                    for (const f of input.fieldRow) {
                                        if (f.fieldGroup_) els.push(f.fieldGroup_);
                                    }
                                }
                            }
                        }
                        els.forEach(el => el && el.classList && el.classList.toggle('sa-zebra-stripe', striped));
                    }
                }
                return origRender.call(this, optBubble);
            };
            return () => { B.BlockSvg.prototype.render = origRender; };
        },
        css: `
.sa-zebra-stripe { filter: brightness(0.95); }
.blocklyDraggable > .blocklyPath.sa-zebra-stripe { filter: brightness(0.95) saturate(0.9); }
`
    },

    {
        id: 'editor-square-inputs',
        name: '方形数字输入框',
        description: '数字/文本输入框从圆形变为方形，视觉上更清晰地区分输入区域。',
        category: '视觉',
        setup: async (ctx) => {
            const B = ctx.Blockly;
            if (!B || !B.BlockSvg) return () => {};
            const origJsonInit = B.BlockSvg.prototype.jsonInit;
            B.BlockSvg.prototype.jsonInit = function (json) {
                const shapeOverride = {
                    math_number: 'NUMBER', math_integer: 'NUMBER', math_whole_number: 'NUMBER',
                    math_positive_number: 'NUMBER', math_angle: 'NUMBER', note: 'NUMBER',
                    text: 'TEXT', argument_editor_string_number: 'TEXT', colour_picker: 'COLOUR'
                };
                if (shapeOverride[this.type] && !this.isShadow()) {
                    const shape = B.OUTPUT_SHAPE_SQUARE || B.INPUT_SHAPE_SQUARE;
                    if (shape && B.shapesForArgument) {
                        try {
                            const newJson = {...json};
                            // 保持 jsonInit 原有行为，仅对明确映射的块应用方形输出形状
                            const argShape = shapeOverride[this.type] === 'NUMBER' ? 'NUMBER' : 'TEXT';
                            if (B.INPUT_SHAPE_HEXAGONAL && B.INPUT_SHAPE_SQUARE) {
                                newJson.outputShape = B.OUTPUT_SHAPE_SQUARE;
                            }
                            return origJsonInit.call(this, newJson);
                        } catch (e) { /* 降级 */ }
                    }
                }
                return origJsonInit.call(this, json);
            };
            return () => { B.BlockSvg.prototype.jsonInit = origJsonInit; };
        },
        css: `
.blocklyDraggable .blocklyEditableText, .blocklyDraggable .blocklyHtmlInput {
    border-radius: 4px;
}
`
    },

    {
        id: 'editor-number-arrow-keys',
        name: '数字框 ↑↓ 微调',
        description: '聚焦数字输入框时，按 ↑/↓ 键可以快速增减数值，Shift 一次 ±10，替代手动输入。',
        category: '编辑器',
        setup: async (ctx) => {
            const B = ctx.Blockly;
            if (!B) return () => {};
            const handler = (e) => {
                const target = e.target;
                if (!target || target.tagName !== 'INPUT') return;
                const isNum = /^\d*\.?\d*$/.test(target.value || '');
                if (!isNum) return;
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                e.preventDefault();
                e.stopPropagation();
                let v = parseFloat(target.value || '0');
                const step = e.shiftKey ? 10 : 1;
                v = e.key === 'ArrowUp' ? v + step : v - step;
                target.value = String(Math.round(v * 1000) / 1000);
                target.dispatchEvent(new Event('input', {bubbles: true}));
                // 同步 Blockly 字段值
                const field = target._blocklyField;
                if (field && field.setValue) field.setValue(target.value);
            };
            document.addEventListener('keydown', handler, true);
            return () => { document.removeEventListener('keydown', handler, true); };
        }
    },

    {
        id: 'transparent-orphans',
        name: '孤立积木半透明',
        description: '顶部不是帽子积木的孤立积木（没有以帽子启动的脚本）变淡显示，帮助快速发现未接线的积木；帽子积木本身保持清晰。',
        category: '视觉',
        setup: async (ctx) => {
            const { Blockly } = ctx;
            if (!Blockly || !Blockly.BlockSvg) return () => {};

            const CLASS = 'sa-orphan-hat';

            // 帽子 / 脚本起点判定：上方无法再接入任何积木，即 previousConnection
            // 与 outputConnection 都为 null（没有任何东西能接到它上面）。
            // 这样能正确识别本编辑器里的 block_define（"定义xxx 实现"）——它的视觉
            // 形状是帽子，但 nextConnection 可能为 null，用"有 nextConnection"判定
            // 会漏掉它；同时也能识别标准事件帽子（prev/out 为 null、next 有值）。
            // 普通语句块（有 previousConnection）和 Reporter（有 outputConnection）
            // 不会被误判为帽子。
            const isHat = (block) =>
                !!(block && !block.previousConnection && !block.outputConnection);

            // 收集一棵脚本树里的所有积木：自身 + 通过 next 连接的语句块 +
            // 通过输入连接（reporter / 值）连上的积木（含 shadow 占位）。
            // 不依赖 getDescendants 的具体语义，手工遍历更稳（scratch-blocks 定制 fork）。
            const collectChain = (block) => {
                const out = [];
                const stack = [block];
                const seen = new Set();
                while (stack.length) {
                    const b = stack.pop();
                    if (!b || seen.has(b.id)) continue;
                    seen.add(b.id);
                    out.push(b);
                    const next = b.getNextBlock && b.getNextBlock();
                    if (next) stack.push(next);
                    if (b.inputList) {
                        for (const input of b.inputList) {
                            const target = input.connection &&
                                input.connection.targetBlock &&
                                input.connection.targetBlock();
                            if (target) stack.push(target);
                        }
                    }
                }
                return out;
            };

            // 给一棵脚本树打标记（或不打）：
            //  - 是帽子：它自身 + 下方所有积木都标记为不透明
            //  - 非帽子：它自身 + 下方所有积木都确保不带标记（透明）
            // 只有"帽子或挂在帽子下的积木"才不透明；孤立的非帽子积木（含其下级）
            // 一律透明，正是"孤立积木半透明"要的效果。
            const tagChain = (topBlock) => {
                if (!topBlock) return;
                const keep = isHat(topBlock);
                for (const b of collectChain(topBlock)) {
                    const svg = b.getSvgRoot && b.getSvgRoot();
                    if (!svg || !svg.classList) continue;
                    if (keep) svg.classList.add(CLASS);
                    else svg.classList.remove(CLASS);
                }
            };

            const tagWorkspace = (ws) => {
                if (!ws || ws.isFlyout) return;
                let tops;
                try { tops = ws.getTopBlocks(false); } catch (e) { return; }
                for (const block of tops) tagChain(block);
            };

            // 在 Blockly 渲染顶层积木时同步打标记类，确保重渲染后状态正确
            // （仿斑马条纹插件，避免仅靠事件监听可能出现的时序 / 丢标问题）。
            const origRender = Blockly.BlockSvg.prototype.render;
            Blockly.BlockSvg.prototype.render = function (optBubble) {
                const result = origRender.call(this, optBubble);
                // 仅顶层积木参与（与 CSS .blocklyDraggable 作用范围一致）；
                // 子树由 tagWorkspace / 事件统一处理。
                if (!this.isInFlyout && !this.getParent() &&
                    this.svgGroup_ && this.svgGroup_.classList) {
                    if (isHat(this)) this.svgGroup_.classList.add(CLASS);
                    else this.svgGroup_.classList.remove(CLASS);
                }
                return result;
            };

            // 兜底：积木移动 / 断开连接（成为顶层）等事件驱动再标记一次对应工作区。
            // 注意：scratch-blocks 定制 fork 里【没有】全局 Blockly.addChangeListener
            // （实测 typeof 为 undefined），只能挂在具体工作区实例上。若直接调用会抛错
            // 并中断 setup，导致后面的初始打标 retagAll 永远不执行（表现为"所有积木透明"）。
            const listener = (e) => {
                let ws = null;
                if (e && e.workspaceId && Blockly.Workspace && Blockly.Workspace.getById) {
                    ws = Blockly.Workspace.getById(e.workspaceId);
                }
                if (!ws) ws = ctx.getWorkspace && ctx.getWorkspace();
                if (ws) tagWorkspace(ws);
            };
            let removeListener = () => {};
            try {
                const main = ctx.getWorkspace && ctx.getWorkspace();
                if (main && typeof main.addChangeListener === 'function') {
                    main.addChangeListener(listener);
                    removeListener = () => { try { main.removeChangeListener(listener); } catch (e) {} };
                }
            } catch (e) { /* 变更监听是可选的，失败不影响初始打标 */ }

            // ★ 初始打标（核心修复）：覆写安装前已渲染完成的积木不会触发 render 覆写
            // 或变更事件，必须主动遍历一次所有非 flyout 工作区，否则它们永远拿不到
            // sa-orphan-hat 类、被 CSS 判为透明（表现为"所有积木都透明"）。
            // 关键：必须「同步立即执行」+ setTimeout 兜底，不能只依赖 requestAnimationFrame
            // —— 在部分 headless / 隐藏页面下，加载阶段的 rAF 不触发，会导致打标永远不跑。
            const retagAll = () => {
                const tagWs = (ws) => {
                    if (!ws || ws.isFlyout) return;
                    try { tagWorkspace(ws); } catch (e) { /* silent */ }
                };
                const main = ctx.getWorkspace && ctx.getWorkspace();
                if (main) tagWs(main);
                try {
                    const db = Blockly.Workspace && Blockly.Workspace.WorkspaceDB_;
                    if (db && typeof db === 'object') {
                        for (const id in db) tagWs(db[id]);
                    }
                } catch (e) { /* silent */ }
            };
            retagAll();              // 立即打标（setup 运行时积木已渲染完成）
            setTimeout(retagAll, 0); // 兜底：DOM / SVG 完全就绪后再打一次
            setTimeout(retagAll, 500);
            setTimeout(retagAll, 1500);

            return () => {
                Blockly.BlockSvg.prototype.render = origRender;
                removeListener();
                // 清理：移除所有标记类，恢复完全不透明
                try {
                    const workspaces = [];
                    const main = ctx.getWorkspace && ctx.getWorkspace();
                    if (main) workspaces.push(main);
                    const db = Blockly.Workspace && Blockly.Workspace.WorkspaceDB_;
                    if (db && typeof db === 'object') {
                        for (const id in db) { if (db[id]) workspaces.push(db[id]); }
                    }
                    for (const ws of workspaces) {
                        if (!ws || ws.isFlyout) continue;
                        let tops;
                        try { tops = ws.getTopBlocks(false); } catch (e) { continue; }
                        for (const block of tops) {
                            for (const b of collectChain(block)) {
                                const svg = b.getSvgRoot && b.getSvgRoot();
                                if (svg && svg.classList) svg.classList.remove(CLASS);
                            }
                        }
                    }
                } catch (e) { /* silent */ }
            };
        },
        css: `
.blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable:not(.sa-orphan-hat) {
    opacity: 0.6;
    transition: opacity .2s;
}
.blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable:not(.sa-orphan-hat):hover,
.blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable:not(.sa-orphan-hat).blocklyDragging {
    opacity: 1;
}
`
    },

    // ========================================================================
    // （More Right-Click Menu）— 移植自 TurboWarp addons
    // 功能：右键积木新增「全部复制 / 复制积木 / 剪切积木」（内部剪贴板）、
    //       点击空白画布浮现「粘贴」按钮、增强整理积木
    // 子选项：增强"整理积木"、在鼠标指针处粘贴积木
    // ========================================================================
    {
        id: 'developer-tools',
        name: '更多右键菜单栏',
        description: '右键积木新增「全部复制（整条脚本）/ 复制积木（单块）/ 剪切积木」，复制内容存入内部剪贴板；点击空白画布会浮现「粘贴」按钮，点击即可粘贴。区别于原版「复制」直接落一块到画布。',
        category: '编辑器',
        recommended: true,
        options: [
            { id: 'enhanced-cleanup', label: '增强"整理积木"', default: true },
            { id: 'paste-at-mouse', label: '在鼠标指针处粘贴积木', default: true }
        ],
        css: `
`,
        setup: async (ctx) => {
            const B = ctx.Blockly;
            if (!B || !B.Xml || !B.Gesture || !B.ContextMenu) return () => {};

            // ── 子选项读取 ──
            const addonConfig = ctx.addon || {};
            const optionDefs = addonConfig.options || [];
            const getOpts = () => {
                try {
                    // 优先从 localStorage 读最新值（用户可能在面板切换了子选项）
                    const saved = JSON.parse(localStorage.getItem('extbuilder_opts_' + (addonConfig.id || 'developer-tools')) || '{}');
                    const defaults = {};
                    optionDefs.forEach(o => { defaults[o.id] = !!o.default; });
                    return {...defaults, ...saved};
                } catch (e) {
                    const defaults = {};
                    optionDefs.forEach(o => { defaults[o.id] = !!o.default; });
                    return {...defaults};
                }
            };

            // ── 内部剪贴板（XML 字符串）──
            let clipboardXml = null;   // 序列化的 XML 字符串

            // ── 右键上下文捕获 ──
            let lastTarget = null;          // 右键点击的积木
            let lastWorkspace = null;       // 右键所在工作区
            let lastMouseWsPos = null;      // 鼠标位置（workspace 坐标）

            const computeWsPos = (e, ws) => {
                if (!e || !ws || !ws.getCanvas) return null;
                try {
                    const svg = ws.getCanvas();
                    if (svg && svg.createSVGPoint) {
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX; pt.y = e.clientY;
                        const ctm = svg.getScreenCTM();
                        if (ctm) return pt.matrixTransform(ctm.inverse());
                    }
                } catch (err) { /* silent */ }
                return null;
            };

            // ── 工具函数：获取主工作区 ──
            const getMainWs = () => { try { return ctx.getWorkspace && ctx.getWorkspace(); } catch (e) { return null; } };

            // ── 序列化 / 复制到内部剪贴板 ──
            const getStackTop = (b) => {
                let t = b;
                try { while (t.getParent && t.getParent()) t = t.getParent(); } catch (e) {}
                return t;
            };
            const serializeStack = (topBlock) => {                 // 整条连接（含 next 链）
                const xml = B.Xml.blockToDom(topBlock, true);
                return new XMLSerializer().serializeToString(xml);
            };
            const serializeSingle = (block) => {                   // 仅单块：剥掉 <next> 后续链
                const xml = B.Xml.blockToDom(block, true);
                const nextEl = xml.getElementsByTagName('next')[0];
                if (nextEl && nextEl.parentNode) nextEl.parentNode.removeChild(nextEl);
                return new XMLSerializer().serializeToString(xml);
            };
            const setClipboard = (xmlStr) => {
                clipboardXml = xmlStr;
                // 按钮只在点击幕布时出现（showPasteBtn），复制时无需立即显示
            };
            const copyAll = (block) => {   // 全部复制：右键积木连接在一起的全部积木
                if (!block) return;
                try { setClipboard(serializeStack(getStackTop(block))); } catch (e) { console.warn('[MoreRightClick] 复制失败:', e); }
            };
            const copySingle = (block) => { // 复制积木：仅右键单块（含嵌套 input 子积木）
                if (!block) return;
                try { setClipboard(serializeSingle(block)); } catch (e) { console.warn('[MoreRightClick] 复制失败:', e); }
            };
            const cutSingle = (block) => {  // 剪切积木：复制到剪贴板并移除该块
                if (!block) return;
                try {
                    setClipboard(serializeSingle(block));
                    const nextBlock = block.getNextBlock && block.getNextBlock();
                    if (nextBlock && block.nextConnection) {
                        try { block.nextConnection.disconnect(); } catch (e) {}
                    }
                    block.dispose(true);
                } catch (e) { console.warn('[MoreRightClick] 剪切失败:', e); }
            };

            // ── 粘贴积木 ──
            const pasteBlocks = (ws, optX, optY) => {
                if (!clipboardXml || !ws || !B.Xml || !B.Xml.domToBlock) return;
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(clipboardXml, 'text/xml');
                    const blockEl = xmlDoc.documentElement;
                    if (!blockEl || blockEl.tagName !== 'block') return;

                    // 关闭事件分组以避免撤销栈混乱
                    if (!B.Events.getGroup()) B.Events.setGroup(true);

                    const newBlock = B.Xml.domToBlock(blockEl, ws);
                    if (!newBlock) return;

                    // 处理 shadow ID 冲突（与 block-duplicate 一致）
                    if (B.scratchBlocksUtils && B.scratchBlocksUtils.changeObscuredShadowIds) {
                        B.scratchBlocksUtils.changeObscuredShadowIds(newBlock);
                    }

                    // 定位：剪贴板积木不含坐标（domToBlock 落在 0,0），按 delta 移动
                    const cur = newBlock.getRelativeToSurfaceXY ? newBlock.getRelativeToSurfaceXY() : {x: 0, y: 0};
                    let dx, dy;
                    if (optX !== undefined && optY !== undefined) {
                        dx = optX - cur.x; dy = optY - cur.y;
                    } else {
                        dx = 40; dy = 40;
                    }
                    newBlock.moveBy(dx, dy);

                    // 选中新粘贴的积木
                    if (ws.select && newBlock.select) {
                        try { ws.select(newBlock); } catch (e) { /* silent */ }
                    }

                    B.Events.setGroup(false);
                } catch (e) {
                    console.warn('[MoreRightClick] 粘贴失败:', e);
                }
            };

            // ── 增强「整理积木」──
            const enhancedCleanUp = (ws) => {
                if (!ws) return;
                let tops;
                try { tops = ws.getTopBlocks(false); } catch (e) { return; }
                if (!tops || tops.length === 0) return;

                // 分离帽子积木（脚本起点）和孤立非帽子积木
                const hats = [];
                const orphans = [];
                tops.forEach(b => {
                    const isHat = !b.previousConnection && !b.outputConnection;
                    if (isHat) hats.push(b);
                    else orphans.push(b);
                });

                const COL_GAP = 180;  // 列间距
                const ROW_GAP = 48;   // 行间距（标准 Blockly spacing * 1.5）
                let x = 20, maxY = 0;

                const layoutColumn = (blocks) => {
                    let cx = x, cy = 10;
                    blocks.forEach(block => {
                        try {
                            const hw = block.width || block.height || 120;
                            const hh = block.height || block.height || 80;
                            block.moveBy(cx - (block.getRelativeToSurfaceXY ? block.getRelativeToSurfaceXY().x : 0),
                                        cy - (block.getRelativeToSurfaceXY ? block.getRelativeToSurfaceXY().y : 0));
                            cy += hh + ROW_GAP;
                            if (cy > maxY) maxY = cy;
                        } catch (e) { /* 跳过不可移动的 */ }
                    });
                    x += COL_GAP;
                };

                // 先排帽子列（脚本），再排孤立列
                if (hats.length) layoutColumn(hats);
                if (orphans.length) layoutColumn(orphans);

                // 调整工作区滚动范围
                try { ws.resizeContents(); } catch (e) { /* silent */ }
            };

            // ── 捕获右键目标（在原生 showContextMenu_ 之前记录积木/工作区/鼠标位置）──
            const origHandleRightClick = B.Gesture.prototype.handleRightClick;
            B.Gesture.prototype.handleRightClick = function (e) {
                lastTarget = this.targetBlock_ || null;
                lastWorkspace = this.startWorkspace_ || null;
                lastMouseWsPos = computeWsPos(e, lastWorkspace);
                return origHandleRightClick.call(this, e);
            };

            // ── 核心方案：覆写 ContextMenu.show —— 仿 TurboWarp 开发者工具完整菜单 ──
            // 原版菜单结构（右键积木）：
            //   撤销 | 重做 | ── | 整理积木+ | ── | [原生项] | ── | 全部复制/复制积木/剪切积木 | 粘贴
            // 原版菜单结构（右键空白画布）：
            //   撤销 | 重做 | ── | 整理积木+ | ── | 添加注释 | 删除 | ── | 粘贴
            const origShow = B.ContextMenu.show;
            B.ContextMenu.show = function (e, options, rtl) {
                try {
                    const opts = getOpts();
                    const ws = lastWorkspace || getMainWs();
                    const block = lastTarget ||
                        (ws && ws.getSelected && ws.getSelected()) || null;

                    const newOptions = [];

                    // ① 撤销 / 重做（工作区级操作）
                    const canUndo = ws && ws.undoStack && Array.isArray(ws.undoStack) && ws.undoStack.length > 0;
                    const canRedo = ws && ws.redoStack && Array.isArray(ws.redoStack) && ws.redoStack.length > 0;
                    // scratch-blocks 的 undo/redo 通过 Blockly.Events 或 workspace 方法暴露
                    // 尝试多种方式检测
                    let _canUndo = false, _canRedo = false;
                    try {
                        if (B.Events && typeof B.Events.getUndoStack === 'function') {
                            _canUndo = B.Events.getUndoStack().length > 0;
                        }
                        if (B.Events && typeof B.Events.getRedoStack === 'function') {
                            _canRedo = B.Events.getRedoStack().length > 0;
                        }
                    } catch(e) {}
                    // fallback: 通过 workspace 的 undo_/redo_
                    try {
                        if (!_canUndo && ws && ws.undo_ && Array.isArray(ws.undo_)) _canUndo = ws.undo_.length > 0;
                        if (!_canRedo && ws && ws.redo_ && Array.isArray(ws.redo_)) _canRedo = ws.redo_.length > 0;
                    } catch(e) {}

                    newOptions.push({
                        text: '撤销',
                        enabled: _canUndo,
                        callback: () => { try { if (ws && ws.undo) ws.undo(); else if (B.Commands) B.Commands.undo(); } catch(x){} }
                    });
                    newOptions.push({
                        text: '重做',
                        enabled: _canRedo,
                        callback: () => { try { if (ws && ws.redo) ws.redo(); else if (B.Commands) B.Commands.redo(); } catch(x){} }
                    });

                    newOptions.push({text: '──', enabled: false, callback: function(){}});

                    // ② 整理积木+
                    newOptions.push({
                        text: '整理积木' + (opts['enhanced-cleanup'] ? '+' : ''),
                        enabled: !!(ws && ws.getTopBlocks),
                        callback: () => {
                            if (opts['enhanced-cleanup']) enhancedCleanUp(ws);
                            else try { if (ws && ws.cleanUp) ws.cleanUp(); } catch(e){}
                        }
                    });

                    newOptions.push({text: '──', enabled: false, callback: function(){}});

                    // ③ 如果右键的是积木，注入原生选项（options 已由 block.showContextMenu_ 构建）
                    if (block && options && options.length > 0) {
                        // 把原生选项全部接过来（复制、添加注释、删除、帮助等）
                        for (const opt of options) newOptions.push(opt);
                        // 清空原数组避免重复
                        options.length = 0;

                        newOptions.push({text: '──', enabled: false, callback: function(){}});

                        // ④ 自定义复制/剪切项
                        newOptions.push({
                            text: '全部复制',
                            enabled: true,
                            callback: () => { copyAll(block); }
                        });
                        newOptions.push({
                            text: '复制积木',
                            enabled: true,
                            callback: () => { copySingle(block); }
                        });
                        newOptions.push({
                            text: '剪切积木',
                            enabled: (typeof block.isDeletable !== 'function') ? true : block.isDeletable(),
                            callback: () => { cutSingle(block); }
                        });
                    }

                    // ⑤ 粘贴（剪贴板有内容时才启用）
                    newOptions.push({
                        text: '粘贴',
                        enabled: !!clipboardXml,
                        callback: () => {
                            const pasteWs = lastWorkspace || getMainWs();
                            pasteBlocks(pasteWs, lastMouseWsPos ? lastMouseWsPos.x : undefined, lastMouseWsPos ? lastMouseWsPos.y : undefined);
                        }
                    });

                    // 替换 options 为新数组
                    options.length = 0;
                    for (const o of newOptions) options.push(o);

                } catch (err) { /* 任何错误不影响原生菜单 */ }
                return origShow.call(this, e, options, rtl);
            };

            // ── 键盘快捷键：Ctrl+C / Ctrl+V ──
            const onKeyDown = (e) => {
                // Ctrl/Cmd + C = 复制
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey) {
                    const ws = getMainWs();
                    const selected = ws && ws.getSelected && ws.getSelected();
                    if (selected && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable))) {
                        e.preventDefault();
                        e.stopPropagation();
                        const top = selected.getParent ? (function findTop(b){return b.getParent?findTop(b.getParent()):b;})(selected) : selected;
                        copyAll(top);
                    }
                }
                // Ctrl/Cmd + V = 粘贴
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.shiftKey && !e.altKey) {
                    if (clipboardXml && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable))) {
                        e.preventDefault();
                        e.stopPropagation();
                        const ws = getMainWs();
                        if (ws) pasteBlocks(ws);
                    }
                }
            };
            document.addEventListener('keydown', onKeyDown, true);

            // ── 修复：拖拽后 shadow 块（绿色椭圆等）位置漂移 ──
            // 根因：moveOffDragSurface_ 后 shadow 的 outputConnection 坐标变陈旧，
            // 每次 render → tighten_() 用相对位置修正会累积偏移。
            // 修复：拖拽结束后强制对含 shadow 输入的积木做绝对定位重渲染。
            const origMoveOffDragSurface = B.BlockSvg.prototype.moveOffDragSurface_;
            B.BlockSvg.prototype.moveOffDragSurface_ = function (newXY) {
                origMoveOffDragSurface.call(this, newXY);
                try {
                    // 拖拽结束后的下一帧，强制重新渲染本块及所有后代
                    // （requestAnimationFrame 确保 DOM 已从 drag surface 移回 canvas）
                    const self = this;
                    requestAnimationFrame(() => {
                        try {
                            // 从栈顶开始渲染整条链
                            let top = self;
                            while (top.getParent && top.getParent()) top = top.getParent();
                            const rerenderWithShadows = (block) => {
                                if (!block) return;
                                // 强制重新计算连接坐标：先清掉陈旧的 transform 再 render
                                if (block.svgGroup_) {
                                    const root = block.getSvgRoot && block.getSvgRoot();
                                    if (root) {
                                        // 读当前绝对位置
                                        const cur = block.getRelativeToSurfaceXY ? block.getRelativeToSurfaceXY() : {x:0,y:0};
                                        // 重设 transform 为干净的绝对坐标
                                        root.setAttribute('transform', 'translate(' + cur.x + ',' + cur.y + ')');
                                    }
                                }
                                block.render && block.render(true);
                                // 也渲染所有通过 input 连接的子块（shadow 块）
                                if (block.inputList) {
                                    for (const inp of block.inputList) {
                                        const target = inp.connection && inp.connection.targetBlock && inp.connection.targetBlock();
                                        if (target) rerenderWithShadows(target);
                                    }
                                }
                                // 渲染 next 链上的后续块
                                const next = block.getNextBlock && block.getNextBlock();
                                if (next) rerenderWithShadows(next);
                            };
                            rerenderWithShadows(top);
                        } catch(e) { /* silent */ }
                    });
                } catch(e) { /* silent */ }
            };

            // ── 增强「整理积木」──
            // 当子选项开启时，用增强版替换默认的 cleanUp
            let origCleanUp = null;
            const tryPatchCleanup = () => {
                const opts = getOpts();
                if (opts['enhanced-cleanup'] && B.WorkspaceSvg && B.WorkspaceSvg.prototype.cleanUp && !origCleanUp) {
                    origCleanUp = B.WorkspaceSvg.prototype.cleanUp;
                    B.WorkspaceSvg.prototype.cleanUp = function (...args) {
                        enhancedCleanUp(this);
                    };
                } else if (!opts['enhanced-cleanup'] && origCleanUp) {
                    B.WorkspaceSvg.prototype.cleanUp = origCleanUp;
                    origCleanUp = null;
                }
            };
            tryPatchCleanup();

            // 监听子选项变化（其他地方写入 localStorage 时同步更新行为）
            let _lastOptsStr = JSON.stringify(getOpts());
            const optsPoller = setInterval(() => {
                const cur = JSON.stringify(getOpts());
                if (cur !== _lastOptsStr) {
                    _lastOptsStr = cur;
                    tryPatchCleanup();
                }
            }, 500);

            return () => {
                // 清理所有覆写
                B.Gesture.prototype.handleRightClick = origHandleRightClick;
                B.ContextMenu.show = origShow;
                B.BlockSvg.prototype.moveOffDragSurface_ = origMoveOffDragSurface;
                document.removeEventListener('keydown', onKeyDown, true);
                clearInterval(optsPoller);
                if (origCleanUp) {
                    B.WorkspaceSvg.prototype.cleanUp = origCleanUp;
                }
                clipboardXml = null;
                lastTarget = null; lastWorkspace = null; lastMouseWsPos = null;
            };
        }
    }

];

/**
 * ============================================================
 * 自定义插件（用户从本地 JS 文件导入，持久化在 localStorage）
 * ============================================================
 * 导入的 JS 文件需导出一个插件对象（CommonJS：module.exports = {...}，
 * 或 ES Module：export default {...}），结构：
 *   {
 *     id: 'my-plugin',        // 唯一 id（与内置插件 id 冲突时后者覆盖前者）
 *     name: '我的插件',       // 中文名
 *     description: '...',     // 描述
 *     category: '自定义',     // 分类（可选，默认「自定义」）
 *     css: '...',             // 可选，注入的 CSS 字符串
 *     setup: function(ctx) {  // 必填，返回清理函数
 *       const B = ctx.Blockly;
 *       // 改装逻辑……
 *       return function cleanup() { 在 cleanup 中还原原型并移除监听 };
 *     }
 *   }
 * 也可导出数组一次导入多个插件。
 *
 * 注意：setup 必须是「自包含」函数（不依赖文件内其它变量/helper），因为它会被
 * 序列化为源码字符串（setupCode）在页面加载时重新编译执行。
 */
const CUSTOM_ADDONS_KEY = 'extbuilder_custom_addons';

// 去掉函数引用，返回可 JSON 序列化的纯对象（保留 setupCode 源码）
const stripCustomFn = (a) => {
    const {setup, ...rest} = a;
    return rest;
};

// 解析当前可用的 Blockly 实例（窗口优先，其次全局）
function resolveBlockly() {
    if (typeof window !== 'undefined') {
        if (window._extBuilderBlockly) return window._extBuilderBlockly;
        if (window.Blockly) return window.Blockly;
    }
    if (typeof globalThis !== 'undefined' && globalThis.Blockly) return globalThis.Blockly;
    return undefined;
}

// 把存储的 setupCode 还原成函数
function rehydrateSetup(addon) {
    if (typeof addon.setup === 'function') return addon.setup;
    if (typeof addon.setupCode === 'string') {
        try {
            const code = 'module.exports = (' + addon.setupCode + ');';
            const fn = new Function('module', 'exports', 'Blockly', code);
            const module = {exports: {}};
            const blk = resolveBlockly();
            fn(module, module.exports, blk);
            return typeof module.exports === 'function' ? module.exports : (() => {});
        } catch (e) {
            console.error('[ExtAddons] 自定义插件「' + (addon.id || '?') + '」setup 解析失败:', e);
            return () => {};
        }
    }
    return () => {};
}

/**
 * 读取已导入并持久化的自定义插件（带已还原的 setup 函数）
 */
export function loadCustomAddons() {
    try {
        const raw = localStorage.getItem(CUSTOM_ADDONS_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map(a => ({...a, custom: true, setup: rehydrateSetup(a)}));
    } catch (e) { return []; }
}

/**
 * 持久化自定义插件列表（自动去掉不可序列化的函数）
 */
export function saveCustomAddons(list) {
    try {
        localStorage.setItem(CUSTOM_ADDONS_KEY, JSON.stringify((list || []).map(stripCustomFn)));
    } catch (e) { /* localStorage 不可用时静默 */ }
}

/**
 * 从 JS 文件文本导入自定义插件。
 * @param {string} fileText 文件内容
 * @returns {Array} 成功导入的插件定义数组（已写入 localStorage）
 * @throws {Error} 格式错误时抛异常
 */
export function importCustomAddonFromFile(fileText) {
    if (typeof fileText !== 'string' || !fileText.trim()) {
        throw new Error('文件内容为空');
    }
    let code = fileText;
    // 支持 `export default {...}` → 转写为 CommonJS module.exports
    if (/export\s+default/.test(code)) {
        code = code.replace(/export\s+default\s+/, 'module.exports = ');
        // 屏蔽其它 export 语句（简单处理，避免重新编译时报语法错误）
        code = code.replace(/^[ \t]*export\s+/gm, '// export ');
    }
    const module = {exports: {}};
    const blk = resolveBlockly();
    const win = (typeof window !== 'undefined' ? window : undefined);
    // 在受控作用域里执行，提供 module/exports/Blockly/ctx/window
    const fn = new Function('module', 'exports', 'Blockly', 'ctx', 'window', code);
    fn(module, module.exports, blk, undefined, win);
    const exp = module.exports;
    if (!exp) {
        throw new Error('文件未导出插件对象（请用 module.exports = {...} 或 export default {...}）');
    }
    const list = Array.isArray(exp) ? exp : [exp];
    const valid = [];
    for (const a of list) {
        if (!a || typeof a.id !== 'string' || !a.id.trim()) {
            throw new Error('插件缺少有效的 id 字段');
        }
        if (typeof a.setup !== 'function') {
            throw new Error('插件「' + (a.id || '?') + '」缺少 setup 函数');
        }
        valid.push({
            id: a.id.trim(),
            name: a.name || a.id,
            description: a.description || '',
            category: a.category || '自定义',
            css: typeof a.css === 'string' ? a.css : '',
            setupCode: a.setup.toString(),
            custom: true
        });
    }
    // 合并：删除同名旧插件，追加新插件
    const existing = loadCustomAddons().map(stripCustomFn);
    const merged = existing.filter(e => !valid.some(v => v.id === e.id)).concat(valid);
    saveCustomAddons(merged);
    return valid;
}

/**
 * 删除一个自定义插件（按 id）
 */
export function removeCustomAddon(id) {
    const existing = loadCustomAddons().map(stripCustomFn);
    saveCustomAddons(existing.filter(e => e.id !== id));
}

/**
 * 内置插件 + 自定义插件（运行时合并，用于列表渲染与激活）
 */
export function getAllAddons() {
    return [...EXT_ADDONS, ...loadCustomAddons()];
}

/**
 * 读取插件开关状态（默认值合并）
 */
export function getAddonState() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) { saved = {}; }
    const state = {};
    getAllAddons().forEach(a => {
        // 自定义插件默认关闭（不在 DEFAULT_STATE 里）；内置插件用 DEFAULT_STATE 默认值
        state[a.id] = saved[a.id] === undefined ? !!DEFAULT_STATE[a.id] : !!saved[a.id];
    });
    return state;
}

/**
 * 保存插件开关状态
 */
export function setAddonState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* localStorage 不可用时静默 */ }
}

/**
 * 激活（或重新激活）所有启用的插件。
 * @param {object} ctx { Blockly, getWorkspace }
 * @returns {Promise<() => void>} 清理函数
 *
 * 注意：串行化执行（内部 promise 链），避免快速连续切换开关时并发
 * apply 互相覆盖（A 的 cleanup 恢复原型后 B 的 setup 又覆写，最终状态
 * 取决于时序）。每次 apply 前先移除同 id 的旧 style，保证幂等。
 */
let _applyQueue = Promise.resolve();
export async function applyExtAddons(ctx) {
    const run = async () => {
        const state = getAddonState();
        const cleanups = [];
        const styleEls = [];

        // 幂等：移除所有已注入的插件样式（可能来自上次 apply）
        document.querySelectorAll('style[data-ext-addon]').forEach(el => el.remove());

        for (const addon of getAllAddons()) {
            if (!state[addon.id]) continue;
            // 注入 CSS
            if (addon.css) {
                const style = document.createElement('style');
                style.setAttribute('data-ext-addon', addon.id);
                style.textContent = addon.css;
                document.head.appendChild(style);
                styleEls.push(style);
            }
            // 执行 setup
            if (typeof addon.setup === 'function') {
                try {
                    const cleanup = await addon.setup({...ctx, addon});
                    if (typeof cleanup === 'function') cleanups.push(cleanup);
                } catch (e) {
                    console.error('[ExtAddons] 插件 ' + addon.id + ' 初始化失败:', e);
                }
            }
        }

        return () => {
            cleanups.forEach(fn => { try { fn(); } catch (e) { /* silent */ } });
            styleEls.forEach(el => { try { el.remove(); } catch (e) { /* silent */ } });
        };
    };

    // 排队：前一个 apply 完成后才执行本次，避免并发覆写
    const result = _applyQueue.then(run, run);
    _applyQueue = result.catch(() => {});
    return result;
}

/**
 * 子选项状态管理（用于有 options 的插件，如 developer-tools）
 * 键格式：extbuilder_opts_{addonId}
 */
const OPTS_STORAGE_PREFIX = 'extbuilder_opts_';

/**
 * 获取某插件的子选项状态
 * @param {string} addonId 插件 id
 * @param {Array} optionDefs 选项定义数组 [{id, default}]
 * @returns {Object} {optionId: boolean, ...}
 */
export function getAddonOptions(addonId, optionDefs) {
    const defaults = {};
    (optionDefs || []).forEach(o => { defaults[o.id] = !!o.default; });
    try {
        const saved = JSON.parse(localStorage.getItem(OPTS_STORAGE_PREFIX + addonId) || '{}');
        return {...defaults, ...saved};
    } catch (e) { return {...defaults}; }
}

/**
 * 保存某插件的子选项状态
 * @param {string} addonId 插件 id
 * @param {Object} opts {optionId: boolean, ...}
 */
export function setAddonOptions(addonId, opts) {
    try {
        localStorage.setItem(OPTS_STORAGE_PREFIX + addonId, JSON.stringify(opts));
    } catch (e) { /* silent */ }
}
