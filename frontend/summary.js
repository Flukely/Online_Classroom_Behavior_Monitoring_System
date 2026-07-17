// summary.js — รวมทุกคน ไม่มีตัวกรองบุคคล + X-axis ปรับตาม Zoom
const API_BASE = `http://${location.hostname}:5000`;
const SS_KEY = "CA_CSV_TEXT"; // รับ CSV ที่อัปโหลดจากหน้าแรก
let allData = [];
let currentZoom = 1; // 1=10s, 2=30s, 3=60s
const charts = {};
const BASE_STEP_FOR_DETECTION_TIME = 10;

const RGBA = (rgb, a) => `rgba(${rgb},${a})`;
const PAL = {
  pos: "46,204,113", neu: "149,165,166", neg: "231,76,60", off: "17,24,39",
  happy: "46,204,113", neutral: "149,165,166", sad: "52,152,219",
  angry: "231,76,60", fearful: "155,89,182", disgusted: "22,160,133", surprised: "243,156,18"
};
const EMO8 = ["happy","neutral","sad","angry","fearful","disgusted","surprised","off"];
const EMO_LABELS = {
  happy:"Happy", neutral:"Neutral", sad:"Sad", angry:"Angry",
  fearful:"Fearful", disgusted:"Disgusted", surprised:"Surprised", off:"ไม่อยู่หน้าจอ"
};
const GROUPS = ["บวก (Positive)", "กลาง (Neutral)", "ลบ (Negative)", "ไม่อยู่หน้าจอ"];
const $ = (q) => document.querySelector(q);
const stepFromZoom = (z) => (z === 2 ? 30 : z === 3 ? 60 : 10);

// ป้องกันค่าค้างจากรอบก่อน
if (typeof window.__EXPORTING__ === "undefined") window.__EXPORTING__ = false;
// เปิดแอนิเมชันแบบปกติเมื่อใช้งานทั่วไป (บังคับชนิดเป็น object เสมอ)
if (typeof Chart.defaults?.animation !== "object") {
  Chart.defaults.animation = {};
}
Chart.defaults.animation.duration = 600;
Chart.defaults.animation.easing = "easeOutQuart";

/* ========== Helper ========== */
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
/**
 * [รวมอารมณ์เป็น 3 กลุ่ม]
 *  - Positive:   happy, surprised
 *  - Neutral:    (ค่าอื่นที่ไม่อยู่ด้านลบ/ไม่อยู่หน้าจอ) + not matched → neutral
 *  - Negative:   angry, sad, fearful, disgusted
 *  - Off-screen: behavior มีคำว่า "ไม่อยู่หน้าจอ" หรือ emotion = "not_in_frame"
 */
function toGroup(row) {
  const beh = (row.behavior || "").trim();
  if (beh.includes("ไม่อยู่หน้าจอ")) return GROUPS[3];
  const e = (row.emotion || "").trim().toLowerCase();
  if (["happy","surprised"].includes(e)) return GROUPS[0];
  if (["angry","sad","fearful","disgusted"].includes(e)) return GROUPS[2];
  if (e === "not_in_frame") return GROUPS[3];
  return GROUPS[1];
}

/* ========== Load data ========== */
async function loadSnapshots() {
  const params = new URLSearchParams(location.search);
  const fromCsvParam = params.get("source") === "csv";
  const nameFromQS = params.get("name"); // << มาใหม่

  const SS_KEY = "CA_CSV_TEXT";
  const NAME_KEY = "CA_CSV_NAME";

  const textInSession = sessionStorage.getItem(SS_KEY);
  // ใช้ชื่อจาก URL ก่อน ถ้าไม่มีค่อย fallback เป็น sessionStorage
  const uploadedName =
    (nameFromQS ? decodeURIComponent(nameFromQS) : "") ||
    sessionStorage.getItem(NAME_KEY) || "";

  const dlBtn = document.getElementById("downloadCsvBtn");
  const nameChip = document.getElementById("uploadedCsvName");

  const comingFromCsv = !!textInSession || fromCsvParam;

  if (comingFromCsv) {
    if (dlBtn) dlBtn.style.display = "none";
    if (nameChip) {
      nameChip.textContent = `ใช้ข้อมูลจาก: ${uploadedName || "ไฟล์ CSV (อัปโหลด)"}`;
      nameChip.hidden = false;
    }
  } else {
    if (dlBtn) dlBtn.style.display = "";
    if (nameChip) nameChip.hidden = true;
  }

  // โหลดข้อมูล
  let text;
  if (textInSession && textInSession.trim()) {
    text = textInSession;
  } else {
    const res = await fetch(`${API_BASE}/api/snapshots`, { cache: "no-store" });
    if (!res.ok) return;
    text = await res.text();
  }

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

  // รวมทุกคน ไม่มีตัวกรอง
  renderAll();
}

/* ========== Summary & KPIs ========== */
function computeSummary(data) {
  const detections = data.length;
  const maxT = Math.max(0, ...data.map(r => Number(r.time) || 0));

  // เวลาที่ตรวจจับยึดฐาน 10s
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
    detections,
    clipTime: Math.round(maxT),
    detectionTime,
    emoCounts,
    groupCounts
  };
}

function formatMinSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s}`;
}

function renderKpis(sum) {
  const cards = [
    { h: "จำนวนครั้งที่ตรวจจับ", v: sum.detections },
    { h: "เวลาคลิป (นาที)", v: formatMinSec(sum.clipTime) },
    { h: "เวลาที่ตรวจจับ (วินาที)", v: sum.detectionTime },
    { h: "อัตราการตรวจจับ (นาที)", v: (sum.clipTime ? (sum.detections / sum.clipTime).toFixed(2) : "0") },
    { h: "ไม่อยู่หน้าจอ (ครั้ง)", v: sum.groupCounts.off }
  ];
  $("#kpiGrid").innerHTML = cards.map(c =>
    `<div class="kpi"><div class="h">${c.h}</div><div class="v">${c.v}</div></div>`
  ).join("");
}

/* ========== Overview (Pie + Time) ========== */
function updateZoomVisibility(clipSec) {
  const z2 = document.getElementById("zoom2Btn");
  const z3 = document.getElementById("zoom3Btn");
  if (z2) z2.style.display = clipSec >= 30 ? "inline-flex" : "none";
  if (z3) z3.style.display = clipSec >= 60 ? "inline-flex" : "none";
}
function setActiveZoomButtons(){
  const map = {1:"#zoom1Btn", 2:"#zoom2Btn", 3:"#zoom3Btn"};
  [1,2,3].forEach(z => {
    const el = document.querySelector(map[z]);
    if (!el) return;
    el.classList.toggle('is-active', z === currentZoom);
  });
}
// step = bin width (10s, 30s, 60s)
function renderOverview(data, step) {
  const sum = computeSummary(data);
  renderKpis(sum);
  updateZoomVisibility(sum.clipTime);

  const maxT = Math.max(0, ...data.map(r => Number(r.time) || 0));
  const ticks = [];
  for (let t = 0; t <= Math.ceil(maxT / step) * step; t += step) ticks.push(t);

  const groupKey = (g) => (g === GROUPS[0]) ? "pos" : (g === GROUPS[2]) ? "neg" : (g === GROUPS[3]) ? "off" : "neu";
  const groupY   = { pos: 1, neu: 0, neg: -1, off: -2 };

  const binCounts = { pos:0, neu:0, neg:0, off:0 };
  const timePointsByGroup = { pos:[], neu:[], off:[], neg:[] };

  ticks.forEach(t0 => {
    const rows = data.filter(r => Math.floor((Number(r.time) || 0) / step) * step === t0);
    if (!rows.length) return;
    const cnt = { pos:0, neu:0, neg:0, off:0 };
    rows.forEach(r => cnt[groupKey(toGroup(r))]++);
    const dominant = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
    binCounts[dominant]++;
    timePointsByGroup[dominant].push({ x: t0, y: groupY[dominant] });
  });

  charts.groupPie?.destroy();
  const ctxPie = document.getElementById("groupPie")?.getContext("2d");
  if (ctxPie) {
    charts.groupPie = new Chart(ctxPie, {
      type: "pie",
      data: {
        labels: ["Positive","Neutral","Negative","Off-screen"],
        datasets: [{
          data: [binCounts.pos, binCounts.neu, binCounts.neg, binCounts.off],
          backgroundColor: [RGBA(PAL.pos,.9),RGBA(PAL.neu,.9),RGBA(PAL.neg,.9),RGBA(PAL.off,.9)],
          borderColor: [RGBA(PAL.pos,1),RGBA(PAL.neu,1),RGBA(PAL.neg,1),RGBA(PAL.off,1)],
          borderWidth: 2, hoverOffset: 10
        }]
      },
      options: { 
        animation: window.__EXPORTING__ ? false : { duration: 600, easing: "easeOutQuart" },
        responsive: true, maintainAspectRatio: false, 
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 14, boxHeight: 14 } } } }
    });
    window.__pieChart = charts.groupPie; 
  }

  const totalBins = Math.max(1, binCounts.pos + binCounts.neu + binCounts.neg + binCounts.off);
  const rows = [
    {key:"pos", label:"Positive", rgb: PAL.pos, val: binCounts.pos},
    {key:"neu", label:"Neutral",  rgb: PAL.neu, val: binCounts.neu},
    {key:"neg", label:"Negative", rgb: PAL.neg, val: binCounts.neg},
    {key:"off", label:"Off-screen", rgb: PAL.off, val: binCounts.off},
  ].map(r => ({...r, pct:(r.val/totalBins)*100})).sort((a,b)=>b.pct-a.pct);

  const listEl = document.getElementById("groupPctList");
  if (listEl){
    listEl.innerHTML = rows.map(r => `
      <div class="pct-item">
        <span class="pct-dot" style="background: rgba(${r.rgb},0.9); border-color: rgba(${r.rgb},1)"></span>
        <span>${r.label}</span>
        <span class="pct-val">${r.pct.toFixed(2)} %</span>
      </div>
    `).join("");
  }
  setActiveZoomButtons();

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
        animation: window.__EXPORTING__ ? false : { duration: 600, easing: "easeOutQuart" }, 
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 14, boxHeight: 14 } }, title: { display: true, text: `ช่วงเวลา (bin ${step}s)` } },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: `เวลา (ทุก ${step} วินาที)` },
            ticks: {
              stepSize: step,
              callback: (v) => `${v}s`
            }
          },
          y: {
            type: "linear", suggestedMin: -2.1, suggestedMax: 1.1,
            ticks: {
              callback: (v) => (v===1?"Positive":v===0?"Neutral":v===-1?"Negative":v===-2?"Off-screen":"")
            },
            title: { display: true, text: "กลุ่มความรู้สึก" }
          }
        }
      }
    });
    window.__timeChart = charts.groupOverTime;
  }
}

/* ========== 8 (7+off) emotions stacked ========== */
function renderEmo7OverTime(data, step) {
  const maxT = Math.max(0, ...data.map(r => Number(r.time) || 0));
  const ticks = [];
  for (let t = 0; t <= Math.ceil(maxT / step) * step; t += step) ticks.push(t);

  // label เป็นช่วงเวลา เช่น 0-10s, 10-20s ...
  const labels = ticks.map(t => `${t}-${t + step}s`);

// ---------- 10s: ค่าเฉลี่ย Confidence + แสดง Off-screen เป็นสัดส่วนเวลา ----------
if (step === 10) {
  const emo7 = ["happy","neutral","sad","angry","fearful","disgusted","surprised"];
  const emo8 = [...emo7, "off"];

  const perBin = ticks.map(t0 => {
    const rows = data.filter(r => Math.floor((Number(r.time) || 0) / step) * step === t0);

    let offCount = 0;
    const sum = Object.fromEntries(emo7.map(k => [k, 0]));
    const cnt = Object.fromEntries(emo7.map(k => [k, 0]));

    rows.forEach(r => {
      const e = (r.emotion || "").toLowerCase();
      const isOff = e === "not_in_frame" || r.behavior?.includes("ไม่อยู่หน้าจอ");
      if (isOff) { offCount++; return; }

      if (!emo7.includes(e)) return;
      let conf = Number(r.confidence);
      if (!Number.isFinite(conf)) return;
      if (conf <= 1) conf *= 100;                 
      conf = Math.max(0, Math.min(100, conf));    
      sum[e] += conf; cnt[e] += 1;
    });

    const avg = emo7.map(k => (cnt[k] ? sum[k] / cnt[k] : 0));
    const offPct = rows.length ? (offCount / rows.length) * 100 : 0;  
    return [...avg, offPct];
  });

  // datasets: ใส่ความหนาที่ระดับ dataset (เฉพาะ 10s)
  const datasets = emo8.map((k, idx) => ({
    label: EMO_LABELS[k],
    data: perBin.map(arr => Number(arr[idx].toFixed(2))),
    backgroundColor: k === "off" ? RGBA(PAL.off, 0.95) : RGBA(PAL[k], 0.85),
    borderColor:     k === "off" ? RGBA(PAL.off, 1)    : RGBA(PAL[k], 1),
    borderWidth:     k === "off" ? 0 : 1,
    borderRadius:    6,
    // ความหนาแท่งเฉพาะ 10s
    maxBarThickness: 40,     // จำกัดความหนาสูงสุด
    grouped: false,          // ทุก dataset ใช้ slot เดียวกัน
  }));

  charts.emo7OverTime?.destroy();
  charts.emo7OverTime = new Chart($("#emo7OverTime").getContext("2d"), {
    type: "bar",
    data: { labels: ticks.map(t => `${t}s`), datasets },
    options: {
      animation: window.__EXPORTING__ ? false : { duration: 600, easing: "easeOutQuart" }, 
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 14, boxHeight: 14 } },
        title: { display: true, text: "ค่าเฉลี่ยความมั่นใจ (Confidence) ต่อช่วง 10 วินาที" }
      },
      scales: {
        x: { stacked: false, title: { display: true, text: "ช่วงเวลา (ความกว้างช่วงละ 10 วินาที)" } },
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" }, title: { display: true, text: "ค่า (%)" } }
      }
    }
  });
  window.__emo7Chart = charts.emo7OverTime; 
  return;
}

  // ---------- โหมด 30s/60s: Stacked % ----------
  // ในช่วง 30s/60s จะเน้น "สัดส่วนการปรากฏ" ของแต่ละอารมณ์ (% ต่อช่วง) รวมถึง Off-screen
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
    data: { labels, datasets },
    options: {
      animation: window.__EXPORTING__ ? false : { duration: 600, easing: "easeOutQuart" },
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 14, boxHeight: 14 } },
        title: { display: true, text: `อารมณ์ทั้งหมด (สัดส่วน % ต่อช่วง ${step}s)` }
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: `ช่วงเวลา (ความกว้างช่วงละ ${step} วินาที)` }
        },
        y: {
          stacked: true, beginAtZero: true, max: 100,
          ticks: { callback: v => v + "%" },
          title: { display: true, text: "สัดส่วน (%)" }
        }
      }
    }
  });
}

/* ========== glue ========== */
function renderAll() {
  const step = stepFromZoom(currentZoom);
  const data = allData.slice(); // รวมทุกคน
  renderOverview(data, step);
  if ($("#motionsView").classList.contains("view-active")) {
    renderEmo7OverTime(data, step);
  }
  setActiveZoomButtons();
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
    renderEmo7OverTime(allData.slice(), stepFromZoom(currentZoom));
    setActiveZoomButtons();
  });

  $("#zoom1Btn").addEventListener("click", () => { currentZoom = 1; renderAll(); });
  $("#zoom2Btn").addEventListener("click", () => { currentZoom = 2; renderAll(); });
  $("#zoom3Btn").addEventListener("click", () => { currentZoom = 3; renderAll(); });

  document.addEventListener("click", (e) => {
    const id = e.target?.dataset?.dl;
    if (id) downloadCanvasPNG(id);
  });

  // ===== Modal helpers for "Student Name" =====
  const nameModal = document.getElementById("nameModal");
  const nameBackdrop = document.getElementById("nameModalBackdrop");
  const studentNameInput = document.getElementById("studentName");
  const confirmNameBtn = document.getElementById("confirmNameBtn");
  const nameError = document.getElementById("nameError");

  function openNameModal(prefill = "") {
    return new Promise((resolve) => {
      // เปิด
      nameBackdrop.hidden = false;
      nameModal.hidden = false;
      nameBackdrop.setAttribute("open", "");
      nameModal.setAttribute("open", "");

      // เติมค่าที่เคยใช้
      studentNameInput.value = prefill || "";
      nameError.hidden = true;

      // โฟกัส input
      setTimeout(() => studentNameInput.focus(), 0);

      const closeModal = () => {
        nameBackdrop.hidden = true;
        nameModal.hidden = true;
        nameBackdrop.removeAttribute("open");
        nameModal.removeAttribute("open");
        // cleanup listener
        confirmNameBtn.removeEventListener("click", onConfirm);
        document.removeEventListener("keydown", onKey);
        document.querySelectorAll("[data-close-name-modal]").forEach(btn => {
          btn.removeEventListener("click", onCancel);
        });
      };

      const sanitizeFileName = (name) => {
        return (name || "")
          .trim()
          .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
          .replace(/\s+/g, "_")                      
          .slice(0, 60);
      };

      const onConfirm = () => {
        const value = sanitizeFileName(studentNameInput.value);
        if (!value || value.length === 0) {
          nameError.hidden = false;
          return;
        }
        nameError.hidden = true;
        closeModal();
        resolve(value);
      };

      const onCancel = () => {
        closeModal();
        resolve(null);
      };

      const onKey = (e) => {
        if (e.key === "Enter") onConfirm();
        if (e.key === "Escape") onCancel();
      };

      confirmNameBtn.addEventListener("click", onConfirm);
      document.addEventListener("keydown", onKey);
      document.querySelectorAll("[data-close-name-modal]").forEach(btn => {
        btn.addEventListener("click", onCancel);
      });
      // คลิกฉากหลังเพื่อปิด
      nameBackdrop.addEventListener("click", onCancel, { once: true });
    });
  }

  // ===== Download CSV with pretty modal for name =====
  document.getElementById("downloadCsvBtn").addEventListener("click", async () => {
    // เปิดโมดัลถามชื่อ 
    const prev = localStorage.getItem("ca_student_name") || "";
    const safeName = await openNameModal(prev);
    if (safeName === null) return; // กดยกเลิก

    // จำชื่อไว้ใช้คราวหน้า
    localStorage.setItem("ca_student_name", safeName);

    // โหลด CSV 
    const res = await fetch(`${API_BASE}/api/snapshots`, { cache: "no-store" });
    let text = await res.text();

    // ปรับบรรทัดเป็น CRLF ให้ Excel/Windows
    text = text.replace(/\r?\n/g, "\r\n");

    // ทำ timestamp
    const dt = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}_${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;

    const filename = `emotion_snapshots_${safeName}_${stamp}.csv`;

    // ใส่ BOM กันภาษาไทยเพี้ยน
    const bom = "\uFEFF";
    const blob = new Blob([bom, text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

bindUI();
loadSnapshots();

// ปิดแอนิเมชันชั่วคราวให้กราฟ Chart.js ที่มีอยู่ แล้วคืนค่าเมื่อเรียกฟังก์ชันที่ส่งกลับ
function disableChartAnimationTemporarily(charts) {
  const prev = new Map();
  charts.forEach(c => {
    if (!c) return;
    prev.set(c, c.options.animation);
    c.options.animation = false;     // ปิดแอนิเมชัน
    c.update('none');                // v4: โหมดต้องเป็นสตริง
  });
  // คืนค่า
  return () => {
    charts.forEach(c => {
      if (!c) return;
      c.options.animation = prev.get(c);
       c.update();                  // วาดคืนปกติ
    });
  };
}

// ตั้งชื่อไฟล์ PDF 
function makePdfName() {
  const chip = document.getElementById("uploadedCsvName");
  let base = "summary";
  if (chip && !chip.hidden) {
    base = (chip.textContent.split("ใช้ข้อมูลจาก: ").pop() || "summary");
  }
  base = base.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").replace(/\s+/g, "_");

  const d = new Date(), pad = n => String(n).padStart(2,"0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${base}_${stamp}.pdf`;
}

// =========== PDF Export (รวม 10/30/60 วินาที) ===========
async function downloadSummaryPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let saved = false; // บอกสถานะว่าบันทึกไฟล์สำเร็จไหม

  let prevGlobalAnim;
  let restoreInstances;

  try {
    // เปิดโหมด export (ปิดแอนิเมชันทั้งระบบ)
    window.__EXPORTING__ = true;
    prevGlobalAnim = Chart.defaults.animation;
    Chart.defaults.animation = false;

    // ปิดในอินสแตนซ์ที่มีอยู่แล้วด้วย 
    restoreInstances = disableChartAnimationTemporarily([
      window.__pieChart, window.__timeChart, window.__emo7Chart
    ]);

    // จับภาพ DOM (ข้อความไทยคมชัด) 
    const SNAP_SCALE = 3; //
    const snap = async (el) => {
      await new Promise(r => requestAnimationFrame(r)); // รอ 1 เฟรมให้ DOM/Canvas เสถียร
      const can = await html2canvas(el, { backgroundColor: "#ffffff", scale: SNAP_SCALE });
      return { url: can.toDataURL("image/png"), w: can.width, h: can.height, ratio: can.height / can.width };
    };
    const place = (img, x, y, wmm) => {
      const hmm = wmm * img.ratio;
      pdf.addImage(img.url, "PNG", x, y, wmm, hmm, undefined, "FAST");
      return hmm;
    };

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // ขอบ/ช่องไฟ — ลดลงเพื่อให้กราฟใหญ่ขึ้น
    const margin = 6;
    const gutter = 3;
    const contentW = pageW - margin * 2;
    const colW = (contentW - gutter) / 2;

    // KPI เต็มแถว
    const kpiImg = await snap(document.getElementById("kpiPanel"));

    // เตรียมภาพ 3 ช่วงเวลา 
    const zooms = [1, 2, 3];
    const rows = [];
    for (const z of zooms) {
      const showZ2 = document.getElementById("zoom2Btn").style.display !== "none";
      const showZ3 = document.getElementById("zoom3Btn").style.display !== "none";
      if ((z === 2 && !showZ2) || (z === 3 && !showZ3)) continue;

      currentZoom = z;

      // Overview
      document.getElementById("tabOverview").click();
      renderAll();
      const overviewImg = await snap(document.getElementById("overviewGrid"));

      // Emo7
      document.getElementById("tabMotions").click();
      renderEmo7OverTime(allData.slice(), stepFromZoom(currentZoom));
      const emo7Img = await snap(document.getElementById("cardEmo7"));

      rows.push({ z, overviewImg, emo7Img });
    }

    // วางเลย์เอาต์หน้าเดียว: KPI + (Overview|Emo7) x จำนวนช่วง
    const maxRows = rows.length;
    // สูงของ KPI: จำกัดช่วง 18–28mm แล้ว “เหลือพื้นที่ให้กราฟก่อน”
    let kpiHmm = Math.min(28, contentW * (kpiImg.h / kpiImg.w));
    kpiHmm = Math.max(18, kpiHmm);

    // ต้องการให้กราฟอย่างน้อย 50mm ต่อแถว
    const MIN_ROW = 50;
    const availableForRows = pageH - margin * 2 - kpiHmm - (maxRows - 1) * gutter;
    let rowHmm = availableForRows / Math.max(1, maxRows);

    // ถ้าต่ำกว่า MIN_ROW ให้หด KPI ลง 
    if (rowHmm < MIN_ROW) {
      const need = (MIN_ROW * maxRows + (maxRows - 1) * gutter) - (pageH - margin * 2);
      kpiHmm = Math.max(14, kpiHmm - need);
      rowHmm = (pageH - margin * 2 - kpiHmm - (maxRows - 1) * gutter) / Math.max(1, maxRows);
    }

    let y = margin;

    // KPI
    place(kpiImg, margin, y, contentW);
    y += kpiHmm + gutter;

    // แถวละ 2 คอลัมน์
    for (const r of rows) {
      const xL = margin;
      const xR = margin + colW + gutter;

      // คำนวณสัดส่วนให้ไม่เกิน rowHmm
      const leftH  = colW * r.overviewImg.ratio;
      const rightH = colW * r.emo7Img.ratio;
      const scale = Math.min(rowHmm / Math.max(leftH, rightH), 1);
      const colScaled = colW * scale;

      const hL = place(r.overviewImg, xL, y, colScaled);
      const hR = place(r.emo7Img,    xR, y, colScaled);

      y += Math.max(hL, hR) + gutter;
    }

    // ตั้งชื่อไฟล์
    const chip = document.getElementById("uploadedCsvName");
    const base = (chip && !chip.hidden
      ? (chip.textContent.split("ใช้ข้อมูลจาก: ").pop() || "summary")
      : "summary").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").replace(/\s+/g, "_");
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    pdf.save(makePdfName());
    saved = true;
  } catch (err) {
    // ไม่แจ้งเตือนที่นี่ ปล่อยให้คนเรียกเป็นคนตัดสินใจ
    console.error("PDF export error:", err);
  } finally {
    // คืนค่ากราฟทุกตัว + global defaults เสมอ
    try { restoreInstances && restoreInstances(); } catch {}
   // ห้ามตั้งเป็น true (boolean) — ต้องเป็น object หรือ false
    Chart.defaults.animation =
      (prevGlobalAnim && typeof prevGlobalAnim === "object")
      ? prevGlobalAnim
      : { duration: 600, easing: "easeOutQuart" };
    window.__EXPORTING__ = false;
    [window.__pieChart, window.__timeChart, window.__emo7Chart].forEach(c => {
      if (!c) return;
      const prev = c.options.animation;
      c.options.animation = { duration: 600, easing: "easeOutQuart" };
      c.update();
      c.options.animation = prev;
    });
  }
  return saved;
}

// รอให้ DOM พร้อม แล้วค่อยผูกปุ่มดาวน์โหลด PDF
(function attachPdfHandlerOnce(){
  const onReady = (fn) =>
    (document.readyState !== "loading") ? fn() : document.addEventListener("DOMContentLoaded", fn);

  onReady(() => {
    const btn = document.getElementById("downloadPdfBtn");
    if (!btn) return;

    // กันกดซ้ำระหว่างทำงาน
    let busy = false;
    btn.addEventListener("click", async () => {
      if (busy) return;
      // ตรวจว่า jsPDF ถูกโหลดแล้วหรือยัง
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("ไม่สามารถโหลดไลบรารี jsPDF ได้\nตรวจการเชื่อมต่ออินเทอร์เน็ต หรือใช้ไฟล์แบบติดตั้งในเครื่อง");
        return;
      }
      try {
        busy = true;
        btn.disabled = true;
        btn.textContent = "กำลังสร้าง PDF…";
        const ok = await downloadSummaryPDF();  // ให้ฟังก์ชันคืนสถานะ
        if (!ok) {
          alert("เกิดข้อผิดพลาดระหว่างสร้าง PDF (ไฟล์อาจยังถูกสร้างบางส่วนแล้ว)\nลองกดอีกครั้ง หรือเช็คคอนโซลสำหรับรายละเอียด");
        }
      } finally {
        busy = false;
        btn.disabled = false;
        btn.textContent = "ดาวน์โหลด PDF";
      }
    });
  });
})();
