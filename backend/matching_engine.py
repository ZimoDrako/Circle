"""Adaptive matching engine for Circle.

The model separates hard constraints from soft compatibility. It deliberately keeps
inferred interests lower-confidence than interests a student explicitly selected.
"""
from __future__ import annotations
from typing import Any, Dict, List, Tuple
import math

RELATED: Dict[str, Dict[str, float]] = {
    "anime": {"manga": .88, "cosplay": .62, "japanese culture": .58, "tcg": .42, "gaming": .38},
    "manga": {"anime": .88, "cosplay": .55, "japanese culture": .52, "reading": .32},
    "gaming": {"esports": .62, "pc gaming": .58, "playstation": .55, "nintendo": .52, "board games": .28},
    "esports": {"gaming": .70, "competitive gaming": .82, "twitch": .45},
    "hip-hop": {"rap": .90, "r&b": .46, "concerts": .42, "music production": .30},
    "r&b": {"hip-hop": .46, "concerts": .38, "singing": .30},
    "edm": {"festivals": .68, "djing": .56, "nightlife": .48, "concerts": .45},
    "music production": {"djing": .55, "songwriting": .52, "hip-hop": .30},
    "basketball": {"nba": .72, "fitness": .38, "sports": .55},
    "soccer": {"sports": .58, "fitness": .36, "outdoors": .20},
    "gym": {"fitness": .90, "weightlifting": .78, "nutrition": .42, "running": .28},
    "fitness": {"gym": .90, "running": .58, "hiking": .32, "nutrition": .42},
    "hiking": {"outdoors": .88, "camping": .70, "travel": .38, "photography": .30},
    "photography": {"film": .36, "travel": .34, "art": .45, "content creation": .48},
    "fashion": {"thrifting": .58, "streetwear": .72, "sneakers": .64, "photography": .24},
    "cars": {"motorsports": .66, "car meets": .72, "engineering": .30},
    "coding": {"technology": .75, "ai": .58, "startups": .36, "hackathons": .58},
    "ai": {"coding": .58, "technology": .76, "startups": .42, "entrepreneurship": .38},
    "entrepreneurship": {"startups": .82, "business": .64, "finance": .38, "networking": .44},
    "finance": {"business": .52, "investing": .82, "entrepreneurship": .38},
    "coffee": {"cafes": .82, "food": .40, "study sessions": .35},
    "food": {"cooking": .56, "restaurants": .76, "coffee": .40, "travel": .26},
    "travel": {"languages": .38, "photography": .34, "food": .26, "outdoors": .30},
    "volunteering": {"community service": .86, "nonprofits": .52, "activism": .30},
    "books": {"reading": .92, "writing": .42, "book clubs": .64},
    "movies": {"film": .82, "tv": .48, "acting": .28},
    "art": {"design": .52, "drawing": .68, "museums": .46, "photography": .45},
}

SIMILARITY_TRAITS = {"depth", "energy", "spontaneity", "adventurous", "party_level", "study_style", "activity_level"}
BALANCE_TRAITS = {"extroversion", "initiative"}
OPTION_MAX = {
    "arrival": 4, "friday_night": 6, "spontaneous": 4, "group_size": 4,
    "new_people": 4, "plans_change": 4, "conversation": 4, "weekend_energy": 4,
    "social_battery": 4, "invite_style": 4,
}
# Whether a lower option index represents MORE of the dimension.
QUESTION_AXES = {
    "arrival": ("extroversion", True), "new_people": ("extroversion", True),
    "spontaneous": ("spontaneity", True), "plans_change": ("spontaneity", True),
    "conversation": ("depth", False), "weekend_energy": ("energy", True),
    "social_battery": ("energy", True), "invite_style": ("initiative", True),
    "group_size": ("group_size", False), "friday_night": ("party_level", True),
}

def _norm(s: Any) -> str:
    return str(s or "").strip().casefold()

def _jaccard(a: set, b: set) -> float:
    return len(a & b) / max(1, len(a | b)) if a and b else 0.0

def infer_interests(interests: List[str]) -> Dict[str, float]:
    explicit = {_norm(x) for x in interests if _norm(x)}
    inferred: Dict[str, float] = {}
    for interest in explicit:
        for related, strength in RELATED.get(interest, {}).items():
            if related not in explicit:
                inferred[related] = max(inferred.get(related, 0.0), round(strength * .55, 3))
    return dict(sorted(inferred.items(), key=lambda x: x[1], reverse=True)[:30])

def build_matching_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    personality = {k: float(v) for k, v in (data.get("personality") or {}).items() if isinstance(v, (int, float))}
    social = data.get("social_style") or {}
    axes: Dict[str, List[float]] = {}
    for qid, raw in social.items():
        if qid not in QUESTION_AXES or not isinstance(raw, (int, float)):
            continue
        axis, reverse = QUESTION_AXES[qid]
        mx = OPTION_MAX.get(qid, 4)
        v = max(0.0, min(1.0, float(raw) / mx))
        if reverse:
            v = 1.0 - v
        axes.setdefault(axis, []).append(v * 100)
    for axis, vals in axes.items():
        survey_v = sum(vals) / len(vals)
        if axis in personality:
            personality[axis] = round(personality[axis] * .65 + survey_v * .35, 1)
        else:
            personality[axis] = round(survey_v, 1)
    return {
        "traits": personality,
        "survey_consistency": round(_survey_consistency(social), 3),
        "profile_confidence": round(min(1.0, .35 + .04 * len(social) + .025 * len(personality)), 3),
    }

def _survey_consistency(social: Dict[str, Any]) -> float:
    pairs = [("arrival", "new_people"), ("spontaneous", "plans_change"), ("weekend_energy", "social_battery")]
    scores = []
    for a, b in pairs:
        if a in social and b in social:
            av = float(social[a]) / OPTION_MAX[a]
            bv = float(social[b]) / OPTION_MAX[b]
            scores.append(1 - min(1.0, abs(av - bv)))
    return sum(scores) / len(scores) if scores else .5

def _interest_vector(u: Dict[str, Any]) -> Dict[str, float]:
    levels = {_norm(k): max(.1, min(1.0, float(v))) for k, v in (u.get("interest_levels") or {}).items() if _norm(k) and isinstance(v, (int, float))}
    for x in u.get("interests") or []:
        levels.setdefault(_norm(x), 1.0)
    for k, v in (u.get("inferred_interests") or {}).items():
        if _norm(k) and isinstance(v, (int, float)):
            levels[_norm(k)] = max(levels.get(_norm(k), 0), min(.65, float(v)))
    return levels

def _interest_score(a: Dict[str, Any], b: Dict[str, Any]) -> Tuple[float, List[str]]:
    av, bv = _interest_vector(a), _interest_vector(b)
    if not av or not bv:
        return 0.0, []
    shared_keys = av.keys() & bv.keys()
    direct = sum(min(av[k], bv[k]) for k in shared_keys)
    # Weighted overlap coefficient: selecting many genuine interests should not
    # punish a student simply because another profile listed fewer interests.
    # Blend it with weighted Dice so broad profiles still need meaningful overlap.
    smaller_mass = max(1.0, min(sum(av.values()), sum(bv.values())))
    total_mass = max(1.0, sum(av.values()) + sum(bv.values()))
    overlap = direct / smaller_mass
    dice = (2.0 * direct) / total_mass
    direct_score = overlap * .70 + dice * .30
    related = 0.0
    related_pairs = []
    for ai, aw in av.items():
        for bi, bw in bv.items():
            rel = max(RELATED.get(ai, {}).get(bi, 0), RELATED.get(bi, {}).get(ai, 0))
            if rel:
                val = aw * bw * rel
                if val > related:
                    related_pairs = [(ai, bi)]
                related = max(related, val)
    score = min(1.0, direct_score * 1.12 + related * .22)
    shared = sorted(av.keys() & bv.keys(), key=lambda k: min(av[k], bv[k]), reverse=True)[:3]
    reasons = [f"You both like {x.title()}" for x in shared]
    if not reasons and related_pairs:
        reasons.append(f"Related interests: {related_pairs[0][0].title()} + {related_pairs[0][1].title()}")
    return score, reasons

def _trait_score(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    ap = (a.get("matching_profile") or {}).get("traits") or a.get("personality") or {}
    bp = (b.get("matching_profile") or {}).get("traits") or b.get("personality") or {}
    keys = set(ap) & set(bp)
    if not keys:
        return .5
    vals = []
    for k in keys:
        try:
            diff = abs(float(ap[k]) - float(bp[k])) / 100
        except (TypeError, ValueError):
            continue
        if k in BALANCE_TRAITS:
            # Moderate complementarity can help groups; extreme opposites are penalized.
            vals.append(max(0.0, 1.0 - abs(diff - .25) * 1.2))
        else:
            vals.append(1.0 - diff)
    return sum(vals) / len(vals) if vals else .5

def compatibility(a: Dict[str, Any], b: Dict[str, Any]) -> Tuple[int, List[str]]:
    reasons: List[str] = []
    interest, interest_reasons = _interest_score(a, b)
    reasons.extend(interest_reasons)

    alf = {_norm(x) for x in a.get("looking_for") or []}
    blf = {_norm(x) for x in b.get("looking_for") or []}
    goals = _jaccard(alf, blf)
    if alf & blf:
        reasons.append("Looking for similar connections")

    ad, bd = set(a.get("availability_days") or []), set(b.get("availability_days") or [])
    at, bt = set(a.get("availability_times") or []), set(b.get("availability_times") or [])
    availability = .5 * _jaccard(ad, bd) + .5 * _jaccard(at, bt)
    if ad & bd and at & bt:
        reasons.append("Your schedules overlap")

    traits = _trait_score(a, b)
    if traits >= .78:
        reasons.append("Compatible social energy")

    same_campus = 1.0 if a.get("university") and a.get("university") == b.get("university") else 0.0
    academic = 0.0
    if a.get("year") and a.get("year") == b.get("year"):
        academic += .45
    if a.get("major") and b.get("major") and _norm(a["major"]) == _norm(b["major"]):
        academic += .55

    # Confidence shrinks uncertain profiles toward a neutral score instead of over-ranking them.
    ac = float((a.get("matching_profile") or {}).get("profile_confidence", .55))
    bc = float((b.get("matching_profile") or {}).get("profile_confidence", .55))
    confidence = max(.45, min(1.0, (ac + bc) / 2))

    raw = interest*.30 + traits*.24 + goals*.16 + availability*.14 + same_campus*.10 + academic*.06
    calibrated = .5 + (raw - .5) * confidence
    return int(round(max(0, min(100, calibrated * 100)))), reasons[:5]

def people_preference_allows(preference: str, already_connected: bool) -> bool:
    p = _norm(preference)
    if "new" in p:
        return not already_connected
    if "friend" in p and "either" not in p:
        return already_connected
    return True
