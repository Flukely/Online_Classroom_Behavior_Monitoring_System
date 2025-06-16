import cv2
import numpy as np
from datetime import datetime
import logging
import traceback

class DebugVisualizer:
    def __init__(self):
        try:
            self.debug_mode = True
            # สร้างหน้าต่าง debug
            self.font = cv2.FONT_HERSHEY_SIMPLEX
            cv2.namedWindow('Debug Window', cv2.WINDOW_NORMAL)
            cv2.resizeWindow('Debug Window', 800, 600)
            cv2.moveWindow('Debug Window', 0, 0)
            self.window_created = True
            logging.info("Debug window created successfully")
        except Exception as e:
            logging.error(f"Failed to create debug window: {str(e)}")
            self.window_created = False
        
    def draw_debug_info(self, frame, coords, result):
        if not self.debug_mode or not self.window_created:
            return
            
        try:
            debug_frame = frame.copy()
            
            # วาดจุดสำคัญบนใบหน้า
            if coords is not None:
                coords = coords.astype(np.int32)
                
                # กรอบใบหน้า
                cv2.polylines(debug_frame, [coords[0:17]], False, (255, 255, 0), 2)
                
                # ตา
                cv2.polylines(debug_frame, [coords[36:42]], True, (0, 255, 0), 2)  # ตาซ้าย
                cv2.polylines(debug_frame, [coords[42:48]], True, (0, 255, 0), 2)  # ตาขวา
                
                # จมูก
                cv2.polylines(debug_frame, [coords[27:36]], True, (255, 0, 0), 2)
                
                # ปาก
                cv2.polylines(debug_frame, [coords[48:68]], True, (0, 0, 255), 2)

            # สร้างพื้นหลังสีดำสำหรับข้อความ
            overlay = debug_frame.copy()
            cv2.rectangle(overlay, (10, 10), (300, 200), (0, 0, 0), -1)
            debug_frame = cv2.addWeighted(overlay, 0.3, debug_frame, 0.7, 0)

            # แสดงข้อมูลการวิเคราะห์
            info = [
                f"Behavior: {result.get('behavior', 'N/A')}",
                f"Eye Status: {result.get('eye_status', 'N/A')}",
                f"Pitch: {result.get('pitch', 'N/A'):.1f}" if result.get('pitch') else "Pitch: N/A",
                f"Yaw: {result.get('yaw', 'N/A'):.1f}" if result.get('yaw') else "Yaw: N/A",
                f"Roll: {result.get('roll', 'N/A'):.1f}" if result.get('roll') else "Roll: N/A",
                f"Time: {datetime.now().strftime('%H:%M:%S')}"
            ]

            y0 = 40
            for text in info:
                cv2.putText(debug_frame, text, (20, y0), 
                           self.font, 0.7, (255, 255, 255), 2)
                y0 += 30

            # แสดงผล
            cv2.imshow('Debug Window', debug_frame)
            key = cv2.waitKey(1) & 0xFF
            
            # กด 'q' เพื่อปิดหน้าต่าง debug
            if key == ord('q'):
                self.close()

        except Exception as e:
            logging.error(f"Error in draw_debug_info: {str(e)}\n{traceback.format_exc()}")
            
    def close(self):
        try:
            if self.window_created:
                cv2.destroyAllWindows()
                self.window_created = False
                logging.info("Debug window closed")
        except Exception as e:
            logging.error(f"Error closing window: {str(e)}")