import { describe, expect, it } from 'vitest';
import { landingFor, safeReturn } from '../src/auth/signin';

const gym = (role: 'owner' | 'admin' | 'staff' | 'coach' | 'member') => ({ gymId: 'g1', gymName: 'Gym', logoUrl: null, role });
const ORIGIN = 'https://www.hybridone.co.uk';

describe('landingFor', () => {
  it('sends each role to its own app', () => {
    expect(landingFor(gym('owner'))).toBe('/today');
    expect(landingFor(gym('admin'))).toBe('/today');
    expect(landingFor(gym('staff'))).toBe('/s/today');
    expect(landingFor(gym('coach'))).toBe('/s/today');
    expect(landingFor(gym('member'))).toBe('/m/today');
  });
});

describe('safeReturn', () => {
  it('keeps an address inside the site', () => {
    expect(safeReturn('/members?x=1#a', ORIGIN, '/')).toBe('/members?x=1#a');
  });
  it('drops other sites, empty values and sign-in pages', () => {
    expect(safeReturn('https://evil.example/members', ORIGIN, '/')).toBe('');
    expect(safeReturn('//evil.example/x', ORIGIN, '/')).toBe('');
    expect(safeReturn(null, ORIGIN, '/')).toBe('');
    expect(safeReturn('/login.html', ORIGIN, '/')).toBe('');
    expect(safeReturn('/sign-in', ORIGIN, '/')).toBe('');
    expect(safeReturn('/hybrid-hub', ORIGIN, '/')).toBe('');
    expect(safeReturn('/puffin-performance', ORIGIN, '/')).toBe('');
  });
  it('drops an address outside the dev site folder', () => {
    expect(safeReturn('/other/page', ORIGIN, '/HybridOS/')).toBe('');
    expect(safeReturn('/HybridOS/members', ORIGIN, '/HybridOS/')).toBe('/HybridOS/members');
  });
});
