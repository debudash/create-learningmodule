import type { Browser, Page } from '@playwright/test';

/** Signs in as a seeded person and opens Lesson 3 of the sample Unit in the workspace. */
export async function openSampleLesson(browser: Browser, person: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/sign-in');
  await page.getByRole('button', { name: new RegExp(person) }).click();
  await page.waitForURL('/units');
  await page.getByRole('link', { name: /The Lightning Thief/ }).click();
  await page.getByRole('link', { name: /Rick Riordan as a Myth Adapter/ }).click();
  await page.waitForSelector('.lesson-editor', { timeout: 90_000 });
  return page;
}

/** The values of every field inside an Activity (its blocks are form fields). */
export function activityText(page: Page, activityId: string): Promise<string> {
  return page
    .locator(`[data-activity-id="${activityId}"] input, [data-activity-id="${activityId}"] textarea`)
    .evaluateAll((fields) => fields.map((f) => (f as HTMLInputElement).value).join('\n'));
}
