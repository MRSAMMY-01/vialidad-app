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
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { getMapThumbnailUrl } from '@/services/cloudinaryService';
import type { ReportEvent } from '@/data/mockEvents';
import {
  ShieldCheck,
  ShieldAlert,
  Trash2,
  LogOut,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // 2. Subscribe to eventos collection when user is admin
  useEffect(() => {
    if (!isAdmin) {
      setEvents([]);
      return;
    }

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
        <div className="flex items-center justify-between">
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

                      {/* Eliminar */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(ev.id, ev.title)}
                          disabled={deletingId === ev.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-medium transition disabled:opacity-50"
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
    </div>
  );
}
