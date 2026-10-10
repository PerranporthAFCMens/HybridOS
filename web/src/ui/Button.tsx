import { Link } from 'react-router-dom';
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
  const classes = `btn ${variant} ${className}`.trim();
  const { href, ...others } = rest;
  // A path inside the app (/members) moves within the app; anything else (old pages, files) is an ordinary link.
  if (href && href.startsWith('/') && !href.includes('.')) return <Link className={classes} to={href} {...others} />;
  return <a className={classes} href={href} {...others} />;
}
