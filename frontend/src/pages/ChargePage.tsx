import { useCharge } from '../hooks/useCharge.ts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

function cellColor(days: number): string {
  if (days === 0)  return 'bg-gray-50 text-gray-300';
  if (days <= 5)   return 'bg-green-500 text-white font-medium';
  if (days <= 8)   return 'bg-orange-400 text-white font-medium';
  return 'bg-orange-700 text-white font-bold';
}

export default function ChargePage() {
  const { data, loading, error, range, setRange } = useCharge();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Charge ressource</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">Période :</span>
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand-400"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand-400"
          />
          {/* Légende */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> ≤5j</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> 5–8j</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-700 inline-block" /> &gt;8j</span>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-auto p-6">
        {loading && <div className="text-sm text-gray-400 text-center mt-12">Chargement…</div>}
        {error   && <div className="text-sm text-red-500 text-center mt-12">{error}</div>}

        {!loading && !error && data && (
          data.rows.length === 0 ? (
            <div className="text-sm text-gray-400 text-center mt-12">Aucune donnée sur cette période</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white border border-gray-200 px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap min-w-[160px]">
                      Ressource
                    </th>
                    {data.weeks.map((w) => (
                      <th key={w} className="border border-gray-200 px-3 py-2 text-center text-gray-500 font-medium whitespace-nowrap min-w-[80px]">
                        {format(parseISO(w), "'S'ww", { locale: fr })}
                        <div className="text-[10px] font-normal text-gray-400">
                          {format(parseISO(w), 'd MMM', { locale: fr })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.ressourceId} className="hover:bg-gray-50/50">
                      <td className="sticky left-0 z-10 bg-white border border-gray-200 px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                        {row.ressourceNom}
                      </td>
                      {data.weeks.map((w) => {
                        const days = row.workload[w] ?? 0;
                        return (
                          <td key={w} className={`border border-gray-200 px-3 py-2 text-center ${cellColor(days)}`}>
                            {days > 0 ? `${days}j` : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
