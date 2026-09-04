import asyncio
import json
import re
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from utils.city_state import CityState
from utils.severity_config import get as get_sev, SEVERITY_CONFIG
from utils.alert_dispatcher import AlertDispatcher
from agents.graph import agent_graph
from agents._llm import ask

app = FastAPI(title="UrbanMind 2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _never_500_middleware(request: Request, call_next):
    """Catch any exception in a route handler so a single bad request
    never brings the whole server down."""
    try:
        return await call_next(request)
    except Exception as e:
        try:
            print(f"[MW-CATCH] {request.method} {request.url.path} — {type(e).__name__}: {e}", flush=True)
        except Exception:
            pass
        return JSONResponse(status_code=500, content={"error": f"{type(e).__name__}: {e}"})


def _report_unhandled(loop, context):
    """asyncio background-task safety net so a raised exception inside
    asyncio.create_task(...) doesn't kill the process silently."""
    msg = context.get("exception") or context.get("message")
    try:
        print(f"[ASYNC-CATCH] {msg}", flush=True)
    except Exception:
        pass

city_state = CityState()
# Broadcast fan-out: one queue per connected SSE client.
_subscribers: "list[asyncio.Queue]" = []
_main_loop: asyncio.AbstractEventLoop = None
# Cap concurrent in-flight custom-incident graph runs. Prevents backend
# meltdown when the operator hammers "Submit" repeatedly.
_CUSTOM_SEM = asyncio.Semaphore(3)


def _task_watchdog(t):
    """asyncio task done-callback that surfaces silent exceptions."""
    try:
        exc = t.exception()
    except Exception:
        exc = None
    if exc:
        try:
            print(f"[TASK-CATCH] {type(exc).__name__}: {exc}", flush=True)
        except Exception:
            pass


def _broadcast_now(evt: dict):
    """Push an event to every connected SSE subscriber queue."""
    for q in list(_subscribers):
        try:
            q.put_nowait(evt)
        except Exception:
            pass


SCENARIO_SEVERITY = {"SC01": 3, "SC02": 4, "SC03": 2}
SCENARIO_INCIDENT_JUNCTION = {"SC01": "J1", "SC02": "H1", "SC03": "O1"}

# Rough set of known junctions for custom-incident location matching
KNOWN_JUNCTIONS = {
    "silk board": "J1", "btm": "J2", "hosur": "J3", "koramangala": "J4", "agara": "J5",
    "marathahalli": "O1", "kadubeesanahalli": "O2", "bellandur": "O3", "ibblur": "O4", "sarjapur": "O5",
    "hebbal": "H1", "mekhri": "H2", "bellary": "H3", "nagawara": "H4", "ganga nagar": "H5",
}


def _enqueue_sync(evt: dict):
    """Thread-safe enqueue used from worker threads while agent graph runs.
    Fans out to every subscriber."""
    if _main_loop is None:
        _broadcast_now(evt)
        return
    try:
        _main_loop.call_soon_threadsafe(_broadcast_now, evt)
    except Exception:
        pass


async def _enqueue(evt: dict):
    _broadcast_now(evt)


def _handle_event(evt: dict):
    et = evt.get("type")
    data = evt.get("data", {})
    if et == "SET_DENSITY":
        city_state.density.update(data)
        if city_state.emergency_active:
            try:
                agent_graph.invoke(city_state)
            except Exception as e:
                city_state.push_message("System", f"Agent graph error: {e}", "#ef4444")
    elif et == "ADD_MESSAGE":
        city_state.push_message(data.get("agent", "System"), data.get("text", ""), data.get("color", "#8b5cf6"))
    elif et == "SET_EMERGENCY":
        city_state.emergency_active = bool(data.get("value", False))
    elif et == "SET_ROUTE":
        city_state.route_visible = bool(data.get("value", False))
    elif et == "SET_NARRATOR":
        city_state.narrator_outputs.update(data)
    elif et == "INCREMENT_METRICS":
        for k, v in data.items():
            city_state.metrics[k] = city_state.metrics.get(k, 0) + v
    elif et == "SET_COMPLETION":
        city_state.completion_banner = data.get("text")

        async def clear():
            await asyncio.sleep(5)
            city_state.completion_banner = None
            await _enqueue({"type": "SET_COMPLETION", "data": {"text": None}})

        asyncio.create_task(clear()).add_done_callback(_task_watchdog)
    elif et == "SET_CUSTOM_BANNER":
        city_state.custom_banner = data.get("text")
    elif et == "ADD_ALERT":
        city_state.push_alert(data.get("department", ""), data.get("message", ""), data.get("icon", "!"))
    elif et == "SET_HOSPITAL":
        city_state.selected_hospital = data
    elif et == "SET_PROTOCOL":
        city_state.protocol_active = bool(data.get("value", False))
    elif et == "SET_SEVERITY":
        try:
            city_state.severity = int(data.get("value", 3))
        except Exception:
            pass


@app.on_event("startup")
async def _capture_loop():
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    _main_loop.set_exception_handler(_report_unhandled)


@app.on_event("startup")
async def _startup():
    try:
        from src.rag.retriever import load_knowledge_files
        load_knowledge_files()
    except Exception as e:
        print(f"RAG load failed (non-fatal): {e}")
    # Do NOT import vision.analyzer here — that would force MobileViT to load
    # even when the user never uploads an image. Load lazily inside /report.
    print("UrbanMind 2.0 ready.")


@app.post("/event")
async def post_event(request: Request):
    evt = await request.json()
    et = evt.get("type")
    if et in {"SET_DENSITY", "ADD_MESSAGE", "ADD_ALERT", "SET_EMERGENCY", "SET_HOSPITAL"}:
        _log("EVENT", "scripted", f"{et}", extra=str(evt.get("data", ""))[:120])
    _handle_event(evt)
    await _enqueue(evt)
    return {"ok": True}


@app.get("/state")
async def get_state():
    return JSONResponse(city_state.to_dict())


@app.post("/mode/{mode}")
async def set_mode(mode: str):
    city_state.active_mode = mode
    await _enqueue({"type": "SET_MODE", "data": {"mode": mode}})
    return {"ok": True, "mode": mode}


@app.get("/stream")
async def stream():
    # Sweep out unbounded subscriber growth from aborted requests.
    if len(_subscribers) > 20:
        drop = len(_subscribers) - 20
        del _subscribers[:drop]
    # Give this client its OWN queue so every subscriber sees every event.
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)

    async def gen():
        try:
            yield f"data: {json.dumps({'type': 'SNAPSHOT', 'data': city_state.to_dict()})}\n\n"
            while True:
                try:
                    evt = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield f"data: {json.dumps(evt)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'HEARTBEAT', 'ts': datetime.utcnow().isoformat()})}\n\n"
        finally:
            try:
                _subscribers.remove(q)
            except ValueError:
                pass

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


import sys as _sys
_USE_COLOR = _sys.stdout.isatty() and not bool(__import__("os").environ.get("NO_COLOR"))
ANSI = {
    "reset": "\033[0m" if _USE_COLOR else "",
    "bold":  "\033[1m" if _USE_COLOR else "",
    "dim":   "",  # dim renders invisibly on many terminals — never use it
    "cyan":    "\033[96m" if _USE_COLOR else "",
    "magenta": "\033[95m" if _USE_COLOR else "",
    "yellow":  "\033[93m" if _USE_COLOR else "",
    "green":   "\033[92m" if _USE_COLOR else "",
    "red":     "\033[91m" if _USE_COLOR else "",
    "blue":    "\033[94m" if _USE_COLOR else "",
    "gray":    "\033[37m" if _USE_COLOR else "",
}

AGENT_LOG_COLOR = {
    "IncidentAgent": "yellow", "PredictionAgent": "yellow",
    "SupervisingAgent": "magenta",
    "ConstraintAgent": "red",
    "InterventionAgent": "blue",
    "EmissionAgent": "green", "SafetyAgent": "green",
    "PoliceAgent": "blue", "EMSAgent": "cyan",
    "HospitalRoutingAgent": "cyan", "EmergencyCorridorAgent": "cyan",
    "ProtocolDispatchAgent": "magenta",
    "CommsAgent": "magenta", "NarratorAgent": "magenta",
    "System": "red",
}


def _now_iso():
    # Local wall-clock, millisecond precision, no timezone (readable in terminal).
    return datetime.now().isoformat(timespec="milliseconds")


def _log(kind: str, agent: str, text: str = "", extra: str = ""):
    """Plain-visible backend log. Two lines per event so the header
    (timestamp + kind + agent) stays visible even on narrow terminals."""
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    color = AGENT_LOG_COLOR.get(agent, "gray")
    c = ANSI[color]; r = ANSI["reset"]; b = ANSI["bold"]
    header = f"{ts}  {c}{b}[{kind}]{r}  {c}{b}{agent}{r}"
    if extra:
        header += f"   ({extra})"
    print(header, flush=True)
    if text:
        one = " ".join(str(text).split())
        print(f"    {one}", flush=True)


def _run_graph_streaming(state):
    """Run agent_graph.invoke and stream every push_message/push_alert to SSE
    as it happens by monkey-patching the state methods for the duration."""
    orig_msg = state.push_message
    orig_alert = state.push_alert

    def patched_msg(agent, text, color):
        orig_msg(agent, text, color)
        _log("MSG", agent, text)
        _enqueue_sync({"type": "ADD_MESSAGE", "data": {"agent": agent, "text": text, "color": color}})
        _enqueue_sync({"type": "AGENT_STATE", "data": {
            "agent": agent, "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
        }})

    def patched_alert(department, message, icon):
        orig_alert(department, message, icon)
        _log("ALERT", department, message, extra=f"icon={icon}")
        _enqueue_sync({"type": "ADD_ALERT", "data": {"department": department, "message": message, "icon": icon}})

    state.push_message = patched_msg
    state.push_alert = patched_alert
    print("\n────────────────────────────────────────────────────────────────", flush=True)
    _log("GRAPH", "orchestrator", f"invoke start · severity={getattr(state, 'severity', '?')} · emergency={state.emergency_active}")
    t0 = datetime.now()
    try:
        agent_graph.invoke(state)
    finally:
        state.push_message = orig_msg
        state.push_alert = orig_alert
    dt_ms = int((datetime.now() - t0).total_seconds() * 1000)
    _log("GRAPH", "orchestrator", f"invoke complete", extra=f"took={dt_ms}ms")
    plan = state.__dict__.get("_supervisor_plan")
    if plan:
        _log("PLAN", "SupervisingAgent",
             f"{plan.get('sequence_key','?').upper()} · priority {plan.get('priority_level','?')}",
             extra=f"sequence=[{', '.join(plan.get('sequence', []))}]")
        _enqueue_sync({"type": "SUPERVISOR_PLAN", "data": plan})
    print("────────────────────────────────────────────────────────────────\n", flush=True)


BASE_METRICS = {
    "vehicle_minutes_saved": 500,
    "co2_avoided_kg": 120,
    "corridors_cleared": 1,
    "incidents_prevented": 1,
}


def _scaled_metrics(sev: int):
    cfg = get_sev(sev)
    return {
        "vehicle_minutes_saved": int(BASE_METRICS["vehicle_minutes_saved"] * cfg["vehicle_minutes_multiplier"]),
        "co2_avoided_kg": int(BASE_METRICS["co2_avoided_kg"] * cfg["co2_multiplier"]),
        "corridors_cleared": 1 if cfg.get("emergency_corridor") else 0,
        "incidents_prevented": 1 if cfg.get("is_accident") else 0,
    }


@app.post("/invoke_scenario/{scenario_id}")
async def invoke_scenario(scenario_id: str):
    sid = scenario_id.upper()
    junction = SCENARIO_INCIDENT_JUNCTION.get(sid, "J1")
    sev = SCENARIO_SEVERITY.get(sid, 3)
    _log("INTAKE", "System", f"scripted scenario {sid} received", extra=f"sev={sev} junction={junction}")
    city_state.severity = sev
    city_state.emergency_active = True
    city_state.density[junction] = 0.89
    _log("SCENARIO", "System", f"loading scripted scenario", extra=f"id={sid} junction={junction}")

    msg_start = len(city_state.messages)
    alert_start = len(city_state.department_alerts)

    def _invoke():
        try:
            _run_graph_streaming(city_state)
        except Exception as e:
            city_state.push_message("System", f"Agent graph error: {e}", "#ef4444")

    await asyncio.to_thread(_invoke)

    plan = city_state.__dict__.get("_supervisor_plan")
    if plan:
        await _enqueue({"type": "SUPERVISOR_PLAN", "data": plan})

    metrics = _scaled_metrics(sev)
    for k, v in metrics.items():
        city_state.metrics[k] = city_state.metrics.get(k, 0) + v
    await _enqueue({"type": "INCREMENT_METRICS", "data": metrics})

    return {"ok": True, "scenario": sid, "junction": junction, "severity": sev,
            "new_messages": len(city_state.messages) - msg_start}


def _parse_incident_json(raw: str):
    """Extract a JSON object from an LLM response with a regex fallback."""
    if not raw:
        return None
    # try direct
    try:
        return json.loads(raw)
    except Exception:
        pass
    # regex first {...}
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


def _extract_incident(description: str, severity: int):
    cfg = get_sev(severity)
    fallback = {
        "incident_type": "congestion" if severity < 4 else "accident",
        "estimated_vehicles_affected": 30 * severity,
        "road_type": "arterial",
        "is_accident": bool(cfg.get("is_accident")),
        "suggested_departments": cfg["departments_alerted"],
    }
    prompt = (
        "You are an incident classifier. Read the description and reply with a "
        "single JSON object only (no prose), with keys: incident_type (string), "
        "estimated_vehicles_affected (integer), road_type (string), "
        "is_accident (boolean), suggested_departments (array of strings from "
        "['Public','Traffic Police','BBMP','Fire','Hospital']).\n"
        f"Severity: {severity}/5 ({cfg['label']}).\n"
        f"Description: {description}\nJSON:"
    )
    raw = ask(prompt, json.dumps(fallback))
    parsed = _parse_incident_json(raw)
    if not isinstance(parsed, dict):
        return fallback
    # coerce
    out = dict(fallback)
    for k in ("incident_type", "road_type"):
        if k in parsed and isinstance(parsed[k], str):
            out[k] = parsed[k]
    if "estimated_vehicles_affected" in parsed:
        try:
            out["estimated_vehicles_affected"] = int(parsed["estimated_vehicles_affected"])
        except Exception:
            pass
    if "is_accident" in parsed:
        out["is_accident"] = bool(parsed["is_accident"])
    if isinstance(parsed.get("suggested_departments"), list):
        out["suggested_departments"] = [str(x) for x in parsed["suggested_departments"]]
    return out


def _junction_from_location(location: str) -> str:
    if not location:
        return "J1"
    low = location.lower()
    for name, jid in KNOWN_JUNCTIONS.items():
        if name in low:
            return jid
    return "J1"


async def _run_custom(body: dict) -> dict:
    # Cap concurrent in-flight graph runs to prevent hangs under load.
    async with _CUSTOM_SEM:
        return await _run_custom_impl(body)


async def _run_custom_impl(body: dict) -> dict:
    description = str(body.get("description", "")).strip() or "Unspecified incident"
    _log("INTAKE", "System", f"custom incident received", extra=f"sev={body.get('severity')} loc={body.get('location')!r}")
    try:
        severity = int(body.get("severity", 3))
    except Exception:
        severity = 3
    severity = max(1, min(5, severity))
    location = str(body.get("location", "")).strip() or "J1"
    image_analysis = body.get("image_analysis")

    # --- Emit SCENARIO_LOADED so operator + department dashboards can render
    # the incident pin, map center and route without needing to build a
    # synthetic scenario client-side. Geocode the location; fall back to Silk
    # Board (matches DEFAULT_ORIGIN) if lookup fails.
    lat, lon = 12.9177, 77.6228
    try:
        from src.routing.osrm_router import geocode as _geocode
        geo = await _geocode(location) if location else None
        if geo and geo.get("lat") is not None:
            lat = float(geo["lat"])
            lon = float(geo.get("lng") or geo.get("lon") or lon)
    except Exception:
        pass

    custom_sc = {
        "id": "CUSTOM",
        "code": "CUSTOM",
        "label": (description or "Custom Incident")[:60],
        "description": description,
        "severity": severity,
        "mapCenter": [lat, lon],
        "mapZoom": 14,
        "junctions": [
            {"id": "X1", "name": location or "Incident", "lat": lat, "lng": lon}
        ],
        "totalDuration": 60,
        "events": [],
    }
    city_state.custom_scenario = custom_sc
    _log("SCENARIO", "System", f"custom scenario prepared", extra=f"center=[{lat:.4f},{lon:.4f}] label={custom_sc['label']!r}")
    await _enqueue({"type": "SCENARIO_LOADED", "data": custom_sc})
    # Always mark emergency active so the incident pin renders on every map.
    city_state.emergency_active = True
    await _enqueue({"type": "SET_EMERGENCY", "data": {"value": True}})
    await _enqueue({"type": "SET_SEVERITY", "data": {"value": severity}})
    if severity >= 3:
        city_state.route_visible = True
        await _enqueue({"type": "SET_ROUTE", "data": {"value": True}})

    parsed = _extract_incident(description, severity)
    body_is_accident = bool(body.get("is_accident"))
    if body_is_accident:
        parsed["is_accident"] = True
        parsed["incident_type"] = "accident"
    city_state.__dict__["_parsed_custom"] = {
        **parsed,
        "description": description,
        "location": location,
        "injury_indicators": (image_analysis or {}).get("injury_indicators")
            if isinstance(image_analysis, dict) else None,
    }

    junction = _junction_from_location(location)
    city_state.severity = severity
    # emergency_active already set to True above (all custom incidents show pin)
    city_state.density[junction] = max(0.85, city_state.density.get(junction, 0.4))

    banner_text = f"CUSTOM INCIDENT ACTIVE — {description[:60]}"
    city_state.custom_banner = banner_text
    await _enqueue({"type": "SET_CUSTOM_BANNER", "data": {"text": banner_text}})
    await _enqueue({"type": "SET_DENSITY", "data": {junction: city_state.density[junction]}})

    def _invoke():
        try:
            _run_graph_streaming(city_state)
        except Exception as e:
            city_state.push_message("System", f"Agent graph error: {e}", "#ef4444")
            _enqueue_sync({"type": "ADD_MESSAGE", "data": {"agent": "System", "text": f"Agent graph error: {e}", "color": "#ef4444"}})

    await asyncio.to_thread(_invoke)

    # Dispatch department alerts for the custom incident. The supervisor
    # sometimes picks a sequence (e.g. congestion) that omits Police/Hospital
    # agents; department alerts should still fire based on severity.
    try:
        incident_type = parsed.get("incident_type") or ("accident" if body_is_accident else "congestion")
        dispatched = AlertDispatcher.dispatch(
            incident_type=incident_type,
            severity=severity,
            location=location or junction,
            selected_hospital=getattr(city_state, "selected_hospital", None),
        )
        for a in dispatched:
            city_state.push_alert(a.get("department", ""), a.get("message", ""), a.get("icon", "!"))
            await _enqueue({"type": "ADD_ALERT", "data": {
                "department": a.get("department", ""),
                "message": a.get("message", ""),
                "icon": a.get("icon", "!"),
            }})
    except Exception as e:
        city_state.push_message("System", f"Alert dispatch failed: {e}", "#ef4444")

    metrics = _scaled_metrics(severity)
    for k, v in metrics.items():
        city_state.metrics[k] = city_state.metrics.get(k, 0) + v
    await _enqueue({"type": "INCREMENT_METRICS", "data": metrics})

    # Clear custom banner after a while
    async def _clear_banner():
        await asyncio.sleep(20)
        city_state.custom_banner = None
        city_state.custom_scenario = None
        await _enqueue({"type": "SET_CUSTOM_BANNER", "data": {"text": None}})

    asyncio.create_task(_clear_banner()).add_done_callback(_task_watchdog)

    return {"ok": True, "parsed": parsed, "severity": severity, "junction": junction,
            "image_analysis": image_analysis}


@app.post("/custom-incident")
async def custom_incident(request: Request):
    body = await request.json()
    # Fire the agent pipeline in the background so the HTTP response is
    # immediate; agent messages and department alerts stream via SSE.
    asyncio.create_task(_run_custom(body)).add_done_callback(_task_watchdog)
    return {"ok": True, "queued": True}


@app.post("/route")
async def compute_route(request: Request):
    body = await request.json()
    from src.routing.osrm_router import get_route, get_cached_route
    route_key = body.get("cache_key")
    if route_key:
        cached = get_cached_route(route_key)
        if cached:
            return {"primary": cached, "alternatives": [], "cached": True}
    return await get_route(
        body["origin_lat"], body["origin_lon"],
        body["dest_lat"], body["dest_lon"],
        alternatives=body.get("alternatives", True),
    )


@app.post("/geocode")
async def geocode_location(request: Request):
    body = await request.json()
    from src.routing.osrm_router import geocode
    result = await geocode(body["query"])
    if not result:
        return {"error": "Location not found. Try being more specific, e.g. 'Silk Board, Bangalore'"}
    return result


@app.post("/report")
async def report_incident(request: Request):
    """Multipart: description, severity, location, optional image file."""
    form = await request.form()
    description = form.get("description", "")
    try:
        severity = int(form.get("severity", 3))
    except Exception:
        severity = 3
    location = form.get("location", "")
    image = form.get("image")
    image_analysis = None
    if image is not None and hasattr(image, "read"):
        try:
            data = await image.read()
            from src.vision.analyzer import analyze_image  # lazy import
            image_analysis = analyze_image(data)
        except Exception as e:
            image_analysis = {"error": f"Vision failed: {e}"}
    if (isinstance(image_analysis, dict)
            and image_analysis.get("verification_status") == "supported"
            and image_analysis.get("injury_indicators")):
        severity = max(severity, 4)
    payload = {"description": description, "severity": severity, "location": location,
               "image_analysis": image_analysis,
               "is_accident": bool(isinstance(image_analysis, dict)
                                   and image_analysis.get("verification_status") == "supported"
                                   and image_analysis.get("injury_indicators"))}
    # Return the vision verdict immediately; run the agent pipeline in the
    # background so the frontend renders the VisionAgent card without waiting
    # on the full multi-agent graph (5-60s otherwise).
    asyncio.create_task(_run_custom(payload)).add_done_callback(_task_watchdog)
    return {"ok": True, "image_analysis": image_analysis}


@app.get("/alerts/{department}")
async def alerts_for(department: str):
    q = (department or "").strip().lower()
    matches = [a for a in city_state.department_alerts if q in (a.get("department", "").lower())]
    return JSONResponse(matches)


@app.post("/medical-assessment")
async def medical_assessment(body: dict):
    incident_id = body.get("incident_id", "custom")
    raw = str(body.get("raw_assessment_text", "")).strip()
    if not raw:
        return {"error": "raw_assessment_text required"}
    from agents import ems, hospital_routing
    summary = ems.assess(raw, incident_id)
    city_state.__dict__["_ems_assessment"] = summary
    # Origin: prefer the live custom-scenario junction, else Silk Board fallback.
    origin = {"lat": 12.9177, "lng": 77.6228}
    try:
        cs = city_state.custom_scenario or {}
        j = (cs.get("junctions") or [None])[0]
        if j and "lat" in j and ("lng" in j or "lon" in j):
            origin = {"lat": float(j["lat"]), "lng": float(j.get("lng", j.get("lon")))}
    except Exception:
        pass
    # Combine field assessment + EMS dispatch + incident-type capabilities.
    caps = hospital_routing._collect_required_capabilities(city_state)
    hospital = hospital_routing.select_capability_hospital(caps, origin)
    if hospital:
        city_state.selected_hospital = hospital
        text = (f"HOSPITAL SELECTED (re-select): {hospital['name']} — "
                f"matched capabilities [{hospital['capability_matched']}], "
                f"ETA {hospital['eta_from_J1']} min, "
                f"using EMS dispatch + field assessment")
        city_state.push_message("HospitalRoutingAgent", text, "#06b6d4")
        _log("MSG", "HospitalRoutingAgent", text, extra="re-select")
        await _enqueue({"type": "ADD_MESSAGE", "data": {
            "agent": "HospitalRoutingAgent", "text": text, "color": "#06b6d4"}})
    record = {
        "incident_id": incident_id,
        "raw": raw,
        "summary": summary,
        "hospital": hospital,
        "timestamp": datetime.utcnow().isoformat(),
    }
    city_state.medical_assessments.append(record)
    await _enqueue({
        "type": "MEDICAL_ASSESSMENT",
        "data": {"incident_id": incident_id, "raw": raw,
                 "summary": summary, "hospital": hospital},
    })
    if hospital:
        await _enqueue({"type": "SET_HOSPITAL", "data": hospital})
    return {"ok": True, "summary": summary, "hospital": hospital}


@app.get("/medical-assessments")
async def list_medical_assessments():
    return JSONResponse(city_state.medical_assessments)


_HOSPITAL_CACHE = None


@app.get("/hospitals")
async def list_hospitals():
    global _HOSPITAL_CACHE
    if _HOSPITAL_CACHE is None:
        import os
        path = os.path.join(os.path.dirname(__file__), "data", "hospitals.json")
        try:
            with open(path, "r") as f:
                _HOSPITAL_CACHE = json.load(f)
        except Exception:
            _HOSPITAL_CACHE = []
    return JSONResponse(_HOSPITAL_CACHE)


@app.get("/")
async def root():
    return {"service": "UrbanMind 2.0", "status": "ok"}
