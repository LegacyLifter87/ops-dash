// ---------------------------------------------------------------------------
// store.js — Ops Dash state: auth, tenant (seo_accounts/seo_members), and the
// account-scoped SEO (Google Search Console) wrappers. Shares the Supabase
// project with Job Tracker but its own tenant model. Tokens never touch the
// browser — all GSC work goes through the seo-gsc edge function.
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { useState, useEffect } from './lib.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- tiny pub/sub store -----------------------------------------------------
const listeners = new Set();
let state = { phase: 'loading', session: null, user: null, accounts: [], activeAccountId: null, error: '' };
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useStore() {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((n) => n + 1)), []);
  return state;
}

// --- active account ---------------------------------------------------------
export function getActiveAccountId() { return state.activeAccountId; }
export function activeAccount() { return state.accounts.find((a) => a.id === state.activeAccountId) || null; }
export function setActiveAccount(id) { try { localStorage.setItem('ops_active_account', id); } catch { /* ignore */ } set({ activeAccountId: id }); }

// --- auth / session ---------------------------------------------------------
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  await applySession(session);
  supabase.auth.onAuthStateChange((_e, s) => { applySession(s); });
}
async function applySession(session) {
  if (!session) { set({ phase: 'login', session: null, user: null, accounts: [], activeAccountId: null }); return; }
  set({ session, user: session.user });
  await loadAccounts();
}
export async function loadAccounts() {
  const { data, error } = await supabase.from('seo_accounts').select('*').order('created_at');
  if (error) { set({ phase: 'app', accounts: [], error: error.message }); return; }
  const accounts = data || [];
  let active = null;
  try { active = localStorage.getItem('ops_active_account'); } catch { /* ignore */ }
  if (!accounts.some((a) => a.id === active)) active = accounts[0]?.id || null;
  set({ phase: 'app', accounts, activeAccountId: active, error: '' });
}
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: (email || '').trim(), password });
  if (error) throw new Error(error.message);
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email: (email || '').trim(), password });
  if (error) throw new Error(error.message);
  return data; // data.session is null when email confirmation is required
}
export async function signOut() { await supabase.auth.signOut(); }
export function getUserEmail() { return state.user?.email || ''; }

// --- account provisioning (service-role fn: bootstraps past RLS) ------------
async function opsInvoke(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('ops-accounts', { body: { action, ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function createAccount(name) {
  const r = await opsInvoke('create_account', { name: (name || '').trim() });
  await loadAccounts();
  if (r.account) setActiveAccount(r.account.id);
  return r.account;
}

// --- SEO / Google Search Console (account-scoped) ---------------------------
async function seoInvoke(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-gsc', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoStatus = () => seoInvoke('status');
export const seoConnect = () => seoInvoke('connect');
export const seoDisconnect = () => seoInvoke('disconnect');
export const seoAddSite = (property, displayName) => seoInvoke('add_site', { property, displayName });
export const seoRemoveSite = (siteId) => seoInvoke('remove_site', { siteId });
export const seoSync = (siteId) => seoInvoke('sync', siteId ? { siteId } : {});
export async function seoLoadData(siteId) {
  if (!siteId) return { queries: [], pages: [] };
  const [{ data: queries }, { data: pages }] = await Promise.all([
    supabase.from('seo_queries').select('*').eq('site_id', siteId),
    supabase.from('seo_pages').select('*').eq('site_id', siteId),
  ]);
  return { queries: queries || [], pages: pages || [] };
}
export async function seoLoadSites() {
  const aid = getActiveAccountId();
  if (!aid) return [];
  const { data } = await supabase.from('seo_sites').select('*').eq('account_id', aid).order('created_at');
  return data || [];
}
export async function seoLoadKeywords(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_keywords').select('*').eq('site_id', siteId).order('opportunity', { ascending: false });
  return data || [];
}
export const seoKeywordsRebuild = (siteId) => seoInvokeKw('rebuild', siteId ? { siteId } : {});
async function seoInvokeKw(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-keywords', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}

// --- Job Tracker bridge (agency link + analytics pull) ----------------------
async function jtInvoke(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('jt-bridge', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const jtStatus = () => jtInvoke('status');
export const jtAnalytics = () => jtInvoke('analytics');
export const jtListCompanies = () => jtInvoke('list_companies');
export const jtLink = (companyId) => jtInvoke('link', { companyId });
export const jtUnlink = () => jtInvoke('unlink');
export const jtCreateFromCompany = (companyId) => jtInvoke('create_from_company', { companyId });
