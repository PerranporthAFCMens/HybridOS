// Opening a report from the one list on the Reports page (there is no tab dropdown any more).
const TITLES = { Memberships: 'Memberships overview', Classes: 'Classes overview', Members: 'Members overview', Payments: 'Payments overview' };

/** From the Reports page (or any open report), open the report with this name. */
export async function openReport(page, label) {
  const back = page.getByRole('link', { name: '← All reports' });
  if (await back.count()) await back.click();
  const title = TITLES[label] ?? label;
  await page.locator('.report-row').filter({ has: page.locator('b', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).click();
}
