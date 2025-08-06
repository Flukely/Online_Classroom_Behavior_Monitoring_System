// ================== ตัวแปร DOM ==================
const video = document.getElementById("myVideo");
const videoProgress = document.getElementById("videoProgress");
const currentTimeSpan = document.getElementById("currentTime");
const totalTimeSpan = document.getElementById("totalTime");
let canvas;

// ================== โหลดโมเดล face-api ==================
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
]).then(startVideoUpload);

// ================== ฟังก์ชันแปลงเวลา ==================
function formatTime(sec) {
  if (isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ================== UI เวลา ==================
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

function plotChartsFromCSV(data) {
  const groupMap = {
    neutral: "กลาง (Neutral)",
    sad: "ลบ (Negative)",
    fearful: "ลบ (Negative)",
    disgusted: "ลบ (Negative)",
    angry: "ลบ (Negative)",
    happy: "บวก (Positive)",
    surprised: "บวก (Positive)",
  };
  const outScreenLabel = "ไม่อยู่หน้าจอ";

  const timeLabels = [];
  const groupLabels = [];
  for (const row of data) {
    if (row.emotion && row.emotion.trim() !== "") {
      let group = groupMap[row.emotion.trim()] || "กลาง (Neutral)";
      groupLabels.push(group);
    } else if (row.behavior === outScreenLabel) {
      groupLabels.push(outScreenLabel);
    } else {
      groupLabels.push("กลาง (Neutral)");
    }
    timeLabels.push(row.time || "");
  }

  const count = {
    "บวก (Positive)": 0,
    "กลาง (Neutral)": 0,
    "ลบ (Negative)": 0,
    [outScreenLabel]: 0,
  };
  for (const group of groupLabels) {
    if (count[group] !== undefined) count[group]++;
    else count["กลาง (Neutral)"]++;
  }
  const total = groupLabels.length || 1;

  let yLabels = [
    "บวก (Positive)",
    "กลาง (Neutral)",
    "ลบ (Negative)",
    outScreenLabel,
  ];

  // Line Chart
  const lineCtx = document.getElementById("emotionLineChart").getContext("2d");
  if (window.lineChart) window.lineChart.destroy();
  window.lineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: timeLabels,
      datasets: [
        {
          label: "กลุ่มอารมณ์",
          data: groupLabels,
          borderColor: "rgba(75, 192, 192, 1)",
          tension: 0.1,
          stepped: true,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: "rgba(75, 192, 192, 1)",
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "การเปลี่ยนแปลงอารมณ์ตามเวลา",
          font: { size: 18, weight: "bold" },
          padding: { top: 10, bottom: 20 },
          color: "#2c3e50",
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "เวลา (วินาที)",
            font: { size: 14, weight: "bold" },
            color: "#2c3e50",
          },
        },
        y: {
          type: "category",
          labels: yLabels,
          title: {
            display: true,
            text: "กลุ่มอารมณ์",
            font: { size: 14, weight: "bold" },
            color: "#2c3e50",
          },
        },
      },
    },
  });

  // Pie Chart
  const pieCtx = document.getElementById("emotionPieChart").getContext("2d");
  if (window.pieChart) window.pieChart.destroy();
  window.pieChart = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: yLabels,
      datasets: [
        {
          data: yLabels.map((lbl) => (count[lbl] / total) * 100),
          backgroundColor: [
            "rgba(46, 204, 113, 0.9)",
            "rgba(149, 165, 166, 0.9)",
            "rgba(231, 76, 60, 0.9)",
            "rgba(52, 73, 94, 0.9)", // สำหรับ 'ไม่อยู่หน้าจอ'
          ],
          borderColor: [
            "rgba(46, 204, 113, 1)",
            "rgba(149, 165, 166, 1)",
            "rgba(231, 76, 60, 1)",
            "rgba(52, 73, 94, 1)",
          ],
          borderWidth: 2,
          hoverOffset: 15,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 14, weight: "bold" },
            color: "#2c3e50",
          },
        },
        title: {
          display: true,
          text: "สัดส่วนอารมณ์โดยรวม",
          font: { size: 18, weight: "bold" },
          padding: { top: 10, bottom: 20 },
          color: "#2c3e50",
        },
      },
    },
  });
}

function startVideoUpload() {
  const videoUpload = document.getElementById("videoUpload");
  const snapshotContainer = document.getElementById("snapshotContainer");
  let canvas;

  fetch("http://127.0.0.1:5000/api/clear_snapshots", { method: "POST" });
  videoUpload.addEventListener("change", () => {
    const file = videoUpload.files[0];
    if (file) {
      video.src = URL.createObjectURL(file);
      video.load();
      video.play().catch((err) => console.error("ไม่สามารถเล่นวิดีโอ:", err));
    }
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

    const earHistory = {};
    const HISTORY_LENGTH = 5;
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

        // ปิด snapshot ที่วินาที 0 และเริ่มที่วินาที 10
        if (resizedDetections.length === 0) {
          if (nowSec % 10 === 0 && nowSec !== lastSnapshotSec && nowSec >= 10) {
            lastSnapshotSec = nowSec;
            // ไม่ต้อง push emotionResults เพราะใช้ CSV แล้ว
            // 1. สร้าง tempCanvas ขนาดเต็มวิดีโอ (หรือขนาดที่ต้องการ)
            const sw = video.videoWidth;
            const sh = video.videoHeight;
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = sw;
            tempCanvas.height = sh;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.drawImage(video, 0, 0, sw, sh);

            // 2. แสดงใน snapshotContainer
            const snapshotWrapper = document.createElement("div");
            const img = document.createElement("img");
            img.src = tempCanvas.toDataURL("image/png");
            img.className = "snapshot";
            snapshotWrapper.appendChild(img);

            const infoDiv = document.createElement("div");
            infoDiv.innerHTML = `<b>ไม่อยู่หน้าจอ</b> <br>Time: ${nowSec}s`;
            snapshotWrapper.appendChild(infoDiv);

            document
              .getElementById("snapshotContainer")
              .appendChild(snapshotWrapper);

            // 3. ส่งข้อมูลไป backend (สามารถส่งรูป หรือไม่ส่งก็ได้)
            isFetching = true;
            fetch("http://127.0.0.1:5000/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: tempCanvas.toDataURL("image/png"), // จะส่งรูปเฟรมว่างด้วยก็ได้
                time: nowSec,
                emotion: "",
                confidence: "",
                behavior: "ไม่อยู่หน้าจอ",
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                // (จะโชว์ result backend เพิ่มก็ได้)
                isFetching = false;
              })
              .catch((err) => {
                isFetching = false;
              });
          }
        }
        resizedDetections.forEach((detection, i) => {
          const box = detection.detection.box;
          const landmarks = detection.landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const nose = landmarks.getNose();
          const jaw = landmarks.getJawOutline();

          const dy = rightEye[0].y - leftEye[0].y;
          const dx = rightEye[0].x - leftEye[0].x;
          const roll = (Math.atan2(dy, dx) * 180) / Math.PI;

          const noseTip = nose[3];
          const chin = jaw[8];
          const pitch =
            (Math.atan2(chin.y - noseTip.y, chin.x - noseTip.x) * 180) /
            Math.PI;

          const midEyeX = (leftEye[3].x + rightEye[0].x) / 2;
          const yaw =
            (Math.atan2(
              noseTip.x - midEyeX,
              noseTip.y - (leftEye[3].y + rightEye[0].y) / 2
            ) *
              180) /
            Math.PI;

          const avgEAR = (getEAR(leftEye) + getEAR(rightEye)) / 2;
          const isClosed = avgEAR < 0.18;

          let posture = "Look straight";
          if (pitch >= 94 && pitch <= 95) posture = "ก้มหน้า";
          else if (pitch >= 89 && pitch <= 90) posture = "เงยหน้า";
          else if (yaw >= 29 && yaw <= 31) posture = "หันซ้าย";
          else if (yaw >= -27 && yaw <= -25) posture = "หันขวา";
          else if (roll >= 39 && roll <= 41) posture = "เอียงซ้าย";
          else if (roll >= -29 && roll <= -27) posture = "เอียงขวา";

          const drawText = (text, x, y) => {
            ctx.strokeStyle = "black";
            ctx.fillStyle = "white";
            ctx.lineWidth = 2;
            ctx.font = "bold 14px Arial";
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
          };

          drawText(
            `Eye: ${isClosed ? "หลับตา" : "ลืมตา"}`,
            box.x,
            box.y + box.height + 20
          );
          drawText(`Posture: ${posture}`, box.x, box.y + box.height + 40);

          const nowSec = Math.floor(video.currentTime);
          if (
            nowSec % 10 === 0 &&
            nowSec !== lastSnapshotSec &&
            !isFetching &&
            nowSec >= 10
          ) {
            lastSnapshotSec = nowSec;

            const sw = 500,
              sh = 600;
            const sx = Math.max(0, box.x + box.width / 2 - sw / 2);
            const sy = Math.max(0, box.y + box.height / 2 - sh / 2);

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = sw;
            tempCanvas.height = sh;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

            const snapshotWrapper = document.createElement("div");
            const img = document.createElement("img");
            img.src = tempCanvas.toDataURL("image/png");
            img.className = "snapshot";
            snapshotWrapper.appendChild(img);

            const sorted = Object.entries(detection.expressions || {}).sort(
              (a, b) => b[1] - a[1]
            );
            const [mainEmotion, mainScore] = sorted[0] || ["neutral", 0];
            const emotionDiv = document.createElement("div");
            emotionDiv.innerHTML = `อารมณ์: ${mainEmotion} (${(
              mainScore * 100
            ).toFixed(1)}%)`;
            snapshotWrapper.appendChild(emotionDiv);

            isFetching = true;

            fetch("http://127.0.0.1:5000/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: tempCanvas.toDataURL("image/png"),
                time: nowSec,
                emotion: mainEmotion,
                confidence: mainScore,
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                const analysisDiv = document.createElement("div");
                analysisDiv.innerHTML = `
                  <b>วิเคราะห์จาก Backend:</b><br>
                  ท่าทาง: ${data.behavior}<br>
                  สถานะตา: ${data.eye_status}<br>
                  Roll: ${data.roll?.toFixed(1)}°<br>
                  Pitch: ${data.pitch?.toFixed(1)}°<br>
                  Yaw: ${data.yaw?.toFixed(1)}°`;
                snapshotWrapper.appendChild(analysisDiv);
                isFetching = false;
              })
              .catch((err) => {
                console.error("❌ fetch error:", err);
                isFetching = false;
              });

            snapshotContainer.appendChild(snapshotWrapper);
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
}

// ฟังก์ชันโหลดข้อมูลและ plot กราฟ (เรียกเมื่อ load หน้าเว็บหรือกดปุ่ม refresh)
async function loadSnapshotsAndPlot() {
  const res = await fetch("http://127.0.0.1:5000/api/snapshots");
  const csvText = await res.text();
  const rows = csvText.split("\n").slice(1).filter(Boolean); // ข้าม header
  const data = rows.map((row) => {
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
    ] = row.split(",");
    return {
      timestamp,
      time,
      emotion,
      confidence,
      behavior,
      eye_status,
      pitch,
      yaw,
      roll,
    };
  });

  // เรียก plotChartsFromCSV เพื่ออัปเดตกราฟ
  plotChartsFromCSV(data);
}

// ตัวอย่าง: auto refresh เมื่อเข้าเว็บ
window.onload = function () {
  loadSnapshotsAndPlot();
};

// ตัวอย่าง: ถ้ามีปุ่ม refresh
document.getElementById("reloadChartBtn").onclick = loadSnapshotsAndPlot;

window.addEventListener("beforeunload", () => {
  console.log("!! PAGE RELOAD !!");
});

// ปุ่มล้างข้อมูล snapshot ทั้งหมด
document.getElementById("clearCsvBtn").onclick = async function () {
  if (!confirm("ต้องการล้างข้อมูล snapshot ทั้งหมดใช่หรือไม่?")) return;
  try {
    const res = await fetch("http://127.0.0.1:5000/api/clear_snapshots", {
      method: "POST",
    });
    if (!res.ok) throw new Error("Clear CSV failed");
    alert("ล้างข้อมูลสำเร็จ!");
    loadSnapshotsAndPlot();
  } catch (err) {
    alert("ล้างข้อมูลไม่สำเร็จ: " + err);
  }
};
