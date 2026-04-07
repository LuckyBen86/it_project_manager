import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications.ts';
import type { AppNotification } from '../lib/types.ts';

const TYPE_STYLES: Record<string, { icon: string; color: string }> = {
  retard:             { icon: '⚠', color: 'text-red-600' },
  echeance_proche:    { icon: '⏰', color: 'text-orange-500' },
  demande_en_attente: { icon: '📋', color: 'text-brand-600' },
};

function NotifItem({ item, onClose }: { item: AppNotification; onClose: () => void }) {
  const navigate = useNavigate();
  const style = TYPE_STYLES[item.type] ?? { icon: '•', color: 'text-gray-500' };

  const handleClick = () => {
    onClose();
    if (item.type === 'demande_en_attente') navigate('/demandes');
    else navigate('/');
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex gap-3 items-start transition-colors border-b border-gray-100 last:border-0"
    >
      <span className={`shrink-0 text-sm mt-0.5 ${style.color}`}>{style.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-800 leading-snug">{item.titre}</p>
        {item.projetTitre && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.projetTitre}</p>}
      </div>
    </button>
  );
}

export default function NotificationDropdown() {
  const { count, items } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Notifications</span>
            {count > 0 && <span className="text-[10px] text-gray-400">{count} non lue{count > 1 ? 's' : ''}</span>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-4 text-xs text-gray-400 text-center">Aucune notification</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <NotifItem key={item.id} item={item} onClose={() => setOpen(false)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
