window.GUIA = {
  app: 'Documentación', sub: 'Documentación de vehículos, ART y seguro de vida para supervisores',
  icono: 'fa-solid fa-folder-open', c1: '#6b4a1a', c2: '#a07030', abrir: '../documentacion/', apk: '../portal/apk/Documentacion.apk',
  roles: [{
    id: 'supervisor', nombre: 'Supervisor',
    pasos: [
      { t: 'Entrar con el PIN',
        html: '<p>Al abrir la app ingresá el <b>PIN de supervisor</b> y tocá <b>Entrar</b>. El celular lo recuerda para la próxima vez.</p>',
        tel: { quien: 'Acceso', salir: false, cont: '<div class="cd" style="text-align:center;margin-top:40px"><div class="h">Ingresá el PIN de supervisor</div><div class="in foco" style="font-size:18px;letter-spacing:6px">••••</div><span class="b">Entrar</span></div>' } },
      { t: 'Elegir la sección',
        html: '<p>Tenés tres secciones:</p><ul><li><b>Automotriz</b>: cédula verde, VTV, tarjeta de circulación y pólizas de cada vehículo.</li><li><b>ART</b>: documentación de ART por empresa.</li><li><b>Seguro de vida</b>: documentación por empresa.</li></ul><p>Con <b>Menú</b> (o la tecla Esc) volvés a la pantalla principal.</p>',
        tel: { quien: 'Menú', salir: 'Menú', cont: '<div class="cd"><span class="b foco" style="display:block;padding:14px">Automotriz</span><span class="b" style="display:block;padding:14px">ART</span><span class="b" style="display:block;padding:14px">Seguro de vida</span></div>' } },
      { t: 'Automotriz',
        html: '<p>Ves el listado de vehículos con dominio, marca, modelo, empresa, vencimientos de VTV y póliza. Tocá un documento para verlo en una ventana.</p><div class="tip">No se muestran los vehículos marcados como "No Ver" o dados de baja.</div>',
        tel: { quien: 'Automotriz', salir: 'Menú', cont: '<div class="cd"><div class="row"><span><b>AB123CD</b><br>Toyota Hilux</span><span class="b foco" style="font-size:9px">Cédula verde</span></div><div class="row"><span><b>AC456EF</b><br>Fiat Strada</span><span class="b" style="font-size:9px">VTV</span></div></div>' } },
      { t: 'ART y Seguro de vida',
        html: '<ol><li>Buscá a la persona en el listado de personal.</li><li>Tocá <b>Ver documentación</b>: se abre la documentación de la empresa donde figura.</li></ol>',
        tel: { quien: 'ART', salir: 'Menú', cont: '<div class="cd"><div class="in">pérez</div><div class="row"><span>Pérez Juan<br>LP 1234 · PPQ</span><span class="b foco" style="font-size:9px">Ver documentación</span></div></div>' } },
      { t: 'Descargar o enviar por mail',
        html: '<ol><li>Marcá los documentos con <b>Seleccionar</b>.</li><li>Tocá <b>Descargar</b>, o <b>Enviar por mail</b>: ponés tu nombre, el correo de destino y un mensaje opcional, y tocás <b>Enviar</b>.</li></ol><p>Con <b>Quitar selección</b> desmarcás todo.</p>',
        tel: { quien: 'Enviar', salir: 'Menú', cont: '<div class="cd"><div class="h">Enviar por mail</div><div class="lb">Tu nombre</div><div class="in">Carlos Sandoval</div><div class="lb">Correo de destino</div><div class="in foco">cliente@empresa.com</div><span class="b v">Enviar</span><span class="b g">Cancelar</span></div>' } }
    ],
    faq: [
      ['Dice "PIN incorrecto"', 'Pedile el PIN a administración.'],
      ['Falta un documento', 'Avisá a administración para que lo suba a la carpeta correspondiente.']
    ]
  }]
};
