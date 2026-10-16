/* =====================================================================
   CONTENIDO 2: objetos del mundo, acertijos, sustos guionados y objetivos
   ===================================================================== */
function populate(AR){
  const E=(a,x,y,o)=>{o.area=a;o.x=x;o.y=y;o.id=o.id||(a+'_'+x+'_'+y);AR[a].ents.push(o);return o};
  const clueE=(a,x,y,cid,label,spr,pages,after)=>E(a,x,y,{id:'e_'+cid,label,spr,clue:cid,on(){const first=addClue(cid);say(clueTitle(cid),typeof pages==='function'?pages(first):pages,()=>{after&&after(first)})}});
  const docE=(a,x,y,did,label,spr,o)=>E(a,x,y,Object.assign({id:'d_'+did,label,spr:spr||'papel',doc:did,on(){readDoc(did,o&&o.after)}},o||{}));
  const itemE=(a,x,y,it,label,spr,msg,o)=>E(a,x,y,Object.assign({id:'i_'+it,label,spr,cond:()=>!has('got:'+it)&&(!o||!o.c||o.c()),on(){setF('got:'+it);giveItem(it);say('',[msg],o&&o.after)}},o||{}));
  const pilasE=(a,x,y)=>E(a,x,y,{id:'p_'+a+x+'_'+y,label:'Agarrar pilas',spr:'pilas',cond:()=>!has('got:p_'+a+x+'_'+y),on(){setF('got:p_'+a+x+'_'+y);G.pilas++;sfx('objeto');toast('Pilas nuevas (tenés '+G.pilas+')');save()}});
  const botE=(a,x,y)=>E(a,x,y,{id:'b_'+a+x+'_'+y,label:'Agarrar la botella',spr:'botella',cond:()=>!has('got:b_'+a+x+'_'+y),on(){setF('got:b_'+a+x+'_'+y);G.botellas++;sfx('objeto');toast('Botella vacía (tenés '+G.botellas+'). Tirala con G o con el botón Botella para hacer ruido lejos.');save()}});
  const exitE=(a,x,y,to,tx,ty,label,need,o)=>E(a,x,y,Object.assign({id:'x_'+a+'_'+x+'_'+y,label,spr:null,glint:false,on(){const n=need&&need();if(n){say('',[n]);return}goArea(to,tx,ty)}},o||{}));
  const deco=(a,x,y,label,pages,o)=>E(a,x,y,Object.assign({label,glint:false,on(){say('',typeof pages==='function'?pages():pages,o&&o.after)}},o||{}));
  const cul=susById(CASE.culpa),ar=armaById(CASE.arma);

  /* ================= CAPÍTULO 1 ================= */
  // escena del crimen
  clueE('pb',7,7,'c_cuerpo','Examinar el cuerpo','cuerpo',first=>[
    ...(first?['El Conde Ulrico Sombranegra. Boca arriba sobre la alfombra, los ojos abiertos, la boca torcida como si hubiera visto algo justo antes de morir.']:[]),
    ar.forense],first=>{if(first)setTimeout(()=>{if(G.area==='pb'){sfx('susurro',-.3);susurro('...no fue solo una persona...')}},900)}).cond=()=>!has('cuerpoIdo');
  deco('pb',7,7,'Examinar la alfombra',['El cuerpo ya no está. Sobre la alfombra quedó la mancha y dos surcos de sangre que se arrastran hacia el hall... y siguen debajo de la escalera, hasta la puerta del sótano.'],{spr:'arrastre',cond:()=>has('cuerpoIdo')});
  clueE('pb',2,2,'c_reloj','Examinar el reloj','reloj',()=>[`El reloj de pie cayó con el Conde. El vidrio está astillado y las agujas quedaron clavadas: ${CASE.hora}.`,'Esa es la hora del crimen.']);
  clueE('pb',10,6,'c_rastro','Examinar el piso junto al escritorio','rastro',()=>[cul.rastroEsc]);
  docE('pb',11,9,'historia','Leer el libro abierto','libro');
  docE('pb',33,8,'lista','Leer la lista de la cena','papel');
  // armas
  ARMAS.forEach(a=>{const [ar2,x,y]=a.pos;clueE(ar2,x,y,'w_'+a.id,a.label,'arma_'+a.id,()=>[a.id===CASE.arma?a.falta:a.presente])});
  // sospechosos
  SUS.forEach(s=>{
    const [pa,px,py]=s.pos;
    E(pa,px,py,{id:'npc_'+s.id,k:'npc',npc:s,label:'Hablar con '+s.nombre,glint:false,cond:()=>!has('caso_cerrado'),on(){
      const first=!G.talked.includes(s.id);if(first){G.talked.push(s.id);addClue('t_'+s.id)}
      const extra=has('m1')?[[
        'Berta: "Apague esa linterna cuando escuche los pasos. Por el amor de Dios."',
        ][0]]:[];
      say(s.nombre+', '+s.rol,s.talk.concat(has('m1')?[{berta:'(susurra) Apague la linterna cuando lo escuche. A la luz la encuentra.',tomas:'(susurra) Ya salió. Lo escuché respirar detrás del vidrio. No corra si no la vio.',clara:'(llorando) Estaba parado al lado de mi cama. Sin cara. Me miraba sin cara.',vidal:'(pálido) Lo que anda por la casa no es una persona. No intente razonar con eso.',elena:'(muy tranquila) Ya vino a cobrar. Siempre viene cuando muere el Conde.'}[s.id]]:[]),()=>{if(first)save()})}});
    const [ca,cx,cy]=s.coartPos;clueE(ca,cx,cy,'a_'+s.id,s.coartLabel,'coartada_'+s.id,()=>[fillT(s.id===CASE.culpa?s.contr:s.corr)]);
    const [ra,rx,ry]=s.rastroPos;clueE(ra,rx,ry,'r_'+s.id,s.rastroLabel,'rastro_'+s.id,()=>[s.rastroPropio]);
    const [ea,ex,ey]=s.escPos;clueE(ea,ex,ey,'e_'+s.id,s.escLabel,'escondite',first=>s.id===CASE.culpa?[`Escondido ${s.escLugar}...`,`...encontrás ${ar.escondido}.`]:[s.escNada],first=>{if(first&&s.id===CASE.culpa){sfx('stinger')}});
    const [ma,mx,my]=s.motPos;E(ma,mx,my,{id:'e_m_'+s.id,label:s.motLabel,spr:'papel',clue:'m_'+s.id,on(){addClue('m_'+s.id);showPaper(s.motTit,s.motTxt,true)}});
  });
  // llaves y acertijos de la casa
  itemE('pb',27,13,'llave_jardin','Abrir el cajón','cajon','En el cajón de los cubiertos, entre servilletas amarillas, hay una llave larga con una etiqueta: "Jardín".');
  docE('pb',37,13,'notaCocina','Leer la nota de la alacena','papel');
  E('pb',23,21,{id:'telefono',label:'Usar el teléfono',spr:'telefono',glint:false,on(){
    if(has('caso_cerrado')){say('Teléfono',['Levantás el tubo. No hay tono.','Del otro lado alguien respira despacio, muy cerca del micrófono.','Y una voz que no es humana dice tu nombre.'],()=>{sfx('susurro',0)});return}
    say('Teléfono',['Un teléfono negro y pesado. La línea con la comisaría todavía funciona, entre ruidos de la tormenta.','Podés llamar al Inspector y decirle quién fue. Tenés '+(3-G.intentos)+' intento'+(3-G.intentos===1?'':'s')+'.'],openAccuse)}});
  deco('pb',19,24,'Probar la puerta principal',['La puerta principal no se mueve. Por la cerradura se ve que un árbol enorme cayó contra ella con la tormenta.','Nadie entra. Nadie sale.']);
  E('pb',16,1,{id:'puertaSotano',label:'Abrir la puerta del sótano',spr:null,glint:false,on(){
    if(!has('caso_cerrado')){say('',['Una puerta baja de hierro, debajo de la escalera. Está fría como el hielo.','Del otro lado se escucha algo que se arrastra. Y después, nada.','Primero resolvé el caso.']);return}
    if(!hasItem('llave_hierro')){say('',['Cerrada con una cerradura de hierro antigua. Las marcas de sangre terminan justo acá, debajo de la puerta.','La llave tiene que estar en algún lado. ¿El estudio del Conde?']);return}
    if(!has('u_sotano')){setF('u_sotano');sfx('candado')}
    goArea('so',3,4)}});
  exitE('pb',19,2,'p1',25,16,'Subir al primer piso');
  exitE('pb',38,15,'jd',2,14,'Salir al jardín',()=>{if(has('u_jardin'))return null;if(hasItem('llave_jardin')){setF('u_jardin');sfx('candado');return null}return 'La puerta trasera está cerrada con llave. Tiene una cerradura grande y oxidada.'});
  docE('pb',17,13,'notaHall','Levantar el papel del piso','papel',{cond:()=>has('m1')});
  pilasE('pb',22,18);pilasE('pb',35,23);
  E('pb',5,14,{id:'piano',label:'Tocar el piano',spr:null,glint:false,on(){
    if(has('u_piano')){say('',['El compartimento secreto del piano está vacío. Las teclas siguen tibias, como si alguien acabara de tocar.']);return}
    openPiano()}});

  // primer piso
  exitE('p1',25,20,'pb',19,4,'Bajar a la planta baja');
  E('p1',24,10,{id:'puertaEstudio',label:'Abrir el estudio del Conde',spr:'candado',glint:false,cond:()=>!has('u_estudio'),on(){
    openKeypad({tit:'Estudio del Conde',sub:'Un candado de cuatro números. El Conde lo puso hace poco: la madera alrededor todavía está astillada.',len:4,ok:c=>c===CASE.codEst,
      done(){setF('u_estudio');unlockTile('p1',24,9);sfx('candado');say('',['El candado cede. La puerta del estudio se abre sola, despacio, con un quejido largo.'],()=>{checkpoint()})}})}});
  docE('p1',20,10,'retrato','Mirar el retrato del abuelo','retrato',{after(){if(!has('sus_retrato')){setF('sus_retrato');sfx('risa',.2);setTimeout(()=>susurro('...no lo toques...'),500)}}});
  [[3,10],[11,10],[29,10],[36,10]].forEach(([x,y],i)=>deco('p1',x,y,'Mirar el cuadro',[['Una mujer con un vestido de novia. La cara está tapada con pintura negra, muy gruesa, como si alguien no quisiera verla.','Un nene con traje de marinero. Tiene la boca cosida en la pintura.','Un paisaje: la mansión de noche. En una ventana del primer piso hay una figura pálida. Esa ventana es la del pasillo donde estás parado.','Un hombre de negro, sin cara. El marco está rayado con uñas.'][i]],{spr:'retrato'}));
  docE('p1',9,5,'partitura','Leer la partitura','papel');
  E('p1',15,1,{id:'espejo',label:'Mirarte en el espejo',spr:null,glint:true,on(){
    if(!has('sus_espejo')){setF('sus_espejo');scare('generico',()=>readDoc('espejo'));return}readDoc('espejo')}});
  pilasE('p1',16,7);pilasE('p1',32,8);
  E('p1',28,2,{id:'cajaFuerte',label:'Abrir la caja fuerte',spr:'cajaFuerte',glint:false,cond:()=>!has('u_caja'),on(){
    openKeypad({tit:'Caja fuerte',sub:'Una caja fuerte empotrada. Cuatro números: dos para el día y dos para el mes.',len:4,ok:c=>c===CASE.boda.code,
      done(){setF('u_caja');sfx('candado');setF('got:llave_hierro');giveItem('llave_hierro');setF('got:anillo');giveItem('anillo');
        say('',['La caja fuerte se abre con un golpe seco.','Adentro: una llave de hierro, pesada y helada, con una etiqueta que dice "Sótano".','Y un anillo de bodas antiguo, con una inscripción: "Hasta que la muerte nos encuentre".','Debajo de todo, una foto vieja de una novia en la capilla del cementerio. Tiene la cara raspada con una moneda.'],()=>{checkpoint();save()})}})}});
  docE('p1',23,5,'diarioConde','Leer el diario sobre el escritorio','libro');
  docE('p1',20,7,'planos','Mirar los planos','papel');
  E('p1',14,18,{id:'puertaVestidor',label:'Abrir el vestidor',spr:'candado',glint:false,cond:()=>!has('u_vestidor'),on(){
    if(hasItem('llave_pequena')){setF('u_vestidor');unlockTile('p1',15,18);sfx('candado');say('',['La llave dorada entra justo. Click. Un olor dulce y rancio sale del vestidor.'])}
    else say('',['Cerrado con llave. Una cerradura chiquita, dorada, con forma de nota musical.'])}});
  docE('p1',20,20,'diarioElena','Leer el diario de Elena','libro');
  E('p1',35,19,{id:'cajaMusica',label:'Mirar la caja de música',spr:'cajaMusica',on(){
    say('',['Una caja de música con una bailarina rota. Le falta la cabeza.','Cuando la tocás, la cuerda empieza a girar sola.'],()=>{sfx('cajaMusica');setTimeout(()=>sfx('llanto',.5),5200);if(!has('sus_cuna2')){setF('sus_cuna2');setTimeout(()=>{if(G.area==='p1'){scare('generico')}},7000)}})}});
  docE('p1',37,18,'cuna','Leer el cuaderno de la cuna','libro');
  deco('p1',33,16,'Mirar el caballito',['Un caballito de madera. Se está hamacando.','Nadie lo tocó.'],{spr:'caballito'});

  // jardín
  exitE('jd',1,14,'pb',37,15,'Entrar a la casa');
  E('jd',6,18,{id:'puertaCobertizo',label:'Abrir el cobertizo',spr:'candado',glint:false,cond:()=>!has('u_cobertizo'),on(){
    if(hasItem('llave_cobertizo')){setF('u_cobertizo');unlockTile('jd',6,19);sfx('candado');say('',['El candado se abre. Adentro huele a tierra mojada y a algo podrido.'])}
    else say('',['El cobertizo de Tomás está cerrado con un candado. La llave no está a la vista.','Tomás guarda las cosas importantes entre sus plantas.'])}});
  itemE('jd',24,3,'llave_cobertizo','Revisar la maceta rota','maceta','Dentro de una maceta rota, enterrada en la tierra, hay una llave chica con una cinta verde: la del cobertizo.');
  docE('jd',5,24,'cobertizo','Leer el cuaderno manchado','libro');
  pilasE('jd',8,21);
  E('jd',30,21,{id:'pozo',label:'Mirar dentro del pozo',spr:null,glint:false,on(){
    if(!has('sus_pozo')){setF('sus_pozo');say('',['Te asomás. Abajo todo es negro. Se escucha agua... y algo más.','Alguien, desde el fondo, dice tu nombre con la voz de tu mamá.'],()=>scare('generico'));return}
    say('',['No vuelvas a mirar ahí abajo.'])}});
  deco('jd',38,20,'Mirar el portón',['Un portón de hierro con una cadena oxidada. Del otro lado, entre la niebla, se ven cruces torcidas.','El cementerio de la familia. Desde acá no se puede pasar.']);

  /* ================= CAPÍTULO 2 ================= */
  exitE('so',3,2,'pb',16,2,'Subir a la casa',()=>has('ch2volver')?null:'La puerta de arriba se cerró de golpe cuando bajaste. Está trabada desde el otro lado. Solo queda ir hacia adelante.');
  docE('so',9,6,'bodega','Leer el registro de la bodega','libro');
  docE('so',21,5,'lavadero','Leer la nota arrugada','papel');
  docE('so',35,3,'valvulas','Leer la página del manual','papel');
  docE('so',12,23,'inscripcion','Leer la inscripción en la piedra','inscripcion');
  [[10,3],[14,5],[16,3],[37,6],[22,4]].forEach(([x,y])=>botE('so',x,y));
  pilasE('so',31,6);pilasE('so',2,18);pilasE('so',30,25);
  itemE('so',17,6,'fusible1','Agarrar el fusible','fusible','Un fusible de vidrio, viejo pero sano, metido entre dos barricas. Uno de tres.',{after(){save()}});
  itemE('so',27,5,'fusible2','Meter la mano en la pileta','fusible','Metés la mano en el agua negra de la pileta. Algo te roza los dedos. Sacás un fusible.',{after(){if(!has('sus_pileta')){setF('sus_pileta');scare('cosa')}save()}});
  itemE('so',37,18,'fusible3','Agarrar el fusible','fusible','En el piso de la celda de castigo, entre uñas arrancadas, hay un fusible. El tercero.');
  itemE('so',38,18,'reliquia','Agarrar lo que brilla en la pared','reliquia','Clavado en la pared hay un diente enorme, negro, con raíz de tres puntas. La reliquia del prisionero. Está tibio.');
  docE('so',35,19,'prisionero','Leer el diario del prisionero','libro');
  deco('so',24,4,'Mirar la sábana colgada',['Una sábana colgada de una soga. Tiene una mancha con forma de cara.','La mancha abre la boca.'],{spr:'sabana',after(){if(!has('sus_sabana')){setF('sus_sabana');scare('generico')}}});
  E('so',20,11,{id:'agua',label:'Mirar el agua',spr:null,glint:false,cond:()=>!has('drenado'),on(){say('',['El pasillo está inundado. Agua negra, helada, hasta el pecho.','Algo se mueve abajo. Es grande. Tiene que haber una forma de vaciarlo desde las calderas.'])}});
  E('so',7,12,{id:'valvulas',label:'Usar las válvulas',spr:'valvulas',glint:false,cond:()=>!has('drenado'),on(){openValves()}});
  E('so',13,11,{id:'cajaFus',label:'Abrir la caja de fusibles',spr:'cajaFus',glint:false,cond:()=>!has('luz'),on(){
    const n=['fusible1','fusible2','fusible3'].filter(f=>hasItem(f)).length;
    if(n<3){say('',[`La caja de fusibles del sótano. Tres huecos vacíos. Tenés ${n} de 3 fusibles.`]);return}
    ['fusible1','fusible2','fusible3'].forEach(useItem);setF('luz');}});
  E('so',32,11,{id:'reja2',label:'Destrabar la reja',spr:null,glint:false,cond:()=>!has('u_celda2'),on(){setF('u_celda2');unlockTile('so',32,10);sfx('candado');say('',['Desde adentro, la reja de la celda se destraba con un empujón. Ahora es un atajo al pasillo.'])}});
  [[27,11],[32,12],[37,11]].forEach(([x,y],i)=>E('so',x,y,{id:'marcas'+i,label:'Mirar las marcas en la pared',spr:null,on(){
    const n=CASE.marcas[i];setF('vi_marcas'+i);
    say('',[`Celda ${['I','II','III'][i]}. Rayas en la pared, hechas con las uñas, contando días.`,`Contás ${n}: ${'|'.repeat(n)}`,i===2?'Abajo dice: "en orden, uno, dos, tres. así abre la de castigo."':'Hay sangre seca en la punta de cada raya.'])}}));
  E('so',33,18,{id:'castigo',label:'Abrir la celda de castigo',spr:'candado',glint:false,cond:()=>!has('u_castigo'),on(){
    openKeypad({tit:'Celda de castigo',sub:'Un candado viejo de tres números. Alguien grabó en la puerta: "los días de los tres".',len:3,ok:c=>c===CASE.marcas.join(''),
      done(){setF('u_castigo');unlockTile('so',34,18);sfx('candado');say('',['El candado cae al piso. La puerta de la celda de castigo se abre hacia adentro, sola.'],()=>checkpoint())}})}});
  E('so',20,26,{id:'rejaCata',label:'Abrir la reja de las catacumbas',spr:null,glint:false,on(){
    if(!has('luz')){say('',['Una reja enorme con un motor eléctrico. Sin corriente no se mueve.','Detrás, unos escalones bajan a la oscuridad total.']);return}
    if(!has('u_catacumbas')){setF('u_catacumbas');unlockTile('so',20,27);sfx('electricidad')}
    goArea('ca',21,1)}});
  // catacumbas
  exitE('ca',21,1,'so',20,25,'Volver al sótano');
  AR.ca._piezas.forEach(([x,y],i)=>itemE('ca',x,y,'pieza'+(i+1),'Agarrar el pedazo de metal','pieza',`Un pedazo de medallón de plata ennegrecida, con una parte de un ojo grabado. ${i+1===3?'Con este, ya tenés tres.':''}`,{after(){const n=[1,2,3].filter(k=>hasItem('pieza'+k)).length;toast(`Partes del medallón: ${n}/3`);checkpoint();save();if(n===2)setTimeout(()=>{sfx('chillido',0);susurro('...devolvelo...')},1500)}}));
  {const o=AR.ca._otros;if(o[5])docE('ca',o[5][0],o[5][1],'huesos','Mirar la calavera','calavera');
    [6,7,8].forEach(i=>{if(o[i])pilasE('ca',o[i][0],o[i][1])});[9,10].forEach(i=>{if(o[i])botE('ca',o[i][0],o[i][1])});
    o.slice(11,16).forEach(([x,y],i)=>deco('ca',x,y,'Mirar el nicho',[['Un nicho con un esqueleto sentado. Tiene las manos sobre las orejas.','Un nicho vacío. Por el polvo, hace poco hubo algo acostado acá.','Huesos de chico, muchos. Demasiados.','Un esqueleto con ropa de mucama. Todavía tiene un plumero en la mano.','Una calavera dada vuelta mirando la pared. Cuando la iluminás, se escucha un "no".'][i]],{spr:'calavera'}))}
  E('ca',21,29,{id:'puertaHuesos',label:'Examinar la Puerta de los Huesos',spr:null,glint:false,on(){
    const n=[1,2,3].filter(k=>hasItem('pieza'+k)).length;
    if(n<3){say('',['Una puerta hecha de huesos humanos, encastrados como ladrillos. En el centro, un hueco redondo con la forma de un medallón partido en tres.',`Tenés ${n} de 3 partes.`]);return}
    if(!has('medallon_puesto')){setF('medallon_puesto');[1,2,3].forEach(k=>useItem('pieza'+k));setF('got:medallon');giveItem('medallon',true);
      say('',['Encastrás las tres partes. El medallón se suelda solo con un chasquido, como un hueso que vuelve a su lugar.','Debajo aparecen cuatro calaveras con cuatro nombres. Las bocas están cerradas.','Tenés que abrir una. Solo una.'],riddle);return}
    riddle();
    function riddle(){openChoice({tit:'Cuatro calaveras',sub:'Cuatro nombres tallados en los huesos de la frente. ¿Qué boca abrís?',opts:ANCESTROS,
      done(i){if(ANCESTROS[i]===CASE.fundador){setF('u_huesos');sfx('portazo',0);say('',['La boca de '+CASE.fundador+' se abre con un crujido larguísimo. La puerta se parte al medio.','Del otro lado sube un aire helado y un olor a flores podridas.'],()=>goArea('ce',5,6))}
        else{scare('cosa');alertarMonstruo(P.x,P.y,30);say('',['La boca de '+ANCESTROS[i]+' se abre... y muerde. Te arranca un pedazo de la manga.','Algo, muy cerca, escuchó todo.'])}}})}}});

  /* ================= CAPÍTULO 3 ================= */
  exitE('ce',4,4,'ca',21,29,'Bajar a las catacumbas');
  E('ce',9,15,{id:'isabel',label:'Leer la lápida',spr:'flores',glint:true,on(){
    if(!has('got:llave_cuidador')){setF('got:llave_cuidador');giveItem('llave_cuidador',true);
      say('Lápida',[`ISABEL SOMBRANEGRA · ${CASE.isabelMuere}\n"Esperó en el altar. Sigue esperando."`,'Sobre la tierra hay un ramo de flores blancas, frescas, como si alguien las hubiera dejado hace un minuto.','Entre los tallos hay una llave con una etiqueta: "Casilla". La agarrás.','Detrás tuyo, alguien suspira.'],()=>{setF('novia')});return}
    say('Lápida',[`ISABEL SOMBRANEGRA · ${CASE.isabelMuere}\n"Esperó en el altar. Sigue esperando."`])}});
  {const lugares=[[15,3],[30,6],[39,12],[12,24]];const r=mulberry(CASE.seed^77);const ord=lugares.slice().sort(()=>r()-.5);
    CASE.condes.forEach((c,i)=>{const [x,y]=ord[i];E('ce',x,y,{id:'conde'+i,label:'Leer la lápida',spr:null,on(){setF('vi_conde'+i);say('Lápida',[`${c.n.toUpperCase()} SOMBRANEGRA\nConde\n${c.nac} — ${c.muere}`,['"Pagó."','"Pagó con su hijo mayor."','"Pagó, y después se pagó a sí mismo."','"El último que bajó."'][i]])}})});
    [[24,3,'LEONOR SOMBRANEGRA\nEsposa\n"Se durmió y no despertó. Nadie la escuchó gritar."'],[18,6,'MARÍA DEL CARMEN SOMBRANEGRA\nEsposa\n"Le arrancó los ojos a su marido antes de morir."'],[27,21,'TOMASITO\n(sin apellido, sin fecha)\n"Lo encontramos en el pozo."']].forEach(([x,y,t])=>deco('ce',x,y,'Leer la lápida',[t]));}
  E('ce',37,9,{id:'puertaCasilla',label:'Abrir la casilla del cuidador',spr:'candado',glint:false,cond:()=>!has('u_casilla'),on(){
    if(hasItem('llave_cuidador')){setF('u_casilla');unlockTile('ce',37,8);sfx('candado');say('',['La llave gira con esfuerzo. Adentro hay una lámpara de querosén apagada y un olor a encierro.'])}
    else say('',['La casilla del cuidador está cerrada. En la puerta, alguien clavó una herradura dada vuelta.'])}});
  docE('ce',36,4,'himno','Leer la hoja de la pared','papel');
  docE('ce',38,6,'cuidador','Leer la libreta del cuidador','libro');
  pilasE('ce',35,7);pilasE('ce',8,22);pilasE('ce',31,28);
  [[35,24,0],[37,24,1],[39,24,2]].forEach(([x,y,b])=>E('ce',x,y,{id:'campana'+b,label:'Tocar la campana '+['grande','mediana','chica'][b],spr:'campana',glint:false,on(){tocarCampana(b)}}));
  E('ce',21,24,{id:'puertaCapilla',label:'Entrar a la capilla',spr:null,glint:false,on(){
    if(!has('campanas')){say('',['Las puertas de la capilla están cerradas. No tienen cerradura: solo una inscripción tallada.','"Me abro con el himno."']);return}
    goArea('cp',10,21)}});
  E('ce',21,18,{id:'puertaCripta',label:'Abrir la cripta de los Condes',spr:'candado',glint:false,cond:()=>!has('u_cripta'),on(){
    openKeypad({tit:'Cripta de los Condes',sub:'Una reja de hierro con un candado de cuatro cifras. Encima dice: "LOS CONDES, EN EL ORDEN EN QUE CAYERON".',len:4,ok:c=>c===CASE.codCripta,
      done(){setF('u_cripta');unlockTile('ce',21,17);sfx('portazo',0);say('',['La reja de la cripta se abre. Adentro, todos los ataúdes tienen la tapa corrida.'],()=>checkpoint())}})}});
  itemE('ce',21,12,'velo','Agarrar el velo','velo','Sobre un ataúd abierto hay un velo de novia, amarillento, con manchas oscuras. Cuando lo levantás, pesa como si todavía tuviera una cabeza adentro.',{after(){if(!has('sus_velo')){setF('sus_velo');scare('novia')}save()}});
  docE('ce',23,14,'contrato','Leer el pergamino','contrato');
  pilasE('ce',17,13);
  E('ce',42,16,{id:'porton',label:'Abrir el portón',spr:null,glint:false,on(){
    if(!has('quemado')){say('',['El portón del cementerio está cerrado con cadenas gruesas. Del otro lado, el camino al pueblo.','Todavía no. Ella no te va a dejar ir.']);return}
    terminar()}});
  // capilla
  exitE('cp',10,22,'ce',21,23,'Salir al cementerio');
  docE('cp',24,3,'libroCapilla','Leer el libro de la capilla','libro');
  itemE('cp',26,7,'fosforos','Agarrar la caja de fósforos','fosforos','Una caja de fósforos de cera, de las que usaba el cura para las velas del altar. Quedan pocos.');
  pilasE('cp',27,2);
  deco('cp',19,12,'Mirar en el confesionario',['Adentro del confesionario hay una hoja doblada:','"Padre, la vi en el pasillo de la casa. No caminaba. Cada vez que parpadeaba estaba más cerca. Cuando la alumbré con el farol se quedó quieta, con la cabeza torcida. Dígame que no estoy loca."'],{spr:'papel',glint:true});
  E('cp',10,4,{id:'altar',label:'Acercarte al altar',spr:null,glint:false,on(){altar()}});
  [[7,2,1],[14,2,2],[7,4,3],[14,4,4]].forEach(([x,y,n])=>E('cp',x,y,{id:'vela'+n,label:'Encender la vela',spr:'velaApagada',glint:false,cond:()=>has('ofrenda')&&!has('vela'+n),on(){
    if(!hasItem('fosforos')){say('',['Una vela negra, gruesa. Necesitás algo para encenderla.']);return}
    setF('vela'+n);sfx('linterna');const c=['vela1','vela2','vela3','vela4'].filter(has).length;
    if(c<4){toast(`Velas encendidas: ${c}/4`);setTimeout(()=>{noviaCerca(3+(4-c)*2)},700)}else{say('',['La cuarta vela se enciende. Las cuatro llamas se inclinan hacia vos al mismo tiempo, como si alguien soplara desde el altar.','Ahora el contrato.'])}}}));
  return AR;
}

/* ---------- campanas ---------- */
function tocarCampana(b){
  sfx('campana',[196,262,392][b]);alertarMonstruo((35+b*2)*T,24*T,16);
  if(has('campanas'))return;
  G.campSeq=(G.campSeq||[]).concat(b).slice(-5);
  const want=CASE.himno;
  if(G.campSeq.length===5){
    if(G.campSeq.every((v,i)=>v===want[i])){setF('campanas');unlockTile('ce',21,25);unlockTile('ce',22,25);
      setTimeout(()=>{sfx('campana',196);sfx('campana',262)},900);setTimeout(()=>{susurro('...sí, acepto...');sfx('susurro',0)},2200);
      cartel('','Las puertas de la capilla se abrieron',3500);checkpoint();save()}
    else{G.campSeq=[];setTimeout(()=>{toast('Las campanas desafinan, como si alguien se riera adentro del metal. Empezá de nuevo.');sfx('risa',0)},800)}
  }
}
/* ---------- altar ---------- */
function altar(){
  if(!has('ofrenda')){
    const faltan=['anillo','reliquia','medallon','velo'].filter(i=>!hasItem(i));
    if(faltan.length){say('',['Un altar de piedra con un mantel podrido. En el centro, cuatro huecos tallados en fila.',`Faltan cosas para la ofrenda (tenés ${4-faltan.length} de 4). El contrato dice qué hay que traer.`]);return}
    if(!G.docs.includes('contrato')){say('',['Tenés cuatro objetos que encajan en los huecos del altar. Pero no sabés en qué orden.','En algún lado tiene que estar escrito.']);return}
    openOrder({tit:'La ofrenda',sub:'Poné los objetos en los huecos del altar, en el orden del contrato.',items:['anillo','reliquia','medallon','velo'],
      done(ord){if(ord.every((o,i)=>o===CASE.ritual[i])){setF('ofrenda');sfx('stinger');say('',['Cada objeto se hunde en su hueco como si la piedra fuera barro.','En los cuatro rincones del altar aparecen cuatro velas negras que antes no estaban.'],()=>{checkpoint();save()})}
        else{scare('novia');noviaCerca(2);say('',['Los objetos se escupen del altar. Una carcajada de mujer rebota en toda la capilla.','Ese no era el orden.'])}}});
    return}
  const v=['vela1','vela2','vela3','vela4'].filter(has).length;
  if(v<4){say('',[`Las velas negras del altar. Encendidas: ${v} de 4.`,hasItem('fosforos')?'Encendé las cuatro.':'Necesitás con qué encenderlas. ¿La sacristía?']);return}
  if(!has('quemado')){say('',['Sostenés el contrato sobre las cuatro llamas.','El pergamino grita cuando se prende fuego. Grita con la voz de todos los Condes juntos.'],()=>{setF('quemado')})}
  else say('',['El contrato ya es ceniza. ¡CORRÉ HASTA EL PORTÓN!'])
}

/* ---------- objetivos y pistas ---------- */
function casoN(){return G.clues.filter(c=>/^(c_|w_|a_|r_|e_|m_|t_)/.test(c)).length}
function objetivo(){
  const ch=AREAS[G.area]?AREAS[G.area].ch:1;
  if(has('quemado'))return{t:'¡CORRÉ HASTA EL PORTÓN DEL CEMENTERIO!',h:'El portón está al este del cementerio, al final del camino. Alumbrala si la ves.'};
  if(ch===3||has('u_huesos')){
    if(!hasItem('llave_cuidador')&&!has('got:llave_cuidador'))return{t:'Buscá la tumba de Isabel, la novia.',h:'Isabel no está con los Condes: el libro dice que quedó afuera, sola, cerca del mausoleo donde saliste. Buscá la lápida con flores.'};
    if(!has('u_casilla'))return{t:'Entrá a la casilla del cuidador.',h:'La casilla está arriba a la derecha del cementerio. Usá la llave de las flores.'};
    if(!has('campanas'))return{t:'Tocá el himno con las campanas del campanario.',h:'La hoja del himno estaba en la casilla. El campanario está abajo a la derecha. Grave = la grande (izquierda), media = la del medio, aguda = la chica (derecha).'};
    if(!hasItem('fosforos')&&!has('got:fosforos'))return{t:'Revisá la capilla y la sacristía.',h:'La sacristía es el cuarto a la derecha del altar.'};
    if(!has('u_cripta'))return{t:'Abrí la cripta de los Condes.',h:'Leé el libro de la capilla. Buscá las cuatro lápidas de los Condes, ordenalos del que murió primero al último y usá la última cifra de cada año de muerte.'};
    if(!hasItem('velo')&&!has('got:velo')||!G.docs.includes('contrato'))return{t:'Revisá la cripta.',h:'Adentro de la cripta hay un velo y un pergamino. Necesitás los dos.'};
    if(!has('ofrenda'))return{t:'Hacé la ofrenda en el altar de la capilla.',h:'El contrato describe cada objeto sin nombrarlo: "lo que unió dos manos" es el anillo, "lo que se le arrancó a la Boca" es la reliquia (el diente), "lo que se rompió en tres" es el medallón y "lo que cubrió el rostro" es el velo.'};
    if(['vela1','vela2','vela3','vela4'].filter(has).length<4)return{t:'Encendé las cuatro velas del altar.',h:'Están en las esquinas del altar. Cada vela que prendés la acerca. Alumbrala mientras tanto.'};
    return{t:'Quemá el contrato en el altar.',h:'Acercate al altar con las cuatro velas prendidas.'};
  }
  if(ch===2){
    if(G.area==='ca'){const n=[1,2,3].filter(k=>hasItem('pieza'+k)).length;
      if(n<3&&!has('medallon_puesto'))return{t:`Encontrá las 3 partes del medallón (${n}/3).`,h:'Están al fondo de los pasillos sin salida, lejos de la entrada. Mirá el mapa del diario para ver por dónde ya pasaste. No corras: la cosa te escucha.'};
      return{t:'Abrí la Puerta de los Huesos, al fondo de las catacumbas.',h:'Está en el extremo de abajo del laberinto. Para la calavera correcta, releé el diario del prisionero.'}}
    if(!has('drenado'))return{t:'Encontrá la forma de llegar a las celdas.',h:'El pasillo del medio está inundado. En las calderas hay válvulas; los valores están en una página del manual, en el depósito (arriba a la derecha).'};
    const f=['fusible1','fusible2','fusible3'].filter(x=>hasItem(x)||has('luz')).length;
    if(!has('luz')&&f<3)return{t:`Juntá los 3 fusibles (${f}/3).`,h:'Uno está en la bodega, otro en el lavadero y el último en la celda de castigo. La clave de la celda de castigo son las rayas de las celdas I, II y III, en ese orden.'};
    if(!has('luz'))return{t:'Poné los fusibles en la caja de la sala de calderas.',h:'La caja de fusibles está en la pared de arriba de la sala de calderas.'};
    return{t:'Bajá a las catacumbas por la reja grande del fondo.',h:'La reja está en el salón de abajo de todo del sótano. Llevá botellas: hacen ruido lejos de vos.'};
  }
  // capítulo 1
  if(!has('caso_cerrado')){
    const n=casoN();
    let h='Compará las pistas: cómo murió y qué arma falta; de quién es el rastro junto al cuerpo; qué coartada no se sostiene; qué hay en cada escondite. Cuando estés seguro, usá el teléfono del hall.';
    if(n<3)h='Empezá por la biblioteca (a la izquierda del hall): el cuerpo, el reloj y el piso cerca del escritorio.';
    else if(!hasItem('llave_jardin')&&!has('u_jardin'))h='Hay lugares a los que todavía no podés entrar. La llave de la puerta trasera de la cocina está en la cocina misma.';
    else if(!has('u_estudio'))h='El estudio del Conde (arriba) tiene un candado de 4 números. Una mitad está en una nota en la cocina; la otra, detrás de un cuadro del pasillo de arriba.';
    else if(!has('u_cobertizo'))h='El cobertizo del jardín tiene candado. Tomás guarda las cosas entre sus plantas, en el invernadero.';
    else if(!has('u_piano'))h='La partitura del cuarto de Clara dice que abre algo escondido en el piano del salón. Tocá esas notas en ese orden.';
    else if(!has('u_vestidor'))h='La llave dorada del piano abre el vestidor de Elena (al lado de su cuarto, arriba).';
    return{t:`Resolvé el asesinato: quién, con qué y por qué. Pistas del caso: ${n}/${TOTAL_CASO}.`,h};
  }
  if(!hasItem('llave_hierro'))return{t:'El cuerpo desapareció. Abrí la caja fuerte del estudio.',h:'El diario del Conde dice que la combinación es el día y el mes de su boda (DDMM). Elena lo escribió en su diario, dentro de su vestidor.'};
  return{t:'Bajá al sótano. La puerta está en el hall, junto a la escalera.',h:'Es la puerta de hierro arriba a la izquierda del hall. Las marcas de sangre llevan hasta ahí.'};
}
function clueTitle(id){const c=CASECLUES.find(x=>x.id===id);return c?c.t:''}
let CASECLUES=[];

/* ---------- disparadores por zona (una sola vez) ---------- */
const TRIGGERS=[
  {id:'tBib',a:'pb',r:[1,1,13,10],run(){relampago();setTimeout(()=>{sfx('susurro',-.4);susurro('...todavía está caliente...')},700)}},
  {id:'tP1',a:'p1',r:[1,10,38,12],run(){for(let i=0;i<8;i++)setTimeout(()=>sfx('pasoAjeno',.6-i*.15,1.3),i*230);setTimeout(()=>susurro('...arriba no hay nada...'),2200)}},
  {id:'tCuna',a:'p1',r:[30,14,38,22],run(){sfx('cajaMusica');setTimeout(()=>sfx('llanto',.3),4000)}},
  {id:'tCunaSal',a:'p1',r:[30,10,38,12],c:()=>has('tCuna'),run(){sfx('portazo',.4);sfx('risa',.6)}},
  {id:'tJd',a:'jd',r:[1,1,38,26],run(){setTimeout(()=>susurro('...no mires el pozo...'),1500)}},
  {id:'tBano',a:'p1',r:[11,1,17,8],run(){sfx('goteo',.2);setTimeout(()=>sfx('golpes',-.5),1800)}},
  {id:'tDesp',a:'pb',r:[26,21,38,24],c:()=>has('m1'),run(){sfx('arrastre',.5);setTimeout(()=>scare('sinrostro'),1400)}},
  {id:'tCeldas',a:'so',r:[26,11,38,19],run(){susurro('...sacame de acá...');sfx('golpes',.3)}},
  {id:'tCald',a:'so',r:[1,11,14,19],run(){sfx('chillido',-.5);setTimeout(()=>sfx('arrastre',.5),900)}},
  {id:'tAcceso',a:'so',r:[1,21,38,26],run(){sfx('golpes',0);setTimeout(()=>susurro('...ya te escuchó...'),1500)}},
  {id:'tCata',a:'ca',r:[0,0,41,6],run(){cartel('','No corras. No grites. Escuchá.',3500)}},
  {id:'tCata2',a:'ca',r:[0,14,41,31],run(){sfx('risa',-.6);setTimeout(()=>{if(G.area==='ca')scare('cosa')},3000)}},
  {id:'tCripta',a:'ce',r:[16,11,27,16],run(){sfx('golpes',-.3);setTimeout(()=>sfx('golpes',.3),900)}},
  {id:'tCapilla',a:'cp',r:[1,1,20,22],run(){sfx('stinger');setTimeout(()=>susurro('...¿sos vos? ¿viniste?...'),1200)}},
  {id:'tSacristia',a:'cp',r:[22,1,28,8],run(){sfx('portazo',-.2);noviaCerca(4)}},
];
/* ---------- eventos por condiciones (una sola vez) ---------- */
const EVENTS=[
  {id:'ev_m1',w:()=>!has('m1')&&casoN()>=7&&AREAS[G.area].ch===1,run(){
    apagon(3500);sfx('telefono');setTimeout(()=>sfx('telefono'),1200);
    setTimeout(()=>{cartel('Medianoche','Algo despertó en la casa',4000);sfx('stinger');setF('m1');spawnMonster('sinrostro',{lejos:true});susurro('...ya llegó...')},2600)}},
  {id:'ev_cierre',w:()=>has('caso_cerrado'),run(){
    apagon(4000);setTimeout(()=>{sfx('grito');setF('cuerpoIdo');cartel('','El cuerpo del Conde desapareció',4000);
      setTimeout(()=>say('',['Cuando vuelven las luces, la casa está en silencio. No hay nadie. Ni Berta, ni Tomás, ni Clara, ni el doctor, ni Elena.','En la biblioteca, el cuerpo del Conde ya no está. Solo dos surcos de sangre que se arrastran hacia el hall.','Cuarenta años. Ya vino a cobrar.']),3000);
      if(!monster)spawnMonster('sinrostro',{lejos:true});},1800)}},
  {id:'ev_ch2',w:()=>G.area==='so',run(){
    sfx('portazo',0);ambiente('sotano');cartel('Capítulo II','Lo que hay debajo',5000);
    setTimeout(()=>say('',['La puerta de arriba se cierra de un golpe. Escuchás el cerrojo del otro lado.','Algo, muy abajo, deja de moverse. Como si estuviera escuchando.']),2500);
    despawnMonster();setTimeout(()=>{if(AREAS[G.area].ch===2)spawnMonster('cosa',{lejos:true})},25000);checkpoint()}},
  {id:'ev_drenado',w:()=>has('drenado'),run(){for(let y=0;y<AREAS.so.h;y++)for(let x=0;x<AREAS.so.w;x++)if(AREAS.so.grid[y][x]==='v')AREAS.so.grid[y][x]='u';AREAS.so.dirty=true;sfx('agua');
    say('',['Un rugido de cañerías. El agua del pasillo empieza a bajar, girando, tragada por las rejillas.','Cuando se vacía del todo, en el barro quedan huellas. Huellas de manos. Muchas. Van hacia las celdas.'])}},
  {id:'ev_luz',w:()=>has('luz'),run(){
    sfx('electricidad');apagon(900);
    setTimeout(()=>{cartel('','Volvió la luz',2500);sfx('stinger');
      if(monster)despawnMonster();spawnMonster('cosa',{cerca:6});alertarMonstruo(P.x,P.y,40);
      setTimeout(()=>susurro('...¡NO CORRAS!... ¡TIRÁ ALGO!...'),600);checkpoint()},1200)}},
  {id:'ev_ch3',w:()=>G.area==='ce',run(){despawnMonster();ambiente('cementerio');cartel('Capítulo III','La Novia de Sombranegra',5000);
    setTimeout(()=>say('',['Salís del mausoleo a un cementerio envuelto en niebla. Las lápidas están torcidas, como si algo hubiera empujado desde abajo.','A lo lejos, una capilla. Más cerca, el campanario. Y en algún lado, alguien llora con un vestido blanco.']),2500);checkpoint()}},
  {id:'ev_novia',w:()=>has('novia'),run(){scare('novia',()=>{spawnMonster('novia',{cerca:7});cartel('','Alumbrala. No dejes de alumbrarla.',4000)})}},
  {id:'ev_quemado',w:()=>has('quemado'),run(){
    unlockTile('ce',43,16);sfx('grito');apagon(1200);
    setTimeout(()=>{cartel('','¡CORRÉ!',3000);despawnMonster();G.furia=true;if(G.area==='cp')spawnMonster('novia',{cerca:5});else spawnMonster('novia',{cerca:8});checkpoint()},1300)}},
];
