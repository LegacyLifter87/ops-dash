// ---------------------------------------------------------------------------
// lib.js — shared imports, enums, labels, and formatting helpers.
// All other modules import the rendering primitives from here so there is a
// single Preact instance (avoids the "Invalid hook call" duplicate-copy bug).
// ---------------------------------------------------------------------------
import { render } from 'preact';
import { html } from 'htm/preact';
import {
  useState, useEffect, useMemo, useRef, useReducer, useCallback,
} from 'preact/hooks';

export { render, html, useState, useEffect, useMemo, useRef, useReducer, useCallback };

// --- ID + date helpers ------------------------------------------------------
export const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthKey(iso) {
  if (!iso) return '';
  return iso.slice(0, 7); // YYYY-MM
}

// Time-of-day from an ISO timestamp, e.g. "2:05 PM"
export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Human duration from milliseconds, e.g. "2h 15m" / "45m"
export function fmtDuration(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// Decimal hours from two ISO timestamps (to "now" if end omitted).
export function hoursBetween(startIso, endIso) {
  if (!startIso) return 0;
  const end = endIso ? new Date(endIso) : new Date();
  return Math.max(0, (end - new Date(startIso)) / 3600000);
}

// --- Number / money / percent formatting ------------------------------------
export function fmtMoney(n, { cents = true } = {}) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function fmtPct(n, digits = 1) {
  if (n == null || isNaN(n)) return '—';
  return `${(Number(n) * 100).toFixed(digits)}%`;
}

export const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// Round to 2 decimals (money/exports).
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// classnames helper
export const cx = (...xs) => xs.filter(Boolean).join(' ');

// --- Domain enums + display labels ------------------------------------------
export const JOB_TYPES = [
  { value: 'service',  label: 'Service' },
  { value: 'install',  label: 'Install' },
  { value: 'sales',    label: 'Sales' },
  { value: 'training', label: 'Training' },
];
export const jobTypeLabel = (v) => JOB_TYPES.find((t) => t.value === v)?.label || '—';

// Default job stages (customizable in Settings → Job Tracker). The job's progress
// through fulfilment, shown as a badge/selector on the Job Tracker.
export const JOB_STAGES = [
  { value: 'contract_signed',   label: 'Contract Signed' },
  { value: 'ready_to_schedule', label: 'Ready to Schedule' },
  { value: 'scheduled',         label: 'Scheduled' },
  { value: 'in_progress',       label: 'In Progress' },
  { value: 'complete',          label: 'Complete' },
];

// Days of the week (value = JS getDay(): 0=Sun … 6=Sat). Used for the pay week.
export const WEEK_DAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

// Default contact sources (value === label; free-form, GHL may send others).
export const CONTACT_SOURCES = [
  { value: 'Website',         label: 'Website' },
  { value: 'Referral',        label: 'Referral' },
  { value: 'Google',          label: 'Google' },
  { value: 'Facebook',        label: 'Facebook' },
  { value: 'Repeat Customer', label: 'Repeat Customer' },
  { value: 'Walk-in',         label: 'Walk-in' },
  { value: 'Other',           label: 'Other' },
];

// Default material-spending categories (companies customize these in Settings).
export const SPENDING_CATEGORIES = [
  { value: 'lumber',           label: 'Lumber' },
  { value: 'hardware',         label: 'Hardware' },
  { value: 'tools',            label: 'Tools' },
  { value: 'equipment_rental', label: 'Equipment Rental' },
  { value: 'permits',          label: 'Permits' },
  { value: 'other',            label: 'Other' },
];

export const LEAD_STATUS = [
  { value: 'active',         label: 'Active',        tone: 'blue' },
  { value: 'follow_up',      label: 'Follow Up',     tone: 'amber' },
  { value: 'closed',         label: 'Closed (Won)',  tone: 'green' },
  { value: 'not_interested', label: 'Not Interested',tone: 'red' },
];
export const leadStatus = (v) => LEAD_STATUS.find((s) => s.value === v) || LEAD_STATUS[0];

// The permanent permitting board stages (a job appears on the board once its
// permit status is anything past "not_needed").
export const PERMIT_STAGES = [
  { value: 'needed',            label: 'Permit Needed',     tone: 'amber' },
  { value: 'applied',           label: 'Applied',           tone: 'blue' },
  { value: 'approved',          label: 'Approved',          tone: 'green' },
  { value: 'needs_inspection',  label: 'Needs Inspection',  tone: 'amber' },
  { value: 'inspection_failed', label: 'Inspection Failed', tone: 'red' },
  { value: 'inspection_passed', label: 'Inspection Passed', tone: 'green' },
];
export const PERMIT_STATUS = [
  { value: 'not_needed', label: 'Not Needed', tone: 'gray' },
  ...PERMIT_STAGES,
];
export const permitStatus = (v) => PERMIT_STATUS.find((s) => s.value === v) || PERMIT_STATUS[0];

// Engineering (on a permit when engineering is needed)
export const ENGINEERING_TYPES = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'structural', label: 'Structural' },
];
export const engineeringType = (v) => ENGINEERING_TYPES.find((t) => t.value === v) || null;
export const ENGINEERING_STATUS = [
  { value: 'needed',   label: 'Needed',   tone: 'amber' },
  { value: 'applied',  label: 'Applied',  tone: 'blue' },
  { value: 'stamped',  label: 'Stamped',  tone: 'blue' },
  { value: 'approved', label: 'Approved', tone: 'green' },
];
export const engineeringStatus = (v) => ENGINEERING_STATUS.find((s) => s.value === v) || ENGINEERING_STATUS[0];

// When commission becomes payable. Sales follows this; GP always at install.
export const PAYOUT_SCHEDULES = [
  { value: 'at_install', label: 'All at install (job complete)' },
  { value: 'at_sale',    label: 'All at sale (contract signed)' },
  { value: 'split',      label: '50% at sale / 50% at install' },
];
export const payoutSchedule = (v) => PAYOUT_SCHEDULES.find((x) => x.value === v) || PAYOUT_SCHEDULES[0];

// Company payroll cadence (the pay-period rhythm, distinct from commission milestones).
export const PAY_PERIOD_FREQS = [
  { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Biweekly' }, { value: 'monthly', label: 'Monthly (calendar)' },
];
const _PAYDAY = 86400000;
const _d = (iso) => new Date(iso + 'T00:00:00');
const _iso = (d) => d.toISOString().slice(0, 10);
// The pay period (start/end inclusive ISO + label) that CONTAINS refIso, given a
// frequency and an anchor date that fixes weekly/biweekly boundaries.
export function payPeriodRange(freq, anchorIso, refIso) {
  const ref = _d(refIso);
  if (freq === 'monthly') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { start: _iso(start), end: _iso(end), label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  const len = freq === 'biweekly' ? 14 : 7;
  const anchor = _d(anchorIso || refIso);
  const idx = Math.floor((ref - anchor) / _PAYDAY / len);
  const start = new Date(anchor.getTime() + idx * len * _PAYDAY);
  const end = new Date(start.getTime() + (len - 1) * _PAYDAY);
  return { start: _iso(start), end: _iso(end), label: `${_iso(start)} – ${_iso(end)}` };
}
// The period n steps from the one starting at periodStartIso (n<0 = earlier).
export function shiftPayPeriod(freq, anchorIso, periodStartIso, n) {
  if (freq === 'monthly') { const d = _d(periodStartIso); return payPeriodRange(freq, anchorIso, _iso(new Date(d.getFullYear(), d.getMonth() + n, 15))); }
  const len = freq === 'biweekly' ? 14 : 7;
  return payPeriodRange(freq, anchorIso, _iso(new Date(_d(periodStartIso).getTime() + (n * len + 1) * _PAYDAY)));
}

// Portion labels for the payout ledger
export const milestoneLabel = (m) => (m === 'sale' ? 'at signing' : 'at install');
export const kindLabel = (k) => (k === 'gp' ? 'GP' : k === 'referral' ? 'Referral' : k === 'bonus' ? 'Bonus' : 'Sales');

export const LEAD_SOURCES = [
  { value: 'company', label: 'Company-Generated', tone: 'blue' },
  { value: 'self',    label: 'Self-Generated',    tone: 'green' },
];
export const leadSource = (v) => LEAD_SOURCES.find((x) => x.value === v) || LEAD_SOURCES[0];

export const JOB_STATUS = [
  { value: 'active',    label: 'Active',    tone: 'blue' },
  { value: 'completed', label: 'Completed', tone: 'green' },
  { value: 'canceled',  label: 'Canceled',  tone: 'red' },
];
export const jobStatus = (v) => JOB_STATUS.find((s) => s.value === v) || JOB_STATUS[0];

// Default cancellation dispositions (companies customize these in Settings).
export const CANCEL_DISPOSITIONS = [
  { value: 'price',         label: 'Price / Too expensive' },
  { value: 'financing',     label: 'Financing fell through' },
  { value: 'competitor',    label: 'Went with competitor' },
  { value: 'unresponsive',  label: 'Unresponsive / Ghosted' },
  { value: 'postponed',     label: 'Project postponed' },
  { value: 'not_a_fit',     label: 'Not a fit / Out of scope' },
  { value: 'other',         label: 'Other' },
];

// User work classification — set per user; drives features + access by where
// someone works (field / office / remote). null = unset.
export const EMPLOYMENT_TYPES = [
  { value: 'field',  label: 'Field' },
  { value: 'office', label: 'Office' },
  { value: 'remote', label: 'Remote' },
];
export const employmentTypeLabel = (v) => EMPLOYMENT_TYPES.find((t) => t.value === v)?.label || '';

// Sales-campaign KPIs (unit: how to format a score) + period presets.
export const CAMPAIGN_KPIS = [
  { value: 'total_projects',    label: 'Total projects sold',     unit: 'count', hint: 'Number of jobs sold in the period' },
  { value: 'sales_volume',      label: 'Total sales $ volume',    unit: 'money', hint: 'Sum of job value sold in the period' },
  { value: 'sold_vs_installed', label: 'Sold → installed %',      unit: 'pct',   hint: 'Share of their sold jobs that are installed' },
  { value: 'best_margin',       label: 'Best gross margin',       unit: 'pct',   hint: 'Average gross-margin % across their sold jobs' },
];
export const campaignKpi = (v) => CAMPAIGN_KPIS.find((k) => k.value === v) || CAMPAIGN_KPIS[0];
// Bases a percentage-of reward tier can pay out on (both resolve to dollars from
// the winner's actual period performance). Gross margin is a ratio, so its dollar
// form is gross profit.
export const CAMPAIGN_BONUS_BASES = [
  { value: 'gp', label: 'Gross profit', short: 'gross profit' },
  { value: 'revenue', label: 'Sales volume', short: 'sales volume' },
];
export const bonusBaseLabel = (v) => CAMPAIGN_BONUS_BASES.find((b) => b.value === v)?.short || v;
export const CAMPAIGN_PERIODS = [
  { value: 'day', label: '1 day' }, { value: 'week', label: '1 week' }, { value: 'month', label: '1 month' },
  { value: 'quarter', label: '1 quarter' }, { value: 'year', label: '1 year' }, { value: 'custom', label: 'Custom' },
];
// Inclusive end date (YYYY-MM-DD) from a preset + start date. 'custom' -> caller sets end.
export function campaignEndDate(preset, startIso) {
  if (!startIso || preset === 'custom') return startIso;
  const d = new Date(startIso + 'T00:00:00');
  if (preset === 'day') return startIso;
  if (preset === 'week') d.setDate(d.getDate() + 7);
  else if (preset === 'month') d.setMonth(d.getMonth() + 1);
  else if (preset === 'quarter') d.setMonth(d.getMonth() + 3);
  else if (preset === 'year') d.setFullYear(d.getFullYear() + 1);
  else return startIso;
  d.setDate(d.getDate() - 1); // make the range inclusive
  return d.toISOString().slice(0, 10);
}
// Format a KPI score for display by its unit.
export function campaignScore(kpiValue, score) {
  const u = campaignKpi(kpiValue).unit;
  if (u === 'money') return '$' + Math.round(Number(score) || 0).toLocaleString();
  if (u === 'pct') return ((Number(score) || 0) * 100).toFixed(1) + '%';
  return String(Math.round(Number(score) || 0));
}

// Labor categories — job-tied vs. overhead
export const LABOR_CATEGORIES = [
  { value: 'job',      label: 'Job Labor',  job: true },
  { value: 'drive',    label: 'Drive Time', job: true },
  { value: 'overtime', label: 'Overtime',   job: true },
  { value: 'training', label: 'Training',   job: false },
  { value: 'shop',     label: 'Shop',       job: false },
  { value: 'other',    label: 'Other',      job: false },
];
export const laborCategory = (v) => LABOR_CATEGORIES.find((c) => c.value === v) || LABOR_CATEGORIES[0];
