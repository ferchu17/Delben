window.GUIA = {
  app: 'Licencias del Personal', sub: 'Vacaciones, enfermedad y demás licencias con firma, PDF y mail',
  icono: 'fa-solid fa-file-signature', c1: '#6B2D5C', c2: '#8E3B7A', abrir: '../licencias/',
  apk: 'https://github.com/ferchu17/Delben/releases/download/licencias-apk/Licencias.apk',
  roles: [{
    id: 'supervisor', nombre: 'Supervisor',
    pasos: [
      { t: 'Entrar',
        html: '<p>Entrá con tu <b>usuario y contraseña de SGI</b> y tocá <b>Ingresar</b>.</p><p>Arriba ves la <b>fecha de hoy</b> y dos opciones:</p><ul><li><b>Nueva licencia</b>: cargar vacaciones, enfermedad, fallecimiento, suspensión, cambio de objetivo, etc.</li><li><b>Licencias registradas</b>: buscar las licencias cargadas, ver el PDF y reenviarlo.</li></ul>',
        tel: { quien: 'Licencias del Personal', cont: '<div class="cd"><div class="h" style="text-align:center">Hoy: viernes 23 de octubre de 2026</div><span class="b foco" style="display:block;padding:12px;background:#6B2D5C">Nueva licencia<br><small>Vacaciones, enfermedad, suspensión…</small></span><span class="b g" style="display:block;padding:12px">Licencias registradas<br><small>Consultar, ver PDF y reenviar</small></span></div>' } },
      { t: 'Vigilador y objetivo',
        html: '<ol><li>Revisá la <b>fecha</b> (viene la de hoy).</li><li>En <b>Vigilador</b> escribí parte del nombre, DNI o legajo y elegilo de la lista: <b>legajo, DNI, empresa y email</b> se completan solos.</li><li>Si el vigilador tiene otro email, corregilo: le llega la copia de la licencia.</li><li>Elegí el <b>objetivo</b> de la lista.</li></ol>',
        tel: { quien: 'Nueva licencia', cont: '<div class="cd"><div class="lb">Vigilador</div><div class="in foco">LEDESMA ENZO</div><div class="row"><span>Legajo 195</span><span>DNI 30111222</span><b>LEGUYET</b></div><div class="lb">Email del vigilador</div><div class="in">enzo@correo.com</div><div class="lb">Objetivo</div><div class="in">Jardines de San Isidro (M.2)</div></div>' } },
      { t: 'Tipo de licencia y fechas',
        html: '<ol><li>Elegí el <b>tipo de licencia</b>. Según el tipo aparecen los datos que hacen falta.</li><li><b>Vacaciones</b>: elegí el <b>período</b> al que corresponden (2025, 2026, 2027).</li><li>Cargá <b>desde</b> y <b>hasta</b>, los dos días incluidos.</li><li>La app calcula sola los <b>días corridos</b> y el día de <b>reintegro</b>.</li></ol><div class="tip">Ejemplo: del 01/10 al 14/10 son 14 días y se reintegra el 15/10.</div><p>En <b>suspensión</b>, <b>sanción</b>, <b>sin goce</b> o <b>fallecimiento</b> pide además el motivo o parentesco. En <b>cambio de objetivo</b> pide la fecha y el objetivo nuevo.</p>',
        tel: { quien: 'Nueva licencia', cont: '<div class="cd"><div class="lb">Tipo de licencia</div><div class="in">Vacaciones</div><div class="lb">Período</div><div class="in">2025</div><div class="row"><span>Desde 01/10/2026</span><span>Hasta 14/10/2026</span></div><div class="h foco" style="background:#F7EEF4;color:#6B2D5C;padding:8px;border-radius:10px">Total: 14 días corridos<br><small>Se reintegra el 15 de octubre de 2026</small></div></div>' } },
      { t: 'Certificado',
        html: '<p>En <b>enfermedad</b> el certificado es obligatorio; en otros tipos es opcional.</p><ul><li><b>Sacar foto</b>: abre la cámara del celular.</li><li><b>Adjuntar archivo</b>: elegís una foto o un PDF guardado.</li></ul><p>Podés cargar hasta 6. Con la ✕ quitás uno. Las fotos se agregan como hojas al final del PDF de la licencia.</p>',
        tel: { quien: 'Certificado', cont: '<div class="cd"><div class="row"><span class="b foco" style="background:#D98E04;color:#2a1a00">📷 Sacar foto</span><span class="b g">📎 Adjuntar archivo</span></div><div class="foto" style="height:90px">certificado.jpg</div></div>' } },
      { t: 'Destinatarios del correo',
        html: '<p>Antes de generar el formulario ves a quién le llega el mail:</p><ul><li><b>Para</b>: el vigilador, si tiene email.</li><li><b>Copia</b>: vos (el supervisor que entró), Fernando Jacyno y RRHH.</li></ul><ol><li>Para <b>quitar</b> a alguien tocá la <b>✕</b>.</li><li>Para <b>agregar</b> escribí nombre o email y elegilo de la lista, o escribí el email completo y tocá <b>Agregar</b>.</li></ol><div class="tip">Los correos nuevos que agregues quedan guardados en la libreta para la próxima vez.</div>',
        tel: { quien: 'Destinatarios', cont: '<div class="cd"><div class="row" style="background:#FFF8EA"><b>Para: vigilador</b><span>enzo@correo.com</span></div><div class="row"><span>Tu nombre (supervisor)</span><b>✕</b></div><div class="row"><span>Fernando Jacyno</span><b>✕</b></div><div class="row"><span>Anabella Mancilla</span><b>✕</b></div><div class="in foco">Agregar: escribí nombre o email</div></div>' } },
      { t: 'Formulario y firmas',
        html: '<ol><li>Tocá <b>Generar formulario</b>: aparece la notificación tal como sale en el PDF. Si algo está mal, tocá <b>Corregir</b>.</li><li>Tocá el recuadro <b>Firma del supervisor</b> y firmá con el dedo (la pantalla se pone horizontal). Tocá <b>OK CONFIRMAR</b>.</li><li>Pasale el celular al vigilador: tocá <b>Firma del vigilador</b> y que firme.</li><li>Revisá las aclaraciones y el DNI.</li></ol><div class="tip">En enfermedad o ART, si el vigilador no está, tildá <b>El vigilador no está presente para firmar</b>.</div>',
        tel: { quien: 'Formulario para firmar', cont: '<div class="cd"><div class="h" style="text-align:center;text-decoration:underline">PERIODO DE DESCANSO ANUAL</div><div class="lb">Firma del supervisor</div><div class="foto foco" style="height:70px;font-family:cursive;font-size:20px">G. San Martín</div><div class="lb">Firma del vigilador</div><div class="foto" style="height:70px;font-family:cursive;font-size:20px">E. Ledesma</div></div>' } },
      { t: 'Guardar y enviar',
        html: '<ol><li>Tocá <b>GUARDAR Y ENVIAR</b>.</li><li>Se guarda en la planilla, el PDF queda en Drive y se manda el mail con el PDF y los certificados.</li><li>Al terminar podés <b>ABRIR PDF</b>, <b>COMPARTIR PDF</b> (WhatsApp) o cargar una <b>Nueva licencia</b>.</li></ol><div class="tip">No se guarda nada hasta que tocás GUARDAR Y ENVIAR con las firmas confirmadas.</div>',
        tel: { quien: 'Listo', cont: '<div class="cd" style="text-align:center"><div style="font-size:40px">✅</div><div class="h">Vacaciones N° 8 – LEDESMA ENZO</div><span class="b v foco" style="background:#D98E04;color:#2a1a00">ABRIR PDF</span><span class="b" style="background:#6B2D5C">COMPARTIR PDF</span><span class="b g">Nueva licencia</span></div>' } },
      { t: 'Licencias registradas',
        html: '<p>En <b>Licencias registradas</b> buscás por <b>vigilador</b>, <b>tipo</b> o <b>fechas</b>. Con <b>Solo las que están vigentes hoy</b> ves quién está de licencia ahora.</p><p>Al elegir un vigilador ves sus datos y los <b>días de vacaciones tomados por período</b>. En cada licencia tocá <b>VER</b> para abrir el PDF, los adjuntos o <b>reenviarla por mail</b>.</p>',
        tel: { quien: 'Licencias registradas', cont: '<div class="cd"><div class="lb">Vigilador</div><div class="in foco">ledesma</div><div class="row"><span>Vacaciones por período</span><b>2025: 14 días</b></div><div class="row"><span>N° 8 · Vacaciones<br>01/10 al 14/10</span><span class="b">VER</span></div></div>' } }
    ],
    faq: [
      ['El vigilador no aparece en la lista', 'Tiene que estar en el listado de personal de SGI y no estar dado de baja.'],
      ['¿Cómo se calculan los días?', 'Son días corridos con desde y hasta incluidos. El reintegro es el día siguiente al "hasta".'],
      ['El vigilador no está para firmar', 'En enfermedad y ART se puede tildar que no está presente. En vacaciones y los demás tipos su firma es obligatoria.'],
      ['¿A quién le llega el mail?', 'Al vigilador (si tiene email) y a la lista de destinatarios que ves antes de generar el formulario. Podés quitar o agregar personas.'],
      ['¿Dónde queda el PDF?', 'En la carpeta de Drive de Licencias, y se ve desde Licencias registradas → VER → ABRIR PDF.']
    ],
    quiz: [
      { p: 'Vacaciones del 01/10 al 14/10: ¿cuántos días son?', o: ['13', '14', '15'], c: 1 },
      { p: '¿Cuándo se guarda la licencia?', o: ['Al elegir el vigilador', 'Al generar el formulario', 'Al tocar GUARDAR Y ENVIAR con las firmas'], c: 2 },
      { p: '¿Se puede quitar a alguien de los destinatarios del correo?', o: ['Sí, con la ✕', 'No, siempre les llega a todos'], c: 0 }
    ]
  }, {
    id: 'admin', nombre: 'Administrador',
    pasos: [
      { t: 'La planilla Certificados y Licencias',
        html: '<p>La app usa la planilla <b>Certificados y Licencias</b> (cuenta delbensgii). Tiene estas hojas:</p><ul><li><b>Licencias</b>: una fila por licencia, con el link del PDF y de los adjuntos.</li><li><b>TiposLicencia</b>: los tipos y sus textos.</li><li><b>Destinatarios</b>: los que salen por defecto en el mail.</li><li><b>Contactos</b>: la libreta para la lista desplegable.</li><li><b>Empresas</b>: la razón social que va en el formulario.</li><li><b>Config</b>: modo prueba y otros datos.</li></ul><p>El personal, los objetivos y los usuarios salen de <b>Stock Manager</b>.</p>',
        tel: { quien: 'Planilla de Licencias', cont: '<div class="cd"><div class="row"><b>Licencias</b><span>registro</span></div><div class="row foco"><b>TiposLicencia</b><span>tipos y textos</span></div><div class="row"><b>Destinatarios</b><span>por defecto</span></div><div class="row"><b>Contactos</b><span>libreta</span></div><div class="row"><b>Empresas</b><span>razón social</span></div><div class="row"><b>Config</b><span>modo prueba</span></div></div>' } },
      { t: 'Agregar o cambiar un tipo de licencia',
        html: '<p>En la hoja <b>TiposLicencia</b> agregá una fila (o cambiá una existente). No hace falta tocar el código.</p><ul><li><b>fechas</b>: RANGO (desde y hasta), DESDE (una fecha) o NO.</li><li><b>periodo</b>: SI para que pida el año (vacaciones).</li><li><b>certificado</b>: NO, OPCIONAL u OBLIGATORIO.</li><li><b>firma empleado</b>: SI, OPCIONAL o NO.</li><li><b>motivo</b> y <b>objetivo nuevo</b>: SI o NO.</li><li><b>activo</b>: NO para que no aparezca.</li></ul><div class="tip">En el texto podés usar {dias} {desde} {hasta} {reintegro} {periodo} {objetivo} {objetivoNuevo} {motivo}.</div>',
        tel: { quien: 'TiposLicencia', cont: '<div class="cd"><div class="row"><b>VAC</b><span>Vacaciones · RANGO · período SI</span></div><div class="row"><b>ENF</b><span>Enfermedad · certificado OBLIGATORIO</span></div><div class="row foco"><b>COB</b><span>Cambio de objetivo · DESDE</span></div></div>' } },
      { t: 'Destinatarios y contactos',
        html: '<ul><li>En <b>Destinatarios</b> están los que salen marcados por defecto (además del supervisor que entró): nombre y email.</li><li>En <b>Contactos</b> está la libreta para la lista desplegable. Se puede importar el CSV que exporta Outlook (Archivo → Importar → Reemplazar la hoja actual). También aparecen los usuarios de SGI con email.</li><li>Los contactos con "ex" o "Zanardi" no aparecen. Se cambia en Config → <b>CONTACTOS_EXCLUIR</b>.</li></ul>',
        tel: { quien: 'Destinatarios', cont: '<div class="cd"><div class="row"><span>Fernando Jacyno</span><span>fjacyno@…</span></div><div class="row"><span>Anabella Mancilla</span><span>amancilla@…</span></div><div class="row"><span>Paula Moldes</span><span>pmoldes@…</span></div><div class="row"><span>Silvia Ventemilla</span><span>sventemilla@…</span></div></div>' } },
      { t: 'Modo prueba',
        html: '<p>Mientras en <b>Config</b> no esté <b>MODO_PRUEBA = NO</b>, la app está en prueba:</p><ul><li>El mail llega <b>solo al administrador</b>.</li><li>El PDF sale con el sello <b>PRUEBA - SIN VALIDEZ</b>.</li><li>Las filas quedan con estado <b>PRUEBA</b>.</li></ul><p>Para usarla de verdad agregá en Config la fila <b>MODO_PRUEBA</b> con <b>NO</b>. Toma efecto al instante.</p>',
        tel: { quien: 'Config', cont: '<div class="cd"><div class="row"><b>EMAIL_ADMIN</b><span>fjacyno@ktl-seguridad.com</span></div><div class="row foco"><b>MODO_PRUEBA</b><span>NO</span></div><div class="row"><b>CONTACTOS_EXCLUIR</b><span>ex, zanardi</span></div></div>' } }
    ],
    faq: [
      ['Al entrar dice "No se pudo comunicar con el sistema"', 'Revisá que la implementación de Apps Script esté como "Cualquier persona", autorizada (ejecutar instalar()) y con Nueva versión.'],
      ['Sale "No cuentas con el permiso necesario"', 'Stock Manager tiene que estar compartido con delbensgii@gmail.com como editor.'],
      ['Cambié el código y no se ve', 'Implementar → Administrar implementaciones → Editar → Nueva versión.']
    ],
    quiz: [
      { p: '¿Dónde se agrega un tipo de licencia nuevo?', o: ['En el código', 'En la hoja TiposLicencia', 'En GitHub'], c: 1 },
      { p: '¿Cómo se sale del modo prueba?', o: ['Config → MODO_PRUEBA = NO', 'Borrando la planilla', 'Reinstalando la app'], c: 0 }
    ]
  }]
};
