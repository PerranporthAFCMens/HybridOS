import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`btn ${variant} ${className}`.trim()} {...rest} />;
}

export function LinkButton({
  variant = 'secondary',
  className = '',
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return <a className={`btn ${variant} ${className}`.trim()} {...rest} />;
}
