const M = (t, c, f) => '<div class="tile' + (f ? ' foco' : '') + '" style="background:' + c + '">' + t + '</div> ';
window.GUIA = {
  app: 'DELBEN SGI', sub: 'Sistema de Gestión Integral',
  icono: 'fa-solid fa-gauge-high', c1: '#1040a0', c2: '#1e6fc8', abrir: '../sgi/', apk: '../portal/apk/DelbenSGI.apk',
  roles: [{
    id: 'usuario', nombre: 'Usuarios de SGI',
    pasos: [
      { t: 'Entrar y el menú',
        html: '<p>Entrá con tu <b>usuario y contraseña</b>. Cada perfil ve solo las ventanas que tiene autorizadas.</p><p>El menú principal tiene: Ingreso de Stock, Registro de Salida, Inventarios, Gestión de Personal, Flota Automotriz, Datos Varios, Anotaciones, Orden de Compra, Indumentaria, Control Móviles y Solicitud Indumentaria.</p><div class="tip">El botón de menú (hamburguesa) te lleva a cualquier ventana sin volver al inicio.</div>',
        tel: { titulo: 'DELBEN SGI', quien: 'Menú', cont: M('Ingreso de Stock', '#2e7d32') + M('Registro de Salida', '#c62828') + M('Inventarios', '#6a1b9a') + M('Gestión de Personal', '#1565c0', 1) + M('Flota Automotriz', '#00838f') + M('Indumentaria', '#ef6c00') },
      },
      { t: 'Stock: ingresos y salidas',
        html: '<ul><li><b>Ingreso de Stock</b>: cargás lo que entra al depósito (cantidad, código, ítem, proveedor).</li><li><b>Registro de Salida</b>: <b>Nueva Salida</b> con quién retira, objetivo, ítems y a quién se asigna. Si marcás <b>Asignar al Servicio</b>, también queda en el inventario del servicio.</li><li><b>Inventarios</b>: Inventario Oficina e Inventarios Servicios, con el total valorizado.</li></ul>',
        tel: { titulo: 'Registro de Salida', tabs: ['Nueva Salida', 'Registros'], on: 'Nueva Salida', cont: '<div class="cd"><div class="lb">Quien Retira</div><div class="in">Carlos Sandoval</div><div class="lb">Objetivo/Cliente</div><div class="in">Fincas de Iraola 2</div><div class="row"><span>2 · Camisa celeste</span></div><div class="row foco"><span>Asignar al Servicio</span><b>✓</b></div><span class="b v">Registrar Salida</span></div>' } },
      { t: 'Gestión de Personal',
        html: '<p>Pestañas: Nuevo Ingreso, Listado de Personal, Cargos del Personal, Vacaciones, Proyección de Vac., Días por Período, Diagrama, Ausencias, Informe de Personal, Cargos Firmados y Devoluciones.</p><ul><li>En el <b>Listado</b> buscás, filtrás y exportás.</li><li><b>Vacaciones</b> calcula los días según la antigüedad.</li><li><b>Cargos Firmados</b> y <b>Devoluciones</b> muestran lo firmado en la app Cargos del Personal.</li></ul>',
        tel: { titulo: 'Gestión de Personal', tabs: ['Nuevo Ingreso', 'Listado de Personal', 'Vacaciones'], on: 'Listado de Personal', cont: '<div class="cd"><div class="in foco">buscar: pérez</div><div class="row"><span>Pérez Juan<br>LP 1234 · PPQ</span><span class="bd a">Activo</span></div><div class="row"><span>Pérez Ana<br>LP 2210 · LEG</span><span class="bd a">Activo</span></div></div>' } },
      { t: 'Flota Automotriz',
        html: '<p>Pestañas: Nuevo Vehículo, Listado de Flota, Mantenimiento, Trabajos a Realizar, Documentación, Pólizas, Status de Flota y Movileros.</p><ul><li>Cargás dominio, marca, modelo, vencimientos de VTV y póliza.</li><li>Al entrar, SGI avisa con una <b>alerta de vencimiento de VTV</b>.</li><li><b>Status de Flota</b> muestra el estado de cada vehículo con colores.</li></ul>',
        tel: { titulo: 'Flota Automotriz', tabs: ['Listado de Flota', 'Mantenimiento', 'Status de Flota'], on: 'Listado de Flota', cont: '<div class="cd foco" style="background:#fff4d6"><b>⚠ PRÓXIMO VENCIMIENTO VTV</b><br>AB123CD · 30/10/2026</div><div class="row"><span>AB123CD<br>Toyota Hilux</span><span>PPQ</span></div>' } },
      { t: 'Indumentaria y Orden de Compra',
        html: '<ul><li><b>Indumentaria</b>: Nueva Solicitud, Solicitudes Registradas, próximas entregas y curvas. Cada solicitud tiene estado (Activo, Pendiente, Entregado, Baja).</li><li><b>Solicitud Indumentaria</b>: el pedido que hacen los supervisores.</li><li><b>Orden de Compra</b>: Nueva OC, Listado, Reimprimir, OC Autorizadas, No Autorizadas y Pendientes.</li></ul>',
        tel: { titulo: 'Orden de Compra', tabs: ['Nueva OC', 'Listado de OC', 'OC Autorizadas'], on: 'Nueva OC', cont: '<div class="cd"><div class="lb">Proveedor</div><div class="in">Uniformes SRL</div><div class="lb">Concepto</div><div class="in">Indumentaria</div><span class="b foco">Cargar Datos</span></div>' } },
      { t: 'Datos Varios, Anotaciones y Móviles',
        html: '<ul><li><b>Datos Varios</b>: Quien Retira, Objetivos, Empresas, Líneas, Proveedores, Precios, <b>Perfiles</b> (qué pestañas ve cada rol) y <b>Apariencia</b> (colores de cada ventana).</li><li><b>Anotaciones</b>: notas y agenda; con "Para todos" las ven supervisores y coordinadores.</li><li><b>Control Móviles</b>: los controles de Combustible, Carro Eléctrico y Bicicletas que se cargan desde la app Control de Móviles.</li></ul>',
        tel: { titulo: 'Datos Varios', tabs: ['Quien Retira', 'Objetivo/Cliente', 'Perfiles', 'Apariencia'], on: 'Perfiles', cont: '<div class="cd"><div class="row"><span>Flota</span><span>✓ Supervisor ✓ Admin</span></div><div class="row foco"><span>Cargos Firmados</span><span>✓ Admin</span></div><span class="b v">Guardar</span></div>' } }
    ],
    faq: [
      ['No veo una ventana o una pestaña', 'Depende de tu perfil. El administrador lo habilita en Datos Varios → Perfiles.'],
      ['Olvidé la contraseña', 'Pedile al administrador que la cambie. Con la sesión abierta, también podés cambiarla en Cambiar Contraseña.'],
      ['Vengo desde Novedades del Personal', 'El botón SGI de Novedades entra directo, sin volver a pedir usuario y clave.']
    ]
  }]
};
