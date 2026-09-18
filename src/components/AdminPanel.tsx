import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { getMapThumbnailUrl } from '@/services/cloudinaryService';
import { getSessionMetrics, type SessionMetrics } from '@/services/sessionService';
import LocationPickerMap from '@/components/LocationPickerMap';
import type { ReportEvent, EventType, Severity, EventStatus } from '@/data/mockEvents';
import {
  ShieldCheck,
  ShieldAlert,
  Trash2,
  LogOut,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Users,
  UserCheck,
  RotateCcw,
  Activity,
  MapPin,
  Save,
  X,
  Pencil,
} from 'lucide-react';

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Repositioning state
  const [editingLocationEvent, setEditingLocationEvent] = useState<ReportEvent | null>(null);
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Report Details Edit state
  const [editingEvent, setEditingEvent] = useState<ReportEvent | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    reporter: string;
    tipo: EventType;
    severity: Severity;
    estado: EventStatus;
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 1. Listen to Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser && !currentUser.isAnonymous) {
        setCheckingAdmin(true);
        try {
          const adminDocRef = doc(db, 'admins', currentUser.uid);
          const adminDoc = await getDoc(adminDocRef);
          setIsAdmin(adminDoc.exists());
        } catch (err) {
          console.error('Error verificando rol de administrador:', err);
          setIsAdmin(false);
        } finally {
          setCheckingAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setCheckingAdmin(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Fetch events & session return metrics when user is admin
  useEffect(() => {
    if (!isAdmin) {
      setEvents([]);
      setSessionMetrics(null);
      return;
    }

    // Fetch session analytics
    setLoadingMetrics(true);
    getSessionMetrics()
      .then((metrics) => setSessionMetrics(metrics))
      .finally(() => setLoadingMetrics(false));

    setLoadingEvents(true);
    const colRef = collection(db, 'eventos');
    const unsubscribeSnapshot = onSnapshot(
      colRef,
      (snapshot) => {
        const loaded: ReportEvent[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            lat: Number(data.lat) || 0,
            lng: Number(data.lng) || 0,
            tipo: data.tipo || 'bache',
            severity: data.severity || 'moderado',
            estado: data.estado || 'activo',
            tipoIntervencion: data.tipoIntervencion || undefined,
            ultimaConfirmacion: data.ultimaConfirmacion || data.date || '',
            estadoVotos: data.estadoVotos || { activo: 0, intervencion_parcial: 0, resuelto: 0 },
            title: data.title || 'Sin título',
            description: data.description || '',
            date: data.date || '',
            photo: data.photo || '',
            reporter: data.reporter || 'Vecino/a de Chillán',
            confirmations: Number(data.confirmations) || 0,
            yaConfirme: false,
            yaVoteEstado: false,
            uid: data.uid,
          };
        });

        // Ordenar por fecha más reciente primero (y por ID como desempate)
        loaded.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        setEvents(loaded);
        setLoadingEvents(false);
      },
      (error) => {
        console.error('Error obteniendo eventos en panel admin:', error);
        setLoadingEvents(false);
      }
    );

    return () => unsubscribeSnapshot();
  }, [isAdmin]);

  // Auth actions
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Error al iniciar sesión con Google:', err);
      alert(`Error al iniciar sesión: ${err.message || 'Intente nuevamente'}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  const handleNavigateHome = () => {
    window.location.href = '/';
  };

  // Delete event action
  const handleDelete = async (id: string, title: string) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente el reporte "${title || id}"?\n\nEsta acción es irreversible.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      await deleteDoc(doc(db, 'eventos', id));
    } catch (err: any) {
      console.error('Error al eliminar el reporte:', err);
      alert(`Error al eliminar: ${err.message || 'No tienes permisos para realizar esta acción.'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Reposition event location action
  const handleSaveLocation = async () => {
    if (!editingLocationEvent || !tempLocation) return;
    try {
      setIsSavingLocation(true);
      const eventRef = doc(db, 'eventos', editingLocationEvent.id);
      await updateDoc(eventRef, {
        lat: tempLocation.lat,
        lng: tempLocation.lng,
      });
      setEditingLocationEvent(null);
      setTempLocation(null);
    } catch (err: any) {
      console.error('Error al actualizar ubicación del reporte:', err);
      alert(`Error al guardar la nueva ubicación: ${err.message || 'Error de permisos o conexión.'}`);
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Edit report details action
  const handleSaveEdit = async () => {
    if (!editingEvent || !editFormData) return;
    if (!editFormData.title.trim() || !editFormData.description.trim()) {
      alert('El título y la descripción no pueden estar vacíos.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const eventRef = doc(db, 'eventos', editingEvent.id);
      await updateDoc(eventRef, {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        reporter: editFormData.reporter.trim() || 'Vecino/a de Chillán',
        tipo: editFormData.tipo,
        severity: editFormData.severity,
        estado: editFormData.estado,
      });
      setEditingEvent(null);
      setEditFormData(null);
    } catch (err: any) {
      console.error('Error al actualizar datos del reporte:', err);
      alert(`Error al guardar cambios: ${err.message || 'Error de permisos o conexión.'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Helper styles for badges
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critico':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'moderado':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'leve':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getEstadoBadge = (est: string) => {
    switch (est) {
      case 'activo':
        return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'intervencion_parcial':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'resuelto':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatTipo = (tipo: string) => {
    switch (tipo) {
      case 'bache':
        return 'Bache / Daño';
      case 'corte_calle':
        return 'Corte de calle';
      default:
        return 'Otro problema';
    }
  };

  // 1. Loading screen
  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Verificando credenciales de administrador...</p>
      </div>
    );
  }

  // 2. Not logged in with Google (either unauthenticated or anonymous)
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
          <div className="mx-auto w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-sm text-gray-500 mt-1">
              Acceso restringido para la gestión de reportes de Chillán Reporta.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-medium py-3 px-4 rounded-xl border border-gray-300 shadow-sm transition active:scale-[0.99]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Iniciar sesión con Google</span>
          </button>

          <button
            onClick={handleNavigateHome}
            className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition py-1"
          >
            <ArrowLeft size={14} />
            <span>Volver a la app principal</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Logged in with Google, but NOT an admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center space-y-6">
          <div className="mx-auto w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Acceso Denegado</h1>
            <p className="text-sm text-red-600 font-medium mt-1">
              No tienes permisos de administrador
            </p>
            <p className="text-xs text-gray-500 mt-2">
              La cuenta <span className="font-mono font-medium text-gray-700">{user.email || user.uid}</span> no está registrada en la lista de administradores.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-4 rounded-xl transition text-sm"
            >
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
            <button
              onClick={handleNavigateHome}
              className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition py-2"
            >
              <ArrowLeft size={14} />
              <span>Volver a la app principal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Admin Panel View
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              Panel de Administración
            </h1>
            <p className="text-xs text-gray-500">Chillán Reporta • Gestión interna</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-gray-800">{user.displayName || 'Administrador'}</p>
            <p className="text-[11px] text-gray-500">{user.email}</p>
          </div>

          <button
            onClick={handleNavigateHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <ExternalLink size={14} />
            <span>Ver App</span>
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-medium transition"
          >
            <LogOut size={14} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* User Retention & Activity Metrics */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Métricas de Retorno y Usuarios</h3>
                <p className="text-[11px] text-gray-500">Actividad calculada desde la colección de sesiones.</p>
              </div>
            </div>
            {loadingMetrics && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin text-blue-600" />
                <span>Calculando...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Unique Users */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <Users size={14} className="text-blue-600" />
                <span>Usuarios Totales</span>
              </div>
              <p className="text-xl font-extrabold text-gray-900">
                {sessionMetrics ? sessionMetrics.totalUniqueUsers : '-'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">UIDs únicos registrados</p>
            </div>

            {/* Returning Users */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <UserCheck size={14} className="text-emerald-600" />
                <span>Usuarios Recurrentes</span>
              </div>
              <p className="text-xl font-extrabold text-emerald-600">
                {sessionMetrics ? sessionMetrics.returningUsers : '-'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Visitas en 2+ días distintos</p>
            </div>

            {/* Return Rate */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <RotateCcw size={14} className="text-purple-600" />
                <span>Tasa de Retorno</span>
              </div>
              <p className="text-xl font-extrabold text-purple-600">
                {sessionMetrics && sessionMetrics.totalUniqueUsers > 0
                  ? `${((sessionMetrics.returningUsers / sessionMetrics.totalUniqueUsers) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">% de retención comunitaria</p>
            </div>

            {/* Total Daily Sessions */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <Activity size={14} className="text-amber-600" />
                <span>Sesiones Diarias</span>
              </div>
              <p className="text-xl font-extrabold text-amber-700">
                {sessionMetrics ? sessionMetrics.totalSessions : '-'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Total registros de sesión</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Listado de Reportes ({events.length})</h2>
            <p className="text-xs text-gray-500">Visualiza y elimina reportes de la comunidad.</p>
          </div>
        </div>

        {loadingEvents ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Cargando reportes en tiempo real...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-base font-semibold text-gray-800">No hay reportes registrados</h3>
            <p className="text-xs text-gray-500">La colección de eventos se encuentra vacía.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[11px] font-semibold uppercase text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Foto</th>
                    <th className="px-4 py-3.5">Título / Descripción</th>
                    <th className="px-4 py-3.5">Tipo</th>
                    <th className="px-4 py-3.5">Severidad</th>
                    <th className="px-4 py-3.5">Estado</th>
                    <th className="px-4 py-3.5">Reportero</th>
                    <th className="px-4 py-3.5">Fecha</th>
                    <th className="px-4 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Foto */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ev.photo ? (
                          <a
                            href={ev.photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group relative"
                          >
                            <img
                              src={getMapThumbnailUrl(ev.photo)}
                              alt={ev.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-[10px]">
                            Sin foto
                          </div>
                        )}
                      </td>

                      {/* Título & Descripción */}
                      <td className="px-4 py-3 min-w-[200px] max-w-xs">
                        <p className="font-bold text-gray-900 text-sm line-clamp-1">{ev.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{ev.description}</p>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-800">{formatTipo(ev.tipo)}</span>
                      </td>

                      {/* Severidad */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getSeverityBadge(
                            ev.severity
                          )}`}
                        >
                          {ev.severity}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${getEstadoBadge(
                            ev.estado
                          )}`}
                        >
                          {ev.estado.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Reportero */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {ev.reporter || 'Vecino/a de Chillán'}
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {ev.date}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEvent(ev);
                            setEditFormData({
                              title: ev.title,
                              description: ev.description,
                              reporter: ev.reporter,
                              tipo: ev.tipo,
                              severity: ev.severity,
                              estado: ev.estado,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-800 hover:text-white border border-gray-200 text-xs font-medium transition"
                          title="Editar título, descripción y datos"
                        >
                          <Pencil size={13} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingLocationEvent(ev);
                            setTempLocation({ lat: ev.lat, lng: ev.lng });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 text-xs font-medium transition"
                          title="Corregir ubicación en el mapa"
                        >
                          <MapPin size={13} />
                          <span>Ubicación</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(ev.id, ev.title)}
                          disabled={deletingId === ev.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-medium transition disabled:opacity-50"
                        >
                          {deletingId === ev.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Reposition Report Location Modal */}
      {editingLocationEvent && tempLocation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setEditingLocationEvent(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Corregir Ubicación del Reporte</h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{editingLocationEvent.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLocationEvent(null)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <LocationPickerMap
                location={tempLocation}
                onChangeLocation={setTempLocation}
                heightClassName="h-64"
                hintText="Arrastra el marcador azul a la calle exacta"
              />
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2 border border-gray-100 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-blue-600" />
                  <span className="font-mono">{tempLocation.lat.toFixed(5)}, {tempLocation.lng.toFixed(5)}</span>
                </div>
                <span className="text-[11px] text-gray-400">Nuevas coordenadas</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingLocationEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={isSavingLocation}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 active:scale-95"
              >
                {isSavingLocation ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{isSavingLocation ? 'Guardando...' : 'Guardar ubicación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Report Details Modal */}
      {editingEvent && editFormData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setEditingEvent(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Editar Reporte</h3>
                <p className="text-xs text-gray-500 mt-0.5">Corrige títulos, descripciones o categorías</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="ej. Bache en Av. O'Higgins"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder="Descripción detallada del daño vial"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Evento</label>
                  <select
                    value={editFormData.tipo}
                    onChange={(e) => setEditFormData({ ...editFormData, tipo: e.target.value as EventType })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium bg-white outline-none focus:border-blue-500"
                  >
                    <option value="bache">Bache / Daño</option>
                    <option value="corte_calle">Corte de calle</option>
                    <option value="otro">Otro problema</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Peligro Vial</label>
                  <select
                    value={editFormData.severity}
                    onChange={(e) => setEditFormData({ ...editFormData, severity: e.target.value as Severity })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium bg-white outline-none focus:border-blue-500 capitalize"
                  >
                    <option value="leve">Leve (Verde)</option>
                    <option value="moderado">Moderado (Amarillo)</option>
                    <option value="critico">Crítico (Rojo)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                  <select
                    value={editFormData.estado}
                    onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value as EventStatus })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium bg-white outline-none focus:border-blue-500 capitalize"
                  >
                    <option value="activo">Activo</option>
                    <option value="intervencion_parcial">Intervención Parcial</option>
                    <option value="resuelto">Resuelto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reportero</label>
                  <input
                    type="text"
                    value={editFormData.reporter}
                    onChange={(e) => setEditFormData({ ...editFormData, reporter: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                    placeholder="Nombre o alias"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 active:scale-95"
              >
                {isSavingEdit ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{isSavingEdit ? 'Guardando...' : 'Guardar cambios'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
