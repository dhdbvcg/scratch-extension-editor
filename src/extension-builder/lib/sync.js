/**
 * Extension Builder — 跨站互通（同步链接）
 *
 * 两个部署（例如平台应用与自定义域名，如 sbp_xxx 应用 与 dhdbvcg.cc.cd）
 * 之间，浏览器的 localStorage 彼此隔离，无法直接共享。本模块通过
 * "同步链接"实现登录账号与存档的互通：
 *
 *   1. 在网站 A 点击"生成同步链接" → 把账号凭证 + 全部存档编码进 URL
 *      （形如 .../...#sync=<base64url 数据>）
 *   2. 在网站 B（另一个部署）打开该链接 → 页面自动识别并导入：
 *      账号不存在则直接创建并登录，存档按 id 合并（已存在的不覆盖）。
 *      之后两边各持有一份完整数据，可双向重复同步保持最新。
 *
 * 注意：链接中包含账号凭证与存档数据，请勿公开分享。
 */

import {getUserMeta, importUser, createSession} from './auth.js';
import {listSaves, mergeSaves} from './saves.js';

const SYNC_TAG = 'ebsync1:';

// ---- base64url（UTF-8 安全） ----

function toBase64Url(str) {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
}

// ---- 构建 / 解析 ----

/** 生成同步数据串（不含前缀以外的部分，用于拼进 URL） */
export function buildSyncPayload(username) {
    const user = getUserMeta(username);
    if (!user) throw new Error('用户数据不存在，请先登录');
    const payload = {
        v: 1,
        t: Date.now(),
        site: (typeof location !== 'undefined' && location.hostname) || '',
        user: {
            username,
            salt: user.salt,
            hash: user.hash,
            createdAt: user.createdAt
        },
        saves: listSaves(username)
    };
    return SYNC_TAG + toBase64Url(JSON.stringify(payload));
}

/** 生成完整同步链接（在另一个网站打开即可互通） */
export function buildSyncUrl(username) {
    const payload = buildSyncPayload(username);
    return location.origin + location.pathname + location.search + '#sync=' + payload;
}

/**
 * 从 URL / 用户粘贴的文本中解析同步数据。
 * 支持直接传完整 URL、或 #sync= 之后的字符串。
 * 解析失败返回 null。
 */
export function parseSyncPayload(input) {
    let text = String(input || '').trim();
    if (!text) return null;
    const m = text.match(/#sync=([A-Za-z0-9_-]+)/);
    if (m) text = m[1];
    if (text.indexOf(SYNC_TAG) !== 0) return null;
    try {
        const payload = JSON.parse(fromBase64Url(text.slice(SYNC_TAG.length)));
        if (!payload || payload.v !== 1 || !payload.user || !payload.user.username) {
            return null;
        }
        return payload;
    } catch (e) {
        return null;
    }
}

/**
 * 导入同步数据。
 * 返回 {created, merged, username}：
 *   created: 是否在本站创建了新账号（并自动登录）
 *   merged:  合并进来的存档数量
 */
export function importSyncPayload(payload) {
    if (!payload || !payload.user) return {created: false, merged: 0, username: ''};
    const created = importUser(payload.user);
    // 跨站导入的新账号默认开启自动登录（长期保持）
    if (created) createSession(payload.user.username, true);
    const merged = mergeSaves(payload.user.username, payload.saves || []);
    return {created, merged, username: payload.user.username};
}
