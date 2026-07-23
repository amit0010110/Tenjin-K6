import { test, expect } from '@playwright/test';

test.describe('SLA Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dev@tenjint6.local');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/$/);
    // Navigate into the first project
    await page.goto('/projects');
    await page.locator('h3').first().click();
    await page.waitForURL(/\/projects\//);
  });

  test('shows SLA page with empty state', async ({ page }) => {
    await page.getByRole('link', { name: /sla/i }).click();
    await page.waitForURL(/\/sla$/);
    await expect(page.getByText(/no sla rules yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create sla rule/i })).toBeVisible();
  });

  test('creates an SLA rule', async ({ page }) => {
    await page.getByRole('link', { name: /sla/i }).click();
    await page.waitForURL(/\/sla$/);

    await page.getByRole('button', { name: /new sla/i }).click();
    await expect(page.getByText(/create sla rule/i)).toBeVisible();

    await page.locator('input').first().fill('P95 under 200ms');
    await page.getByRole('button', { name: /create rule/i }).click();

    await expect(page.getByText('P95 under 200ms')).toBeVisible();
  });

  test('toggles an SLA rule', async ({ page }) => {
    await page.getByRole('link', { name: /sla/i }).click();
    await page.waitForURL(/\/sla$/);

    // Create first if not exists
    const body = await page.locator('body').textContent();
    if (body?.includes('No SLA rules yet')) {
      await page.getByRole('button', { name: /new sla/i }).click();
      await page.locator('input').first().fill('Toggle Test Rule');
      await page.getByRole('button', { name: /create rule/i }).click();
      await expect(page.getByText('Toggle Test Rule')).toBeVisible();
    }

    // Click the toggle button (first toggle icon)
    const toggleBtn = page.getByTitle(/enable|disable/i).first();
    await toggleBtn.click();
    // After toggling, the rule should still exist
    await expect(page.getByText(/toggle test rule|p95 under 200ms/i).first()).toBeVisible();
  });

  test('checks SLA compliance status', async ({ page }) => {
    await page.getByRole('link', { name: /sla/i }).click();
    await page.waitForURL(/\/sla$/);

    // Create a rule first if empty
    const body = await page.locator('body').textContent();
    if (body?.includes('No SLA rules yet')) {
      await page.getByRole('button', { name: /new sla/i }).click();
      await page.locator('input').first().fill('Status Check Rule');
      await page.getByRole('button', { name: /create rule/i }).click();
      await expect(page.getByText('Status Check Rule')).toBeVisible();
    }

    await page.getByRole('button', { name: /check status/i }).click();
    // Should show stat cards after checking
    await expect(page.getByText(/compliant/i).first()).toBeVisible();
  });
});

test.describe('SLA Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dev@tenjint6.local');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/$/);
    await page.goto('/projects');
    await page.locator('h3').first().click();
    await page.waitForURL(/\/projects\//);
  });

  test('generates SLA report', async ({ page }) => {
    await page.getByRole('link', { name: /sla/i }).click();
    await page.waitForURL(/\/sla$/);

    // Create a rule first if empty
    const body = await page.locator('body').textContent();
    if (body?.includes('No SLA rules yet')) {
      await page.getByRole('button', { name: /new sla/i }).click();
      await page.locator('input').first().fill('Report Test Rule');
      await page.getByRole('button', { name: /create rule/i }).click();
      await expect(page.getByText('Report Test Rule')).toBeVisible();
    }

    // Generate report from the management page
    await page.getByRole('button', { name: /generate report/i }).click();
    await expect(page.getByText(/sla compliance report/i)).toBeVisible();
    await expect(page.getByText(/overall compliance/i)).toBeVisible();
  });

  test('views SLA report page', async ({ page }) => {
    // Create a rule first via management page
    await page.getByRole('link', { name: /sla/i }).click();
    await page.waitForURL(/\/sla$/);
    const body = await page.locator('body').textContent();
    if (body?.includes('No SLA rules yet')) {
      await page.getByRole('button', { name: /new sla/i }).click();
      await page.locator('input').first().fill('Report page rule');
      await page.getByRole('button', { name: /create rule/i }).click();
      await expect(page.getByText('Report page rule')).toBeVisible();
    }

    // Navigate to the report sub-page
    await page.goto(page.url() + '/report');
    await expect(page.getByText(/sla reports/i)).toBeVisible();
    await expect(page.getByText(/compliance report/i)).toBeVisible();
  });
});
