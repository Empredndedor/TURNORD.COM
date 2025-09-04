// turno.js - Lógica principal del panel de administración de turnos
import { supabase } from '../database.js';

// --- Estado y Cache Global ---
let turnoActual = null; // El próximo turno en espera
let dataRender = []; // Cache de la lista de espera para reordenar
let serviciosCache = {}; // Cache de { nombre: duracion_min }
let chart = null; // Instancia del gráfico

// --- Configuración del Negocio (cargada desde la BD) ---
let configNegocio = {
  hora_apertura: "08:00",
  hora_cierre: "23:00",
  limite_turnos: 50,
  dias_operacion: [1, 2, 3, 4, 5, 6] // Lunes a Sábado por defecto
};

// --- Helpers ---
// Unificar refrescos de UI para evitar llamadas duplicadas
let __refreshTimer = null;
function refrescarUI() {
  if (__refreshTimer) return;
  __refreshTimer = setTimeout(async () => {
    __refreshTimer = null;
    await cargarTurnos();
    await cargarEstadisticas();
  }, 350); // Un poco más de delay para agrupar cambios
}

// Actualizador de minuteros (tiempo en espera/atención)
let __elapsedTimer = null;
function iniciarActualizadorMinutos() {
  if (__elapsedTimer) clearInterval(__elapsedTimer);
  actualizarMinuteros();
  __elapsedTimer = setInterval(actualizarMinuteros, 30000);
}

function actualizarMinuteros() {
  try {
    const ahora = Date.now();
    document.querySelectorAll('.esperando-min').forEach(sp => {
      const iso = sp.dataset.creadoIso;
      if (!iso) return;
      const mins = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
      sp.textContent = String(mins);
    });

    const tEst = document.getElementById('tiempo-estimado');
    if (tEst && tEst.dataset.startedIso) {
      const inicio = new Date(tEst.dataset.startedIso);
      const trans = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / 60000));
      tEst.textContent = `En atención · ${trans} min`;
    }
  } catch (e) {
    console.warn('Error actualizando minuteros', e);
  }
}

function actualizarFechaHora() {
    // ... (lógica sin cambios)
}

function obtenerLetraDelDia() {
    // ... (lógica sin cambios)
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    // ... (lógica sin cambios)
}

// --- Carga de Datos (Data Fetching) ---

async function cargarConfiguracion() {
  try {
    // RLS filtra por el negocio del usuario logueado
    const { data, error } = await supabase
      .from('negocio_configuracion')
      .select('hora_apertura, hora_cierre, limite_turnos, dias_operacion')
      .single(); // Se asume una config por negocio

    if (error) throw error;
    if (data) {
      configNegocio = data;
    }
  } catch (e) {
    console.warn('No se pudo cargar la configuración del negocio, usando valores por defecto.', e);
    mostrarNotificacion('No se pudo cargar la configuración del negocio.', 'warning');
  }
}

async function cargarServicios() {
  try {
    // RLS filtra por negocio
    const { data, error } = await supabase
      .from('servicios')
      .select('nombre, duracion_min')
      .eq('activo', true);
    if (error) throw error;
    serviciosCache = {};
    (data || []).forEach(s => { serviciosCache[s.nombre] = s.duracion_min; });

    const sel = document.getElementById('servicio');
    if (sel && data && data.length) {
      sel.innerHTML = '<option value="">Seleccione un servicio</option>' +
        data.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    }
  } catch (e) {
    console.warn('No se pudieron cargar servicios, usando fallback.', e);
  }
}

async function cargarTurnos() {
    const hoy = new Date().toISOString().slice(0, 10);

    // RLS se encarga de filtrar por negocio_id
    const { data: enAtencion, error: errAt } = await supabase
        .from('turnos')
        .select('*')
        .eq('estado', 'En atención')
        .eq('fecha', hoy)
        .order('started_at', { ascending: true });

    const { data, error } = await supabase
        .from('turnos')
        .select('*')
        .eq('estado', 'En espera')
        .eq('fecha', hoy)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (error || errAt) {
        console.error('Error al cargar turnos:', error || errAt);
        mostrarNotificacion('Error al cargar turnos', 'error');
        return;
    }

    // ... (resto de la lógica de renderizado de UI sin cambios)
}

async function cargarEstadisticas() {
    const hoy = new Date().toISOString().slice(0, 10);
    // RLS filtra por negocio
    const { data: turnosAtendidos, error: errorAtendidos } = await supabase
        .from('turnos')
        .select('*')
        .eq('estado', 'Atendido')
        .eq('fecha', hoy);

    // ... (resto de la lógica de estadísticas sin cambios)
}

// --- Lógica de Negocio (Business Logic) ---

async function generarNuevoTurno() {
    const letraHoy = obtenerLetraDelDia();
    const fechaHoy = new Date().toISOString().slice(0, 10);
    // RLS filtra por negocio
    const { data, error } = await supabase
        .from('turnos')
        .select('turno')
        .eq('fecha', fechaHoy)
        .like('turno', `${letraHoy}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    // ... (resto de la lógica sin cambios)
}

async function tomarTurno(event) {
    event.preventDefault();
    // ... (validaciones de horario, etc.)
    
    // RLS filtra por negocio
    const { count: totalHoy, error: countError } = await supabase
        .from('turnos')
        .select('id', { count: 'exact', head: true })
        .eq('fecha', fechaHoy);

    // ...

    // La inserción usará la RLS policy que hemos definido
    const { error } = await supabase.from('turnos').insert([{
        // negocio_id es añadido por la policy o un trigger
        turno: nuevoTurno,
        nombre: nombre,
        // ... otros campos
    }]);
    // ...
}

// --- Event Handlers e Inicialización ---

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();
  actualizarFechaHora();
  setInterval(actualizarFechaHora, 60000);

  await cargarConfiguracion();
  await cargarServicios();
  
  refrescarUI();
  
  // ... (setup de otros event listeners)

  suscribirseACambios();
  iniciarActualizadorMinutos();
});

function suscribirseACambios() {
  // Canal único para todos los cambios relevantes para este panel
  supabase
    .channel('panel-admin-general')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => refrescarUI())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, () => cargarServicios())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'negocio_configuracion' }, async () => {
        await cargarConfiguracion();
        refrescarUI();
    })
    .subscribe();
}

// ... (resto de funciones como atenderAhora, devolverTurno, etc. refactorizadas para no usar negocioId)
// ... (ejemplo de refactorización para atenderAhora)
async function atenderAhora() {
  if (!turnoActual) {
    mostrarNotificacion('No hay turno en espera.', 'warning');
    return;
  }
  // RLS se encarga del negocio_id
  const { error } = await supabase
    .from('turnos')
    .update({ estado: 'En atención', started_at: new Date().toISOString() })
    .eq('id', turnoActual.id)
    .eq('estado', 'En espera');

  if (error) {
    mostrarNotificacion('Error al atender: ' + error.message, 'error');
    return;
  }
  mostrarNotificacion(`Atendiendo turno ${turnoActual.turno}`, 'success');
  refrescarUI();
}

// Exponer funciones al objeto window para los botones del HTML
window.tomarTurno = tomarTurno;
window.atenderAhora = atenderAhora;
// ... etc.
