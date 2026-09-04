from transformers import pipeline
from PIL import Image
import io

print("Loading MobileViT model... (first run downloads ~22MB, cached after)")
classifier = pipeline("image-classification", model="apple/mobilevit-small")
print("MobileViT ready.")

VEHICLE_LABELS = [
    "car","truck","bus","motorcycle","bicycle","vehicle","automobile","van","ambulance","traffic",
    "cab","taxi","limousine","limo","minivan","jeep","police van","tow truck","fire engine","fire truck",
    "trailer","tractor","pickup","sports car","convertible","racer","beach wagon","station wagon",
    "moped","scooter","tricycle","unicycle","freight car","passenger car","streetcar","tram","trolley",
    "recreational vehicle","school bus","garbage truck","moving van","snowplow","forklift","golfcart"
]
PERSON_LABELS = [
    "person","pedestrian","human","people","man","woman","child","boy","girl","cyclist","motorcyclist","rider"
]
ROAD_HAZARD_LABELS = [
    "traffic light","stop sign","street sign","fire hydrant","parking meter","bench","barrier",
    "smoke","fire","flame","spill","oil","glass","debris","cone","tunnel","bridge","road"
]

def analyze_image(image_bytes: bytes) -> dict:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    results = classifier(img, top_k=20)
    detected_labels = [r["label"].lower() for r in results if r["score"] > 0.08]
    top_scores = {r["label"].lower(): round(r["score"], 3) for r in results[:5]}
    vehicles = [l for l in detected_labels if any(v in l for v in VEHICLE_LABELS)]
    persons  = [l for l in detected_labels if any(p in l for p in PERSON_LABELS)]
    hazards  = [l for l in detected_labels if any(h in l for h in ROAD_HAZARD_LABELS)]
    vehicle_count = len(vehicles); person_detected = len(persons) > 0
    score = vehicle_count * 2 + (2 if person_detected else 0) + len(hazards)
    if score >= 5:
        verification_status, confidence = "supported", 0.82
    elif score >= 3:
        verification_status, confidence = "supported", 0.68
    elif score >= 1:
        verification_status, confidence = "needs_verification", 0.50
    else:
        verification_status, confidence = "insufficient_evidence", 0.25
    return {"objects_detected": detected_labels[:8], "vehicle_count": vehicle_count,
            "injury_indicators": person_detected, "confidence": confidence,
            "verification_status": verification_status, "top_predictions": top_scores,
            "hazards": hazards, "score": score,
            "note": "MobileViT pretrained model detects objects in image. Verification status indicates whether visible evidence is consistent with reported incident — not proof of accident.",
            "model": "apple/mobilevit-small"}
