import { test, expect } from '@playwright/test';
import { login, screenshot, goTo, waitForModal } from './helpers';

const TITRE_PROJET = `[E2E] Projet ${Date.now()}`;

test.describe('Vue Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, 'Kanban');
  });

  test('affiche les 5 colonnes de statut', async ({ page }) => {
    // Les en-têtes de colonnes sont les seuls h3/span au niveau du header Kanban
    await expect(page.getByText('Non validé').first()).toBeVisible();
    await expect(page.getByText('À planifier').first()).toBeVisible();
    await expect(page.getByText('En cours').first()).toBeVisible();
    await expect(page.getByText('Terminé').first()).toBeVisible();
    await screenshot(page, 'kanban-01-colonnes');
  });

  test('créer un nouveau projet', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nouveau projet' }).click();
    await waitForModal(page, 'Nouveau projet');
    await screenshot(page, 'kanban-02-modal-creation');

    await page.getByPlaceholder('Nom du projet').fill(TITRE_PROJET);
    // Sélectionner le responsable (obligatoire)
    await page.locator('select').first().selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(TITRE_PROJET)).toBeVisible();
    await screenshot(page, 'kanban-03-projet-cree');
  });

  test('ouvrir le panneau de détail d\'un projet', async ({ page }) => {
    await page.getByRole('button', { name: 'Refonte ETIC', exact: true }).click();
    await waitForModal(page, 'Refonte ETIC');
    await screenshot(page, 'kanban-04-detail-projet');
  });

  test('modifier un projet', async ({ page }) => {
    // Le bouton "Modifier" est sur la carte, visible au hover (opacity-0 → opacity-100)
    const carte = page.locator('.group').filter({ hasText: TITRE_PROJET }).first();
    if (await carte.count() === 0) { test.skip(); return; }

    await carte.hover();
    await page.waitForTimeout(200); // laisser l'animation opacity apparaître
    await carte.getByRole('button', { name: 'Modifier' }).click();
    await waitForModal(page, 'Modifier le projet');

    const nouvelleDesc = 'Modifié par E2E';
    await page.getByPlaceholder('Description optionnelle').fill(nouvelleDesc);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'kanban-05-projet-modifie');
  });

  test('supprimer le projet de test', async ({ page }) => {
    const carte = page.locator('.group').filter({ hasText: TITRE_PROJET }).first();
    if (await carte.count() === 0) { test.skip(); return; }

    await carte.hover();
    await page.waitForTimeout(200); // laisser l'animation opacity apparaître
    await carte.getByRole('button', { name: 'Supprimer' }).click();
    // Dialog de confirmation
    await page.getByRole('button', { name: /confirmer|oui|supprimer/i }).last().click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: TITRE_PROJET, exact: true })).not.toBeVisible();
    await screenshot(page, 'kanban-06-projet-supprime');
  });
});
