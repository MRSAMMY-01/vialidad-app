import { useState, useRef, useEffect } from 'react';
import { Coffee, X, ExternalLink, Heart } from 'lucide-react';

export default function SupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="absolute bottom-5 left-4 z-[1000] pointer-events-auto">
      {/* Floating Popover Card */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 mb-1.5 w-72 rounded-2xl bg-white/95 p-4 shadow-2xl backdrop-blur-md border border-gray-100 animate-scale-in text-gray-800 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Coffee size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 leading-tight">
                  ¿Te ha servido este mapa?
                </h4>
                <p className="text-[10px] text-gray-500">Chillán Reporta</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 transition"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            Puedes apoyar el proyecto con un pequeño aporte. Esto ayuda a mantener la plataforma disponible y seguir mejorándola.
          </p>

          <a
            href="https://link.mercadopago.cl/electro01"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#009ee3] hover:bg-[#0086c2] text-white py-2.5 px-3 text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-98"
          >
            <span>Apoyar con Mercado Pago</span>
            <ExternalLink size={13} />
          </a>

          <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 pt-0.5">
            <Heart size={10} className="text-red-400 fill-red-400" />
            <span>Aporte voluntario para la comunidad</span>
          </div>
        </div>
      )}

      {/* Discrete Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-md backdrop-blur-md border border-gray-100 hover:bg-gray-50 active:scale-95 transition"
        aria-label="Apoyar el proyecto"
      >
        <span className="text-sm leading-none">☕</span>
        <span className="text-[11px] font-semibold text-gray-700">Apoyar</span>
      </button>
    </div>
  );
}
