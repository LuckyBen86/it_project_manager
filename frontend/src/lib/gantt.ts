import { addDays, differenceInDays, startOfWeek, startOfMonth, addWeeks, addMonths, format } from 'date-fns';
import type { Tache } from './types.ts';
import { fr } from 'date-fns/locale';

export type ZoomLevel = 'semaine' | 'mois';

export const DAY_WIDTH_SEMAINE = 40;  // px par jour ouvré en zoom semaine
export const DAY_WIDTH_MOIS = 14;     // px par jour ouvré en zoom mois
export const WEEKEND_WIDTH = 4;       // px pour samedi/dimanche (séparateur visuel)

export function getDayWidth(zoom: ZoomLevel): number {
  return zoom === 'semaine' ? DAY_WIDTH_SEMAINE : DAY_WIDTH_MOIS;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Largeur réelle en px d'un jour donné */
export function getActualDayWidth(date: Date, dayWidth: number): number {
  return isWeekend(date) ? WEEKEND_WIDTH : dayWidth;
}

/** Offset en px depuis start jusqu'à date */
export function dateToOffset(date: Date, start: Date, dayWidth: number): number {
  const totalDays = differenceInDays(date, start);
  if (totalDays <= 0) return 0;
  let offset = 0;
  for (let i = 0; i < totalDays; i++) {
    offset += getActualDayWidth(addDays(start, i), dayWidth);
  }
  return offset;
}

/** Date à partir d'un offset en px (snap au prochain jour ouvré) */
export function offsetToDate(offset: number, start: Date, dayWidth: number): Date {
  let accumulated = 0;
  let i = 0;
  while (i <= 365) {
    const d = addDays(start, i);
    const w = getActualDayWidth(d, dayWidth);
    if (accumulated + w > offset) {
      // Snap au prochain jour ouvré si on tombe sur un week-end
      let result = d;
      while (isWeekend(result)) result = addDays(result, 1);
      return result;
    }
    accumulated += w;
    i++;
  }
  return start;
}

/** Largeur en px pour N jours ouvrés à partir d'une date */
export function businessDaysWidth(startDate: Date, numDays: number, dayWidth: number): number {
  if (!numDays || numDays <= 0) return 0;
  let width = 0;
  let added = 0;
  let current = new Date(startDate);
  // On couvre les jours ouvrés + les week-ends intercalaires
  while (added < numDays) {
    width += getActualDayWidth(current, dayWidth);
    if (!isWeekend(current)) added++;
    current = addDays(current, 1);
  }
  return width;
}

/** Ajoute N jours ouvrés à une date */
export function addBusinessDays(date: Date, days: number): Date {
  let result = new Date(date);
  let added = 0;
  while (added < days) {
    result = addDays(result, 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

/** Compte les jours ouvrés entre deux dates */
export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  let current = new Date(start);
  while (current < end) {
    if (!isWeekend(current)) count++;
    current = addDays(current, 1);
  }
  return count;
}

export function getTimelineStart(zoom: ZoomLevel, refDate: Date): Date {
  return zoom === 'semaine'
    ? startOfWeek(refDate, { locale: fr })
    : startOfMonth(refDate);
}

/** Calcule le tableau des offsets réels pour chaque jour (à partir de timelineStart) */
export interface DayColumn {
  date: Date;
  offsetPx: number;
  widthPx: number;
  isWeekend: boolean;
}

export function buildDayColumns(start: Date, totalDays: number, dayWidth: number): DayColumn[] {
  const columns: DayColumn[] = [];
  let offset = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const weekend = isWeekend(d);
    const w = weekend ? WEEKEND_WIDTH : dayWidth;
    columns.push({ date: d, offsetPx: offset, widthPx: w, isWeekend: weekend });
    offset += w;
  }
  return columns;
}

export interface TimelineHeader {
  label: string;
  offsetPx: number;
  widthPx: number;
}

/**
 * Trie les tâches en ordre topologique : les prédécesseurs apparaissent toujours
 * avant leurs dépendants. Les cycles éventuels sont ignorés gracieusement.
 */
export function sortTasksTopologically(tasks: Tache[]): Tache[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const sorted: Tache[] = [];
  const visited = new Set<string>();

  const visit = (task: Tache, stack = new Set<string>()) => {
    if (visited.has(task.id)) return;
    if (stack.has(task.id)) return; // cycle : on ignore
    stack.add(task.id);
    for (const dep of task.dependances ?? []) {
      const pred = taskMap.get(dep.precedentId);
      if (pred) visit(pred, stack);
    }
    visited.add(task.id);
    sorted.push(task);
  };

  tasks.forEach((t) => visit(t));
  return sorted;
}

/**
 * Calcule la date de début de chaque tâche en tenant compte des dépendances.
 * Une tâche sans prédécesseur commence à projectStart.
 * Une tâche avec prédécesseurs commence après la fin du prédécesseur le plus tardif.
 */
export function computeTaskStartDates(tasks: Tache[], projectStart: Date): Map<string, Date> {
  const startDates = new Map<string, Date>();

  const resolve = (task: Tache): Date => {
    if (startDates.has(task.id)) return startDates.get(task.id)!;

    // Base : date explicite en base ou début du projet
    let base = task.dateDebut ? new Date(task.dateDebut) : projectStart;

    // Contraintes des prédécesseurs : la tâche ne peut pas commencer avant leur fin,
    // même si une dateDebut explicite est enregistrée (données potentiellement obsolètes).
    for (const dep of task.dependances ?? []) {
      const pred = tasks.find((t) => t.id === dep.precedentId);
      if (!pred?.duree) continue;
      const predStart = resolve(pred);
      const predEnd = addBusinessDays(predStart, pred.duree);
      if (predEnd > base) base = predEnd;
    }

    startDates.set(task.id, base);
    return base;
  };

  tasks.forEach((t) => resolve(t));
  return startDates;
}

export function buildTimelineHeaders(
  zoom: ZoomLevel,
  start: Date,
  totalDays: number,
  dayWidth: number,
): TimelineHeader[] {
  const dayColumns = buildDayColumns(start, totalDays, dayWidth);
  const headers: TimelineHeader[] = [];

  if (zoom === 'semaine') {
    let current = startOfWeek(start, { locale: fr });
    while (differenceInDays(current, start) < totalDays) {
      const offsetDay = Math.max(0, differenceInDays(current, start));
      const col = dayColumns[offsetDay];
      if (!col) break;
      // Largeur d'une semaine = 5 jours ouvrés * dayWidth + 2 week-ends * WEEKEND_WIDTH
      const weekWidth = 5 * dayWidth + 2 * WEEKEND_WIDTH;
      headers.push({
        label: format(current, "'S'w — dd MMM", { locale: fr }),
        offsetPx: col.offsetPx,
        widthPx: weekWidth,
      });
      current = addWeeks(current, 1);
    }
  } else {
    let current = startOfMonth(start);
    while (differenceInDays(current, start) < totalDays) {
      const offsetDay = Math.max(0, differenceInDays(current, start));
      const col = dayColumns[offsetDay];
      if (!col) break;
      // Largeur approximative d'un mois (22 jours ouvrés + 8/9 jours week-end)
      const monthWidth = 22 * dayWidth + 9 * WEEKEND_WIDTH;
      headers.push({
        label: format(current, 'MMMM yyyy', { locale: fr }),
        offsetPx: col.offsetPx,
        widthPx: monthWidth,
      });
      current = addMonths(current, 1);
    }
  }
  return headers;
}
