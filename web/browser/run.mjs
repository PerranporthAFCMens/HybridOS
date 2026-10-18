// Runs the browser checks. `npm run browser` runs every check one after another.
// In CI, SHARD=<n>/<of> (for example SHARD=2/5) runs only that share, so the shares can run on separate
// machines at the same time. Each check goes to exactly one share, so nothing is skipped.
// A failing check does not stop the others in the share: every failure is listed at the end.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

// Rough run time in seconds (measured; used only to spread the work evenly across shares). A check
// not listed here gets DEFAULT_WEIGHT, so a new check needs no change here.
const DEFAULT_WEIGHT = 5;
const WEIGHT = {
  join: 11, 'join-pay': 15, 'quick-join': 14, owners: 11, member: 11, builder: 10, 'classes-calendar': 10,
  'member-home': 9, back: 9, 'member-community': 8, owed: 8, access: 8, classes: 7, programmes: 27,
};
// The layout audit is the slowest check by far (3 screen widths x about 45 screens), so it runs as three
// separate jobs, one per width.
const AUDIT_SIZES = ['phone320', 'phone390', 'desktop'];
const AUDIT_WEIGHT = 107;

const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !['mock.mjs', 'fake-date.mjs', 'run.mjs'].includes(f)).map((f) => f.slice(0, -4)).sort();
const jobs = files.flatMap((name) => (name === 'audit'
  ? AUDIT_SIZES.map((size) => ({ label: `audit (${size})`, file: 'audit.mjs', env: { AUDIT_SIZES: size }, weight: AUDIT_WEIGHT }))
  : [{ label: name, file: `${name}.mjs`, env: {}, weight: WEIGHT[name] ?? DEFAULT_WEIGHT }]));

const m = /^(\d+)\/(\d+)$/.exec(process.env.SHARD ?? '1/1');
if (!m || +m[1] < 1 || +m[1] > +m[2]) { console.error(`SHARD must look like 2/5, got "${process.env.SHARD}"`); process.exit(2); }
const [index, count] = [+m[1] - 1, +m[2]];

// Heaviest first, each into the currently lightest share: a simple, repeatable way to balance the shares.
const shares = Array.from({ length: count }, () => ({ total: 0, jobs: [] }));
for (const job of [...jobs].sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))) {
  const lightest = shares.reduce((a, b) => (b.total < a.total ? b : a));
  lightest.jobs.push(job);
  lightest.total += job.weight;
}
const mine = shares[index].jobs.sort((a, b) => jobs.indexOf(a) - jobs.indexOf(b));
console.log(`Share ${index + 1} of ${count}: ${mine.length} of ${jobs.length} checks (${mine.map((j) => j.label).join(', ')})`);

const run = (job) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn(process.execPath, [join(dir, job.file)], { stdio: 'inherit', env: { ...process.env, ...job.env } });
  child.on('exit', (code) => resolve({ job, code, seconds: Math.round((Date.now() - started) / 1000) }));
});

const failed = [];
for (const job of mine) {
  const r = await run(job);
  console.log(`--- ${job.label}: ${r.code === 0 ? 'PASS' : 'FAIL'} in ${r.seconds}s`);
  if (r.code !== 0) failed.push(job.label);
}
if (failed.length) { console.log(`FAILED: ${failed.join(', ')}`); process.exit(1); }
console.log(`All ${mine.length} checks in this share passed.`);
