from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
APP_PATH = ROOT / "server" / "app"
if str(APP_PATH) not in sys.path:
    sys.path.insert(0, str(APP_PATH))
