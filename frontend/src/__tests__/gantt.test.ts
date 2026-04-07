import { describe, it, expect } from 'vitest';
import { addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  dateToOffset,
  getDayWidth,
  getTimelineStart,
  businessDaysWidth,
  countBusinessDays,
  addBusinessDays,
  isWeekend,
  WEEKEND_WIDTH,
} from '../lib/gantt.ts';

// Lundi 6 janvier 2025
const LUNDI = new Date('2025-01-06');
const DAY_W = 40;

describe('isWeekend', () => {
  it('détecte samedi et dimanche', () => {
    expect(isWeekend(new Date('2025-01-04'))).toBe(true);  // samedi
    expect(isWeekend(new Date('2025-01-05'))).toBe(true);  // dimanche
    expect(isWeekend(new Date('2025-01-06'))).toBe(false); // lundi
    expect(isWeekend(new Date('2025-01-10'))).toBe(false); // vendredi
  });
});

describe('dateToOffset', () => {
  it('retourne 0 pour la date de début', () => {
    expect(dateToOffset(LUNDI, LUNDI, DAY_W)).toBe(0);
  });

  it('retourne 5*DAY_W pour +5 jours ouvrés (lun→sam)', () => {
    // Lun Mar Mer Jeu Ven = 5 jours ouvrés, Sam = weekend
    const vendredi = addDays(LUNDI, 4); // vendredi
    expect(dateToOffset(vendredi, LUNDI, DAY_W)).toBe(4 * DAY_W);
  });

  it('intègre les week-ends intercalaires avec WEEKEND_WIDTH', () => {
    // Lun (40) + Mar (40) + Mer (40) + Jeu (40) + Ven (40) + Sam (4) + Dim (4) + Lun suivant
    const lundiSuivant = addDays(LUNDI, 7);
    const expected = 5 * DAY_W + 2 * WEEKEND_WIDTH;
    expect(dateToOffset(lundiSuivant, LUNDI, DAY_W)).toBe(expected);
  });
});

describe('addBusinessDays', () => {
  it('saute les week-ends', () => {
    const vendredi = addDays(LUNDI, 4); // vendredi
    const result = addBusinessDays(vendredi, 1);
    expect(result.getDay()).toBe(1); // lundi suivant
  });

  it('ajoute 5 jours ouvrés depuis lundi = lundi suivant', () => {
    const result = addBusinessDays(LUNDI, 5);
    expect(result.toDateString()).toBe(addDays(LUNDI, 7).toDateString());
  });
});

describe('countBusinessDays', () => {
  it('compte 5 jours ouvrés sur une semaine complète', () => {
    expect(countBusinessDays(LUNDI, addDays(LUNDI, 7))).toBe(5);
  });

  it('ne compte pas les week-ends', () => {
    const samedi = addDays(LUNDI, 5);
    const dimanche = addDays(LUNDI, 6);
    expect(countBusinessDays(LUNDI, samedi)).toBe(5); // lun-ven
    expect(countBusinessDays(samedi, dimanche)).toBe(0);
  });
});

describe('businessDaysWidth', () => {
  it('5 jours ouvrés depuis lundi = 5*DAY_W + 2*WEEKEND_WIDTH (week-end inclus)', () => {
    // Lun+Mar+Mer+Jeu+Ven = 5 ouvrés, mais inclut Sam+Dim en largeur réduite
    const w = businessDaysWidth(LUNDI, 5, DAY_W);
    expect(w).toBe(5 * DAY_W + 2 * WEEKEND_WIDTH);
  });

  it('retourne 0 pour 0 jours', () => {
    expect(businessDaysWidth(LUNDI, 0, DAY_W)).toBe(0);
  });
});

describe('getDayWidth', () => {
  it('retourne 40 pour semaine', () => expect(getDayWidth('semaine')).toBe(40));
  it('retourne 14 pour mois', () => expect(getDayWidth('mois')).toBe(14));
});

describe('getTimelineStart', () => {
  it('retourne le lundi pour zoom semaine', () => {
    const ref = new Date('2025-01-08'); // mercredi
    const result = getTimelineStart('semaine', ref);
    expect(result.toDateString()).toBe(startOfWeek(ref, { locale: fr }).toDateString());
  });
});
