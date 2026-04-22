from pydantic import BaseModel


class Neighborhood(BaseModel):
    district: str
    vibe_nightlife: float
    vibe_chill: float
    vibe_trendy: float
    day_pop: float
    night_pop: float
    is_cafe: float
    is_bar: float
    total_business: float
    young_ratio: float
