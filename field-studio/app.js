/* 잉크원 필드 스튜디오 — P1 프로토타입
   현장 사진 + 한 줄 메모 → Gemini 1회 호출 → 제목 3안·블로그 HTML·스레드·15초 쇼츠·인스타·해시태그
   키는 localStorage에만 저장한다(코드·저장소에 하드코딩 없음). */
(() => {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const LS = {
    key: 'ink1fs_gemini_key_v1',
    oa: 'ink1fs_openai_key_v1',
    cfg: 'ink1fs_cfg_v1',
    hist: 'ink1fs_history_v1',
    mars: 'mars_secretary_mobile_gemini_v1',
    marsOa: 'mars_secretary_mobile_openai_v1'
  };
  const API = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const BLOG_URL = 'https://blog.naver.com/lvyhs621';

  /* ───────────────────────── 브랜드 프리셋 ───────────────────────── */
  const BRANDS = {
    ink1: {
      id: 'ink1', name: '잉크원', blog: 'lvyhs621',
      label: '잉크원 · lvyhs621',
      line: '잉크원 · 친근한 존댓말 · 결론→원인→조치→CTA · 태그 8~10 · 가격 미표기'
    },
    swo621: {
      id: 'swo621', name: 'swo621', blog: 'inkone_mps',
      label: 'swo621 · 세상의 궁금한 이야기',
      line: 'swo621 · 정보글 톤 · 상호·번호 없음 · 호기심 제목 · 태그 8~10'
    },
    blogger: {
      id: 'blogger', name: '구글 블로그', blog: 'ink1-suwon-test',
      label: '구글 블로그 · ink1-suwon-test',
      line: '구글 블로그 · 담백한 정보형 · 상호 최소 · 검색 키워드 중심'
    }
  };

  const TYPES = ['설치', 'AS/수리', '정기점검', '정보글', '상담', '견적', '철수'];

  /* ───────────────────────── 상태 ───────────────────────── */
  const S = {
    view: 'home',
    brand: 'ink1',
    type: 'AS/수리',
    photos: [],
    memo: '',
    result: null,
    selTitle: 0,
    pane: 'blog',
    history: [],
    cfg: { model: 'auto' },
    busy: false
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function loadCfg() {
    try {
      const c = JSON.parse(store.get(LS.cfg) || '{}');
      if (c && c.model) S.cfg.model = c.model;
    } catch (e) {}
  }
  function saveCfg() { store.set(LS.cfg, JSON.stringify(S.cfg)); }

  function loadHistory() {
    try { S.history = JSON.parse(store.get(LS.hist) || '[]') || []; } catch (e) { S.history = []; }
  }
  function saveHistory() {
    while (S.history.length > 20) S.history.pop();
    let ok = store.set(LS.hist, JSON.stringify(S.history));
    if (!ok) {                       // 용량 초과 → 오래된 것부터 버린다
      while (S.history.length > 3 && !ok) { S.history.pop(); ok = store.set(LS.hist, JSON.stringify(S.history)); }
      if (!ok) toast('브라우저 저장 공간이 부족해 기록을 저장하지 못했습니다.', true);
    }
  }

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast on' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast' + (isErr ? ' err' : ''); }, 2600);
  }

  /* ───────────────────────── 화면 전환 ───────────────────────── */
  function go(view) {
    S.view = view;
    ['home', 'write', 'result', 'settings'].forEach((v) => {
      $('#v-' + v).classList.toggle('hidden', v !== view);
    });
    $$('#tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
    $('#view').scrollTop = 0;
  }

  function paintBrand() {
    const b = BRANDS[S.brand];
    $('#brandBtn').textContent = b.name + ' ▾';
    $('#whoLine').textContent = b.name + ' · ' + b.blog;
    $('#writePresetLabel').textContent = '· ' + b.name;
    $('#presetLine').textContent = b.line;
  }

  /* ───────────────────────── 사진: EXIF·리사이즈 ───────────────────────── */
  function exifFromJpeg(buf) {
    try {
      const dv = new DataView(buf);
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let off = 2;
      while (off < dv.byteLength - 4) {
        if (dv.getUint8(off) !== 0xFF) { off++; continue; }
        const marker = dv.getUint8(off + 1);
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { off += 2; continue; }
        const size = dv.getUint16(off + 2);
        if (marker === 0xE1 && dv.getUint32(off + 4) === 0x45786966) return readTiff(dv, off + 10);
        if (marker === 0xDA) break;
        off += 2 + size;
      }
    } catch (e) {}
    return null;
  }

  function readTiff(dv, base) {
    const little = dv.getUint16(base) === 0x4949;
    const u16 = (o) => dv.getUint16(o, little);
    const u32 = (o) => dv.getUint32(o, little);
    const ascii = (entry) => {
      const count = u32(entry + 4);
      const start = count <= 4 ? entry + 8 : base + u32(entry + 8);
      let s = '';
      for (let i = 0; i < count && i < 32; i++) {
        const c = dv.getUint8(start + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    };
    let exifPtr = 0, dt = '';
    const ifd0 = base + u32(base + 4);
    const n0 = u16(ifd0);
    for (let i = 0; i < n0; i++) {
      const e = ifd0 + 2 + i * 12;
      const tag = u16(e);
      if (tag === 0x8769) exifPtr = base + u32(e + 8);
      else if (tag === 0x0132) dt = ascii(e) || dt;
    }
    if (exifPtr) {
      const n = u16(exifPtr);
      for (let i = 0; i < n; i++) {
        const e = exifPtr + 2 + i * 12;
        if (u16(e) === 0x9003) { const v = ascii(e); if (v) dt = v; }
      }
    }
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(dt);
    if (!m) return null;
    return { key: +(m[1] + m[2] + m[3] + m[4] + m[5] + m[6]), text: m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] };
  }

  function resize(dataUrlOrBitmap, max, q) {
    return new Promise((resolve, reject) => {
      const done = (src, w, h) => {
        const r = Math.min(1, max / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * r)), ch = Math.max(1, Math.round(h * r));
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        x.drawImage(src, 0, 0, cw, ch);
        resolve({ url: c.toDataURL('image/jpeg', q), w: cw, h: ch });
      };
      if (typeof dataUrlOrBitmap === 'string') {
        const img = new Image();
        img.onload = () => done(img, img.naturalWidth, img.naturalHeight);
        img.onerror = reject;
        img.src = dataUrlOrBitmap;
      } else {
        done(dataUrlOrBitmap, dataUrlOrBitmap.width, dataUrlOrBitmap.height);
      }
    });
  }

  async function addPhotos(files) {
    const list = Array.from(files || []).slice(0, 10 - S.photos.length);
    if (!list.length) return;
    let added = 0;
    for (const f of list) {
      try {
        const buf = await f.arrayBuffer();
        const ex = exifFromJpeg(buf);
        let bmp;
        try { bmp = await createImageBitmap(new Blob([buf], { type: f.type || 'image/jpeg' }), { imageOrientation: 'from-image' }); }
        catch (e) { toast('이 사진은 브라우저에서 열 수 없습니다(HEIC 등). JPG로 저장해 주세요.', true); continue; }
        const disp = await resize(bmp, 1280, 0.86);
        const ai = await resize(bmp, 800, 0.72);
        const mini = await resize(bmp, 260, 0.6);
        S.photos.push({
          id: 'p' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: f.name || 'photo.jpg',
          dateKey: ex ? ex.key : null,
          dateText: ex ? ex.text : '',
          disp: disp.url, ai: ai.url, mini: mini.url, w: disp.w, h: disp.h, edited: false
        });
        added++;
      } catch (e) {
        toast('사진을 읽지 못했습니다: ' + (e && e.message ? e.message : e), true);
      }
    }
    sortPhotos();
    paintThumbs();
    if (added) toast(added + '장 추가 · 촬영 시각 순으로 정렬했습니다');
    if (S.photos.length >= 10) toast('사진은 10장까지입니다.');
  }

  function sortPhotos() {
    S.photos = S.photos
      .map((p, i) => ({ p, i }))
      .sort((a, b) => {
        const ka = a.p.dateKey, kb = b.p.dateKey;
        if (ka && kb && ka !== kb) return ka - kb;
        if (ka && !kb) return -1;
        if (!ka && kb) return 1;
        return a.i - b.i;
      })
      .map((x) => x.p);
  }

  function paintThumbs() {
    const box = $('#thumbs');
    box.innerHTML = '';
    S.photos.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'thumb';
      d.innerHTML =
        '<span class="num">' + (i + 1) + '</span>' +
        '<img alt="" src="' + p.disp + '">' +
        (p.dateText ? '<span class="stamp">' + p.dateText + '</span>' : '') +
        '<span class="acts"><button data-act="mosaic" data-id="' + p.id + '">가리기</button>' +
        '<button data-act="del" data-id="' + p.id + '">✕</button></span>';
      box.appendChild(d);
    });
    const add = document.createElement('button');
    add.className = 'addbox';
    add.id = 'addPhoto';
    add.innerHTML = '<b>＋</b>사진 추가';
    add.addEventListener('click', () => $('#fileInput').click());
    if (S.photos.length < 10) box.appendChild(add);
    $('#photoMeta').textContent = S.photos.length + '/10장';
    const dated = S.photos.filter((p) => p.dateKey).length;
    $('#photoHint').textContent = S.photos.length
      ? (dated ? dated + '장은 촬영 시각으로 정렬 · ' : '') + 'AI용 800px 별도 저장'
      : '촬영 시각이 있으면 순서대로 정렬합니다 · AI용 800px 별도 저장';
  }

  /* ───────────────────────── 모자이크 편집기 ───────────────────────── */
  const M = { photo: null, canvas: null, ctx: null, size: 38, mode: 'pixel', undo: [], drawing: false, last: null };

  function openMosaic(id) {
    const p = S.photos.find((x) => x.id === id);
    if (!p) return;
    M.photo = p;
    const c = $('#mCanvas');
    const img = new Image();
    img.onload = () => {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      M.canvas = c; M.ctx = x; M.undo = [];
      pushUndo();
      $('#mosaicSheet').classList.remove('hidden');
    };
    img.src = p.disp;
  }

  function pushUndo() {
    try {
      M.undo.push(M.canvas.toDataURL('image/jpeg', 0.9));
      if (M.undo.length > 6) M.undo.shift();
    } catch (e) {}
  }

  function canvasPoint(ev) {
    const c = M.canvas;
    const r = c.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (c.width / r.width);
    const py = (ev.clientY - r.top) * (c.height / r.height);
    return { x: px, y: py, scale: c.width / r.width };
  }

  function dab(x, y) {
    const ctx = M.ctx, c = M.canvas;
    const r = Math.max(6, M.size * 0.9) * (c.width / Math.max(320, c.getBoundingClientRect().width || 320));
    const rr = Math.max(10, r);
    const bx = Math.max(0, x - rr), by = Math.max(0, y - rr);
    const bw = Math.min(c.width - bx, rr * 2), bh = Math.min(c.height - by, rr * 2);
    if (bw <= 1 || bh <= 1) return;
    if (M.mode === 'blur') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = 'blur(' + Math.max(6, rr / 3) + 'px)';
      ctx.drawImage(c, bx, by, bw, bh, bx, by, bw, bh);
      ctx.restore();
    } else {
      const block = Math.max(6, rr / 3.2);
      const tw = Math.max(1, Math.round(bw / block)), th = Math.max(1, Math.round(bh / block));
      const t = document.createElement('canvas');
      t.width = tw; t.height = th;
      const tx = t.getContext('2d');
      tx.drawImage(c, bx, by, bw, bh, 0, 0, tw, th);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, 0, 0, tw, th, bx, by, bw, bh);
      ctx.restore();
    }
  }

  function bindCanvas() {
    const c = $('#mCanvas');
    const start = (ev) => {
      ev.preventDefault();
      M.drawing = true;
      pushUndo();
      const p = canvasPoint(ev);
      M.last = p;
      dab(p.x, p.y);
    };
    const move = (ev) => {
      if (!M.drawing) return;
      ev.preventDefault();
      const p = canvasPoint(ev);
      if (M.last) {
        const dx = p.x - M.last.x, dy = p.y - M.last.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.min(24, Math.max(1, Math.round(dist / 8)));
        for (let i = 1; i <= steps; i++) dab(M.last.x + (dx * i) / steps, M.last.y + (dy * i) / steps);
      } else dab(p.x, p.y);
      M.last = p;
    };
    const end = () => { M.drawing = false; M.last = null; };
    c.addEventListener('pointerdown', start);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', end);
    $('#mSize').addEventListener('input', (e) => { M.size = +e.target.value; });
    $('#mMode').addEventListener('click', () => {
      M.mode = M.mode === 'pixel' ? 'blur' : 'pixel';
      $('#mMode').textContent = M.mode === 'pixel' ? '모자이크' : '블러';
    });
    $('#mUndo').addEventListener('click', () => {
      const last = M.undo.pop();
      if (!last) return;
      const img = new Image();
      img.onload = () => { M.ctx.clearRect(0, 0, M.canvas.width, M.canvas.height); M.ctx.drawImage(img, 0, 0); };
      img.src = last;
    });
    $('#mCancel').addEventListener('click', () => {
      M.undo = [];
      $('#mosaicSheet').classList.add('hidden');
    });
    $('#mClose').addEventListener('click', () => $('#mosaicSheet').classList.add('hidden'));
    $('#mSave').addEventListener('click', async () => {
      if (!M.photo || !M.canvas) return;
      const edited = M.canvas.toDataURL('image/jpeg', 0.88);
      const p = M.photo;
      p.disp = edited;
      p.edited = true;
      const ai = await resize(edited, 800, 0.72);
      p.ai = ai.url;
      const mini = await resize(edited, 260, 0.6);
      p.mini = mini.url;
      paintThumbs();
      $('#mosaicSheet').classList.add('hidden');
      toast('가린 사진으로 바꿨습니다 · AI에도 가린 상태로 전달됩니다');
    });
  }

  /* ───────────────────────── Gemini 프롬프트 ───────────────────────── */
  const SYS_INK = `너는 '잉크원/아싸렌탈수원지사'(경기남부 사무기기 복사기·프린터·PC 임대와 수리) 현장 기록 담당자다.
사장님이 현장에서 찍은 사진과 한 줄 메모를 주면, 그 현장을 네이버 블로그 글 1편과 스레드·15초 쇼츠 대본·인스타 캡션으로 한 번에 정리한다.

[브랜드 고정값 — 글자 하나 바꾸지 않는다]
- 상호: 잉크원/아싸렌탈수원지사
- 지역: 수원·화성·평택·동탄·안산·용인 등 경기남부
- 대표번호: 1544-4065 (CTA 한 곳에만)
- 홈페이지: https://ink1.kr/
- 블로그: https://blog.naver.com/lvyhs621
- 주소: 경기 수원시 권선구 경수대로235번길 62-26 1층

[블로그 제목 3안]
- 각 30자 안팎, 끝에 반드시 ' /아싸렌탈수원지사'를 붙인다. 전화번호는 제목에 넣지 않는다.
- 앞 15자 안에 지역·기종·증상 중 최소 둘이 들어간다.
- 세 안은 서로 다른 방식: ① 기종+증상+해결 ② 고객이 검색창에 치는 질문형 ③ 현장 후기형.
- 고객이 실제로 검색하는 말(기종명·오류코드·증상)로 쓴다. '프린터 고장'처럼 뭉뚱그린 말은 쓰지 않는다.

[블로그 본문]
- 본문 전체 1,600~1,900자. 소제목 4~6개, 문단은 2~3문장으로 짧게.
- 순서: 결론(3줄 요약) → 원인 → 조치(단계별) → 확인(시험 출력·스캔) → 자주 묻는 질문 2~3개 → CTA.
- 첫 문장은 고객이 검색창에 치는 증상 문장으로 시작한다. 인사는 "안녕하세요, 잉크원·아싸렌탈 수원지사입니다."를 한 번만 쓴다.
- 사진에서 실제로 보이는 것과 메모에 적힌 사실만 쓴다. 기종명·오류코드·부품명·소요시간·출력매수는 근거가 없으면 쓰지 않는다. 모르는 값은 문장 자체를 뺀다.
- 가격·월 임대료·견적 숫자는 블로그·쇼츠·스레드·인스타 어디에도 쓰지 않는다.
- 본문은 네이버 스마트에디터에 붙여넣을 HTML로 쓴다. 태그는 <h2>, <p>, <ul>, <li>, <b> 만 사용하고 표·이미지·링크 태그는 쓰지 않는다.
- "1. "로 시작하는 문단을 만들지 않는다(스마트에디터가 자동 번호매김을 걸어 서식이 깨진다). 목록은 <ul><li>로만 쓴다.
- CTA 마지막 문단 고정:
  잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065 · 톡톡 문의 · https://ink1.kr/
  경기 수원시 권선구 경수대로235번길 62-26 1층
- 본문 맨 끝에 해시태그 8~10개를 한 줄로 붙인다(지역 2 + 업종 2 + 기종 2 + 서비스 2~4). 10개를 넘기지 않는다.

[스레드 글]
- 250~350자, 3~6줄. 문제 1줄 → 원인·방법 3줄 → 블로그 링크 1줄.
- 모든 문장이 서술어로 끝나게 쓴다(중간에 끊긴 문장 금지). 이모지 0~2개, 해시태그 0~2개.

[15초 쇼츠 대본]
- 0~3초 훅(업종·증상 1줄 + 반전 또는 핵심 훅 1줄), 3~9초 조치 3단계, 9~15초 엔딩(블로그 링크 유도).
- 화면 자막과 음성 대사를 따로 적는다. 한 줄은 15자 안팎으로 짧게.
- 엔딩 음성 마지막 문장은 반드시 "잉크원·아싸렌탈, 1544-4065"로 끝낸다.
- 가격·임대료 숫자는 음성과 자막 모두에 넣지 않는다.

[인스타 캡션]
- 첫 줄은 반드시 '수원'으로 시작하는 문장. 1,000자 이내, 첫 두 줄에 증상과 결론.
- 맨 아래에 스마트박스: 구분선 '━' 20자, 상호 / 지역 / 번호 / 블로그 / 홈페이지 / 한 줄 안내 순서, 이모지 줄마다 하나.
- 위치 태그는 넣지 않는다. 해시태그 8~12개를 박스 아래 한 줄로 붙인다.

[유튜브]
- 제목: '수원'을 포함하고 기종·증상과 숫자를 넣는다. 100자 이내. 끝에 (NN초) 표기를 쓰지 않는다.
- 설명: 첫 줄은 증상 한 문장, 그 아래 3줄 요약, 맨 아래 인스타와 같은 스마트박스.

[말투]
- 동네 사장님이 직접 쓰는 친근한 존댓말. 전문가 과시·감탄사·과장 금지. 읽는 사람이 바로 따라 할 수 있게 쓴다.
- 같은 문장을 채널마다 복사하지 않는다. 같은 사실을 블로그는 문단으로, 쇼츠는 3단계로, 스레드는 3줄로 다시 쓴다.`;

  const SYS_SWO = `너는 사무기기 업체 '수우전산'이 운영하는 정보 블로그 'swo621(세상의 궁금한 이야기)'의 필자다.
사진과 메모를 주면, 그 현장에서 뽑아낼 수 있는 '쓸모 있는 정보'로 블로그 글 1편과 스레드·15초 쇼츠 대본·인스타 캡션을 만든다.

[블로그]
- 상호·전화번호·주소·CTA를 넣지 않는다(정보글이다). 브랜드 언급은 최대 한 번, 자연스럽게만.
- 제목 3안: 30자 안팎, 호기심을 부르는 사실·질문형. ' /swo621' 같은 꼬리표를 붙이지 않는다.
- 본문 1,600~1,900자, 소제목 4~6개. 순서: 결론(3줄) → 왜 그런가 → 확인 방법 → 실제 사례 → 자주 묻는 질문 2~3개.
- 사진에 보이는 사실과 메모만 근거로 쓴다. 모르는 수치·모델명은 쓰지 않는다. 가격 숫자는 쓰지 않는다.
- HTML 태그는 <h2>, <p>, <ul>, <li>, <b> 만. "1. "로 시작하는 문단 금지.
- 맨 끝에 해시태그 8~10개 한 줄.

[스레드] 250~350자, 3~6줄, 문제 1줄 → 핵심 3줄 → 링크 1줄. 문장은 서술어로 끝낸다.
[15초 쇼츠] 0~3초 훅 / 3~9초 핵심 3단계 / 9~15초 정리+블로그 링크. 화면 자막과 음성 대사를 따로, 한 줄 15자 안팎. 가격 금지.
[인스타] 첫 줄은 '수원'으로 시작. 스마트박스는 상호(수우전산)·지역(경기남부)·홈페이지 https://ink1.kr/ 만 넣고 전화번호는 넣지 않는다. 해시태그 8~12개. 위치 태그 금지.
[유튜브] 제목에 '수원' 포함, 설명 첫 줄은 증상 한 문장.`;

  const SYS_BLOG = `너는 사무기기 현장 기록을 구글 블로그(Blogger)에 올릴 정보글로 정리하는 필자다.
[블로그] 제목 3안은 검색 키워드 중심 30자 안팎(꼬리표 없음). 본문 1,600~1,900자, 소제목 4~6개, 결론→원인→확인 방법→사례→FAQ. HTML은 <h2>,<p>,<ul>,<li>,<b> 만. 해시태그는 태그 줄로 8~10개. 가격 숫자 금지.
[스레드] 250~350자 요약. [15초 쇼츠] 훅/핵심 3단계/엔딩, 자막과 음성 분리. [인스타] 첫 줄 '수원' 시작, 위치 태그 없음. [유튜브] 제목·설명.`;

  function systemFor(brand) {
    if (brand === 'swo621') return SYS_SWO;
    if (brand === 'blogger') return SYS_BLOG;
    return SYS_INK;
  }

  function userPrompt() {
    const b = BRANDS[S.brand];
    const lines = [];
    lines.push('작업 종류: ' + S.type);
    if (S.memo.trim()) lines.push('현장 메모: ' + S.memo.trim());
    lines.push('사진 ' + S.photos.length + '장(촬영 순서대로). 사진에 보이는 것을 근거로 써라.');
    lines.push('브랜드: ' + b.label);
    lines.push('');
    lines.push('아래 형식 그대로 출력하라. 다른 말·머리말·코드블록 표시를 쓰지 않는다.');
    lines.push('');
    lines.push('[TITLE1] 첫 번째 제목');
    lines.push('[TITLE2] 두 번째 제목');
    lines.push('[TITLE3] 세 번째 제목');
    lines.push('[BLOG] 네이버에 붙여넣을 HTML 본문 (1,600자 이상)');
    lines.push('[TAGS] 해시태그를 공백으로 구분해 한 줄');
    lines.push('[THREADS] 스레드 글 (250자 이상)');
    lines.push('[SHORTS] 0-3초|화면 자막|음성 대사 형식으로 한 줄씩 (3~4줄)');
    lines.push('[INSTA] 인스타 캡션');
    lines.push('[YT_TITLE] 유튜브 제목');
    lines.push('[YT_DESC] 유튜브 설명');
    return lines.join('\n');
  }

  /* ───────────────────────── 모델 선택·호출 ───────────────────────── */
  const CHAIN_AUTO = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  function chain() {
    const m = S.cfg.model && S.cfg.model !== 'auto' ? S.cfg.model : null;
    if (!m) return CHAIN_AUTO.slice();
    return [m].concat(CHAIN_AUTO.filter((x) => x !== m));
  }

  function apiKey() { return (store.get(LS.key) || '').trim(); }

  function friendly(status, msg) {
    const s = String(msg || '');
    if (/API_KEY_INVALID|API key not valid/i.test(s)) return 'API 키가 유효하지 않습니다. 설정에서 Google AI Studio 키를 다시 확인해 주세요.';
    if (/PERMISSION_DENIED|API key expired/i.test(s)) return '이 키로는 호출할 수 없습니다(권한·만료). AI Studio에서 키를 확인해 주세요.';
    if (status === 429) return 'Gemini 사용 한도를 넘었습니다. 잠시 뒤 다시 시도해 주세요.';
    if (status === 403) return '이 키에 모델 권한이 없습니다(403). AI Studio에서 확인해 주세요.';
    if (/RESOURCE_EXHAUSTED/i.test(s)) return '요청이 몰렸습니다. 1분 뒤 다시 시도해 주세요.';
    if (/SAFETY|blocked/i.test(s)) return '사진·메모가 안전 정책에 걸렸습니다. 표현을 바꿔 다시 시도해 주세요.';
    return 'Gemini 호출 실패(' + status + '): ' + s.slice(0, 160);
  }

  async function callModel(model, parts, signal, maxTokens) {
    const key = apiKey();
    const body = {
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: systemFor(S.brand) }] },
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: maxTokens || 8192,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };
    const res = await fetch(API + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch (e) {}
    if (!res.ok) {
      const msg = (j && j.error && j.error.message) || raw;
      const err = new Error(friendly(res.status, msg));
      err.status = res.status;
      err.raw = msg;
      throw err;
    }
    const cand = (j.candidates || [])[0];
    if (!cand) throw new Error('빈 응답을 받았습니다. 다시 시도해 주세요.');
    const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
    if (!text) throw new Error('응답이 비었습니다(' + (cand.finishReason || '알 수 없음') + '). 다시 시도해 주세요.');
    return { text, finish: cand.finishReason, usage: j.usageMetadata || {}, model };
  }

  function parseSections(text) {
    const tags = ['TITLE1', 'TITLE2', 'TITLE3', 'BLOG', 'TAGS', 'THREADS', 'SHORTS', 'INSTA', 'YT_TITLE', 'YT_DESC'];
    const norm = text.replace(/\r/g, '').replace(/\*\*\[?/g, '');
    const hits = [];
    const re = /\[(TITLE1|TITLE2|TITLE3|BLOG|TAGS|THREADS|SHORTS|INSTA|YT_TITLE|YT_DESC)\]/g;
    let m;
    while ((m = re.exec(norm)) !== null) hits.push({ tag: m[1], start: m.index, end: m.index + m[0].length });
    const out = {};
    hits.forEach((h, i) => {
      const stop = i + 1 < hits.length ? hits[i + 1].start : norm.length;
      const v = norm.slice(h.end, stop).trim();
      if (!out[h.tag]) out[h.tag] = v;
    });
    return out;
  }

  function htmlToText(html) {
    let t = String(html || '')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h1|h2|h3|ul|ol|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    const d = document.createElement('textarea');
    d.innerHTML = t;
    t = d.value;
    return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  function parseShorts(raw) {
    return String(raw || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const p = l.split('|').map((x) => x.trim());
        if (p.length >= 3) return { time: p[0], screen: p[1], voice: p.slice(2).join(' ') };
        const m = /^([0-9~\-–]+\s*초?)\s*[:：]?\s*(.*)$/.exec(l);
        if (m) return { time: m[1], screen: m[2], voice: '' };
        return { time: '', screen: l, voice: '' };
      });
  }

  async function generate() {
    if (S.busy) return;
    if (!apiKey()) {
      toast('설정에서 Google AI Studio 키를 먼저 저장해 주세요.', true);
      go('settings');
      return;
    }
    if (!S.photos.length && !S.memo.trim()) {
      toast('사진이나 메모 중 하나는 있어야 합니다.', true);
      return;
    }
    S.busy = true;
    $('#makeBtn').disabled = true;
    $('#genSheet').classList.remove('hidden');
    $('#genStage').textContent = '사진 정리 → 지침 확인 → 생성 요청';
    $('#genElapsed').textContent = '0초';
    const t0 = Date.now();
    const elTimer = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      $('#genElapsed').textContent = s + '초';
      $('#genStage').textContent = s < 8 ? '지침·사진을 묶어 요청 중'
        : s < 20 ? 'Gemini가 원고를 쓰는 중' : '거의 끝났습니다 · 조금만 더';
    }, 500);

    const ctrl = new AbortController();
    $('#genCancel').onclick = () => { try { ctrl.abort(); } catch (e) {} };
    const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 180000);

    const parts = [{ text: userPrompt() }];
    S.photos.forEach((p) => {
      const b64 = (p.ai || '').split(',')[1];
      if (b64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
    });

    let lastErr = null;
    try {
      for (const model of chain()) {
        try {
          let r = await callModel(model, parts, ctrl.signal, 8192);
          let sec = parseSections(r.text);
          if ((!sec.BLOG || sec.BLOG.length < 400) && r.finish === 'MAX_TOKENS') {
            r = await callModel(model, parts, ctrl.signal, 16384);
            sec = parseSections(r.text);
          }
          if (!sec.BLOG) { lastErr = new Error('원고 형식이 깨졌습니다. 다시 시도해 주세요.'); continue; }
          finishResult(sec, r);
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') throw new Error('취소했습니다.');
          if (e && (e.status === 404 || /no longer available|not found|NOT_FOUND/i.test(e.raw || ''))) { continue; }
          if (e && (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 429)) throw e;
          lastErr = e;
        }
      }
      throw lastErr || new Error('생성에 실패했습니다.');
    } catch (e) {
      toast((e && e.message) || '생성에 실패했습니다.', true);
      if (/키/.test(String(e && e.message))) go('settings');
    } finally {
      clearInterval(elTimer);
      clearTimeout(timer);
      $('#genSheet').classList.add('hidden');
      $('#makeBtn').disabled = false;
      S.busy = false;
    }
  }

  function finishResult(sec, r) {
    const titles = [sec.TITLE1, sec.TITLE2, sec.TITLE3].filter(Boolean).map((t) => t.replace(/^["'“”]|["'“”]$/g, '').trim());
    const tags = String(sec.TAGS || '')
      .replace(/\n/g, ' ')
      .split(/\s+/)
      .filter((t) => t.startsWith('#'))
      .map((t) => t.replace(/[.,]/g, ''));
    const res = {
      id: 'r' + Date.now(),
      at: new Date().toISOString(),
      brand: S.brand,
      type: S.type,
      memo: S.memo.trim(),
      titles: titles.length ? titles : ['(제목 없음)'],
      blogHtml: sec.BLOG || '',
      tags: tags.slice(0, 12),
      threads: sec.THREADS || '',
      shorts: parseShorts(sec.SHORTS),
      insta: sec.INSTA || '',
      ytTitle: sec.YT_TITLE || '',
      ytDesc: sec.YT_DESC || '',
      model: r.model,
      ms: 0,
      usage: r.usage,
      photoCount: S.photos.length,
      thumb: S.photos[0] ? (S.photos[0].mini || '') : ''
    };
    res.blogText = htmlToText(res.blogHtml);
    S.result = res;
    S.selTitle = 0;
    renderResult();
    saveToHistory(res);
    go('result');
    toast('원고 완성 · ' + res.model + ' · ' + (res.tags.length) + '개 태그');
  }

  function saveToHistory(res) {
    const copy = Object.assign({}, res);
    delete copy.usage;
    S.history.unshift(copy);
    saveHistory();
    paintHome();
  }

  /* ───────────────────────── 결과 렌더 ───────────────────────── */
  function renderResult() {
    const r = S.result;
    if (!r) {
      $('#resultEmpty').classList.remove('hidden');
      $('#resultBody').classList.add('hidden');
      return;
    }
    $('#resultEmpty').classList.add('hidden');
    $('#resultBody').classList.remove('hidden');
    $('#resModel').textContent = r.model || '–';

    const tl = $('#titleList');
    tl.innerHTML = '';
    r.titles.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 't' + (i === S.selTitle ? ' on' : '');
      b.innerHTML = '<span>' + esc(t) + '</span><small>' + ['① 기종+증상+해결', '② 검색 질문형', '③ 현장 후기형'][i] + '</small>';
      b.addEventListener('click', () => { S.selTitle = i; renderResult(); });
      tl.appendChild(b);
    });

    $('#blogPreview').innerHTML = sanitizeHtml(r.blogHtml);
    $('#threadsBox').textContent = r.threads || '(없음)';
    $('#threadsLen').textContent = (r.threads || '').length + '자 · ' + ((r.threads || '').split('\n').filter(Boolean).length) + '줄';

    const sb = $('#shortsBox');
    sb.innerHTML = '';
    (r.shorts || []).forEach((row) => {
      const d = document.createElement('div');
      d.className = 'shortsrow';
      d.innerHTML = '<div class="tm">' + esc(row.time || '') + '</div><div><div class="sc">' + esc(row.screen) +
        '</div>' + (row.voice ? '<div class="vc">🎙 ' + esc(row.voice) + '</div>' : '') + '</div>';
      sb.appendChild(d);
    });
    if (!(r.shorts || []).length) sb.innerHTML = '<div class="empty">(대본 없음)</div>';

    $('#instaBox').textContent = r.insta || '(없음)';

    const tg = $('#tagList');
    tg.innerHTML = '';
    r.tags.forEach((t) => {
      const s = document.createElement('span');
      s.className = 'chip tag';
      s.textContent = t;
      tg.appendChild(s);
    });
    $('#tagCount').textContent = r.tags.length + '개';

    const rt = $('#resThumbs');
    rt.innerHTML = '';
    if (S.photos.length) {
      S.photos.forEach((p, i) => {
        const d = document.createElement('div');
        d.className = 'thumb';
        d.innerHTML = '<span class="num">' + (i + 1) + '</span><img alt="" src="' + p.disp + '">';
        d.addEventListener('click', () => downloadDataUrl(p.disp, '현장사진_' + String(i + 1).padStart(2, '0') + '.jpg'));
        rt.appendChild(d);
      });
      $('#resPhotoMeta').textContent = S.photos.length + '장 · 눌러서 저장';
    } else {
      rt.innerHTML = '<div class="muted" style="grid-column:1/-1">이 원고는 기록에서 열었습니다. 사진은 그때 쓰던 기기에만 남습니다.</div>';
      $('#resPhotoMeta').textContent = '';
    }

    $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.p === S.pane));
    $$('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + S.pane));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function sanitizeHtml(h) {
    const ok = /^(P|H1|H2|H3|UL|OL|LI|B|STRONG|BR|DIV|SPAN|EM|I|BLOCKQUOTE)$/;
    const d = document.createElement('div');
    d.innerHTML = String(h || '');
    const walk = (node) => {
      Array.from(node.children).forEach((el) => {
        if (!ok.test(el.tagName)) {
          const frag = document.createDocumentFragment();
          while (el.firstChild) frag.appendChild(el.firstChild);
          el.replaceWith(frag);
          return;
        }
        Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name));
        walk(el);
      });
    };
    walk(d);
    return d.innerHTML;
  }

  /* ───────────────────────── 복사·저장 ───────────────────────── */
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (x) {}
      ta.remove();
      return ok;
    }
  }

  async function copyRich(html, text) {
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
        return true;
      } catch (e) {}
    }
    const d = document.createElement('div');
    d.contentEditable = 'true';
    d.innerHTML = html;
    d.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(d);
    const rng = document.createRange();
    rng.selectNodeContents(d);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rng);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    sel.removeAllRanges();
    d.remove();
    return ok;
  }

  function downloadDataUrl(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadBlob(blob, name) {
    const u = URL.createObjectURL(blob);
    downloadDataUrl(u, name);
    setTimeout(() => URL.revokeObjectURL(u), 8000);
  }

  /* 최소 ZIP(무압축) — 의존성 없이 사진·원고를 한 파일로 */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const dt = new Date();
    const dosTime = ((dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate()) & 0xFFFF;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = f.data instanceof Uint8Array ? f.data : enc.encode(String(f.data));
      const crc = crc32(data);
      const lh = new Uint8Array(30 + name.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);      // UTF-8 이름
      dv.setUint16(8, 0, true);           // 무압축
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lh.set(name, 30);
      chunks.push(lh, data);
      const ch = new Uint8Array(46 + name.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);
      offset += lh.length + data.length;
    });
    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: 'application/zip' });
  }

  function dataUrlToU8(url) {
    const b64 = String(url || '').split(',')[1] || '';
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function zipName(r) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return '필드스튜디오_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }

  function buildPackage(r) {
    const files = [];
    S.photos.forEach((p, i) => files.push({ name: '사진/' + String(i + 1).padStart(2, '0') + '_현장.jpg', data: dataUrlToU8(p.disp) }));
    const title = r.titles[S.selTitle] || r.titles[0] || '';
    files.push({ name: '원고.html', data: '<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title>\n<h1>' + esc(title) + '</h1>\n' + r.blogHtml });
    files.push({ name: '원고_텍스트.txt', data: title + '\n\n' + r.blogText });
    files.push({ name: '해시태그.txt', data: r.tags.join(' ') });
    files.push({ name: '스레드.txt', data: r.threads });
    files.push({ name: '쇼츠대본.txt', data: (r.shorts || []).map((s) => s.time + ' | ' + s.screen + (s.voice ? ' | ' + s.voice : '')).join('\n') });
    files.push({ name: '인스타캡션.txt', data: r.insta });
    if (r.ytTitle) files.push({ name: '유튜브.txt', data: r.ytTitle + '\n\n' + r.ytDesc });
    return files;
  }

  /* ───────────────────────── 홈 ───────────────────────── */
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  function paintHome() {
    const today = dayKey(new Date());
    const now = new Date();
    const nToday = S.history.filter((h) => dayKey(new Date(h.at)) === today).length;
    const nMonth = S.history.filter((h) => {
      const d = new Date(h.at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    $('#kToday').textContent = nToday;
    $('#kMonth').textContent = nMonth;
    $('#kKey').textContent = apiKey() ? '연결' : '없음';
    $('#kKey').style.color = apiKey() ? '#0f7a5a' : '#a4232b';

    const list = $('#histList');
    $('#histCount').textContent = S.history.length ? S.history.length + '건' : '';
    if (!S.history.length) {
      list.innerHTML = '<div class="empty">아직 만든 원고가 없습니다.<br>첫 현장을 넣어 보세요.</div>';
      return;
    }
    list.innerHTML = '';
    S.history.slice(0, 10).forEach((h) => {
      const d = document.createElement('button');
      d.className = 'hitem';
      d.style.width = '100%';
      d.style.textAlign = 'left';
      const dt = new Date(h.at);
      const stamp = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
      d.innerHTML = (h.thumb ? '<img alt="" src="' + h.thumb + '">' : '<img alt="">') +
        '<div class="t"><b>' + esc(h.titles[0] || '(제목 없음)') + '</b>' +
        '<span>' + stamp + ' · ' + esc(BRANDS[h.brand] ? BRANDS[h.brand].name : h.brand) + ' · ' + esc(h.type) + '</span></div>' +
        '<span class="badge">열기</span>';
      d.addEventListener('click', () => {
        S.result = h;
        S.selTitle = 0;
        renderResult();
        go('result');
      });
      list.appendChild(d);
    });
  }

  /* ───────────────────────── 설정 ───────────────────────── */
  function paintSettings() {
    const k = apiKey();
    $('#gemKey').value = k;
    $('#keyState').textContent = k ? '저장됨' : '없음';
    $('#keyState').className = 'badge' + (k ? '' : ' warn');
    const oa = (store.get(LS.oa) || '').trim();
    $('#oaKey').value = oa;
    $('#modelSel').value = S.cfg.model || 'auto';
    $('#histN').textContent = S.history.length + '건';
    let bytes = 0;
    try {
      Object.keys(localStorage).forEach((kk) => { bytes += (localStorage.getItem(kk) || '').length; });
    } catch (e) {}
    $('#lsUse').textContent = (bytes / 1024).toFixed(0) + 'KB / 약 5MB';
  }

  async function testKey() {
    const k = apiKey();
    if (!k) { toast('키를 먼저 저장해 주세요.', true); return; }
    toast('확인 중…');
    try {
      // 키는 쿼리로 넘긴다(브라우저 CORS 단순 요청 유지)
      const r2 = await fetch(API + '?pageSize=200&key=' + encodeURIComponent(k));
      if (!r2.ok) {
        const j = await r2.json().catch(() => ({}));
        throw new Error(friendly(r2.status, (j.error && j.error.message) || ''));
      }
      const j = await r2.json();
      const names = (j.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /gemini.*flash/.test(n) && !/image|tts|live/.test(n));
      toast('연결됨 · 사용 가능한 모델 ' + names.length + '개');
      $('#modelInfo').textContent = '사용 가능: ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' …' : '');
    } catch (e) {
      toast((e && e.message) || '연결에 실패했습니다.', true);
    }
  }

  /* ───────────────────────── 이벤트 ───────────────────────── */
  function bind() {
    $$('#tabs .tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.v)));
    $('#goWrite').addEventListener('click', () => go('write'));
    $('#addPhoto').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', async (e) => {
      await addPhotos(e.target.files);
      e.target.value = '';
    });
    $('#thumbs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      if (b.dataset.act === 'mosaic') openMosaic(b.dataset.id);
      if (b.dataset.act === 'del') {
        S.photos = S.photos.filter((p) => p.id !== b.dataset.id);
        paintThumbs();
      }
    });
    $('#memo').addEventListener('input', (e) => { S.memo = e.target.value; });

    const types = $('#types');
    TYPES.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'chip' + (t === S.type ? ' on' : '');
      b.textContent = t;
      b.addEventListener('click', () => {
        S.type = t;
        $$('#types .chip').forEach((x) => x.classList.toggle('on', x.textContent === t));
      });
      types.appendChild(b);
    });

    $('#brandBtn').addEventListener('click', () => {
      const opts = Object.keys(BRANDS).map((k) => BRANDS[k]);
      openChooser('브랜드 프리셋', opts.map((b) => ({ key: b.id, label: b.name, sub: b.line })), (id) => {
        S.brand = id;
        paintBrand();
        toast(BRANDS[id].name + ' 프리셋으로 바꿨습니다');
      });
    });

    $('#makeBtn').addEventListener('click', generate);
    $('#genCancel').addEventListener('click', () => {});
    $('#seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      S.pane = b.dataset.p;
      renderResult();
    });

    $('#copyHtml').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      const ok = await copyRich(r.blogHtml, r.blogText);
      toast(ok ? '서식 HTML을 복사했습니다 · 네이버에 붙여넣기' : '복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.', !ok);
    });
    $('#copyText').addEventListener('click', async () => {
      if (!S.result) return;
      const ok = await copyText(S.result.blogText);
      toast(ok ? '본문 텍스트를 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyTitle').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      const ok = await copyText(r.titles[S.selTitle] || r.titles[0] || '');
      toast(ok ? '제목을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyThreads').addEventListener('click', async () => {
      if (!S.result) return;
      const ok = await copyText(S.result.threads || '');
      toast(ok ? '스레드 글을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyThreadsShort').addEventListener('click', async () => {
      const t = (S.result && S.result.threads) || '';
      const lines = t.split('\n').filter(Boolean);
      const short = lines.slice(0, 3).join('\n').slice(0, 260);
      const ok = await copyText(short);
      toast(ok ? '짧은 버전(260자)을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyShorts').addEventListener('click', async () => {
      const rows = (S.result && S.result.shorts) || [];
      const t = rows.map((s) => s.time + ' | ' + s.screen + (s.voice ? ' | ' + s.voice : '')).join('\n');
      const ok = await copyText(t);
      toast(ok ? '쇼츠 대본을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyInsta').addEventListener('click', async () => {
      const ok = await copyText((S.result && S.result.insta) || '');
      toast(ok ? '인스타 캡션을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyYt').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      const ok = await copyText((r.ytTitle || '') + '\n\n' + (r.ytDesc || ''));
      toast(ok ? '유튜브 제목·설명을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyTags').addEventListener('click', async () => {
      const ok = await copyText(((S.result && S.result.tags) || []).join(' '));
      toast(ok ? '해시태그를 복사했습니다' : '복사 실패', !ok);
    });

    $('#zipBtn').addEventListener('click', () => {
      if (!S.result) return;
      const files = buildPackage(S.result);
      downloadBlob(makeZip(files), zipName(S.result) + '.zip');
      toast('ZIP으로 저장했습니다 · 사진 ' + S.photos.length + '장 + 원고');
    });
    $('#htmlBtn').addEventListener('click', () => {
      const r = S.result;
      if (!r) return;
      const title = r.titles[S.selTitle] || r.titles[0] || '';
      const html = '<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title>\n<h1>' + esc(title) + '</h1>\n' + r.blogHtml;
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), zipName(r) + '_원고.html');
      toast('원고 HTML을 저장했습니다');
    });
    $('#naverBtn').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      await copyRich(r.blogHtml, r.blogText);
      window.open('https://blog.naver.com/lvyhs621', '_blank');
      toast('본문을 복사했습니다 · 글쓰기에서 붙여넣으세요');
    });
    $('#discardBtn').addEventListener('click', () => {
      S.result = null;
      renderResult();
      go('write');
    });

    $('#saveKey').addEventListener('click', () => {
      const v = $('#gemKey').value.trim();
      if (v) store.set(LS.key, v); else store.del(LS.key);
      paintSettings(); paintHome();
      toast(v ? '키를 이 브라우저에 저장했습니다' : '키를 지웠습니다');
    });
    $('#testKey').addEventListener('click', testKey);
    $('#importKey').addEventListener('click', () => {
      const v = (store.get(LS.mars) || '').trim();
      if (!v) { toast('비서실에 저장된 키가 없습니다.', true); return; }
      store.set(LS.key, v);
      paintSettings(); paintHome();
      toast('비서실 키를 가져왔습니다');
    });
    $('#saveOa').addEventListener('click', () => {
      const v = $('#oaKey').value.trim();
      if (v) store.set(LS.oa, v); else store.del(LS.oa);
      toast(v ? 'OpenAI 키를 저장했습니다' : 'OpenAI 키를 지웠습니다');
    });
    $('#modelSel').addEventListener('change', (e) => {
      S.cfg.model = e.target.value;
      saveCfg();
      toast('모델: ' + (e.target.value === 'auto' ? '자동' : e.target.value));
    });
    $('#exportBtn').addEventListener('click', () => {
      const data = { app: 'ink1-field-studio', at: new Date().toISOString(), history: S.history };
      downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), '필드스튜디오_백업.json');
      toast('기록을 JSON으로 저장했습니다');
    });
    $('#clearHistBtn').addEventListener('click', () => {
      if (!confirm('저장된 원고 기록을 모두 지울까요? 되돌릴 수 없습니다.')) return;
      S.history = [];
      store.del(LS.hist);
      paintHome(); paintSettings();
      toast('기록을 지웠습니다');
    });
  }

  /* 선택 시트 */
  function openChooser(title, items, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet';
    wrap.innerHTML = '<div class="inner"><div class="hd"><b>' + esc(title) + '</b><button class="btn mini ghost">닫기</button></div><div class="stack" id="chList"></div></div>';
    document.body.appendChild(wrap);
    const list = wrap.querySelector('#chList');
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.style.margin = '0';
      b.style.textAlign = 'left';
      b.innerHTML = '<b style="font-size:14.5px">' + esc(it.label) + '</b><div class="muted" style="margin-top:4px">' + esc(it.sub || '') + '</div>';
      b.addEventListener('click', () => { wrap.remove(); onPick(it.key); });
      list.appendChild(b);
    });
    wrap.querySelector('button').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  }

  /* ───────────────────────── 시작 ───────────────────────── */
  function init() {
    loadCfg();
    loadHistory();
    bindCanvas();
    bind();
    paintBrand();
    paintThumbs();
    paintHome();
    paintSettings();
    if (!apiKey()) {
      const mars = (store.get(LS.mars) || '').trim();
      if (mars) { $('#homeHint').innerHTML = '마르스 비서실 키를 찾았습니다. <b>설정 → 비서실 키 가져오기</b>를 누르면 바로 쓸 수 있습니다.'; }
      else $('#homeHint').textContent = '설정에서 Google AI Studio 키를 넣으면 바로 동작합니다.';
    }
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
