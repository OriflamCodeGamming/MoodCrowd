# backend/database.py

import sqlite3
import os
from passlib.context import CryptContext

# Путь к базе данных
DB_PATH = os.path.join(os.path.dirname(__file__), "moodcrowd.db")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    """Создаёт таблицы при первом запуске"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Пользователи
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )
    """)

    # Плейлисты
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Треки
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        title TEXT,
        artist TEXT,
        genre TEXT,
        bpm REAL,
        order_index INTEGER NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id)
    )
    """)

    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # позволяет обращаться по имени колонки
    return conn

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)