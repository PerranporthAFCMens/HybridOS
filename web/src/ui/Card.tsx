import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...rest} />;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h3>{title}</h3>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
