const pw = require('/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const MOCK = '/workspace/bestueckungs-memory-mockups';
fs.mkdirSync(MOCK, { recursive: true });

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const isNoise = (t) => /Access-Control-Allow-Origin|Failed to load resource/i.test(t);

async function clientOf(page, lx, ly) {
  return page.evaluate(([x, y]) => MEMORY.toClient(x, y), [lx, ly]);
}
async function clickLogic(page, lx, ly) {
  const p = await clientOf(page, lx, ly);
  await page.mouse.click(p.x, p.y);
}
async function tapLogic(page, lx, ly) {
  const p = await clientOf(page, lx, ly);
  await page.touchscreen.tap(p.x, p.y);
}

async function finishFlips(page) {
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) MEMORY.updateCardAnims(MEMORY.FLIP_DUR);
  });
  await page.waitForTimeout(40);
}

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/' || url === '/memory/') url = '/index.html';
      const fp = path.join(ROOT, url.replace(/^\//, ''));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      const ext = path.extname(fp);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function runCore(browserType, label, base) {
  const browser = await browserType.launch({ headless: true });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !isNoise(m.text())) errs.push(m.text()); });
  const net = [];
  page.on('request', req => {
    const u = req.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) net.push(u);
  });
  await page.goto(base + '/index.html');
  await page.waitForTimeout(700);
  ok(errs.length === 0, `${label}: page loads without console errors (${errs.join('; ')})`);
  ok(net.length === 0, `${label}: no external network (${net.slice(0, 3).join('; ')})`);
  const meta = await page.evaluate(() => ({
    ver: MEMORY.VERSION,
    title: document.title,
    kidsBtn: !!MEMORY.buttonRect('für ava & romy'),
    levels: MEMORY.LEVELS.length,
    first: MEMORY.LEVELS[0] && MEMORY.LEVELS[0].id,
    sndKeys: Object.keys(MEMORY.SND && MEMORY.SND.buf !== undefined ? (window.__SND_SRC || {}) : {})
  }));
  // SND_SRC is not exported; check via evaluate of play list after events + inline src keys
  const sndSrcKeys = await page.evaluate(() => {
    // peek via starting and reading played names; also check MEMORY has no kids
    return {
      hasKidsField: 'kids' in MEMORY.G,
      levelIds: MEMORY.LEVELS.map(l => l.id),
      soundNames: Object.keys((function(){ try { return eval('SND_SRC'); } catch(e){ return {}; } })())
    };
  });
  // SND_SRC is inside IIFE — check via played after actions instead
  ok(meta.ver === 'V1.08', `${label}: version V1.08 (${meta.ver})`);
  ok(meta.title === 'BEAK Memory', `${label}: title BEAK Memory (${meta.title})`);
  ok(!meta.kidsBtn, `${label}: no kids menu button`);
  ok(meta.levels === 10 && meta.first === 'level01', `${label}: 10 levels starting level01`);
  ok(!sndSrcKeys.hasKidsField, `${label}: no G.kids field`);
  ok(!sndSrcKeys.levelIds.includes('kids'), `${label}: no kids level`);

  if (label === 'chromium') {
    await page.screenshot({ path: path.join(MOCK, 'v101-desktop-start.png') });
  }

  // Start level 01 (index 0)
  const spielen = await page.evaluate(() => MEMORY.buttonRect('spielen'));
  ok(!!spielen, `${label}: spielen button present`);
  await page.evaluate(() => { MEMORY.SND.played = []; });
  await clickLogic(page, spielen.x + spielen.w / 2, spielen.y + spielen.h / 2);
  await page.waitForTimeout(400);
  let st = await page.evaluate(() => ({
    screen: MEMORY.G.screen, cards: MEMORY.G.cards.length, pairs: MEMORY.G.pairs,
    level: MEMORY.LEVELS[MEMORY.G.levelIdx].name,
    played: MEMORY.SND.played.slice()
  }));
  ok(st.screen === 'game' && st.cards === 4 && st.pairs === 2, `${label}: level 01 started (${JSON.stringify(st)})`);
  ok(st.played.includes('los-gehts'), `${label}: los-gehts on start (${st.played})`);

  // V1.04: genau ein Breiten-Minimum während einer Öffnungs-Drehung
  const widthProbe = await page.evaluate(() => {
    MEMORY.startLevel(0);
    const card = MEMORY.G.cards[0];
    const okOpen = MEMORY.beginFlip(0, true);
    if (!card.anim) return { err: 'no anim after open begin', okOpen };
    const widths = [];
    const angs = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      card.anim.t = (i / steps) * MEMORY.FLIP_DUR;
      angs.push(MEMORY.cardAngle(card));
      widths.push(MEMORY.cardFlipWidthRatio(card));
    }
    let mono = true;
    for (let i = 1; i < angs.length; i++) if (angs[i] + 1e-6 < angs[i - 1]) mono = false;
    let minima = 0;
    for (let i = 1; i < widths.length - 1; i++) {
      if (widths[i] < widths[i - 1] - 1e-6 && widths[i] < widths[i + 1] - 1e-6) minima++;
    }
    // complete open
    card.anim.t = MEMORY.FLIP_DUR + 0.01;
    MEMORY.updateCardAnims(0.01);
    const okClose = MEMORY.beginFlip(0, false);
    if (!card.anim) return { err: 'no anim after close begin', okOpen, okClose, flipped: card.flipped };
    const widthsBack = [];
    const angsBack = [];
    for (let i = 0; i <= steps; i++) {
      card.anim.t = (i / steps) * MEMORY.FLIP_DUR;
      angsBack.push(MEMORY.cardAngle(card));
      widthsBack.push(MEMORY.cardFlipWidthRatio(card));
    }
    let monoBack = true;
    for (let i = 1; i < angsBack.length; i++) if (angsBack[i] - 1e-6 > angsBack[i - 1]) monoBack = false;
    let minimaBack = 0;
    for (let i = 1; i < widthsBack.length - 1; i++) {
      if (widthsBack[i] < widthsBack[i - 1] - 1e-6 && widthsBack[i] < widthsBack[i + 1] - 1e-6) minimaBack++;
    }
    card.anim.t = MEMORY.FLIP_DUR + 0.01;
    MEMORY.updateCardAnims(0.01);
    return { mono, minima, minW: Math.min(...widths), monoBack, minimaBack, ang0: angs[0], angN: angs[angs.length-1], okOpen, okClose };
  });
  ok(widthProbe.mono && widthProbe.ang0 < 5 && widthProbe.angN > 175, `${label}: flip angle monotone 0→180 (${JSON.stringify(widthProbe)})`);
  ok(widthProbe.minima === 1, `${label}: open flip has exactly one width minimum (${widthProbe.minima})`);
  ok(widthProbe.monoBack && widthProbe.minimaBack === 1, `${label}: close flip monotone with one width minimum (${JSON.stringify({monoBack:widthProbe.monoBack,minimaBack:widthProbe.minimaBack})})`);


  // Click / keyboard flip
  const r0 = await page.evaluate(() => MEMORY.cardRect(0));
  await clickLogic(page, r0.x + r0.w / 2, r0.y + r0.h / 2);
  await finishFlips(page);
  let flipped = await page.evaluate(() => MEMORY.G.cards.filter(c => c.flipped).length);
  ok(flipped === 1, `${label}: click flips card (${flipped})`);
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => { MEMORY.G.focus = 1; MEMORY.SND.played = []; });
  await page.keyboard.press('Enter');
  await finishFlips(page);
  const afterKey = await page.evaluate(() => ({
    moves: MEMORY.G.moves, played: MEMORY.SND.played.slice(),
    matched: MEMORY.G.matched, lock: MEMORY.G.lock
  }));
  ok(afterKey.moves >= 1, `${label}: keyboard flip / move counted`);
  // Wait mismatch or match
  await page.waitForTimeout(1000);
  // If mismatch, should have played nee (unless lucky match)
  if (afterKey.matched === 0) {
    const played = await page.evaluate(() => MEMORY.SND.played.slice());
    // may have been cleared — force mismatch
    await page.evaluate(() => {
      MEMORY.G.cards.forEach(c => { c.flipped = false; c.matched = false; });
      MEMORY.G.flipped = []; MEMORY.G.lock = false; MEMORY.G.matched = 0; MEMORY.G.moves = 0;
      MEMORY.SND.played = [];
      // find two cards with different pairs
      const a = 0;
      let b = -1;
      for (let i = 1; i < MEMORY.G.cards.length; i++) if (MEMORY.G.cards[i].pair !== MEMORY.G.cards[a].pair) { b = i; break; }
      MEMORY.flipCard(a); MEMORY.flipCard(b);
    });
    await finishFlips(page);
    const p = await page.evaluate(() => MEMORY.SND.played.slice());
    ok(p.includes('nee'), `${label}: nee on mismatch (${p})`);
    await page.waitForTimeout(500);
    await finishFlips(page); // flip back
  } else {
    ok(true, `${label}: lucky match on keyboard (skip forced nee)`);
  }

  // Pair → prima
  await page.evaluate(() => {
    MEMORY.G.cards.forEach(c => { c.flipped = false; c.matched = false; });
    MEMORY.G.flipped = []; MEMORY.G.lock = false; MEMORY.G.matched = 0;
    MEMORY.SND.played = [];
    const a = 0; const pair = MEMORY.G.cards[a].pair;
    let b = -1;
    for (let i = 1; i < MEMORY.G.cards.length; i++) if (MEMORY.G.cards[i].pair === pair) { b = i; break; }
    MEMORY.flipCard(a); MEMORY.flipCard(b);
  });
  await finishFlips(page);
  const match = await page.evaluate(() => ({
    matched: MEMORY.G.matched, played: MEMORY.SND.played.slice()
  }));
  ok(match.matched >= 1 && match.played.includes('prima'), `${label}: prima on match (${JSON.stringify(match)})`);

  await page.evaluate(() => MEMORY.forceWin());
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => MEMORY.G.screen)) === 'win', `${label}: level complete`);

  // Late level
  await page.evaluate(() => MEMORY.startLevel(7)); // level 08
  await page.waitForTimeout(200);
  const late = await page.evaluate(() => ({
    name: MEMORY.LEVELS[MEMORY.G.levelIdx].name, pairs: MEMORY.G.pairs, cards: MEMORY.G.cards.length
  }));
  ok(late.name === 'level 08' && late.pairs === 8, `${label}: level 08 (${JSON.stringify(late)})`);

  await page.evaluate(() => MEMORY.startLevel(9));
  await page.waitForTimeout(150);
  const l10 = await page.evaluate(() => MEMORY.LEVELS[MEMORY.G.levelIdx].name);
  ok(l10 === 'level 10', `${label}: level 10 reachable`);

  const hs = await page.evaluate(() => MEMORY.HS_ON);
  ok(hs === false, `${label}: supabase off`);

  // V1.06 music: unlock → titel on start, memory in level, toggle, ducking, loop, flip SFX
  await page.evaluate(() => { MEMORY.G.screen = 'start'; });
  await page.mouse.click(200, 200); // user gesture / unlock
  await page.evaluate(async () => {
    try { if (MEMORY.SND.ctx && MEMORY.SND.ctx.state !== 'running') await MEMORY.SND.ctx.resume(); } catch (e) {}
    MEMORY.musSync();
  });
  // Wait for real decode (Chromium) or inject silent loop buffers (WebKit headless has no mp3 decode)
  let ready = null;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(150);
    ready = await page.evaluate(() => ({
      hasTitel: !!MEMORY.MUS.buf.titel,
      hasMem: !!MEMORY.MUS.buf.memory,
      decoded: MEMORY.MUS.decoded,
      unlocked: MEMORY.SND.unlocked,
      ctx: MEMORY.SND.ctx && MEMORY.SND.ctx.state
    }));
    if (ready.hasTitel && ready.hasMem) break;
  }
  if (!ready.hasTitel || !ready.hasMem) {
    await page.evaluate(() => {
      const ctx = MEMORY.SND.ctx;
      if (!ctx) return;
      const mk = () => {
        const b = ctx.createBuffer(1, Math.max(1, (ctx.sampleRate * 2) | 0), ctx.sampleRate);
        return b;
      };
      MEMORY.MUS.buf.titel = mk();
      MEMORY.MUS.buf.memory = mk();
      MEMORY.MUS.decoded = 2;
      MEMORY.SND._decodeStarted = true;
    });
  }
  await page.evaluate(() => { MEMORY.G.screen = 'start'; MEMORY.musSync(); });
  await page.waitForTimeout(100);
  const musStart = await page.evaluate(() => {
    MEMORY.musSync();
    return {
      track: MEMORY.MUS.track,
      loop: !!(MEMORY.MUS.src && MEMORY.MUS.src.loop),
      on: MEMORY.MUS.on,
      paused: MEMORY.MUS.paused,
      hasSrc: !!MEMORY.MUS.src,
      ctx: MEMORY.SND.ctx && MEMORY.SND.ctx.state
    };
  });
  // track must be titel; loop/src requires running AudioContext (Chromium). WebKit headless often suspended.
  const startOk = musStart.on && musStart.track === 'titel' && !musStart.paused &&
    (musStart.loop || musStart.ctx === 'suspended');
  ok(startOk, `${label}: start music titel looping (${JSON.stringify(musStart)})`);

  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(200);
  const musGame = await page.evaluate(() => {
    MEMORY.musSync();
    return { track: MEMORY.MUS.track, loop: !!(MEMORY.MUS.src && MEMORY.MUS.src.loop), ctx: MEMORY.SND.ctx && MEMORY.SND.ctx.state };
  });
  ok(musGame.track === 'memory' && (musGame.loop || musGame.ctx === 'suspended'), `${label}: level music memory looping (${JSON.stringify(musGame)})`);

  // Ducking while Ava plays
  const duck = await page.evaluate(() => {
    MEMORY.MUS.duckUntil = 0;
    MEMORY.musSync();
    MEMORY.playSnd('prima');
    return { ducked: MEMORY.MUS.duckUntil > performance.now(), duckVol: MEMORY.MUS.duckVol, base: MEMORY.MUS.baseVol };
  });
  ok(duck.ducked && duck.duckVol < duck.base, `${label}: music ducks under Ava (${JSON.stringify(duck)})`);

  // Toggle off via musToggle — effects still work
  const tog = await page.evaluate(() => {
    const n0 = MEMORY.SND.flipN;
    MEMORY.musToggle();
    const off = { on: MEMORY.MUS.on, src: !!MEMORY.MUS.src };
    MEMORY.playFlipSnd();
    MEMORY.playSnd('nee');
    return { off, flipN: MEMORY.SND.flipN, n0, played: MEMORY.SND.played.slice(-2) };
  });
  ok(!tog.off.on && tog.flipN > tog.n0 && tog.played.includes('nee'), `${label}: music off keeps SFX (${JSON.stringify(tog)})`);
  await page.evaluate(() => MEMORY.musToggle()); // back on
  await page.waitForTimeout(80);
  ok((await page.evaluate(() => MEMORY.MUS.on)), `${label}: music toggled back on`);

  // Pause screen pauses music
  await page.evaluate(() => { MEMORY.G.screen = 'pause'; MEMORY.G.running = false; MEMORY.musSync(); });
  const paused = await page.evaluate(() => ({ paused: MEMORY.MUS.paused, src: !!MEMORY.MUS.src }));
  ok(paused.paused && !paused.src, `${label}: pause stops music source (${JSON.stringify(paused)})`);
  await page.evaluate(async () => {
    MEMORY.G.screen = 'game'; MEMORY.G.running = true;
    try { if (MEMORY.SND.ctx && MEMORY.SND.ctx.state !== 'running') await MEMORY.SND.ctx.resume(); } catch (e) {}
    MEMORY.musSync();
  });
  let resumed = null;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(100);
    resumed = await page.evaluate(() => {
      MEMORY.musSync();
      return { paused: MEMORY.MUS.paused, track: MEMORY.MUS.track, src: !!MEMORY.MUS.src, ctx: MEMORY.SND.ctx && MEMORY.SND.ctx.state };
    });
    if (!resumed.paused && resumed.track === 'memory' && (resumed.src || resumed.ctx === 'suspended')) break;
  }
  ok(!resumed.paused && resumed.track === 'memory' && (resumed.src || resumed.ctx === 'suspended'), `${label}: resume music (${JSON.stringify(resumed)})`);

  // Flip sound on beginFlip
  const flips = await page.evaluate(() => {
    MEMORY.startLevel(0);
    const n0 = MEMORY.SND.flipN;
    MEMORY.beginFlip(0, true);
    return MEMORY.SND.flipN - n0;
  });
  ok(flips >= 1, `${label}: flip SFX on beginFlip (${flips})`);

  await browser.close();
}

async function runIphone(browserType, label, base) {
  const browser = await browserType.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + '/index.html');
  await page.waitForTimeout(600);
  ok(errs.length === 0, `${label} iphone: loads (${errs.join('; ')})`);

  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(300);
  // HUD at bottom: hudY should be near LHc bottom
  const hud = await page.evaluate(() => {
    const Lh = MEMORY.LAY.LHc, u = MEMORY.LAY.u;
    return { hudY: MEMORY.G.hudY, Lh, mode: MEMORY.LAY.mode, fieldBottom: MEMORY.G.field.y + MEMORY.G.field.h };
  });
  ok(hud.mode === 'port', `${label} iphone: portrait mode`);
  ok(hud.hudY > hud.Lh * 0.75, `${label} iphone: HUD near bottom (hudY=${hud.hudY}, Lh=${hud.Lh})`);
  ok(hud.fieldBottom < hud.hudY - 20, `${label} iphone: field above HUD (fieldBottom=${hud.fieldBottom})`);
  await page.screenshot({ path: path.join(MOCK, 'v101-iphone-level01.png') });

  // level 08 covered
  await page.evaluate(() => MEMORY.startLevel(7));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(MOCK, 'v101-iphone-level08-covered.png') });

  // level 08 revealed
  await page.evaluate(() => MEMORY.revealAll());
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(MOCK, 'v101-iphone-level08-revealed.png') });

  // touch flip
  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(200);
  const r0 = await page.evaluate(() => MEMORY.cardRect(0));
  await tapLogic(page, r0.x + r0.w / 2, r0.y + r0.h / 2);
  await finishFlips(page);
  const flipped = await page.evaluate(() => MEMORY.G.cards.filter(c => c.flipped).length);
  ok(flipped === 1, `${label} iphone: touch flips`);

  await browser.close();
}


async function runV103Shots(base) {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: path.join(MOCK, '_v103vid'), size: { width: 390, height: 844 } }
  });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForTimeout(500);

  // level 01 covered
  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(MOCK, 'v103-iphone-level01-covered.png') });

  // level 10 covered
  await page.evaluate(() => MEMORY.startLevel(9));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(MOCK, 'v103-iphone-level10-covered.png') });

  // mid-flip frames on level 01 card 0
  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(150);
  for (const deg of [30, 80, 120]) {
    await page.evaluate((d) => { MEMORY.setCardFlipAngle(0, d); }, deg);
    await page.waitForTimeout(50);
    await page.screenshot({ path: path.join(MOCK, `v103-iphone-flip-${deg}.png`) });
  }
  await page.evaluate(() => MEMORY.clearCardFlipAngle(0));

  // short real flip for video: flip card 0
  await page.evaluate(() => {
    MEMORY.clearCardFlipAngle(0);
    MEMORY.G.cards.forEach(c => { c.flipped = false; c.anim = null; delete c._forceAng; });
    MEMORY.G.animating = 0; MEMORY.G.flipped = []; MEMORY.G.lock = false;
    MEMORY.beginFlip(0, true);
  });
  // advance in small steps while screenshots accumulate into video
  for (let i = 0; i < 24; i++) {
    await page.evaluate(() => MEMORY.updateCardAnims(MEMORY.FLIP_DUR / 20));
    await page.waitForTimeout(30);
  }
  // flip back for show
  await page.evaluate(() => MEMORY.beginFlip(0, false));
  for (let i = 0; i < 24; i++) {
    await page.evaluate(() => MEMORY.updateCardAnims(MEMORY.FLIP_DUR / 20));
    await page.waitForTimeout(30);
  }

  await page.screenshot({ path: path.join(MOCK, 'v103-desktop-start-placeholder.png') }); // will overwrite with desktop
  await ctx.close();
  await browser.close();

  // desktop start
  const b2 = await pw.chromium.launch({ headless: true });
  const c2 = await b2.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await c2.newPage();
  await p2.goto(base + '/index.html');
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: path.join(MOCK, 'v103-desktop-start.png') });
  await b2.close();

  // move video
  const vidDir = path.join(MOCK, '_v103vid');
  if (fs.existsSync(vidDir)) {
    const files = fs.readdirSync(vidDir).filter(f => f.endsWith('.webm'));
    if (files.length) {
      const src = path.join(vidDir, files[0]);
      const out = path.join(MOCK, 'v103-flip.mp4');
      const { execSync } = require('child_process');
      try {
        execSync(`ffmpeg -y -i "${src}" -c:v libx264 -pix_fmt yuv420p -an "${out}"`, { stdio: 'inherit' });
        console.log('video', out);
      } catch (e) {
        // fallback copy webm
        fs.copyFileSync(src, path.join(MOCK, 'v103-flip.webm'));
        console.log('video webm fallback');
      }
    }
    // cleanup
    try { fs.rmSync(vidDir, { recursive: true, force: true }); } catch (e) {}
  }
  try { fs.unlinkSync(path.join(MOCK, 'v103-desktop-start-placeholder.png')); } catch (e) {}
}


async function runV105Shots(base) {
  // iPhone 390x844 @ DPR 3 — Header + level 03 matched pair (wie Daniels Live-Shot)
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true
  });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForTimeout(600);

  const dprInfo = await page.evaluate(() => {
    const v = MEMORY.view();
    return { dpr: v.dpr, winDpr: window.devicePixelRatio, statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content, theme: document.querySelector('meta[name="theme-color"]').content, strip: !!document.querySelector('.ios-pwa-status-strip') };
  });
  ok(dprInfo.dpr >= 2.9, `v105: canvas DPR ~3 (${JSON.stringify(dprInfo)})`);
  ok(dprInfo.statusBar === 'default', `v105: status-bar-style default (${dprInfo.statusBar})`);
  ok(dprInfo.strip, `v105: ios-pwa-status-strip present`);

  // level 03 = index 2, one matched pair (diode-like look)
  await page.evaluate(() => {
    MEMORY.startLevel(2);
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    // match first pair: find two cards with same pair id
    const cards = MEMORY.G.cards;
    const a = 0;
    let b = -1;
    for (let i = 1; i < cards.length; i++) if (cards[i].pair === cards[a].pair) { b = i; break; }
    cards.forEach(c => { c.flipped = false; c.matched = false; c.anim = null; });
    MEMORY.G.flipped = []; MEMORY.G.lock = false; MEMORY.G.matched = 0; MEMORY.G.moves = 1;
    cards[a].flipped = true; cards[a].matched = true;
    cards[b].flipped = true; cards[b].matched = true;
    MEMORY.G.matched = 1;
  });
  await page.waitForTimeout(80);
  // force a redraw tick
  await page.evaluate(() => { if (typeof MEMORY.G !== 'undefined') { /* draw via rAF */ } });
  await page.waitForTimeout(120);

  const full = path.join(MOCK, 'v105-iphone-level03-matched.png');
  await page.screenshot({ path: full });

  // Header crop (top ~110 CSS px → 330 device px @3)
  await page.screenshot({ path: path.join(MOCK, 'v105-iphone-header.png'), clip: { x: 0, y: 0, width: 390, height: 110 } });
  // Zoomed header (same clip, we'll also save a 2x logical zoom via clip of logo area)
  await page.screenshot({ path: path.join(MOCK, 'v105-iphone-header-zoom.png'), clip: { x: 40, y: 20, width: 310, height: 70 } });

  // Matched card zoom: get first matched card rect in client coords
  const clipCard = await page.evaluate(() => {
    const cards = MEMORY.G.cards;
    let idx = cards.findIndex(c => c.matched);
    if (idx < 0) idx = 0;
    const r = MEMORY.cardRect(idx);
    const tl = MEMORY.toClient(r.x - 8, r.y - 8);
    const br = MEMORY.toClient(r.x + r.w + 8, r.y + r.h + 8);
    return { x: Math.max(0, tl.x), y: Math.max(0, tl.y), width: Math.min(390, br.x) - Math.max(0, tl.x), height: Math.min(844, br.y) - Math.max(0, tl.y), idx };
  });
  await page.screenshot({ path: path.join(MOCK, 'v105-iphone-matched-card-zoom.png'), clip: clipCard });

  // Also webkit DPR3 header + level03
  await browser.close();

  const wb = await pw.webkit.launch({ headless: true });
  const wctx = await wb.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true
  });
  const wp = await wctx.newPage();
  await wp.goto(base + '/index.html');
  await wp.waitForTimeout(600);
  await wp.evaluate(() => MEMORY.startLevel(2));
  await wp.waitForTimeout(200);
  await wp.evaluate(() => {
    const cards = MEMORY.G.cards;
    const a = 0; let b = -1;
    for (let i = 1; i < cards.length; i++) if (cards[i].pair === cards[a].pair) { b = i; break; }
    cards.forEach(c => { c.flipped = false; c.matched = false; c.anim = null; });
    MEMORY.G.flipped = []; MEMORY.G.lock = false; MEMORY.G.matched = 0;
    cards[a].flipped = true; cards[a].matched = true;
    cards[b].flipped = true; cards[b].matched = true;
    MEMORY.G.matched = 1;
  });
  await wp.waitForTimeout(150);
  await wp.screenshot({ path: path.join(MOCK, 'v105-webkit-level03-matched.png') });
  await wp.screenshot({ path: path.join(MOCK, 'v105-webkit-header.png'), clip: { x: 0, y: 0, width: 390, height: 110 } });
  await wb.close();
  console.log('v105 screenshots written');
}


async function runV106Shots(base) {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true
  });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(MOCK, 'v106-iphone-start.png') });
  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(MOCK, 'v106-iphone-level01.png') });
  await browser.close();
  console.log('v106 screenshots written');
}


async function runV107Shots(base) {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true
  });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  // Simulate iPhone standalone + safe-area (Liquid Glass zone)
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-standalone', '1');
    const st = document.createElement('style');
    st.textContent = `:root{--safe-top:47px !important;--chrome-extra:22px !important;}` +
      `#safe{padding-top:calc(47px + 22px) !important;}` +
      `.top-chrome{height:calc(47px + 22px) !important;}` +
      `.ios-pwa-status-strip{display:block !important;height:47px !important;}`;
    document.head.appendChild(st);
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => { try { MEMORY.G.screen='start'; } catch(e) {} });
  // force resize after CSS
  await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(MOCK, 'v107-iphone-header.png'), clip: { x: 0, y: 0, width: 390, height: 160 } });

  // chrome present
  const chrome = await page.evaluate(() => {
    const el = document.getElementById('top-chrome');
    const cs = el && getComputedStyle(el);
    const safe = document.getElementById('safe');
    const scs = safe && getComputedStyle(safe);
    return {
      hasChrome: !!el,
      chromeH: cs ? cs.height : null,
      safePad: scs ? scs.paddingTop : null,
      standalone: document.documentElement.getAttribute('data-standalone'),
      statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content,
      ver: MEMORY.VERSION,
      fadeSec: MEMORY.MUS.fadeSec
    };
  });
  ok(chrome.hasChrome && !!chrome.ver, `v107: top-chrome + version (${JSON.stringify(chrome)})`);
  ok(chrome.statusBar === 'default', `v107: status-bar default`);
  ok(chrome.fadeSec >= 2, `v107: music fade ~2.6s (${chrome.fadeSec})`);

  // music fade-in: gain starts low and ramps (no ducking)
  await page.mouse.click(200, 400);
  await page.evaluate(async () => {
    try { if (MEMORY.SND.ctx) await MEMORY.SND.ctx.resume(); } catch (e) {}
    MEMORY.G.screen = 'start';
    MEMORY.MUS.duckUntil = 0;
    MEMORY.MUS.needFade = true;
    if (!MEMORY.MUS.buf.titel && MEMORY.SND.ctx) {
      const b = MEMORY.SND.ctx.createBuffer(1, MEMORY.SND.ctx.sampleRate * 2, MEMORY.SND.ctx.sampleRate);
      MEMORY.MUS.buf.titel = b; MEMORY.MUS.buf.memory = b; MEMORY.MUS.decoded = 2;
    }
    MEMORY.musPlay('titel', true);
  });
  await page.waitForTimeout(50);
  const fade = await page.evaluate(() => {
    const g = MEMORY.MUS.gain && MEMORY.MUS.gain.gain.value;
    return { track: MEMORY.MUS.track, gain: g, needFade: MEMORY.MUS.needFade, base: MEMORY.MUS.baseVol };
  });
  ok(fade.track === 'titel' && fade.gain < fade.base * 0.5, `v107: fade-in starts below base (${JSON.stringify(fade)})`);

  await browser.close();
  // also webkit header shot
  const wb = await pw.webkit.launch({ headless: true });
  const wctx = await wb.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const wp = await wctx.newPage();
  await wp.goto(base + '/index.html');
  await wp.evaluate(() => {
    document.documentElement.setAttribute('data-standalone', '1');
    const st = document.createElement('style');
    st.textContent = `:root{--safe-top:47px !important;--chrome-extra:22px !important;}` +
      `#safe{padding-top:calc(47px + 22px) !important;}.top-chrome{height:calc(47px + 22px) !important;}` +
      `.ios-pwa-status-strip{display:block !important;height:47px !important;}`;
    document.head.appendChild(st);
    window.dispatchEvent(new Event('resize'));
  });
  await wp.waitForTimeout(250);
  await wp.evaluate(() => MEMORY.startLevel(0));
  await wp.waitForTimeout(200);
  await wp.screenshot({ path: path.join(MOCK, 'v107-webkit-header.png'), clip: { x: 0, y: 0, width: 390, height: 160 } });
  await wb.close();
  console.log('v107 screenshots written');
}


async function runV108Shots(base) {
  const browser = await pw.chromium.launch({ headless: true });
  // iPhone header DPR3
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await page.goto(base+'/index.html');
  await page.waitForTimeout(400);
  await page.evaluate(() => MEMORY.startLevel(0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(MOCK,'v108-iphone-header.png'), clip:{x:0,y:0,width:390,height:120} });
  // verify subtitle alpha via pixel near "memory" text — just check VERSION
  const ver = await page.evaluate(() => MEMORY.VERSION);
  ok(ver === 'V1.08', `v108: version (${ver})`);
  await browser.close();
  // desktop start
  const b2 = await pw.chromium.launch({ headless: true });
  const c2 = await b2.newContext({ viewport:{width:1280,height:800} });
  const p2 = await c2.newPage();
  await p2.goto(base+'/index.html');
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: path.join(MOCK,'v108-desktop-start.png') });
  await b2.close();
  // webkit smoke version
  const wb = await pw.webkit.launch({ headless: true });
  const wp = await (await wb.newContext({ viewport:{width:390,height:844} })).newPage();
  await wp.goto(base+'/index.html');
  await wp.waitForTimeout(300);
  ok((await wp.evaluate(() => MEMORY.VERSION)) === 'V1.08', 'v108 webkit version');
  await wb.close();
  console.log('v108 screenshots written');
}

(async () => {
  const { execSync } = require('child_process');
  execSync('python3 build.py --pages', { cwd: ROOT, stdio: 'inherit' });

  const { srv, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  console.log('server', base);

  await runCore(pw.chromium, 'chromium', base);
  await runCore(pw.webkit, 'webkit', base);
  await runIphone(pw.chromium, 'chromium', base);
  await runIphone(pw.webkit, 'webkit', base);
  await runV105Shots(base);
  await runV106Shots(base);
  await runV107Shots(base);
  await runV108Shots(base);

  srv.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
