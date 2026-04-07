interface Props {
  label: string;
  error?: string;
  required?: boolean;
  small?: boolean;
  children: React.ReactNode;
}

export default function FormField({ label, error, required, small, children }: Props) {
  return (
    <div>
      <label className={`block font-medium text-gray-700 mb-1 ${small ? 'text-xs' : 'text-sm'}`}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50';

export const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

export const inputClassXs =
  'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50';

export const selectClassXs =
  'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
