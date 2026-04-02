// Toast Helper - Melhora a aparência dos toasts do sistema

/**
 * Exibe um toast melhorado com ícone e estilo moderno
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo do alerta (success, error, warning, info)
 * @param {number} duration - Duração em ms (padrão: 5000)
 */
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast shadow-lg border-0';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.style.borderRadius = '15px';
    
    // Definir cores com base no tipo
    let bgColor, textColor, icon;
    
    switch (type) {
        case 'success':
            bgColor = 'linear-gradient(145deg, #d4edda, #c3e6cb)';
            textColor = '#155724';
            icon = '<i class="bi bi-check-circle-fill"></i>';
            break;
        case 'error':
        case 'danger':
            bgColor = 'linear-gradient(145deg, #f8d7da, #f5c6cb)';
            textColor = '#721c24';
            icon = '<i class="bi bi-exclamation-circle-fill"></i>';
            break;
        case 'warning':
            bgColor = 'linear-gradient(145deg, #fff3cd, #ffeeba)';
            textColor = '#856404';
            icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
            break;
        case 'info':
        default:
            bgColor = 'linear-gradient(145deg, #d1ecf1, #bee5eb)';
            textColor = '#0c5460';
            icon = '<i class="bi bi-info-circle-fill"></i>';
            break;
    }
    
    toast.style.background = bgColor;
    toast.style.color = textColor;
    
    toast.innerHTML = `
        <div class="toast-header border-0" style="background: transparent; color: ${textColor}">
            <span class="me-2">${icon}</span>
            <strong class="me-auto">Notificação</strong>
            <small>agora</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
        delay: duration,
        autohide: true
    });
    
    bsToast.show();
    
    // Remover do DOM após esconder
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Substituir a função showAlert original
window.showAlert = function(message, type = 'info', duration = 5000) {
    showToast(message, type, duration);
};
