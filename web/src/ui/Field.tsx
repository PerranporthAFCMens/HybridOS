import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

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

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ctl ctl-area ${className}`.trim()} {...rest} />;
}

/** A tick box with its words. The whole row (at least 44px tall) is the tap target. */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
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
