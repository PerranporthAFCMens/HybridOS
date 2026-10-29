import { Link } from 'react-router-dom';
import { BASENAME, SITE } from '../app/site';
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
  // An address that already includes the site root (siteUrl('') on the dev preview) is also an ordinary link, or the router would add the root twice.
  const hasSiteRoot = BASENAME !== '' && href !== undefined && href.startsWith(SITE);
  if (href && href.startsWith('/') && !href.includes('.') && !hasSiteRoot) return <Link className={classes} to={href} {...others} />;
  return <a className={classes} href={href} {...others} />;
}
