"""Lightweight keyword-based RAG retriever.

No embeddings, no vector DB — we score each policy paragraph by the number of
query-term hits and return the top-N. Files are auto-created from bundled
defaults on first load so the demo works out of the box.
"""
import os
from pathlib import Path
from typing import List, Tuple

_HERE = Path(__file__).resolve().parent
KNOWLEDGE_DIR = _HERE / "knowledge"

DEFAULT_FILES = {
    "traffic_policies.txt": """UrbanMind Traffic Policies
==========================
Policy TP-1 Lane closure: A lane closure requires 20 minutes advance public
advisory, cone barrier placement, and a signed BBMP diversion plan. Do not
close more than 3 concurrent lanes per corridor (rule R-31D).

Policy TP-2 Signal phase: Adaptive signal phasing may extend a green phase by
up to 15 seconds during an active emergency corridor. Bus stop dwell times
must be respected within a 50 m buffer.

Policy TP-3 School zone: Speed is capped at 25 km/h in school zones between
07:30-09:30 and 14:00-16:30. Signal preemption is disabled inside school
zones during those windows.

Policy TP-4 Monsoon: During monsoon rainfall > 25 mm/hour, all elevated
corridors reduce speed by 20 km/h and open drains are inspected within 30
minutes. Waterlogged junctions get a priority BBMP dispatch.
""",
    "police_sops.txt": """Traffic Police Standard Operating Procedures
==============================================
SOP-P1 Accident on arterial road: First responder logs incident, requests
tow, cordons a 100 m upstream buffer, and files a preliminary report within
15 minutes. Notify InterventionAgent for signal override request.

SOP-P2 Ambulance escort: Police pilot vehicle leads the emergency corridor
from the closest cross-junction to the destination hospital. Signal phase is
pre-empted (R-14B).

SOP-P3 Citizen alert: Public advisory is issued through the Public and BBMP
channels within 5 minutes of a severity>=4 event.
""",
    "ems_protocols.txt": """EMS Pre-arrival & Trauma Protocols
====================================
EMS-1 Trauma triage: Patients with GCS < 9, penetrating trauma, or
suspected internal bleeding are routed to Level-1 trauma capability
hospitals only.

EMS-2 Pre-arrival notification: Ambulance crew must transmit vitals and
mechanism-of-injury 5 minutes before arrival so the hospital ED can prep
the appropriate bay.

EMS-3 Ambulance selection: Nearest available ALS unit within 4 km takes
priority over closer BLS units for severity >= 4.
""",
    "hospital_guidance.txt": """Hospital Capability & Selection Guidance
==========================================
H-1 Capability matrix: Manipal (HAL) — Level-1 trauma, 24x7 neuro-ICU.
St. Johns — Level-2 trauma, burn unit. Sakra — Level-1 trauma, cath lab.

H-2 Selection ranking: Rank candidate hospitals by (trauma_level, ETA,
current_ED_load). Break ties on capability, not distance.

H-3 Diversion: If ED occupancy > 95 %, HospitalRoutingAgent must select the
next-ranked candidate and re-run pre-arrival notification.
""",
    "corridor_rules.txt": """Emergency Corridor Rules
==========================
C-1 Corridor definition: An emergency corridor is the sequence of signalized
junctions along the fastest ambulance path, preempted for green-wave.

C-2 Citizen alert: A push advisory must reach every commuter within 500 m
of the corridor at least 60 seconds before the ambulance arrives at each
junction.

C-3 Signal preemption: EmergencyCorridorAgent hands the phase plan to the
signal controller; ConstraintAgent must acknowledge (R-22C) before any
signal is forced.

C-4 Ambulance ETA: Publish updated ambulance ETA to citizen apps every 15
seconds while the corridor is active.
""",
}

# Loaded lazily.
KNOWLEDGE_BASE: dict = {}


def load_knowledge_files():
    """Ensure default files exist on disk, then load them into memory."""
    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    for fname, content in DEFAULT_FILES.items():
        p = KNOWLEDGE_DIR / fname
        if not p.exists():
            p.write_text(content, encoding="utf-8")

    KNOWLEDGE_BASE.clear()
    for p in sorted(KNOWLEDGE_DIR.glob("*.txt")):
        try:
            KNOWLEDGE_BASE[p.name] = p.read_text(encoding="utf-8")
        except Exception:
            continue
    return list(KNOWLEDGE_BASE.keys())


def _paragraphs(text: str):
    out = []
    for chunk in text.split("\n\n"):
        c = chunk.strip()
        if c:
            out.append(c)
    return out


def retrieve_context(query_terms: List[str], top_n: int = 3) -> Tuple[str, List[str]]:
    if not KNOWLEDGE_BASE:
        load_knowledge_files()

    terms = [t.lower().strip() for t in (query_terms or []) if t and t.strip()]
    if not terms:
        return ("No specific policy context found for this query.", [])

    hits = []  # (score, fname, paragraph)
    for fname, text in KNOWLEDGE_BASE.items():
        low = text.lower()
        for para in _paragraphs(text):
            plow = para.lower()
            score = sum(plow.count(t) for t in terms)
            if score > 0:
                hits.append((score, fname, para))

    if not hits:
        return ("No specific policy context found for this query.", [])

    hits.sort(key=lambda x: x[0], reverse=True)
    top = hits[:top_n]
    context = "\n\n---\n\n".join(f"[{fname}]\n{para}" for _, fname, para in top)
    refs = []
    for _, fname, _ in top:
        if fname not in refs:
            refs.append(fname)
    return (context, refs)
