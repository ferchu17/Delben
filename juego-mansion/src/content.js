/* =====================================================================
   CONTENIDO: el caso sorteado, las áreas, las pistas, los documentos
   ===================================================================== */
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const NOTAS=[{n:'DO',f:262},{n:'RE',f:294},{n:'MI',f:330},{n:'FA',f:349},{n:'SOL',f:392},{n:'LA',f:440},{n:'SI',f:494}];
const ANCESTROS=['Aurelio','Bartolomé','Casimiro','Desiderio'];

const SUS=[
  {id:'berta',nombre:'Berta',rol:'la cocinera',look:{coat:'#2a2e44',skin:'#e2bf9c',hair:'#8a8a92',hairT:'bun',hat:'cap',apron:true},
    pos:['pb',35,17],motivo:'Vengar a su hijo',
    talk:['(Tiene los ojos rojos y las manos blancas de harina.) Detective... yo encontré al señor. Tirado ahí, con los ojos abiertos.',
      'Estuve en la cocina toda la noche, amasando el pan de mañana. No me moví de acá.',
      'La señora Elena no derramó ni una lágrima. Y la vi esconder una carta en el tocador de su cuarto.'],
    coart:'Dice que estuvo en la cocina toda la noche, amasando pan.',
    corr:'El horno todavía está tibio. En la libreta de Berta: "{T} — saqué la segunda tanda". Hay pan recién hecho. Estuvo acá.',
    contr:'El horno está frío desde hace horas. La libreta de Berta dice "pan listo, 22:30" y después nada. A las {T} la cocina estaba vacía. Berta mintió.',
    coartPos:['pb',31,13],coartLabel:'Examinar el horno',
    rastroEsc:'En la alfombra, junto al cuerpo, hay huellas blancas de harina. Mucha más de la que se pega a una suela por accidente.',
    rastroPropio:'Una bolsa de harina abierta junto a la mesa. Berta tiene el delantal y los zapatos blancos de harina.',
    rastroPos:['pb',28,18],rastroLabel:'Examinar la bolsa de harina',
    escPos:['pb',33,23],escLabel:'Revisar las bolsas de la despensa',escLugar:'entre las bolsas de papas de la despensa',
    escNada:'Bolsas de papas y cebollas. Huele a humedad y a tierra. Debajo de todo, nada.',
    motPos:['pb',27,23],motLabel:'Revisar el delantal colgado',motTit:'Carta en el delantal de Berta',
    motTxt:'Mamá:\n\nEl Conde me echó como a un perro y me acusó de robarle. Ahora nadie me da trabajo en todo el pueblo. Me voy lejos. No me busques.\n\nNunca le perdones lo que me hizo.\n\n— Julián'},
  {id:'tomas',nombre:'Tomás',rol:'el jardinero',look:{coat:'#33482a',skin:'#c2946a',hair:'#3a2818',hairT:'short',hat:'straw'},
    pos:['jd',30,8],motivo:'No perder su casa',
    talk:['(No te mira a los ojos. Tiene las manos lastimadas.) Yo no entro a la casa grande. Nunca. No me gusta lo que hay abajo.',
      'Estuve acá, en el invernadero, tapando los rosales para que el granizo no los destroce.',
      'El doctor venía todas las semanas. Llegaba con la valija liviana y se iba con la valija pesada. Usted sabrá.'],
    coart:'Dice que estuvo en el invernadero tapando los rosales.',
    corr:'Las lonas sobre los rosales están empapadas por dentro y atadas con nudos de marinero: las pusieron en plena tormenta, cerca de las {T}. Tomás dice la verdad.',
    contr:'Los rosales están destrozados por el granizo, sin tapar. Las lonas siguen dobladas y secas en un rincón. Tomás no estuvo acá a las {T}.',
    coartPos:['jd',27,7],coartLabel:'Examinar los rosales',
    rastroEsc:'Barro con pétalos de rosa roja aplastados, junto al cuerpo. Rosas de las que solo crecen en el invernadero.',
    rastroPropio:'Los rosales rojos del invernadero. Tomás tiene los dedos lastimados por las espinas y las botas llenas de barro con pétalos.',
    rastroPos:['jd',33,8],rastroLabel:'Examinar las rosas rojas',
    escPos:['jd',9,24],escLabel:'Levantar la lona del rincón',escLugar:'debajo de una lona, en el cobertizo',
    escNada:'Herramientas oxidadas, macetas rotas y un frasco lleno de ojos de vidrio de muñeca. Raro. Pero no es un arma.',
    motPos:['jd',25,11],motLabel:'Leer el papel clavado en la mesa',motTit:'Notificación del escribano',
    motTxt:'Por disposición del Conde Ulrico Sombranegra, se procederá a la venta del jardín y a la demolición de la casa del jardinero el día 1° del mes próximo.\n\nEl ocupante, Tomás Ferreyra, deberá desalojar sin derecho a reclamo alguno.'},
  {id:'clara',nombre:'Clara',rol:'la sobrina',look:{coat:'#5a2048',skin:'#efcdb2',hair:'#d8b250',hairT:'long'},
    pos:['p1',4,7],motivo:'Quedarse con la herencia',
    talk:['(Está sentada en el piso, abrazada a las rodillas.) ¿Usted también los escucha? Los pasos. Arriba. No hay nada arriba de este piso.',
      'Estuve en mi cuarto con la puerta cerrada, escuchando discos. No escuché nada, ¡nada!',
      'Berta odiaba a mi tío. Desde lo de su hijo Julián ya ni le hablaba.'],
    coart:'Dice que estuvo en su cuarto escuchando discos.',
    corr:'El tocadiscos sigue caliente y la púa gira en el surco final. Al lado, una lista con la hora de cada disco: el de las {T} está tachado como escuchado. Estuvo acá.',
    contr:'El tocadiscos está frío y el disco tiene una capa de polvo. Nadie lo puso esta noche. Clara mintió sobre dónde estaba a las {T}.',
    coartPos:['p1',3,1],coartLabel:'Examinar el tocadiscos',
    rastroEsc:'Un cabello largo y rubio enganchado en el puño del Conde. Y en el aire, un olor dulzón a jazmín.',
    rastroPropio:'Un frasco de perfume de jazmín sobre la cómoda de Clara, casi vacío. En el cepillo, cabellos rubios largos.',
    rastroPos:['p1',1,3],rastroLabel:'Examinar la cómoda',
    escPos:['p1',8,2],escLabel:'Mirar debajo de la cama',escLugar:'debajo de la cama de Clara',
    escNada:'Una caja de lata con cartas de amor de un chico del pueblo. Y una muñeca sin ojos. Nada más.',
    motPos:['p1',2,8],motLabel:'Revisar los papeles del escritorio',motTit:'Copia del testamento',
    motTxt:'Yo, Ulrico Sombranegra, en pleno uso de mis facultades, dejo la totalidad de mis bienes a mi sobrina Clara.\n\nElla deberá residir en esta casa hasta el día de su muerte y cumplir con las obligaciones de la familia, como las cumplimos todos.'},
  {id:'vidal',nombre:'Doctor Vidal',rol:'el médico',look:{coat:'#1e2030',skin:'#dcb490',hair:'#a8a8b0',hairT:'short',glasses:true},
    pos:['pb',22,9],motivo:'Que no lo denunciaran por robo',
    talk:['Soy el médico de la familia. Certifiqué la muerte. Y le aconsejo que no se quede mucho tiempo en esta casa.',
      'Estuve en el cuarto de huéspedes, arriba, escribiendo informes de mis pacientes. Trabajo hasta tarde.',
      'Clara hereda todo, ¿sabía? Una fortuna así le cambia la cara a cualquiera.'],
    coart:'Dice que estuvo en el cuarto de huéspedes escribiendo informes.',
    corr:'Sobre el escritorio, informes médicos con la hora de cada uno. El último dice "{T}" y la tinta todavía mancha el dedo. Estuvo acá.',
    contr:'Los informes del doctor terminan a las 22:00. La tinta de la última hoja está seca hace horas y la silla está fría. A las {T} no estaba acá.',
    coartPos:['p1',33,4],coartLabel:'Examinar el escritorio',
    rastroEsc:'Un polvo fino y blanco en el cuello del Conde: talco. Del que traen por dentro los guantes de látex.',
    rastroPropio:'Una caja de guantes de látex del doctor, abierta. Falta un par. Tienen talco por dentro.',
    rastroPos:['p1',31,7],rastroLabel:'Examinar la caja del doctor',
    escPos:['p1',37,5],escLabel:'Abrir el maletín',escLugar:'en el maletín del doctor',
    escNada:'Jeringas, frascos con nombres en latín y un estetoscopio. Todo ordenado. Demasiado ordenado.',
    motPos:['p1',34,1],motLabel:'Leer la carta sobre la cama',motTit:'Carta del Conde, sin enviar',
    motTxt:'Señor Comisario:\n\nMañana a primera hora iré a verlo. El Doctor Vidal me ha robado durante meses: falsificó recetas y vendió los remedios de mi difunta madre.\n\nTengo las pruebas.\n\n— U. S.'},
  {id:'elena',nombre:'Elena',rol:'la viuda',look:{coat:'#141018',skin:'#e8d0c0',hair:'#1a1010',hairT:'long'},
    pos:['pb',11,22],motivo:'Escapar con su amante',
    talk:['(Viste de negro, como si ya lo supiera de antes.) Veinte años casada con él. Veinte años en esta casa. ¿Sabe lo que es eso?',
      'Estuve en el salón, frente a la chimenea, leyendo. Ulrico no me dejaba subir sin él.',
      'Ayer Tomás le gritó a mi marido. Algo de un papel del escribano. Lo escuchó toda la casa.'],
    coart:'Dice que estuvo en el salón leyendo frente a la chimenea.',
    corr:'En la chimenea hay brasas rojas: alguien la alimentó toda la noche. Al lado, un libro abierto y una taza de té todavía tibia. Elena estuvo acá.',
    contr:'La chimenea del salón está apagada y fría desde la tarde. El libro tiene el señalador en la página 3. Elena no estuvo leyendo acá a las {T}.',
    coartPos:['pb',6,23],coartLabel:'Examinar la chimenea',
    rastroEsc:'Debajo del escritorio brilla algo: una perla, con un pedacito de gancho de oro roto.',
    rastroPropio:'El joyero de Elena. Los pendientes de perla están, pero a uno le falta la perla: el gancho está roto.',
    rastroPos:['p1',7,15],rastroLabel:'Abrir el joyero',
    escPos:['p1',18,16],escLabel:'Revisar entre los vestidos',escLugar:'entre los vestidos del vestidor de Elena',
    escNada:'Vestidos negros, sombreros con velo, cajas de zapatos. Un olor dulce y rancio. Nada más.',
    motPos:['p1',5,15],motLabel:'Revisar el tocador',motTit:'Carta escondida en el tocador',
    motTxt:'Mi amor:\n\nAguantá un poco más. Cuando él ya no esté, nos vamos lejos y nadie nos va a separar nunca.\n\nQuemá esta carta.\n\n— A.'},
];
const ARMAS=[
  {id:'veneno',nombre:'Veneno',forense:'Labios azules, uñas violetas. Junto a la mano, una copa con restos de vino que huele a almendras amargas. Lo envenenaron.',
    pos:['pb',30,23],label:'Examinar el estante del veneno',presente:'Un frasco de veneno para ratas, lleno hasta arriba y cubierto de polvo. Nadie lo tocó.',
    falta:'En el estante donde se guarda el veneno para ratas hay un círculo limpio en el polvo. El frasco no está.',escondido:'el frasco de veneno para ratas, casi vacío, con la etiqueta rasgada'},
  {id:'candelabro',nombre:'Candelabro',forense:'Un golpe brutal en la nuca. Hay gotas de cera blanca pegadas al pelo, mezcladas con sangre.',
    pos:['pb',27,4],label:'Examinar los candelabros',presente:'Los dos candelabros de plata del comedor. Las velas están enteras y las bases, limpias.',
    falta:'En la mesa del comedor hay un solo candelabro. Debería haber dos: se ve la marca redonda en el mantel.',escondido:'el candelabro de plata del comedor, con la base pegajosa de sangre seca y cera'},
  {id:'cuchillo',nombre:'Cuchillo',forense:'Una sola herida, fina y profunda, debajo de las costillas. Quien lo hizo sabía exactamente dónde clavar.',
    pos:['pb',34,13],label:'Examinar el taco de cuchillos',presente:'El taco de cuchillos de Berta: están todos, limpios y afilados.',
    falta:'Al taco de cuchillos le falta el más largo. La ranura vacía tiene una mancha oscura.',escondido:'el cuchillo más largo de la cocina, envuelto en un repasador manchado de rojo'},
  {id:'soga',nombre:'Soga',forense:'Marcas moradas alrededor del cuello y fibras ásperas de cáñamo entre los dedos. Lo estrangularon por detrás.',
    pos:['jd',4,21],label:'Examinar el clavo de la soga',presente:'Un rollo de soga de cáñamo, completo, colgado de su clavo.',
    falta:'El clavo donde se cuelga la soga está vacío. En la pared quedó una marca más clara.',escondido:'un pedazo de soga de cáñamo, cortado, con pelos grises enganchados'},
  {id:'atizador',nombre:'Atizador',forense:'La sien hundida por un golpe. En la herida hay hollín negro, como de chimenea.',
    pos:['pb',8,23],label:'Examinar los utensilios de la chimenea',presente:'El atizador de la chimenea, colgado en su lugar, con hollín viejo.',
    falta:'El soporte de los utensilios de la chimenea tiene un gancho vacío: falta el atizador.',escondido:'el atizador de la chimenea, con la punta negra de hollín y sangre'},
];

/* ---------- sorteo del caso ---------- */
function makeCase(seed){
  const r=mulberry(seed);const pick=a=>a[Math.floor(r()*a.length)];
  const C={seed};
  C.culpa=pick(SUS).id;C.arma=pick(ARMAS).id;
  C.hora=pick(['23:10','23:25','23:40','23:55','00:15','00:35']);
  C.codEst=String(1000+Math.floor(r()*9000));
  const dia=1+Math.floor(r()*28),mes=Math.floor(r()*12);C.boda={dia,mes,code:String(dia).padStart(2,'0')+String(mes+1).padStart(2,'0')};
  C.melodia=[];for(let i=0;i<5;i++)C.melodia.push(Math.floor(r()*7));
  C.valv=[];for(let i=0;i<4;i++)C.valv.push(1+Math.floor(r()*5));
  C.marcas=[];for(let i=0;i<3;i++)C.marcas.push(2+Math.floor(r()*8));
  C.fundador=pick(ANCESTROS);
  // condes: año de muerte (ordenados por muerte en el tiempo, pero en el mapa se mezclan)
  let y=1820+Math.floor(r()*12);C.condes=[];
  const nombres=['Aurelio','Bartolomé','Casimiro','Desiderio'].sort(()=>r()-.5);
  for(let i=0;i<4;i++){const nac=y-(38+Math.floor(r()*30));C.condes.push({n:nombres[i],nac,muere:y});y+=18+Math.floor(r()*22)}
  C.codCripta=C.condes.map(c=>String(c.muere%10)).join('');
  C.himno=[];for(let i=0;i<5;i++)C.himno.push(Math.floor(r()*3));
  const objs=['anillo','reliquia','medallon','velo'];C.ritual=objs.slice().sort(()=>r()-.5);
  C.isabelMuere=1890+Math.floor(r()*20);
  return C;
}
const susById=id=>SUS.find(s=>s.id===id);
const armaById=id=>ARMAS.find(a=>a.id===id);
const fillT=(s)=>s.replace(/\{T\}/g,CASE.hora);
let CASE=null;

/* ---------- textos de pistas del caso (para la pestaña Caso) ---------- */
function caseClues(){
  const L=[];const cul=susById(CASE.culpa),ar=armaById(CASE.arma);
  L.push({id:'c_cuerpo',g:'La escena',t:'El cuerpo',x:()=>ar.forense});
  L.push({id:'c_reloj',g:'La escena',t:'El reloj',x:()=>`El reloj de pie cayó con el cuerpo. Las agujas quedaron clavadas: ${CASE.hora}. Esa es la hora del crimen.`});
  L.push({id:'c_rastro',g:'La escena',t:'Un rastro',x:()=>cul.rastroEsc});
  ARMAS.forEach(a=>L.push({id:'w_'+a.id,g:'Las armas posibles',t:a.nombre,x:()=>a.id===CASE.arma?a.falta:a.presente}));
  SUS.forEach(s=>{
    L.push({id:'t_'+s.id,g:s.nombre+', '+s.rol,t:'Testimonio',x:()=>s.coart});
    L.push({id:'a_'+s.id,g:s.nombre+', '+s.rol,t:'Coartada verificada',x:()=>fillT(s.id===CASE.culpa?s.contr:s.corr)});
    L.push({id:'r_'+s.id,g:s.nombre+', '+s.rol,t:'Sus cosas',x:()=>s.rastroPropio});
    L.push({id:'e_'+s.id,g:s.nombre+', '+s.rol,t:'Su escondite',x:()=>s.id===CASE.culpa?`Escondido ${s.escLugar}: ${ar.escondido}.`:s.escNada});
    L.push({id:'m_'+s.id,g:s.nombre+', '+s.rol,t:'Un motivo',x:()=>s.motTit+': '+s.motTxt.split('\n').filter(Boolean).slice(0,2).join(' ')});
  });
  return L;
}
const TOTAL_CASO=33;

/* ---------- documentos ---------- */
function DOCS(){
  const C=CASE;
  return{
    historia:{t:'Historia de la familia Sombranegra',x:'Un libro grueso, encuadernado en cuero.\n\n"La familia Sombranegra llegó a estas tierras en 1790 con una fortuna que nadie supo explicar. El primer Conde mandó a construir la casa encima de una cueva que los indios llamaban la Boca.\n\nDicen que el Conde bajó a la Boca con una vela y volvió a subir sin ella, con el pelo blanco y un contrato firmado.\n\nDesde entonces, cada cuarenta años..."\n\nEl resto del capítulo está arrancado.'},
    lista:{t:'Lista de invitados a la cena',x:'Cena del 16.\nUlrico (cabecera). Elena. Clara. Dr. Vidal.\nSirve: Berta. Tomás no está invitado.\n\nAl margen, con otra letra, temblorosa:\n"Cuarenta años. Ya es la hora. Él viene a cobrar."',mano:false},
    notaCocina:{t:'Nota pegada en la alacena',x:`Berta:\nSi me pasa algo, la verdad está en mi estudio. Le puse un candado con dos mitades.\n\nLa primera mitad es esta: ${C.codEst.slice(0,2)}\n\nLa segunda la guarda mi abuelo, que vigila el pasillo de arriba.\n\n— U.`,mano:true},
    retrato:{t:'Retrato del abuelo Desiderio',x:`Un hombre severo, de ojos completamente negros.\nDetrás del marco, rayado en la madera con algo filoso:\n\n${C.codEst.slice(2)}\n\nCuando volvés a colgar el cuadro, jurarías que los ojos ya no miran al mismo lugar.`},
    partitura:{t:'Partitura de Clara',x:`Una canción de cuna escrita a mano, con lápiz. Arriba dice:\n"La que tocaba mamá. Abre lo que papá escondió en el piano."\n\n${C.melodia.map(i=>NOTAS[i].n).join('  —  ')}`,mano:true},
    diarioConde:{t:'Diario del Conde Ulrico',x:`16 de octubre.\n\nCuarenta años exactos desde que mi padre me llevó al sótano y me mostró la puerta de abajo. Esta noche viene a cobrar. Siempre cobra en sangre de la familia.\n\nSi no le pago, se lleva a Clara.\n\nEscondí la llave del sótano en la caja fuerte. La combinación es el día y el mes de mi boda, como siempre: dos números para el día y dos para el mes. Elena nunca lo olvida; lo escribe cada año en su diario.\n\nQue Dios me perdone por lo que hay abajo. Ya no tiene cara. Ya no se parece a nada.`},
    planos:{t:'Planos viejos de la mansión',x:'Un plano amarillento, comido por la humedad. Debajo de la casa hay un sótano enorme, y debajo del sótano, pasillos que siguen hasta el cementerio familiar.\n\nAlguien escribió encima con tinta roja:\n\nCATACUMBAS. NO BAJAR SIN LUZ. NO CORRER. NO GRITAR.'},
    diarioElena:{t:'Diario de Elena',x:`Hoy se cumplen veinte años de mi boda con Ulrico, el ${C.boda.dia} de ${MESES[C.boda.mes]}. Veinte años en esta casa.\n\nVeinte años escuchando cosas que se arrastran debajo del piso por las noches. Ulrico dice que son las cañerías.\n\nUlrico miente. Anoche una de las cañerías dijo mi nombre.`,mano:true},
    espejo:{t:'El espejo del baño',x:'El vapor cubre el espejo, aunque nadie abrió el agua caliente.\nHay letras escritas con un dedo. Desde adentro del vidrio.\n\nNO ESTÁS SOLO EN ESTA CASA',mano:true},
    cuna:{t:'Cuaderno en la cuna',x:`Isabel Sombranegra, hermana menor del Conde, murió el día de su boda en ${C.isabelMuere}, vestida de blanco, en la capilla del cementerio. El novio no llegó nunca.\n\nLa enterraron con el vestido. Dicen que todavía lo busca.\nDicen que cuando la mirás, no se mueve.\nDicen que cuando dejás de mirarla, ya está al lado tuyo.`},
    cobertizo:{t:'Diario del jardinero anterior',x:'Día 3. Escucho golpes debajo del pozo.\n\nDía 9. Algo me llama por mi nombre desde el pozo. Tiene la voz de mi madre.\n\nDía 14. Lo vi en el pasillo de la casa grande. Alto. Vestido de negro. No tiene cara. Donde debería estar la cara hay piel lisa.\n\nDía 15. No tiene ojos, pero ve la luz. Si apagás la linterna tiene que estar muy cerca para encontrarte. No tiene orejas, pero escucha los pasos apurados.\n\nDía 16. Me escondí en el ropero. Pasó al lado. Respiraba.\n\n(La última página está pegada con algo oscuro.)',mano:true},
    notaHall:{t:'Nota arrugada en el piso del hall',x:'NO CORRAS SI NO TE VIO.\nSI TE VIO, CORRÉ Y METETE EN UN ROPERO O DEBAJO DE UNA CAMA.\nLA LUZ LO TRAE.\nY NO MIRES LOS CUADROS DE NOCHE.',mano:true},
    bodega:{t:'Registro de la bodega',x:'1891 — 40 botellas de tinto. 12 de blanco.\n1931 — 40 botellas de tinto. "Una para Él".\n1971 — 40 botellas. "Una para Él. Bajó a buscarla. Perdimos a Ramón."\n2011 — (vacío)\n\nAl pie, en letra apurada:\n"La cosa de abajo no ve. Es ciega. Se guía por el ruido. Si tirás una botella lejos, va hacia el ruido. Nunca corras cerca de ella."'},
    lavadero:{t:'Nota de la lavandera',x:'Señora Elena:\nRenuncio. No vuelvo a bajar al lavadero.\nLas sábanas se mueven solas. Ayer una tenía forma de persona. Respiraba.\nY en el desagüe se escucha algo que mastica.\n— Ofelia',mano:true},
    valvulas:{t:'Manual de la caldera (página suelta)',x:`PROCEDIMIENTO DE DRENAJE DEL PASILLO BAJO\n\nPara abrir la compuerta, ajustar las válvulas a la presión indicada:\n\n  Válvula 1 ........ ${C.valv[0]}\n  Válvula 2 ........ ${C.valv[1]}\n  Válvula 3 ........ ${C.valv[2]}\n  Válvula 4 ........ ${C.valv[3]}\n\nADVERTENCIA: una presión incorrecta produce un golpe de ariete muy ruidoso.`},
    prisionero:{t:'Diario del prisionero',x:`Me llamo Ramón Ibarra. Me encerraron acá abajo para que Él me encuentre primero y no busque a la familia.\n\nYa entendí cómo es. El trato lo hizo ${C.fundador}, el primero, el que llegó con la fortuna. Los demás solo pagaron. Por eso la Puerta de los Huesos solo se abre por la boca de ${C.fundador}.\n\nLa reliquia que dejo acá es un diente de Él. Se lo arranqué. Gritó como una mujer.\n\nSi alguien lee esto: la Novia del cementerio no es como las otras. Mientras la alumbres, no se mueve. Nunca dejes de alumbrarla.`},
    inscripcion:{t:'Inscripción en la piedra',x:'AQUÍ TERMINA LA CASA Y EMPIEZA LA BOCA.\nQUIEN BAJE SIN TRES PARTES NO VUELVE A SUBIR.\n\n(Debajo, alguien rayó: "el medallón se rompió en tres. están al fondo de los pasillos ciegos")'},
    huesos:{t:'Calavera con algo escrito',x:'Sobre la frente de una calavera, con tinta muy vieja:\n\n"Cuatro bocas. Una sola dice la verdad. Las otras muerden."'},
    cuidador:{t:'Libreta del cuidador del cementerio',x:'Reglas para el turno de noche:\n\n1. Si la ves de blanco entre las tumbas, alumbrala. Mientras la alumbres no se mueve.\n2. No te quedes sin pilas. NUNCA te quedes sin pilas.\n3. Si escuchás las campanas sin que nadie las toque, no salgas.\n4. La capilla solo se abre con el himno. El himno está en la hoja de la pared.\n\n(Las últimas reglas están tachadas y encima dice: "ya no sirve. ya me vio.")',mano:true},
    himno:{t:'Himno de la capilla',x:`Una hoja amarilla clavada en la pared. Abajo de la letra del himno, el orden de las campanas:\n\n${C.himno.map(i=>['GRAVE','MEDIA','AGUDA'][i]).join('  ·  ')}\n\n(Grave es la campana grande, aguda la chica.)`},
    libroCapilla:{t:'Libro de la capilla',x:`Registro parroquial.\n\n"La cripta de los Condes se abre con la última cifra del año en que murió cada uno de ellos, empezando por el que murió primero y terminando por el último."\n\nNotas al margen: los cuatro primeros Condes están enterrados en el cementerio, cada uno con su lápida. Isabel no; Isabel quedó afuera, sola, cerca del mausoleo.`},
    contrato:{t:'El contrato',x:`Un pergamino que está tibio, como si respirara.\n\n"Yo, ${C.fundador} Sombranegra, entrego la sangre de mi sangre a cambio de oro, cada cuarenta años, hasta que alguien devuelva lo que se dio, en este orden:\n\n${C.ritual.map((o,i)=>(i+1)+'. '+({anillo:'Lo que unió dos manos.',reliquia:'Lo que se le arrancó a la Boca.',medallon:'Lo que se rompió en tres.',velo:'Lo que cubrió el rostro de la novia.'})[o]).join('\n')}\n\nY que se enciendan las cuatro velas, y que este papel arda."`},
    final:{t:'',x:''},
  };
}
let DOC={};

/* ---------- áreas ---------- */
function buildAreas(){
  const AR={};
  const susPos=(id,k)=>susById(id)[k];
  // ===== PLANTA BAJA =====
  {const m=new MB(40,26,'#');
    m.room(1,1,13,10,'w');m.room(15,1,24,24,'m');m.room(26,1,38,10,'w');m.room(1,12,13,24,'w');m.room(26,12,38,19,'t');m.room(26,21,38,24,'s');
    m.pts([[14,6],[25,6],[14,18],[25,15],[32,11],[28,20]],'D');
    m.set(16,0,'L');m.set(19,25,'L');m.set(20,25,'L');m.set(39,15,'L');
    m.pts([[0,3],[0,7],[0,15],[0,20],[39,3],[39,7],[5,0],[9,0],[29,0],[34,0]],'W');
    m.hl(1,13,1,'B');m.pts([[1,9],[1,10],[2,10],[12,10],[13,10],[13,9]],'B');m.rect(5,4,7,5,'T');m.set(9,5,'C');m.set(13,3,'A');m.rect(4,7,9,8,'o');
    m.rect(18,1,21,2,'=');m.rect(18,3,21,23,'c');m.pts([[16,6],[23,6],[16,15],[23,15]],'O');m.set(24,11,'A');
    m.rect(28,4,36,5,'T');for(let x=28;x<=36;x+=2){m.set(x,3,'C');m.set(x,6,'C')}m.pts([[37,1],[38,1],[38,10]],'I');m.set(26,1,'A');
    m.rect(2,13,4,14,'P');m.rect(5,24,7,24,'Q');m.rect(10,12,13,12,'B');m.rect(3,16,10,20,'o');m.rect(4,16,8,16,'C');m.set(11,18,'C');m.set(1,23,'A');
    m.hl(26,38,12,'K');m.rect(30,12,31,12,'S');m.rect(31,16,33,17,'T');m.pts([[37,19],[38,19]],'R');m.set(26,19,'I');
    m.hl(29,38,24,'I');m.pts([[26,21],[27,21],[38,21],[38,22]],'X');m.set(36,21,'A');m.set(26,24,'R');
    AR.pb={id:'pb',nombre:'Mansión · Planta baja',ch:1,grid:m.g,w:40,h:26,floor:'w',pared:'#2a1c26',oscuro:.95,amb:'mansion',
      lights:[{x:6,y:4.3,r:85},{x:19.5,y:8,r:110},{x:19.5,y:17,r:110},{x:30,y:4.3,r:80,c:()=>CASE.arma!=='candelabro'||true},{x:34,y:4.3,r:80},
        {x:30.5,y:12.4,r:70,c:()=>CASE.culpa!=='berta',fuego:true},{x:6,y:24.2,r:120,c:()=>CASE.culpa!=='elena',fuego:true}],
      ents:[]};}
  // ===== PRIMER PISO =====
  {const m=new MB(40,24,'#');
    m.room(1,1,9,8,'p');m.room(11,1,17,8,'t');m.room(19,1,29,8,'c');m.room(31,1,38,8,'w');m.room(1,10,38,12,'c');
    m.room(1,14,14,22,'p');m.room(16,14,21,22,'w');m.room(23,14,28,22,'m');m.room(30,14,38,22,'w');
    m.pts([[5,9],[14,9],[34,9],[8,13],[25,13],[34,13]],'D');m.set(24,9,'L');m.set(15,18,'L');
    m.pts([[0,4],[0,18],[39,4],[39,18],[5,0],[23,0],[35,0],[5,23],[34,23]],'W');
    m.rect(24,18,27,22,'=');
    m.rect(6,1,7,3,'b');m.set(1,1,'A');m.set(9,1,'I');m.rect(3,4,6,6,'o');m.pts([[8,7],[9,7]],'T');
    m.rect(11,1,13,2,'U');m.pts([[17,1],[17,4]],'I');
    m.hl(19,26,1,'B');m.rect(22,3,25,4,'T');m.pts([[19,6],[29,6]],'C');m.set(29,1,'I');
    m.rect(36,1,38,2,'b');m.rect(31,4,32,5,'T');m.set(38,7,'A');
    m.set(1,12,'A');
    m.rect(10,14,13,16,'b');m.set(1,14,'A');m.set(6,14,'I');m.set(1,22,'I');m.rect(4,18,9,21,'o');
    m.pts([[16,14],[21,14],[16,22]],'A');m.set(21,22,'I');
    m.rect(36,15,37,16,'b');m.pts([[31,21],[38,21]],'X');m.set(30,14,'A');
    AR.p1={id:'p1',nombre:'Mansión · Primer piso',ch:1,grid:m.g,w:40,h:24,floor:'w',pared:'#2a1830',oscuro:.95,amb:'mansion',
      lights:[{x:6,y:10.3,r:80,parp:true},{x:16,y:10.3,r:80},{x:26,y:10.3,r:80,parp:true},{x:36,y:10.3,r:80},{x:24,y:3.3,r:70},{x:9,y:1.3,r:60},
        {x:31.5,y:4.3,r:60,c:()=>CASE.culpa!=='vidal'},{x:35,y:19,r:50,parp:true},{x:6,y:14.3,r:60}],
      ents:[]};}
  // ===== JARDÍN =====
  {const m=new MB(40,28,'g');
    m.hl(0,39,0,'F');m.hl(0,39,27,'F');m.vl(39,0,27,'F');m.vl(0,0,27,'#');m.set(0,14,'L');m.set(39,20,'L');
    m.hl(1,30,14,'r');m.vl(20,4,24,'r');m.vl(30,12,14,'r');m.vl(6,15,18,'r');m.hl(20,30,22,'r');m.hl(20,30,4,'r');
    m.box(23,2,37,12,'W','s');m.set(30,12,'D');m.rect(25,5,28,6,'H');m.rect(32,5,35,6,'H');m.rect(25,9,28,10,'H');m.rect(32,9,35,10,'H');m.set(36,3,'I');
    m.box(2,19,11,26,'#','w');m.set(6,19,'L');m.pts([[3,25],[10,20]],'X');m.rect(7,22,8,22,'T');m.set(10,25,'I');
    m.rect(12,7,13,8,'O');m.rect(31,21,32,22,'O');
    [[3,3],[8,4],[15,3],[4,9],[9,11],[16,18],[25,17],[35,16],[37,25],[14,24],[17,10],[26,25],[2,16],[13,20],[34,24]].forEach(([x,y])=>m.set(x,y,'Z'));
    m.hl(14,18,17,'H');m.vl(24,15,20,'H');m.hl(33,37,18,'H');
    AR.jd={id:'jd',nombre:'Jardín',ch:1,grid:m.g,w:40,h:28,floor:'g',pared:'#24202a',techo:'#0a0b0a',oscuro:.9,exterior:true,amb:'cementerio',lluvia:true,
      lights:[{x:10,y:13.3,r:90,farol:true},{x:22,y:13.3,r:90,farol:true},{x:30,y:7.3,r:90,c:()=>CASE.culpa!=='tomas',farol:true}],ents:[]};}
  // ===== SÓTANO =====
  {const m=new MB(40,28,'#');
    m.room(1,1,6,6,'s');m.rect(2,1,5,2,'=');m.room(1,8,38,9,'s');m.set(3,7,'D');
    m.room(8,1,18,6,'s');m.set(13,7,'D');for(let x=9;x<=17;x+=2){m.set(x,2,'R');m.set(x,4,'R')}
    m.room(20,1,28,6,'t');m.set(24,7,'D');m.pts([[21,2],[23,2],[25,2],[27,2]],'U');
    m.room(30,1,38,6,'s');m.set(34,7,'D');m.pts([[30,1],[31,1],[37,1],[38,1],[38,2],[32,4],[33,4],[36,5]],'X');
    m.room(1,11,14,19,'s');m.set(7,10,'D');m.rect(3,13,4,14,'M');m.rect(9,13,10,14,'M');m.set(1,19,'A');
    m.room(16,11,24,19,'v');m.set(20,10,'D');m.set(25,15,'D');
    m.room(26,11,38,19,'s');m.vl(30,11,15,'#');m.vl(34,11,15,'#');m.hl(26,38,15,'V');m.pts([[28,15],[32,15],[36,15]],'D');m.set(32,10,'L');
    m.vl(34,17,19,'#');m.hl(34,38,17,'#');m.set(34,18,'L');m.set(38,19,'J');
    m.room(1,21,38,26,'s');m.set(8,20,'D');m.set(20,27,'L');m.pts([[3,22],[5,22],[34,22],[36,22]],'N');m.pts([[10,26],[28,26],[2,26]],'J');m.set(38,26,'A');
    AR.so={id:'so',nombre:'Sótano',ch:2,grid:m.g,w:40,h:28,floor:'s',pared:'#26232a',ladrillo:true,oscuro:.975,amb:'sotano',
      lights:[{x:5,y:5,r:60,parp:true},
        ...[[3.5,4],[13,8.5],[24,8.5],[34,8.5],[7,16],[30,17.5],[20,24],[10,24],[30,24],[13,3],[24,4],[34,3]].map(([x,y])=>({x,y,r:100,c:()=>has('luz'),bombita:true}))],ents:[]};}
  // ===== CATACUMBAS (laberinto sorteado) =====
  {const W=41,H=31,m=new MB(W,H,'#');const r=mulberry(CASE.seed^0x9e3779b9);
    const CW=20,CH=15,vis=new Set(),st=[[10,0]];vis.add('10,0');m.set(21,1,'s');
    while(st.length){const [cx,cy]=st[st.length-1];const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[cx+dx,cy+dy,dx,dy]).filter(([x,y])=>x>=0&&y>=0&&x<CW&&y<CH&&!vis.has(x+','+y));
      if(!nb.length){st.pop();continue}const [nx,ny,dx,dy]=nb[Math.floor(r()*nb.length)];vis.add(nx+','+ny);m.set(2*cx+1+dx,2*cy+1+dy,'s');m.set(2*nx+1,2*ny+1,'s');st.push([nx,ny])}
    for(let i=0;i<70;i++){const x=1+Math.floor(r()*(W-2)),y=1+Math.floor(r()*(H-2));if(m.get(x,y)==='#'&&((m.get(x-1,y)==='s'&&m.get(x+1,y)==='s')||(m.get(x,y-1)==='s'&&m.get(x,y+1)==='s')))m.set(x,y,'s')}
    // callejones sin salida, ordenados por distancia a la entrada
    const dist={};const q=[[21,1]];dist['21,1']=0;while(q.length){const [x,y]=q.shift();[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const k=(x+dx)+','+(y+dy);if(m.get(x+dx,y+dy)!=='#'&&dist[k]===undefined){dist[k]=dist[x+','+y]+1;q.push([x+dx,y+dy])}})}
    const dead=[];for(let y=1;y<H-1;y+=2)for(let x=1;x<W-1;x+=2){if(m.get(x,y)==='#')continue;const n=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>m.get(x+dx,y+dy)!=='#').length;if(n===1&&!(x===21&&(y===1||y===H-2)))dead.push([x,y,dist[x+','+y]||0])}
    dead.sort((a,b)=>b[2]-a[2]);
    // piezas lejos y separadas entre sí
    const piezas=[];for(const d of dead){if(piezas.length>=3)break;if(piezas.every(p=>Math.abs(p[0]-d[0])+Math.abs(p[1]-d[1])>14))piezas.push(d)}
    while(piezas.length<3&&dead.length)piezas.push(dead[piezas.length]);
    const otros=dead.filter(d=>!piezas.includes(d));
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(m.get(x,y)==='s'&&r()<.14)m.set(x,y,'x');
    m.set(21,0,'=');m.set(21,H-1,'L');m.set(21,H-2,'s');
    AR.ca={id:'ca',nombre:'Catacumbas',ch:2,grid:m.g,w:W,h:H,floor:'s',pared:'#221f24',ladrillo:true,oscuro:.985,amb:'sotano',lights:[],ents:[],_piezas:piezas,_otros:otros};
    otros.slice(0,5).forEach(([x,y],i)=>AR.ca.lights.push({x,y,r:55,parp:true,vela:true}));}
  // ===== CEMENTERIO =====
  {const m=new MB(44,32,'g');
    m.hl(0,43,0,'F');m.hl(0,43,31,'F');m.vl(0,0,31,'F');m.vl(43,0,31,'F');m.set(43,16,'L');
    m.box(2,2,9,8,'#','s');m.set(5,8,'D');m.rect(3,3,4,3,'=');
    m.box(34,2,41,8,'#','w');m.set(37,8,'L');m.set(40,3,'b');m.set(40,4,'b');m.set(35,3,'T');m.set(40,7,'I');
    m.box(34,22,40,28,'#','s');m.set(37,22,'D');
    m.box(15,10,28,17,'#','s');m.set(21,17,'L');m.pts([[16,11],[18,11],[25,11],[27,11],[16,15],[27,15]],'N');
    m.box(16,25,27,31,'#');m.set(21,25,'L');m.set(22,25,'L');
    m.vl(5,9,20,'d');m.hl(5,40,20,'d');m.vl(21,18,24,'d');m.vl(37,9,21,'d');m.hl(10,37,9,'d');m.hl(29,42,16,'d');
    const reserved=(x,y)=>(x>=1&&x<=10&&y>=1&&y<=9)||(x>=33&&x<=42&&y>=1&&y<=9)||(x>=33&&x<=41&&y>=21&&y<=29)||(x>=14&&x<=29&&y>=9&&y<=18)||(x>=15&&x<=28&&y>=24)||(x>=7&&x<=11&&y>=13&&y<=17);
    for(let y=3;y<=28;y+=3)for(let x=12;x<=41;x+=3){if(!reserved(x,y)&&m.get(x,y)==='g')m.set(x,y,'G')}
    for(let y=11;y<=28;y+=3)for(let x=2;x<=12;x+=3){if(!reserved(x,y)&&m.get(x,y)==='g')m.set(x,y,'G')}
    m.set(9,15,'G');
    [[11,4],[30,5],[2,12],[13,27],[31,13],[41,12],[7,25],[40,30],[29,22],[12,18]].forEach(([x,y])=>{if(m.get(x,y)==='g')m.set(x,y,'Z')});
    AR.ce={id:'ce',nombre:'Cementerio de los Sombranegra',ch:3,grid:m.g,w:44,h:32,floor:'g',pared:'#25232a',ladrillo:true,techo:'#0a0b0c',oscuro:.94,exterior:true,niebla:true,amb:'cementerio',
      lights:[{x:5,y:10,r:80,farol:true},{x:21,y:23.3,r:90,farol:true},{x:37,y:10,r:80,farol:true,parp:true},{x:37,y:21,r:80,farol:true},{x:9,y:16.3,r:55,vela:true}],ents:[]};}
  // ===== CAPILLA =====
  {const m=new MB(30,24,'#');
    m.room(1,1,20,22,'s');m.rect(9,5,12,22,'c');m.room(22,1,28,8,'t');m.set(21,5,'D');
    m.rect(8,2,13,3,'Y');m.pts([[2,2],[19,2]],'O');
    for(let y=8;y<=18;y+=2){m.rect(3,y,8,y,'E');m.rect(13,y,18,y,'E')}
    m.pts([[1,10],[1,14],[20,12]],'A');m.set(10,23,'D');m.set(11,23,'D');
    m.pts([[22,1],[28,4]],'I');m.rect(24,5,26,5,'T');
    AR.cp={id:'cp',nombre:'Capilla',ch:3,grid:m.g,w:30,h:24,floor:'s',pared:'#2a2630',ladrillo:true,oscuro:.96,amb:'cementerio',
      lights:[{x:7,y:2,r:70,c:()=>has('vela1')},{x:14,y:2,r:70,c:()=>has('vela2')},{x:7,y:4,r:70,c:()=>has('vela3')},{x:14,y:4,r:70,c:()=>has('vela4')},{x:10.5,y:3,r:140,c:()=>has('quemado'),fuego:true}],ents:[]};}
  return AR;
}
