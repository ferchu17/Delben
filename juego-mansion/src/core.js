'use strict';
/* =====================================================================
   MANSIÓN SOMBRANEGRA — núcleo: utilidades, sonido, controles, mapas y dibujo
   ===================================================================== */
const $=s=>document.querySelector(s);
const T=32;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dst=(a,b,c,d)=>Math.hypot(a-c,b-d);
const rnd=Math.random;
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hh(a,b){let h=(a*374761393+b*668265263)^0x5bd1e995;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const tactil=matchMedia('(pointer: coarse)').matches||('ontouchstart' in window);
if(tactil)document.body.classList.add('tactil');

/* ---------- lienzo ---------- */
const cv=$('#c'),ctx=cv.getContext('2d');
const dark=document.createElement('canvas'),dctx=dark.getContext('2d');
let dpr=1,vw=0,vh=0,zoom=1,camX=0,camY=0;
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);vw=innerWidth;vh=innerHeight;
  cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);
  dark.width=Math.ceil(cv.width/2);dark.height=Math.ceil(cv.height/2);
  zoom=Math.max(1,Math.min(1.8,Math.min(vw,vh)/(9.5*T)));
}
addEventListener('resize',resize);resize();

/* =====================================================================
   SONIDO (todo sintetizado)
   ===================================================================== */
const A={ctx:null,master:null,muted:false,nbuf:null,drone:null,growl:null,hum:null};
function audioInit(){
  if(A.ctx)return;
  try{
    const C=new (window.AudioContext||window.webkitAudioContext)();A.ctx=C;
    A.master=C.createGain();A.master.gain.value=A.muted?0:.8;
    const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
    A.master.connect(comp);comp.connect(C.destination);
    A.nbuf=C.createBuffer(1,C.sampleRate*2,C.sampleRate);const d=A.nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    // gruñido continuo (sube cuando algo te persigue)
    const g=C.createGain();g.gain.value=0;g.connect(A.master);
    const o=C.createOscillator();o.type='sawtooth';o.frequency.value=48;const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=320;
    const am=C.createGain();am.gain.value=.6;const lfo=C.createOscillator();lfo.frequency.value=7;const lg=C.createGain();lg.gain.value=.4;lfo.connect(lg);lg.connect(am.gain);
    o.connect(lp);lp.connect(am);am.connect(g);o.start();lfo.start();
    const n=C.createBufferSource();n.buffer=A.nbuf;n.loop=true;const bp=C.createBiquadFilter();bp.type='bandpass';bp.frequency.value=900;bp.Q.value=2;const ng=C.createGain();ng.gain.value=.25;n.connect(bp);bp.connect(ng);ng.connect(am);n.start();
    A.growl={g,o,lfo};
  }catch(e){A.ctx=null}
}
function audioMute(m){A.muted=m;if(A.master)A.master.gain.value=m?0:.8}
function out(pan){
  if(pan&&A.ctx.createStereoPanner){const p=A.ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);p.connect(A.master);return p}
  return A.master;
}
function tone(f,t0,dur,type,vol,f2,pan,attack){
  const C=A.ctx,o=C.createOscillator(),g=C.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t0);
  if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(vol||.2,t0+(attack||.015));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  o.connect(g);g.connect(out(pan));o.start(t0);o.stop(t0+dur+.05);return o;
}
function noise(t0,dur,vol,type,freq,q,pan,attack){
  const C=A.ctx,n=C.createBufferSource();n.buffer=A.nbuf;n.loop=true;const f=C.createBiquadFilter();f.type=type||'lowpass';f.frequency.value=freq||800;if(q)f.Q.value=q;
  const g=C.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+(attack||.01));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  n.connect(f);f.connect(g);g.connect(out(pan));n.start(t0,Math.random()*1.5);n.stop(t0+dur+.05);return f;
}
const SFX={
  paso(v,pan){noise(A.ctx.currentTime,.09,.05*v,'bandpass',380+rnd()*250,1.2,pan)},
  pasoAjeno(pan,v){const t=A.ctx.currentTime;noise(t,.12,.11*(v||1),'bandpass',260,1.4,pan);tone(70,t,.12,'sine',.08*(v||1),null,pan)},
  latido(v){const t=A.ctx.currentTime;tone(58,t,.16,'sine',.5*v);tone(52,t+.2,.2,'sine',.38*v)},
  susurro(pan){const t=A.ctx.currentTime;for(let i=0;i<5;i++)noise(t+i*.22+rnd()*.1,.28,.06+rnd()*.05,'bandpass',2200+rnd()*1800,4,pan??(rnd()*2-1),.08)},
  crujido(pan){const t=A.ctx.currentTime;const o=tone(190,t,1.1,'sawtooth',.05,120,pan,.2);},
  portazo(pan){const t=A.ctx.currentTime;noise(t,.6,.7,'lowpass',260,0,pan);tone(60,t,.4,'sine',.6,40,pan);noise(t,.12,.3,'highpass',2000,0,pan)},
  grito(){const t=A.ctx.currentTime;[620,740,910,1180].forEach((f,i)=>tone(f,t,1.3,'sawtooth',.13,f*.55,(i%2?-.4:.4),.02));noise(t,1.1,.5,'highpass',1500);noise(t,.5,.6,'lowpass',500);tone(90,t,.6,'square',.25,40)},
  golpeSusto(){const t=A.ctx.currentTime;noise(t,.4,.9,'lowpass',180);tone(45,t,.5,'sine',.9,30);[233,247,262].forEach(f=>tone(f*2,t,1.6,'sawtooth',.07,f*1.9,0,.01))},
  stinger(){const t=A.ctx.currentTime;[110,116.5,164.8,174.6].forEach(f=>tone(f,t,2.4,'sawtooth',.06,f*.97,0,.6));noise(t,2,.15,'bandpass',600,1,0,.8)},
  llanto(pan){const t=A.ctx.currentTime;for(let i=0;i<4;i++){const o=tone(560-i*20,t+i*.55,.5,'sine',.07,420,pan,.12)}},
  risa(pan){const t=A.ctx.currentTime;for(let i=0;i<6;i++)tone(380+(i%2)*40,t+i*.13,.11,'triangle',.08,300,pan)},
  golpes(pan){const t=A.ctx.currentTime;for(let i=0;i<3;i++){noise(t+i*.32,.15,.5,'lowpass',300,0,pan);tone(80,t+i*.32,.15,'sine',.4,50,pan)}},
  vidrio(pan){const t=A.ctx.currentTime;noise(t,.25,.6,'highpass',3000,0,pan);for(let i=0;i<5;i++)tone(2500+rnd()*3000,t+rnd()*.15,.25,'sine',.06,null,pan)},
  pista(){const t=A.ctx.currentTime;tone(392,t,.6,'triangle',.09);tone(466,t+.12,.8,'triangle',.07)},
  objeto(){const t=A.ctx.currentTime;tone(523,t,.25,'triangle',.1);tone(784,t+.1,.4,'triangle',.08)},
  puerta(){const t=A.ctx.currentTime;tone(150,t,.5,'sawtooth',.05,110,0,.1);noise(t+.35,.2,.3,'lowpass',400)},
  cerrado(){const t=A.ctx.currentTime;noise(t,.08,.4,'bandpass',1200,3);noise(t+.12,.08,.35,'bandpass',1000,3)},
  candado(){const t=A.ctx.currentTime;noise(t,.06,.5,'bandpass',2500,4);tone(900,t+.05,.2,'square',.06)},
  mal(){const t=A.ctx.currentTime;tone(150,t,.35,'square',.1,110)},
  tecla(){tone(1300,A.ctx.currentTime,.04,'square',.03)},
  nota(f){const t=A.ctx.currentTime;tone(f,t,1.6,'triangle',.18);tone(f*2.01,t,1,'sine',.04)},
  campana(f){const t=A.ctx.currentTime;[1,2.4,3.9,5.4].forEach((m,i)=>tone(f*m,t,4.5-i,'sine',.16/(i+1)))},
  valvula(){const t=A.ctx.currentTime;tone(700,t,.3,'sawtooth',.04,1100)},
  estallido(){const t=A.ctx.currentTime;noise(t,1.2,.9,'lowpass',200);tone(38,t,1,'sine',.9,25);noise(t,.3,.5,'highpass',1500)},
  agua(){const t=A.ctx.currentTime;noise(t,3,.4,'lowpass',500,0,0,.5)},
  trueno(){const t=A.ctx.currentTime;noise(t,3,.6,'lowpass',180);noise(t+.05,.5,.3,'lowpass',900)},
  linterna(){noise(A.ctx.currentTime,.03,.3,'bandpass',3000,3)},
  telefono(){const t=A.ctx.currentTime;for(let i=0;i<2;i++){tone(440,t+i*.45,.38,'sine',.08);tone(480,t+i*.45,.38,'sine',.08)}},
  cajaMusica(){const t=A.ctx.currentTime;[659,587,523,587,659,659,659,587,587,587,659,784,784].forEach((f,i)=>tone(f*(1+(rnd()-.5)*.012),t+i*.38,.9,'triangle',.06))},
  electricidad(){const t=A.ctx.currentTime;noise(t,.6,.4,'bandpass',4000,2);tone(60,t,2,'sawtooth',.06)},
  goteo(pan){const t=A.ctx.currentTime;tone(1400+rnd()*600,t,.12,'sine',.05,700,pan)},
  arrastre(pan){const t=A.ctx.currentTime;noise(t,1.6,.25,'lowpass',220,0,pan,.4)},
  chillido(pan){const t=A.ctx.currentTime;tone(1500,t,.7,'sawtooth',.07,2600,pan,.05);tone(1650,t,.7,'sawtooth',.05,2400,pan,.05)},
};
function sfx(name,...a){if(!A.ctx||A.muted)return;try{SFX[name](...a)}catch(e){}}
/* ambiente por capítulo */
function ambiente(tipo){
  if(!A.ctx)return;
  if(A.drone){try{A.drone.stop()}catch(e){}A.drone=null}
  const C=A.ctx,g=C.createGain();g.gain.value=0;g.connect(A.master);g.gain.linearRampToValueAtTime(1,C.currentTime+3);
  const nodes=[];
  const base={mansion:[41.2,41.7,61.7],sotano:[36.7,37.1,55],cementerio:[46.2,46.9,69.3],menu:[38.9,39.4,58.3]}[tipo]||[41.2,41.7,61.7];
  base.forEach((f,i)=>{const o=C.createOscillator();o.type=i===2?'triangle':'sine';o.frequency.value=f;const og=C.createGain();og.gain.value=i===2?.025:.05;o.connect(og);og.connect(g);o.start();nodes.push(o)});
  const n=C.createBufferSource();n.buffer=A.nbuf;n.loop=true;const bp=C.createBiquadFilter();bp.type='bandpass';bp.frequency.value=tipo==='cementerio'?500:300;bp.Q.value=.7;
  const wg=C.createGain();wg.gain.value=tipo==='cementerio'?.07:tipo==='sotano'?.02:.035;n.connect(bp);bp.connect(wg);wg.connect(g);n.start();nodes.push(n);
  const lfo=C.createOscillator();lfo.frequency.value=.06;const lg=C.createGain();lg.gain.value=tipo==='cementerio'?380:180;lfo.connect(lg);lg.connect(bp.frequency);lfo.start();nodes.push(lfo);
  A.drone={stop(){g.gain.linearRampToValueAtTime(0,C.currentTime+1.5);setTimeout(()=>nodes.forEach(x=>{try{x.stop()}catch(e){}}),1700)}};
}
function growlLevel(v){if(!A.growl||!A.ctx)return;A.growl.g.gain.setTargetAtTime(A.muted?0:clamp(v,0,1)*.22,A.ctx.currentTime,.25)}

/* =====================================================================
   CONTROLES
   ===================================================================== */
const keys={};const joy={x:0,y:0};const mouse={x:0,y:0,t:-99,on:false};
const touchState={run:false};
function clearKeys(){for(const k in keys)keys[k]=false;joy.x=joy.y=0;touchState.run=false}
addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.t=performance.now();mouse.on=true});
const joyEl=$('#joy'),knob=$('#knob');let joyId=null;
function joyMove(e){const r=joyEl.getBoundingClientRect();let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy),mx=46;
  if(m>mx){dx=dx/m*mx;dy=dy/m*mx}knob.style.transform=`translate(${dx}px,${dy}px)`;joy.x=dx/mx;joy.y=dy/mx}
joyEl.addEventListener('pointerdown',e=>{joyId=e.pointerId;joyEl.setPointerCapture(e.pointerId);joyMove(e)});
joyEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e)});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;joy.x=joy.y=0;knob.style.transform=''};
joyEl.addEventListener('pointerup',joyEnd);joyEl.addEventListener('pointercancel',joyEnd);

/* =====================================================================
   MAPAS
   ===================================================================== */
class MB{
  constructor(w,h,fill){this.w=w;this.h=h;this.g=[];for(let y=0;y<h;y++)this.g.push(new Array(w).fill(fill||'#'))}
  set(x,y,c){if(x>=0&&y>=0&&x<this.w&&y<this.h)this.g[y][x]=c;return this}
  get(x,y){return(x>=0&&y>=0&&x<this.w&&y<this.h)?this.g[y][x]:'#'}
  rect(x0,y0,x1,y1,c){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)this.set(x,y,c);return this}
  room(x0,y0,x1,y1,f){return this.rect(x0,y0,x1,y1,f)}
  box(x0,y0,x1,y1,wall,f){this.rect(x0,y0,x1,y1,wall);if(f)this.rect(x0+1,y0+1,x1-1,y1-1,f);return this}
  pts(arr,c){arr.forEach(([x,y])=>this.set(x,y,c));return this}
  hl(x0,x1,y,c){return this.rect(x0,y,x1,y,c)}
  vl(x,y0,y1,c){return this.rect(x,y0,x,y1,c)}
}
const SOLID=new Set('#WBTKSbAPXRGFHZYENMQIOUCLJV'.split(''));
const OPAQUE=new Set('#WBAQHZLMO'.split(''));
const FLOORS=new Set('.wcpotmsgdruv=xD'.split(''));

/* ---------- dibujo de tiles (capa estática por área) ---------- */
function floorAt(area,x,y){
  // para puertas/marcas: el piso más común alrededor
  const g=area.grid;const c={};
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const ch=(g[y+dy]||[])[x+dx];if(ch&&'wcpotmsgdru'.includes(ch))c[ch]=(c[ch]||0)+1});
  let best=area.floor||'w',bn=0;for(const k in c)if(c[k]>bn){bn=c[k];best=k}return best;
}
function drawFloor(c,ch,x,y,tx,ty,area){
  const h=hh(tx,ty);
  switch(ch){
    case 'w':c.fillStyle=ty%2?'#2c1f17':'#281c15';c.fillRect(x,y,T,T);c.fillStyle='rgba(0,0,0,.35)';c.fillRect(x,y+T-1,T,1);c.fillRect(x+((ty*13)%T),y,1,T);if(h>.85){c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x+h*20,y+8,6,2)}break;
    case 'c':c.fillStyle='#34121a';c.fillRect(x,y,T,T);if((tx+ty)%2===0){c.fillStyle='rgba(180,120,50,.07)';c.beginPath();c.moveTo(x+16,y+7);c.lineTo(x+25,y+16);c.lineTo(x+16,y+25);c.lineTo(x+7,y+16);c.fill()}break;
    case 'p':c.fillStyle='#261630';c.fillRect(x,y,T,T);c.fillStyle='rgba(255,255,255,.03)';if(h>.5)c.fillRect(x+4,y+4,3,3);break;
    case 'o':{c.fillStyle='#3a1416';c.fillRect(x,y,T,T);const g=area.grid;c.fillStyle='#7a5a24';
      if((g[ty-1]||[])[tx]!=='o')c.fillRect(x,y+3,T,2);if((g[ty+1]||[])[tx]!=='o')c.fillRect(x,y+T-5,T,2);if(g[ty][tx-1]!=='o')c.fillRect(x+3,y,2,T);if(g[ty][tx+1]!=='o')c.fillRect(x+T-5,y,2,T);break}
    case 't':c.fillStyle=(tx+ty)%2?'#2f2e35':'#24232a';c.fillRect(x,y,T,T);c.fillStyle='rgba(0,0,0,.4)';c.fillRect(x,y,T,1);c.fillRect(x,y,1,T);if(h>.8){c.fillStyle='rgba(60,10,10,.35)';c.fillRect(x+h*18,y+10,8,5)}break;
    case 'm':c.fillStyle=(tx+ty)%2?'#312d37':'#29262f';c.fillRect(x,y,T,T);if(h>.55){c.strokeStyle='rgba(255,255,255,.05)';c.beginPath();c.moveTo(x+h*T,y);c.lineTo(x+T,y+h*T);c.stroke()}break;
    case 's':c.fillStyle=h>.5?'#26252a':'#232227';c.fillRect(x,y,T,T);c.fillStyle='rgba(0,0,0,.4)';c.fillRect(x,y+((tx%2)?0:16),T,1);c.fillRect(x+((ty%2)?8:24),y,1,T);if(h>.9){c.fillStyle='rgba(30,40,25,.5)';c.fillRect(x+6,y+6,9,7)}break;
    case 'g':c.fillStyle=h>.5?'#141d16':'#121a14';c.fillRect(x,y,T,T);c.fillStyle='#1b281c';for(let i=0;i<4;i++){const a=hh(tx*7+i,ty*3);c.fillRect(x+a*30,y+hh(i,tx+ty)*30,1,3)}break;
    case 'd':c.fillStyle='#231a12';c.fillRect(x,y,T,T);c.fillStyle='rgba(0,0,0,.3)';if(h>.6)c.fillRect(x+h*24,y+12,5,3);break;
    case 'r':c.fillStyle='#29251f';c.fillRect(x,y,T,T);c.fillStyle='#38322a';for(let i=0;i<6;i++)c.fillRect(x+hh(tx+i,ty)*30,y+hh(ty+i,tx)*30,2,2);break;
    case 'u':c.fillStyle='#1d1610';c.fillRect(x,y,T,T);c.fillStyle='rgba(120,140,150,.06)';c.fillRect(x+h*14,y+6,14,3);break;
    case 'v':c.fillStyle='#0b151b';c.fillRect(x,y,T,T);c.fillStyle='rgba(120,160,180,.06)';c.fillRect(x+h*10,y+(tx%3)*9,16,1);break;
    case '=':c.fillStyle='#2b2019';c.fillRect(x,y,T,T);c.fillStyle='#3a2c22';for(let i=0;i<4;i++)c.fillRect(x,y+i*8,T,5);c.fillStyle='rgba(0,0,0,.4)';for(let i=0;i<4;i++)c.fillRect(x,y+i*8+5,T,3);break;
    case 'x':drawFloor(c,'s',x,y,tx,ty,area);c.fillStyle='#bdb39a';if(h>.4){c.fillRect(x+6+h*10,y+14,10,2);c.beginPath();c.arc(x+20,y+20,3,0,7);c.fill()}break;
    default:drawFloor(c,area.floor||'w',x,y,tx,ty,area);
  }
}
function wallFaceColor(area){return area.pared||'#2a1e2a'}
function isWallCh(ch){return ch==='#'||ch==='W'||ch==='L'||ch===undefined}
function drawTile(c,area,tx,ty){
  const g=area.grid,ch=g[ty][tx],x=tx*T,y=ty*T;
  const n=(dx,dy)=>(g[ty+dy]||[])[tx+dx];
  if(FLOORS.has(ch)&&ch!=='D'){drawFloor(c,ch,x,y,tx,ty,area);return}
  if(ch==='#'||ch==='W'){
    c.fillStyle=area.techo||'#0b090e';c.fillRect(x,y,T,T);
    const below=n(0,1);
    if(below!==undefined&&!isWallCh(below)&&!OPAQUE.has(below)){
      const fc=wallFaceColor(area);c.fillStyle=fc;c.fillRect(x,y+T-20,T,20);
      if(area.ladrillo){c.fillStyle='rgba(0,0,0,.35)';c.fillRect(x,y+T-10,T,1);c.fillRect(x+(tx%2?8:24),y+T-20,1,10);c.fillRect(x+(tx%2?24:8),y+T-10,1,10)}
      else{c.fillStyle='rgba(255,255,255,.03)';for(let i=0;i<T;i+=8)c.fillRect(x+i,y+T-20,3,20)}
      c.fillStyle='#3a2a1e';c.fillRect(x,y+T-3,T,3);c.fillStyle='rgba(0,0,0,.6)';c.fillRect(x,y+T-21,T,2);
      if(hh(tx,ty*3)>.9&&!area.exterior){c.fillStyle='rgba(70,10,10,.35)';c.fillRect(x+hh(ty,tx)*20,y+T-18,3,10+hh(tx,ty)*8)}
    }
    if(ch==='W'){
      // ventana: si da a un piso, la dibujamos en la cara; si es lateral, como franja
      const vertical=!(below!==undefined&&!isWallCh(below));
      c.fillStyle='#141c2c';
      if(vertical){c.fillRect(x+10,y+3,12,T-6);c.fillStyle='#0a0f18';c.fillRect(x+15,y+3,2,T-6)}
      else{c.fillRect(x+5,y+T-18,T-10,13);c.fillStyle='#0a0f18';c.fillRect(x+15,y+T-18,2,13)}
    }
    return;
  }
  // puertas
  if(ch==='D'||ch==='L'){
    drawFloor(c,floorAt(area,tx,ty),x,y,tx,ty,area);
    const horiz=isWallCh(n(-1,0))||isWallCh(n(1,0))||OPAQUE.has(n(-1,0));
    if(ch==='D'){
      c.fillStyle='#120e10';
      if(horiz){c.fillRect(x,y,3,T);c.fillRect(x+T-3,y,3,T);c.fillStyle='#3a2616';c.fillRect(x+3,y,4,T-4)}
      else{c.fillRect(x,y,T,3);c.fillRect(x,y+T-3,T,3);c.fillStyle='#3a2616';c.fillRect(x,y+3,T-4,4)}
    }else{
      c.fillStyle='#3d2614';c.fillRect(x+1,y+1,T-2,T-2);c.fillStyle='#2a1a0e';
      if(horiz)for(let i=4;i<T;i+=7)c.fillRect(x+i,y+2,1,T-4);else for(let i=4;i<T;i+=7)c.fillRect(x+2,y+i,T-4,1);
      c.fillStyle='#6a6a70';c.fillRect(x+T/2-3,y+T/2-3,6,6);c.fillStyle='#1a1a1a';c.fillRect(x+T/2-1,y+T/2-1,2,3);
    }
    return;
  }
  // muebles sobre piso
  drawFloor(c,floorAt(area,tx,ty),x,y,tx,ty,area);
  const same=(dx,dy)=>n(dx,dy)===ch;
  switch(ch){
    case 'B':{c.fillStyle='#24160d';c.fillRect(x,y,T,T);c.fillStyle='#120a05';c.fillRect(x+2,y+2,T-4,T-4);
      const cols=['#4a1a1a','#1a2a4a','#2a3a1a','#4a3a1a','#3a1a3a','#1a1a1a','#5a4a3a'];
      for(let r=0;r<2;r++){let bx=x+3;const by=y+3+r*14;while(bx<x+T-4){const q=hh(bx|0,ty*5+r+tx);const bw=2+Math.floor(q*3);c.fillStyle=cols[Math.floor(q*7)];c.fillRect(bx,by+(q>.85?3:0),bw,11-(q>.85?3:0));bx+=bw+1}
        c.fillStyle='#24160d';c.fillRect(x+2,by+11,T-4,3)}break}
    case 'T':{c.fillStyle='#4a2f1c';c.fillRect(x,y,T,T);c.fillStyle='#57381f';c.fillRect(x+(same(-1,0)?0:2),y+(same(0,-1)?0:2),T-(same(-1,0)?0:2)-(same(1,0)?0:2),T-(same(0,-1)?0:2)-(same(0,1)?0:6));
      if(!same(0,1)){c.fillStyle='#2a1a0e';c.fillRect(x,y+T-6,T,6)}break}
    case 'K':c.fillStyle='#3a3640';c.fillRect(x,y,T,T);c.fillStyle='#4a4652';c.fillRect(x,y,T,T-10);c.fillStyle='#3a2414';c.fillRect(x,y+T-10,T,10);c.fillStyle='#1a1010';c.fillRect(x+T/2-1,y+T-8,2,5);break;
    case 'S':c.fillStyle='#111114';c.fillRect(x,y,T,T);c.fillStyle='#24242a';c.beginPath();c.arc(x+10,y+11,6,0,7);c.arc(x+23,y+11,6,0,7);c.fill();c.fillStyle='#000';c.fillRect(x+4,y+T-9,T-8,6);break;
    case 'b':{c.fillStyle='#2a1a10';c.fillRect(x,y,T,T);const top=!same(0,-1);c.fillStyle='#9a9284';c.fillRect(x+(same(-1,0)?0:3),y+(top?3:0),T-(same(-1,0)?0:3)-(same(1,0)?0:3),T-(top?3:0)-(same(0,1)?0:4));
      if(top){c.fillStyle='#c8c0b0';c.fillRect(x+6,y+5,T-12,8)}else{c.fillStyle='rgba(60,40,40,.25)';c.fillRect(x+4,y+4,T-8,T-10)}
      if(hh(tx,ty)>.7){c.fillStyle='rgba(90,10,10,.5)';c.beginPath();c.arc(x+16,y+18,5,0,7);c.fill()}break}
    case 'A':c.fillStyle='#22140b';c.fillRect(x+1,y,T-2,T);c.fillStyle='#2e1c10';c.fillRect(x+3,y+2,T/2-4,T-4);c.fillRect(x+T/2+1,y+2,T/2-4,T-4);c.fillStyle='#8a7a40';c.fillRect(x+T/2-3,y+T/2-2,2,5);c.fillRect(x+T/2+1,y+T/2-2,2,5);c.fillStyle='rgba(0,0,0,.5)';for(let i=6;i<T-4;i+=4)c.fillRect(x+5,y+i,T-10,1);break;
    case 'P':c.fillStyle='#08080a';c.fillRect(x,y,T,T);c.fillStyle='#16161c';c.fillRect(x+2,y+2,T-4,T-12);if(!same(0,1)){c.fillStyle='#d8d2c4';c.fillRect(x,y+T-10,T,8);c.fillStyle='#08080a';for(let i=2;i<T;i+=6)c.fillRect(x+i,y+T-10,3,5)}break;
    case 'X':c.fillStyle='#4a3420';c.fillRect(x+2,y+2,T-4,T-4);c.strokeStyle='#2a1a0c';c.lineWidth=2;c.strokeRect(x+3,y+3,T-6,T-6);c.beginPath();c.moveTo(x+3,y+3);c.lineTo(x+T-3,y+T-3);c.stroke();c.lineWidth=1;break;
    case 'R':c.fillStyle='#3a2414';c.beginPath();c.arc(x+16,y+16,13,0,7);c.fill();c.strokeStyle='#18100a';c.lineWidth=2;c.beginPath();c.arc(x+16,y+16,10,0,7);c.stroke();c.beginPath();c.arc(x+16,y+16,5,0,7);c.stroke();c.lineWidth=1;break;
    case 'G':{c.fillStyle='rgba(0,0,0,.4)';c.fillRect(x+6,y+24,22,5);c.fillStyle=hh(tx,ty)>.5?'#55525a':'#4a4750';c.beginPath();c.moveTo(x+7,y+26);c.lineTo(x+7,y+11);c.quadraticCurveTo(x+16,y+1,x+25,y+11);c.lineTo(x+25,y+26);c.fill();
      c.fillStyle='rgba(0,0,0,.35)';c.fillRect(x+15,y+10,2,10);c.fillRect(x+11,y+13,10,2);if(hh(ty,tx)>.6){c.fillStyle='#2a3a24';c.fillRect(x+7,y+21,8,5)}break}
    case 'F':c.fillStyle='#1a1a1e';for(let i=2;i<T;i+=6)c.fillRect(x+i,y+2,2,T-4);c.fillRect(x,y+6,T,2);c.fillRect(x,y+T-8,T,2);break;
    case 'H':c.fillStyle='#0d1a0f';c.fillRect(x,y,T,T);c.fillStyle='#132416';for(let i=0;i<5;i++){c.beginPath();c.arc(x+hh(tx+i,ty)*T,y+hh(ty+i,tx)*T,6+hh(i,tx)*5,0,7);c.fill()}break;
    case 'Z':c.fillStyle='#1a120c';c.fillRect(x+12,y+8,8,T-8);c.fillStyle='rgba(8,14,9,.95)';c.beginPath();c.arc(x+16,y+10,19,0,7);c.fill();c.fillStyle='#0f1a11';c.beginPath();c.arc(x+12,y+6,10,0,7);c.arc(x+22,y+12,9,0,7);c.fill();break;
    case 'Y':c.fillStyle='#3a3640';c.fillRect(x,y,T,T);c.fillStyle='#5a1414';c.fillRect(x,y+4,T,T-14);c.fillStyle='#8a7030';c.fillRect(x,y+T-12,T,2);break;
    case 'E':c.fillStyle='#2e1c10';c.fillRect(x,y+8,T,14);c.fillStyle='#3e2818';c.fillRect(x,y+8,T,4);c.fillStyle='#1a0f08';c.fillRect(x,y+20,T,3);break;
    case 'N':c.fillStyle='#1a120c';c.beginPath();c.moveTo(x+10,y+1);c.lineTo(x+22,y+1);c.lineTo(x+28,y+9);c.lineTo(x+24,y+31);c.lineTo(x+8,y+31);c.lineTo(x+4,y+9);c.fill();c.strokeStyle='#4a3a2a';c.stroke();c.fillStyle='#4a3a2a';c.fillRect(x+15,y+8,2,12);c.fillRect(x+11,y+11,10,2);break;
    case 'M':c.fillStyle='#202024';c.fillRect(x,y,T,T);c.fillStyle='#2e2e34';c.beginPath();c.arc(x+16,y+16,13,0,7);c.fill();c.fillStyle='#d8d0b0';c.beginPath();c.arc(x+16,y+14,5,0,7);c.fill();c.strokeStyle='#a01010';c.beginPath();c.moveTo(x+16,y+14);c.lineTo(x+19,y+11);c.stroke();c.fillStyle='#4a3a2a';c.fillRect(x,y+26,T,3);break;
    case 'Q':c.fillStyle='#2e2a2e';c.fillRect(x,y,T,T);c.fillStyle='#050404';c.fillRect(x+4,y+8,T-8,T-8);c.fillStyle='#4a4048';c.fillRect(x,y,T,6);break;
    case 'I':c.fillStyle='#2e1c10';c.fillRect(x+1,y+1,T-2,T-2);c.fillStyle='#1a0f08';c.fillRect(x+3,y+T/2-1,T-6,1);c.fillRect(x+3,y+8,T-6,1);c.fillStyle='#8a7a40';c.fillRect(x+T/2-2,y+12,4,2);c.fillRect(x+T/2-2,y+22,4,2);break;
    case 'O':c.fillStyle='rgba(0,0,0,.4)';c.beginPath();c.ellipse(x+17,y+26,12,5,0,0,7);c.fill();c.fillStyle='#5a5660';c.beginPath();c.arc(x+16,y+16,11,0,7);c.fill();c.fillStyle='#6a6670';c.beginPath();c.arc(x+13,y+13,5,0,7);c.fill();break;
    case 'U':c.fillStyle='#cfc8b8';c.beginPath();c.ellipse(x+16,y+16,14,12,0,0,7);c.fill();c.fillStyle='#4a3a2a';c.beginPath();c.ellipse(x+16,y+16,10,8,0,0,7);c.fill();c.fillStyle='rgba(80,10,10,.35)';c.beginPath();c.ellipse(x+17,y+18,7,5,0,0,7);c.fill();break;
    case 'C':c.fillStyle='#3a1015';c.fillRect(x+4,y+4,T-8,T-8);c.fillStyle='#4e1820';c.fillRect(x+6,y+6,T-12,T-16);break;
    case 'J':c.fillStyle='#a89e88';for(let i=0;i<5;i++){c.fillRect(x+hh(tx+i,ty)*22+2,y+hh(ty,tx+i)*24+4,10,3)}c.beginPath();c.arc(x+16,y+14,6,0,7);c.fill();c.fillStyle='#1a1410';c.fillRect(x+12,y+12,3,3);c.fillRect(x+18,y+12,3,3);break;
    case 'V':c.fillStyle='#2a2a2e';for(let i=3;i<T;i+=6)c.fillRect(x+i,y,2,T);c.fillRect(x,y+3,T,2);c.fillRect(x,y+T-5,T,2);break;
  }
}
function renderStatic(area){
  const W=area.w,H=area.h;
  if(!area.cv){area.cv=document.createElement('canvas');area.cv.width=W*T;area.cv.height=H*T}
  const c=area.cv.getContext('2d');c.clearRect(0,0,W*T,H*T);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)drawTile(c,area,x,y);
  area.dirty=false;
}

/* =====================================================================
   PERSONAJES Y CRIATURAS
   ===================================================================== */
function ell(c,x,y,rx,ry,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill()}
function circ(c,x,y,r,col){c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}
function rr(c,x,y,w,h,r,col){c.fillStyle=col;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill()}
function drawPerson(c,x,y,o,fx,fy,walk,moving,t){
  const b=moving?Math.abs(Math.sin(walk))*-2:Math.sin(t*1.7+x)*.5;
  ell(c,x,y+12,10,4,'rgba(0,0,0,.45)');
  const l=moving?Math.sin(walk)*3:0;
  c.fillStyle=o.legs||'#121016';c.fillRect(x-6,y+1+b,4,10+l);c.fillRect(x+2,y+1+b,4,10-l);
  if(o.hairT==='long')rr(c,x-9,y-21+b,18,20,6,o.hair);
  rr(c,x-9,y-11+b,18,15,4,o.coat);
  if(o.apron)c.fillStyle='#d8d0c0',c.fillRect(x-6,y-8+b,12,12);
  if(o.trench){c.fillStyle='rgba(0,0,0,.3)';c.fillRect(x-1,y-11+b,2,15);c.fillStyle=o.belt||'#3a2a18';c.fillRect(x-9,y-3+b,18,2)}
  if(o.blood){c.fillStyle='rgba(120,10,10,.8)';c.fillRect(x-4,y-6+b,6,8)}
  circ(c,x,y-16+b,7.5,o.skin);
  c.fillStyle=o.hair;
  if(o.hairT==='bun'){circ(c,x,y-22+b,5,o.hair);c.beginPath();c.arc(x,y-17+b,7.7,Math.PI,0);c.fill()}
  else if(o.hairT==='long'){c.beginPath();c.arc(x,y-17+b,8,Math.PI,0);c.fill()}
  else if(o.hairT==='short'){c.beginPath();c.arc(x,y-17+b,7.9,Math.PI*1.05,-.05);c.fill()}
  const ex=fx*2.2,ey=fy>0?1:fy<0?-2:0;
  if(fy>-.6){c.fillStyle='#120e12';c.fillRect(x-3.5+ex,y-16+b+ey,2,2.2);c.fillRect(x+1.5+ex,y-16+b+ey,2,2.2)}
  if(o.glasses&&fy>-.6){c.strokeStyle='#ccc';c.lineWidth=1;c.strokeRect(x-4.5+ex,y-17+b+ey,4,4);c.strokeRect(x+.5+ex,y-17+b+ey,4,4)}
  if(o.hat==='fedora'){c.fillStyle='#2a1c12';c.fillRect(x-11,y-21+b,22,3);rr(c,x-7,y-28+b,14,8,3,'#3a2818');c.fillStyle='#0e0a08';c.fillRect(x-7,y-23+b,14,2)}
  if(o.hat==='cap')rr(c,x-7,y-25+b,14,6,3,'#e8e2d6');
  if(o.hat==='straw'){ell(c,x,y-21+b,12,3.5,'#a8843a');rr(c,x-6,y-27+b,12,7,3,'#b8944a')}
}
/* criaturas */
function drawMonster(c,m,t,lit){
  const x=m.x,y=m.y;
  c.save();
  if(m.tipo==='sinrostro'){
    const tw=(m.state==='chase'?Math.sin(t*40)*1.5:0);
    ell(c,x,y+14,12,5,'rgba(0,0,0,.6)');
    c.fillStyle='#050406';c.fillRect(x-7+tw,y-6,5,20);c.fillRect(x+2-tw,y-6,5,20);
    rr(c,x-10,y-34,20,30,4,'#08070a');
    c.fillStyle='#0a090c';c.fillRect(x-15,y-30,5,34+Math.sin(t*3)*2);c.fillRect(x+10,y-30,5,34+Math.cos(t*3)*2);
    c.fillStyle='#d8d4ce';c.fillRect(x-17,y+2,4,6);c.fillRect(x+13,y+2,4,6);
    ell(c,x,y-44,9,11,'#e2ddd6');
    if(m.state==='chase'){c.fillStyle='#000';c.beginPath();c.ellipse(x,y-40,4,6+Math.sin(t*20)*2,0,0,7);c.fill()}
    c.fillStyle='rgba(0,0,0,.15)';c.fillRect(x-1,y-54,2,20);
  }else if(m.tipo==='cosa'){
    const k=Math.sin(t*14)*3;
    ell(c,x,y+8,18,7,'rgba(0,0,0,.55)');
    c.strokeStyle='#bdb5a8';c.lineWidth=3;c.lineCap='round';
    for(let i=0;i<4;i++){const s=i<2?-1:1,o=(i%2?8:-6);c.beginPath();c.moveTo(x+s*6,y+o*.4);c.lineTo(x+s*18,y+o-8+(i%2?k:-k));c.lineTo(x+s*24,y+o+6);c.stroke()}
    ell(c,x,y,13,10,'#cfc6b8');ell(c,x,y-10,9,8,'#d8d0c2');
    c.fillStyle='#200606';c.beginPath();c.ellipse(x,y-8,6,4+Math.abs(k),0,0,7);c.fill();
    c.fillStyle='#eee';for(let i=-4;i<=4;i+=2)c.fillRect(x+i,y-11,1,2);
    c.lineWidth=1;
  }else if(m.tipo==='novia'){
    const fl=m.frozen?0:Math.sin(t*30)*1.5;
    ell(c,x,y+12,11,4,'rgba(0,0,0,.55)');
    c.fillStyle='#d8d4cc';c.beginPath();c.moveTo(x-6,y-14);c.lineTo(x+6,y-14);c.lineTo(x+14+fl,y+12);c.lineTo(x-14-fl,y+12);c.fill();
    c.fillStyle='rgba(120,20,20,.6)';c.fillRect(x-3,y-2,6,10);
    c.fillStyle='#0c0a0a';c.beginPath();c.ellipse(x,y-20,8,10,0,0,7);c.fill();c.fillRect(x-8,y-20,16,22);
    c.fillStyle='rgba(230,230,235,.35)';c.beginPath();c.moveTo(x-9,y-30);c.lineTo(x+9,y-30);c.lineTo(x+13,y+6);c.lineTo(x-13,y+6);c.fill();
    c.fillStyle='#e0dcd6';c.fillRect(x-12,y-4,3,10);c.fillRect(x+9,y-4,3,10);
    if(!m.frozen&&Math.sin(t*9)>.6){c.fillStyle='#fff';c.fillRect(x-3,y-21,2,2);c.fillRect(x+1,y-21,2,2)}
  }
  c.restore();
}
/* susto a pantalla completa */
function scareFace(c,tipo,R,rr2,k){
  // cabeza alargada con piel enferma
  const skin=c.createRadialGradient(-R*.15,-R*.25,R*.1,0,0,R*1.05);
  skin.addColorStop(0,tipo==='cosa'?'#d8cfc0':'#cbc4b8');skin.addColorStop(.6,tipo==='cosa'?'#9a9080':'#8a8278');skin.addColorStop(1,'#2a2420');
  if(tipo==='novia'){c.fillStyle='#050404';c.beginPath();c.ellipse(0,R*.1,R*1.15,R*1.5,0,0,7);c.fill()}
  c.fillStyle=skin;c.beginPath();c.ellipse(0,0,R*.68,R*1.02,0,0,7);c.fill();
  // venas
  c.strokeStyle='rgba(70,30,80,.45)';c.lineWidth=R*.008;
  for(let i=0;i<14;i++){let x=(rr2()-.5)*R*1.1,y=(rr2()-.5)*R*1.6;c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++){x+=(rr2()-.5)*R*.18;y+=(rr2()-.5)*R*.18;c.lineTo(x,y)}c.stroke()}
  // ojos hundidos
  if(tipo!=='cosa'){
    [-1,1].forEach(sd=>{const ex=sd*R*.27,ey=-R*.22;
      if(tipo==='sinrostro'){c.strokeStyle='rgba(40,20,20,.5)';c.lineWidth=R*.012;c.beginPath();c.moveTo(ex-R*.12,ey);c.quadraticCurveTo(ex,ey+R*.03,ex+R*.12,ey);c.stroke();return}
      const g=c.createRadialGradient(ex,ey,0,ex,ey,R*.24);g.addColorStop(0,'#000');g.addColorStop(.55,'rgba(0,0,0,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=g;c.beginPath();c.ellipse(ex,ey,R*.24,R*.3,sd*.15,0,7);c.fill();
      c.fillStyle='#f4f0e8';c.beginPath();c.arc(ex+(rr2()-.5)*R*.02,ey+R*.02,R*.028,0,7);c.fill();
      // lágrimas de sangre
      c.fillStyle='rgba(110,0,0,.95)';const len=R*(.35+rr2()*.35)*Math.min(1,k*2.5);c.fillRect(ex-R*.012,ey+R*.12,R*.024,len);c.beginPath();c.arc(ex,ey+R*.12+len,R*.02,0,7);c.fill()})}
  // boca
  const mo=R*(.22+k*.55),mw=tipo==='cosa'?R*.5:R*.22,my=tipo==='cosa'?0:R*.42;
  const mg=c.createRadialGradient(0,my,0,0,my,Math.max(mw,mo));mg.addColorStop(0,'#000');mg.addColorStop(.8,'#0a0000');mg.addColorStop(1,'#3a0606');
  c.fillStyle=mg;c.beginPath();c.ellipse(0,my,mw,mo,0,0,7);c.fill();
  c.fillStyle='#d8d0b8';
  const nT=tipo==='cosa'?28:13;
  for(let i=0;i<nT;i++){
    if(tipo==='cosa'){const a=i/nT*Math.PI*2,r1=Math.min(mw,mo)*.95,r2=r1*(.55+rr2()*.2);c.beginPath();c.moveTo(Math.cos(a-.08)*r1,my+Math.sin(a-.08)*r1*(mo/mw));c.lineTo(Math.cos(a+.08)*r1,my+Math.sin(a+.08)*r1*(mo/mw));c.lineTo(Math.cos(a)*r2,my+Math.sin(a)*r2*(mo/mw));c.fill();continue}
    const xx=-mw+(i+.5)*(mw*2/nT),tl=mo*(.25+rr2()*.35),tw=mw*2/nT*.45;
    c.beginPath();c.moveTo(xx-tw,my-mo*.85);c.lineTo(xx+tw,my-mo*.85);c.lineTo(xx+(rr2()-.5)*tw,my-mo*.85+tl);c.fill();
    c.beginPath();c.moveTo(xx-tw,my+mo*.85);c.lineTo(xx+tw,my+mo*.85);c.lineTo(xx+(rr2()-.5)*tw,my+mo*.85-tl*.8);c.fill()}
  if(tipo==='novia'){c.strokeStyle='rgba(0,0,0,.85)';c.lineWidth=R*.012;for(let i=0;i<40;i++){const x=(rr2()-.5)*R*1.3;c.beginPath();c.moveTo(x,-R*1.1);c.bezierCurveTo(x+(rr2()-.5)*R*.3,-R*.3,x+(rr2()-.5)*R*.4,R*.3,x*.8+(rr2()-.5)*R*.2,R*1.3);c.stroke()}
    c.fillStyle='rgba(230,228,235,.22)';c.beginPath();c.ellipse(0,-R*.05,R*.95,R*1.3,0,0,7);c.fill()}
  // sombra inferior
  const sh=c.createLinearGradient(0,-R,0,R*1.1);sh.addColorStop(0,'rgba(0,0,0,.35)');sh.addColorStop(.4,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.7)');c.fillStyle=sh;c.beginPath();c.ellipse(0,0,R*.69,R*1.03,0,0,7);c.fill();
}
function drawScare(c,w,h,tipo,k,t,seed){
  if(k<.05){c.fillStyle='#fff';c.fillRect(0,0,w,h);return}
  if(k<.28&&(Math.floor(k*70)%5===0)){c.fillStyle='#000';c.fillRect(0,0,w,h);return}
  const s=Math.min(w,h),rr2=mulberry(seed||7);
  c.fillStyle='#000';c.fillRect(0,0,w,h);
  const z=.7+Math.pow(k,.45)*.9;const jx=(rnd()-.5)*s*.03,jy=(rnd()-.5)*s*.03;
  c.save();c.translate(w/2+jx,h/2+jy+s*.04);c.scale(z,z);scareFace(c,tipo,s*.46,mulberry(seed||7),k);c.restore();
  // fantasma rojo desplazado (aberración)
  c.save();c.globalAlpha=.22;c.globalCompositeOperation='lighter';c.translate(w/2+jx+s*.018,h/2+jy+s*.04);c.scale(z*1.02,z*1.02);c.fillStyle='rgba(160,0,0,1)';c.beginPath();c.ellipse(0,0,s*.46*.68,s*.46*1.02,0,0,7);c.fill();c.restore();
  const v=c.createRadialGradient(w/2,h/2,s*.25,w/2,h/2,Math.max(w,h)*.7);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(30,0,0,.9)');c.fillStyle=v;c.fillRect(0,0,w,h);
  c.fillStyle='rgba(255,255,255,.07)';for(let i=0;i<60;i++)c.fillRect(rnd()*w,rnd()*h,rnd()*w*.35,1+rnd()*2);
  c.fillStyle='rgba(0,0,0,.18)';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
}
