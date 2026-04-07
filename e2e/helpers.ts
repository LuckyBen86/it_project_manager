import { Page, expect } from '@playwright/test';

export const ADMIN = { email: 'admin@it-pm.local', password: 'Admin1234!', nom: 'Administrateur' };

export async function login(page: Page, user = ADMIN) {
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: false });
}

/** Le Modal component affiche son titre dans un h2 — on l'utilise comme proxy "dialog ouvert" */
export async function waitForModal(page: Page, title: string) {
  await expect(page.locator('h2').filter({ hasText: title })).toBeVisible({ timeout: 10000 });
}

/** Navigue via le menu principal */
export async function goTo(page: Page, section: 'Kanban' | 'Gantt' | 'Mes tâches' | 'Administration' | 'Corbeille') {
  await page.getByRole('link', { name: section }).click();
  await page.waitForLoadState('networkidle');
}
