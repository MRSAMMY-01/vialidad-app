import { Plus } from 'lucide-react';

interface ReportButtonProps {
  onClick: () => void;
}

export default function ReportButton({ onClick }: ReportButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-6 right-5 z-[1000] flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3.5 font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-700 active:scale-95"
    >
      <Plus size={22} />
      <span className="text-sm">Reportar problema</span>
    </button>
  );
}
