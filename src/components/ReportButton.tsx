import { Plus } from 'lucide-react';

interface ReportButtonProps {
  onClick: () => void;
}

export default function ReportButton({ onClick }: ReportButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-5 right-4 z-[1000] flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 font-bold text-xs text-white shadow-lg shadow-blue-600/30 backdrop-blur-sm transition-all hover:bg-blue-700 active:scale-95"
      aria-label="Reportar un bache"
    >
      <Plus size={16} className="stroke-[2.5]" />
      <span>Reportar bache</span>
    </button>
  );
}
