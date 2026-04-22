import os
import requests
from urllib.parse import quote

NAVER_API_URL = "https://openapi.naver.com/v1/search/local.json"

CHAIN_BLOCKLIST = [
    # Coffee chains
    "스타벅스", "Starbucks", "이디야", "이디야커피", "메가커피", "메가MGC커피",
    "컴포즈커피", "빽다방", "할리스", "투썸플레이스", "투썸", "엔제리너스", "엔젤리너스",
    "커피빈", "폴바셋", "스타벅스 리저브", "스타벅스 더", "배스킨라빈스"
    # Fast food
    "맥도날드", "버거킹", "롯데리아", "KFC", "서브웨이", "맘스터치", "쉐이크쉑",
    # Chicken chains
    "BHC", "교촌치킨", "굽네치킨", "네네치킨", "처갓집양념치킨",
    # Korean casual chains
    "김밥천국", "종로김밥", "한솥도시락", "홍콩반점0410", "홍콩반점",
    "새마을식당", "한신포차", "롤링파스타",
    # Convenience stores
    "GS25", "씨유", "세븐일레븐", "이마트24",
    # Supermarkets / department stores
    "이마트", "홈플러스", "롯데마트", "코스트코", "신세계백화점", "현대백화점",
    # Retail chains
    "올리브영", "유니클로", "자라", "H&M", "에잇세컨즈",
    # Cinemas
    "CGV", "롯데시네마",
]


# Filters by name substring match
def is_valid_place(name: str) -> bool:
    return not any(chain in name for chain in CHAIN_BLOCKLIST)


# Venue categories that should never appear in casual night-out results
CATEGORY_BLOCKLIST = ["예식장", "웨딩", "결혼식장", "뷔페결혼"]


def _is_valid_category(category: str) -> bool:
    return not any(kw in category for kw in CATEGORY_BLOCKLIST)


def fetch_naver_places(query: str, display: int = 30) -> list[dict]:
    """Call Naver local search, strip HTML tags, filter chains and venues, return place dicts."""
    client_id = os.environ.get("NAVER_CLIENT_ID")
    client_secret = os.environ.get("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError("Naver API credentials not configured")

    resp = requests.get(
        NAVER_API_URL,
        headers={
            "X-Naver-Client-Id": client_id,
            "X-Naver-Client-Secret": client_secret,
        },
        params={"query": query, "display": display, "sort": "comment"},
        timeout=5,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Naver API returned {resp.status_code}")

    results = []
    for item in resp.json().get("items", []):
        name = item["title"].replace("<b>", "").replace("</b>", "")
        category = item.get("category", "")
        if not is_valid_place(name) or not _is_valid_category(category):
            continue
        address = item.get("roadAddress") or item.get("address", "")
        mapx = item.get("mapx", "")
        mapy = item.get("mapy", "")
        results.append({
            "name": name,
            "address": address,
            "category": item.get("category", ""),
            "mapx": mapx,
            "mapy": mapy,
            "lat": int(mapy) / 1e7 if mapy else None,
            "lng": int(mapx) / 1e7 if mapx else None,
            "naver_link": f"https://map.naver.com/v5/search/{quote(name)}",
        })
    return results
