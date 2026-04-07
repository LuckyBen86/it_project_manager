import { test, expect } from '@playwright/test';
import { login, screenshot, ADMIN } from './helpers';

test.describe('Authentification', () => {
  test('affiche la page de login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await screenshot(page, 'auth-01-page-login');
  });

  test('refus avec mauvais mot de passe', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN.email);
    await page.fill('input[type="password"]', 'mauvaismdp');
    await page.click('button[type="submit"]');
    // Doit rester sur login et afficher une erreur
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/login/);
    await screenshot(page, 'auth-02-erreur-login');
  });

  test('login admin réussi', async ({ page }) => {
    await login(page);
    // Menu admin visible
    await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible();
    // Badge rôle visible
    await expect(page.getByText('Responsable')).toBeVisible();
    await screenshot(page, 'auth-03-login-reussi');
  });

  test('déconnexion', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /déconnexion/i }).click();
    await expect(page).toHaveURL(/login/);
    await screenshot(page, 'auth-04-deconnexion');
  });

  test('accès refusé sans token (redirection login)', async ({ page }) => {
    // Accès direct sans être connecté
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });
});
