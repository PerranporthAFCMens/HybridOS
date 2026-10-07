import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

// The ONLY place a raw <input> or <select> may appear (lint enforces this). The styling in
// ui/forms.css makes every box shrinkable, 44px tall and iPhone-safe, so a screen cannot get it wrong.

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ctl ${className}`.trim()} {...rest} />;
}

export function DateInput({ className = '', ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="date" className={`ctl ctl-date ${className}`.trim()} {...rest} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ctl ${className}`.trim()} {...rest} />;
}

/** A labelled form row. `htmlFor` must match the box's id so the label is tappable and readable by screen readers. */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

/** Two fields side by side on a wide screen, stacked on a phone. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}
