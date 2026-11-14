import argparse
import hashlib
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

HIER = Path(__file__).resolve().parent
BACKEND = HIER.parent

CTX_DEM = {
    "url": "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif",
    "datei": "M20_JezeroCrater_CTXDEM_20m.tif",
    "bytes": 90345300,
    "sha256": "ba7f706ea1b5d63a562f28a7dcf7a7f3c79bce7f048e6974b57e8a33c30d1ba2",
}
HIRISE_ZIP = {
    "url": "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSR_TRN_HiRISE_soc_003_USGS_release_aug2024/MSR_TRN_HiRISE_soc_003_USGS_release_aug2024_mosaics.zip",
    "datei": "MSR_TRN_HiRISE_soc_003_USGS_release_aug2024_mosaics.zip",
    "bytes": 5468062403,
    "muster": "DeltaGeoid_1m_Eqc_latTs0_lon0_Blend40.tif",
}
SCIENCE_QUELLEN = [
    {
        "url": "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json",
        "datei": "nasa/M20_waypoints.json",
        "sha256": None,
    },
    {
        "url": "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_SAMPLE_v3.json",
        "datei": "nasa/M20_SAMPLE_v3.json",
        "sha256": "60d4b0a275ebcc6edd573fd768da085999a506a1661111e7f20f8d4b0aa1fcae",
    },
    {
        "url": "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip",
        "datei": "nasa/gazetteer/MARS_nomenclature_center_pts.zip",
        "sha256": "753f29654d14e3f3e75f8bbe2b8fc36d4a6b43e16d9d74c122150a3797c31910",
    },
]


def sha256_von(pfad: Path) -> str:
    h = hashlib.sha256()
    with pfad.open("rb") as datei:
        for block in iter(lambda: datei.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def laden(url: str, ziel: Path, erwartete_bytes: int | None = None) -> None:
    ziel.parent.mkdir(parents=True, exist_ok=True)
    anfrage = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(anfrage) as antwort, ziel.open("wb") as ausgabe:
        gesamt = int(antwort.headers.get("Content-Length") or 0)
        geladen = 0
        while True:
            block = antwort.read(1 << 20)
            if not block:
                break
            ausgabe.write(block)
            geladen += len(block)
            if gesamt:
                print(f"\r  {ziel.name}: {geladen / 1e6:.0f} von {gesamt / 1e6:.0f} MB", end="", flush=True)
    print()
    if erwartete_bytes is not None and ziel.stat().st_size != erwartete_bytes:
        raise SystemExit(f"{ziel.name}: Groesse {ziel.stat().st_size} statt {erwartete_bytes}, Datei wurde verworfen")


def sicherstellen(quelle: dict, raw: Path) -> Path:
    ziel = raw / quelle["datei"]
    if ziel.is_file() and (quelle.get("bytes") is None or ziel.stat().st_size == quelle["bytes"]):
        print(f"vorhanden: {ziel.name}")
    else:
        print(f"lade: {ziel.name}")
        laden(quelle["url"], ziel, quelle.get("bytes"))
    pruefsumme = quelle.get("sha256")
    if pruefsumme and sha256_von(ziel) != pruefsumme:
        ziel.unlink()
        raise SystemExit(f"{ziel.name}: Pruefsumme stimmt nicht, Datei wurde verworfen")
    return ziel


def kacheln_bauen(dem: Path, ziel: Path, name: str, max_zoom: int | None = None) -> None:
    if (ziel / "metadata.json").is_file():
        print(f"Kacheln vorhanden: {name}")
        return
    befehl = [sys.executable, str(HIER / "build_tiles.py"), str(dem), str(ziel), "--name", name]
    if max_zoom is not None:
        befehl += ["--max-zoom", str(max_zoom)]
    print(f"baue Kacheln: {name}")
    subprocess.run(befehl, check=True, stdout=subprocess.DEVNULL)


def hirise_dtm(raw: Path) -> Path:
    zip_pfad = sicherstellen(HIRISE_ZIP, raw)
    with zipfile.ZipFile(zip_pfad) as archiv:
        mitglied = next(name for name in archiv.namelist() if name.endswith(HIRISE_ZIP["muster"]))
        ziel = raw / "hirise" / mitglied
        if not ziel.is_file():
            print(f"entpacke: {Path(mitglied).name}")
            archiv.extract(mitglied, raw / "hirise")
    return ziel


def main() -> None:
    parser = argparse.ArgumentParser(description="Holt die Jezero-Geodaten und baut die Hoehenkacheln.")
    parser.add_argument("--data-dir", type=Path, default=BACKEND / "data")
    parser.add_argument("--hirise", action="store_true", help="zusaetzlich HiRISE-Paket (5,5 GB) laden und Kacheln bauen")
    parser.add_argument("--science", action="store_true", help="zusaetzlich die Quelldateien fuer build_science_points.py laden")
    args = parser.parse_args()

    raw = args.data_dir / "raw"
    tiles = args.data_dir / "tiles"
    dem = sicherstellen(CTX_DEM, raw)
    kacheln_bauen(dem, tiles / "ctx_dem", "ctx_dem")
    if args.science:
        for quelle in SCIENCE_QUELLEN:
            sicherstellen(quelle, raw)
    if args.hirise:
        kacheln_bauen(hirise_dtm(raw), tiles / "hirise_dem", "hirise_dem", max_zoom=6)
    print("fertig. Backend starten: uvicorn app.main:app --port 8000")


if __name__ == "__main__":
    main()
