import cv2
import numpy as np
from pathlib import Path

# Example: Load one MSD floorplan
img_path = Path("path/to/structure_in/example.png")
img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)

# Normalize and threshold
_, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY_INV)
cv2.imshow("binary", binary)
cv2.waitKey(0)