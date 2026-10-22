// Browser gate: a generic layout audit for EVERY screen and pop-up (UI_RULES.md rule 6).
// At 320, 390 and 1280px, with the wide iPhone date-box width faked, it fails if:
//   - the page scrolls sideways,
//   - anything sticks out past its parent's edge or off the screen,
//   - a button, link-button or form box is shorter than 40px (the tap-target rule).
// Add a new screen or pop-up to STATES below; no per-screen layout check needs writing.
import { USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage } from './mock.mjs';

const ADA = '33333333-3333-4333-8333-333333333333';
const at = (h, m = 0, d = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const SIZES = { phone320: { width: 320, height: 640 }, phone390: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

let onRota = false; // set while a rota state is being opened
const handle = async ({ route, url, path, select }) => {
  // The rota screen needs a small team, hours, and some time off (only while that screen is open, so the Staff screen keeps its empty state).
  if (onRota) {
    if (path.endsWith('/rpc/get_gym_team_accounts')) return reply(route, [{ user_id: 'c1', display_name: 'Alexandra Montgomery-Featherstonehaugh', email: 'alex@example.test', role: 'coach', is_active: true, access_status: 'active', joined_at: '2026-01-01T00:00:00Z' }, { user_id: 'c2', display_name: 'Sam Staff', email: 'sam@example.test', role: 'staff', is_active: true, access_status: 'active', joined_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/staff_working_hours')) return reply(route, [1, 2, 3, 4, 5, 6, 0].flatMap((weekday) => ['c1', 'c2'].map((user_id) => ({ user_id, weekday, is_working: weekday !== 0, start_time: '06:00:00', end_time: '14:00:00' }))));
    if (path.endsWith('/staff_time_blocks')) return reply(route, [{ id: 'b1', user_id: 'c1', starts_at: at(0, 0, 0), ends_at: at(0, 0, 2), kind: 'leave', reason: 'Holiday with a long reason' }, { id: 'b3', user_id: USER, starts_at: at(9, 0, 5), ends_at: at(11, 0, 5), kind: 'sick', reason: 'A long reason that goes on and on and on' }, { id: 'b2', user_id: 'c2', starts_at: at(16, 0, 3), ends_at: at(18, 0, 3), kind: 'blocked', reason: 'Dentist' }]);
    if (path.endsWith('/gym_closed_days')) return reply(route, [{ id: 'd1', closed_on: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10), reason: 'Bank holiday' }]);
  }
  if (path.endsWith('/rpc/platform_list_gyms')) return reply(route, [{ gym_id: 'g1', name: 'Puffin Performance with a long name', slug: 'puffin', created_at: '2026-01-01T00:00:00Z', members: 42, owner_email: 'owner@example.test', addons_off: ['community'] }], 1);
  if (path.endsWith('/rpc/platform_audit')) return reply(route, [{ id: 1, at: '2026-10-20T10:00:00Z', actor: 'a1', action: 'set_gym_addon', gym_id: 'g1', detail: { addon: 'community', enabled: false } }], 1);
  if (path.endsWith('/platform_addons')) return reply(route, [{ key: 'classes', name: 'Classes', description: 'Timetable and booking', optional: false, default_on: true, sort_order: 1 }, { key: 'community', name: 'Community', description: 'Feed and posts', optional: true, default_on: true, sort_order: 2 }], 2);
  if (path.endsWith('/rpc/get_member_contact_visibility')) return reply(route, { team_sees_phone: true, team_sees_address: false }, 1);
  if (path.endsWith('/rpc/get_member_details')) return reply(route, { date_of_birth: '1994-06-14', phone_hidden: false, address_hidden: false, phone: '+447700900123', has_details: true, address_line1: 'Flat 12, Extraordinarily Long Named Building Court', address_line2: 'Off the Rather Long Road Name', town: 'Perranporth', postcode: 'TR6 0AB', emergency_name: 'Bartholomew Featherstonehaugh-Montgomery', emergency_phone: '+447700900456', emergency_relationship: 'Partner or spouse', guardian_name: null, guardian_phone: null }, 1);
  if (path.endsWith('/gym_members')) return reply(route, [{ user_id: ADA, role: 'member', joined_at: '2026-03-01T00:00:00', attrition_on: null }, { user_id: 'b', role: 'member', joined_at: '2026-05-01T00:00:00', attrition_on: null }]);
  if (path.endsWith('/profiles')) {
    // Like the real database: a request for one person (id=eq.X) gets only that person.
    const rows = [
      { id: USER, display_name: null, first_name: 'Alexandra', last_name: 'Montgomery-Featherstonehaugh' },
      { id: ADA, display_name: null, first_name: 'Adam', last_name: 'Turner-With-A-Very-Long-Surname' },
      { id: 'b', display_name: 'Bob Adams', first_name: null, last_name: null },
    ];
    const eq = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
    return reply(route, url.searchParams.get('id')?.startsWith('eq.') ? rows.filter((r) => r.id === eq) : rows);
  }
  if (path.endsWith('/memberships') && select.includes('starts_on')) return reply(route, [{ id: 'm1', status: 'active', starts_on: '2026-03-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', membership_plans: { name: 'Hybrid Monthly with a long plan name', price_pence: 4500, billing_interval: 'monthly' } }]);
  if (path.endsWith('/memberships') && select.includes('membership_plans')) return reply(route, [{ user_id: ADA, status: 'active', membership_plans: { name: 'Hybrid Monthly', includes_classes: true, includes_open_gym: true, includes_pt: false } }]);
  if (path.endsWith('/class_packs')) return reply(route, [{ id: 'h1', user_id: ADA, name: '10 class pack with a rather long name for a small phone', credits_total: 10, credits_left: 7, expires_at: '2099-12-01T00:00:00Z', source: 'owner', voided_at: null, created_at: '2026-10-10T00:00:00Z' }, { id: 'h2', user_id: 'b', name: 'Drop-in', credits_total: 1, credits_left: 0, expires_at: null, source: 'purchase', voided_at: null, created_at: '2026-10-12T00:00:00Z' }]);
  if (path.endsWith('/class_pack_types')) return reply(route, [{ id: 'k1', name: '10 class pack with a rather long name for a small phone', credits: 10, price_pence: 6000, valid_days: 90, is_active: true }, { id: 'k2', name: 'Drop-in', credits: 1, price_pence: 1200, valid_days: null, is_active: false }]);
  if (path.endsWith('/membership_plans')) return reply(route, [{ id: 'p1', name: 'Hybrid Monthly with a long plan name', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true, description: 'Everything included, with a longer description to wrap over a few lines on a narrow phone screen', joining_fee_pence: 1000, classes_per_week: null, includes_open_gym: true, includes_classes: true, includes_pt: false, is_public: true }]);
  if (path.endsWith('/members')) return reply(route, [{ user_id: ADA, display_name: null, first_name: 'Adam', last_name: 'Turner-With-A-Very-Long-Surname', email: 'adam@example.test' }, { user_id: 'b', display_name: 'Bob Adams', first_name: null, last_name: null, email: 'bob@example.test' }]);
  if (path.endsWith('/workout_assignments')) return reply(route, [{ id: 'a1', member_user_id: ADA, title: 'Lower body strength with a long workout name', status: 'completed', source: 'pt', assigned_by: USER, created_at: at(9, 0, -3), completed_at: at(10, 0, -2), member_rpe: 7, member_notes: null, result: null }]);
  if (path.endsWith('/channels')) return reply(route, [{ id: 'c1', name: 'general', description: 'Everyone' }]);
  if (path.endsWith('/rpc/get_class_calendar')) return reply(route, [{ session_id: 's1', name: 'Strength and conditioning with a long name', starts_at: at(7, 30), ends_at: at(8, 30), booked_count: 9, capacity: 12, is_cancelled: false, spaces_left: 3, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0 }]);
  if (path.endsWith('/staff_access')) return reply(route, [{ permissions: { mark_attendance: true, view_timetable: true } }], 1);
  if (path.endsWith('/class_session_staff')) return reply(route, [{ session_id: 's1', assignment_role: 'Coach', is_lead: true, class_sessions: { id: 's1', name: 'Strength and conditioning with a long name', starts_at: at(23, 0), ends_at: at(23, 59), capacity: 12, is_cancelled: false } }]);
  if (path.endsWith('/class_bookings')) return reply(route, [{ id: 'bk1', user_id: ADA, status: 'booked', booked_at: at(6) }, { id: 'bk2', user_id: 'b', status: 'attended', booked_at: at(6, 5) }]);
  return false;
};

// Each state: how to get to it. Add new screens and pop-ups here.
const STATES = {
  today: async (page) => { await page.goto(`${base}/today`); await page.getByText('Active members', { exact: true }).waitFor(); await page.getByText('Strength and conditioning').first().waitFor(); },
  members: async (page) => { await page.goto(`${base}/members`); await page.locator('.member-row').first().waitFor(); },
  plans: async (page) => { await page.goto(`${base}/plans`); await page.getByRole('heading', { name: /Hybrid Monthly/ }).waitFor(); },
  'plan form': async (page) => { await page.goto(`${base}/plans`); await page.getByRole('button', { name: 'New plan' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  classes: async (page) => { await page.goto(`${base}/classes`); await page.getByRole('button', { name: 'List', exact: true }).click(); await page.getByRole('heading', { name: /Strength and conditioning/ }).waitFor(); },
  'class calendar': async (page) => { await page.goto(`${base}/classes`); await page.getByRole('button', { name: 'Day', exact: true }).click(); await page.getByRole('button', { name: /^Add a class on .* at 09:00$/ }).waitFor(); },
  'class form': async (page) => { await page.goto(`${base}/classes`); await page.getByRole('button', { name: 'Add class' }).click(); await page.getByRole('dialog').getByLabel('Class name').waitFor(); },
  packs: async (page) => { await page.goto(`${base}/packs`); await page.getByRole('heading', { name: /10 class pack/ }).waitFor(); },
  'pack give': async (page) => { await page.goto(`${base}/packs`); await page.getByRole('button', { name: 'Give to a member' }).click(); await page.getByRole('dialog').getByLabel('Member').waitFor(); },
  'pack cancel': async (page) => { await page.goto(`${base}/packs`); await page.getByRole('button', { name: 'Cancel pack' }).click(); await page.getByRole('button', { name: 'Yes, cancel it' }).waitFor(); },
  'pack form': async (page) => { await page.goto(`${base}/packs`); await page.getByRole('button', { name: 'New pack' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  programmes: async (page) => { await page.goto(`${base}/programmes`); await page.getByRole('heading', { name: 'Programmes', level: 1 }).waitFor(); },
  'member record': async (page) => { await page.goto(`${base}/members`); await page.locator('.member-row').first().click(); await page.getByText('Customer lifecycle').waitFor(); await page.getByRole('heading', { name: /Hybrid Monthly/ }).waitFor(); },
  settings: async (page) => { await page.goto(`${base}/settings`); await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor(); },
  staff: async (page) => { await page.goto(`${base}/staff`); await page.getByText('No team accounts yet.').waitFor(); },
  rota: async (page) => { await page.goto(`${base}/rota`); await page.getByRole('heading', { name: 'Rota and time off' }).waitFor(); await page.locator('.rota-cell.working').first().waitFor(); },
  'rota time off': async (page) => { await page.goto(`${base}/rota`); await page.locator('.rota-cell.working').first().click(); await page.getByRole('dialog').getByLabel('Reason (optional)').waitFor(); },
  'rota closed day': async (page) => { await page.goto(`${base}/rota`); await page.getByRole('button', { name: /gym open\. Open$/ }).first().click(); await page.getByRole('dialog').getByLabel('Reason (optional)').waitFor(); },
  'staff time off': async (page) => { await page.goto(`${base}/s/time-off`); await page.getByRole('heading', { name: 'My time off' }).waitFor(); await page.getByRole('button', { name: /^Remove / }).first().waitFor(); },
  'staff block out time': async (page) => { await page.goto(`${base}/s/time-off`); await page.getByRole('button', { name: 'Block out time' }).click(); await page.getByRole('dialog').getByLabel('Reason (optional)').waitFor(); },
  'staff form': async (page) => { await page.goto(`${base}/staff`); await page.getByRole('button', { name: 'Add staff login' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  rooms: async (page) => { await page.goto(`${base}/rooms`); await page.getByText('Nothing set up yet. Add your first room.').waitFor(); },
  'rooms form': async (page) => { await page.goto(`${base}/rooms`); await page.getByRole('button', { name: 'Add room or equipment' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  access: async (page) => { await page.goto(`${base}/access`); await page.getByText('No access levels yet.').first().waitFor(); },
  'access form': async (page) => { await page.goto(`${base}/access`); await page.getByRole('button', { name: 'New access level' }).click(); await page.getByRole('dialog').getByLabel('Level name').waitFor(); },
  door: async (page) => { await page.goto(`${base}/door`); await page.getByRole('button', { name: 'Save door access' }).waitFor(); },
  'member view': async (page) => { await page.goto(`${base}/member-view`); await page.getByRole('button', { name: 'Save member view' }).waitFor(); },
  'member privacy': async (page) => { await page.goto(`${base}/member-privacy`); await page.getByRole('button', { name: 'Save' }).waitFor(); },
  community: async (page) => { await page.goto(`${base}/community`); await page.getByText('No community posts yet.').waitFor(); },
  communications: async (page) => { await page.goto(`${base}/communications`); await page.getByRole('button', { name: 'Save template' }).waitFor(); },
  workouts: async (page) => { await page.goto(`${base}/workouts`); await page.getByText('No workouts yet. Build your first one.').waitFor(); },
  movements: async (page) => { await page.goto(`${base}/movements`); await page.getByRole('heading', { name: 'Movements', level: 1 }).waitFor(); },
  'workout editor': async (page) => { await page.goto(`${base}/workouts`); await page.getByRole('button', { name: 'New workout' }).click(); await page.getByLabel('Workout name').waitFor(); },
  'report summary': async (page) => { await page.goto(`${base}/reports`); await page.getByText('Needs a look').waitFor(); },
  'report overview': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Overview' }); await page.waitForTimeout(800); },
  'report memberships': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Memberships' }); await page.waitForTimeout(800); },
  'report classes': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Classes' }); await page.waitForTimeout(800); },
  'report members': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Members' }); await page.waitForTimeout(800); },
  'report payments': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Payments' }); await page.waitForTimeout(800); },
  'report money owed': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Money owed' }); await page.waitForTimeout(800); },
  'report xero': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Accounting (Xero)' }); await page.waitForTimeout(800); },
  'report report library': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Report library' }); await page.waitForTimeout(800); },
  'payments page': async (page) => { await page.goto(`${base}/payments`); await page.waitForTimeout(1200); },
  'training page': async (page) => { await page.goto(`${base}/training`); await page.waitForTimeout(1200); },
  'lifts page': async (page) => { await page.goto(`${base}/lifts`); await page.waitForTimeout(1200); },
  'class setup page': async (page) => { await page.goto(`${base}/class-setup`); await page.waitForTimeout(1200); },
  'member membership': async (page) => { await page.goto(`${base}/m/membership`); await page.waitForTimeout(1200); },
  'member community': async (page) => { await page.goto(`${base}/m/community`); await page.waitForTimeout(1200); },
  'member leaderboard': async (page) => { await page.goto(`${base}/m/train/leaderboard`); await page.waitForTimeout(1200); },
  'report builder': async (page) => { await page.goto(`${base}/reports`); await page.getByLabel('Report section').selectOption({ label: 'Report builder' }); await page.getByLabel('Look at').waitFor(); },
  'staff day': async (page) => { await page.goto(`${base}/s/today`); await page.getByText('Next up').waitFor(); },
  'staff roster': async (page) => { await page.goto(`${base}/s/today`); await page.getByRole('button', { name: 'See who is booked' }).click(); await page.getByRole('button', { name: /^Attended: / }).waitFor(); },
  'staff timetable': async (page) => { await page.goto(`${base}/s/timetable`); await page.getByRole('heading', { name: 'Gym timetable' }).waitFor(); await page.getByText('Strength and conditioning').first().waitFor(); },
  'staff clients': async (page) => { await page.goto(`${base}/s/clients`); await page.getByRole('heading', { name: 'All clients' }).waitFor(); await page.getByText('needs your reply').first().waitFor(); },
  'staff client': async (page) => { await page.goto(`${base}/s/clients/${ADA}`); await page.getByRole('link', { name: '‹ Clients' }).waitFor(); await page.getByRole('heading', { name: /Adam/ }).waitFor(); },
  'staff me': async (page) => { await page.goto(`${base}/s/me`); await page.getByRole('button', { name: 'Sign out' }).waitFor(); },
  'member today': async (page) => { await page.goto(`${base}/m/today`); await page.getByRole('heading', { name: 'Ready for your next class?' }).waitFor(); },
  'member classes': async (page) => { await page.goto(`${base}/m/classes`); await page.getByText('No classes on this day.').waitFor(); },
  'member train': async (page) => { await page.goto(`${base}/m/train`); await page.getByRole('button', { name: 'Start my own workout' }).or(page.getByRole('link', { name: 'Start my own workout' })).waitFor(); },
  'member bests': async (page) => { await page.goto(`${base}/m/train/pbs`); await page.getByText('No personal bests yet.').waitFor(); },
  'member pt': async (page) => { await page.goto(`${base}/m/train/pt`); await page.getByText('No sessions booked.').waitFor(); },
  'member me': async (page) => { await page.goto(`${base}/m/me`); await page.getByRole('button', { name: 'Sign out' }).waitFor(); },
  control: async (page) => { await page.goto(`${base}/control`); await page.getByText('Manage Puffin Performance with a long name').waitFor(); },
  estate: async (page) => { await page.goto(`${base}/estate`); await page.getByText('The estate view is for owners and admins of two or more gyms.').waitFor(); },
  'member groups': async (page) => { await page.goto(`${base}/m/groups`); await page.getByText('You are not in any groups yet.').waitFor(); },
  'member group form': async (page) => { await page.goto(`${base}/m/groups`); await page.getByRole('button', { name: 'New group' }).click(); await page.getByRole('dialog').getByLabel('Group name').waitFor(); },
  'membership rules': async (page) => { await page.goto(`${base}/membership-rules`); await page.getByRole('button', { name: 'Save membership rules' }).waitFor(); },
  'membership requests': async (page) => { await page.goto(`${base}/membership-requests`); await page.getByText('Nothing is waiting.').waitFor(); },
  owners: async (page) => { await page.goto(`${base}/owners`); await page.getByText('No access invitations yet.').waitFor(); },
  menu: async (page, size) => { await page.goto(`${base}/today`); await page.getByText('Active members', { exact: true }).waitFor(); if (size.width < 900) { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(350); } },
};

// Runs inside the page. Returns a list of problems in plain words.
function audit() {
  const problems = [];
  const vw = window.innerWidth;
  const label = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + (e.textContent ? ` "${e.textContent.trim().slice(0, 24)}"` : ''));
  if (document.documentElement.scrollWidth > vw + 1) {
    const wide = [...document.querySelectorAll('#root *')].filter((e) => e.scrollWidth > vw + 1).slice(-3).map((e) => label(e));
    problems.push(`the page scrolls sideways${wide.length ? ` (wide: ${wide.join('; ')})` : ''}`);
  }
  const drawerClosed = vw < 900 && !document.querySelector('.shell.open');
  const root = document.querySelector('#root');
  for (const e of root.querySelectorAll('*')) {
    if (e instanceof SVGElement && e.tagName.toLowerCase() !== 'svg') continue;
    if (drawerClosed && e.closest('.side')) continue;
    if (e.closest('.table-wrap')) continue; // report tables scroll sideways inside their own box, by design
    if (e.closest('.mem-days')) continue; // the day strip scrolls sideways inside its own box, by design
    if (e.closest('.backdrop, .menu-btn') && !e.matches('.menu-btn')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fixedish = cs.position === 'fixed' || cs.position === 'absolute';
    // 1. off the screen sideways (modal and page ancestors may clip it, but it is still wrong)
    if (!fixedish && (r.right > vw + 1 || r.left < -1)) problems.push(`${label(e)} runs off the screen (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
    // 2. sticks out past its parent's edge
    const p = e.parentElement;
    if (p && !fixedish) {
      const pcs = getComputedStyle(p);
      if (pcs.display !== 'contents' && !/(auto|scroll|hidden|clip)/.test(pcs.overflowX)) {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1) problems.push(`${label(e)} sticks out of ${label(p)} by ${Math.round(Math.max(r.right - pr.right, pr.left - r.left))}px`);
      }
    }
    // 3. tap targets
    const tag = e.tagName.toLowerCase();
    const interactive = tag === 'button' || tag === 'select' || tag === 'input' || tag === 'textarea' || e.matches('.btn') || (tag === 'a' && cs.display !== 'inline' && !e.closest('nav'));
    if (interactive && !e.closest('[data-dense]') && r.height < 40) problems.push(`${label(e)} is only ${Math.round(r.height)}px tall (tap targets must be 40px or more)`);
  }
  return [...new Set(problems)];
}

const browser = await launch();
let allOk = true;
const c = runChecks();
// AUDIT_SIZES (for example "desktop") runs only those widths, so CI can run the widths side by side.
const only = process.env.AUDIT_SIZES?.split(',');
// AUDIT_PART="1/2" runs every second screen starting with the first ("2/2": the others), so one width can be split in two.
const partMatch = /^(\d+)\/(\d+)$/.exec(process.env.AUDIT_PART ?? '');
const part = partMatch ? { n: +partMatch[1] - 1, of: +partMatch[2] } : null;
for (const [sizeName, viewport] of Object.entries(SIZES)) {
  if (only && !only.includes(sizeName)) continue;
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, handle);
  await page.addInitScript(() => {
    // iPhone Safari gives date boxes a wide built-in width; fake that everywhere.
    const s = document.createElement('style');
    s.textContent = 'input[type=date]::-webkit-datetime-edit{display:inline-block;min-width:330px}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
  });
  for (const [stateIndex, [stateName, go]] of Object.entries(STATES).entries()) {
    if (part && stateIndex % part.of !== part.n) continue;
    const navs = [];
    const onNav = (fr) => { if (fr === page.mainFrame()) navs.push(fr.url()); };
    page.on('framenavigated', onNav);
    try { onRota = stateName.startsWith('rota') || stateName.startsWith('staff time off'); await go(page, viewport); } catch (e) {
      c.ok(`${sizeName} / ${stateName}: could not open (${String(e).split('\n')[0].slice(0, 80)})`, false);
      console.log(`  ${sizeName} / ${stateName}: page errors: ${errors.slice(-3).join(' | ').slice(0, 400)}; navigations: ${navs.length} (${[...new Set(navs)].slice(0, 4).join(', ')}); body: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 200).replace(/\n/g, ' / ')}`);
      page.off('framenavigated', onNav);
      continue;
    }
    page.off('framenavigated', onNav);
    // the menu's name loads separately; audit with it in place (the test person has a very long surname)
    // Only admin screens have this menu; the member app has none, so waiting for it there just burns 15 seconds a screen.
    if (!page.url().includes('/m/')) await page.locator('.account .who-name').waitFor({ state: 'attached', timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(150);
    const problems = await page.evaluate(audit);
    if (shots) await page.screenshot({ path: `${shots}/audit-${sizeName}-${stateName.replace(/ /g, '-')}.png`, fullPage: false });
    if (problems.length) { for (const p of problems.slice(0, 8)) console.log(`  ${sizeName} / ${stateName}: ${p}`); if (problems.length > 8) console.log(`  ...and ${problems.length - 8} more`); }
    c.ok(`${sizeName} / ${stateName}`, problems.length === 0);
  }
  c.ok(`${sizeName}: no page errors`, errors.length === 0);
  await ctx.close();
}
await browser.close();
if (!c.report('layout audit')) allOk = false;
process.exit(allOk ? 0 : 1);
