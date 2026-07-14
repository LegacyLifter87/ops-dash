// ---------------------------------------------------------------------------
// auth.js — Ops Dash login / signup, loading, and first-account onboarding.
// ---------------------------------------------------------------------------
import { html, useState, cx } from './lib.js';
import { signIn, signUp, createAccount, forgotPassword } from './store.js';
import { Card, Btn, Input, Field } from './ui.js';

function Shell({ children }) {
  return html`
    <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-950">
      <div class="w-full max-w-sm">
        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 text-white">
            <div class="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center text-xl font-bold">◑</div>
            <span class="text-2xl font-bold tracking-tight">Ops Dash</span>
          </div>
          <p class="text-slate-400 text-sm mt-1">Agency operations & SEO intelligence</p>
        </div>
        <${Card}><div class="p-6">${children}</div></${Card}>
      </div>
    </div>`;
}

export function LoadingScreen() {
  return html`<div class="min-h-screen flex items-center justify-center bg-slate-50">
    <div class="text-slate-400 text-sm animate-pulse">Loading Ops Dash…</div>
  </div>`;
}

export function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      if (mode === 'login') { await signIn(email, password); }
      else {
        const r = await signUp(email, password);
        if (!r.session) { setMsg('Check your email to confirm your account, then sign in.'); setMode('login'); }
      }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return html`<${Shell}>
    <div class="flex gap-1 mb-5 p-1 bg-slate-100 rounded-xl text-sm">
      ${['login', 'signup'].map((m) => html`
        <button onClick=${() => { setMode(m); setErr(''); setMsg(''); }}
          class=${cx('flex-1 py-1.5 rounded-lg font-medium', mode === m ? 'bg-white shadow text-slate-900' : 'text-slate-500')}>
          ${m === 'login' ? 'Sign in' : 'Create account'}</button>`)}
    </div>
    <form onSubmit=${(e) => { e.preventDefault(); submit(); }} class="space-y-3">
      <${Field} label="Email"><${Input} type="email" value=${email} onInput=${setEmail} placeholder="you@company.com" /></${Field}>
      <${Field} label="Password"><${Input} type="password" value=${password} onInput=${setPassword} placeholder="••••••••" /></${Field}>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      ${msg && html`<div class="text-sm text-emerald-600">${msg}</div>`}
      <${Btn} type="submit" class="w-full" disabled=${busy}>${busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}</${Btn}>
      ${mode === 'login' && html`<button type="button" onClick=${async () => {
        if (!email.trim()) { setErr('Enter your email above first, then click “Forgot password?”.'); return; }
        setErr(''); setMsg('');
        try { await forgotPassword(email); setMsg('Reset link sent — check your email.'); } catch (e) { setErr(e.message); }
      }} class="w-full text-center text-xs text-slate-400 hover:text-slate-600 underline">Forgot password?</button>`}
    </form>
  </${Shell}>`;
}

export function Onboarding() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    try { await createAccount(name); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return html`<${Shell}>
    <div class="space-y-3">
      <div>
        <div class="font-semibold text-slate-900">Create your first account</div>
        <p class="text-sm text-slate-500">An account is a workspace for a business you manage — its sites, keywords, and SEO data live here.</p>
      </div>
      <${Field} label="Account name"><${Input} value=${name} onInput=${setName} placeholder="Acme Home Services" /></${Field}>
      ${err && html`<div class="text-sm text-rose-600">${err}</div>`}
      <${Btn} class="w-full" onClick=${create} disabled=${busy}>${busy ? 'Creating…' : 'Create account'}</${Btn}>
    </div>
  </${Shell}>`;
}
