// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
async function apiCall(url, options) {
  options = options || {};
  const backendUrl = "https://moodcrowd.onrender.com";
  const res = await fetch(backendUrl + url, {
    credentials: "include",
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("HTTP " + res.status + ": " + text);
  }
  return res.json();
}

// === УВЕДОМЛЕНИЯ ===
function showNotification(message, type = "success") {
  // Удаляем старое уведомление
  const old = document.querySelector(".notification");
  if (old) old.remove();

  // Создаём новое
  const notification = document.createElement("div");
  notification.className = `notification ${type} show`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Скрываем через 3 секунды
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// === АВТОРИЗАЦИЯ ===
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authSection = document.getElementById("auth-section");
  const uploadSection = document.getElementById("upload-section");

  if (document.getElementById("show-register")) {
    document.getElementById("show-register").addEventListener("click", function () {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
    });
  }

  if (document.getElementById("show-login")) {
    document.getElementById("show-login").addEventListener("click", function () {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
  }

  async function checkAuth() {
    try {
      await apiCall("/playlists/list");
      authSection.classList.add("hidden");
      uploadSection.classList.remove("hidden");
      showPlaylistsButton();
    } catch (e) {
      // Не авторизован
    }
  }

  if (document.getElementById("login-btn")) {
    document.getElementById("login-btn").addEventListener("click", async function () {
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      try {
        await apiCall("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        });
        showNotification("Вход выполнен!");
        authSection.classList.add("hidden");
        uploadSection.classList.remove("hidden");
        showPlaylistsButton();
      } catch (err) {
        showNotification("Ошибка входа: " + err.massage, "error");
      }
    });
  }

  if (document.getElementById("register-btn")) {
    document.getElementById("register-btn").addEventListener("click", async function () {
      const email = document.getElementById("reg-email").value;
      const password = document.getElementById("reg-password").value;
      try {
        await apiCall("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        });
        showNotification("Регистрация успешна! Теперь войдите.");
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
      } catch (err) {
        showNotification("Ошибка регистрации: " + err.massage, "error");
      }
    });
  }

  checkAuth();
});

// === ПОКАЗАТЬ КНОПКУ ПЛЕЙЛИСТОВ ===
function showPlaylistsButton() {
  const btn = document.getElementById("show-playlists-btn");
  if (btn) btn.classList.remove("hidden");
}

// === ЗАГРУЗКА ФАЙЛОВ ===
let currentFilesForAnalysis = [];

if (document.getElementById("browse-btn")) {
  document.getElementById("browse-btn").addEventListener("click", function () {
    document.getElementById("file-input").click();
  });
}

if (document.getElementById("file-input")) {
  document.getElementById("file-input").addEventListener("change", function (e) {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith(".mp3"));
    if (files.length > 10) {
      showNotification("Максимум 10 файлов!");
      return;
    }
    currentFilesForAnalysis = files;
    document.getElementById("file-count").textContent = "Выбрано: " + files.length + " файлов";
    if (document.getElementById("analyze-btn")) {
      document.getElementById("analyze-btn").disabled = files.length === 0;
    }
  });
}

if (document.getElementById("drop-area")) {
  const dropArea = document.getElementById("drop-area");
  dropArea.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropArea.classList.add("bg-blue-50");
  });
  dropArea.addEventListener("dragleave", function () {
    dropArea.classList.remove("bg-blue-50");
  });
  dropArea.addEventListener("drop", function (e) {
    e.preventDefault();
    dropArea.classList.remove("bg-blue-50");
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".mp3"));
    if (files.length <= 10) {
      currentFilesForAnalysis = files;
      document.getElementById("file-count").textContent = "Выбрано: " + files.length + " файлов";
      if (document.getElementById("analyze-btn")) {
        document.getElementById("analyze-btn").disabled = files.length === 0;
      }
    } else {
      showNotification("Максимум 10 файлов!");
    }
  });
}

// === АНАЛИЗ С ИНДИКАТОРОМ ===
if (document.getElementById("analyze-btn")) {
  document.getElementById("analyze-btn").addEventListener("click", async function () {
    if (currentFilesForAnalysis.length === 0) {
      showNotification("Выберите файлы!");
      return;
    }

    const statusText = document.createElement("div");
    statusText.id = "analysis-status";
    statusText.className = "mt-2 text-center text-gray-600";
    statusText.textContent = "Анализ треков... Это может занять 30-60 секунд.";
    this.parentNode.appendChild(statusText);

    try {
      this.disabled = true;
      this.textContent = "Анализ...";

      const formData = new FormData();
      currentFilesForAnalysis.forEach(file => formData.append("files", file));

      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error("Ошибка: " + response.status + " " + text);
      }

      const tracks = await response.json();
      window.currentTracks = tracks;
      window.currentFiles = currentFilesForAnalysis;

      const table = document.getElementById("tracks-table");
      if (table) {
        table.innerHTML = "";
        tracks.forEach(track => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td class="p-2 border-t">${track.title || "—"}</td>
            <td class="p-2 border-t">${track.artist || "—"}</td>
            <td class="p-2 border-t">${track.genre || "—"}</td>
            <td class="p-2 border-t">${track.bpm || "—"}</td>
          `;
          table.appendChild(row);
        });
      }

      renderChart(tracks);

      hideAllSections();
      document.getElementById("results-section").classList.remove("hidden");

    } catch (err) {
      console.error(err);
      showNotification("Ошибка анализа: " + err.massage, "error");
    } finally {
      const statusEl = document.getElementById("analysis-status");
      if (statusEl) statusEl.remove();
      this.disabled = false;
      this.textContent = "Анализировать";
    }
  });
}

// === ГРАФИК BPM ===
function renderChart(tracks) {
  const canvas = document.getElementById("bpm-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Уничтожаем предыдущий график, если есть
  if (window.bpmChart) {
    window.bpmChart.destroy();
  }

  const labels = tracks.map((_, i) => `Трек ${i + 1}`);
  const bpmData = tracks.map(t => t.bpm || 0);

  window.bpmChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'BPM',
        data: bpmData,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  });
}
// === СОХРАНЕНИЕ ПЛЕЙЛИСТА ===
if (document.getElementById("save-btn")) {
  document.getElementById("save-btn").addEventListener("click", async function () {
    const name = prompt("Название плейлиста:", "Плейлист 1");
    if (!name || !window.currentTracks) return;
    try {
      await apiCall("/playlists/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, tracks: window.currentTracks })
      });
      showNotification("Плейлист сохранён!");
    } catch (err) {
      showNotification("Ошибка: " + err.massage, "error");
    }
  });
}

// === НАЗАД ===
if (document.getElementById("back-to-upload")) {
  document.getElementById("back-to-upload").addEventListener("click", function () {
    hideAllSections();
    document.getElementById("upload-section").classList.remove("hidden");
  });
}

// === СТРАНИЦА ПЛЕЙЛИСТОВ ===
let currentPlaylists = [];

async function loadPlaylistsPage() {
  try {
    const playlists = await apiCall("/playlists/list");
    currentPlaylists = playlists;
    
    const listEl = document.getElementById("playlists-list");
    listEl.innerHTML = "";

    if (playlists.length === 0) {
      listEl.innerHTML = '<p class="text-gray-500">У вас нет сохранённых плейлистов.</p>';
    } else {
      playlists.forEach(pl => {
        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white";
        div.innerHTML = `
          <h3 class="font-bold text-lg">${pl.name}</h3>
          <p class="text-sm text-gray-600">${pl.tracks.length} треков • ${new Date(pl.created_at).toLocaleDateString()}</p>
          <div class="mt-2 flex gap-2">
            <button onclick="viewPlaylist('${pl.id}')" class="text-sm bg-indigo-600 text-white px-2 py-1 rounded">Просмотр</button>
            <button onclick="playPlaylistFromList('${pl.id}')" class="text-sm bg-green-600 text-white px-2 py-1 rounded">Воспроизвести</button>
          </div>
        `;
        listEl.appendChild(div);
      });
    }

    hideAllSections();
    document.getElementById("playlists-section").classList.remove("hidden");
  } catch (err) {
    showNotification("Ошибка загрузки плейлистов: " + err.massage, "error");
  }
}

window.viewPlaylist = async function(playlistId) {
  const pl = currentPlaylists.find(p => p.id == playlistId);
  if (!pl) return;
  showNotification(`Плейлист: ${pl.name}\nТреки:\n${pl.tracks.map(t => t.title || t.filename).join('\n')}`);
};

// === ВОСПРОИЗВЕДЕНИЕ СОХРАНЁННОГО ПЛЕЙЛИСТА ===
window.playPlaylistFromList = async function(playlistId) {
  const pl = currentPlaylists.find(p => p.id == playlistId);
  if (!pl || !pl.tracks.length) {
    showNotification("Плейлист пуст.");
    return;
  }

  // Ищем совпадения с текущими файлами по имени
  const matchedFiles = [];
  pl.tracks.forEach(track => {
    const file = window.currentFiles?.find(f => f.name === track.filename);
    if (file) {
      matchedFiles.push(file);
    }
  });

  if (matchedFiles.length === 0) {
    showNotification("Нет загруженных файлов для воспроизведения. Загрузите те же MP3-файлы.");
    return;
  }

  // Сохраняем для плеера
  window.currentFiles = matchedFiles;
  window.currentTracks = pl.tracks;

  // Начинаем воспроизведение
  playTrack(0);

  // Показываем плеер
  hideAllSections();
  document.getElementById("player-section").classList.remove("hidden");
};

// === УЛУЧШЕННЫЙ ПЛЕЕР ===
let currentTrackIndex = 0;

function playTrack(index) {
  if (!window.currentFiles || index >= window.currentFiles.length) {
    showNotification("Трек не найден для воспроизведения.");
    return;
  }

  const file = window.currentFiles[index];
  const url = URL.createObjectURL(file);
  const player = document.getElementById("audio-player");
  
  if (player) {
    player.src = url;
    player.play().catch(e => {
      console.error("Ошибка воспроизведения:", e);
      showNotification("Браузер не позволяет воспроизвести аудио. Попробуйте нажать кнопку ещё раз.");
    });
    currentTrackIndex = index;
    // Обновляем заголовок плеера
    const trackName = (window.currentTracks?.[index]?.title || file.name) || "Трек";
    document.querySelector("#player-section h2").textContent = `Плеер: ${trackName}`;
  }
}

// === КНОПКИ ПЛЕЕРА ===
if (document.getElementById("audio-player")) {
  const player = document.getElementById("audio-player");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (currentTrackIndex < (window.currentFiles?.length || 0) - 1) {
        playTrack(currentTrackIndex + 1);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      if (currentTrackIndex > 0) {
        playTrack(currentTrackIndex - 1);
      }
    });
  }

  if (player) {
    player.addEventListener("ended", function () {
      if (currentTrackIndex < (window.currentFiles?.length || 0) - 1) {
        playTrack(currentTrackIndex + 1);
      }
    });
  }
}

// === КНОПКА "К СПИСКУ" ===
document.addEventListener("DOMContentLoaded", () => {
  const backToPlaylistsBtn = document.getElementById("back-to-playlists");
  if (backToPlaylistsBtn) {
    backToPlaylistsBtn.addEventListener("click", () => {
      hideAllSections();
      document.getElementById("playlists-section").classList.remove("hidden");
    });
  }
});

// === СКРЫТЬ ВСЕ СЕКЦИИ ===
function hideAllSections() {
  ["auth-section", "upload-section", "results-section", "playlists-section", "player-section"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

// === ОБРАБОТЧИКИ КНОПОК НАВИГАЦИИ ===
document.addEventListener("DOMContentLoaded", () => {
  const showPlaylistsBtn = document.getElementById("show-playlists-btn");
  const backToMainBtn = document.getElementById("back-to-main");

  if (showPlaylistsBtn) {
    showPlaylistsBtn.addEventListener("click", loadPlaylistsPage);
  }

  if (backToMainBtn) {
    backToMainBtn.addEventListener("click", () => {
      hideAllSections();
      document.getElementById("upload-section").classList.remove("hidden");
    });
  }
});