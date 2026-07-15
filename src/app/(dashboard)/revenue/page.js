"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Money, Field } from '@/components/ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function Revenue() {
  const [entries, setEntries] = useState([]);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState({ entry_date: today(), amount: '', notes: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => Promise.all([api.get('/revenue'), api.get('/savings/account')])
    .then(([r, a]) => { setEntries(r); setAccount(a); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault(); setError(''); setNotice('');
    try {
      const r = await api.post('/revenue', form);
      setNotice(`Revenue recorded and deposited to savings. New balance: ${Number(r.balance).toLocaleString()}.`);
      setForm({ entry_date: today(), amount: '', notes: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async entry => {
    if (!confirm(`Reverse the ${entry.entry_date} entry of ${entry.amount}? A reversal will be posted to the savings ledger.`)) return;
    try { await api.del(`/revenue/${entry.id}`); load(); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Sales & savings</h1><div className="sub">Daily revenue entries auto-deposit into the savings account</div></div>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}

      {account && (
        <div className="grid cols-4" style={{ marginBottom: 14 }}>
          <div className="card stat"><div className="label">Current balance</div><div className="value"><Money value={account.balance} /></div></div>
          <div className="card stat"><div className="label">Total deposits</div><div className="value"><Money value={account.total_deposits} /></div></div>
          <div className="card stat"><div className="label">Committed to pending cheques</div><div className="value"><Money value={account.committed_to_pending_cheques} /></div></div>
          <div className="card stat"><div className="label">Available for clearance</div>
            <div className="value" style={{ color: account.available_after_commitments < 0 ? 'var(--claret)' : 'var(--banker)' }}>
              <Money value={account.available_after_commitments} /></div>
            <div className="hint">Balance minus cheques not yet cleared</div></div>
        </div>
      )}

      <div className="grid cols-2">
        <div>
          <form className="card card-pad" onSubmit={submit} style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Record today's sales revenue</h2>
            <div className="grid cols-2">
              <Field label="Date *"><input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></Field>
              <Field label="Amount *"><input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
            <button className="btn primary">Record & deposit to savings</button>
          </form>

          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)' }}><h2 style={{ fontSize: 16 }}>Revenue entries</h2></div>
            <div className="table-wrap responsive-table">
              <table>
                <thead><tr><th>Date</th><th className="num">Amount</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {entries.length === 0 && <tr><td colSpan={4} className="empty">No revenue recorded yet.</td></tr>}
                  {entries.map(r => (
                    <tr key={r.id}>
                      <td className="mono" data-label="Date">{r.entry_date}</td>
                      <td className="num" data-label="Amount"><Money value={r.amount} /></td>
                      <td className="muted" data-label="Notes">{r.notes || '—'}</td>
                      <td><button className="btn danger sm" onClick={() => remove(r)}>Reverse</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)' }}><h2 style={{ fontSize: 16 }}>Savings account ledger</h2></div>
          <div className="table-wrap responsive-table">
            <table>
              <thead><tr><th>When</th><th>Type</th><th>Reference</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {(!account || account.transactions.length === 0) && <tr><td colSpan={5} className="empty">Ledger is empty.</td></tr>}
                {account?.transactions.map(t => (
                  <tr key={t.id}>
                    <td className="mono" data-label="When" style={{ fontSize: 12 }}>{t.created_at}</td>
                    <td data-label="Type">{t.type.replace('_', ' ')}</td>
                    <td className="muted" data-label="Ref">{t.reference}</td>
                    <td className="num" data-label="Amount" style={{ color: t.amount < 0 ? 'var(--claret)' : 'var(--banker)' }}><Money value={t.amount} /></td>
                    <td className="num" data-label="Balance"><Money value={t.balance_after} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
