# backend/main.py

import os
import tempfile
import eyed3
import librosa
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
import sqlite3
from datetime import datetime

from .database import init_db, get_db_connection, verify_password, get_password_hash

app = FastAPI(title="MoodCrowd API")

# Разрешаем только твой локальный frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8080",
        "http://192.168.0.1:8080",   # ← твой IP из лога
        "http://172.26.16.1:8080"    # ← второй IP из лога
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)


# Модели
class UserRegister(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class PlaylistSave(BaseModel):
    name: str
    tracks: List[dict]

# Вспомогательная функция: получить user_id из сессии (упрощённо — через email в cookie)
def get_current_user(session_email: Optional[str] = Cookie(None)) -> Optional[int]:
    if not session_email:
        return None
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (session_email,)).fetchone()
    conn.close()
    return user["id"] if user else None

@app.post("/auth/register")
async def register(user: UserRegister):
    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (user.email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    
    hashed_pw = get_password_hash(user.password)
    conn.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (user.email, hashed_pw))
    conn.commit()
    conn.close()
    return {"message": "Регистрация успешна"}

@app.post("/auth/login")
async def login(user: UserLogin, response: JSONResponse):
    conn = get_db_connection()
    db_user = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (user.email,)).fetchone()
    conn.close()
    
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    
    # Устанавливаем cookie с email (упрощённая сессия)
    response = JSONResponse({"message": "Вход выполнен"})
    response.set_cookie(key="session_email", value=user.email, httponly=False, max_age=86400)  # 24 часа
    return response

@app.post("/analyze")
async def analyze_tracks(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        if not file.filename.endswith(".mp3"):
            continue
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            # ID3 теги
            audiofile = eyed3.load(tmp_path)
            title = audiofile.tag.title if audiofile and audiofile.tag and audiofile.tag.title else "Неизвестно"
            artist = audiofile.tag.artist if audiofile and audiofile.tag and audiofile.tag.artist else "Неизвестно"
            genre = "Неизвестно"
            if audiofile and audiofile.tag and audiofile.tag.genre:
                genre = str(audiofile.tag.genre)

            # BPM
            y, sr = librosa.load(tmp_path, duration=60.0)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = round(float(tempo), 1)

            results.append({
                "filename": file.filename,
                "title": title,
                "artist": artist,
                "genre": genre,
                "bpm": bpm
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    return JSONResponse(results)

@app.post("/playlists/save")
async def save_playlist(data: PlaylistSave, user_id: int = Depends(get_current_user)):
    if user_id is None:
        raise HTTPException(status_code=401, detail="Требуется вход")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO playlists (user_id, name) VALUES (?, ?)", (user_id, data.name))
    playlist_id = cursor.lastrowid
    
    for idx, track in enumerate(data.tracks):
        cursor.execute("""
            INSERT INTO tracks (playlist_id, filename, title, artist, genre, bpm, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            playlist_id,
            track.get("filename", ""),
            track.get("title"),
            track.get("artist"),
            track.get("genre"),
            track.get("bpm"),
            idx
        ))
    
    conn.commit()
    conn.close()
    return {"message": "Плейлист сохранён", "playlist_id": playlist_id}

@app.get("/playlists/list")
async def list_playlists(user_id: int = Depends(get_current_user)):
    if user_id is None:
        raise HTTPException(status_code=401, detail="Требуется вход")
    
    conn = get_db_connection()
    playlists = conn.execute("""
        SELECT id, name, created_at FROM playlists WHERE user_id = ? ORDER BY created_at DESC
    """, (user_id,)).fetchall()
    
    result = []
    for pl in playlists:
        tracks = conn.execute("""
            SELECT filename, title, artist, genre, bpm FROM tracks
            WHERE playlist_id = ? ORDER BY order_index
        """, (pl["id"],)).fetchall()
        result.append({
            "id": pl["id"],
            "name": pl["name"],
            "created_at": pl["created_at"],
            "tracks": [dict(t) for t in tracks]
        })
    
    conn.close()
    return JSONResponse(result)

# Инициализация БД при старте
init_db()