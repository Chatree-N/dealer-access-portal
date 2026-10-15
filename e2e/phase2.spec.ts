import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Client } from 'pg';
import path from 'path';
import fs from 'fs';

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
    const happyEmail = `happy.${Date.now()}@lotustelecom.example`;
    await page.getByLabel(/First name/).fill('Happy');
    await page.getByLabel(/Last name/).fill('Path');
    await page.getByLabel(/Email address/).fill(happyEmail);
    
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page.getByLabel(/Verification code/)).toBeVisible();
    
    // Fetch real OTP from Mailpit for happyEmail
    let otpCode = '';
    await expect.poll(async () => {
      const res = await page.request.get('http://localhost:8025/api/v1/messages');
      const data = await res.json();
      const msg = data.messages?.find((m: { To?: Array<{ Address: string }> }) =>
        m.To?.some((t) => t.Address.toLowerCase() === happyEmail.toLowerCase())
      );
      if (msg) {
        otpCode = msg.Snippet.match(/\b\d{6}\b/)?.[0] || '';
      }
      return otpCode;
    }).toMatch(/^\d{6}$/);

    await page.getByLabel(/Verification code/).fill(otpCode);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText('Email verified')).toBeVisible();
    
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Consent & Signature
    await checkAxe(page);
    await page.getByLabel(/I have read and agree to the terms and conditions/).check();
    await page.getByRole('button', { name: /type your name instead/i }).click();
    await page.getByLabel(/Signature \(typed\)/).fill('Happy Path');

    // Intercept submit request and response
    const submitPromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/request/submit')
    );
    await page.getByRole('button', { name: 'Submit request' }).click();
    const submitResp = await submitPromise;
    expect(submitResp.status()).toBe(200);

    const submitJson = await submitResp.json();
    expect(submitJson.requestId).toMatch(/^REQ-\d{4}$/);
    const submitBodyStr = JSON.stringify(submitJson);
    expect(submitBodyStr).not.toContain('http');
    expect(submitBodyStr).not.toContain('openchat');
    expect(submitBodyStr).not.toContain(happyEmail);

    // Step 4: Success
    await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible();
    await expect(page.getByText('REQ-')).toBeVisible();
    await checkAxe(page);

    // Assert no room URLs leaked
    const content = await page.content();
    expect(content).not.toContain('line' + '.me');
    expect(content).not.toContain('openchat.example/rooms');

    // Assert requests row exists with status pending_review
    const dbClient = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/openchat',
    });
    await dbClient.connect();
    const dbRes = await dbClient.query(
      'SELECT id, status, signature_ref, signature_kind FROM requests WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [happyEmail]
    );
    await dbClient.end();

    expect(dbRes.rows.length).toBe(1);
    const dbRow = dbRes.rows[0];
    expect(dbRow.status).toBe('pending_review');
    expect(dbRow.signature_kind).toBe('typed');

    // Assert signature file exists under STORAGE_DIR
    const storageDir = path.resolve(process.cwd(), process.env.STORAGE_DIR || '.data');
    const sigPath = path.join(storageDir, dbRow.signature_ref);
    expect(fs.existsSync(sigPath)).toBe(true);
    const sigContent = fs.readFileSync(sigPath, 'utf-8');
    expect(sigContent).toBe('Happy Path');
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

  test('real OTP flow via Mailpit: send, wrong code, correct code, resend cooldown', async ({ page }) => {
    await page.getByLabel(/Branch code/).fill('1234');
    await page.getByRole('button', { name: 'Verify branch code' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    const otpFlowEmail = 'real.otp.flow@lotustelecom.example';
    await page.getByLabel(/First name/).fill('A');
    await page.getByLabel(/Last name/).fill('B');
    await page.getByLabel(/Email address/).fill(otpFlowEmail);
    await page.getByRole('button', { name: 'Verify email' }).click();
    
    // Check that cooldown timer and input are displayed
    await expect(page.getByText(/Resend code in/i)).toBeVisible();
    await expect(page.getByLabel(/Verification code/)).toBeVisible();
    await checkAxe(page);

    // Fetch real code from Mailpit for otpFlowEmail
    let realCode = '';
    await expect.poll(async () => {
      const res = await page.request.get('http://localhost:8025/api/v1/messages');
      const data = await res.json();
      const msg = data.messages?.find((m: { To?: Array<{ Address: string }> }) =>
        m.To?.some((t) => t.Address.toLowerCase() === otpFlowEmail.toLowerCase())
      );
      if (msg) {
        realCode = msg.Snippet.match(/\b\d{6}\b/)?.[0] || '';
      }
      return realCode;
    }).toMatch(/^\d{6}$/);

    // Enter wrong code first
    await page.getByLabel(/Verification code/).fill('000000');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/That code doesn't match/i)).toBeVisible();
    await checkAxe(page);

    // Enter correct code from Mailpit
    await page.getByLabel(/Verification code/).fill(realCode);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/Email verified/i)).toBeVisible();
    await checkAxe(page);
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
