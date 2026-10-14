import { test, expect, type Page } from '@playwright/test';

test.describe('Phase 2 Screenshots', () => {
  const takeScreenshots = async (page: Page, name: string) => {
    await page.waitForTimeout(500); // Wait for fonts and animations
    
    // Desktop (1440px per ADR 15)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `screenshots/phase2/${name}.png`, fullPage: true });
  };

  test('generate screenshots', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.199' });
    await page.goto('/');
    
    // Step 1: Branch found (1234)
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.waitForTimeout(500); // wait for lookup
    await takeScreenshots(page, 'step1-found');

    // Step 1: Branch not found (0000 / 9999)
    await page.goto('/');
    await page.getByLabel(/Branch code/).fill('0000');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step1-notfound');

    // Resume full flow from step 1 found
    await page.goto('/');
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.waitForTimeout(500);
    
    // Step 2: Details
    const screenshotEmail = 'screenshot.user@lotustelecom.example';
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/First name/).fill('Happy');
    await page.getByLabel(/Last name/).fill('Path');
    await page.getByLabel(/Email address/).fill(screenshotEmail);
    
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page.getByLabel(/Verification code/)).toBeVisible();
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step2-sent');

    // Wrong code attempt for screenshot
    await page.getByLabel(/Verification code/).fill('000000');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/That code doesn't match/i)).toBeVisible();
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step2-wrong');

    // Fetch real code from Mailpit for screenshotEmail
    let realCode = '';
    await expect.poll(async () => {
      const res = await page.request.get('http://localhost:8025/api/v1/messages');
      const data = await res.json();
      const msg = data.messages?.find((m: { To?: Array<{ Address: string }> }) =>
        m.To?.some((t) => t.Address.toLowerCase() === screenshotEmail.toLowerCase())
      );
      if (msg) {
        realCode = msg.Snippet.match(/\b\d{6}\b/)?.[0] || '';
      }
      return realCode;
    }).toMatch(/^\d{6}$/);

    // Verify with real code
    await page.getByLabel(/Verification code/).fill(realCode);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/Email verified/i)).toBeVisible();
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

    // Step 1: Rate limited (exceeded 10 requests / min)
    const rateLimitIp = '198.51.100.77';
    for (let i = 0; i < 11; i++) {
      await page.request.post('/api/branch/lookup', {
        headers: { 'x-forwarded-for': rateLimitIp },
        data: { branchCode: '1234' },
      });
    }
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': rateLimitIp });
    await page.goto('/');
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.waitForTimeout(500);
    await takeScreenshots(page, 'step1-ratelimited');
  });
});
