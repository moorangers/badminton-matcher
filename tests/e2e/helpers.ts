import type { Page } from '@playwright/test';

/** Starts from a clean slate (no session in localStorage) and creates a
 * brand-new session, landing on the dashboard. The create screen no
 * longer asks for mode/court/score (always creates as doubles/1 court/11
 * pts) — those are chosen on the dashboard's pre-game section instead,
 * before the first "เริ่มจับคู่". */
export async function createSession(
  page: Page,
  opts: { mode?: 'Singles' | 'Doubles'; pin?: string } = {},
) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // "สร้าง session" opens a modal now (trigger lives in the header) —
  // its submit button shares the same label as the trigger, so use the
  // stable data-testid to submit unambiguously
  await page.getByRole('button', { name: 'สร้าง session', exact: true }).click();
  await page.getByPlaceholder('เช่น 1234').fill(opts.pin ?? '1234');
  await page.getByTestId('submit-create-session').click();
  await page.getByPlaceholder(/เพิ่มชื่อผู้เล่น/).waitFor();

  if (opts.mode) {
    // use the stable data-testid rather than role+name: the accessible
    // name ("Singles (1v1)"/"Doubles (2v2)") can collide with the
    // "existing sessions" picker rows, which also mention the mode in
    // their own label once enough sessions have accumulated in the DB
    await page
      .getByTestId(`mode-option-${opts.mode.toLowerCase()}`)
      .click();
  }
}

export async function addPlayers(page: Page, names: string[]) {
  await page.getByPlaceholder(/เพิ่มชื่อผู้เล่น/).fill(names.join(' '));
  await page.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
  await page.getByText(names[names.length - 1], { exact: true }).waitFor();
}

export async function generateMatches(page: Page) {
  await page.getByRole('button', { name: 'เริ่มจับคู่' }).click();
  await page.getByText('แมตช์ปัจจุบัน').waitFor();
}
