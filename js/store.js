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
let state = { phase: 'loading', session: null, user: null, accounts: [], activeAccountId: null, error: '', myTabs: null, recovery: false, identity: null, curAgency: null };
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useStore() {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((n) => n + 1)), []);
  return state;
}

// --- agency context (super → agency → business hierarchy) -------------------
// Non-super staff are locked to their own agency. The platform admin (super)
// picks an agency from the console and can back out to "All agencies";
// everything below (account switcher, team, new-business) scopes to it.
export function isSuper() { return !!state.identity?.superAdmin; }
export function getCurrentAgency() { return state.curAgency; }
export function enterAgency(id, name) {
  try { localStorage.setItem('ops_current_agency', JSON.stringify({ id, name })); } catch { /* ignore */ }
  set({ curAgency: { id, name } });
  reconcileActiveAccount();
}
export function exitAgency() {
  try { localStorage.removeItem('ops_current_agency'); } catch { /* ignore */ }
  set({ curAgency: null });
}
// Accounts visible in the current agency context (supers see every account
// via RLS, so filter client-side; everyone else is already scoped by RLS).
export function visibleAccounts() {
  if (state.identity?.superAdmin && state.curAgency) return state.accounts.filter((a) => a.agency_id === state.curAgency.id);
  return state.accounts;
}
function reconcileActiveAccount() {
  const vis = visibleAccounts();
  if (!vis.some((a) => a.id === state.activeAccountId)) {
    const id = vis[0]?.id || null;
    set({ activeAccountId: id });
    loadMyTabs(id);
  }
}
export async function loadIdentity() {
  const uid = state.user?.id;
  if (!uid) return;
  try {
    const [{ data: prof }, { data: staff }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', uid).maybeSingle(),
      supabase.from('seo_agency_users').select('agency_id, role').eq('user_id', uid).maybeSingle(),
    ]);
    const superAdmin = prof?.role === 'overall_admin';
    let agencyName = null;
    if (staff?.agency_id) {
      const { data: ag } = await supabase.from('seo_agencies').select('name').eq('id', staff.agency_id).maybeSingle();
      agencyName = ag?.name || null;
    }
    let cur = null;
    if (superAdmin) {
      try { cur = JSON.parse(localStorage.getItem('ops_current_agency') || 'null'); } catch { cur = null; }
      if (cur && !cur.id) cur = null;
    } else if (staff?.agency_id) {
      cur = { id: staff.agency_id, name: agencyName };
    }
    set({ identity: { superAdmin, staffRole: staff?.role || null, agencyId: staff?.agency_id || null, agencyName }, curAgency: cur });
    reconcileActiveAccount();
  } catch { set({ identity: { superAdmin: false, staffRole: null, agencyId: null, agencyName: null } }); }
}

// --- active account ---------------------------------------------------------
export function getActiveAccountId() { return state.activeAccountId; }
export function activeAccount() { return state.accounts.find((a) => a.id === state.activeAccountId) || null; }
export function setActiveAccount(id) { try { localStorage.setItem('ops_active_account', id); } catch { /* ignore */ } set({ activeAccountId: id }); loadMyTabs(id); }
// Per-member tab access for the active account (null = all tabs). UI-level
// gating only — data access is still enforced by RLS/membership server-side.
export async function loadMyTabs(aid) {
  if (!aid || !state.user) { set({ myTabs: null }); return; }
  try {
    const { data } = await supabase.from('seo_members').select('tab_access').eq('account_id', aid).eq('user_id', state.user.id).maybeSingle();
    set({ myTabs: data?.tab_access || null });
  } catch { set({ myTabs: null }); }
}

// --- auth / session ---------------------------------------------------------
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  await applySession(session);
  supabase.auth.onAuthStateChange((e, s) => {
    if (e === 'PASSWORD_RECOVERY') { set({ recovery: true }); }
    applySession(s);
  });
}
// Recovery-link landing: user arrived via a reset email — set the new password.
export async function completeRecovery(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  set({ recovery: false });
}
export async function forgotPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail((email || '').trim(), { redirectTo: 'https://ops.legacybuilder.app' });
  if (error) throw new Error(error.message);
}
async function applySession(session) {
  if (!session) { set({ phase: 'login', session: null, user: null, accounts: [], activeAccountId: null, identity: null, curAgency: null }); return; }
  set({ session, user: session.user });
  await Promise.all([loadAccounts(), loadIdentity()]);
}
export async function loadAccounts() {
  const { data, error } = await supabase.from('seo_accounts').select('*');
  if (error) { set({ phase: 'app', accounts: [], error: error.message }); return; }
  const accounts = (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  let active = null;
  try { active = localStorage.getItem('ops_active_account'); } catch { /* ignore */ }
  if (!accounts.some((a) => a.id === active)) active = accounts[0]?.id || null;
  set({ phase: 'app', accounts, activeAccountId: active, error: '' });
  loadMyTabs(active);
  reconcileActiveAccount(); // keep the active account inside the agency context (races loadIdentity)
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
  const extra = { name: (name || '').trim() };
  // Super creating inside an entered agency: stamp that agency, not their own.
  if (state.identity?.superAdmin && state.curAgency) extra.agencyId = state.curAgency.id;
  const r = await opsInvoke('create_account', extra);
  await loadAccounts();
  if (r.account) setActiveAccount(r.account.id);
  return r.account;
}
export async function updateAccount(accountId, name) {
  const r = await opsInvoke('update_account', { accountId, name: (name || '').trim() });
  await loadAccounts();
  return r.account;
}
export async function deleteAccount(accountId, confirmName) {
  await opsInvoke('delete_account', { accountId, confirmName });
  await loadAccounts(); // reconciles the active account away from the deleted one
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
export const seoGscBackfill = (siteId) => seoInvoke('backfill', { siteId });
export const seoTrendsAi = (siteId) => seoInvoke('trends_ai', { siteId });
export async function seoLoadMonthly(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_monthly_site').select('*').eq('site_id', siteId).order('month');
  return data || [];
}
export async function seoLoadMonthlyQueries(siteId, sinceMonth) {
  if (!siteId) return [];
  let q = supabase.from('seo_monthly_queries').select('month,query,clicks,impressions,position').eq('site_id', siteId);
  if (sinceMonth) q = q.gte('month', sinceMonth);
  const { data } = await q.limit(10000);
  return data || [];
}
// 12-month history for one specific page (seo_monthly_pages).
export async function seoLoadPageHistory(siteId, page) {
  if (!siteId || !page) return [];
  const { data } = await supabase.from('seo_monthly_pages').select('month,clicks,impressions,ctr,position').eq('site_id', siteId).eq('page', page).order('month');
  return data || [];
}
// Live: top queries driving one page (recent 90 days vs prior 90) via seo-gsc.
export const seoPageQueries = (siteId, page) => seoInvoke('page_queries', { siteId, page });
export async function seoLoadData(siteId) {
  if (!siteId) return { queries: [], pages: [] };
  // The SEO overview only uses the two most recent 28-day windows, but
  // seo_queries/seo_pages accumulate every synced window over time. Scope to the
  // latest two periods and page through the rows so large sites (hundreds of
  // pages / tens of thousands of query rows) aren't silently truncated by the
  // API's row cap — that was capping the Pages list.
  const { data: latest } = await supabase.from('seo_queries').select('period_start').eq('site_id', siteId).order('period_start', { ascending: false }).limit(1);
  const cur = latest?.[0]?.period_start;
  if (!cur) return { queries: [], pages: [] };
  const { data: prevRow } = await supabase.from('seo_queries').select('period_start').eq('site_id', siteId).lt('period_start', cur).order('period_start', { ascending: false }).limit(1);
  const periods = [cur, prevRow?.[0]?.period_start].filter(Boolean);
  const pageAll = async (table) => {
    const out = []; const N = 1000;
    for (let from = 0; ; from += N) {
      const { data, error } = await supabase.from(table).select('*').eq('site_id', siteId).in('period_start', periods).range(from, from + N - 1);
      if (error || !data || !data.length) break;
      out.push(...data);
      if (data.length < N) break;
    }
    return out;
  };
  const [queries, pages] = await Promise.all([pageAll('seo_queries'), pageAll('seo_pages')]);
  return { queries, pages };
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
export const seoAuditDiscover = (siteId) => seoInvokeAudit('discover', { siteId });
export const seoAuditRun = (siteId, urls) => seoInvokeAudit('crawl', { siteId, urls });
export const seoAuditAi = (siteId, url) => seoInvokeAudit('ai_analyze', { siteId, url });
export const seoAuditSpeed = (siteId, url) => seoInvokeAudit('speed', { siteId, url });
export async function seoLoadAudit(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_audit_pages').select('*').eq('site_id', siteId).order('technical_score');
  return data || [];
}
// Site-level SEO health audit (seo-site-audit fn): weighted category scores +
// prioritised findings across the whole crawl, plus robots/sitemap/llms signals.
async function seoInvokeSiteAudit(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-site-audit', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoSiteAuditRun = (siteId) => seoInvokeSiteAudit('run', { siteId });
export const seoSiteAuditLoad = (siteId) => seoInvokeSiteAudit('load', { siteId });
// Site-level fixes pushed through the Connector plugin (needs plugin v1.5.0+):
// robots.txt, XML sitemap, and heading structure.
async function seoInvokeSiteFix(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-site-fix', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoSiteFixStatus = (siteId) => seoInvokeSiteFix('status', { siteId });
export const seoFixRobots = (siteId, opts) => seoInvokeSiteFix('fix_robots', { siteId, ...opts });
export const seoFixSitemap = (siteId) => seoInvokeSiteFix('fix_sitemap', { siteId });
export const seoFixLlms = (siteId, content) => seoInvokeSiteFix('fix_llms', { siteId, content });
export const seoFixHeadings = (siteId, url, renderedH1) => seoInvokeSiteFix('fix_headings', { siteId, url, rendered_h1: renderedH1 });
export const seoKeywordsRebuild = (siteId) => seoInvokeKw('rebuild', siteId ? { siteId } : {});
// Negative keywords: exclude from blogging (auto + manual, any opportunity score)
// and queue for Google Ads campaign-negative push. Match is phrase-level.
export const seoListNegatives = (siteId) => seoInvokeKw('list_negatives', { siteId });
export const seoSetNegative = (siteId, keyword, reason) => seoInvokeKw('set_negative', { siteId, keyword, reason });
export const seoClearNegative = (siteId, keyword) => seoInvokeKw('clear_negative', { siteId, keyword });
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
export const seoGeogridScheduleSave = (siteId, opts) => seoInvokeGrid('schedule_save', { siteId, ...opts });
export const seoGeogridScheduleDelete = (siteId, scheduleId) => seoInvokeGrid('schedule_delete', { siteId, scheduleId });
export async function seoLoadGeogrids(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_geogrid').select('*').eq('site_id', siteId).order('created_at', { ascending: false });
  return data || [];
}
export async function seoLoadGeogridSchedules(siteId) {
  if (!siteId) return [];
  const { data } = await supabase.from('seo_geogrid_schedules').select('*').eq('site_id', siteId).order('created_at');
  return data || [];
}
export async function seoLoadGeogridHistory(siteId, keyword) {
  if (!siteId || !keyword) return [];
  const { data } = await supabase.from('seo_geogrid_history').select('found,total,top3,avg_rank,run_at').eq('site_id', siteId).eq('keyword', keyword).order('run_at');
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
// --- Google Business Profile audit (DataForSEO public profile) --------------
async function seoInvokeGbp(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-gbp', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoGbpAudit = (siteId, opts) => seoInvokeGbp('audit', { siteId, ...opts });
export const seoGbpAiPlan = (siteId) => seoInvokeGbp('ai_plan', { siteId });
export async function seoGbpLoad(siteId) {
  if (!siteId) return null;
  const d = await seoInvokeGbp('load', { siteId });
  return d.report || null;
}
// Owner connection (business.manage) — account-scoped, private performance data.
// Citation builder (DataForSEO SERP discovery + NAP consistency).
async function seoInvokeCit(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-citations', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoCitationsLoad = (siteId) => seoInvokeCit('load', { siteId });
export const seoCitationsSaveProfile = (siteId, profile) => seoInvokeCit('save_profile', { siteId, profile });
export const seoCitationsScan = (siteId) => seoInvokeCit('scan', { siteId });
export const seoCitationsRecheck = (siteId, directoryDomain) => seoInvokeCit('recheck', { siteId, directoryDomain });
export const seoCitationsSetStatus = (siteId, directoryDomain, patch) => seoInvokeCit('set_status', { siteId, directoryDomain, ...patch });
// Facebook Page connection + NAP push (Graph API).
async function seoInvokeFb(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-fb', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoFbStatus = () => seoInvokeFb('fb_status', {});
export const seoFbConnect = () => seoInvokeFb('fb_connect', {});
export const seoFbDisconnect = () => seoInvokeFb('fb_disconnect', {});
export const seoFbPages = () => seoInvokeFb('fb_pages', {});
export const seoFbSelectPage = (pageId) => seoInvokeFb('fb_select_page', { pageId });
export const seoFbGet = () => seoInvokeFb('fb_get', {});
export const seoFbUpdate = (fields) => seoInvokeFb('fb_update', { fields });
// Owner connection (business.manage) — account-scoped, private performance data.
export const seoGbpStatus = () => seoInvokeGbp('gbp_status', {});
export const seoGbpConnect = () => seoInvokeGbp('gbp_connect', {});
export const seoGbpDisconnect = () => seoInvokeGbp('gbp_disconnect', {});
export const seoGbpLocations = () => seoInvokeGbp('gbp_locations', {});
export const seoGbpSelectLocation = (opts) => seoInvokeGbp('gbp_select_location', opts);
export const seoGbpMetrics = () => seoInvokeGbp('gbp_metrics', {});
// Write-back to Google Business Profile (Business Information API).
async function seoInvokeGbpWrite(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-gbp-write', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoGbpGetLocation = () => seoInvokeGbpWrite('gbp_get_location', {});
export const seoGbpUpdate = (fields) => seoInvokeGbpWrite('gbp_update', { fields });
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
// target = { cluster } for a topic cluster, or { keyword } for a single keyword.
export const seoBriefResearch = (siteId, target) => seoInvokeBrief('research', { siteId, ...target });
export const seoBriefGenerate = (siteId, target, format, sources) => seoInvokeBrief('generate', { siteId, ...target, format, sources });
export const seoBriefRefine = (siteId, key, sources) => seoInvokeBrief('refine', { siteId, key, sources });
// --- WordPress execution engine (Ops Dash Connector plugin on client sites) ---
async function seoInvokeWp(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-wp', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoWpConnect = (siteId, wpUrl) => seoInvokeWp('connect', { siteId, wpUrl });
// Pairing flow: mint a short-lived 8-char code; the WP plugin exchanges it for
// the real key itself (seo-wp-pair), so no human ever copies the long key.
export const seoWpPairStart = (siteId, wpUrl) => seoInvokeWp('pair_start', { siteId, wpUrl });
export const seoWpStatus = (siteId) => seoInvokeWp('status', { siteId });
export const seoWpPublish = (siteId, key, mode, featuredImageUrl, imageSource) => seoInvokeWp('publish', { siteId, key, mode, featuredImageUrl, imageSource });
export const seoWpSuggestMeta = (siteId, url) => seoInvokeWp('suggest_meta', { siteId, url });
// action ∈ fix_meta | fix_schema | fix_alts | fix_h1 | fix_canonical — one page per call.
export const seoWpFix = (siteId, action, url) => seoInvokeWp(action, { siteId, url });
export const seoWpUpdateSeo = (siteId, target) => seoInvokeWp('update_seo', { siteId, ...target });
export const seoWpDisconnect = (siteId) => seoInvokeWp('disconnect', { siteId });
// --- Google Ads reporting (account-scoped; per-client OAuth) ---
async function seoInvokeAds(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-ads', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoAdsStatus = () => seoInvokeAds('ads_status');
export const seoAdsConnect = () => seoInvokeAds('ads_connect');
export const seoAdsCustomers = () => seoInvokeAds('ads_customers');
export const seoAdsSelectCustomer = (c) => seoInvokeAds('ads_select_customer', c);
export const seoAdsSync = () => seoInvokeAds('ads_sync');
export const seoAdsDisconnect = () => seoInvokeAds('ads_disconnect');
// BYO developer token (agency only). Default is the shared platform token.
export const seoAdsSetDevToken = (token, label) => seoInvokeAds('ads_set_dev_token', { token, label });
export const seoAdsClearDevToken = () => seoInvokeAds('ads_clear_dev_token');
// --- Google Analytics 4 reporting (account-scoped; per-client OAuth) ---
async function seoInvokeGa(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-ga', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoGaStatus = () => seoInvokeGa('ga_status');
export const seoGaConnect = () => seoInvokeGa('ga_connect');
export const seoGaProperties = () => seoInvokeGa('ga_properties');
export const seoGaSelectProperty = (p) => seoInvokeGa('ga_select_property', p);
export const seoGaSync = (extra) => seoInvokeGa('ga_sync', extra);
export const seoGaSetRange = (rangeDays) => seoInvokeGa('ga_set_range', { rangeDays });
export const seoGaInsights = () => seoInvokeGa('ga_insights');
export const seoGaDisconnect = () => seoInvokeGa('ga_disconnect');
// Edit a generated article before it goes to WordPress (RLS: admins/agency).
export async function seoBriefSave(siteId, key, patch) {
  const { error } = await supabase.from('seo_briefs').update(patch).eq('site_id', siteId).eq('cluster', key);
  if (error) throw new Error(error.message);
}
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

// --- Team / user control panel (seo-team fn) ---------------------------------
async function seoInvokeTeam(action, extra = {}) {
  const body = { action, accountId: getActiveAccountId(), ...extra };
  // Super acting inside an entered agency targets THAT agency (seo-team
  // honors body.agencyId only for platform admins). Explicit agencyId in
  // `extra` (console actions) always wins.
  if (state.identity?.superAdmin && state.curAgency && body.agencyId === undefined) body.agencyId = state.curAgency.id;
  const { data, error } = await supabase.functions.invoke('seo-team', { body });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoTeamList = () => seoInvokeTeam('list_members', {});
export const seoTeamAdd = (email, role) => seoInvokeTeam('add_member', { email, role });
export const seoTeamSetRole = (userId, role) => seoInvokeTeam('set_role', { userId, role });
export const seoTeamRemove = (userId) => seoInvokeTeam('remove_member', { userId });
export const seoAgencyList = () => seoInvokeTeam('agency_list', {});
export const seoAgencyGrant = (email) => seoInvokeTeam('agency_grant', { email });
// Multi-agency: caller tier + the SUPER console (platform admin only).
export const seoAgencyWhoami = () => seoInvokeTeam('agency_whoami', {});
export const seoSuperListAgencies = () => seoInvokeTeam('super_list_agencies', {});
export const seoSuperCreateAgency = (name, ownerEmail) => seoInvokeTeam('super_create_agency', { name, ownerEmail });
export const seoSuperUpdateAgency = (agencyId, name) => seoInvokeTeam('super_update_agency', { agencyId, name });
export const seoUserAccounts = (userId) => seoInvokeTeam('user_accounts', { userId });
export const seoUserSetAccounts = (userId, accountIds) => seoInvokeTeam('user_set_accounts', { userId, accountIds });
export const seoSuperDeleteAgency = (agencyId, confirmName) => seoInvokeTeam('super_delete_agency', { agencyId, confirmName });
export const seoAgencyRevoke = (userId) => seoInvokeTeam('agency_revoke', { userId });
export const seoMemberGrant = (email, unrestricted, accountIds) => seoInvokeTeam('member_grant', { email, unrestricted, accountIds });
export const seoMemberSetAccounts = (userId, accountIds) => seoInvokeTeam('member_set_accounts', { userId, accountIds });
export const seoMemberSetTier = (userId, tier) => seoInvokeTeam('member_set_tier', { userId, tier });
export const seoMemberRevoke = (userId) => seoInvokeTeam('member_revoke', { userId });

// ── Blog automation (seo-autoblog) ──────────────────────────────────────────
async function seoInvokeAutoblog(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-autoblog', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoAutoblogStatus = (siteId) => seoInvokeAutoblog('status', { siteId });
export const seoAutoblogSave = (siteId, cfg) => seoInvokeAutoblog('save_schedule', { siteId, ...cfg });
export const seoAutoblogPlanBatch = (siteId, n) => seoInvokeAutoblog('plan_batch', { siteId, n });
export const seoAutoblogGenerateOne = (siteId, queueId) => seoInvokeAutoblog('generate_one', { siteId, queueId });
export const seoAutoblogApprove = (siteId, queueId, reason) => seoInvokeAutoblog('approve', { siteId, queueId, reason });
// reason feeds the generator's learning; markNegative also blocks the keyword from future blogging + queues an Ads negative.
export const seoAutoblogReject = (siteId, queueId, reason, markNegative) => seoInvokeAutoblog('reject', { siteId, queueId, reason, mark_negative: !!markNegative });
export const seoAutoblogPublishOne = (siteId, queueId) => seoInvokeAutoblog('publish_one', { siteId, queueId });
export const seoAutoblogRetry = (siteId, queueId) => seoInvokeAutoblog('retry', { siteId, queueId });
export const seoAutoblogRemove = (siteId, queueId) => seoInvokeAutoblog('remove', { siteId, queueId });
export const seoTeamSetPassword = (userId, password) => seoInvokeTeam('set_password', { userId, password });
export const seoTeamSendReset = (userId, mode) => seoInvokeTeam('send_reset', { userId, mode });
export const seoTeamDeleteUser = (userId) => seoInvokeTeam('delete_user', { userId });
export const seoTeamSetTabs = (userId, tabs) => seoInvokeTeam('set_tabs', { userId, tabs });

// --- Marketing strategy (seo-strategy fn) -----------------------------------
async function seoInvokeStrategy(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-strategy', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoStrategySitemap = (siteId) => seoInvokeStrategy('sitemap_fetch', { siteId });
export const seoStrategyPages = (siteId) => seoInvokeStrategy('pages_list', { siteId });
export const seoStrategyPagesSave = (siteId, pages) => seoInvokeStrategy('pages_save', { siteId, pages });
export const seoStrategyAreaGet = (siteId) => seoInvokeStrategy('area_get', { siteId });
export const seoStrategyAreaSave = (siteId, state, counties, cities) => seoInvokeStrategy('area_save', { siteId, state, counties, cities });
export const seoStrategyCounties = (state) => seoInvokeStrategy('geo_counties', { state });
export const seoStrategyCities = (state, counties) => seoInvokeStrategy('geo_cities', { state, counties });
export const seoStrategyContext = (siteId) => seoInvokeStrategy('context', { siteId });

// --- Social Media Manager (seo-social fn) -----------------------------------
async function seoInvokeSocial(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-social', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoSocialProfile = (siteId) => seoInvokeSocial('profile_get', { siteId });
export const seoSocialProfileSave = (siteId, fields) => seoInvokeSocial('profile_save', { siteId, ...fields });
export const seoSocialLogoUpload = (siteId, dataBase64, contentType) => seoInvokeSocial('logo_upload', { siteId, dataBase64, contentType });
export const seoSocialPlanMonth = (siteId, month) => seoInvokeSocial('plan_month', { siteId, month });
export const seoSocialWriteBatch = (siteId, calendarId, limit) => seoInvokeSocial('write_batch', { siteId, calendarId, limit });
export const seoSocialMediaBatch = (siteId, calendarId, limit) => seoInvokeSocial('media_batch', { siteId, calendarId, limit });
export const seoSocialRegenMedia = (siteId, postId) => seoInvokeSocial('regen_media', { siteId, postId });
export const seoSocialRefresh = (siteId, calendarId) => seoInvokeSocial('refresh', { siteId, calendarId });
export const seoSocialCalendar = (siteId, month) => seoInvokeSocial('calendar_get', { siteId, month });
export const seoSocialUpdatePost = (siteId, postId, fields) => seoInvokeSocial('update_post', { siteId, postId, ...fields });
export const seoSocialApprove = (siteId, postId) => seoInvokeSocial('approve', { siteId, postId });
export const seoSocialReject = (siteId, postId, reason) => seoInvokeSocial('reject', { siteId, postId, reason });
export const seoSocialApproveAll = (siteId, calendarId) => seoInvokeSocial('approve_all', { siteId, calendarId });
// GHL Social Planner connection (per business).
export const seoSocialGhlStatus = (siteId) => seoInvokeSocial('ghl_status', { siteId });
export const seoSocialGhlConnect = (siteId, locationId, token) => seoInvokeSocial('ghl_connect', { siteId, locationId, token });
export const seoSocialGhlSetAccounts = (siteId, accountIds) => seoInvokeSocial('ghl_set_accounts', { siteId, accountIds });
export const seoSocialGhlDisconnect = (siteId) => seoInvokeSocial('ghl_disconnect', { siteId });
export const seoSocialGhlPush = (siteId, calendarId) => seoInvokeSocial('ghl_push', { siteId, calendarId });

// --- Media generation (kie.ai via seo-media fn) -----------------------------
async function seoInvokeMedia(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('seo-media', { body: { action, accountId: getActiveAccountId(), ...extra } });
  if (error) { let m = error.message; try { const c = await error.context?.json(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}
export const seoMediaGenerate = ({ model, input, kind, purpose, siteId }) => seoInvokeMedia('generate', { model, input, kind, purpose, siteId });
export const seoMediaStatus = (id) => seoInvokeMedia('status', { id });
export const seoMediaList = (limit) => seoInvokeMedia('list', { limit });
export const seoMediaRemove = (id) => seoInvokeMedia('remove', { id });
export const seoMediaCredits = () => seoInvokeMedia('credits', {});

// --- Job Tracker bridge (agency link + analytics pull) ----------------------
async function jtInvoke(action, extra = {}) {
  const body = { action, accountId: getActiveAccountId(), ...extra };
  // Super acting inside an entered agency targets THAT agency's JT link.
  if (state.identity?.superAdmin && state.curAgency && body.agencyId === undefined) body.agencyId = state.curAgency.id;
  const { data, error } = await supabase.functions.invoke('jt-bridge', { body });
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
// Agency-level JT link + task push (Team tab).
export const jtAgencyStatus = () => jtInvoke('agency_jt_status');
export const jtAgencySet = (companyId) => jtInvoke('agency_jt_set', { companyId });
export const jtAgencyUsers = () => jtInvoke('agency_task_users');
export const jtAgencyTaskCreate = ({ title, description, dueDate, dueTime, assigneeId }) => jtInvoke('agency_task_create', { title, description, dueDate, dueTime, assigneeId });
