// @ts-check
const { test } = require('@playwright/test');
const path = require('path');

const editorPath = `file://${path.resolve(__dirname, '../editor/index.html')}`;

test('capture editor screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(editorPath);

  // Wait for page to fully load
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({
    path: 'test-output/editor-screenshot.png',
    fullPage: false,
  });
});
