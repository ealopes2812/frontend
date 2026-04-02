/* ===================================================================
   MODERN CHIPS FILTER SYSTEM - JavaScript Controller
   ================================================================== */

class ModernFiltersController {
    constructor() {
        this.activeFilters = new Map();
        this.searchType = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeFilters();
        this.updateActiveFiltersDisplay();
    }

    setupEventListeners() {
        // Listeners para os selects dos chips
        document.getElementById('empresaFilter')?.addEventListener('change', (e) => {
            this.handleFilterChange('empresa', e.target.value, e.target);
        });

        document.getElementById('projetoFilter')?.addEventListener('change', (e) => {
            this.handleFilterChange('projeto', e.target.value, e.target);
        });

        document.getElementById('garagemFilter')?.addEventListener('change', (e) => {
            this.handleFilterChange('garagem', e.target.value, e.target);
        });

        // Listener para o input de busca
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });

        // Animações de hover nos chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('mouseenter', () => this.animateChipHover(chip, true));
            chip.addEventListener('mouseleave', () => this.animateChipHover(chip, false));
        });
    }

    handleFilterChange(filterType, value, element) {
        const chip = element.closest('.filter-chip');
        
        if (value && value !== '') {
            this.activeFilters.set(filterType, value);
            this.setChipActive(chip, true);
            this.addRippleEffect(chip);
        } else {
            this.activeFilters.delete(filterType);
            this.setChipActive(chip, false);
        }

        this.updateActiveFiltersDisplay();
        this.applyFilters();
    }

    handleSearchInput(value) {
        if (this.searchType && value.trim()) {
            this.activeFilters.set('search', {
                type: this.searchType,
                value: value.trim()
            });
        } else {
            this.activeFilters.delete('search');
        }

        this.updateActiveFiltersDisplay();
        this.applyFilters();
    }

    setSearchFilter(type) {
        this.searchType = type;
        const searchText = document.querySelector('.search-text');
        const searchInput = document.getElementById('searchInput');
        const inputContainer = document.getElementById('searchInputContainer');
        const searchChip = document.querySelector('.search-chip');

        // Mapear tipos para labels amigáveis
        const typeLabels = {
            'patrimonio': 'Patrimônio',
            'prefixo': 'Prefixo',
            'hotspot': 'Serial',
            'empresa': 'Empresa',
            'projeto': 'Projeto',
            'garagem': 'Garagem'
        };

        const typeIcons = {
            'patrimonio': 'bi-tag',
            'prefixo': 'bi-hash',
            'hotspot': 'bi-wifi',
            'empresa': 'bi-building',
            'projeto': 'bi-folder',
            'garagem': 'bi-geo-alt'
        };

        if (searchText) {
            searchText.textContent = typeLabels[type] || type;
        }

        if (searchInput) {
            searchInput.placeholder = `Digite o ${typeLabels[type] || type}...`;
            searchInput.focus();
        }

        // Atualizar ícone do chip de busca
        const searchIcon = searchChip?.querySelector('.chip-icon i');
        if (searchIcon && typeIcons[type]) {
            searchIcon.className = `bi ${typeIcons[type]}`;
        }

        // Mostrar input e ativar chip
        if (inputContainer) {
            inputContainer.style.display = 'block';
            this.animateElementIn(inputContainer);
        }

        this.setChipActive(searchChip, true);
        this.addRippleEffect(searchChip);

        // Fechar dropdown
        const dropdown = bootstrap.Dropdown.getInstance(document.getElementById('searchFilterDropdown'));
        if (dropdown) {
            dropdown.hide();
        }
    }

    clearSearch() {
        console.log('🧹 INICIANDO clearSearch() da classe ModernChips');
        
        const searchInput = document.getElementById('searchInput');
        const inputContainer = document.getElementById('searchInputContainer');
        const searchChip = document.querySelector('.search-chip');
        const searchText = document.querySelector('.search-text');

        try {
            // 1. Limpar o campo de busca
            if (searchInput) {
                searchInput.value = '';
                searchInput.disabled = false; // Garantir que não está desabilitado
                console.log('✅ Campo de input limpo e habilitado');
            } else {
                console.warn('⚠️ searchInput não encontrado');
            }
            
            // 2. Manter o campo visível (busca universal)
            if (inputContainer) {
                inputContainer.style.display = 'flex'; // Não esconder mais
                console.log('✅ Container de busca mantido visível');
            }
            
            // 3. Limpar variável global de busca - MÚLTIPLAS FORMAS
            console.log('🔄 Valor atual de currentSearchValue:', `"${window.currentSearchValue}"`);
            window.currentSearchValue = '';
            currentSearchValue = '';  // Garantir que ambas existam
            if (typeof window.currentSearchValue === 'undefined') {
                window.currentSearchValue = '';
            }
            console.log('✅ currentSearchValue definido como:', `"${window.currentSearchValue}"`);
            
            // 4. Resetar ícone
            const searchIcon = searchChip?.querySelector('.chip-icon i');
            if (searchIcon) {
                searchIcon.className = 'bi bi-search';
                console.log('✅ Ícone resetado');
            }

            // 5. Limpar estado interno
            this.searchType = null;
            this.activeFilters.delete('search');
            this.setChipActive(searchChip, false);
            this.updateActiveFiltersDisplay();
            console.log('✅ Estado interno limpo');
            
            // 6. Aplicar filtros para atualizar tabela
            console.log('🔄 Chamando applyFilters após limpeza...');
            this.applyFilters();
            
            // 7. Verificação com delay para garantir que funcionou
            setTimeout(() => {
                console.log('🔍 VERIFICAÇÃO PÓS-LIMPEZA:');
                console.log('   - currentSearchValue:', `"${window.currentSearchValue}"`);
                console.log('   - Campo input:', `"${searchInput?.value || 'N/A'}"`);
                
                if (window.filteredData && window.equipmentData) {
                    const currentCount = window.filteredData.length;
                    const totalCount = window.equipmentData.length;
                    console.log(`   - Dados na tabela: ${currentCount}/${totalCount}`);
                    
                    if (currentCount !== totalCount && (!window.currentSearchValue || window.currentSearchValue === '')) {
                        console.warn('⚠️ DADOS NÃO RESTAURADOS - Executando correção...');
                        
                        // Forçar restauração dos dados
                        window.filteredData = [...window.equipmentData];
                        
                        if (typeof window.updateTable === 'function') {
                            window.updateTable();
                            console.log('🔧 updateTable() forçado');
                        }
                        if (typeof window.updateCards === 'function') {
                            window.updateCards();
                            console.log('🔧 updateCards() forçado');
                        }
                        
                        console.log('🔧 Dados forçadamente restaurados');
                    } else {
                        console.log('✅ Dados restaurados CORRETAMENTE');
                    }
                }
            }, 150);
            
            console.log('✅ Busca limpa com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao limpar busca:', error);
            
            // Fallback: usar função de emergência
            if (typeof window.clearSearchEmergency === 'function') {
                console.log('🚨 Chamando clearSearchEmergency()...');
                window.clearSearchEmergency();
            } else {
                // Último recurso: recarregar página
                console.warn('⚠️ Recarregando página como último recurso...');
                location.reload();
            }
        }
    }

    clearAllFilters() {
        // Limpar todos os selects
        document.getElementById('empresaFilter').value = '';
        document.getElementById('projetoFilter').value = '';
        document.getElementById('garagemFilter').value = '';

        // Limpar busca
        this.clearSearch();

        // Limpar mapa de filtros ativos
        this.activeFilters.clear();

        // Remover estado ativo dos chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            this.setChipActive(chip, false);
        });

        this.updateActiveFiltersDisplay();
        this.applyFilters();

        // Animação de feedback
        this.showClearFeedback();
    }

    setChipActive(chip, active) {
        if (!chip) return;

        if (active) {
            chip.classList.add('active', 'has-selection');
        } else {
            chip.classList.remove('active', 'has-selection');
        }
    }

    updateActiveFiltersDisplay() {
        const activeFiltersEl = document.getElementById('activeFilters');
        const countEl = activeFiltersEl?.querySelector('.active-filter-count');
        const textEl = activeFiltersEl?.querySelector('.active-filter-text');

        const activeCount = this.activeFilters.size;

        if (activeCount > 0) {
            if (countEl) countEl.textContent = activeCount;
            if (textEl) textEl.textContent = activeCount === 1 ? 'filtro ativo' : 'filtros ativos';
            if (activeFiltersEl) {
                activeFiltersEl.style.display = 'block';
                this.animateElementIn(activeFiltersEl);
            }
        } else {
            if (activeFiltersEl) {
                activeFiltersEl.style.display = 'none';
            }
        }
    }

    applyFilters() {
        // Esta função será integrada com o sistema existente de filtros
        console.log('Aplicando filtros:', Object.fromEntries(this.activeFilters));
        
        // Integração com o sistema existente
        if (typeof window.applyFilters === 'function') {
            window.applyFilters();
        }

        // Integração com o sistema de busca inovador
        if (window.innovativeSearch && this.activeFilters.has('search')) {
            const searchData = this.activeFilters.get('search');
            window.innovativeSearch.performLiveSearch(searchData.value);
        }

        // Animação de loading nos chips ativos
        this.showFilterLoadingState();
    }

    showFilterLoadingState() {
        document.querySelectorAll('.filter-chip.active').forEach(chip => {
            chip.classList.add('loading');
            setTimeout(() => {
                chip.classList.remove('loading');
            }, 800);
        });
    }

    animateChipHover(chip, isHover) {
        if (isHover) {
            chip.style.transform = 'translateY(-2px) scale(1.02)';
        } else {
            chip.style.transform = 'translateY(0) scale(1)';
        }
    }

    addRippleEffect(chip) {
        if (!chip) return;

        // Remove efeito anterior se existir
        chip.classList.remove('ripple');

        // Força reflow
        // eslint-disable-next-line no-unused-expressions
        chip.offsetHeight;

        // Adiciona efeito
        chip.classList.add('ripple');

        setTimeout(() => {
            chip.classList.remove('ripple');
        }, 600);
    }

    animateElementIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        
        requestAnimationFrame(() => {
            element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }

    showClearFeedback() {
        const container = document.querySelector('.modern-filters-container');
        if (!container) return;

        // Criar elemento de feedback
        const feedback = document.createElement('div');
        feedback.className = 'clear-feedback';
        feedback.innerHTML = '<i class="bi bi-check-circle"></i> Filtros limpos';
        feedback.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
            z-index: 1000;
            opacity: 0;
            animation: feedbackPop 2s ease-out;
        `;

        container.style.position = 'relative';
        container.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }

    initializeFilters() {
        // Inicializar estado baseado nos valores atuais
        const empresaFilter = document.getElementById('empresaFilter');
        const projetoFilter = document.getElementById('projetoFilter');
        const garagemFilter = document.getElementById('garagemFilter');

        if (empresaFilter?.value) {
            this.handleFilterChange('empresa', empresaFilter.value, empresaFilter);
        }
        if (projetoFilter?.value) {
            this.handleFilterChange('projeto', projetoFilter.value, projetoFilter);
        }
        if (garagemFilter?.value) {
            this.handleFilterChange('garagem', garagemFilter.value, garagemFilter);
        }
    }
}

/* ===================================================================
   ANIMAÇÕES CSS DINÂMICAS
   ================================================================== */

// Adicionar estilos de animação dinamicamente
const style = document.createElement('style');
style.textContent = `
    @keyframes feedbackPop {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
        20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
        }
        80% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
        }
    }

    .filter-chip.ripple::before {
        opacity: 1;
        transform: scale(1);
        transition: all 0.6s ease;
    }
`;
document.head.appendChild(style);

/* ===================================================================
   INICIALIZAÇÃO E INTEGRAÇÃO
   ================================================================== */

// Instância global do controlador
let modernFiltersController;

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    modernFiltersController = new ModernFiltersController();
});

// Funções globais para compatibilidade com o sistema existente
window.setSearchFilter = function(type) {
    if (modernFiltersController) {
        modernFiltersController.setSearchFilter(type);
    }
};

window.clearSearch = function() {
    console.log('🧹 Função clearSearch() chamada pelo botão X');
    
    try {
        // Forçar limpeza da variável global ANTES de qualquer coisa
        window.currentSearchValue = '';
        console.log('🔧 currentSearchValue forçado para vazio:', window.currentSearchValue);
        
        // Método 1: Usar controller se disponível
        if (modernFiltersController) {
            modernFiltersController.clearSearch();
        }
        
        // Método 2: Limpeza direta como backup
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.disabled = false;
        }
        
        // Método 3: Garantir que variável global está vazia
        window.currentSearchValue = '';
        
        // Método 4: Chamar função global de filtros 
        if (typeof window.applyFilters === 'function') {
            console.log('🔄 Chamando window.applyFilters...');
            window.applyFilters();
        }
        
        // Método 5: Verificação com timeout
        setTimeout(() => {
            // Verificar se ainda há problemas após 500ms
            const input = document.getElementById('searchInput');
            if (input && (input.disabled || input.value !== '' || window.currentSearchValue !== '')) {
                console.warn('⚠️ Busca ainda não limpa, usando emergência...');
                console.log('Estado atual:', {
                    inputValue: input.value,
                    inputDisabled: input.disabled,
                    currentSearchValue: window.currentSearchValue
                });
                
                if (typeof window.clearSearchEmergency === 'function') {
                    window.clearSearchEmergency();
                }
            } else {
                console.log('✅ Verificação: busca realmente limpa!');
            }
        }, 500);
        
        console.log('✅ clearSearch executado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro em clearSearch:', error);
        
        // Último recurso
        if (typeof window.clearSearchEmergency === 'function') {
            window.clearSearchEmergency();
        } else {
            console.warn('⚠️ Recarregando página...');
            location.reload();
        }
    }
};

window.clearAllFilters = function() {
    if (modernFiltersController) {
        modernFiltersController.clearAllFilters();
    }
};

window.handleSearchKeyPress = function(event) {
    if (event.key === 'Enter') {
        const searchInput = event.target;
        if (modernFiltersController) {
            modernFiltersController.handleSearchInput(searchInput.value);
        }
    }
};

// Função para sincronizar com filtros externos (se necessário)
window.updateExternalFilters = function(filters) {
    if (modernFiltersController) {
        // Atualizar o estado interno baseado em filtros externos
        filters.forEach((value, key) => {
            modernFiltersController.activeFilters.set(key, value);
        });
        modernFiltersController.updateActiveFiltersDisplay();
    }
};