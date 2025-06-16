import cv2
import dlib
import numpy as np
from .debug_visualizer import DebugVisualizer

# โหลด predictor
class BehaviorAnalyzer:
    def __init__(self):
        self.detector = dlib.get_frontal_face_detector()
        self.predictor = dlib.shape_predictor("model/shape_predictor_68_face_landmarks.dat")
        self.debugger = DebugVisualizer()

    def shape_to_np(self, shape):
        return np.array([[p.x, p.y] for p in shape.parts()])

    def get_eye_aspect_ratio(self, eye):  # เพิ่ม self เป็นพารามิเตอร์แรก
        A = np.linalg.norm(eye[1] - eye[5])
        B = np.linalg.norm(eye[2] - eye[4])
        C = np.linalg.norm(eye[0] - eye[3])
        return (A + B) / (2.0 * C)

    def analyze_behavior(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rects = self.detector(gray)

        if not rects:
            result = {
                'behavior': 'ไม่อยู่หน้าจอ',
                'pitch': None,
                'yaw': None,
                'roll': None,
                'eye_status': None
            }
            self.debugger.draw_debug_info(frame, None, result)
            return result

        shape = self.predictor(gray, rects[0])
        coords = self.shape_to_np(shape)

        # แยกจุดสำคัญออกเป็นส่วนๆ
        left_eye = coords[36:42]
        right_eye = coords[42:48]
        nose = coords[27:36]
        jaw = coords[0:17]

        # คำนวณ EAR
        left_ear = self.get_eye_aspect_ratio(coords[36:42])  # เรียกใช้เมธอดผ่าน self
        right_ear = self.get_eye_aspect_ratio(coords[42:48])
        avg_ear = (left_ear + right_ear) / 2.0
        eye_status = 'หลับตา' if avg_ear < 0.31 else 'ลืมตา'

        # Pitch, Yaw, Roll
        dx = right_eye[0][0] - left_eye[3][0]
        dy = right_eye[0][1] - left_eye[3][1]
        roll = np.degrees(np.arctan2(dy, dx))

        nose_tip = nose[3]
        chin = jaw[8]
        pitch = np.degrees(np.arctan2(chin[1] - nose_tip[1], chin[0] - nose_tip[0]))

        mid_eye_x = (left_eye[3][0] + right_eye[0][0]) / 2
        mid_eye_y = (left_eye[3][1] + right_eye[0][1]) / 2
        yaw = np.degrees(np.arctan2(nose_tip[0] - mid_eye_x, nose_tip[1] - mid_eye_y))

        # Behavior
        behavior = 'ปกติ'
        if pitch >= 94 and pitch <= 96:
            behavior = 'ก้มหน้า'
        elif pitch >= 89 and pitch <= 91:
            behavior = 'เงยหน้า'
        elif yaw >= 29 and yaw <= 31:
             behavior = 'หันซ้าย'
        elif yaw >= -27 and yaw <= -25:
            behavior = 'หันขวา'
        elif roll >= 39 and roll <= 41:
            behavior = 'เอียงซ้าย'
        elif roll >= -29 and roll <= -27:
            behavior = 'เอียงขวา'

        result = {
            'behavior': behavior,
            'pitch': round(pitch, 1),
            'yaw': round(yaw, 1),
            'roll': round(roll, 1),
            'eye_status': eye_status
        }
        
        self.debugger.draw_debug_info(frame, coords, result)
        return result

# Create analyzer instance
analyzer = BehaviorAnalyzer()

# For backwards compatibility
def analyze_behavior(frame):
    return analyzer.analyze_behavior(frame)