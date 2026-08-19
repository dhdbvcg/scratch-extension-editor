/**
 * Supabase 云端配置
 *
 * 在 https://supabase.com 免费创建项目后，把下面两个值替换为你的项目凭证：
 *   1. Project URL      （Settings → API → Project URL）
 *   2. anon public key  （Settings → API → anon public）
 *
 * 然后在 Supabase 控制台 SQL Editor 执行（建两张表 + RLS）：
 * ---------------------------------------------------------------
 * create table if not exists public.ext_users (
 *   username text primary key,
 *   salt text not null default '',
 *   hash text not null default '',
 *   email text,
 *   provider text not null default 'local',
 *   created_at bigint not null default 0
 * );
 *
 * create table if not exists public.ext_saves (
 *   id text primary key,
 *   username text not null,
 *   name text not null default '',
 *   updated_at bigint not null default 0,
 *   data jsonb not null default '{}'::jsonb
 * );
 * create index if not exists ext_saves_user_idx on public.ext_saves (username);
 *
 * -- 好友 / 关注关系表（关注 = follower 关注 followee 一条记录；
 * -- 互相关注 = 同时存在 A→B 与 B→A，即"好友"）
 * create table if not exists public.ext_friends (
 *   follower text not null,
 *   followee text not null,
 *   created_at bigint not null default 0,
 *   primary key (follower, followee)
 * );
 * create index if not exists ext_friends_follower_idx on public.ext_friends (follower);
 * create index if not exists ext_friends_followee_idx on public.ext_friends (followee);
 *
 * alter table public.ext_users enable row level security;
 * alter table public.ext_saves enable row level security;
 * alter table public.ext_friends enable row level security;
 * create policy "ext_users all" on public.ext_users for all using (true);
 * create policy "ext_saves all" on public.ext_saves for all using (true);
 * create policy "ext_friends all" on public.ext_friends for all using (true);
 * ---------------------------------------------------------------
 */

// Supabase 项目凭证（项目：1qw2we3er4rt's Project @ ap-northeast-2）
export const SUPABASE_URL = 'https://hbndheyywwinwezoekyd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibmRoZXl5d3dpbndlem9la3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDE0MzMsImV4cCI6MjEwMDExNzQzM30.V01oah5J16cfB0GpfCxueERo5dGczFI-OzVQCvWeoMY';

/** 云端同步是否开启 */
export const CLOUD_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
