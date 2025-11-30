from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .. import models, schemas
import uuid

router = APIRouter(
    prefix="/rooms",
    tags=["rooms"],
)

# Dependency to get a DB session for each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=schemas.RoomResponse)
def create_room(db: Session = Depends(get_db)):
    """Create a new empty room and return its ID."""
    room_id = str(uuid.uuid4())
    room = models.Room(id=room_id, code="")
    db.add(room)
    db.commit()
    db.refresh(room)
    return schemas.RoomResponse(roomId=room.id, code=room.code)


@router.get("/{room_id}", response_model=schemas.RoomResponse)
def get_room(room_id: str, db: Session = Depends(get_db)):
    """Fetch a room by ID."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return schemas.RoomResponse(roomId=room.id, code=room.code)
