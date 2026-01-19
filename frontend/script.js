// frontend/script.js

let selectedFiles = [];

// Элементы DOM
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const dropArea = document.getElementById('drop-area');
const fileCount = document.getElementById('file-count');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results-section');
const tracksTable = document.getElementById('tracks-table');
const saveBtn = document.getElementById('save-btn');

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

  // Удаляем старый график, если есть
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

// Кнопка "Сохранить" (временно)
saveBtn.addEventListener('click', () => {
  alert('Функция сохранения будет добавлена позже (после авторизации)');
});