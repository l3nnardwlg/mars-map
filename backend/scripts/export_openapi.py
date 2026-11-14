import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402


def main() -> None:
    ziel = BACKEND / "openapi.json"
    ziel.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"geschrieben: {ziel}")


if __name__ == "__main__":
    main()
