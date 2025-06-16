from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import datetime
from utils.image_processing import base64_to_cv2
from utils.behavior_analysis import analyze_behavior
import logging
import traceback

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

# ปรับปรุงการตั้งค่า logging
logging.basicConfig(
    filename='logs/behavior_analysis.log',
    level=logging.DEBUG,  # เปลี่ยนเป็น DEBUG เพื่อดูรายละเอียดมากขึ้น
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# สร้างโฟลเดอร์ logs ถ้ายังไม่มี
if not os.path.exists('logs'):
    os.makedirs('logs')

app = Flask(__name__)
CORS(app)

@app.route('/api/analyze', methods=['POST'])
def analyze_snapshot():
    try:
        # ตรวจสอบ request
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

        # ส่งผลลัพธ์
        response = {
            'status': 'success',
            'behavior': result['behavior'],
            'pitch': result['pitch'],
            'yaw': result['yaw'],
            'roll': result['roll'],
            'eye_status': result['eye_status'],
            'timestamp': datetime.datetime.now().isoformat()
        }
        logging.info(f"Successfully analyzed behavior: {result['behavior']}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

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