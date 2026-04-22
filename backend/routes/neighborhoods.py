import pandas as pd
from fastapi import APIRouter, HTTPException, Path, Query
from pathlib import Path
from models.neighborhood import Neighborhood

router = APIRouter()

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "processed_neighborhoods.csv"

VIBE_COLUMNS = {
    "nightlife": "vibe_nightlife",
    "chill": "vibe_chill",
    "trendy": "vibe_trendy",
}


def load_data() -> pd.DataFrame:
    return pd.read_csv(DATA_PATH)


@router.get("/neighborhoods", response_model=list[Neighborhood])
def get_neighborhoods(vibe: str = Query("nightlife", description="nightlife | chill | trendy")):
    if vibe not in VIBE_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid vibe '{vibe}'. Choose from: {', '.join(VIBE_COLUMNS)}",
        )

    df = load_data()
    sort_col = VIBE_COLUMNS[vibe]
    df = df.sort_values(sort_col, ascending=False)

    fields = ["district", "vibe_nightlife", "vibe_chill", "vibe_trendy",
              "day_pop", "night_pop", "is_cafe", "is_bar", "total_business", "young_ratio"]
    return df[fields].to_dict(orient="records")


@router.get("/neighborhoods/{district}", response_model=list[Neighborhood])
def get_neighborhood(district: str = Path(description="District name, e.g. 강남구")):
    df = load_data()
    filtered = df[df["district"] == district]

    if filtered.empty:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found")

    fields = ["district", "vibe_nightlife", "vibe_chill", "vibe_trendy",
              "day_pop", "night_pop", "is_cafe", "is_bar", "total_business", "young_ratio"]
    filtered = filtered[fields].sort_values(
        ["vibe_nightlife", "vibe_chill", "vibe_trendy"], ascending=False
    )
    return filtered.to_dict(orient="records")
