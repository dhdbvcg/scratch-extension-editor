/**
 * Extension Builder — 存档系统
 *
 * 每个账号的存档列表保存在 localStorage（key: extbuilder_saves_<username>）。
 * 一个存档 = 完整项目快照：
 *   - extInfo        扩展元数据（id / 名称 / 颜色 / 图标等）
 *   - customBlocks   积木列表（字段、类型、过滤条件等）
 *   - workspaceXml   Map<blockId, workspace XML> 的普通对象形式
 *   - generatedCode  当前生成的 JS 代码
 */

function savesKey(username) {
    return 'extbuilder_saves_' + username;
}

import {cloudAvailable, cloudUpsertSave, cloudDeleteSave, cloudFetchSaves} from './cloud.js';

function readList(username) {
    try {
        const raw = localStorage.getItem(savesKey(username));
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function writeList(username, list) {
    try {
        localStorage.setItem(savesKey(username), JSON.stringify(list));
    } catch (e) {
        // 存储空间不足等，忽略
    }
}

/** 按更新时间倒序返回该账号的所有存档 */
export function listSaves(username) {
    return readList(username).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** 从云端拉取存档并合并到本地（云端有则覆盖本地缺失项，按 id 去重，云端优先） */
export async function syncSavesFromCloud(username) {
    if (!username || !cloudAvailable()) return listSaves(username);
    try {
        const cloudSaves = await cloudFetchSaves(username);
        if (!Array.isArray(cloudSaves) || !cloudSaves.length) return listSaves(username);
        const local = readList(username);
        const localMap = new Map(local.map(s => [s.id, s]));
        cloudSaves.forEach(cs => {
            const ls = localMap.get(cs.id);
            // 云端更新时间更新则覆盖本地；本地不存在则新增
            if (!ls || (cs.updatedAt || 0) > (ls.updatedAt || 0)) {
                localMap.set(cs.id, {
                    id: cs.id,
                    name: cs.name || '存档',
                    updatedAt: cs.updatedAt || Date.now(),
                    data: cs.data || {}
                });
            }
        });
        const merged = Array.from(localMap.values());
        writeList(username, merged);
        return merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (e) {
        console.warn('[Cloud] 拉取存档失败:', e.message);
        return listSaves(username);
    }
}

/** 新建或覆盖一个存档（按 id 匹配） */
export function saveProject(username, save) {
    if (!username || !save) return null;
    const list = readList(username);
    const idx = list.findIndex(s => s.id === save.id);
    const entry = {
        id: save.id || ('save_' + Date.now()),
        name: save.name || ('存档 ' + new Date().toLocaleString()),
        updatedAt: Date.now(),
        data: save.data || {}
    };
    if (idx >= 0) {
        list[idx] = entry;
    } else {
        list.unshift(entry);
    }
    writeList(username, list);
    // 云端备份存档（失败不阻断，静默降级）
    if (cloudAvailable()) {
        cloudUpsertSave(username, entry).catch(e => console.warn('[Cloud] 存档上传失败:', e.message));
    }
    return entry;
}

export function deleteSave(username, id) {
    if (!username || !id) return;
    writeList(username, readList(username).filter(s => s.id !== id));
    // 云端删除（失败不阻断）
    if (cloudAvailable()) {
        cloudDeleteSave(username, id).catch(e => console.warn('[Cloud] 存档删除失败:', e.message));
    }
}

/**
 * 合并来自其他站点的存档（按 id 去重，本地已存在的跳过、不覆盖）。
 * 返回新增存档数量。
 */
export function mergeSaves(username, incoming) {
    if (!username || !Array.isArray(incoming)) return 0;
    const list = readList(username);
    const have = new Set(list.map(s => s.id));
    let added = 0;
    incoming.forEach(s => {
        if (!s || !s.id || have.has(s.id)) return;
        list.push({
            id: s.id,
            name: s.name || '存档',
            updatedAt: s.updatedAt || Date.now(),
            data: s.data || {}
        });
        have.add(s.id);
        added++;
    });
    if (added) writeList(username, list);
    return added;
}

/** 把一个存档导出为 JSON 文件下载 */
export function exportSaveFile(save) {
    const blob = new Blob(
        [JSON.stringify({type: 'extbuilder-save', version: 1, ...save}, null, 2)],
        {type: 'application/json'}
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (save.name || '存档').replace(/[\\/:*?"<>|]/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** 解析导入的存档 JSON 文本 */
export function parseSaveFileText(text) {
    let obj;
    try {
        obj = JSON.parse(text);
    } catch (e) {
        throw new Error('文件不是有效的 JSON');
    }
    if (!obj || typeof obj !== 'object' || !obj.data) {
        throw new Error('不是有效的扩展存档文件');
    }
    return obj;
}

/** 把组件当前状态收集成可持久化的项目快照 */
export function collectProjectState({extInfo, customBlocks, workspaceXmlMap, generatedCode}) {
    const xml = {};
    if (workspaceXmlMap && typeof workspaceXmlMap.forEach === 'function') {
        workspaceXmlMap.forEach((v, k) => {
            xml[k] = v;
        });
    }
    return {
        version: 1,
        extInfo: extInfo || {},
        customBlocks: Array.isArray(customBlocks) ? customBlocks : [],
        workspaceXml: xml,
        generatedCode: generatedCode || ''
    };
}

/** 把项目快照还原为组件 state 可用的对象 */
export function restoreProjectState(data) {
    const xmlMap = new Map();
    const xml = (data && data.workspaceXml) || {};
    Object.keys(xml).forEach(k => {
        xmlMap.set(k, xml[k]);
    });
    return {
        extInfo: (data && data.extInfo) || {},
        customBlocks: (data && Array.isArray(data.customBlocks)) ? data.customBlocks : [],
        workspaceXmlMap: xmlMap,
        generatedCode: (data && data.generatedCode) || ''
    };
}
