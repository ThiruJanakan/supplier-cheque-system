"use client";

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
