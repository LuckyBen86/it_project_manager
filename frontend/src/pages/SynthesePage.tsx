import { useNavigate } from 'react-router-dom';
import { useSynthese } from '../hooks/useSynthese.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { useMesDemandesCount } from '../hooks/useMesDemandes.ts';

interface KpiTileProps {
  value: number;
  label: string;
  color: 'red' | 'amber' | 'blue' | 'green' | 'purple' | 'gray';
  icon: React.ReactNode;
  onClick?: () => void;
  subtitle?: string;
}

const COLOR_MAP = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    num: 'text-red-600',    icon: 'bg-red-100 text-red-500' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  num: 'text-amber-600',  icon: 'bg-amber-100 text-amber-500' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   num: 'text-blue-600',   icon: 'bg-blue-100 text-blue-500' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  num: 'text-green-600',  icon: 'bg-green-100 text-green-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', num: 'text-purple-600', icon: 'bg-purple-100 text-purple-500' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   num: 'text-gray-700',   icon: 'bg-gray-100 text-gray-400' },
};

function KpiTile({ value, label, color, icon, onClick, subtitle }: KpiTileProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      onClick={onClick}
      className={`${c.bg} ${c.border} border rounded-2xl p-5 flex items-start gap-4 shadow-sm ${onClick ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
    >
      <div className={`${c.icon} rounded-xl p-3 shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-3xl font-bold ${c.num} leading-none`}>{value}</p>
        <p className={`text-sm font-medium ${c.text} mt-1 leading-snug`}>{label}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

interface ProgressTileProps {
  done: number;
  total: number;
  label: string;
}

function ProgressTile({ done, total, label }: ProgressTileProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1';
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-end justify-between mb-3">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{pct}<span className="text-base font-normal text-gray-400"> %</span></p>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">{done} / {total} terminées</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-6 first:mt-0 px-1">
      {children}
    </h2>
  );
}

// SVG icons
const IconAlert = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>;
const IconClock = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconCalendar = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconTask = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const IconFolder = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
const IconInbox = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
const IconData = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const IconPlay = <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export default function SynthesePage() {
  const { data, loading, error } = useSynthese();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { count: mesDemandesCount } = useMesDemandesCount();

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-500">Chargement...</div>;
  if (error || !data) return <div className="flex items-center justify-center h-full text-sm text-red-500">{error ?? 'Erreur'}</div>;

  const { taches, projets, demandes } = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Synthèse</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vue d'ensemble de l'activité</p>
        </div>

        {/* ── Mon espace ── */}
        <SectionTitle>Mon espace</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => navigate('/mes-taches')}
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left"
          >
            <div className="bg-brand-50 text-brand-600 rounded-xl p-3 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Mes tâches</p>
              <p className="text-xs text-gray-400 mt-0.5">{taches.enCours} en cours · {taches.aFaire} à faire</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/mes-demandes')}
            className="relative flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all text-left"
          >
            <div className="bg-purple-50 text-purple-600 rounded-xl p-3 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Mes demandes</p>
              <p className="text-xs text-gray-400 mt-0.5">{demandes.enAttente} en attente</p>
            </div>
            {mesDemandesCount > 0 && (
              <span className="absolute top-3 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {mesDemandesCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Tâches ── */}
        <SectionTitle>Tâches</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <KpiTile
            value={taches.enDepassement}
            label="en dépassement"
            subtitle="cumul activités > durée prévue"
            color={taches.enDepassement > 0 ? 'red' : 'gray'}
            icon={IconAlert}
            onClick={() => navigate('/mes-taches')}
          />
          <KpiTile
            value={taches.enRetard}
            label="en retard"
            subtitle="date butoire dépassée"
            color={taches.enRetard > 0 ? 'red' : 'gray'}
            icon={IconClock}
            onClick={() => navigate('/mes-taches')}
          />
          <KpiTile
            value={taches.prochaineEcheance}
            label="échéance ≤ 5 jours ouvrés"
            subtitle="à surveiller de près"
            color={taches.prochaineEcheance > 0 ? 'amber' : 'gray'}
            icon={IconCalendar}
            onClick={() => navigate('/mes-taches')}
          />
          <KpiTile
            value={taches.aFaire}
            label="non démarrées"
            subtitle="statut À faire"
            color={taches.aFaire > 0 ? 'blue' : 'gray'}
            icon={IconPlay}
            onClick={() => navigate('/mes-taches')}
          />
          {taches.sansDonnees > 0 && (
            <KpiTile
              value={taches.sansDonnees}
              label="sans données"
              subtitle="ni durée ni date de début"
              color="purple"
              icon={IconData}
              onClick={() => navigate('/mes-taches')}
            />
          )}
        </div>

        {/* Barre de progression tâches */}
        <ProgressTile
          done={taches.termine}
          total={taches.total}
          label="Taux de complétion des tâches"
        />

        {/* ── Projets (responsable) ── */}
        {projets && (
          <>
            <SectionTitle>Projets</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
              <KpiTile
                value={projets.enDepassement}
                label="en dépassement"
                subtitle="cumul activités > durée prévue"
                color={projets.enDepassement > 0 ? 'red' : 'gray'}
                icon={IconAlert}
                onClick={() => navigate('/')}
              />
              <KpiTile
                value={projets.enRetard}
                label="en retard"
                subtitle="date butoire dépassée"
                color={projets.enRetard > 0 ? 'red' : 'gray'}
                icon={IconClock}
                onClick={() => navigate('/')}
              />
              <KpiTile
                value={projets.prochaineEcheance}
                label="échéance ≤ 5 jours ouvrés"
                subtitle="à surveiller de près"
                color={projets.prochaineEcheance > 0 ? 'amber' : 'gray'}
                icon={IconCalendar}
                onClick={() => navigate('/')}
              />
              <KpiTile
                value={projets.enCours}
                label="en cours"
                subtitle={`sur ${projets.total} au total`}
                color="blue"
                icon={IconFolder}
                onClick={() => navigate('/')}
              />
            </div>
            <ProgressTile
              done={projets.termine}
              total={projets.total}
              label="Taux de complétion des projets"
            />
          </>
        )}

        {/* ── Demandes ── */}
        <SectionTitle>Demandes</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiTile
            value={demandes.enAttente}
            label={user?.role === 'responsable' || user?.role === 'direction_generale' ? 'en attente de validation' : 'mes demandes en attente'}
            color={demandes.enAttente > 0 ? 'amber' : 'gray'}
            icon={IconInbox}
            onClick={() => navigate(user?.role === 'responsable' || user?.role === 'direction_generale' ? '/demandes' : '/mes-demandes')}
          />
          <KpiTile
            value={taches.enCours}
            label="tâches en cours"
            subtitle="statut En cours"
            color="green"
            icon={IconTask}
            onClick={() => navigate('/mes-taches')}
          />
        </div>

      </div>
    </div>
  );
}
