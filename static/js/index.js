// Toast notification using Bootstrap 5
function showToast(message, type = "info") {
  // Espera a que Bootstrap esté disponible
  if (typeof bootstrap === "undefined") {
    setTimeout(() => showToast(message, type), 200);
    return;
  }
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toastId = `toast-${Date.now()}`;
  const bgClass = type === "success" ? "bg-success text-white"
                : type === "error" ? "bg-danger text-white"
                : type === "warning" ? "bg-warning text-dark"
                : "bg-info text-white";
  const toast = document.createElement('div');
  toast.className = `toast align-items-center ${bgClass}`;
  toast.id = toastId;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white ms-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>
  `;
  toastContainer.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 3500 });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function captureImage() {
  const btn = document.getElementById("capture-btn");
  const url = btn.dataset.captureUrl;
  btn.disabled = true;
  btn.textContent = "Capturando...";
  fetch(url)
    .then(response => {
      btn.disabled = false;
      btn.textContent = "📷 Capturar Imagen";
      if (!response.ok) throw new Error('Error al capturar la imagen');
      return response.blob();
    })
    .then(blob => {
      const img = document.getElementById("captured-image");
      const dl = document.getElementById("download-link");
      const preview = document.getElementById("capture-preview");
      const objectURL = URL.createObjectURL(blob);
      img.src = objectURL;
      preview.style.display = "flex";
      // Asigna nombre único con fecha y hora
      const now = new Date();
      const filename = `captura_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}.jpg`;
      dl.href = objectURL;
      dl.setAttribute('download', filename);
      showToast("Imagen capturada correctamente.", "success");
    })
    .catch(error => {
      btn.disabled = false;
      btn.textContent = "📷 Capturar Imagen";
      showToast("Error al capturar la imagen", "error");
    });
}

function removeCapturedImage() {
  const img = document.getElementById("captured-image");
  const dl = document.getElementById("download-link");
  const preview = document.getElementById("capture-preview");
  img.src = "";
  dl.href = "";
  preview.style.display = "none";
  showToast("Imagen eliminada.", "info");
}

function startRecording() {
  const btn = document.getElementById('start-record-btn');
  const pauseBtn = document.getElementById('pause-record-btn');
  const removeBtn = document.getElementById('remove-video-btn');
  const videoStream = document.getElementById('video-stream');
  if (videoStream) {
    videoStream.style.display = "";
  }
  btn.disabled = true;
  btn.textContent = "Grabando...";
  fetch("/start_recording")
    .then(response => response.text())
    .then(message => {
      document.getElementById("download-video-link").style.display = "none";
      btn.disabled = false;
      btn.textContent = "⏺️ Grabar Video";
      pauseBtn.style.display = "";
      removeBtn.style.display = "none";
      removeBtn.disabled = true;
      showToast(message, message.includes("iniciada") ? "success" : "warning");
    })
    .catch(error => {
      btn.disabled = false;
      btn.textContent = "⏺️ Grabar Video";
      showToast("Error al iniciar grabación", "error");
    });
}

function pauseRecording() {
  const btn = document.getElementById('pause-record-btn');
  const removeBtn = document.getElementById('remove-video-btn');
  btn.disabled = true;
  btn.textContent = "Pausando...";
  fetch("/pause_recording")
    .then(response => response.text())
    .then((message) => {
      document.getElementById("download-video-link").style.display = "inline-block";
      btn.disabled = false;
      btn.textContent = "⏸️ Pausar Video";
      btn.style.display = "none";
      removeBtn.style.display = "";
      removeBtn.disabled = false;
      showToast(message, message.includes("pausada") ? "success" : "warning");
    })
    .catch(error => {
      btn.disabled = false;
      btn.textContent = "⏸️ Pausar Video";
      showToast("Error al pausar grabación", "error");
    });
}

function removeVideo() {
  const videoStream = document.getElementById("video-stream");
  const removeBtn = document.getElementById("remove-video-btn");
  const startBtn = document.getElementById("start-record-btn");
  const pauseBtn = document.getElementById("pause-record-btn");
  const downloadBtn = document.getElementById("download-video-link");
  if (videoStream) {
    videoStream.style.display = "none";
  }
  removeBtn.style.display = "none";
  startBtn.disabled = false;
  startBtn.style.display = "";
  pauseBtn.style.display = "none";
  downloadBtn.style.display = "none";
  removeBtn.disabled = true;
  showToast("Video ocultado. Puedes grabar de nuevo.", "info");
}

document.addEventListener('DOMContentLoaded', () => {
  const audioElement = document.querySelector('.audio-player');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeDisplay = document.getElementById('volume-display');

  if (!audioElement || !volumeSlider || !volumeDisplay) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext;
  let sourceNode;
  let gainNode;
  let useNativeVolume = !AudioContextClass;
  let warnedAboutNativeVolume = false;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const updateDisplay = (value) => {
    const safeValue = clamp(Number(value) || 0, 0, 200);
    if (useNativeVolume && safeValue > 100) {
      volumeDisplay.textContent = '100% (máximo)';
    } else {
      volumeDisplay.textContent = `${safeValue}%`;
    }
    volumeSlider.setAttribute('aria-valuenow', String(safeValue));
  };

  const ensureAudioGraph = () => {
    if (useNativeVolume) {
      if (!AudioContextClass && !warnedAboutNativeVolume && typeof showToast === 'function') {
        showToast('Tu navegador no soporta la amplificación avanzada de audio. Se usará el control de volumen estándar.', 'warning');
        warnedAboutNativeVolume = true;
      }
      return false;
    }
    if (!audioContext) {
      audioContext = new AudioContextClass();
      try {
        sourceNode = audioContext.createMediaElementSource(audioElement);
      } catch (error) {
        console.error('No se pudo crear el contexto de audio:', error);
        audioContext = null;
        sourceNode = null;
        gainNode = null;
        useNativeVolume = true;
        if (!warnedAboutNativeVolume && typeof showToast === 'function') {
          showToast('No se pudo inicializar el control de volumen ampliado. Se usará el control de volumen estándar.', 'warning');
          warnedAboutNativeVolume = true;
        }
        return false;
      }
      gainNode = audioContext.createGain();
      sourceNode.connect(gainNode).connect(audioContext.destination);
      audioElement.volume = 0;
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return true;
  };

  const applyGainFromSlider = (value) => {
    const normalized = clamp(Number(value) / 100, 0, 2);
    if (!useNativeVolume && gainNode) {
      if (normalized <= 1) {
        audioElement.volume = normalized;
        gainNode.gain.value = 1;
      } else {
        audioElement.volume = 1;
        gainNode.gain.value = normalized;
      }
    } else {
      const fallbackVolume = clamp(normalized, 0, 1);
      audioElement.volume = fallbackVolume;
    }
    updateDisplay(value);
  };

  volumeSlider.addEventListener('input', (event) => {
    const value = event.target.value;
    ensureAudioGraph();
    applyGainFromSlider(value);
  });

  audioElement.addEventListener('play', () => {
    ensureAudioGraph();
    applyGainFromSlider(volumeSlider.value);
  });

  applyGainFromSlider(volumeSlider.value);
});
