import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from .db import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    code = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
