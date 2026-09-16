export type Severity = 'leve' | 'moderado' | 'critico';
export type EventType = 'bache' | 'corte_calle' | 'otro';
export type EventStatus = 'activo' | 'intervencion_parcial' | 'resuelto';

export interface ReportEvent {
  id: string;
  lat: number;
  lng: number;
  tipo: EventType;
  severity: Severity;
  estado: EventStatus;
  tipoIntervencion?: string;
  ultimaConfirmacion: string;
  estadoVotos: {
    activo: number;
    intervencion_parcial: number;
    resuelto: number;
  };
  title: string;
  description: string;
  date: string;
  photo: string;
  reporter: string;
  confirmations: number;
  yaConfirme: boolean;
  yaVoteEstado: boolean;
  uid?: string;
  confirmedUids?: string[];
  votedUids?: string[];
}

const photos = {
  pothole1: 'https://images.pexels.com/photos/5688465/pexels-photo-5688465.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  pothole2: 'https://images.pexels.com/photos/9963247/pexels-photo-9963247.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  pothole3: 'https://images.pexels.com/photos/20518249/pexels-photo-20518249.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  pothole4: 'https://images.pexels.com/photos/17706118/pexels-photo-17706118.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  crack1: 'https://images.pexels.com/photos/11849379/pexels-photo-11849379.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  crack2: 'https://images.pexels.com/photos/8891506/pexels-photo-8891506.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  puddle: 'https://images.pexels.com/photos/31172239/pexels-photo-31172239.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  patched: 'https://images.pexels.com/photos/6018646/pexels-photo-6018646.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  construction: 'https://images.pexels.com/photos/30667997/pexels-photo-30667997.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  road: 'https://images.pexels.com/photos/2612386/pexels-photo-2612386.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
};

export const mockEvents: ReportEvent[] = [
  {
    id: '1', lat: -36.6066, lng: -72.1034, tipo: 'bache', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-28',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Bache profundo en Av. O\'Higgins',
    description: 'Bache de gran tamaño cerca del semáforo, peligroso para vehículos.',
    date: '2026-08-28', photo: photos.pothole1, reporter: 'María González', confirmations: 12, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '2', lat: -36.5980, lng: -72.0950, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-26',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Grietas en calle Constitución',
    description: 'Múltiples grietas longitudinales en el pavimento.',
    date: '2026-08-26', photo: photos.crack1, reporter: 'Carlos Soto', confirmations: 7, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '3', lat: -36.6120, lng: -72.1100, tipo: 'bache', severity: 'leve', estado: 'activo',
    ultimaConfirmacion: '2026-08-25',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Desnivel leve en pasaje Los Aromos',
    description: 'Leve hundimiento del pavimento, no afecta el tránsito.',
    date: '2026-08-25', photo: photos.road, reporter: 'Ana Pérez', confirmations: 3, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '4', lat: -36.5900, lng: -72.0900, tipo: 'bache', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-14',
    estadoVotos: { activo: 0, intervencion_parcial: 1, resuelto: 2 },
    title: 'Hundimiento en calle Arauco',
    description: 'Sectón de calle hundida, requiere reparación urgente.',
    date: '2026-08-14', photo: photos.pothole3, reporter: 'Pedro Muñoz', confirmations: 18, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '5', lat: -36.6200, lng: -72.1050, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-24',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Baches en Av. Vicente Méndez',
    description: 'Varios baches medianos en ambos sentidos.',
    date: '2026-08-24', photo: photos.pothole2, reporter: 'Lucía Ramírez', confirmations: 9, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '6', lat: -36.5850, lng: -72.0850, tipo: 'bache', severity: 'leve', estado: 'activo',
    ultimaConfirmacion: '2026-08-22',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Grieta pequeña en calle Maipú',
    description: 'Grieta superficial, no representa peligro inmediato.',
    date: '2026-08-22', photo: photos.crack2, reporter: 'Jorge Fuentes', confirmations: 2, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '7', lat: -36.6150, lng: -72.0950, tipo: 'bache', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-29',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Bache gigante en Av. Bernardo O\'Higgins',
    description: 'Bache que ha dañado varios vehículos esta semana.',
    date: '2026-08-29', photo: photos.pothole4, reporter: 'Sofía Castro', confirmations: 22, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '8', lat: -36.6030, lng: -72.0880, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-21',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Pavimento deteriorado en calle Libertad',
    description: 'Superficie irregular con desprendimiento de asfalto.',
    date: '2026-08-21', photo: photos.patched, reporter: 'Diego Rojas', confirmations: 6, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '9', lat: -36.5950, lng: -72.1100, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-27',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Agua estancada en calle Chacabuco',
    description: 'Pozo de agua por mala filtración, daña el pavimento.',
    date: '2026-08-27', photo: photos.puddle, reporter: 'Valentina Díaz', confirmations: 8, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '10', lat: -36.6080, lng: -72.1000, tipo: 'bache', severity: 'leve', estado: 'activo',
    ultimaConfirmacion: '2026-08-23',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Reparación parcial en calle Orompello',
    description: 'Parche reciente pero con bordes irregulares.',
    date: '2026-08-23', photo: photos.patched, reporter: 'Manuel Vargas', confirmations: 4, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '11', lat: -36.6170, lng: -72.0920, tipo: 'bache', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-30',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Bache profundo en Av. Argentina',
    description: 'Bache de 40cm de profundidad, muy peligroso.',
    date: '2026-08-30', photo: photos.pothole1, reporter: 'Camila Torres', confirmations: 15, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '12', lat: -36.5920, lng: -72.1020, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-12',
    estadoVotos: { activo: 1, intervencion_parcial: 2, resuelto: 0 },
    title: 'Grietas amplias en calle Independencia',
    description: 'Red de grietas que se extienden por media cuadra.',
    date: '2026-08-12', photo: photos.crack1, reporter: 'Francisco Lagos', confirmations: 5, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '13', lat: -36.6050, lng: -72.1150, tipo: 'bache', severity: 'leve', estado: 'activo',
    ultimaConfirmacion: '2026-08-10',
    estadoVotos: { activo: 2, intervencion_parcial: 0, resuelto: 0 },
    title: 'Leve desnivel en calle Las Heras',
    description: 'Pequeño desnivel, apenas perceptible al conducir.',
    date: '2026-08-10', photo: photos.road, reporter: 'Paula Navarro', confirmations: 1, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '14', lat: -36.6130, lng: -72.0870, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-28',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Obra mal señalizada en calle Collín',
    description: 'Trabajos en vía sin señalización adecuada.',
    date: '2026-08-28', photo: photos.construction, reporter: 'Rodrigo Saavedra', confirmations: 11, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '15', lat: -36.5990, lng: -72.0980, tipo: 'bache', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-29',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Hundimiento severo en Av. Ecuador',
    description: 'Sectón de calle con hundimiento profundo.',
    date: '2026-08-29', photo: photos.pothole3, reporter: 'Isabel Contreras', confirmations: 20, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '16', lat: -36.5880, lng: -72.0950, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-26',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Baches en calle Bulnes',
    description: 'Tres baches medianos en 50 metros.',
    date: '2026-08-26', photo: photos.pothole2, reporter: 'Tomás Bravo', confirmations: 7, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '17', lat: -36.6190, lng: -72.1080, tipo: 'bache', severity: 'leve', estado: 'activo',
    ultimaConfirmacion: '2026-08-11',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Grieta en calle Rengo',
    description: 'Grieta lineal superficial, sin riesgo inmediato.',
    date: '2026-08-11', photo: photos.crack2, reporter: 'Daniela Muñoz', confirmations: 2, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '18', lat: -36.6040, lng: -72.0930, tipo: 'bache', severity: 'moderado', estado: 'activo',
    ultimaConfirmacion: '2026-08-25',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Desgaste del pavimento en calle Aníbal Pinto',
    description: 'Asfalto desgastado con pérdida de adherencia.',
    date: '2026-08-25', photo: photos.patched, reporter: 'Sebastián Riquelme', confirmations: 6, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '19', lat: -36.6015, lng: -72.1005, tipo: 'corte_calle', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-30',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Corte total en calle 5 de Abril',
    description: 'Tránsito completamente suspendido entre Maipú y 18 de Septiembre por rotura de matriz.',
    date: '2026-08-30', photo: photos.construction, reporter: 'Andrés Morales', confirmations: 16, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '20', lat: -36.6095, lng: -72.0945, tipo: 'corte_calle', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-30',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Corte de calzada en Av. Collín con Isabel Riquelme',
    description: 'Vía cerrada por faenas viales de recarpeteo asfáltico y desvío de locomoción.',
    date: '2026-08-30', photo: photos.construction, reporter: 'Camila Sepúlveda', confirmations: 24, yaConfirme: false, yaVoteEstado: false,
  },
  {
    id: '21', lat: -36.5935, lng: -72.0980, tipo: 'corte_calle', severity: 'critico', estado: 'activo',
    ultimaConfirmacion: '2026-08-29',
    estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
    title: 'Cierre preventivo en calle Gamero con Cocharcas',
    description: 'Tránsito cortado temporalmente por remoción de ramas y cableado sobre la calzada.',
    date: '2026-08-29', photo: photos.construction, reporter: 'Matías Rivas', confirmations: 9, yaConfirme: false, yaVoteEstado: false,
  },
];

export const uniqueReporters = new Set(mockEvents.map((e) => e.reporter)).size;

export const severityConfig: Record<Severity, { label: string; color: string; ring: string; bg: string; text: string; border: string }> = {
  critico: { label: 'Crítico', color: '#dc2626', ring: 'ring-red-500', bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-500' },
  moderado: { label: 'Moderado', color: '#f59e0b', ring: 'ring-amber-500', bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-500' },
  leve: { label: 'Leve', color: '#22c55e', ring: 'ring-green-500', bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500' },
};

// Simulated GPS location (mock) - central Chillán
export const mockGpsLocation = { lat: -36.6066, lng: -72.1034 };
