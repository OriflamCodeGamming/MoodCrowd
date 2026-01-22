let selectedFiles = [];
let currentUser = null;

// Элементы DOM
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const dropArea = document.getElementById('drop-area');
const fileCount = document.getElementById('file-count');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results-section');
const tracksTable = document.getElementById('tracks-table');
const saveBtn = document.getElementById('save-btn');
const emailInput = document.getElementById('email-input');
const loginBtn = document.getElementById('login-btn');
const authSection = document.getElementById('auth-section');

// Обработчики выбора файлов
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('bg-blue-50');
});
dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('bg-blue-50');
});
dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('bg-blue-50');
  if (e.dataTransfer.files) {
    handleFiles({ target: { files: e.dataTransfer.files } });
  }
});

function handleFiles(event) {
  const files = Array.from(event.target.files).filter(f => f.name.endsWith('.mp3'));
  if (files.length > 10) {
    alert('Максимум 10 файлов!');
    return;
  }
  selectedFiles = files;
  fileCount.textContent = `Выбрано: ${selectedFiles.length} файлов`;
  analyzeBtn.disabled = selectedFiles.length === 0;
}

// Анализ
analyzeBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  const formData = new FormData();
  selectedFiles.forEach(file => formData.append('files', file));

  try {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Анализ...';

    const response = await fetch('http://127.0.0.1:8000/analyze', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Ошибка сервера');

    const tracks = await response.json();

    // Сохраняем данные для последующего сохранения
    window.currentTracks = tracks;

    // Очистка таблицы
    tracksTable.innerHTML = '';

    // Заполнение таблицы
    tracks.forEach(track => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="p-2 border-t">${track.title || '—'}</td>
        <td class="p-2 border-t">${track.artist || '—'}</td>
        <td class="p-2 border-t">${track.genre || '—'}</td>
        <td class="p-2 border-t">${track.bpm || '—'}</td>
      `;
      tracksTable.appendChild(row);
    });

    // Построение графика
    renderChart(tracks);

    // Показываем результаты
    document.getElementById('upload-section').classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Если пользователь уже вошёл — разрешаем сохранять
    if (currentUser) {
      saveBtn.disabled = false;
    }

  } catch (err) {
    alert('Ошибка: ' + err.message);
    console.error(err);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Анализировать';
  }
});

// График BPM
function renderChart(tracks) {
  const ctx = document.getElementById('bpm-chart').getContext('2d');

  if (window.bpmChart) window.bpmChart.destroy();

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
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 20 }
        }
      }
    }
  });
}

// Вход по email (демо)
loginBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  if (email && email.includes('@')) {
    currentUser = email;
    authSection.classList.add('hidden');
    saveBtn.disabled = false;
    alert('Вы вошли как ' + email);
  } else {
    alert('Введите корректный email');
  }
});

// Сохранение плейлиста
saveBtn.addEventListener('click', () => {
  if (!currentUser) {
    alert('Сначала войдите!');
    return;
  }
  if (!window.currentTracks || window.currentTracks.length === 0) {
    alert('Нет данных для сохранения');
    return;
  }

  const playlistName = prompt('Название плейлиста:', 'Моя вечеринка');
  if (!playlistName) return;

  const playlist = {
    id: Date.now(),
    name: playlistName,
    user: currentUser,
    createdAt: new Date().toISOString(),
    tracks: window.currentTracks
  };

  const saved = JSON.parse(localStorage.getItem('playlists') || '[]');
  saved.push(playlist);
  localStorage.setItem('playlists', JSON.stringify(saved));

  alert('Плейлист «' + playlistName + '» сохранён в браузере!');
});