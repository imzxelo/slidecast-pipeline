// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const editorPath = `file://${path.resolve(__dirname, '../editor/index.html')}`;

test.describe('Slide Sync Editor', () => {
  test('should load the editor page', async ({ page }) => {
    await page.goto(editorPath);

    // Check title
    await expect(page).toHaveTitle('Slide Sync Editor');

    // Check header elements
    await expect(page.locator('header h1')).toHaveText('Slide Sync Editor');
    await expect(page.locator('label:has-text("PDF")')).toBeVisible();
    await expect(page.locator('label:has-text("Audio")')).toBeVisible();
  });

  test('should have all main panels', async ({ page }) => {
    await page.goto(editorPath);

    // Left panel (thumbnails)
    await expect(page.locator('.left-panel')).toBeVisible();

    // Center panel (slide view + audio controls)
    await expect(page.locator('.center-panel')).toBeVisible();
    await expect(page.locator('.slide-view')).toBeVisible();
    await expect(page.locator('.audio-controls')).toBeVisible();

    // Right panel (markers)
    await expect(page.locator('.right-panel')).toBeVisible();
  });

  test('should have playback controls', async ({ page }) => {
    await page.goto(editorPath);

    // Play button
    await expect(page.locator('.play-btn')).toBeVisible();

    // Speed selector
    await expect(page.locator('#speedSelect')).toBeVisible();
    const speedOptions = page.locator('#speedSelect option');
    await expect(speedOptions).toHaveCount(6);

    // Progress bar
    await expect(page.locator('.progress-container')).toBeVisible();
  });

  test('should have marker controls', async ({ page }) => {
    await page.goto(editorPath);

    // Import/Export buttons
    await expect(page.locator('#importBtn')).toBeVisible();
    await expect(page.locator('#exportBtn')).toBeVisible();

    // Add marker button
    await expect(page.locator('#addMarkerBtn')).toBeVisible();
    await expect(page.locator('#addMarkerBtn')).toHaveText('+ マーカーを追加 (M)');

    // Empty state message
    await expect(page.locator('.markers-list .empty-state')).toBeVisible();
  });

  test('should have keyboard hints', async ({ page }) => {
    await page.goto(editorPath);

    const hints = page.locator('.keyboard-hint');
    await expect(hints).toBeVisible();
    await expect(hints).toContainText('Space');
    await expect(hints).toContainText('再生/停止');
    await expect(hints).toContainText('M');
    await expect(hints).toContainText('マーカー追加');
  });

  test('should show empty state for thumbnails initially', async ({ page }) => {
    await page.goto(editorPath);

    const emptyState = page.locator('.left-panel .empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('PDFを読み込んでください');
  });

  test('should toggle speed options', async ({ page }) => {
    await page.goto(editorPath);

    const speedSelect = page.locator('#speedSelect');

    // Default should be 1x
    await expect(speedSelect).toHaveValue('1');

    // Change to 1.5x
    await speedSelect.selectOption('1.5');
    await expect(speedSelect).toHaveValue('1.5');

    // Change to 0.5x
    await speedSelect.selectOption('0.5');
    await expect(speedSelect).toHaveValue('0.5');
  });

  test('should have time display', async ({ page }) => {
    await page.goto(editorPath);

    // Current time
    await expect(page.locator('#currentTime')).toBeVisible();
    await expect(page.locator('#currentTime')).toHaveText('0:00.000');

    // Duration
    await expect(page.locator('#duration')).toBeVisible();
    await expect(page.locator('#duration')).toHaveText('0:00.000');
  });

  test('should show alert when adding marker without files', async ({ page }) => {
    await page.goto(editorPath);

    // Setup dialog handler
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('PDFと音声を先に読み込んでください');
      await dialog.accept();
    });

    // Click add marker button
    await page.locator('#addMarkerBtn').click();
  });

  test('should have edit modal hidden by default', async ({ page }) => {
    await page.goto(editorPath);

    const modal = page.locator('#editModal');
    await expect(modal).not.toHaveClass(/active/);
  });
});
