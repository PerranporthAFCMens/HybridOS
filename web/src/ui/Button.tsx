import type { ButtonHTMLAttributes } from 'react';

export function Button({ primary, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" className={`btn${primary ? ' primary' : ''} ${className}`.trim()} {...rest} />;
}
