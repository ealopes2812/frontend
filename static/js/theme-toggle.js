/* ===================================================================
   THEME TOGGLE SYSTEM - Modern Dark/Light Mode
   WifiMaxx Monitor - Advanced Theme Management
   ================================================================== */

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.init();
    }

    init() {
        this.createToggleButton();
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.detectSystemTheme();
    }

    /* ===============================================================
       THEME STORAGE & DETECTION
       =============================================================== */

    getStoredTheme() {
        try {
            return localStorage.getItem('wifimaxx-theme');
        } catch (e) {
            console.warn('LocalStorage não disponível, usando tema padrão');
            return null;
        }
    }

    storeTheme(theme) {
        try {
            localStorage.setItem('wifimaxx-theme', theme);
        } catch (e) {
            console.warn('Não foi possível salvar o tema');
        }
    }

    detectSystemTheme() {
        if (window.matchMedia && !this.getStoredTheme()) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
            this.applyTheme(this.currentTheme);
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!this.getStoredTheme()) {
                    this.currentTheme = e.matches ? 'dark' : 'light';
                    this.applyTheme(this.currentTheme);
                }
            });
        }
    }

    /* ===============================================================
       TOGGLE BUTTON CREATION
       =============================================================== */

    createToggleButton() {
        // Check if button already exists
        if (document.querySelector('.theme-toggle')) {
            return;
        }

        const toggleButton = document.createElement('button');
        toggleButton.className = 'theme-toggle';
        toggleButton.setAttribute('aria-label', 'Alternar tema escuro/claro');
        toggleButton.setAttribute('title', 'Alternar tema');
        toggleButton.setAttribute('role', 'button');
        // Minimal two-dots UI
        toggleButton.innerHTML = `
            <span class="dot dot-dark" aria-hidden="true"></span>
            <span class="dot dot-light" aria-hidden="true"></span>
        `;

        // Prefer placing inside the header menus container
        const headerMenus = document.querySelector('.header-menus');
        if (headerMenus) {
            headerMenus.prepend(toggleButton);
        } else {
            // Fallback to header or body
            const header = document.querySelector('header.main-header');
            if (header) {
                header.style.position = 'relative';
                header.appendChild(toggleButton);
            } else {
                document.body.appendChild(toggleButton);
            }
        }

        return toggleButton;
    }

    /* ===============================================================
       THEME APPLICATION
       =============================================================== */

    applyTheme(theme) {
        const html = document.documentElement;
        const body = document.body;
        
        console.log(`🎨 Aplicando tema: ${theme}`);
        
        // Add transition class to prevent flicker
        html.classList.add('theme-transitioning');
        
        // MOBILE FIX: Force clear all theme states first
        html.removeAttribute('data-theme');
        body.removeAttribute('data-theme');
        html.classList.remove('light-theme', 'dark-theme');
        body.classList.remove('light-theme', 'dark-theme');
        
        // Apply theme - IMPORTANT: dark theme = NO attribute, light theme = 'light' attribute
        if (theme === 'light') {
            html.setAttribute('data-theme', 'light');
            body.setAttribute('data-theme', 'light');
            html.classList.add('light-theme');
            body.classList.add('light-theme');
            console.log('🎨 Tema LIGHT aplicado - data-theme="light"');
        } else {
            html.removeAttribute('data-theme');
            body.removeAttribute('data-theme');
            html.classList.add('dark-theme');
            body.classList.add('dark-theme');
            console.log('🎨 Tema DARK aplicado - data-theme removido');
        }

        // Store theme preference
        this.storeTheme(theme);
        this.currentTheme = theme;

        // MOBILE FIX: Force immediate theme application
        this.forceMobileThemeUpdate(theme);

        // Force re-render of filter labels IMMEDIATELY
        setTimeout(() => {
            console.log('🎨 Primeira atualização (10ms)');
            this.forceFilterStyleUpdate();
            this.forceMobileThemeUpdate(theme);
        }, 10);

        // Remove transition class and force update again
        setTimeout(() => {
            html.classList.remove('theme-transitioning');
            console.log('🎨 Segunda atualização (100ms) - transições removidas');
            this.forceFilterStyleUpdate();
            this.forceMobileThemeUpdate(theme);
        }, 100);

        // Update button state
        this.updateButtonState();

        // Final force update for any stubborn elements
        setTimeout(() => {
            console.log('🎨 Terceira atualização (300ms) - limpeza final');
            this.forceFilterStyleUpdate();
            this.forceMobileThemeUpdate(theme);
        }, 300);

        // Dispatch custom event
        this.dispatchThemeChangeEvent(theme);

        console.log(`🎨 Tema ${theme} aplicado com sucesso`);
    }

    /* ===============================================================
       MOBILE THEME FIX - FORÇA APLICAÇÃO CORRETA NO MOBILE
       =============================================================== */

    forceMobileThemeUpdate(theme) {
        const html = document.documentElement;
        const body = document.body;
        
        console.log(`📱 Forçando aplicação de tema mobile: ${theme}`);
        
        // Detectar se é mobile
        const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
        
        if (isMobile) {
            console.log('📱 Dispositivo mobile detectado - aplicando correções');
            
            // Force remove all existing theme classes and attributes
            html.removeAttribute('data-theme');
            body.removeAttribute('data-theme');
            html.classList.remove('light-theme', 'dark-theme');
            body.classList.remove('light-theme', 'dark-theme');
            
            // Force reflow
            html.offsetHeight;
            body.offsetHeight;
            
            if (theme === 'light') {
                // Aplicar tema claro com força total
                html.setAttribute('data-theme', 'light');
                body.setAttribute('data-theme', 'light');
                html.classList.add('light-theme');
                body.classList.add('light-theme');
                
                // Force CSS properties directly for mobile
                body.style.setProperty('background', 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf0 100%)', 'important');
                body.style.setProperty('color', '#2c3e50', 'important');
                
                console.log('📱 Tema LIGHT forçado no mobile');
            } else {
                // Aplicar tema escuro com força total
                html.classList.add('dark-theme');
                body.classList.add('dark-theme');
                body.setAttribute('data-theme', 'dark');
                
                // Force CSS properties directly for mobile
                body.style.setProperty('background', 'linear-gradient(135deg, #0f172a 0%, #0b1220 100%)', 'important');
                body.style.setProperty('color', '#e9ecef', 'important');
                
                console.log('📱 Tema DARK forçado no mobile');
            }
            
            // Force reflow again
            html.offsetHeight;
            body.offsetHeight;
        }
    }

    /* ===============================================================
       FORCE FILTER STYLE UPDATE - ULTIMATE NUCLEAR APPROACH
       =============================================================== */

    forceFilterStyleUpdate() {
        console.log('🎨 Forçando atualização NUCLEAR de estilos dos filtros...');
        
        // Get current theme - check both attribute and current class state
        const html = document.documentElement;
        const themeAttribute = html.getAttribute('data-theme');
        const isDarkTheme = (themeAttribute === null || themeAttribute === 'dark');
        
        console.log(`🎨 Tema detectado: ${themeAttribute} | isDarkTheme: ${isDarkTheme}`);
        
        // Force re-render of filter elements with NUCLEAR approach
        const filterElements = document.querySelectorAll('.filter-label-adaptive, .filter-icon-adaptive, .filter-group-label');
        
        console.log(`🎨 Encontrados ${filterElements.length} elementos de filtro para atualização NUCLEAR`);
        
        filterElements.forEach((element, index) => {
            console.log(`🎨 NUCLEAR: Atualizando elemento ${index + 1}: ${element.className}`);
            
            // NUCLEAR: Remove ALL style properties
            element.removeAttribute('style');
            
            // Force browser to recalculate styles
            element.style.display = 'none';
            element.offsetHeight; // Trigger reflow
            element.style.display = '';
            element.offsetHeight; // Another reflow
            
            // NUCLEAR: Apply theme-specific styles with setProperty to force !important
            if (isDarkTheme) {
                if (element.classList.contains('filter-label-adaptive')) {
                    element.style.setProperty('color', '#ffffff', 'important');
                    element.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.3)', 'important');
                    element.style.setProperty('font-weight', '600', 'important');
                    element.style.setProperty('opacity', '0.95', 'important');
                } else if (element.classList.contains('filter-icon-adaptive')) {
                    element.style.setProperty('color', '#f8fafc', 'important');
                    element.style.setProperty('filter', 'brightness(1.1)', 'important');
                    element.style.setProperty('opacity', '0.9', 'important');
                } else if (element.classList.contains('filter-group-label')) {
                    element.style.setProperty('color', '#ffffff', 'important');
                    element.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.1)', 'important');
                    element.style.setProperty('opacity', '1', 'important');
                }
            } else { // Light theme
                if (element.classList.contains('filter-label-adaptive')) {
                    element.style.setProperty('color', '#2c3e50', 'important');
                    element.style.setProperty('text-shadow', 'none', 'important');
                    element.style.setProperty('font-weight', '500', 'important');
                    element.style.setProperty('opacity', '0.9', 'important');
                } else if (element.classList.contains('filter-icon-adaptive')) {
                    element.style.setProperty('color', '#374151', 'important');
                    element.style.setProperty('filter', 'none', 'important');
                    element.style.setProperty('opacity', '0.85', 'important');
                } else if (element.classList.contains('filter-group-label')) {
                    element.style.setProperty('color', '#1f2937', 'important');
                    element.style.setProperty('text-shadow', 'none', 'important');
                    element.style.setProperty('opacity', '0.95', 'important');
                }
            }
            
            console.log(`🎨 NUCLEAR: Elemento ${index + 1} | Tema: ${isDarkTheme ? 'DARK' : 'LIGHT'} | Cor: ${element.style.color}`);
        });

        // NUCLEAR: Also force update on ALL spans and icons in the page
        const allSpans = document.querySelectorAll('span.filter-label-adaptive, i.filter-icon-adaptive, span.filter-group-label, i.filter-group-label');
        allSpans.forEach((element, index) => {
            console.log(`🎨 NUCLEAR SPAN: Atualizando elemento ${index + 1}`);
            
            // NUCLEAR: Remove ALL style properties
            element.removeAttribute('style');
            
            // Force reflow
            element.style.display = 'none';
            element.offsetHeight;
            element.style.display = '';
            
            // Apply direct styles with setProperty for !important
            if (isDarkTheme) {
                if (element.classList.contains('filter-label-adaptive') || element.classList.contains('filter-group-label')) {
                    element.style.setProperty('color', '#ffffff', 'important');
                    element.style.setProperty('opacity', '0.95', 'important');
                    element.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.3)', 'important');
                    element.style.setProperty('font-weight', '600', 'important');
                } else if (element.classList.contains('filter-icon-adaptive')) {
                    element.style.setProperty('color', '#f8fafc', 'important');
                    element.style.setProperty('opacity', '0.9', 'important');
                    element.style.setProperty('filter', 'brightness(1.1)', 'important');
                }
            } else { // Light theme
                if (element.classList.contains('filter-label-adaptive') || element.classList.contains('filter-group-label')) {
                    element.style.setProperty('color', '#2c3e50', 'important');
                    element.style.setProperty('opacity', '0.9', 'important');
                    element.style.setProperty('text-shadow', 'none', 'important');
                    element.style.setProperty('font-weight', '500', 'important');
                } else if (element.classList.contains('filter-icon-adaptive')) {
                    element.style.setProperty('color', '#374151', 'important');
                    element.style.setProperty('opacity', '0.85', 'important');
                    element.style.setProperty('filter', 'none', 'important');
                }
            }
            
            console.log(`🎨 NUCLEAR SPAN: ${index + 1} | Tema: ${isDarkTheme ? 'DARK' : 'LIGHT'} | Cor: ${element.style.color}`);
        });
        
        console.log('🎨 Atualização NUCLEAR de estilos dos filtros concluída');
    }

    updateButtonState() {
        const button = document.querySelector('.theme-toggle');
        if (button) {
            const label = this.currentTheme === 'light' 
                ? 'Alterar para tema escuro' 
                : 'Alterar para tema claro';
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        }
    }

    /* ===============================================================
       EVENT HANDLING
       =============================================================== */

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-toggle')) {
                e.preventDefault();
                this.toggleTheme();
            }
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.target.closest('.theme-toggle') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        
        // Add switching class for animation
        const button = document.querySelector('.theme-toggle');
        if (button) {
            button.classList.add('switching');
            setTimeout(() => {
                button.classList.remove('switching');
            }, 600);
        }
        
        this.applyTheme(newTheme);
        
        // Add click feedback
        this.addClickFeedback();
    }

    addClickFeedback() {
        const button = document.querySelector('.theme-toggle');
        if (button) {
            button.style.transform = 'translateY(-50%) translateY(-1px) scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        }
    }

    /* ===============================================================
       CUSTOM EVENTS
       =============================================================== */

    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themeChanged', {
            detail: { theme: theme },
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    /* ===============================================================
       PUBLIC API
       =============================================================== */

    getCurrentTheme() {
        return this.currentTheme;
    }

    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
        } else {
            console.warn('Tema inválido. Use "light" ou "dark"');
        }
    }

    /* ===============================================================
       COMPONENT INTEGRATION
       =============================================================== */

    adaptComponents() {
        // Adapt any existing components that need special handling
        this.adaptCharts();
        this.adaptTables();
    }

    adaptCharts() {
        // If you have charts that need theme adaptation
        const charts = document.querySelectorAll('[data-chart]');
        charts.forEach(chart => {
            // Update chart colors based on theme
        });
    }

    adaptTables() {
        // Special table adaptations if needed
        const tables = document.querySelectorAll('.table-container-glass .table');
        tables.forEach(table => {
            // Any special table theme handling
        });
    }
}

/* ===================================================================
   INITIALIZATION
   ================================================================== */

// Initialize theme system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    
    console.log('🌙 Sistema de Tema Inicializado');
    console.log(`📱 Tema atual: ${window.themeManager.getCurrentTheme()}`);
});

// Listen for theme changes
document.addEventListener('themeChanged', (e) => {
    console.log(`🎨 Evento de mudança de tema: ${e.detail.theme}`);
    
    // Notify other components about theme change
    if (window.universalSearch) {
        window.universalSearch.adaptToTheme(e.detail.theme);
    }
});

/* ===================================================================
   UTILITY FUNCTIONS
   ================================================================== */

// Helper function to check if dark theme is active
window.isDarkTheme = () => {
    return !document.documentElement.hasAttribute('data-theme') || 
           document.documentElement.getAttribute('data-theme') === 'dark';
};

// Helper function to get current theme
window.getCurrentTheme = () => {
    return window.themeManager ? window.themeManager.getCurrentTheme() : 'dark';
};

// Console styling for better debugging
const themeStyles = {
    info: 'color: #2196F3; font-weight: bold;',
    success: 'color: #4CAF50; font-weight: bold;',
    warning: 'color: #FF9800; font-weight: bold;'
};

console.log('%c🌙 Theme Toggle System Loaded', themeStyles.success);