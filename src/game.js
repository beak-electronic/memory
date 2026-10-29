(function(){
"use strict";
var VERSION = "V1.06";
var PINK = "#dd007a", WHITE = "#ffffff", GREY = "#505050", LIGHT = "#b4b4b4", CARD_BACK = "#dd007a";
var CREDIT = "Soundeffekte: Ava (2)";
var FLIP_DUR = 0.40; // s, 3D-Kartendrehung
var SND_SRC = __SOUNDS__;
var MUS_SRC = __MUSIC__;
var LS_BEST = "bestueckungs-memory.v1.best";
var LS_TOP = "bestueckungs-memory.v1.top5";
var LS_LEVEL = "bestueckungs-memory.v1.level";
var LS_MUSIC = "bestueckungs-memory.v1.music";

/* =====================================================================
 * MOTIFS — zentrale, austauschbare Motivliste
 * ---------------------------------------------------------------------
 * Pro Bauteil: { part: <src|null>, symbol: <src|null>, label: "…" }
 *   src = null  → Canvas-Platzhalter (drawPlaceholder)
 *   src = string → Image-URL / relative Pfad / data:image/… URI
 *
 * Ideal für Daniels Motive (Bericht):
 *   Format: PNG (Transparenz) oder SVG
 *   Größe: 512×512 px (mind. 256×512 ok), quadratisch
 *   Motiv: zentriert, ~10 % Rand, dunkles Grau #505050 auf transparent
 *   Dateinamen-Vorschlag: motifs/<id>-part.png / motifs/<id>-symbol.png
 *   Dann hier part/symbol auf den Pfad setzen und neu bauen — fertig.
 * ===================================================================== */
var PART_IDS = [
  "resistor","ceramic","elko","led","diode","transistor",
  "ic","coil","switch","pot","crystal","battery","speaker"
];
var MOTIFS = {
  resistor:   { label: "widerstand",   part: null, symbol: null },
  ceramic:    { label: "keramik-c",    part: null, symbol: null },
  elko:       { label: "elko",         part: null, symbol: null },
  led:        { label: "led",          part: null, symbol: null },
  diode:      { label: "diode",        part: null, symbol: null },
  transistor: { label: "transistor",   part: null, symbol: null },
  ic:         { label: "ic",           part: null, symbol: null },
  coil:       { label: "spule",        part: null, symbol: null },
  switch:     { label: "schalter",     part: null, symbol: null },
  pot:        { label: "potentiometer",part: null, symbol: null },
  crystal:    { label: "quarz",        part: null, symbol: null },
  battery:    { label: "batterie",     part: null, symbol: null },
  speaker:    { label: "lautsprecher", part: null, symbol: null }
};
var motifImgs = {}; // key "id:part"|"id:symbol" → HTMLImageElement | null | "loading"|"fail"

function motifKey(id, face){ return id + ":" + face; }
function ensureMotifImage(id, face){
  var m = MOTIFS[id]; if(!m) return null;
  var src = face === "symbol" ? m.symbol : m.part;
  if(!src) return null;
  var k = motifKey(id, face);
  if(motifImgs[k] === "fail") return null;
  if(motifImgs[k] && motifImgs[k] !== "loading") return motifImgs[k];
  if(motifImgs[k] === "loading") return null;
  var img = new Image();
  motifImgs[k] = "loading";
  img.onload = function(){ motifImgs[k] = img; };
  img.onerror = function(){ motifImgs[k] = "fail"; };
  img.src = src;
  return null;
}
function preloadMotifs(){
  PART_IDS.forEach(function(id){
    ensureMotifImage(id, "part");
    ensureMotifImage(id, "symbol");
  });
}

/* ---- Level-Definitionen ----
 * pairs: Anzahl Paare
 * match: "identical" = zwei gleiche Bauteilbilder
 *        "mixed"     = Bauteil + Schaltsymbol
 */
var LEVELS = [
  { id: "level01", name: "level 01", pairs: 2, match: "identical" },
  { id: "level02", name: "level 02", pairs: 3, match: "identical" },
  { id: "level03", name: "level 03", pairs: 4, match: "identical" },
  { id: "level04", name: "level 04", pairs: 4, match: "mixed" },
  { id: "level05", name: "level 05", pairs: 5, match: "mixed" },
  { id: "level06", name: "level 06", pairs: 6, match: "mixed" },
  { id: "level07", name: "level 07", pairs: 6, match: "mixed" },
  { id: "level08", name: "level 08", pairs: 8, match: "mixed" },
  { id: "level09", name: "level 09", pairs: 8, match: "mixed" },
  { id: "level10", name: "level 10", pairs: 10, match: "mixed" }
];

/* ---- Bestenliste: lokal + optional Supabase (wie Breakout) ----
 * Online bleibt AUS, solange HS_URL / HS_KEY leer sind.
 * Für Online nötig: eigene Tabelle z. B. memory_scores
 *   (id, name text, moves int, time_ms int, level int, created_at)
 *   + anon select/insert Policies; dann URL+Key hier setzen.
 */
var HS_URL = ""; // z. B. "https://xxxx.supabase.co/rest/v1/memory_scores"
var HS_KEY = "";
var HS_ON = !!(HS_URL && HS_KEY && window.fetch) && (!navigator.webdriver || /[?&]hsonline=1\b/.test(location.search));
var OHS = { rows: null, state: "off", at: -1e9, sending: false };
function hsRefresh(){ if(!HS_ON){ OHS.state="off"; return; } /* stub ready for Breakout-style fetch */ }
function hsSubmit(){ if(!HS_ON) return; }

function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function pad2(n){ return (n<10?"0":"")+n; }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function fmt(n){ return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g," "); }
function rr(c,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
  c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
  c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
  c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r); c.closePath();
}
function shuffle(a){
  var i=a.length,j,t;
  while(i){ j=(Math.random()*i--)|0; t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function fmtTime(ms){
  var s=Math.floor(ms/1000), m=(s/60)|0; s=s%60;
  return m+":"+pad2(s);
}

function loadTop5(){
  try{
    var a=JSON.parse(lsGet(LS_TOP,"[]"));
    if(!Array.isArray(a)) return [];
    return a.filter(function(e){ return e && typeof e.moves==="number"; }).slice(0,5);
  }catch(e){ return []; }
}
function saveTop5(a){ lsSet(LS_TOP, JSON.stringify(a.slice(0,5))); }
function recordScore(){
  if(G.moves<=0) return;
  var entry={moves:G.moves, time:G.elapsed, level:G.levelIdx, date:new Date().toISOString().slice(0,10)};
  var top=loadTop5();
  top.push(entry);
  top.sort(function(a,b){ return a.moves-b.moves || a.time-b.time; });
  G.top5=top.slice(0,5);
  saveTop5(G.top5);
  var best=parseInt(lsGet(LS_BEST,"0"),10)||0;
  if(!best || G.moves<best){ lsSet(LS_BEST,String(G.moves)); G.isNewBest=true; G.best=G.moves; }
  else { G.best=best; G.isNewBest=false; }
  hsSubmit();
}

/* ---- canvas / layout ---- */
var canvas=document.getElementById("game");
var ctx=canvas.getContext("2d");
var safeEl=document.getElementById("safe");
var TOUCH_DEV=(navigator.maxTouchPoints||0)>0||("ontouchstart" in window);
var view={scale:1,ox:0,oy:0,dpr:1,cw:0,ch:0};
var LAY={mode:"port",LWc:390,LHc:780,u:1,logo:{cx:195,y:12,h:28},pause:{x:0,y:0,r:18}};

function readInsets(){
  try{ var cs=getComputedStyle(safeEl);
    return {t:parseFloat(cs.paddingTop)||0,r:parseFloat(cs.paddingRight)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0};
  }catch(e){ return {t:0,r:0,b:0,l:0}; }
}
function resize(){
  var cw=window.innerWidth, ch=window.innerHeight;
  // Retina/iPhone: volles devicePixelRatio (bis 3) — Cap 2 machte Logo/Pause unscharf
  var dpr=Math.min(window.devicePixelRatio||1, 3);
  var budget=TOUCH_DEV?8e6:12e6;
  if(cw*ch*dpr*dpr>budget) dpr=Math.max(1,Math.sqrt(budget/(cw*ch)));
  canvas.width=Math.max(1,Math.round(cw*dpr));
  canvas.height=Math.max(1,Math.round(ch*dpr));
  var ins=readInsets();
  var aw=Math.max(1,cw-ins.l-ins.r), ah=Math.max(1,ch-ins.t-ins.b), s;
  if(ah/aw>=1.05){
    LAY.mode="port"; LAY.LWc=390; s=aw/390; LAY.LHc=ah/s;
    if(LAY.LHc<700){ LAY.LHc=700; s=Math.min(aw/390,ah/700); }
  } else {
    LAY.mode="land"; LAY.LWc=1280; LAY.LHc=800; s=Math.min(aw/1280,ah/800);
  }
  // Ox/Oy auf Device-Pixel snappen → scharfer Text/UI auf Retina
  var ox=ins.l+(aw-LAY.LWc*s)/2, oy=ins.t+(ah-LAY.LHc*s)/2;
  ox=Math.round(ox*dpr)/dpr; oy=Math.round(oy*dpr)/dpr;
  view={scale:s,ox:ox,oy:oy,dpr:dpr,cw:cw,ch:ch};
  LAY.u=clamp((TOUCH_DEV?0.7:0.5)/s,1,1.55);
  layoutBoard();
}
window.addEventListener("resize",resize);
window.addEventListener("orientationchange",function(){ setTimeout(resize,120); });

/* ---- audio (Ava SFX + BEAK music) ---- */
var SND={ctx:null,out:null,buf:{},want:{},decoded:0,failed:0,unlocked:false,played:[],flipN:0};
var MUS={
  on: lsGet(LS_MUSIC,"1")!=="0",
  buf:{}, decoded:0, failed:0,
  gain:null, src:null, track:null, want:null,
  baseVol:0.20, duckVol:0.045, duckUntil:0,
  paused:false, offset:0, startedAt:0,
  toggled:0
};
function decodeB64Audio(b64, onOk, onFail){
  try{
    var bin=atob(b64), u8=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    // OfflineAudioContext dekodiert auch ohne Audiogerät / suspended (wichtig für WebKit)
    var OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    var ctx=OC ? new OC(1, 1, 44100) : SND.ctx;
    if(!ctx){ onFail(); return; }
    var p=ctx.decodeAudioData(u8.buffer, onOk, onFail);
    if(p&&p.catch) p.catch(onFail);
  }catch(e){ onFail(); }
}
function sndInit(){
  if(SND.ctx) return;
  var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  try{ SND.ctx=new AC(); }catch(e){ SND.ctx=null; return; }
  SND.out=SND.ctx.createGain(); SND.out.gain.value=0.9; SND.out.connect(SND.ctx.destination);
  MUS.gain=SND.ctx.createGain(); MUS.gain.gain.value=0; MUS.gain.connect(SND.ctx.destination);
  SND._decodeStarted=false;
}
function startDecodeIfNeeded(){
  if(!SND.ctx || SND._decodeStarted) return;
  SND._decodeStarted=true;
  Object.keys(SND_SRC).forEach(function(name){
    decodeB64Audio(SND_SRC[name],
      function(b){ SND.buf[name]=b; SND.decoded++; if(SND.want[name]&&performance.now()-SND.want[name]<2000){ delete SND.want[name]; sndStart(name); } },
      function(){ SND.failed++; });
  });
  Object.keys(MUS_SRC||{}).forEach(function(name){
    decodeB64Audio(MUS_SRC[name],
      function(b){
        MUS.buf[name]=b; MUS.decoded++;
        if(MUS.want===name){ MUS.want=null; musPlay(name, true); }
        else if(SND.unlocked && MUS.on) musSync();
      },
      function(){ MUS.failed++; });
  });
}
function sndUnlock(){
  sndInit(); var c=SND.ctx; if(!c) return;
  function go(){
    // Unlock ZUERST — WebKit-Headless wirft bei src.start/resume oft InvalidStateError
    SND.unlocked=true;
    try{ startDecodeIfNeeded(); }catch(e){}
    try{
      if(c.state!=="running"&&c.resume){ var rr=c.resume(); if(rr&&rr.catch) rr.catch(function(){}); }
    }catch(e){}
    try{
      var b=c.createBuffer(1,1,22050), src=c.createBufferSource(); src.buffer=b; src.connect(c.destination); src.start(0);
    }catch(e){}
    try{ musSync(); }catch(e){}
  }
  try{
    if(c.state!=="running"&&c.resume){
      var r=c.resume();
      if(r&&r.then) r.then(function(){ go(); }).catch(function(){ go(); });
      else go();
    } else go();
  }catch(e){ go(); }
}
["keydown","pointerdown","touchend","mousedown","click"].forEach(function(ev){ window.addEventListener(ev,sndUnlock,true); });
function sndStart(name){ try{ var src=SND.ctx.createBufferSource(); src.buffer=SND.buf[name]; src.connect(SND.out); src.start(0); }catch(e){} }
function musDuck(ms){
  MUS.duckUntil=performance.now()+(ms||700);
  musApplyGain();
  setTimeout(function(){ musApplyGain(); }, (ms||700)+40);
}
function playSnd(name){
  SND.played.push(name); if(SND.played.length>50) SND.played.shift();
  musDuck(name==="los-gehts"?1100:750);
  if(!SND.ctx) return;
  if(SND.buf[name]) sndStart(name); else SND.want[name]=performance.now();
}
/** Leiser Karton-/Papier-Wisch + Tick bei ~90°; WebAudio, Zufallsvariation. Unabhängig vom Musik-Schalter. */
function playFlipSnd(){
  if(!SND.ctx||!SND.unlocked) return;
  try{
    var ctx=SND.ctx, dur=0.085+Math.random()*0.045, sr=ctx.sampleRate|0;
    var n=Math.max(1, (sr*dur)|0), buf=ctx.createBuffer(1, n, sr), d=buf.getChannelData(0);
    var pitch=0.88+Math.random()*0.28, vol=0.07+Math.random()*0.035;
    var tickAt=(n*0.40)|0, i, t, env, noise, f, prev=0;
    for(i=0;i<n;i++){
      t=i/sr;
      env = t<0.006 ? (t/0.006) : Math.exp(-3.4*(t-0.006)/Math.max(1e-4,dur-0.006));
      noise=Math.random()*2-1;
      prev=prev*0.82+noise*0.18; // soft LP
      f=400*pitch+(160*pitch-400*pitch)*(i/(n-1));
      d[i]=env*vol*(0.62*prev + 0.22*Math.sin(2*Math.PI*f*t));
    }
    for(i=0;i<(0.016*sr)|0;i++){
      var j=tickAt+i; if(j<0||j>=n) continue;
      var te=i/(0.016*sr), e=Math.sin(Math.PI*te);
      d[j]+=0.28*vol*e*Math.sin(2*Math.PI*88*pitch*(i/sr));
      d[j]+=0.08*vol*e*(Math.random()*2-1);
    }
    for(i=0;i<n;i++){ if(d[i]>0.9)d[i]=0.9; else if(d[i]<-0.9)d[i]=-0.9; }
    var src=ctx.createBufferSource(); src.buffer=buf;
    var g=ctx.createGain(); g.gain.value=1;
    src.connect(g); g.connect(SND.out); src.start(0);
    SND.flipN++;
  }catch(e){}
}
function musApplyGain(){
  if(!MUS.gain||!SND.ctx) return;
  var now=SND.ctx.currentTime;
  var silent=!MUS.on || MUS.paused || (typeof document!=="undefined" && document.hidden);
  var duck=performance.now()<MUS.duckUntil;
  var target=silent?0:(duck?MUS.duckVol:MUS.baseVol);
  try{
    MUS.gain.gain.cancelScheduledValues(now);
    MUS.gain.gain.setTargetAtTime(target, now, 0.04);
  }catch(e){ MUS.gain.gain.value=target; }
}
function musStopKeepOffset(){
  if(MUS.src && MUS.track && MUS.buf[MUS.track] && SND.ctx){
    var dur=MUS.buf[MUS.track].duration||1;
    MUS.offset=((SND.ctx.currentTime-MUS.startedAt)+MUS.offset)%dur;
    if(MUS.offset<0) MUS.offset=0;
  }
  if(MUS.src){
    try{ MUS.src.onended=null; MUS.src.stop(0); }catch(e){}
    MUS.src=null;
  }
}
function musPlay(name, forceRestart){
  if(!MUS.on||!SND.unlocked) return;
  sndInit();
  if(!SND.ctx||!MUS.gain) return;
  if(!MUS.buf[name]){ MUS.want=name; return; }
  if(!forceRestart && MUS.track===name && MUS.src && !MUS.paused) return;
  var offset=(!forceRestart && MUS.track===name)?MUS.offset:0;
  musStopKeepOffset();
  if(forceRestart || MUS.track!==name){ offset=0; MUS.offset=0; }
  MUS.paused=false; MUS.track=name;
  try{
    if(SND.ctx.state!=="running" && SND.ctx.resume){
      try{ SND.ctx.resume(); }catch(e0){}
    }
    var src=SND.ctx.createBufferSource();
    src.buffer=MUS.buf[name];
    src.loop=true;
    src.connect(MUS.gain);
    src.start(0, offset%MUS.buf[name].duration);
    MUS.src=src; MUS.startedAt=SND.ctx.currentTime; MUS.offset=offset;
    musApplyGain();
  }catch(e){ MUS.src=null; MUS.want=name; }
}
function musDesired(){
  if(G.screen==="start"||G.screen==="info") return "titel";
  if(G.screen==="game"||G.screen==="win"||G.screen==="pause") return "memory";
  return "titel";
}
function musSync(){
  if(!SND.unlocked) return;
  if(SND.ctx && SND.ctx.state!=="running" && SND.ctx.resume){
    try{ var r=SND.ctx.resume(); if(r&&r.then) r.then(function(){ startDecodeIfNeeded(); }); }catch(e){}
  }
  startDecodeIfNeeded();
  var hide=(typeof document!=="undefined" && document.hidden);
  var shouldPause=(G.screen==="pause")||hide;
  if(!MUS.on){
    musStopKeepOffset(); MUS.paused=true; musApplyGain(); return;
  }
  var want=musDesired();
  if(shouldPause){
    if(MUS.src) musStopKeepOffset();
    MUS.paused=true; MUS.track=want; musApplyGain();
    return;
  }
  if(MUS.paused || MUS.track!==want || !MUS.src){
    musPlay(want, MUS.track!==want);
  } else {
    musApplyGain();
  }
}
function musToggle(){
  MUS.on=!MUS.on;
  lsSet(LS_MUSIC, MUS.on?"1":"0");
  MUS.toggled++;
  if(!MUS.on){ musStopKeepOffset(); MUS.paused=true; musApplyGain(); }
  else { MUS.offset=0; musSync(); }
}
document.addEventListener("visibilitychange", function(){ musSync(); });

/* ---- game state ---- */
var G={
  screen:"start", // start | game | win | info | pause
  levelIdx:0,
  cards:[],
  cols:2, rows:2,
  flipped:[],
  lock:false,
  animating:0,
  moves:0,
  matched:0,
  pairs:0,
  elapsed:0,
  running:false,
  startAt:0,
  focus:0,
  feedbackT:0,
  feedbackMsg:"",
  feedbackKind:"ok",
  winT:0,
  buttons:[],
  cardRects:[],
  field:null,
  top5:loadTop5(),
  best:parseInt(lsGet(LS_BEST,"0"),10)||0,
  isNewBest:false,
  mismatchDelay:0,
  mismatchIds:[],
  touchUI:TOUCH_DEV
};

function pickParts(n){
  var pool=PART_IDS.slice();
  shuffle(pool);
  return pool.slice(0,n);
}

function buildDeck(level){
  var parts=pickParts(level.pairs);
  var cards=[], i, id=0;
  for(i=0;i<parts.length;i++){
    var p=parts[i];
    if(level.match==="identical"){
      cards.push({uid:id++, pair:i, part:p, face:"part"});
      cards.push({uid:id++, pair:i, part:p, face:"part"});
    } else {
      cards.push({uid:id++, pair:i, part:p, face:"part"});
      cards.push({uid:id++, pair:i, part:p, face:"symbol"});
    }
  }
  shuffle(cards);
  cards.forEach(function(c){ c.flipped=false; c.matched=false; c.anim=null; });
  return cards;
}

function gridFor(nCards){
  if(nCards<=4) return {cols:2, rows:2};
  if(nCards<=6) return {cols:3, rows:2};
  if(nCards<=8) return {cols:4, rows:2};
  if(nCards<=9) return {cols:3, rows:3};
  if(nCards<=12) return {cols:4, rows:3};
  if(nCards<=16) return {cols:4, rows:4};
  if(nCards<=20) return {cols:5, rows:4};
  return {cols:5, rows:Math.ceil(nCards/5)};
}

function startLevel(idx){
  var L=LEVELS[idx]; if(!L) return;
  G.levelIdx=idx;
  G.cards=buildDeck(L);
  G.pairs=L.pairs;
  var g=gridFor(G.cards.length);
  G.cols=g.cols; G.rows=g.rows;
  G.flipped=[];
  G.lock=false;
  G.moves=0;
  G.matched=0;
  G.elapsed=0;
  G.running=true;
  G.startAt=performance.now();
  G.focus=0;
  G.feedbackT=0;
  G.mismatchDelay=0;
  G.mismatchIds=[];
  G.animating=0;
  G.screen="game";
  G.winT=0;
  G.isNewBest=false;
  lsSet(LS_LEVEL, String(idx));
  layoutBoard();
  playSnd("los-gehts");
  musSync();
}

function layoutBoard(){
  var Lw=LAY.LWc, Lh=LAY.LHc, u=LAY.u, port=LAY.mode==="port";
  var top, bottomBar, sidePad, gap;
  if(port){
    // Statusleiste fest am unteren Rand (wie Breakout); Spielfeld nutzt den Platz darüber
    top=52*u;
    bottomBar=108*u; // Platz für Stats + Credit + Version (+ safe-area via view insets)
    sidePad=14*u;
    gap=10*u;
    LAY.logo={cx:Lw/2, y:10*u, h:26*u};
    LAY.pause={x:Lw-28*u, y:18*u, r:16*u};
    LAY.music={x:LAY.pause.x-LAY.pause.r*2.7, y:LAY.pause.y, r:LAY.pause.r};
  } else {
    top=56;
    bottomBar=0;
    sidePad=24;
    gap=12;
    LAY.logo={cx:Lw*0.72, y:18, h:32};
    LAY.pause={x:Lw-40, y:28, r:18};
    LAY.music={x:LAY.pause.x-LAY.pause.r*2.7, y:LAY.pause.y, r:LAY.pause.r};
  }
  var availW=port ? (Lw-sidePad*2) : Math.min(720, Lw*0.55);
  var availH=port ? (Lh-top-bottomBar-8*u) : (Lh-top-40);
  var cols=G.cols||2, rows=G.rows||2;
  var cellW=(availW-(cols-1)*gap)/cols;
  var cellH=(availH-(rows-1)*gap)/rows;
  var size=Math.floor(Math.min(cellW, cellH));
  size=Math.max(48, size);
  var boardW=cols*size+(cols-1)*gap;
  var boardH=rows*size+(rows-1)*gap;
  var fx=port ? (Lw-boardW)/2 : 48;
  var fy=top + Math.max(0, (availH-boardH)/2);
  if(fy<top) fy=top;
  var pad=port?10*u:14;
  G.field={
    x:Math.round(fx), y:Math.round(fy), w:Math.round(boardW), h:Math.round(boardH),
    card:Math.round(size), gap:gap,
    cardX:Math.round(fx-pad), cardY:Math.round(fy-pad),
    cardW:Math.round(boardW+pad*2), cardH:Math.round(boardH+pad*2)
  };
  // Portrait: HUD am unteren Bildschirmrand (nicht unter dem Spielfeld schwebend)
  G.hudY = port ? (Lh - bottomBar + 10*u) : (Lh-90);
  // card rects
  G.cardRects=[];
  var i, r, c;
  for(i=0;i<G.cards.length;i++){
    r=(i/cols)|0; c=i%cols;
    G.cardRects[i]={
      x:Math.round(fx+c*(size+gap)),
      y:Math.round(fy+r*(size+gap)),
      w:Math.round(size), h:Math.round(size), i:i
    };
  }
}

/* ---- simple placeholder drawings (leicht austauschbar via MOTIFS) ---- */
function drawPlaceholder(c, x, y, w, h, part, face){
  var cx=x+w/2, cy=y+h/2, s=Math.min(w,h);
  c.save();
  c.strokeStyle=GREY; c.fillStyle=GREY; c.lineWidth=Math.max(2,s*0.045); c.lineCap="round"; c.lineJoin="round";
  if(face==="symbol"){
    drawSymbol(c, cx, cy, s, part);
  } else {
    drawPart(c, cx, cy, s, part);
  }
  c.restore();
}
function drawPart(c, cx, cy, s, part){
  var g=GREY;
  c.fillStyle=g; c.strokeStyle=g;
  if(part==="resistor"){
    // body + leads + 3 color bands (grey shades)
    c.fillRect(cx-s*0.38, cy-s*0.04, s*0.12, s*0.08);
    c.fillRect(cx+s*0.26, cy-s*0.04, s*0.12, s*0.08);
    rr(c, cx-s*0.26, cy-s*0.14, s*0.52, s*0.28, s*0.06); c.fill();
    c.fillStyle="#3a3a3a"; c.fillRect(cx-s*0.14, cy-s*0.14, s*0.06, s*0.28);
    c.fillStyle="#6a6a6a"; c.fillRect(cx-s*0.02, cy-s*0.14, s*0.06, s*0.28);
    c.fillStyle="#2e2e2e"; c.fillRect(cx+s*0.10, cy-s*0.14, s*0.06, s*0.28);
  } else if(part==="ceramic"){
    rr(c, cx-s*0.16, cy-s*0.22, s*0.32, s*0.44, s*0.06); c.fill();
    c.fillRect(cx-s*0.08, cy+s*0.22, s*0.06, s*0.14);
    c.fillRect(cx+s*0.02, cy+s*0.22, s*0.06, s*0.14);
  } else if(part==="elko"){
    c.beginPath(); c.ellipse(cx, cy-s*0.02, s*0.18, s*0.26, 0, 0, Math.PI*2); c.fill();
    c.fillStyle="#3a3a3a"; c.fillRect(cx-s*0.18, cy-s*0.30, s*0.36, s*0.08);
    c.fillStyle=g; c.fillRect(cx-s*0.08, cy+s*0.24, s*0.05, s*0.14);
    c.fillRect(cx+s*0.03, cy+s*0.24, s*0.05, s*0.14);
  } else if(part==="led"){
    c.beginPath(); c.moveTo(cx, cy-s*0.22); c.lineTo(cx+s*0.18, cy+s*0.12); c.lineTo(cx-s*0.18, cy+s*0.12); c.closePath(); c.fill();
    c.fillStyle="#e85a9a"; c.globalAlpha=0.85; c.beginPath(); c.arc(cx, cy-s*0.02, s*0.08, 0, Math.PI*2); c.fill();
    c.globalAlpha=1; c.fillStyle=g;
    c.fillRect(cx-s*0.08, cy+s*0.12, s*0.05, s*0.2);
    c.fillRect(cx+s*0.03, cy+s*0.12, s*0.05, s*0.2);
  } else if(part==="diode"){
    c.fillRect(cx-s*0.32, cy-s*0.04, s*0.18, s*0.08);
    c.fillRect(cx+s*0.14, cy-s*0.04, s*0.18, s*0.08);
    c.beginPath(); c.moveTo(cx-s*0.14, cy-s*0.16); c.lineTo(cx+s*0.12, cy); c.lineTo(cx-s*0.14, cy+s*0.16); c.closePath(); c.fill();
    c.fillRect(cx+s*0.10, cy-s*0.16, s*0.05, s*0.32);
  } else if(part==="transistor"){
    c.beginPath(); c.arc(cx, cy-s*0.04, s*0.22, 0, Math.PI*2); c.fill();
    c.fillStyle="#3a3a3a"; c.beginPath(); c.arc(cx, cy-s*0.04, s*0.10, 0, Math.PI*2); c.fill();
    c.fillStyle=g;
    c.fillRect(cx-s*0.18, cy+s*0.18, s*0.05, s*0.16);
    c.fillRect(cx-s*0.02, cy+s*0.18, s*0.05, s*0.16);
    c.fillRect(cx+s*0.12, cy+s*0.18, s*0.05, s*0.16);
  } else if(part==="ic"){
    rr(c, cx-s*0.22, cy-s*0.28, s*0.44, s*0.56, s*0.04); c.fill();
    c.fillStyle=PINK; c.beginPath(); c.arc(cx, cy-s*0.22, s*0.05, 0, Math.PI*2); c.fill();
    c.fillStyle=g;
    var i; for(i=0;i<4;i++){
      c.fillRect(cx-s*0.30, cy-s*0.16+i*s*0.12, s*0.08, s*0.05);
      c.fillRect(cx+s*0.22, cy-s*0.16+i*s*0.12, s*0.08, s*0.05);
    }
  } else if(part==="coil"){
    c.lineWidth=Math.max(2,s*0.05); c.beginPath();
    for(var k=0;k<4;k++){ c.arc(cx-s*0.18+k*s*0.12, cy, s*0.08, Math.PI, 0, false); }
    c.stroke();
    c.fillRect(cx-s*0.34, cy-s*0.03, s*0.10, s*0.06);
    c.fillRect(cx+s*0.24, cy-s*0.03, s*0.10, s*0.06);
  } else if(part==="switch"){
    rr(c, cx-s*0.22, cy-s*0.12, s*0.44, s*0.24, s*0.04); c.fill();
    c.fillStyle="#3a3a3a"; rr(c, cx-s*0.06, cy-s*0.22, s*0.12, s*0.14, s*0.03); c.fill();
    c.fillStyle=g; c.fillRect(cx-s*0.28, cy-s*0.03, s*0.06, s*0.06); c.fillRect(cx+s*0.22, cy-s*0.03, s*0.06, s*0.06);
  } else if(part==="pot"){
    c.beginPath(); c.arc(cx, cy, s*0.24, 0, Math.PI*2); c.fill();
    c.fillStyle="#3a3a3a"; c.beginPath(); c.arc(cx, cy, s*0.10, 0, Math.PI*2); c.fill();
    c.strokeStyle=WHITE; c.lineWidth=Math.max(2,s*0.04);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx+s*0.16, cy-s*0.12); c.stroke();
    c.fillStyle=g;
    c.fillRect(cx-s*0.18, cy+s*0.24, s*0.05, s*0.12);
    c.fillRect(cx-s*0.02, cy+s*0.24, s*0.05, s*0.12);
    c.fillRect(cx+s*0.12, cy+s*0.24, s*0.05, s*0.12);
  } else if(part==="crystal"){
    c.beginPath(); c.ellipse(cx, cy, s*0.16, s*0.26, 0, 0, Math.PI*2); c.fill();
    c.fillStyle="#6a6a6a"; c.beginPath(); c.ellipse(cx, cy, s*0.10, s*0.18, 0, 0, Math.PI*2); c.fill();
    c.fillStyle=g; c.fillRect(cx-s*0.06, cy-s*0.36, s*0.12, s*0.10); c.fillRect(cx-s*0.06, cy+s*0.26, s*0.12, s*0.10);
  } else if(part==="battery"){
    rr(c, cx-s*0.18, cy-s*0.26, s*0.36, s*0.52, s*0.04); c.fill();
    c.fillStyle="#3a3a3a"; c.fillRect(cx-s*0.08, cy-s*0.34, s*0.16, s*0.10);
    c.fillStyle=WHITE; c.font=(s*0.18)+"px NunitoSB"; c.textAlign="center"; c.textBaseline="middle";
    c.fillText("+", cx, cy-s*0.08);
  } else if(part==="speaker"){
    c.beginPath(); c.moveTo(cx-s*0.18, cy-s*0.12); c.lineTo(cx-s*0.02, cy-s*0.12);
    c.lineTo(cx+s*0.18, cy-s*0.26); c.lineTo(cx+s*0.18, cy+s*0.26);
    c.lineTo(cx-s*0.02, cy+s*0.12); c.lineTo(cx-s*0.18, cy+s*0.12); c.closePath(); c.fill();
    c.lineWidth=Math.max(2,s*0.035); c.beginPath();
    c.arc(cx+s*0.22, cy, s*0.10, -0.9, 0.9); c.stroke();
    c.beginPath(); c.arc(cx+s*0.22, cy, s*0.18, -0.9, 0.9); c.stroke();
  } else {
    rr(c, cx-s*0.2, cy-s*0.2, s*0.4, s*0.4, s*0.06); c.fill();
  }
}
function drawSymbol(c, cx, cy, s, part){
  c.strokeStyle=GREY; c.fillStyle=GREY; c.lineWidth=Math.max(2,s*0.05); c.lineCap="round"; c.lineJoin="round";
  if(part==="resistor"){
    // zigzag
    c.beginPath();
    c.moveTo(cx-s*0.34, cy);
    c.lineTo(cx-s*0.22, cy);
    var zs=[[-0.14,-0.12],[-0.06,0.12],[0.02,-0.12],[0.10,0.12],[0.18,-0.12]];
    for(var i=0;i<zs.length;i++) c.lineTo(cx+s*zs[i][0], cy+s*zs[i][1]);
    c.lineTo(cx+s*0.22, cy); c.lineTo(cx+s*0.34, cy); c.stroke();
  } else if(part==="ceramic"||part==="elko"){
    c.beginPath(); c.moveTo(cx-s*0.3, cy); c.lineTo(cx-s*0.06, cy); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.06, cy-s*0.18); c.lineTo(cx-s*0.06, cy+s*0.18); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.06, cy-s*0.18); c.lineTo(cx+s*0.06, cy+s*0.18); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.06, cy); c.lineTo(cx+s*0.3, cy); c.stroke();
    if(part==="elko"){ c.beginPath(); c.moveTo(cx+s*0.12, cy-s*0.22); c.lineTo(cx+s*0.12, cy-s*0.10); c.moveTo(cx+s*0.06, cy-s*0.16); c.lineTo(cx+s*0.18, cy-s*0.16); c.stroke(); }
  } else if(part==="led"||part==="diode"){
    c.beginPath(); c.moveTo(cx-s*0.3, cy); c.lineTo(cx-s*0.08, cy); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.08, cy-s*0.16); c.lineTo(cx+s*0.14, cy); c.lineTo(cx-s*0.08, cy+s*0.16); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(cx+s*0.14, cy-s*0.16); c.lineTo(cx+s*0.14, cy+s*0.16); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.14, cy); c.lineTo(cx+s*0.32, cy); c.stroke();
    if(part==="led"){
      c.beginPath(); c.moveTo(cx+s*0.02, cy-s*0.22); c.lineTo(cx+s*0.14, cy-s*0.34); c.stroke();
      c.beginPath(); c.moveTo(cx+s*0.10, cy-s*0.16); c.lineTo(cx+s*0.22, cy-s*0.28); c.stroke();
    }
  } else if(part==="transistor"){
    c.beginPath(); c.arc(cx, cy, s*0.26, 0, Math.PI*2); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.12, cy-s*0.16); c.lineTo(cx-s*0.12, cy+s*0.16); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.12, cy-s*0.08); c.lineTo(cx+s*0.14, cy-s*0.22); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.12, cy+s*0.08); c.lineTo(cx+s*0.14, cy+s*0.22); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.34, cy); c.lineTo(cx-s*0.12, cy); c.stroke();
  } else if(part==="ic"){
    rr(c, cx-s*0.22, cy-s*0.18, s*0.44, s*0.36, s*0.04); c.stroke();
    c.font=(s*0.16)+"px NunitoSB"; c.textAlign="center"; c.textBaseline="middle"; c.fillText("IC", cx, cy);
  } else if(part==="coil"){
    c.beginPath();
    for(var k=0;k<4;k++){ c.arc(cx-s*0.18+k*s*0.12, cy, s*0.08, Math.PI, 0, false); }
    c.moveTo(cx-s*0.34, cy); c.lineTo(cx-s*0.26, cy);
    c.moveTo(cx+s*0.26, cy); c.lineTo(cx+s*0.34, cy); c.stroke();
  } else if(part==="switch"){
    c.beginPath(); c.moveTo(cx-s*0.3, cy); c.lineTo(cx-s*0.1, cy); c.stroke();
    c.beginPath(); c.arc(cx-s*0.1, cy, s*0.04, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(cx+s*0.14, cy, s*0.04, 0, Math.PI*2); c.fill();
    c.beginPath(); c.moveTo(cx-s*0.08, cy); c.lineTo(cx+s*0.12, cy-s*0.16); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.14, cy); c.lineTo(cx+s*0.32, cy); c.stroke();
  } else if(part==="pot"){
    c.beginPath(); c.moveTo(cx-s*0.3, cy); c.lineTo(cx-s*0.14, cy); c.stroke();
    c.beginPath();
    c.moveTo(cx-s*0.14, cy); c.lineTo(cx-s*0.06, cy-s*0.12); c.lineTo(cx+s*0.02, cy+s*0.12);
    c.lineTo(cx+s*0.10, cy-s*0.12); c.lineTo(cx+s*0.18, cy); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.18, cy); c.lineTo(cx+s*0.32, cy); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.02, cy-s*0.22); c.lineTo(cx+s*0.02, cy-s*0.06); c.stroke();
  } else if(part==="crystal"){
    c.beginPath(); c.moveTo(cx-s*0.3, cy); c.lineTo(cx-s*0.1, cy); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.1, cy-s*0.16); c.lineTo(cx-s*0.1, cy+s*0.16); c.stroke();
    rr(c, cx-s*0.06, cy-s*0.14, s*0.12, s*0.28, 2); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.1, cy-s*0.16); c.lineTo(cx+s*0.1, cy+s*0.16); c.stroke();
    c.beginPath(); c.moveTo(cx+s*0.1, cy); c.lineTo(cx+s*0.3, cy); c.stroke();
  } else if(part==="battery"){
    c.beginPath(); c.moveTo(cx-s*0.3, cy); c.lineTo(cx-s*0.1, cy); c.stroke();
    c.beginPath(); c.moveTo(cx-s*0.1, cy-s*0.18); c.lineTo(cx-s*0.1, cy+s*0.18); c.stroke();
    c.lineWidth=Math.max(3,s*0.08);
    c.beginPath(); c.moveTo(cx+s*0.06, cy-s*0.10); c.lineTo(cx+s*0.06, cy+s*0.10); c.stroke();
    c.lineWidth=Math.max(2,s*0.05);
    c.beginPath(); c.moveTo(cx+s*0.06, cy); c.lineTo(cx+s*0.3, cy); c.stroke();
  } else if(part==="speaker"){
    c.beginPath(); c.moveTo(cx-s*0.2, cy-s*0.1); c.lineTo(cx-s*0.05, cy-s*0.1);
    c.lineTo(cx+s*0.15, cy-s*0.22); c.lineTo(cx+s*0.15, cy+s*0.22);
    c.lineTo(cx-s*0.05, cy+s*0.1); c.lineTo(cx-s*0.2, cy+s*0.1); c.closePath(); c.stroke();
  } else {
    c.beginPath(); c.arc(cx, cy, s*0.18, 0, Math.PI*2); c.stroke();
  }
}

function easeFlip(t){
  t=clamp(t,0,1);
  // easeInOutCubic
  return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
}
function flipLift(p){
  // p 0..1 through flip — peak lift mid-way, slight settle
  var s=Math.sin(p*Math.PI);
  return 1 + 0.07*s;
}
function cardAngle(card){
  // 0° = Rückseite, 180° = Vorderseite. Während Anim: monoton eine Richtung, kein Overshoot.
  if(typeof card._forceAng==="number") return card._forceAng;
  if(card.matched && !card.anim) return 180;
  if(card.anim){
    var t=clamp(card.anim.t/card.anim.dur, 0, 1);
    var p=easeFlip(t); // 0→1, kein Bounce/Overshoot
    if(p<0) p=0; if(p>1) p=1;
    return card.anim.toFront ? (p*180) : (180-p*180);
  }
  return (card.flipped?180:0);
}
function drawBeakMark(c, x, y, w, h){
  // Weißes „B E A K ·“ auf Pink-Karte — auch bei kleinen Karten lesbar
  var beakSize=Math.max(9, Math.min(w*0.22, h*0.28));
  c.save();
  c.textAlign="left"; c.textBaseline="alphabetic";
  c.fillStyle="rgba(255,255,255,0.92)";
  c.font=beakSize+"px Aeonis";
  var letters=["B","E","A","K"], gap=beakSize*0.16;
  var widths=[], total=0, i;
  for(i=0;i<letters.length;i++){ widths[i]=c.measureText(letters[i]).width; total+=widths[i]+(i?gap:0); }
  var dotR=Math.max(1.2, beakSize*0.075);
  total += gap*0.55 + dotR*2;
  if(total > w*0.88){
    var sc=(w*0.88)/total;
    beakSize*=sc; gap*=sc; dotR*=sc; total*=sc;
    c.font=beakSize+"px Aeonis";
    widths=[]; total=0;
    for(i=0;i<letters.length;i++){ widths[i]=c.measureText(letters[i]).width; total+=widths[i]+(i?gap:0); }
    total += gap*0.55 + dotR*2;
  }
  var bx=x+(w-total)/2;
  var baseline=y+h/2+beakSize*0.32;
  for(i=0;i<letters.length;i++){ c.fillText(letters[i], bx, baseline); bx+=widths[i]+gap; }
  c.beginPath(); c.arc(bx+dotR, baseline-beakSize*0.28, dotR, 0, Math.PI*2); c.fill();
  c.restore();
}
function drawCardFaceAt(c, x, y, w, h, card){
  var pad=w*0.1;
  var img=ensureMotifImage(card.part, card.face);
  if(img && img.naturalWidth){
    var iw=img.naturalWidth, ih=img.naturalHeight;
    var aw=w-pad*2, ah=h-pad*2;
    var sc=Math.min(aw/iw, ah/ih);
    var dw=iw*sc, dh=ih*sc;
    c.drawImage(img, x+(w-dw)/2, y+(h-dh)/2, dw, dh);
  } else {
    drawPlaceholder(c, x+pad*0.5, y+pad*0.5, w-pad, h-pad, card.part, card.face);
  }
}
function paintCardSide(c, x, y, w, h, card, front, matched){
  // Einheitlicher Rand per Inset-Fill (kein stroke — vermeidet Clipping/halbe Pixel)
  var r=Math.max(6, Math.round(w*0.12));
  var bw=2; // feste 2-Logikpixel-Rahmenstärke
  if(front){
    if(matched){
      c.fillStyle=PINK;
      rr(c, x, y, w, h, r); c.fill();
      c.fillStyle=WHITE;
      rr(c, x+bw, y+bw, w-bw*2, h-bw*2, Math.max(2, r-bw)); c.fill();
    } else {
      // dezenter grauer 2px-Rahmen
      c.fillStyle="rgba(80,80,80,0.28)";
      rr(c, x, y, w, h, r); c.fill();
      c.fillStyle=WHITE;
      rr(c, x+bw, y+bw, w-bw*2, h-bw*2, Math.max(2, r-bw)); c.fill();
    }
    drawCardFaceAt(c, x+bw, y+bw, w-bw*2, h-bw*2, card);
  } else {
    c.fillStyle=CARD_BACK;
    rr(c, x, y, w, h, r); c.fill();
    // einheitliche weiße Innenkante 2px (Inset)
    c.fillStyle="rgba(255,255,255,0.22)";
    rr(c, x+bw, y+bw, w-bw*2, h-bw*2, Math.max(2, r-bw)); c.fill();
    c.fillStyle=CARD_BACK;
    rr(c, x+bw*2, y+bw*2, w-bw*4, h-bw*4, Math.max(2, r-bw*2)); c.fill();
    drawBeakMark(c, x, y, w, h);
  }
}
/* Weiche Schatten: ruhend gecacht, während Flip live (max. 2 Karten) */
var SHADOW_CACHE={};
function getRestShadow(w, h, rad){
  var key=(w|0)+"x"+(h|0)+"r"+(rad|0);
  if(SHADOW_CACHE[key]) return SHADOW_CACHE[key];
  var pad=Math.ceil(Math.max(20, w*0.18));
  var cv=document.createElement("canvas");
  cv.width=Math.max(1,(w+pad*2)|0); cv.height=Math.max(1,(h+pad*2)|0);
  var g=cv.getContext("2d");
  g.clearRect(0,0,cv.width,cv.height);
  g.shadowColor="rgba(0,0,0,0.35)";
  g.shadowBlur=Math.max(10, w*0.14);
  g.shadowOffsetX=0; g.shadowOffsetY=Math.max(2, h*0.03);
  g.fillStyle="rgba(0,0,0,0.22)";
  rr(g, pad, pad, w, h, rad); g.fill();
  // Zentrum wieder klar → nur weicher Halo bleibt (keine harte Karte im Cache)
  g.globalCompositeOperation="destination-out";
  g.shadowColor="transparent"; g.shadowBlur=0; g.shadowOffsetY=0;
  g.fillStyle="#000";
  rr(g, pad, pad, w, h, rad); g.fill();
  g.globalCompositeOperation="source-over";
  SHADOW_CACHE[key]=cv;
  return cv;
}
var _flipShCV=null;
function drawSoftShadowTrapezoid(c, cx, cy, halfW, leftH, rightH, lift, sin){
  // Weicher Halo ohne harte Füllung: Blur zeichnen, dann Form ausstanzen
  var elev=Math.max(0, lift-1);
  var blur=12+elev*160+Math.abs(sin)*10;
  var oy=4+elev*60+Math.abs(sin)*5;
  var ox=sin*5;
  var pad=Math.ceil(blur+Math.abs(oy)+Math.abs(ox)+10);
  var maxH=Math.max(leftH, rightH);
  var bw=Math.ceil(halfW*2+pad*2);
  var bh=Math.ceil(maxH*2+pad*2);
  if(bw<2||bh<2) return;
  if(!_flipShCV) _flipShCV=document.createElement("canvas");
  if(_flipShCV.width<bw) _flipShCV.width=bw;
  if(_flipShCV.height<bh) _flipShCV.height=bh;
  var g=_flipShCV.getContext("2d");
  g.setTransform(1,0,0,1,0,0);
  g.clearRect(0,0,_flipShCV.width,_flipShCV.height);
  var lx=pad, ly=pad+maxH;
  function trap(gg){
    gg.beginPath();
    gg.moveTo(lx, ly-leftH);
    gg.lineTo(lx+halfW*2, ly-rightH);
    gg.lineTo(lx+halfW*2, ly+rightH);
    gg.lineTo(lx, ly+leftH);
    gg.closePath();
  }
  g.save();
  g.shadowColor="rgba(0,0,0,0.40)";
  g.shadowBlur=blur;
  g.shadowOffsetX=ox;
  g.shadowOffsetY=oy;
  g.fillStyle="rgba(0,0,0,0.22)";
  trap(g); g.fill();
  g.restore();
  // harte Form entfernen → nur weicher Schatten bleibt
  g.save();
  g.globalCompositeOperation="destination-out";
  g.fillStyle="#000";
  trap(g); g.fill();
  g.restore();
  c.drawImage(_flipShCV, 0, 0, bw, bh, cx-halfW-pad, cy-maxH-pad, bw, bh);
}
function drawCard3D(c, rect, card, selected){
  // Eine monotone 180°-Drehung: progress 0→1 ⇒ Winkel 0→180 (öffnen) bzw. 180→0 (schließen)
  var ang=cardAngle(card);
  var rad=ang*Math.PI/180;
  var cos=Math.cos(rad); // 1→0→-1 genau einmal durch 0
  var sin=Math.sin(rad);
  var prog=ang/180;
  var lift=1;
  if(card.anim){
    // Lift nur aus sin(winkel), kein zweites Easing — Peak genau bei 90°
    lift=1+0.07*Math.abs(sin);
  }
  var cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
  var w=rect.w*lift, h=rect.h*lift;
  var scaleX=cos; // vorzeichenbehaftet; Breite = |scaleX|
  var absC=Math.abs(scaleX);
  var halfW=Math.max(0.5, (w/2)*absC);
  var k=0.12*Math.abs(sin);
  // Trapez: Kante die „wegdreht“ etwas kürzer
  var leftH=h/2*(1+(scaleX>=0?k:-k));
  var rightH=h/2*(1+(scaleX>=0?-k:k));

  var rCard=Math.max(6, Math.round(rect.w*0.12));
  var showFront = ang >= 90;
  // Ruhend: achsenparallel zeichnen (kein Clip/Scale) → scharfe einheitliche Ränder
  if(!card.anim && absC>0.995){
    var sh=getRestShadow(rect.w, rect.h, rCard);
    var pad=(sh.width-rect.w)/2;
    c.drawImage(sh, Math.round(rect.x-pad), Math.round(rect.y-pad+1));
    paintCardSide(c, rect.x, rect.y, rect.w, rect.h, card, showFront, !!card.matched);
    if(selected){
      c.save();
      c.strokeStyle=WHITE; c.lineWidth=3;
      rr(c, rect.x-3, rect.y-3, rect.w+6, rect.h+6, rCard+3); c.stroke();
      c.restore();
    }
    return;
  }

  drawSoftShadowTrapezoid(c, cx, cy, halfW, leftH, rightH, lift, sin);

  if(absC < 0.035){
    c.fillStyle=showFront?WHITE:CARD_BACK;
    c.fillRect(cx-1.5, cy-h*0.48, 3, h*0.96);
    return;
  }

  c.save();
  c.beginPath();
  c.moveTo(cx-halfW, cy-leftH);
  c.lineTo(cx+halfW, cy-rightH);
  c.lineTo(cx+halfW, cy+rightH);
  c.lineTo(cx-halfW, cy+leftH);
  c.closePath();
  c.clip();

  c.translate(cx, cy);
  c.scale(absC*lift, lift);
  paintCardSide(c, -rect.w/2, -rect.h/2, rect.w, rect.h, card, showFront, !!card.matched);
  c.restore();

  // dezente Schattierung der abgewandten Seite (kein zweites Klappen)
  if(Math.abs(sin)>0.08){
    c.save();
    c.beginPath();
    c.moveTo(cx-halfW, cy-leftH);
    c.lineTo(cx+halfW, cy-rightH);
    c.lineTo(cx+halfW, cy+rightH);
    c.lineTo(cx-halfW, cy+leftH);
    c.closePath();
    c.clip();
    var grd=c.createLinearGradient(cx-halfW, cy, cx+halfW, cy);
    var aShade=0.16*Math.abs(sin);
    if(scaleX>=0){ grd.addColorStop(0,"rgba(0,0,0,0)"); grd.addColorStop(1,"rgba(0,0,0,"+aShade+")"); }
    else { grd.addColorStop(0,"rgba(0,0,0,"+aShade+")"); grd.addColorStop(1,"rgba(0,0,0,0)"); }
    c.fillStyle=grd; c.fillRect(cx-halfW-2, cy-h, halfW*2+4, h*2);
    c.restore();
  }

  if(selected && !card.anim && absC>0.95){
    c.strokeStyle=WHITE; c.lineWidth=Math.max(3,rect.w*0.05);
    var rr0=rCard+3;
    rr(c, rect.x-3, rect.y-3, rect.w+6, rect.h+6, rr0); c.stroke();
  }
}
function drawCard(c, rect, card, selected){
  drawCard3D(c, rect, card, selected);
}
/** Test-Hilfe: relative Kartenbreite |cos(angle)| für aktuelle Anim */
function cardFlipWidthRatio(card){
  return Math.abs(Math.cos(cardAngle(card)*Math.PI/180));
}

/* ---- logo ---- */
function drawLogo(cx, y, beakH){
  var c=ctx;
  c.save();
  c.shadowColor="transparent"; c.shadowBlur=0; c.shadowOffsetX=0; c.shadowOffsetY=0;
  c.globalAlpha=1;
  c.textAlign="left"; c.textBaseline="alphabetic";
  c.fillStyle=WHITE;
  var beakSize=beakH*0.92;
  c.font=beakSize+"px Aeonis";
  var letters=["B","E","A","K"], gap=beakSize*0.18;
  var widths=[], total=0, i;
  for(i=0;i<letters.length;i++){ widths[i]=c.measureText(letters[i]).width; total+=widths[i]+(i?gap:0); }
  var dotR=beakSize*0.07;
  total += gap*0.7 + dotR*2;
  var sub="memory";
  var subSize=Math.max(beakSize*(LAY.mode==="port"?0.38:0.50), LAY.mode==="port"?12:18);
  c.font=subSize+"px NunitoLI";
  var track=subSize*0.06, subW=0;
  for(i=0;i<sub.length;i++) subW+=c.measureText(sub[i]).width+(i<sub.length-1?track:0);
  var gapLogo=beakSize*0.22;
  var fullW=total+gapLogo+subW;
  var x=cx-fullW/2;
  c.font=beakSize+"px Aeonis"; c.fillStyle=WHITE; c.globalAlpha=1;
  var baseline=y+beakSize*0.82;
  for(i=0;i<letters.length;i++){ c.fillText(letters[i], x, baseline); x+=widths[i]+gap; }
  c.beginPath(); c.arc(x+dotR, baseline-beakSize*0.28, dotR, 0, Math.PI*2); c.fill();
  x+=dotR*2+gapLogo;
  c.font=subSize+"px NunitoLI"; c.globalAlpha=0.55; c.fillStyle=WHITE;
  for(i=0;i<sub.length;i++){ c.fillText(sub[i], x, baseline); x+=c.measureText(sub[i]).width+track; }
  c.globalAlpha=1;
  c.restore();
  return {w:fullW, h:beakH};
}

/* ---- gameplay ---- */
function countOpening(){
  var n=G.flipped.length, i;
  for(i=0;i<G.cards.length;i++){
    if(G.cards[i].anim && G.cards[i].anim.toFront) n++;
  }
  return n;
}
function beginFlip(idx, toFront){
  var card=G.cards[idx];
  if(!card||card.matched||card.anim) return false;
  if(toFront && card.flipped) return false;
  if(!toFront && !card.flipped) return false;
  // Debounce: verhindert Doppelstart derselben Richtung (pointerdown-Synthese)
  var now=performance.now();
  var dir=toFront?1:0;
  if(card._flipAt && card._flipDir===dir && now-card._flipAt<100) return false;
  card._flipAt=now; card._flipDir=dir;
  card.anim={toFront:!!toFront, t:0, dur:FLIP_DUR};
  delete card._forceAng;
  G.animating++;
  playFlipSnd();
  return true;
}
function resolvePair(){
  if(G.flipped.length<2) return;
  G.moves++;
  G.lock=true;
  var a=G.cards[G.flipped[0]], b=G.cards[G.flipped[1]];
  if(a.pair===b.pair){
    a.matched=true; b.matched=true;
    G.matched++;
    G.flipped=[];
    G.lock=false;
    playSnd("prima");
    G.feedbackKind="ok";
    G.feedbackMsg="paar!";
    G.feedbackT=0.9;
    if(G.matched>=G.pairs) levelWon();
  } else {
    G.mismatchIds=G.flipped.slice();
    G.flipped=[];
    G.mismatchDelay=0.45;
    playSnd("nee");
    G.feedbackKind="no";
    G.feedbackMsg="daneben";
    G.feedbackT=0.7;
  }
}
function onFlipDone(idx){
  var card=G.cards[idx];
  if(!card) return;
  if(card.flipped){
    if(G.flipped.indexOf(idx)<0) G.flipped.push(idx);
    if(G.flipped.length>=2) resolvePair();
  } else {
    // zurückgedreht
    if(G.animating===0 && G.mismatchIds.length){
      G.mismatchIds=[];
      G.lock=false;
    }
  }
}
function updateCardAnims(dt){
  var i, card, finished=[];
  for(i=0;i<G.cards.length;i++){
    card=G.cards[i];
    if(!card.anim) continue;
    card.anim.t+=dt;
    if(card.anim.t>=card.anim.dur){
      card.flipped=!!card.anim.toFront;
      card.anim=null;
      G.animating=Math.max(0, G.animating-1);
      finished.push(i);
    }
  }
  for(i=0;i<finished.length;i++) onFlipDone(finished[i]);
  // nach mismatchDelay: beide zurückdrehen
  if(G.mismatchDelay>0){
    G.mismatchDelay-=dt;
    if(G.mismatchDelay<=0){
      G.mismatchDelay=0;
      G.mismatchIds.forEach(function(id){ beginFlip(id, false); });
    }
  } else if(G.lock && G.animating===0 && G.flipped.length===0 && G.mismatchIds.length===0 && G.mismatchDelay<=0){
    // sicherstellen, dass Lock freigegeben ist wenn nichts mehr läuft
    // (Match-Pfad setzt lock schon frei; Backflip-Pfad in onFlipDone)
  }
}
function flipCard(idx){
  if(G.screen!=="game"||G.lock) return;
  var card=G.cards[idx];
  if(!card||card.flipped||card.matched||card.anim) return;
  if(countOpening()>=2) return;
  beginFlip(idx, true);
}

function levelWon(){
  G.running=false;
  G.elapsed=performance.now()-G.startAt;
  G.screen="win";
  G.winT=0;
  // kein Extra-Sound: letztes Paar hat schon "prima"
  recordScore();
  musSync();
}

function nextLevel(){
  var next=G.levelIdx+1;
  if(next>=LEVELS.length){ G.screen="start"; musSync(); return; }
  startLevel(next);
}

/* ---- input ---- */
function toLogic(cx,cy){ return {x:(cx-view.ox)/view.scale, y:(cy-view.oy)/view.scale}; }
function hitButton(L){
  for(var i=0;i<G.buttons.length;i++){
    var b=G.buttons[i];
    if(L.x>=b.x&&L.x<=b.x+b.w&&L.y>=b.y&&L.y<=b.y+b.h) return b;
  }
  return null;
}
function hitCard(L){
  for(var i=0;i<G.cardRects.length;i++){
    var r=G.cardRects[i];
    if(L.x>=r.x&&L.x<=r.x+r.w&&L.y>=r.y&&L.y<=r.y+r.h) return i;
  }
  return -1;
}
function hitPause(L){
  var p=LAY.pause; if(!p) return false;
  return Math.hypot(L.x-p.x, L.y-p.y)<=p.r+6;
}
function hitMusic(L){
  var m=LAY.music; if(!m) return false;
  return Math.hypot(L.x-m.x, L.y-m.y)<=m.r+6;
}
function ensureMusicLayout(){
  var Lw=LAY.LWc, u=LAY.u, port=LAY.mode==="port";
  if(port){
    if(!LAY.pause) LAY.pause={x:Lw-28*u, y:18*u, r:16*u};
    LAY.music={x:LAY.pause.x-LAY.pause.r*2.7, y:LAY.pause.y, r:LAY.pause.r};
  } else {
    if(!LAY.pause) LAY.pause={x:Lw-40, y:28, r:18};
    LAY.music={x:LAY.pause.x-LAY.pause.r*2.7, y:LAY.pause.y, r:LAY.pause.r};
  }
}

function onTap(L){
  if(hitMusic(L)){ musToggle(); return; }
  if(G.screen==="start"||G.screen==="win"||G.screen==="info"||G.screen==="pause"){
    var b=hitButton(L);
    if(b&&b.act){ b.act(); musSync(); return; }
    return;
  }
  if(G.screen==="game"){
    if(hitPause(L)){ G.screen="pause"; G.running=false; musSync(); return; }
    var ci=hitCard(L);
    if(ci>=0){ G.focus=ci; flipCard(ci); }
  }
}

canvas.addEventListener("pointerdown", function(e){
  e.preventDefault();
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  var L=toLogic(e.clientX,e.clientY);
  onTap(L);
}, {passive:false});
document.addEventListener("touchmove", function(e){ e.preventDefault(); }, {passive:false});

window.addEventListener("keydown", function(e){
  var k=e.key;
  if(k==="m"||k==="M"){ e.preventDefault(); musToggle(); return; }
  if(G.screen==="start"){
    if(k==="Enter"||k===" "){ e.preventDefault(); startLevel(0); musSync(); }
    return;
  }
  if(G.screen==="win"){
    if(k==="Enter"||k===" "){ e.preventDefault(); nextLevel(); musSync(); }
    if(k==="Escape"){ e.preventDefault(); G.screen="start"; musSync(); }
    return;
  }
  if(G.screen==="pause"){
    if(k==="Escape"||k==="Enter"||k===" "||k==="p"||k==="P"){ e.preventDefault(); G.screen="game"; G.running=true; G.startAt=performance.now()-G.elapsed; musSync(); }
    return;
  }
  if(G.screen==="info"){
    if(k==="Escape"||k==="Enter"||k===" "){ e.preventDefault(); G.screen="start"; musSync(); }
    return;
  }
  if(G.screen!=="game") return;
  if(k==="Escape"||k==="p"||k==="P"){ e.preventDefault(); G.screen="pause"; G.running=false; musSync(); return; }
  var cols=G.cols, n=G.cards.length;
  if(k==="ArrowLeft"){ e.preventDefault(); G.focus=(G.focus%cols===0)?G.focus+cols-1:G.focus-1; if(G.focus<0)G.focus=0; if(G.focus>=n)G.focus=n-1; }
  else if(k==="ArrowRight"){ e.preventDefault(); G.focus=(G.focus%cols===cols-1)?G.focus-cols+1:G.focus+1; if(G.focus>=n)G.focus=n-1; if(G.focus<0)G.focus=0; }
  else if(k==="ArrowUp"){ e.preventDefault(); G.focus-=cols; if(G.focus<0) G.focus+=cols*((n/cols)|0); while(G.focus>=n) G.focus-=cols; if(G.focus<0)G.focus=0; }
  else if(k==="ArrowDown"){ e.preventDefault(); G.focus+=cols; if(G.focus>=n) G.focus%=cols; }
  else if(k==="Enter"||k===" "){ e.preventDefault(); flipCard(G.focus); }
});

/* ---- render ---- */
function drawPauseBtn(){
  var p=LAY.pause, c=ctx; if(!p) return;
  c.save();
  // Kein halbtransparentes Fill (wirkte auf iOS milchig/blur-artig)
  c.shadowColor="transparent"; c.shadowBlur=0;
  c.globalAlpha=1;
  c.strokeStyle=WHITE; c.lineWidth=Math.max(2, p.r*0.12);
  c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI*2); c.stroke();
  c.fillStyle=WHITE;
  var bw=Math.max(2, p.r*0.22), bh=Math.max(8, p.r*0.9);
  c.fillRect(Math.round(p.x-bw*1.6), Math.round(p.y-bh/2), Math.round(bw), Math.round(bh));
  c.fillRect(Math.round(p.x+bw*0.6), Math.round(p.y-bh/2), Math.round(bw), Math.round(bh));
  c.restore();
}
function drawMusicBtn(){
  ensureMusicLayout();
  var m=LAY.music, c=ctx; if(!m) return;
  c.save();
  c.shadowColor="transparent"; c.shadowBlur=0; c.globalAlpha=1;
  c.strokeStyle=WHITE; c.lineWidth=Math.max(2, m.r*0.12);
  c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI*2); c.stroke();
  // Note-Symbol (Achtelnote)
  var s=m.r*0.55;
  c.fillStyle=WHITE; c.strokeStyle=WHITE; c.lineWidth=Math.max(2, m.r*0.14); c.lineCap="round";
  var nx=m.x-s*0.15, ny=m.y+s*0.15;
  c.beginPath(); c.ellipse(nx, ny+s*0.35, s*0.28, s*0.20, -0.5, 0, Math.PI*2); c.fill();
  c.beginPath(); c.moveTo(nx+s*0.26, ny+s*0.35); c.lineTo(nx+s*0.26, ny-s*0.55); c.stroke();
  c.beginPath(); c.moveTo(nx+s*0.26, ny-s*0.55); c.quadraticCurveTo(nx+s*0.7, ny-s*0.35, nx+s*0.55, ny-s*0.05); c.stroke();
  if(!MUS.on){
    // durchstreichen
    c.strokeStyle=WHITE; c.lineWidth=Math.max(2, m.r*0.16);
    c.beginPath(); c.moveTo(m.x-s*0.7, m.y+s*0.7); c.lineTo(m.x+s*0.7, m.y-s*0.7); c.stroke();
  }
  c.restore();
}

function drawStatusBar(){
  var c=ctx, Lw=LAY.LWc, Lh=LAY.LHc, u=LAY.u, port=LAY.mode==="port";
  var L=LEVELS[G.levelIdx];
  var levelName=L?L.name:"level";
  var moves=String(G.moves);
  var time=fmtTime(G.running?performance.now()-G.startAt:G.elapsed);
  var pairs=G.matched+"/"+G.pairs;
  if(port){
    var y=G.hudY|| (Lh-98*u);
    var cols=[["level", levelName],["züge",moves],["zeit",time],["paare",pairs]];
    var n=cols.length, slot=Lw/n;
    c.textAlign="center";
    // dünne Trennlinie über der Statusleiste (wie Breakout)
    c.globalAlpha=0.35; c.fillStyle=WHITE; c.fillRect(16*u, y-14*u, Lw-32*u, 1.5);
    c.globalAlpha=1;
    for(var i=0;i<n;i++){
      var x=(i+0.5)*slot;
      c.globalAlpha=0.75; c.fillStyle=WHITE; c.font=(12*u)+"px NunitoLI";
      c.fillText(cols[i][0], x, y);
      c.globalAlpha=1; c.font=(20*u)+"px NunitoSB";
      c.fillText(cols[i][1], x, y+24*u);
    }
    c.globalAlpha=0.55; c.font=(11*u)+"px NunitoLI";
    c.fillText(CREDIT, Lw/2, y+48*u);
    c.globalAlpha=0.4; c.font=(10*u)+"px NunitoLI";
    c.fillText(VERSION, Lw/2, y+64*u);
    c.globalAlpha=1;
  } else {
    // side HUD
    var hx=G.field.cardX+G.field.cardW+36;
    var hy=G.field.cardY+8;
    function item(lab,val){
      c.textAlign="left"; c.fillStyle=WHITE; c.globalAlpha=0.75; c.font="14px NunitoLI"; c.fillText(lab,hx,hy); hy+=18;
      c.globalAlpha=1; c.font="26px NunitoSB"; c.fillText(val,hx,hy); hy+=40;
    }
    item("level", levelName); item("züge", moves); item("zeit", time);
    item("paare", pairs);
    c.globalAlpha=0.7; c.font="13px NunitoLI"; c.fillText(CREDIT, hx, hy+10);
    c.globalAlpha=0.45; c.font="12px NunitoLI"; c.fillText(VERSION, hx, hy+28);
    c.globalAlpha=1;
  }
}

function drawFeedback(){
  if(G.feedbackT<=0) return;
  var c=ctx, Lw=LAY.LWc;
  var a=Math.min(1, G.feedbackT*2);
  c.save();
  c.globalAlpha=a*0.95;
  c.fillStyle=G.feedbackKind==="ok"?WHITE:"rgba(255,255,255,0.9)";
  c.font=(LAY.mode==="port"?22:28)+"px NunitoSB";
  c.textAlign="center"; c.textBaseline="middle";
  c.fillText(G.feedbackMsg, Lw/2, (G.field?G.field.y:100)-18);
  c.restore();
}

function drawGame(){
  var c=ctx, Lw=LAY.LWc, Lh=LAY.LHc;
  c.shadowColor="transparent"; c.shadowBlur=0; c.globalAlpha=1;
  c.fillStyle=PINK; c.fillRect(0,0,Lw,Lh);
  // white playfield card
  if(G.field){
    c.fillStyle=WHITE;
    rr(c, G.field.cardX, G.field.cardY, G.field.cardW, G.field.cardH, 14); c.fill();
  }
  for(var i=0;i<G.cards.length;i++){
    drawCard(c, G.cardRects[i], G.cards[i], G.focus===i && !TOUCH_DEV);
  }
  drawStatusBar();
  // Header zuletzt + scharf (kein Overlay darunter)
  c.shadowColor="transparent"; c.shadowBlur=0; c.globalAlpha=1;
  drawLogo(LAY.logo.cx, LAY.logo.y, LAY.logo.h);
  drawMusicBtn();
  drawPauseBtn();
  drawFeedback();
}

function btn(label, x, y, w, h, act){
  var b={label:label,x:x,y:y,w:w,h:h,act:act};
  G.buttons.push(b);
  return b;
}
function paintBtn(b, primary){
  var c=ctx;
  if(primary){
    c.fillStyle=WHITE; rr(c,b.x,b.y,b.w,b.h, b.h/2); c.fill();
    c.fillStyle=PINK; c.font="22px NunitoSB"; c.textAlign="center"; c.textBaseline="middle";
    c.fillText(b.label, b.x+b.w/2, b.y+b.h/2+1);
  } else {
    c.strokeStyle=WHITE; c.lineWidth=2; rr(c,b.x,b.y,b.w,b.h, b.h/2); c.stroke();
    c.fillStyle=WHITE; c.font="18px NunitoSB"; c.textAlign="center"; c.textBaseline="middle";
    c.fillText(b.label, b.x+b.w/2, b.y+b.h/2+1);
  }
}

function drawStart(){
  var c=ctx, Lw=LAY.LWc, Lh=LAY.LHc, port=LAY.mode==="port";
  c.fillStyle=PINK; c.fillRect(0,0,Lw,Lh);
  ensureMusicLayout();
  drawMusicBtn();
  drawLogo(Lw/2, Lh*(port?0.12:0.14), port?34:56);
  c.fillStyle=WHITE; c.globalAlpha=0.85;
  c.font=(port?15:18)+"px NunitoLI"; c.textAlign="center";
  c.fillText("baue paare aus bauteilen", Lw/2, Lh*0.28);
  c.globalAlpha=1;
  G.buttons=[];
  var bw=Math.min(280, Lw*0.7), bh=48;
  var y0=Lh*0.40;
  var b1=btn("spielen", Lw/2-bw/2, y0, bw, bh, function(){ startLevel(0); });
  paintBtn(b1, true);
  var b3=btn("info", Lw/2-bw/2, y0+bh+18, bw, 40, function(){ G.screen="info"; });
  c.globalAlpha=0.85; paintBtn(b3, false); c.globalAlpha=1;

  if(G.best>0){
    c.fillStyle=WHITE; c.globalAlpha=0.8; c.font="16px NunitoSB";
    c.fillText("beste züge  "+G.best, Lw/2, Lh*0.78);
  }
  c.globalAlpha=0.7; c.font="14px NunitoLI"; c.fillText(CREDIT, Lw/2, Lh*0.86);
  c.globalAlpha=0.45; c.font="12px NunitoLI"; c.fillText(VERSION, Lw/2, Lh*0.91);
  c.globalAlpha=1;
}

function drawWin(){
  var c=ctx, Lw=LAY.LWc, Lh=LAY.LHc, port=LAY.mode==="port";
  // dim game underneath lightly
  drawGame();
  c.fillStyle="rgba(221,0,122,0.82)"; c.fillRect(0,0,Lw,Lh);
  drawLogo(Lw/2, Lh*0.12, port?30:44);
  c.fillStyle=WHITE; c.font=(port?32:42)+"px NunitoSB"; c.textAlign="center";
  c.fillText("level geschafft!", Lw/2, Lh*0.32);
  c.font="18px NunitoLI"; c.globalAlpha=0.9;
  var L=LEVELS[G.levelIdx];
  c.fillText((L?L.name:"")+"  ·  "+G.moves+" züge  ·  "+fmtTime(G.elapsed), Lw/2, Lh*0.40);
  c.globalAlpha=1;
  if(G.isNewBest){ c.font="16px NunitoSB"; c.fillText("neue bestleistung!", Lw/2, Lh*0.47); }
  G.buttons=[];
  var bw=Math.min(260, Lw*0.65), bh=48;
  var label=G.levelIdx+1>=LEVELS.length?"menü":"weiter";
  var b1=btn(label, Lw/2-bw/2, Lh*0.55, bw, bh, function(){
    if(G.levelIdx+1>=LEVELS.length){ G.screen="start"; musSync(); }
    else nextLevel();
  });
  paintBtn(b1, true);
  var b2=btn("menü", Lw/2-bw/2, Lh*0.55+bh+14, bw, 40, function(){ G.screen="start"; musSync(); });
  paintBtn(b2, false);
  c.globalAlpha=0.7; c.font="14px NunitoLI"; c.fillText(CREDIT+"  ·  "+VERSION, Lw/2, Lh*0.88);
  c.globalAlpha=1;
}

function drawPause(){
  var c=ctx, Lw=LAY.LWc, Lh=LAY.LHc;
  drawGame();
  c.fillStyle="rgba(221,0,122,0.75)"; c.fillRect(0,0,Lw,Lh);
  c.fillStyle=WHITE; c.font="36px NunitoSB"; c.textAlign="center";
  c.fillText("pause", Lw/2, Lh*0.4);
  c.font="16px NunitoLI"; c.globalAlpha=0.85;
  c.fillText(G.touchUI?"tippen zum weiterspielen":"esc / enter zum weiterspielen", Lw/2, Lh*0.48);
  c.globalAlpha=1;
  G.buttons=[];
  var bw=Math.min(240, Lw*0.6), bh=48;
  var b1=btn("weiter", Lw/2-bw/2, Lh*0.56, bw, bh, function(){ G.screen="game"; G.running=true; G.startAt=performance.now()-G.elapsed; musSync(); });
  paintBtn(b1, true);
  var b2=btn("menü", Lw/2-bw/2, Lh*0.56+bh+14, bw, 40, function(){ G.screen="start"; musSync(); });
  paintBtn(b2, false);
}

function drawInfo(){
  var c=ctx, Lw=LAY.LWc, Lh=LAY.LHc, port=LAY.mode==="port";
  c.fillStyle=PINK; c.fillRect(0,0,Lw,Lh);
  ensureMusicLayout(); drawMusicBtn();
  drawLogo(Lw/2, Lh*0.08, port?28:40);
  c.fillStyle=WHITE; c.textAlign="center";
  c.font="22px NunitoSB"; c.fillText("info", Lw/2, Lh*0.22);
  c.font=(port?14:16)+"px NunitoLI"; c.globalAlpha=0.9;
  var lines=[
    "decke zwei karten auf.",
    "finde paare aus bauteilen",
    "oder bauteil + schaltsymbol.",
    "",
    "steuerung: tippen / klicken",
    "oder pfeiltasten + enter.",
    "",
    CREDIT,
    "motive: platzhalter — austauschbar",
    "über MOTIFS in game.js",
    "",
    VERSION
  ];
  var y=Lh*0.28;
  for(var i=0;i<lines.length;i++){ c.fillText(lines[i], Lw/2, y); y+=(port?20:24); }
  c.globalAlpha=1;
  G.buttons=[];
  var bw=Math.min(220, Lw*0.55), bh=44;
  var b1=btn("zurück", Lw/2-bw/2, Lh*0.86, bw, bh, function(){ G.screen="start"; musSync(); });
  paintBtn(b1, true);
}

function render(){
  var c=ctx;
  c.setTransform(view.dpr,0,0,view.dpr,0,0);
  c.clearRect(0,0,view.cw,view.ch);
  c.setTransform(view.dpr*view.scale,0,0,view.dpr*view.scale, view.dpr*view.ox, view.dpr*view.oy);
  if(G.screen==="start") drawStart();
  else if(G.screen==="game") drawGame();
  else if(G.screen==="win") drawWin();
  else if(G.screen==="pause") drawPause();
  else if(G.screen==="info") drawInfo();
  else drawStart();
}

var lastT=performance.now();
function frame(now){
  var dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  if(G.screen==="game"&&G.running){
    G.elapsed=now-G.startAt;
  }
  if(G.feedbackT>0) G.feedbackT-=dt;
  if(G.screen==="game") updateCardAnims(dt);
  if(G.screen==="win") G.winT+=dt;
  render();
  requestAnimationFrame(frame);
}

/* ---- test hooks ---- */
function forceWin(){
  G.cards.forEach(function(c){ c.flipped=true; c.matched=true; c.anim=null; });
  G.matched=G.pairs; G.flipped=[]; G.lock=false; G.animating=0; G.mismatchDelay=0; G.mismatchIds=[];
  levelWon();
}
function revealAll(){
  G.cards.forEach(function(c){ c.flipped=true; c.anim=null; });
  G.animating=0;
}
/** Test: freeze a card at a flip angle (0=back .. 180=front). */
function setCardFlipAngle(idx, deg){
  var card=G.cards[idx]; if(!card) return;
  deg=clamp(deg,0,180);
  if(card.anim){ card.anim=null; G.animating=Math.max(0,G.animating-1); }
  card._forceAng=deg;
  card.flipped = deg >= 90;
}
function clearCardFlipAngle(idx){
  var card=G.cards[idx]; if(!card) return;
  delete card._forceAng;
}

window.MEMORY = {
  VERSION:VERSION, CREDIT:CREDIT, G:G, LEVELS:LEVELS, MOTIFS:MOTIFS, PART_IDS:PART_IDS,
  LS_BEST:LS_BEST, LS_TOP:LS_TOP, LS_MUSIC:LS_MUSIC, SND:SND, MUS:MUS, playSnd:playSnd, playFlipSnd:playFlipSnd,
  musToggle:musToggle, musSync:musSync, musPlay:musPlay, HS_ON:HS_ON, OHS:OHS,
  startLevel:startLevel, flipCard:flipCard, forceWin:forceWin, revealAll:revealAll,
  beginFlip:beginFlip, setCardFlipAngle:setCardFlipAngle, clearCardFlipAngle:clearCardFlipAngle, FLIP_DUR:FLIP_DUR, cardAngle:cardAngle, cardFlipWidthRatio:cardFlipWidthRatio,
  nextLevel:nextLevel, buildDeck:buildDeck, layoutBoard:layoutBoard, updateCardAnims:updateCardAnims,
  buttonRect:function(label){
    for(var i=0;i<G.buttons.length;i++) if(G.buttons[i].label===label) return G.buttons[i];
    return null;
  },
  cardRect:function(i){ return G.cardRects[i]||null; },
  toClient:function(lx,ly){ return {x:view.ox+lx*view.scale, y:view.oy+ly*view.scale}; },
  view:function(){ return view; },
  LAY:LAY
};

preloadMotifs();
resize();
requestAnimationFrame(frame);
canvas.focus();
})();
