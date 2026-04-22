from fastapi import APIRouter, HTTPException, Query
from utils.naver import fetch_naver_places

router = APIRouter()

VIBE_PHRASES = {
    "chill":        "카페",
    "nightlife":    "술집",
    "trendy":       "맛집",
    "indie":        "카페",
    "classy":       "레스토랑",
    "adventurous":  "맛집",
}


@router.get("/places")
def search_places(
    neighborhood: str = Query(..., description="Neighborhood name, e.g. 연남동"),
    vibe: str = Query(None, description="Vibe type, e.g. chill, nightlife, trendy"),
):
    query = f"{neighborhood} {VIBE_PHRASES.get(vibe, '맛집')}"
    try:
        places = fetch_naver_places(query)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Drop lat/lng — frontend uses raw mapx/mapy for marker placement
    return [{k: v for k, v in p.items() if k not in ("lat", "lng")} for p in places]
