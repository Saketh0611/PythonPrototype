from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import DATABASE_URL

# Create the SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    echo=True,       # prints SQL in terminal; change to False if noisy
    future=True
)

# SessionLocal will be used in our routes to talk to the DB
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for our models
Base = declarative_base()
