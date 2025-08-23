from queue import Queue
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2, os, datetime, logging, traceback, csv, json
from utils.image_processing import base64_to_cv2
from utils.behavior_analysis import analyze_behavior

os.makedirs('logs', exist_ok=True)
file_handler = logging.FileHandler('logs/behavior_analysis.log', encoding='utf-8')
console_handler = logging.StreamHandler()
fmt = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
file_handler.setFormatter(fmt); console_handler.setFormatter(fmt)
logger = logging.getLogger(); logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler); logger.addHandler(console_handler)

app = Flask(__name__)
CORS(app)

CSV_PATH = "logs/emotion_snapshots.csv"

# ---------- SSE ----------
subscribers = []
def publish_snapshot(row: dict):
    dead = []
    for q in subscribers:
        try: q.put_nowait(row)
        except Exception: dead.append(q)
    for q in dead:
        try: subscribers.remove(q)
        except ValueError: pass

@app.route('/api/stream')
def stream():
    q = Queue(); subscribers.append(q)
    def gen():
        yield 'event: ping\ndata: {}\n\n'
        try:
            while True:
                row = q.get()
                yield f"data: {json.dumps(row, ensure_ascii=False)}\n\n"
        except GeneratorExit:
            try: subscribers.remove(q)
            except ValueError: pass
    return Response(gen(), headers={
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
})
# -------------------------

def save_snapshot_to_csv(data):
    file_exists = os.path.isfile(CSV_PATH)
    with open(CSV_PATH, mode="a", encoding="utf-8", newline="") as f:
        fieldnames = ["timestamp","time","emotion","confidence","behavior","eye_status","pitch","yaw","roll"]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists: w.writeheader()
        w.writerow(data)
    publish_snapshot(data)  # ส่งอีเวนต์ทุกครั้งที่เขียน

@app.route('/api/analyze', methods=['POST'])
def analyze_snapshot():
    try:
        if not request.is_json: return jsonify({'error':'Request must be JSON'}), 400
        data = request.get_json()
        if not data or 'image' not in data: return jsonify({'error':'Missing image data'}), 400

        frame = base64_to_cv2(data['image'])
        if frame is None: return jsonify({'error':'Invalid image data'}), 400

        result = analyze_behavior(frame)

        timestamp = datetime.datetime.now().isoformat()
        row = {
            "timestamp": timestamp,
            "time": data.get("time", None),
            "emotion": data.get("emotion", ""),
            "confidence": data.get("confidence", ""),
            "behavior": result["behavior"],
            "eye_status": result["eye_status"],
            "pitch": result["pitch"],
            "yaw": result["yaw"],
            "roll": result["roll"]
        }
        save_snapshot_to_csv(row)

        return jsonify({
            'status':'success', 'behavior':result['behavior'],
            'pitch':result['pitch'],'yaw':result['yaw'],'roll':result['roll'],
            'eye_status':result['eye_status'],'timestamp':timestamp
        })
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return jsonify({'error':'Internal server error'}), 500

@app.route('/api/snapshots', methods=['GET'])
def get_snapshots_csv():
    try:
        return open(CSV_PATH, encoding="utf-8").read(), 200, {'Content-Type': 'text/csv; charset=utf-8'}
    except Exception:
        return "timestamp,time,emotion,confidence,behavior,eye_status,pitch,yaw,roll\n", 200, {'Content-Type': 'text/csv; charset=utf-8'}

@app.route('/api/clear_snapshots', methods=['POST'])
def clear_snapshots():
    with open(CSV_PATH, 'w', encoding="utf-8", newline="") as f:
        f.write("timestamp,time,emotion,confidence,behavior,eye_status,pitch,yaw,roll\n")
    return jsonify({'status':'success'})

if __name__ == '__main__':
    try:
        logger.info("Starting Flask server")
        test_window = cv2.namedWindow('Test', cv2.WINDOW_AUTOSIZE); cv2.destroyWindow('Test')
        logger.info("Display is available")
    except Exception as e:
        logger.error(f"Display not available: {e}")
    app.run(debug=True, threaded=True, use_reloader=False)  # << threaded=True
