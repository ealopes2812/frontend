/**
 * 📱 OTIMIZAÇÕES MOBILE JAVASCRIPT - WiFiMaxx Monitor
 * Melhorias de performance e UX para dispositivos móveis
 * Atualizado em: 09-09-2025 - Suporte ao zoom e responsividade
 */

(function() {
    'use strict';

    // ===== DETECÇÃO DE DISPOSITIVO =====
    const isMobile = () => {
        return window.innerWidth <= 575.98;
    };
    
    const isTablet = () => {
        return window.innerWidth > 575.98 && window.innerWidth <= 991.98;
    };

    const isTouch = () => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };
    
    // ===== CONFIGURAÇÕES MOBILE =====
    const mobileConfig = {
        dateFormat: 'dd/mm/yy',
        enableZoom: true,
        optimizeTouch: true,
        compactMode: true
    };

    // ===== PERFORMANCE OPTIMIZATIONS =====
    
    // Debounce para redimensionamento
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // Throttle para scroll
    const throttle = (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // ===== OTIMIZAÇÕES ESPECÍFICAS MOBILE =====
    
    /**
     * Otimizar campos de data para formato brasileiro compacto
     */
    const optimizeDateFields = () => {
        if (!isMobile()) return;
        const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
        dateInputs.forEach(input => {
            // Skip if already wrapped by our helper
            if (input.closest('.date-input-wrapper')) {
                input.classList.add('date-mobile-optimized');
                return;
            }

            // Aplicar classes mobile
            input.classList.add('date-mobile-optimized');

            // Criar wrapper e elemento de display formatado (overlay)
            try {
                const wrapper = document.createElement('div');
                wrapper.className = 'date-input-wrapper position-relative';
                wrapper.style.position = 'relative';
                // Inserir wrapper no lugar do input
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);

                // Criar input de display (read-only) sobreposto
                const display = document.createElement('input');
                display.type = 'text';
                display.readOnly = true;
                display.className = 'form-control modern-form-control formatted-date';
                display.style.position = 'absolute';
                display.style.top = '0';
                display.style.left = '0';
                display.style.width = '100%';
                display.style.border = 'none';
                display.style.background = 'white';
                display.style.pointerEvents = 'auto';
                display.style.zIndex = '999';
                display.style.cursor = 'text';
                display.style.padding = window.getComputedStyle(input).padding || '6px 8px';
                display.style.borderRadius = window.getComputedStyle(input).borderRadius || '6px';

                // When clicking the overlay, try to open the native picker (best UX)
                display.addEventListener('click', (e) => {
                    e.preventDefault();
                    try {
                        // Prefer the standardized API when available
                        if (typeof input.showPicker === 'function') {
                            input.showPicker();
                        } else {
                            // Fallback: focus and dispatch a click to trigger native picker
                            input.focus();
                            try { input.click(); } catch (e) {}
                        }
                    } catch (err) {
                        try { input.focus(); } catch (e) {}
                    }
                    // Hide the overlay while the picker is open; it will be restored on blur
                    display.style.visibility = 'hidden';
                });
                wrapper.appendChild(display);

                // Formatter ISO YYYY-MM-DD to DD/MM/YYYY
                const isoToShort = (iso) => {
                    if (!iso) return '';
                    const parts = iso.split('-');
                    if (parts.length !== 3) return iso;
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                };

                const refresh = () => {
                    display.value = isoToShort(input.value);
                };

                // Atualizar quando valor muda por interação do usuário
                input.addEventListener('change', refresh);
                input.addEventListener('input', refresh);

                // Esconder overlay quando o usuário foca (mostrar seletor nativo)
                input.addEventListener('focus', () => { display.style.visibility = 'hidden'; });
                input.addEventListener('blur', () => { display.style.visibility = 'visible'; refresh(); });

                // Inicializar display
                refresh();

                // Ocultar visual do input nativo (alguns navegadores mobile mostram outra representação)
                try {
                    input.style.opacity = '0';
                    input.style.color = 'transparent';
                    input.style.webkitTextFillColor = 'transparent';
                    input.style.appearance = 'none';
                    input.style.webkitAppearance = 'none';
                    // Desabilitar pointer-events no input nativo: o overlay tratará os cliques
                    input.style.pointerEvents = 'none';
                    // Garantir que o overlay fique acima do input
                    input.style.zIndex = '998';
                } catch(e) {}

                // Alguns scripts setam input.value programaticamente (sem disparar eventos).
                // Vamos fazer um polling leve para detectar mudanças e atualizar o overlay.
                if (!input.dataset._datePoll) {
                    input.dataset._datePoll = '1';
                    input.dataset._lastVal = input.value || '';
                    const pollInterval = setInterval(() => {
                        try {
                            if (input.value !== input.dataset._lastVal) {
                                input.dataset._lastVal = input.value;
                                refresh();
                            }
                            // Se o input for removido do DOM, parar o polling
                            if (!document.contains(input)) {
                                clearInterval(pollInterval);
                            }
                        } catch (e) {}
                    }, 250);
                }
            } catch (e) {
                console.warn('Não foi possível aplicar overlay de data:', e);
            }
        });
    };
    
    /**
     * Otimizar interface do usuário para mobile
     */
    const optimizeUserInterface = () => {
        if (!isMobile()) return;
        
        // Ocultar email do usuário, manter apenas ícone
        const userEmailElements = document.querySelectorAll('.user-email-desktop span');
        userEmailElements.forEach(element => {
            if (element.textContent.includes('@') || element.textContent.length > 15) {
                element.classList.add('d-mobile-none');
            }
        });
        
        // Otimizar textos dos menus
        const menuTexts = document.querySelectorAll('.dropdown .btn span:not(.visually-hidden)');
        menuTexts.forEach(span => {
            if (span.textContent.length > 6) {
                span.classList.add('d-none', 'd-sm-inline');
            }
        });
        
        // Adicionar classes responsivas aos cards
        const statusCards = document.querySelectorAll('.status-card');
        statusCards.forEach(card => {
            card.classList.add('mobile-optimized-card');
        });
    };
    
    /**
     * Otimizar viewport para suporte ao zoom
     */
    const optimizeViewport = () => {
        if (!isMobile()) return;
        
        // Permitir zoom mas manter controle
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover'
            );
        }
    };
    
    /**
     * Melhorar targets de toque
     */
    const optimizeTouchTargets = () => {
        if (!isTouch()) return;
        
        const touchElements = document.querySelectorAll('button, .btn, .nav-link, .dropdown-item');
        touchElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            if (rect.height < 44 || rect.width < 44) {
                element.classList.add('touch-target');
                element.style.minHeight = '44px';
                element.style.minWidth = '44px';
                element.style.display = 'flex';
                element.style.alignItems = 'center';
                element.style.justifyContent = 'center';
            }
        });
    };
    
    /**
     * Configurar feedback visual para toque
     */
    const setupTouchFeedback = () => {
        if (!isTouch()) return;
        
        document.addEventListener('touchstart', function(e) {
            if (e.target.matches('button, .btn, .clickable-card, .status-card')) {
                e.target.style.transform = 'scale(0.95)';
                e.target.style.opacity = '0.8';
                e.target.style.transition = 'all 0.1s ease';
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
            if (e.target.matches('button, .btn, .clickable-card, .status-card')) {
                setTimeout(() => {
                    e.target.style.transform = '';
                    e.target.style.opacity = '';
                }, 150);
            }
        }, { passive: true });
    };
    
    /**
     * Inicialização principal das otimizações mobile
     */
    const initMobileOptimizationsAdvanced = () => {
        if (isMobile()) {
            console.log('📱 Inicializando otimizações mobile avançadas');
            
            // Aplicar todas as otimizações
            optimizeDateFields();
            optimizeUserInterface();
            optimizeViewport();
            optimizeTouchTargets();
            setupTouchFeedback();
            
            // Adicionar classe ao body
            document.body.classList.add('mobile-optimized');
            
            // Marcar como inicializado
            window.mobileOptimized = true;
        }
    };

    // ===== TOUCH GESTURES =====
    const addTouchGestures = () => {
        let startY = 0;
        let startTime = 0;

        // Pull to refresh
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].pageY;
            startTime = Date.now();
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (window.scrollY === 0) {
                const currentY = e.touches[0].pageY;
                const deltaY = currentY - startY;
                
                if (deltaY > 100 && Date.now() - startTime < 1000) {
                    // Pull to refresh detectado
                    showPullToRefresh();
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            hidePullToRefresh();
        }, { passive: true });
    };

    // ===== INTERFACE MOBILE =====
    
    // Scroll automático para elementos
    const smoothScrollTo = (element, offset = 0) => {
        if (element) {
            const elementPosition = element.offsetTop - offset;
            window.scrollTo({
                top: elementPosition,
                behavior: 'smooth'
            });
        }
    };

    // Feedback visual para toque
    const addTouchFeedback = () => {
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.btn, .nav-link, .clickable-card');
            if (target) {
                target.classList.add('touch-active');
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('.btn, .nav-link, .clickable-card');
            if (target) {
                setTimeout(() => {
                    target.classList.remove('touch-active');
                }, 150);
            }
        }, { passive: true });
    };

    // ===== VIRTUAL KEYBOARD HANDLING =====
    const handleVirtualKeyboard = () => {
        let initialViewportHeight = window.innerHeight;
        
        const handleResize = debounce(() => {
            const currentHeight = window.innerHeight;
            const heightDiff = initialViewportHeight - currentHeight;
            
            if (heightDiff > 150) {
                // Teclado virtual aberto
                document.body.classList.add('keyboard-open');
                
                // Scroll para o input ativo
                const activeElement = document.activeElement;
                if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
                    setTimeout(() => {
                        smoothScrollTo(activeElement, 50);
                    }, 300);
                }
            } else {
                // Teclado virtual fechado
                document.body.classList.remove('keyboard-open');
            }
        }, 100);

        window.addEventListener('resize', handleResize);
    };

    // ===== OTIMIZAÇÃO DE TABELAS =====
    const optimizeTables = () => {
        const tables = document.querySelectorAll('.table-responsive');
        
        tables.forEach(table => {
            // Adicionar scroll horizontal suave
            table.style.scrollbarWidth = 'thin';
            table.classList.add('scroll-optimized');
            
            // Mostrar indicador de scroll
            const scrollIndicator = document.createElement('div');
            scrollIndicator.className = 'scroll-indicator d-mobile-only';
            scrollIndicator.innerHTML = '← Deslize para ver mais →';
            scrollIndicator.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                z-index: 10;
                animation: fadeOut 3s ease-out forwards;
            `;
            
            table.style.position = 'relative';
            table.appendChild(scrollIndicator);
        });
    };

    // ===== CACHE INTELIGENTE =====
    const cacheManager = {
        set: (key, data, ttl = 5 * 60 * 1000) => {
            const now = Date.now();
            const item = {
                data: data,
                expiry: now + ttl
            };
            localStorage.setItem(`mobile_cache_${key}`, JSON.stringify(item));
        },
        
        get: (key) => {
            const itemStr = localStorage.getItem(`mobile_cache_${key}`);
            if (!itemStr) return null;
            
            const item = JSON.parse(itemStr);
            const now = Date.now();
            
            if (now > item.expiry) {
                localStorage.removeItem(`mobile_cache_${key}`);
                return null;
            }
            
            return item.data;
        },
        
        clear: () => {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('mobile_cache_')) {
                    localStorage.removeItem(key);
                }
            });
        }
    };

    // ===== LOADING OTIMIZADO =====
    const showMobileLoading = (message = 'Carregando...') => {
        const existingLoader = document.querySelector('.mobile-loader');
        if (existingLoader) return;

        const loader = document.createElement('div');
        loader.className = 'mobile-loader';
        loader.innerHTML = `
            <div class="mobile-loader-content">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 mb-0">${message}</p>
            </div>
        `;
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        
        document.body.appendChild(loader);
    };

    const hideMobileLoading = () => {
        const loader = document.querySelector('.mobile-loader');
        if (loader) {
            loader.remove();
        }
    };

    // ===== PULL TO REFRESH =====
    const showPullToRefresh = () => {
        const refreshIndicator = document.createElement('div');
        refreshIndicator.id = 'pull-refresh-indicator';
        refreshIndicator.innerHTML = '↓ Solte para atualizar';
        refreshIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--primary-color);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 1000;
            animation: slideDown 0.3s ease-out;
        `;
        
        document.body.appendChild(refreshIndicator);
    };

    const hidePullToRefresh = () => {
        const indicator = document.getElementById('pull-refresh-indicator');
        if (indicator) {
            indicator.remove();
        }
    };

    // ===== NETWORK OPTIMIZATION =====
    const networkOptimization = {
        isSlowConnection: () => {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
            }
            return false;
        },
        
        preloadCriticalData: async () => {
            if (networkOptimization.isSlowConnection()) {
                return; // Não precarregar em conexões lentas
            }
            
            // Precarregar dados críticos
            try {
                const cachedData = cacheManager.get('dashboard_data');
                if (!cachedData) {
                    // Precarregar dados em background
                    fetch('/api/data')
                        .then(response => response.json())
                        .then(data => {
                            cacheManager.set('dashboard_data', data);
                        })
                        .catch(console.error);
                }
            } catch (error) {
                console.warn('Preload failed:', error);
            }
        }
    };

    // ===== CONFIGURAÇÃO DOS FILTROS MOBILE =====
    const setupMobileFilters = () => {
        if (!isMobile()) return;
        
        console.log('📱 Configurando filtros para mobile...');
        
        // Configurar labels dos filtros
        const filterSelects = document.querySelectorAll('[data-mobile-label]');
        
        filterSelects.forEach(select => {
            const label = select.getAttribute('data-mobile-label');
            if (label) {
                // Adicionar estilo personalizado para cada filtro
                const wrapper = select.closest('.filter-group');
                if (wrapper) {
                    wrapper.setAttribute('data-mobile-label', label);
                    
                    // Melhorar acessibilidade
                    select.setAttribute('aria-label', `Filtro ${label}`);
                    
                    // Adicionar evento para feedback visual
                    select.addEventListener('focus', function() {
                        wrapper.style.transform = 'translateY(-2px)';
                        wrapper.style.transition = 'all 0.2s ease';
                    });
                    
                    select.addEventListener('blur', function() {
                        wrapper.style.transform = 'translateY(0)';
                    });
                }
            }
        });
        
        // Configurar botão de busca especificamente
        const searchButton = document.getElementById('searchFilterDropdown');
        if (searchButton) {
            // Melhorar aparência do botão de busca
            searchButton.style.position = 'relative';
            
            // Adicionar evento para melhorar UX
            searchButton.addEventListener('click', function() {
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 100);
            });
        }
        
        // Configurar campo de busca
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            // Melhorar UX do campo de busca
            searchInput.addEventListener('focus', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 8px 25px rgba(23,162,184,0.3)';
            });
            
            searchInput.addEventListener('blur', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
            });
        }
        
        // Configurar botão de limpar busca
        const clearButton = document.getElementById('clearSearch');
        if (clearButton) {
            clearButton.addEventListener('click', function() {
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 100);
            });
        }
        
        console.log('✅ Filtros mobile configurados!');
    };

    // ===== INICIALIZAÇÃO =====
    const initMobileOptimizations = () => {
        console.log('📱 Inicializando otimizações mobile...');
        
        // Aplicar classes baseadas no dispositivo
        if (isMobile()) {
            document.body.classList.add('mobile-device');
            // Executar otimizações avançadas para mobile
            initMobileOptimizationsAdvanced();
        }
        
        if (isTouch()) {
            document.body.classList.add('touch-device');
        }
        
        // Registrar Service Worker para PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/static/sw.js')
                .then((registration) => {
                    console.log('✅ Service Worker registrado:', registration);
                })
                .catch((error) => {
                    console.warn('⚠️ Service Worker falhou:', error);
                });
        }
        
        // Inicializar recursos
        // lazyLoadImages(); // Removido - não necessário para watchlist
        
        // Definir função vazia para evitar erros
        if (!window.lazyLoadImages) {
            window.lazyLoadImages = function() { /* no-op */ };
        }
        
        addTouchGestures();
        addTouchFeedback();
        handleVirtualKeyboard();
        optimizeTables();
        networkOptimization.preloadCriticalData();
        setupMobileFilters(); // Configurar filtros para mobile
        
        // Adicionar estilos CSS dinâmicos
        const mobileStyles = document.createElement('style');
        mobileStyles.textContent = `
            .touch-active {
                transform: scale(0.98);
                transition: transform 0.1s ease-out;
            }
            
            .keyboard-open {
                height: 100vh;
                overflow: hidden;
            }
            
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100%); }
                to { transform: translateX(-50%) translateY(0); }
            }
            
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; }
            }
            
            .scroll-indicator {
                pointer-events: none;
            }
        `;
        document.head.appendChild(mobileStyles);
        
        console.log('✅ Otimizações mobile ativadas!');
    };

    // ===== EXPORTAR FUNÇÕES GLOBAIS =====
    window.MobileOptimizations = {
        showLoading: showMobileLoading,
        hideLoading: hideMobileLoading,
        smoothScrollTo: smoothScrollTo,
        cacheManager: cacheManager,
        isMobile: isMobile,
        isTouch: isTouch
    };

    // ===== AUTO-INICIALIZAÇÃO =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileOptimizations);
    } else {
        initMobileOptimizations();
    }

})();
