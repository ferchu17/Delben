window.GUIA = {
  app: 'Control de Móviles', sub: 'Control diario de vehículos con fotos e informe en PDF',
  icono: 'fa-solid fa-car-side', c1: '#1a4a7a', c2: '#2060b0', abrir: '../', apk: '../portal/apk/Moviles.apk',
  roles: [{
    id: 'personal', nombre: 'Personal / Supervisor',
    pasos: [
      { t: 'Elegir el tipo de móvil',
        html: '<p>Al abrir la app elegís qué vas a controlar:</p><ul><li><b>Combustible</b>: camioneta o auto.</li><li><b>Eléctrico</b>: carro eléctrico.</li><li><b>Bicicleta</b>.</li></ul><p>Después tocás <b>INGRESAR AL CONTROL →</b>.</p><div class="tip">La primera vez la app carga el personal, la flota y los objetivos. Si no hay señal, usa la última lista guardada.</div>',
        tel: { quien: 'Control diario', cont: '<div class="cd" style="text-align:center"><div class="h">Seleccione un tipo de móvil</div><span class="b g">Bicicleta</span><span class="b foco">Combustible</span><span class="b g">Eléctrico</span><div style="margin-top:10px"><span class="b v">INGRESAR AL CONTROL →</span></div></div>' } },
      { t: 'Datos del control',
        html: '<ol><li><b>Fecha y hora</b> se completan solas (se pueden cambiar).</li><li>Elegí la <b>patente</b>: el número de móvil se completa solo.</li><li>Cargá el <b>kilometraje</b>.</li><li>Elegí el <b>objetivo / cliente</b> y el <b>turno</b> (guardia entrante o saliente).</li><li>Elegí tu nombre en <b>Apellido y Nombre</b>: DNI, legajo y empresa se completan solos.</li><li>Si hay algo para avisar, escribilo en <b>Novedad / Observación General</b>.</li></ol>',
        tel: { quien: 'Combustible', cont: '<div class="cd"><div class="lb">Patente</div><div class="in foco">AB 123 CD</div><div class="lb">Kilometraje</div><div class="in">84.520</div><div class="lb">Objetivo / Cliente</div><div class="in">Barrio San Francisco</div><div class="lb">Turno / Guardia</div><div class="in">Guardia Entrante</div><div class="lb">Apellido y Nombre</div><div class="in">Pérez Juan</div></div>' } },
      { t: 'Inspección del vehículo',
        html: '<p>Tocá <b>CONTINUAR A INSPECCIÓN / GUARDAR →</b>. Aparece la lista de controles del vehículo (neumáticos, luces, escobillas, baliza, limpieza, etc.).</p><ul><li>Marcá cada ítem como <b>Sin Novedad</b> o <b>Con Novedad</b>.</li><li>Si un ítem tiene novedad, explicalo en la observación.</li></ul>',
        tel: { quien: 'Inspección', cont: '<div class="cd"><div class="row"><span>1. Estado Externo General</span><span class="bd a">Sin Novedad</span></div><div class="row"><span>2. Luces</span><span class="bd a">Sin Novedad</span></div><div class="row foco"><span>3. Neumático Delantero Der.</span><span class="bd x">Con Novedad</span></div><div class="row"><span>4. Rueda de Auxilio</span><span class="bd a">Sin Novedad</span></div></div>' } },
      { t: 'Fotos y envío',
        html: '<ol><li>Sacá las <b>vistas fotográficas</b> del vehículo con <b>Tomar foto con la cámara</b>, o elegilas con <b>Elegir de la galería</b>.</li><li>Elegí el supervisor que recibe el informe.</li><li>Tocá guardar: el control queda registrado y se arma el <b>informe en PDF</b> con las 4 fotos, que le llega por mail al supervisor.</li></ol><div class="ojo">Si aparece un error de conexión, revisá la señal y tocá <b>Reintentar</b>. No cierres la app hasta ver que se guardó.</div>',
        tel: { quien: 'Fotos', cont: '<div class="cd"><div class="h">Vistas fotográficas</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><div class="foto">Frente</div><div class="foto">Atrás</div><div class="foto">Lateral</div><div class="foto">Lateral</div></div><span class="b foco">Tomar foto con la cámara</span><span class="b g">Elegir de la galería</span></div>' } }
    ],
    faq: [
      ['No aparece la patente o mi nombre', 'Las listas salen de SGI (Flota y Movileros). Pedile a administración que lo agregue.'],
      ['Dice "Tiempo de espera agotado"', 'Hay poca señal. Esperá a tener conexión y tocá Reintentar.'],
      ['Me equivoqué en un dato', 'Antes de guardar podés corregirlo. Si ya lo guardaste, avisá al supervisor.']
    ],
    quiz: [
      { p: 'Un neumático está pinchado. ¿Cómo lo marcás?', o: ['Sin Novedad', 'Con Novedad y lo explico', 'No lo marco'], c: 1 },
      { p: '¿Quién recibe el informe en PDF?', o: ['Nadie', 'El supervisor elegido', 'El cliente'], c: 1 }
    ]
  }]
};
