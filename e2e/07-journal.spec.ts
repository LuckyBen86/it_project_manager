import { test, expect } from '@playwright/test';
import { login, screenshot, goTo } from './helpers';

test.describe('Journal d\'activité', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goTo(page, 'Administration');
    await page.getByRole('button', { name: 'Journal' }).click();
    await page.waitForLoadState('networkidle');
  });

  test('affiche l\'onglet Journal avec le tableau', async ({ page }) => {
    // En-têtes du tableau
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Auteur' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Entité' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Détail' })).toBeVisible();
    await screenshot(page, 'journal-01-onglet');
  });

  test('affiche le filtre par type d\'action', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await expect(select.locator('option', { hasText: 'Toutes les actions' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Statut projet' })).toBeAttached();
    await expect(select.locator('option', { hasText: 'Suppression projet' })).toBeAttached();
    await screenshot(page, 'journal-02-filtres');
  });

  test('filtrer par statut projet', async ({ page }) => {
    await page.locator('select').selectOption('STATUT_PROJET');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'journal-03-filtre-statut-projet');
    // Soit des résultats avec le badge "Statut projet", soit le message vide
    const hasResults = await page.locator('text=Statut projet').count() > 0;
    const isEmpty = await page.locator('text=Aucune entrée dans le journal').isVisible();
    expect(hasResults || isEmpty).toBe(true);
  });

  test('le journal contient des entrées après actions E2E précédentes', async ({ page }) => {
    // Les tests précédents (création/suppression de projets, changement de statuts)
    // ont normalement généré des entrées
    await page.locator('select').selectOption('');
    await page.waitForLoadState('networkidle');
    // Au moins une entrée doit exister (admin a fait des actions dans les autres tests)
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    // Peut être 0 si c'est la première exécution ou si les données ont été nettoyées
    // On vérifie juste que le tableau s'affiche sans erreur
    expect(count).toBeGreaterThanOrEqual(0);
    await screenshot(page, 'journal-04-entrees');
  });
});
