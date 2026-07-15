"use client";

export const Money = ({ value, currency = 'LKR' }) => (
  <span className="mono">{currency} {Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
);

export const Stamp = ({ status }) => (
  <span className={`stamp ${status}`}>{status.replace('_', ' ')}</span>
);

export const ChequeNo = ({ children }) => <span className="chq-no">{children}</span>;

export const Field = ({ label, children }) => (
  <label className="field"><span>{label}</span>{children}</label>
);
