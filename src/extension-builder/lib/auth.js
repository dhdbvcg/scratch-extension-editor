/**
 * Extension Builder — 登录账号系统
 *
 * 基于 localStorage 的轻量账号管理（注册 / 登录 / 登出 / 会话）。
 * 密码使用 SHA-256 加盐哈希存储，不保存明文。
 * 在非 HTTPS 环境（crypto.subtle 不可用）自动回退到确定性哈希，
 * 保证任何部署环境（http / https / localhost）都能正常工作。
 */

const USERS_KEY = 'extbuilder_users';
const SESSION_KEY = 'extbuilder_session';
const PREV_SESSION_KEY = 'extbuilder_prev_session'; // 切换账号时记住上一个会话
const SESSION_DAYS = 30;

import {cloudAvailable, cloudUpsertUser, cloudFetchUsers} from './cloud.js';

// ---- 哈希 ----

function sha256Hex(text) {
    // 优先使用 Web Crypto（仅安全上下文可用，https / localhost）
    if (typeof window !== 'undefined' && window.crypto &&
            window.crypto.subtle && window.crypto.subtle.digest) {
        return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
            .then((buf) => {
                const bytes = new Uint8Array(buf);
                let hex = '';
                for (let i = 0; i < bytes.length; i++) {
                    hex += bytes[i].toString(16).padStart(2, '0');
                }
                return hex;
            })
            .catch(() => fallbackHash(text));
    }
    return Promise.resolve(fallbackHash(text));
}

// 回退哈希：FNV-1a 变体双通道，确定性输出 64 位 hex
function fallbackHash(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < text.length; i++) {
            const ch = text.charCodeAt(i);
            h1 ^= ch;
            h1 = Math.imul(h1, 0x01000193);
            h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
        }
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') +
           (h2 >>> 0).toString(16).padStart(8, '0');
}

// ---- 存储 ----

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function setUsers(users) {
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
        // 存储空间不足等，忽略
    }
}

function makeToken() {
    return Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36);
}

// ---- 会话 ----

/**
 * 为用户建立会话并写入存储，返回会话对象。
 * @param {string} username 用户名
 * @param {boolean} [remember] 是否"自动登录/记住我"：
 *   - true（默认）：写入 localStorage，30 天有效，刷新/重开浏览器都保持登录
 *   - false：写入 sessionStorage，仅当前浏览器会话有效，关闭标签页后失效
 * 同步链接导入新账号时也会用到。
 */
export function createSession(username, remember) {
    const session = {
        username,
        token: makeToken(),
        remember: !!remember,
        expires: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
    };
    try {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        // 忽略（存储不可用时会话不持久）
    }
    return session;
}

export function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !s.username) return null;
        if (s.expires && s.expires < Date.now()) {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        if (!getUsers()[s.username]) {
            // 账号已被删除则强制退出
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        return s;
    } catch (e) {
        return null;
    }
}

export function logout() {
    try {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
        // 忽略
    }
}

// ---- 注册 / 登录 ----

export function register(username, password, remember, captchaToken) {
    const name = String(username || '').trim();
    if (name.length < 2) return Promise.reject(new Error('用户名至少需要 2 个字符'));
    if (!password || String(password).length < 4) {
        return Promise.reject(new Error('密码至少需要 4 个字符'));
    }
    // hCaptcha 验证：注册时必须提供有效 token（客户端基本校验，防止空提交）
    if (!captchaToken || typeof captchaToken !== 'string' || captchaToken.length < 10) {
        return Promise.reject(new Error('请完成人机验证'));
    }
    const users = getUsers();
    if (users[name]) return Promise.reject(new Error('该用户名已被注册，请直接登录'));
    const salt = makeToken();
    return sha256Hex(salt + '::' + password).then((hash) => {
        users[name] = {salt, hash, createdAt: Date.now()};
        setUsers(users);
        // 云端备份账号（失败不阻断本地注册，静默降级）
        if (cloudAvailable()) {
            cloudUpsertUser({username: name, ...users[name]}).catch(e => console.warn('[Cloud] 账号上传失败:', e.message));
        }
        return createSession(name, remember);
    });
}

export function login(username, password, remember) {
    const name = String(username || '').trim();
    const users = getUsers();
    let u = users[name];
    if (!u && cloudAvailable()) {
        // 本地无此账号 → 尝试从云端拉取（支持多设备首次登录）
        return cloudFetchUsers().then((cloudUsers) => {
            const cu = cloudUsers.find(c => c.username === name);
            if (!cu) return Promise.reject(new Error('用户不存在，请先注册'));
            // 拉取成功后写入本地缓存
            const cached = getUsers();
            cached[name] = {
                salt: cu.salt,
                hash: cu.hash,
                createdAt: cu.createdAt || Date.now(),
                provider: cu.provider || 'local',
                email: cu.email
            };
            setUsers(cached);
            u = cached[name];
            return sha256Hex(u.salt + '::' + password).then((hash) => {
                if (hash !== u.hash) return Promise.reject(new Error('密码错误'));
                return createSession(name, remember);
            });
        });
    }
    if (!u) return Promise.reject(new Error('用户不存在，请先注册'));
    return sha256Hex(u.salt + '::' + password).then((hash) => {
        if (hash !== u.hash) return Promise.reject(new Error('密码错误'));
        return createSession(name, remember);
    });
}

// ---- 供同步链接使用 ----

export function getUserMeta(username) {
    return getUsers()[username] || null;
}

/**
 * 从同步链接导入账号（仅当本地不存在该用户名时创建）。
 * 已存在的账号不会被覆盖，密码保持本地版本。
 * 返回 true 表示新建了账号。
 */
export function importUser(meta) {
    if (!meta || !meta.username || !meta.salt || !meta.hash) return false;
    const users = getUsers();
    if (users[meta.username]) return false;
    users[meta.username] = {
        salt: meta.salt,
        hash: meta.hash,
        createdAt: meta.createdAt || Date.now()
    };
    setUsers(users);
    return true;
}

// ---- 切换账号（记住上一个会话，支持一键切回） ----

/**
 * 保存当前会话为"上一个会话"（切换/退出前调用）。
 */
export function savePrevSession(s) {
    try {
        if (s && s.username) {
            localStorage.setItem(PREV_SESSION_KEY, JSON.stringify(s));
        }
    } catch (e) { /* silent */ }
}

/**
 * 读取上一个会话（用于"一键切回"）。
 */
export function getPrevSession() {
    try {
        const raw = localStorage.getItem(PREV_SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !s.username) return null;
        // 检查是否过期
        if (s.expires && s.expires < Date.now()) {
            clearPrevSession();
            return null;
        }
        return s;
    } catch (e) { return null; }
}

/**
 * 清除上一个会话。
 */
export function clearPrevSession() {
    try {
        localStorage.removeItem(PREV_SESSION_KEY);
    } catch (e) { /* silent */ }
}

/**
 * 一键切回到上一个会话：恢复 session 到当前登录状态。
 * 返回恢复的会话对象；失败返回 null。
 */
export function switchToPrevSession() {
    const prev = getPrevSession();
    if (!prev) return null;
    // 先退出当前
    logout();
    // 恢复上一个
    createSession(prev.username, prev.remember);
    return getSession();
}
