/* =====================================================================
   INTERFAZ: diálogos, paneles, acertijos, guardado, en línea y arranque
   ===================================================================== */
/* ---------- diálogo ---------- */
let dq=null;
function say(name,pages,cb){
  pages=(pages||[]).filter(p=>p!=null&&p!=='');if(!pages.length){cb&&cb();return}
  clearKeys();if(S.mode==='play'||S.mode==='dialog')S.mode='dialog';
  dq={name,pages,i:0,chars:0,cb};$('#dQuien').textContent=name||'';$('#dQuien').hidden=!name;$('#dTexto').textContent='';$('#opciones').innerHTML='';$('#dialogo').hidden=false;
}
function dialogTick(dt){const p=dq.pages[dq.i];if(dq.chars<p.length){dq.chars=Math.min(p.length,dq.chars+dt*70);$('#dTexto').textContent=p.slice(0,Math.floor(dq.chars))}}
function dialogAdvance(){
  if(!dq)return;const p=dq.pages[dq.i];
  if(dq.chars<p.length){dq.chars=p.length;$('#dTexto').textContent=p;return}
  dq.i++;
  if(dq.i>=dq.pages.length){$('#dialogo').hidden=true;const cb=dq.cb;dq=null;if(S.mode==='dialog')S.mode='play';cb&&cb()}
  else{dq.chars=0;$('#dTexto').textContent=''}
}
$('#dialogo').addEventListener('click',dialogAdvance);

/* ---------- avisos ---------- */
let toastT=null;function toast(m,ms){const t=$('#toast');t.textContent=m;t.classList.add('ver');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('ver'),ms||3000)}
let cartelT=null;function cartel(a,b,ms){$('#cartel1').textContent=a||'';$('#cartel2').textContent=b||'';$('#cartel').classList.add('ver');clearTimeout(cartelT);cartelT=setTimeout(()=>$('#cartel').classList.remove('ver'),ms||3000)}
let susT=null;function susurro(m){const s=$('#susurro');s.textContent=m;s.classList.add('ver');clearTimeout(susT);susT=setTimeout(()=>s.classList.remove('ver'),2600)}

/* ---------- paneles ---------- */
const PANELES=['#pDoc','#pDiario','#pTeclado','#pPiano','#pValv','#pElegir','#pAcusar','#pMenu','#pCodigo','#pCargar','#pOnline','#pAyuda'];
let panelCb=null;
function openPanel(id,cb){clearKeys();PANELES.forEach(p=>$(p).hidden=true);if(S.mode!=='panel')S.prevPanelMode=S.mode;S.mode='panel';$(id).hidden=false;panelCb=cb||null}
function closePanel(){PANELES.forEach(p=>$(p).hidden=true);if(S.mode==='panel')S.mode=S.prevPanelMode==='title'?'title':'play';const cb=panelCb;panelCb=null;cb&&cb()}
document.querySelectorAll('[data-cerrar]').forEach(b=>b.addEventListener('click',closePanel));

function readDoc(id,after){const d=DOC[id];if(!d)return;if(!G.docs.includes(id)){G.docs.push(id);dirtyNet=true;sfx('pista');save()}showPaper(d.t,d.x,d.mano,after)}
function showPaper(t,x,mano,after){$('#docTit').textContent=t;$('#docTxt').textContent=x;$('#docTxt').className='doc'+(mano?' mano':'');openPanel('#pDoc',after)}

/* ---------- teclado numérico ---------- */
let kp=null;
(()=>{const box=$('#kTec');['1','2','3','4','5','6','7','8','9','←','0','✓'].forEach(k=>{const b=document.createElement('button');b.textContent=k;b.setAttribute('aria-label',k==='←'?'borrar':k==='✓'?'probar':k);
  b.addEventListener('click',()=>k==='✓'?kpTry():kpPress(k==='←'?'borrar':k));box.appendChild(b)})})();
function openKeypad(o){kp={...o,code:''};$('#kTit').textContent=o.tit;$('#kSub').textContent=o.sub||'';$('#kMsj').textContent='';kpShow();openPanel('#pTeclado')}
function kpShow(){$('#kVisor').textContent=(kp.code+'_'.repeat(kp.len)).slice(0,kp.len)}
function kpPress(k){if(!kp)return;if(k==='borrar')kp.code=kp.code.slice(0,-1);else if(kp.code.length<kp.len)kp.code+=k;sfx('tecla');$('#kMsj').textContent='';kpShow()}
function kpTry(){if(!kp)return;if(kp.code.length<kp.len){$('#kMsj').textContent='Faltan números.';return}
  if(kp.ok(kp.code)){const d=kp.done;kp=null;closePanel();d&&d()}
  else{sfx('mal');ruido(P.x,P.y,5);$('#kMsj').textContent='No abre.';kp.code='';kpShow();const h=document.querySelector('#pTeclado .hoja');h.classList.remove('temblor');void h.offsetWidth;h.classList.add('temblor')}}
$('#kOk').addEventListener('click',kpTry);

/* ---------- piano ---------- */
let pianoSeq=[];
(()=>{const box=$('#pTeclas');NOTAS.forEach((n,i)=>{const b=document.createElement('button');b.textContent=n.n;b.addEventListener('pointerdown',e=>{e.preventDefault();pianoKey(i);b.classList.add('on');setTimeout(()=>b.classList.remove('on'),150)});box.appendChild(b)})})();
function openPiano(){pianoSeq=[];$('#pVisor').textContent='—';$('#pMsj').textContent='';openPanel('#pPiano')}
function pianoKey(i){sfx('nota',NOTAS[i].f);ruido(5.5*T,14.5*T,7);pianoSeq.push(i);$('#pVisor').textContent=pianoSeq.map(k=>NOTAS[k].n).join(' · ');
  if(pianoSeq.length===CASE.melodia.length){
    if(pianoSeq.every((v,k)=>v===CASE.melodia[k])){setTimeout(()=>{closePanel();setF('u_piano');setF('got:llave_pequena');giveItem('llave_pequena');
      say('',['La última nota queda vibrando más de lo normal. Con un clic, se abre una tapita escondida debajo del teclado.','Adentro hay una llave dorada, diminuta, con forma de nota musical.','Mientras la sacás, una tecla grave suena sola. Una vez. Muy despacio.'],()=>{sfx('nota',65)})},600)}
    else{setTimeout(()=>{sfx('mal');$('#pMsj').textContent='Esa no es la melodía. Algo arriba se movió con el ruido.';pianoSeq=[];$('#pVisor').textContent='—'},500)}}}
$('#pBorrar').addEventListener('click',()=>{pianoSeq=[];$('#pVisor').textContent='—';$('#pMsj').textContent=''});

/* ---------- válvulas ---------- */
let valv=[1,1,1,1];
(()=>{const box=$('#vDiales');for(let i=0;i<4;i++){const d=document.createElement('div');d.className='dial';const b=document.createElement('button');b.textContent='1';b.setAttribute('aria-label','Válvula '+(i+1));
  b.addEventListener('click',()=>{valv[i]=valv[i]%5+1;b.textContent=valv[i];sfx('valvula')});d.appendChild(b);const l=document.createElement('span');l.textContent='Válvula '+(i+1);d.appendChild(l);box.appendChild(d)}})();
function openValves(){$('#vMsj').textContent='';openPanel('#pValv')}
$('#vOk').addEventListener('click',()=>{
  if(valv.every((v,i)=>v===CASE.valv[i])){closePanel();setF('drenado');checkpoint()}
  else{sfx('estallido');ruido(P.x,P.y,30);$('#vMsj').textContent='¡BANG! La caldera golpea tan fuerte que tiembla todo el sótano. Si algo estaba durmiendo, ya no.';G.sanity-=8}});

/* ---------- elegir una opción ---------- */
let elegir=null;
function openChoice(o){elegir={...o,sel:null};$('#eTit').textContent=o.tit;$('#eSub').textContent=o.sub||'';$('#eMsj').textContent='';const c=$('#eCont');c.innerHTML='';
  const box=document.createElement('div');box.className='opc';o.opts.forEach((txt,i)=>{const b=document.createElement('button');b.textContent=txt;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{elegir.sel=i;[...box.children].forEach((x,j)=>x.setAttribute('aria-pressed',j===i?'true':'false'))});box.appendChild(b)});c.appendChild(box);
  elegir.mode='uno';openPanel('#pElegir')}
function openOrder(o){elegir={...o,ord:[]};$('#eTit').textContent=o.tit;$('#eSub').textContent=o.sub||'';$('#eMsj').textContent='';const c=$('#eCont');c.innerHTML='';
  const lista=document.createElement('div');lista.className='orden';const box=document.createElement('div');box.className='opc';
  const pintar=()=>{lista.innerHTML='';for(let i=0;i<o.items.length;i++){const s=document.createElement('div');s.className='slot';s.innerHTML=`<b>${i+1}</b><span>${elegir.ord[i]?esc(NOMBRE_OBJ[elegir.ord[i]]):'<i>vacío</i>'}</span>`;lista.appendChild(s)}
    [...box.children].forEach(b=>b.disabled=elegir.ord.includes(b.dataset.it))};
  o.items.forEach(it=>{const b=document.createElement('button');b.textContent=NOMBRE_OBJ[it];b.dataset.it=it;b.addEventListener('click',()=>{if(elegir.ord.length<o.items.length&&!elegir.ord.includes(it)){elegir.ord.push(it);pintar()}});box.appendChild(b)});
  const reset=document.createElement('button');reset.className='btn sec';reset.textContent='Sacar todo';reset.style.marginTop='8px';reset.addEventListener('click',()=>{elegir.ord=[];pintar()});
  c.appendChild(box);c.appendChild(lista);c.appendChild(reset);pintar();elegir.mode='orden';openPanel('#pElegir')}
$('#eOk').addEventListener('click',()=>{if(!elegir)return;
  if(elegir.mode==='uno'){if(elegir.sel===null){$('#eMsj').textContent='Elegí una.';return}const d=elegir.done,s=elegir.sel;elegir=null;closePanel();d(s)}
  else{if(elegir.ord.length<elegir.items.length){$('#eMsj').textContent='Faltan objetos.';return}const d=elegir.done,o=elegir.ord;elegir=null;closePanel();d(o)}});

/* ---------- acusación ---------- */
const acc=[null,null,null];
function openAccuse(){
  const mk=(id,arr,k)=>{const box=$(id);box.innerHTML='';arr.forEach((txt,i)=>{const b=document.createElement('button');b.textContent=txt;b.setAttribute('aria-pressed',acc[k]===i?'true':'false');
    b.addEventListener('click',()=>{acc[k]=i;[...box.children].forEach((x,j)=>x.setAttribute('aria-pressed',j===i?'true':'false'));$('#aOk').disabled=acc.includes(null)});box.appendChild(b)})};
  mk('#aQuien',SUS.map(s=>s.nombre+', '+s.rol),0);mk('#aArma',ARMAS.map(a=>a.nombre),1);mk('#aMot',SUS.map(s=>s.motivo),2);
  $('#aOk').disabled=acc.includes(null);$('#aMsj').textContent=G.intentos?`Te quedan ${3-G.intentos} intento${3-G.intentos===1?'':'s'}.`:(casoN()<16?'Ojo: todavía te faltan muchas pistas.':'');
  openPanel('#pAcusar');
}
$('#aOk').addEventListener('click',()=>{
  const ok=[SUS[acc[0]].id===CASE.culpa,ARMAS[acc[1]].id===CASE.arma,SUS[acc[2]].id===CASE.culpa].filter(Boolean).length;
  const cul=susById(CASE.culpa),ar=armaById(CASE.arma);
  const verdad=`${cul.nombre} (${cul.rol}) mató al Conde a las ${CASE.hora} con ${ar.nombre.toLowerCase()==='veneno'?'veneno':'el '+ar.nombre.toLowerCase()}. Su motivo: ${cul.motivo.toLowerCase()}. Mintió sobre dónde estaba y escondió el arma ${cul.escLugar}.`;
  if(ok===3){closePanel();setF('caso_resuelto');setF('caso_cerrado');sfx('stinger');
    say('Inspector (teléfono)',['...Muy bien, detective. Exactamente lo que sospechaba.',verdad,'Mañana a primera hora voy con dos agentes. Encierre a '+cul.nombre+' en algún cuarto y no se mueva de...','(La línea se corta. Y en el silencio, la casa entera cruje, como si algo enorme se estirara debajo del piso.)']);return}
  G.intentos++;sfx('mal');save();
  if(G.intentos>=3){closePanel();setF('caso_cerrado');say('Inspector (teléfono)',['...No, detective. Esto no cierra por ningún lado.','Le voy a decir lo que yo creo: '+verdad,'Pero sin pruebas firmes no puedo detener a nadie. Y para cuando llegue, ya va a ser tarde... (La línea se corta.)']);return}
  $('#aMsj').textContent=`El inspector no está convencido. Acertaste ${ok} de 3. Te quedan ${3-G.intentos} intento${3-G.intentos===1?'':'s'}.`;
});

/* ---------- diario ---------- */
let tabDiario='obj';
document.querySelectorAll('#dTabs button').forEach(b=>b.addEventListener('click',()=>{tabDiario=b.dataset.tab;renderDiario()}));
function openDiario(){if(S.mode!=='play')return;renderDiario();openPanel('#pDiario')}
function renderDiario(){
  document.querySelectorAll('#dTabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tabDiario?'true':'false'));
  const c=$('#dCont');c.innerHTML='';const add=h=>{const d=document.createElement('div');d.innerHTML=h;c.appendChild(d);return d};
  if(tabDiario==='obj'){const o=objetivo();
    add(`<h3>Objetivo</h3><p>${esc(o.t)}</p>`);
    if(G.diff!=='pesadilla'){const b=add('<button class="btn sec" id="bPista">Necesito una pista</button><div id="pistaTxt"></div>');b.querySelector('#bPista').addEventListener('click',()=>{const p=b.querySelector('#pistaTxt');p.className='pista-box';p.textContent=o.h})}
    else add('<p><i>Modo Pesadilla: sin pistas.</i></p>');
    add(`<h3>Estado</h3><p>Linterna: ${Math.round(G.battery)}% · Pilas de repuesto: ${G.pilas} · Botellas: ${G.botellas} · Cordura: ${Math.round(G.sanity)}%</p>`);
    if(G.pilas>0&&G.battery<90){const b=add('<button class="btn sec">Cambiar las pilas ahora</button>');b.querySelector('button').addEventListener('click',()=>{G.pilas--;G.battery=100;sfx('linterna');renderDiario()})}
    add(`<p>Tiempo jugado: ${fmtT(G.time)} · Pistas del caso: ${casoN()}/${TOTAL_CASO}</p>`);
  }else if(tabDiario==='caso'){
    add('<p>El caso de la muerte del Conde Ulrico. Las pistas se anotan solas cuando las examinás. Para acusar, usá el teléfono del hall de la planta baja.</p>');
    if(has('caso_cerrado'))add(`<p class="pista-box">${has('caso_resuelto')?'Caso resuelto.':'El caso quedó sin resolver.'}</p>`);
    const grupos={};CASECLUES.forEach(cl=>{(grupos[cl.g]=grupos[cl.g]||[]).push(cl)});
    for(const g in grupos){const ul=grupos[g].map(cl=>G.clues.includes(cl.id)?`<li class="rojo"><b>${esc(cl.t)}:</b> ${esc(cl.x())}</li>`:`<li class="falta">${esc(cl.t)}: sin descubrir</li>`).join('');add(`<div class="grupo"><h3>${esc(g)}</h3><ul>${ul}</ul></div>`)}
  }else if(tabDiario==='docs'){
    if(!G.docs.length)add('<p>Todavía no leíste ningún documento.</p>');
    const ul=document.createElement('ul');G.docs.forEach(id=>{const d=DOC[id];if(!d)return;const li=document.createElement('li');li.style.cursor='pointer';li.textContent=d.t;li.addEventListener('click',()=>{showPaper(d.t,d.x,d.mano,()=>openPanel('#pDiario'))});ul.appendChild(li)});c.appendChild(ul);
    const marcas=[0,1,2].filter(i=>has('vi_marcas'+i));if(marcas.length)add(`<h3>Anotado</h3><ul>${marcas.map(i=>`<li>Rayas en la celda ${['I','II','III'][i]}: ${CASE.marcas[i]}</li>`).join('')}</ul>`);
    const condes=CASE.condes.map((cd,i)=>has('vi_conde'+i)?`<li>${esc(cd.n)} Sombranegra: ${cd.nac} — ${cd.muere}</li>`:'').join('');if(condes)add(`<h3>Lápidas de los Condes</h3><ul>${condes}</ul>`);
  }else if(tabDiario==='inv'){
    if(!G.items.length)add('<p>No llevás nada importante.</p>');
    add('<ul>'+G.items.map(i=>`<li><b>${esc(ITEMS[i].n)}</b>: ${esc(ITEMS[i].d)}</li>`).join('')+'</ul>');
    add(`<p>Pilas de repuesto: ${G.pilas} · Botellas: ${G.botellas}</p>`);
  }else if(tabDiario==='mapa'){
    add(`<p>${esc(AREA.nombre)}: lo que ya recorriste. El punto rojo sos vos.</p>`);
    const cv2=document.createElement('canvas');cv2.className='mapa';const a=AREA,k=8;cv2.width=a.w*k;cv2.height=a.h*k;const c2=cv2.getContext('2d');const ex=EXPL[a.id]||new Uint8Array(a.w*a.h);
    for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++){if(!ex[y*a.w+x])continue;const ch=a.grid[y][x];c2.fillStyle=ch==='#'||ch==='W'?'#3a3242':ch==='L'?'#8e1b1b':ch==='D'?'#a08050':SOLID.has(ch)?'#2a2430':'#6a6272';c2.fillRect(x*k,y*k,k,k)}
    c2.fillStyle='#e02020';c2.beginPath();c2.arc(P.x/T*k,P.y/T*k,4,0,7);c2.fill();c.appendChild(cv2);
  }
}
function fmtT(s){s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return(h?h+'h ':'')+m+'m '+String(ss).padStart(2,'0')+'s'}

/* ---------- menú ---------- */
function openMenu(){if(S.mode!=='play')return;
  $('#mStats').innerHTML=`<span>Capítulo</span><span>${['','I','II','III'][AREA.ch]}</span><span>Tiempo jugado</span><span>${fmtT(G.time)}</span><span>Veces que te atrapó</span><span>${G.deaths}</span><span>Sustos</span><span>${G.sustos}</span><span>Dificultad</span><span>${G.diff==='pesadilla'?'Pesadilla':'Normal'}</span>`;
  openPanel('#pMenu')}
$('#mSonido').addEventListener('click',e=>{audioMute(!A.muted);e.currentTarget.textContent='Sonido: '+(A.muted?'no':'sí');lsSet('sn2_mute',A.muted?'1':'0')});
$('#mAyuda').addEventListener('click',()=>openPanel('#pAyuda',()=>openPanel('#pMenu')));
$('#mSalir').addEventListener('click',()=>{save();closePanel();salirAlMenu()});
$('#mCodigo').addEventListener('click',async()=>{save(true);$('#cExpl').textContent='Copiá este código y mandátelo (por WhatsApp, por mail, como quieras). En el otro aparato, abrí el juego y tocá "Cargar código" en la pantalla de inicio.';$('#cMsj').textContent='';$('#cTxt').value='Armando el código...';openPanel('#pCodigo',()=>openPanel('#pMenu'));$('#cTxt').value=await exportCode()});
$('#cCopiar').addEventListener('click',()=>{const t=$('#cTxt');const v=t.value;const ok=()=>$('#cMsj').textContent='Código copiado.';
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v).then(ok).catch(()=>{t.removeAttribute('readonly');t.select();try{document.execCommand('copy');ok()}catch(e){$('#cMsj').textContent='Seleccioná el texto y copialo a mano.'}t.setAttribute('readonly','')})}
  else{t.removeAttribute('readonly');t.select();try{document.execCommand('copy');ok()}catch(e){$('#cMsj').textContent='Seleccioná el texto y copialo a mano.'}t.setAttribute('readonly','')}});

/* ---------- HUD ---------- */
let hudT=0,hudObj='';
function updateHUD(force){
  hudT-=1/60;if(hudT>0&&!force)return;hudT=.25;
  $('#hArea').textContent=AREA.nombre;const o=objetivo().t;if(o!==hudObj){hudObj=o;$('#hObj').textContent=o}
  const bar=(id,v)=>{const el=$(id);el.querySelector('.lleno').style.width=clamp(v,0,100)+'%';el.classList.toggle('baja',v<20)};
  bar('#brLuz',G.linterna?G.battery:0);bar('#brCor',G.sanity);bar('#brAli',P.stamina);
  $('#brAli').hidden=P.stamina>=99.5;
  $('#hInv').textContent=`Pilas: ${G.pilas}`+(G.botellas||AREA.ch===2?` · Botellas: ${G.botellas}`:'')+(P.hidden?' · Escondido':'');
  $('#tBot').hidden=!(G.botellas>0);$('#tLuz').classList.toggle('on',G.linterna);
  $('#tAcc').classList.toggle('activo',!!S.near);$('#tAcc').textContent=S.near?(S.near.salir?'Salir':S.near.hide?'Esconder':'Acción'):'Acción';
}
let guardT=null;function flashGuard(t){const g=$('#hGuard');g.textContent=t;g.classList.add('ver');clearTimeout(guardT);guardT=setTimeout(()=>g.classList.remove('ver'),1800)}

/* =====================================================================
   GUARDADO (este aparato, nube de Claude y código para pasar)
   ===================================================================== */
let DB=null,UID=null,ROOMCAP=null,dirtyNet=false;
const slotKey=()=>G.mode==='online'?'sn2_on_'+G.code:'sn2_solo';
function serialize(){G.x=P.x;G.y=P.y;G.area=G.area;G.savedAt=Date.now();G.trig=[...S.trig];return JSON.stringify(G)}
let cloudBusy=false,cloudPend=null;
function save(quiet){
  if(!G||S.mode==='title'||S.mode==='end'||S.fadeDir)return;
  const json=serialize();lsSet(slotKey(),json);
  if(!quiet)flashGuard('Partida guardada');
  if(DB&&UID){cloudPend={k:slotKey(),json};cloudFlush()}
}
async function cloudFlush(){if(cloudBusy||!cloudPend)return;cloudBusy=true;const {k,json}=cloudPend;cloudPend=null;
  try{await DB.doc(`data/users/${UID}/${k}`).set({json,savedAt:Date.now()})}catch(e){}
  cloudBusy=false;if(cloudPend)cloudFlush()}
function valid(d){return d&&d.v===2&&Array.isArray(d.flags)&&typeof d.seed==='number'}
async function loadSlot(k){
  let best=null;try{const l=JSON.parse(lsGet(k)||'null');if(valid(l))best=l}catch(e){}
  if(DB&&UID){try{const s=await DB.doc(`data/users/${UID}/${k}`).get();if(s.exists){const d=JSON.parse(s.data().json);if(valid(d)&&(!best||(d.savedAt||0)>(best.savedAt||0)))best=d}}catch(e){}}
  return best;
}
function borrarSlot(k){lsSet(k,null);if(DB&&UID)DB.doc(`data/users/${UID}/${k}`).delete().catch(()=>{})}
async function perfil(){let p={completados:0,pesadilla:false,mejor:0};try{const l=JSON.parse(lsGet('sn2_perfil')||'null');if(l)p=l}catch(e){}
  if(DB&&UID){try{const s=await DB.doc(`data/users/${UID}/sn2_perfil`).get();if(s.exists){const d=s.data();if(d&&(d.completados||0)>=(p.completados||0))p={completados:d.completados||0,pesadilla:!!d.pesadilla,mejor:d.mejor||0}}}catch(e){}}return p}
async function guardarPerfil(p){lsSet('sn2_perfil',JSON.stringify(p));if(DB&&UID){try{await DB.doc(`data/users/${UID}/sn2_perfil`).set(p)}catch(e){}}}
/* código para pasar la partida */
function b64u(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
async function exportCode(){
  const g=JSON.parse(serialize());g.mode='solo';g.code=null;const txt=new TextEncoder().encode(JSON.stringify(g));
  try{if(window.CompressionStream){const cs=new Blob([txt]).stream().pipeThrough(new CompressionStream('deflate-raw'));const buf=new Uint8Array(await new Response(cs).arrayBuffer());return 'SN2:'+b64u(buf)}}catch(e){}
  return 'SN2J:'+b64u(txt);
}
async function importCode(code){
  code=String(code||'').trim().replace(/\s+/g,'');let bytes;
  if(code.startsWith('SN2:')){const u=unb64u(code.slice(4));const ds=new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'));bytes=new Uint8Array(await new Response(ds).arrayBuffer())}
  else if(code.startsWith('SN2J:'))bytes=unb64u(code.slice(5));else throw new Error('formato');
  const d=JSON.parse(new TextDecoder().decode(bytes));if(!valid(d))throw new Error('datos');return d;
}

/* =====================================================================
   EN LÍNEA
   ===================================================================== */
let NET=null;let netT=0;
const LOCAL_FLAG=/^(t[A-Z]|ev_|sus_|vi_|got:p_|got:b_)/;
function presencia(){
  return{n:G.nick||'Detective',c:G.color||0,a:G.area,x:Math.round(P.x),y:Math.round(P.y),fx:Math.round(P.fx*10)/10,fy:Math.round(P.fy*10)/10,m:P.moving?1:0,
    f:G.flags.filter(f=>!LOCAL_FLAG.test(f)).join('|'),i:G.items.join('|'),u:G.used.join('|'),d:G.docs.join('|'),k:G.clues.join('|'),tk:G.talked.join('|')}
}
function netTick(dt){if(!NET)return;netT-=dt;if(netT<=0){netT=.12;try{NET.send(presencia())}catch(e){}}}
function mergeRemote(pr,nick){
  if(!pr||!AREAS)return;let nuevo=false;const sp=s=>String(s||'').split('|').filter(x=>x&&x.length<48);
  sp(pr.f).forEach(f=>{if(LOCAL_FLAG.test(f)||FL.has(f))return;if(f.startsWith('open:')){const [,a,x,y]=f.split(':');if(!AREAS[a]||!AREAS[a].grid[+y])return;AREAS[a].grid[+y][+x]='D';AREAS[a].dirty=true}setF(f);nuevo=true});
  sp(pr.u).forEach(i=>{if(ITEMS[i]&&!G.used.includes(i)){useItem(i);nuevo=true}});
  sp(pr.i).forEach(i=>{if(ITEMS[i]&&!G.items.includes(i)&&!G.used.includes(i)){giveItem(i,true);nuevo=true}});
  sp(pr.d).forEach(d=>{if(DOC[d]&&!G.docs.includes(d)){G.docs.push(d);nuevo=true}});
  sp(pr.k).forEach(k=>{if(CASECLUES.some(c=>c.id===k)&&!G.clues.includes(k)){G.clues.push(k);nuevo=true}});
  sp(pr.tk).forEach(k=>{if(SUS.some(s=>s.id===k)&&!G.talked.includes(k)){G.talked.push(k);nuevo=true}});
  if(nuevo&&S.mode!=='title'){toast(`${nick} encontró algo nuevo. Ya está en tu diario.`);sfx('pista');save(true)}
}
function onPeersList(list){
  const seen=new Set();
  for(const {id,p} of list){if(!p||typeof p.x!=='number')continue;seen.add(id);const nick=String(p.n||'Detective').slice(0,14)||'Detective';
    let o=others.get(id);if(!o){o={x:p.x,y:p.y,walk:0};others.set(id,o);if(G&&S.mode!=='title')toast(`${nick} entró a la mansión.`)}
    o.tx=+p.x||0;o.ty=+p.y||0;o.area=String(p.a||'');o.nick=nick;o.c=Math.abs(p.c|0)%COATS.length;o.fx=clamp(+p.fx||0,-1,1);o.fy=clamp(+p.fy||1,-1,1);o.mv=!!p.m;
    if(o.area!==o.lastArea){o.x=o.tx;o.y=o.ty;o.lastArea=o.area}
    if(G&&S.mode!=='title')mergeRemote(p,nick)}
  for(const k of [...others.keys()])if(!seen.has(k)){const o=others.get(k);toast(`${o.nick} salió de la mansión.`);others.delete(k)}
  updateOnline();
}
function updateOthers(dt){others.forEach(o=>{const k=Math.min(1,dt*10);o.x+=(o.tx-o.x)*k;o.y+=(o.ty-o.y)*k;if(o.mv)o.walk+=dt*11})}
function updateOnline(){const h=$('#hOnline');if(!G||G.mode!=='online'){h.hidden=true;return}h.hidden=false;const n=others.size+1;h.textContent=`Sala ${G.code} · ${n} detective${n>1?'s':''}${NET?'':' (sin conexión)'}`}
async function conectar(code){
  if(ROOMCAP){
    const nr=await ROOMCAP.join('sombra-'+code);
    nr.onPeers(ch=>{onPeersList(ch.peers.filter(p=>!p.sameTab&&p.kind==='viewer').map(p=>({id:p.peer,p:p.presence})))},()=>{NET=null;toast('Se cortó la conexión con la sala. Seguís jugando solo.',4000);updateOnline()});
    return{send:p=>nr.presence(p).catch(()=>{}),leave:()=>nr.leave().catch(()=>{})};
  }
  return await peerConectar(code);
}
function cargarScript(src){return new Promise((ok,mal)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=mal;document.head.appendChild(s)})}
async function peerConectar(code){
  if(!window.Peer)await cargarScript('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js');
  const hostId='sombranegra2-'+code;let me=null,isHost=false,hostConn=null,conns=[],mine={},cerrado=false;const peers=new Map();
  const emitir=()=>onPeersList([...peers.entries()].map(([id,p])=>({id,p})));
  function host(){me=new Peer(hostId);me.on('open',()=>{isHost=true});
    me.on('connection',c=>{conns.push(c);c.on('data',d=>{if(d&&d.t==='p'&&d.p){peers.set(c.peer,d.p);emitir()}});c.on('close',()=>{peers.delete(c.peer);conns=conns.filter(x=>x!==c);emitir()})});
    me.on('error',e=>{if(e&&e.type==='unavailable-id'){try{me.destroy()}catch(x){}cliente()}})}
  function cliente(){me=new Peer();me.on('open',()=>{hostConn=me.connect(hostId);
      hostConn.on('data',d=>{if(d&&d.t==='all'){peers.clear();for(const k in d.p)if(k!==me.id)peers.set(k,d.p[k]);emitir()}});
      hostConn.on('close',()=>{if(cerrado)return;peers.clear();emitir();try{me.destroy()}catch(x){}setTimeout(host,500+rnd()*1500)})});
    me.on('error',e=>{if(e&&e.type==='peer-unavailable'){try{me.destroy()}catch(x){}setTimeout(host,300+rnd()*700)}})}
  host();
  const iv=setInterval(()=>{
    if(isHost){const all={};all[hostId]=mine;peers.forEach((p,k)=>all[k]=p);conns.forEach(c=>{try{c.open&&c.send({t:'all',p:all})}catch(e){}})}
    else if(hostConn&&hostConn.open){try{hostConn.send({t:'p',p:mine})}catch(e){}}
  },150);
  return{send:p=>{mine=p},leave:()=>{cerrado=true;clearInterval(iv);try{me&&me.destroy()}catch(e){}}};
}

/* =====================================================================
   PORTADA, INICIO Y FINAL
   ===================================================================== */
let savedSolo=null,confirmNueva=false,prof={completados:0,pesadilla:false,mejor:0};
async function refreshPortada(){
  savedSolo=await loadSlot('sn2_solo');prof=await perfil();
  const b=$('#bContinuar'),n=$('#bNueva');
  if(savedSolo){b.hidden=false;const ch=({pb:1,p1:1,jd:1,so:2,ca:2,ce:3,cp:3})[savedSolo.area]||1;b.textContent=`Continuar · Capítulo ${['','I','II','III'][ch]} · ${fmtT(savedSolo.time||0)}`;n.className='btn-menu'}
  else{b.hidden=true;n.className='btn-grande'}
  n.textContent='Nueva partida';confirmNueva=false;
  $('#bPesadilla').hidden=!prof.pesadilla;
  $('#notaNube').textContent=DB?'Tu partida se guarda sola en tu cuenta y en este aparato.':'La partida se guarda sola en este aparato. Para seguir en otro, usá "Pasar la partida" en el menú del juego.';
  if(prof.completados)$('#notaNube').textContent+=` Terminaste el juego ${prof.completados} ${prof.completados===1?'vez':'veces'}.`;
}
function startGame(state,nueva){
  audioInit();if(A.ctx&&A.ctx.state==='suspended')A.ctx.resume();
  G=state;['flags','items','used','docs','clues','talked','seen','campSeq'].forEach(k=>{if(!Array.isArray(G[k]))G[k]=[]});FL=new Set(G.flags);buildWorld();
  AREA=AREAS[G.area]||AREAS.pb;P.x=G.x;P.y=G.y;P.hidden=null;P.stamina=100;monster=null;G.mResp=has('m1')||has('cosa_on')||has('novia')?6:null;
  if(blocked(P.x,P.y,9)&&G.cp){P.x=G.cp.x;P.y=G.cp.y}
  renderStatic(AREA);ambiente(AREA.amb);
  $('#portada').hidden=true;$('#hud').hidden=false;if(tactil)$('#tactil').hidden=false;
  S.mode='play';S.fade=1;S.fadeDir=-1;S.lastScare=G.time;S.amb=20;
  updateHUD(true);updateOnline();
  if(nueva){
    setF('ch1');cartel('Capítulo I','La muerte del Conde',5000);
    setTimeout(()=>say('',['Octubre. Medianoche. La tormenta cortó el único camino al pueblo.','Te llamaron desde la Mansión Sombranegra: el Conde Ulrico apareció muerto en su biblioteca. En la casa hay cinco personas. Una de ellas lo mató.','El inspector no puede llegar hasta mañana. Hasta entonces, el caso es tuyo: revisá la escena, interrogá a todos y buscá el arma.','Cuando sepas quién fue, con qué y por qué, llamá al inspector desde el teléfono del hall.','Una última cosa. La cocinera te lo dijo en voz baja cuando entraste: "De noche, en esta casa, no camine sin luz".'],()=>{
      toast(tactil?'Mové con la rueda. Botones: Acción, Correr, Linterna. Diario arriba.':'WASD para moverte · Mouse apunta la linterna · E examinar · Shift correr · F linterna · Q diario',7000);save()}),1200);
  }else{cartel(AREA.nombre,'',2500);toast('Partida recuperada. '+objetivo().t,5000)}
}
async function nuevaPartida(diff){
  const seed=(Math.random()*4294967295)>>>0;borrarSlot('sn2_solo');
  const st=newState(seed,'solo',diff||'normal');st.nick=lsGet('sn2_nick')||'';startGame(st,true);
}
function salirAlMenu(){
  if(NET){NET.leave();NET=null}others.clear();despawnMonster();
  G=null;AREA=null;S.mode='title';$('#hud').hidden=true;$('#tactil').hidden=true;$('#dialogo').hidden=true;dq=null;PANELES.forEach(p=>$(p).hidden=true);$('#pFinal').hidden=true;
  $('#portada').hidden=false;ambiente('menu');refreshPortada();
}
async function terminar(){
  if(S.mode==='end')return;S.mode='end';despawnMonster();growlLevel(0);
  const t=G.time;prof.completados=(prof.completados||0)+1;prof.pesadilla=true;if(!prof.mejor||t<prof.mejor)prof.mejor=t;await guardarPerfil(prof);
  borrarSlot(slotKey());
  sfx('campana',196);
  const cul=susById(CASE.culpa);
  $('#fTit').textContent='Amanece';
  $('#fTxt').innerHTML=`<p>Cruzás el portón cuando el cielo empieza a ponerse gris. Detrás tuyo, la capilla arde sin hacer ruido.</p>
  <p>El contrato de ${esc(CASE.fundador)} Sombranegra es ceniza. La Boca, debajo de la casa, se cierra con un ruido de huesos. Por primera vez en doscientos años, nadie de la familia va a tener que pagar.</p>
  <p>${has('caso_resuelto')?`Y ${esc(cul.nombre)} va a responder por la muerte del Conde: lo resolviste.`:`Lo que nunca se supo fue quién mató al Conde. ${esc(cul.nombre)} se fue del pueblo esa misma semana.`}</p>
  <p style="margin-top:14px"><i>Tres días después suena tu teléfono. Una voz de nena, muy bajito: "Detective... la casa de al lado de la mansión también tiene sótano."</i></p>
  <p style="color:#8a8090;margin-top:14px">Continuará en el Capítulo IV.</p>`;
  $('#fStats').innerHTML=`<span>Tiempo total</span><span>${fmtT(t)}</span><span>Veces que te atrapó</span><span>${G.deaths}</span><span>Desmayos</span><span>${G.desmayos}</span><span>Sustos</span><span>${G.sustos}</span><span>Pistas del caso</span><span>${casoN()}/${TOTAL_CASO}</span><span>Caso</span><span>${has('caso_resuelto')?'Resuelto':'Sin resolver'}</span><span>Dificultad</span><span>${G.diff==='pesadilla'?'Pesadilla':'Normal'}</span><span>Juego creado por</span><span>Fernando Jacyno · 10/2026</span>`;
  const bt=$('#fBtns');bt.innerHTML='';
  const mk=(txt,fn,cls)=>{const b=document.createElement('button');b.className=cls||'btn';b.textContent=txt;b.addEventListener('click',fn);bt.appendChild(b)};
  mk('Menú principal',()=>{$('#pFinal').hidden=true;salirAlMenu()},'btn sec');
  mk('Modo Pesadilla (caso nuevo)',()=>{$('#pFinal').hidden=true;if(NET){NET.leave();NET=null}others.clear();nuevaPartida('pesadilla')});
  mk('Jugar otra vez (caso nuevo)',()=>{$('#pFinal').hidden=true;if(NET){NET.leave();NET=null}others.clear();nuevaPartida('normal')});
  S.fade=0;$('#pFinal').hidden=false;
}

/* ---------- botones de portada ---------- */
$('#bNueva').addEventListener('click',e=>{if(savedSolo&&!confirmNueva){confirmNueva=true;e.currentTarget.textContent='¿Seguro? Se borra la partida guardada. Tocá otra vez';return}nuevaPartida('normal')});
$('#bContinuar').addEventListener('click',()=>{if(savedSolo)startGame(savedSolo,false)});
$('#bPesadilla').addEventListener('click',()=>nuevaPartida('pesadilla'));
$('#bAyuda').addEventListener('click',()=>openPanel('#pAyuda'));
$('#bCargar').addEventListener('click',()=>{$('#lTxt').value='';$('#lMsj').textContent='';openPanel('#pCargar')});
$('#lOk').addEventListener('click',async()=>{try{const d=await importCode($('#lTxt').value);d.mode='solo';d.code=null;lsSet('sn2_solo',JSON.stringify(d));closePanel();startGame(d,false)}catch(e){$('#lMsj').textContent='Ese código no sirve. Fijate de copiarlo completo, desde "SN2" hasta el final.'}});
$('#bOnline').addEventListener('click',()=>{$('#oApodo').value=lsGet('sn2_nick')||'';$('#oMsj').textContent='';openPanel('#pOnline')});
function nuevoCodigo(){const a='abcdefghjkmnpqrstuvwxyz23456789';let s='';for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
async function online(code){
  const msj=$('#oMsj');const nick=($('#oApodo').value.trim()||'Detective').slice(0,14);lsSet('sn2_nick',nick);
  code=String(code||'').trim().toLowerCase();if(!/^[a-z0-9]{3,6}$/.test(code)){msj.textContent='Escribí el código de la sala (letras y números).';return}
  msj.textContent='Conectando...';
  try{NET=await conectar(code)}catch(e){NET=null;msj.textContent='No se pudo conectar. Revisá internet y probá de nuevo.';return}
  const k='sn2_on_'+code;let st=await loadSlot(k);
  if(!st){st=newState(hashStr('sombranegra-'+code),'online','normal',code)}
  st.mode='online';st.code=code;st.nick=nick;st.color=Math.floor(Math.random()*COATS.length);
  closePanel();startGame(st,!st.flags.includes('ch1'));toast(`Sala ${code}: pasales este código a tus amigos.`,6000);
}
$('#oCrear').addEventListener('click',()=>online(nuevoCodigo()));
$('#oUnir').addEventListener('click',()=>online($('#oCodigo').value));
$('#oCodigo').addEventListener('keydown',e=>{if(e.key==='Enter')online($('#oCodigo').value)});

/* ---------- teclado y botones del juego ---------- */
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(S.mode==='panel'){
    if(k==='escape'){closePanel();return}
    if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))return;
    if(!$('#pTeclado').hidden){if(/^[0-9]$/.test(k))kpPress(k);if(k==='backspace')kpPress('borrar');if(k==='enter')kpTry()}
    if((k==='q'||k==='tab')&&!$('#pDiario').hidden){e.preventDefault();closePanel()}
    return;
  }
  if(S.mode==='dialog'){if(k==='e'||k===' '||k==='enter'){e.preventDefault();if(!e.repeat)dialogAdvance()}return}
  if(S.mode!=='play')return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k))e.preventDefault();
  keys[k]=true;
  if(e.repeat)return;
  if(k==='e'||k===' '||k==='enter')interact();
  else if(k==='f'){G.linterna=!G.linterna;sfx('linterna')}
  else if(k==='g')tirarBotella();
  else if(k==='q'||k==='tab')openDiario();
  else if(k==='escape')openMenu();
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
addEventListener('blur',()=>{clearKeys();save(true)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save(true)});
addEventListener('pagehide',()=>save(true));
$('#bDiario').addEventListener('click',e=>{e.currentTarget.blur();openDiario()});
$('#bMenu').addEventListener('click',e=>{e.currentTarget.blur();openMenu()});
$('#tAcc').addEventListener('pointerdown',e=>{e.preventDefault();if(S.mode==='dialog')dialogAdvance();else interact()});
$('#tCorrer').addEventListener('pointerdown',e=>{e.preventDefault();touchState.run=true;e.currentTarget.classList.add('on')});
['pointerup','pointercancel','pointerleave'].forEach(ev=>$('#tCorrer').addEventListener(ev,e=>{touchState.run=false;e.currentTarget.classList.remove('on')}));
$('#tLuz').addEventListener('pointerdown',e=>{e.preventDefault();if(S.mode==='play'){G.linterna=!G.linterna;sfx('linterna')}});
$('#tBot').addEventListener('pointerdown',e=>{e.preventDefault();tirarBotella()});
// primer toque: habilita el sonido
addEventListener('pointerdown',()=>{audioInit();if(A.ctx&&A.ctx.state==='suspended')A.ctx.resume();if(S.mode==='title'&&!A.drone)ambiente('menu')},{once:false});

/* ---------- capacidades de Claude (nube y salas), si existen ---------- */
async function initCaps(){
  for(let i=0;i<30&&!(window.claude&&typeof window.claude.use==='function');i++)await new Promise(r=>setTimeout(r,50));
  const c=window.claude;if(!c||typeof c.use!=='function')return;
  try{const [db,user,room]=await Promise.all([c.use('db'),c.use('user'),c.use('room')]);ROOMCAP=room||null;if(db&&user){const id=await user.id();if(id){UID=id;DB=db}}}catch(e){}
  if(S.mode==='title'||S.prevPanelMode==='title')refreshPortada();
}

/* ---------- bucle principal ---------- */
let last=performance.now();
function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  try{update(dt);if(G&&AREA)render();else{ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#030204';ctx.fillRect(0,0,cv.width,cv.height)}}catch(err){console.error(err)}
  requestAnimationFrame(loop);
}
if(lsGet('sn2_mute')==='1'){A.muted=true;$('#mSonido').textContent='Sonido: no'}
refreshPortada();initCaps();requestAnimationFrame(loop);
