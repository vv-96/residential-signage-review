"use client";

import { useEffect } from "react";

export function Modal({ title, eyebrow, open, onClose, children, footer, width = "md" }: {
  title: string;
  eyebrow?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`wizard wizard-width-${width}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="wizard-header">
          <div>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2></div>
          <button aria-label={`关闭${title}`} onClick={onClose}>×</button>
        </header>
        {children}
        {footer ? <footer className="wizard-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
