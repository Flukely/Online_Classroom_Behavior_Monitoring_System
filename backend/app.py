from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import datetime
from utils.image_processing import base64_to_cv2
from utils.behavior_analysis import analyze_behavior
import logging
import traceback
import csv

# สร้างโฟลเดอร์ logs ก่อนตั้งค่า logging
os.makedirs('logs', exist_ok=True)

# กำหนด log handlers
file_handler = logging.FileHandler('logs/behavior_analysis.log', encoding='utf-8')
console_handler = logging.StreamHandler()

# กำหนดรูปแบบ log messages
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# ตั้งค่า root logger
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# สร้างโฟลเดอร์ logs ถ้ายังไม่มี
if not os.path.exists('logs'):
    os.makedirs('logs')

app = Flask(__name__)
CORS(app)

CSV_PATH = "logs/emotion_snapshots.csv"

def save_snapshot_to_csv(data):
    file_exists = os.path.isfile(CSV_PATH)
    with open(CSV_PATH, mode="a", encoding="utf-8", newline="") as csvfile:
        fieldnames = ["timestamp", "time", "emotion", "confidence", "behavior", "eye_status", "pitch", "yaw", "roll"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(data)

@app.route('/api/analyze', methods=['POST'])
def analyze_snapshot():
    try:
        if not request.is_json:
            logging.error("Request is not JSON")
            return jsonify({'error': 'Request must be JSON'}), 400

        data = request.get_json()
        logging.debug(f"Received request data: {str(data.keys())}")

        if not data or 'image' not in data:
            logging.error("Missing image data in request")
            return jsonify({'error': 'Missing image data'}), 400

        # แปลงรูปภาพ
        try:
            image_b64 = data['image']
            frame = base64_to_cv2(image_b64)
            if frame is None:
                logging.error("Failed to convert base64 to image")
                return jsonify({'error': 'Invalid image data'}), 400
        except Exception as e:
            logging.error(f"Image conversion error: {str(e)}")
            return jsonify({'error': 'Invalid image format'}), 400

        # วิเคราะห์พฤติกรรม
        try:
            result = analyze_behavior(frame)
            logging.debug(f"Analysis result: {result}")
        except Exception as e:
            logging.error(f"Behavior analysis error: {str(e)}\n{traceback.format_exc()}")
            return jsonify({'error': 'Analysis failed'}), 500

        # --- เก็บ snapshot ลง CSV ---
        timestamp = datetime.datetime.now().isoformat()
        snapshot_row = {
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
        save_snapshot_to_csv(snapshot_row)
        # ---------------------------

        # ส่งผลลัพธ์
        response = {
            'status': 'success',
            'behavior': result['behavior'],
            'pitch': result['pitch'],
            'yaw': result['yaw'],
            'roll': result['roll'],
            'eye_status': result['eye_status'],
            'timestamp': timestamp
        }
        logging.info(f"Successfully analyzed behavior: {result['behavior']}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/snapshots', methods=['GET'])
def get_snapshots_csv():
    try:
        return open(CSV_PATH, encoding="utf-8").read(), 200, {'Content-Type': 'text/csv; charset=utf-8'}
    except Exception as e:
        logger.error(f"Cannot read CSV: {str(e)}")
        return "timestamp,time,emotion,confidence,behavior,eye_status,pitch,yaw,roll\n", 200, {'Content-Type': 'text/csv; charset=utf-8'}
    
@app.route('/api/clear_snapshots', methods=['POST'])
def clear_snapshots():
    try:
        # ลบหรือเคลียร์ไฟล์ CSV แล้วสร้าง header ใหม่
        with open(CSV_PATH, 'w', encoding="utf-8", newline="") as f:
            f.write("timestamp,time,emotion,confidence,behavior,eye_status,pitch,yaw,roll\n")
        return jsonify({'status': 'success', 'message': 'CSV cleared.'}), 200
    except Exception as e:
        logger.error(f"Cannot clear CSV: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    try:
        logger.info("Starting Flask server")
        # ตรวจสอบการแสดงผล OpenCV
        test_window = cv2.namedWindow('Test', cv2.WINDOW_AUTOSIZE)
        cv2.destroyWindow('Test')
        logger.info("Display is available")
    except Exception as e:
        logger.error(f"Display not available: {str(e)}")
    
    app.run(debug=True, threaded=False, use_reloader=False)
