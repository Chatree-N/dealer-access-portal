import { test } from '@playwright/test';

test('take screenshots', async ({ page }) => {
  await page.goto('/dev/components');
  
  // Desktop (1440px per ADR 15)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000); // allow fonts to load
  await page.screenshot({ path: 'screenshots/desktop.png', fullPage: true });
});
