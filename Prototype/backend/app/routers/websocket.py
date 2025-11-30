from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
from sqlalchemy.orm import Session

from ..db import SessionLocal
from .. import models

router = APIRouter(
    tags=["websocket"],
)

# --- DB dependency ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Connection manager ---

class ConnectionManager:
    def __init__(self):
        # room_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # room_id -> current code
        self.room_code: Dict[str, str] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_code(self, room_id: str, code: str):
        """Send the latest code to everyone in the room."""
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_json(
                    {"type": "code_update", "code": code}
                )

    async def broadcast_cursor(
        self,
        room_id: str,
        client_id: str,
        line_number: int,
        column: int,
    ):
        """Broadcast a cursor position to everyone in the room."""
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_json(
                    {
                        "type": "cursor",
                        "clientId": client_id,
                        "lineNumber": line_number,
                        "column": column,
                    }
                )


manager = ConnectionManager()


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    db: Session = Depends(get_db),
):
    # Check that the room exists in the DB
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if room is None:
        await websocket.close(code=1000)
        return

    # Initialize in-memory code for this room from DB if not present
    manager.room_code.setdefault(room_id, room.code or "")

    # Accept connection and join the room
    await manager.connect(room_id, websocket)

    # Send the current code to the client that just connected
    await websocket.send_json(
        {"type": "init", "code": manager.room_code[room_id]}
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "code_update":
                new_code = data.get("code", "")

                # Update in-memory state
                manager.room_code[room_id] = new_code

                # Save to database
                room.code = new_code
                db.add(room)
                db.commit()

                # Broadcast to all users in this room (including sender)
                await manager.broadcast_code(room_id, new_code)

            elif msg_type == "cursor":
                client_id = data.get("clientId")
                line_number = data.get("lineNumber")
                column = data.get("column")
                if client_id is not None and line_number is not None and column is not None:
                    await manager.broadcast_cursor(
                        room_id=room_id,
                        client_id=client_id,
                        line_number=line_number,
                        column=column,
                    )

    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
