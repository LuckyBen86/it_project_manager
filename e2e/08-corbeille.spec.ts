import { test, expect } from '@playwright/test';
import { login, screenshot, goTo } from './helpers';

const TITRE_PROJET = `[E2E] Corbeille Projet ${Date.now()}`;
const TITRE_TACHE = `[E2E] Corbeille Tâche ${Date.now()}`;

test.describe('Corbeille', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('affiche la page corbeille vide ou avec des éléments', async ({ page }) => {
    await goTo(page, 'Corbeille');
    await expect(page.getByRole('heading', { name: 'Mes éléments supprimés' })).toBeVisible();
    await screenshot(page, 'corbeille-01-page');
  });

  test('cycle complet : créer projet → supprimer → restaurer', async ({ page }) => {
    // 1. Créer un projet
    await goTo(page, 'Kanban');
    await page.getByRole('button', { name: '+ Nouveau projet' }).click();
    await page.getByPlaceholder('Nom du projet').fill(TITRE_PROJET);
    await page.locator('select').first().selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TITRE_PROJET)).toBeVisible();
    await screenshot(page, 'corbeille-02-projet-cree');

    // 2. Supprimer le projet (hover → Supprimer)
    const carte = page.locator('.group').filter({ hasText: TITRE_PROJET }).first();
    await carte.hover();
    await page.waitForTimeout(200);
    await carte.getByRole('button', { name: 'Supprimer' }).click();
    await page.getByRole('button', { name: /confirmer|oui|supprimer/i }).last().click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: TITRE_PROJET, exact: true })).not.toBeVisible();
    await screenshot(page, 'corbeille-03-projet-supprime');

    // 3. Vérifier qu'il est dans la corbeille
    await goTo(page, 'Corbeille');
    await expect(page.getByText(TITRE_PROJET)).toBeVisible();
    await screenshot(page, 'corbeille-04-projet-en-corbeille');

    // 4. Restaurer
    const row = page.locator('div').filter({ hasText: TITRE_PROJET }).last();
    await row.getByRole('button', { name: 'Restaurer' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TITRE_PROJET)).not.toBeVisible();
    await screenshot(page, 'corbeille-05-projet-restaure');

    // 5. Vérifier que le projet est de retour dans le Kanban
    await goTo(page, 'Kanban');
    await expect(page.getByText(TITRE_PROJET)).toBeVisible();
    await screenshot(page, 'corbeille-06-projet-de-retour');

    // Nettoyage : supprimer le projet restauré
    const carteRestauree = page.locator('.group').filter({ hasText: TITRE_PROJET }).first();
    await carteRestauree.hover();
    await page.waitForTimeout(200);
    await carteRestauree.getByRole('button', { name: 'Supprimer' }).click();
    await page.getByRole('button', { name: /confirmer|oui|supprimer/i }).last().click();
    await page.waitForLoadState('networkidle');
  });

  test('cycle complet : créer tâche → supprimer → restaurer', async ({ page }) => {
    // 1. Ouvrir un projet existant et créer une tâche
    await goTo(page, 'Kanban');
    await page.getByRole('button', { name: 'Refonte ETIC', exact: true }).click();
    await page.locator('h2').filter({ hasText: 'Refonte ETIC' }).waitFor({ state: 'visible', timeout: 10000 });

    await page.getByRole('button', { name: '+ Nouvelle tâche' }).click();
    await page.locator('h2').filter({ hasText: 'Nouvelle tâche' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input').first().fill(TITRE_TACHE);
    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TITRE_TACHE)).toBeVisible();
    await screenshot(page, 'corbeille-07-tache-creee');

    // 2. Supprimer la tâche
    const tacheLigne = page.locator('[class*="border"]').filter({ hasText: TITRE_TACHE }).first();
    await tacheLigne.getByRole('button', { name: /supprimer/i }).click();
    await page.getByRole('button', { name: /confirmer|oui|supprimer/i }).last().click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('span.text-sm').filter({ hasText: TITRE_TACHE })).not.toBeVisible();
    await screenshot(page, 'corbeille-08-tache-supprimee');

    // 3. Vérifier corbeille
    await goTo(page, 'Corbeille');
    await expect(page.getByText(TITRE_TACHE)).toBeVisible();
    await screenshot(page, 'corbeille-09-tache-en-corbeille');

    // 4. Restaurer
    const rowTache = page.locator('div').filter({ hasText: TITRE_TACHE }).last();
    await rowTache.getByRole('button', { name: 'Restaurer' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TITRE_TACHE)).not.toBeVisible();
    await screenshot(page, 'corbeille-10-tache-restauree');
  });
});
