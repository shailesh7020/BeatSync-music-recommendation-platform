import os
import sys

# Ensure local backend app takes precedence over any globally installed editable packages
BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
if BACKEND_DIR not in sys.path or sys.path[0] != BACKEND_DIR:
    sys.path.insert(0, BACKEND_DIR)
