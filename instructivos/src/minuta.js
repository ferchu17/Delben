window.GUIA = {
  app: 'Minuta Operativa del Servicio', sub: 'La minuta diaria de cada servicio: presentismo, novedades, fotos, PDF y mail',
  icono: 'fa-solid fa-clipboard-check', c1: '#1F3864', c2: '#2E5597', abrir: '../minuta-operativa/',
  apk: 'https://github.com/ferchu17/Delben/releases/download/minuta-operativa-apk/MinutaOperativa.apk',
  roles: [{
    id: 'servicio', nombre: 'Encargado del servicio',
    pasos: [
      { t: 'Entrar con el usuario del servicio',
        html: '<p>Entrá con el <b>usuario y la contraseña del servicio</b> (por ejemplo <b>sfrancisco</b>, <b>laguna</b> o <b>raizen</b>).</p><ol><li>Aparecen solos el <b>nombre del servicio</b>, su <b>logo</b> y el <b>supervisor</b>.</li><li>La sesión queda abierta: aunque se cierre el navegador o el celular, al volver a abrir la app está todo como lo dejaste.</li><li>Solo se cierra con el botón <b>Salir</b>.</li></ol>',
        tel: { quien: 'Ingreso', cont: '<div class="cd"><div class="h">Minuta Operativa del Servicio</div><div class="lb">Usuario</div><div class="in">sfrancisco</div><div class="lb">Contraseña</div><div class="in">••••••</div><span class="b n foco">Ingresar</span></div>' } },
      { t: 'Datos generales',
        html: '<ol><li>La <b>fecha</b> y el <b>día</b> se completan solos (de madrugada toma la fecha del turno noche que empezó el día anterior).</li><li>Elegí el <b>turno</b>: Diurno o Nocturno. El horario sale del servicio.</li><li>Elegí al <b>jefe de servicio / encargado</b> que hace el informe: escribí el apellido o el legajo y tocá la persona. Debajo aparecen su <b>legajo</b> y su <b>empresa</b>.</li><li>Elegí el <b>supervisor</b> en la lista desplegable: a él le llega la minuta.</li></ol>',
        tel: { quien: 'Nueva minuta', cont: '<div class="cd"><div class="lb">Turno *</div><div class="in">Nocturno</div><div class="lb">Jefe de servicio / Encargado *</div><div class="in foco">SELTZER EMMANUEL</div><div style="font-size:9px"><b>Leg. 310</b> · PPQ</div><div class="lb">Supervisor *</div><div class="in">Gerardo Vica ▾</div></div>' } },
      { t: 'Personal y horas',
        html: '<p>En <b>Personal en servicio</b> cargá a cada persona del turno con <b>＋ Agregar persona</b>.</p><ul><li>Elegila de la lista: queda con <b>legajo y empresa</b>.</li><li>Poné <b>ingreso</b> y <b>egreso</b>: la app calcula sola las horas. Por ejemplo de 19:00 a 07:00 son <b>12 h</b> (3 diurnas y 9 nocturnas).</li><li>Horas diurnas: de 06:00 a 21:00. Nocturnas: de 21:00 a 06:00.</li></ul><p>En <b>Francos y licencias</b> se cargan los que no trabajan (F, VAC, ENF, ART, etc.).</p>',
        tel: { quien: 'Personal en servicio', cont: '<div class="cd"><div class="lb">Apellido y nombre</div><div class="in">CASTRO CARLOS</div><div class="lb">Ingreso · Egreso</div><div class="in">19:00 · 07:00</div><span class="b foco">⏱ 12 h</span><span class="b g">☀️ 3</span><span class="b g">🌙 9</span></div>' } },
      { t: 'Vehículos',
        html: '<ol><li>Escribí la <b>patente</b>: aparece la lista de la flota y al elegirla se completan el vehículo, el color, el año y la empresa.</li><li>Poné el <b>Km inicio</b> y el <b>Km fin</b>: el <b>Recorrido total</b> se calcula solo.</li><li>Elegí el <b>Movilero</b> (queda con legajo y empresa) y el nivel de combustible.</li></ol>',
        tel: { quien: 'Vehículos', cont: '<div class="cd"><div class="lb">Patente / N°</div><div class="in foco">OOL102</div><div style="font-size:9px">Fiat Strada · ROJO · 2015</div><div class="lb">Km inicio · Km fin</div><div class="in">141.708 · 141.745</div><div class="lb">Recorrido total</div><div class="in"><b>37 km</b></div><div class="lb">Movilero</div><div class="in">CASTRO CARLOS</div></div>' } },
      { t: 'Novedades durante la guardia',
        html: '<p>La minuta se va escribiendo <b>durante toda la guardia</b>, a medida que pasan las cosas:</p><ul><li><b>＋ Agregar novedad</b>: la hora se pone sola. Elegí la sección (CCTV, supervisión, portones…), quién y qué pasó.</li><li><b>＋ Agregar recorrida</b>: rondines con vigilador, sector, modo y marcación QR.</li><li><b>Novedades relevantes</b>: lo importante (reflector quemado, perímetro suelto). Va destacado en el mail.</li></ul><div class="tip">🎤 En <b>Detalle</b> (inicio de turno y cada novedad) y en <b>Observaciones finales</b> hay un micrófono: tocalo, hablá y lo que digas se escribe. Tocá ⏹ para terminar.</div><div class="tip">Todo se guarda solo en el celular. Si se cierra la app, al abrirla seguís donde estabas.</div>',
        tel: { quien: 'Registro de novedades', cont: '<div class="cd"><div class="row"><span><b>23:00</b> · Cierre de portones</span></div><div class="row"><span><b>01:37</b> · Llamado AVVN</span></div><span class="b n foco">＋ Agregar novedad</span></div>' } },
      { t: 'Fotos',
        html: '<p>En <b>Registro fotográfico</b> hay dos botones:</p><ul><li><b>📷 Sacar foto</b>: abre la cámara del celular.</li><li><b>📎 Adjuntar archivos</b>: elegís fotos de la galería o de la PC (varias a la vez).</li></ul><p>Podés agregar hasta 60 fotos y ponerle una descripción a cada una.</p>',
        tel: { quien: 'Registro fotográfico', cont: '<div class="cd"><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><div class="foto">Foto 1</div><div class="foto">Foto 2</div></div><span class="b foco">📷 Sacar foto</span><span class="b g">📎 Adjuntar archivos</span></div>' } },
      { t: 'Guardar y enviar',
        html: '<p>Al terminar la guardia, tocá <b>💾 Guardar y enviar</b>.</p><ol><li>Le llega siempre al <b>servicio</b>, al <b>supervisor</b>, a <b>Gustavo San Martín</b> y a <b>Fernando</b>.</li><li>Además podés elegir contactos guardados (intendente, auditor…) o agregar uno nuevo con nombre y correo: queda guardado para la próxima.</li><li>Una vez enviada, <b>la minuta no se puede modificar</b>.</li></ol><p>Enseguida queda abierta la minuta del <b>turno siguiente</b>, sin cerrar sesión: el nocturno sigue con sus novedades.</p>',
        tel: { quien: 'Guardar y enviar', cont: '<div class="cd"><div class="lb">Le llega siempre a</div><div style="font-size:9px">Servicio · Supervisor · Gustavo · Fernando</div><div class="lb">Además, a</div><span class="b g">✔ Intendente</span><span class="b g">＋ Auditor</span><span class="b v foco">✅ Guardar y enviar</span></div>' } },
      { t: 'Informes',
        html: '<p>En <b>📂 Informes</b> están todas las minutas del servicio en PDF.</p><ul><li>Buscá por cualquier dato: novedad, vigilador, legajo, patente, sector o fecha.</li><li><b>📄 Ver PDF</b>, <b>⬇ Descargar</b> o <b>📨 Reenviar</b> a otro correo.</li><li>Si alguna dice <b>Correo no enviado</b>, tocá <b>🔁 Reintentar envío</b>.</li></ul>',
        tel: { quien: 'Informes', cont: '<div class="cd"><div class="in foco">portones</div><div class="row"><span>Lunes 19/10 · 🌙 Nocturno</span><span class="b" style="font-size:9px">PDF</span></div><div class="row"><span>Martes 20/10 · ☀️ Diurno</span><span class="b" style="font-size:9px">PDF</span></div></div>' } }
    ],
    faq: [
      ['No aparece una persona en la lista', 'La lista sale del personal activo de SGI. Si es nueva o figura de baja, avisale a administración.'],
      ['No aparece la patente', 'La lista sale de la flota de SGI (sin los vehículos dados de baja). Igual podés escribir la patente y el vehículo a mano.'],
      ['Se cerró la app en el medio de la guardia', 'No se pierde nada: al volver a abrirla seguís con la minuta donde la dejaste.'],
      ['Me equivoqué en una minuta ya enviada', 'Las minutas enviadas no se modifican. Avisale al supervisor y, si hace falta, cargá la corrección en la minuta siguiente.']
    ]
  }, {
    id: 'supervisor', nombre: 'Supervisores y administración',
    pasos: [
      { t: 'Entrar',
        html: '<p>Entrá con tu <b>usuario y clave de SGI</b>. Ves dos pestañas: <b>📂 Informes</b> y <b>👥 Presentes</b> de tus servicios (administración ve todos).</p><p>También se abre desde <b>Novedades del Personal</b> con el botón <b>Presentes de los servicios</b>.</p>',
        tel: { quien: 'Supervisor', cont: '<div class="cd"><span class="b g">📂 Informes</span><span class="b foco">👥 Presentes</span></div>' } },
      { t: 'Presentes de los servicios',
        html: '<p>Es el personal que informan los servicios en sus minutas.</p><ul><li>Filtrá por <b>fecha</b>, <b>servicio</b>, <b>empresa</b> y <b>turno</b>.</li><li>En <b>Buscar</b> escribí cualquier dato: nombre, legajo, puesto, hora de ingreso o código.</li><li>Arriba ves el total de registros, personas y horas (diurnas y nocturnas).</li><li><b>⬇ Descargar Excel</b> baja lo que estás viendo.</li></ul>',
        tel: { quien: 'Presentes', cont: '<div class="cd"><div class="in foco">2233</div><div class="row"><span>19/10 · San Francisco<br><b>GIMENEZ MARTIN</b> · KDE</span><span>12 h</span></div><span class="b g">⬇ Descargar Excel</span></div>' } },
      { t: 'Informes',
        html: '<p>En <b>📂 Informes</b> buscás las minutas de tus servicios por cualquier dato y las ves en PDF, las descargás o las reenviás.</p>',
        tel: { quien: 'Informes', cont: '<div class="cd"><div class="lb">Servicio</div><div class="in">Todos mis servicios</div><div class="row"><span>BARRIO SAN FRANCISCO · 19/10</span><span class="b" style="font-size:9px">PDF</span></div></div>' } }
    ],
    faq: [
      ['No veo un servicio', 'Cada supervisor ve los servicios donde figura como supervisor en Config_Servicios de la planilla Minuta Operativa.']
    ]
  }]
};
