// ================== ตัวแปร DOM ==================
const video = document.getElementById("myVideo");
const videoProgress = document.getElementById("videoProgress");
const currentTimeSpan = document.getElementById("currentTime");
const totalTimeSpan = document.getElementById("totalTime");

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
  videoProgress.max = video.duration;
  totalTimeSpan.textContent = formatTime(video.duration);
});

video.addEventListener("timeupdate", () => {
  videoProgress.value = video.currentTime;
  currentTimeSpan.textContent = formatTime(video.currentTime);
});

function startVideoUpload() {
  const videoUpload = document.getElementById("videoUpload");
  const snapshotContainer = document.getElementById("snapshotContainer");
  let canvas;

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

  // ================== กราฟอารมณ์ ==================
  let chart;
  let emotionHistory = [];
  const emotionLabels = [
    "angry",
    "disgusted",
    "fearful",
    "happy",
    "neutral",
    "sad",
    "surprised",
  ];

  function initChart() {
    const ctx = document.getElementById("emotionChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "bar", // เปลี่ยนจาก "line" เป็น "bar"
      data: {
        labels: [],
        datasets: emotionLabels.map((label, idx) => ({
          label,
          data: [],
          backgroundColor: [
            "rgba(231,76,60,0.7)",
            "rgba(39,174,96,0.7)",
            "rgba(142,68,173,0.7)",
            "rgba(241,196,15,0.7)",
            "rgba(149,165,166,0.7)",
            "rgba(52,152,219,0.7)",
            "rgba(255,152,0,0.7)",
          ][idx],
          borderColor: [
            "#e74c3c",
            "#27ae60",
            "#8e44ad",
            "#f1c40f",
            "#95a5a6",
            "#3498db",
            "#ff9800",
          ][idx],
          borderWidth: 1,
        })),
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              font: { size: 16 },
              boxWidth: 24,
              padding: 20,
            },
          },
          title: {
            display: true,
            text: "กราฟแสดงอารมณ์ตามเวลา (Bar Chart)",
            font: { size: 20 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "เวลา (วินาที)", font: { size: 16 } },
            stacked: false, // ถ้าอยาก stacked ให้เปลี่ยนเป็น true
            ticks: { font: { size: 14 } },
            grid: { color: "rgba(200,200,200,0.2)" },
          },
          y: {
            min: 0,
            max: 100,
            title: {
              display: true,
              text: "ความมั่นใจ (%)",
              font: { size: 16 },
            },
            ticks: { font: { size: 14 } },
            grid: { color: "rgba(200,200,200,0.2)" },
          },
        },
      },
    });

    emotionHistory = [];
  }

  // ================== เมื่อ video เล่น ==================
  video.addEventListener("play", () => {
    if (canvas) canvas.remove();
    canvas = null;

    initChart();

    if (video.readyState < 2) {
      video.addEventListener("canplay", startDetection, { once: true });
    } else {
      startDetection();
    }
  });

  function startDetection() {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector(".video-container").appendChild(canvas);

    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: displaySize.width + "px",
      height: displaySize.height + "px",
    });

    faceapi.matchDimensions(canvas, displaySize);

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

          let posture = "ปกติ";
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
          if (nowSec % 20 === 0 && nowSec !== lastSnapshotSec && !isFetching) {
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

            if (detection.expressions) {
              const dataPoint = { time: nowSec };
              emotionLabels.forEach((label) => {
                dataPoint[label] = (detection.expressions[label] || 0) * 100;
              });
              emotionHistory.push(dataPoint);
              chart.data.labels.push(nowSec);
              chart.data.datasets.forEach((ds) => {
                ds.data.push(dataPoint[ds.label]);
              });
              chart.update("none");
            }
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
}
