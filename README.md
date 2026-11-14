# mars-map


Bereich	Entscheidung
Frontend	Next.js + TypeScript
3D	Three.js + React Three Fiber
Terrain	Quadtree-LOD mit DEM-Kacheln
Routing	Python + FastAPI + A*
Daten	NASA PDS, MOLA, HiRISE
Speicherung	Zunächst lokale vorberechnete Dateien
Infrastruktur	Docker Compose
CI	GitHub Actions

Zeitplan – 48 Stunden
Zeitraum	   Dev A	                                           Dev B
0–8 h	     3D-Mars + Kamera	                             NASA-Daten + API-Grundgerüst
8–20 h	     Terrain + Layer	                             Routing + Risk Engine
20–32 h	     Mission UI + Integration	                     Science Points + EVA
32–40 h	     Performance + Polish	                         Tests + Datenvalidierung
40–48 h            	Gemeinsame End-to-End-Tests, Demo und Pitch



Priorität 1: Echter 3D-Mars mit hochauflösbarer Demo-Region und NASA-Daten.

Priorität 2: Funktionierende Routenplanung mit Gelände- und Risikoanalyse.

Priorität 3: Mission Control mit wissenschaftlichen Informationen.