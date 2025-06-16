const video = document.getElementById("myVideo");

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
  faceapi.nets.faceExpressionNet.loadFromUri("./models"),
]).then(startVideoUpload);

function startVideoUpload() {
  const videoUpload = document.getElementById("videoUpload");
  const snapshotContainer = document.getElementById("snapshotContainer");
  let canvas;

  videoUpload.addEventListener("change", () => {
    const file = videoUpload.files[0];
    if (file) {
      video.src = URL.createObjectURL(file);
      video.load();
    }
  });

  function getEAR(eye) {
    const A = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const B = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const C = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (A + B) / (2.0 * C);
  }

  video.addEventListener("play", () => {
    if (canvas) canvas.remove();

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      video.addEventListener("loadedmetadata", startDetection, { once: true });
    } else {
      startDetection();
    }

    function startDetection() {
      canvas = faceapi.createCanvasFromMedia(video);
      document.querySelector(".video-container").appendChild(canvas);

      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";

      faceapi.matchDimensions(canvas, displaySize, true);

      const rollHistory = {},
        pitchHistory = {},
        yawHistory = {};
      const HISTORY_LENGTH = 5;
      let lastSnapshotTime = 0;
      const SNAPSHOT_INTERVAL = 3000;
      let isVideoPlaying = true;

      video.addEventListener("ended", () => {
        isVideoPlaying = false;
      });

      async function onFrame() {
        if (!isVideoPlaying) {
          return;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
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

        const resizedDetections = faceapi.resizeResults(detections, {
          width: canvas.width,
          height: canvas.height,
        });

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        faceapi.draw.drawDetections(canvas, resizedDetections, {
          withScore: false,
        });

        resizedDetections.forEach((det) => {
          const landmarks = det.landmarks;
          const positions = landmarks.positions;

          ctx.save();
          ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;

          positions.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });

          ctx.restore();
        });

        faceapi.draw.drawFaceExpressions(canvas, resizedDetections, {
          minConfidence: 0.1,
          fontSize: 14,
        });

        const now = Date.now();

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

          if (!rollHistory[i]) rollHistory[i] = [];
          if (!pitchHistory[i]) pitchHistory[i] = [];
          if (!yawHistory[i]) yawHistory[i] = [];

          rollHistory[i].push(roll);
          pitchHistory[i].push(pitch);
          yawHistory[i].push(yaw);

          if (rollHistory[i].length > HISTORY_LENGTH) rollHistory[i].shift();
          if (pitchHistory[i].length > HISTORY_LENGTH) pitchHistory[i].shift();
          if (yawHistory[i].length > HISTORY_LENGTH) yawHistory[i].shift();

          const avgRoll =
            rollHistory[i].reduce((a, b) => a + b, 0) / rollHistory[i].length;
          const avgPitch =
            pitchHistory[i].reduce((a, b) => a + b, 0) / pitchHistory[i].length;
          const avgYaw =
            yawHistory[i].reduce((a, b) => a + b, 0) / yawHistory[i].length;

          const leftEAR = getEAR(leftEye);
          const rightEAR = getEAR(rightEye);
          const avgEAR = (leftEAR + rightEAR) / 2.0;

          const EAR_THRESHOLD = 0.31;
          const eyeStatus = avgEAR < EAR_THRESHOLD ? "หลับตา" : "ลืมตา";

          let posture = "ปกติ";
          if (avgPitch >= 94 && avgPitch <= 95) posture = "ก้มหน้า";
          else if (avgPitch >= 89 && avgPitch <= 90) posture = "เงยหน้า";
          else if (avgYaw >= 29 && avgYaw <= 31) posture = "หันซ้าย";
          else if (avgYaw >= -27 && avgYaw <= -25) posture = "หันขวา";
          else if (avgRoll >= 39 && avgRoll <= 41) posture = "เอียงซ้าย";
          else if (avgRoll >= -29 && avgRoll <= -27) posture = "เอียงขวา";

          ctx.fillStyle = "white";
          ctx.strokeStyle = "black";
          ctx.lineWidth = 2;
          ctx.font = "bold 14px Arial";

          function drawTextWithOutline(text, x, y) {
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
          }

          drawTextWithOutline(
            `Eye: ${eyeStatus}`,
            box.x,
            box.y + box.height + 20
          );
          drawTextWithOutline(
            `Roll: ${avgRoll.toFixed(1)}°`,
            box.x,
            box.y - 30
          );
          drawTextWithOutline(
            `Pitch: ${avgPitch.toFixed(1)}°`,
            box.x,
            box.y - 10
          );
          drawTextWithOutline(`Yaw: ${avgYaw.toFixed(1)}°`, box.x, box.y + 10);
          drawTextWithOutline(
            `Posture: ${posture}`,
            box.x,
            box.y + box.height + 40
          );

          if (isVideoPlaying && now - lastSnapshotTime > SNAPSHOT_INTERVAL) {
            const sw = 500;
            const sh = 600;
            const sx = Math.max(0, box.x + box.width / 2 - sw / 2);
            const sy = Math.max(0, box.y + box.height / 2 - sh / 2);

            const snapshotWrapper = document.createElement("div");
            snapshotWrapper.className = "snapshot-wrapper";

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = sw;
            tempCanvas.height = sh;
            const tempCtx = tempCanvas.getContext("2d");

            tempCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            const img = document.createElement("img");
            img.src = tempCanvas.toDataURL("image/png");
            img.alt = `snapshot-face-${i + 1}`;
            img.title = `บุคคลที่ ${i + 1} (ใบหน้า)`;
            img.className = "snapshot";

            snapshotWrapper.appendChild(img);
            snapshotContainer.appendChild(snapshotWrapper);

            fetch("http://127.0.0.1:5000/api/analyze", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                image: tempCanvas.toDataURL("image/png"),
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                const analysisDiv = document.createElement("div");
                analysisDiv.className = "analysis-result";

                analysisDiv.innerHTML = `
                  <div class="analysis-header">วิเคราะห์จาก AI (Backend)</div>
                  <div class="analysis-item">ท่าทาง: ${data.behavior}</div>
                  <div class="analysis-item">สถานะตา: ${data.eye_status}</div>
                  <div class="analysis-item">Roll: ${data.roll?.toFixed(1)}°</div>
                  <div class="analysis-item">Pitch: ${data.pitch?.toFixed(1)}°</div>
                  <div class="analysis-item">Yaw: ${data.yaw?.toFixed(1)}°</div>
                `;

                snapshotWrapper.appendChild(analysisDiv);
              })
              .catch((err) => {
                console.error("Error sending to backend:", err);
              });

            lastSnapshotTime = now;
          }
        });

        requestAnimationFrame(onFrame);
      }

      onFrame();
    }
  });
}