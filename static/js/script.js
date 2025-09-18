// Toast notification using Bootstrap 5
function showToast(message, type = "info") {
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

// Cambia el chip de canales según modo
const modeEl = document.getElementById('mode');
const channelsChip = document.getElementById('channels-chip');
if (modeEl && channelsChip) {
  modeEl.addEventListener('change', () => {
    channelsChip.textContent = modeEl.value === 'ambient'
      ? '2 canales (estéreo)'
      : '1 canal (mono)';
  });
}

// Restablecer a predeterminado
const deviceEl = document.getElementById('device_index');
const resetBtn = document.getElementById('resetDefault');
if (resetBtn && deviceEl) {
  resetBtn.addEventListener('click', () => {
    deviceEl.value = '';
    deviceEl.focus();
  });
}

// Botón “Guardar cambios” de la barra inferior
function submitForm(){
  const form = document.querySelector('form[method="post"]');
  if(form) form.submit();
}

// Resalta botón aplicar cuando cambian los selects
const form = document.querySelector('form[method="post"]');
if(form){
  form.addEventListener('change', () => {
    const applyBtn = form.querySelector('.btn-primary');
    if(applyBtn){
      applyBtn.style.boxShadow = '0 0 0 6px var(--ring)';
      setTimeout(()=> applyBtn.style.boxShadow = '', 600);
    }
  });
}

// Reemplaza alert por showToast en este archivo si se usa alert
// Ejemplo de uso: showToast('Configuración guardada', 'success');