import { test, expect } from '@playwright/test';
import { login, screenshot, goTo, ADMIN } from './helpers';

test.describe('Mes tâches', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
    await goTo(page, 'Mes tâches');
  });

  test('affiche la liste des tâches assignées', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mes tâches' })).toBeVisible();
    // Filtres de statut visibles
    await expect(page.getByRole('button', { name: 'Toutes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'À faire' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'En cours' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminé' })).toBeVisible();
    await screenshot(page, 'mes-taches-01-liste');
  });

  test('filtrer par statut', async ({ page }) => {
    await page.getByRole('button', { name: 'En cours' }).click();
    await page.waitForTimeout(300);
    await screenshot(page, 'mes-taches-02-filtre-en-cours');

    await page.getByRole('button', { name: 'Terminé' }).click();
    await page.waitForTimeout(300);
    await screenshot(page, 'mes-taches-03-filtre-termine');

    await page.getByRole('button', { name: 'Toutes' }).click();
  });

  test('changer le statut d\'une tâche via le select', async ({ page }) => {
    const taches = page.locator('[class*="rounded-xl"]').filter({ hasText: '+ Activité' });
    if (await taches.count() === 0) { test.skip(); return; }

    const select = taches.first().locator('select');
    const valeurActuelle = await select.inputValue();
    const nouvelleValeur = valeurActuelle === 'a_faire' ? 'en_cours' : 'a_faire';

    await select.selectOption(nouvelleValeur);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'mes-taches-04-statut-change');
    expect(await select.inputValue()).toBe(nouvelleValeur);

    // Remettre à l'état initial
    await select.selectOption(valeurActuelle);
    await page.waitForLoadState('networkidle');
  });

  test('ouvrir le formulaire d\'ajout d\'activité', async ({ page }) => {
    const taches = page.locator('[class*="rounded-xl"]').filter({ hasText: '+ Activité' });
    if (await taches.count() === 0) { test.skip(); return; }

    await taches.first().getByRole('button', { name: '+ Activité' }).click();
    await expect(page.getByPlaceholder(/développement|réunion/i)).toBeVisible();
    await screenshot(page, 'mes-taches-05-form-activite-ouvert');
  });

  test('ajouter une activité', async ({ page }) => {
    const taches = page.locator('[class*="rounded-xl"]').filter({ hasText: '+ Activité' });
    if (await taches.count() === 0) { test.skip(); return; }

    const tache = taches.first();
    await tache.getByRole('button', { name: '+ Activité' }).click();

    await page.getByPlaceholder(/développement|réunion/i).fill('Test E2E - activité automatique');
    await page.locator('input[type="date"]').first().fill('2026-03-01');
    await page.locator('input[type="number"]').first().fill('0.5');

    await screenshot(page, 'mes-taches-06-form-rempli');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForLoadState('networkidle');

    // Le formulaire se ferme après enregistrement
    await expect(page.getByPlaceholder(/développement|réunion/i)).not.toBeVisible({ timeout: 5000 });
    await screenshot(page, 'mes-taches-07-activite-ajoutee');
  });

  test('ouvrir le modal historique', async ({ page }) => {
    const taches = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Historique' });
    if (await taches.count() === 0) { test.skip(); return; }

    await taches.first().getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByText('Historique des activités')).toBeVisible();
    await screenshot(page, 'mes-taches-08-modal-historique');
  });

  test('modifier une activité dans le modal historique', async ({ page }) => {
    const taches = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Historique' });
    if (await taches.count() === 0) { test.skip(); return; }

    await taches.first().getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByText('Historique des activités')).toBeVisible();

    const modifierBtn = page.getByRole('button', { name: 'Modifier' }).first();
    if (!await modifierBtn.isVisible()) {
      console.log('Aucune activité modifiable (créées par un autre utilisateur)');
      await page.keyboard.press('Escape');
      return;
    }

    await modifierBtn.click();
    await screenshot(page, 'mes-taches-09-form-modifier');

    // Changer la date
    await page.locator('input[type="date"]').last().fill('2026-02-01');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForLoadState('networkidle');

    // Le formulaire se ferme = succès
    await expect(page.locator('input[type="date"]').last()).not.toBeVisible({ timeout: 5000 });
    await screenshot(page, 'mes-taches-10-activite-modifiee');
  });

  test('fermer le modal historique avec Échap', async ({ page }) => {
    const taches = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Historique' });
    if (await taches.count() === 0) { test.skip(); return; }

    await taches.first().getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByText('Historique des activités')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.getByText('Historique des activités')).not.toBeVisible();
    await screenshot(page, 'mes-taches-11-modal-ferme');
  });
});
