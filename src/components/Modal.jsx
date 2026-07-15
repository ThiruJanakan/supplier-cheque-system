"use client";

export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="body">{children}</div>
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
}
