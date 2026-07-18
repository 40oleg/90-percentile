import path from 'node:path';
import { expect, test } from '@playwright/test';

const SAMPLE_VIDEO = path.join(__dirname, 'fixtures', 'sample.webm');

test.describe('video proof (optional evidence clip)', () => {
  test('proof button starts dim with no clip attached', async ({ page }) => {
    await page.goto('/');
    const proofBtn = page.locator('.proof-btn').first();

    await expect(proofBtn).toBeVisible();
    await expect(proofBtn).not.toHaveClass(/has-video/);
  });

  test('attaching a clip opens the viewer and lights up the button', async ({ page }) => {
    await page.goto('/');
    const proofBtn = page.locator('.proof-btn').first();

    const chooserPromise = page.waitForEvent('filechooser');
    await proofBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(SAMPLE_VIDEO);

    await expect(page.locator('app-video-modal video')).toBeVisible();

    await page.getByRole('button', { name: 'Закрыть' }).click();
    await expect(page.locator('app-video-modal')).toHaveCount(0);
    await expect(proofBtn).toHaveClass(/has-video/);
  });

  test('attaching a clip does not mark the challenge as completed', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('.card').first();
    const proofBtn = firstCard.locator('.proof-btn');

    const chooserPromise = page.waitForEvent('filechooser');
    await proofBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(SAMPLE_VIDEO);
    await page.getByRole('button', { name: 'Закрыть' }).click();

    await expect(firstCard).not.toHaveClass(/done/);
    await expect(firstCard.locator('.status-pending')).toBeVisible();
    await expect(page.locator('.progress-label')).toContainText('0/25');
  });

  test('clicking a lit proof button reopens the viewer without a file picker', async ({
    page,
  }) => {
    await page.goto('/');
    const proofBtn = page.locator('.proof-btn').first();

    const chooserPromise = page.waitForEvent('filechooser');
    await proofBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(SAMPLE_VIDEO);
    await page.getByRole('button', { name: 'Закрыть' }).click();

    let filechooserFired = false;
    page.once('filechooser', () => (filechooserFired = true));
    await proofBtn.click();

    await expect(page.locator('app-video-modal video')).toBeVisible();
    expect(filechooserFired).toBe(false);
  });

  test('removing a clip clears it and dims the button again', async ({ page }) => {
    await page.goto('/');
    const proofBtn = page.locator('.proof-btn').first();

    const chooserPromise = page.waitForEvent('filechooser');
    await proofBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(SAMPLE_VIDEO);
    await expect(proofBtn).toHaveClass(/has-video/);

    await page.getByRole('button', { name: 'Удалить' }).click();

    await expect(page.locator('app-video-modal')).toHaveCount(0);
    await expect(proofBtn).not.toHaveClass(/has-video/);
  });

  test('attached clips persist across a reload', async ({ page }) => {
    await page.goto('/');
    const proofBtn = page.locator('.proof-btn').first();

    const chooserPromise = page.waitForEvent('filechooser');
    await proofBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(SAMPLE_VIDEO);
    await page.getByRole('button', { name: 'Закрыть' }).click();

    await page.reload();

    await expect(page.locator('.proof-btn').first()).toHaveClass(/has-video/);
  });
});
