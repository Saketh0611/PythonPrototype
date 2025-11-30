from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
from sqlalchemy.orm import Session

from ..db import SessionLocal
from .. import models

router = APIRouter(tags=["websocket"])

# ---------------------------------------------------------
# Database dependency
# Creates a database session for each websocket connection.
# ---------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# Connection Manager
# - Tracks all users connected to each room
# - Stores the latest code for each room
# - Broadcasts code/cursor updates to all collaborators
# ---------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        # room_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

        # room_id -> current shared code
        self.room_code: Dict[str, str] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        """Accept a WebSocket connection and add it to the room."""
        await websocket.accept()
        self.active_connections.setdefault(room_id, [])
        self.active_connections[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        """Remove user from room when they close their browser."""
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)

            # Remove empty room
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_code(self, room_id: str, code: str):
        """Send the latest code to every user in the room."""
        if room_id in self.active_connections:
            for ws in self.active_connections[room_id]:
                await ws.send_json({"type": "code_update", "code": code})

    async def broadcast_cursor(self, room_id: str, client_id: str, line_number: int, column: int):
        """Send cursor position updates to all users."""
        if room_id in self.active_connections:
            for ws in self.active_connections[room_id]:
                await ws.send_json({
                    "type": "cursor",
                    "clientId": client_id,
                    "lineNumber": line_number,
                    "column": column,
                })


# Single, global connection manager
manager = ConnectionManager()


# ---------------------------------------------------------
# WebSocket endpoint: /ws/{room_id}
# Handles:
# - Joining a room
# - Receiving code / cursor updates
# - Broadcasting updates to other collaborators
# ---------------------------------------------------------
@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, db: Session = Depends(get_db)):

    # 1) Check if room exists in DB
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if room is None:
        # Reject connection if room doesn't exist
        await websocket.close(code=1000)
        return

    # 2) Load saved code for this room (only once)
    manager.room_code.setdefault(room_id, room.code or "")

    # 3) Accept connection + add user to room
    await manager.connect(room_id, websocket)

    # 4) Send current code to the newly connected user
    await websocket.send_json({"type": "init", "code": manager.room_code[room_id]})

    try:
        # 5) Main loop: receive messages until user disconnects
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # --- Handle code updates ---
            if msg_type == "code_update":
                new_code = data.get("code", "")

                # Update in-memory shared code
                manager.room_code[room_id] = new_code

                # Save latest code to DB
                room.code = new_code
                db.add(room)
                db.commit()

                # Send updated code to all users in the room
                await manager.broadcast_code(room_id, new_code)

            # --- Handle cursor updates ---
            elif msg_type == "cursor":
                client_id = data.get("clientId")
                line_number = data.get("lineNumber")
                column = data.get("column")

                if client_id and line_number and column:
                    # Broadcast cursor location to others
                    await manager.broadcast_cursor(
                        room_id=room_id,
                        client_id=client_id,
                        line_number=line_number,
                        column=column,
                    )

    except WebSocketDisconnect:
        # 6) Cleanup on disconnect
        manager.disconnect(room_id, websocket)
