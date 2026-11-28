/* 마르스 자비스 HUD — 원형 코어 · 음성 대화 · Gemini 연동 · 실행 계획 패널
   · 키는 localStorage에만 저장한다(코드·저장소에 하드코딩 없음).
   · 외부 라이브러리 없이 Canvas 2D · Web Speech API · fetch만 사용한다. */
(() => {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────────────────── 저장소 ───────────────────────── */
  const LS = {
    key: 'marshud_gemini_key_v1',
    cfg: 'marshud_cfg_v1',
    hist: 'marshud_history_v1'
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  const API = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const CHAIN = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  const OTHER_KEY_SOURCES = [
    { k: 'ink1fs_gemini_key_v1', name: '필드 스튜디오' },
    { k: 'mars_secretary_mobile_gemini_v1', name: '마르스 비서실' }
  ];

  const cfg = Object.assign(
    { model: 'auto', tts: 'on', voice: '', rate: 1 },
    safeJSON(store.get(LS.cfg), {})
  );
  function safeJSON(s, d) { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } }
  function saveCfg() { store.set(LS.cfg, JSON.stringify(cfg)); }

  const apiKey = () => (store.get(LS.key) || '').trim();

  /* ───────────────────────── 페르소나 ───────────────────────── */
  const SYSTEM = [
    '너는 "니케"다. 마르스 님(최성일, 수우전산·잉크원 대표 · 경기 수원)의 개인 AI 비서이며, 지금은 "마르스 자비스 HUD" 화면 안에서 음성으로 답하고 있다.',
    '사업 맥락: 수우전산은 복사기·프린터 임대와 수리(A/S)를 하는 회사다. 잉크원은 그 브랜드로 블로그·쇼츠·홍보를 하고, 잉크원 AS AI와 필드 스튜디오 같은 자동화 도구를 직접 만든다. 거래처는 학교·학원·관공서·기업이고, 미수금·세금계산서·방문 일정 관리가 일상 업무다.',
    '답변 원칙:',
    '1. 한국어로, 결론 → 근거 → 다음 액션 순서로 3문장 이내(대략 60~110자)로 짧게 말한다.',
    '2. 음성으로 읽히므로 목록 기호, 마크다운 표시(**, #, -), 이모지를 쓰지 않는다. 숫자는 읽기 쉽게 쓴다.',
    '3. 확인되지 않은 거래처·금액·일정을 지어내지 않는다. 모르면 "확인이 필요합니다"라고 말한다.',
    '4. 계산이 필요하면 직접 계산해 수치로 답한다.',
    '5. 사용자가 "계획", "단계별", "실행 계획", "플랜"을 요청하면 답변 끝에 아래 형식의 JSON 코드블록을 덧붙인다. 코드블록 앞뒤에 다른 말을 쓰지 않는다.',
    '```json',
    '{"plan":[{"title":"단계 이름","detail":"구체적으로 할 일 한 줄","owner":"니케","eta":"10분"}]}',
    '```',
    '6. 잡담에는 짧고 위트 있게 답한다. 존댓말을 쓴다.'
  ].join('\n');

  /* ───────────────────────── 아이콘(SVG) ───────────────────────── */
  const SVG = (body, sw) => '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  const ICON = {
    sound: SVG('<path d="M4 9.4h3.4L12 5.4v13.2L7.4 14.6H4z"/><path d="M16.2 9.2a4.2 4.2 0 0 1 0 5.6"/><path d="M18.8 6.4a8 8 0 0 1 0 11.2"/>', 1.6),
    mute: SVG('<path d="M4 9.4h3.4L12 5.4v13.2L7.4 14.6H4z"/><path d="M16.4 9.6l4.6 4.6M21 9.6l-4.6 4.6"/>', 1.6),
    brief: SVG('<rect x="5" y="4.2" width="14" height="16" rx="2.2"/><path d="M9 4.2V3h6v1.2"/><path d="M8.6 9.6h6.8M8.6 13h6.8M8.6 16.4h4"/>'),
    promo: SVG('<path d="M6.8 9V6.6h10.4V9"/><rect x="4.4" y="9" width="15.2" height="6.4" rx="1.4"/><path d="M7.6 15.4v3.8h8.8v-3.8"/><path d="M17 12.2h1.2"/>'),
    wrench: SVG('<path d="M14.6 6.2a4.1 4.1 0 0 0 5.2 5.2l-8.4 8.4a2.1 2.1 0 0 1-3-3z"/><path d="M14.6 6.2 18 2.8l3.2 3.2-3.4 3.4"/>'),
    idea: SVG('<path d="M9 17.4h6"/><path d="M10 20.4h4"/><path d="M12 3.2a5.6 5.6 0 0 0-3.2 10.2v2h6.4v-2A5.6 5.6 0 0 0 12 3.2z"/>')
  };

  /* ───────────────────────── 화면 요소 ───────────────────────── */
  const canvas = $('#hudCanvas');
  const ctx = canvas.getContext('2d');
  const el = {
    body: document.body,
    stateText: $('#stateText'),
    stateChip: $('#stateChip'),
    coreState: $('#coreState'),
    coreSub: $('#coreSub'),
    coreWave: $('#coreWave'),
    metaClock: $('#metaClock'),
    metaModel: $('#metaModel'),
    metaKey: $('#metaKey'),
    subtitleBody: $('#subtitleBody'),
    subMeta: $('#subMeta'),
    typingFlag: $('#typingFlag'),
    keyBanner: $('#keyBanner'),
    presets: $('#presets'),
    composer: $('#composer'),
    cmd: $('#cmd'),
    btnSend: $('#btnSend'),
    btnMic: $('#btnMic'),
    btnMute: $('#btnMute'),
    muteIco: $('#muteIco'),
    planList: $('#planList'),
    planEmpty: $('#planEmpty'),
    planCount: $('#planCount'),
    settings: $('#settings'),
    apiInput: $('#apiKey'),
    modelSel: $('#modelSel'),
    ttsSel: $('#ttsSel'),
    voiceSel: $('#voiceSel'),
    rateSel: $('#rateSel'),
    rateVal: $('#rateVal'),
    testResult: $('#testResult'),
    foundKey: $('#foundKey'),
    foundName: $('#foundName'),
    toast: $('#toast'),
    subText: null
  };

  /* 파형 미터 (코어 아래 작은 막대 17개) */
  const WAVE_BARS = 17;
  for (let i = 0; i < WAVE_BARS; i++) el.coreWave.appendChild(document.createElement('i'));
  const waveBars = $$('#coreWave i');

  /* ───────────────────────── 상태 ───────────────────────── */
  const SUBS = {
    idle: '대기 중 · 말을 걸어 주세요',
    listening: '듣는 중 · 말씀하세요',
    thinking: '분석 중 · 잠시만요',
    speaking: '응답 중 · 음성 출력'
  };
  const STATE = {
    idle:      { spin: 0.30, spin2: -0.20, glow: 0.55, particle: 0.55, ring: 0.00 },
    listening: { spin: 0.62, spin2: -0.44, glow: 0.95, particle: 1.00, ring: 1.00 },
    thinking:  { spin: 2.60, spin2: -1.90, glow: 0.80, particle: 1.55, ring: 0.35 },
    speaking:  { spin: 0.90, spin2: -0.62, glow: 1.00, particle: 1.10, ring: 0.85 }
  };
  const view = { w: 0, h: 0, cx: 0, cy: 0, R: 0, t: 0, dpr: 1 };
  let state = 'idle';
  let anim = Object.assign({}, STATE.idle);
  let amp = 0.05;
  const wave = new Float32Array(96);

  function setState(s, sub) {
    state = s;
    el.body.dataset.state = s;
    el.stateText.textContent = s.toUpperCase();
    el.coreState.textContent = s.toUpperCase();
    el.coreSub.textContent = sub || SUBS[s];
  }

  /* ───────────────────────── 캔버스 ───────────────────────── */
  const dots = [];
  for (let i = 0; i < 84; i++) {
    dots.push({
      a: Math.random() * TAU,
      r: 0.42 + Math.random() * 0.62,
      sp: (0.12 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1),
      s: 0.6 + Math.random() * 1.7,
      al: 0.12 + Math.random() * 0.5,
      tw: 0.4 + Math.random() * 1.8,
      ph: Math.random() * TAU,
      gold: Math.random() < 0.16
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.w = w; view.h = h; view.dpr = dpr;
    view.cx = w / 2;
    view.cy = h * 0.44;
    view.R = Math.min(w * 0.44, h * 0.37);
  }

  const cA = (a) => 'rgba(0,229,255,' + a + ')';
  const gA = (a) => 'rgba(255,198,92,' + a + ')';

  function arc(r, a0, a1, color, lw, blur) {
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    if (blur) { ctx.shadowBlur = blur; ctx.shadowColor = color; }
    ctx.stroke();
    if (blur) ctx.shadowBlur = 0;
  }

  function drawHUD() {
    const { w, h, cx, cy, R, t } = view;
    ctx.clearRect(0, 0, w, h);
    if (R < 20) return;

    const target = STATE[state];
    anim.spin += (target.spin - anim.spin) * 0.06;
    anim.spin2 += (target.spin2 - anim.spin2) * 0.06;
    anim.glow += (target.glow - anim.glow) * 0.06;
    anim.particle += (target.particle - anim.particle) * 0.05;
    anim.ring += (target.ring - anim.ring) * 0.07;

    const pulse = Math.sin(t * 1.15) * 0.5 + 0.5;
    const breathe = 1 + Math.sin(t * 1.05) * 0.012;
    const spinA = t * anim.spin;
    const spinB = t * anim.spin2;

    ctx.save();
    ctx.translate(cx, cy);

    /* 중앙 앰비언트 글로우 */
    const glowR = R * (1.18 + amp * 0.22 + pulse * 0.04);
    const grd = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, glowR);
    grd.addColorStop(0, 'rgba(0,229,255,' + (0.16 * anim.glow) + ')');
    grd.addColorStop(0.45, 'rgba(0,180,220,' + (0.06 * anim.glow) + ')');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, TAU);
    ctx.fill();

    /* 바깥 원 + 눈금 */
    ctx.save();
    ctx.rotate(spinA * 0.12);
    const ticks = 132;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU;
      const major = i % 11 === 0;
      const len = major ? R * 0.040 : R * 0.017;
      const r0 = R * 0.995;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * (r0 - len), Math.sin(a) * (r0 - len));
      ctx.strokeStyle = major ? cA(0.42 + pulse * 0.18) : cA(0.16);
      ctx.lineWidth = major ? 1.4 : 1;
      ctx.stroke();
    }
    ctx.restore();

    /* 방위 숫자 000 / 090 / 270 (아래 180은 상태 라벨과 겹쳐 생략) */
    ctx.save();
    ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.fillStyle = cA(0.34);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      if (i === 2) continue;
      const a = (i / 4) * TAU - Math.PI / 2;
      const label = String(i * 90).padStart(3, '0');
      ctx.save();
      ctx.translate(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    /* 링 1 — 긴 호 3개 (시안) */
    ctx.save();
    ctx.rotate(spinA);
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU;
      arc(R * 0.86, a0, a0 + 0.82, cA(0.55), 2.2, 10);
      arc(R * 0.86, a0 + 1.05, a0 + 1.32, cA(0.22), 1.2, 0);
      const ex = Math.cos(a0 + 0.82) * R * 0.86, ey = Math.sin(a0 + 0.82) * R * 0.86;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2, 0, TAU);
      ctx.fillStyle = cA(0.95);
      ctx.shadowBlur = 12;
      ctx.shadowColor = cA(0.9);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    /* 링 2 — 점선 링 + 4개 골드 브래킷 */
    ctx.save();
    ctx.rotate(spinB);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.765, 0, TAU);
    ctx.setLineDash([2, 7]);
    ctx.strokeStyle = cA(0.26);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * TAU + 0.18;
      arc(R * 0.765, a0, a0 + 0.26, gA(0.6), 3.4, 8);
    }
    ctx.restore();

    /* 링 3 — 데이터 아크 (불규칙 회전) */
    ctx.save();
    ctx.rotate(-spinA * 0.55 + 1.1);
    const arcs = [
      [R * 0.66, 0.15, 1.15, cA(0.5), 1.6],
      [R * 0.66, 2.30, 2.62, gA(0.45), 1.4],
      [R * 0.66, 3.60, 4.55, cA(0.30), 1.1]
    ];
    arcs.forEach(([r, a0, a1, col, lw]) => arc(r, a0, a1, col, lw, 6));
    ctx.restore();

    /* 스캔 스윕 — 생각 중에 빠르게 */
    const sweepSpeed = state === 'thinking' ? 3.4 : state === 'listening' ? 1.1 : 0.5;
    const sweepA = t * sweepSpeed;
    const sg = ctx.createLinearGradient(0, 0, Math.cos(sweepA) * R, Math.sin(sweepA) * R);
    sg.addColorStop(0, cA(0.0));
    sg.addColorStop(1, state === 'listening' ? gA(0.32) : cA(0.30));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R * 0.83, sweepA - 0.30, sweepA);
    ctx.closePath();
    ctx.fillStyle = sg;
    ctx.fill();

    /* 파형 링 — 마이크/음성 리듬 */
    const wr = R * (0.545 + amp * 0.055);
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const idx = i % 96;
      const a = (i / 96) * TAU - Math.PI / 2;
      const rr = wr + wave[idx] * R * 0.075;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = state === 'listening' ? gA(0.85) : cA(0.8);
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 16;
    ctx.shadowColor = state === 'listening' ? gA(0.6) : cA(0.7);
    ctx.stroke();
    ctx.shadowBlur = 0;
    /* 안쪽 보조 링 */
    ctx.beginPath();
    for (let i = 0; i <= 96; i += 2) {
      const a = (i / 96) * TAU - Math.PI / 2;
      const rr = wr - 7 - wave[i % 96] * R * 0.035;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = cA(0.18);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    /* 궤도 입자 */
    ctx.save();
    for (const d of dots) {
      const a = d.a + t * d.sp * anim.particle * 0.55;
      const r = R * d.r + Math.sin(t * d.tw + d.ph) * R * 0.014 + amp * R * 0.05 * (d.r - 0.4);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const tw = 0.55 + 0.45 * Math.sin(t * d.tw * 1.6 + d.ph);
      ctx.beginPath();
      ctx.arc(x, y, d.s, 0, TAU);
      ctx.fillStyle = d.gold ? gA(d.al * tw * 0.85) : cA(d.al * tw);
      ctx.fill();
      if (d.s > 1.6) {
        ctx.beginPath();
        ctx.arc(x, y, d.s * 2.6, 0, TAU);
        ctx.fillStyle = d.gold ? gA(0.045) : cA(0.05);
        ctx.fill();
      }
    }
    ctx.restore();

    /* 리스닝 확산 링 */
    if (anim.ring > 0.05) {
      for (let k = 0; k < 2; k++) {
        const ph = ((t * 0.55 + k * 0.5) % 1);
        const rr = R * (0.55 + ph * 0.55);
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.strokeStyle = state === 'listening' ? gA(0.28 * (1 - ph) * anim.ring) : cA(0.22 * (1 - ph) * anim.ring);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    /* 코어 */
    const coreR = R * 0.345 * breathe * (1 + amp * 0.10);
    const cg = ctx.createRadialGradient(-coreR * 0.25, -coreR * 0.3, coreR * 0.06, 0, 0, coreR);
    cg.addColorStop(0, 'rgba(190,250,255,' + (0.92) + ')');
    cg.addColorStop(0.32, 'rgba(0,229,255,' + (0.70 * anim.glow) + ')');
    cg.addColorStop(0.72, 'rgba(0,120,170,' + (0.35 * anim.glow) + ')');
    cg.addColorStop(1, 'rgba(0,20,32,0.05)');
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, TAU);
    ctx.fillStyle = cg;
    ctx.shadowBlur = 34;
    ctx.shadowColor = cA(0.55);
    ctx.fill();
    ctx.shadowBlur = 0;

    /* 코어 둘레 링 */
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 1.16, 0, TAU);
    ctx.strokeStyle = cA(0.55);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 1.16, 0, TAU);
    ctx.setLineDash([R * 0.02, R * 0.03]);
    ctx.strokeStyle = cA(0.22);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);

    /* 회전 삼각 파편 */
    ctx.save();
    ctx.rotate(-spinA * 1.6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const x = Math.cos(a) * coreR * 0.78, y = Math.sin(a) * coreR * 0.78;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + t * 0.8);
      ctx.beginPath();
      ctx.moveTo(0, -coreR * 0.12);
      ctx.lineTo(coreR * 0.1, coreR * 0.08);
      ctx.lineTo(-coreR * 0.1, coreR * 0.08);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? gA(0.55) : cA(0.5);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* 중심점 */
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, coreR * 0.085), 0, TAU);
    ctx.fillStyle = 'rgba(240,255,255,0.95)';
    ctx.shadowBlur = 20;
    ctx.shadowColor = cA(0.9);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /* ───────────────────────── 오디오 진폭 ───────────────────────── */
  let analyser = null, audioCtx = null, micStream = null, micBuf = null, micOn = false;
  let micRAF = 0;

  async function startMicAnalyser() {
    if (micOn) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const src = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser);
      micBuf = new Uint8Array(analyser.fftSize);
      micOn = true;
      return true;
    } catch (e) {
      micOn = false;
      return false;
    }
  }

  function stopMicAnalyser() {
    micOn = false;
    analyser = null;
    if (micStream) { micStream.getTracks().forEach((tr) => tr.stop()); micStream = null; }
  }

  function readMicLevel() {
    if (!analyser || !micBuf) return 0;
    analyser.getByteTimeDomainData(micBuf);
    let sum = 0;
    for (let i = 0; i < micBuf.length; i += 4) {
      const v = (micBuf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (micBuf.length / 4));
    return Math.min(1, rms * 6.5);
  }

  /* 음성 출력 중 리듬(실제 오디오 분석은 불가하므로 음절 패턴 근사) */
  let speakEnv = 0;
  function synthLevel() {
    const tt = performance.now() / 1000;
    const v = 0.34 + 0.28 * Math.abs(Math.sin(tt * 6.7)) + 0.18 * Math.abs(Math.sin(tt * 15.3 + 1.2)) + Math.random() * 0.16;
    speakEnv += (Math.min(1, v) - speakEnv) * 0.28;
    return speakEnv;
  }

  function updateLevels() {
    let target = 0.04 + Math.sin(view.t * 1.1) * 0.02;
    if (state === 'listening') target = Math.max(0.08, readMicLevel());
    else if (state === 'speaking') target = 0.18 + synthLevel() * 0.82;
    else if (state === 'thinking') target = 0.10 + Math.abs(Math.sin(view.t * 2.2)) * 0.12;

    amp += (target - amp) * (state === 'speaking' ? 0.35 : 0.2);
    for (let i = 0; i < wave.length; i++) {
      wave[i] = wave[i] * 0.82 + amp * (0.55 + 0.45 * Math.sin(i * 0.62 + view.t * 5.2)) * 0.55;
    }
    for (let i = 0; i < waveBars.length; i++) {
      const v = Math.abs(Math.sin(i * 0.9 + view.t * (state === 'listening' ? 7 : 3.2)));
      const hpx = 3 + (amp * 12 + 1) * (0.35 + v * 0.9);
      waveBars[i].style.height = Math.min(16, hpx).toFixed(1) + 'px';
    }
  }

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(60, now - lastT) / 1000;
    lastT = now;
    view.t += reduceMotion ? dt * 0.35 : dt;
    updateLevels();
    drawHUD();
    requestAnimationFrame(frame);
  }

  /* ───────────────────────── 음성 출력 (TTS) ───────────────────────── */
  const tts = { voice: null, seq: 0, speaking: false };

  function koVoices() {
    if (!window.speechSynthesis) return [];
    return speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang));
  }

  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const list = koVoices();
    if (!list.length) return null;
    if (cfg.voice) {
      const found = list.find((v) => v.name === cfg.voice || v.voiceURI === cfg.voice);
      if (found) return found;
    }
    const prefer = list.find((v) => /male|남성|InJoon|Hyunsu|BongJin|GookMin|Injun|Chul/i.test(v.name)) || list[0];
    return prefer;
  }

  function cleanForSpeech(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*_`#>~]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  let ttsUnlocked = false;
  let activeAudio = null;
  let activeAudioUrl = null;
  const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  function unlockTTS() {
    if (ttsUnlocked) return;
    ttsUnlocked = true;
    try {
      const a = new Audio(SILENT_WAV);
      a.volume = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
    if (window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        u.lang = 'ko-KR';
        speechSynthesis.speak(u);
      } catch (e) {}
    }
  }

  function pcmToWavUrl(b64, sampleRate) {
    const bin = atob(b64);
    const len = bin.length;
    const buf = new ArrayBuffer(44 + len);
    const view = new DataView(buf);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, len, true);
    const bytes = new Uint8Array(buf, 44);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  async function fetchJarvisAudio(text) {
    const key = apiKey();
    if (!key) return null;
    const clean = cleanForSpeech(text).slice(0, 450);
    if (!clean) return null;
    const res = await fetch(API + 'gemini-2.5-flash-preview-tts:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: clean }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
        }
      })
    });
    if (!res.ok) return null;
    const j = await res.json();
    const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    for (const p of parts) {
      if (p.inlineData && p.inlineData.data) {
        const mime = p.inlineData.mimeType || '';
        const m = mime.match(/rate=(\d+)/);
        const rate = m ? Number(m[1]) : 24000;
        return pcmToWavUrl(p.inlineData.data, rate);
      }
    }
    return null;
  }

  function stopSpeak(silent) {
    tts.seq++;
    tts.speaking = false;
    if (activeAudio) {
      try { activeAudio.pause(); activeAudio.src = ''; } catch (e) {}
      activeAudio = null;
    }
    if (activeAudioUrl) {
      try { URL.revokeObjectURL(activeAudioUrl); } catch (e) {}
      activeAudioUrl = null;
    }
    if (window.speechSynthesis && speechSynthesis.speaking) {
      try { speechSynthesis.cancel(); } catch (e) {}
    }
    if (!silent && state === 'speaking') setState('idle');
  }

  function chunkText(text) {
    const clean = cleanForSpeech(text);
    if (clean.length <= 160) return clean ? [clean] : [];
    const parts = clean.replace(/([.!?。！?])\s+/g, '$1\u0001').split('\u0001');
    const out = [];
    let buf = '';
    for (const p of parts) {
      if (!p) continue;
      if ((buf + ' ' + p).trim().length > 170) {
        if (buf) out.push(buf.trim());
        buf = p;
      } else {
        buf = (buf + ' ' + p).trim();
      }
    }
    if (buf) out.push(buf.trim());
    return out;
  }

  async function speak(text, onDone) {
    if (cfg.tts === 'off') { if (onDone) onDone(); return; }
    const chunks = chunkText(text);
    if (!chunks.length) { if (onDone) onDone(); return; }
    const wasSpeaking = tts.speaking || (window.speechSynthesis && speechSynthesis.speaking);
    stopSpeak(true);
    const mySeq = ++tts.seq;
    tts.speaking = true;
    if (state !== 'thinking') setState('speaking');

    if (apiKey()) {
      try {
        const wavUrl = await fetchJarvisAudio(text);
        if (mySeq !== tts.seq) { if (wavUrl) URL.revokeObjectURL(wavUrl); return; }
        if (wavUrl) {
          activeAudioUrl = wavUrl;
          const a = new Audio(wavUrl);
          activeAudio = a;
          a.playbackRate = Math.max(0.7, Math.min(1.4, Number(cfg.rate) || 1));
          a.onended = () => {
            if (mySeq !== tts.seq) return;
            tts.speaking = false;
            if (state === 'speaking') setState('idle');
            if (onDone) onDone();
          };
          a.onerror = () => {
            if (mySeq !== tts.seq) return;
            tts.speaking = false;
            if (state === 'speaking') setState('idle');
            if (onDone) onDone();
          };
          await a.play();
          return;
        }
      } catch (e) {}
    }

    if (!window.speechSynthesis) {
      tts.speaking = false;
      if (state === 'speaking') setState('idle');
      if (onDone) onDone();
      return;
    }
    tts.voice = pickVoice();
    let i = 0;
    const next = () => {
      if (mySeq !== tts.seq) return;
      if (i >= chunks.length) {
        tts.speaking = false;
        if (state === 'speaking') setState('idle');
        if (onDone) onDone();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.lang = 'ko-KR';
      if (tts.voice) u.voice = tts.voice;
      u.rate = Math.max(0.7, (Number(cfg.rate) || 1) * 0.94);
      u.pitch = 0.76;
      u.onstart = () => { if (mySeq === tts.seq && state !== 'thinking') setState('speaking'); };
      u.onend = () => { if (mySeq === tts.seq) next(); };
      u.onerror = (e) => {
        if (mySeq !== tts.seq) return;
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
        tts.speaking = false;
        if (state === 'speaking') setState('idle');
        if (onDone) onDone();
      };
      try { speechSynthesis.speak(u); } catch (e) { next(); }
    };
    if (wasSpeaking) setTimeout(next, 60);
    else next();
  }

  /* ───────────────────────── 음성 인식 (STT) ───────────────────────── */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, recOn = false, recFinal = '', recTimer = 0;

  function startListening() {
    if (state === 'thinking') { toast('답변을 만드는 중입니다. 잠시만요.', 'warn'); return; }
    stopSpeak(true);
    recFinal = '';
    setState('listening');
    el.btnMic.setAttribute('aria-pressed', 'true');
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (!isMobile || !SR) startMicAnalyser();

    if (!SR) {
      toast('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome·Edge에서 마이크를 쓰거나 아래에 입력해 주세요.', 'warn');
      clearTimeout(recTimer);
      recTimer = setTimeout(() => { if (state === 'listening') stopListening(false); }, 12000);
      return;
    }
    try {
      if (!rec) {
        rec = new SR();
        rec.lang = 'ko-KR';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;

        rec.onresult = (ev) => {
          let interim = '', final = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) final += r[0].transcript;
            else interim += r[0].transcript;
          }
          const shown = (recFinal + final + interim).trim();
          el.cmd.value = shown;
          if (final) recFinal += final;
        };
        rec.onerror = (ev) => {
          const map = {
            'not-allowed': '마이크 권한이 필요합니다. 브라우저 주소창의 자물쇠에서 마이크를 허용해 주세요.',
            'service-not-allowed': '이 브라우저에서 음성 인식 서비스가 막혀 있습니다. 주소창 자물쇠에서 마이크를 허용해 주세요.',
            'no-speech': '아무 소리도 들리지 않았습니다. 마이크 가까이에서 다시 말씀해 주세요.',
            'audio-capture': '마이크를 찾지 못했습니다. 마이크 연결을 확인해 주세요.',
            'network': '음성 인식 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
            'aborted': ''
          };
          const msg = map[ev.error] !== undefined ? map[ev.error] : ('음성 인식 오류: ' + ev.error);
          if (msg) toast(msg, 'warn');
          if (ev.error !== 'aborted') stopListening(false);
        };
        rec.onend = () => {
          if (!recOn) return;
          recOn = false;
          clearTimeout(recTimer);
          el.btnMic.setAttribute('aria-pressed', 'false');
          stopMicAnalyser();
          const text = (recFinal || el.cmd.value || '').trim();
          if (text) { el.cmd.value = ''; submit(text); }
          else if (state === 'listening') setState('idle');
        };
      }
      recOn = true;
      rec.start();
      clearTimeout(recTimer);
      recTimer = setTimeout(() => { if (recOn) stopListening(true); }, 15000);
    } catch (e) {
      recOn = false;
      toast('음성 인식을 시작하지 못했습니다. 아래 입력란을 이용해 주세요.', 'warn');
      stopListening(false);
    }
  }

  function stopListening(submitNow) {
    clearTimeout(recTimer);
    const wasOn = recOn;
    recOn = false;
    if (rec && wasOn) { try { rec.stop(); } catch (e) {} }
    el.btnMic.setAttribute('aria-pressed', 'false');
    if (!submitNow) stopMicAnalyser();
    const text = (recFinal || '').trim();
    if (submitNow && text) { el.cmd.value = ''; submit(text); return; }
    if (state === 'listening') setState('idle');
  }

  el.btnMic.addEventListener('click', () => {
    unlockTTS();
    if (recOn || state === 'listening') stopListening(false);
    else startListening();
  });

  /* ───────────────────────── 대화 · Gemini ───────────────────────── */
  let history = [];
  try { history = JSON.parse(store.get(LS.hist) || '[]'); } catch (e) { history = []; }
  if (!Array.isArray(history)) history = [];

  function saveHistory() {
    const trimmed = history.slice(-10);
    while (trimmed.length && JSON.stringify(trimmed).length > 14000) trimmed.shift();
    store.set(LS.hist, JSON.stringify(trimmed));
  }

  const modelLabel = () => (cfg.model === 'auto' ? CHAIN[0] : cfg.model).replace('gemini-', '').replace(/-flash/g, ' FLASH').replace('flash-latest', 'FLASH LATEST').toUpperCase();
  const modelChain = () => {
    if (cfg.model && cfg.model !== 'auto') return [cfg.model].concat(CHAIN.filter((m) => m !== cfg.model));
    return CHAIN.slice();
  };

  function friendlyError(status, msg) {
    const s = String(msg || '');
    if (/API_KEY_INVALID|API key not valid/i.test(s)) return 'API 키가 유효하지 않습니다. 설정에서 Google AI Studio 키를 다시 확인해 주세요.';
    if (/PERMISSION_DENIED|API key expired|API has not been used/i.test(s)) return '이 키로는 호출할 수 없습니다(권한 또는 만료). AI Studio에서 키 상태를 확인해 주세요.';
    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(s)) return '사용 한도를 넘었습니다. 1분쯤 뒤 다시 시도해 주세요.';
    if (status === 403) return '이 키에 모델 권한이 없습니다(403). AI Studio에서 확인해 주세요.';
    if (/SAFETY|blocked/i.test(s)) return '안전 정책에 걸린 표현이 있습니다. 말씀을 조금 바꿔 다시 시도해 주세요.';
    if (status === 404) return '모델을 찾지 못했습니다. 설정에서 모델을 자동으로 두고 다시 시도해 주세요.';
    if (status === 0) return '네트워크에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
    return 'Gemini 호출 실패(' + status + '): ' + s.slice(0, 150);
  }

  async function callModel(model, contents, maxTokens, keyOverride) {
    const key = keyOverride || apiKey();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    let res;
    try {
      res = await fetch(API + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: { parts: [{ text: SYSTEM }] },
          generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens || 1024, topP: 0.95 }
        }),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      const err = new Error(e && e.name === 'AbortError' ? '응답 시간이 초과됐습니다(45초). 다시 시도해 주세요.' : friendlyError(0, ''));
      err.status = 0;
      throw err;
    }
    clearTimeout(timer);
    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch (e) {}
    if (!res.ok) {
      const msg = (j && j.error && j.error.message) || raw;
      const err = new Error(friendlyError(res.status, msg));
      err.status = res.status;
      err.raw = msg;
      throw err;
    }
    const cand = (j && j.candidates && j.candidates[0]);
    if (!cand) throw new Error('빈 응답을 받았습니다. 다시 시도해 주세요.');
    const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('응답이 비었습니다(' + (cand.finishReason || '알 수 없음') + '). 다시 시도해 주세요.');
    return { text, model, usage: (j && j.usageMetadata) || {} };
  }

  async function askGemini(userText) {
    history.push({ role: 'user', text: userText });
    saveHistory();
    const recent = history.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
    let lastErr = null;
    for (const model of modelChain()) {
      try {
        const out = await callModel(model, recent);
        history.push({ role: 'assistant', text: out.text });
        saveHistory();
        return out;
      } catch (e) {
        lastErr = e;
        const retryableModel = e.status === 404 || /not found|not supported|unsupported|does not support/i.test(String(e.raw || e.message));
        if (!retryableModel) throw e;
      }
    }
    throw lastErr || new Error('사용할 수 있는 모델이 없습니다.');
  }

  /* ───────────────────────── 계획(플랜) 파싱 ───────────────────────── */
  function extractPlan(text) {
    let plan = [];
    let rest = String(text || '');

    const blocks = [];
    const re = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(rest)) !== null) blocks.push({ full: m[0], body: m[1] });

    const tryParse = (s) => {
      try {
        const j = JSON.parse(s);
        const arr = j && (Array.isArray(j.plan) ? j.plan : Array.isArray(j.steps) ? j.steps : Array.isArray(j.build_plan) ? j.build_plan : null);
        if (arr && arr.length) return arr;
      } catch (e) {}
      return null;
    };

    for (const b of blocks) {
      const arr = tryParse(b.body.trim());
      if (arr) { plan = arr; rest = rest.replace(b.full, ''); }
    }

    if (!plan.length) {
      const idx = rest.search(/\{\s*"(plan|steps|build_plan)"\s*:/);
      if (idx >= 0) {
        const sub = rest.slice(idx);
        let depth = 0, end = -1, inStr = false, esc = false;
        for (let i = 0; i < sub.length; i++) {
          const ch = sub[i];
          if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === '"') inStr = false;
            continue;
          }
          if (ch === '"') inStr = true;
          else if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end > 0) {
          const arr = tryParse(sub.slice(0, end));
          if (arr) { plan = arr; rest = rest.slice(0, idx) + rest.slice(idx + end); }
        }
      }
    }

    plan = plan.slice(0, 8).map((s, i) => {
      if (typeof s === 'string') return { title: s, detail: '', owner: '', eta: '' };
      return {
        title: String(s.title || s.step || s.name || ('단계 ' + (i + 1))).slice(0, 80),
        detail: String(s.detail || s.desc || s.description || s.action || '').slice(0, 240),
        owner: String(s.owner || s.who || '').slice(0, 20),
        eta: String(s.eta || s.time || s.duration || '').slice(0, 20)
      };
    });

    return { text: rest.replace(/\n{3,}/g, '\n\n').trim(), plan };
  }

  /* ───────────────────────── 자막 렌더 ───────────────────────── */
  const subSpans = () => $$('.sub-speak', el.subtitleBody);

  function appendAILine() {
    const prev = document.getElementById('subText');
    if (prev) prev.removeAttribute('id');
    const line = document.createElement('div');
    line.className = 'sub-line ai';
    const span = document.createElement('span');
    span.className = 'sub-speak';
    span.id = 'subText';
    line.appendChild(span);
    el.subtitleBody.appendChild(line);
    el.subText = span;
    el.subtitleBody.scrollTop = el.subtitleBody.scrollHeight;
    return span;
  }

  function clearSubtitle() {
    el.subtitleBody.innerHTML = '';
    return appendAILine();
  }

  /* 마지막 AI 답변의 첫 줄이 패널 위쪽에 오도록 맞춘다(답변을 처음부터 읽게) */
  function scrollSub() {
    const span = document.getElementById('subText');
    const box = el.subtitleBody;
    if (!span || !box) return;
    const lineEl = span.parentElement;
    const top = lineEl.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 4;
    box.scrollTop = Math.max(0, top);
  }

  function showUserLine(text) {
    const welcome = document.getElementById('welcomeLine');
    if (welcome) welcome.remove();
    const line = document.createElement('div');
    line.className = 'sub-line user';
    const span = document.createElement('span');
    span.className = 'sub-speak';
    span.textContent = text;
    line.appendChild(span);
    el.subtitleBody.appendChild(line);
    el.subtitleBody.scrollTop = el.subtitleBody.scrollHeight;
  }

  function showAILine(text, opts) {
    const o = opts || {};
    const span = clearSubtitle();
    if (o.note) {
      const note = document.createElement('span');
      note.className = 'sub-note';
      note.textContent = o.note;
      span.parentElement.appendChild(note);
    }
    if (o.hint) {
      const hint = document.createElement('span');
      hint.className = 'sub-hint';
      hint.textContent = o.hint;
      span.parentElement.appendChild(hint);
    }
    if (o.error) {
      span.className = 'sub-speak sub-error';
      span.innerHTML = o.error;
      el.subtitleBody.scrollTop = 0;
      return;
    }
    typeText(span, text);
  }

  let typeTimer = 0;
  function typeText(span, text) {
    clearInterval(typeTimer);
    const t = String(text || '');
    if (reduceMotion || t.length > 900) {
      span.textContent = t;
      el.subtitleBody.scrollTop = 0;
      return;
    }
    span.parentElement.classList.add('typing');
    el.typingFlag.hidden = false;
    let i = 0;
    const step = Math.max(1, Math.round(t.length / 110));
    typeTimer = setInterval(() => {
      i = Math.min(t.length, i + step);
      span.textContent = t.slice(0, i);
      el.subtitleBody.scrollTop = el.subtitleBody.scrollHeight;
      if (i >= t.length) {
        clearInterval(typeTimer);
        span.parentElement.classList.remove('typing');
        el.typingFlag.hidden = true;
        scrollSub();
      }
    }, 16);
  }

  function showError(html) {
    const span = appendAILine();
    span.className = 'sub-speak sub-error';
    span.innerHTML = html;
  }

  /* 한글 조합 중 Enter로 조기 전송되는 것 방지 */
  let composing = false;
  el.cmd.addEventListener('compositionstart', () => { composing = true; });
  el.cmd.addEventListener('compositionend', () => { composing = false; });

  /* ───────────────────────── 플랜 렌더 ───────────────────────── */
  let currentPlan = [];

  function renderPlan(steps) {
    currentPlan = steps || [];
    el.planList.innerHTML = '';
    el.planCount.textContent = String(currentPlan.length);
    el.planEmpty.hidden = currentPlan.length > 0;
    currentPlan.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'plan-item';
      li.style.animationDelay = (i * 45) + 'ms';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1).padStart(2, '0');
      const body = document.createElement('div');
      body.className = 'body';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = s.title;
      body.appendChild(title);
      if (s.detail) {
        const d = document.createElement('div');
        d.className = 'detail';
        d.textContent = s.detail;
        body.appendChild(d);
      }
      const meta = document.createElement('div');
      meta.className = 'meta';
      if (s.owner) { const p = document.createElement('span'); p.className = 'pill' + (/마르스|사장|대표/.test(s.owner) ? ' gold' : ''); p.textContent = s.owner; meta.appendChild(p); }
      if (s.eta) { const p = document.createElement('span'); p.className = 'pill'; p.textContent = '예상 ' + s.eta; meta.appendChild(p); }
      if (meta.children.length) body.appendChild(meta);
      li.appendChild(num);
      li.appendChild(body);
      li.title = '누르면 완료 표시';
      li.addEventListener('click', () => li.classList.toggle('done'));
      el.planList.appendChild(li);
    });
  }

  function planAsText() {
    if (!currentPlan.length) return '';
    return currentPlan.map((s, i) => (i + 1) + '. ' + s.title + (s.detail ? ' — ' + s.detail : '') + (s.owner ? ' [' + s.owner + ']' : '') + (s.eta ? ' (' + s.eta + ')' : '')).join('\n');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('복사했습니다.');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('복사했습니다.'); } catch (e2) { toast('복사하지 못했습니다. 길게 눌러 복사해 주세요.', 'warn'); }
      ta.remove();
    }
  }

  /* ───────────────────────── 빠른 실행 프리셋 ───────────────────────── */
  const PRESETS = [
    {
      id: 'brief', icon: 'brief', label: '오늘 업무 브리핑', plan: true,
      prompt: '오늘 업무 브리핑을 해줘. 결론부터 세 문장으로, 그리고 단계별 실행 계획도 붙여줘.',
      demo: {
        text: '결론부터 말씀드립니다. 오늘 챙길 일은 세 가지입니다. 첫째, 11월 미수금 거래처 정산 확인. 둘째, 내일 출장 동선과 기사 준비. 셋째, 잉크원 블로그 1건 예약 발행입니다. 지금은 맛보기 응답이고, 키를 넣으면 실제 일정과 메일을 읽어 브리핑합니다.',
        plan: [
          { title: '미수금 정산 확인', detail: 'CMS 집금 내역과 세금계산서 발행분을 대조해 미입금 거래처를 추린다.', owner: '니케', eta: '15분' },
          { title: '출장 동선 정리', detail: '방문지 주소로 이동 순서와 소요 시간을 계산해 캘린더에 넣는다.', owner: '니케', eta: '10분' },
          { title: '부품·소모품 준비', detail: '내일 방문 건의 기종과 필요 부품 재고를 확인한다.', owner: '마르스', eta: '20분' },
          { title: '콘텐츠 1건 발행', detail: '잉크원 블로그 예약 글을 점검하고 3개 채널에 배포한다.', owner: '니케', eta: '25분' }
        ]
      }
    },
    {
      id: 'promo', icon: 'promo', label: '잉크원 홍보 문구',
      prompt: '잉크원(복사기·프린터 임대와 수리) 블로그 상단에 쓸 홍보 문구를 세 가지 안으로 써줘. 수원·경기남부 소상공인 대상.',
      demo: {
        text: '세 가지 안으로 준비했습니다. 첫째, 복사기 고장 당일 출동 — 속도를 강조한 안. 둘째, 월 3만 원대 토너까지 책임 — 비용을 강조한 안. 셋째, 수원 15년 1,200대 관리 노하우 — 신뢰를 강조한 안입니다. 맛보기 예시 문구이니, 키를 넣으면 블로그 톤에 맞춰 다듬어 드립니다.',
        plan: []
      }
    },
    {
      id: 'as', icon: 'wrench', label: 'A/S 응대 초안',
      prompt: '고객이 복사기 용지 걸림과 흐린 출력을 문의했어. 방문 A/S 응대 카톡 초안을 정중하게 써줘.',
      demo: {
        text: '네, 고객님. 증상 접수했습니다. 오늘 오후 네 시까지 방문 가능하고, 부품 재고를 확인한 뒤 출발 전에 다시 연락드리겠습니다. 방문 전 전원은 켜 두시면 점검에 도움이 됩니다. 맛보기 예시입니다.',
        plan: []
      }
    },
    {
      id: 'idea', icon: 'idea', label: '사업 아이디어', plan: true,
      prompt: '수우전산·잉크원에 붙일 수 있는 구독형 매출 아이디어 하나를 골라서, 단계별 실행 계획까지 짜줘.',
      demo: {
        text: '아이디어 하나 추천합니다. 복사기 무료 점검에 소모품 정기배송을 묶은 구독 상품입니다. 기존 임대 고객 서른 곳에 먼저 제안하면 매달 반복 매출이 생깁니다. 세부 단계는 아래 계획표에 정리했습니다.',
        plan: [
          { title: '고객 30곳 추리기', detail: '임대 1년 이상, 월 사용량 상위 거래처를 뽑아 우선 제안 대상을 만든다.', owner: '니케', eta: '20분' },
          { title: '요금제 3단 설계', detail: '기본·표준·프리미엄으로 나누고 토너 포함 여부와 점검 주기를 정한다.', owner: '마르스', eta: '30분' },
          { title: '제안서 한 장', detail: '월 고정비와 절감액을 비교한 1페이지 제안서를 만든다.', owner: '니케', eta: '25분' },
          { title: '5곳 시범 제안', detail: '먼저 5곳에 문자·방문으로 제안하고 반응을 기록한다.', owner: '마르스', eta: '2일' }
        ]
      }
    }
  ];

  function renderPresets() {
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.dataset.id = p.id;
      const i = document.createElement('span');
      i.className = 'i';
      i.innerHTML = ICON[p.icon] || '';
      i.setAttribute('aria-hidden', 'true');
      const t = document.createElement('span');
      t.textContent = p.label;
      b.appendChild(i);
      b.appendChild(t);
      b.addEventListener('click', () => runPreset(p));
      el.presets.appendChild(b);
    });
  }

  function setBusy(busy) {
    el.btnSend.disabled = busy;
    $$('.preset').forEach((b) => { b.disabled = busy; });
  }

  async function runPreset(p) {
    if (state === 'thinking') return;
    stopSpeak(true);
    showUserLine(p.label);
    if (apiKey()) {
      await sendToAI(p.prompt, { skipUserLine: true });
      return;
    }
    await demoAnswer(p.demo, '맛보기 응답 · 실제 AI는 설정에서 키를 넣으면 동작합니다');
  }

  async function demoAnswer(demo, note) {
    setState('thinking');
    setBusy(true);
    await sleep(700 + Math.random() * 500);
    setState('idle');
    setBusy(false);
    const span = appendAILine();
    typeText(span, demo.text);
    const line = span.parentElement;
    const n = document.createElement('span');
    n.className = 'sub-note';
    n.textContent = note;
    line.appendChild(n);
    el.subMeta.textContent = 'DEMO · 키 미등록';
    scrollSub();
    renderPlan(demo.plan || []);
    speak(demo.text);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ───────────────────────── 전송 ───────────────────────── */
  async function submit(text) {
    unlockTTS();
    const t = String(text || '').trim();
    if (!t) return;
    if (state === 'thinking') { toast('아직 답변을 만드는 중입니다.', 'warn'); return; }
    stopSpeak(true);
    el.cmd.value = '';
    showUserLine(t);
    await sendToAI(t, { skipUserLine: true });
  }

  async function sendToAI(prompt, opts) {
    const o = opts || {};
    if (!apiKey()) {
      const p = PRESETS.find((x) => x.prompt === prompt);
      if (p) { await demoAnswer(p.demo, '맛보기 응답 · 실제 AI는 설정에서 키를 넣으면 동작합니다'); return; }
      setState('idle');
      const span = appendAILine();
      span.textContent = '키가 아직 없습니다. 설정(⚙)에서 Google AI Studio 키를 넣으면 실제 AI와 대화합니다. 아래 빠른 실행 버튼으로도 화면과 음성을 먼저 체험하실 수 있습니다.';
      const hint = document.createElement('span');
      hint.className = 'sub-hint';
      hint.textContent = '발급: aistudio.google.com → Get API key → 키 만들기. 무료 등급도 사용할 수 있습니다.';
      span.parentElement.appendChild(hint);
      el.keyBanner.hidden = false;
      el.subMeta.textContent = 'KEY OFF';
      return;
    }

    setState('thinking');
    setBusy(true);
    el.typingFlag.hidden = false;
    el.subMeta.textContent = 'THINKING · ' + modelLabel();
    try {
      const out = await askGemini(prompt);
      const parsed = extractPlan(out.text);
      setBusy(false);
      el.typingFlag.hidden = true;
      el.subMeta.textContent = out.model.replace('-flash', ' FLASH').toUpperCase() + (out.usage && out.usage.totalTokenCount ? ' · ' + out.usage.totalTokenCount + ' tok' : '');

      const span = appendAILine();
      typeText(span, parsed.text || '(빈 응답)');
      if (parsed.plan.length) {
        renderPlan(parsed.plan);
        const n = document.createElement('span');
        n.className = 'sub-note';
        n.textContent = 'PLAN ' + parsed.plan.length + '단계 → BUILD PLAN 패널(' + (window.innerWidth <= 820 ? '아래' : '오른쪽') + ')';
        span.parentElement.appendChild(n);
        scrollSub();
      } else if (/계획|플랜|단계별|plan/i.test(prompt)) {
        renderPlan([]);
        const n = document.createElement('span');
        n.className = 'sub-note';
        n.textContent = '이번 답변에는 계획 블록이 없었습니다. “단계별 실행 계획으로 다시”라고 해보세요.';
        span.parentElement.appendChild(n);
      }
      setState('idle');
      speak(parsed.text);
    } catch (e) {
      setBusy(false);
      el.typingFlag.hidden = true;
      setState('idle');
      el.subMeta.textContent = 'ERROR';
      showError('<b>응답을 받지 못했습니다.</b><br>' + escapeHTML(e.message || String(e)));
      toast(e.message || 'Gemini 호출에 실패했습니다.', 'warn');
      if (/API 키|권한|키가/.test(String(e.message))) el.keyBanner.hidden = false;
    }
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  el.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (composing) return;
    submit(el.cmd.value);
  });

  /* ───────────────────────── 설정 ───────────────────────── */
  function openSettings() { popModal(true); }
  function popModal(open) {
    el.settings.hidden = !open;
    if (open) {
      fillSettings();
      setTimeout(() => el.apiInput.focus(), 60);
    }
  }

  function fillSettings() {
    el.apiInput.value = apiKey();
    el.modelSel.value = cfg.model || 'auto';
    el.ttsSel.value = cfg.tts || 'on';
    el.rateSel.value = String(cfg.rate || 1);
    el.rateVal.textContent = Number(cfg.rate || 1).toFixed(2) + '×';
    fillVoices();
    detectOtherKey();
  }

  function fillVoices() {
    const list = koVoices();
    el.voiceSel.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = list.length ? '자동 선택 (한국어)' : '브라우저 기본 (한국어 음성 없음)';
    el.voiceSel.appendChild(def);
    list.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name;
      o.textContent = v.name + ' · ' + v.lang + (v.localService ? '' : ' · 온라인');
      el.voiceSel.appendChild(o);
    });
    el.voiceSel.value = cfg.voice || '';
  }

  function detectOtherKey() {
    const found = OTHER_KEY_SOURCES.find((s) => (store.get(s.k) || '').trim().length > 20);
    if (found && !apiKey()) {
      el.foundKey.hidden = false;
      el.foundName.textContent = found.name;
      el.foundKey.dataset.src = found.k;
    } else {
      el.foundKey.hidden = true;
    }
  }

  $('#btnImportKey').addEventListener('click', () => {
    const src = el.foundKey.dataset.src;
    if (!src) return;
    const v = (store.get(src) || '').trim();
    if (!v) { toast('가져올 키를 찾지 못했습니다.', 'warn'); return; }
    el.apiInput.value = v;
    toast('키를 가져왔습니다. 저장을 누르면 적용됩니다.');
  });

  $('#btnToggleKey').addEventListener('click', (e) => {
    const isPw = el.apiInput.type === 'password';
    el.apiInput.type = isPw ? 'text' : 'password';
    e.currentTarget.textContent = isPw ? '숨기기' : '보기';
  });

  $('#btnSave').addEventListener('click', () => {
    const v = el.apiInput.value.trim();
    if (v && !/^AIza[0-9A-Za-z_\-]{10,}$/.test(v) && !/^[A-Za-z0-9_.\-]{20,}$/.test(v)) {
      toast('키 형식이 이상합니다. AIza… 또는 AQ.… 로 시작하는 키를 확인해 주세요.', 'warn');
      return;
    }
    if (v) store.set(LS.key, v); else store.del(LS.key);
    cfg.model = el.modelSel.value;
    cfg.tts = el.ttsSel.value;
    cfg.voice = el.voiceSel.value;
    cfg.rate = Number(el.rateSel.value) || 1;
    saveCfg();
    syncKeyUI();
    popModal(false);
    toast(v ? '저장했습니다. 이제 실제 AI가 답합니다.' : '키를 지웠습니다. 맛보기 모드로 동작합니다.');
  });

  $('#btnClearKey').addEventListener('click', () => {
    store.del(LS.key);
    el.apiInput.value = '';
    syncKeyUI();
    toast('키를 삭제했습니다.');
  });

  $('#btnTest').addEventListener('click', async () => {
    const v = el.apiInput.value.trim();
    if (!v) { setTest('키를 먼저 입력해 주세요.', 'err'); return; }
    setTest('테스트 중…', '');
    const probe = [{ role: 'user', parts: [{ text: '연결 확인. "연결됨"이라고만 답해.' }] }];
    const t0 = performance.now();
    try {
      const out = await callModel(modelChain()[0], probe, 64, v);
      setTest('연결 OK · ' + out.model + ' · ' + Math.round(performance.now() - t0) + 'ms', 'ok');
    } catch (e) {
      let ok = null, altErr = e;
      for (const m of modelChain().slice(1)) {
        try { ok = await callModel(m, probe, 64, v); break; } catch (e2) { altErr = e2; }
      }
      if (ok) setTest('연결 OK · ' + ok.model + ' (기본 모델 대체)', 'ok');
      else setTest(altErr.message || '연결 실패', 'err');
    }
  });

  function setTest(msg, cls) {
    el.testResult.textContent = msg;
    el.testResult.className = 'test-result' + (cls ? ' ' + cls : '');
  }

  el.rateSel.addEventListener('input', () => { el.rateVal.textContent = Number(el.rateSel.value).toFixed(2) + '×'; });
  el.modelSel.addEventListener('change', () => {});
  el.ttsSel.addEventListener('change', () => {});

  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnBannerOpen').addEventListener('click', openSettings);
  $('#btnCloseSettings').addEventListener('click', () => popModal(false));
  $('#btnCloseSettings2').addEventListener('click', () => popModal(false));
  el.settings.addEventListener('click', (e) => { if (e.target === el.settings) popModal(false); });

  /* 음소거 */
  function syncMute() {
    const off = cfg.tts === 'off';
    el.btnMute.classList.toggle('off', off);
    el.btnMute.setAttribute('aria-pressed', off ? 'true' : 'false');
    el.muteIco.textContent = '';
    el.muteIco.innerHTML = off ? ICON.mute : ICON.sound;
    el.btnMute.style.color = off ? '' : 'var(--cyan-soft)';
    if (off) stopSpeak(true);
  }
  el.btnMute.addEventListener('click', () => {
    cfg.tts = cfg.tts === 'off' ? 'on' : 'off';
    saveCfg();
    syncMute();
    toast(cfg.tts === 'off' ? '음성을 껐습니다. 자막으로만 답합니다.' : '음성을 켰습니다.');
  });

  $('#btnStop').addEventListener('click', () => { stopSpeak(false); toast('읽기를 멈췄습니다.'); });
  $('#btnSpeakAgain').addEventListener('click', () => {
    const txt = ($('#subText') && $('#subText').textContent || '').trim();
    if (!txt) return;
    if (cfg.tts === 'off') { cfg.tts = 'on'; saveCfg(); syncMute(); }
    speak(txt);
  });

  $('#btnPlanCopy').addEventListener('click', () => {
    const t = planAsText();
    if (!t) { toast('복사할 계획이 없습니다.', 'warn'); return; }
    copyText('[' + new Date().toLocaleDateString('ko-KR') + ' 실행 계획]\n' + t);
  });
  $('#btnPlanClear').addEventListener('click', () => { renderPlan([]); });

  /* 키 상태 표시 */
  function syncKeyUI() {
    const has = !!apiKey();
    el.metaKey.textContent = has ? 'ON' : 'OFF';
    el.keyBanner.hidden = has;
    el.metaModel.textContent = modelLabel();
  }

  /* 시계 */
  function tickClock() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    el.metaClock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* 토스트 */
  let toastTimer = 0;
  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.className = 'toast' + (kind ? ' ' + kind : '');
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3400);
  }

  /* 단축키 */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.settings.hidden) { popModal(false); return; }
      if (recOn) { stopListening(false); return; }
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      el.cmd.focus();
    }
  });

  /* 음성 목록 준비 */
  if (window.speechSynthesis) {
    const loadVoices = () => { if (!el.settings.hidden) fillVoices(); };
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    speechSynthesis.getVoices();
  }

  /* ───────────────────────── 시작 ───────────────────────── */
  renderPresets();
  syncKeyUI();
  syncMute();
  tickClock();
  setInterval(tickClock, 1000);
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSpeak(true);
  });
  requestAnimationFrame(frame);

  /* 단독 파일(file://)에서 음성 인식이 막히는 경우 안내 */
  if (location.protocol === 'file:') {
    el.subMeta.textContent = '로컬 파일 · 음성 인식은 웹 주소에서';
  }

  /* 첫 방문 안내 */
  const seen = store.get('marshud_seen_v1');
  if (!seen) {
    store.set('marshud_seen_v1', '1');
    setTimeout(() => {
      if (!apiKey()) toast('처음이시죠? 빠른 실행 버튼으로 맛보기부터 해보세요. 실제 AI는 설정(⚙)에서 키를 넣으면 됩니다.');
    }, 900);
  }

  /* 디버그용(콘솔 확인) */
  window.__marsHud = { get state() { return state; }, setState, apiKeyPresent: apiKey, cfg, PRESETS };
})();
