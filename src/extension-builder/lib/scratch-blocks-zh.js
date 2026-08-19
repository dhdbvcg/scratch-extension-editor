/**
 * Chinese (Simplified) translations for scratch-blocks built-in messages.
 *
 * Maps every Blockly.Msg key from node_modules/scratch-blocks/msg/messages.js
 * to its Chinese equivalent based on official Scratch 3.0 Chinese locale.
 *
 * Usage: import and call applyZhTranslations() BEFORE Blockly.inject().
 */

/**
 * Apply all Chinese translations to Blockly.Msg.
 * Must be called after scratch-blocks is loaded but before workspace inject.
 */
export function applyZhTranslations(Blockly) {
    if (!Blockly) return;

    // 1. Fix the "Make a Block" callback that throws "External procedure editor
    // must be override Blockly.Procedures.externalProcedureDefCallback". Provide
    // a no-op callback so clicking the button does nothing — the user can still
    // drag our pre-defined积木 from 事件/控制/运算 etc. categories.
    if (Blockly.Procedures && !Blockly.Procedures.externalProcedureDefCallback) {
        Blockly.Procedures.externalProcedureDefCallback = function () {};
    }

    // 2. Override extension block definitions (the few extension_xxx blocks whose
    // message0 strings are hardcoded in extensions.js and not in messages.js).
    overrideExtensionBlocks(Blockly);

    if (!Blockly.Msg) return;
    const Msg = Blockly.Msg;

    // ===================================================
    // Block & UI Messages — from scratch-l10n zh-cn.json
    // Source: https://github.com/LLK/scratch-l10n
    // ===================================================

    // Category labels
    Msg.CATEGORY_MOTION = '运动';
    Msg.CATEGORY_LOOKS = '外观';
    Msg.CATEGORY_SOUND = '声音';
    Msg.CATEGORY_EVENTS = '事件';
    Msg.CATEGORY_CONTROL = '控制';
    Msg.CATEGORY_SENSING = '侦测';
    Msg.CATEGORY_OPERATORS = '运算';
    Msg.CATEGORY_VARIABLES = '变量';
    Msg.CATEGORY_MYBLOCKS = '自制积木';

    // Motion
    Msg.MOTION_MOVESTEPS = '移动 %1 步';
    Msg.MOTION_TURNLEFT = '左转 %1 %2 度';
    Msg.MOTION_TURNRIGHT = '右转 %1 %2 度';
    Msg.MOTION_POINTINDIRECTION = '面向 %1 方向';
    Msg.MOTION_POINTTOWARDS = '面向 %1';
    Msg.MOTION_POINTTOWARDS_POINTER = '鼠标指针';
    Msg.MOTION_POINTTOWARDS_RANDOM = '随机方向';
    Msg.MOTION_GOTO = '移到 %1';
    Msg.MOTION_GOTO_POINTER = '鼠标指针';
    Msg.MOTION_GOTO_RANDOM = '随机位置';
    Msg.MOTION_GOTOXY = '移到 x: %1 y: %2';
    Msg.MOTION_GLIDESECSTOXY = '在 %1 秒内滑行到 x: %2 y: %3';
    Msg.MOTION_GLIDETO = '在 %1 秒内滑行到 %2';
    Msg.MOTION_GLIDETO_POINTER = '鼠标指针';
    Msg.MOTION_GLIDETO_RANDOM = '随机位置';
    Msg.MOTION_CHANGEXBY = '将x坐标增加 %1';
    Msg.MOTION_SETX = '将x坐标设为 %1';
    Msg.MOTION_CHANGEYBY = '将y坐标增加 %1';
    Msg.MOTION_SETY = '将y坐标设为 %1';
    Msg.MOTION_IFONEDGEBOUNCE = '碰到边缘就反弹';
    Msg.MOTION_SETROTATIONSTYLE = '将旋转方式设为 %1';
    Msg.MOTION_SETROTATIONSTYLE_LEFTRIGHT = '左右翻转';
    Msg.MOTION_SETROTATIONSTYLE_DONTROTATE = '不可旋转';
    Msg.MOTION_SETROTATIONSTYLE_ALLAROUND = '任意旋转';
    Msg.MOTION_XPOSITION = 'x 坐标';
    Msg.MOTION_YPOSITION = 'y 坐标';
    Msg.MOTION_DIRECTION = '方向';
    Msg.MOTION_SCROLLRIGHT = '向右滚动 %1';
    Msg.MOTION_SCROLLUP = '向上滚动 %1';
    Msg.MOTION_ALIGNSCENE = '和场景 %1 对齐';
    Msg.MOTION_ALIGNSCENE_BOTTOMLEFT = '左下角';
    Msg.MOTION_ALIGNSCENE_BOTTOMRIGHT = '右下角';
    Msg.MOTION_ALIGNSCENE_MIDDLE = '中间';
    Msg.MOTION_ALIGNSCENE_TOPLEFT = '左上角';
    Msg.MOTION_ALIGNSCENE_TOPRIGHT = '右上角';
    Msg.MOTION_XSCROLL = 'x滚动位置';
    Msg.MOTION_YSCROLL = 'y滚动位置';
    Msg.MOTION_STAGE_SELECTED = '选中了舞台：不可使用运动类积木';

    // Looks
    Msg.LOOKS_SAYFORSECS = '说 %1 %2 秒';
    Msg.LOOKS_SAY = '说 %1';
    Msg.LOOKS_HELLO = '你好！';
    Msg.LOOKS_THINKFORSECS = '思考 %1 %2 秒';
    Msg.LOOKS_THINK = '思考 %1';
    Msg.LOOKS_HMM = '嗯……';
    Msg.LOOKS_SHOW = '显示';
    Msg.LOOKS_HIDE = '隐藏';
    Msg.LOOKS_HIDEALLSPRITES = '隐藏所有角色';
    Msg.LOOKS_EFFECT_COLOR = '颜色';
    Msg.LOOKS_EFFECT_FISHEYE = '鱼眼';
    Msg.LOOKS_EFFECT_WHIRL = '漩涡';
    Msg.LOOKS_EFFECT_PIXELATE = '像素化';
    Msg.LOOKS_EFFECT_MOSAIC = '马赛克';
    Msg.LOOKS_EFFECT_BRIGHTNESS = '亮度';
    Msg.LOOKS_EFFECT_GHOST = '虚像';
    Msg.LOOKS_CHANGEEFFECTBY = '将 %1 特效增加 %2';
    Msg.LOOKS_SETEFFECTTO = '将 %1 特效设定为 %2';
    Msg.LOOKS_CLEARGRAPHICEFFECTS = '清除图形特效';
    Msg.LOOKS_CHANGESIZEBY = '将大小增加 %1';
    Msg.LOOKS_SETSIZETO = '将大小设为 %1';
    Msg.LOOKS_SIZE = '大小';
    Msg.LOOKS_CHANGESTRETCHBY = '伸缩%1';
    Msg.LOOKS_SETSTRETCHTO = '设置伸缩为%1 %';
    Msg.LOOKS_SWITCHCOSTUMETO = '换成 %1 造型';
    Msg.LOOKS_NEXTCOSTUME = '下一个造型';
    Msg.LOOKS_SWITCHBACKDROPTO = '换成 %1 背景';
    Msg.LOOKS_GOTOFRONTBACK = '移到最 %1 ';
    Msg.LOOKS_GOTOFRONTBACK_FRONT = '前面';
    Msg.LOOKS_GOTOFRONTBACK_BACK = '后面';
    Msg.LOOKS_GOFORWARDBACKWARDLAYERS = '%1 %2 层';
    Msg.LOOKS_GOFORWARDBACKWARDLAYERS_FORWARD = '前移';
    Msg.LOOKS_GOFORWARDBACKWARDLAYERS_BACKWARD = '后移';
    Msg.LOOKS_BACKDROPNUMBERNAME = '背景 %1';
    Msg.LOOKS_COSTUMENUMBERNAME = '造型 %1';
    Msg.LOOKS_NUMBERNAME_NUMBER = '编号';
    Msg.LOOKS_NUMBERNAME_NAME = '名称';
    Msg.LOOKS_SWITCHBACKDROPTOANDWAIT = '换成 %1 背景并等待';
    Msg.LOOKS_NEXTBACKDROP_BLOCK = '下一个背景';
    Msg.LOOKS_NEXTBACKDROP = '下一个背景';
    Msg.LOOKS_PREVIOUSBACKDROP = '上一个背景';
    Msg.LOOKS_RANDOMBACKDROP = '随机背景';

    // Sound
    Msg.SOUND_PLAY = '播放声音 %1';
    Msg.SOUND_PLAYUNTILDONE = '播放声音 %1 等待播完';
    Msg.SOUND_STOPALLSOUNDS = '停止所有声音';
    Msg.SOUND_SETEFFECTO = '将 %1 音效设为 %2';
    Msg.SOUND_CHANGEEFFECTBY = '将 %1 音效增加 %2';
    Msg.SOUND_CLEAREFFECTS = '清除音效';
    Msg.SOUND_EFFECTS_PITCH = '音调';
    Msg.SOUND_EFFECTS_PAN = '左右平衡';
    Msg.SOUND_CHANGEVOLUMEBY = '将音量增加 %1';
    Msg.SOUND_SETVOLUMETO = '将音量设为 %1%';
    Msg.SOUND_VOLUME = '音量';
    Msg.SOUND_RECORD = '录制…';

    // Events
    Msg.EVENT_WHENFLAGCLICKED = '当 %1 被点击';
    Msg.EVENT_WHENTHISSPRITECLICKED = '当角色被点击';
    Msg.EVENT_WHENSTAGECLICKED = '当舞台被点击';
    Msg.EVENT_WHENTOUCHINGOBJECT = '当该角色碰到 %1';
    Msg.EVENT_WHENBROADCASTRECEIVED = '当接收到 %1';
    Msg.EVENT_WHENBACKDROPSWITCHESTO = '当背景换成 %1';
    Msg.EVENT_WHENGREATERTHAN = '当 %1 > %2';
    Msg.EVENT_WHENGREATERTHAN_TIMER = '计时器';
    Msg.EVENT_WHENGREATERTHAN_LOUDNESS = '响度';
    Msg.EVENT_BROADCAST = '广播 %1';
    Msg.EVENT_BROADCASTANDWAIT = '广播 %1 并等待';
    Msg.EVENT_WHENKEYPRESSED = '当按下 %1 键';
    Msg.EVENT_WHENKEYPRESSED_SPACE = '空格';
    Msg.EVENT_WHENKEYPRESSED_LEFT = '←';
    Msg.EVENT_WHENKEYPRESSED_RIGHT = '→';
    Msg.EVENT_WHENKEYPRESSED_DOWN = '↓';
    Msg.EVENT_WHENKEYPRESSED_UP = '↑';
    Msg.EVENT_WHENKEYPRESSED_ANY = '任意';

    // Control
    Msg.CONTROL_FOREVER = '重复执行';
    Msg.CONTROL_REPEAT = '重复执行 %1 次';
    Msg.CONTROL_IF = '如果 %1 那么';
    Msg.CONTROL_ELSE = '否则';
    Msg.CONTROL_STOP = '停止';
    Msg.CONTROL_STOP_ALL = '全部脚本';
    Msg.CONTROL_STOP_THIS = '这个脚本';
    Msg.CONTROL_STOP_OTHER = '该角色的其他脚本';
    Msg.CONTROL_WAIT = '等待 %1 秒';
    Msg.CONTROL_WAITUNTIL = '等待 %1';
    Msg.CONTROL_REPEATUNTIL = '重复执行直到 %1';
    Msg.CONTROL_WHILE = '当 %1 重复执行';
    Msg.CONTROL_FOREACH = '对于 %2 中的每个 %1';
    Msg.CONTROL_STARTASCLONE = '当作为克隆体启动时';
    Msg.CONTROL_CREATECLONEOF = '克隆 %1';
    Msg.CONTROL_CREATECLONEOF_MYSELF = '自己';
    Msg.CONTROL_DELETETHISCLONE = '删除此克隆体';
    Msg.CONTROL_COUNTER = '计数器';
    Msg.CONTROL_INCRCOUNTER = '计数器加一';
    Msg.CONTROL_CLEARCOUNTER = '计数器归零';
    Msg.CONTROL_ALLATONCE = '所有脚本';

    // Sensing
    Msg.SENSING_TOUCHINGOBJECT = '碰到 %1 ?';
    Msg.SENSING_TOUCHINGOBJECT_POINTER = '鼠标指针';
    Msg.SENSING_TOUCHINGOBJECT_EDGE = '舞台边缘';
    Msg.SENSING_TOUCHINGCOLOR = '碰到颜色 %1 ?';
    Msg.SENSING_COLORISTOUCHINGCOLOR = '颜色 %1 碰到 %2 ?';
    Msg.SENSING_DISTANCETO = '到 %1 的距离';
    Msg.SENSING_DISTANCETO_POINTER = '鼠标指针';
    Msg.SENSING_ASKANDWAIT = '询问 %1 并等待';
    Msg.SENSING_ASK_TEXT = '你叫什么名字？';
    Msg.SENSING_ANSWER = '回答';
    Msg.SENSING_KEYPRESSED = '按下 %1 键?';
    Msg.SENSING_MOUSEDOWN = '按下鼠标?';
    Msg.SENSING_MOUSEX = '鼠标的x坐标';
    Msg.SENSING_MOUSEY = '鼠标的y坐标';
    Msg.SENSING_SETDRAGMODE = '将拖动模式设为 %1';
    Msg.SENSING_SETDRAGMODE_DRAGGABLE = '可拖动';
    Msg.SENSING_SETDRAGMODE_NOTDRAGGABLE = '不可拖动';
    Msg.SENSING_LOUDNESS = '响度';
    Msg.SENSING_LOUD = '响声？';
    Msg.SENSING_TIMER = '计时器';
    Msg.SENSING_RESETTIMER = '计时器归零';
    Msg.SENSING_OF = '%2 的 %1';
    Msg.SENSING_OF_XPOSITION = 'x 坐标';
    Msg.SENSING_OF_YPOSITION = 'y 坐标';
    Msg.SENSING_OF_DIRECTION = '方向';
    Msg.SENSING_OF_COSTUMENUMBER = '造型编号';
    Msg.SENSING_OF_COSTUMENAME = '造型名称';
    Msg.SENSING_OF_SIZE = '大小';
    Msg.SENSING_OF_VOLUME = '音量';
    Msg.SENSING_OF_BACKDROPNUMBER = '背景编号';
    Msg.SENSING_OF_BACKDROPNAME = '背景名称';
    Msg.SENSING_OF_STAGE = '舞台';
    Msg.SENSING_CURRENT = '当前时间的 %1';
    Msg.SENSING_CURRENT_YEAR = '年';
    Msg.SENSING_CURRENT_MONTH = '月';
    Msg.SENSING_CURRENT_DATE = '日';
    Msg.SENSING_CURRENT_DAYOFWEEK = '星期';
    Msg.SENSING_CURRENT_HOUR = '时';
    Msg.SENSING_CURRENT_MINUTE = '分';
    Msg.SENSING_CURRENT_SECOND = '秒';
    Msg.SENSING_DAYSSINCE2000 = '2000年至今的天数';
    Msg.SENSING_USERNAME = '用户名';
    Msg.SENSING_USERID = '用户id';

    // Operators
    Msg.OPERATORS_ADD = '%1 + %2';
    Msg.OPERATORS_SUBTRACT = '%1 - %2';
    Msg.OPERATORS_MULTIPLY = '%1 * %2';
    Msg.OPERATORS_DIVIDE = '%1 / %2';
    Msg.OPERATORS_RANDOM = '在 %1 和 %2 之间取随机数';
    Msg.OPERATORS_GT = '%1 > %2';
    Msg.OPERATORS_LT = '%1 < %2';
    Msg.OPERATORS_EQUALS = '%1 = %2';
    Msg.OPERATORS_AND = '%1 与 %2';
    Msg.OPERATORS_OR = '%1 或 %2';
    Msg.OPERATORS_NOT = '%1 不成立';
    Msg.OPERATORS_JOIN = '连接 %1 和 %2';
    Msg.OPERATORS_JOIN_APPLE = '苹果';
    Msg.OPERATORS_JOIN_BANANA = '香蕉';
    Msg.OPERATORS_LETTEROF = '%2 的第 %1 个字符';
    Msg.OPERATORS_LETTEROF_APPLE = '果';
    Msg.OPERATORS_LENGTH = '%1 的字符数';
    Msg.OPERATORS_CONTAINS = '%1 包含 %2 ?';
    Msg.OPERATORS_MOD = '%1 除以 %2 的余数';
    Msg.OPERATORS_ROUND = '四舍五入 %1';
    Msg.OPERATORS_MATHOP = '%1 %2';
    Msg.OPERATORS_MATHOP_ABS = '绝对值';
    Msg.OPERATORS_MATHOP_FLOOR = '向下取整';
    Msg.OPERATORS_MATHOP_CEILING = '向上取整';
    Msg.OPERATORS_MATHOP_SQRT = '平方根';
    Msg.OPERATORS_MATHOP_SIN = 'sin';
    Msg.OPERATORS_MATHOP_COS = 'cos';
    Msg.OPERATORS_MATHOP_TAN = 'tan';
    Msg.OPERATORS_MATHOP_ASIN = 'asin';
    Msg.OPERATORS_MATHOP_ACOS = 'acos';
    Msg.OPERATORS_MATHOP_ATAN = 'atan';
    Msg.OPERATORS_MATHOP_LN = 'ln';
    Msg.OPERATORS_MATHOP_LOG = 'log';
    Msg.OPERATORS_MATHOP_EEXP = 'e ^';
    Msg.OPERATORS_MATHOP_10EXP = '10 ^';

    // Data / Variables
    Msg.DATA_SETVARIABLETO = '将 %1 设为 %2';
    Msg.DATA_CHANGEVARIABLEBY = '将 %1 增加 %2';
    Msg.DATA_SHOWVARIABLE = '显示变量 %1';
    Msg.DATA_HIDEVARIABLE = '隐藏变量 %1';
    Msg.DATA_ADDTOLIST = '将 %1 加入 %2';
    Msg.DATA_DELETEOFLIST = '删除 %2 的第 %1 项';
    Msg.DATA_DELETEALLOFLIST = '删除 %1 的全部项目';
    Msg.DATA_INSERTATLIST = '在 %3 的第 %2 项前插入 %1';
    Msg.DATA_REPLACEITEMOFLIST = '将 %2 的第 %1 项替换为 %3';
    Msg.DATA_ITEMOFLIST = '%2 的第 %1 项';
    Msg.DATA_ITEMNUMOFLIST = '%2 中第一个 %1 的编号';
    Msg.DATA_LENGTHOFLIST = '%1 的项目数';
    Msg.DATA_LISTCONTAINSITEM = '%1 包含 %2 ?';
    Msg.DATA_SHOWLIST = '显示列表 %1';
    Msg.DATA_HIDELIST = '隐藏列表 %1';
    Msg.DATA_INDEX_ALL = '全部';
    Msg.DATA_INDEX_LAST = '末尾';
    Msg.DATA_INDEX_RANDOM = '随机';

    // Procedures
    Msg.PROCEDURES_DEFINITION = '定义 %1';
    Msg.PROCEDURES_RETURN = '返回 %1';
    Msg.PROCEDURES_TO_REPORTER = '切换为返回值积木';
    Msg.PROCEDURES_TO_STATEMENT = '切换为堆叠积木';
    Msg.PROCEDURES_DOCS = '如何使用返回值';

    // Context menus
    Msg.DUPLICATE = '复制';
    Msg.DELETE = '删除';
    Msg.ADD_COMMENT = '添加注释';
    Msg.REMOVE_COMMENT = '删除注释';
    Msg.DELETE_BLOCK = '删除';
    Msg.DELETE_X_BLOCKS = '删除 %1 积木';
    Msg.DELETE_ALL_BLOCKS = '删除全部 %1 积木？';
    Msg.CLEAN_UP = '整理积木';
    Msg.COLLAPSE_ALL = '折叠所有积木';
    Msg.EXPAND_ALL = '展开所有积木';
    Msg.HELP = '帮助';
    Msg.UNDO = '撤销';
    Msg.REDO = '重做';
    Msg.EDIT_PROCEDURE = '编辑';
    Msg.SHOW_PROCEDURE_DEFINITION = '查看定义';
    Msg.WORKSPACE_COMMENT_DEFAULT_TEXT = '说些什么……';

    // Colour picker
    Msg.COLOUR_HUE_LABEL = '颜色';
    Msg.COLOUR_SATURATION_LABEL = '饱和度';
    Msg.COLOUR_BRIGHTNESS_LABEL = '亮度';

    // Variables UI
    Msg.CHANGE_VALUE_TITLE = '更改变量：';
    Msg.RENAME_VARIABLE = '修改变量名';
    Msg.RENAME_VARIABLE_TITLE = '将所有的「%1」变量名改为：';
    Msg.RENAME_VARIABLE_MODAL_TITLE = '修改变量名';
    Msg.NEW_VARIABLE = '建立一个变量';
    Msg.NEW_VARIABLE_TITLE = '新变量名：';
    Msg.VARIABLE_MODAL_TITLE = '新建变量';
    Msg.VARIABLE_ALREADY_EXISTS = '已经存在名为「%1」的变量。';
    Msg.VARIABLE_ALREADY_EXISTS_FOR_ANOTHER_TYPE = '已经存在一个名为「%1」的变量，其类型为「%2」。';
    Msg.DELETE_VARIABLE_CONFIRMATION = '删除%1处「%2」变量吗？';
    Msg.CANNOT_DELETE_VARIABLE_PROCEDURE = '无法删除变量「%1」，因为函数「%2」的定义中用到了它';
    Msg.DELETE_VARIABLE = '删除变量「%1」';

    // Procedures UI
    Msg.NEW_PROCEDURE = '制作新的积木';
    Msg.PROCEDURE_ALREADY_EXISTS = '已经存在名为「%1」的程序。';
    Msg.PROCEDURE_DEFAULT_NAME = '积木名称';
    Msg.PROCEDURE_USED = '在删除一个积木定义前，请先把该积木从所有使用的地方删除。';

    // Lists UI
    Msg.NEW_LIST = '建立一个列表';
    Msg.NEW_LIST_TITLE = '新的列表名：';
    Msg.LIST_MODAL_TITLE = '新建列表';
    Msg.LIST_ALREADY_EXISTS = '名为 「%1」 的列表已存在。';
    Msg.RENAME_LIST_TITLE = '将所有的「%1」列表改名为：';
    Msg.RENAME_LIST_MODAL_TITLE = '修改列表名';
    Msg.DEFAULT_LIST_ITEM = '东西';
    Msg.DELETE_LIST = '删除「%1」列表';
    Msg.RENAME_LIST = '修改列表名';

    // Broadcast Messages
    Msg.NEW_BROADCAST_MESSAGE = '新消息';
    Msg.NEW_BROADCAST_MESSAGE_TITLE = '新消息的名称：';
    Msg.BROADCAST_MODAL_TITLE = '新消息';
    Msg.DEFAULT_BROADCAST_MESSAGE_NAME = '消息1';
}

/**
 * Override the few scratch-blocks built-in extension blocks whose messages are
 * hardcoded in node_modules/scratch-blocks/blocks_vertical/extensions.js
 * and therefore cannot be translated via Blockly.Msg. We replace each block's
 * init function with a localized version before any block is created.
 */
function overrideExtensionBlocks(Blockly) {
    if (!Blockly.Blocks) return;

    Blockly.Blocks['extension_pen_down'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 落笔',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/pen-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'shape_statement', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_music_drum'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 演奏鼓 %3',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/music-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'},
                    {type: 'input_value', name: 'NUMBER'}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'shape_statement', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_wedo_motor'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 启动电机 %3',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/wedo2-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'},
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'rotate-right.svg', width: 24, height: 24}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'shape_statement', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_wedo_hat'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 当我戴上帽子时',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/wedo2-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'shape_hat', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_wedo_boolean'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 真的吗?',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/wedo2-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'output_boolean', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_wedo_tilt_reporter'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 倾斜角度 %3',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/wedo2-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'},
                    {type: 'input_value', name: 'TILT'}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'output_number', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_wedo_tilt_menu'] = {
        init: function () {
            this.jsonInit({
                message0: '%1',
                args0: [
                    {type: 'field_dropdown', name: 'TILT',
                        options: [
                            ['任意', 'Any'],
                            ['旋转', 'Whirl'],
                            ['南', 'South'],
                            ['倒回', 'Back in time']
                        ]
                    }
                ],
                extensions: ['colours_more', 'output_string']
            });
        }
    };

    Blockly.Blocks['extension_music_reporter'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 嘿，明星',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/music-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'}
                ],
                category: Blockly.Categories.more,
                extensions: ['colours_more', 'output_number', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_microbit_display'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 显示 %3',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/microbit-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'},
                    {type: 'input_value', name: 'MATRIX'}
                ],
                category: Blockly.Categories.pen,
                extensions: ['colours_pen', 'shape_statement', 'scratch_extension']
            });
        }
    };

    Blockly.Blocks['extension_music_play_note'] = {
        init: function () {
            this.jsonInit({
                message0: '%1 %2 演奏音符 %3 %4 拍',
                args0: [
                    {type: 'field_image', src: Blockly.mainWorkspace.options.pathToMedia + 'extensions/music-block-icon.svg', width: 40, height: 40},
                    {type: 'field_vertical_separator'},
                    {type: 'input_value', name: 'NOTE'},
                    {type: 'input_value', name: 'BEATS'}
                ],
                category: Blockly.Categories.pen,
                extensions: ['colours_pen', 'shape_statement', 'scratch_extension']
            });
        }
    };

    // Override the "Extensions" category label (hardcoded in default_toolbox.js
    // and FlyoutExtensionCategoryHeader). The class is added by Blockly and
    // its text content can be replaced.
    if (Blockly.FlyoutExtensionCategoryHeader && Blockly.FlyoutExtensionCategoryHeader.prototype) {
        // Wrap createDom or similar — but the simpler trick is to update text
        // post-render via DOM mutation (handled by translateExtLabels in JSX).
    }
}
