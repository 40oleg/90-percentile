import { expect, test } from '@playwright/test';

test.describe('challenge list', () => {
  test('renders every challenge with 0% progress', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.card')).toHaveCount(25);
    await expect(page.locator('.progress-label')).toContainText('0/25');
    await expect(page.locator('.progress-label')).toContainText('0%');
  });

  test('a fresh card is dim and marked as pending', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('.card').first();
    await expect(firstCard).not.toHaveClass(/done/);
    await expect(firstCard.locator('.status-pending')).toBeVisible();
  });

  test('toggling a card marks it done and updates progress', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-area').click();

    await expect(firstCard).toHaveClass(/done/);
    await expect(firstCard.locator('.status-done')).toBeVisible();
    await expect(page.locator('.progress-label')).toContainText('1/25');
  });

  test('toggling a done card reverts it back to pending', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-area').click();
    await expect(firstCard).toHaveClass(/done/);

    await firstCard.locator('.toggle-area').click();

    await expect(firstCard).not.toHaveClass(/done/);
    await expect(page.locator('.progress-label')).toContainText('0/25');
  });

  test('filtering to "ГОТОВО" shows only completed challenges', async ({ page }) => {
    await page.goto('/');

    await page.locator('.card').first().locator('.toggle-area').click();
    await page.getByRole('tab', { name: 'ГОТОВО' }).click();

    await expect(page.locator('.card')).toHaveCount(1);
    await expect(page.locator('.card').first().locator('.status-done')).toBeVisible();
  });

  test('filtering to "В ПРОЦЕССЕ" hides the completed challenge', async ({ page }) => {
    await page.goto('/');

    await page.locator('.card').first().locator('.toggle-area').click();
    await page.getByRole('tab', { name: 'В ПРОЦЕССЕ' }).click();

    await expect(page.locator('.card')).toHaveCount(24);
    await expect(page.locator('.status-done')).toHaveCount(0);
  });

  test('switching back to "ВСЕ" restores the full list', async ({ page }) => {
    await page.goto('/');

    await page.locator('.card').first().locator('.toggle-area').click();
    await page.getByRole('tab', { name: 'ГОТОВО' }).click();
    await page.getByRole('tab', { name: 'ВСЕ' }).click();

    await expect(page.locator('.card')).toHaveCount(25);
  });

  test('progress persists across a reload', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-area').click();
    await expect(page.locator('.progress-label')).toContainText('1/25');

    await page.reload();

    await expect(page.locator('.progress-label')).toContainText('1/25');
    await expect(page.locator('.card').first()).toHaveClass(/done/);
  });

  test('mute button toggles its pressed state and icon', async ({ page }) => {
    await page.goto('/');

    const muteBtn = page.locator('.mute-btn');
    await expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(muteBtn).toHaveText('🔊');

    await muteBtn.click();

    await expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(muteBtn).toHaveText('🔇');
  });

  test('the manifest is reachable and describes an installable app', async ({ page, request }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const res = await request.get(new URL(manifestHref!, page.url()).toString());
    expect(res.ok()).toBe(true);

    const manifest = await res.json();
    expect(manifest.name).toBe('90 Percentile');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
