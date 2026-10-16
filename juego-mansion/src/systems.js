/* =====================================================================
   SISTEMAS: estado, jugador, criaturas, luz, sustos y dibujo
   ===================================================================== */
let G=null,AREAS=null,FL=new Set(),monster=null,AREA=null;
const S={mode:'title',t:0,near:null,scare:null,fade:0,fadeDir:0,fadeCb:null,blackT:0,lightning:0,nextL:12,amb:18,lastScare:0,hall:null,hallT:0,bottle:null,heartT:0,stepT:0,saveT:45,trig:new Set(),cur:null,ganar:false};
const P={x:0,y:0,fx:0,fy:1,ang:Math.PI/2,walk:0,moving:false,running:false,stamina:100,hidden:null,seenHide:false,runLock:0};

function newState(seed,mode,diff,code){
  return{v:2,seed,mode:mode||'solo',diff:diff||'normal',code:code||null,area:'pb',x:19.5*T,y:20.5*T,flags:[],items:[],used:[],docs:[],clues:[],talked:[],seen:[],
    pilas:1,botellas:0,battery:100,sanity:100,time:0,deaths:0,desmayos:0,sustos:0,intentos:0,cp:{area:'pb',x:19.5*T,y:20.5*T},campSeq:[],linterna:true,furia:false,savedAt:0};
}
/* ---------- banderas, objetos, pistas ---------- */
function has(f){return FL.has(f)}
function setF(f){if(FL.has(f))return false;FL.add(f);G.flags.push(f);dirtyNet=true;return true}
function hasItem(i){return G.items.includes(i)}
function giveItem(i,silent){if(!G.items.includes(i)&&!G.used.includes(i)){G.items.push(i);dirtyNet=true;if(!silent){sfx('objeto');toast('Guardaste: '+ITEMS[i].n)}}}
function useItem(i){G.items=G.items.filter(x=>x!==i);if(!G.used.includes(i))G.used.push(i);dirtyNet=true}
function addClue(id){if(G.clues.includes(id))return false;G.clues.push(id);sfx('pista');dirtyNet=true;if(/^(c_|w_|a_|r_|e_|m_|t_)/.test(id))toast(`Pista anotada en el diario (${casoN()}/${TOTAL_CASO})`);save();return true}
const ITEMS={
  llave_jardin:{n:'Llave del jardín',d:'Una llave larga y oxidada con una etiqueta: "Jardín".'},
  llave_cobertizo:{n:'Llave del cobertizo',d:'Una llave chica con una cinta verde.'},
  llave_pequena:{n:'Llave dorada',d:'Una llave diminuta con forma de nota musical. Estaba escondida en el piano.'},
  llave_hierro:{n:'Llave del sótano',d:'Pesada, helada. La etiqueta dice "Sótano".'},
  anillo:{n:'Anillo de bodas',d:'"Hasta que la muerte nos encuentre." Lo que unió dos manos.'},
  fusible1:{n:'Fusible',d:'Uno de los fusibles del sótano.'},fusible2:{n:'Fusible',d:'Uno de los fusibles del sótano.'},fusible3:{n:'Fusible',d:'Uno de los fusibles del sótano.'},
  reliquia:{n:'Reliquia (diente)',d:'Un diente enorme y negro, arrancado de la Boca. Está tibio.'},
  pieza1:{n:'Parte del medallón',d:'Plata ennegrecida con un ojo grabado.'},pieza2:{n:'Parte del medallón',d:'Plata ennegrecida con un ojo grabado.'},pieza3:{n:'Parte del medallón',d:'Plata ennegrecida con un ojo grabado.'},
  medallon:{n:'Medallón',d:'Lo que se rompió en tres, otra vez entero.'},
  llave_cuidador:{n:'Llave de la casilla',d:'Estaba entre las flores de la tumba de Isabel.'},
  velo:{n:'Velo de novia',d:'Amarillento, manchado. Lo que cubrió el rostro de la novia.'},
  fosforos:{n:'Fósforos',d:'Fósforos de cera de la sacristía.'},
};
const NOMBRE_OBJ={anillo:'El anillo',reliquia:'La reliquia (diente)',medallon:'El medallón',velo:'El velo'};

/* ---------- mundo ---------- */
function buildWorld(){
  CASE=makeCase(G.seed);DOC=DOCS();AREAS=buildAreas();populate(AREAS);CASECLUES=caseClues();
  FL=new Set(G.flags);
  G.flags.forEach(f=>{if(f.startsWith('open:')){const [,a,x,y]=f.split(':');if(AREAS[a])AREAS[a].grid[+y][+x]='D'}});
  if(has('drenado'))for(let y=0;y<AREAS.so.h;y++)for(let x=0;x<AREAS.so.w;x++)if(AREAS.so.grid[y][x]==='v')AREAS.so.grid[y][x]='u';
  for(const k in AREAS)AREAS[k].dirty=true;
  S.trig=new Set(G.flags.filter(f=>f.startsWith('t')||f.startsWith('ev_')));
}
function unlockTile(a,x,y){setF('open:'+a+':'+x+':'+y);AREAS[a].grid[y][x]='D';AREAS[a].dirty=true}
function tileAt(px,py){const a=AREA;const tx=Math.floor(px/T),ty=Math.floor(py/T);if(tx<0||ty<0||tx>=a.w||ty>=a.h)return '#';return a.grid[ty][tx]}
function walkableT(tx,ty,a){a=a||AREA;if(tx<0||ty<0||tx>=a.w||ty>=a.h)return false;const c=a.grid[ty][tx];return !SOLID.has(c)&&c!=='v'}
function opaqueAt(px,py){const c=tileAt(px,py);return OPAQUE.has(c)}
function blocked(x,y,r){
  const x0=Math.floor((x-r)/T),x1=Math.floor((x+r)/T),y0=Math.floor((y-r)/T),y1=Math.floor((y+r)/T);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)if(!walkableT(tx,ty))return true;
  for(const e of AREA.ents)if(e.k==='npc'&&(!e.cond||e.cond())&&Math.hypot((e.x+.5)*T-x,(e.y+.5)*T-y)<r+10)return true;
  return false;
}
function los(x0,y0,x1,y1){const d=Math.hypot(x1-x0,y1-y0),n=Math.ceil(d/8);for(let i=1;i<n;i++){const k=i/n;if(opaqueAt(x0+(x1-x0)*k,y0+(y1-y0)*k))return false}return true}
function checkpoint(){G.cp={area:G.area,x:P.x,y:P.y};save()}

/* ---------- cambio de área ---------- */
function goArea(id,x,y,silent){
  if(S.fadeDir)return;
  S.fadeDir=1;S.fadeCb=()=>{
    const prevCh=AREA?AREA.ch:0,prevAmb=AREA?AREA.amb:null;
    G.area=id;AREA=AREAS[id];P.x=(x+.5)*T;P.y=(y+.5)*T;P.hidden=null;S.near=null;
    if(AREA.dirty)renderStatic(AREA);
    if(AREA.amb!==prevAmb||!A.drone)ambiente(AREA.amb);
    if(monster){despawnMonster();G.mResp=8+rnd()*14}
    explored(true);
    if(!silent)checkpoint();
    updateHUD(true);
  };
}
/* ---------- explorado (para el mapa) ---------- */
const EXPL={};
function explored(reset){const a=AREA;if(!EXPL[a.id])EXPL[a.id]=new Uint8Array(a.w*a.h);const ex=EXPL[a.id];
  const tx=Math.floor(P.x/T),ty=Math.floor(P.y/T);for(let y=ty-3;y<=ty+3;y++)for(let x=tx-3;x<=tx+3;x++)if(x>=0&&y>=0&&x<a.w&&y<a.h)ex[y*a.w+x]=1}

/* =====================================================================
   CRIATURAS
   ===================================================================== */
function monsterTypeFor(){const ch=AREA.ch;if(ch===1&&has('m1'))return 'sinrostro';if(ch===2&&has('cosa_on'))return 'cosa';if(ch===3&&has('novia'))return 'novia';return null}
const MSTATS={
  sinrostro:{walk:52,chase:138,sight:true,hear:1},
  cosa:{walk:58,chase:152,sight:false,hear:1.5},
  novia:{walk:70,chase:205,sight:true,hear:.8},
};
function spawnMonster(tipo,o){
  o=o||{};if(tipo==='cosa')setF('cosa_on');
  const pos=o.cerca?spotNear(o.cerca):spotFar();if(!pos)return;
  monster={tipo,x:pos[0],y:pos[1],state:'patrol',path:[],pt:0,target:null,t:0,away:0,active:90+rnd()*70,seen:false,last:null,frozen:false,search:0,growl:0};
  if(tipo==='novia'&&G.furia){monster.state='chase'}
}
function despawnMonster(){monster=null;growlLevel(0)}
function spotFar(){const a=AREA;let best=null,bd=0;for(let i=0;i<120;i++){const tx=Math.floor(rnd()*a.w),ty=Math.floor(rnd()*a.h);if(!walkableT(tx,ty))continue;
  const x=(tx+.5)*T,y=(ty+.5)*T,d=Math.hypot(x-P.x,y-P.y);if(d>14*T&&!los(x,y,P.x,P.y))return[x,y];if(d>bd){bd=d;best=[x,y]}}return best}
function spotNear(n){
  // detrás del jugador, fuera de la luz si se puede
  const a=AREA;let best=null,bs=-1;
  for(let i=0;i<160;i++){const ang=rnd()*Math.PI*2,d=(n*.6+rnd()*n*.6)*T;const x=P.x+Math.cos(ang)*d,y=P.y+Math.sin(ang)*d;const tx=Math.floor(x/T),ty=Math.floor(y/T);
    if(!walkableT(tx,ty))continue;const behind=Math.cos(ang-P.ang)<0?2:0;const sc=behind+(los(x,y,P.x,P.y)?1:0)+rnd()*.5;if(sc>bs){bs=sc;best=[(tx+.5)*T,(ty+.5)*T]}}
  return best||spotFar();
}
function noviaCerca(n){if(!monster||monster.tipo!=='novia'){if(AREA.ch===3&&has('novia'))spawnMonster('novia',{cerca:n});return}const p=spotNear(n);if(p){monster.x=p[0];monster.y=p[1];sfx('susurro',0)}}
function alertarMonstruo(x,y,r){if(!monster||monster.away>0)return;const st=MSTATS[monster.tipo];if(Math.hypot(monster.x-x,monster.y-y)<r*T*st.hear){monster.target={x,y};if(monster.state!=='chase'){monster.state='investigate';monster.path=[]}}}
function ruido(x,y,r){alertarMonstruo(x,y,r)}
function bfsPath(sx,sy,gx,gy,maxN){
  const a=AREA,W=a.w,H=a.h;
  if(!walkableT(gx,gy,a)){for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]])if(walkableT(gx+dx,gy+dy,a)){gx+=dx;gy+=dy;break}}
  if(!walkableT(sx,sy,a)){for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]])if(walkableT(sx+dx,sy+dy,a)){sx+=dx;sy+=dy;break}}
  const s=sy*W+sx,g=gy*W+gx;if(s===g)return[];
  const prev=new Int32Array(W*H).fill(-1);prev[s]=s;const q=[s];let qi=0;
  while(qi<q.length&&qi<(maxN||4000)){const c=q[qi++];if(c===g)break;const cx=c%W,cy=(c/W)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const k=ny*W+nx;if(prev[k]!==-1)continue;if(!walkableT(nx,ny,a))continue;prev[k]=c;q.push(k)}}
  if(prev[g]===-1)return null;const path=[];let c=g;while(c!==s){path.push([(c%W+.5)*T,((c/W|0)+.5)*T]);c=prev[c]}return path.reverse();
}
function playerLit(){return G.linterna&&G.battery>0}
function inFlashlight(x,y){
  if(!playerLit())return false;const d=Math.hypot(x-P.x,y-P.y);if(d>flashRange())return false;
  let da=Math.atan2(y-P.y,x-P.x)-P.ang;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
  return Math.abs(da)<.5&&los(P.x,P.y,x,y);
}
function flashRange(){let r=G.diff==='pesadilla'?220:265;if(G.battery<15)r*=.65+G.battery/45;return r}
function updateMonster(dt){
  if(!monster){
    const tipo=monsterTypeFor();
    if(tipo){G.mResp=(G.mResp??10)-dt;if(G.mResp<=0){spawnMonster(tipo);G.mResp=null}}
    return;
  }
  const m=monster,st=MSTATS[m.tipo];const mult=G.diff==='pesadilla'?1.15:1;
  m.t+=dt;
  // ciclos de actividad del hombre sin rostro
  if(m.tipo==='sinrostro'&&m.state!=='chase'){m.active-=dt;if(m.active<=0){sfx('arrastre',0);despawnMonster();G.mResp=(has('caso_cerrado')?25:45)+rnd()*35;return}}
  const d=Math.hypot(P.x-m.x,P.y-m.y);
  // visión
  let ve=false;
  if(!P.hidden){
    if(m.tipo==='cosa')ve=d<1.4*T;
    else{const range=m.tipo==='novia'?16*T:(playerLit()?10*T:(nearLight(P.x,P.y)?6.5*T:3.8*T))*(G.diff==='pesadilla'?1.2:1);ve=d<range&&los(m.x,m.y,P.x,P.y)}
  }
  if(m.tipo==='novia'){m.frozen=inFlashlight(m.x,m.y-10);if(G.furia)ve=!P.hidden}
  if(ve){if(m.state!=='chase'){m.state='chase';sfx('stinger');if(m.tipo!=='novia')sfx('chillido',clamp((m.x-P.x)/300,-1,1))}m.last={x:P.x,y:P.y};m.lostT=0}
  // ¿te vio esconderte?
  if(P.hidden&&P.hiddenJust){P.hiddenJust=false;P.seenHide=(m.state==='chase'&&d<6*T&&m.tipo!=='cosa')}
  let speed=st.walk;
  if(m.state==='chase'){
    speed=st.chase;
    if(!ve){m.lostT=(m.lostT||0)+dt;if(m.tipo==='novia'&&!G.furia&&m.lostT>6){m.state='patrol'}else if(m.tipo!=='novia'&&m.lostT>(P.hidden&&P.seenHide?99:1.2)){m.state='investigate';m.target=m.last;m.path=[]}}
    const tgt=(ve||m.tipo==='novia')?{x:P.x,y:P.y}:m.last;
    if(P.hidden&&P.seenHide&&m.tipo!=='cosa'){m.target={x:P.x,y:P.y}}
    m.pt-=dt;if(m.pt<=0||!m.path||!m.path.length){m.pt=.35;m.path=bfsPath(Math.floor(m.x/T),Math.floor(m.y/T),Math.floor(tgt.x/T),Math.floor(tgt.y/T))||[]}
  }else if(m.state==='investigate'){
    speed=m.tipo==='cosa'?st.chase*.85:st.walk*1.6;
    if(!m.path||!m.path.length){m.path=m.target?bfsPath(Math.floor(m.x/T),Math.floor(m.y/T),Math.floor(m.target.x/T),Math.floor(m.target.y/T))||[]:[];if(!m.path.length){m.state='search';m.search=4+rnd()*3}}
  }else if(m.state==='search'){
    speed=st.walk;m.search-=dt;if(m.search<=0)m.state='patrol';
    if(!m.path||!m.path.length){const tx=Math.floor(m.x/T)+Math.floor(rnd()*7-3),ty=Math.floor(m.y/T)+Math.floor(rnd()*7-3);if(walkableT(tx,ty))m.path=bfsPath(Math.floor(m.x/T),Math.floor(m.y/T),tx,ty,600)||[]}
  }else{ // patrulla: se acerca de a poco
    if(!m.path||!m.path.length){
      let tx,ty,ok=false;for(let i=0;i<30&&!ok;i++){const near=rnd()<.55;tx=near?Math.floor(P.x/T)+Math.floor(rnd()*17-8):Math.floor(rnd()*AREA.w);ty=near?Math.floor(P.y/T)+Math.floor(rnd()*17-8):Math.floor(rnd()*AREA.h);ok=walkableT(tx,ty)}
      if(ok)m.path=bfsPath(Math.floor(m.x/T),Math.floor(m.y/T),tx,ty)||[];
    }
  }
  if(m.tipo==='novia'&&m.frozen)speed=0;
  if(m.tipo==='novia'&&!m.frozen&&m.state!=='chase'&&d<14*T&&!P.hidden)speed=st.walk*1.6;
  speed*=mult;
  if(m.path&&m.path.length&&speed>0){const [nx,ny]=m.path[0];const dx=nx-m.x,dy=ny-m.y,dd=Math.hypot(dx,dy);if(dd<4)m.path.shift();else{const k=Math.min(dd,speed*dt)/dd;m.x+=dx*k;m.y+=dy*k}}
  // la novia, si está lejos y no la ves, se teletransporta más cerca
  if(m.tipo==='novia'&&!m.frozen&&d>18*T&&rnd()<dt*.08){const p=spotNear(9);if(p){m.x=p[0];m.y=p[1]}}
  // atrapar
  const reach=P.hidden?(P.seenHide&&m.tipo!=='cosa'?26:-1):20;
  if(d<reach&&S.mode==='play')morir(m.tipo);
  // sonido
  growlLevel(m.state==='chase'?clamp(1-d/(12*T),0,1):clamp(.5-d/(16*T),0,.4));
  if(m.tipo!=='novia'&&m.state!=='chase'){m.stepT=(m.stepT||0)-dt;if(m.stepT<=0&&d<14*T){m.stepT=.7;if(m.tipo==='cosa')sfx('arrastre',clamp((m.x-P.x)/300,-1,1));else sfx('pasoAjeno',clamp((m.x-P.x)/300,-1,1),clamp(1-d/(14*T),.1,1))}}
  // cordura
  if(d<7*T&&(ve||inFlashlight(m.x,m.y)))G.sanity-=dt*(m.tipo==='novia'?2.5:4);
}
function nearLight(x,y){if(S.blackT>0)return false;for(const l of AREA.lights){if(l.c&&!l.c())continue;if(Math.hypot((l.x)*T-x,(l.y)*T-y)<l.r*.7)return true}return false}
function morir(tipo){
  if(S.mode!=='play')return;G.deaths++;
  scare(tipo,()=>{S.mode='dead';const t=$('#muerte');$('#mTit').textContent='Te atrapó';
    $('#mTxt').textContent=['Lo último que escuchaste fue tu propio nombre.','No tenía cara. Pero sonreía.','Sentiste las manos frías en la nuca. Después, nada.','Te arrastró a la oscuridad. Todavía escuchás tus uñas contra el piso.','"Acepto", dijo una voz de mujer al lado de tu oído.'][Math.floor(rnd()*5)];
    t.hidden=false;save()});
}
function desmayo(){
  if(S.mode!=='play')return;G.desmayos++;S.mode='dead';
  $('#mTit').textContent='Te desmayaste';$('#mTxt').textContent='La oscuridad se metió adentro de tu cabeza. Cuando abrís los ojos, no sabés cuánto tiempo pasó.';$('#muerte').hidden=false;sfx('golpeSusto');
}
$('#mSeguir').addEventListener('click',()=>{
  $('#muerte').hidden=true;const cp=G.cp||{area:G.area,x:P.x,y:P.y};
  G.sanity=Math.max(G.sanity,70);G.battery=Math.max(G.battery,40);
  if(monster){despawnMonster()}G.mResp=G.furia?4:20;
  S.mode='play';
  if(cp.area!==G.area){goArea(cp.area,Math.floor(cp.x/T),Math.floor(cp.y/T),true)}else{P.x=cp.x;P.y=cp.y;P.hidden=null}
  if(G.furia){G.mResp=5}
});

/* =====================================================================
   SUSTOS
   ===================================================================== */
function scare(tipo,cb){
  if(S.mode==='scare'){cb&&setTimeout(cb,900);return}
  S.prevMode=S.mode==='dead'?'play':S.mode;S.mode='scare';S.scare={tipo:tipo==='generico'?['generico','generico','sinrostro'][Math.floor(rnd()*3)]:tipo,t:0,dur:1.15,cb,seed:(rnd()*1e9)|0};document.body.classList.add('susto');
  sfx('grito');sfx('golpeSusto');G.sustos++;G.sanity=Math.max(0,G.sanity-14);S.lastScare=G.time;clearKeys();
  try{navigator.vibrate&&navigator.vibrate([90,40,140])}catch(e){}
}
function relampago(){S.lightning=1;setTimeout(()=>sfx('trueno'),400+rnd()*900)}
function apagon(ms){S.blackT=ms/1000;sfx('electricidad')}
const AMB_EVENTS=[
  ()=>{const p=rnd()<.5?-1:1;for(let i=0;i<4;i++)setTimeout(()=>sfx('pasoAjeno',p*.8,.7),i*420)},
  ()=>{sfx('susurro');if(rnd()<.6)susurro(['...detrás tuyo...','...te estoy viendo...','...quedate...','...¿por qué viniste?...','...no apagues la luz...','...ya casi...','...date vuelta...'][Math.floor(rnd()*7)])},
  ()=>sfx('golpes',rnd()*2-1),()=>sfx('portazo',rnd()*2-1),()=>sfx('llanto',rnd()*2-1),()=>sfx('risa',rnd()*2-1),()=>sfx('crujido',rnd()*2-1),()=>sfx('arrastre',rnd()*2-1),
  ()=>{apagon(700)},
  ()=>{S.hall={x:P.x+Math.cos(P.ang)*(150+rnd()*60),y:P.y+Math.sin(P.ang)*(150+rnd()*60),t:.35};sfx('susurro',0)},
];
function ambientTick(dt){
  S.amb-=dt*(G.sanity<40?1.8:1);
  if(S.amb<=0){S.amb=16+rnd()*28;
    const evs=AMB_EVENTS.slice(0,G.sanity<55?10:8);evs[Math.floor(rnd()*evs.length)]();
    // susto de frente, sin aviso
    const sinceLast=G.time-S.lastScare;
    if(sinceLast>200&&rnd()<(G.diff==='pesadilla'?.3:.18)&&!(monster&&monster.state==='chase'))setTimeout(()=>{if(S.mode==='play')scare('generico')},400);
  }
  if(AREA.ch===2&&rnd()<dt*.25)sfx('goteo',rnd()*2-1);
}

/* =====================================================================
   JUGADOR
   ===================================================================== */
let lastStep=0;
function updatePlayer(dt){
  if(P.hidden){P.moving=false;P.stamina=Math.min(100,P.stamina+dt*25);return}
  let ix=joy.x,iy=joy.y;
  if(keys.a||keys.arrowleft)ix-=1;if(keys.d||keys.arrowright)ix+=1;if(keys.w||keys.arrowup)iy-=1;if(keys.s||keys.arrowdown)iy+=1;
  const len=Math.hypot(ix,iy);if(len>1){ix/=len;iy/=len}
  const wantRun=(keys.shift||touchState.run)&&P.runLock<=0;
  P.running=wantRun&&len>.2&&P.stamina>0;
  if(P.running){P.stamina-=dt*14;if(P.stamina<=0){P.stamina=0;P.runLock=1.5}}else{P.stamina=Math.min(100,P.stamina+dt*(len>.2?9:16))}
  P.runLock-=dt;
  const sp=(P.running?172:102)*(G.sanity<25?.9:1);
  if(len>.15){
    const nx=P.x+ix*sp*dt;if(!blocked(nx,P.y,9))P.x=nx;const ny=P.y+iy*sp*dt;if(!blocked(P.x,ny,9))P.y=ny;
    P.walk+=dt*(P.running?16:11);P.fx=ix;P.fy=iy;P.moving=true;
    lastStep-=dt;if(lastStep<=0){lastStep=P.running?.27:.42;sfx('paso',P.running?1.4:.8);ruido(P.x,P.y,P.running?(G.diff==='pesadilla'?11:9):2.2)}
  }else P.moving=false;
  // linterna: mouse en la compu, dirección de marcha en el celular
  let target=P.ang;
  if(!tactil&&mouse.on&&performance.now()-mouse.t<4000){const wx=camX+mouse.x/zoom,wy=camY+mouse.y/zoom;target=Math.atan2(wy-P.y,wx-P.x)}
  else if(P.moving)target=Math.atan2(P.fy,P.fx);
  let da=target-P.ang;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;P.ang+=da*Math.min(1,dt*10);
  if(!tactil&&mouse.on&&performance.now()-mouse.t<4000){P.fx=Math.cos(P.ang);P.fy=Math.sin(P.ang)}
}
function updateSurvival(dt){
  const k=G.diff==='pesadilla'?1.5:1;
  if(G.linterna&&G.battery>0){G.battery-=dt*.2*k;if(G.battery<=0){G.battery=0;if(G.pilas>0){G.pilas--;G.battery=100;sfx('linterna');toast('Cambiaste las pilas (te quedan '+G.pilas+')')}else{toast('La linterna se apagó. No tenés más pilas.');sfx('linterna')}}}
  const lit=nearLight(P.x,P.y);
  if(lit)G.sanity=Math.min(100,G.sanity+dt*.9);
  else if(!playerLit())G.sanity-=dt*.45*k;
  else G.sanity-=dt*.05*k;
  if(P.hidden)G.sanity-=dt*.25;
  if(G.sanity<=0){G.sanity=0;desmayo()}
  G.sanity=clamp(G.sanity,0,100);
  // latido
  let fear=0;if(monster&&monster.away<=0){const d=Math.hypot(monster.x-P.x,monster.y-P.y);fear=clamp(1-d/(11*T),0,1);if(monster.state==='chase')fear=Math.max(fear,.6)}
  fear=Math.max(fear,(40-G.sanity)/60);
  if(fear>0){S.heartT-=dt;if(S.heartT<=0){S.heartT=1.3-fear*.9;sfx('latido',.35+fear*.65)}}
}
/* ---------- interactuar ---------- */
function interactables(){
  const L=[];
  for(const e of AREA.ents){if(e.cond&&!e.cond())continue;L.push({e,x:(e.x+.5)*T,y:(e.y+.5)*T,label:typeof e.label==='function'?e.label():e.label,r:e.r||46})}
  // escondites
  const tx=Math.floor(P.x/T),ty=Math.floor(P.y/T);
  for(let y=ty-1;y<=ty+1;y++)for(let x=tx-1;x<=tx+1;x++){const c=(AREA.grid[y]||[])[x];if(c==='A'||c==='b')L.push({hide:{x,y,c},x:(x+.5)*T,y:(y+.5)*T,label:c==='A'?'Esconderte en el ropero':'Meterte debajo de la cama',r:40,pri:-8})}
  return L;
}
function findNear(){if(P.hidden)return{salir:true,label:'Salir del escondite',x:P.x,y:P.y};let best=null,bd=1e9;for(const it of interactables()){const d=Math.hypot(it.x-P.x,it.y-P.y)+(it.pri||0);if(d<it.r+(it.pri||0)&&d<bd){bd=d;best=it}}return best}
function interact(){
  if(S.mode==='dialog'){dialogAdvance();return}
  if(S.mode!=='play')return;const n=S.near;if(!n)return;
  if(n.salir){const h=P.hidden;P.hidden=null;P.seenHide=false;sfx('crujido',0);const spots=[[0,1],[0,-1],[1,0],[-1,0]];for(const [dx,dy] of spots){const x=(h.x+dx+.5)*T,y=(h.y+dy+.5)*T;if(!blocked(x,y,9)){P.x=x;P.y=y;break}}return}
  if(n.hide){P.hidden={x:n.hide.x,y:n.hide.y,from:{x:P.x,y:P.y}};P.hiddenJust=true;sfx('crujido',0);P.x=(n.hide.x+.5)*T;P.y=(n.hide.y+.5)*T;return}
  const e=n.e;if(!G.seen.includes(e.id)){G.seen.push(e.id)}
  e.on();
}
function tirarBotella(){
  if(S.mode!=='play'||G.botellas<=0||S.bottle||P.hidden)return;G.botellas--;
  let x=P.x,y=P.y;const dx=Math.cos(P.ang),dy=Math.sin(P.ang);let d=0;
  while(d<7*T){const nx=x+dx*8,ny=y+dy*8;if(opaqueAt(nx,ny)||!walkableT(Math.floor(nx/T),Math.floor(ny/T)))break;x=nx;y=ny;d+=8}
  S.bottle={sx:P.x,sy:P.y,x:P.x,y:P.y,tx:x,ty:y,t:0,dur:Math.max(.25,d/420)};sfx('linterna');
}
function updateBottle(dt){const b=S.bottle;if(!b)return;b.t+=dt;const k=Math.min(1,b.t/b.dur);b.x=lerp(b.sx,b.tx,k);b.y=lerp(b.sy,b.ty,k);
  if(k>=1){sfx('vidrio',clamp((b.tx-P.x)/300,-1,1));ruido(b.tx,b.ty,16);if(monster&&monster.tipo!=='novia'&&Math.hypot(monster.x-b.tx,monster.y-b.ty)<16*T*MSTATS[monster.tipo].hear){monster.state='investigate';monster.target={x:b.tx,y:b.ty};monster.path=[]}S.bottle=null}}

/* ---------- disparadores y eventos ---------- */
function checkTriggers(){
  const tx=P.x/T,ty=P.y/T;
  for(const tr of TRIGGERS){if(S.trig.has(tr.id)||tr.a!==G.area)continue;const [x0,y0,x1,y1]=tr.r;if(tx>=x0&&tx<=x1+1&&ty>=y0&&ty<=y1+1&&(!tr.c||tr.c())){S.trig.add(tr.id);setF(tr.id);tr.run()}}
  for(const ev of EVENTS){if(S.trig.has(ev.id))continue;if(ev.w()){S.trig.add(ev.id);setF(ev.id);ev.run()}}
}

/* =====================================================================
   DIBUJO
   ===================================================================== */
function castPoly(x,y,r,a0,a1,n){const pts=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n,dx=Math.cos(a),dy=Math.sin(a);let d=4;while(d<r){if(opaqueAt(x+dx*d,y+dy*d)){d+=2;break}d+=6}pts.push([x+dx*Math.min(d,r),y+dy*Math.min(d,r)])}return pts}
function lightHole(x,y,r,alpha,pts,s,full){
  const sx=(x-camX)*s,sy=(y-camY)*s,R=r*s;const g=dctx.createRadialGradient(sx,sy,0,sx,sy,R);
  g.addColorStop(0,`rgba(0,0,0,${alpha})`);g.addColorStop(.55,`rgba(0,0,0,${alpha*.8})`);g.addColorStop(1,'rgba(0,0,0,0)');dctx.fillStyle=g;
  dctx.beginPath();if(!full)dctx.moveTo(sx,sy);pts.forEach(([px,py],i)=>{const X=(px-camX)*s,Y=(py-camY)*s;if(i===0&&full)dctx.moveTo(X,Y);else dctx.lineTo(X,Y)});dctx.closePath();dctx.fill();
}
const SPR={};
function drawSprite(c,e,t){
  const x=(e.x+.5)*T,y=(e.y+.5)*T;
  switch(e.spr){
    case 'cuerpo':{ell(c,x,y+4,26,16,'rgba(90,8,8,.85)');ell(c,x+10,y+10,14,8,'rgba(60,4,4,.7)');
      c.fillStyle='#1a1418';c.fillRect(x-14,y-5,26,11);c.fillStyle='#d8c8b8';c.beginPath();c.arc(x-18,y,6,0,7);c.fill();c.fillStyle='#111';c.fillRect(x-20,y-2,2,2);c.fillRect(x-20,y+1,2,2);
      c.fillStyle='#d8c8b8';c.fillRect(x+12,y-9,8,3);c.fillRect(x+12,y+6,8,3);c.fillStyle='#120e10';c.fillRect(x+12,y-4,12,4);c.fillRect(x+12,y+1,12,4);break}
    case 'arrastre':ell(c,x,y+4,24,14,'rgba(70,6,6,.75)');c.fillStyle='rgba(70,6,6,.6)';c.fillRect(x+10,y-2,140,4);c.fillRect(x+10,y+6,140,3);break;
    case 'reloj':c.fillStyle='#3a2414';c.fillRect(x-14,y-6,30,12);circ(c,x+12,y,7,'#e0d6c0');c.strokeStyle='#111';c.beginPath();c.moveTo(x+12,y);c.lineTo(x+12,y-5);c.moveTo(x+12,y);c.lineTo(x+16,y+1);c.stroke();break;
    case 'rastro':case 'rastro_berta':case 'rastro_tomas':case 'rastro_clara':case 'rastro_vidal':case 'rastro_elena':
      if(e.spr==='rastro'){const cul=CASE.culpa;const col={berta:'rgba(230,226,215,.7)',tomas:'rgba(60,40,20,.85)',clara:'rgba(220,190,90,.6)',vidal:'rgba(240,240,240,.5)',elena:'#f0ece0'}[cul];c.fillStyle=col;if(cul==='elena')circ(c,x,y,3,col);else for(let i=0;i<4;i++)ell(c,x-10+i*7,y+(i%2?4:-3),3,5,col);if(cul==='tomas'){c.fillStyle='#8a1020';c.fillRect(x-4,y-1,4,3);c.fillRect(x+6,y+3,3,2)}}
      else{c.fillStyle='#d8d0c0';c.fillRect(x-5,y-6,10,12);c.fillStyle='#8a7050';c.fillRect(x-5,y-6,10,3)}break;
    case 'libro':c.fillStyle='#3a1a14';c.fillRect(x-8,y-6,16,12);c.fillStyle='#d8ccb0';c.fillRect(x-7,y-5,7,10);c.fillRect(x+1,y-5,6,10);break;
    case 'papel':case 'inscripcion':c.save();c.translate(x,y);c.rotate(.2);c.fillStyle='#d8ccb0';c.fillRect(-6,-7,12,14);c.fillStyle='#6a5a4a';c.fillRect(-4,-4,8,1);c.fillRect(-4,-1,8,1);c.fillRect(-4,2,6,1);c.restore();break;
    case 'contrato':c.fillStyle='#c8b080';c.fillRect(x-9,y-6,18,12);c.fillStyle='#7a1010';circ(c,x+5,y+3,3,'#7a1010');break;
    case 'cajon':case 'escondite':case 'coartada_berta':case 'coartada_tomas':case 'coartada_clara':case 'coartada_vidal':case 'coartada_elena':break;
    case 'telefono':c.fillStyle='#0a0a0a';c.fillRect(x-7,y-4,14,9);c.fillRect(x-9,y-7,18,4);break;
    case 'retrato':break;
    case 'cajaFuerte':c.fillStyle='#3a3a40';c.fillRect(x-7,y-12,16,14);circ(c,x+1,y-5,3,'#8a8a90');break;
    case 'candado':break;
    case 'cajaMusica':c.fillStyle='#5a2a3a';c.fillRect(x-7,y-4,14,9);c.fillStyle='#e8e0d0';c.fillRect(x-1,y-12,2,8);break;
    case 'caballito':{const k=Math.sin(t*2.2)*.25;c.save();c.translate(x,y+6);c.rotate(k);c.fillStyle='#6a3a1a';c.fillRect(-12,-2,24,3);c.fillStyle='#d8c8a8';c.fillRect(-8,-14,14,8);c.fillRect(4,-20,5,10);c.fillStyle='#111';c.fillRect(6,-18,2,2);c.restore();break}
    case 'maceta':c.fillStyle='#8a4a2a';c.beginPath();c.moveTo(x-7,y-6);c.lineTo(x+7,y-6);c.lineTo(x+5,y+6);c.lineTo(x-5,y+6);c.fill();c.fillStyle='#2a3a1a';circ(c,x,y-8,6,'#2a3a1a');break;
    case 'pilas':c.fillStyle='#1a1a1a';c.fillRect(x-6,y-4,5,10);c.fillRect(x+1,y-4,5,10);c.fillStyle='#c9a24a';c.fillRect(x-6,y-4,5,3);c.fillRect(x+1,y-4,5,3);break;
    case 'botella':c.fillStyle='rgba(60,90,60,.9)';c.fillRect(x-3,y-4,6,11);c.fillRect(x-1,y-9,2,5);break;
    case 'fusible':c.fillStyle='rgba(200,220,230,.8)';c.fillRect(x-6,y-3,12,6);c.fillStyle='#8a8a90';c.fillRect(x-8,y-3,3,6);c.fillRect(x+5,y-3,3,6);break;
    case 'reliquia':c.fillStyle='#1a1414';c.beginPath();c.moveTo(x-4,y-8);c.lineTo(x+4,y-8);c.lineTo(x+2,y+6);c.lineTo(x,y+2);c.lineTo(x-2,y+6);c.fill();break;
    case 'sabana':{const k=Math.sin(t*1.5)*3;c.fillStyle='rgba(210,205,195,.85)';c.beginPath();c.moveTo(x-12,y-14);c.lineTo(x+12,y-14);c.lineTo(x+13+k,y+12);c.lineTo(x-13+k,y+12);c.fill();ell(c,x+k*.5,y-4,5,6,'rgba(60,40,40,.35)');break}
    case 'valvulas':for(let i=0;i<4;i++)circ(c,x-12+i*8,y,3.5,'#8a2a1a');break;
    case 'cajaFus':c.fillStyle='#4a4a50';c.fillRect(x-8,y-14,16,12);c.fillStyle='#1a1a1a';c.fillRect(x-6,y-12,12,8);break;
    case 'pieza':c.fillStyle='#8a8a90';c.beginPath();c.moveTo(x,y);c.arc(x,y,6,0,2.1);c.fill();break;
    case 'calavera':circ(c,x,y,6,'#c8bea8');c.fillStyle='#1a1410';c.fillRect(x-3,y-2,2,2);c.fillRect(x+1,y-2,2,2);c.fillRect(x-1,y+2,2,2);break;
    case 'flores':c.fillStyle='#2a3a1a';c.fillRect(x-1,y-2,2,10);[[-4,-4],[3,-5],[0,-8],[-2,-1],[4,0]].forEach(([dx,dy])=>circ(c,x+dx,y+dy,2.5,'#f0ece4'));break;
    case 'campana':{const k=Math.sin(t*1.3+e.x)*.05;c.save();c.translate(x,y-6);c.rotate(k);c.fillStyle='#6a5a2a';c.beginPath();c.moveTo(-8,8);c.quadraticCurveTo(-8,-8,0,-9);c.quadraticCurveTo(8,-8,8,8);c.fill();c.restore();c.fillStyle='#4a3a2a';c.fillRect(x-1,y+3,2,12);break}
    case 'velo':c.fillStyle='rgba(225,220,205,.8)';c.beginPath();c.ellipse(x,y,10,7,0,0,7);c.fill();break;
    case 'fosforos':c.fillStyle='#7a2a1a';c.fillRect(x-5,y-3,10,6);break;
    case 'velaApagada':c.fillStyle='#141012';c.fillRect(x-3,y-8,6,14);break;
    default:if(e.spr&&e.spr.startsWith('arma_')){c.fillStyle='#6a6a70';c.fillRect(x-5,y-2,10,4)}
  }
}
function drawLightSource(c,l,t){
  if(l.c&&!l.c())return;const x=l.x*T,y=l.y*T;
  if(l.bombita){circ(c,x,y,3,S.blackT>0?'#333':'#f4e8c0');return}
  if(l.fuego){for(let i=0;i<3;i++){ell(c,x-8+i*8,y-2+Math.sin(t*12+i)*1.5,3,5+Math.sin(t*9+i)*2,S.blackT>0?'#401010':'#e88a2a')}return}
  if(l.farol){c.fillStyle='#1a1a1a';c.fillRect(x-1,y,2,14);c.fillStyle=S.blackT>0?'#333':'#f0c060';c.fillRect(x-4,y-8,8,8);return}
  c.fillStyle='#e8dcc0';c.fillRect(x-2,y-2,4,7);if(S.blackT<=0){const f=Math.sin(t*14+x)*1.2;ell(c,x,y-5+f*.3,2.2,3.6,'#e8a84a');ell(c,x,y-4.5,1,2,'#fff1c4')}
}
let others=new Map();
function render(){
  const t=S.t;const W=vw/zoom,H=vh/zoom,s=dpr*zoom;
  const a=AREA;const mw=a.w*T,mh=a.h*T;
  let cx=P.x-W/2,cy=P.y-H/2;
  camX=mw<W?(mw-W)/2:clamp(cx,0,mw-W);camY=mh<H?(mh-H)/2:clamp(cy,0,mh-H);
  if(S.mode==='scare'||(G.sanity<20&&!reduceMotion)){const k=S.mode==='scare'?8:1.5;camX+=(rnd()-.5)*k;camY+=(rnd()-.5)*k}
  if(a.dirty)renderStatic(a);
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#030204';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(s,0,0,s,-camX*s,-camY*s);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(a.cv,0,0);
  // agua animada
  // entidades
  for(const e of a.ents){if(e.k==='npc'||(e.cond&&!e.cond())||!e.spr)continue;drawSprite(ctx,e,t)}
  a.lights.forEach(l=>drawLightSource(ctx,l,t));
  // retratos del pasillo (ojos que siguen)
  if(a.id==='p1')[3,11,20,29,36].forEach(px=>{const x=px*T,y=9*T;ctx.fillStyle='#6a5020';ctx.fillRect(x+5,y+12,22,18);ctx.fillStyle='#16121a';ctx.fillRect(x+7,y+14,18,14);circ(ctx,x+16,y+20,4,'#4a3a34');const dx=clamp((P.x-(x+16))/160,-1.5,1.5);ctx.fillStyle=(Math.sin(t*.6+px)>.97)?'#d02020':'#d8d0c0';ctx.fillRect(x+13.5+dx,y+19,1.5,1.5);ctx.fillRect(x+17+dx,y+19,1.5,1.5)});
  // personajes ordenados
  const ents=[];
  for(const e of a.ents){if(e.k!=='npc'||(e.cond&&!e.cond()))continue;const ex=(e.x+.5)*T,ey=(e.y+.5)*T;ents.push({y:ey,d:()=>{const dx=P.x-ex,dy=P.y-ey,m=Math.hypot(dx,dy)||1;const n=m<150;drawPerson(ctx,ex,ey,e.npc.look,n?dx/m:0,n?dy/m:1,0,false,t)}})}
  if(!P.hidden)ents.push({y:P.y,d:()=>drawPerson(ctx,P.x,P.y,PLAYER_LOOK,P.fx,P.fy,P.walk,P.moving,t)});
  others.forEach(o=>{if(o.area!==G.area)return;ents.push({y:o.y,d:()=>drawPerson(ctx,o.x,o.y,{...PLAYER_LOOK,coat:COATS[o.c]},o.fx,o.fy,o.walk,o.mv,t)})});
  if(monster&&monster.away<=0)ents.push({y:monster.y,d:()=>drawMonster(ctx,monster,t)});
  ents.sort((p,q)=>p.y-q.y).forEach(e=>e.d());
  if(S.bottle){const b=S.bottle;const k=b.t/b.dur;ctx.fillStyle='rgba(60,90,60,.9)';ctx.fillRect(b.x-3,b.y-4-Math.sin(k*Math.PI)*22,6,8)}
  // alucinación
  if(S.hall){S.hall.t-=1/60;const h=S.hall;ctx.fillStyle='rgba(5,4,6,.9)';ctx.fillRect(h.x-7,h.y-40,14,46);ell(ctx,h.x,h.y-46,8,10,'rgba(220,215,205,.85)');if(h.t<=0)S.hall=null}

  // ===== oscuridad =====
  const s2=s/2;
  dctx.setTransform(1,0,0,1,0,0);dctx.globalCompositeOperation='source-over';dctx.clearRect(0,0,dark.width,dark.height);
  const base=(a.oscuro||.95)*(1-S.lightning*.8);
  dctx.fillStyle=`rgba(2,1,4,${base})`;dctx.fillRect(0,0,dark.width,dark.height);
  dctx.globalCompositeOperation='destination-out';
  if(!P.hidden){
    const fl=Math.sin(t*9)*2+Math.sin(t*23)*1.5;
    if(playerLit()&&!(G.battery<15&&Math.sin(t*37)>.6)){const r=flashRange();const pts=castPoly(P.x,P.y,r,P.ang-.5,P.ang+.5,28);lightHole(P.x,P.y,r,1,pts,s2,false)}
    const amb=castPoly(P.x,P.y,52,0,Math.PI*2,20);lightHole(P.x,P.y,52,.6,amb,s2,true);
  }else{const amb=castPoly(P.x,P.y,40,0,Math.PI*2,16);lightHole(P.x,P.y,40,.35,amb,s2,true)}
  if(S.blackT<=0)a.lights.forEach(l=>{if(l.c&&!l.c())return;const x=l.x*T,y=l.y*T;if(Math.abs(x-P.x)>W||Math.abs(y-P.y)>H)return;
    const parp=l.parp&&Math.sin(t*7+x)>.85?.3:1;const r=(l.r+Math.sin(t*8+x)*3)*parp;const pts=castPoly(x,y,r,0,Math.PI*2,24);lightHole(x,y,r,.9*parp,pts,s2,true)});
  others.forEach(o=>{if(o.area!==G.area)return;const pts=castPoly(o.x,o.y,120,0,Math.PI*2,16);lightHole(o.x,o.y,120,.75,pts,s2,true)});
  ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(dark,0,0,cv.width,cv.height);
  // tinte cálido de velas y fuego
  ctx.setTransform(s,0,0,s,-camX*s,-camY*s);ctx.globalCompositeOperation='lighter';
  if(S.blackT<=0)a.lights.forEach(l=>{if(l.c&&!l.c())return;if(l.bombita)return;const x=l.x*T,y=l.y*T,r=l.fuego?90:55;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,l.fuego?'rgba(140,50,10,.28)':'rgba(110,60,15,.2)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)});
  ctx.globalCompositeOperation='source-over';
  // destellos de cosas sin examinar (solo si las alumbrás o estás encima)
  for(const e of a.ents){if(e.glint===false||(e.cond&&!e.cond())||G.seen.includes(e.id))continue;const x=(e.x+.5)*T,y=(e.y+.5)*T;const d=Math.hypot(x-P.x,y-P.y);
    if(d<1.6*T||inFlashlight(x,y)){const p=(Math.sin(t*3+e.x)+1)/2;ctx.fillStyle=`rgba(230,215,170,${.25+p*.45})`;const r=2+p*1.5;ctx.beginPath();ctx.moveTo(x,y-14-r*2);ctx.lineTo(x+r*.5,y-14-r*.5);ctx.lineTo(x+r*2,y-14);ctx.lineTo(x+r*.5,y-14+r*.5);ctx.lineTo(x,y-14+r*2);ctx.lineTo(x-r*.5,y-14+r*.5);ctx.lineTo(x-r*2,y-14);ctx.lineTo(x-r*.5,y-14-r*.5);ctx.fill()}}
  // la cara pálida del hombre sin rostro se ve en la oscuridad
  if(monster&&monster.tipo==='sinrostro'){const d=Math.hypot(monster.x-P.x,monster.y-P.y);if(d<9*T&&los(P.x,P.y,monster.x,monster.y-40)){ell(ctx,monster.x,monster.y-44,9,11,`rgba(226,221,214,${.18+clamp(1-d/(9*T),0,1)*.25})`)}}
  if(monster&&monster.tipo==='novia'&&!monster.frozen){const d=Math.hypot(monster.x-P.x,monster.y-P.y);if(d<10*T&&Math.sin(t*9)>.3){ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(monster.x-3,monster.y-21,2,2);ctx.fillRect(monster.x+1,monster.y-21,2,2)}}
  // nombres de otros jugadores
  others.forEach(o=>{if(o.area===G.area)bubble(o.x,o.y-40,o.nick,'#7f9a78')});
  // cartel de interacción
  if(S.near&&S.mode==='play'){const n=S.near;bubble(n.salir?P.x:n.x,(n.salir?P.y:n.y)-(n.e&&n.e.k==='npc'?44:22),(tactil?'':'[E] ')+n.label)}
  // ===== efectos de pantalla =====
  ctx.setTransform(1,0,0,1,0,0);
  if(a.lluvia||a.exterior){ctx.strokeStyle='rgba(170,180,200,.12)';ctx.lineWidth=1*dpr;ctx.beginPath();for(let i=0;i<70;i++){const x=(hh(i,7)*cv.width+t*300*dpr*(.6+hh(i,3)))%cv.width,y=(hh(i,9)*cv.height+t*900*dpr*(.6+hh(i,5)))%cv.height;ctx.moveTo(x,y);ctx.lineTo(x-4*dpr,y+16*dpr)}ctx.stroke()}
  if(a.niebla){for(let i=0;i<5;i++){const x=((hh(i,1)*1.5+t*.015*(i+1))%1.5-.25)*cv.width,y=(hh(i,2))*cv.height,R=cv.width*.35;const g=ctx.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,'rgba(140,140,155,.055)');g.addColorStop(1,'rgba(150,150,165,0)');ctx.fillStyle=g;ctx.fillRect(x-R,y-R,R*2,R*2)}}
  if(P.hidden){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='rgba(10,6,4,.92)';const gap=cv.height/9;for(let i=0;i<9;i++)ctx.fillRect(0,i*gap,cv.width,gap*.62);}
  // viñeta y cordura
  const vg=ctx.createRadialGradient(cv.width/2,cv.height/2,Math.min(cv.width,cv.height)*.3,cv.width/2,cv.height/2,Math.max(cv.width,cv.height)*.72);
  const sanK=clamp((50-G.sanity)/50,0,1);const pulse=sanK*(.5+Math.sin(t*3)*.5);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(${Math.round(60*pulse)},0,0,${.6+sanK*.3})`);ctx.fillStyle=vg;ctx.fillRect(0,0,cv.width,cv.height);
  if(sanK>.5&&!reduceMotion){ctx.fillStyle=`rgba(255,255,255,${.03*sanK})`;for(let i=0;i<20;i++)ctx.fillRect(rnd()*cv.width,rnd()*cv.height,rnd()*cv.width*.2,1)}
  if(S.fade>0){ctx.fillStyle=`rgba(0,0,0,${S.fade})`;ctx.fillRect(0,0,cv.width,cv.height)}
  if(S.mode==='scare'&&S.scare){drawScare(ctx,cv.width,cv.height,S.scare.tipo,S.scare.t/S.scare.dur,t,S.scare.seed)}
}
const PLAYER_LOOK={coat:'#6a5232',skin:'#e8c8a0',hair:'#2a1a10',hairT:'short',hat:'fedora',trench:true};
const COATS=['#3f5a7a','#7a3f5a','#4a7a3f','#6a4a90','#90603a'];
function bubble(x,y,txt,color){
  ctx.font='12px "IM Fell English", Georgia, serif';const w=ctx.measureText(txt).width+12;
  rr(ctx,x-w/2,y-9,w,18,3,'rgba(6,4,8,.9)');ctx.strokeStyle=color||'#8e1b1b';ctx.lineWidth=1;ctx.strokeRect(x-w/2+.5,y-8.5,w-1,17);
  ctx.fillStyle='#e6dcc6';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,x,y+1);
}

/* ---------- actualización general ---------- */
function update(dt){
  S.t+=dt;
  if(S.fadeDir===1){S.fade+=dt*2.6;if(S.fade>=1){S.fade=1;const cb=S.fadeCb;S.fadeCb=null;S.fadeDir=-1;cb&&cb()}}
  else if(S.fadeDir===-1){S.fade-=dt*1.6;if(S.fade<=0){S.fade=0;S.fadeDir=0}}
  if(S.mode==='scare'&&S.scare){S.scare.t+=dt;if(S.scare.t>=S.scare.dur){const cb=S.scare.cb;S.scare=null;document.body.classList.remove('susto');S.mode=S.prevMode==='scare'?'play':(S.prevMode||'play');if(S.mode==='dialog'&&!dq)S.mode='play';cb&&cb()}return}
  if(S.mode==='dialog'&&dq)dialogTick(dt);
  if(!G||!AREA)return;
  S.lightning=Math.max(0,S.lightning-dt*1.5);S.blackT=Math.max(0,S.blackT-dt);
  updateOthers(dt);
  if(S.mode!=='play')return;
  G.time+=dt;
  if(AREA.exterior||['pb','p1'].includes(AREA.id)){S.nextL-=dt;if(S.nextL<=0){S.nextL=14+rnd()*22;relampago()}}
  updatePlayer(dt);updateSurvival(dt);updateMonster(dt);updateBottle(dt);ambientTick(dt);checkTriggers();
  explored();
  S.near=findNear();
  S.saveT-=dt;if(S.saveT<=0){S.saveT=45;save(true)}
  netTick(dt);
  updateHUD();
}
