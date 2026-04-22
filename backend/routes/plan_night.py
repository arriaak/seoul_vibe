import math
import random
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.naver import fetch_naver_places, is_valid_place

router = APIRouter()

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "processed_neighborhoods.csv"

# ── Weighted scoring maps ─────────────────────────────────────────────────────

ENERGY_MAP = {
    "high":   {"nightlife": 0.8, "trendy": 0.5, "adventurous": 0.6},
    "medium": {"trendy": 0.5, "adventurous": 0.4, "nightlife": 0.3, "chill": 0.3},
    "low":    {"chill": 0.8, "trendy": 0.2, "adventurous": 0.2},
}

TIME_MAP = {
    "afternoon":  {"chill": 0.7, "trendy": 0.5, "adventurous": 0.3},
    "evening":    {"trendy": 0.6, "nightlife": 0.5, "chill": 0.2, "adventurous": 0.5},
    "late night": {"nightlife": 0.9, "trendy": 0.3, "adventurous": 0.4},
    "late":       {"nightlife": 0.9, "trendy": 0.3, "adventurous": 0.4},
}

MOOD_MAP = {
    "food":    {"trendy": 0.7, "adventurous": 0.8, "nightlife": 0.2, "chill": 0.3},
    "coffee":  {"chill": 0.9, "trendy": 0.4, "adventurous": 0.2},
    "explore": {"adventurous": 0.9, "trendy": 0.6, "nightlife": 0.3, "chill": 0.2},
    "party":   {"nightlife": 1.0, "trendy": 0.5, "adventurous": 0.3},
}

# CSV column to use when scoring neighborhoods for each vibe
VIBE_CSV_COL = {
    "nightlife":   "vibe_nightlife",
    "chill":       "vibe_chill",
    "trendy":      "vibe_trendy",
    "adventurous": "vibe_trendy",   # adventurous uses trendy as a proxy
}

# ── Stop configs ──────────────────────────────────────────────────────────────
# Keys are stop types; each config drives Naver query + category scoring.

STOP_CONFIGS: dict[str, dict] = {
    "cafe":       {"query_suffix": "분위기 좋은 카페", "category_keywords": ["카페", "커피", "디저트"],                          "exclude_keywords": ["음식점", "술집", "주점", "호프"]},
    "restaurant": {"query_suffix": "인기 맛집",        "category_keywords": ["음식점", "한식", "일식", "중식", "양식", "분식"], "exclude_keywords": ["카페", "커피", "술집", "주점"]},
    "bar":        {"query_suffix": "분위기 좋은 술집", "category_keywords": ["술집", "바", "주점", "호프", "와인"],             "exclude_keywords": ["카페", "커피"]},
}


class PlanRequest(BaseModel):
    energy: str
    time: str
    mood: str
    neighborhood: Optional[str] = None


# ── Vibe profile ──────────────────────────────────────────────────────────────

def build_vibe_profile(energy: str, time: str, mood: str) -> dict[str, float]:
    """Combine all input signals into a weighted score for each vibe dimension."""
    scores: dict[str, float] = {"nightlife": 0.0, "chill": 0.0, "trendy": 0.0, "adventurous": 0.0}
    for mapping in [
        ENERGY_MAP.get(energy.lower(), {}),
        TIME_MAP.get(time.lower(), {}),
        MOOD_MAP.get(mood.lower(), {}),
    ]:
        for k, w in mapping.items():
            scores[k] = scores.get(k, 0.0) + w
    return scores


def get_vibes(profile: dict[str, float]) -> tuple[str, str]:
    """Return (primary, secondary) by descending score."""
    ranked = sorted(profile, key=lambda v: profile[v], reverse=True)
    return ranked[0], ranked[1]


# ── Neighborhood ──────────────────────────────────────────────────────────────

def pick_neighborhood(primary: str, secondary: str) -> str:
    """Score all districts by 0.7×primary + 0.3×secondary, pick randomly from top 5."""
    df = pd.read_csv(DATA_PATH)
    p_col = VIBE_CSV_COL.get(primary, "vibe_trendy")
    s_col = VIBE_CSV_COL.get(secondary, "vibe_trendy")
    df["_score"] = 0.7 * df[p_col] + 0.3 * df[s_col]
    top5 = df.nlargest(5, "_score")["district"].tolist()
    return random.choice(top5)


# ── Itinerary structure ───────────────────────────────────────────────────────

def build_stop_sequence(mood: str, time: str) -> list[str]:
    """Determine stop order from mood + time. Returns a list of stop-type strings.
    Duplicate entries (e.g. two cafes) are handled downstream with seen_names dedup."""
    m = mood.lower()
    is_afternoon = "afternoon" in time.lower()
    is_late = "late" in time.lower()

    if is_afternoon:
        # No bars in the afternoon
        if m == "coffee":
            return ["cafe", "cafe", "restaurant"]   # cafe-focused outing
        return ["cafe", "restaurant"]

    if m == "coffee":
        return ["cafe", "restaurant", "cafe"]       # bookended by cafes, no bar
    if m == "food":
        return ["cafe", "restaurant", "bar"]        # restaurant is the main event
    if m == "party":
        return ["restaurant", "bar", "bar"]         # bar-crawl: two different bars
    if m == "explore":
        return ["bar", "cafe", "restaurant"] if is_late else ["cafe", "restaurant", "bar"]

    return ["cafe", "restaurant", "bar"]


# ── Place scoring & selection ─────────────────────────────────────────────────

def score_place(place: dict, category_keywords: list[str]) -> int:
    score = 0
    if len(place["name"]) > 5:
        score += 1
    if is_valid_place(place["name"]):
        score += 1
    if any(kw in place["category"] for kw in category_keywords):
        score += 2
    return score


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


RADIUS_KM = 1.5


def pick_best(candidates: list[dict], category_keywords: list[str], anchor: dict | None) -> dict | None:
    """Return a high-scoring candidate within RADIUS_KM of anchor.
    Picks randomly from the top-3 to give variety across repeated calls."""
    if not candidates:
        return None

    scored = sorted(candidates, key=lambda p: score_place(p, category_keywords), reverse=True)

    if anchor is None or anchor.get("lat") is None:
        return random.choice(scored[:min(3, len(scored))])

    nearby = [
        p for p in scored
        if p.get("lat") and p.get("lng")
        and haversine_km(anchor["lat"], anchor["lng"], p["lat"], p["lng"]) <= RADIUS_KM
    ]
    if nearby:
        return random.choice(nearby[:min(3, len(nearby))])

    # Fallback: nothing within radius — closest among top-5
    return min(scored[:5], key=lambda p: (
        haversine_km(anchor["lat"], anchor["lng"], p["lat"], p["lng"])
        if p.get("lat") and p.get("lng") else float("inf")
    ))


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/plan-night")
def plan_night(req: PlanRequest):
    profile = build_vibe_profile(req.energy, req.time, req.mood)
    primary, secondary = get_vibes(profile)
    neighborhood = req.neighborhood or pick_neighborhood(primary, secondary)

    stop_types              = build_stop_sequence(req.mood, req.time)
    user_chose_neighborhood = bool(req.neighborhood)

    itinerary:   list[dict] = []
    anchor:      dict | None = None
    seen_names:  set[str]    = set()   # prevents duplicate places when a type appears twice

    for stop_type in stop_types:
        cfg = STOP_CONFIGS.get(stop_type)
        if not cfg:
            continue

        query = f"{neighborhood} {cfg['query_suffix']}"
        try:
            candidates = fetch_naver_places(query, display=50)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e))

        # Keep only places in the target district
        in_hood = [p for p in candidates if neighborhood in p.get("address", "")]
        if user_chose_neighborhood:
            if not in_hood:
                continue
            candidates = in_hood
        else:
            candidates = in_hood or candidates

        # Remove results that belong to a different stop type
        exclude = cfg.get("exclude_keywords", [])
        if exclude:
            filtered = [p for p in candidates if not any(kw in p.get("category", "") for kw in exclude)]
            if filtered:
                candidates = filtered

        # Deduplicate across stops (handles two-cafe or two-bar sequences)
        candidates = [p for p in candidates if p["name"] not in seen_names]

        best = pick_best(candidates, cfg["category_keywords"], anchor)
        if best:
            itinerary.append({
                "type":       stop_type,
                "name":       best["name"],
                "address":    best["address"],
                "category":   best["category"],
                "lat":        best["lat"],
                "lng":        best["lng"],
                "naver_link": best["naver_link"],
            })
            seen_names.add(best["name"])
            if anchor is None and best.get("lat") is not None:
                anchor = best

    return {
        "neighborhood":   neighborhood,
        "primary_vibe":   primary,
        "secondary_vibe": secondary,
        "itinerary":      itinerary,
    }
