// ====== Elements ======
const hero = document.getElementById('uploadHero');
const app = document.getElementById('appSection');
const themeToggle = document.getElementById('themeToggle');
const toastHost = document.getElementById('toastHost');

// อัปโหลด 
const video = document.getElementById("myVideo");
const videoInputEl = document.getElementById("videoUpload");
const csvInputEl   = document.getElementById("csvUpload");
const dropZoneVideo = document.getElementById("dropZoneVideo");
const dropZoneCsv   = document.getElementById("dropZoneCsv");
const selectFilesBtnVideo = document.getElementById("selectFilesBtnVideo");
const selectCsvBtn        = document.getElementById("selectCsvBtn");
const fileNameEl   = document.getElementById("fileName");
const csvFileNameEl= document.getElementById("csvFileName");
const fileInputEl = videoInputEl;   // alias ให้ videoInputEl
let canvas = null;                  // ป้องกัน ReferenceError เวลาใช้งาน canvas

// วิดีโอ UI 
const videoContainer = document.querySelector('.video-container');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const videoProgress = document.getElementById("videoProgress");
const currentTimeSpan = document.getElementById("currentTime");
const totalTimeSpan = document.getElementById("totalTime");
const progressBar = document.getElementById('progressBar');
const percentText = document.getElementById('percentText');
const elapsedEl = document.getElementById('elapsed');
const durationEl = document.getElementById('duration');
const summaryLink = document.getElementById('summaryLink');
const processingTitle = document.getElementById('processingTitle');

selectFilesBtnVideo?.addEventListener("click", ()=> videoInputEl.click());
selectCsvBtn?.addEventListener("click", ()=> csvInputEl.click());

// ====== Modal Elements ======
const modalBackdrop = document.getElementById('modalBackdrop');
const modalHelp = document.getElementById('modalHelp');
const modalFeatures = document.getElementById('modalFeatures');
const modalNoti = document.getElementById('modalNoti');
const openHowBtn = document.getElementById('openHow');
const openFeaturesBtn = document.getElementById('openFeatures');
const openNotiBtn = document.getElementById('openNoti');
const notiBadge = document.getElementById('notiBadge');
const notiList = document.getElementById('notiList');
const clearNotiBtn = document.getElementById('clearNoti');

// ====== Alert Modal ======
const modalAlert = document.getElementById('modalAlert');
const alertTitleEl = document.getElementById('alertTitle');
const alertContentEl = document.getElementById('alertContent');
const alertPrimaryBtn = document.getElementById('alertPrimaryBtn'); 

// ====== Modal core ======
function openModal(modalEl){
  if (!modalEl) return;
  modalBackdrop.hidden = false;
  modalEl.hidden = false;
  // สำหรับบางเอนจินใช้ attribute open เพื่อให้ CSS จับได้
  modalBackdrop.setAttribute('open','');
  modalEl.setAttribute('open','');
  // เลื่อนโฟกัสไปที่ปุ่มปิดเพื่อ A11y
  const closer = modalEl.querySelector('[data-close-modal]') || modalEl;
  setTimeout(()=> closer.focus?.(), 0);
}
function closeModal(modalEl){
  if (!modalEl) return;
  modalBackdrop.hidden = true;
  modalEl.hidden = true;
  modalBackdrop.removeAttribute('open');
  modalEl.removeAttribute('open');
}
// ปิดเมื่อคลิกปุ่ม [✕] หรือปุ่มใน footer ที่ติด data-close-modal
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-close-modal]');
  if (btn){
    const m = e.target.closest('.modal');
    closeModal(m);
  }
});
// ปิดเมื่อคลิกฉากหลัง
modalBackdrop?.addEventListener('click', ()=>{
  // ปิดทุกโมดัลที่เปิดอยู่
  [modalHelp, modalFeatures, modalNoti].forEach(m=>{
    if (!m.hidden) closeModal(m);
  });
});
// ปิดเมื่อกด ESC
document.addEventListener('keydown',(e)=>{
  if (e.key === 'Escape'){
    [modalHelp, modalFeatures, modalNoti].forEach(m=>{
      if (!m.hidden) closeModal(m);
    });
  }
});

// ปุ่มเปิดแต่ละโมดัล
openHowBtn?.addEventListener('click', ()=> openModal(modalHelp));
openFeaturesBtn?.addEventListener('click', ()=> openModal(modalFeatures));
openNotiBtn?.addEventListener('click', ()=>{
  renderNotiList();
  openModal(modalNoti);
});

// ====== เปิด Alert กลางหน้าจอ ======
function openAlert(message, {
  title = 'แจ้งเตือน',
  type = 'ok',
  primaryLabel,            // เช่น 'ดูสรุปผล'
  primaryHref,             // เช่น 'summary.html?...'
  primaryOnClick           // ฟังก์ชันทางเลือกถ้าอยากควบคุมเอง
} = {}) {
  if (!modalAlert) return;

  // ข้อความ/โทนสี
  alertTitleEl.textContent = title;
  alertContentEl.textContent = message;
  modalAlert.classList.toggle('modal--err', type === 'err');
  modalAlert.classList.toggle('modal--ok', type !== 'err');

  // ปุ่มหลัก (ซ่อน/แสดง + ผูกเหตุการณ์)
  if (alertPrimaryBtn) {
    alertPrimaryBtn.style.display = primaryLabel ? 'inline-flex' : 'none';
    alertPrimaryBtn.textContent = primaryLabel || '';
    alertPrimaryBtn.onclick = null;
    if (primaryLabel) {
      if (primaryOnClick) {
        alertPrimaryBtn.onclick = primaryOnClick;
      } else if (primaryHref) {
        alertPrimaryBtn.onclick = () => { location.href = primaryHref; };
      }
    }
  }

  openModal(modalAlert);
}

// ====== Notification Center (เชื่อมกับ toast) ======
const notiHistory = []; // เก็บประวัติแจ้งเตือนสำหรับศูนย์แจ้งเตือน
function updateNotiBadge(){ 
  if (notiBadge) notiBadge.textContent = String(notiHistory.length); 
  }
function renderNotiList(){
  if (!notiList) return;
  if (!notiHistory.length){
    notiList.innerHTML = `<div class="muted">ยังไม่มีการแจ้งเตือน</div>`;
    return;
  }
  notiList.innerHTML = notiHistory.slice(-50).reverse().map(n=>{
    const tone = n.type === 'err' ? '⚠️' : 'ℹ️';
    return `
      <div class="noti-item">
        <span class="tag">${tone}</span>
        <div>
          <div><strong>${n.msg}</strong></div>
          <div class="muted" style="font-size:12px;">เวลา ${fmtTimeShort(new Date(n.ts))}</div>
        </div>
      </div>
    `;
  }).join('');
}
function updateNotiBadge(){
  if (!notiBadge) return;
  notiBadge.textContent = String(notiHistory.length);
}

// ----- Toast (override ของเดิม: เก็บลง history ด้วย) -----
function toast(msg, type = "ok") {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastHost.appendChild(el);

  // เก็บประวัติ + อัปเดต badge
  notiHistory.push({ type, msg, ts: Date.now() });
  updateNotiBadge();

  openAlert(msg, { title: type === 'err' ? 'เกิดข้อผิดพลาด' : 'แจ้งเตือน', type });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
  }, 2600);

  setTimeout(() => el.remove(), 3200);
}

clearNotiBtn?.addEventListener('click', ()=>{
  notiHistory.length = 0;
  updateNotiBadge();
  renderNotiList();
  toast('ล้างแจ้งเตือนแล้ว');
});

(function onboardingOnce(){
  const KEY = 'ca_onboarded_v1';
  if (!localStorage.getItem(KEY)) {
    // แสดงโมดัลวิธีใช้งาน
    openModal(modalHelp);
    // ทำเครื่องหมายว่าดูแล้ว (กันเด้งซ้ำในครั้งต่อไป)
    localStorage.setItem(KEY, '1');
  }
})();

async function beginAnalysisForFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/")) { toast("กรุณาเลือกไฟล์วิดีโอ", "err"); return; }

  // สลับหน้า Hero → App
  hero.classList.add('hidden');
  app.classList.remove('hidden');

  // แสดงชื่อไฟล์ (อัปเดตทั้ง #fileName และ .file-name ถ้ามี)
  document.querySelectorAll('#fileName, .file-name').forEach(el=>{
    el.textContent = file.name || "ไฟล์วิดีโอ";
  });

  toast('เริ่มวิเคราะห์วิดีโอ…');

  // รีเซ็ตสถานะ/กราฟ
  savedSnapshots = 0;
  expectedSnapshots = 0;
  countedTimes.clear();
  processingTitle.textContent = 'กำลังประมวลผลวิดีโอ';
  summaryLink.classList.add('hidden');
  updateProgressFromSnapshots();

  barCounts = new Map();
  totals = EMO_KEYS.reduce((a,k)=>{ a[k]=0; return a; },{});
  confAgg = new Map();
  initRealtimeBarChart();
  refreshRealtimeBar();

  // เคลียร์ snapshot เดิมใน backend (ถ้าใช้)
  try { await fetch("http://127.0.0.1:5000/api/clear_snapshots", { method: "POST" }); } catch {}

  // เล่นวิดีโอ
  video.src = URL.createObjectURL(file);
  video.load();
  safePlay(video);
}

// ===== CSV Upload (offline review) =====
const SS_KEY = "CA_CSV_TEXT";
const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10MB
const EXPECTED_HEADER = [
  "timestamp","time","person_id","bbox","emotion","confidence","behavior","eye_status","pitch","yaw","roll"
];

function normalizeNewlines(s){ return s.replace(/\r?\n/g, "\n"); }
function stripBOM(s){ return s.replace(/^\uFEFF/, ""); }
function isOurCsv(text){
  if(!text) return false;
  const t = stripBOM(normalizeNewlines(text)).trim();
  if(!t) return false;
  const cols = t.split("\n")[0].trim().split(",").map(x=>x.replace(/^"|"$/g,"").trim());
  return cols.length === EXPECTED_HEADER.length && cols.every((c,i)=>c===EXPECTED_HEADER[i]) && t.split("\n").length>1;
}

// 1) เลือกไฟล์ CSV ผ่านปุ่ม
csvInputEl?.addEventListener("change", () => {
  const f = csvInputEl.files?.[0];
  if (!f) return;
  if (f.size > MAX_CSV_BYTES) return toast("ไฟล์ใหญ่เกิน 10MB","err");

  const reader = new FileReader();
  reader.onload = () => {
    try{
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!isOurCsv(text)) return toast("ไฟล์นี้ไม่ใช่ CSV จากระบบเรา ❌","err");
      csvFileNameEl.textContent = `เลือกไฟล์: ${f.name}`;
      sessionStorage.setItem(SS_KEY, stripBOM(normalizeNewlines(text)));
      sessionStorage.setItem("CA_CSV_NAME", f.name);
      const encoded = encodeURIComponent(f.name || "CSV");
      toast("โหลด CSV สำเร็จ ✓ กำลังไปที่หน้าสรุป…");
      location.href = `summary.html?source=csv&name=${encoded}`;
    }catch(e){ console.error(e); toast("อ่านไฟล์ไม่สำเร็จ","err"); }
  };
  reader.onerror = () => toast("อ่านไฟล์ไม่สำเร็จ","err");
  reader.readAsText(f,"utf-8");
});

// 2) ลาก-วาง CSV ที่ช่องขวา
bindDropArea(dropZoneCsv, (files)=>{
  const f = files.find(x=>/\.csv$/i.test(x.name) || x.type === "text/csv");
  if(!f) return toast("กรุณาวางไฟล์ .csv","err");
  if (f.size > MAX_CSV_BYTES) return toast("ไฟล์ใหญ่เกิน 10MB","err");

  const reader = new FileReader();
  reader.onload = () => {
    try{
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!isOurCsv(text)) return toast("ไฟล์นี้ไม่ใช่ CSV จากระบบเรา ❌","err");
      csvFileNameEl.textContent = `เลือกไฟล์: ${f.name}`;
      sessionStorage.setItem(SS_KEY, stripBOM(normalizeNewlines(text)));
      csvFileNameEl.textContent = `เลือกไฟล์: ${f.name}`;
      sessionStorage.setItem("CA_CSV_NAME", f.name);         // เก็บใน sessionStorage เหมือนเดิม
      sessionStorage.setItem(SS_KEY, stripBOM(normalizeNewlines(text)));
      const encoded = encodeURIComponent(f.name || "CSV");
      toast("โหลด CSV สำเร็จ ✓ กำลังไปที่หน้าสรุป…");
      location.href = `summary.html?source=csv&name=${encoded}`; // ส่งชื่อไฟล์ผ่าน URL ด้วย
    }catch(e){ console.error(e); toast("อ่านไฟล์ไม่สำเร็จ","err"); }
  };
  reader.onerror = () => toast("อ่านไฟล์ไม่สำเร็จ","err");
  reader.readAsText(f,"utf-8");
});

// 3) ลาก-วาง วิดีโอ ที่ช่องซ้าย
bindDropArea(dropZoneVideo, (files)=>{
  const f = files.find(x => x.type.startsWith("video/"));
  if (!f) return toast("กรุณาวางไฟล์วิดีโอ","err");
  beginAnalysisForFile(f);
});

// 4) กัน default ทั้งหน้า ป้องกันเบราว์เซอร์เปิดไฟล์ทับหน้าเว็บ
["dragover","drop"].forEach(ev=>{
  window.addEventListener(ev, e=>{
    e.preventDefault(); e.stopPropagation();
  });
});

// Theme management
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const root = document.documentElement;
  
  if (saved) {
    root.setAttribute('data-theme', saved);
    themeToggle.checked = (saved === 'dark');
  }
  
  themeToggle?.addEventListener('change', () => {
    const mode = themeToggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
  });
})();

// ===== Drag & Drop (รองรับ 2 ช่อง) =====
function preventDefaults(e){ e.preventDefault(); e.stopPropagation(); }
function setDragState(el, on){ el?.classList?.toggle("dragover", !!on); }
function bindDropArea(areaEl, onDropFiles){
  ["dragenter","dragover"].forEach(ev => areaEl?.addEventListener(ev, e => { preventDefaults(e); setDragState(areaEl, true); }));
  ["dragleave","drop"].forEach(ev => areaEl?.addEventListener(ev, e => { preventDefaults(e); setDragState(areaEl, false); }));
  areaEl?.addEventListener("drop", e => {
    const files = Array.from(e.dataTransfer?.files || []);
    onDropFiles(files);
  });
}

// วิดีโอ: change + drag&drop
videoInputEl?.addEventListener("change", () => {
  const f = videoInputEl.files?.[0];
  beginAnalysisForFile(f);
});

// ===== Toggle video visibility =====
let isVideoVisible = true;

function setVideoVisible(show) {
  isVideoVisible = !!show;
  videoContainer.classList.toggle('hidden', !isVideoVisible);
  toggleVideoBtn.textContent = isVideoVisible ? 'ซ่อนวิดีโอ' : 'แสดงวิดีโอ';
  toggleVideoBtn.setAttribute('aria-pressed', String(isVideoVisible));
}

toggleVideoBtn?.addEventListener('click', () => setVideoVisible(!isVideoVisible));
setVideoVisible(true);

// Live tag functionality
const liveTag = document.getElementById("liveTag");

function setLive(state) {
  if (!liveTag) return;
  
  liveTag.dataset.state = state;
  liveTag.textContent = state === "live" 
    ? "Live" 
    : state === "offline" 
      ? "Offline" 
      : "Connecting…";
}

// ===== Progress tracking =====
const SNAP_INTERVAL_SEC = 10;
const snapCountEl = document.getElementById('snapCount');
let expectedSnapshots = 0, savedSnapshots = 0;

function computeExpectedSnapshots() {
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  expectedSnapshots = Math.max(0, Math.floor(dur / SNAP_INTERVAL_SEC));
}

function updateProgressFromSnapshots() {
  const pct = expectedSnapshots > 0
    ? Math.min(100, Math.round((savedSnapshots / expectedSnapshots) * 100))
    : 0;

  if (progressBar) progressBar.style.width = pct + '%';
  if (percentText) percentText.textContent = pct + '%';
  if (snapCountEl) {
    snapCountEl.textContent = expectedSnapshots > 0
      ? `${savedSnapshots}/${expectedSnapshots}`
      : `${savedSnapshots}/—`;
  }

  if (pct === 100) {
    processingTitle.textContent = 'วิเคราะห์สำเร็จ';
    // ปุ่มสรุปบนการ์ด: โชว์ + ทำให้เด่น + โฟกัส
    summaryLink.href = 'summary.html?source=video';
    summaryLink.classList.remove('hidden');
    summaryLink.classList.add('btn-primary');
    setTimeout(() => summaryLink.focus?.(), 0);

    // ป๊อปอัปแจ้งเตือนพร้อมปุ่ม "ดูสรุปผล"
    openAlert('วิเคราะห์เสร็จแล้ว ✅', {
      title: 'แจ้งเตือน',
      type: 'ok',
      primaryLabel: 'ดูสรุปผล',
      primaryHref: 'summary.html?source=video'
    });
  }
}

// Aspect ratio & time slider
function updateAspect() {
  if (!video.videoWidth) return;
  
  document.querySelector('.video-container').style.setProperty(
    '--video-aspect', 
    `${video.videoWidth} / ${video.videoHeight}`
  );
}

['loadedmetadata', 'durationchange'].forEach(ev => {
  video.addEventListener(ev, () => {
    computeExpectedSnapshots();
    bindDurationUI();
    updateProgressFromSnapshots();
    updateAspect();
  });
});

function bindDurationUI() {
  if (!isNaN(video.duration)) {
    durationEl.textContent = formatTime(video.duration || 0);
    totalTimeSpan.textContent = formatTime(video.duration || 0);
    videoProgress.max = video.duration || 0;
  }
}

video.addEventListener('timeupdate', () => {
  const t = video.currentTime || 0;
  elapsedEl.textContent = formatTime(t);
  currentTimeSpan.textContent = formatTime(t);
  
  if (!isNaN(video.duration)) {
    videoProgress.value = t;
  }
});

videoProgress.addEventListener('input', (e) => {
  const v = parseFloat(e.target.value || '0');
  if (!isNaN(v)) video.currentTime = v;
});

// ===== Debug panel =====
const debugPanel = document.getElementById("debugPanel");

document.getElementById("toggleDebugBtn")?.addEventListener('click', () => {
  debugPanel.classList.toggle('hidden');
});

document.getElementById("clearDebugBtn")?.addEventListener('click', () => {
  document.getElementById("snapshotContainer").innerHTML = "";
  document.getElementById("idGalleryContainer").innerHTML = "";
});

// ===== Snapshot cards & per-id galleries =====
const snapshotContainer = document.getElementById("snapshotContainer");
const idGalleryContainer = document.getElementById("idGalleryContainer");
const idBuckets = new Map();

function ensureIdBucket(id) {
  if (!idGalleryContainer) return null;
  
  let b = idBuckets.get(id);
  if (!b) {
    const wrap = document.createElement("div");
    wrap.className = "id-bucket";
    wrap.dataset.id = id;
    wrap.innerHTML = `
      <div class="id-header">
        ID #${id}
        <span class="badge">ล่าสุด t=<span class="id-lasttime">-</span>s</span>
      </div>
      <div class="id-grid"></div>
    `;
    
    idGalleryContainer.prepend(wrap);
    b = {
      el: wrap,
      grid: wrap.querySelector(".id-grid"),
      last: wrap.querySelector(".id-lasttime")
    };
    
    idBuckets.set(id, b);
  }
  
  return b;
}

function addIdSnapshot({ person_id, imgSrc, time, emotion, confidence }) {
  if (!person_id || !idGalleryContainer) return;
  
  const b = ensureIdBucket(person_id);
  const cell = document.createElement("div");
  cell.className = "id-thumb";
  
  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = imgSrc;
  img.alt = `ID ${person_id}`;
  img.title = `t=${time}s ${emotion || ""}${
    confidence !== undefined ? ` (${Math.round(Number(confidence) * 100)}%)` : ""
  }`;
  
  const cap = document.createElement("small");
  cap.className = "id-caption";
  cap.textContent = `t=${time}s ${emotion || ""}`;
  
  cell.append(img, cap);
  b.grid.prepend(cell);
  
  while (b.grid.children.length > 12) {
    b.grid.lastChild.remove();
  }
  
  b.last.textContent = time;
}

const MAX_SNAPSHOTS = 24;

const deg = (x) => {
  return x === undefined || x === null || x === "" 
    ? "-" 
    : `${Number(x).toFixed(1)}°`;
};

function addSnapshotCard(info) {
  const card = document.createElement("div");
  card.className = "snapshot-card";
  
  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = info.imgSrc;
  card.appendChild(img);
  
  const meta = document.createElement("div");
  meta.className = "snapshot-meta";
  
  const pid = (info.person_id !== undefined && info.person_id !== null && info.person_id !== "") 
    ? String(info.person_id) 
    : null;
  
  const badge = pid 
    ? `<span class="badge id">ID #${pid}</span>` 
    : `<span class="badge absent">ไม่พบใบหน้า</span>`;
  
  const toSummary = pid 
    ? `<a class="badge" href="summary.html?person=${encodeURIComponent(pid)}">สรุป</a>` 
    : "";
  
  meta.innerHTML = `
    ${badge} ${toSummary}
    <b>t = ${info.time ?? 0}s</b>
    อารมณ์: ${info.emotion || "-"} ${
      info.confidence !== undefined && info.confidence !== "" 
        ? `(${(Number(info.confidence) * 100).toFixed(1)}%)` 
        : ""
    }<br>
    ท่าทาง: ${info.behavior || "-"}<br>
    ตา: ${info.eye_status || "-"}<br>
    R/P/Y: ${deg(info.roll)} / ${deg(info.pitch)} / ${deg(info.yaw)}
  `;
  
  card.appendChild(meta);
  snapshotContainer.prepend(card);
  
  while (snapshotContainer.children.length > MAX_SNAPSHOTS) {
    snapshotContainer.lastChild.remove();
  }
}

// ===== Charts =====
const EMO_KEYS = [
  'happy', 'surprised', 'neutral', 'sad', 
  'angry', 'fearful', 'disgusted', 'not_in_frame'
];

const EMO_LABEL = {
  happy: "ดีใจ (Happy)",
  surprised: "ประหลาดใจ (Surprised)",
  neutral: "เฉย ๆ (Neutral)",
  sad: "เศร้า (Sad)",
  angry: "โกรธ (Angry)",
  fearful: "กลัว (Fearful)",
  disgusted: "รังเกียจ (Disgusted)",
  not_in_frame: "ไม่อยู่หน้าจอ"
};

const EMO_BG = {
  happy: "rgba(46,204,113,0.85)",
  surprised: "rgba(243,156,18,0.85)",
  neutral: "rgba(149,165,166,0.85)",
  sad: "rgba(52,152,219,0.85)",
  angry: "rgba(231,76,60,0.85)",
  fearful: "rgba(155,89,182,0.85)",
  disgusted: "rgba(22,160,133,0.85)",
  not_in_frame: "rgba(52,73,94,0.85)"
};

const EMO_BORDER = {
  happy: "rgba(46,204,113,1)",
  surprised: "rgba(243,156,18,1)",
  neutral: "rgba(149,165,166,1)",
  sad: "rgba(52,152,219,1)",
  angry: "rgba(231,76,60,1)",
  fearful: "rgba(155,89,182,1)",
  disgusted: "rgba(22,160,133,1)",
  not_in_frame: "rgba(52,73,94,1)"
};

const TICK_SEC = 10;
let barCounts = new Map();
let totals = EMO_KEYS.reduce((a, k) => {
  a[k] = 0;
  return a;
}, {});
let lineChart, pieChart;

let confAgg = new Map(); // tick -> { emoKey: { sum: number, count: number } }

function ensureTick(tk) {
  if (!barCounts.has(tk)) {
    const z = EMO_KEYS.reduce((a, k) => {
      a[k] = 0;
      return a;
    }, {});
    barCounts.set(tk, z);
  }
  
  return barCounts.get(tk);
}

function rowToEmotionKey(row) {
  const behavior = (row.behavior || "").trim();
  if (behavior === "ไม่อยู่หน้าจอ") return "not_in_frame";
  
  const e = (row.emotion || "").trim().toLowerCase();
  return EMO_KEYS.includes(e) ? e : "neutral";
}

function pushSnapshot(row) {
  const t = Number(row.time || 0);
  const tick = Math.floor(t / TICK_SEC) * TICK_SEC;
  const key = rowToEmotionKey(row);

  // --- (เดิม) นับจำนวนต่อ tick เพื่อกราฟรวม/สัดส่วน ---
  const bucket = ensureTick(tick);
  bucket[key] = (bucket[key] || 0) + 1;
  totals[key] = (totals[key] || 0) + 1;

  // --- (ใหม่) สะสม confidence เพื่อนำไปทำเส้น Y=confidence ---
  const c = Number(row.confidence);
  let conf = Number.isFinite(c) ? c : 0;  // 0..1 จากโมเดล
  if (key === 'not_in_frame') conf = 1;   // ไม่อยู่หน้าจอ = 100%
  if (!confAgg.has(tick)) confAgg.set(tick, {});
  const slot = confAgg.get(tick);
  if (!slot[key]) slot[key] = { sum: 0, count: 0 };
  slot[key].sum += conf;
  slot[key].count += 1;

  refreshRealtimeBar();

}

// ===== Real-time stacked bar (แท่งเรียลไทม์) =====
const WINDOW_TICKS = 30;      // แสดงเฉพาะ 30 ช่วงล่าสุด (อ่านง่าย)
let barChart = null;

function initRealtimeBarChart(){
  const ctx = document.getElementById("emotionBarChart").getContext("2d");
  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],  // tick วินาที (0,10,20,...)
      datasets: EMO_KEYS.map(k => ({
      __key: k,
      label: EMO_LABEL[k],
      data: [],
      backgroundColor: EMO_BG[k],
      borderColor: EMO_BORDER[k],
      borderWidth: 1,
      grouped: false,          // <<< ทำให้ทุกแท่งอยู่กึ่งกลาง (ไม่จัดช่องแยก)
      maxBarThickness: 22
    }))
    },
    options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: "bottom" },
      title: { display: true, text: "ความมั่นใจเฉลี่ย (%) ต่อเวลา" },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) => `t=${items?.[0]?.label || 0}s`,
          label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}%`
        }
      }
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: {
      x: { stacked: false, title: { display: true, text: "เวลาเริ่มช่วง (วินาที)" } },
      y: {
        stacked: false,
        beginAtZero: true,
        max: 100,                    // ล็อก 0..100
        ticks: { callback: v => `${v}%` },
        title: { display: true, text: "Confidence (%)" }
       }
      }
    }
  });
}

function refreshRealtimeBar(){
  if (!barChart) return;

  // set labels (ticks) จาก barCounts และจำกัดหน้าต่างล่าสุด
  let ticks = Array.from(barCounts.keys()).sort((a,b)=>a-b);
  if (ticks.length > WINDOW_TICKS) {
    ticks = ticks.slice(-WINDOW_TICKS);
  }

  // อัปเดต labels
  barChart.data.labels = ticks.map(t => String(t));

  // อัปเดต data ต่ออารมณ์ด้วยค่าเฉลี่ยความมั่นใจ (%)
  barChart.data.datasets.forEach(ds => {
    const key = ds.__key;
    ds.data = ticks.map(tk => {
      const s = confAgg.get(tk)?.[key];
      const avg = s && s.count ? (s.sum / s.count) : 0;
      return Math.round(avg * 100); // 0..100
    });
  });

  // ยืดความกว้าง canvas เพื่อเลื่อนดูได้ (ถ้าแท่งเยอะ)
  const cv = barChart.canvas;
  const PX_PER_BAR = 36; // กว้างต่อคอลัมน์
  const minW = 680;      // ให้พอดีการ์ด
  cv.style.width = Math.max(minW, ticks.length * PX_PER_BAR) + "px";

  barChart.update('none');
}

// Prevent duplicate counting per tick
const countedTimes = new Set();

function bumpProgressOnce(t) {
  const key = String(Math.floor(Number(t) || 0));
  if (countedTimes.has(key)) return;
  
  countedTimes.add(key);
  savedSnapshots += 1;
  updateProgressFromSnapshots();
}

// ===== Load models and bind upload =====
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
]).then(startVideoUpload);

function startVideoUpload() {
  fileInputEl.addEventListener('change', async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    
    // HERO → APP
    hero.classList.add('hidden');
    app.classList.remove('hidden');
    
    if (fileNameEl) fileNameEl.textContent = file.name;
    toast('เริ่มวิเคราะห์วิดีโอ…');
    
    // Reset progress/graphs
    savedSnapshots = 0;
    expectedSnapshots = 0;
    countedTimes.clear();
    
    processingTitle.textContent = 'กำลังประมวลผลวิดีโอ';
    summaryLink.classList.add('hidden');
    updateProgressFromSnapshots();
    
    barCounts = new Map();
    totals = EMO_KEYS.reduce((a, k) => {
      a[k] = 0;
      return a;
    }, {});
    confAgg = new Map()
    
    // แทน initCharts();
    initRealtimeBarChart();
    refreshRealtimeBar(); // เคลียร์หน้าจอกราฟให้ว่างก่อนเริ่ม

    
    // Clear CSV for new session
    await fetch("http://127.0.0.1:5000/api/clear_snapshots", {
      method: "POST"
    });
    
    // Play video
    video.src = URL.createObjectURL(file);
    video.load();
    safePlay(video)
    
    async function safePlay(vid) {
      try {
        await vid.play();
      } catch (e) {
        // เคสที่เจอบ่อยและ “ไม่ถือว่า fail”
        if (e && (e.name === 'AbortError')) return;           // ถูกยกเลิกเพราะมีการโหลด/สั่ง play ซ้อน
        if (e && (e.name === 'NotAllowedError') && vid.muted) return; // Chrome policy แต่วีดิโอ muted แล้ว ปล่อยผ่าน
        console.error('video.play() failed:', e);
        toast('เล่นวิดีโอไม่สำเร็จ', 'err');
      }
    }
  });
  
  // Canvas + Detection
  function getDisplaySize() {
    const rect = videoContainer.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }
  
  function resizeCanvas() {
    if (!canvas) return;
    
    const { width, height } = getDisplaySize();
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  }
  
  function startDetection() {
    video.addEventListener("loadedmetadata", () => {
      updateAspect();
      resizeCanvas();
      
      try {
        tracker.maxDist = Math.max(video.videoWidth, video.videoHeight) * 0.22;
        tracker.maxMiss = 240;
        tracker.descThreshold = 0.62;
      } catch {}
    });
    
    window.addEventListener("resize", resizeCanvas);
    
    canvas = faceapi.createCanvasFromMedia(video);
    videoContainer.appendChild(canvas);
    resizeCanvas();
    
    let lastSnapshotSec = -1, isFetching = false;
    
    async function onFrame() {
      try {
        if (video.paused || video.ended) {
          requestAnimationFrame(onFrame);
          return;
        }
        
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 512,
            scoreThreshold: 0.3
          }))
          .withFaceLandmarks()
          .withFaceExpressions()
          .withFaceDescriptors();
        
        const displaySize = getDisplaySize();
        faceapi.matchDimensions(canvas, displaySize);
        const drawDetections = faceapi.resizeResults(detections, displaySize);
        
        const tracked = tracker.update(detections);
        const trackedForDraw = faceapi.resizeResults(tracked, displaySize);
        
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        faceapi.draw.drawDetections(canvas, trackedForDraw, { withScore: false });
        faceapi.draw.drawFaceLandmarks(canvas, trackedForDraw);
        faceapi.draw.drawFaceExpressions(canvas, drawDetections, {
          minConfidence: 0.1,
          fontSize: 14
        });
        
        const nowSec = Math.floor(video.currentTime);
        const tick = 10;
        
        if (detections.length === 0) {
          if (nowSec % tick === 0 && nowSec !== lastSnapshotSec && nowSec >= tick && !isFetching) {
            lastSnapshotSec = nowSec;
            isFetching = true;
            
            const sw = video.videoWidth;
            const sh = video.videoHeight;
            
            const tmp = document.createElement("canvas");
            tmp.width = sw;
            tmp.height = sh;
            
            tmp.getContext("2d", { willReadFrequently: true })
              .drawImage(video, 0, 0, sw, sh);
            
            const frames = [{
              image: tmp.toDataURL("image/png"),
              time: nowSec,
              person_id: null,
              bbox: "0,0,0,0",
              emotion: "",
              confidence: ""
            }];
            
            fetch("http://127.0.0.1:5000/api/analyze_batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ frames })
            })
              .then(r => r.json())
              .then(({ rows }) => {
                const row = rows && rows[0] 
                  ? rows[0] 
                  : { time: nowSec, behavior: "ไม่อยู่หน้าจอ" };
                
                addSnapshotCard({
                  imgSrc: frames[0].image,
                  time: row.time,
                  person_id: row.person_id || null,
                  emotion: row.emotion,
                  confidence: row.confidence,
                  behavior: row.behavior,
                  eye_status: row.eye_status,
                  roll: row.roll,
                  pitch: row.pitch,
                  yaw: row.yaw
                });
                
                bumpProgressOnce(nowSec);
              })
              .finally(() => {
                isFetching = false;
              });
          }
        } else if (nowSec % tick === 0 && nowSec !== lastSnapshotSec && !isFetching && nowSec >= tick) {
          lastSnapshotSec = nowSec;
          isFetching = true;
          
          const frames = tracked.map(det => {
            const box = det.detection.box;
            const sw = 500, sh = 600;
            
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            
            const sx = Math.max(0, Math.min(video.videoWidth - sw, cx - sw / 2));
            const sy = Math.max(0, Math.min(video.videoHeight - sh, cy - sh / 2));
            
            const tmp = document.createElement("canvas");
            tmp.width = sw;
            tmp.height = sh;
            
            tmp.getContext("2d", { willReadFrequently: true })
              .drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            
            const sorted = Object.entries(det.expressions || {})
              .sort((a, b) => b[1] - a[1]);
            
            const [emo, score] = sorted[0] || ["neutral", 0];
            
            return {
              image: tmp.toDataURL("image/png"),
              time: nowSec,
              person_id: det.person_id,
              bbox: `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`,
              emotion: emo,
              confidence: score
            };
          });
          
          fetch("http://127.0.0.1:5000/api/analyze_batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frames })
          })
            .then(r => r.json())
            .then(({ rows }) => {
              rows.forEach((row, i) => {
                addSnapshotCard({
                  imgSrc: frames[i]?.image || frames[0].image,
                  time: row.time,
                  emotion: row.emotion,
                  person_id: row.person_id || null,
                  confidence: row.confidence,
                  behavior: row.behavior,
                  eye_status: row.eye_status,
                  roll: row.roll,
                  pitch: row.pitch,
                  yaw: row.yaw
                });
                
                addIdSnapshot({
                  person_id: row.person_id || null,
                  imgSrc: frames[i]?.image || frames[0].image,
                  time: row.time,
                  emotion: row.emotion,
                  confidence: row.confidence
                });
              });
              
              bumpProgressOnce(nowSec);
            })
            .finally(() => {
              isFetching = false;
            });
        }
      } catch (err) {
        console.error("onFrame error:", err);
      }
      
      requestAnimationFrame(onFrame);
    }
    
    onFrame();
  }
  
  video.addEventListener("play", () => {
    if (canvas) canvas.remove();
    canvas = null;
    
    if (video.readyState < 2) {
      video.addEventListener("canplay", startDetection, { once: true });
    } else {
      startDetection();
    }
  });
  
  // Bootstrap charts + SSE
  (async function bootstrapCharts() {
    // แทน initCharts();
    initRealtimeBarChart();
    refreshRealtimeBar(); // เคลียร์หน้าจอกราฟให้ว่างก่อนเริ่ม

    
    try {
      const res = await fetch("http://127.0.0.1:5000/api/snapshots");
      const csvText = await res.text();
      const rows = csvText.split("\n").slice(1).filter(Boolean);
      
      countedTimes.clear();
      
      rows.forEach(line => {
        const parts = line.split(",");
        const t = parts[1];
        countedTimes.add(String(Math.floor(Number(t) || 0)));
      });
      
      savedSnapshots = countedTimes.size;
      updateProgressFromSnapshots();
      
      rows.forEach(line => {
        const p = line.split(",");
        if (p.length < 11) return;
        
        const [timestamp, time] = [p[0], Number(p[1] || 0)];
        const [emotion, confidence, behavior, eye_status, pitch, yaw, roll] = p.slice(-7);
        
        pushSnapshot({
          timestamp,
          time,
          emotion,
          confidence,
          behavior,
          eye_status,
          pitch,
          yaw,
          roll
        });
      });
    } catch (e) {
      console.warn("โหลด CSV เริ่มต้นไม่สำเร็จ", e);
    }
    
    setLive("connecting");
    
    const es = new EventSource("http://127.0.0.1:5000/api/stream");
    
    es.onopen = () => setLive("live");
    es.onerror = () => setLive("offline");
    
    es.onmessage = (evt) => {
      try {
        const row = JSON.parse(evt.data);
        pushSnapshot(row);
        bumpProgressOnce(row.time);
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };
  })();
}

// ===== Tracker =====
class SimpleTracker {
  constructor(maxDist = 120, maxMiss = 45, descThreshold = 0.55) {
    this.maxDist = maxDist;
    this.maxMiss = maxMiss;
    this.descThreshold = descThreshold;
    this.nextId = 1;
    this.tracks = new Map();
    this.registry = new Map();
  }
  
  _dist(a, b) {
    const dx = a.cx - b.cx;
    const dy = a.cy - b.cy;
    return Math.hypot(dx, dy);
  }
  
  _dDesc(a, b) {
    if (!a || !b) return Infinity;
    
    try {
      return faceapi.euclideanDistance(a, b);
    } catch {
      let s = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const d = a[i] - b[i];
        s += d * d;
      }
      return Math.sqrt(s);
    }
  }
  
  _mergeDesc(oldD, newD, alpha = 0.7) {
    if (!oldD) return new Float32Array(newD);
    
    const out = new Float32Array(newD.length);
    for (let i = 0; i < newD.length; i++) {
      out[i] = alpha * oldD[i] + (1 - alpha) * newD[i];
    }
    
    let n = 0;
    for (let i = 0; i < out.length; i++) {
      n += out[i] * out[i];
    }
    
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < out.length; i++) {
      out[i] /= n;
    }
    
    return out;
  }
  
  update(detections) {
    const dets = detections.map(d => {
      const box = d.detection.box;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      return { ...d, cx, cy };
    });
    
    for (const t of this.tracks.values()) {
      t.miss++;
    }
    
    for (const det of dets) {
      let bestId = null;
      let bestDesc = Infinity;
      let bestGeo = Infinity;
      
      for (const [id, t] of this.tracks) {
        const dDesc = this._dDesc(det.descriptor, t.descriptor);
        const dGeo = this._dist(det, t);
        
        if (dDesc <= this.descThreshold && dGeo <= this.maxDist) {
          if (dDesc < bestDesc || (Math.abs(dDesc - bestDesc) < 1e-6 && dGeo < bestGeo)) {
            bestId = id;
            bestDesc = dDesc;
            bestGeo = dGeo;
          }
        }
      }
      
      if (bestId == null) {
        for (const [id, reg] of this.registry) {
          const dDesc = this._dDesc(det.descriptor, reg.descriptor);
          if (dDesc <= (this.descThreshold + 0.05)) {
            bestId = id;
            break;
          }
        }
      }
      
      if (bestId != null) {
        let t = this.tracks.get(bestId);
        if (!t) {
          t = {
            cx: det.cx,
            cy: det.cy,
            miss: 0,
            descriptor: new Float32Array(det.descriptor)
          };
          this.tracks.set(bestId, t);
        }
        
        t.cx = det.cx;
        t.cy = det.cy;
        t.miss = 0;
        t.descriptor = this._mergeDesc(t.descriptor, det.descriptor);
        
        const reg = this.registry.get(bestId) || { descriptor: null, count: 0 };
        reg.descriptor = this._mergeDesc(reg.descriptor, det.descriptor);
        reg.count++;
        this.registry.set(bestId, reg);
        
        det.person_id = bestId;
      } else {
        let cId = null;
        let cBest = Infinity;
        
        for (const [id, t] of this.tracks) {
          const dGeo = this._dist(det, t);
          if (dGeo < cBest && dGeo <= this.maxDist) {
            cBest = dGeo;
            cId = id;
          }
        }
        
        if (cId != null) {
          const t = this.tracks.get(cId);
          t.cx = det.cx;
          t.cy = det.cy;
          t.miss = 0;
          t.descriptor = this._mergeDesc(t.descriptor, det.descriptor);
          det.person_id = cId;
        } else {
          const id = this.nextId++;
          const desc = new Float32Array(det.descriptor);
          
          this.tracks.set(id, {
            cx: det.cx,
            cy: det.cy,
            miss: 0,
            descriptor: desc
          });
          
          this.registry.set(id, {
            descriptor: new Float32Array(desc),
            count: 1
          });
          
          det.person_id = id;
        }
      }
    }
    
    for (const [id, t] of [...this.tracks]) {
      if (t.miss > this.maxMiss) {
        const reg = this.registry.get(id) || { descriptor: null, count: 0 };
        reg.descriptor = this._mergeDesc(reg.descriptor, t.descriptor);
        reg.count++;
        this.registry.set(id, reg);
        this.tracks.delete(id);
      }
    }
    
    return dets;
  }
}

const tracker = new SimpleTracker();

// ===== Utils =====
function formatTime(sec) {
  if (isNaN(sec)) return "00:00";
  
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
