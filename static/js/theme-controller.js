/**
 * WifiMaxx Monitor - Controlador de Tema
 * Controla a troca entre temas claro e escuro
 * Versão: 1.0.2
 */

// Identificar preferência inicial de tema
document.addEventListener('DOMContentLoaded', function() {
    // Se ThemeManager (theme-toggle.js) estiver ativo, evitar conflito e apenas sincronizar
    if (window.themeManager) {
        try {
            const current = window.themeManager.getCurrentTheme();
            document.documentElement.setAttribute('data-theme', current === 'dark' ? 'dark' : 'light');
        } catch (e) { /* noop */ }
        // Não registrar listeners duplicados
        return;
    }
    // Verificar se há uma preferência salva
    // Usar a mesma chave do ThemeManager para unificar persistência
    const savedTheme = localStorage.getItem('wifimaxx-theme') || localStorage.getItem('theme');
    
    // Se não houver preferência salva, usar a preferência do sistema
    if (!savedTheme) {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        
        if (prefersDarkScheme.matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('wifimaxx-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('wifimaxx-theme', 'light');
        }
    } else {
        // Usar a preferência salva
    document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    // Configurar botão de alternar tema
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            // Aplicar novo tema
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('wifimaxx-theme', newTheme);
            
            // Atualizar icone do botão
            updateThemeToggleIcon(newTheme);
        });
        
        // Configurar ícone inicial
        updateThemeToggleIcon(savedTheme || 
                             (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    }
});

// Atualizar ícone do botão de tema
function updateThemeToggleIcon(theme) {
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (themeToggle) {
        if (theme === 'dark') {
            themeToggle.classList.add('theme-dark');
            themeToggle.classList.remove('theme-light');
        } else {
            themeToggle.classList.add('theme-light');
            themeToggle.classList.remove('theme-dark');
        }
    }
}