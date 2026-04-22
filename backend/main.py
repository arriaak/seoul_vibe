from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.neighborhoods import router as neighborhoods_router
from routes.places import router as places_router
from routes.plan_night import router as plan_night_router

app = FastAPI(title="Seoul Vibe Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(neighborhoods_router)
app.include_router(places_router)
app.include_router(plan_night_router)
