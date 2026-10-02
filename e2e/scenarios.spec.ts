import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENARIOS = [
  "network", "errors", "domain", "dupe", "verify-sent", 
  "verify-wrong", "verify-ok", "typed-sig", "incomplete", "expired"
];

async function checkNoOverlap(page: Page) {
  // Find all FloatFields that have a value (uses fieldset/legend structure)
  const fieldsets = await page.locator('fieldset').all();
  for (const fieldset of fieldsets) {
    // Check if the fieldset contains an input with a value
    const input = fieldset.locator('input');
    const inputCount = await input.count();
    if (inputCount === 0) continue;
    const val = await input.first().inputValue().catch(() => '');
    if (!val) continue;

    // The legend contains the label text
    const legend = fieldset.locator('legend');
    const legendCount = await legend.count();
    if (legendCount === 0) continue;
    
    const inputBbox = await input.first().boundingBox();
    const legendBbox = await legend.first().boundingBox();
    if (inputBbox && legendBbox) {
      // The legend (label) bottom edge should be above or at the input top edge
      // (legend sits in the fieldset border notch, input text is below)
      const legendBottom = legendBbox.y + legendBbox.height;
      expect(legendBottom).toBeLessThanOrEqual(inputBbox.y + 4); // 4px tolerance for sub-pixel
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
        await expect(page.getByText("This email isn't on")).toBeVisible();
        await expect(page.getByRole('button', { name: 'Verify email' })).toBeVisible();
      } else if (s === "dupe") {
        await expect(page.getByText('A request for this email is already pending')).toBeVisible();
      } else if (s === "verify-sent") {
        await expect(page.getByText('Enter the 6-digit code')).toBeVisible();
        await expect(page.getByText('Send a new code')).toBeVisible();
      } else if (s === "verify-wrong") {
        await expect(page.getByText("That code doesn't match.")).toBeVisible();
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
