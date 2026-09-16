import type { Severity } from '@/data/mockEvents';

export interface FilterState {
  severity: Severity | 'todos';
  tipo?: string | 'todos'; // Prepared for future type filter
}

interface SeverityFilterProps {
  selectedSeverity: Severity | 'todos';
  onChangeSeverity: (severity: Severity | 'todos') => void;
  counts?: {
    todos: number;
    critico: number;
    moderado: number;
    leve: number;
  };
}

export default function SeverityFilter({
  selectedSeverity,
  onChangeSeverity,
  counts,
}: SeverityFilterProps) {
  const options: { id: Severity | 'todos'; label: string; dotColor?: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'critico', label: 'Críticos', dotColor: 'bg-red-500' },
    { id: 'moderado', label: 'Moderados', dotColor: 'bg-amber-500' },
    { id: 'leve', label: 'Leves', dotColor: 'bg-green-500' },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/95 backdrop-blur-md shadow-lg border border-gray-100/90 overflow-x-auto max-w-[92vw]">
      {options.map((opt) => {
        const isActive = selectedSeverity === opt.id;
        const count = counts ? counts[opt.id as keyof typeof counts] : undefined;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChangeSeverity(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
            }`}
          >
            {opt.dotColor && (
              <span
                className={`w-2 h-2 rounded-full ${opt.dotColor} ${
                  isActive ? 'ring-1 ring-white/60' : ''
                }`}
              />
            )}
            <span>{opt.label}</span>
            {count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
