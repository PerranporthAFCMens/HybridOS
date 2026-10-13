import { useState } from 'react';
import type { ComponentPropsWithRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// The ONLY place a raw <input> or <select> may appear (lint enforces this). The styling in
// ui/forms.css makes every box shrinkable, 44px tall and iPhone-safe, so a screen cannot get it wrong.

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ctl ${className}`.trim()} {...rest} />;
}

/** A password box with an eye to show what has been typed. The label of the button says what tapping it will do. */
export function PasswordInput({ className = '', eyeFor, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { eyeFor?: string }) {
  const [shown, setShown] = useState(false);
  const what = eyeFor ?? (rest['aria-label'] ? rest['aria-label'].toLowerCase() : 'password');
  return (
    <span className="ctl-pass">
      <input type={shown ? 'text' : 'password'} className={`ctl ${className}`.trim()} {...rest} />
      <button type="button" className="ctl-eye" aria-label={`${shown ? 'Hide' : 'Show'} ${what}`} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}

export function DateInput({ className = '', ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="date" className={`ctl ctl-date ${className}`.trim()} {...rest} />;
}

export function ColorInput({ className = '', ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="color" className={`ctl ctl-color ${className}`.trim()} {...rest} />;
}

export function FileInput({ className = '', ...rest }: Omit<ComponentPropsWithRef<'input'>, 'type'>) {
  return <input type="file" className={`ctl ctl-file ${className}`.trim()} {...rest} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ctl ${className}`.trim()} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ctl ctl-area ${className}`.trim()} {...rest} />;
}

/** A tick box with its words. The whole row (at least 44px tall) is the tap target. */
export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`check${disabled ? ' disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
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
