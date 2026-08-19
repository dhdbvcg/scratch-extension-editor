/**
 * Extension Editor - A Blockly-based Scratch/TurboWarp extension editor
 *
 * Defensive version: works even if Blockly fails to load
 */

import React, {useState, useEffect, useRef, useCallback, Component} from 'react';
import LazyScratchBlocks from '../lib/tw-lazy-scratch-blocks.js';
import {
    TOOLBOX_CONFIG,
    BLOCK_DEFINITIONS,
    CODE_GENERATORS,
    javascriptGenerator
} from '../lib/block-definitions.js';
import {applyZhTranslations} from '../lib/scratch-blocks-zh.js';
import {EXT_FORGE_RUNTIME, withUtilInjection} from '../lib/extforge-runtime.js';
import {getSession, login, register, logout as authLogout, getUserMeta} from '../lib/auth.js';
import {
    listSaves, saveProject, deleteSave, exportSaveFile, parseSaveFileText,
    collectProjectState, restoreProjectState
} from '../lib/saves.js';
import {buildSyncUrl, parseSyncPayload, importSyncPayload} from '../lib/sync.js';
import {
    cloudAvailable, cloudSearchUsers, cloudListRelations, cloudFollow, cloudUnfollow
} from '../lib/cloud.js';
import {EXT_ADDONS, getAllAddons, getAddonState, setAddonState, applyExtAddons, getAddonOptions, setAddonOptions, importCustomAddonFromFile, removeCustomAddon} from '../lib/ext-addons.js';
import '../styles/extension-builder.css';

// 积木预设颜色（Scratch 风格常用色，供积木定义面板选择）
const BLOCK_COLOURS = [
    '#FF6680', // 红
    '#FFAB19', // 橙
    '#FFD500', // 黄
    '#59C059', // 绿
    '#0FBD8C', // 青
    '#4C97FF', // 蓝
    '#9966FF', // 紫（默认）
    '#A66F48'  // 棕
];

/**
 * For each (block, input_name) we map to the standard block type whose
 * shadow child will be attached as the placeholder. Numbers use
 * math_number, strings use text, booleans use logic_boolean. When a real
 * reporter block is plugged in, Blockly swaps the shadow out automatically.
 */
const PLACEHOLDER_SHADOWS = {
    control_wait:     {TIME: {type: 'math_number', field: 'NUM', value: 1}},
    control_repeat:   {TIMES: {type: 'math_number', field: 'NUM', value: 10}},
    control_return:   {VALUE: {type: 'text', field: 'TEXT', value: ''}},
    control_inlineReturn:{VALUE: {type: 'text', field: 'TEXT', value: ''}},
    math_arithmetic:  {A: {type: 'math_number', field: 'NUM', value: 0}, B: {type: 'math_number', field: 'NUM', value: 0}},
    math_single:      {NUM: {type: 'math_number', field: 'NUM', value: 0}},
    math_round:       {NUM: {type: 'math_number', field: 'NUM', value: 0}},
    math_random:      {FROM: {type: 'math_number', field: 'NUM', value: 1}, TO: {type: 'math_number', field: 'NUM', value: 10}},
    math_trig:        {NUM: {type: 'math_number', field: 'NUM', value: 0}},
    math_compare:     {A: {type: 'math_number', field: 'NUM', value: 0}, B: {type: 'math_number', field: 'NUM', value: 0}},
    string_concat:    {A: {type: 'text', field: 'TEXT', value: ''}, B: {type: 'text', field: 'TEXT', value: ''}},
    string_slice:     {STR: {type: 'text', field: 'TEXT', value: ''}, START: {type: 'math_number', field: 'NUM', value: 0}, END: {type: 'math_number', field: 'NUM', value: 0}},
    string_indexOf:   {STR: {type: 'text', field: 'TEXT', value: ''}, SUBSTR: {type: 'text', field: 'TEXT', value: ''}},
    string_length:    {STR: {type: 'text', field: 'TEXT', value: ''}},
    string_contains:  {STR: {type: 'text', field: 'TEXT', value: ''}, SUBSTR: {type: 'text', field: 'TEXT', value: ''}},
    string_replace:   {STR: {type: 'text', field: 'TEXT', value: ''}, OLD: {type: 'text', field: 'TEXT', value: ''}, NEW: {type: 'text', field: 'TEXT', value: ''}},
    string_trim:      {STR: {type: 'text', field: 'TEXT', value: ''}},
    string_toUpperCase:{STR: {type: 'text', field: 'TEXT', value: ''}},
    string_toLowerCase:{STR: {type: 'text', field: 'TEXT', value: ''}},
    string_regex:     {STR: {type: 'text', field: 'TEXT', value: ''}, PATTERN: {type: 'text', field: 'TEXT', value: ''}},
    vector_create:    {X: {type: 'math_number', field: 'NUM', value: 0}, Y: {type: 'math_number', field: 'NUM', value: 0}},
    var_set:          {VALUE: {type: 'text', field: 'TEXT', value: ''}},
    var_change:       {DELTA: {type: 'math_number', field: 'NUM', value: 0}},
    list_getItem:     {INDEX: {type: 'math_number', field: 'NUM', value: 0}},
    list_indexOf:     {ITEM: {type: 'text', field: 'TEXT', value: ''}},
    list_contains:    {ITEM: {type: 'text', field: 'TEXT', value: ''}},
    list_addItem:     {ITEM: {type: 'text', field: 'TEXT', value: ''}},
    list_removeItem:  {INDEX: {type: 'math_number', field: 'NUM', value: 0}},
    list_replaceItem: {INDEX: {type: 'math_number', field: 'NUM', value: 0}, ITEM: {type: 'text', field: 'TEXT', value: ''}},
    func_return:      {VALUE: {type: 'text', field: 'TEXT', value: ''}},
    block_field_number:{DEFAULT: {type: 'math_number', field: 'NUM', value: 0}},
    browser_alert:    {MSG: {type: 'text', field: 'TEXT', value: ''}},
    browser_console:  {MSG: {type: 'text', field: 'TEXT', value: ''}},
    browser_localStorageSet:{VALUE: {type: 'text', field: 'TEXT', value: ''}},
    browser_openUrl:  {URL: {type: 'text', field: 'TEXT', value: ''}},
    music_playTone:   {FREQ: {type: 'math_number', field: 'NUM', value: 440}, TIME: {type: 'math_number', field: 'NUM', value: 1}},
    music_playNote:   {BEATS: {type: 'math_number', field: 'NUM', value: 1}},
    music_rest:       {BEATS: {type: 'math_number', field: 'NUM', value: 1}},
    music_setVolume:  {VOLUME: {type: 'math_number', field: 'NUM', value: 50}},
    music_setTempo:   {TEMPO: {type: 'math_number', field: 'NUM', value: 120}},
    event_whenTimerGreaterThan: {VALUE: {type: 'math_number', field: 'NUM', value: 10}},
    event_whenLoudnessGreaterThan: {VALUE: {type: 'math_number', field: 'NUM', value: 10}},
    motion_moveSteps: {STEPS: {type: 'math_number', field: 'NUM', value: 10}},
    motion_turnRight: {DEGREES: {type: 'math_number', field: 'NUM', value: 15}},
    motion_turnLeft: {DEGREES: {type: 'math_number', field: 'NUM', value: 15}},
    motion_pointInDirection: {DIRECTION: {type: 'math_number', field: 'NUM', value: 90}},
    motion_glideTo: {SECS: {type: 'math_number', field: 'NUM', value: 1}, X: {type: 'math_number', field: 'NUM', value: 0}, Y: {type: 'math_number', field: 'NUM', value: 0}},
    looks_say: {MESSAGE: {type: 'text', field: 'TEXT', value: '你好!'}, SECS: {type: 'math_number', field: 'NUM', value: 2}},
    looks_think: {MESSAGE: {type: 'text', field: 'TEXT', value: '嗯...'}},
    looks_changeSize: {CHANGE: {type: 'math_number', field: 'NUM', value: 10}},
    net_httpGet: {URL: {type: 'text', field: 'TEXT', value: 'https://example.com/api'}},
    net_httpPost: {URL: {type: 'text', field: 'TEXT', value: 'https://example.com/api'}, BODY: {type: 'text', field: 'TEXT', value: '{}'}},
    net_jsonParse: {JSON: {type: 'text', field: 'TEXT', value: '{"a":1}'}, KEY: {type: 'text', field: 'TEXT', value: 'a'}},
    time_waitMs: {MS: {type: 'math_number', field: 'NUM', value: 1000}}
};

const DEFAULT_EXTENSION_INFO = {
    id: 'myextension',
    name: '我的第一个扩展',
    description: '',
    author: '',
    docsUrl: '',
    license: 'MPL-2.0',
    color1: '#FF6680',
    color2: '#FF4D6A',
    color3: '#FF3355',
    categoryIcon: '',
    blockIcon: '',
    customId: false,
    blocks: []
};

// Common open-source licenses for Scratch extensions
const LICENSE_OPTIONS = [
    'MPL-2.0',
    'MIT',
    'Apache-2.0',
    'GPL-3.0',
    'BSD-3-Clause',
    'CC-BY-4.0',
    'CC0-1.0',
    'Proprietary'
];

const COLOR_PRESETS = [
    ['#FF6680', '#FF4D6A', '#FF3355'],
    ['#4C97FF', '#4280D7', '#3373CC'],
    ['#9966FF', '#855CD6', '#774DCB'],
    ['#0FBD8C', '#0DA57A', '#0B8E69'],
    ['#FF8C1A', '#FF8000', '#DB6E00'],
    ['#FFBF00', '#E6AC00', '#CC9900'],
    ['#5CB1D7', '#4A9DC0', '#3D8AA8'],
    ['#CF63CF', '#BB4FBC', '#A53EA5']
];

// Error boundary to catch rendering errors
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {error: null};
    }
    static getDerivedStateFromError(error) {
        return {error};
    }
    componentDidCatch(error, info) {
        console.error('ExtensionBuilder error:', error, info);
    }
    render() {
        if (this.state.error) {
            return (
                <div className="ext-builder-error">
                    <h2>运行时错误</h2>
                    <pre style={{whiteSpace: 'pre-wrap', maxWidth: '80%', overflow: 'auto'}}>
                        {this.state.error.toString()}
                    </pre>
                    <button onClick={() => window.location.reload()}>刷新页面</button>
                </div>
            );
        }
        return this.props.children;
    }
}

const ExtensionBuilder = () => {
    return (
        <ErrorBoundary>
            <ExtensionBuilderInner />
        </ErrorBoundary>
    );
};

const ExtensionBuilderInner = () => {
    const blocklyDivRef = useRef(null);
    const workspaceRef = useRef(null);
    const [generatedCode, setGeneratedCode] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [activeTab, setActiveTab] = useState('editor');
    const [showBlockBuilder, setShowBlockBuilder] = useState(false);
    const [builderModalPos, setBuilderModalPos] = useState(null); // {x, y}
    const builderModalRef = useRef(null);
    const builderDragRef = useRef(null); // {startX, startY, origX, origY}
    // Blockly workspace XML is stored in a ref instead of React state so
    // that drag operations don't trigger component re-renders (which
    // were causing the floating builder window's block list to flash /
    // disappear during drags).
    const customBlockXmlRef = useRef(new Map());

    // Close the floating builder window with the Escape key.
    useEffect(() => {
        if (!showBlockBuilder) return;
        const onKey = (e) => {
            if (e.key === 'Escape') setShowBlockBuilder(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [showBlockBuilder]);

    // Drag the floating builder window by its header.
    const handleBuilderDragStart = useCallback((e) => {
        if (e.button !== 0 || !builderModalRef.current) return;
        const rect = builderModalRef.current.getBoundingClientRect();
        builderDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: rect.left,
            origY: rect.top
        };
        document.addEventListener('mousemove', handleBuilderDragMove);
        document.addEventListener('mouseup', handleBuilderDragEnd);
        e.preventDefault();
    }, []);

    const handleBuilderDragMove = useCallback((e) => {
        if (!builderDragRef.current) return;
        const dx = e.clientX - builderDragRef.current.startX;
        const dy = e.clientY - builderDragRef.current.startY;
        setBuilderModalPos({
            x: builderDragRef.current.origX + dx,
            y: builderDragRef.current.origY + dy
        });
    }, []);

    const handleBuilderDragEnd = useCallback(() => {
        builderDragRef.current = null;
        document.removeEventListener('mousemove', handleBuilderDragMove);
        document.removeEventListener('mouseup', handleBuilderDragEnd);
    }, [handleBuilderDragMove]);
    const [searchTerm, setSearchTerm] = useState('');
    const [extInfo, setExtInfo] = useState(DEFAULT_EXTENSION_INFO);
    const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
    const [editingBlockId, setEditingBlockId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [showExtensionSettings, setShowExtensionSettings] = useState(false);
    const [settingsDraft, setSettingsDraft] = useState(null);
    const [showBlockPreview, setShowBlockPreview] = useState(false);

    // ---- 登录 / 存档 / 跨站同步 ----
    const [session, setSession] = useState(() => getSession());
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
    const [authUser, setAuthUser] = useState('');
    const [authPass, setAuthPass] = useState('');
    const [authPass2, setAuthPass2] = useState('');
    const [authError, setAuthError] = useState('');
    const [authBusy, setAuthBusy] = useState(false);
    const [authRemember, setAuthRemember] = useState(true); // 自动登录（记住我）默认开启
    const [showSavesPanel, setShowSavesPanel] = useState(false);
    const [savesList, setSavesList] = useState([]);
    const [saveNameInput, setSaveNameInput] = useState('');
    const [saveMsg, setSaveMsg] = useState('');
    const [syncLinkText, setSyncLinkText] = useState('');
    const [syncInput, setSyncInput] = useState('');

    // ExtAddons 插件系统：弹窗开关 + 激活清理
    const [showAddonsPanel, setShowAddonsPanel] = useState(false);
    const [addonState, setAddonStateInternal] = useState(() => getAddonState());
    const [addonSearch, setAddonSearch] = useState('');
    const [addonOpts, setAddonOptsInternal] = useState(() => {
        // 初始化所有有 options 的插件的子选项状态
        const opts = {};
        getAllAddons().filter(a => a.options && a.options.length).forEach(a => {
            opts[a.id] = getAddonOptions(a.id, a.options);
        });
        return opts;
    });
    const extAddonsCleanupRef = useRef(null);

    // 个人主页
    const [showProfilePanel, setShowProfilePanel] = useState(false);
    const [profileMeta, setProfileMeta] = useState(null);
    const [profileCounts, setProfileCounts] = useState({following: 0, followers: 0});

    // 好友 / 关注
    const [showFriendsPanel, setShowFriendsPanel] = useState(false);
    const [friendsTab, setFriendsTab] = useState('friends'); // 'friends' | 'following' | 'followers'
    const [friendsRelations, setFriendsRelations] = useState([]); // [{follower, followee}]
    const [friendsSearch, setFriendsSearch] = useState('');
    const [friendsResults, setFriendsResults] = useState([]);
    const [friendsBusy, setFriendsBusy] = useState(false);
    const [friendsMsg, setFriendsMsg] = useState('');

    // Block management state (like Scratch's sprite list)
    const [customBlocks, setCustomBlocks] = useState([
        {
            id: 'block_1', name: '我的第一个积木', xml: null,
            blockType: 'command', isTerminal: false, isAsync: false,
            attachAllThreads: false, filterSprite: true, filterStage: true, icon: '',
            colour: ''
        },
        {
            id: 'block_2', name: '我的第二个积木', xml: null,
            blockType: 'command', isTerminal: false, isAsync: false,
            attachAllThreads: false, filterSprite: true, filterStage: true, icon: '',
            colour: ''
        },
        {
            id: 'block_3', name: '我的第三个积木', xml: null,
            blockType: 'command', isTerminal: false, isAsync: false,
            attachAllThreads: false, filterSprite: true, filterStage: true, icon: '',
            colour: ''
        }
    ]);
    // 派生：代码面板显示的内容 = 与导出 .js 文件完全一致（wrapAsExtension 输出）。
    // 放这里是为了确保 generatedCode / extInfo / customBlocks 都已声明（避免 TDZ）。
    const exportableCode = React.useMemo(() => {
        if (!generatedCode && !(customBlocks && customBlocks.length)) return '';
        try {
            return wrapAsExtension(extInfo, generatedCode, customBlocks);
        } catch (e) {
            return '// 包装失败：' + (e && e.message ? e.message : String(e)) +
                '\n\n/* 原始生成代码 */\n' + generatedCode;
        }
    }, [extInfo, generatedCode, customBlocks]);
    const [copyMsg, setCopyMsg] = useState('');
    const copyMsgTimerRef = useRef(null);
    const [currentBlockId, setCurrentBlockId] = useState('block_1');
    const currentBlockRef = useRef('block_1');
    // Keep a ref to quickly save current workspace without re-render
    const saveWorkspaceRef = useRef(() => {});

    // Load scratch-blocks
    useEffect(() => {
        let cancelled = false;
        try {
            if (LazyScratchBlocks.isLoaded()) {
                setLoaded(true);
                return;
            }
            LazyScratchBlocks.load()
                .then((BlocklyModule) => {
                    if (cancelled) return;
                    // BlocklyModule is the scratch-blocks default export (the Blockly global)
                    const Blockly = BlocklyModule && (BlocklyModule.default || BlocklyModule);
                    console.log('scratch-blocks loaded. Blockly:', typeof Blockly);
                    console.log('Blockly.inject:', typeof (Blockly && Blockly.inject));
                    console.log('Blockly.Blocks:', typeof (Blockly && Blockly.Blocks));
                    // Make sure window.Blockly also has the right reference
                    if (Blockly && typeof Blockly.inject === 'function') {
                        window.Blockly = Blockly;
                    }
                    setLoaded(true);
                })
                .catch(err => {
                    console.error('Failed to load scratch-blocks:', err);
                    if (!cancelled) {
                        setLoadError(err.message || String(err));
                        setLoaded(true);
                    }
                });
        } catch (e) {
            console.error('LazyScratchBlocks error:', e);
            setLoadError(e.message);
            setLoaded(true);
        }
        return () => { cancelled = true; };
    }, []);

    // Initialize Blockly workspace
    useEffect(() => {
        if (!loaded || workspaceLoaded || !blocklyDivRef.current) return;

        try {
            // Try multiple sources to get Blockly
            let Blockly = null;
            if (LazyScratchBlocks.get) {
                Blockly = LazyScratchBlocks.get();
            }
            if (!Blockly && window.Blockly && typeof window.Blockly.inject === 'function') {
                Blockly = window.Blockly;
            }

            if (!Blockly || typeof Blockly.inject !== 'function') {
                console.error('Blockly not properly loaded', {
                    fromLazy: typeof (LazyScratchBlocks.get && LazyScratchBlocks.get()),
                    fromWindow: typeof window.Blockly,
                    windowKeys: window.Blockly ? Object.keys(window.Blockly).slice(0, 20) : []
                });
                setLoadError('Blockly.inject function not available. Check browser console.');
                return;
            }

            // Set Blockly media path to local scratch-blocks media (avoid blockly-demo.appspot.com requests)
            if (Blockly.utils && typeof Blockly.utils._MEDIA_URL !== 'undefined') {
                Blockly.utils._MEDIA_URL = '/static/blocks-media/default/';
            }

            // Register all custom blocks
            let registeredCount = 0;
            Object.entries(BLOCK_DEFINITIONS).forEach(([type, def]) => {
                if (!Blockly.Blocks) {
                    console.warn('Blockly.Blocks not found, creating empty object');
                    Blockly.Blocks = {};
                }
                // Register all custom blocks (override any built-in Scratch
                // blocks with the same type — e.g. event_broadcast,
                // control_wait — so custom shapes apply).
                if (Blockly.Blocks[type]) {
                    Blockly.Blocks[type] = null; // force re-init with custom def
                }
                // Clean the definition: remove type (set externally), keep everything else
                const cleanDef = {};
                Object.keys(def).forEach(k => {
                    if (k !== 'type') cleanDef[k] = def[k];
                });
                Blockly.Blocks[type] = {
                    init: function () {
                        // Apply hat shape for HAT blocks before jsonInit, so SVG renders
                        // the curved top instead of a flat one. scratch-blocks detects
                        // this via the `shape_hat` extension which calls setInputsInline
                        // + setNextStatement + sets `this.hat_ = true`. We must also
                        // REMOVE the previousStatement field — otherwise Blockly's
                        // jsonInit treats `previousStatement: null` as "create a
                        // previousConnection of any type", which gives the block a
                        // flat top with a notch instead of a curved hat top.
                        if (cleanDef.id === 'HAT') {
                            delete cleanDef.previousStatement;
                            const baseExts = (def.extensions || []).filter(function (e) { return e !== 'shape_hat'; });
                            cleanDef.extensions = baseExts.concat(['shape_hat']);
                            // block_define uses the same yellow as other hat blocks
                            // (scratch event category) so it looks identical.
                            if (type === 'block_define') {
                                cleanDef.colour = 45;
                            }
                        }
                        // Use jsonInit for all output shape decisions.
                        // This avoids infinite recursion that occurs when
                        // calling setOutput + jsonInit separately.
                        this.jsonInit(cleanDef);
                        // After jsonInit, override the bottom notch for block_define.
                        // shape_hat extension sets setNextStatement(true) which
                        // creates a C-shape notch at the bottom. Remove it so
                        // block_define looks like an ordinary hat block (flat
                        // bottom, no C notch) — matching CB-ExtGallary / scratch
                        // standard hat appearance.
                        if (type === 'block_define') {
                            this.setNextStatement(false);
                        }
                        // After jsonInit, set the output shape if applicable.
                        if (this.outputConnection) {
                            let outputShape = null;
                            if (cleanDef.output === 'Boolean') {
                                outputShape = 1;
                            } else if (cleanDef.output === 'Number' ||
                                       cleanDef.output === 'String') {
                                outputShape = 2;
                            }
                            if (outputShape !== null) {
                                this.setOutputShape(outputShape);
                            }
                        }

                        // For blocks that show a value preview below
                        // (boolean/return blocks), wrap the VALUE field text
                        // with a white background rect that mirrors the
                        // runtime preview in TurboWarp.
                        const previewTypes = ['logic_boolean', 'control_return',
                            'control_inlineReturn', 'func_return'];
                        if (previewTypes.indexOf(type) >= 0) {
                            const valueField = this.getField('VALUE');
                            if (valueField) {
                                valueField.extNeedsBox_ = true;
                                this.extValueField_ = valueField;
                            }
                        }

                        // NOTE: Editable input placeholders are injected via the toolbox
                        // XML as shadow child blocks (<shadow type="math_number">).
                        // Blockly's flyout automatically clones these onto every
                        // block created from the toolbox. For blocks created
                        // programmatically via ws.newBlock(), we attach the
                        // same shadow children here so the visual style is
                        // consistent everywhere.
                        const shadowSpec = PLACEHOLDER_SHADOWS[type];
                        if (shadowSpec && this.workspace) {
                            Object.keys(shadowSpec).forEach((iname) => {
                                const spec = shadowSpec[iname];
                                const input = this.getInput(iname);
                                if (!input || !input.connection) return;
                                if (input.connection.targetBlock()) return;
                                try {
                                    const shadow = this.workspace.newBlock(spec.type);
                                    shadow.setShadow(true);
                                    shadow.setFieldValue(String(spec.value), spec.field);
                                    shadow.initSvg();
                                    shadow.render();
                                    input.connection.connect(shadow.outputConnection);
                                } catch (e) {
                                    // ignore — likely shadow already exists from toolbox
                                }
                            });
                        }
                    }
                };
                registeredCount++;
            });
            console.log('[ExtBuilder] Registered', registeredCount, 'custom blocks');

            // Verify a sample block was created correctly
            const sampleBlock = Blockly.Blocks['event_whenLoaded'];
            if (!sampleBlock) {
                console.error('event_whenLoaded block NOT registered!');
                setLoadError('Block registration failed - no blocks registered');
                return;
            }

            // Set Blockly media path and utils before injection
            if (!Blockly.utils) {
                Blockly.utils = {};
            }
            if (typeof Blockly.utils._MEDIA_URL !== 'string') {
                Blockly.utils._MEDIA_URL = '/static/blocks-media/default/';
            }
            // Initialize xml namespace if missing
            if (!Blockly.utils.xml) {
                Blockly.utils.xml = {};
            }
            if (typeof DOMParser !== 'undefined' && !Blockly.utils.xml.DOM_PARSER) {
                Blockly.utils.xml.DOM_PARSER = new DOMParser();
            }

            // Build multi-category toolbox XML from TOOLBOX_CONFIG (16 categories).
            // Each category shows its own block types from block-definitions.js.
            // The "id" attribute is critical: scratch-blocks uses it for the
            // category menu dots (scratchCategoryId-{id}), so clicking a dot
            // scrolls the flyout to the correct category section.
            const categoryIds = [
                'events', 'control', 'math', 'strings', 'vectors',
                'input', 'variables', 'lists', 'functions', 'blocks',
                'runtime', 'targets', 'browser', 'music', 'script', 'extra'
            ];
            const toolboxXml = '<xml xmlns="https://developers.google.com/blockly/xml">' +
                TOOLBOX_CONFIG.contents.map((cat, idx) => {
                    const childXml = cat.contents.map(b => {
                        const shadows = PLACEHOLDER_SHADOWS[b.type];
                        if (!shadows) return `<block type="${b.type}"/>`;
                        const valueXml = Object.keys(shadows).map(name => {
                            const s = shadows[name];
                            return `<value name="${name}"><shadow type="${s.type}"><field name="${s.field}">${s.value}</field></shadow></value>`;
                        }).join('');
                        return `<block type="${b.type}">${valueXml}</block>`;
                    }).join('');
                    const safeName = String(cat.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeColour = String(cat.colour || '#FF6680').replace(/[^#0-9a-fA-F]/g, '');
                    const catId = categoryIds[idx] || 'cat' + idx;
                    return `<category name="${safeName}" id="${catId}" colour="${safeColour}" secondaryColour="${safeColour}">${childXml}</category>`;
                }).join('') +
                '</xml>';
            console.log('[ExtBuilder] Toolbox XML length:', toolboxXml.length);

            // Apply Chinese translations BEFORE inject so Blockly renders blocks
            // with Chinese text from the start (instead of waiting for DOM mutations)
            applyZhTranslations(Blockly);
            console.log('[ExtBuilder] Chinese translations applied to Blockly.Msg');

            // Inject workspace with our custom toolbox. scratch-blocks' default
            // toolbox has 10 categories — we replace it with a SINGLE 自制积木
            // category matching CB-ExtGallary layout.
            const workspace = Blockly.inject(blocklyDivRef.current, {
                toolbox: toolboxXml,
                media: '/static/blocks-media/default/',
                grid: {
                    spacing: 25,
                    length: 3,
                    colour: '#ccc',
                    snap: false
                },
                zoom: {
                    controls: true,
                    wheel: true,
                    startScale: 0.55,
                    maxScale: 3,
                    minScale: 0.3,
                    scaleSpeed: 1.1
                },
                trashcan: true,
                sounds: false,
                // 禁用"折叠所有积木/展开所有积木"右键菜单项，避免
                // scratch-blocks 因 Blockly.Msg.COLLAPSE_ALL/EXPAND_ALL 未
                // 定义而渲染出空白按钮（点击后会把自定义积木塌缩成
                // 小图标，用户很容易误以为是 bug）。
                collapse: false
            });
            console.log('[ExtBuilder] Workspace injected. Initial block count:', workspace.getAllBlocks(false).length);

            // Force scale to match original TurboWarp (BLOCKS_DEFAULT_SCALE = 0.55)
            // This ensures blocks are the same size as turbowarp.org/editor
            // even if startScale option was ignored by scratch-blocks.
            try {
                if (workspace.setScale) workspace.setScale(0.55);
            } catch(e) {}

            // Hide inline input fields when a reporter block is plugged into the
            // same socket. Blockly's input_value renderer doesn't know that
            // we appended a field, so we toggle the field's SVG group
            // (g.blocklyEditableText / blocklyFieldTextGroup) visibility
            // directly on every change.
            // (no runtime helper needed — placeholder fields are declared in args0.)
            // (placeholder fields are declared directly in BLOCK_DEFINITIONS
            // args0; Blockly handles placeholder visibility automatically when
            // a target block is plugged in — no runtime sync needed.)

            // CRITICAL: scratch-blocks queries container size on inject and caches it.
            // After CSS layout completes, the host div may have grown from 0 → N px.
            // We must call resizeSvg on next animation frame so the SVG fills the host.
            const forceResize = () => {
                try {
                    if (typeof Blockly.svgResize === 'function') {
                        Blockly.svgResize(workspace);
                    } else if (typeof workspace.resizeSvg === 'function') {
                        workspace.resizeSvg();
                    } else if (typeof Blockly.resizeSvg === 'function') {
                        Blockly.resizeSvg();
                    }
                    if (typeof Blockly.fireUiEvent === 'function') {
                        Blockly.fireUiEvent(workspace, 'resize');
                    } else if (typeof workspace.fireUiEvent === 'function') {
                        workspace.fireUiEvent('resize');
                    }
                } catch (e) {
                    console.warn('[ExtBuilder] resizeSvg failed:', e);
                }
                console.log('[ExtBuilder] Workspace resized. SVG size:', workspace.getMetrics ? (() => {
                    const m = workspace.getMetrics();
                    return m ? `${Math.round(m.viewWidth)}x${Math.round(m.viewHeight)}` : 'no metrics';
                })() : 'no metrics method');
            };

            // Resize on next animation frame (DOM has been laid out by then)
            requestAnimationFrame(() => {
                requestAnimationFrame(forceResize);
                // Re-apply scale after resize (resizeSvg may reset it)
                try { if (workspace.setScale) workspace.setScale(0.55); } catch(e) {}
            });
            // Also resize on a delayed schedule as a safety net
            const resizeTimer = setTimeout(() => {
                forceResize();
                try { if (workspace.setScale) workspace.setScale(0.55); } catch(e) {}
            }, 250);

            // Translate default Scratch toolbox categories from English to Chinese.
            // scratch-blocks injects its own category menu (scratchCategoryMenu)
            // with English names like "Motion". We rewrite them in the DOM on the
            // next frame after the menu has been rendered.
            const enToZh = {
                Motion: '运动', Looks: '外观', Sound: '声音',
                Events: '事件', Control: '控制', Sensing: '侦测',
                Operators: '运算', Data: '数据', DataLists: '数据列表',
                More: '更多', Extensions: '扩展',
                Variables: '变量', 'My Blocks': '自制积木'
            };
            const translateToolbox = () => {
                const labels = document.querySelectorAll('.scratchCategoryMenuItemLabel');
                let translated = 0;
                labels.forEach(el => {
                    const raw = el.textContent.trim();
                    if (enToZh[raw] && el.textContent !== enToZh[raw]) {
                        el.textContent = enToZh[raw];
                        translated++;
                    }
                });
                // Also try aria-label / title on the menu item itself
                const items = document.querySelectorAll('.scratchCategoryMenuItem');
                items.forEach(el => {
                    const match = el.className.match(/scratchCategoryId-(\w+)/);
                    if (!match) return;
                    const eng = match[1].charAt(0).toUpperCase() + match[1].slice(1);
                    if (enToZh[eng]) {
                        // Update aria-label or any visible attribute
                        const label = el.querySelector('.scratchCategoryMenuItemLabel');
                        if (!label) {
                            // Fallback: create label if missing
                            const span = document.createElement('span');
                            span.className = 'scratchCategoryMenuItemLabel';
                            span.textContent = enToZh[eng];
                            el.appendChild(span);
                            translated++;
                        }
                    }
                });

                // Translate the small "Extension" header text that scratch-blocks
                // renders at the top of every extension_xxx block in the flyout.
                // The text is rendered as an SVG <text> by the FlyoutExtensionCategoryHeader
                // or by the block itself. Match on text content == "Extension" only.
                const extLabels = document.querySelectorAll('text.blocklyText');
                extLabels.forEach(el => {
                    const txt = (el.textContent || '').trim();
                    if (txt === 'Extension') {
                        el.textContent = '扩展';
                        translated++;
                    }
                });

                // Translate the flyout section header text (e.g. "Extensions"
                // that appears below the "Make a Block" button inside the
                // 制作积木 flyout). Class is blocklyFlyoutLabelText.
                const flyoutLabels = document.querySelectorAll('.blocklyFlyoutLabelText');
                flyoutLabels.forEach(el => {
                    const txt = (el.textContent || '').trim();
                    if (enToZh[txt] && el.textContent !== enToZh[txt]) {
                        el.textContent = enToZh[txt];
                        translated++;
                    } else if (txt === 'Extensions') {
                        el.textContent = '扩展积木';
                        translated++;
                    } else if (txt === 'Extension') {
                        el.textContent = '扩展';
                        translated++;
                    }
                });

                // Category dot click navigation: let scratch-blocks handle it
                // natively. In multi-category toolbox mode, clicking a dot
                // scrolls the flyout to that category while keeping all other
                // categories' blocks visible below/above. No custom filtering
                // is needed — scratch-blocks' setSelectedItemFactory already
                // does this (toolbox.js:732).

                // Inject a 创建积木 button at the bottom of the flyout.
                // Blockly's flyout and workspace roots are <svg>, so HTML
                // children get zero size. Append to the host div (HTML) and
                // absolute-position over the bottom of the flyout.
                const flyout = document.querySelector('.blocklyFlyout');
                if (!flyout) {
                    // flyout not rendered yet, skip this cycle
                    return false;
                }

                if (translated > 0) {
                    console.log('[ExtBuilder] Translated', translated, 'toolbox category labels to Chinese');
                }
                return translated > 0;
            };
            // Retry up to 5 times (every 200ms) until toolbox DOM is ready
            const translateTimer = setInterval(() => {
                if (translateToolbox()) clearInterval(translateTimer);
            }, 200);
            setTimeout(() => {
                clearInterval(translateTimer);
                translateToolbox(); // one last attempt
            }, 1500);

            // HTML floating preview widget — shown below ANY reporter block
            // (oval or hex shape, i.e. has outputConnection) when clicked.
            const isReporter = (block) => !!block.outputConnection;
            const previewDivs = {}; // block.id -> { div, block }
            var activePreviewBlockId = null;

            const ensurePreviewDiv = (block) => {
                if (!isReporter(block)) return;
                var text = '';
                var vf = block.getField('VALUE');
                if (!vf && block.type === 'logic_boolean') vf = block.getField('BOOL');
                if (!vf && block.type === 'math_number') vf = block.getField('NUM');
                if (vf) {
                    var raw = vf.getValue();
                    if (block.type === 'logic_boolean') {
                        // Show true/false in the white box, not 真/假
                        text = raw === 'TRUE' ? 'true' : 'false';
                    } else {
                        text = raw || '';
                    }
                }
                // For blocks whose VALUE field is empty (return blocks with
                // nothing plugged in), fall through to the code generator
                // to show the actual computed value.
                if (!text) {
                    try {
                        var fn = CODE_GENERATORS[block.type];
                        if (typeof fn === 'function') {
                            var code = fn(block);
                            if (Array.isArray(code)) code = code[0];
                            code = String(code || '');

                            // Build a sandbox with a stub runtime so blocks
                            // like mouseX / timer can produce real-looking values.
                            var sandbox = {
                                Math: Math,
                                String: String,
                                Number: Number,
                                Array: Array,
                                // Common scratch runtime objects referenced by code
                                runtime: {
                                    ioDevices: {
                                        mouse: {
                                            getScratchX: function () { return window.mouseX || 0; },
                                            getScratchY: function () { return window.mouseY || 0; },
                                            getIsDown: function () { return false; }
                                        },
                                        keyboard: {
                                            getKeyIsDown: function () { return false; }
                                        }
                                    },
                                    currentMSecs: 0,
                                    frameRate: 30,
                                    start: function () {},
                                    stop: function () {},
                                    createClone: function () {},
                                    deleteThisClone: function () {},
                                    broadcast: function () {}
                                },
                                // Stub scratch list/variable references (commonly
                                // appear in list_contains, var_get, etc.)
                                myList: [],
                                list: [],
                                arr: [],
                                __var: 0,
                                __str: '',
                                __bool: false,
                                __arr: []
                            };
                            var keys = Object.keys(sandbox);
                            var vals = keys.map(function (k) { return sandbox[k]; });
                            var fnBody = 'return (' + code + ')';
                            try {
                                var result = (new Function(...keys, fnBody))(...vals);
                                window.__extEvalDebug = {code: code, fnBody: fnBody, result: result};
                            } catch (e2) {
                                // ReferenceError (e.g. undefined variable name from
                                // user's list/var) → boolean blocks fall back to
                                // false, value blocks show the code expression
                                // itself (never a misleading 'false').
                                var blockDef = BLOCK_DEFINITIONS[block.type];
                                var isHex = blockDef && blockDef.output === 'Boolean';
                                if (e2 instanceof ReferenceError ||
                                    /is not defined/.test(e2.message)) {
                                    result = isHex ? false : code;
                                    window.__extEvalErr = e2.message;
                                } else {
                                    result = code; // unknown error → show code
                                    window.__extEvalErr = e2.message;
                                }
                            }
                            // Format the value — booleans always become 'true'/'false'
                            if (typeof result === 'boolean') {
                                text = 'true' === String(result) ? 'true' :
                                       'false' === String(result) ? 'false' : String(result);
                            } else if (typeof result === 'number') {
                                text = Number.isInteger(result) ? String(result) :
                                    code.indexOf('Math.PI') >= 0 ? result.toFixed(6) :
                                    String(Math.round(result * 1000) / 1000);
                            } else if (typeof result === 'string') {
                                text = result;
                            } else if (result === undefined || result === null) {
                                // Undefined result (e.g. list index out of
                                // range) → show the code expression, never
                                // the literal string 'undefined'
                                text = code;
                            } else if (code === 'true' || code === 'false') {
                                text = code;
                            } else {
                                text = String(result);
                            }
                        } else { text = '...'; }
                    } catch (e) { text = '...'; }
                }
                var entry = previewDivs[block.id];
                if (!entry) {
                    var wrap = document.createElement('div');
                    wrap.className = 'ext-value-preview';
                    wrap.style.cssText = [
                        'position:absolute','z-index:999',
                        'background:#ffffff','border:1px solid #cccccc',
                        'border-radius:8px',
                        'box-shadow:0 1px 2px rgba(0,0,0,0.15),0 3px 12px rgba(0,0,0,0.2),0 6px 24px rgba(0,0,0,0.1)',
                        'padding:4px 6px',
                        'font-family:Helvetica,Arial,sans-serif','font-size:13px','font-weight:500',
                        'color:#222222',
                        'white-space:nowrap','text-align:center',
                        'display:inline-flex','align-items:center','gap:6px',
                        'display:none','transition:opacity 0.15s ease','opacity:0',
                        'pointer-events:auto'
                    ].join(';');

                    var span = document.createElement('span');
                    span.className = 'ext-value-text';
                    span.style.cssText = 'min-width:18px; user-select:text;';

                    var btn = document.createElement('button');
                    btn.className = 'ext-value-copy';
                    btn.textContent = '\uD83D\uDCCB';
                    btn.title = '\u590D\u5236\u8FD4\u56DE\u503C';
                    btn.style.cssText = [
                        'background:none','border:none','cursor:pointer',
                        'font-size:12px','padding:1px 3px','margin:0',
                        'line-height:1','opacity:0.5',
                        'border-radius:4px'
                    ].join(';');
                    btn.onmouseenter = function () { this.style.opacity = '1'; };
                    btn.onmouseleave = function () { this.style.opacity = '0.5'; };
                    btn.onclick = function (e) {
                        e.stopPropagation();
                        var txt = span.textContent || '';
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(txt).then(function () {
                                btn.textContent = '\u2714\uFE0F';
                                setTimeout(function () { btn.textContent = '\uD83D\uDCCB'; }, 1200);
                            });
                        }
                    };

                    wrap.appendChild(span);
                    wrap.appendChild(btn);
                    document.body.appendChild(wrap);
                    entry = { div: wrap, span: span };
                    previewDivs[block.id] = entry;
                }
                entry.block = block;
                // Hex blocks (output: 'Boolean') MUST show only true / false
                var def = BLOCK_DEFINITIONS[block.type];
                var isHexBlock = def && def.output === 'Boolean';
                if (isHexBlock) {
                    if (text !== 'true' && text !== 'false') {
                        text = (!text || text === '...' || text === '0') ? 'false' : 'true';
                    }
                }
                entry.span.textContent = text || '...';
            };

            const showPreview = (block) => {
                var entry = previewDivs[block.id];
                if (!entry) return;
                var svgRoot = block.getSvgRoot();
                if (!svgRoot) return;
                var rect = svgRoot.getBoundingClientRect();
                var div = entry.div;
                // Cancel any pending fade-out timer
                if (div._fadeTimer) { clearTimeout(div._fadeTimer); div._fadeTimer = null; }
                div.style.display = 'inline-flex';
                div.style.left = (rect.left + rect.width / 2) + 'px';
                div.style.top = (rect.bottom + 4) + 'px';
                div.style.opacity = '1';
                activePreviewBlockId = block.id;
            };

            const hideAllPreviews = () => {
                activePreviewBlockId = null;
                var ids = Object.keys(previewDivs);
                for (var i = 0; i < ids.length; i++) {
                    var div = previewDivs[ids[i]].div;
                    div.style.opacity = '0';
                    // Hide after fade completes — store handle to cancel on re-show
                    div._fadeTimer = setTimeout(function (d) {
                        d.style.display = 'none';
                    }.bind(null, div), 120);
                }
            };

            const repositionActive = () => {
                if (!activePreviewBlockId) return;
                var entry = previewDivs[activePreviewBlockId];
                if (!entry) return;
                var block = entry.block;
                if (!block || !block.workspace) {
                    // Block was deleted — faded hide
                    if (entry.div) { entry.div.style.opacity = '0'; }
                    activePreviewBlockId = null;
                    return;
                }
                var svgRoot = block.getSvgRoot();
                if (!svgRoot) return;
                var rect = svgRoot.getBoundingClientRect();
                entry.div.style.left = (rect.left + rect.width / 2) + 'px';
                entry.div.style.top = (rect.bottom + 4) + 'px';
                entry.div.style.opacity = '1';
            };

            const removePreviewDiv = (block) => {
                var entry = previewDivs[block.id];
                if (entry) {
                    if (entry.div && entry.div.parentNode) {
                        entry.div.parentNode.removeChild(entry.div);
                    }
                    delete previewDivs[block.id];
                }
                if (activePreviewBlockId === block.id) activePreviewBlockId = null;
            };

            // Ensure every reporter block has its hidden div created
            const refreshValueBoxes = () => {
                workspace.getAllBlocks(false).forEach(function (b) {
                    if (!isReporter(b)) { removePreviewDiv(b); return; }
                    ensurePreviewDiv(b);
                });
            };

            // Single capture-phase handler: intercept ALL mousedowns before
            // any Blockly handler. Decision matrix:
            //  - dropdown text → pass through (Blockly opens dropdown)
            //  - preview block body → stop + show white box
            //  - outside → hide white box
            document.addEventListener('mousedown', function (e) {
                var el = e.target;
                while (el) {
                    if (el.classList && el.classList.contains('ext-value-preview')) return;
                    el = el.parentNode;
                }
                // Walk up to find what was clicked
                var clickedBlockId = null;
                var onDropdownText = false;
                var inDropDown = false;
                el = e.target;
                while (el) {
                    // Skip if clicking inside Blockly's dropdown menu
                    if (el.classList && (
                        el.classList.contains('blocklyDropDownDiv') ||
                        el.classList.contains('blocklyWidgetDiv'))) {
                        inDropDown = true;
                    }
                    if (el.classList && el.classList.contains('blocklyDropdownText')) {
                        onDropdownText = true;
                    }
                    if (el.classList && el.classList.contains('blocklyDraggable')) {
                        clickedBlockId = el.getAttribute('data-id');
                        break;
                    }
                    el = el.parentElement;
                }
                // Dropdown area → let Blockly handle everything, keep preview
                if (onDropdownText || inDropDown) {
                    window.__extDropClick = (window.__extDropClick||0)+1;
                    return;
                }
                // Preview block body → show white box
                if (clickedBlockId && previewDivs[clickedBlockId]) {
                    var blk = workspace.getBlockById(clickedBlockId);
                    if (blk && isReporter(blk)) {
                        // Boolean block: stop event so Blockly doesn't open dropdown
                        if (blk.type === 'logic_boolean') {
                            e.stopImmediatePropagation();
                        }
                        showPreview(blk);
                        return;
                    }
                }
                // Outside → hide white box, let event continue to Blockly
                hideAllPreviews();
            }, true); // capture phase

            // MutationObserver on workspace SVG — refresh divs and
            // reposition active preview when DOM changes
            try {
                var svgCanvas = workspace.getCanvas();
                if (svgCanvas && window.MutationObserver) {
                    var valueBoxObserver = new MutationObserver(function () {
                        refreshValueBoxes();
                        repositionActive();
                    });
                    valueBoxObserver.observe(svgCanvas, {
                        childList: true, subtree: true,
                        attributes: false, characterData: true
                    });
                }
            } catch (e) {
                console.warn('Could not set up value box observer:', e);
            }

            // Hat-block visual fix: the top curve is drawn at negative-y
            // coordinates and gets clipped, so shift every hat block's
            // group down by 18px to bring the curve into view.
            try {
                const hatFix = () => {
                    if (!svgCanvas) return;
                    svgCanvas.querySelectorAll('.blocklyDraggable[data-shapes~="hat"]').forEach(function (g) {
                        if (g.getAttribute('data-hat-fixed') === '1') return;
                        g.setAttribute('data-hat-fixed', '1');
                        const cur = g.getAttribute('transform') || '';
                        const m = cur.match(/translate\(([^)]+)\)/);
                        const baseX = m ? Number(m[1].split(',')[0]) || 0 : 0;
                        const baseY = m ? Number(m[1].split(',')[1]) || 0 : 0;
                        g.setAttribute('transform', 'translate(' + baseX + ',' + (baseY + 18) + ')');
                    });
                };
                hatFix();
                if (window.MutationObserver) {
                    new MutationObserver(hatFix).observe(svgCanvas, {childList: true, subtree: true});
                }
            } catch (e) { /* cosmetic — never crash */ }

            // Reposition on drag/zoom/move via Blockly events
            if (typeof workspace.addChangeListener === 'function') {
                workspace.addChangeListener(function (e) {
                    if (e.type === Blockly.Events.UI ||
                        e.type === Blockly.Events.MOVE ||
                        e.type === Blockly.Events.DRAG) {
                        repositionActive();
                    }
                    refreshValueBoxes();
                });
            }
            window.addEventListener('resize', repositionActive);
            if (blocklyDivRef.current) {
                blocklyDivRef.current.addEventListener('scroll', repositionActive);
            }
            // Track mousemove to keep the white box following the block
            // during drags (Blockly uses a drag surface that doesn't
            // trigger DOM events while moving).
            document.addEventListener('mousemove', function (e) {
                if (e.buttons && activePreviewBlockId) {
                    repositionActive();
                }
            });

            // Auto-generate JS code + auto-save workspace XML on every change.
            // Debounced so dragging blocks doesn't re-render the whole UI
            // (including the floating builder window) on every mouse move.
            let wsSaveTimer = null;
            workspace.addChangeListener((event) => {
                try {
                    if (event.type !== Blockly.Events.UI) {
                        if (wsSaveTimer) clearTimeout(wsSaveTimer);
                        wsSaveTimer = setTimeout(() => {
                            try {
                                const code = javascriptGenerator.workspaceToCode(workspace);
                                setGeneratedCode(code);
                            } catch (genErr) { /* silent */ }
                            try {
                                const B = window._extBuilderBlockly || window.Blockly;
                                if (B && B.Xml) {
                                    // Save XML to a ref (not React state) so drags
                                    // don't re-render the builder window.
                                    customBlockXmlRef.current.set(currentBlockRef.current,
                                        B.Xml.domToText(B.Xml.workspaceToDom(workspace)));
                                }
                            } catch (saveErr) { /* silent */ }
                        }, 400);
                    }
                    // Keep the value preview label below return
                    // blocks in sync with the actual value.
                    if (event.type === Blockly.Events.BLOCK_CHANGE && event.blockId) {
                        const changed = workspace.getBlockById(event.blockId);
                        if (!changed) return;
                        if (changed.type === 'control_return' ||
                            changed.type === 'control_inlineReturn' ||
                            changed.type === 'func_return') {
                            const label = changed.getField('VALUE');
                            if (label) {
                                const v = javascriptGenerator.valueToCode(changed, 'VALUE', 0) || '';
                                label.setValue(v);
                            }
                        }
                    }
                    // Remove preview divs for deleted blocks
                    if (event.type === Blockly.Events.DELETE && event.oldBlockIds) {
                        for (var i = 0; i < event.oldBlockIds.length; i++) {
                            var did = event.oldBlockIds[i];
                            if (previewDivs[did] && previewDivs[did].parentNode) {
                                previewDivs[did].parentNode.removeChild(previewDivs[did]);
                            }
                            delete previewDivs[did];
                        }
                    }
                    refreshValueBoxes();
                } catch (e) {
                    console.error('Code generation error:', e);
                }
            });


            // Attach to window for debugging
            window._extBuilderWorkspace = workspace;
            window._extBuilderBlockly = Blockly;
            window._extBuilderGenerator = javascriptGenerator;

            // Seed the workspace with starter blocks for every existing
            // customBlock so the canvas is populated immediately. Subsequent
            // starter blocks are added by handleCreateBlock.
            customBlocks.forEach((b) => {
                addStarterBlocks(workspace, Blockly, b.name, b.id, b.blockType);
            });
            if (customBlocks.length) {
                const first = findBlockByCustomId(workspace, customBlocks[0].id);
                if (first && workspace.select) {
                    workspace.select(first);
                }
            }

            workspaceRef.current = workspace;
            setWorkspaceLoaded(true);
            // 清理主工作区重复块（防御注入瞬间出现的副本，如 target_clone
            // 有时会被复制成 2 个，残留一个孤立椭圆显示在屏幕左上角）
            try {
                const seen = new Set();
                workspace.getTopBlocks(true).forEach(b => {
                    const key = (b.type || '?') + ':' + (b.getFieldValue && (b.getFieldValue('NAME') || b.getFieldValue('TYPE') || ''));
                    if (seen.has(key)) b.dispose(false);
                    else seen.add(key);
                });
            } catch (e) { /* 清理失败无关紧要 */ }
            // 拖动结束 + 工具箱 flyout 拖动时：清理任何独立显示的 ghost 元素
            // （scratch-blocks 拖动带 input_value 字段的块时，字段会作为 ghost
            // 在屏幕外独立显示——比如截图1里左上角孤立显示"克隆体"的椭圆）
            try {
                const INPUT_VALUE = (Blockly.inputsValue || Blockly.INPUT_VALUE || 1);
                const hideInputGhosts = () => {
                    // 1) 隐藏所有 .blocklyInputRow 元素（input_value 字段 SVG 容器）
                    //    如果它们不在任何 block 主体内（孤立显示）
                    //    同时清理 main workspace 和 dragSurface 内部
                    ['.blocklyMainWorkspace', '.blocklyBlockDragSurface'].forEach(function(sel) {
                        const svg = document.querySelector(sel);
                        if (!svg) return;
                        svg.querySelectorAll('.blocklyInputRow').forEach(row => {
                            if (!row.closest('.blocklyDraggable')) {
                                row.style.display = 'none';
                            }
                        });
                    });
                    // 2) 拖动结束后强制隐藏 blocklyBlockDragSurface
                    const ds = document.querySelector('.blocklyBlockDragSurface');
                    if (ds && !(workspace.isDragging && workspace.isDragging())) {
                        ds.style.display = 'none';
                    }
                };
                workspace.addChangeListener((event) => {
                    if (event && event.type === Blockly.Events.BLOCK_CREATE) {
                        // 延后一毫秒再隐藏（等块内的脱联 input_value 字段创建出来）
                        setTimeout(hideInputGhosts, 0);
                    }
                });
                // 兜底：每次 mouseup 后再清理一次（拖动结束时也可能有 ghost 残留）
                const injectionDiv = workspace.getInjectionDiv();
                if (injectionDiv) {
                    injectionDiv.addEventListener('pointerup', () => {
                        setTimeout(hideInputGhosts, 50);
                    });
                }
                // 终极兜底：每 200ms 检查 blocklyBlockDragSurface，非拖动时强制 hide
                // （scratch-blocks 拖动时 set display:block，mouseup 后偶尔不重置）
                const dragSurfaceWatcher = setInterval(() => {
                    const ds = document.querySelector('.blocklyBlockDragSurface');
                    if (!ds) return;
                    const isDragging = !!(workspace.isDragging && workspace.isDragging());
                    const dsHasContent = (ds.children[0] && ds.children[0].childNodes.length > 0);
                    if (!isDragging && dsHasContent) {
                        ds.style.display = 'none';
                    } else if (!isDragging && ds.style.display !== 'none') {
                        ds.style.display = 'none';
                    }
                }, 200);
                // 终极 v6：覆写 BlockDragSurfaceSvg.setBlocksAndShow——
                // 拖动开始时立即隐藏拖动副本里的 input 字段（不依赖 CSS 选择器）
                try {
                    const BlockDragSurfaceSvg = Blockly.BlockDragSurfaceSvg;
                    if (BlockDragSurfaceSvg && BlockDragSurfaceSvg.prototype) {
                        const origSetBlocks = BlockDragSurfaceSvg.prototype.setBlocksAndShow;
                        BlockDragSurfaceSvg.prototype.setBlocksAndShow = function(blocks) {
                            const result = origSetBlocks.call(this, blocks);
                            // 立即隐藏拖动副本中所有 input 字段
                            if (this.dragGroup_) {
                                this.dragGroup_.querySelectorAll(
                                    'g.blocklyInputRow, path:not(.blocklyBlockBackground), ' +
                                    'path[data-argument-type], ellipse, rect.blocklyInputRow, .blocklyShape'
                                ).forEach(el => {
                                    el.style.display = 'none';
                                });
                            }
                            return result;
                        };
                    }
                } catch (e) { /* 覆写失败无关紧要 */ }
                // 终极 v7：监听主工作区 blocklyBlockCanvas 上的元素新增
                // 任何不在 blocklyDraggable 内的 input socket 立即隐藏
                // （用户拖动时主工作区会出现跟随鼠标的孤立 input ghost）
                try {
                    const mainCanvas = document.querySelector('.blocklyBlockCanvas');
                    if (mainCanvas && window.MutationObserver) {
                        const mainOrphanObserver = new MutationObserver((mutations) => {
                            mutations.forEach(m => {
                                m.addedNodes.forEach(node => {
                                    if (node && node.querySelectorAll) {
                                        node.querySelectorAll(
                                            'g.blocklyInputRow, ' +
                                            'path:not(.blocklyBlockBackground), ' +
                                            'path[data-argument-type], ' +
                                            'ellipse, rect.blocklyInputRow, .blocklyShape'
                                        ).forEach(el => {
                                            if (!el.closest('.blocklyDraggable')) {
                                                el.style.display = 'none';
                                            }
                                        });
                                    }
                                });
                            });
                        });
                        mainOrphanObserver.observe(mainCanvas, {childList: true, subtree: true});
                    }
                } catch (e) { /* observer 失败无关紧要 */ }
                // 终极 v8：监听 scratch-blocks 拖动表面（避免 document.body 监听导致 reflow 警告）
                try {
                    if (window.MutationObserver) {
                        const dragSurf = document.querySelector('.blocklyBlockDragSurface');
                        const mainCanvas = document.querySelector('.blocklyBlockCanvas');
                        const bubbleCanvas = document.querySelector('.blocklyBubbleCanvas');
                        const targets = [dragSurf, mainCanvas, bubbleCanvas].filter(Boolean);
                        targets.forEach(function(target) {
                            try {
                                const obs = new MutationObserver(function(mutations) {
                                    mutations.forEach(m => {
                                        m.addedNodes.forEach(node => {
                                            if (node && node.querySelectorAll) {
                                                node.querySelectorAll(
                                                    'g.blocklyInputRow, ' +
                                                    'path:not(.blocklyBlockBackground), ' +
                                                    'path[data-argument-type], ' +
                                                    'ellipse, rect.blocklyInputRow, .blocklyShape, ' +
                                                    'g.blocklyInsertionMarker, .blocklyInsertionMarker'
                                                ).forEach(el => {
                                                    if (!el.closest('.blocklyDraggable')) {
                                                        el.style.display = 'none';
                                                    }
                                                });
                                            }
                                        });
                                    });
                                });
                                obs.observe(target, {childList: true, subtree: true});
                            } catch (e) { /* 单个 observer 失败无关紧要 */ }
                        });
                    }
                } catch (e) { /* observer 失败无关紧要 */ }
                // 终极 v10：暴力兜底 —— 任何 fill="#529552" 元素不在 blocklyDraggable 内立即隐藏
                // 覆盖 v9 漏掉的所有 input socket 形状
                try {
                    if (window.MutationObserver) {
                        const v10obs = new MutationObserver(function(mutations) {
                            mutations.forEach(m => {
                                m.addedNodes.forEach(node => {
                                    if (node && node.querySelectorAll) {
                                        node.querySelectorAll('[fill="#529552"], [fill="#0FBD8C"]').forEach(el => {
                                            if (!el.closest('.blocklyDraggable')) {
                                                el.style.display = 'none';
                                            }
                                        });
                                    }
                                });
                            });
                        });
                        v10obs.observe(document.body, {childList: true, subtree: true, attributes: true});
                    }
                } catch (e) { /* v10 失败无关紧要 */ }
                // 终极兜底：MutationObserver 监听 dragSurface 内部的孤立 inputRow
                // 任何新加入的 inputRow 如果不在 .blocklyDraggable 内则立即 hide
                try {
                    const dsEl = document.querySelector('.blocklyBlockDragSurface');
                    if (dsEl && window.MutationObserver) {
                        const dsObserver = new MutationObserver((mutations) => {
                            mutations.forEach(m => {
                                m.addedNodes.forEach(node => {
                                    if (node && node.querySelectorAll) {
                                        node.querySelectorAll('.blocklyInputRow').forEach(row => {
                                            if (!row.closest('.blocklyDraggable')) {
                                                row.style.display = 'none';
                                            }
                                        });
                                    }
                                });
                            });
                        });
                        dsObserver.observe(dsEl, {childList: true, subtree: true});
                    }
                } catch (e) { /* observer 失败无关紧要 */ }
                // 页面卸载时清除定时器
                if (workspace.dispose) {
                    const origDispose = workspace.dispose.bind(workspace);
                    workspace.dispose = function() {
                        clearInterval(dragSurfaceWatcher);
                        return origDispose();
                    };
                }
            } catch (e) { /* drag 监听失败无关紧要 */ }
            return () => {
                clearTimeout(resizeTimer);
            };
        } catch (e) {
            console.error('Failed to initialize Blockly:', e);
            setLoadError('Blockly initialization failed: ' + (e.message || String(e)));
            return undefined;
        }
    }, [loaded, workspaceLoaded]);

    // 插件激活（独立 effect）：workspace 就绪后激活 ExtAddons。
    // 必须放在独立 useEffect 里——若与 workspace 初始化同 effect，
    // setWorkspaceLoaded(true) 会让 effect 重新运行并先执行 cleanup，
    // 把刚激活的插件全部卸载。
    useEffect(() => {
        if (!workspaceLoaded || !workspaceRef.current) return;
        const Blockly = window._extBuilderBlockly || window.Blockly;
        if (!Blockly) return;
        if (extAddonsCleanupRef.current) return; // 已激活
        let cancelled = false;
        applyExtAddons({
            Blockly,
            getWorkspace: () => workspaceRef.current
        }).then(cleanup => {
            if (!cancelled) extAddonsCleanupRef.current = cleanup;
        }).catch(e => console.warn('[ExtAddons] 激活失败:', e));
        return () => {
            cancelled = true;
            if (extAddonsCleanupRef.current) {
                try { extAddonsCleanupRef.current(); } catch (e) { /* silent */ }
                extAddonsCleanupRef.current = null;
            }
        };
    }, [workspaceLoaded]);

    const addStarterBlocks = (workspace, Blockly, blockName, blockId, blockType, colour) => {
        try {
            // Place a block_define starter for this custom block in workspace.
            // Each starter carries a `data-block-id` attribute so we can map
            // it back to the React customBlocks[] entry.
            const metrics = workspace.getMetrics ? workspace.getMetrics() : null;
            const viewW = (metrics && metrics.viewWidth) || 800;
            const viewH = (metrics && metrics.viewHeight) || 400;

            // Stack new starters below any existing top-level blocks
            const top = workspace.getTopBlocks ? workspace.getTopBlocks(true) : [];
            let bottomY = 60;
            top.forEach(b => {
                const y = (b.getRelativeToSurfaceXY && b.getRelativeToSurfaceXY().y) || 0;
                const h = b.height || 40;
                bottomY = Math.max(bottomY, y + h + 20);
            });
            const startX = Math.max(40, viewW / 2 - 60);
            const startY = bottomY;

            const def = workspace.newBlock('block_define');
            if (def) {
                // Tag with data-block-id so we can locate the block later
                const svgRoot = def.getSvgRoot && def.getSvgRoot();
                if (svgRoot && blockId) {
                    svgRoot.setAttribute('data-block-id', blockId);
                }
                const nameField = def.getField('NAME');
                if (nameField) {
                    nameField.setValue(blockName || '我的积木');
                }
                // Store non-rendered metadata used by the code generator
                // (opcode / type / display text) directly on the Blockly block.
                def._opcode = (blockId || 'block').replace(/[^a-zA-Z0-9]/g, '_');
                def._type = (blockType || 'command').toUpperCase() === 'BOOLEAN' ? 'BOOLEAN'
                    : (blockType || 'command').toUpperCase() === 'REPORTER' ? 'REPORTER'
                        : (blockType || 'command').toUpperCase() === 'HAT' ? 'HAT'
                            : (blockType || 'command').toUpperCase() === 'CONDITIONAL' ? 'CONDITIONAL'
                                : 'COMMAND';
                def._text = '[' + (blockName || 'block') + ']';
                // 积木自定义颜色（hex，如 #FF6680）；留空使用默认色
                if (colour) {
                    try { def.setColour(colour); } catch (e) { /* 忽略非法色 */ }
                }
                // 定义扩展的积木块禁止一切删除（拖动/右键/Delete 键），
                // 防止用户误删导致工作区与代码面板失去对应关系。
                def.setDeletable(false);
                def.initSvg();
                def.moveBy(startX, startY);
                def.render();
            }
            console.log('[ExtBuilder] Starter block added for "' + blockName + '" (id=' + blockId + '). Block count:', workspace.getAllBlocks(false).length);
        } catch (e) {
            console.warn('Failed to add starter block:', e);
        }
    };

    // Find a top-level block_define carrying a given customBlock id
    const findBlockByCustomId = (workspace, blockId) => {
        if (!workspace || !blockId) return null;
        const tops = workspace.getTopBlocks(true);
        for (let i = 0; i < tops.length; i++) {
            const t = tops[i];
            if (t.type !== 'block_define') continue;
            const svg = t.getSvgRoot && t.getSvgRoot();
            if (svg && svg.getAttribute('data-block-id') === blockId) return t;
        }
        return null;
    };

    // Save current workspace to the active block's xml ref
    const saveCurrentWorkspace = useCallback(() => {
        if (!workspaceRef.current) return;
        try {
            const B = window._extBuilderBlockly || window.Blockly;
            const xml = B.Xml.domToText(B.Xml.workspaceToDom(workspaceRef.current));
            customBlockXmlRef.current.set(currentBlockRef.current, xml);
        } catch (e) {
            console.warn('Failed to save workspace:', e);
        }
    }, []);

    // Load a block's workspace into the current workspace
    const loadBlockWorkspace = useCallback((blockId, blockName) => {
        if (!workspaceRef.current) return;
        try {
            const ws = workspaceRef.current;
            ws.clear();
            const block = customBlocks.find(b => b.id === blockId);
            const B = window._extBuilderBlockly || window.Blockly;
            // Prefer the latest saved XML from the ref (kept in sync with the
            // live workspace via the change listener). Fall back to the
            // initial xml field on first load.
            const savedXml = customBlockXmlRef.current.get(blockId) ||
                (block && block.xml);
            if (savedXml) {
                const dom = B.Xml.textToDom(savedXml);
                B.Xml.domToWorkspace(dom, ws);
            } else {
                addStarterBlocks(ws, B, block?.name || blockName);
            }
            console.log('[ExtBuilder] Loaded workspace for block:', blockName);
        } catch (e) {
            console.warn('Failed to load workspace:', e);
            // Fallback: just add starter
            const ws = workspaceRef.current;
            const B = window._extBuilderBlockly || window.Blockly || {};
            addStarterBlocks(ws, B, blockName);
        }
    }, [customBlocks]);

    // Switch to a block — just highlight/focus the matching top-level
    // block_define; do NOT swap the workspace contents.
    const handleSelectBlock = useCallback((blockId) => {
        if (blockId === currentBlockRef.current) {
            // Even re-selecting the same block — focus the matching starter
            if (workspaceRef.current) {
                const target = findBlockByCustomId(workspaceRef.current, blockId);
                if (target && workspaceRef.current.select) {
                    workspaceRef.current.select(target);
                    if (workspaceRef.current.centerOnBlock) {
                        workspaceRef.current.centerOnBlock(target.id);
                    }
                }
            }
            return;
        }
        saveCurrentWorkspace();
        currentBlockRef.current = blockId;
        setCurrentBlockId(blockId);
        if (workspaceRef.current) {
            const target = findBlockByCustomId(workspaceRef.current, blockId);
            if (target && workspaceRef.current.select) {
                workspaceRef.current.select(target);
                if (workspaceRef.current.centerOnBlock) {
                    workspaceRef.current.centerOnBlock(target.id);
                }
            }
        }
    }, [saveCurrentWorkspace]);

    // Create a new block — append a block_define to the shared workspace
    // (no longer clears or swaps the workspace).
    const handleCreateBlock = useCallback(() => {
        const id = 'block_' + Date.now();
        const name = '我的积木 ' + (customBlocks.length + 1);
        setCustomBlocks(prev => [...prev, {
            id, name, xml: null,
            blockType: 'command', isTerminal: false, isAsync: false,
            attachAllThreads: false, filterSprite: true, filterStage: true, icon: '',
            colour: ''
        }]);
        currentBlockRef.current = id;
        setCurrentBlockId(id);
        if (workspaceRef.current) {
            const B = window._extBuilderBlockly || window.Blockly || {};
            addStarterBlocks(workspaceRef.current, B, name, id, 'command', '');
            // Focus the newly added block so the user sees it immediately
            const created = findBlockByCustomId(workspaceRef.current, id);
            if (created && workspaceRef.current.select) {
                workspaceRef.current.select(created);
            }
        }
    }, [customBlocks.length]);

    // Delete a block — remove from customBlocks AND from the shared workspace
    const handleDeleteBlock = useCallback((blockId) => {
        if (customBlocks.length <= 1) return; // at least one block remains
        // Remove the corresponding top-level block from the workspace
        if (workspaceRef.current) {
            const target = findBlockByCustomId(workspaceRef.current, blockId);
            if (target && target.dispose) target.dispose(false);
        }
        setCustomBlocks(prev => prev.filter(b => b.id !== blockId));
        if (blockId === currentBlockRef.current) {
            // Pick the next visible block — do NOT reload workspace
            const remaining = customBlocks.filter(b => b.id !== blockId);
            const next = remaining[remaining.length - 1];
            if (next) {
                currentBlockRef.current = next.id;
                setCurrentBlockId(next.id);
                if (workspaceRef.current) {
                    const nextBlock = findBlockByCustomId(workspaceRef.current, next.id);
                    if (nextBlock && workspaceRef.current.select) {
                        workspaceRef.current.select(nextBlock);
                    }
                }
            }
        }
    }, [customBlocks]);

    // Rename a block
    const handleRenameBlock = useCallback((blockId, newName) => {
        const trimmed = (newName || '').trim();
        if (!trimmed) return; // ignore empty names
        setCustomBlocks(prev => prev.map(b =>
            b.id === blockId ? {...b, name: trimmed} : b
        ));
        // Sync the block's NAME field on the shared workspace canvas so the
        // hat block renames immediately (CB-ExtGallary behavior).
        if (workspaceRef.current) {
            const defBlock = findBlockByCustomId(workspaceRef.current, blockId);
            if (defBlock) {
                const f = defBlock.getField('NAME');
                if (f) f.setValue(trimmed);
                if (defBlock.render) defBlock.render();
            }
        }
    }, []);

    // Begin inline rename
    const handleStartRename = useCallback((blockId, currentName) => {
        setEditingBlockId(blockId);
        setEditingName(currentName);
    }, []);

    const handleCancelRename = useCallback(() => {
        setEditingBlockId(null);
        setEditingName('');
    }, []);

    const handleCommitRename = useCallback((blockId) => {
        handleRenameBlock(blockId, editingName);
        handleCancelRename();
    }, [editingName, handleRenameBlock, handleCancelRename]);

    // Update a block's metadata (type, filters, icon, etc.) AND sync
    // the matching top-level block_define in the shared workspace.
    const handleUpdateBlock = useCallback((blockId, updates) => {
        setCustomBlocks(prev => prev.map(b =>
            b.id === blockId ? {...b, ...updates} : b
        ));
        // Sync NAME/TYPE fields to the Blockly block
        if (workspaceRef.current) {
            const defBlock = findBlockByCustomId(workspaceRef.current, blockId);
            if (defBlock) {
                if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
                    const f = defBlock.getField('NAME');
                    if (f) f.setValue(updates.name);
                }
                if (Object.prototype.hasOwnProperty.call(updates, 'blockType')) {
                    const f = defBlock.getField('TYPE');
                    if (f) f.setValue(updates.blockType);
                }
                if (Object.prototype.hasOwnProperty.call(updates, 'colour')) {
                    try {
                        if (updates.colour) defBlock.setColour(updates.colour);
                        else defBlock.setColour(290); // 恢复默认紫色
                    } catch (e) { /* 忽略非法色 */ }
                }
            }
        }
    }, []);

    // Upload a block icon
    const handlePickBlockIcon = useCallback((blockId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                handleUpdateBlock(blockId, {icon: ev.target.result});
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }, [handleUpdateBlock]);

    const handleClearBlockIcon = useCallback((blockId) => {
        handleUpdateBlock(blockId, {icon: ''});
    }, [handleUpdateBlock]);

    // Add a text segment to current block's template
    const handleAddText = useCallback((blockId) => {
        const value = (window.prompt('输入文本片段:') || '').trim();
        if (!value) return;
        setCustomBlocks(prev => prev.map(b => {
            if (b.id !== blockId) return b;
            const parts = Array.isArray(b.parts) ? b.parts : [];
            return {...b, parts: [...parts, {kind: 'text', value}]};
        }));
    }, []);

    // Add an input segment to current block's template
    const handleAddInput = useCallback((blockId) => {
        const name = (window.prompt('输入参数名 (仅 a-z, A-Z):') || '').trim();
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
            window.alert('参数名格式不正确（仅字母数字下划线，开头必须是字母）');
            return;
        }
        setCustomBlocks(prev => prev.map(b => {
            if (b.id !== blockId) return b;
            const parts = Array.isArray(b.parts) ? b.parts : [];
            return {...b, parts: [...parts, {kind: 'input', name, inputType: 'String'}]};
        }));
    }, []);

    // Field-editor handlers (CB-ExtGallary style)
    const handleAddField = useCallback((blockId, kind) => {
        setCustomBlocks(prev => prev.map(b => {
            if (b.id !== blockId) return b;
            const fields = Array.isArray(b.fields) ? b.fields : [];
            const idx = fields.length;
            const newField = kind === 'label'
                ? {kind: 'label', text: '标签' + idx, name: 'F' + idx}
                : kind === 'number'
                    ? {kind: 'number', text: '数字' + idx, default: '0', name: 'F' + idx}
                    : kind === 'boolean'
                        ? {kind: 'boolean', text: '布尔' + idx, default: 'true', name: 'F' + idx}
                        : {kind: 'text', text: '文本' + idx, name: 'F' + idx};
            return {...b, fields: [...fields, newField]};
        }));
    }, []);

    const handleUpdateField = useCallback((blockId, idx, updates) => {
        setCustomBlocks(prev => prev.map(b => {
            if (b.id !== blockId) return b;
            const fields = Array.isArray(b.fields) ? b.fields : [];
            return {...b, fields: fields.map((f, i) => i === idx ? {...f, ...updates} : f)};
        }));
    }, []);

    const handleRemoveField = useCallback((blockId, idx) => {
        setCustomBlocks(prev => prev.map(b => {
            if (b.id !== blockId) return b;
            const fields = Array.isArray(b.fields) ? b.fields : [];
            return {...b, fields: fields.filter((_, i) => i !== idx)};
        }));
    }, []);

    // Save block metadata (already applied via setters, this just confirms + shows summary)
    const handleSaveBlockMeta = useCallback((blockId) => {
        const block = customBlocks.find(b => b.id === blockId);
        if (!block) return;
        const parts = block.parts || [];
        const template = parts
            .map(p => p.kind === 'text' ? p.value : `[${p.name}]`)
            .join('');
        const summary = [
            `名称: ${block.name}`,
            `类型: ${block.blockType}`,
            `结尾: ${block.isTerminal ? '是' : '否'}`,
            `异步: ${block.isAsync ? '是' : '否'}`,
            `附加所有线程: ${block.attachAllThreads ? '是' : '否'}`,
            `在角色中显示: ${block.filterSprite ? '是' : '否'}`,
            `在舞台中显示: ${block.filterStage ? '是' : '否'}`,
            `图标: ${block.icon ? '已设置' : '无'}`,
            `模板: ${template || '(空)'}`
        ].join('\n');
        window.alert('积木已保存:\n\n' + summary);
    }, [customBlocks]);

    // Extension settings (creation) modal
    const handleOpenSettings = useCallback(() => {
        setSettingsDraft({...extInfo});
        setShowExtensionSettings(true);
    }, [extInfo]);

    const handleCloseSettings = useCallback(() => {
        setShowExtensionSettings(false);
        setSettingsDraft(null);
    }, []);

    // ---- Block preview: render each block in a hidden workspace, capture SVG XML ----
    const [previewBlocks, setPreviewBlocks] = useState([]);
    const [panelPreviewSvg, setPanelPreviewSvg] = useState('');
    const previewHostRef = useRef(null);
    const previewWorkspaceRef = useRef(null);
    const panelPreviewRef = useRef(null);
    const panelWorkspaceRef = useRef(null);

    const handleOpenPreview = useCallback(() => {
        setShowBlockPreview(true);
    }, []);

    const handleClosePreview = useCallback(() => {
        setShowBlockPreview(false);
        setPreviewBlocks([]);
    }, []);

    // Render customBlock previews — each customBlock becomes a *finished*
    // scratch block (matching AstraEditor preview behaviour). The block
    // shows the user-supplied NAME followed by all the fields as inputs,
    // just like a normal Scratch command block would render.
    useEffect(() => {
        if (!showBlockPreview || !previewHostRef.current) return;
        const host = previewHostRef.current;
        if (!previewWorkspaceRef.current) {
            previewWorkspaceRef.current = Blockly.inject(host, {
                renderer: 'scratch',
                toolbox: '<xml></xml>',
                sounds: false,
                trashcan: false,
                scrollbars: false,
                zoom: {controls: false, wheel: false, startScale:1},
                grid: {spacing: 8, length: 1, colour: '#fff', snap: false},
                collapse: false
            });
        }
        const ws = previewWorkspaceRef.current;
        ws.getTopBlocks().forEach(b => b.dispose(false));

        const items = [];
        let yOffset = 8;
        customBlocks.forEach(function (cb, idx) {
            const svgXml = renderCustomBlockToSvg(ws, cb, idx);
            if (!svgXml) return;
            // Estimate height from svg width attr for stacking
            const m = svgXml.match(/height="(\d+)"/);
            const h = m ? Number(m[1]) : 40;
            items.push({
                type: cb.name || ('我的积木 ' + (idx + 1)),
                label: cb.name || ('我的积木 ' + (idx + 1)),
                svgXml: svgXml
            });
            yOffset += Math.max(20, h) + 4;
        });
        setPreviewBlocks(items);
    }, [showBlockPreview, customBlocks]);

    // Live preview of the currently-edited customBlock inside the builder
    // panel's "积木预览" zone. Re-renders whenever the active block or its
    // fields / blockType change — renders a REAL Scratch block SVG.
    useEffect(() => {
        const cb = customBlocks.find(b => b.id === currentBlockId);
        if (!cb || !panelPreviewRef.current) {
            setPanelPreviewSvg('');
            return;
        }
        const host = panelPreviewRef.current;
        if (!panelWorkspaceRef.current) {
            panelWorkspaceRef.current = Blockly.inject(host, {
                renderer: 'scratch',
                toolbox: '<xml></xml>',
                sounds: false,
                trashcan: false,
                scrollbars: false,
                zoom: {controls: false, wheel: false, startScale:1},
                grid: {spacing: 8, length: 1, colour: '#fff', snap: false},
                collapse: false
            });
        }
        const ws = panelWorkspaceRef.current;
        ws.getTopBlocks().forEach(b => b.dispose(false));
        const idx = customBlocks.findIndex(b => b.id === currentBlockId);
        setPanelPreviewSvg(renderCustomBlockToSvg(ws, cb, Math.max(0, idx)));
    }, [currentBlockId, customBlocks, activeTab]);

    const handleApplySettings = useCallback(() => {
        if (!settingsDraft) return;
        const trimmed = settingsDraft.name.trim() || DEFAULT_EXTENSION_INFO.name;
        const id = settingsDraft.customId
            ? (settingsDraft.id.trim() || DEFAULT_EXTENSION_INFO.id)
            : DEFAULT_EXTENSION_INFO.id;
        // TurboWarp / scratch-vm only accepts ids matching /^[a-z0-9]+$/i
        // (letters and digits only — no hyphens, underscores, or other
        // punctuation).
        const safeId = id.toLowerCase().replace(/[^a-z0-9]/g, '') || 'myextension';
        setExtInfo({...settingsDraft, name: trimmed, id: safeId});
        setShowExtensionSettings(false);
        setSettingsDraft(null);
    }, [settingsDraft]);

    const handlePickColor = useCallback((preset) => {
        if (!settingsDraft) return;
        setSettingsDraft({
            ...settingsDraft,
            color1: preset[0],
            color2: preset[1],
            color3: preset[2]
        });
    }, [settingsDraft]);

    const handlePickIcon = useCallback((targetKey) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file || !settingsDraft) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                setSettingsDraft(d => d ? {...d, [targetKey]: ev.target.result} : d);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }, [settingsDraft]);

    const handleClearIcon = useCallback((targetKey) => {
        if (!settingsDraft) return;
        setSettingsDraft(d => d ? {...d, [targetKey]: ''} : d);
    }, [settingsDraft]);

    const handleExport = useCallback(() => {
        console.log('Export clicked, code length:', generatedCode.length);
        try {
            const fullCode = wrapAsExtension(extInfo, generatedCode, customBlocks);
            const blob = new Blob([fullCode], {type: 'application/javascript'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${extInfo.id}.js`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Export complete:', `${extInfo.id}.js`);
        } catch (e) {
            console.error('Export failed:', e);
            alert('导出失败: ' + e.message);
        }
    }, [extInfo, generatedCode, customBlocks]);

    // 复制完整代码到剪贴板（兼容非 HTTPS 环境：navigator.clipboard 不可用时
    // 回退到 execCommand）
    const handleCopyCode = useCallback(() => {
        const text = exportableCode || generatedCode;
        if (!text) return;
        const flashCopy = () => {
            setCopyMsg('已复制');
            if (copyMsgTimerRef.current) clearTimeout(copyMsgTimerRef.current);
            copyMsgTimerRef.current = setTimeout(() => setCopyMsg(''), 1800);
        };
        const fallbackCopy = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                flashCopy();
            } catch (err) {
                alert('复制失败，请手动选中代码复制（Ctrl+C）');
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(flashCopy).catch(fallbackCopy);
        } else {
            fallbackCopy();
        }
    }, [exportableCode, generatedCode]);

    const handleReset = useCallback(() => {
        try {
            if (workspaceRef.current) {
                workspaceRef.current.clear();
                const currentBlock = customBlocks.find(b => b.id === currentBlockRef.current);
                addStarterBlocks(workspaceRef.current, window._extBuilderBlockly || window.Blockly, currentBlock?.name || '我的积木');
            }
        } catch (e) {
            console.error('Reset failed:', e);
            alert('重置失败: ' + e.message);
        }
    }, [customBlocks]);

    // 插件开关：保存状态 → 重新激活插件（清理旧的原型覆写再应用新的）
    const handleToggleAddon = useCallback((addonId, enabled) => {
        setAddonStateInternal(prev => {
            const next = {...prev, [addonId]: enabled};
            setAddonState(next);
            return next;
        });
        // 重新应用插件：先清理，再按新状态激活
        // 注意：Blockly 是 useEffect 内的局部变量，这里用全局 window 引用
        const Blockly = window._extBuilderBlockly || window.Blockly;
        if (!Blockly || !workspaceRef.current) return;
        if (extAddonsCleanupRef.current) {
            try { extAddonsCleanupRef.current(); } catch (e) { /* silent */ }
            extAddonsCleanupRef.current = null;
        }
        applyExtAddons({
            Blockly,
            getWorkspace: () => workspaceRef.current
        }).then(cleanup => {
            extAddonsCleanupRef.current = cleanup;
        }).catch(e => console.warn('[ExtAddons] 重激活失败:', e));
    }, []);

    // 插件子选项切换（如 developer-tools 的增强整理/鼠标粘贴）
    const handleToggleAddonOption = useCallback((addonId, optId, value) => {
        setAddonOptsInternal(prev => {
            const addonPrev = prev[addonId] || {};
            const next = {...prev, [addonId]: {...addonPrev, [optId]: value}};
            setAddonOptions(addonId, next[addonId]);
            return next;
        });
        // 子选项变更后不需要重新 applyExtAddons——
        // developer-tools 的 setup 内部通过 optsPoller 轮询 localStorage 自动响应
    }, []);

    // ExtAddons：导出设置（JSON 下载）
    const handleAddonExport = useCallback(() => {
        try {
            const blob = new Blob([JSON.stringify(addonState, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'extbuilder-addons-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('导出失败: ' + (e.message || String(e)));
        }
    }, [addonState]);

    // ExtAddons：导入设置（读取 JSON 文件，校验 ID 后合并）
    const handleAddonImport = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    if (typeof data !== 'object' || data === null) throw new Error('文件格式错误');
                    const validIds = new Set(getAllAddons().map(a => a.id));
                    const merged = {...addonState};
                    let changed = 0;
                    Object.keys(data).forEach(k => {
                        if (validIds.has(k)) {
                            merged[k] = !!data[k];
                            changed++;
                        }
                    });
                    if (changed === 0) throw new Error('文件中没有可识别的插件 ID');
                    setAddonState(merged);
                    setAddonStateInternal(merged);
                    // 重激活
                    const Blockly = window._extBuilderBlockly || window.Blockly;
                    if (Blockly && workspaceRef.current) {
                        if (extAddonsCleanupRef.current) {
                            try { extAddonsCleanupRef.current(); } catch (er) { /* silent */ }
                            extAddonsCleanupRef.current = null;
                        }
                        applyExtAddons({Blockly, getWorkspace: () => workspaceRef.current})
                            .then(cleanup => { extAddonsCleanupRef.current = cleanup; });
                    }
                    alert('已导入 ' + changed + ' 项插件设置');
                } catch (err) {
                    alert('导入失败: ' + (err.message || String(err)));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }, [addonState]);

    // ExtAddons：全部重置为默认（清空 localStorage 强制下次读 DEFAULT_STATE）
    const handleAddonReset = useCallback(() => {
        if (!confirm('确定重置全部插件设置到默认值？')) return;
        try { localStorage.removeItem('extbuilder_ext_addons'); } catch (e) { /* silent */ }
        const fresh = getAddonState();
        setAddonStateInternal(fresh);
        const Blockly = window._extBuilderBlockly || window.Blockly;
        if (Blockly && workspaceRef.current) {
            if (extAddonsCleanupRef.current) {
                try { extAddonsCleanupRef.current(); } catch (er) { /* silent */ }
                extAddonsCleanupRef.current = null;
            }
            applyExtAddons({Blockly, getWorkspace: () => workspaceRef.current})
                .then(cleanup => { extAddonsCleanupRef.current = cleanup; });
        }
    }, []);

    // ExtAddons：从本地 JS 文件导入自定义插件（导出 {id,name,description,category,css,setup} 或数组）
    const handleImportPlugin = useCallback(() => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.js,.mjs,text/javascript';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const imported = importCustomAddonFromFile(String(reader.result));
                        if (!imported.length) throw new Error('文件中没有有效的插件对象');
                        // 导入后自动启用这些插件并重激活
                        const nextState = {...addonState};
                        imported.forEach(p => { nextState[p.id] = true; });
                        setAddonState(nextState);
                        setAddonStateInternal(nextState);
                        const Blockly = window._extBuilderBlockly || window.Blockly;
                        if (Blockly && workspaceRef.current) {
                            if (extAddonsCleanupRef.current) {
                                try { extAddonsCleanupRef.current(); } catch (er) { /* silent */ }
                                extAddonsCleanupRef.current = null;
                            }
                            applyExtAddons({Blockly, getWorkspace: () => workspaceRef.current})
                                .then(cleanup => { extAddonsCleanupRef.current = cleanup; });
                        }
                        alert('已导入 ' + imported.length + ' 个插件：\n' + imported.map(p => p.name).join('、'));
                    } catch (err) {
                        alert('导入失败: ' + (err.message || String(err)));
                    }
                };
                reader.onerror = () => alert('读取文件失败');
                reader.readAsText(file);
            };
            input.click();
        } catch (e) {
            console.error('Import plugin failed:', e);
        }
    }, [addonState]);

    // ExtAddons：删除一个自定义插件（按 id）
    const handleRemoveCustomAddon = useCallback((id) => {
        if (!confirm('确定删除自定义插件「' + id + '」？此操作不可撤销。')) return;
        try {
            removeCustomAddon(id);
            // 若当前已启用，先禁用并清理
            if (addonState[id]) {
                const nextState = {...addonState};
                delete nextState[id];
                setAddonState(nextState);
                setAddonStateInternal(nextState);
                const Blockly = window._extBuilderBlockly || window.Blockly;
                if (Blockly && workspaceRef.current) {
                    if (extAddonsCleanupRef.current) {
                        try { extAddonsCleanupRef.current(); } catch (er) { /* silent */ }
                        extAddonsCleanupRef.current = null;
                    }
                    applyExtAddons({Blockly, getWorkspace: () => workspaceRef.current})
                        .then(cleanup => { extAddonsCleanupRef.current = cleanup; });
                }
            }
        } catch (e) {
            console.error('Remove custom addon failed:', e);
        }
    }, [addonState]);

    const handleLoadExtension = useCallback(() => {
        console.log('Load clicked');
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.js';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    alert('已加载文件: ' + file.name);
                };
                reader.readAsText(file);
            };
            input.click();
        } catch (e) {
            console.error('Load failed:', e);
        }
    }, []);

    const handleUndo = useCallback(() => {
        console.log('Undo clicked, workspace:', !!workspaceRef.current);
        try {
            if (workspaceRef.current) {
                workspaceRef.current.undo(false);
            }
        } catch (e) {
            console.error('Undo failed:', e);
        }
    }, []);

    const handleRedo = useCallback(() => {
        console.log('Redo clicked, workspace:', !!workspaceRef.current);
        try {
            if (workspaceRef.current) {
                workspaceRef.current.undo(true);
            }
        } catch (e) {
            console.error('Redo failed:', e);
        }
    }, []);

    // ---- 登录 / 存档 / 跨站同步 handlers ----

    const refreshSaves = useCallback(() => {
        if (!session) {
            setSavesList([]);
            return;
        }
        // 先本地，再尝试云端拉取合并（多设备一致）
        setSavesList(listSaves(session.username));
        import('../lib/saves.js').then(m => {
            return m.syncSavesFromCloud(session.username);
        }).then(merged => {
            if (merged) setSavesList(merged);
        }).catch(() => { /* 云端不可用则保持本地 */ });
    }, [session]);

    // 打开存档面板时刷新列表
    const handleOpenSavesPanel = useCallback(() => {
        setSaveMsg('');
        setSyncLinkText('');
        setSyncInput('');
        refreshSaves();
        setShowSavesPanel(true);
    }, [refreshSaves]);

    // 打开个人主页：加载账号资料 + 刷新存档列表 + 拉取关注/粉丝数
    const handleOpenProfile = useCallback(() => {
        if (!session) return;
        const username = session.username;
        setProfileMeta(getUserMeta(username));
        setProfileCounts({following: 0, followers: 0});
        refreshSaves();
        setShowProfilePanel(true);
        // 云端可用时拉取关注关系，统计关注数 / 粉丝数（本地模式为 0）
        cloudListRelations(username).then((rows) => {
            if (!Array.isArray(rows)) return;
            let following = 0;
            let followers = 0;
            for (const r of rows) {
                if (r.follower === username) following += 1;
                if (r.followee === username) followers += 1;
            }
            setProfileCounts({following, followers});
        }).catch(() => {
            // 拉取失败不影响主页其余内容，保持 0
        });
    }, [session, refreshSaves]);

    // ---- 好友 / 关注 ----
    // 拉取我与他人的全部关注关系，并重算好友（互关）/ 我关注的 / 关注我的
    const loadFriendsRelations = useCallback(() => {
        if (!session) return Promise.resolve([]);
        return cloudListRelations(session.username).then((rows) => {
            setFriendsRelations(rows || []);
            return rows || [];
        }).catch((e) => {
            setFriendsMsg('加载好友关系失败：' + (e && e.message ? e.message : String(e)));
            return [];
        });
    }, [session]);

    const handleOpenFriends = useCallback(() => {
        setFriendsMsg('');
        setFriendsResults([]);
        setFriendsSearch('');
        setFriendsTab('friends');
        setShowFriendsPanel(true);
        loadFriendsRelations();
    }, [loadFriendsRelations]);

    const handleFriendSearch = useCallback(() => {
        if (!session) return;
        const q = friendsSearch.trim();
        if (!q) { setFriendsResults([]); return; }
        setFriendsBusy(true);
        setFriendsMsg('');
        cloudSearchUsers(q, session.username).then((list) => {
            setFriendsResults(list || []);
            if (!list || list.length === 0) setFriendsMsg('没有找到匹配的用户');
        }).catch((e) => {
            setFriendsMsg('搜索失败：' + (e && e.message ? e.message : String(e)));
        }).then(() => setFriendsBusy(false));
    }, [friendsSearch, session]);

    // direction: 'follow' 关注对方；'unfollow-following' 取消关注（我→对方）；
    // 'unfollow-follower' 移除粉丝（对方→我）；'unfriend' 解除好友（取消我对对方的关注）
    const handleFriendAction = useCallback((target, action) => {
        if (!session) return;
        const me = session.username;
        setFriendsBusy(true);
        setFriendsMsg('');
        let p;
        if (action === 'follow') {
            p = cloudFollow(me, target);
        } else if (action === 'unfollow-following' || action === 'unfriend') {
            p = cloudUnfollow(me, target);
        } else if (action === 'unfollow-follower') {
            p = cloudUnfollow(target, me);
        } else {
            p = Promise.resolve();
        }
        p.then(() => loadFriendsRelations())
            .catch((e) => {
                setFriendsMsg('操作失败：' + (e && e.message ? e.message : String(e)));
            })
            .then(() => setFriendsBusy(false));
    }, [session, loadFriendsRelations]);

    const handleAuthSubmit = useCallback((e) => {
        e.preventDefault();
        setAuthError('');
        setAuthBusy(true);
        const doAuth = authMode === 'register'
            ? (authPass === authPass2
                ? register(authUser, authPass, authRemember)
                : Promise.reject(new Error('两次输入的密码不一致')))
            : login(authUser, authPass, authRemember);
        doAuth.then((s) => {
            setSession(s);
            setShowAuthModal(false);
            setAuthUser('');
            setAuthPass('');
            setAuthPass2('');
        }).catch((err) => {
            setAuthError(err && err.message ? err.message : String(err));
        }).then(() => {
            setAuthBusy(false);
        });
    }, [authMode, authUser, authPass, authPass2, authRemember]);

    const handleLogout = useCallback(() => {
        authLogout();
        setSession(null);
        setShowSavesPanel(false);
    }, []);

    // 保存当前项目为新存档
    const handleSaveProject = useCallback(() => {
        if (!session) return;
        try {
            saveCurrentWorkspace();
            const data = collectProjectState({
                extInfo,
                customBlocks,
                workspaceXmlMap: customBlockXmlRef.current,
                generatedCode
            });
            const name = saveNameInput.trim() || ('存档 ' + new Date().toLocaleString());
            saveProject(session.username, {id: 'save_' + Date.now(), name, data});
            setSaveNameInput('');
            refreshSaves();
            setSaveMsg('已保存存档：' + name);
        } catch (err) {
            setSaveMsg('保存失败：' + (err.message || err));
        }
    }, [session, extInfo, customBlocks, generatedCode, saveNameInput,
        refreshSaves, saveCurrentWorkspace]);

    // 用当前项目覆盖已有存档
    const handleOverwriteSave = useCallback((saveId) => {
        if (!session) return;
        try {
            saveCurrentWorkspace();
            const data = collectProjectState({
                extInfo,
                customBlocks,
                workspaceXmlMap: customBlockXmlRef.current,
                generatedCode
            });
            const old = savesList.find(s => s.id === saveId);
            saveProject(session.username, {id: saveId, name: (old && old.name) || '存档', data});
            refreshSaves();
            setSaveMsg('已更新存档：' + ((old && old.name) || ''));
        } catch (err) {
            setSaveMsg('更新失败：' + (err.message || err));
        }
    }, [session, extInfo, customBlocks, generatedCode, savesList,
        refreshSaves, saveCurrentWorkspace]);

    const handleDeleteSave = useCallback((saveId) => {
        if (!session) return;
        const target = savesList.find(s => s.id === saveId);
        if (!target) return;
        if (!window.confirm('确定删除存档「' + target.name + '」吗？此操作不可恢复。')) return;
        deleteSave(session.username, saveId);
        refreshSaves();
        setSaveMsg('已删除存档：' + target.name);
    }, [session, savesList, refreshSaves]);

    // 恢复 block_define 上的生成元数据（opcode/type/text）
    const rehydrateBlockMeta = useCallback((ws, blocks) => {
        const tops = ws.getTopBlocks ? ws.getTopBlocks(true) : [];
        tops.forEach(t => {
            if (t.type !== 'block_define') return;
            const svg = t.getSvgRoot && t.getSvgRoot();
            const bid = svg && svg.getAttribute('data-block-id');
            const cb = blocks.find(b => b.id === bid);
            if (!cb) return;
            t._opcode = (cb.id || 'block').replace(/[^a-zA-Z0-9]/g, '_');
            const bt = String(cb.blockType || 'command').toUpperCase();
            t._type = bt === 'BOOLEAN' ? 'BOOLEAN'
                : bt === 'REPORTER' ? 'REPORTER'
                    : bt === 'HAT' ? 'HAT'
                        : bt === 'CONDITIONAL' ? 'CONDITIONAL' : 'COMMAND';
            t._text = '[' + (cb.name || 'block') + ']';
            // 同步积木颜色（hex 或默认 290 紫色）
            if (t.setColour) {
                try { t.setColour(cb.colour || 290); } catch (e) { /* 忽略非法色 */ }
            }
            // 定义块禁止删除（覆盖从 XML 存档恢复的块）
            if (t.setDeletable) t.setDeletable(false);
        });
    }, []);

    // 任何 customBlocks 变化（创建/编辑/删除/导入）都同步到 Blockly 工作区
    // 并刷新生成代码面板——否则用户在"积木定义"面板改了 name/type 等信息，
    // 工作区里既有的 block_define 块对应的 _opcode/_type/_text 不会更新，
    // 代码面板仍显示旧内容。
    useEffect(() => {
        const ws = workspaceRef.current;
        if (!ws || !workspaceLoaded) return;
        rehydrateBlockMeta(ws, customBlocks);
        try {
            setGeneratedCode(javascriptGenerator.workspaceToCode(ws));
        } catch (e) { /* silent */ }
    }, [customBlocks, workspaceLoaded]);

    // 用存档中的积木列表 + 工作区 XML 重建当前 Blockly 工作区
    const rebuildWorkspaceFromState = useCallback((blocks, xmlMap) => {
        const ws = workspaceRef.current;
        const B = window._extBuilderBlockly || window.Blockly;
        if (!ws || !B) return;
        try {
            ws.clear();
            const firstId = blocks.length ? blocks[0].id : null;
            currentBlockRef.current = firstId;
            setCurrentBlockId(firstId);
            const xml = firstId ? xmlMap.get(firstId) : null;
            if (xml) {
                try {
                    const dom = B.Xml.textToDom(xml);
                    B.Xml.domToWorkspace(dom, ws);
                } catch (e) {
                    console.warn('Restore XML failed, adding starter blocks instead:', e);
                    blocks.forEach(b => addStarterBlocks(ws, B, b.name, b.id, b.blockType));
                }
            } else {
                blocks.forEach(b => addStarterBlocks(ws, B, b.name, b.id, b.blockType));
            }
            rehydrateBlockMeta(ws, blocks);
            try {
                setGeneratedCode(javascriptGenerator.workspaceToCode(ws));
            } catch (e) { /* silent */ }
        } catch (e) {
            console.warn('rebuildWorkspaceFromState failed:', e);
        }
    }, [rehydrateBlockMeta]);

    // 加载一个存档（恢复全部项目状态）
    const handleLoadSave = useCallback((save) => {
        if (!save || !save.data) return;
        try {
            const restored = restoreProjectState(save.data);
            setExtInfo({...DEFAULT_EXTENSION_INFO, ...restored.extInfo});
            setCustomBlocks(restored.customBlocks);
            customBlockXmlRef.current = restored.workspaceXmlMap;
            setGeneratedCode(restored.generatedCode);
            rebuildWorkspaceFromState(restored.customBlocks, restored.workspaceXmlMap);
            setShowSavesPanel(false);
            setShowProfilePanel(false);
            setSaveMsg('已加载存档：' + save.name);
            alert('已加载存档：' + save.name);
        } catch (err) {
            alert('加载存档失败：' + (err.message || err));
        }
    }, [rebuildWorkspaceFromState]);

    // 从 JSON 文件导入存档（登录后存入当前账号）
    const handleImportSaveFile = useCallback(() => {
        if (!session) {
            alert('请先登录后再导入存档');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const save = parseSaveFileText(String(ev.target.result));
                    saveProject(session.username, {
                        id: save.id || ('save_' + Date.now()),
                        name: save.name || file.name.replace(/\.json$/i, ''),
                        data: save.data
                    });
                    refreshSaves();
                    setSaveMsg('已导入存档：' + (save.name || file.name));
                } catch (err) {
                    alert('导入失败：' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }, [session, refreshSaves]);

    // 生成同步链接（在另一个部署打开即可互通）
    const handleGenSync = useCallback(() => {
        if (!session) return;
        try {
            const url = buildSyncUrl(session.username);
            setSyncLinkText(url);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url)
                    .then(() => setSaveMsg('同步链接已生成并复制到剪贴板'))
                    .catch(() => setSaveMsg('同步链接已生成（复制失败，可手动选择复制）'));
            } else {
                setSaveMsg('同步链接已生成（请手动复制）');
            }
        } catch (err) {
            setSaveMsg('生成失败：' + (err.message || err));
        }
    }, [session]);

    // 粘贴对方网站的同步链接并导入
    const handleImportSync = useCallback(() => {
        const payload = parseSyncPayload(syncInput);
        if (!payload) {
            setSaveMsg('链接无效，请检查后重试');
            return;
        }
        const ok = window.confirm(
            '检测到来自「' + (payload.site || '其他站点') + '」的同步数据。\n' +
            '账号：' + payload.user.username + '\n' +
            '存档数量：' + (payload.saves ? payload.saves.length : 0) + '\n\n' +
            '导入后本网站的登录账号与存档将与对方互通（已存在的存档不会被覆盖），是否继续？'
        );
        if (!ok) return;
        try {
            const res = importSyncPayload(payload);
            setSession(getSession());
            setSavesList(listSaves(payload.user.username));
            setSyncInput('');
            const msg = res.created
                ? '已在本站创建账号「' + res.username + '」并登录，互通成功。'
                : '账号「' + res.username + '」已存在，已合并其存档，互通成功。';
            setSaveMsg(msg + (res.merged ? ' 新增存档 ' + res.merged + ' 个。' : ''));
        } catch (err) {
            setSaveMsg('同步失败：' + (err.message || err));
        }
    }, [syncInput]);

    // 页面加载时检测 URL 中的 #sync= 同步链接并提示导入
    useEffect(() => {
        if (typeof location === 'undefined' || !location.hash) return;
        if (location.hash.indexOf('#sync=') !== 0) return;
        const payload = parseSyncPayload(location.hash);
        if (!payload) return;
        const ok = window.confirm(
            '检测到来自「' + (payload.site || '其他站点') + '」的同步链接。\n' +
            '账号：' + payload.user.username + '\n' +
            '存档数量：' + (payload.saves ? payload.saves.length : 0) + '\n\n' +
            '导入后本网站的登录账号与存档将与对方互通，是否继续？'
        );
        try {
            if (ok) {
                const res = importSyncPayload(payload);
                setSession(getSession());
                const msg = res.created
                    ? '已在本站创建账号「' + res.username + '」并登录，互通成功。'
                    : '账号「' + res.username + '」已存在，已合并其存档，互通成功。';
                alert(msg + (res.merged ? ' 新增存档 ' + res.merged + ' 个。' : ''));
            }
        } catch (err) {
            alert('同步失败：' + (err.message || err));
        }
        // 清除 hash，避免刷新页面重复提示
        try {
            history.replaceState(null, '', location.pathname + location.search);
        } catch (e) { /* ignore */ }
    }, []);

    // Add a block by type - removed (use Blockly drag-from-flyout instead)

    // Always render the UI - Blockly loads in background
    return (
        <div className="ext-builder">
            {/* Top menu bar (mimics TurboWarp's red top bar) */}
            <div className="ext-menu-bar">
                                <div className="ext-menu-bar-left">
                    <div className="ext-menu-brand">
                        <span className="ext-menu-logo">⊞</span>
                        <span className="ext-menu-title">扩展编辑器</span>
                    </div>
                    <button className="ext-menu-btn" onClick={handleOpenSettings} title="设置扩展元数据">
                        <span className="ext-menu-btn-icon">⚙</span>
                        <span className="ext-menu-btn-label">设置</span>
                    </button>
                    <button className="ext-menu-btn" onClick={() => setShowAddonsPanel(true)} title="扩展编辑器插件（ExtAddons）">
                        <span className="ext-menu-btn-icon">🧩</span>
                        <span className="ext-menu-btn-label">插件</span>
                    </button>
                    <button className="ext-menu-btn" onClick={handleOpenPreview} title="预览所有积木">
                        <span className="ext-menu-btn-icon">👁</span>
                        <span className="ext-menu-btn-label">预览</span>
                    </button>
                    {!session ? (
                        <button
                            className="ext-menu-btn"
                            onClick={() => { setAuthMode('login'); setAuthError(''); setShowAuthModal(true); }}
                            title="登录 / 注册"
                        >
                            <span className="ext-menu-btn-icon">👤</span>
                            <span className="ext-menu-btn-label">登录</span>
                        </button>
                    ) : (
                        <React.Fragment>
                            <button
                                className="ext-menu-user"
                                title="打开个人主页"
                                onClick={handleOpenProfile}
                            >👤 {session.username}</button>
                            <button className="ext-menu-btn" onClick={handleOpenSavesPanel} title="存档管理">
                                <span className="ext-menu-btn-icon">💾</span>
                                <span className="ext-menu-btn-label">存档</span>
                            </button>
                            <button className="ext-menu-btn" onClick={handleOpenFriends} title="好友 / 关注">
                                <span className="ext-menu-btn-icon">👥</span>
                                <span className="ext-menu-btn-label">好友</span>
                            </button>
                            <button className="ext-menu-btn ext-menu-btn-warn" onClick={handleLogout} title="退出登录">
                                <span className="ext-menu-btn-icon">⏻</span>
                                <span className="ext-menu-btn-label">退出</span>
                            </button>
                        </React.Fragment>
                    )}
                </div>
                <div className="ext-menu-bar-center">
                    <span className="ext-menu-ext-name">{extInfo.name}</span>
                    <span className="ext-menu-ext-id">({extInfo.id})</span>
                </div>
                <div className="ext-menu-bar-right">
                    <button className="ext-menu-btn" onClick={handleLoadExtension} title="加载扩展">
                        <span className="ext-menu-btn-icon">⬆</span>
                        <span className="ext-menu-btn-label">加载</span>
                    </button>
                    <button className="ext-menu-btn" onClick={handleExport} title="导出 .js 文件">
                        <span className="ext-menu-btn-icon">⬇</span>
                        <span className="ext-menu-btn-label">导出</span>
                    </button>
                    <button className="ext-menu-btn ext-menu-btn-warn" onClick={handleReset} title="重置工作区">
                        <span className="ext-menu-btn-icon">↻</span>
                        <span className="ext-menu-btn-label">重置</span>
                    </button>
                </div>
            </div>

            {/* Left icon rail (mimics AstraEditor: 制作积木 button pinned to far left) */}
            <div className="ext-builder-left">
                <button
                    className={`ext-left-btn ${showBlockBuilder ? 'active' : ''}`}
                    onClick={() => setShowBlockBuilder(true)}
                    title="制作积木"
                >
                    <img
                        src="/make-blocks-btn.png"
                        alt="制作积木"
                        className="ext-left-btn-img"
                    />
                </button>
            </div>

            {/* Right side: tab bar + main area */}
            <div className="ext-builder-right">
                {/* Tab bar */}
                <div className="ext-builder-tabs">
                    <button
                        className={`ext-tab ${activeTab === 'editor' ? 'active' : ''}`}
                        onClick={() => setActiveTab('editor')}
                    >
                        <span className="ext-tab-icon">🧩</span>
                        代码
                    </button>
                    <button
                        className={`ext-tab ${activeTab === 'debugger' ? 'active' : ''}`}
                        onClick={() => setActiveTab('debugger')}
                    >
                        <span className="ext-tab-icon">🐞</span>
                        调试器
                    </button>
                </div>

                <div className="ext-builder-main">
                {/* Block builder as a floating window (opens via 制作积木 button) */}
                {showBlockBuilder && (
                    <div className="ext-builder-modal-backdrop">
                        <div
                            ref={builderModalRef}
                            className="ext-builder-modal"
                            style={builderModalPos ? {
                                left: builderModalPos.x,
                                top: builderModalPos.y,
                                margin: 0
                            } : undefined}
                        >
                            <div
                                className="ext-builder-modal-header"
                                onMouseDown={handleBuilderDragStart}
                                title="拖动移动窗口"
                            >
                                <span className="ext-builder-modal-title">🧩 制作积木</span>
                                <button
                                    type="button"
                                    className="ext-builder-modal-close"
                                    onClick={() => setShowBlockBuilder(false)}
                                    aria-label="关闭制作积木"
                                    title="关闭"
                                >✕</button>
                            </div>
                            <div className="ext-builder-modal-body">
                    <div className="ext-block-list">
                        <button
                            className="ext-block-list-settings"
                            onClick={handleOpenSettings}
                            title="扩展设置"
                        >
                            ⚙ 扩展设置
                        </button>
                        <div className="ext-block-list-title">积木列表</div>
                        <div className="ext-block-list-items">
                            {customBlocks.map(block => (
                                <div
                                    key={block.id}
                                    className={`ext-block-list-item ${block.id === currentBlockId ? 'selected' : ''}`}
                                    onClick={() => editingBlockId !== block.id && handleSelectBlock(block.id)}
                                >
                                    {editingBlockId === block.id ? (
                                        <input
                                            className="ext-block-list-name-input"
                                            value={editingName}
                                            autoFocus
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleCommitRename(block.id);
                                                } else if (e.key === 'Escape') {
                                                    handleCancelRename();
                                                }
                                            }}
                                            onBlur={() => handleCommitRename(block.id)}
                                        />
                                    ) : (
                                        <span
                                            className="ext-block-list-name"
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                handleStartRename(block.id, block.name);
                                            }}
                                            title="双击重命名"
                                        >{block.name}</span>
                                    )}
                                    {customBlocks.length > 1 && (
                                        <button
                                            className="ext-block-list-delete"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                                            title="删除积木"
                                        >✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button className="ext-block-list-add" onClick={handleCreateBlock}>
                            + 创建积木
                        </button>

                        {/* Per-block editor (AstraEditor-style: type / config / target filter / icon) */}
                        {(() => {
                            const currentBlock = customBlocks.find(b => b.id === currentBlockId);
                            if (!currentBlock) return null;
                            return (
                                <div className="ext-block-editor">
                                    <div className="ext-block-editor-header">
                                        <span className="ext-block-editor-title">编辑积木</span>
                                        <span className="ext-block-editor-name">{currentBlock.name}</span>
                                    </div>

                                    {/* Live preview — shows the currently-edited block as a real Blockly SVG */}
                                    <div className="ext-block-editor-preview">
                                        <div className="ext-block-editor-preview-header">
                                            <span className="ext-block-editor-preview-label">
                                                {currentBlock.blockType === 'command' ? '命令积木'
                                                    : currentBlock.blockType === 'Boolean' ? '布尔积木'
                                                    : currentBlock.blockType === 'reporter' ? '报告积木'
                                                    : currentBlock.blockType === 'hat' ? '帽子积木'
                                                    : '条件积木'}
                                            </span>
                                        </div>
                                        <div
                                            className="ext-block-editor-preview-svg"
                                            dangerouslySetInnerHTML={{__html: panelPreviewSvg || '<span class="ext-block-editor-preview-empty">编辑字段以预览积木</span>'}}
                                        />
                                        <div
                                            ref={panelPreviewRef}
                                            className="ext-block-editor-preview-host"
                                            aria-hidden="true"
                                        />
                                    </div>

                                    {/* Field table (CB-ExtGallary style) */}
                                    <div className="ext-block-editor-fields-header">
                                        <span>类型</span>
                                        <span>文本</span>
                                        <span></span>
                                    </div>
                                    <div className="ext-block-editor-fields-list">
                                        {(Array.isArray(currentBlock.fields) ? currentBlock.fields : []).map((f, idx) => (
                                            <div key={idx} className="ext-block-editor-fields-row">
                                                <select
                                                    className="ext-block-editor-input ext-block-editor-input-type"
                                                    value={f.kind || 'text'}
                                                    onChange={(e) => handleUpdateField(currentBlock.id, idx, {kind: e.target.value})}
                                                >
                                                    <option value="label">标签</option>
                                                    <option value="text">字符串</option>
                                                    <option value="number">数字</option>
                                                    <option value="boolean">布尔</option>
                                                </select>
                                                <input
                                                    className="ext-block-editor-input ext-block-editor-input-text"
                                                    value={f.text || ''}
                                                    onChange={(e) => handleUpdateField(currentBlock.id, idx, {text: e.target.value})}
                                                    placeholder="字段文本"
                                                />
                                                {f.kind === 'number' && (
                                                    <input
                                                        className="ext-block-editor-input ext-block-editor-input-default"
                                                        type="number"
                                                        value={f.default || '0'}
                                                        onChange={(e) => handleUpdateField(currentBlock.id, idx, {default: e.target.value})}
                                                        placeholder="默认值"
                                                        title="数字默认值"
                                                    />
                                                )}
                                                {f.kind === 'boolean' && (
                                                    <select
                                                        className="ext-block-editor-input ext-block-editor-input-default"
                                                        value={f.default || 'true'}
                                                        onChange={(e) => handleUpdateField(currentBlock.id, idx, {default: e.target.value})}
                                                        title="布尔默认值"
                                                    >
                                                        <option value="true">是</option>
                                                        <option value="false">否</option>
                                                    </select>
                                                )}
                                                <button
                                                    type="button"
                                                    className="ext-block-editor-fields-delete"
                                                    onClick={() => handleRemoveField(currentBlock.id, idx)}
                                                    title="删除此字段"
                                                >删除</button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add field row (CB-ExtGallary style) */}
                                    <div className="ext-block-editor-fields-add">
                                        <button
                                            type="button"
                                            className="ext-block-editor-fields-add-btn"
                                            onClick={() => handleAddField(currentBlock.id, 'text')}
                                        >添加字段</button>
                                        <select
                                            className="ext-block-editor-input ext-block-editor-fields-add-type"
                                            defaultValue="text"
                                            id="ext-block-editor-fields-add-type-select"
                                        >
                                            <option value="label">标签</option>
                                            <option value="text">字符串</option>
                                            <option value="number">数字</option>
                                            <option value="boolean">布尔</option>
                                        </select>
                                    </div>

                                    {/* Block metadata (collapsed by default for cleaner UI) */}
                                    <details className="ext-block-editor-meta">
                                        <summary>积木元数据（高级）</summary>
                                        <label className="ext-block-editor-label">ID</label>
                                        <input
                                            className="ext-block-editor-input"
                                            value={currentBlock.id.replace(/^block_/, '')}
                                            readOnly
                                            title="积木 ID 由系统生成，可在扩展设置中自定义扩展 ID"
                                        />

                                        <label className="ext-block-editor-label">积木类型</label>
                                        <select
                                            className="ext-block-editor-input"
                                            value={currentBlock.blockType || 'command'}
                                            onChange={(e) => handleUpdateBlock(currentBlock.id, {blockType: e.target.value})}
                                        >
                                            <option value="command">命令积木</option>
                                            <option value="Boolean">布尔积木</option>
                                            <option value="reporter">报告积木</option>
                                            <option value="hat">帽子积木</option>
                                            <option value="conditional">条件积木</option>
                                        </select>

                                        <label className="ext-block-editor-label">积木颜色</label>
                                        <div className="ext-block-colour-picker">
                                            <input
                                                type="color"
                                                className="ext-block-colour-input"
                                                value={/^#[0-9a-fA-F]{6}$/.test(currentBlock.colour || '') ? currentBlock.colour : '#9966FF'}
                                                onChange={(e) => handleUpdateBlock(currentBlock.id, {colour: e.target.value})}
                                                title="自定义颜色"
                                            />
                                            {BLOCK_COLOURS.map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    className={'ext-block-colour-swatch' + (currentBlock.colour === c ? ' ext-block-colour-swatch-active' : '')}
                                                    style={{background: c}}
                                                    onClick={() => handleUpdateBlock(currentBlock.id, {colour: currentBlock.colour === c ? '' : c})}
                                                    title={c}
                                                />
                                            ))}
                                            {!!currentBlock.colour && (
                                                <button
                                                    type="button"
                                                    className="ext-block-colour-clear"
                                                    onClick={() => handleUpdateBlock(currentBlock.id, {colour: ''})}
                                                >默认</button>
                                            )}
                                        </div>

                                        <div className="ext-block-editor-section">积木配置</div>
                                        <label className="ext-block-editor-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!!currentBlock.isTerminal}
                                                onChange={(e) => handleUpdateBlock(currentBlock.id, {isTerminal: e.target.checked})}
                                            />
                                            结尾积木
                                        </label>
                                        <label className="ext-block-editor-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!!currentBlock.isAsync}
                                                onChange={(e) => handleUpdateBlock(currentBlock.id, {isAsync: e.target.checked})}
                                            />
                                            异步积木
                                        </label>
                                        <label className="ext-block-editor-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!!currentBlock.attachAllThreads}
                                                onChange={(e) => handleUpdateBlock(currentBlock.id, {attachAllThreads: e.target.checked})}
                                            />
                                            附加所有线程
                                        </label>

                                        <div className="ext-block-editor-section">目标过滤</div>
                                        <label className="ext-block-editor-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!!currentBlock.filterSprite}
                                                onChange={(e) => handleUpdateBlock(currentBlock.id, {filterSprite: e.target.checked})}
                                            />
                                            在角色中显示
                                        </label>
                                        <label className="ext-block-editor-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!!currentBlock.filterStage}
                                                onChange={(e) => handleUpdateBlock(currentBlock.id, {filterStage: e.target.checked})}
                                            />
                                            在舞台中显示
                                        </label>

                                        <button
                                            type="button"
                                            className="ext-block-editor-icon-btn"
                                            onClick={() => currentBlock.icon
                                                ? handleClearBlockIcon(currentBlock.id)
                                                : handlePickBlockIcon(currentBlock.id)}
                                        >
                                            {currentBlock.icon ? '移除图标' : '上传积木图标'}
                                        </button>
                                    </details>

                                    <div className="ext-block-editor-hint">
                                        在右侧 Blockly 工作区拖入积木来定义此积木的代码实现
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Blockly's native workspace + toolbox */}
                <div className="ext-builder-workspace-full">
                    {loadError && (
                        <div className="ext-builder-load-error">
                            <p style={{color: '#f48771', padding: '8px'}}>
                                ⚠️ Blockly 加载失败: {loadError}
                            </p>
                        </div>
                    )}
                    <div ref={blocklyDivRef} className="blockly-host" />
                </div>

                {/* Right code panel */}
                <div className="ext-builder-stage">
                    <div className="ext-stage-header">
                        <span className="ext-stage-title">📋 JavaScript 代码</span>
                        <div className="ext-stage-actions">
                            <button className="ext-stage-btn" onClick={handleOpenPreview} title="扩展积木预览">
                                👁
                            </button>
                            <button className="ext-stage-btn ext-stage-btn-copy" onClick={handleCopyCode} title="复制完整代码，可直接粘贴到 TurboWarp">
                                {copyMsg ? '✅ 已复制' : '📋 复制'}
                            </button>
                            <button className="ext-stage-btn" onClick={handleExport} title="导出">
                                ⬇
                            </button>
                            <button className="ext-stage-btn" onClick={handleLoadExtension} title="加载">
                                ⬆
                            </button>
                            <button className="ext-stage-btn" onClick={handleReset} title="重置">
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Add block by category - removed (Blockly toolbox now handles drag-from-flyout) */}

                    <div className="ext-stage-screen">
                        <pre className="ext-code-content">
                            <code>{exportableCode || '// 拖入积木，JS 代码会自动生成在这里\n// Drag blocks into the workspace, JS will appear here'}</code>
                        </pre>
                    </div>
                    <div className="ext-stage-footer">
                        <button onClick={handleUndo}>↩ 撤销</button>
                        <button onClick={handleRedo}>↪ 重做</button>
                    </div>
                </div>
                </div>
            </div>

            {/* Extension settings modal — mimics the "创建扩展" form */}
            {showExtensionSettings && settingsDraft && (
                <div className="ext-modal-backdrop" onClick={handleCloseSettings}>
                    <div
                        className="ext-modal ext-settings-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="ext-settings-banner"
                            style={{
                                background: `linear-gradient(135deg, ${settingsDraft.color1}, ${settingsDraft.color2}, ${settingsDraft.color3})`
                            }}
                        >
                            {settingsDraft.blockIcon ? (
                                <img src={settingsDraft.blockIcon} alt="icon" className="ext-settings-banner-icon" />
                            ) : (
                                <div className="ext-settings-banner-icon ext-settings-banner-placeholder">⊞</div>
                            )}
                        </div>
                        <h2 className="ext-settings-title">创建扩展</h2>

                        <label className="ext-settings-label">名称</label>
                        <input
                            className="ext-settings-input"
                            value={settingsDraft.name}
                            placeholder="扩展名称..."
                            onChange={(e) => setSettingsDraft({...settingsDraft, name: e.target.value})}
                        />

                        <div className="ext-settings-id-preview">
                            {settingsDraft.customId ? settingsDraft.id : DEFAULT_EXTENSION_INFO.id}
                        </div>

                        <label className="ext-settings-checkbox">
                            <input
                                type="checkbox"
                                checked={settingsDraft.customId}
                                onChange={(e) => setSettingsDraft({
                                    ...settingsDraft,
                                    customId: e.target.checked,
                                    id: e.target.checked ? (settingsDraft.id || DEFAULT_EXTENSION_INFO.id) : DEFAULT_EXTENSION_INFO.id
                                })}
                            />
                            自定义ID?
                        </label>
                        {settingsDraft.customId && (
                            <input
                                className="ext-settings-input"
                                placeholder="扩展ID"
                                value={settingsDraft.id}
                                onChange={(e) => setSettingsDraft({...settingsDraft, id: e.target.value})}
                            />
                        )}

                        <label className="ext-settings-label">描述</label>
                        <input
                            className="ext-settings-input"
                            value={settingsDraft.description}
                            placeholder="扩展描述..."
                            onChange={(e) => setSettingsDraft({...settingsDraft, description: e.target.value})}
                        />

                        <label className="ext-settings-label">作者</label>
                        <input
                            className="ext-settings-input"
                            value={settingsDraft.author}
                            placeholder="作者名称..."
                            onChange={(e) => setSettingsDraft({...settingsDraft, author: e.target.value})}
                        />

                        <label className="ext-settings-label">文档链接</label>
                        <input
                            className="ext-settings-input"
                            value={settingsDraft.docsUrl}
                            placeholder="https://..."
                            onChange={(e) => setSettingsDraft({...settingsDraft, docsUrl: e.target.value})}
                        />

                        <label className="ext-settings-label">许可证</label>
                        <select
                            className="ext-settings-input"
                            value={settingsDraft.license}
                            onChange={(e) => setSettingsDraft({...settingsDraft, license: e.target.value})}
                        >
                            {LICENSE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>

                        <div className="ext-settings-label-row">
                            <span className="ext-settings-label">自定义颜色:</span>
                            <input
                                type="color"
                                className="ext-settings-color-picker"
                                value={settingsDraft.color1}
                                onChange={(e) => {
                                    const c = e.target.value;
                                    setSettingsDraft({
                                        ...settingsDraft,
                                        color1: c,
                                        color2: c,
                                        color3: c
                                    });
                                }}
                            />
                        </div>
                        <div className="ext-settings-color-presets">
                            {COLOR_PRESETS.map((preset, i) => {
                                const active = preset[0] === settingsDraft.color1
                                    && preset[1] === settingsDraft.color2
                                    && preset[2] === settingsDraft.color3;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`ext-settings-color-swatch ${active ? 'active' : ''}`}
                                        onClick={() => handlePickColor(preset)}
                                        title={preset.join(', ')}
                                        style={{
                                            background: `linear-gradient(135deg, ${preset[0]}, ${preset[1]}, ${preset[2]})`
                                        }}
                                    />
                                );
                            })}
                        </div>

                        <div className="ext-settings-icon-row">
                            <div className="ext-settings-icon-cell">
                                <div className="ext-settings-label">分类图标</div>
                                <div className="ext-settings-icon-preview">
                                    {settingsDraft.categoryIcon ? (
                                        <img src={settingsDraft.categoryIcon} alt="category" />
                                    ) : (
                                        <span className="ext-settings-icon-empty">未选择图标</span>
                                    )}
                                </div>
                                <div className="ext-settings-icon-actions">
                                    <button
                                        type="button"
                                        className="ext-settings-icon-btn"
                                        onClick={() => handlePickIcon('categoryIcon')}
                                    >上传</button>
                                    {settingsDraft.categoryIcon && (
                                        <button
                                            type="button"
                                            className="ext-settings-icon-clear"
                                            onClick={() => handleClearIcon('categoryIcon')}
                                        >清除</button>
                                    )}
                                </div>
                            </div>

                            <div className="ext-settings-icon-cell">
                                <div className="ext-settings-label">积木图标</div>
                                <div className="ext-settings-icon-preview">
                                    {settingsDraft.blockIcon ? (
                                        <img src={settingsDraft.blockIcon} alt="block" />
                                    ) : (
                                        <span className="ext-settings-icon-empty">未选择图标</span>
                                    )}
                                </div>
                                <div className="ext-settings-icon-actions">
                                    <button
                                        type="button"
                                        className="ext-settings-icon-btn"
                                        onClick={() => handlePickIcon('blockIcon')}
                                    >上传</button>
                                    {settingsDraft.blockIcon && (
                                        <button
                                            type="button"
                                            className="ext-settings-icon-clear"
                                            onClick={() => handleClearIcon('blockIcon')}
                                        >清除</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="ext-settings-actions">
                            <button
                                type="button"
                                className="ext-settings-cancel"
                                onClick={handleCloseSettings}
                            >取消</button>
                            <button
                                type="button"
                                className="ext-settings-done"
                                onClick={handleApplySettings}
                            >完成</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Block preview modal (mimics AstraEditor "扩展预览") */}
            <div
                className="ext-preview-host"
                ref={previewHostRef}
                aria-hidden="true"
            />
            {showBlockPreview && (
                <div className="ext-modal-backdrop" onClick={handleClosePreview}>
                    <div
                        className="ext-modal ext-preview-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ext-preview-modal-header">
                            <h2 className="ext-settings-title">扩展积木预览</h2>
                            <button
                                type="button"
                                className="ext-preview-modal-close"
                                onClick={handleClosePreview}
                                aria-label="关闭预览"
                            >✕</button>
                        </div>
                        <div className="ext-preview-modal-sub">
                            <span className="ext-preview-ext-name">{extInfo.name}</span>
                            <span className="ext-preview-block-count">共 {previewBlocks.length} 个积木</span>
                        </div>
                        <div className="ext-preview-list">
                            {previewBlocks.length === 0 ? (
                                <div className="ext-preview-empty">没有可预览的积木</div>
                            ) : (
                                previewBlocks.map((b, i) => (
                                    <div
                                        key={b.type + i}
                                        className="ext-preview-item"
                                        title={b.type}
                                    >
                                        <div className="ext-preview-item-type">{b.type}</div>
                                        <div
                                            className="ext-preview-item-svg"
                                            dangerouslySetInnerHTML={{__html: b.svgXml}}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 登录 / 注册 弹窗 */}
            {showAuthModal && (
                <div
                    className="ext-auth-backdrop"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}
                >
                    <div className="ext-auth-card">
                        <div className="ext-auth-header">
                            <span className="ext-auth-title">
                                {authMode === 'login' ? '👤 登录' : '📝 注册'}
                            </span>
                            <button
                                type="button"
                                className="ext-builder-modal-close"
                                onClick={() => setShowAuthModal(false)}
                                aria-label="关闭"
                                title="关闭"
                            >✕</button>
                        </div>
                        <form className="ext-auth-form" onSubmit={handleAuthSubmit}>
                                <label className="ext-auth-label">用户名</label>
                                <input
                                    className="ext-auth-input"
                                    value={authUser}
                                    onChange={(e) => setAuthUser(e.target.value)}
                                    placeholder="输入用户名"
                                    autoFocus
                                />
                                <label className="ext-auth-label">密码</label>
                                <input
                                    className="ext-auth-input"
                                    type="password"
                                    value={authPass}
                                    onChange={(e) => setAuthPass(e.target.value)}
                                    placeholder={authMode === 'register' ? '至少 4 个字符' : '输入密码'}
                                />
                                {authMode === 'register' && (
                                    <React.Fragment>
                                        <label className="ext-auth-label">确认密码</label>
                                        <input
                                            className="ext-auth-input"
                                            type="password"
                                            value={authPass2}
                                            onChange={(e) => setAuthPass2(e.target.value)}
                                            placeholder="再次输入密码"
                                        />
                                    </React.Fragment>
                                )}
                                {authError && <div className="ext-auth-error">{authError}</div>}
                                <label className="ext-auth-remember" title="勾选后 30 天内打开本网站自动登录，无需重复输入密码">
                                    <input
                                        type="checkbox"
                                        checked={authRemember}
                                        onChange={(e) => setAuthRemember(e.target.checked)}
                                    />
                                    <span>自动登录（记住我，30 天内免登录）</span>
                                </label>
                                <button className="ext-auth-btn" type="submit" disabled={authBusy}>
                                    {authBusy ? '请稍候…' : (authMode === 'login' ? '登录' : '注册并登录')}
                                </button>
                                <button
                                    type="button"
                                    className="ext-auth-switch"
                                    onClick={() => {
                                        setAuthMode(authMode === 'login' ? 'register' : 'login');
                                        setAuthError('');
                                    }}
                                >
                                    {authMode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
                                </button>
                            </form>
                    </div>
                </div>
            )}

            {/* 插件设置 弹窗（ExtAddons） */}
            {showAddonsPanel && (
                <div
                    className="ext-auth-backdrop"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowAddonsPanel(false); }}
                >
                    <div className="ext-auth-card ext-addons-card">
                        <div className="ext-auth-header">
                            <span className="ext-auth-title">🧩 编辑器插件</span>
                            <button
                                type="button"
                                className="ext-builder-modal-close"
                                onClick={() => setShowAddonsPanel(false)}
                                aria-label="关闭"
                                title="关闭"
                            >✕</button>
                        </div>
                        <div className="ext-addons-intro">
                            精选自 TurboWarp 插件（addons），只保留对扩展制作有用的积木编辑器增强。
                            开关即时生效，无需刷新。
                        </div>
                        <div className="ext-addons-search">
                            <input
                                type="search"
                                className="ext-addons-search-input"
                                placeholder="搜索插件..."
                                value={addonSearch}
                                onChange={(e) => setAddonSearch(e.target.value)}
                            />
                        </div>
                        <div className="ext-addons-list">
                            {getAllAddons()
                                .filter(addon => {
                                    if (!addonSearch.trim()) return true;
                                    const q = addonSearch.trim().toLowerCase();
                                    return addon.name.toLowerCase().indexOf(q) >= 0 ||
                                        addon.description.toLowerCase().indexOf(q) >= 0 ||
                                        addon.category.toLowerCase().indexOf(q) >= 0;
                                })
                                .map(addon => (
                                <div key={addon.id} className="ext-addon-item">
                                    <label className="ext-addon-label">
                                        <input
                                            type="checkbox"
                                            className="ext-addon-check"
                                            checked={!!addonState[addon.id]}
                                            onChange={(e) => handleToggleAddon(addon.id, e.target.checked)}
                                        />
                                        <span className="ext-addon-name">{addon.name}</span>
                                        {addon.recommended && <span className="ext-addon-recommend">推荐</span>}
                                        <span className="ext-addon-cat">{addon.category}</span>
                                        {addon.custom && (
                                            <button
                                                type="button"
                                                className="ext-addon-del"
                                                title="删除此自定义插件"
                                                aria-label="删除自定义插件"
                                                onClick={() => handleRemoveCustomAddon(addon.id)}
                                            >删除</button>
                                        )}
                                    </label>
                                    <div className="ext-addon-desc">{addon.description}</div>
                                    {/* 子选项：仅在插件启用且有 options 时显示 */}
                                    {addonState[addon.id] && addon.options && addon.options.length > 0 && (
                                        <div className="ext-addon-opts">
                                            {addon.options.map(opt => (
                                                <label key={opt.id} className="ext-addon-opt-item">
                                                    <input
                                                        type="checkbox"
                                                        className="ext-addon-opt-check"
                                                        checked={!!(addonOpts[addon.id] && addonOpts[addon.id][opt.id])}
                                                        onChange={(e) => handleToggleAddonOption(addon.id, opt.id, e.target.checked)}
                                                    />
                                                    <span className="ext-opt-label">{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {getAllAddons().filter(addon => {
                                if (!addonSearch.trim()) return true;
                                const q = addonSearch.trim().toLowerCase();
                                return addon.name.toLowerCase().indexOf(q) >= 0 ||
                                    addon.description.toLowerCase().indexOf(q) >= 0 ||
                                    addon.category.toLowerCase().indexOf(q) >= 0;
                            }).length === 0 && (
                                <div className="ext-addon-empty">没有匹配的插件</div>
                            )}
                        </div>
                        <div className="ext-addons-actions">
                            <button
                                type="button"
                                className="ext-addons-action-btn ext-addons-action-btn-primary"
                                onClick={handleImportPlugin}
                            >导入插件</button>
                            <button
                                type="button"
                                className="ext-addons-action-btn ext-addons-action-btn-info"
                                onClick={() => window.open('ext-addons-doc.html', '_blank')}
                                title="打开插件开发文档与使用教程（独立页面）"
                            >开发教程</button>
                            <button
                                type="button"
                                className="ext-addons-action-btn"
                                onClick={handleAddonExport}
                            >导出设置</button>
                            <button
                                type="button"
                                className="ext-addons-action-btn"
                                onClick={handleAddonImport}
                            >导入设置</button>
                            <button
                                type="button"
                                className="ext-addons-action-btn ext-addons-action-btn-warn"
                                onClick={handleAddonReset}
                            >全部重置</button>
                        </div>
                        <div className="ext-addons-foot">
                            <button
                                type="button"
                                className="ext-auth-btn"
                                onClick={() => setShowAddonsPanel(false)}
                            >完成</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 插件开发与使用教程已移至独立页面：ext-addons-doc.html */}

            {/* 好友 / 关注 弹窗 */}
            {showFriendsPanel && session && (() => {
                const me = session.username;
                const following = friendsRelations
                    .filter(r => r.follower === me).map(r => r.followee);
                const followers = friendsRelations
                    .filter(r => r.followee === me).map(r => r.follower);
                const friendSet = following.filter(f => followers.indexOf(f) >= 0);
                let listItems = [];
                let emptyText = '暂无';
                if (friendsTab === 'friends') {
                    listItems = friendSet.map(u => ({u, action: 'unfriend', label: '取消关注'}));
                    emptyText = '还没有好友。关注他人，对方也关注你后即成为好友。';
                } else if (friendsTab === 'following') {
                    listItems = following.map(u => ({u, action: 'unfollow-following', label: '取消关注'}));
                    emptyText = '你还没有关注任何人。';
                } else {
                    listItems = followers.map(u => ({u, action: 'unfollow-follower', label: '移除', followBack: true}));
                    emptyText = '还没有人关注你。';
                }
                return (
                <div
                    className="ext-auth-backdrop"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowFriendsPanel(false); }}
                >
                    <div className="ext-auth-card ext-friends-card">
                        <div className="ext-auth-header">
                            <span className="ext-auth-title">👥 好友 / 关注</span>
                            <button
                                type="button"
                                className="ext-builder-modal-close"
                                onClick={() => setShowFriendsPanel(false)}
                                aria-label="关闭"
                                title="关闭"
                            >✕</button>
                        </div>
                        <div className="ext-friends-intro">
                            关注他人即可建立联系；互相关注会自动成为好友。数据存储在云端，跨设备同步。
                        </div>
                        {!cloudAvailable() && (
                            <div className="ext-friends-msg">⚠️ 云端未启用，好友功能暂不可用。请检查 supabase-config.js 的 Supabase 配置。</div>
                        )}

                        {/* 搜索添加 */}
                        <div className="ext-friends-search">
                            <input
                                type="search"
                                className="ext-friends-search-input"
                                placeholder="输入用户名搜索用户…"
                                value={friendsSearch}
                                onChange={(e) => setFriendsSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleFriendSearch(); }}
                            />
                            <button
                                type="button"
                                className="ext-friends-search-btn"
                                onClick={handleFriendSearch}
                                disabled={friendsBusy}
                            >搜索</button>
                        </div>
                        {friendsResults.length > 0 && (
                            <div className="ext-friends-results">
                                {friendsResults.map(r => {
                                    const isFollowing = following.indexOf(r.username) >= 0;
                                    return (
                                        <div key={r.username} className="ext-friends-item">
                                            <span className="ext-friends-name">{r.username}</span>
                                            <button
                                                type="button"
                                                className={'ext-friends-btn' + (isFollowing ? ' ext-friends-btn-done' : '')}
                                                disabled={friendsBusy}
                                                onClick={() => handleFriendAction(r.username, isFollowing ? 'unfollow-following' : 'follow')}
                                            >{isFollowing ? '已关注 ✓' : '关注'}</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 分组标签 */}
                        <div className="ext-friends-tabs">
                            <button
                                type="button"
                                className={'ext-friends-tab' + (friendsTab === 'friends' ? ' ext-friends-tab-active' : '')}
                                onClick={() => setFriendsTab('friends')}
                            >好友 ({friendSet.length})</button>
                            <button
                                type="button"
                                className={'ext-friends-tab' + (friendsTab === 'following' ? ' ext-friends-tab-active' : '')}
                                onClick={() => setFriendsTab('following')}
                            >我关注的 ({following.length})</button>
                            <button
                                type="button"
                                className={'ext-friends-tab' + (friendsTab === 'followers' ? ' ext-friends-tab-active' : '')}
                                onClick={() => setFriendsTab('followers')}
                            >关注我的 ({followers.length})</button>
                        </div>

                        {/* 列表 */}
                        <div className="ext-friends-list">
                            {listItems.length === 0 ? (
                                <div className="ext-friends-empty">{emptyText}</div>
                            ) : (
                                listItems.map((it) => (
                                    <div key={it.u} className="ext-friends-item">
                                        <span className="ext-friends-name">{it.u}</span>
                                        <span className="ext-friends-actions">
                                            {it.followBack && (
                                                <button
                                                    type="button"
                                                    className="ext-friends-btn"
                                                    disabled={friendsBusy}
                                                    onClick={() => handleFriendAction(it.u, 'follow')}
                                                >回关</button>
                                            )}
                                            <button
                                                type="button"
                                                className="ext-friends-btn ext-friends-btn-warn"
                                                disabled={friendsBusy}
                                                onClick={() => handleFriendAction(it.u, it.action)}
                                            >{it.label}</button>
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {friendsMsg && <div className="ext-friends-msg">{friendsMsg}</div>}
                    </div>
                </div>
                );
            })()}

            {/* 个人主页 弹窗 */}
            {showProfilePanel && session && (
                <div
                    className="ext-auth-backdrop"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowProfilePanel(false); }}
                >
                    <div className="ext-auth-card ext-profile-card">
                        <div className="ext-auth-header">
                            <span className="ext-auth-title">👤 个人主页</span>
                            <button
                                type="button"
                                className="ext-builder-modal-close"
                                onClick={() => setShowProfilePanel(false)}
                                aria-label="关闭"
                                title="关闭"
                            >✕</button>
                        </div>
                        <div className="ext-profile-body">
                            <div className="ext-profile-head">
                                <div className="ext-profile-avatar">
                                    {(session.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="ext-profile-info">
                                    <div className="ext-profile-name">{session.username}</div>
                                    <div className="ext-profile-email">
                                        {profileMeta && profileMeta.email ? profileMeta.email : ''}
                                    </div>
                                </div>
                            </div>
                            <div className="ext-profile-stats">
                                <div className="ext-profile-stat">
                                    <span className="ext-profile-stat-num">
                                        {Array.isArray(savesList) ? savesList.length : 0}
                                    </span>
                                    <span className="ext-profile-stat-label">存档</span>
                                </div>
                                <div className="ext-profile-stat">
                                    <span className="ext-profile-stat-num">
                                        {customBlocks.length}
                                    </span>
                                    <span className="ext-profile-stat-label">积木</span>
                                </div>
                                <div className="ext-profile-stat">
                                    <span className="ext-profile-stat-num">1</span>
                                    <span className="ext-profile-stat-label">扩展</span>
                                </div>
                                <div className="ext-profile-stat">
                                    <span className="ext-profile-stat-num">{profileCounts.following}</span>
                                    <span className="ext-profile-stat-label">关注</span>
                                </div>
                                <div className="ext-profile-stat">
                                    <span className="ext-profile-stat-num">{profileCounts.followers}</span>
                                    <span className="ext-profile-stat-label">粉丝</span>
                                </div>
                            </div>
                            <div className="ext-profile-joined">
                                注册时间：
                                {profileMeta && profileMeta.createdAt
                                    ? new Date(profileMeta.createdAt).toLocaleString()
                                    : '未知'}
                            </div>
                            <div className="ext-profile-saves-title">我的存档</div>
                            <div className="ext-profile-saves">
                                {Array.isArray(savesList) && savesList.length > 0 ? (
                                    savesList.map(save => (
                                        <div key={save.id} className="ext-profile-save-item">
                                            <div className="ext-profile-save-info">
                                                <div className="ext-profile-save-name">{save.name || '未命名存档'}</div>
                                                <div className="ext-profile-save-time">
                                                    {new Date(save.updatedAt || Date.now()).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="ext-profile-save-actions">
                                                <button
                                                    type="button"
                                                    className="ext-profile-save-btn"
                                                    onClick={() => handleLoadSave(save)}
                                                    title="加载此存档"
                                                >加载</button>
                                                <button
                                                    type="button"
                                                    className="ext-profile-save-btn ext-profile-save-btn-del"
                                                    onClick={() => handleDeleteSave(save.id)}
                                                    title="删除此存档"
                                                >删除</button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="ext-profile-saves-empty">还没有存档，点击顶部 💾 存档 按钮保存项目</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 存档管理 弹窗 */}
            {showSavesPanel && session && (
                <div
                    className="ext-auth-backdrop"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSavesPanel(false); }}
                >
                    <div className="ext-auth-card ext-saves-card">
                        <div className="ext-auth-header">
                            <span className="ext-auth-title">💾 存档管理 · {session.username}</span>
                            <button
                                type="button"
                                className="ext-builder-modal-close"
                                onClick={() => setShowSavesPanel(false)}
                                aria-label="关闭"
                                title="关闭"
                            >✕</button>
                        </div>
                        <div className="ext-saves-body">
                            <div className="ext-saves-new">
                                <input
                                    className="ext-auth-input ext-saves-name-input"
                                    value={saveNameInput}
                                    onChange={(e) => setSaveNameInput(e.target.value)}
                                    placeholder="存档名称（留空自动命名）"
                                />
                                <button className="ext-auth-btn ext-saves-save-btn" onClick={handleSaveProject}>
                                    保存当前项目
                                </button>
                            </div>
                            {saveMsg && <div className="ext-saves-msg">{saveMsg}</div>}
                            <div className="ext-saves-list-title">我的存档（{savesList.length}）</div>
                            {savesList.length === 0 && (
                                <div className="ext-saves-empty">还没有存档，点击上方按钮保存当前项目。</div>
                            )}
                            <div className="ext-saves-list">
                                {savesList.map(save => (
                                    <div className="ext-saves-item" key={save.id}>
                                        <div className="ext-saves-item-info">
                                            <div className="ext-saves-item-name" title={save.name}>{save.name}</div>
                                            <div className="ext-saves-item-time">
                                                {new Date(save.updatedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="ext-saves-item-actions">
                                            <button
                                                className="ext-saves-act"
                                                title="加载此存档"
                                                onClick={() => handleLoadSave(save)}
                                            >加载</button>
                                            <button
                                                className="ext-saves-act"
                                                title="用当前项目覆盖此存档"
                                                onClick={() => handleOverwriteSave(save.id)}
                                            >覆盖</button>
                                            <button
                                                className="ext-saves-act"
                                                title="导出为 JSON 文件"
                                                onClick={() => exportSaveFile(save)}
                                            >导出</button>
                                            <button
                                                className="ext-saves-act ext-saves-act-del"
                                                title="删除此存档"
                                                onClick={() => handleDeleteSave(save.id)}
                                            >删除</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="ext-sync-section">
                                <div className="ext-sync-title">🔗 跨站互通（同步链接）</div>
                                <p className="ext-sync-hint">
                                    在两个部署（例如平台应用与自定义域名）之间互通登录与存档：
                                    在本站生成同步链接，在另一个网站打开该链接即可导入账号与存档，
                                    两边数据保持一致，可双向重复同步。
                                </p>
                                <button className="ext-auth-btn" onClick={handleGenSync}>生成同步链接</button>
                                {syncLinkText && (
                                    <div className="ext-sync-link-box">
                                        <textarea
                                            className="ext-sync-link"
                                            readOnly
                                            value={syncLinkText}
                                            onFocus={(e) => e.target.select()}
                                            rows={3}
                                        />
                                        <button
                                            className="ext-saves-act"
                                            onClick={() => {
                                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                                    navigator.clipboard.writeText(syncLinkText)
                                                        .then(() => alert('已复制同步链接'))
                                                        .catch(() => alert('复制失败，请手动选择复制'));
                                                } else {
                                                    alert('复制失败，请手动选择复制');
                                                }
                                            }}
                                        >复制</button>
                                    </div>
                                )}
                                <div className="ext-sync-import">
                                    <input
                                        className="ext-auth-input"
                                        value={syncInput}
                                        onChange={(e) => setSyncInput(e.target.value)}
                                        placeholder="粘贴对方网站的同步链接（或 #sync= 部分）"
                                    />
                                    <button className="ext-auth-btn" onClick={handleImportSync}>导入对方同步</button>
                                </div>
                                <div className="ext-sync-file">
                                    <button className="ext-saves-act" onClick={handleImportSaveFile}>
                                        导入存档文件(.json)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function wrapAsExtension(extInfo, generatedCode, customBlocks) {
    const esc = (s) => String(s || '').replace(/'/g, "\\'");
    const headerLines = [
        ' * ' + extInfo.name,
        ' * Extension ID: ' + extInfo.id,
        extInfo.description ? ' * Description: ' + extInfo.description : null,
        extInfo.author ? ' * Author: ' + extInfo.author : null,
        extInfo.docsUrl ? ' * Docs: ' + extInfo.docsUrl : null,
        ' * License: ' + (extInfo.license || 'MPL-2.0'),
        ' * Blocks: ' + (Array.isArray(customBlocks) ? customBlocks.length : 0),
        ' * Generated by TurboWarp Extension Editor'
    ].filter(Boolean).join('\n');

    // Build block entries from customBlocks metadata.
    // Each block's `text` is reconstructed from its parts (text + input fragments).
    const blocks = (Array.isArray(customBlocks) ? customBlocks : []).map((b) => {
        const parts = Array.isArray(b.parts) ? b.parts : [];
        // TurboWarp text 语法：命名参数用 [NAME]（%s/%n 是 Blockly 语法，
        // TurboWarp 不解析，会原样显示成 "%s"）。arguments 必须与 [NAME]
        // 一一对应，否则 TurboWarp 静默丢弃该参数。
        const text = parts
            .map(p => p.kind === 'text' ? p.value : `[${p.name}]`)
            .join('');
        const filter = [];
        if (b.filterSprite) filter.push('TARGET_SPRITE');
        if (b.filterStage) filter.push('TARGET_STAGE');
        // 从 parts 构建 arguments（TurboWarp 的 ArgumentType 字符串形式）
        const argumentsDef = {};
        parts.forEach(p => {
            if (!p || p.kind !== 'input' || !p.name) return;
            argumentsDef[p.name] = {
                type: p.inputType === 'Number' ? 'number' : 'string',
                defaultValue: p.inputType === 'Number' ? 0 : ''
            };
        });
        const entry = {
            // CRITICAL: this opcode must EXACTLY match the method name the
            // generator emits. The generator uses `_opcode` which is
            // `(blockId || 'block').replace(/[^a-zA-Z0-9]/g, '_')` — so the
            // registered opcode must be the same transform of b.id. If they
            // differ (e.g. appending the block name), TurboWarp renders the
            // block but calling it fails silently ("no reaction").
            opcode: (b.id || 'block').replace(/[^a-zA-Z0-9]/g, '_'),
            // CRITICAL: TurboWarp parses text with `[NAME]` as a reference
            // to arguments.NAME. If no matching argument exists the bracket
            // is silently dropped, leaving a blank block (visible as a red
            // rectangle with no text). Wrap names in `[]` ONLY when an
            // argument is actually defined.
            text: text || (b.name || 'block'),
            blockType: b.blockType || 'command',
            arguments: argumentsDef
        };
        // 积木自定义颜色：同时输出 colour 与 color1/color2/color3。
        // TurboWarp 的 scratch-vm 在 _convertBlockForScratchBlocks 中读取
        // blockInfo.color1（块级覆盖），不读 colour；官方文档推荐 colour。
        // 三份都输出，任何解析方式都能生效。color2/color3 由 color1 变暗派生。
        if (b.colour) {
            entry.colour = b.colour;
            entry.color1 = b.colour;
            entry.color2 = darkenHex(b.colour, 0.85);
            entry.color3 = darkenHex(b.colour, 0.7);
        }
        if (b.isTerminal) entry.isTerminal = true;
        // isAsync：用户勾选，或生成的实现方法体含 await（block_define 会为
        // 含 await 的方法自动加 async 前缀并输出 "// isAsync: true" 注释）。
        // TurboWarp 对 isAsync 块会 await 方法返回值；漏标则异步块静默失效。
        const opcode = (b.id || 'block').replace(/[^a-zA-Z0-9]/g, '_');
        if (b.isAsync || new RegExp('async\\s+' + opcode + '\\s*\\(args').test(generatedCode)) {
            entry.isAsync = true;
        }
        if (b.attachAllThreads) entry.shouldRestartExistingThreads = true;
        if (filter.length) entry.filterTargets = filter;
        if (b.icon) entry.hideFromPalette = false;
        return entry;
    });

    const blocksJson = JSON.stringify(blocks, null, 4)
        .split('\n')
        .map(l => '                ' + l)
        .join('\n');

    const metaFields = [
        "                id: '" + esc(extInfo.id) + "',",
        "                name: '" + esc(extInfo.name) + "',",
        "                color1: '" + extInfo.color1 + "',",
        "                color2: '" + extInfo.color2 + "',",
        "                color3: '" + extInfo.color3 + "',",
        extInfo.description ? "                description: '" + esc(extInfo.description) + "'," : null,
        extInfo.author ? "                author: '" + esc(extInfo.author) + "'," : null,
        extInfo.docsUrl ? "                docsURL: '" + esc(extInfo.docsUrl) + "'," : null,
        extInfo.license ? "                license: '" + esc(extInfo.license) + "'," : null,
        '                blocks: ' + blocksJson
    ].filter(Boolean).join('\n');

    const className = extInfo.id
        .split(/[^a-zA-Z0-9]/)
        .filter(Boolean)
        .map(capitalize)
        .join('') || 'MyExtension';

    return `/**\n${headerLines}\n */\n\n` +
`(function(Scratch) {\n` +
`    'use strict';\n\n` +
EXT_FORGE_RUNTIME.split('\n').map(l => '    ' + l).join('\n') + '\n\n' +
`    class ${className} {\n` +
`        getInfo() {\n` +
`            return {\n` +
`${metaFields}\n` +
`            };\n` +
`        }\n\n` +
`${withUtilInjection(generatedCode).split('\n').map(l => '        ' + l).join('\n')}\n` +
`    }\n\n` +
`    Scratch.extensions.register(new ${className}());\n` +
`})(Scratch);\n`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// 从 hex 颜色按比例变暗，派生 color2/color3（'#RRGGBB' -> '#RRGGBB'）
function darkenHex(hex, factor) {
    const h = String(hex || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return hex;
    const n = (v) => {
        const x = Math.max(0, Math.min(255, Math.round(v * factor)));
        return x.toString(16).padStart(2, '0');
    };
    return '#' + n(parseInt(h.slice(1, 3), 16)) + n(parseInt(h.slice(3, 5), 16)) + n(parseInt(h.slice(5, 7), 16));
}

/**
 * Render one customBlock as a real Scratch block inside `ws` (a hidden
 * workspace) and return the wrapped SVG string. Module-level so both the
 * modal preview and the builder-panel preview can reuse it.
 */
function renderCustomBlockToSvg(ws, cb, idx) {
    if (!ws || !cb) return '';
    const B = window._extBuilderBlockly || window.Blockly;
    if (!B || !B.Blocks) return '';
    const name = cb.name || ('我的积木 ' + ((idx || 0) + 1));
    const fields = Array.isArray(cb.fields) ? cb.fields : [];

    // Build message template + args from the fields
    let message0 = '%1';
    const args0 = [{type: 'field_label', text: name, name: 'NAME'}];
    fields.forEach(function (f, fi) {
        if (!f) return;
        const ftype = f.kind || 'text';
        const textIdx = (fi * 2) + 2;
        const inputIdx = (fi * 2) + 3;
        if (ftype === 'label') {
            args0.push({type: 'field_label', text: f.text || '', name: 'TXT' + fi});
            message0 += ' %' + textIdx;
        } else {
            args0.push({type: 'field_label', text: f.text || '', name: 'TXT' + fi});
            if (ftype === 'number') {
                args0.push({type: 'field_number', value: Number(f.default) || 0, name: 'FLD' + fi, precision: 1});
            } else if (ftype === 'boolean') {
                args0.push({type: 'field_dropdown', options: [['是','true'],['否','false']], name: 'FLD' + fi});
            } else {
                args0.push({type: 'field_input', text: f.default || f.text || '', name: 'FLD' + fi});
            }
            message0 += ' %' + textIdx + ' %' + inputIdx;
        }
    });

    // Choose the scratch block shape + colour by blockType
    let shapeDef = {colour: 344, id: 'C'};
    if (cb.blockType === 'reporter') shapeDef = {colour: 270, output: 'Number'};
    else if (cb.blockType === 'Boolean') shapeDef = {colour: 270, output: 'Boolean'};
    else if (cb.blockType === 'hat') shapeDef = {colour: 45, id: 'HAT'};
    // 用户自定义积木颜色覆盖默认色（与 block_define 工作区 / 导出代码一致）
    if (cb.colour) shapeDef.colour = cb.colour;

    const previewType = (cb.id || ('b' + idx)) + '__preview';
    // Force re-registration so shape / fields changes are reflected live.
    if (B.Blocks[previewType]) B.Blocks[previewType] = null;
    B.Blocks[previewType] = {
        init: function () {
            const opts = JSON.parse(JSON.stringify({
                message0: message0,
                args0: args0
            }));
            opts.colour = shapeDef.colour;
            if (shapeDef.output !== undefined) opts.output = shapeDef.output;
            opts['id'] = shapeDef.id || 'C';
            if (shapeDef.id === 'HAT') {
                delete opts.previousStatement;
                // shape_hat extension will create the nextConnection via
                // setNextStatement(true). Don't pre-set it to null or
                // setNextStatement(false) — that would remove the
                // connection and break the top-hat shape.
                opts.extensions = ['shape_hat'];
            } else if (shapeDef.output !== undefined) {
                delete opts.previousStatement;
                delete opts.nextStatement;
            } else {
                opts.previousStatement = null;
                opts.nextStatement = null;
            }
            this.jsonInit(opts);
            if (shapeDef.id === 'HAT' && this.setInputsInline) {
                this.setInputsInline(true);
            }
            if (this.outputConnection) {
                let s = null;
                if (shapeDef.output === 'Boolean') s = 1;
                else if (shapeDef.output === 'Number' || shapeDef.output === 'String') s = 2;
                if (s !== null && this.setOutputShape) this.setOutputShape(s);
            }
        }
    };

    try {
        const b = ws.newBlock(previewType);
        b.initSvg();
        b.moveBy(8, 8);
        b.render();
        const draggable = b.getSvgRoot().querySelector('.blocklyDraggable') || b.getSvgRoot();
        let innerXml = draggable.outerHTML;
        innerXml = innerXml.replace(/ transform="translate\([^)]*\)"/, '');
        let w = 100, h = 40;
        try {
            const bbox = draggable.getBBox();
            w = bbox.width;
            h = bbox.height;
        } catch (e) { /* bbox may fail on hidden svg */ }
        // For hat blocks, the top-hat curve extends into negative y (the
        // START_HAT_PATH control points are y=-22) but getBBox ignores it,
        // so the visible SVG box clips the curve. Wrap the inner SVG with
        // a viewBox that includes the negative-y range and shift the
        // group down by the hat height so the curve becomes visible.
        let hatPad = 0;
        if (shapeDef.id === 'HAT') {
            hatPad = 22;
            innerXml = innerXml.replace(
                /<g class="blocklyDraggable"([^>]*)>/,
                '<g class="blocklyDraggable"$1 transform="translate(0,' + hatPad + ')">'
            );
            // bump the path inside so its origin moves down too
            innerXml = innerXml.replace(
                /<path class="blocklyPath"/,
                '<path transform="translate(0,' + hatPad + ')" class="blocklyPath"'
            );
            // Adjust the left/top notch indicators if present
            innerXml = innerXml.replace(
                /<g class="blocklyResizeSE"/,
                '<g transform="translate(0,' + hatPad + ')" class="blocklyResizeSE"'
            );
        }
        const wrapped =
            '<svg width="' + Math.ceil(w) + '" height="' + Math.ceil(h + hatPad) +
            '" xmlns="http://www.w3.org/2000/svg" class="blockly-svg">' +
            innerXml + '</svg>';
        b.dispose(false);
        return wrapped;
    } catch (e) {
        return '';
    }
}

export default ExtensionBuilder;