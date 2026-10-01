import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Component Playground', () => {
  test('should render and have no accessibility violations', async ({ page }) => {
    await page.goto('/dev/components');

    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Component Playground');

    // Axe accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Check Stepper progression
    const nextBtn = page.getByRole('button', { name: 'Next Step' });
    await expect(page.locator('h2').filter({ hasText: 'Stepper' })).toBeVisible();
    await nextBtn.click();
  });
});
