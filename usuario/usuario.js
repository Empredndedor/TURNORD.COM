// usuario.js
import { supabase } from '../database.js';
import Config from '../config.js';

// Estado en memoria/localStorage
let turnoAsignado = null;
let intervaloContador = null;
let telefonoUsuario = localStorage.getItem('telefonoUsuario') || null;

// Cache de configuración de negocio (se carga desde la BD)
let configCache = {
  hora_apertura: '09:00',
  hora_cierre: '18:00',
  limite_turnos: 50,
  dias_operacion: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
};

// Persistencia del deadline del turno para que el contador continúe al volver a la pestaña
function getDeadlineKey(turno) {
  const userId = supabase.auth.getUser()?.id || 'default';
  return `turnoDeadline:${userId}:${turno}`;
}

// Catálogo de servicios (nombre -> duracion_min)
let serviciosCache = {};
async function cargarServiciosActivos() {
  try {
    // RLS se encarga de filtrar por negocio_id
    const { data, error } = await supabase
      .from('servicios')
      .select('nombre,duracion_min')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) throw error;

    serviciosCache = {};
    (data || []).forEach(s => { serviciosCache[s.nombre] = s.duracion_min; });

    const sel = document.querySelector('select[name="tipo"]');
    if (sel) {
      sel.innerHTML = '<option value="">Seleccione un servicio</option>' +
        (data || []).map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    }
  } catch (e) {
    console.warn('No se pudieron cargar servicios activos.', e);
  }
}

// Utilidades de fecha/hora
function obtenerFechaActual() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function obtenerHoraActual() {
  const hoy = new Date();
  const horas = String(hoy.getHours()).padStart(2, '0');
  const minutos = String(hoy.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

function cerrarModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
}

// Conversión HH:MM a minutos totales
function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Obtiene config (apertura, cierre, límite) desde la nueva tabla
async function obtenerConfig() {
  // RLS se encarga de devolver la config del negocio del usuario actual
  const { data, error } = await supabase
    .from('negocio_configuracion')
    .select('hora_apertura, hora_cierre, limite_turnos, dias_operacion')
    .single();

  if (error) throw new Error(error.message);

  // Actualizar cache
  if (data) {
    configCache = { ...configCache, ...data };
  }
  return data;
}

// Actualiza la configuración y notifica
async function actualizarConfiguracion() {
  try {
    const config = await obtenerConfig();
    if (config) {
      mostrarNotificacionConfiguracion(
        'Configuración cargada',
        `Horarios: ${config.hora_apertura} - ${config.hora_cierre} | Límite: ${config.limite_turnos} turnos`
      );
      console.log('Configuración del negocio:', config);
    }
  } catch (error) {
    console.error('Error al cargar la configuración del negocio:', error);
  }
}

function mostrarNotificacionConfiguracion(titulo, mensaje) {
  const notificacion = document.createElement('div');
  notificacion.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm';
  notificacion.innerHTML = `
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium">${titulo}</p>
        <p class="text-sm text-blue-100 mt-1">${mensaje}</p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-blue-200 hover:text-white">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(notificacion);
  setTimeout(() => { if (notificacion.parentElement) notificacion.remove(); }, 5000);
}

// Cuenta turnos de una fecha YYYY-MM-DD
async function contarTurnosDia(fechaISO) {
  // RLS filtra por negocio
  const { count, error } = await supabase
    .from('turnos')
    .select('id', { count: 'exact', head: true })
    .eq('fecha', fechaISO);

  if (error) throw new Error(error.message);
  return count || 0;
}

// ===== Verificación de break =====
async function verificarBreakNegocio() {
  try {
    // La tabla estado_negocio no fue migrada, se asume que no hay break.
    // Si se necesita, se debe crear y migrar esta tabla de forma similar a las otras.
    return { enBreak: false, mensaje: null };
  } catch (error) {
    console.error('Error al verificar break:', error);
    return { enBreak: false, mensaje: null };
  }
}

function mostrarNotificacionBreak(mensaje, tiempoRestante) {
  // ... (código sin cambios)
}

// ===== Días laborales =====
async function verificarDiaLaboralFecha(fecha = new Date()) {
  try {
    if (!configCache.dias_operacion || configCache.dias_operacion.length === 0) {
      return false; // No hay días configurados
    }

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dia = diasSemana[fecha.getDay()];
    return configCache.dias_operacion.includes(dia);
  } catch (error) {
    console.error('Error al verificar día laboral:', error);
    return true; // Permitir por defecto en caso de error
  }
}

async function verificarDiaLaboral() {
  return verificarDiaLaboralFecha(new Date());
}

// ===== Lógica de turnos =====
function obtenerLetraDelDia() {
  const hoy = new Date();
  const fechaBase = new Date('2024-08-23'); // Fecha base donde A = día 0
  const diferenciaDias = Math.floor((hoy - fechaBase) / (1000 * 60 * 60 * 24));
  const indiceDia = ((diferenciaDias % 26) + 26) % 26; // Asegurar positivo
  const letra = String.fromCharCode(65 + indiceDia); // 65 = 'A'
  return letra;
}

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

  if (error || !data || data.length === 0) return `${letraHoy}01`;

  const ultimo = data[0].turno || `${letraHoy}00`;
  const numero = parseInt(ultimo.substring(1), 10) + 1;
  return `${letraHoy}${String(numero).padStart(2, '0')}`;
}

async function verificarTurnoActivo() {
  telefonoUsuario = localStorage.getItem('telefonoUsuario');
  if (!telefonoUsuario) return false;

  // RLS filtra por negocio
  const { data, error } = await supabase
    .from('turnos')
    .select('*')
    .eq('estado', 'En espera')
    .eq('telefono', telefonoUsuario)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al verificar turno activo:', error.message);
    return false;
  }

  if (!data || data.length === 0) return false;

  turnoAsignado = data[0].turno;
  await mostrarMensajeConfirmacion(data[0]);
  return true;
}

async function obtenerPosicionEnFila(turnoUsuario) {
  // RLS filtra por negocio
  const { data, error } = await supabase
    .from('turnos')
    .select('turno')
    .eq('estado', 'En espera')
    .order('created_at', { ascending: true });

  if (error || !data) return 0;

  const index = data.findIndex(t => t.turno === turnoUsuario);
  return index;
}

// Calcular tiempo estimado total considerando todos los servicios en cola
async function calcularTiempoEstimadoTotal(turnoObjetivo = null) {
  const hoy = new Date().toISOString().slice(0, 10);
  let tiempoTotal = 0;

  // 1) Obtener tiempo restante del turno en atención (RLS filtra)
  try {
    const { data: enAtencion } = await supabase
      .from('turnos')
      .select('servicio, started_at')
      .eq('fecha', hoy)
      .eq('estado', 'En atención')
      .order('started_at', { ascending: true })
      .limit(1);

    if (enAtencion && enAtencion.length) {
      // ... (lógica sin cambios)
    }
  } catch (error) {
    console.warn('Error calculando tiempo de atención:', error);
  }

  // 2) Obtener cola de espera y sumar tiempos de servicios (RLS filtra)
  try {
    const { data: cola } = await supabase
      .from('turnos')
      .select('turno, servicio')
      .eq('estado', 'En espera')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true });

    if (cola && cola.length) {
      // ... (lógica sin cambios)
    }
  } catch (error) {
    console.warn('Error calculando tiempo de cola:', error);
  }

  return tiempoTotal;
}

async function mostrarMensajeConfirmacion(turnoData) {
  // ... (código con getDeadlineKey ya actualizado)
}

async function cancelarTurno(turnoData) {
    // ... (lógica de cancelación, remover .eq('negocio_id', ...))
    const { error } = await supabase
        .from('turnos')
        .update({ estado: 'Cancelado' })
        .eq('turno', turnoData.turno)
        .eq('telefono', telefonoUsuario);
    // ...
}

async function actualizarTurnoActualYConteo() {
  const hoy = new Date().toISOString().slice(0, 10);

  // RLS filtra por negocio
  const { data: enAtencion } = await supabase
    .from('turnos')
    .select('turno')
    .eq('fecha', hoy)
    .eq('estado', 'En atención')
    .order('started_at', { ascending: true })
    .limit(1);

  // ... (resto de la lógica sin cambios)
}

// Toma de turno desde formulario simple (hoy/ahora)
async function tomarTurnoSimple(nombre, telefono, servicio) {
  // ... (lógica de validación sin cambios)

  // RLS filtra por negocio
  const { data: turnosActivos } = await supabase
    .from('turnos')
    .select('*')
    .eq('estado', 'En espera')
    .eq('telefono', telefonoUsuario);

  // ... (lógica sin cambios)

  // La inserción no necesita negocio_id, RLS no aplica a INSERT por defecto
  // pero la política que creamos sí lo hace.
  // Sin embargo, la función get_current_negocio_id no puede ser usada en INSERT
  // como valor por defecto. La inserción debe ocurrir desde un entorno autenticado.
  // Este es un problema para una página de usuario no autenticado.
  // Por ahora, asumimos que esta página es para usuarios que NO inician sesión,
  // por lo que no podemos usar RLS aquí.
  // La solución sería un login de cliente o pasar un negocio_id público.
  // Esto requiere un cambio de arquitectura mayor.
  // Por ahora, vamos a hardcodear un ID público de negocio para esta página.
  // Esto es una DEUDA TÉCNICA.
  const publicNegocioId = 'ID_PUBLICO_DE_UN_NEGOCIO_EN_LA_BD';

  const { error } = await supabase.from('turnos').insert([
    {
      negocio_id: publicNegocioId, // DEUDA TÉCNICA
      turno: nuevoTurno,
      nombre,
      telefono,
      servicio,
      estado: 'En espera',
      fecha,
      hora,
    },
  ]);
  // ...
}

// ===== Inicialización =====
window.addEventListener('DOMContentLoaded', async () => {
    // ...
    // Suscripción en tiempo real de turnos
    // El filtro ya no es necesario si RLS está bien configurado para real-time
    supabase
      .channel('turnos-usuario')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        async (payload) => {
            // ...
        }
      )
      .subscribe();
    // ... (repetir para otros canales)
});

export async function tomarTurno(nombre, telefono, servicio, fechaISO, horaHHMM) {
    // ... (misma deuda técnica que en tomarTurnoSimple)
}
