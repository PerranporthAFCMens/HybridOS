// Gate: the privacy policy and data-deletion pages are plain static pages in the built site, readable without sign-in or scripts.
const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173';
const pages = [
  ['privacy.html', 'Privacy policy', 'Other members can never see your details'],
  ['data-deletion.html', 'Delete your data', 'Delete my data'],
];
let ok = true;
for (const [file, heading, text] of pages) {
  const res = await fetch(`${base}/${file}`);
  const html = await res.text();
  const pass = res.ok && html.includes(`<h1>${heading}</h1>`) && html.includes(text) && !html.includes('<script');
  console.log(`${file}: ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) ok = false;
}
const landing = await (await fetch(`${base}/landing.html`)).text();
const linked = landing.includes('href="./privacy"') && landing.includes('href="./data-deletion"');
console.log(`landing page links both: ${linked ? 'PASS' : 'FAIL'}`);
process.exit(ok && linked ? 0 : 1);
