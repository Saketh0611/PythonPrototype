from pydantic import BaseModel

# ---------- Room Schemas ----------

class RoomCreate(BaseModel):
    # For now we don't need any data to create a room,
    # so this is intentionally empty.
    pass


class RoomResponse(BaseModel):
    roomId: str
    code: str = ""

    class Config:
        orm_mode = True  # allows Pydantic to work with SQLAlchemy models


# ---------- Autocomplete Schemas (for later) ----------

class AutocompleteRequest(BaseModel):
    code: str
    cursorPosition: int
    language: str


class AutocompleteResponse(BaseModel):
    suggestion: str
