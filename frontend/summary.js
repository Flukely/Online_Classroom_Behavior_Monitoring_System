const GROUP_LABELS = ["บวก (Positive)", "กลาง (Neutral)", "ลบ (Negative)", "ไม่อยู่หน้าจอ"];
const EMO_GROUP = {
  neutral: "กลาง (Neutral)",
  sad: "ลบ (Negative)",
  fearful: "ลบ (Negative)",
  disgusted: "ลบ (Negative)",
  angry: "ลบ (Negative)",
  happy: "บวก (Positive)",
  surprised: "บวก (Positive)",
};

let currentZoom = 1;
let lineChart, pieChart;

function toGroup(row) {
  if (row.emotion && row.emotion.trim() !== "") {
    return EMO_GROUP[row.emotion.trim()] || "กลาง (Neutral)";
  }
  if (row.behavior === "ไม่อยู่หน้าจอ") return "ไม่อยู่หน้าจอ";
  return "กลาง (Neutral)";
}

function groupByTime(data, groupSec) {
  let grouped = [];
  let bucket = {};
  data.forEach((row) => {
    const t = Number(row.time || 0);
    const key = Math.floor(t / groupSec) * groupSec;
    if (!bucket[key]) bucket[key] = [];
    bucket[key].push(row);
  });
  for (let key in bucket) {
    const rows = bucket[key];
    const emotionCount = {};
    let mainEmotion = "";
    let max = 0;
    rows.forEach((r) => {
      let e = r.emotion || "";
      if (e) {
        if (!emotionCount[e]) emotionCount[e] = 0;
        emotionCount[e]++;
        if (emotionCount[e] > max) { max = emotionCount[e]; mainEmotion = e; }
      }
    });
    grouped.push({ time: Number(key), emotion: mainEmotion });
  }
  grouped.sort((a, b) => a.time - b.time);
  return grouped;
}

function plotChartsFromCSV(data, zoomLevel = 1) {
  let usedData = data;
  if (zoomLevel === 2) usedData = groupByTime(data, 30);
  else if (zoomLevel === 3) usedData = groupByTime(data, 60);

  const timeLabels = [];
  const groupLabels = [];
  usedData.forEach(row => {
    groupLabels.push(toGroup(row));
    timeLabels.push(row.time || "");
  });

  const count = { "บวก (Positive)":0, "กลาง (Neutral)":0, "ลบ (Negative)":0, "ไม่อยู่หน้าจอ":0 };
  groupLabels.forEach(g => { if (count[g] !== undefined) count[g]++; else count["กลาง (Neutral)"]++; });

  // Line
  const lineCtx = document.getElementById("emotionLineChart").getContext("2d");
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(lineCtx, {
    type: "line",
    data: { labels: timeLabels, datasets: [{ label: "กลุ่มอารมณ์", data: groupLabels, borderColor: "rgba(75, 192, 192, 1)", tension: 0.1, stepped: true, borderWidth: 3, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: "rgba(75, 192, 192, 1)", fill: false }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, title: { display:true, text:`การเปลี่ยนแปลงอารมณ์ตามเวลา (Zoom x${zoomLevel})` } },
      scales: { x: { title:{ display:true, text:"เวลา (วินาที)" } }, y: { type:"category", labels: GROUP_LABELS, title:{ display:true, text:"กลุ่มอารมณ์"} } }
    }
  });

  // Pie
  const pieCtx = document.getElementById("emotionPieChart").getContext("2d");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: GROUP_LABELS,
      datasets: [{
        data: GROUP_LABELS.map(lbl => count[lbl]),
        backgroundColor: ["rgba(46,204,113,0.9)","rgba(149,165,166,0.9)","rgba(231,76,60,0.9)","rgba(52,73,94,0.9)"],
        borderColor: ["rgba(46,204,113,1)","rgba(149,165,166,1)","rgba(231,76,60,1)","rgba(52,73,94,1)"],
        borderWidth: 2, hoverOffset: 12
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:"bottom" }, title:{ display:true, text:"สัดส่วนอารมณ์โดยรวม" } }
    }
  });
}

async function loadSnapshotsAndPlot() {
  const res = await fetch("http://127.0.0.1:5000/api/snapshots");
  const csvText = await res.text();
  const rows = csvText.split("\n").slice(1).filter(Boolean);
  const data = rows.map((row) => {
    const [timestamp, time, emotion, confidence, behavior, eye_status, pitch, yaw, roll] = row.split(",");
    return { timestamp, time:Number(time||0), emotion, confidence, behavior, eye_status, pitch, yaw, roll };
  });
  plotChartsFromCSV(data, currentZoom);
}

window.onload = function() {
  loadSnapshotsAndPlot();
  document.getElementById("zoom1Btn").onclick = () => { currentZoom = 1; loadSnapshotsAndPlot(); };
  document.getElementById("zoom2Btn").onclick = () => { currentZoom = 2; loadSnapshotsAndPlot(); };
  document.getElementById("zoom3Btn").onclick = () => { currentZoom = 3; loadSnapshotsAndPlot(); };
  document.getElementById("reloadChartBtn").onclick = loadSnapshotsAndPlot;
};
