import { Page, expect, test } from '@playwright/test';

const PRESSURE_KEY = '90percentile.pressure';
const VIEW_KEY = '90percentile.view';

interface SeedEntry {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  at: string;
}

/** `offset` days from now at a given local hour — the hour picks the slot. */
function dayAt(offset: number, hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

async function seed(page: Page, entries: SeedEntry[]): Promise<void> {
  await page.addInitScript(
    ([key, viewKey, payload]) => {
      localStorage.setItem(key as string, payload as string);
      localStorage.setItem(viewKey as string, 'pressure');
    },
    [PRESSURE_KEY, VIEW_KEY, JSON.stringify(entries)] as const,
  );
}

async function openPressure(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'ДАВЛЕНИЕ' }).click();
}

async function logReading(
  page: Page,
  systolic: string,
  diastolic: string,
  pulse: string,
): Promise<void> {
  const fields = page.locator('.field-input');
  await fields.nth(0).fill(systolic);
  await fields.nth(1).fill(diastolic);
  await fields.nth(2).fill(pulse);
  await page.locator('.entry-submit').click();
}

test.describe('pressure section', () => {
  test('the menu opens the pressure diary', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(25);

    await page.locator('.nav-btn', { hasText: 'ДАВЛЕНИЕ' }).click();

    await expect(page.locator('.field-input')).toHaveCount(3);
    await expect(page.locator('app-pressure-chart')).toHaveCount(2);
    await expect(page.locator('.card')).toHaveCount(0);

    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();
    await expect(page.locator('.card')).toHaveCount(25);
  });

  test('starts empty with no average and two empty charts', async ({ page }) => {
    await openPressure(page);

    await expect(page.locator('.average-value')).toHaveText('—/—');
    await expect(page.locator('.chart-empty')).toHaveCount(2);
    await expect(page.locator('.average-caption')).toHaveText('СРЕДНЕЕ ЗА 14 ДНЕЙ');
  });

  test('a logged reading fills the average, the stats and a chart', async ({ page }) => {
    await openPressure(page);
    await logReading(page, '118', '76', '65');

    await expect(page.locator('.average-value')).toHaveText('118/76');
    await expect(page.locator('.average-unit')).toContainText('ПУЛЬС 65');
    await expect(page.locator('.category')).toHaveText('НОРМА');
    await expect(page.locator('.field-input').first()).toHaveValue('');
    // One of the two charts now has data; the other stays empty.
    await expect(page.locator('.chart-empty')).toHaveCount(1);
    await expect(page.locator('svg.plot')).toHaveCount(1);
  });

  test('the caret walks the fields as the digits fill them', async ({ page }) => {
    await openPressure(page);
    const fields = page.locator('.field-input');

    await fields.nth(0).focus();
    await page.keyboard.type('120');
    await expect(fields.nth(1)).toBeFocused();

    await page.keyboard.type('80');
    await expect(fields.nth(2)).toBeFocused();

    await page.keyboard.type('65');
    // Nothing holds the caret any more, so the phone keyboard drops.
    await expect(fields.nth(2)).not.toBeFocused();
    await expect(page.locator('.field-input:focus')).toHaveCount(0);

    await expect(fields.nth(0)).toHaveValue('120');
    await expect(fields.nth(1)).toHaveValue('80');
    await expect(fields.nth(2)).toHaveValue('65');

    await page.locator('.entry-submit').click();
    await expect(page.locator('.average-value')).toHaveText('120/80');
  });

  test('the caret waits while a field is still short', async ({ page }) => {
    await openPressure(page);
    const fields = page.locator('.field-input');

    await fields.nth(0).focus();
    await page.keyboard.type('12');

    await expect(fields.nth(0)).toBeFocused();
  });

  test('a jump selects the old value, so retyping replaces it', async ({ page }) => {
    await openPressure(page);
    const fields = page.locator('.field-input');

    await fields.nth(1).fill('80');
    await fields.nth(0).focus();
    await page.keyboard.type('130');
    await page.keyboard.type('90');

    await expect(fields.nth(1)).toHaveValue('90');
    await expect(fields.nth(2)).toBeFocused();
  });

  test('the fields take digits only, three at most', async ({ page }) => {
    await openPressure(page);
    const fields = page.locator('.field-input');

    await fields.nth(2).focus();
    await page.keyboard.type('6a5');

    await expect(fields.nth(2)).toHaveValue('65');
  });

  test('a bad reading is rejected with a message', async ({ page }) => {
    await openPressure(page);
    await logReading(page, '80', '120', '65');

    await expect(page.locator('.entry-error')).toContainText('больше нижнего');
    await expect(page.locator('.average-value')).toHaveText('—/—');

    await page.locator('.field-input').first().fill('120');
    await expect(page.locator('.entry-error')).toHaveCount(0);
  });

  test('morning and evening readings land on their own charts', async ({ page }) => {
    await seed(page, [
      { id: 'm1', systolic: 118, diastolic: 76, pulse: 60, at: dayAt(-1, 9) },
      { id: 'm2', systolic: 122, diastolic: 78, pulse: 62, at: dayAt(0, 8) },
      { id: 'e1', systolic: 138, diastolic: 88, pulse: 74, at: dayAt(-1, 20) },
    ]);
    await page.goto('/');

    const charts = page.locator('app-pressure-chart');
    await expect(charts.nth(0).locator('.chart-title')).toHaveText('УТРО');
    await expect(charts.nth(1).locator('.chart-title')).toHaveText('ВЕЧЕР');
    await expect(charts.nth(0).locator('.chart-days')).toHaveText('2/14 ДН.');
    await expect(charts.nth(1).locator('.chart-days')).toHaveText('1/14 ДН.');

    const stats = page.locator('.stat-value');
    await expect(stats.nth(0)).toContainText('120/77');
    await expect(stats.nth(1)).toContainText('138/88');
    await expect(stats.nth(2)).toHaveText('3');
  });

  test('each chart draws three lines over the measured days', async ({ page }) => {
    await seed(page, [
      { id: 'a', systolic: 118, diastolic: 76, pulse: 60, at: dayAt(-2, 9) },
      { id: 'b', systolic: 124, diastolic: 80, pulse: 64, at: dayAt(-1, 9) },
      { id: 'c', systolic: 121, diastolic: 78, pulse: 62, at: dayAt(0, 9) },
    ]);
    await page.goto('/');

    const morning = page.locator('app-pressure-chart').first();
    await expect(morning.locator('polyline.systolic')).toHaveCount(1);
    await expect(morning.locator('polyline.diastolic')).toHaveCount(1);
    await expect(morning.locator('polyline.pulse')).toHaveCount(1);
    await expect(morning.locator('circle')).toHaveCount(9);
  });

  test('readings older than two weeks stay stored but off the charts', async ({ page }) => {
    await seed(page, [
      { id: 'ancient', systolic: 200, diastolic: 120, pulse: 100, at: dayAt(-100, 9) },
      { id: 'today', systolic: 120, diastolic: 80, pulse: 65, at: dayAt(0, 9) },
    ]);
    await page.goto('/');

    await expect(page.locator('.average-value')).toHaveText('120/80');
    await expect(page.locator('.stat-value').nth(2)).toHaveText('2');
    await expect(page.locator('app-pressure-chart').first().locator('.chart-days')).toHaveText(
      '1/14 ДН.',
    );
  });

  test('works on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await seed(page, [
      { id: 'a', systolic: 118, diastolic: 76, pulse: 60, at: dayAt(-2, 9) },
      { id: 'b', systolic: 124, diastolic: 80, pulse: 64, at: dayAt(-1, 21) },
    ]);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');

    await expect(page.locator('.field-input')).toHaveCount(3);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the diary survives a reload', async ({ page }) => {
    await openPressure(page);
    await logReading(page, '130', '85', '70');
    await expect(page.locator('.average-value')).toHaveText('130/85');

    await page.reload();

    await expect(page.locator('.average-value')).toHaveText('130/85');
    await expect(page.locator('.stat-value').nth(2)).toHaveText('1');
  });
});
