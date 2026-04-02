/**
 * Sistema de Gerenciamento de Sessão
 * Valida automaticamente sessões e implementa timeout/renovação
 * Author: PBI Monitor System
 * Version: 1.0
 */

class SessionManager {
    constructor() {
        this.SESSION_CHECK_INTERVAL = 30000; // Verificar a cada 30 segundos
        this.WARNING_THRESHOLD = 300000; // Avisar quando restam 5 minutos (300 segundos)
        this.AUTO_REFRESH_THRESHOLD = 600000; // Auto-renovar quando restam 10 minutos
        this.sessionInterval = null;
        this.warningShown = false;
        this.isActive = true;
        
        // Iniciar monitoramento
        this.initSessionMonitoring();
        this.setupActivityListeners();
        
        console.log('🔐 SessionManager inicializado');
    }

    /**
     * Inicializar monitoramento de sessão
     */
    initSessionMonitoring() {
        // Verificação imediata
        this.checkSession();
        
        // Configurar intervalo de verificação
        this.sessionInterval = setInterval(() => {
            this.checkSession();
        }, this.SESSION_CHECK_INTERVAL);
    }

    /**
     * Verificar status da sessão
     */
    async checkSession() {
        try {
            const response = await fetch('/check-session', {
                method: 'GET',
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (!result.valid) {
                console.warn('🔒 Sessão inválida - redirecionando para login');
                this.handleSessionExpired();
                return;
            }
            
            const timeRemaining = result.time_remaining * 1000; // Converter para milissegundos
            console.log(`🔑 Sessão válida - expira em ${Math.round(timeRemaining/60000)} minutos`);
            
            // Atualizar indicador visual
            this.updateSessionIndicator(timeRemaining);
            
            // Auto-renovar se estiver próximo do limite e usuário ativo
            if (timeRemaining < this.AUTO_REFRESH_THRESHOLD && this.isActive) {
                console.log('🔄 Auto-renovando sessão...');
                await this.refreshSession();
                return;
            }
            
            // Mostrar aviso se sessão está prestes a expirar
            if (timeRemaining < this.WARNING_THRESHOLD && !this.warningShown) {
                this.showSessionWarning(Math.round(timeRemaining/60000));
            }
            
        } catch (error) {
            console.error('❌ Erro ao verificar sessão:', error);
            this.handleSessionError();
        }
    }

    /**
     * Renovar sessão do usuário
     */
    async refreshSession() {
        try {
            const response = await fetch('/refresh-session', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Sessão renovada com sucesso');
                this.warningShown = false; // Reset warning flag
                this.hideSessionWarning();
                
                // Atualizar indicador visual
                this.updateSessionIndicator(result.expires_in * 1000);
                
                // Mostrar notificação de renovação
                this.showNotification('Sessão renovada automaticamente', 'success');
            } else {
                console.warn('⚠️ Falha ao renovar sessão');
                this.handleSessionExpired();
            }
            
        } catch (error) {
            console.error('❌ Erro ao renovar sessão:', error);
            this.handleSessionError();
        }
    }

    /**
     * Lidar com sessão expirada
     */
    handleSessionExpired() {
        this.cleanup();
        
        // Mostrar modal de sessão expirada
        this.showSessionExpiredModal();
        
        // Redirecionar após 3 segundos
        setTimeout(() => {
            window.location.href = '/login';
        }, 3000);
    }

    /**
     * Lidar com erro de sessão
     */
    handleSessionError() {
        console.warn('⚠️ Erro de comunicação com servidor - verificando novamente em 10 segundos');
        
        // Tentar novamente em 10 segundos
        setTimeout(() => {
            this.checkSession();
        }, 10000);
    }

    /**
     * Atualizar indicador visual de sessão
     */
    updateSessionIndicator(timeRemaining) {
        const sessionIndicator = document.getElementById('sessionIndicator');
        const sessionTime = document.getElementById('sessionTime');
        
        if (!sessionIndicator || !sessionTime) return;
        
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        sessionTime.textContent = timeString;
        
        // Mudar cor baseado no tempo restante
        sessionIndicator.className = 'badge d-flex align-items-center gap-1';
        if (timeRemaining < this.WARNING_THRESHOLD) {
            sessionIndicator.classList.add('bg-warning', 'text-dark');
        } else if (timeRemaining < this.AUTO_REFRESH_THRESHOLD) {
            sessionIndicator.classList.add('bg-info');
        } else {
            sessionIndicator.classList.add('bg-success');
        }
    }

    /**
     * Configurar listeners de atividade do usuário
     */
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.isActive = true;
            }, true);
        });
        
        // Marcar como inativo após 5 minutos sem atividade
        setInterval(() => {
            this.isActive = false;
        }, 300000);
    }

    /**
     * Mostrar aviso de sessão prestes a expirar
     */
    showSessionWarning(minutesRemaining) {
        this.warningShown = true;
        
        // Criar modal de aviso
        const warningHtml = `
            <div id="sessionWarningModal" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-warning">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Sessão Expirando
                            </h5>
                        </div>
                        <div class="modal-body text-center">
                            <p class="mb-3">Sua sessão expirará em <strong>${minutesRemaining} minutos</strong>.</p>
                            <p>Deseja renovar sua sessão?</p>
                        </div>
                        <div class="modal-footer justify-content-center">
                            <button type="button" class="btn btn-success" onclick="sessionManager.refreshSession()">
                                <i class="fas fa-refresh me-1"></i> Renovar Sessão
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="sessionManager.hideSessionWarning()">
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar modal ao body
        document.body.insertAdjacentHTML('beforeend', warningHtml);
    }

    /**
     * Ocultar aviso de sessão
     */
    hideSessionWarning() {
        const modal = document.getElementById('sessionWarningModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Mostrar modal de sessão expirada
     */
    showSessionExpiredModal() {
        const expiredHtml = `
            <div id="sessionExpiredModal" class="modal fade show" style="display: block; background: rgba(0,0,0,0.8);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-danger">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-times-circle me-2"></i>
                                Sessão Expirada
                            </h5>
                        </div>
                        <div class="modal-body text-center">
                            <p class="mb-3">Sua sessão expirou por motivos de segurança.</p>
                            <p>Você será redirecionado para a tela de login...</p>
                            <div class="spinner-border text-danger mt-3" role="status">
                                <span class="visually-hidden">Carregando...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', expiredHtml);
    }

    /**
     * Mostrar notificação
     */
    showNotification(message, type = 'info') {
        // Remover notificações existentes
        const existing = document.querySelector('.session-notification');
        if (existing) existing.remove();
        
        const colors = {
            success: 'alert-success',
            warning: 'alert-warning',
            danger: 'alert-danger',
            info: 'alert-info'
        };
        
        const notificationHtml = `
            <div class="session-notification alert ${colors[type]} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <i class="fas fa-info-circle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', notificationHtml);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            const notification = document.querySelector('.session-notification');
            if (notification) notification.remove();
        }, 5000);
    }

    /**
     * Limpar recursos
     */
    cleanup() {
        if (this.sessionInterval) {
            clearInterval(this.sessionInterval);
            this.sessionInterval = null;
        }
        
        this.hideSessionWarning();
        console.log('🧹 SessionManager limpo');
    }

    /**
     * Forçar logout manual
     */
    async forceLogout() {
        this.cleanup();
        
        try {
            await fetch('/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Erro ao fazer logout:', error);
        }
        
        window.location.href = '/login';
    }
}

// Inicializar SessionManager quando página carregar
let sessionManager;

document.addEventListener('DOMContentLoaded', function() {
    // TEMPORARIAMENTE DESABILITADO: Sistema de auth está sendo refatorado
    // Para reabilitar, configure AUTH_DISABLED=false no environment
    const authDisabled = true; // Durante desenvolvimento
    
    if (authDisabled) {
        console.log('🔧 SessionManager desabilitado durante desenvolvimento');
        return;
    }
    
    // Verificar se não está na página de login
    if (!window.location.pathname.includes('/login')) {
        sessionManager = new SessionManager();
        
        // Disponibilizar globalmente para debug
        window.sessionManager = sessionManager;
    }
});

// Cleanup ao sair da página
window.addEventListener('beforeunload', function() {
    if (sessionManager) {
        sessionManager.cleanup();
    }
});
