// ================== DOM ==================
const video = document.getElementById("myVideo");
const videoProgress = document.getElementById("videoProgress");
const currentTimeSpan = document.getElementById("currentTime");
const totalTimeSpan = document.getElementById("totalTime");
let canvas;

// ==== Toggle Video & Progress UI ====
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const processingCard = document.getElementById('processingCard');
const videoContainer = document.querySelector('.video-container');

const progressBar = document.getElementById('progressBar');
const percentText  = document.getElementById('percentText');
const elapsedEl    = document.getElementById('elapsed');
const durationEl   = document.getElementById('duration');

// ซ่อนวิดีโอเป็นค่าเริ่มต้น (ถ้าอยากให้แสดงเป็นค่าเริ่มต้น ให้เปลี่ยนเป็น true)
let isVideoVisible = false;

function setVideoVisible(show){
  isVideoVisible = !!show;
  if (isVideoVisible) {
    videoContainer.classList.remove('hidden');
    processingCard.classList.add('hidden');
    toggleVideoBtn.textContent = 'ซ่อนวิดีโอ';
  } else {
    videoContainer.classList.add('hidden');
    processingCard.classList.remove('hidden');
    toggleVideoBtn.textContent = 'แสดงวิดีโอ';
  }
}

// ปุ่มสลับ
if (toggleVideoBtn) {
  toggleVideoBtn.addEventListener('click', () => setVideoVisible(!isVideoVisible));
}

// ฟังก์ชันอัปเดตเปอร์เซ็นต์
function updateProgressUI(){
  const cur = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const dur = (Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;

  const pct = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0;
  if (progressBar) progressBar.style.width = pct + '%';
  if (percentText) percentText.textContent = (dur > 0 ? pct : 0) + '%';

  if (elapsedEl)  elapsedEl.textContent  = formatTime(cur);
  if (durationEl) durationEl.textContent = formatTime(dur);
}

// ตั้งค่าเริ่มต้น: ซ่อนวิดีโอ โชว์การ์ดเปอร์เซ็นต์
setVideoVisible(false);

// เพิ่มตัวแปรสำหรับ UI ใหม่
const fileNameEl = document.getElementById("fileName");
const liveTag = document.getElementById("liveTag");

// helper set สถานะ live
function setLive(state) {
  if (!liveTag) return;
  // state: 'live' | 'offline' | 'connecting'
  liveTag.dataset.state = state;
  liveTag.textContent =
    state === "live" ? "Live" : state === "offline" ? "Offline" : "Connecting…";
}

// เมื่อเลือกไฟล์ แสดงชื่อไฟล์บน toolbar
const fileInputEl = document.getElementById("videoUpload");
if (fileInputEl && fileNameEl) {
  fileInputEl.addEventListener("change", () => {
    fileNameEl.textContent = fileInputEl.files[0]
      ? fileInputEl.files[0].name
      : "ยังไม่เลือกไฟล์";
  });
}

// ===== Snapshot-driven progress =====
const SNAP_INTERVAL_SEC = 10;               // ถ้าเปลี่ยนช่วงเก็บสแนป ปรับค่านี้
const snapCountEl = document.getElementById('snapCount');

let expectedSnapshots = 0;                  // Y
let savedSnapshots = 0;                     // X

function computeExpectedSnapshots() {
  // เก็บที่ 10 วิ, จุดแรกเริ่มที่ 10 วินาที: 10,20,30,...
  // ดังนั้นจำนวนที่คาด = floor(duration / 10)
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  expectedSnapshots = Math.max(0, Math.floor(dur / SNAP_INTERVAL_SEC));
}

function updateProgressFromSnapshots() {
  // เปอร์เซ็นต์คิดจาก X/Y; ถ้า Y=0 ให้เป็น 0%
  const pct = expectedSnapshots > 0
    ? Math.min(100, Math.round((savedSnapshots / expectedSnapshots) * 100))
    : 0;

  if (progressBar)  progressBar.style.width = pct + '%';
  if (percentText)  percentText.textContent = pct + '%';
  if (snapCountEl)  snapCountEl.textContent = `${savedSnapshots}/${expectedSnapshots}`;
}

// --- ผูกกับ metadata ของวิดีโอ เพื่อคำนวณ Y ---
video.addEventListener("loadedmetadata", () => {
  expectedSnapshots = Math.max(0, Math.floor((video.duration || 0) / SNAP_INTERVAL_SEC));
  durationEl && (durationEl.textContent = formatTime(video.duration || 0));
  updateProgressFromSnapshots();   // แสดง 0/Y
});

// --- เมื่อเวลาเดิน ให้แสดง elapsed (ส่วนเปอร์เซ็นต์ใช้สแนปขับเคลื่อน) ---
video.addEventListener('timeupdate', () => {
  elapsedEl && (elapsedEl.textContent = formatTime(video.currentTime || 0));
});


// === Debug Snapshot Panel ===
const debugPanel = document.getElementById("debugPanel");
const toggleDebugBtn = document.getElementById("toggleDebugBtn");
const clearDebugBtn = document.getElementById("clearDebugBtn");
const snapshotContainer = document.getElementById("snapshotContainer");

if (toggleDebugBtn)
  toggleDebugBtn.onclick = () => debugPanel.classList.toggle("hidden");
if (clearDebugBtn)
  clearDebugBtn.onclick = () => {
    if (snapshotContainer) snapshotContainer.innerHTML = "";
  };

const MAX_SNAPSHOTS = 24;
const deg = (x) =>
  x === undefined || x === null || x === "" ? "-" : `${Number(x).toFixed(1)}°`;

function addSnapshotCard(info) {
  if (!snapshotContainer) return;
  const card = document.createElement("div");
  card.className = "snapshot-card";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = info.imgSrc;
  card.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "snapshot-meta";
  meta.innerHTML = `
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

  snapshotContainer.prepend(card); // โชว์รายการล่าสุดไว้บนสุด
  while (snapshotContainer.children.length > MAX_SNAPSHOTS) {
    snapshotContainer.lastChild.remove();
  }
}

// ================== โหลดโมเดล face-api ==================
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
]).then(startVideoUpload);

// ================== Utils ==================
function formatTime(sec) {
  if (isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

video.addEventListener("loadedmetadata", () => {
  const container = document.querySelector(".video-container");
  container.style.width = video.videoWidth + "px";
  container.style.height = video.videoHeight + "px";
  video.width = video.videoWidth;
  video.height = video.videoHeight;
  if (canvas) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.style.width = video.videoWidth + "px";
    canvas.style.height = video.videoHeight + "px";
  }
});

video.addEventListener("timeupdate", () => {
  videoProgress.value = video.currentTime;
  currentTimeSpan.textContent = formatTime(video.currentTime);
});

const GROUP_LABELS = [
  "บวก (Positive)",
  "กลาง (Neutral)",
  "ลบ (Negative)",
  "ไม่อยู่หน้าจอ",
];
const EMO_GROUP = {
  neutral: "กลาง (Neutral)",
  sad: "ลบ (Negative)",
  fearful: "ลบ (Negative)",
  disgusted: "ลบ (Negative)",
  angry: "ลบ (Negative)",
  happy: "บวก (Positive)",
  surprised: "บวก (Positive)",
};

function toGroup(row) {
  if (row.emotion && row.emotion.trim() !== "")
    return EMO_GROUP[row.emotion.trim()] || "กลาง (Neutral)";
  if (row.behavior === "ไม่อยู่หน้าจอ") return "ไม่อยู่หน้าจอ";
  return "กลาง (Neutral)";
}

let lineChart, pieChart;
let lineX = []; // เวลา (วินาที)
let lineYLabels = []; // ชื่อกลุ่มอารมณ์ (สตริง)
let pieCounts = {
  "บวก (Positive)": 0,
  "กลาง (Neutral)": 0,
  "ลบ (Negative)": 0,
  "ไม่อยู่หน้าจอ": 0,
};

function initCharts() {
  const lctx = document.getElementById("emotionLineChart").getContext("2d");
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(lctx, {
    type: "line",
    data: {
      labels: lineX,
      datasets: [
        {
          label: "กลุ่มอารมณ์",
          data: lineYLabels, // <-- ใช้สตริง
          borderColor: "rgba(75, 192, 192, 1)",
          pointBackgroundColor: "rgba(75, 192, 192, 1)",
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 6,
          tension: 0.1,
          stepped: true,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "การเปลี่ยนแปลงอารมณ์ตามเวลา (Zoom x1)" },
      },
      scales: {
        x: { title: { display: true, text: "เวลา (วินาที)" } },
        y: {
          type: "category",
          labels: GROUP_LABELS,
          title: { display: true, text: "กลุ่มอารมณ์" },
        },
      },
    },
  });

  const pctx = document.getElementById("emotionPieChart").getContext("2d");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pctx, {
    type: "pie",
    data: {
      labels: GROUP_LABELS,
      datasets: [
        {
          data: GROUP_LABELS.map((lbl) => pieCounts[lbl]),
          backgroundColor: [
            "rgba(46,204,113,0.9)", // บวก
            "rgba(149,165,166,0.9)", // กลาง
            "rgba(231,76,60,0.9)", // ลบ
            "rgba(52,73,94,0.9)", // ไม่อยู่หน้าจอ
          ],
          borderColor: [
            "rgba(46,204,113,1)",
            "rgba(149,165,166,1)",
            "rgba(231,76,60,1)",
            "rgba(52,73,94,1)",
          ],
          borderWidth: 2,
          hoverOffset: 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "สัดส่วนอารมณ์โดยรวม" },
      },
    },
  });
}

function pushSnapshot(row) {
  const t = Number(row.time || 0);
  const g = toGroup(row); // ได้ชื่อกลุ่ม (สตริง)

  lineX.push(t);
  lineYLabels.push(g); // <-- เก็บสตริงเหมือน summary
  if (lineX.length > 300) {
    lineX.shift();
    lineYLabels.shift();
  }

  pieCounts[g] = (pieCounts[g] || 0) + 1;

  lineChart.data.labels = lineX;
  lineChart.data.datasets[0].data = lineYLabels; // <-- อัปเดตด้วยสตริง
  lineChart.update();

  pieChart.data.datasets[0].data = GROUP_LABELS.map((lbl) => pieCounts[lbl]);
  pieChart.update();
}

// ====== bootstrap: โหลดข้อมูลเดิม + ต่อ SSE ======
(async function bootstrapRealtime() {
  initCharts();

  // เติมจาก CSV ครั้งแรก
  const txt = await (await fetch("http://127.0.0.1:5000/api/snapshots")).text();
  txt
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .forEach((line) => {
      const [
        timestamp,
        time,
        emotion,
        confidence,
        behavior,
        eye_status,
        pitch,
        yaw,
        roll,
      ] = line.split(",");
      pushSnapshot({
        timestamp,
        time,
        emotion,
        confidence,
        behavior,
        eye_status,
        pitch,
        yaw,
        roll,
      });
    });
})();

// ================== ตรวจจับ + ส่ง snapshot ทุก 10 วิ ==================
function startVideoUpload() {
  const videoUpload = document.getElementById("videoUpload");
  const snapshotContainer = document.getElementById("snapshotContainer");
  let canvas;

  videoUpload.addEventListener("change", async () => {
  const file = videoUpload.files[0];
  if (!file) return;

  // 1) รีเซ็ตตัวนับ/กราฟ/สถานะ
  savedSnapshots = 0;
  expectedSnapshots = 0;          // ให้เป็น 0 ไปก่อน เดี๋ยวคำนวณใหม่ตอน loadedmetadata
  updateProgressFromSnapshots();  // อัปเดตแถบ % (0/0 → 0%)

  // เคลียร์กราฟ
  lineX.length = 0;
  lineYLabels.length = 0;
  pieCounts = { "บวก (Positive)":0, "กลาง (Neutral)":0, "ลบ (Negative)":0, "ไม่อยู่หน้าจอ":0 };
  lineChart.update();
  pieChart.data.datasets[0].data = GROUP_LABELS.map(() => 0);
  pieChart.update();

  // 2) ล้าง CSV สำหรับรอบใหม่นี้ (สำคัญ: await ให้เสร็จก่อนเล่นคลิป)
  await fetch("http://127.0.0.1:5000/api/clear_snapshots", { method: "POST" });

  // 3) โหลดและเล่นคลิป
  video.src = URL.createObjectURL(file);
  video.load();
  // (ไม่ต้อง computeExpectedSnapshots() ที่นี่ก็ได้ เพราะ duration ยังไม่รู้)
  // เดี๋ยวคำนวณ Y เมื่อได้เมตาดาต้าของคลิป:
  //   video.addEventListener('loadedmetadata', computeExpectedSnapshots);
  video.play().catch((err) => console.error("ไม่สามารถเล่นวิดีโอ:", err));
});

  function getEAR(eye) {
    const A = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const B = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const C = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (A + B) / (2.0 * C);
  }

  function startDetection() {
    function resizeCanvasToVideo() {
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.style.width = video.videoWidth + "px";
      canvas.style.height = video.videoHeight + "px";
    }

    video.addEventListener("loadedmetadata", resizeCanvasToVideo);
    video.addEventListener("resize", resizeCanvasToVideo);

    canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector(".video-container").appendChild(canvas);
    resizeCanvasToVideo();

    let lastSnapshotSec = -1;
    let isFetching = false;

    async function onFrame() {
      try {
        if (video.paused || video.ended) {
          requestAnimationFrame(onFrame);
          return;
        }

        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 512,
              scoreThreshold: 0.3,
            })
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        const displaySize = {
          width: video.videoWidth,
          height: video.videoHeight,
        };
        faceapi.matchDimensions(canvas, displaySize);
        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections, {
          withScore: false,
        });
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections, {
          minConfidence: 0.1,
          fontSize: 14,
        });

        const nowSec = Math.floor(video.currentTime);

        // ไม่มีใบหน้า
        if (resizedDetections.length === 0) {
          if (nowSec % 10 === 0 && nowSec !== lastSnapshotSec && nowSec >= 10) {
            lastSnapshotSec = nowSec;
            const sw = video.videoWidth,
              sh = video.videoHeight;
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = sw;
            tempCanvas.height = sh;
            tempCanvas.getContext("2d").drawImage(video, 0, 0, sw, sh);

            // ส่งไป backend เพื่อบันทึก CSV (emotion เว้นว่าง + behavior ไม่อยู่หน้าจอ)
            const imgSrc = tempCanvas.toDataURL("image/png");
            isFetching = true;
            fetch("http://127.0.0.1:5000/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: imgSrc,
                time: nowSec,
                emotion: "",
                confidence: "",
                behavior: "ไม่อยู่หน้าจอ",
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                addSnapshotCard({
                  imgSrc,
                  time: nowSec,
                  emotion: "",
                  confidence: "",
                  behavior: data.behavior,
                  eye_status: data.eye_status,
                  roll: data.roll,
                  pitch: data.pitch,
                  yaw: data.yaw,
                });
              })
              .finally(() => {
                isFetching = false;
              });
          }
        }

        // มีใบหน้า
        resizedDetections.forEach((detection) => {
          const box = detection.detection.box;

          // ข้ามการคำนวณมุมแบบละเอียดในหน้า index (ให้ backend วิเคราะห์)
          const nowSec2 = Math.floor(video.currentTime);
          if (
            nowSec2 % 10 === 0 &&
            nowSec2 !== lastSnapshotSec &&
            !isFetching &&
            nowSec2 >= 10
          ) {
            lastSnapshotSec = nowSec2;

            const sw = 500,
              sh = 600;
            const sx = Math.max(0, box.x + box.width / 2 - sw / 2);
            const sy = Math.max(0, box.y + box.height / 2 - sh / 2);
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = sw;
            tempCanvas.height = sh;
            tempCanvas
              .getContext("2d")
              .drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

            // เลือกอารมณ์หลักจาก face-api
            const sorted = Object.entries(detection.expressions || {}).sort(
              (a, b) => b[1] - a[1]
            );
            const [mainEmotion, mainScore] = sorted[0] || ["neutral", 0];

            const imgSrc = tempCanvas.toDataURL("image/png");
            isFetching = true;
            fetch("http://127.0.0.1:5000/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: imgSrc,
                time: nowSec2,
                emotion: mainEmotion,
                confidence: mainScore,
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                addSnapshotCard({
                  imgSrc,
                  time: nowSec2,
                  emotion: mainEmotion,
                  confidence: mainScore,
                  behavior: data.behavior,
                  eye_status: data.eye_status,
                  roll: data.roll,
                  pitch: data.pitch,
                  yaw: data.yaw,
                });
              })
              .finally(() => {
                isFetching = false;
              });
          }
        });
      } catch (err) {
        console.error("❌ onFrame error:", err);
        isFetching = false;
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

  // ===== สร้างกราฟ + โหลดข้อมูลเดิม + เชื่อม SSE สำหรับอัปเดตสด =====
  (async function bootstrapCharts() {
    initCharts();
    const res = await fetch("http://127.0.0.1:5000/api/snapshots");
    const csvText = await res.text();
    const rows = csvText.split("\n").slice(1).filter(Boolean);
    savedSnapshots = rows.length;          // <== X จาก CSV
    updateProgressFromSnapshots();         // อัปเดต %/แถบ/ตัวนับ
    rows.forEach((line) => {
      const [
        timestamp,
        time,
        emotion,
        confidence,
        behavior,
        eye_status,
        pitch,
        yaw,
        roll,
      ] = line.split(",");
      pushSnapshot({
        timestamp,
        time,
        emotion,
        confidence,
        behavior,
        eye_status,
        pitch,
        yaw,
        roll,
      });
    });
    // ต่อ SSE
    setLive("connecting");
    const es = new EventSource("http://127.0.0.1:5000/api/stream");
    es.onopen = () => setLive("live");
    es.onerror = () => setLive("offline");
    es.onmessage = (evt) => {
      try {
        pushSnapshot(JSON.parse(evt.data));
        pushSnapshot(row);          // วาดกราฟ
        savedSnapshots += 1;        // นับสแนปเพิ่ม
        updateProgressFromSnapshots();
      } catch (e) {}
    };
  })();
}
