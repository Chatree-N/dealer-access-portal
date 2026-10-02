import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENARIOS = [
  "network", "errors", "domain", "dupe", "verify-sent", 
  "verify-wrong", "verify-ok", "typed-sig", "incomplete", "expired"
];

async function checkNoOverlap(page: Page) {
  // Find all FloatFields that have a value
  const inputs = await page.locator('input:not([type="checkbox"])').all();
  for (const input of inputs) {
    const val = await input.inputValue();
    if (val) {
      // Find the associated label by ID
      const id = await input.getAttribute('id');
      if (id) {
        const label = await page.locator(`label[for="${id}"]`);
        const inputBbox = await input.boundingBox();
        const labelBbox = await label.boundingBox();
        if (inputBbox && labelBbox) {
          // Label Y should be significantly less than Input Y
          // specifically, the label center should be above the input text center
          expect(labelBbox.y).toBeLessThan(inputBbox.y - 10);
        }
      }
    }
  }
}

test.describe('Phase 2C: Dev Scenarios', () => {
  for (const s of SCENARIOS) {
    test(`Scenario ${s} works and is accessible`, async ({ page }) => {
      await page.goto(`/dev/scenarios?s=${s}`);

      // Accessibility
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);

      // No overlap check
      await checkNoOverlap(page);
      if (s === "network") {
        await expect(page.getByText('Network error: Could not connect to the server.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      } else if (s === "errors") {
        await expect(page.getByText('First name is required')).toBeVisible();
        await expect(page.getByText('Last name is required')).toBeVisible();
        await expect(page.getByText('Invalid email address')).toBeVisible();
      } else if (s === "domain") {
        await expect(page.getByText('This email isn\'t on')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Verify email' })).toBeVisible();
      } else if (s === "dupe") {
        await expect(page.getByText('is already pending approval')).toBeVisible();
      } else if (s === "verify-sent") {
        await expect(page.getByText('Enter the 6-digit code')).toBeVisible();
        await expect(page.getByText('Send a new code')).toBeVisible();
      } else if (s === "verify-wrong") {
        await expect(page.getByText('That code doesn\'t match.')).toBeVisible();
        await expect(page.getByText('2 attempts remaining')).toBeVisible();
      } else if (s === "verify-ok") {
        await expect(page.getByText('Email verified')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
      } else if (s === "typed-sig") {
        await expect(page.locator('input[name="signature.value"]')).toHaveValue('Jane Doe');
      } else if (s === "incomplete") {
        await expect(page.getByText('Consent is required')).toBeVisible();
        await expect(page.getByText('Signature is required')).toBeVisible();
      } else if (s === "expired") {
        await expect(page.getByText('Expired or too many attempts.')).toBeVisible();
        await expect(page.getByText('Send a new code')).toBeVisible();
      }

      // Desktop screenshot
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(200); // let animations settle
      await page.screenshot({ path: `screenshots/phase2c/${s}.png`, fullPage: true });

      // Mobile screenshot
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `screenshots/phase2c/${s}-375px.png`, fullPage: true });
    });
  }
});
