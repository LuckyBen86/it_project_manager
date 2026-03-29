import { useState } from 'react';
import AdminCategories from '../components/AdminCategories.tsx';
import AdminRessources from '../components/AdminRessources.tsx';

type Tab = 'ressources' | 'categories';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ressources', label: 'Ressources' },
  { id: 'categories', label: 'Catégories' },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('ressources');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des ressources et des catégories</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map((t) => (
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
        {tab === 'categories' && <AdminCategories />}
      </div>
    </div>
  );
}
