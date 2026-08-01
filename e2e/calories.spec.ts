import { Page, expect, test } from '@playwright/test';

const CALORIES_KEY = '90percentile.calories';
const VIEW_KEY = '90percentile.view';

/** Noon `offset` days from now — noon keeps the day boundary unambiguous. */
function dayAt(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

async function seed(
  page: Page,
  entries: { id: string; kcal: number; at: string }[],
  view: 'challenges' | 'calories' = 'calories',
): Promise<void> {
  await page.addInitScript(
    ([key, viewKey, payload, viewValue]) => {
      localStorage.setItem(key as string, payload as string);
      localStorage.setItem(viewKey as string, viewValue as string);
    },
    [CALORIES_KEY, VIEW_KEY, JSON.stringify(entries), view] as const,
  );
}

async function openCalories(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'ККАЛ' }).click();
}

async function logKcal(page: Page, value: string): Promise<void> {
  await page.locator('.entry-input').fill(value);
  await page.locator('.entry-submit').click();
}

test.describe('calorie section', () => {
  test('the menu switches between the two sections', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(25);

    await page.locator('.nav-btn', { hasText: 'ККАЛ' }).click();

    await expect(page.locator('.average-value')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(0);

    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();

    await expect(page.locator('.card')).toHaveCount(25);
    await expect(page.locator('.average-value')).toHaveCount(0);
  });

  test('starts empty with a zero average and a prompt to log something', async ({ page }) => {
    await openCalories(page);

    await expect(page.locator('.average-value')).toHaveText('0');
    await expect(page.locator('.log-empty')).toBeVisible();
    await expect(page.locator('.norm-label')).toContainText('2200');
  });

  test('logging an intake updates the average and the log', async ({ page }) => {
    await openCalories(page);
    await logKcal(page, '1000');

    await expect(page.locator('.average-value')).toHaveText('1000');
    await expect(page.locator('.log-row')).toHaveCount(1);
    await expect(page.locator('.log-kcal')).toHaveText('1000');
    await expect(page.locator('.entry-input')).toHaveValue('');
  });

  test('the average is green within the norm and red above it', async ({ page }) => {
    await openCalories(page);

    await logKcal(page, '2000');
    await expect(page.locator('.average-value')).not.toHaveClass(/over/);
    await expect(page.locator('.norm-state')).toContainText('В НОРМЕ');

    await logKcal(page, '1000');
    await expect(page.locator('.average-value')).toHaveText('3000');
    await expect(page.locator('.average-value')).toHaveClass(/over/);
    await expect(page.locator('.norm-state')).toContainText('ПРЕВЫШЕНА');
  });

  test('an average of exactly the norm still counts as within it', async ({ page }) => {
    await openCalories(page);
    await logKcal(page, '2200');

    await expect(page.locator('.average-value')).toHaveText('2200');
    await expect(page.locator('.average-value')).not.toHaveClass(/over/);
  });

  test('quick-add buttons build up the amount without logging it', async ({ page }) => {
    await openCalories(page);

    await page.locator('.quick-btn', { hasText: '+1000' }).click();
    await page.locator('.quick-btn', { hasText: '+250' }).click();

    await expect(page.locator('.entry-input')).toHaveValue('1250');
    await expect(page.locator('.log-empty')).toBeVisible();

    await page.locator('.entry-submit').click();
    await expect(page.locator('.average-value')).toHaveText('1250');
  });

  test('a bad amount is rejected with a message', async ({ page }) => {
    await openCalories(page);
    await logKcal(page, '0');

    await expect(page.locator('.entry-error')).toBeVisible();
    await expect(page.locator('.log-empty')).toBeVisible();

    await page.locator('.entry-input').fill('500');
    await expect(page.locator('.entry-error')).toHaveCount(0);
  });

  test('yesterday-only intake is averaged over both days', async ({ page }) => {
    await seed(page, [{ id: 'y', kcal: 5000, at: dayAt(-1) }]);
    await page.goto('/');

    await expect(page.locator('.average-value')).toHaveText('2500');
    await expect(page.locator('.stat-value').nth(0)).toHaveText('0');
    await expect(page.locator('.stat-value').nth(1)).toHaveText('2');
    await expect(page.locator('.stat-value').nth(2)).toHaveText('5000');
  });

  test('the app reopens on the section it was left on', async ({ page }) => {
    await openCalories(page);
    await logKcal(page, '1800');

    await page.reload();

    await expect(page.locator('.average-value')).toHaveText('1800');
    await expect(page.locator('.card')).toHaveCount(0);
  });

  test('the challenges section is restored just as well', async ({ page }) => {
    await openCalories(page);
    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();

    await page.reload();

    await expect(page.locator('.card')).toHaveCount(25);
    await expect(page.locator('.average-value')).toHaveCount(0);
  });

  test('an entry can be removed from the log', async ({ page }) => {
    await openCalories(page);
    await logKcal(page, '1000');
    await logKcal(page, '3000');
    await expect(page.locator('.average-value')).toHaveText('4000');

    await page.locator('.log-remove').first().click();

    await expect(page.locator('.log-row')).toHaveCount(1);
    await expect(page.locator('.average-value')).toHaveText('1000');
  });

  test('challenge progress and calories live side by side', async ({ page }) => {
    await page.goto('/');
    await page.locator('.card').first().locator('.toggle-area').click();
    await expect(page.locator('.progress-label')).toContainText('1/25');

    await page.locator('.nav-btn', { hasText: 'ККАЛ' }).click();
    await logKcal(page, '1200');
    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();

    await expect(page.locator('.progress-label')).toContainText('1/25');
    await expect(page.locator('.card').first()).toHaveClass(/done/);
  });

  test('a long log renders only a virtual window of rows', async ({ page }) => {
    const entries = Array.from({ length: 2000 }, (_, i) => ({
      id: `e${i}`,
      kcal: i + 1,
      at: dayAt(-i),
    }));
    await seed(page, entries);
    await page.goto('/');

    const rows = page.locator('.log-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThan(20);

    // The spacer keeps the scrollbar honest about the full 2000 rows.
    const spacerHeight = await page.locator('.log-spacer').evaluate((el) => el.clientHeight);
    expect(spacerHeight).toBe(2000 * 44);

    await expect(page.locator('.log-kcal').first()).toHaveText('1');

    await page.locator('.log-viewport').evaluate((el) => el.scrollTo(0, 44 * 500));

    await expect(page.locator('.log-kcal').first()).not.toHaveText('1');
    expect(await rows.count()).toBeLessThan(20);
  });

  test('the log keeps its history across reloads without trimming it', async ({ page }) => {
    const entries = Array.from({ length: 300 }, (_, i) => ({
      id: `e${i}`,
      kcal: 10,
      at: dayAt(-i),
    }));
    await seed(page, entries);
    await page.goto('/');

    await expect(page.locator('.stat-value').nth(2)).toHaveText('3000');

    await page.reload();

    await expect(page.locator('.stat-value').nth(2)).toHaveText('3000');
    await expect(page.locator('.stat-value').nth(1)).toHaveText('300');
    await expect(page.locator('.average-value')).toHaveText('10');
  });
});
