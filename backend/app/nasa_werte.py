KOERPERMASSE_KG = 80.7
ZUSATZLAST_KG = 0.0
GELAENDEFAKTOR = 1.0
GEHTEMPO_METER_PRO_SEKUNDE = 3.0 / 3.6
MAX_STEIGUNG_GRAD = 15.0
JOULE_PRO_KG_SAUERSTOFF = 3670 * 1055.056 / (0.605 * 0.45359237)
SAUERSTOFF_DICHTE_KG_PRO_LITER = 0.001429
MAX_EVA_SEKUNDEN = 8 * 3600
MITTLERE_STOFFWECHSELRATE_WATT = 350.0
MAX_STOFFWECHSELRATE_WATT = 530.0

QUELLEN = {
    "JOULE_PRO_KG_SAUERSTOFF": "Rechenbeispiel zur Sauerstoffmethode im Apollo PLSS Performance Report (Carson, NASA MSC, NTRS 19720019460): 0,622 lb gelieferter minus 0,017 lb Leckage = 0,605 lb Sauerstoff entsprechen 3670 Btu bei Atemquotient 0,85, ergibt ca. 14,1 MJ je kg Sauerstoff",
    "SAUERSTOFF_DICHTE_KG_PRO_LITER": "Physikalische Konstante: 1,429 g/L bei 0 Grad C und 1 atm, nur zur Umrechnung der Masse in Liter",
    "MAX_EVA_SEKUNDEN": "8 Stunden: laengste nominelle EVA-Dauer in der Mars-PLSS-Studie (ICES 2026, NTRS 20260002884), dazu 0,5 bis 1 Stunde Notfallreserve",
    "MITTLERE_STOFFWECHSELRATE_WATT": "350 W mittlere Stoffwechselrate nach xEMU-Spezifikation (ICES 2026 Mars Schematic Study, NTRS 20260002884)",
    "MAX_STOFFWECHSELRATE_WATT": "530 W maximale Stoffwechselrate nach xEMU-Spezifikation (ICES 2026 Mars Schematic Study)",
    "KOERPERMASSE_KG": "Mittlere Koerpermasse der 6 Astronauten-Probanden, Gernhardt, Norcross, Vos: Integrated Suit Test 1 (IST-1), NASA JSC, SAE 2007, Tabelle 1: 80,7 kg",
    "ZUSATZLAST_KG": "0 gesetzt: die Pandolf-Gleichung gilt fuer Lasten bei 1 g, die Anzuglast bei 0,38 g Mars-Schwerkraft ist damit nicht belegt abbildbar",
    "GELAENDEFAKTOR": "Pandolf-Gelaendekoeffizient eta, 1,0 = feste ebene Flaeche (Kim et al., IEEE EMBC 2024, NASA JSC Crew State and Risk Model)",
    "GEHTEMPO_METER_PRO_SEKUNDE": "3,0 km/h: Geh- und Steigungstest bei Norcross und Gernhardt, NASA JSC (Gehen und Gehen mit 20 % Steigung, jeweils 3,0 km/h); IST-1: nominale Geschwindigkeiten bis 5 km/h",
    "MAX_STEIGUNG_GRAD": "ca. 15 Grad (ca. 27 % Steigung): steilster Abschnitt im Rock Yard des NASA JSC, den Probanden bei der Pandolf-Studie liefen (Kim et al., APACHE-Studie, ICES 2022)",
}


def pandolf_watt(steigung_prozent: float) -> float:
    w = KOERPERMASSE_KG
    last = ZUSATZLAST_KG
    v = GEHTEMPO_METER_PRO_SEKUNDE
    g = max(0.0, steigung_prozent)
    return (
        1.5 * w
        + 2.0 * (w + last) * (last / w) ** 2
        + GELAENDEFAKTOR * (w + last) * (1.5 * v**2 + 0.35 * v * g)
    )
