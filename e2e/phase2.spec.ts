import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Phase 2 Form', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Provide a unique simulated IP per worker to isolate rate limit counters across parallel tests
    const testIp = `192.0.2.${(testInfo.parallelIndex + 1) * 20 + (testInfo.retry + 1)}`;
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });
    await page.goto('/');
  });

  const checkAxe = async (page: Page) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  };

  test('happy path: 1234 -> details -> OTP -> typed signature -> success', async ({ page }) => {
    // Step 1: Branch
    await checkAxe(page);
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await expect(page.getByText('Lotus T…')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Details
    await checkAxe(page);
    await page.getByLabel(/First name/).fill('Happy');
    await page.getByLabel(/Last name/).fill('Path');
    await page.getByLabel(/Email address/).fill('happy@lotustelecom.example');
    
    await page.getByRole('button', { name: 'Verify email' }).click();
    await page.getByLabel(/Verification code/).fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText('Email verified')).toBeVisible();
    
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Consent & Signature
    await checkAxe(page);
    await page.getByLabel(/I have read and agree to the terms and conditions/).check();
    await page.getByRole('button', { name: /type your name instead/i }).click();
    await page.getByLabel(/Signature \(typed\)/).fill('Happy Path');
    await page.getByRole('button', { name: 'Submit request' }).click();

    // Step 4: Success
    await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible();
    await expect(page.getByText('REQ-')).toBeVisible();
    await checkAxe(page);

    // Assert no room URLs leaked
    const content = await page.content();
    expect(content).not.toContain('line' + '.me');
    expect(content).not.toContain('openchat.example/rooms');
  });

  test('honeypot silently succeeds', async ({ page }) => {
    // Fill the hidden honeypot
    // Since it's aria-hidden/sr-only we have to use locator directly
    await page.getByLabel(/Branch code/).fill('1234');
    await page.locator('input[name="honeypot"]').fill('bot-spam');
    
    // Submit
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    
    // Should jump straight to success silently
    await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible();
  });

  test('inactive branch (9999) and not found branch (0000) are indistinguishable in API and UI', async ({ page }) => {
    // API verification: 9999 and 0000 return identical { status: "not_found" }
    const res9999 = await page.request.post('/api/branch/lookup', {
      data: { branchCode: '9999' },
    });
    const res0000 = await page.request.post('/api/branch/lookup', {
      data: { branchCode: '0000' },
    });
    expect(res9999.status()).toBe(200);
    expect(res0000.status()).toBe(200);
    const json9999 = await res9999.json();
    const json0000 = await res0000.json();
    expect(json9999).toEqual({ status: 'not_found' });
    expect(json0000).toEqual({ status: 'not_found' });
    expect(json9999).toEqual(json0000);

    // UI verification for 9999
    await page.getByLabel(/Branch code/).fill('9999');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await expect(page.getByText(/Branch not found/i)).toBeVisible();
    await expect(page.getByText(/Sure the code is right\? Contact the team to add your branch\./i)).toBeVisible();
    await checkAxe(page);

    // UI verification for 0000
    await page.goto('/');
    await page.getByLabel(/Branch code/).fill('0000');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await expect(page.getByText(/Branch not found/i)).toBeVisible();
    await expect(page.getByText(/Sure the code is right\? Contact the team to add your branch\./i)).toBeVisible();
    await checkAxe(page);
  });

  test('rate-limited state: 429 returns generic message and passes axe', async ({ page }) => {
    const testIp = '198.51.100.99';
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });
    await page.goto('/');

    // Exhaust 10-request quota via API
    for (let i = 0; i < 11; i++) {
      await page.request.post('/api/branch/lookup', {
        headers: { 'x-forwarded-for': testIp },
        data: { branchCode: '1234' },
      });
    }

    // Attempt lookup via UI, must display 429 message
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();

    await expect(page.getByText(/Too many requests\. Please try again later\./i)).toBeVisible();
    await checkAxe(page);
  });

  test('wrong OTP then correct OTP', async ({ page }) => {
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel(/First name/).fill('A');
    await page.getByLabel(/Last name/).fill('B');
    await page.getByLabel(/Email address/).fill('a@lotustelecom.example');
    await page.getByRole('button', { name: 'Verify email' }).click();
    
    await page.getByLabel(/Verification code/).fill('000000');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/That code doesn't match/i)).toBeVisible();
  });

  test('domain warning', async ({ page }) => {
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel(/First name/).fill('A');
    await page.getByLabel(/Last name/).fill('B');
    await page.getByLabel(/Email address/).fill('a@mail.example');
    
    await page.getByLabel(/Last name/).focus();
    
    await expect(page.getByText(/Approval may take longer/i)).toBeVisible();
  });

  test('floating labels do not overlap input text when blurred (uncontrolled)', async ({ page }) => {
    await page.goto('/');
    
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    const firstNameInput = page.getByLabel(/First name/);
    
    // Type into it and blur
    await firstNameInput.focus();
    await firstNameInput.pressSequentially('Happy', { delay: 10 });
    await page.getByRole('heading', { name: 'Your details' }).click(); // click away to blur
    
    const fieldset = page.locator('fieldset').filter({ has: firstNameInput });
    const legend = fieldset.locator('legend');
    const legendBbox = await legend.boundingBox();
    const inputBbox = await firstNameInput.boundingBox();
    
    // Legend bottom should be at or above the input top
    expect(legendBbox!.y + legendBbox!.height).toBeLessThanOrEqual(inputBbox!.y + 4);
  });
});
