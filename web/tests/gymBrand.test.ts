import { describe, expect, it } from 'vitest';
import { gymLogo } from '../src/shell/gymBrand';

const HUB = '242f57c2-6e37-4977-b3c5-1c87de7d0b98';

describe('gymLogo', () => {
  it('uses the uploaded logo when there is one, for any gym', () => {
    expect(gymLogo('x', 'https://cdn.example/logo.png')).toEqual({ src: 'https://cdn.example/logo.png', uploaded: true });
    expect(gymLogo(HUB, 'https://cdn.example/hub.png')).toEqual({ src: 'https://cdn.example/hub.png', uploaded: true });
  });
  it('falls back to the bundled logo for Hybrid Hub only', () => {
    expect(gymLogo(HUB, null)).toEqual({ src: '/assets/hybrid-hub-logo-horizontal.svg', uploaded: false });
    expect(gymLogo('other', null)).toBeNull();
  });
  it('ignores a logo address that is not http or https', () => {
    expect(gymLogo('other', 'javascript:alert(1)')).toBeNull();
    expect(gymLogo('other', '/relative/logo.png')).toBeNull();
  });
});
