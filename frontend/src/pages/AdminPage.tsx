import { useState } from 'react';
import AdminCategories from '../components/AdminCategories.tsx';
import AdminRessources from '../components/AdminRessources.tsx';
import AdminJournal from '../components/AdminJournal.tsx';
import AdminLogiciels from '../components/AdminLogiciels.tsx';
import AdminPoles from '../components/AdminPoles.tsx';
import { useAuthStore } from '../store/auth.store.ts';

type Tab = 'ressources' | 'poles' | 'tags' | 'logiciels' | 'journal';

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isDG = user?.role === 'direction_generale';

  const TABS: { id: Tab; label: string; dgOnly?: boolean }[] = [
    { id: 'ressources', label: 'Ressources' },
    { id: 'poles', label: 'Pôles', dgOnly: true },
    { id: 'tags', label: 'Tags' },
    { id: 'logiciels', label: 'Logiciels' },
    { id: 'journal', label: 'Journal' },
  ];

  const visibleTabs = TABS.filter((t) => !t.dgOnly || isDG);
  const [tab, setTab] = useState<Tab>('ressources');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des ressources, des tags et du journal d'activité</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {tab === 'ressources' && <AdminRessources />}
        {tab === 'poles' && isDG && <AdminPoles />}
        {tab === 'tags' && <AdminCategories />}
        {tab === 'logiciels' && <AdminLogiciels />}
        {tab === 'journal' && <AdminJournal />}
      </div>
    </div>
  );
}
