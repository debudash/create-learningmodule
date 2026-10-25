import { expect, test, type Browser, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/**
 * The whole path of a Unit (docs/test_plan.md, end-to-end steps 1, 2, 5 and 6):
 * import the sample Outline, generate every Lesson (fake mode), review one Lesson
 * by hand, submit the rest, bulk approve, publish and download the Release.
 */

const OUTLINE = fileURLToPath(new URL('../fixtures/outlines/g6-u4-lightning-thief.csv', import.meta.url));

interface BoardLesson {
  id: string;
  key: string;
  status: string;
}

async function signIn(browser: Browser, person: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/sign-in');
  await page.getByRole('button', { name: new RegExp(person) }).click();
  await page.waitForURL('/units');
  return page;
}

async function boardLessons(page: Page, unitId: string): Promise<BoardLesson[]> {
  const response = await page.request.get(`/api/units/${unitId}/board`);
  return ((await response.json()) as { lessons: BoardLesson[] }).lessons;
}

test('import, generate, review, publish and download a Unit', async ({ browser }) => {
  test.setTimeout(15 * 60_000);
  const maya = await signIn(browser, 'Maya Chen');

  // 1. Import the sample Outline, resolving every Blocking Outline Issue.
  await maya.goto('/units/new');
  await maya.locator('input[type="file"]').setInputFiles(OUTLINE);
  await maya.getByRole('button', { name: 'Read Outline' }).click();
  const proceed = maya.getByRole('button', { name: 'Continue' });
  await expect(proceed).toBeVisible({ timeout: 60_000 });
  for (let i = 0; i < 60 && (await proceed.isDisabled()); i++) {
    const resolve = maya.getByRole('button', { name: /^(Use suggestion|Keep as written)$/ }).first();
    await resolve.click();
  }
  await proceed.click();
  await maya.getByRole('button', { name: 'Create Unit' }).click();
  await maya.waitForURL(/\/units\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const unitId = maya.url().split('/').at(-1)!;

  // 2. Generate every Lesson; the worker (fake mode) takes them to Draft, Flex Days last.
  await maya.getByRole('button', { name: /^Generate all \d+$/ }).click();
  await expect
    .poll(async () => (await boardLessons(maya, unitId)).every((l) => l.status === 'draft'), { timeout: 5 * 60_000, intervals: [2_000] })
    .toBe(true);
  const lessons = await boardLessons(maya, unitId);
  expect(lessons.length).toBe(47);

  // 5. One Lesson by hand: submit, approve as an Approver, then it is read-only.
  const [first, ...rest] = lessons;
  await maya.goto(`/lessons/${first!.id}`);
  await maya.getByRole('button', { name: 'Submit for review' }).click();
  await expect(maya.getByText('In Review').first()).toBeVisible();
  const priya = await signIn(browser, 'Priya Natarajan');
  await priya.goto(`/lessons/${first!.id}`);
  await priya.getByRole('button', { name: /^Approve/ }).click();
  await expect(priya.getByText('Approved').first()).toBeVisible();
  await maya.reload();
  await expect(maya.getByRole('status')).toHaveText('Read-only', { timeout: 30_000 });

  // 6. Submit the rest, approve them in bulk from the board, publish, download.
  for (const lesson of rest) {
    await maya.goto(`/lessons/${lesson.id}`);
    await maya.getByRole('button', { name: 'Submit for review' }).click();
    await expect(maya.getByRole('button', { name: 'Submit for review' })).toHaveCount(0);
  }
  await priya.goto(`/units/${unitId}`);
  await priya.getByRole('tab', { name: /^In Review/ }).click();
  for (const lesson of rest) await priya.getByLabel(`Select ${lesson.key}`, { exact: true }).check();
  await priya.getByRole('button', { name: `Approve ${rest.length} selected` }).click();
  await expect
    .poll(async () => (await boardLessons(priya, unitId)).every((l) => l.status === 'approved'), { timeout: 60_000 })
    .toBe(true);

  await priya.goto(`/units/${unitId}/publish`);
  await priya.getByRole('button', { name: 'Publish Unit' }).click();
  await expect(priya.getByRole('link', { name: 'Download JSON' })).toBeVisible();
  const download = await priya.request.get((await priya.getByRole('link', { name: 'Download JSON' }).getAttribute('href'))!);
  const release = (await download.json()) as { lessons: unknown[] };
  expect(release.lessons).toHaveLength(47);

  await Promise.all([maya.context().close(), priya.context().close()]);
});
