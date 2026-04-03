import { dateToOffset, businessDaysWidth, computeTaskStartDates, sortTasksTopologically } from '../../lib/gantt.ts';
import type { Projet } from '../../lib/types.ts';

const HEADER_H = 40;
const PROJECT_ROW_H = 40;
const TASK_ROW_H = 40;

interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Chemin orthogonal en L :
 * - Sort à droite de x1 d'un stub fixe (turnX)
 * - Descend/monte verticalement jusqu'à y2
 * - Va horizontalement vers x2 (droite ou gauche)
 * Aucun détour, aucune boucle.
 */
function buildPath(x1: number, y1: number, x2: number, y2: number): string {
  const STUB = 14;
  const R = 4;
  const turnX = x1 + STUB;

  if (Math.abs(y2 - y1) < 2) {
    return `M ${x1},${y1} H ${x2}`;
  }

  const dy = y2 > y1 ? R : -R;
  const dx = x2 > turnX ? R : -R;

  return [
    `M ${x1},${y1}`,
    `H ${turnX - R}`,
    `Q ${turnX},${y1} ${turnX},${y1 + dy}`,
    `V ${y2 - dy}`,
    `Q ${turnX},${y2} ${turnX + dx},${y2}`,
    `H ${x2}`,
  ].join(' ');
}

interface Props {
  projetsGantt: Projet[];
  expandedIds: Set<string>;
  timelineStart: Date;
  dayWidth: number;
  totalWidth: number;
}

export default function GanttArrows({
  projetsGantt,
  expandedIds,
  timelineStart,
  dayWidth,
  totalWidth,
}: Props) {
  const arrows: Arrow[] = [];
  let currentY = HEADER_H;

  for (const projet of projetsGantt) {
    currentY += PROJECT_ROW_H;
    const expanded = expandedIds.has(projet.id);

    if (!expanded) continue;

    const projetDateDebut = projet.dateDebut ? new Date(projet.dateDebut) : null;
    const sortedTaches = sortTasksTopologically(projet.taches);
    const taskStartDates = computeTaskStartDates(sortedTaches, projetDateDebut ?? new Date());

    const taskYMap = new Map<string, number>();

    if (sortedTaches.length === 0) {
      currentY += TASK_ROW_H;
    } else {
      for (const tache of sortedTaches) {
        taskYMap.set(tache.id, currentY + TASK_ROW_H / 2);
        currentY += TASK_ROW_H;
      }

      if (taskStartDates) {
        for (const tache of sortedTaches) {
          if (!tache.duree) continue;
          const tacheStart = taskStartDates.get(tache.id);
          if (!tacheStart) continue;

          for (const dep of tache.dependances ?? []) {
            const pred = projet.taches.find((t) => t.id === dep.precedentId);
            if (!pred || !pred.duree) continue;

            const predStart = taskStartDates.get(pred.id);
            if (!predStart) continue;

            const predRight =
              dateToOffset(predStart, timelineStart, dayWidth) +
              businessDaysWidth(predStart, pred.duree, dayWidth);
            const tacheLeft = dateToOffset(tacheStart, timelineStart, dayWidth);

            const predY = taskYMap.get(pred.id);
            const tacheY = taskYMap.get(tache.id);
            if (predY === undefined || tacheY === undefined) continue;

            arrows.push({ x1: predRight, y1: predY, x2: tacheLeft, y2: tacheY });
          }
        }
      }
    }
  }

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-20"
      style={{ width: totalWidth, height: currentY, overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="dep-arrow"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="#6366f1" />
        </marker>
      </defs>

      {arrows.map((a, i) => (
        <path
          key={i}
          d={buildPath(a.x1, a.y1, a.x2, a.y2)}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeOpacity="0.75"
          markerEnd="url(#dep-arrow)"
        />
      ))}
    </svg>
  );
}
