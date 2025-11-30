from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from . import models
from .routers import rooms, autocomplete, websocket as ws_router

# ---------------------------------------------------------
# Initialize database tables (creates them if they don’t exist)
# ---------------------------------------------------------
Base.metadata.create_all(bind=engine)

# Create the FastAPI application
app = FastAPI(title="Prototype Backend")

# ---------------------------------------------------------
# Enable CORS so the React frontend can call this backend
# (In production you would restrict allowed origins)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # allow every domain for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Register all API routes:
# - /rooms → create/join rooms
# - /autocomplete → code suggestions
# - /ws/{roomId} → WebSocket for real-time collaboration
# ---------------------------------------------------------
app.include_router(rooms.router)
app.include_router(autocomplete.router)
app.include_router(ws_router.router)

# Simple health-check endpoint
@app.get("/")
def root():
    return {"message": "Backend is running"}
