import cv2
import numpy as np
import base64

def base64_to_cv2(b64_string):
    header, encoded = b64_string.split(',', 1)
    img_data = base64.b64decode(encoded)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img
