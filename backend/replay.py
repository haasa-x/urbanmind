import asyncio
import json
import sys
import time
import httpx


async def main(path: str, speed: float = 1.0):
    with open(path) as f:
        scenario = json.load(f)
    events = scenario.get("events", [])
    print(f"Replaying {path} @ {speed}x — {len(events)} events")
    start = time.time()
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10.0) as client:
        for evt in events:
            target = evt.get("t", 0) / max(0.01, speed)
            now = time.time() - start
            if target > now:
                await asyncio.sleep(target - now)
            try:
                r = await client.post("/event", json=evt)
                print(f"[t={evt.get('t')}] {evt.get('type')} -> {r.status_code}")
            except Exception as e:
                print(f"[t={evt.get('t')}] error: {e}")


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else "scenarios/silk_board.json"
    s = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    asyncio.run(main(p, s))
