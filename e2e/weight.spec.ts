import { Page, expect, test } from '@playwright/test';

const WEIGHT_KEY = '90percentile.weight';
const RANGE_KEY = '90percentile.weight.range';
const VIEW_KEY = '90percentile.view';

interface SeedEntry {
  id: string;
  kg: number;
  at: string;
}

/** Local noon `offset` days from now. */
function dayAt(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

async function seed(page: Page, entries: SeedEntry[]): Promise<void> {
  await page.addInitScript(
    ([key, viewKey, payload]) => {
      localStorage.setItem(key as string, payload as string);
      localStorage.setItem(viewKey as string, 'weight');
    },
    [WEIGHT_KEY, VIEW_KEY, JSON.stringify(entries)] as const,
  );
}

async function openWeight(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'ВЕС' }).click();
}

async function logWeight(page: Page, value: string): Promise<void> {
  await page.locator('.entry-input').fill(value);
  await page.locator('.entry-submit').click();
}

test.describe('weight section', () => {
  test('the menu opens the weight diary', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(25);

    await page.locator('.nav-btn', { hasText: 'ВЕС' }).click();

    await expect(page.locator('.entry-input')).toHaveCount(1);
    await expect(page.locator('app-weight-chart')).toHaveCount(1);
    await expect(page.locator('.card')).toHaveCount(0);

    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();
    await expect(page.locator('.card')).toHaveCount(25);
  });

  test('starts empty with no weight and an empty chart', async ({ page }) => {
    await openWeight(page);

    await expect(page.locator('.current-value')).toHaveText('—');
    await expect(page.locator('.chart-empty')).toBeVisible();
    await expect(page.locator('.stat-value').first()).toHaveText('—');
  });

  test('a logged weigh-in becomes the current weight and a point on the chart', async ({
    page,
  }) => {
    await openWeight(page);
    await logWeight(page, '74.5');

    await expect(page.locator('.current-value')).toHaveText('74.5');
    await expect(page.locator('.entry-input')).toHaveValue('');
    await expect(page.locator('svg.plot')).toBeVisible();
    await expect(page.locator('circle.dot')).toHaveCount(2);
  });

  test('a comma works as the decimal separator', async ({ page }) => {
    await openWeight(page);
    await logWeight(page, '74,5');

    await expect(page.locator('.current-value')).toHaveText('74.5');
  });

  test('a bad weight is rejected with a message', async ({ page }) => {
    await openWeight(page);
    await logWeight(page, '900');

    await expect(page.locator('.entry-error')).toContainText('от 20 до 500');
    await expect(page.locator('.current-value')).toHaveText('—');

    await page.locator('.entry-input').fill('74.5');
    await expect(page.locator('.entry-error')).toHaveCount(0);
  });

  test('the chart and the statistics follow the chosen range', async ({ page }) => {
    await seed(page, [
      { id: 'a', kg: 95, at: dayAt(-120) },
      { id: 'b', kg: 88, at: dayAt(-60) },
      { id: 'c', kg: 80, at: dayAt(-1) },
    ]);
    await page.goto('/');

    // A month: only the newest weigh-in is inside the window.
    await expect(page.locator('.chart-count')).toHaveText('1 ЗАМ.');
    await expect(page.locator('.stat-value').nth(0)).toHaveText('—');
    await expect(page.locator('.stat-value').nth(2)).toHaveText('80');

    await page.locator('.range-btn', { hasText: '3 МЕС.' }).click();
    await expect(page.locator('.chart-count')).toHaveText('2 ЗАМ.');
    await expect(page.locator('.stat-value').nth(0)).toHaveText('−8');
    await expect(page.locator('.stat-value').nth(2)).toHaveText('88');

    await page.locator('.range-btn', { hasText: 'ПОЛГОДА' }).click();
    await expect(page.locator('.chart-count')).toHaveText('3 ЗАМ.');
    await expect(page.locator('.stat-value').nth(0)).toHaveText('−15');
    await expect(page.locator('.stat-value').nth(2)).toHaveText('95');
  });

  test('the chosen range is remembered across a reload', async ({ page }) => {
    await openWeight(page);
    await page.locator('.range-btn', { hasText: 'ПОЛГОДА' }).click();

    // The choice is stored by an effect, so let the write land before reloading.
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), RANGE_KEY))
      .toBe('half');

    await page.reload();

    await expect(page.locator('.range-btn', { hasText: 'ПОЛГОДА' })).toHaveClass(/active/);
  });

  test('weigh-ins survive a reload and are never rotated out', async ({ page }) => {
    await seed(page, [
      { id: 'ancient', kg: 110, at: dayAt(-400) },
      { id: 'today', kg: 80, at: dayAt(0) },
    ]);
    await page.goto('/');

    await expect(page.locator('.current-value')).toHaveText('80');
    await expect(page.locator('.chart-count')).toHaveText('1 ЗАМ.');

    await page.reload();

    const stored = await page.evaluate((key) => localStorage.getItem(key), WEIGHT_KEY);
    expect(JSON.parse(stored!)).toHaveLength(2);
  });

  test('works on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await seed(page, [
      { id: 'a', kg: 82, at: dayAt(-20) },
      { id: 'b', kg: 80.5, at: dayAt(-2) },
    ]);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');

    await expect(page.locator('svg.plot')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
