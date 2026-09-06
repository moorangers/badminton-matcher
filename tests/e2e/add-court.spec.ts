import { expect, test } from '@playwright/test';

import { addPlayers, createSession, generateMatches } from './helpers';

/**
 * Regression test for the v0.9.15 bug: adding a court mid-session via the
 * plan editor only updated `session.activeCourts` — nothing ever created a
 * live match for a court that never had one before (only finishMatch's
 * auto-refill does that, and only for a court that already had a match).
 * The new court would sit forever as an empty "next match" preview with
 * no start/finish buttons.
 */
test('adding a court mid-session creates a real, playable match on it', async ({
  page,
}) => {
  await createSession(page, { mode: 'Singles' });
  await addPlayers(page, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  await generateMatches(page);

  // only one court is active so far — one actionable match
  await expect(page.getByRole('button', { name: 'เริ่ม' })).toHaveCount(1);

  await page.getByRole('button', { name: 'ปรับรอบถัดไป' }).click();
  await page.getByRole('button', { name: 'Court 2', exact: true }).click();
  await page.getByRole('button', { name: 'บันทึกแผน' }).click();
  await page.waitForTimeout(1200);

  await expect(page.getByText('COURT 2')).toBeVisible();
  // the key regression check: Court 2 must be a real actionable match
  // (its own "เริ่ม"/"จบแมตช์" buttons), not just a "next match" preview
  await expect(page.getByRole('button', { name: 'เริ่ม' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'จบแมตช์' })).toHaveCount(2);
});
