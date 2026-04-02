/* ===================================================================
   INNOVATIVE SEARCH SYSTEM - Live Search with Smart Suggestions
   ================================================================== */

class InnovativeSearchSystem {
    constructor() {
        this.searchData = [];
        this.searchResults = [];
        this.searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        this.popularSearches = new Map();
        this.searchTimeout = null;
        this.minSearchLength = 1;
        this.maxSuggestions = 8;
        this.isSearchActive = false;
        
        this.init();
    }

    init() {
        console.log('🚀 Inicializando InnovativeSearchSystem...');
        this.createSearchInterface();
        this.setupEventListeners();
        this.loadSearchAnalytics();
        this.createTestButton(); // Adicionar botão de teste
    }

    createTestButton() {
        // Criar botão de teste
        const testBtn = document.createElement('button');
        testBtn.id = 'testSearchBtn';
        testBtn.innerHTML = 'Testar Busca "758"';
        testBtn.style.cssText = `
            position: fixed;
            top: 60px;
            left: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 12px;
            z-index: 9999;
            font-size: 12px;
            cursor: pointer;
        `;
        testBtn.onclick = () => {
            console.log('🧪 Teste manual iniciado');
            this.performLiveSearch('758');
        };
        document.body.appendChild(testBtn);
    }

    createSearchInterface() {
        // A estrutura já existe no HTML, vamos apenas integrar com ela
        const existingSearchInput = document.getElementById('searchInput');
        const searchChip = document.querySelector('.search-chip .chip-content');
        
        if (existingSearchInput && searchChip) {
            console.log('✅ Usando input de busca existente');
            // Adicionar ID alternativo para nossa compatibilidade
            existingSearchInput.setAttribute('data-innovative-search', 'true');
            
            // Mostrar o input existente
            const searchContainer = document.getElementById('searchInputContainer');
            if (searchContainer) {
                searchContainer.style.display = 'flex';
            }
            
            return;
        }

        // Fallback: encontrar o chip de busca e modificar
        const searchChipContent = document.querySelector('.search-chip .chip-content');
        if (!searchChipContent) {
            console.warn('⚠️ Chip de busca não encontrado');
            return;
        }

        // Verificar se já foi modificado
        if (searchChipContent.querySelector('.innovative-search-container')) {
            console.log('✅ Interface de busca já criada');
            return;
        }

        console.log('🔧 Criando interface de busca inovadora...');

        // Substituir o conteúdo do chip por uma interface mais moderna
        searchChipContent.innerHTML = `
            <span class="chip-label">Buscar</span>
            <div class="innovative-search-container">
                <div class="search-input-wrapper">
                    <input type="text" 
                           id="innovativeSearchInput" 
                           class="innovative-search-input" 
                           placeholder="Digite para buscar..."
                           autocomplete="off"
                           spellcheck="false">
                    <div class="search-actions">
                        <button class="search-clear-btn" id="searchClearBtn" style="display: none;">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Suggestions Dropdown -->
                <div class="search-suggestions-dropdown" id="searchSuggestions" style="display: none;">
                    <div class="suggestions-header">
                        <div class="suggestions-title">
                            <i class="bi bi-lightning"></i>
                            <span>Resultados</span>
                        </div>
                        <div class="suggestions-count" id="suggestionsCount"></div>
                    </div>
                    
                    <div class="suggestions-content">
                        <!-- Search Suggestions -->
                        <div class="search-results-section" id="searchResultsSection" style="display: none;">
                            <div class="search-results-list" id="searchResultsList"></div>
                        </div>
                        
                        <!-- Quick Actions -->
                        <div class="quick-actions-section" id="quickActionsSection">
                            <div class="section-header">
                                <i class="bi bi-zap"></i>
                                <span>Ações Rápidas</span>
                            </div>
                            <div class="quick-actions-grid">
                                <button class="quick-action-btn" data-action="show-all">
                                    <i class="bi bi-grid"></i>
                                    <span>Ver Tudo</span>
                                </button>
                                <button class="quick-action-btn" data-action="online-only">
                                    <i class="bi bi-wifi"></i>
                                    <span>Só Online</span>
                                </button>
                                <button class="quick-action-btn" data-action="alerts-only">
                                    <i class="bi bi-exclamation-triangle"></i>
                                    <span>Só Alertas</span>
                                </button>
                                <button class="quick-action-btn" data-action="recent-changes">
                                    <i class="bi bi-clock-history"></i>
                                    <span>Recentes</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        console.log('✅ Interface de busca criada com sucesso');
    }

    setupEventListeners() {
        console.log('🎧 Configurando event listeners...');
        
        // Tentar encontrar input existente primeiro
        let searchInput = document.getElementById('innovativeSearchInput') || 
                         document.getElementById('searchInput') ||
                         document.querySelector('input[data-innovative-search="true"]');
        
        const clearBtn = document.getElementById('searchClearBtn');
        const filterBtn = document.getElementById('searchFilterBtn');
        const suggestions = document.getElementById('searchSuggestions');

        console.log('🔍 searchInput encontrado:', !!searchInput, searchInput?.id);
        console.log('🧹 clearBtn encontrado:', !!clearBtn);
        console.log('📋 suggestions encontrado:', !!suggestions);

        if (searchInput) {
            console.log('✅ Adicionando listeners ao input de busca:', searchInput.id);
            // Input events
            searchInput.addEventListener('input', (e) => {
                console.log('🎯 Event listener INPUT disparado com valor:', e.target.value);
                this.handleSearchInput(e);
            });
            searchInput.addEventListener('focus', () => this.handleSearchFocus());
            searchInput.addEventListener('blur', (e) => this.handleSearchBlur(e));
            searchInput.addEventListener('keydown', (e) => this.handleKeyNavigation(e));
        } else {
            console.error('❌ Input de busca não encontrado!');
            console.log('🔍 Tentando novamente em 1 segundo...');
            setTimeout(() => this.setupEventListeners(), 1000);
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSearch());
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilterOptions());
        }

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!searchInput?.contains(e.target) && !suggestions?.contains(e.target)) {
                this.hideSuggestions();
            }
        });

        // Quick actions
        this.setupQuickActions();
    }

    handleSearchInput(event) {
        const query = event.target.value;
        console.log('⌨️ handleSearchInput chamado com:', query);
        
        const clearBtn = document.getElementById('searchClearBtn');
        
        // Show/hide clear button
        if (clearBtn) {
            clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
        }

        // Debounce search
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            console.log('⏰ Timeout executado, iniciando busca...');
            this.performLiveSearch(query);
        }, 150);

        // Update search type indicator
        this.updateSearchTypeIndicator(query);
    }

    handleSearchFocus() {
        this.isSearchActive = true;
        this.showSuggestions();
        this.updateRecentSearches();
        this.updatePopularSearches();
    }

    handleSearchBlur(event) {
        // Delay to allow clicks on suggestions
        setTimeout(() => {
            if (!this.isInteractingWithSuggestions) {
                this.isSearchActive = false;
                this.hideSuggestions();
            }
        }, 200);
    }

    handleKeyNavigation(event) {
        const suggestions = document.querySelectorAll('.suggestion-item, .quick-action-btn');
        const currentIndex = Array.from(suggestions).findIndex(s => s.classList.contains('selected'));

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectSuggestion(currentIndex + 1, suggestions);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectSuggestion(currentIndex - 1, suggestions);
                break;
            case 'Enter':
                event.preventDefault();
                const selected = document.querySelector('.suggestion-item.selected, .quick-action-btn.selected');
                if (selected) {
                    selected.click();
                } else {
                    this.executeSearch(event.target.value);
                }
                break;
            case 'Escape':
                this.hideSuggestions();
                event.target.blur();
                break;
        }
    }

    performLiveSearch(query) {
        if (!query || query.length < this.minSearchLength) {
            this.hideSearchResults();
            this.clearSearchFromTable();
            return;
        }

        console.log('🔍 Realizando busca por:', query);

        // Add visual debug in the page
        const debugElement = document.getElementById('searchDebug') || this.createDebugElement();
        debugElement.innerHTML = `Buscando por: "${query}"...`;

        // Add to search analytics
        this.trackSearch(query);

        // Perform fuzzy search
        const results = this.fuzzySearch(query);
        
        console.log('📊 Resultados encontrados:', results.length);
        debugElement.innerHTML += `<br>Encontrados: ${results.length} resultados`;
        
        // Show live results
        this.showLiveResults(results, query);
        
        // Apply to main table
        this.applySearchToTable(results);
        
        debugElement.innerHTML += `<br>Filtros aplicados à tabela`;
    }

    createDebugElement() {
        const debug = document.createElement('div');
        debug.id = 'searchDebug';
        debug.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #007bff;
            border-radius: 8px;
            padding: 10px;
            z-index: 9999;
            font-size: 12px;
            max-width: 300px;
        `;
        document.body.appendChild(debug);
        return debug;
    }

    fuzzySearch(query) {
        console.log('🔍 fuzzySearch INICIANDO para:', query);
        
        // Verificar se os dados estão disponíveis
        if (!window.equipmentData || !Array.isArray(window.equipmentData)) {
            console.warn('⚠️ equipmentData não disponível ou não é array:', typeof window.equipmentData);
            console.warn('⚠️ window.equipmentData:', window.equipmentData);
            return [];
        }

        console.log('📊 Buscando em', window.equipmentData.length, 'registros por:', query);

        const queryLower = query.toLowerCase().trim();
        const results = [];

        // Search fields with weights
        const searchFields = [
            { field: 'Patrimonio', weight: 10 },
            { field: 'Prefixo', weight: 9 },
            { field: 'Hotspot', weight: 8 },
            { field: 'Empresa', weight: 7 },
            { field: 'PROJETO', weight: 6 },
            { field: 'GARAGEM', weight: 5 },
            { field: 'Status', weight: 4 },
            { field: 'Monitoramento BI', weight: 3 }
        ];

        window.equipmentData.forEach((item, index) => {
            let score = 0;
            let matches = [];

            searchFields.forEach(({ field, weight }) => {
                const value = (item[field] || '').toString().toLowerCase();
                
                // Exact match
                if (value === queryLower) {
                    score += weight * 10;
                    matches.push({ field, type: 'exact', value });
                }
                // Starts with
                else if (value.startsWith(queryLower)) {
                    score += weight * 5;
                    matches.push({ field, type: 'prefix', value });
                }
                // Contains
                else if (value.includes(queryLower)) {
                    score += weight * 2;
                    matches.push({ field, type: 'contains', value });
                }
                // Fuzzy match (simple Levenshtein-like)
                else if (this.fuzzyMatch(value, queryLower)) {
                    score += weight * 1;
                    matches.push({ field, type: 'fuzzy', value });
                }
            });

            if (score > 0) {
                results.push({
                    item,
                    score,
                    matches,
                    index
                });
            }
        });

        // Sort by score and return top results
        const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, 50);
        console.log('🎯 Encontrados', sortedResults.length, 'resultados relevantes');
        
        return sortedResults;
    }

    fuzzyMatch(text, pattern) {
        if (pattern.length > text.length) return false;
        
        let patternIndex = 0;
        for (let textIndex = 0; textIndex < text.length && patternIndex < pattern.length; textIndex++) {
            if (text[textIndex] === pattern[patternIndex]) {
                patternIndex++;
            }
        }
        
        return patternIndex === pattern.length;
    }

    showLiveResults(results, query) {
        const resultsSection = document.getElementById('searchResultsSection');
        const resultsList = document.getElementById('searchResultsList');
        const previewCount = document.getElementById('previewCount');

        if (!resultsSection || !resultsList) return;

        resultsSection.style.display = 'block';
        
        if (previewCount) {
            previewCount.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
        }

        // Clear previous results
        resultsList.innerHTML = '';

        // Show top results
        const topResults = results.slice(0, this.maxSuggestions);
        
        topResults.forEach((result, index) => {
            const item = result.item;
            const matches = result.matches;
            
            const resultElement = document.createElement('div');
            resultElement.className = 'suggestion-item search-result-item';
            resultElement.setAttribute('data-index', index);
            
            // Get primary match
            const primaryMatch = matches[0];
            const icon = this.getIconForField(primaryMatch.field);
            
            resultElement.innerHTML = `
                <div class="result-icon">
                    <i class="bi ${icon}"></i>
                </div>
                <div class="result-content">
                    <div class="result-primary">
                        <span class="result-title">${this.highlightMatch(item[primaryMatch.field] || '', query)}</span>
                        <span class="result-type">${this.getFieldLabel(primaryMatch.field)}</span>
                    </div>
                    <div class="result-secondary">
                        <span class="result-empresa">${item.Empresa || 'N/A'}</span>
                        <span class="result-status ${this.getStatusClass(item['Monitoramento BI'])}">${item['Monitoramento BI'] || 'N/A'}</span>
                    </div>
                </div>
                <div class="result-score">
                    <span class="score-value">${Math.round(result.score)}</span>
                </div>
            `;

            resultElement.addEventListener('click', () => {
                this.selectSearchResult(result);
            });

            resultsList.appendChild(resultElement);
        });

        this.showSuggestions();
    }

    selectSearchResult(result) {
        const item = result.item;
        
        // Add to search history
        this.addToSearchHistory({
            query: document.getElementById('innovativeSearchInput').value,
            result: item,
            timestamp: Date.now()
        });

        // Apply filter to highlight this specific item
        this.highlightTableItem(item);
        
        // Close suggestions
        this.hideSuggestions();
        
        // Show success feedback
        this.showSuccessFeedback(`Encontrado: ${item.Patrimonio || item.Prefixo || 'Item'}`);
    }

    clearSearchFromTable() {
        if (window.equipmentData && Array.isArray(window.equipmentData)) {
            // Restaurar dados originais
            window.filteredData = [...window.equipmentData];
            
            console.log('🧹 Dados restaurados para', window.filteredData.length, 'registros');
            
            // Update UI
            if (typeof window.updateTable === 'function') {
                console.log('📊 Chamando updateTable após limpeza...');
                window.updateTable();
            }
            if (typeof window.updateCards === 'function') {
                console.log('🃏 Chamando updateCards após limpeza...');
                window.updateCards();
            }
            
            console.log('🧹 Busca limpa, dados restaurados');
        } else {
            console.warn('⚠️ equipmentData não disponível para restaurar');
        }
    }

    applySearchToTable(results) {
        if (!results || results.length === 0) {
            // Se não há resultados, restaurar dados originais
            this.clearSearchFromTable();
            return;
        }

        // Create filtered data from search results
        const filteredData = results.map(r => r.item);
        
        // Definir na global scope
        window.filteredData = filteredData;
        
        console.log('🎯 Aplicando', filteredData.length, 'resultados à tabela');
        console.log('🔍 Primeiro resultado:', filteredData[0]?.Patrimonio || 'N/A');
        
        // Update table and cards using existing functions
        if (typeof window.updateTable === 'function') {
            console.log('📊 Chamando updateTable...');
            window.updateTable();
        } else {
            console.warn('⚠️ updateTable não encontrada');
        }
        
        if (typeof window.updateCards === 'function') {
            console.log('🃏 Chamando updateCards...');
            window.updateCards();
        } else {
            console.warn('⚠️ updateCards não encontrada');
        }
        
        // Reset pagination
        if (typeof window.resetPagination === 'function') {
            window.resetPagination();
        }
        
        // Update current page to 1
        if (typeof window.setCurrentPage === 'function') {
            window.setCurrentPage(1);
        } else if (window.currentPage !== undefined) {
            window.currentPage = 1;
        }
    }

    setupQuickActions() {
        const quickActions = document.querySelectorAll('.quick-action-btn');
        
        quickActions.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.executeQuickAction(action);
            });
        });
    }

    executeQuickAction(action) {
        const searchInput = document.getElementById('innovativeSearchInput');
        
        switch (action) {
            case 'show-all':
                searchInput.value = '';
                this.clearSearch();
                break;
            case 'online-only':
                this.filterByStatus('ONLINE');
                break;
            case 'alerts-only':
                this.filterByStatus('ALERTA');
                break;
            case 'recent-changes':
                this.showRecentChanges();
                break;
        }
        
        this.hideSuggestions();
    }

    filterByStatus(status) {
        if (!window.equipmentData) return;
        
        const filtered = window.equipmentData.filter(item => {
            const monitoring = (item['Monitoramento BI'] || '').toUpperCase();
            return monitoring.includes(status);
        });
        
        window.filteredData = filtered;
        
        if (typeof window.updateTable === 'function') {
            window.updateTable();
        }
        if (typeof window.updateCards === 'function') {
            window.updateCards();
        }
        
        this.showSuccessFeedback(`Filtrado por: ${status}`);
    }

    // Utility methods
    getIconForField(field) {
        const icons = {
            'Patrimonio': 'bi-tag',
            'Prefixo': 'bi-hash',
            'Hotspot': 'bi-wifi',
            'Empresa': 'bi-building',
            'PROJETO': 'bi-folder',
            'GARAGEM': 'bi-geo-alt',
            'Status': 'bi-activity',
            'Monitoramento BI': 'bi-graph-up'
        };
        return icons[field] || 'bi-search';
    }

    getFieldLabel(field) {
        const labels = {
            'Patrimonio': 'Patrimônio',
            'Prefixo': 'Prefixo',
            'Hotspot': 'Serial/Hotspot',
            'Empresa': 'Empresa',
            'PROJETO': 'Projeto',
            'GARAGEM': 'Garagem',
            'Status': 'Status',
            'Monitoramento BI': 'Monitoramento'
        };
        return labels[field] || field;
    }

    getStatusClass(status) {
        if (!status) return 'status-unknown';
        
        const statusUpper = status.toUpperCase();
        if (statusUpper.includes('ONLINE') || statusUpper.includes('NORMAL')) return 'status-online';
        if (statusUpper.includes('ALERTA')) return 'status-alert';
        if (statusUpper.includes('ATENÇÃO') || statusUpper.includes('ATENCAO')) return 'status-warning';
        if (statusUpper.includes('INATIVO')) return 'status-inactive';
        return 'status-unknown';
    }

    highlightMatch(text, query) {
        if (!text || !query) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    showSuggestions() {
        const suggestions = document.getElementById('searchSuggestions');
        if (suggestions) {
            suggestions.style.display = 'block';
            suggestions.classList.add('show');
        }
    }

    hideSuggestions() {
        const suggestions = document.getElementById('searchSuggestions');
        if (suggestions) {
            suggestions.style.display = 'none';
            suggestions.classList.remove('show');
        }
    }

    hideSearchResults() {
        const resultsSection = document.getElementById('searchResultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('innovativeSearchInput');
        const clearBtn = document.getElementById('searchClearBtn');
        
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        
        this.hideSearchResults();
        this.hideSuggestions();
        
        // Reset table to show all data
        this.clearSearchFromTable();
        
        console.log('🧹 Busca completamente limpa');
    }

    showSuccessFeedback(message) {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'search-success-feedback';
        feedback.innerHTML = `
            <i class="bi bi-check-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 3000);
    }

    // Analytics and history methods
    trackSearch(query) {
        const count = this.popularSearches.get(query) || 0;
        this.popularSearches.set(query, count + 1);
        this.saveSearchAnalytics();
    }

    addToSearchHistory(searchData) {
        this.searchHistory.unshift(searchData);
        this.searchHistory = this.searchHistory.slice(0, 20); // Keep last 20 searches
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    }

    updateRecentSearches() {
        const recentList = document.getElementById('recentSearchesList');
        if (!recentList) return;

        recentList.innerHTML = '';
        
        this.searchHistory.slice(0, 5).forEach(search => {
            const item = document.createElement('div');
            item.className = 'suggestion-item recent-search-item';
            item.innerHTML = `
                <i class="bi bi-clock-history"></i>
                <span>${search.query}</span>
                <small>${this.formatTimeAgo(search.timestamp)}</small>
            `;
            
            item.addEventListener('click', () => {
                const searchInput = document.getElementById('innovativeSearchInput');
                if (searchInput) {
                    searchInput.value = search.query;
                    this.performLiveSearch(search.query);
                }
            });
            
            recentList.appendChild(item);
        });
    }

    updatePopularSearches() {
        const popularList = document.getElementById('popularSearchesList');
        if (!popularList) return;

        popularList.innerHTML = '';
        
        // Sort by popularity
        const sorted = Array.from(this.popularSearches.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        sorted.forEach(([query, count]) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item popular-search-item';
            item.innerHTML = `
                <i class="bi bi-fire"></i>
                <span>${query}</span>
                <small>${count}x</small>
            `;
            
            item.addEventListener('click', () => {
                const searchInput = document.getElementById('innovativeSearchInput');
                if (searchInput) {
                    searchInput.value = query;
                    this.performLiveSearch(query);
                }
            });
            
            popularList.appendChild(item);
        });
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return `${days}d`;
    }

    loadSearchAnalytics() {
        const saved = localStorage.getItem('searchAnalytics');
        if (saved) {
            this.popularSearches = new Map(JSON.parse(saved));
        }
    }

    saveSearchAnalytics() {
        localStorage.setItem('searchAnalytics', JSON.stringify(Array.from(this.popularSearches.entries())));
    }
}

// Initialize the innovative search system
window.innovativeSearch = null;

// Função para verificar se os dados estão carregados
function waitForDataAndInitialize() {
    console.log('⏳ Verificando disponibilidade de dados...');
    
    if (window.equipmentData && Array.isArray(window.equipmentData) && window.equipmentData.length > 0) {
        console.log('📊 Dados encontrados:', window.equipmentData.length, 'registros');
        console.log('🎯 Dados de amostra:', window.equipmentData[0]);
        
        if (!window.innovativeSearch) {
            console.log('🚀 Inicializando sistema de busca inovativo...');
            window.innovativeSearch = new InnovativeSearchSystem();
        }
    } else {
        console.log('⏳ Dados ainda não carregados, tentando novamente...');
        console.log('📊 equipmentData atual:', typeof window.equipmentData, window.equipmentData?.length);
        setTimeout(waitForDataAndInitialize, 500);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, aguardando inicialização...');
    
    // Wait for the modern chips to be ready and data to be loaded
    setTimeout(() => {
        console.log('⏰ Timeout executado, iniciando verificação de dados...');
        waitForDataAndInitialize();
    }, 2000); // Aumentar tempo para garantir que tudo seja carregado
});

// Fallback: inicializar quando dados forem carregados
document.addEventListener('dataLoaded', function() {
    console.log('📡 Evento dataLoaded recebido');
    if (!window.innovativeSearch) {
        console.log('📡 Evento dataLoaded recebido, inicializando busca');
        window.innovativeSearch = new InnovativeSearchSystem();
    }
});

/* ===================================================================
   THEME INTEGRATION
   ================================================================== */

// Add theme adaptation method to InnovativeSearchSystem
if (typeof InnovativeSearchSystem !== 'undefined') {
    InnovativeSearchSystem.prototype.adaptToTheme = function(theme) {
        console.log(`🎨 Adaptando sistema de busca para tema: ${theme}`);
        
        // Update search input colors
        const searchInput = document.querySelector('.search-input-container input');
        if (searchInput) {
            if (theme === 'light') {
                searchInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                searchInput.style.color = '#212529';
                searchInput.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            } else {
                searchInput.style.backgroundColor = '';
                searchInput.style.color = '';
                searchInput.style.borderColor = '';
            }
        }
        
        // Update suggestions container
        const suggestionsContainer = document.querySelector('.suggestions-container');
        if (suggestionsContainer) {
            if (theme === 'light') {
                suggestionsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                suggestionsContainer.style.color = '#212529';
                suggestionsContainer.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            } else {
                suggestionsContainer.style.backgroundColor = '';
                suggestionsContainer.style.color = '';
                suggestionsContainer.style.borderColor = '';
            }
        }
    };
}