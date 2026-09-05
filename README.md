# UrbanMind 

Autonomous multi-agent traffic intelligence system for Bangalore.

An operator-facing dashboard where LLM-driven agents observe the road network, reason about incidents, and coordinate a response across Traffic Police, Hospital, Fire, Public Information, BBMP, and Ambulance Crew — with a citizen-facing page for reporting incidents.

---

## What's inside

- **12 specialized agents** — Incident, Prediction, Constraint, Intervention, Emission, Safety, Police, EMS, HospitalRouting, EmergencyCorridor, Comms — orchestrated by a **SupervisingAgent** that picks one of 5 protocols per incident.
- **Groq `llama-3.3-70b-versatile`** for agent reasoning.
- **MobileViT (`apple/mobilevit-small`)** for image evidence verification — auto-escalates severity when injury indicators are visible.
- **Keyword-scored RAG** over hand-written SOP text so every LLM prompt cites its source.
- **OSRM + Nominatim** for real road routing and geocoding.
- **Server-Sent Events broadcast** with per-subscriber fan-out — every dashboard sees every event.
- **Severity-driven behaviour matrix** (levels 1–5) that scales unit dispatch, corridor rules, agent participation, and metrics.
- **Capability-first hospital selection** combining EMS dispatch, paramedic field assessment, and incident type.
- **6 dedicated department portals** plus a public citizen page — all update in lock-step over the same SSE stream.

---

## Tech stack

**Backend** — FastAPI · uvicorn · httpx · langchain-groq · transformers + torch (MobileViT) · Pillow · python-dotenv · reportlab
**Frontend** — React 18 · Vite · React Router · Leaflet · react-leaflet · Stadia Maps · Inter + JetBrains Mono
**External APIs** — Groq · OSRM public server · Nominatim · Stadia Maps

---

## Setup

Clone the repo, then install both halves:

```bash
git clone https://github.com/haasa-x/urbanmind.git
cd urbanmind

# backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "GROQ_API_KEY=your_groq_key" > .env

# frontend
cd ../frontend
npm install
```

`GROQ_API_KEY` is required for LLM output; without it, agents fall back to deterministic stubs so the demo still runs.

---

## Run

**One command (supervised, auto-restarts on crash):**

```bash
./run.sh
```

Kills any process on `:8000` / `:5173`, wipes Vite's dep cache, starts both servers, restarts either one if it dies. `Ctrl+C` stops both.

**Two terminals (manual):**

```bash
# terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# terminal 2 — frontend
cd frontend && npm run dev
```

---


---

## Watching agent logs

The backend prints every agent decision with millisecond timestamps:

```bash
tail -f /tmp/urbanmind-backend.log
```

Sample:

```
16:20:44.576  [MSG]  IncidentAgent
    [HIGH · sev 4] INCIDENT_CONFIRMED at J1: severity 4/5, clearance ETA 30min
16:20:44.624  [MSG]  SupervisingAgent
    Activating MAJOR_ACCIDENT protocol · priority HIGH
16:20:44.882  [ALERT]  Traffic Police   (icon=🚔)
    Deploy 4 units · priority HIGH · ETA 4min
16:20:45.246  [GRAPH]  orchestrator   (took=755ms)
    invoke complete
```

Set `NO_COLOR=1` to strip ANSI escapes.

---


---

## API endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/stream` | GET | SSE broadcast |
| `/state` | GET | Full CityState snapshot |
| `/custom-incident` | POST | Citizen JSON submit |
| `/report` | POST | Multipart submit with image (runs MobileViT) |
| `/route` | POST | OSRM real-road route |
| `/geocode` | POST | Nominatim geocoding |
| `/hospitals` | GET | 30-hospital Bangalore roster with capabilities |
| `/medical-assessment` | POST | Paramedic field brief → hospital re-selection |
| `/alerts/{department}` | GET | Department-filtered alerts |
| `/invoke_scenario/{id}` | POST | Trigger scripted scenario |

---

## Repository layout

```
urbanmind/
├── run.sh                     supervisor script
├── backend/
│   ├── main.py                FastAPI app + SSE + logging
│   ├── replay.py              scripted scenario runner
│   ├── requirements.txt
│   ├── agents/                12 agent modules + supervisor + graph orchestrator
│   ├── utils/                 city_state · severity_config · alert_dispatcher · causal_graph
│   ├── src/
│   │   ├── rag/               keyword retriever + SOP knowledge corpus
│   │   ├── routing/           OSRM + Nominatim wrapper
│   │   └── vision/            MobileViT image analyzer
│   ├── data/hospitals.json    30-hospital roster
│   └── scenarios/*.json       SC-01/02/03 event scripts
└── frontend/
    ├── src/
    │   ├── App.jsx            SSE consumer + router
    │   ├── index.css          design tokens (soft-teal + lavender palette)
    │   ├── components/        Header, CityMap, AgentWorkflowPanel, AgentTraceLog,
    │   │                       NarratorPanel, DepartmentAlertFeed, MetricsStrip,
    │   │                       CockpitSidebar, CitizenView, ...
    │   └── components/departments/  Police, Hospital, Fire, Public, BBMP, Ambulance
    ├── data/                  scenarios · severity · hospitals fallback
    └── hooks/useTypewriter.js
```

---

## Ops one-liners

```bash
# stop everything on both ports
lsof -ti:8000 -ti:5173 | xargs -r kill -9

# fresh restart Vite (clears its dep cache)
rm -rf frontend/node_modules/.vite

# hit the citizen endpoint from CLI
curl -s -X POST http://localhost:8000/custom-incident \
  -H "Content-Type: application/json" \
  -d '{"description":"Truck fire","severity":5,"location":"Hebbal"}'

# tail the live SSE stream (raw)
curl -sN http://localhost:8000/stream
```

---



## License

Educational / demo project. See repository for details.
