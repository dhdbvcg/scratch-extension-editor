/**
 * Supabase 云端同步层
 *
 * 纯 fetch + anon key 实现（不引入 @supabase/supabase-js 依赖），
 * 供 auth.js（账号）与 saves.js（存档）调用。
 *
 * 设计：本地 localStorage 为即时存储，云端为持久备份。
 * 每次写操作（注册/登录/存档增删改）后同步推送到云端；
 * 读操作优先云端（云端有则拉取），保证多设备一致。
 */

import {SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED} from './supabase-config.js';

function endpoint(path) {
    return SUPABASE_URL + '/rest/v1/' + path;
}

async function request(path, options = {}) {
    const {params, ...rest} = options;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
    const res = await fetch(endpoint(path) + (params || ''), {
        ...rest,
        headers: {...headers, ...((rest && rest.headers) || {})}
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error('云同步失败 (' + res.status + '): ' + body.slice(0, 200));
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

/** 云端是否可用（配置完整且网络可达由调用方按需 try/catch） */
export function cloudAvailable() {
    return CLOUD_ENABLED;
}

// ==================== 账号 ====================

/** 云端 upsert 一个账号（按 username 主键覆盖） */
export async function cloudUpsertUser(user) {
    if (!cloudAvailable()) return null;
    return request('ext_users', {
        method: 'POST',
        headers: {'Prefer': 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify([{
            username: user.username,
            salt: user.salt || '',
            hash: user.hash || '',
            email: user.email || null,
            provider: user.provider || 'local',
            created_at: user.createdAt || Date.now()
        }]),
        params: '?on_conflict=username'
    });
}

/** 从云端拉取所有账号（登录/注册时校验用） */
export async function cloudFetchUsers() {
    if (!cloudAvailable()) return [];
    const rows = await request('ext_users?select=username,salt,hash,email,provider,created_at');
    return Array.isArray(rows) ? rows.map(r => ({
        username: r.username,
        salt: r.salt,
        hash: r.hash,
        email: r.email,
        provider: r.provider,
        createdAt: r.created_at
    })) : [];
}

// ==================== 存档 ====================

/** 云端拉取某用户全部存档 */
export async function cloudFetchSaves(username) {
    if (!cloudAvailable() || !username) return [];
    const rows = await request('ext_saves?username=eq.' + encodeURIComponent(username) +
        '&order=updated_at.desc&select=id,username,name,updated_at,data');
    return Array.isArray(rows) ? rows.map(r => ({
        id: r.id,
        username: r.username,
        name: r.name,
        updatedAt: r.updated_at,
        data: r.data || {}
    })) : [];
}

/** 云端 upsert 一个存档（按 id 主键覆盖） */
export async function cloudUpsertSave(username, save) {
    if (!cloudAvailable() || !username || !save) return null;
    return request('ext_saves', {
        method: 'POST',
        headers: {'Prefer': 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify([{
            id: save.id,
            username,
            name: save.name || '存档',
            updated_at: save.updatedAt || Date.now(),
            data: save.data || {}
        }]),
        params: '?on_conflict=id'
    });
}

/** 云端删除一个存档 */
export async function cloudDeleteSave(username, id) {
    if (!cloudAvailable() || !username || !id) return;
    await request('ext_saves?id=eq.' + encodeURIComponent(id) +
        '&username=eq.' + encodeURIComponent(username), {
        method: 'DELETE'
    });
}

// ==================== 好友 / 关注 ====================

/**
 * 按用户名模糊搜索用户（排除自己），用于"添加好友/关注"时的检索。
 * @returns {Promise<Array<{username:string, createdAt:number}>>}
 */
export async function cloudSearchUsers(query, self) {
    if (!cloudAvailable()) return [];
    const q = String(query || '').trim();
    if (q.length < 1) return [];
    const rows = await request('ext_users?username=ilike.*' + encodeURIComponent(q) +
        '*&select=username,created_at&order=username.asc&limit=20');
    return Array.isArray(rows)
        ? rows
            .filter(r => r.username !== self)
            .map(r => ({username: r.username, createdAt: r.created_at}))
        : [];
}

/**
 * 列出与某用户相关的全部关注关系（我关注的 + 关注我的）。
 * @returns {Promise<Array<{follower:string, followee:string, createdAt:number}>>}
 */
export async function cloudListRelations(username) {
    if (!cloudAvailable() || !username) return [];
    const rows = await request('ext_friends?or=(follower.eq.' +
        encodeURIComponent(username) + ',followee.eq.' + encodeURIComponent(username) +
        ')&select=follower,followee,created_at');
    return Array.isArray(rows) ? rows.map(r => ({
        follower: r.follower,
        followee: r.followee,
        createdAt: r.created_at
    })) : [];
}

/**
 * 关注某人（follower 关注 followee）。重复关注会被主键合并，幂等安全。
 */
export async function cloudFollow(follower, followee) {
    if (!cloudAvailable() || !follower || !followee) return null;
    return request('ext_friends', {
        method: 'POST',
        headers: {'Prefer': 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify([{follower, followee, created_at: Date.now()}]),
        params: '?on_conflict=follower,followee'
    });
}

/**
 * 取消关注 / 移除关系（删除 follower→followee 这一条记录）。
 */
export async function cloudUnfollow(follower, followee) {
    if (!cloudAvailable() || !follower || !followee) return;
    await request('ext_friends?follower=eq.' + encodeURIComponent(follower) +
        '&followee=eq.' + encodeURIComponent(followee), {
        method: 'DELETE'
    });
}
