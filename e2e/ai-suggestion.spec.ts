import { expect, test } from '@playwright/test';
import { activityText, openSampleLesson } from './helpers';

const placeholder = 'placeholder AI Suggestion: Add ELD support';

test('an AI Suggestion stays private until accepted, then reaches everyone and History', async ({ browser }) => {
  const maya = await openSampleLesson(browser, 'Maya Chen');
  const jordan = await openSampleLesson(browser, 'Jordan Ellis');
  const loops: string[] = [];
  maya.on('console', (m) => m.type() === 'error' && m.text().includes('Maximum update depth') && loops.push(m.text()));

  await maya.locator('[data-activity-id="lia-part-b"]').getByRole('button', { name: 'AI Suggestion' }).click();
  await maya.getByLabel('Add ELD support').check();
  await maya.getByRole('button', { name: 'Suggest a change' }).click();
  await expect(maya.getByText(/AI Suggestion: \d+ lines added/)).toBeVisible({ timeout: 60_000 });
  expect(await activityText(jordan, 'lia-part-b')).not.toContain(placeholder);

  await maya.getByRole('button', { name: 'Accept' }).click();
  await expect(maya.getByRole('region', { name: 'AI Suggestion' })).toHaveCount(0);
  await expect.poll(() => activityText(jordan, 'lia-part-b')).toContain(placeholder);

  // LCG-27, found while re-verifying Phase 6: accepting set off an endless re-render of the editor.
  await maya.waitForTimeout(1500);
  expect(loops, 'LCG-27: React update loop after Accept').toEqual([]);

  await expect(maya.getByText('All changes saved')).toBeVisible({ timeout: 30_000 });
  await maya.reload();
  await maya.waitForSelector('.lesson-editor', { timeout: 90_000 });
  await maya.getByRole('button', { name: 'History' }).click();
  await expect(maya.locator('section', { hasText: 'Accepted AI Suggestions' }).locator('li')).toHaveCount(1);
  await Promise.all([maya.context().close(), jordan.context().close()]);
});

test('accepting is refused when a colleague changed the Activity meanwhile', async ({ browser }) => {
  const maya = await openSampleLesson(browser, 'Maya Chen');
  const jordan = await openSampleLesson(browser, 'Jordan Ellis');

  await maya.locator('[data-activity-id="lia-part-b"]').getByRole('button', { name: 'AI Suggestion' }).click();
  await maya.getByLabel('Write a sample student response').check();
  await maya.getByRole('button', { name: 'Suggest a change' }).click();
  await expect(maya.getByText(/AI Suggestion: \d+ lines added/)).toBeVisible({ timeout: 60_000 });

  await jordan.locator('[data-activity-id="lia-part-b"] input').first().fill('Part B: Renamed by Jordan');
  await expect.poll(() => maya.locator('[data-activity-id="lia-part-b"] input').first().inputValue()).toBe('Part B: Renamed by Jordan');

  await maya.getByRole('button', { name: 'Accept' }).click();
  await expect(maya.getByText(/has changed since the suggestion/)).toBeVisible();
  expect(await activityText(jordan, 'lia-part-b')).not.toContain('placeholder AI Suggestion: Write a sample student response');
  await maya.getByRole('button', { name: 'Reject' }).click();
  await expect(maya.getByRole('region', { name: 'AI Suggestion' })).toHaveCount(0);
  await Promise.all([maya.context().close(), jordan.context().close()]);
});
