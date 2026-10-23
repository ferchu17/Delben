/* =====================================================================
   PORTAL DE ACCESO — LISTA DE APLICACIONES Y QUIÉN LAS VE
   Cada persona entra con su usuario y clave del SGI y ve solo las apps de su perfil
   (el perfil es el de la hoja de usuarios del SGI: Supervisor, Coordinador, Administrativo,
   Administrador, Flota, Visor...). El Administrador ve todas.

   Para sumar una app nueva: copiá un bloque, cambiá los datos y en "perfiles" poné quién la ve
   ('*' = todos). Al subirlo a GitHub, le aparece sola a cada persona de esos perfiles.

   - id:        identificador corto (sin espacios)
   - nombre / desc: lo que se ve en la tarjeta
   - img:       imagen de la app (carpeta iconos/). Si no hay, se usa el ícono de Font Awesome
   - icono:     ícono de Font Awesome (fontawesome.com/icons) para cuando no hay imagen
   - link:      dirección de la app
   - guia:      instructivo interactivo de la app
   - guiaRol:   (opcional) parte del instructivo según el perfil (ej.: Administrador -> admin)
   - perfiles:  '*' o lista de perfiles que la ven
   - acceso:    (opcional) 'sgi' entra al SGI sin volver a poner la clave;
                'novedades' entra a Novedades del Personal con la misma sesión
                (y solo se muestra si la persona tiene acceso a Novedades)
   - color1/2:  colores de la tarjeta
   ===================================================================== */
window.PORTAL_APPS = [
  { id: 'sgi', nombre: 'DELBEN SGI', desc: 'Sistema de Gestión Integral', img: '../iconos/sgi-192.png', icono: 'fa-solid fa-gauge-high',
    link: '../sgi/', guia: '../instructivos/sgi.html', perfiles: '*', acceso: 'sgi', color1: '#1040a0', color2: '#1e6fc8' },

  { id: 'novedades', nombre: 'Novedades del Personal', desc: 'Proyección y novedades semanales de tus servicios', img: '../iconos/novedades-192.png', icono: 'fa-solid fa-calendar-check',
    link: '../novedades/', guia: '../instructivos/novedades.html', guiaRol: { Administrador: 'admin', '*': 'supervisor' },
    perfiles: '*', acceso: 'novedades', color1: '#5a1a7a', color2: '#8a30b0',
    nota: 'Adentro, el botón Instructivo muestra la ayuda de tu perfil y se puede bajar en PDF.' },

  { id: 'informe', nombre: 'Informe de Novedades', desc: 'Informes con fotos, PDF y envío por mail', img: '../informe-de-novedades/assets/icono-512.png', icono: 'fa-solid fa-file-pen',
    link: '../informe-de-novedades/', guia: '../instructivos/informe.html',
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo'], color1: '#1a7a40', color2: '#2db865' },

  { id: 'minuta', nombre: 'Minuta Operativa del Servicio', desc: 'Minuta diaria de cada servicio: presentismo, novedades, fotos y PDF', img: '../iconos/minuta-192.png', icono: 'fa-solid fa-clipboard-check',
    link: '../minuta-operativa/', guia: '../instructivos/minuta.html', guiaRol: { Servicios: 'servicio', '*': 'supervisor' },
    perfiles: ['Servicios', 'Supervisor', 'Coordinador', 'Administrativo', 'Visor'], color1: '#1F3864', color2: '#2E5597',
    nota: 'Los servicios entran con su usuario y cargan la minuta del turno. Supervisores y administración ven los Informes y los Presentes.' },

  { id: 'moviles', nombre: 'Control de Móviles', desc: 'Control de vehículos con fotos e informe', img: '../iconos/moviles-192.png', icono: 'fa-solid fa-car-side',
    link: '../', guia: '../instructivos/moviles.html',
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo', 'Flota'], color1: '#1a4a7a', color2: '#2060b0' },

  { id: 'cargos', nombre: 'Cargos del Personal', desc: 'Entrega y devolución de indumentaria con firma', img: '../iconos/cargos-192.png', icono: 'fa-solid fa-shirt',
    link: '../cargos/', guia: '../instructivos/cargos.html',
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo'], color1: '#2a4a7a', color2: '#3a70c0' },

  { id: 'licencias', nombre: 'Licencias del Personal', desc: 'Vacaciones, enfermedad y demás licencias con firma, PDF y mail', img: '../iconos/licencias-192.png', icono: 'fa-solid fa-file-signature',
    link: '../licencias/', guia: '../instructivos/licencias.html', guiaRol: { Administrador: 'admin', '*': 'supervisor' },
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo'], color1: '#6B2D5C', color2: '#8E3B7A' },

  { id: 'documentacion', nombre: 'Documentación', desc: 'Automotriz, ART y Seguro de vida', img: '../iconos/documentacion-192.png', icono: 'fa-solid fa-folder-open',
    link: '../documentacion/', guia: '../instructivos/documentacion.html',
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo', 'Flota'], color1: '#6b4a1a', color2: '#a07030' },

  { id: 'combustible', nombre: 'Combustible', desc: 'Fondos, tickets y rendición de combustible', img: '../iconos/combustible-192.png', icono: 'fa-solid fa-gas-pump',
    link: '../combustible/', guia: '../combustible/ayuda.html',
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo'], color1: '#a0141e', color2: '#d42a2a' },

  { id: 'datos', nombre: 'Datos Personales', desc: 'Ficha de datos del personal (para pasarle al personal)', img: '../iconos/datos-personal-192.png', icono: 'fa-solid fa-id-card',
    link: '../datos-personal.html', guia: '../instructivos/datos-personales.html',
    perfiles: ['Supervisor', 'Coordinador', 'Administrativo'], color1: '#1a4a3a', color2: '#307060' }
];
