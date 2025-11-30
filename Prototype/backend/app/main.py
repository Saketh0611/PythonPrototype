from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from . import models
from .routers import rooms, autocomplete, websocket as ws_router

# Create tables in the database (if they don't exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Prototype Backend")

# Allow all origins for now (so any frontend can call the API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # in real apps, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(rooms.router)
app.include_router(autocomplete.router)
app.include_router(ws_router.router)


@app.get("/")
def root():
    return {"message": "Backend is running"}
