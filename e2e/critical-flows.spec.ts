import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /tenjint6/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('logs in with dev credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dev@tenjint6.local');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/scripts/).first()).toBeVisible();
  });

  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dev@tenjint6.local');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/$/);
  });

  test('shows project list', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });
});

test.describe('Schedules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dev@tenjint6.local');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/$/);
  });

  test('shows schedule builder with cron presets', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('h3').first().click();
    await page.waitForURL(/\/projects\//);
    await page.getByRole('link', { name: /schedules/i }).click();
    await page.getByRole('button', { name: /new schedule/i }).click();
    await expect(page.getByText('Cron Expression').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Every 5 minutes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Every hour' })).toBeVisible();
    await page.getByRole('button', { name: 'Every hour' }).click();
    await expect(page.locator('input[value="0 * * * *"]')).toBeVisible();
  });
});
