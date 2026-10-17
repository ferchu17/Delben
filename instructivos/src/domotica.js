window.GUIA = {
  app: 'DelBen Domótica', sub: 'Luces y equipos de la casa, con botones y por voz',
  icono: 'fa-solid fa-house-signal', c1: '#2f6bff', c2: '#8a3bff', abrir: '../domotica/',
  apk: 'https://github.com/ferchu17/Delben/releases/download/domotica-apk/DelbenDomotica.apk',
  roles: [{
    id: 'usuario', nombre: 'Usuario',
    pasos: [
      { t: 'Instalar la app',
        html: '<ol><li>Descargá la APK (botón en la página de DelBen Domótica o en el portal) y abrila.</li><li>Si Android pregunta, permití <b>instalar apps de este origen</b>.</li></ol>',
        tel: { titulo: 'DelBen Domótica', salir: false, oscuro: true, cont: '<div class="cd" style="text-align:center;padding:20px"><div class="h">DelBen Domótica</div><span class="b foco" style="background:#fff;color:#3a1c8c">Descargar APK para Android</span></div>' } },
      { t: 'Configurar Smart Life',
        html: '<p>La primera vez entrá a <b>Ajustes</b> y cargá:</p><ul><li><b>Access ID</b> y <b>Access Secret</b> (platform.tuya.com → Cloud → tu proyecto → Overview).</li><li>El <b>UID</b> de tu cuenta de Smart Life (Devices → Link App Account).</li><li>El <b>Centro de datos</b>: Western America (Argentina).</li></ul><p>Con <b>Pegar todo</b> pegás los 3 datos juntos. Después tocá <b>Guardar</b>.</p><div class="tip">Las claves quedan guardadas solo en tu teléfono: nadie más puede manejar tu casa con la app.</div>',
        tel: { titulo: 'Ajustes', salir: 'Cerrar', oscuro: true, cont: '<div class="cd"><span class="b g">Pegar todo (los 3 datos juntos)</span><div class="lb">Access ID</div><div class="in foco">••••••••</div><div class="lb">Access Secret</div><div class="in">••••••••</div><div class="lb">UID de tu cuenta de Smart Life</div><div class="in">••••••••</div><span class="b v">Guardar</span></div>' } },
      { t: 'Botones y escenas',
        html: '<ul><li>Cada equipo tiene su botón con color: <b>encendido brilla</b>.</li><li>Las escenas <b>Apagar todo</b> y <b>Modo noche</b> funcionan con un toque.</li></ul>',
        tel: { titulo: 'Tu casa, a tu voz', salir: 'Ajustes', oscuro: true, cont: '<div class="tile" style="background:#ffd60a;color:#222;box-shadow:0 0 14px #ffd60a">Pasillo · encendido</div> <div class="tile" style="background:#263055">Cocina</div> <div class="tile" style="background:#18e0ff;color:#022;box-shadow:0 0 14px #18e0ff">Termo · encendido</div> <div class="tile" style="background:#263055">Living</div><div style="margin-top:8px"><span class="b r foco">Apagar todo</span><span class="b" style="background:#8a3bff">Modo noche</span></div>' } },
      { t: 'Hablarle a la casa',
        html: '<p>Decí <b>«Delben…»</b> y la orden. Por ejemplo:</p><ul><li>«Delben, encendé el pasillo».</li><li>«Delben, apagá todas las luces».</li><li>«Delben, ¿está prendido el termo?».</li></ul><p>Activá <b>Escucha permanente</b> y aceptá los permisos de micrófono y notificaciones: funciona con la app cerrada y la pantalla apagada.</p><div class="ojo">Tocá <b>Quitar restricción de batería</b> para que el teléfono no cierre la app. En Samsung: Ajustes → Batería → Límites de uso en segundo plano, y que DelBen no esté en «Apps inactivas».</div>',
        tel: { titulo: 'Tu casa, a tu voz', salir: 'Ajustes', oscuro: true, cont: '<div class="cd foco"><b>«Delben, apagá todas las luces»</b><br><span style="color:#2e9b3a">Listo, apagué todas las luces.</span></div>' } }
    ]
  }]
};
