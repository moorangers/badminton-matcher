import { expect, test, type Page } from '@playwright/test';

import { addPlayers, createSession, generateMatches } from './helpers';

const getCourt1PlayerNames = (page: Page) =>
  page
    .locator('.text-sm.font-bold.text-tertiary, .text-sm.font-bold.text-destructive')
    .allTextContents();

/**
 * Regression test for the v0.9.14 bug: finishMatch() auto-fills the court
 * with a brand-new match right away, but the old undo-finish endpoint
 * unconditionally refused to undo whenever the court already had a newer
 * active match — which is *always* true right after a normal finish, so
 * "undo" was permanently dead in the one case it's meant for.
 */
test('undo after finishing a match restores the original pairing', async ({
  page,
}) => {
  await createSession(page, { mode: 'Doubles' });
  await addPlayers(page, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  await generateMatches(page);
  await page.getByRole('button', { name: 'เริ่ม' }).click();
  await page.waitForTimeout(500);

  const before = (await getCourt1PlayerNames(page)).sort();
  expect(before).toHaveLength(4);

  await page.getByRole('button', { name: 'จบแมตช์' }).click();
  await page.waitForTimeout(1000);

  const afterFinish = (await getCourt1PlayerNames(page)).sort();
  expect(afterFinish).toHaveLength(4);
  // the court should have auto-filled with the 4 players who were resting
  expect(afterFinish).not.toEqual(before);

  await page.getByText('ย้อนกลับคอร์ดนี้').click();
  await page.waitForTimeout(1000);

  const afterUndo = (await getCourt1PlayerNames(page)).sort();
  expect(afterUndo).toEqual(before);

  // the auto-filled match's players must return to the resting pool, not
  // just disappear
  const restingSection = page.locator('div.rounded-2xl', {
    has: page.getByText('กำลังพัก'),
  });
  await expect(restingSection).toBeVisible();
  for (const name of afterFinish) {
    await expect(restingSection.getByText(name, { exact: true })).toBeVisible();
  }
});
