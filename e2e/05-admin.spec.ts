import { test, expect } from '@playwright/test';
import { login, screenshot, goTo, waitForModal } from './helpers';

const TS = Date.now();
const CAT_TEST = `[E2E] Cat ${TS}`;
const RESSOURCE_TEST = {
  nom: `E2E User ${TS}`,
  email: `e2e.${TS}@test.local`,
  password: 'Test1234!',
};

test.describe('Administration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, 'Administration');
  });

  // ── Ressources ─────────────────────────────────────────────────────────────

  test('liste les ressources existantes', async ({ page }) => {
    // Chercher "Administrateur" dans le tableau (pas dans le header de nav)
    await expect(page.locator('table').getByText('Administrateur', { exact: true })).toBeVisible();
    await screenshot(page, 'admin-01-liste-ressources');
  });

  test('créer une nouvelle ressource', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nouvelle ressource' }).click();
    await waitForModal(page, 'Nouvelle ressource');
    await screenshot(page, 'admin-02-modal-ressource');

    await page.getByPlaceholder('Prénom Nom').fill(RESSOURCE_TEST.nom);
    await page.getByPlaceholder('prenom.nom@entreprise.fr').fill(RESSOURCE_TEST.email);
    await page.getByPlaceholder('8 caractères minimum').fill(RESSOURCE_TEST.password);

    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(RESSOURCE_TEST.nom)).toBeVisible();
    await screenshot(page, 'admin-03-ressource-creee');
  });

  test('modifier le rôle d\'une ressource', async ({ page }) => {
    const row = page.locator('tr').filter({ hasText: RESSOURCE_TEST.nom });
    if (await row.count() === 0) { test.skip(); return; }

    await row.getByRole('button', { name: /modifier/i }).click();
    await waitForModal(page, 'Modifier la ressource');

    await page.locator('select').filter({ hasText: /utilisateur|responsable/i }).selectOption('responsable');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'admin-04-role-modifie');
  });

  // ── Catégories ─────────────────────────────────────────────────────────────

  test('liste les catégories existantes', async ({ page }) => {
    await page.getByRole('button', { name: 'Catégories' }).click();
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'admin-05-liste-categories');
    // Au moins une catégorie présente
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('créer une catégorie de projet', async ({ page }) => {
    await page.getByRole('button', { name: 'Catégories' }).click();
    await page.getByRole('button', { name: '+ Nouvelle catégorie' }).click();
    await waitForModal(page, 'Nouvelle catégorie');
    await screenshot(page, 'admin-06-modal-categorie');

    await page.getByPlaceholder('ex: Infrastructure').fill(CAT_TEST);
    await page.locator('select').selectOption('projet');

    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(CAT_TEST)).toBeVisible();
    await screenshot(page, 'admin-07-categorie-creee');
  });

  test('supprimer la catégorie de test', async ({ page }) => {
    await page.getByRole('button', { name: 'Catégories' }).click();
    await page.waitForLoadState('networkidle');

    const row = page.locator('tr').filter({ hasText: CAT_TEST });
    if (await row.count() === 0) { test.skip(); return; }

    await row.getByRole('button', { name: /supprimer/i }).click();
    // ConfirmDialog
    await page.getByRole('button', { name: /confirmer|supprimer|oui/i }).last().click();
    await page.waitForLoadState('networkidle');

    // Vérifier que la ligne de la table (pas le dialog) ne contient plus la catégorie
    await expect(page.locator('table td').filter({ hasText: CAT_TEST })).not.toBeVisible();
    await screenshot(page, 'admin-08-categorie-supprimee');
  });
});
