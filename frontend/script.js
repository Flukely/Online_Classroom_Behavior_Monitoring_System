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
  // ปรับขนาด container ให้สัมพันธ์กับวิดีโอจริง
  const container = document.querySelector(".video-container");
  container.style.width = video.videoWidth + "px";
  container.style.height = video.videoHeight + "px";

  // ปรับขนาด video และ canvas ให้ตรงกัน
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
  const emotionGroups = {
    neutral: ["neutral"],
    negative: ["sad", "fearful", "disgusted", "angry"],
    positive: ["happy", "surprised"],
  };

  let lineChart, pieChart;
  let emotionHistory = [];

function initCharts() {
  // Line Chart
  const lineCtx = document.getElementById('emotionLineChart').getContext('2d');
  if (lineChart) lineChart.destroy();

  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: [], // เวลา
      datasets: [{
        label: 'กลุ่มอารมณ์',
        data: [], // กลุ่มอารมณ์
        borderColor: 'rgba(75, 192, 192, 1)',
        tension: 0.1,
        stepped: true,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
        fill: false // ปิดการเติมพื้นหลัง
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `อารมณ์: ${context.raw}`;
            }
          },
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleFont: { 
            size: 16,
            weight: 'bold'
          },
          bodyFont: { 
            size: 14,
            weight: 'bold'
          },
          padding: 12,
          cornerRadius: 8,
          displayColors: false
        },
        title: {
          display: true,
          text: 'การเปลี่ยนแปลงอารมณ์ตามเวลา',
          font: { 
            size: 18,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          },
          color: '#2c3e50'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'เวลา (วินาที)',
            font: { 
              size: 14,
              weight: 'bold'
            },
            color: '#2c3e50'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 12
            },
            color: '#7f8c8d'
          }
        },
        y: {
          type: 'category',
          labels: ['บวก (Positive)', 'กลาง (Neutral)', 'ลบ (Negative)'],
          title: {
            display: true,
            text: 'กลุ่มอารมณ์',
            font: { 
              size: 14,
              weight: 'bold'
            },
            color: '#2c3e50'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 12,
              weight: 'bold'
            },
            color: '#7f8c8d'
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });

  // Pie Chart
  const pieCtx = document.getElementById('emotionPieChart').getContext('2d');
  if (pieChart) pieChart.destroy();

  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ['บวก (Positive)', 'กลาง (Neutral)', 'ลบ (Negative)'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [
          'rgba(46, 204, 113, 0.9)',  // สีเขียว (Positive)
          'rgba(149, 165, 166, 0.9)', // สีเทา (Neutral)
          'rgba(231, 76, 60, 0.9)'    // สีแดง (Negative)
        ],
        borderColor: [
          'rgba(46, 204, 113, 1)',    // สีเขียว (Positive)
          'rgba(149, 165, 166, 1)',   // สีเทา (Neutral)
          'rgba(231, 76, 60, 1)'      // สีแดง (Negative)
        ],
        borderWidth: 2,
        hoverOffset: 15
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { 
              size: 14,
              weight: 'bold'
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
            color: '#2c3e50'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              return `${label}: ${value.toFixed(1)}%`;
            }
          },
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleFont: { 
            size: 16,
            weight: 'bold'
          },
          bodyFont: { 
            size: 14,
            weight: 'bold'
          },
          padding: 12,
          cornerRadius: 8,
          displayColors: false
        },
        title: {
          display: true,
          text: 'สัดส่วนอารมณ์โดยรวม',
          font: { 
            size: 18,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          },
          color: '#2c3e50'
        }
      },
      cutout: '0%', // ไม่ต้องมีช่องว่างกลาง
      animation: {
        animateScale: true,
        animateRotate: true
      }
    }
  });

  emotionHistory = [];
}

function updateCharts(detection, nowSec) {
  if (!detection.expressions) return;

  // คำนวณคะแนนของแต่ละกลุ่ม
  const neutralScore = detection.expressions.neutral || 0;
  const negativeScore = ['sad', 'fearful', 'disgusted', 'angry']
    .reduce((sum, emotion) => sum + (detection.expressions[emotion] || 0), 0);
  const positiveScore = ['happy', 'surprised']
    .reduce((sum, emotion) => sum + (detection.expressions[emotion] || 0), 0);

  // หากลุ่มที่มีค่ามากที่สุด
  let dominantGroup;
  if (neutralScore > negativeScore && neutralScore > positiveScore) {
    dominantGroup = 'กลาง (Neutral)';
  } else if (negativeScore > positiveScore) {
    dominantGroup = 'ลบ (Negative)';
  } else {
    dominantGroup = 'บวก (Positive)';
  }

  // อัพเดท Line Chart
  lineChart.data.labels.push(nowSec);
  lineChart.data.datasets[0].data.push(dominantGroup);

  // จำกัดจำนวนข้อมูลที่แสดง (เก็บแค่ 30 จุดล่าสุด)
  if (lineChart.data.labels.length > 30) {
    lineChart.data.labels.shift();
    lineChart.data.datasets[0].data.shift();
  }

  // อัพเดท Pie Chart
  const totalTime = lineChart.data.labels.length;
  const groupCounts = lineChart.data.datasets[0].data.reduce((acc, group) => {
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});

  pieChart.data.datasets[0].data = [
    (groupCounts['บวก (Positive)'] || 0) / totalTime * 100,
    (groupCounts['กลาง (Neutral)'] || 0) / totalTime * 100,
    (groupCounts['ลบ (Negative)'] || 0) / totalTime * 100
  ];

  // อัพเดททั้งสองกราฟ
  lineChart.update('none');
  pieChart.update('none');
}

  // แก้ไขส่วน video.addEventListener("play")
  video.addEventListener("play", () => {
    if (canvas) canvas.remove();
    canvas = null;

    initCharts();

    if (video.readyState < 2) {
      video.addEventListener("canplay", startDetection, { once: true });
    } else {
      startDetection();
    }
  });

  function startDetection() {
    function resizeCanvasToVideo() {
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.style.width = video.videoWidth + "px";
      canvas.style.height = video.videoHeight + "px";
    }

    // เรียกใช้เมื่อวิดีโอโหลดหรือขนาดเปลี่ยน
    video.addEventListener("loadedmetadata", resizeCanvasToVideo);
    video.addEventListener("resize", resizeCanvasToVideo);

    // สร้าง canvas ใหม่ทุกครั้งที่เริ่มวิดีโอ
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

        // ตรวจจับใบหน้าและ resize ผลลัพธ์ให้สัมพันธ์กับวิดีโอ
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
            emotionResults.push({
              time: nowSec,
              predicted: "",
              confidence: "",
              true_label: "ไม่อยู่หน้าจอ",
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
            nowSec >= 10 // เพิ่มเงื่อนไขนี้
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
              updateCharts(detection, nowSec); // เรียกใช้ฟังก์ชัน updateCharts 

              emotionResults.push({
                time: nowSec,
                predicted: mainEmotion,
                confidence: mainScore,
                true_label: posture,
              });
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
