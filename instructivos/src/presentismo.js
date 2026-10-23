window.GUIA = {
  app: 'Presentismo de Servicios', sub: 'Presentes con DNI, horas diurnas y nocturnas, traslados y correo al servicio',
  icono: 'fa-solid fa-user-check', c1: '#2e9d3a', c2: '#1565c0', abrir: '../presentismo/',
  apk: 'https://github.com/ferchu17/Delben/releases/download/presentismo-apk/Presentismo.apk',
  roles: [{
    id: 'vigilador', nombre: 'Vigilador',
    pasos: [
      { t: 'Entrar',
        html: '<p>Abrí la app o escaneá el <b>QR del puesto</b>. En la pantalla de inicio tocá <b>Ingresar como vigilador</b>.</p><div class="tip">Si entraste por el QR, el servicio ya aparece elegido y no se puede cambiar.</div>',
        tel: { quien: 'Presentismo', cont: '<div class="cd"><div class="h" style="text-align:center">¿Cómo querés ingresar?</div><span class="b foco" style="display:block;padding:12px;background:#2e9d3a">✓ Ingresar como vigilador<br><small>Dar presente con tu DNI</small></span><span class="b g" style="display:block;padding:12px">Ingresar como encargado</span><span class="b g" style="display:block;padding:12px">Ingresar como supervisor</span></div>' } },
      { t: 'Servicio y horario',
        html: '<ol><li>Elegí el <b>servicio</b> donde estás (si no entraste por el QR).</li><li>Tocá <b>06 a 18</b> o <b>18 a 06</b>, o poné la hora de <b>entrada</b> y de <b>salida</b> a mano si tu horario es otro.</li><li>Debajo ves cuántas horas son <b>diurnas</b> (de 06 a 21) y cuántas <b>nocturnas</b> (de 21 a 06).</li></ol><div class="tip">La fecha no se elige: el presente siempre queda con el día de hoy. Si das el presente de un turno de noche después de las 00, queda con el día en que empezó el turno.</div>',
        tel: { quien: 'Dar presente', cont: '<div class="cd"><div class="lb">Servicio</div><div class="in">BARRIO SAN FRANCISCO</div><div class="lb">Tu horario</div><div class="row"><span class="b foco" style="background:#1565c0">06 a 18</span><span class="b g">18 a 06</span></div><div class="row"><span>Entrada 06:00</span><span>Salida 18:00</span></div><div class="h" style="background:#fff6d6;padding:6px;border-radius:10px">12 h diurnas · 0 h nocturnas</div></div>' } },
      { t: 'DNI y presente',
        html: '<ol><li>Escribí tu <b>DNI sin puntos</b>.</li><li>Tocá <b>DAR PRESENTE</b>.</li><li>Aparece tu nombre: si sos vos tocá <b>Sí, soy yo</b>. Si figurás en dos empresas, tocá la empresa con la que trabajás hoy.</li><li>Sale la pantalla verde <b>PRESENTE REGISTRADO</b>.</li></ol>',
        tel: { quien: 'Dar presente', cont: '<div class="cd"><div class="lb">Tu DNI</div><div class="in" style="text-align:center;font-size:18px;letter-spacing:3px">30111222</div><span class="b foco" style="display:block;padding:12px;background:#2e9d3a;text-align:center">DAR PRESENTE</span><div class="h" style="text-align:center;background:#2e9d3a;color:#fff;padding:10px;border-radius:10px">✓ PRESENTE REGISTRADO<br><small>PEREZ JUAN · 06:00 a 18:00</small></div></div>' } },
      { t: 'Si te trasladan a otro servicio',
        html: '<p>Si estabas en un servicio y te mandan a otro, das el presente en el servicio nuevo con el <b>horario nuevo</b>.</p><ol><li>La app te avisa que figurás en el otro servicio.</li><li>Te pregunta <b>a qué hora te retiraste</b> de ahí: ponela y tocá <b>Confirmar</b>.</li><li>El servicio anterior queda cerrado a esa hora (con sus horas recalculadas) y el nuevo queda registrado.</li></ol><div class="tip">Si seguís hasta el otro día sin que se pisen los horarios, no pregunta nada: simplemente das el presente del turno nuevo.</div>',
        tel: { quien: 'Venís de otro servicio', cont: '<div class="cd"><div class="h">Figurás en BARRIO SAN FRANCISCO de 06:00 a 18:00 hs.</div><div class="lb">¿A qué hora te retiraste?</div><div class="in foco">14:00</div><span class="b" style="display:block;padding:10px;background:#2e9d3a;text-align:center">Confirmar</span></div>' } },
      { t: 'Ver mis presentes',
        html: '<ol><li>Escribí tu DNI.</li><li>Tocá <b>Ver mis presentes</b>.</li></ol><p>Ves <b>solo tus presentes</b> del período actual (del 26 al 25): fecha, servicio, entrada, salida, horas diurnas, horas nocturnas y el total.</p><div class="tip">No se pueden ver otros períodos ni los datos de otra persona.</div>',
        tel: { quien: 'Mis presentes', cont: '<div class="cd"><div class="h">PEREZ JUAN</div><div class="row"><span>22/10 · 06:00 a 18:00</span><b>12 / 0</b></div><div class="row"><span>23/10 · 18:00 a 06:00</span><b>3 / 9</b></div><div class="row foco"><b>Total</b><b>15 h diurnas · 9 h noct.</b></div></div>' } }
    ],
    faq: [
      ['Dice que mi DNI no figura', 'Avisale a tu supervisor: tenés que estar activo en el listado de personal.'],
      ['Me equivoqué de horario', 'Pedile al encargado o al supervisor que anule el presente y lo cargue bien.'],
      ['¿Puedo dar el presente de otro día?', 'No. El vigilador solo da el presente del día. Las otras fechas las informa el encargado o el supervisor.']
    ],
    quiz: [
      { p: '¿Qué horas son diurnas?', o: ['De 06 a 21', 'De 08 a 20', 'De 06 a 18'], c: 0 },
      { p: 'Te trasladan a otro servicio: ¿qué te pregunta la app?', o: ['Tu legajo', 'A qué hora te retiraste del anterior', 'Nada'], c: 1 }
    ]
  }, {
    id: 'encargado', nombre: 'Encargado',
    pasos: [
      { t: 'Entrar',
        html: '<p>En el inicio tocá <b>Ingresar como encargado</b> y entrá con el <b>usuario y contraseña de SGI</b> de tu servicio.</p><p>Se abre <b>Informar presentes</b> con tu servicio y la fecha de <b>ayer</b>: los presentes se informan a <b>día vencido</b> (hoy se informa lo de ayer).</p><div class="tip">Podés cambiar la fecha hasta 3 días atrás. Para fechas anteriores, pedíselo al supervisor.</div>',
        tel: { quien: 'Informar presentes', cont: '<div class="cd"><div class="lb">Servicio</div><div class="in">FINCAS DE IRAOLA 2</div><div class="lb">Fecha que se informa</div><div class="in foco">22/10/2026</div></div>' } },
      { t: 'Horario por defecto',
        html: '<p>Elegí el horario que se pone al agregar a cada persona: <b>06 a 18</b>, <b>18 a 06</b> o cualquier otro a mano.</p><p>Después, a cada persona le podés cambiar el horario en la lista.</p>',
        tel: { quien: 'Informar presentes', cont: '<div class="cd"><div class="lb">Horario que se pone al agregar a alguien</div><div class="row"><span class="b foco" style="background:#1565c0">06 a 18</span><span class="b g">18 a 06</span></div><div class="row"><span>Entrada 06:00</span><span>Salida 18:00</span></div></div>' } },
      { t: 'Elegir al personal',
        html: '<ol><li>Tocá el buscador <b>Agregar personal</b>: se despliega el <b>personal de tu servicio</b>.</li><li>Tocá a la persona: pasa a la lista <b>Para informar</b> con el horario de arriba.</li><li>Escribile la <b>observación</b> al lado (ej.: llegó tarde, reemplazo de franco).</li><li>Volvé al buscador y elegí a la siguiente.</li></ol><div class="tip">Si la persona no está en la lista del servicio (por ejemplo alguien nuevo), escribí su apellido o DNI y aparece del listado general.</div>',
        tel: { quien: 'Agregar personal', cont: '<div class="cd"><div class="in foco">Tocá acá o escribí apellido o DNI</div><div class="lb" style="color:#1565c0">PERSONAL DEL SERVICIO</div><div class="row"><b>ACOSTA MARIO VICTOR</b><span>LEG</span></div><div class="row"><b>AGUIRRE RICARDO</b><span>LEG</span></div></div>' } },
      { t: 'Horario, licencia y observación',
        html: '<p>En cada persona de la lista podés:</p><ul><li>Cambiar la <b>entrada</b> y la <b>salida</b>.</li><li>Cambiar <b>Presente</b> por un tipo de <b>licencia</b> (vacaciones, enfermedad, etc.) y poner hasta qué día.</li><li>Escribir la <b>observación</b>.</li><li>Quitarla con la <b>✕</b>.</li></ul>',
        tel: { quien: 'Para informar', cont: '<div class="cd"><div class="row"><b>ACOSTA MARIO VICTOR</b><b>✕</b></div><div class="row"><span class="in">Presente</span><span class="in">06:00</span><span class="in">18:00</span></div><div class="in foco" style="background:#fffbea">Reemplazo de franco</div></div>' } },
      { t: 'Guardar y enviar el correo',
        html: '<ol><li>Tocá <b>Guardar</b> para registrar a todos juntos.</li><li>O tocá <b>Guardar y enviar correo</b>: además le llega al servicio el listado con entrada, salida, horas diurnas, horas nocturnas y observaciones.</li><li>Si alguien queda <b>en rojo</b>, leé el aviso: por ejemplo, si figura en otro servicio, poné a qué hora se retiró de ahí y volvé a guardar.</li></ol><div class="tip">Abajo, en <b>Ya informados</b>, ves lo cargado en el día y el botón <b>Enviar correo al servicio</b> para mandarlo cuando quieras (a la mañana o durante el día).</div>',
        tel: { quien: 'Informar presentes', cont: '<div class="cd"><div class="row"><span class="b" style="background:#1565c0">Guardar</span><span class="b foco" style="background:#2e9d3a">Guardar y enviar correo</span></div><div class="h">Ya informados el 22/10/2026</div><div class="row"><span>2 presentes</span><span>☀ 15 h</span><span>☾ 9 h</span></div></div>' } },
      { t: 'Anular',
        html: '<p>Si algo quedó mal, en <b>Ya informados</b> tocá <b>Anular</b>, escribí el motivo y volvé a cargarlo bien.</p><div class="tip">El encargado puede anular hasta 3 días atrás. Nada se borra: queda anulado con quién y por qué.</div>',
        tel: { quien: 'Anular registro', cont: '<div class="cd"><div class="lb">Motivo</div><div class="in foco">Cargado por error</div><span class="b r" style="display:block;padding:10px;text-align:center">Anular</span></div>' } },
      { t: 'Buscador de presentes',
        html: '<p>En la pestaña <b>Buscador de presentes</b> ves los presentes de tu servicio de <b>cualquier período</b> (o entre dos fechas), con entrada, salida, horas diurnas y nocturnas por fila y el total.</p><div class="tip">El encargado no puede descargar: eso lo hacen el supervisor y el administrador.</div>',
        tel: { quien: 'Buscador', cont: '<div class="cd"><div class="lb">Período</div><div class="in">26/09/2026 al 25/10/2026</div><div class="row foco"><b>Total</b><span>☀ 312 h</span><span>☾ 198 h</span></div></div>' } }
    ],
    faq: [
      ['Dice que la persona ya tiene presente', 'Ya está cargada ese día (en tu servicio o en otro). Revisá en Ya informados o pedile al supervisor que lo vea en el buscador.'],
      ['No aparece una persona en el desplegable', 'Escribí su apellido o DNI: busca en todo el listado de personal activo.'],
      ['Sale "La aplicación publicada está desactualizada"', 'Avisale al administrador: tiene que publicar una Nueva versión.']
    ],
    quiz: [
      { p: '¿Qué fecha viene por defecto?', o: ['Hoy', 'Ayer (día vencido)', 'El 26'], c: 1 },
      { p: '¿Cómo se manda el correo al servicio?', o: ['Guardar y enviar correo', 'Se manda solo cada hora', 'Desde Gmail'], c: 0 }
    ]
  }, {
    id: 'supervisor', nombre: 'Supervisor',
    pasos: [
      { t: 'Entrar',
        html: '<p>En el inicio tocá <b>Ingresar como supervisor</b> y entrá con tu usuario y contraseña de SGI. Se abre directo el <b>Buscador de presentes</b> con el período actual.</p>',
        tel: { quien: 'Presentismo', cont: '<div class="cd"><span class="b g" style="display:block;padding:12px">Ingresar como vigilador</span><span class="b g" style="display:block;padding:12px">Ingresar como encargado</span><span class="b foco" style="display:block;padding:12px;background:#7c3aed">🔍 Ingresar como supervisor<br><small>Buscador de presentes</small></span></div>' } },
      { t: 'Buscar',
        html: '<ol><li>Elegí el <b>período</b> (del 26 al 25) o <b>Elegir fechas…</b> para un rango.</li><li>Elegí un <b>servicio</b> o <b>Todos</b>.</li><li>Si querés, escribí nombre, DNI o empresa.</li><li>Tocá <b>Buscar</b>.</li></ol><p>Cada fila tiene entrada, salida, <b>horas diurnas</b> (06 a 21) y <b>nocturnas</b> (21 a 06). Arriba y al pie ves el <b>total de lo seleccionado</b>.</p>',
        tel: { quien: 'Buscador de presentes', cont: '<div class="cd"><div class="lb">Período</div><div class="in">26/09/2026 al 25/10/2026</div><div class="lb">Servicio</div><div class="in">Todos</div><div class="row foco"><span>☀ 1.240 h</span><span>☾ 860 h</span><b>2.100 h</b></div></div>' } },
      { t: 'Descargar',
        html: '<p>Tocá <b>Descargar Excel (CSV)</b>: baja lo que ves en la búsqueda, con el total al final.</p><div class="tip">Solo el supervisor y el administrador pueden descargar.</div>',
        tel: { quien: 'Buscador de presentes', cont: '<div class="cd"><div class="row"><span class="b" style="background:#1565c0">Buscar</span><span class="b foco g">Descargar Excel (CSV)</span></div></div>' } },
      { t: 'Informar y corregir',
        html: '<p>En <b>Informar presentes</b> cargás igual que el encargado, pero en <b>cualquier servicio y cualquier fecha</b>. También podés <b>anular</b> registros de cualquier fecha (con motivo).</p>',
        tel: { quien: 'Informar presentes', cont: '<div class="cd"><div class="lb">Servicio</div><div class="in foco">BARRIO LAGUNA GRANDE</div><div class="lb">Fecha</div><div class="in">15/10/2026</div></div>' } },
      { t: 'QR de los servicios',
        html: '<p>En <b>QR de servicios</b> está el QR de cada servicio. Tocá <b>Imprimir todos los QR</b> para sacar las hojas con el logo y el nombre de cada uno, y pegalas en los puestos.</p><div class="tip">Con el QR el vigilador entra con el servicio ya elegido, aunque no conozca bien el nombre.</div>',
        tel: { quien: 'QR de servicios', cont: '<div class="cd"><span class="b foco" style="display:block;padding:10px;background:#7c3aed;text-align:center">Imprimir todos los QR</span><div class="foto" style="height:80px">ARAUCO ZARATE · QR</div></div>' } }
    ],
    faq: [
      ['Un vigilador se equivocó de horario', 'Anulá el registro con el motivo y cargalo bien en Informar presentes.'],
      ['Las horas del vigilador anterior cambiaron solas', 'Fue un traslado: al dar presente en otro servicio dijo a qué hora se retiró. En la fila queda anotado el cambio.']
    ],
    quiz: [
      { p: '¿Quién puede descargar el Excel?', o: ['Todos', 'Supervisor y administrador', 'Solo el encargado'], c: 1 }
    ]
  }, {
    id: 'admin', nombre: 'Administrador',
    pasos: [
      { t: 'Dónde está cada cosa',
        html: '<ul><li><b>Código</b>: proyecto de Apps Script de la planilla <b>Presentismo de Servicios</b> (cuenta delbensgii@gmail.com), archivos Code.gs, Index y appsscript.json. Copia en GitHub: carpeta <b>presentismo/apps-script</b>.</li><li><b>Servicios</b>: pestaña <b>objetivos</b> de Stock Manager (menos los que terminan en "baja").</li><li><b>Usuarios</b>: pestaña <b>Usuarios y contraseñas</b>. Rol <b>Servicios</b> = encargado de su servicio (el nombre tiene que ser igual al objetivo); <b>Supervisor</b> y <b>Administrador</b> ven todo.</li><li><b>Correo del servicio</b>: columna correo del usuario de servicio.</li><li><b>Personal</b>: pestaña personal de Stock Manager (sin los de baja).</li></ul>',
        tel: { quien: 'Stock Manager', cont: '<div class="cd"><div class="row"><b>fincas</b><span>FINCAS DE IRAOLA 2</span><span>Servicios</span></div><div class="row"><b>gsanmartin</b><span>Supervisor</span></div><div class="row foco"><b>fjacyno</b><span>Administrador</span></div></div>' } },
      { t: 'Pestañas de la planilla',
        html: '<ul><li><b>Presentes</b>: un registro por persona y día (entrada, salida, horas diurnas y nocturnas, observaciones, quién cargó, anulaciones y correcciones por traslado).</li><li><b>Codigos</b>: tipos de licencia (se agregan filas sin tocar el código).</li><li><b>Encargados</b>: para dar servicios a usuarios que no son de rol Servicios (usuario y servicios separados por coma).</li><li><b>Envios</b>: registro de cada correo enviado.</li></ul>',
        tel: { quien: 'Presentismo de Servicios', cont: '<div class="cd"><div class="tabs"><span>Presentes</span><span>Codigos</span><span>Encargados</span><span>Envios</span></div></div>' } },
      { t: 'Ajustes en Code.gs',
        html: '<ul><li><b>NOVEDADES_BASE_ID</b>: ID de "Novedades del Personal - Base" (compartida con delbensgii como Lector) para que cada servicio muestre su personal actual de las novedades semanales.</li><li><b>DIAS_ATRAS_ENCARGADO</b>: hasta cuántos días atrás informa el encargado (3).</li><li><b>MAIL_PRUEBA</b>: si tiene un correo, todos los mails van solo ahí. Vacío = van a los servicios.</li></ul><div class="tip">Después de cambiar el código: Implementar → Gestionar implementaciones → editar → Nueva versión.</div>',
        tel: { quien: 'Code.gs', cont: '<div class="cd"><div class="row"><b>NOVEDADES_BASE_ID</b><span>1AbC…</span></div><div class="row"><b>DIAS_ATRAS_ENCARGADO</b><span>3</span></div><div class="row foco"><b>MAIL_PRUEBA</b><span>\'\'</span></div></div>' } }
    ],
    faq: [
      ['Sale "La aplicación publicada está desactualizada"', 'Code.gs e Index no son de la misma versión, o falta publicar. Dejá un solo archivo de código y publicá Nueva versión.'],
      ['Un usuario de servicio no puede entrar', 'Su nombre en Usuarios y contraseñas tiene que ser igual al del objetivo. Ejecutá configurarPlanilla(): en el registro dice con qué objetivo coincide cada uno.'],
      ['Las horas salen en 0', 'Ejecutá configurarPlanilla(): si la pestaña Presentes es de una versión anterior, la renombra y crea la nueva.']
    ],
    quiz: [
      { p: '¿Dónde se cargan los servicios?', o: ['En la pestaña objetivos de Stock Manager', 'En el código', 'En la app'], c: 0 }
    ]
  }]
};
