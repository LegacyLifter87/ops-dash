// ---------------------------------------------------------------------------
// sortable.js — reusable click-to-sort for tables. useSort() holds the sort
// state; SortTh renders a clickable header with a direction arrow.
// ---------------------------------------------------------------------------
import { html, cx, useState } from './lib.js';

const cmp = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

// defKey = initial column, defDir = 'asc' | 'desc'. accessors maps key -> fn(row).
export function useSort(defKey, defDir = 'desc') {
  const [key, setKey] = useState(defKey);
  const [dir, setDir] = useState(defDir);
  const toggle = (k) => {
    if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setKey(k); setDir('desc'); }
  };
  const sort = (rows, accessors = {}) => {
    const get = (r) => (accessors[key] ? accessors[key](r) : r[key]);
    const s = [...rows].sort((x, y) => cmp(get(x), get(y)));
    return dir === 'asc' ? s : s.reverse();
  };
  return { key, dir, toggle, sort };
}

export const SortTh = ({ k, label, sort, right = false, class: cls = '' }) => html`
  <th onClick=${() => sort.toggle(k)} class=${cx('py-1.5 pr-3 cursor-pointer select-none whitespace-nowrap hover:text-slate-600', right && 'text-right', cls)}>
    ${label}<span class=${cx('text-brand-500', sort.key === k ? '' : 'opacity-0')}>${sort.key === k && sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>
  </th>`;
