import os
from dotenv import load_dotenv
from pathlib import Path

# Load variables from a .env file if present
load_dotenv()

# Base directory = folder where this file lives
BASE_DIR = Path(__file__).resolve().parent

# If DATABASE_URL is not set in .env, default to a local SQLite file
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'app.db'}"
)
