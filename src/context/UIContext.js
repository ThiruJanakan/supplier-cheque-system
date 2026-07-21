"use client";
import { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { title, message, confirmText, cancelText, onConfirm, onCancel, danger }

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    warning: (msg) => showToast(msg, 'warning'),
    info: (msg) => showToast(msg, 'info'),
  };

  const confirm = useCallback(({ title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        confirmText,
        cancelText,
        danger,
        onConfirm: () => {
          setDialog(null);
          if (onConfirm) onConfirm();
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          if (onCancel) onCancel();
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              <div className="toast-content">{t.message}</div>
              <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {dialog && (
        <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && dialog.onCancel()}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label={dialog.title}>
            <div className="dialog-body">
              <div className="dialog-title">{dialog.title}</div>
              <div className="dialog-message">{dialog.message}</div>
            </div>
            <div className="dialog-foot">
              <button className="btn ghost" onClick={dialog.onCancel}>{dialog.cancelText}</button>
              <button className={`btn ${dialog.danger ? 'danger' : 'primary'}`} onClick={dialog.onConfirm}>{dialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
