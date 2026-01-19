# backend/main.py

import os
import tempfile
import eyed3
import librosa
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MoodCrowd")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_tracks(files: List[UploadFile] = File(...)):
    results = []
    
    for file in files:
        if not file.filename.endswith(".mp3"):
            raise HTTPException(status_code=400, detail=f"Файл {file.filename} не является MP3")
        
        # Сохраняем временно
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            # 1. Читаем ID3-теги
            audiofile = eyed3.load(tmp_path)
            title = audiofile.tag.title if audiofile and audiofile.tag and audiofile.tag.title else "Неизвестно"
            artist = audiofile.tag.artist if audiofile and audiofile.tag and audiofile.tag.artist else "Неизвестно"
            genre = "Неизвестно"
            if audiofile and audiofile.tag and audiofile.tag.genre:
                genre = str(audiofile.tag.genre)

            # 2. Считаем BPM (анализируем первые 60 секунд)
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
                "error": f"Ошибка анализа: {str(e)}"
            })
        finally:
            # Удаляем временный файл
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return JSONResponse(results)