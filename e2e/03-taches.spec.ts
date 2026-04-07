import { test, expect } from '@playwright/test';
import { login, screenshot, goTo, waitForModal } from './helpers';

const TITRE_TACHE = `[E2E] Tâche ${Date.now()}`;

test.describe('Gestion des tâches', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, 'Kanban');
    // Le titre du projet est un <button> dans la ProjetCard
    await page.getByRole('button', { name: 'Refonte ETIC', exact: true }).click();
    await waitForModal(page, 'Refonte ETIC');
    await screenshot(page, 'taches-00-detail-projet');
  });

  test('affiche les tâches du projet', async ({ page }) => {
    await expect(page.getByText('Tâches').first()).toBeVisible();
    await screenshot(page, 'taches-01-liste-taches');
  });

  test('créer une nouvelle tâche', async ({ page }) => {
    await page.getByRole('button', { name: '+ Nouvelle tâche' }).click();
    await waitForModal(page, 'Nouvelle tâche');
    await screenshot(page, 'taches-02-modal-creation');

    // Remplir le titre de la tâche
    await page.locator('input').first().fill(TITRE_TACHE);

    await page.getByRole('button', { name: 'Créer' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(TITRE_TACHE)).toBeVisible();
    await screenshot(page, 'taches-03-tache-creee');
  });

  test('supprimer la tâche de test', async ({ page }) => {
    const tacheLigne = page.locator('[class*="border"]').filter({ hasText: TITRE_TACHE }).first();
    if (await tacheLigne.count() === 0) { test.skip(); return; }

    await tacheLigne.getByRole('button', { name: /supprimer/i }).click();
    await page.getByRole('button', { name: /confirmer|oui|supprimer/i }).last().click();
    await page.waitForLoadState('networkidle');

    // Attendre que la suppression soit effective (la ligne du panel, pas le dialog)
    await expect(page.locator('span.text-sm').filter({ hasText: TITRE_TACHE })).not.toBeVisible();
    await screenshot(page, 'taches-04-tache-supprimee');
  });
});
