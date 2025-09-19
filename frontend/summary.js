// summary.js (PATCH with sticky toolbar + active zoom + pct-list)
const API_BASE = `http://${location.hostname}:5000`;
let allData = [];
let currentZoom = 1; // 1=10s, 2=30s, 3=60s
const charts = {};
const BASE_STEP_FOR_DETECTION_TIME = 10; // 10s คือฐานการเก็บ snapshot จริง

// ===== แสดง/ซ่อนปุ่มซูมตามความยาวคลิป =====
function updateZoomVisibility(clipSec) {
  const z2 = document.getElementById("zoom2Btn");
  const z3 = document.getElementById("zoom3Btn");
  if (z2) z2.style.display = clipSec >= 30 ? "inline-flex" : "none";
  if (z3) z3.style.display = clipSec >= 60 ? "inline-flex" : "none";
}

// ===== ทำปุ่ม Zoom ให้แสดงสถานะ active =====
function setActiveZoomButtons(){
  const map = {1:"#zoom1Btn", 2:"#zoom2Btn", 3:"#zoom3Btn"};
  [1,2,3].forEach(z => {
    const el = document.querySelector(map[z]);
    if (!el) return;
    el.classList.toggle('is-active', z === currentZoom);
  });
}

// ===== ดาวน์โหลด "รูปเดียว" ของหน้าสรุป =====
async function downloadFullSummaryPNG() {
  const target = document.querySelector(".container"); // เฉพาะเนื้อหาในกรอบสรุป
  if (!target || typeof html2canvas === "undefined") return;
  const canvas = await html2canvas(target, {
    scale: window.devicePixelRatio || 2,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg') || "#ffffff"
  });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "summary_page.png";
  a.click();
}

const RGBA = (rgb, a) => `rgba(${rgb},${a})`;
const PAL = {
  pos: "46,204,113", neu: "149,165,166", neg: "231,76,60", off: "52,73,94",
  happy: "46,204,113", neutral: "149,165,166", sad: "52,152,219",
  angry: "231,76,60", fearful: "155,89,182", disgusted: "22,160,133", surprised: "243,156,18"
};
const EMO8 = [
  "happy", "neutral", "sad", "angry",
  "fearful", "disgusted", "surprised", "off"
];

const EMO_LABELS = {
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
  angry: "Angry",
  fearful: "Fearful",
  disgusted: "Disgusted",
  surprised: "Surprised",
  off: "ไม่อยู่หน้าจอ"
};
const GROUPS = ["บวก (Positive)", "กลาง (Neutral)", "ลบ (Negative)", "ไม่อยู่หน้าจอ"];

const $ = (q) => document.querySelector(q);
const stepFromZoom = (z) => (z === 2 ? 30 : z === 3 ? 60 : 10);

/* ---------- Utils ---------- */
function downloadCanvasPNG(id, name) {
  const cv = document.getElementById(id);
  if (!cv) return;
  const a = document.createElement("a");
  a.href = cv.toDataURL("image/png");
  a.download = (name || id) + ".png";
  a.click();
}

function parseCSVLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  } out.push(cur);
  return out;
}

function toGroup(row) {
  const beh = (row.behavior || "").trim();
  if (beh.includes("ไม่อยู่หน้าจอ")) return GROUPS[3];
  const e = (row.emotion || "").trim().toLowerCase();
  if (["happy", "surprised"].includes(e)) return GROUPS[0];
  if (["angry", "sad", "fearful", "disgusted"].includes(e)) return GROUPS[2];
  if (e === "not_in_frame") return GROUPS[3];
  return GROUPS[1];
}

/* ---------- Data loading ---------- */
async function loadSnapshots() {
  const res = await fetch(`${API_BASE}/api/snapshots`, { cache: "no-store" });
  if (!res.ok) { setDebug("❌ โหลดข้อมูลไม่สำเร็จ: HTTP " + res.status); return; }
  const text = await res.text();
  const rows = text.trim().split(/\r?\n/).slice(1).filter(Boolean);

  allData = rows.map(line => {
    const p = parseCSVLine(line);
    if (!p || p.length < 11) return null;
    const tail = p.slice(-7).map(s => (s ?? "").trim());
    const head = p.slice(0, p.length - 7);
    const [timestamp, tRaw, person_id] = [head[0] ?? "", head[1], head[2] ?? ""];
    const bbox = head.slice(3).join(",").replace(/^"|"$/g, "");
    const [emotion, confidence, behavior, eye_status, pitch, yaw, roll] = tail;
    return {
      timestamp,
      time: Number.isFinite(Number(tRaw)) ? Number(tRaw) : 0,
      person_id, bbox, emotion, confidence, behavior, eye_status, pitch, yaw, roll
    };
  }).filter(Boolean);

  buildPersonFilter();
  renderAll();
}

function buildPersonFilter() {
  const sel = $("#personFilter");
  const ids = [...new Set(allData.map(r => r.person_id).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  sel.innerHTML = `<option value="">ทุกคน</option>` + ids.map(id => `<option>${id}</option>`).join("");
}
const currentFiltered = () => {
  const pid = $("#personFilter")?.value || "";
  return pid ? allData.filter(r => String(r.person_id) === pid) : allData.slice();
};

function setDebug(t) { const el = $("#debugMsg"); if (el) el.textContent = t || ""; }

/* ---------- Summary & KPIs ---------- */
function computeSummary(data, step) {
  const persons = new Set(data.map(r => r.person_id).filter(Boolean));
  const detections = data.length;
  const maxT = Math.max(0, ...data.map(r => Number(r.time) || 0));

  // Detection time: ใช้ฐาน 10s ตายตัว (ไม่ผันกับ zoom)
  const bins = new Set();
  data.forEach(r => {
    const t = Number(r.time);
    if (Number.isFinite(t)) {
      bins.add(Math.floor(t / BASE_STEP_FOR_DETECTION_TIME) * BASE_STEP_FOR_DETECTION_TIME);
    }
  });
  const detectionTime = bins.size * BASE_STEP_FOR_DETECTION_TIME;

  const emoCounts = Object.fromEntries(EMO8.map(e => [e, 0]));
  const groupCounts = { pos: 0, neu: 0, neg: 0, off: 0 };

  data.forEach(r => {
    const e = (r.emotion || "").toLowerCase();
    if (emoCounts[e] != null) emoCounts[e]++;
    const g = toGroup(r);
    if (g === GROUPS[0]) groupCounts.pos++;
    else if (g === GROUPS[2]) groupCounts.neg++;
    else if (g === GROUPS[3]) groupCounts.off++;
    else groupCounts.neu++;
  });

  return {
    personsCount: persons.size,
    detections,
    clipTime: Math.round(maxT),
    detectionTime,
    emoCounts,
    groupCounts
  };
}

function renderKpis(sum) {
  const cards = [
    { h: "จำนวนบุคคล", v: sum.personsCount },
    { h: "จำนวนครั้งที่ตรวจจับ", v: sum.detections },
    { h: "เวลาคลิป (s)", v: sum.clipTime },
    { h: "เวลาที่ตรวจจับ/ทั้งหมด (s)", v: sum.detectionTime },
    { h: "อัตราการตรวจจับ/วินาที", v: (sum.clipTime ? (sum.detections / sum.clipTime).toFixed(2) : "0") },
    { h: "ไม่อยู่หน้าจอ (ครั้ง)", v: sum.groupCounts.off }
  ];
  $("#kpiGrid").innerHTML = cards.map(c => (
    `<div class="kpi"><div class="h">${c.h}</div><div class="v">${c.v}</div></div>`
  )).join("");
}

/* ---------- Overview: Pie + Time (bin-based) ---------- */
function renderOverview(data, step) {
  // 1) สรุป + KPI (เวลาตรวจจับคงที่)
  const sum = computeSummary(data, step);
  renderKpis(sum);
  updateZoomVisibility(sum.clipTime);

  // สร้าง ticks ตาม bin (ใช้ซูม)
  const maxT = Math.max(0, ...data.map(r => Number(r.time) || 0));
  const ticks = [];
  for (let t = 0; t <= Math.ceil(maxT / step) * step; t += step) ticks.push(t);

  // Helper นับกลุ่มเด่นใน bin เดียว
  const groupKey = (g) => (g === GROUPS[0]) ? "pos" : (g === GROUPS[2]) ? "neg" : (g === GROUPS[3]) ? "off" : "neu";
  const groupY   = { pos: 1, neu: 0, neg: -1, off: -2 };

  // 2) คำนวณ "กลุ่มเด่นต่อ bin" เพื่อใช้ทั้ง Pie และ Time chart
  const binCounts = { pos:0, neu:0, neg:0, off:0 };
  const timePointsByGroup = { pos:[], neu:[], neg:[], off:[] };

  ticks.forEach(t0 => {
    const rows = data.filter(r => Math.floor((Number(r.time) || 0) / step) * step === t0);
    if (!rows.length) return;
    const cnt = { pos:0, neu:0, neg:0, off:0 };
    rows.forEach(r => cnt[groupKey(toGroup(r))]++);
    const dominant = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0]; // "pos|neu|neg|off"
    binCounts[dominant]++;
    timePointsByGroup[dominant].push({ x: t0, y: groupY[dominant] });
  });

  // 3) วาด Pie (นับเป็นราย bin → จึงปรับตาม Zoom)
  charts.groupPie?.destroy();
  const ctxPie = document.getElementById("groupPie")?.getContext("2d");
  if (ctxPie) {
    charts.groupPie = new Chart(ctxPie, {
      type: "pie",
      data: {
        labels: ["Positive", "Neutral", "Negative", "Off-screen"],
        datasets: [{
          data: [binCounts.pos, binCounts.neu, binCounts.neg, binCounts.off],
          backgroundColor: [
            RGBA(PAL.pos, 0.9), RGBA(PAL.neu, 0.9),
            RGBA(PAL.neg, 0.9), RGBA(PAL.off, 0.9)
          ],
          borderColor: [
            RGBA(PAL.pos, 1), RGBA(PAL.neu, 1),
            RGBA(PAL.neg, 1), RGBA(PAL.off, 1)
          ],
          borderWidth: 2, hoverOffset: 10
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
    });
  }

  // อัปเดต % ใต้ Pie ให้ตรงกับ bin ที่นับ
  const totalBins = Math.max(1, binCounts.pos + binCounts.neu + binCounts.neg + binCounts.off);
  const rows = [
    {key:"pos", label:"Positive", rgb: PAL.pos, val: binCounts.pos},
    {key:"neu", label:"Neutral",  rgb: PAL.neu, val: binCounts.neu},
    {key:"neg", label:"Negative", rgb: PAL.neg, val: binCounts.neg},
    {key:"off", label:"Off-screen", rgb: PAL.off, val: binCounts.off},
  ].map(r => ({...r, pct:(r.val/totalBins)*100})).sort((a,b)=>b.pct-a.pct);

  const listEl = document.getElementById("groupPctList");
  if (listEl){
    listEl.classList.add('pct-list');
    listEl.innerHTML = rows.map(r => `
      <div class="pct-item">
        <span class="pct-dot" style="background: rgba(${r.rgb},0.9); border-color: rgba(${r.rgb},1)"></span>
        <span>${r.label}</span>
        <span class="pct-val">${r.pct.toFixed(2)} %</span>
      </div>
    `).join("");
  }
  // เรียก setActiveZoomButtons หลังวาดกราฟ
  setActiveZoomButtons();

  // 4) วาด "ช่วงเวลา" — 1 กลุ่ม/1 bin
  const ds = [
    {k:"pos", lbl:GROUPS[0], rgb:PAL.pos},
    {k:"neu", lbl:GROUPS[1], rgb:PAL.neu},
    {k:"neg", lbl:GROUPS[2], rgb:PAL.neg},
    {k:"off", lbl:GROUPS[3], rgb:PAL.off}
  ].map(s => ({
    label: s.lbl,
    data: timePointsByGroup[s.k],
    showLine: false,
    pointRadius: Math.max(4, step/4),
    pointHoverRadius: Math.max(6, step/3),
    backgroundColor: RGBA(s.rgb, 0.75),
    borderColor: RGBA(s.rgb, 1),
    borderWidth: 1.2
  }));

  charts.groupOverTime?.destroy();
  const ctxTime = document.getElementById("groupOverTime")?.getContext("2d");
  if (ctxTime) {
    charts.groupOverTime = new Chart(ctxTime, {
      type: "scatter",
      data: { datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" }, title: { display: true, text: `ช่วงเวลา (bin ${step}s)` } },
        scales: {
          x: { type: "linear", title: { display: true, text: "เวลาเริ่มช่วง (s)" } },
          y: {
            type: "linear", suggestedMin: -2.1, suggestedMax: 1.1,
            ticks: {
              callback: (v) => (v===1?"Positive":v===0?"Neutral":v===-1?"Negative":v===-2?"Off-screen":"")
            },
            title: { display: true, text: "กลุ่มอารมณ์" }
          }
        }
      }
    });
  }
}

/* ---------- 7 motions view: 0–100% ต่อช่วง ---------- */
function renderEmo7OverTime(data, step) {
  const maxT = Math.max(0, ...data.map(r => Number(r.time) || 0));
  const ticks = [];
  for (let t = 0; t <= Math.ceil(maxT / step) * step; t += step) ticks.push(t);

  const perBin = ticks.map(t0 => {
    const rows = data.filter(r => Math.floor((Number(r.time) || 0) / step) * step === t0);
    const counts = Object.fromEntries(EMO8.map(k => [k, 0]));
    rows.forEach(r => {
      const e = (r.emotion || "").toLowerCase();
      if (counts[e] != null) counts[e]++;
      if (r.behavior?.includes("ไม่อยู่หน้าจอ") || e==="not_in_frame") counts.off++;
    });
    const total = rows.length || 1;
    return EMO8.map(k => Math.round((counts[k] / total) * 100));
  });

  const datasets = EMO8.map((k, idx) => ({
    label: EMO_LABELS[k],
    data: perBin.map(arr => arr[idx]),
    borderWidth: 1,
    backgroundColor: RGBA(PAL[k] || PAL.off, 0.85),
    borderColor: RGBA(PAL[k] || PAL.off, 1),
    stack: "emo8"
  }));

  charts.emo7OverTime?.destroy();
  charts.emo7OverTime = new Chart($("#emo7OverTime").getContext("2d"), {
    type: "bar",
    data: { labels: ticks, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true, title: { display: true, text: "เวลาเริ่มช่วง (s)" } },
        y: {
          stacked: true, beginAtZero: true, max: 100,
          ticks: { callback: v => v + "%" },
          title: { display: true, text: "สัดส่วน (%)" }
        }
      }
    }
  });
}

/* ---------- glue: tabs, zoom, filters, CSV ---------- */
function renderAll() {
  const step = stepFromZoom(currentZoom);
  const data = currentFiltered();
  renderOverview(data, step);
  if ($("#motionsView").classList.contains("view-active")) {
    renderEmo7OverTime(data, step);
  }
  setActiveZoomButtons();  // อัปเดตสถานะปุ่มซูม
}

function bindUI() {
  $("#tabOverview").addEventListener("click", () => {
    $("#tabOverview").classList.add("active");
    $("#tabMotions").classList.remove("active");
    $("#overviewView").classList.add("view-active");
    $("#motionsView").classList.remove("view-active");
    renderAll();
  });
  $("#tabMotions").addEventListener("click", () => {
    $("#tabMotions").classList.add("active");
    $("#tabOverview").classList.remove("active");
    $("#overviewView").classList.remove("view-active");
    $("#motionsView").classList.add("view-active");
    renderEmo7OverTime(currentFiltered(), stepFromZoom(currentZoom));
    setActiveZoomButtons();
  });

  $("#zoom1Btn").addEventListener("click", () => { currentZoom = 1; renderAll(); });
  $("#zoom2Btn").addEventListener("click", () => { currentZoom = 2; renderAll(); });
  $("#zoom3Btn").addEventListener("click", () => { currentZoom = 3; renderAll(); });

  $("#personFilter").addEventListener("change", renderAll);
  $("#reloadChartBtn").addEventListener("click", loadSnapshots);

  document.addEventListener("click", (e) => {
    const id = e.target?.dataset?.dl;
    if (id) downloadCanvasPNG(id);
  });

  $("#downloadCsvBtn").addEventListener("click", async () => {
    const res = await fetch(`${API_BASE}/api/snapshots`, { cache: "no-store" });
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "emotion_snapshots.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // theme toggle
  const saved = localStorage.getItem('theme');
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  if (saved) {
    root.setAttribute('data-theme', saved);
    if (toggle) toggle.checked = (saved === 'dark');
  }
  toggle?.addEventListener('change', () => {
    const mode = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
  });

  document.getElementById("downloadFullBtn")
    ?.addEventListener("click", downloadFullSummaryPNG);
}

bindUI();
loadSnapshots();
