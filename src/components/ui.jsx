"use client";
import { useEffect, useState } from 'react';

export const Money = ({ value, currency = 'LKR' }) => {
  const num = Number(value || 0);
  const options = num % 1 !== 0
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  return (
    <span className="mono">{currency} {num.toLocaleString('en-US', options)}</span>
  );
};


export const Stamp = ({ status }) => (
  <span className={`stamp ${status}`}>{status.replace('_', ' ')}</span>
);

export const ChequeNo = ({ children }) => <span className="chq-no">{children}</span>;

export const Field = ({ label, children }) => (
  <label className="field"><span>{label}</span>{children}</label>
);

export const Loader = ({ text = 'Loading' }) => (
  <div className="loader">
    <span className="spinner" />
    <span className="loader-text">{text}…</span>
  </div>
);

// Format a raw amount string into a display string with thousands separators
// and up to 2 decimals, preserving a trailing decimal point while typing.
export function formatMoneyInput(raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  let s = String(raw).replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  let [int, dec] = s.split('.');
  int = int.replace(/^0+(?=\d)/, '');
  if (int === '') int = dec !== undefined ? '0' : '';
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (dec !== undefined) return `${intFmt}.${dec.slice(0, 2)}`;
  return intFmt;
}

// Strip separators back to a plain numeric string (what we store/submit).
export function parseMoneyInput(text) {
  return String(text ?? '').replace(/,/g, '');
}

// Text input that auto-inserts commas and a decimal point as the user types.
// `value` is the raw numeric string; `onChange` receives the raw numeric string.
export function MoneyInput({ value, onChange, ...rest }) {
  const [text, setText] = useState(() => formatMoneyInput(value));

  useEffect(() => {
    const currentRaw = parseMoneyInput(text);
    const incoming = value === '' || value === null || value === undefined ? '' : String(value);
    const numsDiffer = Number(currentRaw || 0) !== Number(incoming || 0);
    if (numsDiffer || (incoming === '' && currentRaw !== '')) {
      setText(formatMoneyInput(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = e => {
    const formatted = formatMoneyInput(e.target.value);
    setText(formatted);
    onChange(parseMoneyInput(formatted));
  };

  return <input inputMode="decimal" value={text} onChange={handle} {...rest} />;
}

const CREDIT_CHIP = {
  overdue:  { bg: '#fce8e6', fg: '#b42318', label: 'Overdue' },
  due_soon: { bg: '#fef3cd', fg: '#946200', label: 'Due soon' },
  upcoming: { bg: '#e7f0fe', fg: '#1a56db', label: 'Upcoming' },
  open:     { bg: '#eef2f0', fg: '#4b5563', label: 'No term' },
  settled:  { bg: '#e6f4ea', fg: '#0f5132', label: 'Settled' },
};

export const CreditChip = ({ status, days }) => {
  const c = CREDIT_CHIP[status] || CREDIT_CHIP.open;
  let text = c.label;
  if (status === 'overdue' && typeof days === 'number') text = `Overdue ${Math.abs(days)}d`;
  else if (status === 'due_soon' && typeof days === 'number') text = days === 0 ? 'Due today' : `Due in ${days}d`;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, whiteSpace: 'nowrap'
    }}>{text}</span>
  );
};
