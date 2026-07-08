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
export async function seoLoadRankHistory(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_rank_history').select('*').eq('site_id', siteId).order('snapshot_date');
  return data || [];
}
async function seoInvokeAudit(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-audit', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoAuditRun = (siteId) => seoInvokeAudit('crawl', { siteId });
export const seoAuditAi = (siteId, url) => seoInvokeAudit('ai_analyze', { siteId, url });
export const seoAuditSpeed = (siteId, url) => seoInvokeAudit('speed', { siteId, url });
export async function seoLoadAudit(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_audit_pages').select('*').eq('site_id', siteId).order('technical_score');
  return data || [];
}
export const seoKeywordsRebuild = (siteId) => seoInvokeKw('rebuild', siteId ? { siteId } : {});
async function seoInvokeAds(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-ads', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoAdsStatus = () => seoInvokeAds('status');
export const seoAdsEnrich = (siteId) => seoInvokeAds('enrich', siteId ? { siteId } : {});
async function seoInvokeComp(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-competitors', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoCompetitorsDiscover = (siteId) => seoInvokeComp('discover', { siteId });
export const seoCompetitorGap = (siteId, competitor) => seoInvokeComp('gap', { siteId, competitor });
export const seoAddCompetitor = (siteId, domain) => seoInvokeComp('add_competitor', { siteId, domain });
export async function seoLoadCompetitors(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_competitors').select('*').eq('site_id', siteId).order('common_keywords', { ascending: false });
  return data || [];
}
export async function seoLoadGap(siteId, competitor) {
  if (!siteId || !competitor) return [];
  const { data } = await supabase.from('seo_gap_keywords').select('*').eq('site_id', siteId).eq('competitor_domain', competitor).order('volume', { ascending: false });
  return data || [];
}
async function seoInvokeDfs(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-dfs', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoDfsEnrichKeywords = (siteId) => seoInvokeDfs('enrich_keywords', { siteId });
export const seoDfsCheckRanks = (siteId, location) => seoInvokeDfs('check_ranks', { siteId, location });
export const seoDfsBacklinks = (siteId) => seoInvokeDfs('backlinks', { siteId });
export async function seoLoadSerpRanks(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_serp_ranks').select('*').eq('site_id', siteId).order('volume', { ascending: false });
  return data || [];
}
export async function seoLoadBacklinks(siteId) {
  if (!siteId) return null;
  const { data } = await supabase.from('seo_backlinks_summary').select('*').eq('site_id', siteId).maybeSingle();
  return data || null;
}
async function seoInvokeOverview(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-overview', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoOverview = (siteId) => seoInvokeOverview('get', { siteId });
export const seoOverviewAiSummary = (siteId) => seoInvokeOverview('ai_summary', { siteId });
async function seoInvokeGrid(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-geogrid', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoGeogridRun = (siteId, opts) => seoInvokeGrid('run', { siteId, ...opts });
export async function seoLoadGeogrids(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_geogrid').select('*').eq('site_id', siteId).order('created_at', { ascending: false });
  return data || [];
}
// --- Lighthouse (Google PageSpeed Insights) --------------------------------
async function seoInvokeLh(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-lighthouse', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoLighthouseRun = (siteId, opts) => seoInvokeLh('run', { siteId, ...opts });
export const seoLighthouseFixPlan = (siteId, opts) => seoInvokeLh('fix_plan', { siteId, ...opts });
export async function seoLighthouseLoad(siteId) {
  if (!siteId) return [];
  const d = await seoInvokeLh('load', { siteId });
  return d.reports || [];
}
export async function seoSetBrandTerms(siteId, terms) {
  const { error } = await supabase.from('seo_sites').update({ brand_terms: terms }).eq('id', siteId);
  if (error) throw new Error(error.message);
}
export async function seoSetEconomics(margin, leadRate) {
  const aid = getActiveAccountId();
  const { error } = await supabase.from('seo_accounts').update({ assumed_margin: margin, lead_rate: leadRate }).eq('id', aid);
  if (error) throw new Error(error.message);
  await loadAccounts();
}
async function seoInvokeBrief(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-brief', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoBriefGenerate = (siteId, cluster, format) => seoInvokeBrief('generate', { siteId, cluster, format });
export async function seoLoadBriefs(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_briefs').select('*').eq('site_id', siteId).order('created_at', { ascending: false });
  return data || [];
}
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
