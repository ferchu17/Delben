const TAB_N = ['Menú', 'Proyección', 'Semanas', 'Informes'];
window.GUIA = {
  app: 'Novedades del Personal', sub: 'Planillas de cobertura y novedades semanales',
  icono: 'fa-solid fa-calendar-check', c1: '#5a1a7a', c2: '#8a30b0', abrir: '../novedades/',
  roles: [{
    id: 'supervisor', nombre: 'Supervisor',
    pasos: [
      { t: 'Entrar y Mis servicios',
        html: '<p>Entrá con tu <b>usuario y clave de SGI</b>. Vas a ver <b>Mis servicios</b>, con las opciones del supervisor: Proyección, Novedades semanales, Semanas informadas, Informes, Resumen, Ausencias, Consultas, Personal, SGI e Instructivo.</p><div class="tip">El botón <b>SGI</b> abre el SGI sin volver a poner usuario y clave.</div>',
        tel: { quien: 'Supervisor', cont: '<div class="tile foco" style="background:#5a1a7a">Proyección</div> <div class="tile" style="background:#7a2a9a">Novedades semanales</div> <div class="tile" style="background:#1a6fc8">Semanas informadas</div> <div class="tile" style="background:#2e9b3a">Informes</div> <div class="tile" style="background:#e08a00">Consultas</div> <div class="tile" style="background:#1040a0">SGI</div>' } },
      { t: 'La planilla del servicio',
        html: '<p>Cada servicio tiene su planilla del período (del 26 al 25), igual a los Excel de siempre.</p><ol><li>Elegí al vigilador de la lista (escribí parte del nombre).</li><li>Cargá los días con el color del turno: <b>Blanco</b>, <b>Celeste</b> o <b>Gris</b>.</li><li>Para un horario especial agregá un <b>Comentario</b> en la celda (por ejemplo "refuerzo de 18 a 03").</li><li>Las novedades van con su código: F, VAC, ENF, ART, LSG, etc.</li></ol>',
        tel: { quien: 'Fincas de Iraola 2', tabs: TAB_N, on: 'Proyección', cont: '<div class="cd"><div class="row"><span>Pérez Juan</span><span><span class="bd" style="background:#fff;border:1px solid #ccc">B</span> <span class="bd" style="background:#cfe8ff">C</span> <span class="bd" style="background:#ddd">G</span></span></div><div class="row foco"><span>Gómez Ana</span><span><span class="bd x">F</span> <span class="bd z">VAC</span></span></div><span class="b g">Blanco</span><span class="b" style="background:#7fb8e6">Celeste</span><span class="b" style="background:#999">Gris</span><span class="b g">Comentario</span></div>' } },
      { t: 'Retén e Instrucción',
        html: '<p>El personal de práctica va en las filas de abajo como <b>Retén</b> o <b>Instrucción</b> (se elige en Puesto). Esos puestos no suman horas al servicio.</p><div class="ojo">Si falta el puesto en Instrucción o Retén, la app no deja guardar hasta completarlo.</div>',
        tel: { quien: 'Fincas de Iraola 2', tabs: TAB_N, on: 'Proyección', cont: '<div class="cd"><div class="h">Instrucción o Retén</div><div class="row foco"><span>López Martín</span><span class="bd p">Retén</span></div></div>' } },
      { t: 'Enviar la semana',
        html: '<p>Las novedades se envían <b>a semana vencida</b>: el lunes informás de lunes a domingo anterior.</p><ol><li>Tocá <b>Enviar semana</b>.</li><li>Si a un vigilador de tu zona le falta algún día, la app avisa y no envía hasta completarlo.</li><li>Si una persona ya está cargada el mismo día y horario en otro servicio, aparece un aviso.</li></ol><p>El día 26 informás los datos del 25 (cierre del período).</p>',
        tel: { quien: 'Fincas de Iraola 2', tabs: TAB_N, on: 'Semanas', cont: '<div class="cd"><span class="b v foco">Enviar semana 3 · 13/10 al 19/10</span><div class="row"><span>Semana 2</span><span class="bd a">Informada</span></div><div class="row"><span>Semana 1</span><span class="bd a">Informada</span></div></div>' } },
      { t: 'Plus por función y Excel',
        html: '<ul><li><b>Plus por función</b>: cargás los días de encargado por persona (+1 día, Agregar plus).</li><li><b>Excel</b>: descargás la planilla o la enviás al servicio o a tu correo.</li><li><b>Semanas informadas</b>: ves lo que ya enviaste y lo podés mandar por correo.</li></ul>',
        tel: { quien: 'Plus por función', tabs: TAB_N, on: 'Proyección', cont: '<div class="cd"><div class="h">Plus por función</div><div class="row"><span>Pérez Juan<br>Encargado</span><span>3 días</span></div><span class="b g">+1 día</span><span class="b foco">Agregar plus</span><span class="b">✉ Enviar</span></div>' } }
    ],
    faq: [
      ['No encuentro a una persona en la lista', 'La lista sale del personal de SGI. Si no está o está dado de baja, pedile a administración que lo revise.'],
      ['Hay dos personas con el mismo nombre', 'Fijate la empresa y el legajo: la que tiene la inicial del segundo nombre es otra persona.'],
      ['Necesito más ayuda', 'En Mis servicios tocá Instructivo: tiene cada pantalla con imágenes y se baja en PDF.']
    ],
    quiz: [
      { p: '¿Cuándo se envían las novedades de la semana?', o: ['El viernes', 'El lunes, de la semana anterior', 'A fin de mes'], c: 1 },
      { p: 'Un vigilador hace refuerzo de 18 a 03. ¿Cómo lo cargo?', o: ['Con un comentario en la celda', 'No se carga', 'En otra planilla'], c: 0 }
    ]
  }, {
    id: 'admin', nombre: 'Administración',
    pasos: [
      { t: 'El menú de administración',
        html: '<p>Con el perfil de administración ves el <b>Menú</b> completo: Proyección, Novedades semanales, Semanas informadas, Conformación horaria, Plus por función, Informes, Resumen, Ausencias, Consultas, Presentismo General, Servicios, Personal, Códigos, Usuarios y perfiles, Ficha por período, Control de cierre, Datos y SGI.</p>',
        tel: { quien: 'Administración', cont: '<div class="tile" style="background:#5a1a7a">Proyección</div> <div class="tile" style="background:#1a6fc8">Semanas informadas</div> <div class="tile foco" style="background:#2e9b3a">Informes</div> <div class="tile" style="background:#e08a00">Control de cierre</div> <div class="tile" style="background:#7a2a9a">Presentismo General</div> <div class="tile" style="background:#1040a0">Datos</div>' } },
      { t: 'Revisar las semanas',
        html: '<p>En <b>Semanas informadas</b> ves lo que envió cada supervisor, servicio por servicio, con la fecha de envío. Cuando un supervisor envía, te llega un aviso por mail.</p>',
        tel: { quien: 'Semanas informadas', cont: '<div class="cd"><div class="row"><span>Fincas de Iraola 2<br>Sandoval</span><span class="bd a">Sem. 3</span></div><div class="row foco"><span>Barrio San Francisco<br>Vica</span><span class="bd p">Falta sem. 3</span></div></div>' } },
      { t: 'Informes y cierre',
        html: '<ul><li><b>Informes</b>: STD, Consolidado, 30/31 días, Facturación, Contratadas vs. Realizadas, Plus y RRHH, con el formato de las planillas de la empresa.</li><li><b>Conformación horaria</b>: contratado contra realizado, por servicio y ciclo.</li><li><b>Control de cierre</b>: antes de pasar a RRHH, compara el personal informado contra el listado.</li></ul>',
        tel: { quien: 'Informes', cont: '<div class="cd"><span class="b">STD</span><span class="b">Consolidado</span><span class="b">30/31 días</span><span class="b">Facturación</span><span class="b foco">RRHH</span><span class="b">Plus</span></div>' } },
      { t: 'Servicios, personal y datos',
        html: '<ul><li><b>Servicios</b>: cliente, supervisor, ciclo de facturación y horas contratadas.</li><li><b>Personal</b> y <b>Códigos</b>: el listado de SGI y los códigos de novedades.</li><li><b>Usuarios y perfiles</b>: qué ve cada perfil.</li><li><b>Datos</b>: feriados, períodos y a quién le llegan los avisos.</li></ul>',
        tel: { quien: 'Datos', cont: '<div class="cd"><div class="h">Feriados</div><div class="row"><span>12/10/2026</span><span>Diversidad cultural</span></div><div class="h">Avisos</div><div class="row foco"><span>fjacyno@ktl-seguridad.com</span></div></div>' } }
    ]
  }]
};
