// auth-guard.js
// Este script protege las páginas de administración.
// Comprueba si hay una sesión de usuario activa y, de no ser así,
// redirige a la página de inicio de sesión.

import { supabase } from './database.js';

(async () => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error al obtener la sesión:', error);
  }

  if (!session) {
    // No hay sesión activa, redirigir al login.
    // El `replace` evita que el usuario pueda volver con el botón de "atrás".
    window.location.replace('login.html');
  }
  // Si hay una sesión, el script no hace nada y permite que la página se cargue normalmente.
})();
