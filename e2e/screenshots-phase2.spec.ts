import { test, type Page } from '@playwright/test';

test.describe('Phase 2 Screenshots', () => {
  const takeScreenshots = async (page: Page, name: string) => {
    await page.waitForTimeout(500); // Wait for fonts and animations
    
    // Desktop (1440px per ADR 15)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `screenshots/phase2/${name}.png`, fullPage: true });
  };

  test('generate screenshots', async ({ page }) => {
    await page.goto('/');
    
    // Step 1: Branch found
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.waitForTimeout(500); // wait for lookup
    await takeScreenshots(page, 'step1-found');
    
    // Step 2: Details
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/First name/).fill('Happy');
    await page.getByLabel(/Last name/).fill('Path');
    await page.getByLabel(/Email address/).fill('happy@lotustelecom.example');
    await page.getByRole('button', { name: 'Verify email' }).click();
    await page.getByLabel(/Verification code/).fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step2-verified');

    // Step 3: Consent & Signature
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step3-signature');
    await page.getByLabel(/I have read and agree to the terms and conditions/).check();
    await page.getByRole('button', { name: /type your name instead/i }).click();
    await page.getByLabel(/Signature \(typed\)/).fill('Happy Path');
    await page.getByRole('button', { name: 'Submit request' }).click();

    // Step 4: Success
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step4-success');
  });
});
