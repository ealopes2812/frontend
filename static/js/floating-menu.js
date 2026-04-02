/* ===================================================================
   FLOATING ACTION MENU - JavaScript
   WifiMaxx Monitor - Sistema de Menu Flutuante
   ================================================================== */

class FloatingActionMenu {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createFloatingMenu();
        this.setupEventListeners();
        console.log('🎯 Menu Flutuante Inicializado');
    }

    createFloatingMenu() {
        // Verificar se já existe
        if (document.querySelector('.floating-action-button')) {
            return;
        }

        const floatingHTML = `
            <!-- Botão Principal Flutuante -->
            <button class="floating-action-button" id="floatingActionBtn" aria-label="Menu de ações">
                <i class="bi bi-plus"></i>
            </button>

            <!-- Menu de Ações -->
            <div class="floating-menu" id="floatingMenu">
                <!-- Relatórios -->
                <div class="floating-menu-item">
                    <button class="floating-action-item reports" data-menu="reports" aria-label="Relatórios">
                        <i class="bi bi-file-earmark-text"></i>
                    </button>
                    <div class="floating-action-label">Relatórios</div>
                    <div class="floating-dropdown">
                        <a href="#" class="floating-dropdown-item" onclick="iniciarGeracaoRAT()">
                            <i class="bi bi-file-text"></i>
                            Gerar RAT
                        </a>
                        <a href="#" class="floating-dropdown-item" onclick="gerarRelatorioPrefixos()">
                            <i class="bi bi-file-earmark-excel"></i>
                            Gerar Relatório xlsx
                        </a>
                        <a href="#" class="floating-dropdown-item" onclick="showEmailModal()">
                            <i class="bi bi-envelope"></i>
                            Gerar E-mail Padrão
                        </a>
                    </div>
                </div>

                <!-- Gerenciar -->
                <div class="floating-menu-item">
                    <button class="floating-action-item manage" data-menu="manage" aria-label="Gerenciar">
                        <i class="bi bi-gear"></i>
                    </button>
                    <div class="floating-action-label">Gerenciar</div>
                    <div class="floating-dropdown">
                        <a href="#" class="floating-dropdown-item" onclick="showAddressModal()">
                            <i class="bi bi-building"></i>
                            Nova Garagem para RAT
                        </a>
                        <a href="#" class="floating-dropdown-item" onclick="showTechnicianModal()">
                            <i class="bi bi-person-plus"></i>
                            Novo Técnico
                        </a>
                    </div>
                </div>

                <!-- Admin (apenas para admins) -->
                ${this.isAdmin() ? `
                <div class="floating-menu-item">
                    <button class="floating-action-item admin" data-menu="admin" aria-label="Administração">
                        <i class="bi bi-shield-lock"></i>
                    </button>
                    <div class="floating-action-label">Admin</div>
                    <div class="floating-dropdown">
                        <a href="/user-manager" target="_blank" class="floating-dropdown-item">
                            <i class="bi bi-people"></i>
                            Gerenciar Usuários
                        </a>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        // Adicionar ao body
        document.body.insertAdjacentHTML('beforeend', floatingHTML);
    }

    setupEventListeners() {
        // Botão principal
        document.addEventListener('click', (e) => {
            if (e.target.closest('#floatingActionBtn')) {
                this.toggleMenu();
            }
        });

        // Fechar menu ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.floating-action-button') && 
                !e.target.closest('.floating-menu') && 
                this.isOpen) {
                this.closeMenu();
            }
        });

        // Suporte a teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeMenu();
            }
        });

        // Fechar dropdowns quando não está em hover
        document.addEventListener('mouseleave', (e) => {
            if (e.target.closest('.floating-menu-item')) {
                const dropdown = e.target.closest('.floating-menu-item').querySelector('.floating-dropdown');
                if (dropdown) {
                    dropdown.style.opacity = '0';
                    dropdown.style.visibility = 'hidden';
                }
            }
        });
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const button = document.getElementById('floatingActionBtn');
        const menu = document.getElementById('floatingMenu');
        
        if (button && menu) {
            button.classList.add('active');
            menu.classList.add('active');
            button.querySelector('i').className = 'bi bi-x';
            this.isOpen = true;
            
            // Animação de feedback
            this.addClickFeedback(button);
            
            console.log('🎯 Menu Flutuante Aberto');
        }
    }

    closeMenu() {
        const button = document.getElementById('floatingActionBtn');
        const menu = document.getElementById('floatingMenu');
        
        if (button && menu) {
            button.classList.remove('active');
            menu.classList.remove('active');
            button.querySelector('i').className = 'bi bi-plus';
            this.isOpen = false;
            
            // Animação de feedback
            this.addClickFeedback(button);
            
            console.log('🎯 Menu Flutuante Fechado');
        }
    }

    addClickFeedback(element) {
        if (element) {
            element.style.transform = 'scale(0.95)';
            setTimeout(() => {
                element.style.transform = '';
            }, 150);
        }
    }

    isAdmin() {
        // Verificar se o usuário é admin (pode ser adaptado conforme necessário)
        return document.querySelector('[data-admin="true"]') || 
               document.querySelector('.admin-menu') ||
               window.userIsAdmin === true;
    }

    // Método público para abrir/fechar programaticamente
    static getInstance() {
        if (!window.floatingActionMenu) {
            window.floatingActionMenu = new FloatingActionMenu();
        }
        return window.floatingActionMenu;
    }
}

/* ===================================================================
   UTILITÁRIOS E HELPERS
   ================================================================== */

// Função para mostrar notificação quando menu é criado
function showFloatingMenuNotification() {
    // Criar uma notificação sutil para informar sobre o menu
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 30px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 10px 15px;
        border-radius: 25px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1002;
        transform: translateX(-20px);
        opacity: 0;
        transition: all 0.3s ease;
        pointer-events: none;
    `;
    notification.textContent = '💡 Clique no + para acessar os menus';
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 1000);
    
    // Remover após alguns segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(-20px)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

/* ===================================================================
   INICIALIZAÇÃO
   ================================================================== */

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Pequeno delay para garantir que outros scripts carregaram
    setTimeout(() => {
        const floatingMenu = FloatingActionMenu.getInstance();
        
        // Mostrar notificação sobre o menu após um tempo
        setTimeout(showFloatingMenuNotification, 3000);
        
        console.log('🎯 Sistema de Menu Flutuante Carregado');
    }, 500);
});

// Disponibilizar globalmente para debug
window.FloatingActionMenu = FloatingActionMenu;

/* ===================================================================
   CONSOLE STYLING
   ================================================================== */

const menuStyles = {
    success: 'color: #10b981; font-weight: bold;',
    info: 'color: #3b82f6; font-weight: bold;',
    warning: 'color: #f59e0b; font-weight: bold;'
};

console.log('%c🎯 Floating Action Menu System Loaded', menuStyles.success);