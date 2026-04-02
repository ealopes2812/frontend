// Variáveis globais
let equipmentData = [];
let filteredData = [];
let currentData = [];
let selectedStatusFilter = null;
let selectedProject = null;
let currentSearchFilter = null;
let currentSearchValue = '';

// Variáveis de paginação
let currentPage = 1;
const itemsPerPage = 50;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Página carregada, iniciando sistema...');
    
    // 🔄 Verificar se foi solicitado reload forçado (mudança de usuário)
    const urlParams = new URLSearchParams(window.location.search);
    const forceReload = urlParams.get('_reload') || sessionStorage.getItem('forceReloadRequired');
    
    if (forceReload) {
        console.log('🔄 Reload forçado detectado - limpando cache completo do frontend');
        
        // 🔐 Preservar credenciais antes de limpar
        const savedUsername = localStorage.getItem('savedUsername');
        const savedPassword = localStorage.getItem('savedPassword');
        const rememberMe = localStorage.getItem('rememberMe');
        
        // 🧹 Limpeza completa de cache do frontend
        sessionStorage.clear();
        localStorage.clear();
        
        // 🔐 Restaurar credenciais se "lembrar-me" estava ativo
        if (rememberMe === 'true' && savedUsername && savedPassword) {
            localStorage.setItem('savedUsername', savedUsername);
            localStorage.setItem('savedPassword', savedPassword);
            localStorage.setItem('rememberMe', 'true');
            console.log('🔐 Credenciais preservadas após limpeza de cache');
        }
        
        // Limpar todas as variáveis globais possíveis
        ['equipmentData', 'filteredData', 'currentData', '__GRID_ROWS__', 'CACHE_GARAGENS', 
         'CACHE_TECNICOS', 'allData', 'originalData', 'dashboardData', 'preloadedData']
        .forEach(varName => {
            if (window[varName]) {
                window[varName] = null;
                delete window[varName];
            }
        });
        
        // Resetar variáveis locais
        equipmentData = [];
        filteredData = [];
        currentData = [];
        
        sessionStorage.removeItem('forceReloadRequired');
        
        // Limpar parâmetro da URL sem recarregar
        if (urlParams.get('_reload')) {
            urlParams.delete('_reload');
            const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
            window.history.replaceState({}, '', newUrl);
        }
        
        console.log('✅ Cache do frontend limpo completamente - dados serão recarregados do servidor');
    }
    
    initializeDates();
    
    try {
        loadInitialData();
    } catch (error) {
        console.error('💥 Erro na inicialização:', error);
    }
    
    setupEventListeners();
});

// Configurar datas iniciais (últimos 30 dias)
function initializeDates() {
    console.log('📅 Inicializando datas...');
    
    const startDateElement = document.getElementById('startDate');
    const endDateElement = document.getElementById('endDate');
    
    if (!startDateElement || !endDateElement) {
        console.error('❌ Elementos de data não encontrados');
        return;
    }
    
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const startDateValue = thirtyDaysAgo.toISOString().split('T')[0];
    const endDateValue = today.toISOString().split('T')[0];
    
    startDateElement.value = startDateValue;
    endDateElement.value = endDateValue;
    
    console.log('✅ Datas configuradas:', startDateValue, 'a', endDateValue);
}

// Carregar dados iniciais
async function loadInitialData() {
    console.log('📊 Iniciando carregamento de dados...');
    
    // Verificar se há dados iniciais no template
    const initialDataElement = document.getElementById('initial-data');
    console.log('🔍 Buscando elemento initial-data:', !!initialDataElement);
    
    if (initialDataElement) {
        try {
            console.log('📝 Conteúdo encontrado');
            const initialData = JSON.parse(initialDataElement.textContent);
            console.log('📊 Dados parseados:', {
                tipo: typeof initialData,
                isArray: Array.isArray(initialData),
                tamanho: initialData ? initialData.length : 'N/A'
            });
            
            if (initialData && initialData.length > 0) {
                console.log('✅ Dados iniciais encontrados:', initialData.length, 'registros');
                
                // Verificar metadados para decidir se carregar dados completos
                let metadata = {};
                try {
                    const metadataElement = document.getElementById('dashboard-metadata');
                    if (metadataElement) {
                        metadata = JSON.parse(metadataElement.textContent);
                        console.log('� Metadados do dashboard:', metadata);
                    }
                } catch (e) {
                    console.warn('⚠️ Erro ao carregar metadados:', e);
                }
                
                // Verificar se há mais dados para carregar
                const totalEquipments = metadata.total_equipments || initialData.length;
                const initialCount = metadata.initial_count || initialData.length;
                
                if (totalEquipments > initialCount) {
                    console.log(`🔄 Carregando dados completos: ${initialCount} de ${totalEquipments} equipamentos...`);
                    
                    // Carregar dados iniciais primeiro
                    equipmentData = initialData;
                    currentData = initialData;
                    filteredData = initialData;
                    
                    // 🔧 FIX: Inicializar window.__GRID_ROWS__ mesmo durante carregamento
                    try { 
                        window.__GRID_ROWS__ = Array.isArray(initialData) ? initialData : []; 
                        console.log('✅ window.__GRID_ROWS__ inicializado (temporário) com', window.__GRID_ROWS__.length, 'registros');
                    } catch (_) {
                        console.warn('⚠️ Erro ao inicializar window.__GRID_ROWS__');
                    }
                    
                    // Processar dados iniciais
                    populateFilters();
                    applyFilters();
                    showRefreshBadge('Carregando dados completos...');
                    
                    // Carregar dados completos em background
                    await loadFullDataAjax();
                } else {
                    // Conjunto completo pequeno
                    equipmentData = initialData;
                    currentData = initialData;
                    filteredData = initialData;
                    
                    // 🔧 FIX: Inicializar window.__GRID_ROWS__ para o formulário de verificação elétrica
                    try { 
                        window.__GRID_ROWS__ = Array.isArray(initialData) ? initialData : []; 
                        console.log('✅ window.__GRID_ROWS__ inicializado com', window.__GRID_ROWS__.length, 'registros');
                    } catch (_) {
                        console.warn('⚠️ Erro ao inicializar window.__GRID_ROWS__');
                    }
                    
                    // Trigger evento para busca inovadora
                    document.dispatchEvent(new CustomEvent('dataLoaded', { 
                        detail: { count: equipmentData.length } 
                    }));
                    console.log('🎯 equipmentData configurado:', equipmentData.length, 'registros');
                    
                    // Processar dados e atualizar interface
                    populateFilters();
                    applyFilters();
                    showRefreshBadge('Dados carregados do servidor');
                    console.log('✅ Dados iniciais processados com sucesso');
                }
                return;
            } else {
                console.warn('⚠️ Array de dados inicial está vazio');
            }
        } catch (e) {
            console.error('❌ Erro ao carregar dados iniciais do template:', e);
        }
    } else {
        console.warn('⚠️ Elemento initial-data não encontrado no DOM');
    }
    
    // Fallback para API
    console.log('🔄 Tentando fallback via API...');
    try {
        await loadData();
        // Carregar técnicos para RAT
        await loadTechniciansForRAT();
    } catch (error) {
        console.error('Erro ao carregar dados principais:', error);
    }
}

// Nova função para carregar dados completos via AJAX
async function loadFullDataAjax() {
    try {
        console.log('🔄 Carregando dados completos via AJAX...');
        
        const response = await fetch('/api/dashboard/full-data', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            credentials: 'include'  // Incluir cookies de autenticação
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.data && Array.isArray(result.data)) {
            console.log(`✅ Dados completos carregados: ${result.total} registros`);
            
            // Substituir dados
            equipmentData = result.data;
            currentData = result.data;
            filteredData = result.data;
            
            // Trigger evento para busca inovadora
            document.dispatchEvent(new CustomEvent('dataLoaded', { 
                detail: { count: equipmentData.length } 
            }));
            
            // Reprocessar filtros e interface
            populateFilters();
            applyFilters();
            showRefreshBadge(`${result.total} registros carregados`);
            
            console.log('🎯 Dados completos integrados com sucesso');
            // Guarde o grid completo para o gerador de e-mail (verdade única)
            try { window.__GRID_ROWS__ = Array.isArray(result.data) ? result.data : []; } catch (_) {}
        } else {
            console.error('❌ Erro na resposta AJAX:', result.message || 'Estrutura de dados inválida');
            showRefreshBadge('Erro ao carregar dados completos', 'error');
        }
        
    } catch (error) {
        console.error('💥 Erro no carregamento AJAX:', error);
        showRefreshBadge('Erro na conexão', 'error');
    }
}

// Event listeners
function setupEventListeners() {
    // Filtros com dependência em cascata
    const empresaFilter = document.getElementById('empresaFilter');
    const projetoFilter = document.getElementById('projetoFilter');
    const garagemFilter = document.getElementById('garagemFilter');
    
    if (empresaFilter) {
        empresaFilter.addEventListener('change', function() {
            // Se selecionar "Todos" em empresa, resetar projeto e garagem também
            if (this.value === '' || this.value === 'Todos') {
                const projetoFilter = document.getElementById('projetoFilter');
                const garagemFilter = document.getElementById('garagemFilter');
                if (projetoFilter) projetoFilter.value = '';
                if (garagemFilter) garagemFilter.value = '';
                console.log('🔄 Empresa resetada para "Todos" - resetando projeto e garagem');
            }
            onEmpresaChange();
            applyFilters();
        });
    }
    
    if (projetoFilter) {
        projetoFilter.addEventListener('change', function() {
            // Se selecionar "Todos" em projeto, resetar garagem também
            if (this.value === '' || this.value === 'Todos') {
                const garagemFilter = document.getElementById('garagemFilter');
                if (garagemFilter) garagemFilter.value = '';
                console.log('🔄 Projeto resetado para "Todos" - resetando garagem');
            }
            onProjetoChange();
            applyFilters();
        });
    }
    
    if (garagemFilter) {
        garagemFilter.addEventListener('change', applyFilters);
    }
    
    // Ordenação por colunas - usando onclick direto no HTML agora
    // setupTableSorting();
    
    // Configurar sistema de busca avançada
    setupAdvancedSearch();
    
    // Datas
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate) startDate.addEventListener('change', loadData);
    if (endDate) endDate.addEventListener('change', loadData);
    
    // Cards clicáveis para filtros de status (suporta classes antigas e novas)
    const statusCards = document.querySelectorAll('.clickable-card, .status-card, .status-card-glass');
    statusCards.forEach(card => {
        if (card) {
            card.addEventListener('click', function() {
                const status = card.getAttribute('data-status');
                if (status) toggleStatusFilter(status);
            });
        }
    });
    
    // Atalho Ctrl+R
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            atualizarDados();
        }
    });
    
    // Event listeners dos modais
    setupModalEventListeners();
}

function setupModalEventListeners() {
    // Botão "Continuar" do modal de status
    const statusContinueBtn = document.querySelector('#statusModal .btn-primary');
    if (statusContinueBtn) {
        statusContinueBtn.addEventListener('click', processarStatusSelection);
    }
    
    // Botão "Gerar RAT" do modal de técnicos
    const techContinueBtn = document.querySelector('#technicianModal .btn-primary');
    if (techContinueBtn) {
        techContinueBtn.addEventListener('click', processarTechnicianSelection);
    }
    
    // Botão de salvar técnico
    document.getElementById('saveTechnicianBtn')?.addEventListener('click', saveTechnician);
    
    // Botão de salvar endereço/garagem
    document.getElementById('saveAddressBtn')?.addEventListener('click', saveAddress);
}

function onEmpresaChange() {
    populateProjetoFilter();
    onProjetoChange();
}

function onProjetoChange() {
    const projetoFilter = document.getElementById('projetoFilter');
    selectedProject = projetoFilter ? projetoFilter.value : null;
    console.log('📋 Projeto selecionado:', selectedProject);
    populateGaragemFilter();
}

function populateProjetoFilter() {
    const empresaFilter = document.getElementById('empresaFilter');
    const projetoFilter = document.getElementById('projetoFilter');
    
    if (!empresaFilter || !projetoFilter) return;
    
    const selectedEmpresa = empresaFilter.value;
    
    let filteredData = equipmentData;
    if (selectedEmpresa) {
        filteredData = filteredData.filter(item => item.Empresa === selectedEmpresa);
    }
    
    const projetos = [...new Set(filteredData.map(item => item.PROJETO).filter(p => p))].sort();
    
    const currentSelection = projetoFilter.value;
    
    projetoFilter.innerHTML = '<option value="">Todos</option>';
    projetos.forEach(projeto => {
        const option = document.createElement('option');
        option.value = projeto;
        option.textContent = projeto;
        projetoFilter.appendChild(option);
    });
    
    // Auto-select apenas se há uma empresa selecionada e só um projeto disponível
    if (selectedEmpresa && projetos.length === 1) {
        projetoFilter.value = projetos[0];
        // Disparar evento para atualizar próximo filtro
        projetoFilter.dispatchEvent(new Event('change'));
    } else if (projetos.includes(currentSelection)) {
        // Manter seleção anterior apenas se ainda existe na lista
        projetoFilter.value = currentSelection;
    }
}

function populateGaragemFilter() {
    const empresaFilter = document.getElementById('empresaFilter');
    const projetoFilter = document.getElementById('projetoFilter');
    const garagemFilter = document.getElementById('garagemFilter');
    
    if (!empresaFilter || !projetoFilter || !garagemFilter) return;
    
    const selectedEmpresa = empresaFilter.value;
    const selectedProjeto = projetoFilter.value;
    
    let filteredData = equipmentData;
    if (selectedEmpresa) {
        filteredData = filteredData.filter(item => item.Empresa === selectedEmpresa);
    }
    if (selectedProjeto) {
        filteredData = filteredData.filter(item => item.PROJETO === selectedProjeto);
    }
    
    const garagens = [...new Set(filteredData.map(item => item.GARAGEM).filter(g => g))].sort();
    
    const currentSelection = garagemFilter.value;
    
    garagemFilter.innerHTML = '<option value="">Todas</option>';
    garagens.forEach(garagem => {
        const option = document.createElement('option');
        option.value = garagem;
        option.textContent = garagem;
        garagemFilter.appendChild(option);
    });
    
    // Auto-select apenas se há uma empresa OU projeto selecionado e só uma garagem disponível
    if ((selectedEmpresa || selectedProjeto) && garagens.length === 1) {
        garagemFilter.value = garagens[0];
        // Disparar evento para atualizar próximo filtro se necessário
        garagemFilter.dispatchEvent(new Event('change'));
    } else if (garagens.includes(currentSelection)) {
        // Manter seleção anterior apenas se ainda existe na lista
        garagemFilter.value = currentSelection;
    }
}

// Carregamento de dados via API (fallback)
async function loadData() {
    console.log('🔄 Função loadData iniciada...');
    try {
        console.log('⏳ Iniciando carregamento...');
        
        const startDateElement = document.getElementById('startDate');
        const endDateElement = document.getElementById('endDate');
        
        if (!startDateElement || !endDateElement) {
            console.error('❌ Elementos de data não encontrados');
            return;
        }
        
        const startDate = startDateElement.value;
        const endDate = endDateElement.value;
        
        console.log('📅 Carregando dados:', startDate, 'a', endDate);
        
        if (!startDate || !endDate) {
            console.error('❌ Datas não configuradas');
            return;
        }
        
        const url = `/api/equipment?start_date=${startDate}&end_date=${endDate}`;
        console.log('🌐 URL da requisição:', url);
        
        try {
            showLoading(true);
        } catch (e) {
            console.warn('Aviso showLoading:', e.message);
        }
        
        const response = await fetch(url);
        console.log('📡 Resposta recebida, status:', response.status);
        
        const data = await response.json();
        console.log('📊 Dados parseados:', data);
        
        if (data.success) {
            equipmentData = data.data;
            console.log('✅ Dados carregados com sucesso:', equipmentData.length, 'registros');
            if (equipmentData.length > 0) {
                console.log('📋 Exemplo de registro:', equipmentData[0]);
            }
            
            // Trigger evento para busca inovadora
            document.dispatchEvent(new CustomEvent('dataLoaded', { 
                detail: { count: equipmentData.length } 
            }));
            
            populateFilters();
            applyFilters();
            showRefreshBadge('Dados atualizados');
        } else {
            console.error('❌ Erro nos dados:', data.message);
            showAlert('Erro ao carregar dados: ' + data.message, 'danger');
        }
    } catch (error) {
        console.error('💥 Erro ao carregar dados:', error);
        showAlert('Erro ao conectar com o servidor', 'danger');
    } finally {
        try {
            showLoading(false);
        } catch (e) {
            console.warn('Aviso showLoading final:', e.message);
        }
        console.log('🏁 loadData finalizada');
    }
}

function populateFilters() {
    console.log('🔧 Inicializando filtros...');
    console.log('📊 equipmentData disponível:', {
        tipo: typeof equipmentData,
        isArray: Array.isArray(equipmentData),
        tamanho: equipmentData ? equipmentData.length : 'N/A'
    });
    
    if (!equipmentData || !Array.isArray(equipmentData) || equipmentData.length === 0) {
        console.warn('⚠️ equipmentData está vazio ou inválido');
        return;
    }
    
    // Debug: examinar primeiro registro
    if (equipmentData.length > 0) {
        console.log('🔍 Primeiro registro:', equipmentData[0]);
        console.log('🔍 Status do primeiro registro:', equipmentData[0].Status);
        console.log('🔍 Monitoramento BI do primeiro registro:', equipmentData[0]['Monitoramento BI']);
    }
    
    const empresas = [...new Set(equipmentData.map(item => item.Empresa).filter(e => e))].sort();
    console.log('🏢 Empresas encontradas:', empresas);
    
    const empresaFilter = document.getElementById('empresaFilter');
    if (!empresaFilter) {
        console.error('❌ Elemento empresaFilter não encontrado');
        return;
    }
    
    empresaFilter.innerHTML = '<option value="">Todas</option>';
    empresas.forEach(empresa => {
        const option = document.createElement('option');
        option.value = empresa;
        option.textContent = empresa;
        empresaFilter.appendChild(option);
    });
    
    populateProjetoFilter();
    populateGaragemFilter();
    
    console.log(`✅ Filtros inicializados: ${empresas.length} empresas`);
}

// Aplicar filtros
function applyFilters() {
    const empresaFilter = document.getElementById('empresaFilter');
    const projetoFilter = document.getElementById('projetoFilter');
    const garagemFilter = document.getElementById('garagemFilter');
    
    if (!empresaFilter || !projetoFilter || !garagemFilter) {
        console.warn('⚠️ Elementos de filtro não encontrados');
        return;
    }
    
    const selectedEmpresa = empresaFilter.value;
    const selectedProjeto = projetoFilter.value;
    const selectedGaragem = garagemFilter.value;
    
    filteredData = equipmentData;
    
    if (selectedEmpresa) {
        filteredData = filteredData.filter(item => item.Empresa === selectedEmpresa);
    }
    if (selectedProjeto) {
        filteredData = filteredData.filter(item => item.PROJETO === selectedProjeto);
    }
    if (selectedGaragem) {
        filteredData = filteredData.filter(item => item.GARAGEM === selectedGaragem);
    }
    if (selectedStatusFilter) {
        // Função auxiliar para normalizar valores (Normal → Online)
        const normalizeValue = (val) => {
            if (!val) return '';
            const upper = String(val).toUpperCase().trim();
            return upper === 'NORMAL' ? 'ONLINE' : upper;
        };
        
        // Filtrar baseado na coluna "Monitoramento BI" (exceto para manutenção e divergência)
        filteredData = filteredData.filter(item => {
            // Para manutenção, usar a coluna Status
            if (selectedStatusFilter.includes('MANUT')) {
                return (item.Status && (item.Status.toUpperCase().includes('GARAGEM_M') || item.Status.endsWith('_M'))) || 
                       (item['Monitoramento BI'] === 'MANUTENCAO');
            }
            
            // Para divergência, filtrar onde Monitoramento BI != Keep Alive
            // MAS excluir máquinas em manutenção (Status GARAGEM_M ou BI = MANUTENCAO)
            if (selectedStatusFilter.includes('DIVERGENCIA')) {
                // Primeiro, excluir manutenção
                const isManut = (item.Status && (item.Status.toUpperCase().includes('GARAGEM_M') || item.Status.endsWith('_M')));
                if (isManut) return false;
                
                const monitoring = item['Monitoramento BI'];
                const keepAlive = item['Keep Alive'];
                const monitoringNormalized = normalizeValue(monitoring);
                const keepAliveNormalized = normalizeValue(keepAlive);
                
                // Excluir se BI é MANUTENCAO
                if (monitoringNormalized === 'MANUTENCAO' || monitoringNormalized === 'MANUTENÇÃO') return false;
                
                return monitoringNormalized !== keepAliveNormalized && monitoring && keepAlive;
            }
            
            // Para outros status, usar a coluna "Monitoramento BI"
            // Mas apenas se NÃO houver divergência
            const monitoring = item['Monitoramento BI'];
            const keepAlive = item['Keep Alive'];
            const monitoringNormalized = normalizeValue(monitoring);
            const keepAliveNormalized = normalizeValue(keepAlive);
            
            // Se há divergência, não mostra nos cards de status normais
            const isDivergent = monitoringNormalized !== keepAliveNormalized && monitoring && keepAlive;
            if (isDivergent) return false;
            
            if (!monitoring) return false;
            
            return selectedStatusFilter.split(',').some(status => {
                const statusUpper = status.toUpperCase().trim();
                
                // Mapear os valores dos cards para os valores da coluna Monitoramento BI
                if (statusUpper === 'ONLINE' || statusUpper === 'NORMAL') {
                    return monitoringNormalized === 'ONLINE';
                } else if (statusUpper === 'ATENÇÃO' || statusUpper === 'ATENCAO') {
                    return monitoringNormalized === 'ATENÇÃO' || monitoringNormalized === 'ATENCAO';
                } else if (statusUpper === 'ALERTA') {
                    return monitoringNormalized === 'ALERTA';
                } else if (statusUpper === 'INATIVO') {
                    return monitoringNormalized === 'INATIVO';
                } else {
                    // Fallback: comparação direta
                    return monitoringNormalized.includes(statusUpper);
                }
            });
        });
    }
    
    // Aplicar filtro de busca avançada
    filteredData = applyAdvancedSearch(filteredData);
    
    // Atualizar currentData para uso nos modais
    currentData = filteredData;
    
    // Resetar paginação quando filtros mudarem
    resetPagination();
    
    updateCards();
    updateTable();

    // Se nenhum status selecionado, limpar destaque visual de cards
    if (!selectedStatusFilter) {
        try {
            document.querySelectorAll('.clickable-card, .status-card, .status-card-glass')
                .forEach(c => c.classList.remove('active'));
        } catch(e) { /* no-op */ }
    }
}

function toggleStatusFilter(status) {
    console.log('🔍 Card clicado, filtro solicitado:', status);
    selectedStatusFilter = selectedStatusFilter === status ? null : status;
    console.log('🎯 Filtro ativo:', selectedStatusFilter);
    // Visual: destacar card ativo
    try {
        const cards = document.querySelectorAll('.clickable-card, .status-card, .status-card-glass');
        cards.forEach(c => c.classList.remove('active'));
        if (selectedStatusFilter) {
            const target = Array.from(cards).find(c => c.getAttribute('data-status') === selectedStatusFilter);
            if (target) target.classList.add('active');
        }
    } catch(e) { /* no-op */ }
    applyFilters();
}

function updateCards() {
    const total = filteredData.length;
    
    // Atualizar total de máquinas
    const totalElement = document.getElementById('totalMaquinas');
    if (totalElement) totalElement.textContent = total;
    
    console.log('🔍 Analisando dados para cards:', filteredData.length, 'registros');
    
    // Debug: mostrar valores únicos das colunas relevantes
    const monitoringValues = [...new Set(filteredData.map(item => item['Monitoramento BI']).filter(m => m))];
    const keepAliveValues = [...new Set(filteredData.map(item => item['Keep Alive']).filter(k => k))];
    const statusValues = [...new Set(filteredData.map(item => item.Status).filter(s => s))];
    
    console.log('📊 Valores únicos de Monitoramento BI:', monitoringValues);
    console.log('📊 Valores únicos de Keep Alive:', keepAliveValues);
    console.log('📊 Valores únicos de Status:', statusValues);
    
    // Contadores
    let online = 0;
    let atencao = 0;
    let alerta = 0;
    let inativo = 0;
    let manutencao = 0;
    let divergencia = 0;
    let outros = 0;
    
    // Função auxiliar para normalizar valores (Normal → Online)
    const normalizeValue = (val) => {
        if (!val) return '';
        const upper = String(val).toUpperCase().trim();
        return upper === 'NORMAL' ? 'ONLINE' : upper;
    };
    
    filteredData.forEach(item => {
        // Primeiro, verificar se é manutenção (baseado no Status)
        if (item.Status && item.Status.toUpperCase().includes('GARAGEM_M')) {
            manutencao++;
            return;
        }
        
        const monitoring = item['Monitoramento BI'];
        const keepAlive = item['Keep Alive'];
        
        // Normalizar ambos os valores para comparação
        const monitoringNormalized = normalizeValue(monitoring);
        const keepAliveNormalized = normalizeValue(keepAlive);
        
        // NOVA LÓGICA: Se Monitoramento BI é ONLINE, vai para card Online (independente do Keep Alive)
        if (monitoringNormalized === 'ONLINE') {
            online++;
            return;
        }
        
        // Se Monitoramento BI é MANUTENÇÃO, vai para card Manutenção (não considera divergência)
        if (monitoringNormalized === 'MANUTENCAO' || monitoringNormalized === 'MANUTENÇÃO') {
            manutencao++;
            return;
        }
        
        // Verificar divergência: apenas se Monitoramento BI NÃO é Online/Manutenção e BI != Keep Alive
        const isDivergent = monitoringNormalized !== keepAliveNormalized && monitoring && keepAlive;
        
        if (isDivergent) {
            divergencia++;
            console.log('⚠️ Divergência encontrada:', item.Prefixo, '| Monitoramento BI:', monitoring, '| Keep Alive:', keepAlive);
            return;
        }
        
        // Se não há divergência, classificar baseado no Monitoramento BI
        if (!monitoring) {
            outros++;
            return;
        }
        
        // Classificar baseado no Monitoramento BI (Online já foi tratado acima)
        if (monitoringNormalized === 'ATENÇÃO' || monitoringNormalized === 'ATENCAO' || monitoringNormalized === 'WARNING') {
            atencao++;
        } else if (monitoringNormalized === 'ALERTA' || monitoringNormalized === 'ALERT' || monitoringNormalized === 'CRÍTICO' || monitoringNormalized === 'CRITICO') {
            alerta++;
        } else if (monitoringNormalized === 'INATIVO' || monitoringNormalized === 'OFFLINE' || monitoringNormalized === 'DESLIGADO') {
            inativo++;
        } else {
            outros++;
            console.log('🤔 Monitoramento BI não categorizado:', monitoring);
        }
    });
    
    console.log('📈 Contagens calculadas (com divergências):', {
        total, online, atencao, alerta, inativo, manutencao, divergencia, outros
    });
    
    // Verificar se a soma está correta
    const somaCalculada = online + atencao + alerta + inativo + manutencao + divergencia + outros;
    if (somaCalculada !== total) {
        console.warn(`⚠️ Divergência na contagem: Total=${total}, Soma=${somaCalculada}`);
    }
    
    // Atualizar cards
    const elements = {
        'countOnline': online,
        'countAtencao': atencao,
        'countAlerta': alerta,
        'countInativo': inativo,
        'countManutencao': manutencao,
        'countDivergencia': divergencia
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            console.log(`🎯 Atualizando ${id}: ${value}`);
        } else {
            console.warn(`⚠️ Elemento ${id} não encontrado`);
        }
    });
}

function updateTable() {
    const tbody = document.querySelector('#equipmentTable tbody');
    const tableCount = document.getElementById('tableCount');
    const noDataMessage = document.getElementById('noDataMessage');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        if (tableCount) tableCount.textContent = '0';
        if (noDataMessage) noDataMessage.classList.remove('d-none');
        updatePagination(0, 0);
        return;
    }
    
    if (noDataMessage) noDataMessage.classList.add('d-none');
    if (tableCount) tableCount.textContent = filteredData.length;
    
    // Calcular dados da página atual
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);
    
    // Renderizar apenas os dados da página atual
    pageData.forEach(item => {
        const row = tbody.insertRow();
        // Normalizar Keep Alive: "Normal" → "Online"
        let keepAliveValue = item['Keep Alive'] || '';
        if (keepAliveValue && keepAliveValue.toUpperCase() === 'NORMAL') {
            keepAliveValue = 'Online';
        }
        row.innerHTML = `
            <td>${item.PROJETO || ''}</td>
            <td>${item.PATROCINADOR || ''}</td>
            <td>${item.Hotspot || ''}</td>
            <td>${item.Patrimonio || ''}</td>
            <td>${item.Prefixo || ''}</td>
            <td>${item.Linha || ''}</td>
            <td>${item.GARAGEM || ''}</td>
            <td>${item.OPERADORA_1 || ''}</td>
            <td>${getMonitoringBadge(item['Monitoramento BI'])}</td>
            <td>${getKeepAliveBadge(keepAliveValue)}</td>
            <td>${formatDate(item['Ultimo Registro Válido'])}</td>
            <td class="text-center">
                <span id="chamado-info-${item.Patrimonio}" style="display: inline-flex; align-items: center; gap: 4px;">
                    <a href="javascript:void(0)" class="badge bg-secondary" style="cursor: pointer; text-decoration: none; display: none;" id="chamado-link-${item.Patrimonio}">
                        <span id="chamado-number-${item.Patrimonio}">-</span>
                    </a>
                    <button class="btn btn-sm btn-outline-info" 
                            onclick="abrirHistoricoChamadosPatrimonio('${(item.Patrimonio || '').replace(/'/g, "\\'")}')"
                            title="Ver histórico de chamados"
                            style="padding: 1px 5px; font-size: 0.7rem; border-radius: 4px; opacity: 0.7;"
                            id="btn-hist-${item.Patrimonio}">
                        <i class="bi bi-clock-history"></i>
                    </button>
                </span>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-success btn-create-chamado" 
                        id="btn-chamado-${item.Patrimonio}"
                        onclick="abrirModalCriarChamadoRapido('${item.Prefixo || ''}', '${item.Patrimonio || ''}', '${item.PROJETO || ''}', '${item.GARAGEM || ''}', '${item.Hotspot || ''}')"
                        title="Criar chamado para este prefixo"
                        style="font-weight: bold; padding: 2px 8px;">
                    +
                </button>
            </td>
        `;
    });
    
    // Atualizar informações de paginação
    updatePagination(filteredData.length, totalPages);
    
    // Verificar chamados abertos para cada prefixo
    verificarChamadosAbertos();
    
    // Reconfigurar ordenação após atualizar tabela
    console.log('🔄 Reconfigurando ordenação da tabela...');
    // Não precisamos mais reconfigurar ordenação aqui pois estamos usando onclick direto no HTML
    // setupTableSorting();
}

// Funções de paginação
function updatePagination(totalItems, totalPages) {
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationNav = document.getElementById('paginationNav');
    
    if (!paginationInfo || !paginationNav) return;
    
    // Atualizar informações da página
    if (totalItems === 0) {
        paginationInfo.textContent = 'Nenhum resultado encontrado';
        paginationNav.innerHTML = '';
        return;
    }
    
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    const infoText = `Mostrando ${startItem}-${endItem} de ${totalItems} equipamentos`;
    paginationInfo.textContent = infoText;
    
    // Construir navegação
    let paginationHTML = '';
    
    // Botão anterior
    if (currentPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="goToPage(${currentPage - 1})">Anterior</a>
            </li>
        `;
    } else {
        paginationHTML += `
            <li class="page-item disabled">
                <span class="page-link">Anterior</span>
            </li>
        `;
    }
    
    // Números das páginas
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Ajustar se não há páginas suficientes no final
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Primeira página
    if (startPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="goToPage(1)">1</a>
            </li>
        `;
        if (startPage > 2) {
            paginationHTML += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }
    
    // Páginas visíveis
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `
                <li class="page-item active">
                    <span class="page-link">${i}</span>
                </li>
            `;
        } else {
            paginationHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="goToPage(${i})">${i}</a>
                </li>
            `;
        }
    }
    
    // Última página
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="goToPage(${totalPages})">${totalPages}</a>
            </li>
        `;
    }
    
    // Botão próximo
    if (currentPage < totalPages) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="goToPage(${currentPage + 1})">Próximo</a>
            </li>
        `;
    } else {
        paginationHTML += `
            <li class="page-item disabled">
                <span class="page-link">Próximo</span>
            </li>
        `;
    }
    
    paginationNav.innerHTML = paginationHTML;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    updateTable();
    
    // Scroll para o topo da tabela
    const tableContainer = document.querySelector('#equipmentTable');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function resetPagination() {
    currentPage = 1;
}

function getStatusBadge(status) {
    if (!status) return '<span class="badge bg-secondary">N/A</span>';
    
    if (status.includes('OPERAÇÃO') || status.includes('NORMAL')) {
        return `<span class="badge bg-success">${status}</span>`; // Verde
    } else if (status.includes('ATENÇÃO')) {
        return `<span class="badge bg-warning">${status}</span>`; // Amarelo
    } else if (status.includes('ALERTA')) {
        return `<span class="badge bg-info">${status}</span>`; // Laranja (definido em CSS)
    } else if (status.includes('INATIVO')) {
        return `<span class="badge bg-danger">${status}</span>`; // Vermelho
    } else if (status.includes('MANUT') || status.includes('GARAGEM_M')) {
        return `<span class="badge bg-secondary">${status}</span>`; // Cinza
    } else {
        return `<span class="badge bg-light text-dark">${status}</span>`;
    }
}

function getMonitoringBadge(monitoring) {
    if (!monitoring && monitoring !== 0 && monitoring !== false) {
        return '<span class="badge bg-secondary">N/A</span>';
    }
    
    // Converter para string para comparação
    const monitoringStr = String(monitoring).toUpperCase().trim();
    
    // Aplicar cores baseadas no valor do monitoramento (similar ao status)
    if (monitoringStr === 'NORMAL' || monitoringStr === 'ONLINE') {
        return `<span class="badge bg-success">Online</span>`; // Verde - exibir "Online"
    } else if (monitoringStr === 'FORA DE OPERAÇÃO' || monitoringStr === 'FORA DE OPERACAO') {
        return `<span class="badge bg-secondary">Prefixo em Manutenção</span>`; // Cinza - exibir "Prefixo em Manutenção"
    } else if (monitoringStr === 'ATENÇÃO' || monitoringStr === 'ATENCAO' || monitoringStr === 'WARNING') {
        return `<span class="badge bg-warning">${monitoring}</span>`; // Amarelo
    } else if (monitoringStr === 'ALERTA' || monitoringStr === 'ALERT' || monitoringStr === 'CRÍTICO' || monitoringStr === 'CRITICO') {
        return `<span class="badge bg-info">${monitoring}</span>`; // Laranja (definido em CSS)
    } else if (monitoringStr === 'INATIVO' || monitoringStr === 'OFFLINE' || monitoringStr === 'DESLIGADO') {
        return `<span class="badge bg-danger">${monitoring}</span>`; // Vermelho
    } else if (monitoringStr === 'MANUTENÇÃO' || monitoringStr === 'MANUTENCAO' || monitoringStr === 'MAINTENANCE') {
        return `<span class="badge bg-secondary">${monitoring}</span>`; // Cinza
    } else if (monitoringStr === 'SIM' || monitoringStr === 'TRUE' || monitoringStr === '1' || monitoring === true || monitoring === 1) {
        return '<span class="badge bg-success">SIM</span>';
    } else if (monitoringStr === 'NÃO' || monitoringStr === 'NAO' || monitoringStr === 'FALSE' || monitoringStr === '0' || monitoring === false || monitoring === 0) {
        return '<span class="badge bg-warning">NÃO</span>';
    } else {
        // Para valores desconhecidos, usar cor neutra
        return `<span class="badge bg-light text-dark">${monitoring}</span>`;
    }
}

// Função para renderizar badge de Keep Alive
function getKeepAliveBadge(keepAlive) {
    if (!keepAlive && keepAlive !== 0 && keepAlive !== false) {
        return '<span class="badge bg-secondary">N/A</span>';
    }
    
    // Converter para string para comparação
    const keepAliveStr = String(keepAlive).toUpperCase().trim();
    
    // Aplicar cores baseadas no valor do Keep Alive
    if (keepAliveStr === 'NORMAL' || keepAliveStr === 'ONLINE') {
        return `<span class="badge bg-success">Online</span>`; // Verde
    } else if (keepAliveStr === 'ATENÇÃO' || keepAliveStr === 'ATENCAO' || keepAliveStr === 'WARNING') {
        return `<span class="badge bg-warning">${keepAlive}</span>`; // Amarelo
    } else if (keepAliveStr === 'ALERTA' || keepAliveStr === 'ALERT' || keepAliveStr === 'CRÍTICO' || keepAliveStr === 'CRITICO') {
        return `<span class="badge bg-info">${keepAlive}</span>`; // Laranja
    } else if (keepAliveStr === 'INATIVO' || keepAliveStr === 'OFFLINE' || keepAliveStr === 'DESLIGADO') {
        return `<span class="badge bg-danger">${keepAlive}</span>`; // Vermelho
    } else if (keepAliveStr === 'FORA DE OPERAÇÃO' || keepAliveStr === 'FORA DE OPERACAO') {
        return `<span class="badge bg-secondary">Prefixo em Manutenção</span>`; // Cinza
    } else {
        // Para valores desconhecidos, usar cor neutra
        return `<span class="badge bg-light text-dark">${keepAlive}</span>`;
    }
}

function repr(obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return `"${obj}"`;
    return String(obj);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
    } catch (error) {
        return dateString;
    }
}

// Funções auxiliares
function showLoading(show) {
    console.log('⏳ showLoading chamada:', show);
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        if (show) {
            indicator.classList.remove('d-none');
            console.log('🔄 Loading mostrado');
        } else {
            indicator.classList.add('d-none');
            console.log('✅ Loading escondido');
        }
    } else {
        console.warn('⚠️ Elemento loadingIndicator não encontrado');
    }
}

function showRefreshBadge(text) {
    const badge = document.getElementById('refreshBadge');
    if (badge) {
        badge.textContent = text;
        badge.classList.remove('d-none');
        setTimeout(() => {
            badge.classList.add('d-none');
        }, 3000);
    }
}

function showAlert(message, type = 'info') {
    // Implementação simples de alert
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Usar bootstrap toast se disponível, senão alert
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer) {
        showToast(message, type);
    } else {
        alert(message);
    }
}

// Funções utilitárias para diferentes tipos de mensagens
function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function showWarning(message) {
    showAlert(message, 'warning');
}

function showInfo(message) {
    showAlert(message, 'info');
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : 
                   type === 'danger' ? 'bg-danger' : 
                   type === 'warning' ? 'bg-warning' : 'bg-info';
    
    // Definir tempo de auto-fechamento baseado no tipo
    const autoHideDelay = type === 'success' ? 3000 : 
                         type === 'info' ? 4000 : 
                         type === 'warning' ? 6000 : 8000; // Erros ficam mais tempo
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert" data-bs-autohide="true" data-bs-delay="${autoHideDelay}">
            <div class="toast-header ${bgClass}">
                <strong class="me-auto text-white">
                    ${type === 'success' ? '✅ Sucesso' : 
                      type === 'danger' ? '❌ Erro' : 
                      type === 'warning' ? '⚠️ Aviso' : 'ℹ️ Informação'}
                </strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Fechar"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: autoHideDelay
    });
    toast.show();
    
    // Remover após fechar
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Funções dos modais
function processarStatusSelection() {
    console.log('🔄 Processando seleção de status...');
    
    // Coletar checkboxes selecionados
    const statusCheckboxes = document.querySelectorAll('#statusModal input[type="checkbox"]:checked');
    
    if (statusCheckboxes.length === 0) {
        showAlert('Selecione pelo menos um status', 'warning');
        return;
    }
    
    const selectedStatus = Array.from(statusCheckboxes).map(checkbox => checkbox.value);
    console.log('📋 Status selecionados para RAT:', selectedStatus);
    
    // Verificar se há projeto selecionado (obrigatório)
    // Suporta fluxo novo: ou existe um projeto selecionado no filtro,
    // ou foi escolhida(s) uma lista de projetos via modal (window.selectedProjects),
    // ou ainda a variável global selectedProject (compatibilidade).
    const projetoFilter = document.getElementById('projetoFilter');
    const hasSelectedProjects = Array.isArray(window.selectedProjects) && window.selectedProjects.length > 0;
    if (((!projetoFilter || !projetoFilter.value) && !selectedProject) && !hasSelectedProjects) {
        showAlert('Selecione um projeto antes de gerar o RAT', 'warning');
        return;
    }
    
    // Fechar modal de status
    const statusModal = bootstrap.Modal.getInstance(document.getElementById('statusModal'));
    statusModal.hide();
    
    // Carregar técnicos e abrir modal
    loadTechniciansForRAT();
    const technicianModal = new bootstrap.Modal(document.getElementById('technicianModal'));
    technicianModal.show();
    
    // Armazenar status selecionados para uso posterior
    window.selectedRATStatus = selectedStatus;
}

async function loadTechniciansForRAT() {
    console.log('👨‍🔧 Carregando técnicos para RAT...');

    const select = document.getElementById('technicianSelect');
    if (!select) {
        console.warn('⚠️ technicianSelect não encontrado no DOM');
        return;
    }

    // Mostrar estado de carregamento
    select.disabled = true;
    select.innerHTML = '<option value="">Carregando técnicos...</option>';

    // Reusar cache se existir
    if (Array.isArray(window.CACHE_TECNICOS) && window.CACHE_TECNICOS.length > 0) {
        console.log('♻️ Usando técnicos do cache:', window.CACHE_TECNICOS.length);
        preencherSelectTecnicos(select, window.CACHE_TECNICOS);
        return;
    }

    try {
        const response = await fetch('/api/technicians/public');
        const result = await response.json();

        console.log('📋 Resposta da API tecnicos:', result);

        // Normalizar lista de técnicos da resposta
        const dataField = result?.data;
        let rawList = [];
        if (Array.isArray(dataField)) {
            rawList = dataField;
        } else if (dataField && typeof dataField === 'object') {
            // Suporta formato dict { nome: cpf }
            rawList = Object.entries(dataField).map(([nome, cpf]) => ({ nome, cpf }));
        } else if (Array.isArray(result)) {
            rawList = result;
        } else {
            rawList = [];
        }
        const listaTecnicos = rawList
            .map(item => {
                if (!item) return null;
                if (typeof item === 'string') {
                    return { nome: item, cpf: null };
                }
                if (typeof item === 'object') {
                    // Suporta formatos {nome, cpf, id, email, telefone}
                    const nome = (item.nome || item.Nome || item.name || '').toString().trim();
                    if (!nome) return null;
                    return {
                        nome,
                        cpf: (item.cpf || item.CPF || '').toString().trim() || null,
                        id: item.id || item.ID || null,
                        email: item.email || null,
                        telefone: item.telefone || item.phone || null
                    };
                }
                return null;
            })
            .filter(Boolean);

        if (listaTecnicos.length === 0) {
            console.warn('⚠️ Nenhum técnico retornado pela API');
            select.innerHTML = '<option value="">Nenhum técnico disponível</option>';
            select.disabled = false;
            return;
        }

        // Cachear para próximos usos
        window.CACHE_TECNICOS = listaTecnicos;

        // Preencher select
        preencherSelectTecnicos(select, listaTecnicos);
    } catch (e) {
        console.error('Erro ao carregar técnicos RAT', e);
        showAlert('Erro ao carregar técnicos', 'error');
        // Fallback simples
        const fallback = [
            { nome: 'João Silva', cpf: '111.111.111-11' },
            { nome: 'Maria Santos', cpf: '222.222.222-22' },
            { nome: 'Pedro Oliveira', cpf: '333.333.333-33' }
        ];
        preencherSelectTecnicos(select, fallback);
    }
}

function preencherSelectTecnicos(select, listaTecnicos) {
    // Guardar seleção anterior se existir
    const prev = select.value || (window.selectedTechnician || '');

    // Limpar e adicionar placeholder
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione um técnico...';
    select.appendChild(placeholder);

    // Preencher opções
    listaTecnicos.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.nome; // enviar apenas o nome para o backend
        opt.textContent = t.nome;
        if (t.cpf) opt.dataset.cpf = t.cpf;
        if (t.id) opt.dataset.id = t.id;
        if (t.email) opt.dataset.email = t.email;
        if (t.telefone) opt.dataset.telefone = t.telefone;
        select.appendChild(opt);
    });

    // Restaurar seleção anterior, se possível
    if (prev && Array.from(select.options).some(o => o.value === prev)) {
        select.value = prev;
    }

    // Habilitar
    select.disabled = false;
}

function loadTechnicians() {
    const techniciansList = document.getElementById('techniciansList');
    if (!techniciansList) return;
    
    // Lista padrão de técnicos (pode vir de API no futuro)
    const technicians = [
        'João Silva',
        'Maria Santos',
        'Pedro Oliveira',
        'Ana Costa',
        'Carlos Mendes'
    ];
    
    techniciansList.innerHTML = '';
    technicians.forEach((tech, index) => {
        const techDiv = document.createElement('div');
        techDiv.className = 'form-check';
        techDiv.innerHTML = `
            <input class="form-check-input" type="checkbox" value="${tech}" id="tech${index}">
            <label class="form-check-label" for="tech${index}">
                ${tech}
            </label>
        `;
        techniciansList.appendChild(techDiv);
    });
}

// Função para iniciar o fluxo de geração de RAT
function iniciarGeracaoRAT() {
    debugLog('📋 Iniciando fluxo de geração de RAT...');
    
    // Verificar se há dados filtrados
    if (!filteredData || filteredData.length === 0) {
        debugLog('❌ Nenhum dado encontrado para gerar RAT');
        showAlert('Nenhum dado encontrado para gerar o RAT. Verifique os filtros aplicados.', 'warning');
        return;
    }
    
    // Agora exigimos apenas a empresa. Se a empresa tiver mais de um projeto,
    // abrimos um modal para o usuário escolher o projeto; caso contrário seguimos.
    const empresaFilter = document.getElementById('empresaFilter');
    const selectedEmpresa = empresaFilter ? empresaFilter.value : null;
    if (!selectedEmpresa) {
        debugLog('❌ Nenhuma empresa selecionada para Gerar RAT');
        showAlert('Selecione a empresa antes de gerar o RAT.', 'warning');
        return;
    }

    // Determinar projetos disponíveis para a empresa selecionada
    let filteredForEmpresa = equipmentData;
    if (selectedEmpresa) filteredForEmpresa = filteredForEmpresa.filter(item => item.Empresa === selectedEmpresa);
    const projetos = [...new Set(filteredForEmpresa.map(item => item.PROJETO).filter(p => p))].sort();

    if (projetos.length === 0) {
        debugLog('❌ Nenhum projeto encontrado para a empresa selecionada');
        showAlert('Nenhum projeto encontrado para a empresa selecionada.', 'warning');
        return;
    }

    if (projetos.length === 1) {
        // Auto-selecionar o projeto único e seguir
        selectedProject = projetos[0];
        debugLog('✅ Empresa com único projeto, selecionado automaticamente: ' + selectedProject);
    } else {
        // Mostrar modal de seleção de projeto e interromper fluxo — a continuação
        // (abrir modal de status) será feita por confirmProjectChoice()
        showProjectChooser(projetos);
        return;
    }
    
    debugLog('✅ Iniciando seleção de status...');
    
    // Limpar variáveis anteriores
    window.selectedRATStatus = null;
    window.selectedTechnician = null;
    window.selectedGarages = null;
    window.responsavelTecnicoEmail = null;
    window.equipeEmails = [];
    
    // Abrir modal de seleção de status
    const statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
    statusModal.show();
}

// Mostra modal dinâmico para escolha de projeto quando a empresa possui múltiplos
function showProjectChooser(projetos) {
        // Criar o conteúdo do modal se não existir
        let existing = document.getElementById('projectChooserModal');
        if (!existing) {
                const modalHtml = `
                <div class="modal fade" id="projectChooserModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Selecione o Projeto</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <p>Esta empresa possui múltiplos projetos. Selecione um ou mais projetos que deseja usar para gerar a(s) RAT(s).</p>
                                <select id="projectChooserSelect" class="form-select" multiple size="6"></select>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-primary" id="confirmProjectChoiceBtn">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                document.getElementById('confirmProjectChoiceBtn').addEventListener('click', confirmProjectChoice);
        }

        // Popular opções
        const sel = document.getElementById('projectChooserSelect');
        sel.innerHTML = '';
        projetos.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                sel.appendChild(opt);
        });

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('projectChooserModal'));
        modal.show();
}

// Handler chamado quando o usuário confirma o projeto no modal
function confirmProjectChoice() {
    const sel = document.getElementById('projectChooserSelect');
    if (!sel) return;
    const chosenOptions = Array.from(sel.selectedOptions).map(o => o.value);
    if (!chosenOptions || chosenOptions.length === 0) {
        showAlert('Selecione pelo menos um projeto antes de confirmar.', 'warning');
        return;
    }
    // Suportar múltiplos projetos: manter compatibilidade definindo selectedProject como o primeiro
    window.selectedProjects = chosenOptions;
    selectedProject = chosenOptions[0];
    debugLog('✅ Projetos selecionados via modal: ' + JSON.stringify(chosenOptions));

        // Fechar modal de escolha e abrir o modal de status em sequência
        const chooserModalEl = document.getElementById('projectChooserModal');
        const chooserModal = bootstrap.Modal.getInstance(chooserModalEl) || new bootstrap.Modal(chooserModalEl);
        chooserModal.hide();

        // Abrir modal de seleção de status (continuação do fluxo)
        const statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
        statusModal.show();
}

// Função para debug - exibir logs na tela também
function debugLog(message) {
    console.log(message);
    
    // Criar ou atualizar div de debug
    let debugDiv = document.getElementById('debugLogs');
    if (!debugDiv) {
        debugDiv = document.createElement('div');
        debugDiv.id = 'debugLogs';
        debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            overflow-y: auto;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            display: none;
        `;
        document.body.appendChild(debugDiv);
    }
    
    const timestamp = new Date().toLocaleTimeString();
    debugDiv.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
}

// Ativar debug quando F12 for pressionado
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12') {
        e.preventDefault();
        const debugDiv = document.getElementById('debugLogs');
        if (debugDiv) {
            debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
        }
    }
});

function confirmarTecnico() {
    debugLog('🔄 Função confirmarTecnico iniciada');
    
    const technicianSelect = document.getElementById('technicianSelect');
    debugLog('📋 Elemento select encontrado: ' + (technicianSelect ? 'SIM' : 'NÃO'));
    
    if (!technicianSelect) {
        debugLog('❌ Elemento technicianSelect não encontrado!');
        showAlert('Erro: elemento de seleção de técnico não encontrado', 'error');
        return;
    }
    
    const selectedTechnician = technicianSelect.value;
    debugLog('👨‍🔧 Valor do técnico selecionado: ' + selectedTechnician);
    
    if (!selectedTechnician) {
        debugLog('⚠️ Nenhum técnico selecionado em confirmarTecnico()');
        showAlert('Por favor, selecione um técnico', 'warning');
        return;
    }
    
    debugLog('✅ Técnico válido selecionado: ' + selectedTechnician);
    
    // Armazenar técnico responsável selecionado
    window.selectedTechnician = selectedTechnician;
    // Pegar o email do dataset do option selecionado
    const selectedOption = technicianSelect.options[technicianSelect.selectedIndex];
    const tecnicoEmail = selectedOption.dataset.email || '';
    window.responsavelTecnicoEmail = tecnicoEmail; // Email real do responsável
    debugLog('📧 Email do técnico: ' + tecnicoEmail);
    debugLog('💾 Técnico armazenado em window.selectedTechnician');
    
    // Fechar modal do técnico e abrir modal de equipe
    const technicianModal = bootstrap.Modal.getInstance(document.getElementById('technicianModal'));
    debugLog('🚪 Modal instance obtida: ' + (technicianModal ? 'SIM' : 'NÃO'));
    
    if (technicianModal) {
        const techModalEl = document.getElementById('technicianModal');
        techModalEl.addEventListener('hidden.bs.modal', function handler() {
            techModalEl.removeEventListener('hidden.bs.modal', handler);
            mostrarModalEquipe();
        }, { once: true });
        technicianModal.hide();
        debugLog('🚪 Modal do técnico fechando, abrirá equipe...');
    } else {
        debugLog('⚠️ Modal instance não encontrada, tentando fechar diretamente');
        const modalElement = document.getElementById('technicianModal');
        if (modalElement) {
            modalElement.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
        mostrarModalEquipe();
    }
}

// Mostrar modal de seleção de equipe
async function mostrarModalEquipe() {
    debugLog('👥 Mostrando modal de equipe...');
    
    const container = document.getElementById('equipeCheckboxes');
    if (!container) {
        debugLog('❌ Container de equipe não encontrado');
        // Pular para garagens se não houver modal de equipe
        mostrarModalGaragens();
        return;
    }
    
    container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';
    
    try {
        // Buscar lista de técnicos
        const response = await fetch('/api/technicians/public');
        const result = await response.json();
        
        container.innerHTML = '';
        
        if (result.success && result.data && result.data.length > 0) {
            const responsavelEmail = (window.responsavelTecnicoEmail || '').toLowerCase();
            
            result.data.forEach((tec, index) => {
                const tecEmail = (tec.email || '').toLowerCase();
                
                // Não mostrar o técnico responsável na lista de equipe
                if (tecEmail && tecEmail === responsavelEmail) {
                    return;
                }
                
                const div = document.createElement('div');
                div.className = 'form-check mb-2';
                div.innerHTML = `
                    <input class="form-check-input equipe-check" type="checkbox" 
                           value="${tec.email || ''}" id="equipe${index}" data-nome="${tec.nome || tec.name || ''}">
                    <label class="form-check-label" for="equipe${index}">
                        ${tec.nome || tec.name || 'Técnico'} ${tec.email ? `<small class="text-muted">(${tec.email})</small>` : ''}
                    </label>
                `;
                container.appendChild(div);
            });
            
            if (container.innerHTML === '') {
                container.innerHTML = '<p class="text-muted text-center">Nenhum outro técnico disponível para equipe</p>';
            }
        } else {
            container.innerHTML = '<p class="text-muted text-center">Nenhum técnico disponível</p>';
        }
    } catch (error) {
        debugLog('❌ Erro ao carregar técnicos: ' + error.message);
        container.innerHTML = '<p class="text-danger text-center">Erro ao carregar técnicos</p>';
    }
    
    // Mostrar modal de equipe
    const equipeModal = new bootstrap.Modal(document.getElementById('equipeModal'));
    equipeModal.show();
}

// Selecionar todos da equipe
function selecionarTodosEquipe() {
    document.querySelectorAll('.equipe-check').forEach(cb => cb.checked = true);
}

// Desmarcar todos da equipe
function desmarcarTodosEquipe() {
    document.querySelectorAll('.equipe-check').forEach(cb => cb.checked = false);
}

// Voltar para modal de técnico
function voltarParaTecnico() {
    const equipeModal = bootstrap.Modal.getInstance(document.getElementById('equipeModal'));
    if (equipeModal) {
        const equipeModalEl = document.getElementById('equipeModal');
        equipeModalEl.addEventListener('hidden.bs.modal', function handler() {
            equipeModalEl.removeEventListener('hidden.bs.modal', handler);
            const techModal = new bootstrap.Modal(document.getElementById('technicianModal'));
            techModal.show();
        }, { once: true });
        equipeModal.hide();
    }
}

// Confirmar seleção de equipe e ir para garagens (ou gerar RAT se for personalizada)
function confirmarEquipe() {
    const selectedEquipe = [];
    document.querySelectorAll('.equipe-check:checked').forEach(cb => {
        if (cb.value) {
            selectedEquipe.push(cb.value);
        }
    });
    
    window.equipeEmails = selectedEquipe;
    debugLog('✅ Equipe selecionada: ' + JSON.stringify(selectedEquipe));
    
    // IMPORTANTE: Capturar o checkbox de criar chamados N4 ANTES de fechar o modal
    // Isso garante que o valor seja preservado mesmo quando há apenas uma garagem
    window.criarChamadosN4Dashboard = document.getElementById('criarChamadosN4CheckEquipe')?.checked || false;
    debugLog('📝 Criar chamados N4 (capturado no modal equipe): ' + window.criarChamadosN4Dashboard);
    
    // Verificar se estamos no fluxo de RAT Personalizada (garagem já foi selecionada)
    const isRATPersonalizada = window.ratPersonalizadaPrefixos && window.ratPersonalizadaPrefixos.length > 0;
    debugLog('🔍 Fluxo RAT Personalizada: ' + isRATPersonalizada);
    
    // Fechar modal de equipe
    const equipeModal = bootstrap.Modal.getInstance(document.getElementById('equipeModal'));
    if (equipeModal) {
        const equipeModalEl = document.getElementById('equipeModal');
        equipeModalEl.addEventListener('hidden.bs.modal', function handler() {
            equipeModalEl.removeEventListener('hidden.bs.modal', handler);
            if (isRATPersonalizada) {
                // RAT Personalizada: garagem já selecionada, gerar RAT diretamente
                debugLog('📄 RAT Personalizada: pulando seleção de garagem, gerando RAT...');
                gerarRAT();
            } else {
                // Fluxo normal: ir para seleção de garagens
                mostrarModalGaragens();
            }
        }, { once: true });
        equipeModal.hide();
    } else {
        if (isRATPersonalizada) {
            debugLog('📄 RAT Personalizada: pulando seleção de garagem, gerando RAT...');
            gerarRAT();
        } else {
            mostrarModalGaragens();
        }
    }
}

// Voltar para modal de equipe
function voltarParaEquipe() {
    const garageModal = bootstrap.Modal.getInstance(document.getElementById('garageModal'));
    if (garageModal) {
        const garageModalEl = document.getElementById('garageModal');
        garageModalEl.addEventListener('hidden.bs.modal', function handler() {
            garageModalEl.removeEventListener('hidden.bs.modal', handler);
            const equipeModal = new bootstrap.Modal(document.getElementById('equipeModal'));
            equipeModal.show();
        }, { once: true });
        garageModal.hide();
    }
}

// Selecionar todas as garagens
function selecionarTodasGaragens() {
    document.querySelectorAll('#garageCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = true);
}

// Desmarcar todas as garagens
function desmarcarTodasGaragens() {
    document.querySelectorAll('#garageCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
}

async function mostrarModalGaragens() {
    try {
        debugLog('🏢 Função mostrarModalGaragens iniciada');
        debugLog('📊 Projeto selecionado: ' + selectedProject);
        debugLog('📊 Current data disponível: ' + (currentData ? currentData.length : 'null'));
        
        // Obter garagens do projeto selecionado a partir dos dados já carregados
        const projeto = selectedProject;
        
        if (!projeto) {
            debugLog('❌ Nenhum projeto selecionado!');
            showAlert('Erro: nenhum projeto selecionado', 'error');
            return;
        }
        
        const garagensDisponiveis = [];
        
        // Buscar garagens nos dados filtrados
        if (currentData && currentData.length > 0) {
            debugLog('🔍 Procurando garagens no currentData...');
            const garagensSet = new Set();
            let itemsEncontrados = 0;
            
            currentData.forEach(item => {
                if (item.PROJETO === projeto && item.GARAGEM) {
                    garagensSet.add(item.GARAGEM);
                    itemsEncontrados++;
                }
            });
            
            debugLog('🔍 Items encontrados para o projeto: ' + itemsEncontrados);
            garagensDisponiveis.push(...Array.from(garagensSet).sort());
        } else {
            debugLog('⚠️ currentData não disponível, tentando carregar do banco...');
            
            // Tentar carregar garagens do banco
            try {
                const response = await fetch('/api/garages');
                const result = await response.json();
                debugLog('🏢 Resposta do banco de garagens: ' + JSON.stringify(result));
                
                if (result.success && result.data && result.data.length > 0) {
                    result.data.forEach(garage => {
                        if (garage.projeto === projeto) {
                            garagensDisponiveis.push(garage.endereco);
                        }
                    });
                }
            } catch (error) {
                debugLog('❌ Erro ao carregar garagens do banco: ' + error.message);
            }
        }
        
        debugLog('🏢 Garagens encontradas para o projeto ' + projeto + ': ' + JSON.stringify(garagensDisponiveis));
        
        if (garagensDisponiveis.length === 0) {
            debugLog('⚠️ Nenhuma garagem encontrada');
            showAlert('Nenhuma garagem encontrada para este projeto', 'warning');
            return;
        }
        
        if (garagensDisponiveis.length === 1) {
            // Se só tem uma garagem, vai direto
            debugLog('🎯 Apenas uma garagem encontrada, indo direto para geração...');
            window.selectedGarages = garagensDisponiveis;
            gerarRAT();
        } else {
            // Se tem múltiplas garagens, mostrar modal de seleção
            debugLog('🎯 Múltiplas garagens encontradas, mostrando modal...');
            mostrarSeletorGaragens(garagensDisponiveis);
        }
        
    } catch (error) {
        debugLog('❌ Erro em mostrarModalGaragens: ' + error.message);
        showAlert('Erro ao carregar garagens: ' + error.message, 'error');
    }
}

function mostrarSeletorGaragens(garagens) {
    // Criar modal dinamicamente se não existir
    let modalHtml = `
        <div class="modal fade" id="garagemModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content border-0 shadow" style="border-radius: 15px;">
                    <div class="modal-header border-bottom-0">
                        <h5 class="modal-title fw-bold text-primary">Selecionar Garagens</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">Selecione as garagens para incluir no RAT:</p>
                        <div id="garagensList" class="text-dark" style="max-height: 300px; overflow-y: auto;">
                            ${garagens.map((garagem, index) => `
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" value="${garagem}" id="garage${index}">
                                    <label class="form-check-label text-dark fw-medium" for="garage${index}">
                                        ${garagem}
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-3">
                            <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" onclick="selecionarTodasGaragens()">
                                <i class="fas fa-check-double me-1"></i> Selecionar Todas
                            </button>
                        </div>
                    </div>
                    <div class="modal-footer border-top-0">
                        <button type="button" class="btn btn-outline-secondary rounded-pill" data-bs-dismiss="modal">
                            <i class="fas fa-times me-1"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-primary rounded-pill" onclick="confirmarGaragens()">
                            <i class="fas fa-check me-1"></i> Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal existente se houver
    const existingModal = document.getElementById('garagemModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Adicionar novo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const garagemModal = new bootstrap.Modal(document.getElementById('garagemModal'));
    garagemModal.show();
}

function selecionarTodasGaragens() {
    const checkboxes = document.querySelectorAll('#garagensList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function confirmarGaragens() {
    const selectedCheckboxes = document.querySelectorAll('#garagensList input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
        showAlert('Selecione pelo menos uma garagem', 'warning');
        return;
    }
    
    const selectedGarages = Array.from(selectedCheckboxes).map(cb => cb.value);
    console.log('🏢 Garagens selecionadas:', selectedGarages);
    
    // Armazenar garagens selecionadas
    window.selectedGarages = selectedGarages;
    
    // O valor de criarChamadosN4Dashboard já foi capturado no modal de equipe
    // Não sobrescrever aqui
    console.log('📝 Criar chamados N4 (já capturado): ' + window.criarChamadosN4Dashboard);
    
    // Fechar modal
    const garagemModal = bootstrap.Modal.getInstance(document.getElementById('garagemModal'));
    garagemModal.hide();
    
    // Gerar RAT
    gerarRAT();
}

async function gerarRAT() {
    debugLog('📄 [FUNÇÃO CORRETA] Iniciando geração do RAT...');
    
    try {
        debugLog('⏳ Processando RAT...');
        showAlert('Processando RAT...', 'info');
        
        // Validar dados necessários
        const hasSelectedProjects = Array.isArray(window.selectedProjects) && window.selectedProjects.length > 0;
        if (!selectedProject && !hasSelectedProjects) {
            debugLog('❌ Projeto não selecionado');
            showAlert('Projeto não selecionado', 'error');
            return;
        }

        if (!window.selectedTechnician) {
            debugLog('❌ Técnico não selecionado');
            showAlert('Técnico não selecionado', 'error');
            return;
        }

        if (!window.selectedGarages || window.selectedGarages.length === 0) {
            debugLog('❌ Garagens não selecionadas');
            showAlert('Garagens não selecionadas', 'error');
            return;
        }

        // Construir lista de projetos a gerar (suporta múltiplos)
        const projectsToGenerate = hasSelectedProjects ? window.selectedProjects : [selectedProject];

        debugLog('📤 Projetos a gerar: ' + JSON.stringify(projectsToGenerate));
        
        // Verificar se deve criar chamados N4 (usar valor armazenado em window, pois o modal já foi fechado)
        const criarChamadosN4 = window.criarChamadosN4Dashboard || false;
        debugLog('📝 Criar chamados N4: ' + criarChamadosN4);

        // Agrupar por garagem: enviar um request por garagem incluindo TODOS os projetos selecionados
        for (let g = 0; g < window.selectedGarages.length; g++) {
            const garagem = window.selectedGarages[g];

            // ajustar variável global para compatibilidade com o restante do fluxo (usar o primeiro projeto como fallback)
            selectedProject = projectsToGenerate[0] || selectedProject;

            const requestData = {
                projeto: projectsToGenerate.length > 1 ? projectsToGenerate : projectsToGenerate[0],
                statuses: window.selectedRATStatus || [],
                technician: window.selectedTechnician,
                garages: [garagem],
                // NOVO: Sistema de equipe (igual ao watchlist)
                responsavel_tecnico_email: window.responsavelTecnicoEmail || window.selectedTechnician || '',
                equipe_emails: window.equipeEmails || [],
                // NOVO: Criar chamados N4 automaticamente
                criar_chamados_n4: criarChamadosN4,
                filters: {
                    startDate: document.getElementById('startDate')?.value || null,
                    endDate: document.getElementById('endDate')?.value || null
                }
            };

            debugLog('📤 Dados da requisição RAT: ' + JSON.stringify(requestData));
            debugLog('👥 Equipe incluída: ' + JSON.stringify(window.equipeEmails || []));

            const response = await fetch('/api/generate-rat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
        
            debugLog('📡 Resposta recebida, status: ' + response.status);
            
            if (response.ok) {
                // Se a resposta é um arquivo PDF ou ZIP, fazer download direto
                const contentType = response.headers.get('content-type');
                debugLog('📄 Content-Type: ' + contentType);
                
                if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/zip'))) {
                    const isPdf = contentType.includes('application/pdf');
                    const isZip = contentType.includes('application/zip');
                    
                    debugLog(`📄 Fazendo download do ${isPdf ? 'PDF' : 'ZIP'}...`);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    
                    // Tentar extrair o nome do arquivo do header Content-Disposition
                    const contentDisp = response.headers.get('content-disposition') || response.headers.get('Content-Disposition') || '';
                    let filename = '';
                    const m = /filename\*?=([^;]+)/i.exec(contentDisp);
                    if (m && m[1]) {
                        filename = m[1].trim().replace(/UTF-8''/, '').replace(/"/g, '');
                    }

                    if (!filename) {
                        // Fallback: construir nome com projetos e garagem
                        const projPart = Array.isArray(requestData.projeto) ? requestData.projeto.join('_') : requestData.projeto;
                        if (isPdf) {
                            filename = `RAT_${projPart}_${garagem}_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.pdf`;
                        } else {
                            filename = `RAT_${projPart}_${garagem}_multiplas_garagens_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.zip`;
                        }
                    }
                    a.download = filename;
                    
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    // Verificar se chamados N4 foram criados
                    const chamadosN4Criados = response.headers.get('X-Chamados-N4-Criados');
                    const chamadosN4Status = response.headers.get('X-Chamados-N4-Status');
                    
                    // Mensagem de sucesso personalizada
                    const fileType = isPdf ? 'PDF' : 'ZIP com múltiplas RATs';
                    let successMessage = `RAT gerado e baixado com sucesso! (${fileType})`;
                    if (criarChamadosN4 && chamadosN4Criados) {
                        if (chamadosN4Status === 'success') {
                            successMessage = `RAT gerado com sucesso! ${chamadosN4Criados} chamados N4 criados. (${fileType})`;
                        } else {
                            successMessage = `RAT gerado! Alguns chamados N4 podem não ter sido criados. (${fileType})`;
                        }
                        debugLog(`📋 Chamados N4 criados: ${chamadosN4Criados} (${chamadosN4Status})`);
                    }
                    showAlert(successMessage, 'success');
                    debugLog(`✅ ${fileType} baixado com sucesso`);

                    // Se for PDF único, tentar redirecionar para a versão online criada
                    if (isPdf) {
                        try {
                            const ratId = response.headers.get('X-RAT-ID');
                            const ratUrl = response.headers.get('X-RAT-URL');
                            if (ratId || ratUrl) {
                                const url = ratUrl || `/rat?id=${encodeURIComponent(ratId)}`;
                                debugLog('🔗 Redirecionando para versão online da RAT: ' + url);
                                // Pequeno delay para garantir que o download não seja interrompido
                                setTimeout(() => { window.location.href = url; }, 600);
                            }
                        } catch (e) {
                            console.warn('⚠️ Não foi possível ler headers de RAT online', e);
                        }
                    }
                } else {
                    // Resposta JSON - verificar se há erro
                    const result = await response.json();
                    debugLog('📄 Resposta JSON: ' + JSON.stringify(result));
                    if (result.success) {
                        showAlert('RAT gerado com sucesso!', 'success');
                        console.log('✅ RAT gerado:', result);
                    } else {
                        // Não interromper o loop se este projeto não retornou equipamentos.
                        // Mostrar alerta e continuar para o próximo projeto.
                        showAlert(result.message || 'Nenhum equipamento encontrado para este projeto', 'warning');
                        debugLog('⚠️ Projeto sem equipamentos: ' + JSON.stringify(requestData));
                        continue;
                    }
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                // Mostrar aviso e continuar para o próximo projeto em caso de erro HTTP
                showAlert(errorData.message || `Erro ${response.status} ao gerar RAT para ${proj}`, 'warning');
                debugLog('⚠️ Erro HTTP ao gerar RAT: ' + (errorData.message || `Status ${response.status}`));
                continue;
            }
        } // fim for

        debugLog('✅ Processo de geração de RAT concluído para todos os projetos solicitados.');
    } catch (error) {
        console.error('❌ Erro na geração do RAT:', error);
        showAlert(`Erro ao gerar RAT: ${error.message}`, 'error');
    }
}

function processarTechnicianSelection() {
    debugLog('🔄 processarTechnicianSelection() chamada - FUNÇÃO OBSOLETA');
    // Esta função não é mais usada - o sistema agora usa confirmarTecnico() com select
    return;
}

function generateRATReport(technicians) {
    console.log('📋 Gerando RAT com técnicos:', technicians);
    console.log('📊 Dados filtrados:', filteredData.length, 'registros');
    
    // Simular processamento
    showAlert('RAT está sendo gerado...', 'info');
    
    setTimeout(() => {
        const ratData = {
            technicians: technicians,
            equipmentCount: filteredData.length,
            companies: [...new Set(filteredData.map(item => item.Empresa))],
            projects: [...new Set(filteredData.map(item => item.PROJETO))],
            date: new Date().toISOString().split('T')[0]
        };
        
        console.log('📋 RAT gerado:', ratData);
        showAlert(`RAT gerado com sucesso! ${filteredData.length} equipamentos incluídos.`, 'success');
    }, 1500);
}

// Funções do menu
function atualizarDados() {
    console.log('🔄 Atualizando dados...');
    loadData();
}

async function gerarRelatorioPrefixos() {
    console.log('📊 Iniciando geração de relatório de prefixos...');
    
    try {
        showLoading(true);
        
        // Obter filtros atuais
        const filters = {
            empresa: document.getElementById('empresaFilter')?.value || '',
            projeto: document.getElementById('projetoFilter')?.value || '',
            garagem: document.getElementById('garagemFilter')?.value || ''
        };
        
        const response = await fetch('/api/prefixes-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filters })
        });
        
        if (response.ok && response.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
            // Download do arquivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Extrair nome do arquivo do header Content-Disposition ou usar padrão
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'relatorio_prefixos.xlsx';
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('Relatório de prefixos gerado com sucesso!', 'success');
        } else {
            const result = await response.json();
            showAlert(result.message || 'Erro ao gerar relatório de prefixos', 'error');
        }
    } catch (error) {
        console.error('Erro ao gerar relatório de prefixos:', error);
        showAlert('Erro ao gerar relatório de prefixos', 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================================================
// RAT PERSONALIZADA - Entrada manual de prefixos
// ============================================================================

// Variáveis globais para RAT Personalizada
window.ratPersonalizadaPrefixos = [];
window.ratPersonalizadaEmpresa = null;
window.ratPersonalizadaProjeto = null;
window.ratPersonalizadaGaragem = null;
window.ratPersonalizadaEquipamentos = null; // Dados com Bluemaxx_B incluído

function iniciarRATPersonalizada() {
    console.log('📋 Iniciando fluxo de RAT Personalizada...');
    
    try {
        // Limpar campos anteriores
        document.getElementById('ratPersPrefixos').value = '';
        document.getElementById('ratPersContador').textContent = '0 prefixos';
        document.getElementById('ratPersPrefixosList').style.display = 'none';
        document.getElementById('ratPersPrefixosChips').innerHTML = '';
        
        // Limpar variáveis globais
        window.ratPersonalizadaPrefixos = [];
        window.ratPersonalizadaEmpresa = null;
        window.ratPersonalizadaProjeto = null;
        window.ratPersonalizadaGaragem = null;
        
        // Limpar projeto e garagem
        const projetoSelect = document.getElementById('ratPersProjeto');
        const garagemSelect = document.getElementById('ratPersGaragem');
        if (projetoSelect) projetoSelect.innerHTML = '<option value="">Carregando...</option>';
        if (garagemSelect) garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        
        // Configurar listener para contador de prefixos
        const textareaPrefixos = document.getElementById('ratPersPrefixos');
        if (textareaPrefixos) {
            textareaPrefixos.removeEventListener('input', atualizarContadorPrefixos);
            textareaPrefixos.addEventListener('input', atualizarContadorPrefixos);
        }
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('ratPersonalizadaModal'));
        modal.show();
        
        // Carregar dados com Bluemaxx_B incluído (async)
        carregarEquipamentosRATPersonalizada();
        
    } catch (error) {
        console.error('❌ Erro ao iniciar RAT Personalizada:', error);
        showAlert('Erro ao iniciar RAT Personalizada: ' + error.message, 'error');
    }
}

// Carrega equipamentos incluindo status Bluemaxx_B para RAT Personalizada
async function carregarEquipamentosRATPersonalizada() {
    try {
        console.log('🔄 Carregando equipamentos para RAT Personalizada (inclui Bluemaxx_B)...');
        
        const response = await fetch('/api/rat-personalizada/equipamentos', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            window.ratPersonalizadaEquipamentos = result.data;
            console.log(`✅ ${result.total} equipamentos carregados para RAT Personalizada (inclui Bluemaxx_B)`);
            
            // Popular empresas usando os dados carregados
            popularEmpresasRATPersonalizada();
        } else {
            throw new Error(result.error || 'Erro ao carregar equipamentos');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar equipamentos para RAT Personalizada:', error);
        showAlert('Erro ao carregar equipamentos. Usando dados do dashboard.', 'warning');
        
        // Fallback: usar equipmentData normal
        window.ratPersonalizadaEquipamentos = equipmentData;
        popularEmpresasRATPersonalizada();
    }
}

function popularEmpresasRATPersonalizada() {
    const select = document.getElementById('ratPersEmpresa');
    if (!select) return;
    
    // Usar dados com Bluemaxx_B se disponível, senão fallback para equipmentData
    const dados = window.ratPersonalizadaEquipamentos || equipmentData || [];
    
    if (dados.length === 0) {
        select.innerHTML = '<option value="">Nenhum dado disponível</option>';
        return;
    }
    
    // Extrair empresas únicas
    const empresas = [...new Set(dados.map(item => item.Empresa).filter(e => e))].sort();
    
    select.innerHTML = '<option value="">Selecione a empresa...</option>';
    empresas.forEach(empresa => {
        const opt = document.createElement('option');
        opt.value = empresa;
        opt.textContent = empresa;
        select.appendChild(opt);
    });
    
    console.log(`📋 RAT Personalizada: ${empresas.length} empresas carregadas`);
}

function atualizarFiltrosRATPersonalizada(origem) {
    const empresaSelect = document.getElementById('ratPersEmpresa');
    const projetoSelect = document.getElementById('ratPersProjeto');
    const garagemSelect = document.getElementById('ratPersGaragem');
    
    if (!empresaSelect || !projetoSelect || !garagemSelect) return;
    
    const selectedEmpresa = empresaSelect.value;
    const selectedProjeto = projetoSelect.value;
    
    // Usar dados com Bluemaxx_B se disponível, senão fallback para equipmentData
    const dados = window.ratPersonalizadaEquipamentos || equipmentData || [];
    
    if (origem === 'empresa') {
        // Atualizar projetos baseado na empresa selecionada
        if (!selectedEmpresa) {
            projetoSelect.innerHTML = '<option value="">Selecione a empresa primeiro...</option>';
            garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
            return;
        }
        
        // Filtrar pelos dados (inclui Bluemaxx_B)
        const filteredByEmpresa = dados.filter(item => item.Empresa === selectedEmpresa);
        const projetos = [...new Set(filteredByEmpresa.map(item => item.PROJETO).filter(p => p))].sort();
        
        projetoSelect.innerHTML = '<option value="">Selecione o projeto...</option>';
        projetos.forEach(projeto => {
            const opt = document.createElement('option');
            opt.value = projeto;
            opt.textContent = projeto;
            projetoSelect.appendChild(opt);
        });
        
        // Auto-selecionar se só tem um projeto
        if (projetos.length === 1) {
            projetoSelect.value = projetos[0];
            atualizarFiltrosRATPersonalizada('projeto');
        } else {
            garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        }
        
        console.log(`📋 RAT Personalizada: ${projetos.length} projetos para empresa ${selectedEmpresa}`);
    }
    
    if (origem === 'projeto') {
        // Atualizar garagens baseado no projeto selecionado
        if (!selectedProjeto) {
            garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
            return;
        }
        
        // Filtrar pelos dados (inclui Bluemaxx_B)
        let filteredData = dados;
        if (selectedEmpresa) {
            filteredData = filteredData.filter(item => item.Empresa === selectedEmpresa);
        }
        filteredData = filteredData.filter(item => item.PROJETO === selectedProjeto);
        
        const garagens = [...new Set(filteredData.map(item => item.GARAGEM).filter(g => g))].sort();
        
        garagemSelect.innerHTML = '<option value="">Selecione a garagem...</option>';
        garagens.forEach(garagem => {
            const opt = document.createElement('option');
            opt.value = garagem;
            opt.textContent = garagem;
            garagemSelect.appendChild(opt);
        });
        
        // Auto-selecionar se só tem uma garagem
        if (garagens.length === 1) {
            garagemSelect.value = garagens[0];
        }
        
        console.log(`📋 RAT Personalizada: ${garagens.length} garagens para projeto ${selectedProjeto}`);
    }
}

function atualizarContadorPrefixos() {
    const textarea = document.getElementById('ratPersPrefixos');
    const contador = document.getElementById('ratPersContador');
    const listContainer = document.getElementById('ratPersPrefixosList');
    const chipsContainer = document.getElementById('ratPersPrefixosChips');
    
    if (!textarea || !contador) return;
    
    const prefixos = parsePrefixos(textarea.value);
    contador.textContent = `${prefixos.length} prefixo${prefixos.length !== 1 ? 's' : ''}`;
    contador.className = prefixos.length > 0 ? 'badge bg-success' : 'badge bg-secondary';
    
    // Mostrar chips dos prefixos
    if (prefixos.length > 0 && chipsContainer && listContainer) {
        listContainer.style.display = 'block';
        chipsContainer.innerHTML = prefixos.slice(0, 20).map(p => 
            `<span class="badge bg-primary me-1 mb-1">${p}</span>`
        ).join('');
        
        if (prefixos.length > 20) {
            chipsContainer.innerHTML += `<span class="badge bg-secondary me-1 mb-1">+${prefixos.length - 20} mais...</span>`;
        }
    } else if (listContainer) {
        listContainer.style.display = 'none';
    }
}

function parsePrefixos(texto) {
    if (!texto || !texto.trim()) return [];
    
    // Separar por vírgulas, ponto-e-vírgula, ou quebras de linha
    const prefixos = texto
        .split(/[,;\n\r]+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
    
    // Remover duplicatas
    return [...new Set(prefixos)];
}

// Confirmar prefixos e continuar para seleção de técnico (fluxo normal)
function confirmarPrefixosRAT() {
    console.log('📋 Confirmando prefixos para RAT Personalizada...');
    
    // Validar campos obrigatórios
    const empresa = document.getElementById('ratPersEmpresa')?.value;
    const projeto = document.getElementById('ratPersProjeto')?.value;
    const garagem = document.getElementById('ratPersGaragem')?.value;
    const prefixosTexto = document.getElementById('ratPersPrefixos')?.value;
    
    if (!empresa) {
        showAlert('Selecione a empresa.', 'warning');
        return;
    }
    if (!projeto) {
        showAlert('Selecione o projeto.', 'warning');
        return;
    }
    if (!garagem) {
        showAlert('Selecione a garagem.', 'warning');
        return;
    }
    
    const prefixos = parsePrefixos(prefixosTexto);
    if (prefixos.length === 0) {
        showAlert('Informe pelo menos um prefixo.', 'warning');
        return;
    }
    
    // Capturar opção de criar chamados N4
    const criarChamadosN4 = document.getElementById('criarChamadosN4CheckPers')?.checked || false;
    
    // Armazenar dados para uso posterior no fluxo
    window.ratPersonalizadaPrefixos = prefixos;
    window.ratPersonalizadaEmpresa = empresa;
    window.ratPersonalizadaProjeto = projeto;
    window.ratPersonalizadaGaragem = garagem;
    window.ratPersonalizadaCriarChamadosN4 = criarChamadosN4; // NOVO
    
    // Configurar variáveis globais do fluxo normal de RAT
    selectedProject = projeto;
    window.selectedProjects = [projeto];
    window.selectedGarages = [garagem];
    window.selectedRATStatus = []; // Sem status - usamos prefixos manuais
    
    console.log(`✅ RAT Personalizada: ${prefixos.length} prefixos confirmados`);
    console.log(`   Empresa: ${empresa}, Projeto: ${projeto}, Garagem: ${garagem}`);
    console.log(`   Criar chamados N4: ${criarChamadosN4}`);
    
    // Fechar modal de RAT Personalizada
    const ratPersModal = bootstrap.Modal.getInstance(document.getElementById('ratPersonalizadaModal'));
    if (ratPersModal) {
        const modalEl = document.getElementById('ratPersonalizadaModal');
        modalEl.addEventListener('hidden.bs.modal', function handler() {
            modalEl.removeEventListener('hidden.bs.modal', handler);
            // Continuar para seleção de técnico (fluxo normal)
            abrirModalTecnicoRAT();
        }, { once: true });
        ratPersModal.hide();
    } else {
        abrirModalTecnicoRAT();
    }
}

// Abrir modal de seleção de técnico para RAT
async function abrirModalTecnicoRAT() {
    debugLog('👨‍🔧 Abrindo modal de seleção de técnico...');
    
    // Popular select de técnicos
    const technicianSelect = document.getElementById('technicianSelect');
    if (technicianSelect) {
        technicianSelect.innerHTML = '<option value="">Carregando...</option>';
        
        try {
            const response = await fetch('/api/technicians/public');
            const result = await response.json();
            
            technicianSelect.innerHTML = '<option value="">Selecione o técnico responsável...</option>';
            
            if (result.success && result.data) {
                result.data.forEach(tec => {
                    const opt = document.createElement('option');
                    opt.value = tec.nome || tec.name || '';
                    opt.textContent = tec.nome || tec.name || 'Técnico';
                    opt.dataset.email = tec.email || '';
                    technicianSelect.appendChild(opt);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar técnicos:', error);
            technicianSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
    
    // Mostrar modal de técnico
    const technicianModal = new bootstrap.Modal(document.getElementById('technicianModal'));
    technicianModal.show();
}

// Sobrescrever gerarRAT para suportar prefixos manuais
const originalGerarRAT = window.gerarRAT;
window.gerarRAT = async function() {
    // Verificar se estamos no fluxo de RAT Personalizada
    if (window.ratPersonalizadaPrefixos && window.ratPersonalizadaPrefixos.length > 0) {
        await gerarRATPersonalizada();
    } else if (typeof originalGerarRAT === 'function') {
        await originalGerarRAT();
    } else {
        // Fallback para o código original inline
        await gerarRATOriginal();
    }
};

async function gerarRATPersonalizada() {
    debugLog('📄 [RAT PERSONALIZADA] Gerando RAT com prefixos manuais...');
    
    try {
        showAlert('Processando RAT Personalizada...', 'info');
        
        const projeto = window.ratPersonalizadaProjeto;
        const empresa = window.ratPersonalizadaEmpresa;
        const garagem = window.ratPersonalizadaGaragem;
        const prefixos = window.ratPersonalizadaPrefixos;
        
        if (!projeto || !garagem || prefixos.length === 0) {
            showAlert('Dados incompletos para gerar RAT Personalizada.', 'error');
            return;
        }
        
        // Verificar se deve criar chamados N4 (checkbox no modal de RAT Personalizada)
        const criarChamadosN4 = window.ratPersonalizadaCriarChamadosN4 || false;
        debugLog('📝 RAT Personalizada - Criar chamados N4: ' + criarChamadosN4);
        
        // Montar requisição
        const requestData = {
            projeto: projeto,
            empresa: empresa,
            statuses: [], // Sem filtro de status
            technician: window.selectedTechnician,
            garages: [garagem],
            responsavel_tecnico_email: window.responsavelTecnicoEmail || '',
            equipe_emails: window.equipeEmails || [],
            prefixos_manuais: prefixos,
            // NOVO: Criar chamados N4 automaticamente
            criar_chamados_n4: criarChamadosN4,
            filters: {
                startDate: null,
                endDate: null
            }
        };
        
        console.log('📤 Enviando requisição RAT Personalizada:', requestData);
        
        const response = await fetch('/api/generate-rat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            if (contentType && (contentType.includes('application/pdf') || contentType.includes('application/zip'))) {
                const isPdf = contentType.includes('application/pdf');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                // Extrair nome do arquivo
                const contentDisp = response.headers.get('content-disposition') || '';
                let filename = '';
                const m = /filename\*?=([^;]+)/i.exec(contentDisp);
                if (m && m[1]) {
                    filename = m[1].trim().replace(/UTF-8''/, '').replace(/"/g, '');
                }
                
                if (!filename) {
                    filename = `RAT_Personalizada_${projeto}_${garagem}_${new Date().toISOString().slice(0,10)}.${isPdf ? 'pdf' : 'zip'}`;
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showAlert(`RAT Personalizada gerada com sucesso! (${prefixos.length} prefixos)`, 'success');
                
                // Limpar variáveis de RAT Personalizada
                window.ratPersonalizadaPrefixos = [];
                window.ratPersonalizadaEmpresa = null;
                window.ratPersonalizadaProjeto = null;
                window.ratPersonalizadaGaragem = null;
                
            } else {
                const result = await response.json();
                if (result.success) {
                    showAlert('RAT Personalizada gerada com sucesso!', 'success');
                    // Limpar variáveis
                    window.ratPersonalizadaPrefixos = [];
                } else {
                    showAlert(result.message || 'Erro ao gerar RAT Personalizada', 'warning');
                }
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            showAlert(errorData.message || `Erro ${response.status} ao gerar RAT`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro ao gerar RAT Personalizada:', error);
        showAlert('Erro ao gerar RAT Personalizada: ' + error.message, 'error');
    }
}

// Abrir modal de acesso - PADRÃO ALINHADO AO REFORÇO
async function solicitacaoAcesso() {
    console.log('🔑 Iniciando modal de solicitação de acesso...');
    
    try {
        // Carregar projetos primeiro (clona dashboard ou usa índice em cache)
        await preencherProjetosAccess();

        // Configurar event listener para mudança de projeto
        const selProj = document.getElementById('accessProject');
        if (selProj) {
            selProj.onchange = async () => {
                await preencherGaragensPorProjetoAccess();
                await buscarPrefixosParaAcesso();
                atualizarPreviewEmail();
            };
            // Carregar garagens iniciais (todas) e prefixos
            await preencherGaragensPorProjetoAccess();
        }

        const selGar = document.getElementById('accessGarages');
        if (selGar) {
            selGar.addEventListener('change', async () => {
                await buscarPrefixosParaAcesso();
                atualizarPreviewEmail();
            });
        }

        // Índice agora unificado (REFORCO_IDX) é garantido dentro das funções de preenchimento

        // Carregar técnicos
        await loadTechniciansForVisit();
        console.log('✅ Técnicos carregados com sucesso');

        // Abrir modal
        const el = document.getElementById('accessRequestModal');
        const modal = new bootstrap.Modal(el);
        
        el.addEventListener('shown.bs.modal', () => {
            // Configurar data mínima (hoje)
            const today = new Date().toISOString().split('T')[0];
            const dateStart = document.getElementById('accessDateStart');
            if (dateStart) {
                dateStart.value = today;
                dateStart.min = today;
            }

            // Configurar event listeners
            setupAccessModalEventListeners();
            setupModalResetListener();

            // Focus no select de projetos
            if (selProj) {
                selProj.focus();
            }
        }, { once: true });
        
        modal.show();
        console.log('✅ Modal aberto com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal de acesso:', error);
        alert('Erro ao carregar modal de solicitação de acesso');
    }
}

function setupModalResetListener() {
    const modal = document.getElementById('accessRequestModal');
    if (modal) {
        // Remover listener existente
        modal.removeEventListener('hidden.bs.modal', resetAccessModal);
        
        // Adicionar listener para reset
        modal.addEventListener('hidden.bs.modal', resetAccessModal);
    }
}

function resetAccessModal() {
    console.log('🔄 Resetando modal de solicitação de acesso...');
    
    // Reset dos campos
    const fieldsToReset = [
        // 'accessProject' NÃO é resetado para manter lista carregada em próxima abertura
        'accessType',
        'accessObjective',
        'accessDateEnd',
        'accessTime'
    ];
    
    fieldsToReset.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            if (field.type === 'select-one') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
            
            // Reset visual styles
            field.style.borderColor = '';
            field.style.boxShadow = '';
        }
    });
    
    // Reset selects múltiplos
    const multiSelects = ['accessGarages', 'visitTechnicians'];
    multiSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            Array.from(select.options).forEach(option => {
                option.selected = false;
            });
            select.style.borderColor = '';
            select.style.boxShadow = '';
        }
    });
    
    // Reset data início para hoje
    const today = new Date().toISOString().split('T')[0];
    const dateStart = document.getElementById('accessDateStart');
    if (dateStart) {
        dateStart.value = today;
        dateStart.style.borderColor = '';
        dateStart.style.boxShadow = '';
    }
    
    // Reset horário para 08:00
    const timeField = document.getElementById('accessTime');
    if (timeField) {
        timeField.value = '08:00';
        timeField.style.borderColor = '';
        timeField.style.boxShadow = '';
    }
    
    // Reset preview
    const preview = document.getElementById('emailPreview');
    if (preview) {
        preview.value = '';
        preview.style.animation = '';
    }
    
    // Reset header progress
    const modalHeader = document.querySelector('#accessRequestModal .modal-header');
    if (modalHeader) {
        modalHeader.classList.remove('progress-20', 'progress-40', 'progress-60', 'progress-80', 'progress-100');
    }
    
    // Reset título
    const modalTitle = document.querySelector('#accessRequestModal .modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = 'Solicitação de Acesso';
    }
    
    // Reset botões
    const generateBtn = document.getElementById('generateEmailBtn');
    const copyBtn = document.getElementById('copyEmailBtn');
    
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="bi bi-clock me-1"></i> 0% Completo';
        generateBtn.classList.remove('btn-primary');
        generateBtn.classList.add('btn-secondary');
        generateBtn.style.transform = '';
        generateBtn.style.animation = '';
    }
    
    if (copyBtn) {
        copyBtn.disabled = true;
        copyBtn.innerHTML = '<i class="bi bi-clipboard-check me-1"></i> Copiar Email';
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-outline-success');
        copyBtn.style.transform = '';
        copyBtn.style.animation = '';
    }
    
    console.log('✅ Modal resetado com sucesso');
}

function setupAccessModalEventListeners() {
    // Lista de campos que devem atualizar o preview automaticamente
    const fieldsToWatch = [
        'accessProject',
        'accessDateStart',
        'accessTime',
        'accessGarages',
        'visitTechnicians'
    ];
    
    fieldsToWatch.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Remover listeners existentes para evitar duplicatas
            field.removeEventListener('change', handleAccessFieldChange);
            field.removeEventListener('input', handleAccessFieldChange);
            
            // Adicionar novos listeners
            field.addEventListener('change', handleAccessFieldChange);
            
            if (field.type === 'text' || field.type === 'time' || field.type === 'date') {
                field.addEventListener('input', handleAccessFieldChange);
            }
        }
    });
    
    // Event listeners específicos para carregar dados
    const projectSelect = document.getElementById('accessProject');
    if (projectSelect) {
        projectSelect.addEventListener('change', function() {
            preencherGaragensPorProjetoAccess();
        });
    }
    
    // A função carregarProjetosAccess() já foi chamada antes na solicitacaoAcesso()
    // então não precisa chamar novamente aqui
    
    // Configurar validação visual em tempo real
    setupFieldValidation();
}

function handleAccessFieldChange(event) {
    const field = event.target;
    
    // Validação visual do campo
    validateField(field);
    
    // Atualizar preview com delay
    setTimeout(() => {
        atualizarPreviewEmail();
        updateFormProgressAccess();
    }, field.type === 'text' ? 300 : 100);
}

function updateFormProgressAccess() {
    const project = document.getElementById('accessProject')?.value || '';
    const garages = document.getElementById('accessGarages')?.selectedOptions.length || 0;
    const technicians = document.getElementById('visitTechnicians')?.selectedOptions.length || 0;
    const date = document.getElementById('accessDateStart')?.value || '';
    const time = document.getElementById('accessTime')?.value || '';
    
    const completed = [project, garages > 0, technicians > 0, date, time].filter(Boolean).length;
    const total = 5;
    const progress = Math.round((completed / total) * 100);
    
    const generateBtn = document.getElementById('generateEmailBtn');
    if (generateBtn) {
        generateBtn.disabled = progress < 100;
        generateBtn.innerHTML = progress === 100 ? 
            '<i class="bi bi-envelope-paper me-1"></i> Gerar Email' :
            `<i class="bi bi-clock me-1"></i> ${progress}% Completo`;
    }
}

function validateField(field) {
    const isRequired = field.hasAttribute('required');
    if (!isRequired) return;
    
    let isValid = false;
    
    if (field.type === 'select-multiple') {
        isValid = field.selectedOptions.length > 0;
    } else {
        isValid = field.value.trim() !== '';
    }
    
    // Aplicar estilos visuais
    if (isValid) {
        field.style.borderColor = '#28a745';
        field.style.boxShadow = '0 0 0 0.2rem rgba(40, 167, 69, 0.25)';
    } else {
        field.style.borderColor = '#dc3545';
        field.style.boxShadow = '0 0 0 0.2rem rgba(220, 53, 69, 0.25)';
    }
}

function setupFieldValidation() {
    const requiredFields = [
        'accessTechnician',
        'accessType',
        'accessDateStart', 
        'accessTime',
        'accessGarages'
    ];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            // Validação inicial
            validateField(field);
        }
    });
}

function updateFormProgress() {
    const requiredFields = [
        'accessTechnician',
        'accessType',
        'accessDateStart',
        'accessTime',
        'accessGarages'
    ];
    
    let filledFields = 0;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            let isFilled = false;
            
            if (field.type === 'select-multiple') {
                isFilled = field.selectedOptions.length > 0;
            } else {
                isFilled = field.value.trim() !== '';
            }
            
            if (isFilled) filledFields++;
        }
    });
    
    const progress = (filledFields / requiredFields.length) * 100;
    
    // Atualizar indicador de progresso no header
    const modalHeader = document.querySelector('#accessRequestModal .modal-header');
    if (modalHeader) {
        // Remover classes de progresso anteriores
        modalHeader.classList.remove('progress-20', 'progress-40', 'progress-60', 'progress-80', 'progress-100');
        
        // Adicionar nova classe de progresso
        if (progress >= 100) {
            modalHeader.classList.add('progress-100');
        } else if (progress >= 80) {
            modalHeader.classList.add('progress-80');
        } else if (progress >= 60) {
            modalHeader.classList.add('progress-60');
        } else if (progress >= 40) {
            modalHeader.classList.add('progress-40');
        } else if (progress >= 20) {
            modalHeader.classList.add('progress-20');
        }
    }
    
    // Atualizar botões baseado no progresso
    const generateBtn = document.getElementById('generateEmailBtn');
    const copyBtn = document.getElementById('copyEmailBtn');
    
    if (generateBtn) {
        if (progress === 100) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-envelope-check me-1"></i> Gerar Email';
            generateBtn.classList.remove('btn-secondary');
            generateBtn.classList.add('btn-primary');
        } else {
            generateBtn.disabled = true;
            generateBtn.innerHTML = `<i class="bi bi-clock me-1"></i> ${Math.round(progress)}% Completo`;
            generateBtn.classList.remove('btn-primary');
            generateBtn.classList.add('btn-secondary');
        }
    }
    
    if (copyBtn) {
        copyBtn.disabled = progress !== 100;
        if (progress === 100) {
            copyBtn.classList.remove('btn-outline-success');
            copyBtn.classList.add('btn-success');
        } else {
            copyBtn.classList.remove('btn-success');
            copyBtn.classList.add('btn-outline-success');
        }
    }
    
    // Atualizar título com progresso
    const modalTitle = document.querySelector('#accessRequestModal .modal-title');
    if (modalTitle && progress < 100) {
        const originalTitle = 'Solicitação de Acesso';
        modalTitle.innerHTML = `${originalTitle} <small class="text-light opacity-75">(${Math.round(progress)}%)</small>`;
    } else if (modalTitle && progress === 100) {
        modalTitle.innerHTML = 'Solicitação de Acesso <small class="text-light opacity-75">✓ Pronto</small>';
    }
}

async function loadTechnicians() {
    try {
        const response = await fetch('/api/tecnico');
        const result = await response.json();
        
        // Carregar técnicos no select principal (responsável)
        const select = document.getElementById('accessTechnician');
        select.innerHTML = '<option value="">Selecione um técnico...</option>';
        
        // Carregar técnicos no select de visitantes
        const visitSelect = document.getElementById('visitTechnicians');
        visitSelect.innerHTML = '';
        
        if (result.success && result.data) {
            Object.keys(result.data).forEach(nome => {
                // Select principal (responsável)
                const option = document.createElement('option');
                option.value = nome;
                option.textContent = nome;
                select.appendChild(option);
                
                // Select de visitantes (múltipla seleção)
                const visitOption = document.createElement('option');
                visitOption.value = nome;
                visitOption.textContent = `👨‍🔧 ${nome}`;
                visitSelect.appendChild(visitOption);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar técnicos:', error);
        showToast('Erro ao carregar lista de técnicos', 'error');
    }
}

function loadGaragesForAccess() {
    const select = document.getElementById('accessGarages');
    select.innerHTML = '';
    
    // Obter garagens únicas dos dados filtrados
    const garagens = [...new Set(filteredData.map(item => item.GARAGEM).filter(Boolean))];
    
    // Ordenar garagens alfabeticamente
    garagens.sort();
    
    garagens.forEach(garagem => {
        const option = document.createElement('option');
        option.value = garagem;
        option.textContent = `🏢 ${garagem}`;
        select.appendChild(option);
    });
    
    // Adicionar informação se não houver dados
    if (garagens.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '⚠️ Nenhuma garagem encontrada nos dados filtrados';
        option.disabled = true;
        select.appendChild(option);
    }
}

function adicionarTecnico() {
    console.log('👨‍🔧 Abrindo modal de adicionar técnico...');
    
    // Limpar formulário
    document.getElementById('newTechnicianForm').reset();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('newTechnicianModal'));
    modal.show();
}

function removerTecnico() {
    console.log('❌ Função de remover técnico...');
    showAlert('Para remover um técnico, entre em contato com o administrador do sistema', 'info');
}





function adicionarEndereco() {
    console.log('🏢 Abrindo modal de adicionar endereço...');
    
    // Limpar formulário
    document.getElementById('newAddressForm').reset();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('newAddressModal'));
    modal.show();
}

// Função para abrir modal de nova garagem
function showAddressModal() {
    console.log('🏢 Abrindo modal para adicionar nova garagem...');
    
    // Limpar formulário
    document.getElementById('newAddressForm').reset();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('newAddressModal'));
    modal.show();
}

// Função para salvar nova garagem/endereço
function saveAddress(event) {
    if (event) event.preventDefault(); // Prevenir envio do formulário
    console.log('🏢 Salvando nova garagem...');
    
    // Obter valores do formulário
    const nome = document.getElementById('garageName')?.value?.trim();
    const endereco = document.getElementById('garageAddress')?.value?.trim();
    const responsavel = document.getElementById('garageResponsible')?.value?.trim();
    const telefone = document.getElementById('garagePhone')?.value?.trim();
    const email = document.getElementById('garageEmail')?.value?.trim();
    
    // Debug - mostrar valores capturados
    console.log('📋 Valores capturados:');
    console.log('  - Nome:', nome, typeof nome);
    console.log('  - Endereço:', endereco, typeof endereco);
    console.log('  - Responsável:', responsavel, typeof responsavel);
    console.log('  - Telefone:', telefone, typeof telefone);
    console.log('  - Email:', email, typeof email);
    
    // Validar campos obrigatórios
    if (!nome || !endereco || !responsavel) {
        console.log('❌ Validação falhou - campos obrigatórios vazios');
        showAlert('Nome da garagem, endereço e nome do responsável são campos obrigatórios', 'warning');
        return;
    }
    
    console.log('✅ Validação passou - todos os campos obrigatórios preenchidos');
    
    // Preparar dados
    const data = {
        nome: nome,
        endereco: endereco,
        responsavel: responsavel,
        telefone: telefone || null,
        email: email || null
    };
    
    console.log('📦 Dados preparados para envio:', data);
    
    // Enviar para API
    fetch('/api/garagem', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro ao adicionar garagem');
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Garagem adicionada com sucesso:', data);
        showSuccess('Garagem adicionada com sucesso');
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('newAddressModal')).hide();
        
        // Recarregar dados (opcional)
        if (typeof loadData === 'function') {
            loadData();
        }
    })
    .catch(error => {
        console.error('❌ Erro ao adicionar garagem:', error);
        showAlert('Erro ao adicionar garagem. Tente novamente.', 'danger');
    });
}

// Função para abrir modal de novo técnico
function showTechnicianModal() {
    console.log('👨‍💼 Abrindo modal para adicionar novo técnico...');
    
    // Limpar formulário
    document.getElementById('newTechnicianForm').reset();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('newTechnicianModal'));
    modal.show();
}

// Função para salvar um novo técnico
function saveTechnician() {
    console.log('💾 Salvando novo técnico...');
    
    // Obter valores do formulário e garantir que não sejam undefined
    const nome = document.getElementById('techName')?.value?.trim() || '';
    const cpf = document.getElementById('techCPF')?.value?.trim() || '';
    const email = document.getElementById('techEmail')?.value?.trim() || '';
    const telefone = document.getElementById('techPhone')?.value?.trim() || '';
    const rg = document.getElementById('techRG')?.value?.trim() || '';
    const empresa = document.getElementById('techEmpresa')?.value?.trim() || '';
    const escritorio = document.getElementById('techEscritorio')?.value || '';
    
    // Validar campos obrigatórios
    if (!nome || !cpf) {
        showWarning('Nome e CPF são campos obrigatórios');
        return;
    }
    
    // Verificar dados dos campos
    console.log('📝 Valores dos campos do formulário:');
    console.log('  - Nome:', nome, typeof nome);
    console.log('  - CPF:', cpf, typeof cpf);
    console.log('  - RG:', rg, typeof rg);
    console.log('  - Email:', email, typeof email);
    console.log('  - Telefone:', telefone, typeof telefone);
    console.log('  - Empresa:', empresa, typeof empresa);
    console.log('  - Escritório:', escritorio, typeof escritorio);
    
    // Preparar dados na ordem correta das colunas do banco de dados
    const data = {
        nome: nome,
        cpf: cpf,
        rg: rg || '',        // Enviar string vazia para o backend tratar
        email: email || '',  // Enviar string vazia para o backend tratar
        telefone: telefone || '', // Enviar string vazia para o backend tratar
        empresa: empresa || '',   // Empresa do técnico
        escritorio: escritorio || '' // Escritório vinculado
    };
    
    // Log dos dados que serão enviados
    console.log('🔍 Dados que serão enviados para a API:', JSON.stringify(data));
    
    // Enviar para API
    fetch('/api/tecnico', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log('📬 Resposta recebida:', response.status);
        if (!response.ok) {
            throw new Error(`Erro ao adicionar técnico: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Técnico adicionado com sucesso:', JSON.stringify(data));
        showSuccess('Técnico adicionado com sucesso');
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('newTechnicianModal'));
        if (modal) modal.hide();
        
        // Limpar formulário
        const form = document.getElementById('newTechnicianForm');
        if (form) form.reset();
        
        // Recarregar técnicos se necessário
        if (typeof loadTechniciansForRAT === 'function') {
            loadTechniciansForRAT();
        }
    })
    .catch(error => {
        console.error('❌ Erro ao adicionar técnico:', error);
        showAlert('Erro ao adicionar técnico. Tente novamente.', 'danger');
    });
}

// Event listeners para os modais
document.addEventListener('DOMContentLoaded', function() {
    // Confirmar técnico para RAT
    document.getElementById('confirmTechnicianBtn')?.addEventListener('click', confirmarTecnico);
    
    // Confirmar equipe para RAT (NOVO)
    document.getElementById('confirmEquipeBtn')?.addEventListener('click', confirmarEquipe);

    // *** Event listeners para TÉCNICO e GARAGEM movidos para initializeEventListeners() ***
    // *** Para evitar listeners duplicados que causavam duplas execuções ***

    // Submeter solicitação de acesso
    document.getElementById('accessRequestForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('📝 Processando solicitação de acesso...');
        
        const technician = document.getElementById('accessTechnician').value;
        const accessType = document.getElementById('accessType').value;
        const objective = document.getElementById('accessObjective').value;
        const dateStart = document.getElementById('accessDateStart').value;
        const dateEnd = document.getElementById('accessDateEnd').value;
        const timeStart = document.getElementById('accessTime').value;
        
        // Obter garagens selecionadas
        const garageSelect = document.getElementById('accessGarages');
        const garages = Array.from(garageSelect.selectedOptions).map(opt => opt.value);
        
        if (!technician || !accessType || !dateStart || garages.length === 0) {
            showAlert('Preencha todos os campos obrigatórios', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/access-request-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    technician,
                    garages,
                    accessType,
                    objective,
                    dateStart,
                    dateEnd,
                    timeStart
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showAlert(result.message, 'success');
                bootstrap.Modal.getInstance(document.getElementById('accessRequestModal')).hide();
                document.getElementById('accessRequestForm').reset();
            } else {
                showAlert(result.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao criar solicitação de acesso:', error);
            showAlert('Erro ao processar solicitação', 'error');
        }
    });

    // Máscara para CPF
    document.getElementById('techCPF')?.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            e.target.value = value;
        }
    });
});

// Função para solicitar acesso (chamada pelo HTML)
async function solicitarAcesso() {
    console.log('[LEGADO] Redirecionando para solicitacaoAcesso()');
    return solicitacaoAcesso();
}

async function loadTechniciansForAccess() {
    try {
        console.log('👨‍🔧 Carregando técnicos para solicitação de acesso...');
        const response = await fetch('/api/tecnico');
        const result = await response.json();
        
        console.log('📋 Resposta da API técnicos:', result);
        
        // Não existe accessTechnician - só visitTechnicians
        console.log('ℹ️ Campo accessTechnician não existe - usando apenas visitTechnicians');
        return result;
        
        select.innerHTML = '<option value="">Selecione um técnico...</option>';
        
        if (result.success && result.data && Array.isArray(result.data)) {
            console.log('✅ Adicionando técnicos ao select:', result.data.length, 'técnicos');
            result.data.forEach(tecnico => {
                const option = document.createElement('option');
                option.value = tecnico.nome;
                option.textContent = tecnico.nome;
                select.appendChild(option);
            });
            console.log('✅ Técnicos carregados com sucesso');
        } else {
            console.warn('⚠️ API retornou sem dados ou com erro:', result);
            // Adicionar técnicos padrão como fallback
            const defaultTechnicians = [
                'André Gomes',
                'Bruno Silva', 
                'Carlos Santos',
                'Diego Fernandes',
                'Eduardo Lima',
                'Fabio Costa',
                'Gabriel Souza',
                'Henrique Oliveira',
                'Igor Pereira',
                'João Martins'
            ];
            
            defaultTechnicians.forEach(nome => {
                const option = document.createElement('option');
                option.value = nome;
                option.textContent = nome;
                select.appendChild(option);
            });
            
            showAlert('Carregados técnicos padrão', 'info');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar técnicos:', error);
        showAlert('Erro ao carregar técnicos: ' + error.message, 'warning');
    }
}

async function loadTechniciansForVisit() {
    try {
        console.log('👥 Carregando técnicos para seleção de visita...');
        const response = await fetch('/api/tecnico');
        const result = await response.json();
        
        const select = document.getElementById('visitTechnicians');
        if (!select) {
            console.error('❌ Elemento visitTechnicians não encontrado');
            return;
        }
        
        select.innerHTML = '';
        
        if (result.success && result.data && Array.isArray(result.data)) {
            console.log('✅ Adicionando técnicos para visita:', result.data.length, 'técnicos');
            result.data.forEach(tecnico => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    nome: tecnico.nome,
                    cpf: tecnico.cpf || '000.000.000-00',
                    rg: tecnico.rg || '00.000.000-0'
                });
                option.textContent = tecnico.nome;
                option.dataset.cpf = tecnico.cpf || '000.000.000-00';
                option.dataset.rg = tecnico.rg || '00.000.000-0';
                select.appendChild(option);
            });
            console.log('✅ Técnicos para visita carregados com sucesso');
        } else {
            console.warn('⚠️ API retornou sem dados, usando técnicos padrão');
            // Técnicos padrão com dados fictícios
            const defaultTechnicians = [
                { nome: 'André Gomes', cpf: '123.456.789-00', rg: '12.345.678-9' },
                { nome: 'Bruno Silva', cpf: '234.567.890-11', rg: '23.456.789-0' },
                { nome: 'Carlos Santos', cpf: '345.678.901-22', rg: '34.567.890-1' },
                { nome: 'Diego Fernandes', cpf: '456.789.012-33', rg: '45.678.901-2' },
                { nome: 'Eduardo Lima', cpf: '567.890.123-44', rg: '56.789.012-3' },
                { nome: 'Fabio Costa', cpf: '678.901.234-55', rg: '67.890.123-4' },
                { nome: 'Gabriel Souza', cpf: '789.012.345-66', rg: '78.901.234-5' },
                { nome: 'Henrique Oliveira', cpf: '890.123.456-77', rg: '89.012.345-6' },
                { nome: 'Igor Pereira', cpf: '901.234.567-88', rg: '90.123.456-7' },
                { nome: 'João Martins', cpf: '012.345.678-99', rg: '01.234.567-8' }
            ];
            
            defaultTechnicians.forEach(tecnico => {
                const option = document.createElement('option');
                option.value = JSON.stringify(tecnico);
                option.textContent = tecnico.nome;
                option.dataset.cpf = tecnico.cpf;
                option.dataset.rg = tecnico.rg;
                select.appendChild(option);
            });
            
            showAlert('Carregados técnicos padrão para visita', 'info');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar técnicos para visita:', error);
        showAlert('Erro ao carregar técnicos', 'error');
    }
}

// Event listeners para o modal de solicitação de acesso
document.addEventListener('DOMContentLoaded', function() {
    // Botão "Gerar Solicitação"
    const generateBtn = document.getElementById('generateAccessRequestBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            console.log('🔄 Botão "Gerar Solicitação" clicado');
            gerarSolicitacaoAcesso();
        });
    }
    
    // Botão "Adicionar Colaborador"
    const addCollabBtn = document.getElementById('addCollaboratorBtn');
    if (addCollabBtn) {
        addCollabBtn.addEventListener('click', function() {
            console.log('👥 Abrindo modal de adicionar colaborador');
            const modal = new bootstrap.Modal(document.getElementById('addCollaboratorModal'));
            modal.show();
        });
    }
    
    // Botão "Remover Selecionado"
    const removeCollabBtn = document.getElementById('removeCollaboratorBtn');
    if (removeCollabBtn) {
        removeCollabBtn.addEventListener('click', function() {
            console.log('🗑️ Removendo colaborador selecionado');
            removerColaboradorSelecionado();
        });
    }
    
    // Botão "Gerar Email"
    const generateEmailBtn = document.getElementById('generateEmailBtn');
    if (generateEmailBtn) {
        generateEmailBtn.addEventListener('click', function() {
            console.log('� Gerando email...');
            atualizarPreviewEmail();
        });
    }
    
    // Botão "Copiar Email"
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    if (copyEmailBtn) {
        copyEmailBtn.addEventListener('click', function() {
            console.log('📋 Copiando email para clipboard');
            copiarEmailParaClipboard();
        });
    }
    
    // Não atualizar preview automaticamente - apenas quando clicar em "Gerar Email"
    // (removendo os event listeners automáticos)
    
    // Event listener para técnicos de visita (select múltiplo)
    const visitTechSelect = document.getElementById('visitTechnicians');
    if (visitTechSelect) {
        visitTechSelect.addEventListener('change', atualizarPreviewEmail);
    }
    
    // Máscaras para campos
    // Máscara para CPF no modal de colaborador
    document.getElementById('collabCpf')?.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            e.target.value = value;
        }
    });
    
    // Máscara para telefone no modal de colaborador
    document.getElementById('collabPhone')?.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            if (value.length <= 10) {
                value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            } else {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            }
            e.target.value = value;
        }
    });
});

async function gerarSolicitacaoAcesso() {
    console.log('🔄 Iniciando geração de solicitação de acesso...');
    
    try {
        // Obter valores do formulário
        const technician = document.getElementById('accessTechnician')?.value?.trim();
        const accessType = document.getElementById('accessType')?.value?.trim();
        const objective = document.getElementById('accessObjective')?.value?.trim() || '';
        const dateStart = document.getElementById('accessDateStart')?.value;
        const dateEnd = document.getElementById('accessDateEnd')?.value || '';
        const timeStart = document.getElementById('accessTime')?.value || '08:00';
        
        console.log('📋 Dados do formulário:', {
            technician, accessType, objective, dateStart, dateEnd, timeStart
        });
        
        // Obter garagens selecionadas
        const garageSelect = document.getElementById('accessGarages');
        const garages = Array.from(garageSelect.selectedOptions).map(opt => opt.value);
        
        console.log('🏢 Garagens selecionadas:', garages);
        
        // Validação
        if (!technician || !accessType || !dateStart || garages.length === 0) {
            console.warn('⚠️ Campos obrigatórios não preenchidos');
            showAlert('Preencha todos os campos obrigatórios (Técnico, Tipo, Data início e pelo menos uma Garagem)', 'warning');
            return;
        }
        
        // Preparar dados da requisição
        const requestData = {
            technician,
            garages,
            accessType,
            objective,
            dateStart,
            dateEnd,
            timeStart
        };
        
        console.log('📤 Enviando solicitação:', requestData);
        
        const response = await fetch('/api/access-request-document', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('📡 Resposta recebida, status:', response.status);
        
        const result = await response.json();
        console.log('📋 Resultado:', result);
        
        if (result.success) {
            showAlert(result.message || 'Solicitação gerada com sucesso!', 'success');
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('accessRequestModal'));
            if (modal) {
                modal.hide();
            }
            
            // Limpar formulário
            document.getElementById('accessRequestForm')?.reset();
        } else {
            showAlert(result.message || 'Erro ao gerar solicitação', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao gerar solicitação de acesso:', error);
        showAlert('Erro ao processar solicitação: ' + error.message, 'error');
    }
}

function copiarEmailParaClipboard() {
    const emailPreview = document.getElementById('emailPreview');
    const copyBtn = document.getElementById('copyEmailBtn');
    
    // Check for HTML content instead of value
    const emailContent = window.lastAccessEmailHTML || emailPreview?.innerHTML || '';
    
    if (!emailPreview || !emailContent || emailContent.includes('Preencha os campos obrigatórios')) {
        showToast('Preencha todos os campos obrigatórios antes de copiar', 'warning');
        return;
    }
    
    // Animação de feedback no preview
    emailPreview.style.animation = 'pulseSuccess 0.6s ease';
    
    // Copy HTML content with rich formatting for email clients
    if (navigator.clipboard && window.ClipboardItem) {
        // Modern approach - copy both HTML and plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = emailContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        const clipboardItem = new ClipboardItem({
            'text/html': new Blob([emailContent], { type: 'text/html' }),
            'text/plain': new Blob([textContent], { type: 'text/plain' })
        });
        
        navigator.clipboard.write([clipboardItem]).then(() => {
            // Feedback visual avançado no botão
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                const originalClasses = copyBtn.className;
                
                // Animação de sucesso
                copyBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Copiado! ✓';
                copyBtn.className = 'btn btn-success px-4 py-2 shadow-sm';
                copyBtn.style.transform = 'scale(1.05)';
                copyBtn.style.animation = 'bounceSuccess 0.6s ease';
                
                // Restaurar após delay
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.className = originalClasses;
                    copyBtn.style.transform = '';
                    copyBtn.style.animation = '';
                }, 2500);
            }
            
            // Toast de sucesso com detalhes
            const linhas = textContent.split('\n').length;
            const caracteres = textContent.length;
            showToast(`📋 Email copiado com formatação HTML!\n📊 ${linhas} linhas, ${caracteres} caracteres`, 'success');
            
            // Confetti effect (opcional)
            createCopyConfetti();
            
        }).catch(err => {
            console.error('Erro ao copiar HTML:', err);
            // Fallback to plain HTML copy
            navigator.clipboard.writeText(emailContent).then(() => {
                showToast('📋 Email copiado como HTML (fallback)', 'info');
            }).catch(err2 => {
                console.error('Fallback também falhou:', err2);
                showToast('❌ Erro ao copiar - tente selecionar manualmente', 'error');
            });
        });
    } else {
        // Fallback for older browsers - copy HTML as text
        navigator.clipboard.writeText(emailContent).then(() => {
            showToast('📋 Email HTML copiado (compatibilidade)', 'info');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            showToast('❌ Erro ao copiar email', 'error');
        });
    }
}

function createCopyConfetti() {
    // Criar efeito confetti simples no botão de copiar
    const copyBtn = document.getElementById('copyEmailBtn');
    if (!copyBtn) return;
    
    const rect = copyBtn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 12; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.left = `${centerX}px`;
        confetti.style.top = `${centerY}px`;
        confetti.style.width = '6px';
        confetti.style.height = '6px';
        confetti.style.backgroundColor = ['#28a745', '#17a2b8', '#ffc107', '#dc3545'][Math.floor(Math.random() * 4)];
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '9999';
        confetti.style.animation = `confettiFall 1s ease-out forwards`;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        // Direção aleatória
        const angle = (Math.PI * 2 * i) / 12;
        const velocity = 50 + Math.random() * 30;
        confetti.style.setProperty('--dx', Math.cos(angle) * velocity + 'px');
        confetti.style.setProperty('--dy', Math.sin(angle) * velocity + 'px');
        
        document.body.appendChild(confetti);
        
        // Remover após animação
        setTimeout(() => {
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        }, 1000);
    }
}

// Adicionar CSS para animações de confetti
if (!document.getElementById('copyAnimationStyles')) {
    const style = document.createElement('style');
    style.id = 'copyAnimationStyles';
    style.textContent = `
        @keyframes pulseSuccess {
            0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.4); }
            50% { box-shadow: 0 0 0 10px rgba(40, 167, 69, 0.2); }
            100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
        }
        
        @keyframes bounceSuccess {
            0%, 100% { transform: scale(1.05); }
            50% { transform: scale(1.1); }
        }
        
        @keyframes confettiFall {
            0% {
                transform: translateX(0) translateY(0) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translateX(var(--dx)) translateY(var(--dy)) rotate(720deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Lista global de colaboradores
// Variáveis globais para o sistema

function salvarColaborador() {
    const nome = document.getElementById('collabName')?.value?.trim();
    const telefone = document.getElementById('collabPhone')?.value?.trim();
    const email = document.getElementById('collabEmail')?.value?.trim();
    const cpf = document.getElementById('collabCpf')?.value?.trim();
    const rg = document.getElementById('collabRg')?.value?.trim();
    
    if (!nome || !telefone || !email || !cpf || !rg) {
        showAlert('Preencha todos os campos do colaborador', 'warning');
        return;
    }
    
    // Adicionar à lista
    colaboradores.push({ nome, telefone, email, cpf, rg });
    
    // Atualizar a lista visual
    atualizarListaColaboradores();
    
    // Atualizar preview do email
    atualizarPreviewEmail();
    
    // Fechar modal e limpar formulário
    const modal = bootstrap.Modal.getInstance(document.getElementById('addCollaboratorModal'));
    if (modal) modal.hide();
    
    document.getElementById('collaboratorForm')?.reset();
    
    showAlert('Colaborador adicionado com sucesso!', 'success');
}

    // --- REGISTRO DA NOVA OPÇÃO ---
    window.CURRENT_EMAIL_TEMPLATE = window.CURRENT_EMAIL_TEMPLATE || 'solicitar_acesso';

    function selectEmailTemplate(templateType) {
        window.CURRENT_EMAIL_TEMPLATE = templateType;

        const selEl = document.getElementById('emailSelectionModal');
        const selModal = bootstrap.Modal.getInstance(selEl) || new bootstrap.Modal(selEl);

        // helper: fecha com segurança e só segue quando realmente ocultou
        function closeThen(next) {
            if (selEl.contains(document.activeElement)) {
                document.activeElement.blur();            // evita foco em elemento que ficará aria-hidden
            }
            selEl.addEventListener('hidden.bs.modal', function onHidden() {
                selEl.removeEventListener('hidden.bs.modal', onHidden);
                next();
            }, { once: true });
            selModal.hide();
        }

        if (templateType === 'reforco_sinal') {
            // só abre depois do hidden
            closeThen(() => abrirReforcoSinalModal());
            return;
        }

        if (templateType === 'solicitar_acesso') {
            closeThen(() => solicitarAcesso());
            return;
        }

        // Novo: Verificação de Hotspots (elétrica)
        if (templateType === 'verificacao_eletrica') {
            closeThen(() => {
                if (typeof abrirVerificacaoEletricaModal === 'function') {
                    console.log('🟠 Abrindo modal Verificação de Hotspots...');
                    abrirVerificacaoEletricaModal();
                } else {
                    console.warn('Função abrirVerificacaoEletricaModal não encontrada');
                }
            });
            return;
        }

        console.warn('Template não reconhecido:', templateType);
    }

    // --- ABRIR MODAL + CARREGAR GARAGENS ---
        // cache local
        window.REFORCO_IDX = { projetos: [], porProjeto: {}, todos: [] };

        function normStr(v) {
                return (v ?? "").toString().trim();
        }
        function fillOptions(select, arr) {
                select.innerHTML = '';
                for (const v of arr) {
                        const o = document.createElement('option');
                        o.value = v; o.textContent = v;
                        select.appendChild(o);
                }
                
                // Forçar scroll se for um dos elementos de garagens dos modais
                if (select.id === 'selectGaragensReforco' || select.id === 'selectGaragensVerificacao') {
                    select.style.overflowY = 'auto';
                    select.style.overflowX = 'hidden';
                    select.style.maxHeight = '200px';
                }
        }

        // tenta achar o select de projeto da dashboard pra clonar (se existir)
        function getDashboardProjetoSelect() {
                return document.querySelector('#selectProjeto, [data-role="select-projeto"], #filtroProjeto, #filterProjeto') || null;
        }

        // 2.1 Monta índice Projeto→Garagens a partir do /api/data (mesma fonte do grid)
        async function buildProjetoGarageIndexFromData() {
            try {
                const r = await fetch('/api/data');
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const payload = await r.json();
                const rows = Array.isArray(payload) ? payload : (payload.data || []);
                const porProjeto = {};
                const setProjetos = new Set();
                const setGaragens = new Set();

                for (const row of rows) {
                    const proj = normStr(row.PROJETO || row.Projeto);
                    const gar  = normStr(row.GARAGEM || row.Garagem);
                    if (!gar) continue;
                    setGaragens.add(gar);
                    if (proj) {
                        setProjetos.add(proj);
                        (porProjeto[proj] ||= new Set()).add(gar);
                    }
                }

                // serializa Sets
                const idx = {
                    projetos: Array.from(setProjetos).sort((a,b)=>a.localeCompare(b,'pt-BR')),
                    porProjeto: Object.fromEntries(Object.entries(porProjeto).map(([k, set]) => [k, Array.from(set).sort((a,b)=>a.localeCompare(b,'pt-BR'))])),
                    todos: Array.from(setGaragens).sort((a,b)=>a.localeCompare(b,'pt-BR')),
                };
                window.REFORCO_IDX = idx;
                return idx;
            } catch (e) {
                console.warn('Falha ao montar índice Projeto→Garagens do /api/data', e);
                return window.REFORCO_IDX;
            }
        }

        // 2.2 Carregar PROJETOS (clona da dashboard se houver; senão usa índice do /api/data)
        async function carregarProjetosReforco() {
            const selProj = document.getElementById('selectProjetosReforco');
            selProj.innerHTML = '<option value="">Carregando projetos...</option>';

            // tenta clonar do filtro já existente na página
            const dashSel = getDashboardProjetoSelect();
            if (dashSel && dashSel.options?.length) {
                const lista = Array.from(dashSel.options).map(o => normStr(o.value)).filter(Boolean)
                                            .sort((a,b)=>a.localeCompare(b,'pt-BR'));
                fillOptions(selProj, [''].concat(lista));
                selProj.firstElementChild.textContent = 'Selecione um projeto';
                // pré-seleciona o mesmo projeto da dashboard, se houver
                if (dashSel.value) selProj.value = normStr(dashSel.value);
            } else {
                // monta índice a partir do /api/data
                const idx = await buildProjetoGarageIndexFromData();
                fillOptions(selProj, [''].concat(idx.projetos));
                selProj.firstElementChild.textContent = 'Selecione um projeto';
            }
        }

        // 2.3 Preencher GARAGENS com base no projeto escolhido
        function preencherGaragensPorProjeto() {
            const selProj = document.getElementById('selectProjetosReforco');
            const selGar = document.getElementById('selectGaragensReforco');
            const proj = normStr(selProj.value);

            // se tiver índice, usa. senão, reaproveita o select do Solicitar Acesso
            if (proj && window.REFORCO_IDX?.porProjeto?.[proj]?.length) {
                fillOptions(selGar, window.REFORCO_IDX.porProjeto[proj]);
                return;
            }

            // fallback 1: clona do Solicitar Acesso (sem filtrar por projeto)
            const sAcesso = document.getElementById('selectGaragensSolicitar');
            if (sAcesso && sAcesso.options?.length) {
                selGar.innerHTML = '';
                for (const opt of sAcesso.options) {
                    if (!opt.value) continue;
                    const o = document.createElement('option');
                    o.value = opt.value; o.textContent = opt.textContent;
                    selGar.appendChild(o);
                }
                return;
            }

            // fallback 2: se o índice tiver todos (sem projeto), usa
            if (window.REFORCO_IDX?.todos?.length) {
                fillOptions(selGar, window.REFORCO_IDX.todos);
                return;
            }

            // fallback 3: último recurso — dataset
            carregarGaragensReforco(); // sua função já existente (buscar dataset)
        }

        // 2.4 Abrir modal: carregar projetos, depois garagens do projeto atual (se houver)
        async function abrirReforcoSinalModal() {
            await carregarProjetosReforco();

            // quando mudar o projeto, atualiza garagens
            const selProj = document.getElementById('selectProjetosReforco');
            selProj.onchange = preencherGaragensPorProjeto;

            // preenche garagens para o projeto inicialmente selecionado (ou todas)
            preencherGaragensPorProjeto();

            const el = document.getElementById('reforcoSinalModal');
            const modal = new bootstrap.Modal(el);
            el.addEventListener('shown.bs.modal', () => {
                // Forçar propriedades de scroll no elemento garagens
                const selectGaragens = document.getElementById('selectGaragensReforco');
                if (selectGaragens) {
                    selectGaragens.style.overflowY = 'auto';
                    selectGaragens.style.overflowX = 'hidden';
                    selectGaragens.style.maxHeight = '200px';
                    selectGaragens.focus();
                } else if (selProj) {
                    selProj.focus();
                }
            }, { once: true });
            modal.show();
        }

        // 2.5 (opcional) incluir o nome do projeto no assunto
        // helper de normalização (remove acentos e não-alfanum.)
        const norm = (s) => (s ?? '')
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        async function gerarEmailReforcoSinal() {
            const status = document.getElementById('statusReforcoSinal');
            const selGar = document.getElementById('selectGaragensReforco');
            const selProj = document.getElementById('selectProjetosReforco');

            const garagens = Array.from(selGar.selectedOptions).map(o => o.value.trim());
            const projeto = (selProj.value || "").toString().trim();

            if (!garagens.length) {
                status.textContent = 'Selecione ao menos uma garagem.';
                return;
            }
            // 🎯 Filtra DIRETO do grid já carregado (verdade única)
            const base = Array.isArray(window.__GRID_ROWS__) ? window.__GRID_ROWS__ : [];
            const ok = new Set(["Atenção","Alerta","Inativo","Inativa"]);
            const pats = [];
            const seen = new Set();
            const garSet = new Set(garagens.map(norm));
            const projNorm = norm(projeto);

            for (const r of base) {
                const proj = (r.PROJETO ?? r.Projeto ?? "").toString().trim();
                const gar  = (r.GARAGEM ?? r.Garagem ?? "").toString().trim();
                const st   = (r["Monitoramento BI"] ?? r.Status ?? "").toString().trim();
                const pat  = (r.Patrimonio ?? r.PATRIMONIO ?? "").toString().trim();

                if (!pat) continue;
                if (projeto && norm(proj) !== projNorm) continue;
                if (!garSet.has(norm(gar))) continue;
                if (!ok.has(st)) continue;

                if (!seen.has(pat)) { seen.add(pat); pats.push(pat); }
            }

            // Fallback automático se não encontrar patrimonios locais
            let payload;
            if (pats.length > 0) {
                status.textContent = `Consultando ${pats.length} patrimônio(s)...`;
                payload = { patrimonios: pats };
            } else {
                // fallback: evita 200 vazio no back e já usa o mesmo filtro do grid no servidor
                status.textContent = 'Nenhum patrimônio encontrado no grid — usando filtros no servidor...';
                payload = { garagens, projeto };
            }

            try {
                const resp = await fetch('/api/email/reforco-sinal/data', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) throw new Error('Falha na consulta');

                const raw = await resp.json();
                const rowsNorm = (Array.isArray(raw) ? raw : []).map(r => ({
                    Patrimonio:   String(r.Patrimonio ?? ""),
                    IMEI_MODEM_1: String(r.IMEI_MODEM_1 ?? ""),
                    IMEI_CHIP_1:  String(r.IMEI_CHIP_1  ?? ""),
                    N_TELEFONE_1: String(r.N_TELEFONE_1 ?? r["Nº_TELEFONE_1"] ?? ""),
                    OPERADORA_1:  String(r.OPERADORA_1  ?? "")
                }));

                const assunto = `Reforço de Sinal — ${garagens.join(', ')}`;
                document.getElementById('assuntoReforcoSinal').value = assunto;
                document.getElementById('previewReforcoSinal').innerHTML = montarEmailReforcoHtml(rowsNorm);
                status.textContent = rowsNorm.length === 1 ? 'OK: 1 linha retornada.' : `OK: ${rowsNorm.length} linhas retornadas.`;
            } catch (e) {
                console.error(e);
                status.textContent = 'Erro ao gerar o e-mail.';
            }
        }

    // Reaproveite seu endpoint existente; se não houver, use /api/garagens (retornando array de strings)
    async function carregarGaragensReforco() {
        const sel = document.getElementById('selectGaragensReforco');
        sel.innerHTML = '<option disabled>Carregando...</option>';

        // 1) Reaproveita o select do Solicitar Acesso (clone das opções)
        const sAcesso = document.getElementById('selectGaragensSolicitar');
        if (sAcesso && sAcesso.options && sAcesso.options.length) {
            sel.innerHTML = '';
            for (const opt of sAcesso.options) {
                if (!opt.value) continue;
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.textContent;
                sel.appendChild(o);
            }
            return;
        }

        // 2) Usa cache global se disponível (o fluxo de Solicitar Acesso pode popular window.CACHE_GARAGENS)
        if (Array.isArray(window.CACHE_GARAGENS) && window.CACHE_GARAGENS.length) {
            return fillOptions(sel, window.CACHE_GARAGENS);
        }
        if (window.PRELOAD?.garagens?.length) {
            return fillOptions(sel, window.PRELOAD.garagens);
        }

        // 3) Tentar deduzir da própria tabela via /api/data
        try {
            const r = await fetch('/api/data');
            if (r.ok) {
                const payload = await r.json();
                const rows = Array.isArray(payload) ? payload : (payload.data || []);
                const set = new Set();
                for (const row of rows) {
                    const g = row?.GARAGEM || row?.Garagem || row?.garagem;
                    if (g && String(g).trim()) set.add(String(g).trim());
                }
                const arr = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
                if (arr.length) return fillOptions(sel, arr);
            }
        } catch (e) {
            console.warn('fallback /api/data falhou', e);
        }

        // 4) Último fallback: endpoint do dataset Power BI
        try {
            const resp = await fetch('/api/garages/dataset');
            if (resp.ok) {
                const arr = await resp.json();
                if (Array.isArray(arr) && arr.length) return fillOptions(sel, arr);
            }
        } catch (e) {
            console.warn('fallback /api/garages/dataset falhou', e);
        }

        sel.innerHTML = '<option disabled>Nenhuma garagem encontrada</option>';
    }

    function fillOptions(select, arr) {
        select.innerHTML = '';
        for (const g of arr) {
            const o = document.createElement('option');
            o.value = g;
            o.textContent = g;
            select.appendChild(o);
        }
        
        // Forçar scroll se for um dos elementos de garagens dos modais
        if (select.id === 'selectGaragensReforco' || select.id === 'selectGaragensVerificacao') {
            select.style.overflowY = 'auto';
            select.style.overflowX = 'hidden';
            select.style.maxHeight = '200px';
        }
    }

    // --- AÇÕES DO MODAL ---
    document.getElementById('btnGerarEmailReforco')?.addEventListener('click', gerarEmailReforcoSinal);
    document.getElementById('btnCopiarAssuntoReforco')?.addEventListener('click', () => {
        const assunto = document.getElementById('assuntoReforcoSinal').value;
        navigator.clipboard.writeText(assunto);
    });
    document.getElementById('btnCopiarCorpoReforco')?.addEventListener('click', () => {
        const html = document.getElementById('previewReforcoSinal').innerHTML;
        copiarComoHtml(html);
    });

    // Utilitário de cópia HTML preservando formatação (fallback simples)
    function copiarComoHtml(html) {
        console.log('copiarComoHtml: chamado. ClipboardItem support?', !!(navigator.clipboard && window.ClipboardItem));
        // First attempt: modern Clipboard API with both HTML and plain text
        if (navigator.clipboard && window.ClipboardItem) {
            try {
                const htmlBlob = new Blob([html], { type: 'text/html' });
                // Attempt to provide a plain-text alternative using the shared converter
                let textPlain = '';
                try { textPlain = converterHtmlParaTexto(html); } catch(e) { textPlain = html.replace(/<[^>]+>/g, ''); }
                const textBlob = new Blob([textPlain], { type: 'text/plain' });
                const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });

                navigator.clipboard.write([item]).then(() => {
                    console.log('copiarComoHtml: ClipboardItem write succeeded');
                    window._lastCopyMethod = 'ClipboardItem';
                    showToast('E-mail copiado com formatação!', 'success');
                }).catch(async (err) => {
                    console.warn('copiarComoHtml: Falha ao escrever ClipboardItem, tentando execCommand fallback:', err);
                    // Try execCommand fallback for cases like Outlook/Word
                    const ok = forceCopyHtmlUsingExecCommand(html);
                    console.log('copiarComoHtml: execCommand fallback result:', ok);
                    window._lastCopyMethod = ok ? 'execCommand' : 'ClipboardItemFailed';
                    if (ok) showToast('E-mail copiado com formatação (fallback)!', 'success');
                    else {
                        try { await navigator.clipboard.writeText(textPlain); console.log('copiarComoHtml: wrote plain text fallback'); showToast('E-mail copiado como texto!', 'success'); window._lastCopyMethod = 'plainText'; } catch(e) { console.warn('copiarComoHtml: plainText fallback failed, writing raw HTML to clipboard', e); try { await navigator.clipboard.writeText(html); window._lastCopyMethod = 'rawHtmlAsText'; showToast('E-mail copiado (falso fallback)', 'warning'); } catch(e2) { console.error('copiarComoHtml: all copy fallbacks failed', e2); window._lastCopyMethod = 'none'; showToast('❌ Erro ao copiar - tente selecionar manualmente', 'error'); }}
                    }
                });
            } catch (err) {
                console.warn('copiarComoHtml: Erro ao preparar ClipboardItem, tentando execCommand fallback:', err);
                const ok = forceCopyHtmlUsingExecCommand(html);
                console.log('copiarComoHtml: execCommand fallback result (prepare error):', ok);
                window._lastCopyMethod = ok ? 'execCommand' : 'prepareFailed';
                if (!ok) {
                    try { navigator.clipboard.writeText(converterHtmlParaTexto(html)); showToast('E-mail copiado como texto!', 'success'); window._lastCopyMethod = 'plainText'; } catch(e) { navigator.clipboard.writeText(html); showToast('E-mail copiado (fallback simples)', 'warning'); window._lastCopyMethod = 'rawHtmlAsText'; }
                } else {
                    showToast('E-mail copiado com formatação (fallback)!', 'success');
                }
            }
        } else {
            console.log('copiarComoHtml: ClipboardItem not available, using execCommand fallback');
            // Older browsers: try execCommand copy of a contenteditable element
            const ok = forceCopyHtmlUsingExecCommand(html);
            console.log('copiarComoHtml: execCommand result (no ClipboardItem):', ok);
            window._lastCopyMethod = ok ? 'execCommand' : 'none';
            if (!ok) {
                try { navigator.clipboard.writeText(converterHtmlParaTexto(html)); showToast('E-mail copiado como texto!', 'success'); window._lastCopyMethod = 'plainText'; } catch(e) { navigator.clipboard.writeText(html); showToast('E-mail copiado (fallback simples)', 'warning'); window._lastCopyMethod = 'rawHtmlAsText'; }
            } else {
                showToast('E-mail copiado com formatação (fallback)!', 'success');
            }
        }
    }

    // Fallback que força cópia de HTML usando um elemento contenteditable e document.execCommand('copy')
    function forceCopyHtmlUsingExecCommand(html) {
        try {
            console.log('forceCopyHtmlUsingExecCommand: attempting execCommand fallback');
            const el = document.createElement('div');
            el.contentEditable = 'true';
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            el.style.top = '0';
            el.style.opacity = '0';
            // Inserir HTML diretamente
            el.innerHTML = html;
            document.body.appendChild(el);

            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const ok = document.execCommand('copy');

            // Cleanup selection and element
            sel.removeAllRanges();
            document.body.removeChild(el);
            console.log('forceCopyHtmlUsingExecCommand result:', ok);
            if (ok) window._lastCopyMethod = 'execCommand';
            return ok;
        } catch (err) {
            console.warn('forceCopyHtmlUsingExecCommand failed:', err);
            return false;
        }
    }

    // note: generating email handled by the grid-driven gerarEmailReforcoSinal defined earlier

    // --- CONSTRUTOR DO HTML DO E-MAIL ---
    function montarEmailReforcoHtml(rows) {
        // Normaliza strings e agrupa por OPERADORA_1
        const grupos = {};
        (rows || []).forEach(r => {
            const oper = (r.OPERADORA_1 || '').toString();
            if (!grupos[oper]) grupos[oper] = [];
            grupos[oper].push({
                Patrimonio: safeTxt(r.Patrimonio),
                IMEI_MODEM_1: safeTxt(r.IMEI_MODEM_1),
                IMEI_CHIP_1: safeTxt(r.IMEI_CHIP_1),
                N_TELEFONE_1: safeTxt(r.N_TELEFONE_1),
                OPERADORA_1: safeTxt(oper)
            });
        });

        const total = (rows || []).length;
        const saud = saudacaoHorario(); // se já tiver uma função sua, reutilize

        // 👇 singular/plural automático
        const frase = total > 1
            ? 'Por gentileza, realizar o reforço de sinal nos CHIPs:'
            : 'Por gentileza, realizar o reforço de sinal no CHIP:';

        let html = `
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color:#212529;">
                <p>${saud}</p><br>
                <p>${frase}</p>
        `;

        Object.keys(grupos).sort().forEach(oper => {
            const tabela = tabelaOperadora(grupos[oper], oper);
            html += `<p style="margin:18px 0 6px 0;"><br><strong>${oper}</strong></p>${tabela}`;
        });

        html += `</div>`;
        return html;
    }

    function saudacaoHorario() {
        const h = new Date().getHours();
        if (h < 12) return 'Bom dia.';
        if (h < 18) return 'Boa tarde.';
        return 'Boa noite.';
    }

    function tabelaOperadora(itens, oper) {
        const thStyle = 'background:#e9ecef;padding:6px 8px;border:1px solid #999;font-weight:700;color:#212529;';
        const tdStyle = 'padding:6px 8px;border:1px solid #ccc;color:#212529;';
        let t = `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse; width:100%; max-width:860px;">`;
        t += `<thead><tr>
            <th style="${thStyle}">Patrimonio</th>
            <th style="${thStyle}">IMEI_MODEM_1</th>
            <th style="${thStyle}">IMEI_CHIP_1</th>
            <th style="${thStyle}">Nº_TELEFONE_1</th>
            <th style="${thStyle}">OPERADORA_1</th>
        </tr></thead><tbody>`;
        itens.forEach(r => {
            t += `<tr>
                <td style="${tdStyle}"><strong>${escapeHtml(r.Patrimonio)}</strong></td>
                <td style="${tdStyle}">${escapeHtml(r.IMEI_MODEM_1)}</td>
                <td style="${tdStyle}">${escapeHtml(r.IMEI_CHIP_1)}</td>
                <td style="${tdStyle}">${escapeHtml(r.N_TELEFONE_1)}</td>
                <td style="${tdStyle}">${escapeHtml(r.OPERADORA_1)}</td>
            </tr>`;
        });
        t += `</tbody></table>`;
        return t;
    }

    function safeTxt(v) {
        if (v === null || v === undefined) return '';
        // força string para preservar zeros à esquerda (telefone/IMEI)
        return String(v);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

function atualizarListaColaboradores() {
    const lista = document.getElementById('collaboratorsList');
    const noMsg = document.getElementById('noCollaboratorsMsg');
    
    if (!lista) return;
    
    if (colaboradores.length === 0) {
        lista.innerHTML = '<div class="text-muted text-center p-3" id="noCollaboratorsMsg">Nenhum colaborador adicionado</div>';
        return;
    }
    
    if (noMsg) noMsg.remove();
    
    let html = '';
    colaboradores.forEach((colab, index) => {
        html += `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom colaborador-item" data-index="${index}">
                <div>
                    <strong>${colab.nome}</strong><br>
                    <small class="text-muted">${colab.telefone} | ${colab.email}</small><br>
                    <small class="text-muted">CPF: ${colab.cpf} | RG: ${colab.rg}</small>
                </div>
                <input type="checkbox" class="form-check-input colaborador-checkbox" data-index="${index}">
            </div>
        `;
    });
    
    lista.innerHTML = html;
}

function removerColaboradorSelecionado() {
    const checkboxes = document.querySelectorAll('.colaborador-checkbox:checked');
    
    if (checkboxes.length === 0) {
        showAlert('Selecione pelo menos um colaborador para remover', 'warning');
        return;
    }
    
    // Obter índices dos selecionados (em ordem decrescente para não afetar os índices)
    const indices = Array.from(checkboxes)
        .map(cb => parseInt(cb.dataset.index))
        .sort((a, b) => b - a);
    
    // Remover da lista
    indices.forEach(index => {
        colaboradores.splice(index, 1);
    });
    
    // Atualizar interface
    atualizarListaColaboradores();
    atualizarPreviewEmail();
    
    showAlert(`${indices.length} colaborador(es) removido(s)`, 'success');
}

function atualizarPreviewEmail() {
    const project = document.getElementById('accessProject')?.value || '';
    const dateStart = document.getElementById('accessDateStart')?.value || '';
    const timeStart = document.getElementById('accessTime')?.value || '';
    
    // Obter garagens selecionadas
    const garageSelect = document.getElementById('accessGarages');
    const garages = garageSelect ? Array.from(garageSelect.selectedOptions).map(opt => opt.value) : [];
    
    // Obter técnicos selecionados
    const visitTechSelect = document.getElementById('visitTechnicians');
    const selectedTechnicians = visitTechSelect ? Array.from(visitTechSelect.selectedOptions).map(opt => {
        const texto = opt.textContent.replace('👨‍🔧 ', '');
        return {
            nome: texto,
            cpf: opt.dataset.cpf || '000.000.000-00'
        };
    }) : [];
    
    const preview = document.getElementById('emailPreview');
    if (!preview) return;
    
    // Se não há dados suficientes, mostrar preview informativo
    if (!project || garages.length === 0 || selectedTechnicians.length === 0 || !dateStart || !timeStart) {
        preview.innerHTML = `<div style="color: #666; font-style: italic;">
            Preencha os campos obrigatórios para visualizar o preview completo:<br><br>
            • Projeto ${project ? '✓' : '✗'}<br>
            • Garagens/Estações/Terminais ${garages.length > 0 ? '✓' : '✗'}<br>
            • Técnicos para visita ${selectedTechnicians.length > 0 ? '✓' : '✗'}<br>
            • Data ${dateStart ? '✓' : '✗'}<br>
            • Horário ${timeStart ? '✓' : '✗'}
        </div>`;
        return;
    }
    
    // Formatação da data para exibição
    const dataInicio = new Date(dateStart + 'T00:00:00');
    const dataBase = dataInicio.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
    });
    
    // Função para obter preposição correta baseada no dia da semana
    function obterPreposicaoData(dataCompleta) {
        const diaSemana = dataCompleta.split(',')[0].toLowerCase().trim();
        
        // Dias femininos usam "na"
        const diasFemininos = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira'];
        
        // Dias masculinos usam "no"  
        const diasMasculinos = ['sábado', 'domingo'];
        
        if (diasFemininos.includes(diaSemana)) {
            return `na ${dataCompleta}`;
        } else if (diasMasculinos.includes(diaSemana)) {
            return `no ${dataCompleta}`;
        } else {
            // Fallback caso não reconheça o dia
            return `no ${dataCompleta}`;
        }
    }
    
    const dataFormatada = obterPreposicaoData(dataBase);
    
    // Nome da primeira garagem para o assunto
    const primeiraGaragem = garages[0] || 'Garagem não especificada';
    const quantGaragens = garages.length;
    
    // Gerar saudação baseada no horário atual
    const now = new Date();
    const hour = now.getHours();
    let saudacao;
    if (hour < 12) {
        saudacao = 'Bom dia!';
    } else if (hour < 18) {
        saudacao = 'Boa tarde!';
    } else {
        saudacao = 'Boa noite!';
    }
    
    // Montar tabela dinâmica (HTML) dos prefixos
    let prefixosHTML = '';
    if (window.currentPrefixosData && window.currentPrefixosData.length > 0) {
        const rowsHTML = window.currentPrefixosData
            .map(p => `<tr><td style="padding:6px 12px;border:1px solid #ccc;color:#222222;">${p.prefixo}</td><td style="padding:6px 12px;border:1px solid #ccc;color:#222222;">${p.status}</td></tr>`)
            .join('');
        prefixosHTML = `<table style="border-collapse:collapse;font-family:Consolas,monospace;font-size:12px;margin-top:8px;max-width:420px;">`
            + `<thead><tr style="background-color:#f0f0f0;"><th style="text-align:left;border:1px solid #ccc;padding:6px 12px;color:#1a1a1a;font-weight:700;">PREFIXO</th><th style="text-align:left;border:1px solid #ccc;padding:6px 12px;color:#1a1a1a;font-weight:700;">STATUS</th></tr></thead>`
            + `<tbody>${rowsHTML}</tbody></table>`;
    } else {
        prefixosHTML = `<p style="font-style:italic;color:#666666;margin:4px 0 8px;">Nenhum prefixo encontrado para o filtro selecionado.</p>`;
    }

    // Gerar tabela de técnicos HTML
    let tecnicosHTML = '';
    if (selectedTechnicians.length > 0) {
        const tecnicosRowsHTML = selectedTechnicians.map(tecnico => 
            `<tr><td style="padding:6px 12px;border:1px solid #ccc;color:#222222;">${tecnico.nome}</td><td style="padding:6px 12px;border:1px solid #ccc;color:#222222;">${tecnico.cpf}</td></tr>`
        ).join('');
        
        tecnicosHTML = `<table style="border-collapse:collapse;margin:8px 0;font-family:Arial,sans-serif;max-width:500px;"><thead><tr style="background-color:#f0f0f0;"><th style="padding:6px 12px;border:1px solid #ccc;text-align:left;color:#1a1a1a;font-weight:700;">NOME</th><th style="padding:6px 12px;border:1px solid #ccc;text-align:left;color:#1a1a1a;font-weight:700;">CPF</th></tr></thead>`
            + `<tbody>${tecnicosRowsHTML}</tbody></table>`;
    } else {
        tecnicosHTML = `<p style="font-style:italic;color:#666666;margin:4px 0 8px;">Nenhum técnico selecionado.</p>`;
    }

    // Gerar conteúdo do email novo (HTML simplificado)
    let emailContent = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#222222;max-width:680px;">
<p style="margin:0 0 28px 0;color:#222222;">Prezado(a), ${saudacao}</p>
<p style="margin:0 0 24px 0;color:#222222;">Solicito acesso à garagem <strong style="color:#1a1a1a;">${primeiraGaragem}</strong>${quantGaragens > 1 ? ` e outras <strong style="color:#1a1a1a;">${quantGaragens - 1}</strong> garagens` : ''} <strong style="color:#1a1a1a;">${dataFormatada}</strong>, a partir das <strong style="color:#1a1a1a;">${timeStart}</strong> horas, para a realização de manutenção preventiva e corretiva dos equipamentos, nos prefixos:</p>
<div style="margin:0 0 28px 0;">${prefixosHTML}</div>
<p style="margin:0 0 16px 0;color:#222222;"><strong style="color:#1a1a1a;">TÉCNICO(S) DESIGNADO(S):</strong></p>
${tecnicosHTML}
<p style="margin:28px 0 0 0;color:#222222;">Atenciosamente,<br><strong style="color:#1a1a1a;">Equipe WifiMaxx</strong></p>
</div>`;

    // Guardar versão HTML para botão "Copiar HTML" caso exista
    window.lastAccessEmailHTML = emailContent;

    // Mostrar diretamente o HTML no preview
    preview.innerHTML = emailContent;
}

// Função para buscar prefixos baseados na seleção
async function buscarPrefixosParaAcesso() {
    const project = document.getElementById('accessProject')?.value || '';
    const garageSelect = document.getElementById('accessGarages');
    const garages = garageSelect ? Array.from(garageSelect.selectedOptions).map(opt => opt.value) : [];
    
    if (!project || garages.length === 0) {
        window.currentPrefixosData = [];
        return;
    }
    
    console.log('🔍 Buscando prefixos para:', { project, garages });
    
    // Usar a mesma lógica do sistema de verificação elétrica
    let base = [];
    if (Array.isArray(window.__GRID_ROWS__) && window.__GRID_ROWS__.length > 0) {
        base = window.__GRID_ROWS__;
    } else if (Array.isArray(equipmentData) && equipmentData.length > 0) {
        base = equipmentData;
    } else if (Array.isArray(currentData) && currentData.length > 0) {
        base = currentData;
    }
    
    if (base.length === 0) {
        console.warn('⚠️ Nenhuma fonte de dados disponível para prefixos');
        window.currentPrefixosData = [];
        return;
    }
    
    const { semComunicacao, emManutencao } = await buildProblemEquipmentsIndex({ projeto: project, garagens: garages });
    console.log('[PREFIXOS][ACESSO] semComunicacao=', semComunicacao.length, 'emManutencao=', emManutencao.length);
    // Para este email de acesso, queremos apenas os sem comunicação (unificando como SEM COMUNICAÇÃO)
    window.currentPrefixosData = semComunicacao.map(x => ({ prefixo: x.prefixo, status: 'SEM COMUNICAÇÃO' }));
    
    // Atualizar preview automaticamente
    atualizarPreviewEmail();
}

// Função genérica para coletar equipamentos problemáticos (reuso hotspot/acesso)
async function buildProblemEquipmentsIndex({ projeto, garagens }) {
    const projNorm = (projeto||'').toLowerCase().trim();
    const garSet = new Set(garagens.map(g=>g.toLowerCase().trim()));
    let base = [];
    if (Array.isArray(window.__GRID_ROWS__) && window.__GRID_ROWS__.length) base = window.__GRID_ROWS__;
    else if (Array.isArray(equipmentData) && equipmentData.length) base = equipmentData;
    else if (Array.isArray(currentData) && currentData.length) base = currentData;
    if (!base.length) return { semComunicacao: [], emManutencao: [] };

    const semComunicacao = [];
    const emManutencao = [];
    for (const r of base) {
        const proj = (r.PROJETO ?? r.Projeto ?? r.projeto ?? '').toString().trim();
        const gar = (r.GARAGEM ?? r.Garagem ?? r.garagem ?? '').toString().trim();
        const statusVal = (r['Monitoramento BI'] ?? r.Status ?? r.MONITORAMENTO_BI ?? r.status ?? r.MONITOR_STATUS ?? r['Status do Monitor'] ?? '').toString().trim();
        const prefixo = (r.PREFIXO ?? r.Prefixo ?? r.PREFIX ?? r.prefixo ?? '').toString().trim();
        if (!prefixo) continue;
        if (projNorm && proj.toLowerCase().trim() !== projNorm) continue;
        if (!garSet.has(gar.toLowerCase().trim())) continue;
        const statusNorm = statusVal.toLowerCase();
        if (statusNorm.includes('atenção') || statusNorm.includes('atencao') || statusNorm.includes('alerta') || statusNorm.includes('inativ') || statusNorm.includes('offline') || statusNorm === 'atenção' || statusNorm === 'alerta' || statusNorm === 'inativo') {
            semComunicacao.push({ prefixo, status: 'Sem comunicação', statusOriginal: statusVal });
        } else if (statusNorm.includes('manutenção') || statusNorm.includes('manutencao') || statusNorm === 'manutenção' || statusNorm === 'em manutenção' || statusNorm.includes('fora de operação')) {
            emManutencao.push({ prefixo, status: 'Em Manutenção', statusOriginal: statusVal });
        }
    }
    semComunicacao.sort((a,b)=>a.prefixo.localeCompare(b.prefixo));
    emManutencao.sort((a,b)=>a.prefixo.localeCompare(b.prefixo));
    return { semComunicacao, emManutencao };
}

// Funções para carregar dados nos selects do modal de acesso - reutilizam índice unificado (REFORCO_IDX)
function fillOptionsAccess(select, arr) {
    select.innerHTML = '';
    for (const v of arr) {
        const o = document.createElement('option');
        o.value = v; 
        o.textContent = v;
        select.appendChild(o);
    }
    
    // Forçar scroll se for elemento de garagens
    if (select.id === 'accessGarages') {
        select.style.overflowY = 'auto';
        select.style.overflowX = 'hidden';
        select.style.maxHeight = '200px';
    }
}


// --- ÍNDICE UNIFICADO PARA PROJETOS/GARAGENS (REFORÇO + ACESSO) ---
function ensureUnifiedProjetoGarageIndex() {
    return (async () => {
        if (window.REFORCO_IDX && window.REFORCO_IDX.projetos?.length) return window.REFORCO_IDX;
        // reutiliza builder existente do reforço
        try {
            const built = await buildProjetoGarageIndexFromData();
            return (window.REFORCO_IDX = built);
        } catch (e) {
            console.warn('[ACCESS] Falha ao construir índice unificado', e);
            return window.REFORCO_IDX || { projetos: [], porProjeto: {}, todos: [] };
        }
    })();
}

async function preencherProjetosAccess() {
    const selProj = document.getElementById('accessProject');
    if (!selProj) { console.error('❌ accessProject não encontrado'); return; }
    selProj.innerHTML = '<option value="">Carregando projetos...</option>';
    console.log('[ACCESS][DBG] Início preencherProjetosAccess');

    try {
        const dashSel = getDashboardProjetoSelect && getDashboardProjetoSelect();
        if (dashSel && dashSel.options?.length) {
            const lista = Array.from(dashSel.options)
                .map(o => normStr(o.value))
                .filter(Boolean)
                .sort((a,b)=>a.localeCompare(b,'pt-BR'));
            fillOptionsAccess(selProj, [''].concat(lista));
            selProj.firstElementChild.textContent = 'Selecione um projeto';
            if (dashSel.value) selProj.value = normStr(dashSel.value);
            console.log(`📎 [ACCESS] Projetos (clone dashboard): ${lista.length}`);
            console.log('[ACCESS][DBG] childElementCount após clone =', selProj.childElementCount);
        } else {
            const idx = await ensureUnifiedProjetoGarageIndex();
            fillOptionsAccess(selProj, [''].concat(idx.projetos));
            selProj.firstElementChild.textContent = 'Selecione um projeto';
            console.log(`🗂️ [ACCESS] Projetos (índice unificado): ${idx.projetos.length}`);
            console.log('[ACCESS][DBG] childElementCount após índice =', selProj.childElementCount);
        }
        if (selProj.childElementCount <= 1) {
            console.warn('[ACCESS][DBG] Nenhum projeto efetivamente inserido no select. Verificar CSS ou sobrescrita posterior.');
        }
    } catch (e) {
        console.error('❌ Erro ao preparar lista de projetos (acesso):', e);
        selProj.innerHTML = '<option value="">Erro ao carregar projetos</option>';
    }
}

async function preencherGaragensPorProjetoAccess() {
    const selProj = document.getElementById('accessProject');
    const selGar = document.getElementById('accessGarages');
    if (!selProj || !selGar) { console.error('❌ accessProject ou accessGarages não encontrados'); return; }

    const projeto = normStr(selProj.value);
    const idx = await ensureUnifiedProjetoGarageIndex();
    const garagens = projeto ? (idx.porProjeto[projeto] || []) : idx.todos;
    fillOptionsAccess(selGar, garagens);
    console.log(`🚗 [ACCESS] Garagens projeto='${projeto || 'TODOS'}': ${garagens.length}`);
}


// === SISTEMA DE ORDENAÇÃO DA TABELA ===

// Sorting state: use global to avoid TDZ issues when handlers call before this section loads
if (!window.currentSort) {
    window.currentSort = { column: null, direction: 'asc' };
}

let sortingSetup = false;

function setupTableSorting() {
    console.log(`🔧 Configurando ordenação (sortingSetup: ${sortingSetup})...`);
    
    // Usar delegação de eventos na tabela para evitar problemas com event listeners perdidos
    const table = document.querySelector('#equipmentTable');
    if (!table) {
        console.warn('⚠️ Tabela não encontrada! Tentando novamente em 1 segundo...');
        setTimeout(setupTableSorting, 1000);
        return;
    }
    
    console.log('✅ Tabela encontrada:', table);
    
    // Verificar se headers existem
    const sortableHeaders = table.querySelectorAll('.sortable');
    console.log(`📊 Headers sortáveis encontrados: ${sortableHeaders.length}`);
    
    sortableHeaders.forEach((header, index) => {
        const column = header.dataset.column;
        console.log(`📋 Header ${index}: ${column} (data-column="${column}")`);
    });
    
    // Remover event listener anterior se existir
    table.removeEventListener('click', handleTableClick);
    
    // Adicionar delegação de eventos
    table.addEventListener('click', handleTableClick);
    
    sortingSetup = true;
    console.log('✅ Configuração de ordenação por delegação concluída');
}

function handleTableClick(event) {
    console.log('🖱️ Clique detectado na tabela:', event.target);
    
    // Verificar se o clique foi em um cabeçalho ordenável
    const clickedElement = event.target.closest('.sortable');
    
    if (!clickedElement) {
        console.log('❌ Clique não foi em elemento sortable');
        return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const column = clickedElement.dataset.column;
    console.log(`👆 CLIQUE DETECTADO via delegação na coluna: ${column}`);
    
    sortTable(column);
}

function sortTable(column) {
    console.log(`🔄 Iniciando ordenação da coluna: ${column}`);
    
    // Verificar se temos dados para ordenar
    if (!filteredData || filteredData.length === 0) {
        console.warn('⚠️ Nenhum dado filtrado disponível para ordenação');
        return;
    }
    
    // Determinar direção da ordenação
    const sortState = window.currentSort || (window.currentSort = { column: null, direction: 'asc' });
    const previousDirection = sortState.direction;
    const previousColumn = sortState.column;
    
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }
    
    console.log(`🔄 Ordenando por ${column}: ${previousColumn}(${previousDirection}) → ${sortState.column}(${sortState.direction})`);
    
    // Atualizar ícones dos headers
    updateSortIcons(column, sortState.direction);
    
    // NOVA ABORDAGEM: Ordenar os dados filtrados em vez da tabela visual
    console.log(`📊 Ordenando todos os dados filtrados (${filteredData.length} registros) em vez de apenas a página atual`);
    
    // Mapear nome da coluna para propriedade do objeto
    const columnPropertyMap = {
        'projeto': 'PROJETO', 
        'patrocinador': 'PATROCINADOR',
        'hotspot': 'Hotspot',
        'patrimonio': 'Patrimonio',
        'prefixo': 'Prefixo',
        'linha': 'Linha',
        'garagem': 'GARAGEM',
        'operadora': 'OPERADORA_1',  // Corrigido: era 'Operadora'
        'status': 'Status',
        'monitoramento_bi': 'Monitoramento BI',  // Corrigido: era 'Monitoramento_BI'
        'keep_alive': 'Keep Alive',  // Nova coluna
        'ultimo_registro': 'Ultimo Registro Válido'  // Corrigido: era 'Ultimo_Registro_Valido'
    };
    
    const property = columnPropertyMap[column];
    if (!property) {
        console.error(`❌ Propriedade para coluna '${column}' não encontrada!`);
        return;
    }
    
    console.log(`📊 Ordenando por propriedade: ${property}`);
    
    // Ordenar os dados filtrados
    filteredData.sort((a, b) => {
        let aValue = a[property] || '';
        let bValue = b[property] || '';
        
        // Converter para string para comparação
        aValue = String(aValue).trim();
        bValue = String(bValue).trim();
        
        // Tratar valores vazios
    if (!aValue && !bValue) return 0;
    if (!aValue) return sortState.direction === 'asc' ? 1 : -1;
    if (!bValue) return sortState.direction === 'asc' ? -1 : 1;
        
        // Detectar se é número
        const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
        
        let result = 0;
        
        // Se ambos são números válidos
        if (!isNaN(aNum) && !isNaN(bNum) && 
            aValue.match(/^[+-]?\d+([.,]\d+)?$/) && bValue.match(/^[+-]?\d+([.,]\d+)?$/)) {
            result = aNum - bNum;
        }
        // Se é data (formato dd/mm/yyyy)
        else if (aValue.match(/^\d{2}\/\d{2}\/\d{4}/) && bValue.match(/^\d{2}\/\d{2}\/\d{4}/)) {
            const aDate = new Date(aValue.split('/').reverse().join('-'));
            const bDate = new Date(bValue.split('/').reverse().join('-'));
            result = aDate.getTime() - bDate.getTime();
        }
        // Ordenação alfabética
        else {
            const normalizedA = aValue.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\w\s]/g, '');
            const normalizedB = bValue.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\w\s]/g, '');
            
            result = normalizedA.localeCompare(normalizedB, 'pt-BR', { 
                numeric: true, 
                ignorePunctuation: true,
                sensitivity: 'base'
            });
        }
        
        return sortState.direction === 'desc' ? -result : result;
    });
    
    console.log(`✅ Dados ordenados! Atualizando tabela...`);
    
    // Recalcular paginação e atualizar tabela
    currentPage = 1; // Voltar para primeira página após ordenação
    updateTable();
    
    // Persist new sort state globally
    window.currentSort = sortState;
    console.log(`✅ Ordenação de ${column} concluída para todos os ${filteredData.length} registros!`);
}

// Expor função sortTable globalmente para onclick
window.sortTable = sortTable;

// Função de debug para testar ordenação
window.debugSort = function(column) {
    console.log(`🧪 DEBUG: Testando ordenação da coluna ${column}`);
    console.log(`📊 Dados filtrados: ${filteredData.length} registros`);
    const sortState = window.currentSort || { column: null, direction: 'asc' };
    console.log(`🔄 Estado atual: ${sortState.column}(${sortState.direction})`);
    
    // Mostrar primeiro registro antes da ordenação
    if (filteredData.length > 0) {
        const property = {
            'projeto': 'PROJETO', 
            'patrocinador': 'PATROCINADOR',
            'hotspot': 'Hotspot',
            'patrimonio': 'Patrimonio',
            'prefixo': 'Prefixo',
            'linha': 'Linha',
            'garagem': 'GARAGEM',
            'operadora': 'OPERADORA_1',  // Corrigido
            'status': 'Status',
            'monitoramento_bi': 'Monitoramento BI',  // Corrigido
            'ultimo_registro': 'Ultimo Registro Válido'  // Corrigido
        }[column];
        
        console.log(`📋 Primeiros 3 valores de ${column} (${property}):`);
        for (let i = 0; i < Math.min(3, filteredData.length); i++) {
            console.log(`  ${i}: "${filteredData[i][property]}"`);
        }
    }
    
    // Executar ordenação
    sortTable(column);
    
    // Mostrar depois da ordenação
    if (filteredData.length > 0) {
        const property = {
            'projeto': 'PROJETO', 
            'patrocinador': 'PATROCINADOR',
            'hotspot': 'Hotspot',
            'patrimonio': 'Patrimonio',
            'prefixo': 'Prefixo',
            'linha': 'Linha',
            'garagem': 'GARAGEM',
            'operadora': 'OPERADORA_1',  // Corrigido
            'status': 'Status',
            'monitoramento_bi': 'Monitoramento BI',  // Corrigido
            'ultimo_registro': 'Ultimo Registro Válido'  // Corrigido
        }[column];
        
        console.log(`📋 Primeiros 3 valores APÓS ordenação:`);
        for (let i = 0; i < Math.min(3, filteredData.length); i++) {
            console.log(`  ${i}: "${filteredData[i][property]}"`);
        }
    }
};

function getColumnIndex(column) {
    const columnMap = {
        'projeto': 0,
        'patrocinador': 1,
        'hotspot': 2,
        'patrimonio': 3,
        'prefixo': 4,
        'linha': 5,
        'garagem': 6,
        'operadora': 7,
        'monitoramento_bi': 8,
        'keep_alive': 9,
        'ultimo_registro': 10
    };
    return columnMap[column] || -1;
}

function updateSortIcons(activeColumn, direction) {
    // Resetar todos os ícones
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'bi bi-arrow-down-up text-muted';
    });
    
    // Atualizar ícone da coluna ativa
    const activeHeader = document.querySelector(`[data-column="${activeColumn}"] i`);
    if (activeHeader) {
        if (direction === 'asc') {
            activeHeader.className = 'bi bi-arrow-up text-primary';
        } else {
            activeHeader.className = 'bi bi-arrow-down text-primary';
        }
    }
}

// Finalização
console.log('✅ Script app_new_clean.js carregado com sucesso');

// ========== SISTEMA DE BUSCA AVANÇADA ==========

function setupAdvancedSearch() {
    console.log('🔍 Configurando sistema de busca universal...');
    
    const searchInput = document.getElementById('searchInput');
    
    // Variável para debounce
    let searchTimeout = null;
    
    if (searchInput) {
        // Mostrar o campo de busca sempre visível
        searchInput.placeholder = 'Digite qualquer coisa para buscar...';
        
        // Event listener para busca em tempo real com debounce
        searchInput.addEventListener('input', function() {
            const value = this.value.trim();
            
            // Limpar timeout anterior
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // Criar novo timeout para evitar muitas chamadas
            searchTimeout = setTimeout(() => {
                currentSearchValue = value;
                console.log(`🔍 Busca universal (debounced): "${currentSearchValue}"`);
                try {
                    applyFilters();
                } catch (error) {
                    console.error('❌ Erro na busca:', error);
                    // Resetar busca em caso de erro
                    currentSearchValue = '';
                    this.value = '';
                    applyFilters();
                }
            }, 300); // Aguardar 300ms após parar de digitar
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                // Limpar timeout se existir
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                currentSearchValue = this.value.trim();
                console.log(`🔍 Busca por Enter: "${currentSearchValue}"`);
                try {
                    applyFilters();
                } catch (error) {
                    console.error('❌ Erro na busca por Enter:', error);
                }
            }
        });
        
        // Esconder o dropdown de filtros já que não é mais necessário
        const dropdown = document.getElementById('searchFilterDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
    
    console.log('✅ Sistema de busca universal configurado');
}

// Função global para teste fácil da busca
window.testSearch = function(term) {
    console.log(`🧪 Testando busca por: "${term}"`);
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        try {
            searchInput.value = term;
            currentSearchValue = term;
            applyFilters();
            console.log(`✅ Busca aplicada com sucesso`);
        } catch (error) {
            console.error('❌ Erro no teste de busca:', error);
            // Reset em caso de erro
            searchInput.value = '';
            currentSearchValue = '';
            applyFilters();
        }
    } else {
        console.error('❌ Campo de busca não encontrado');
    }
};

// Função para testar limpeza de busca
window.testClearSearch = function() {
    console.log('🧪 Testando limpeza de busca...');
    
    // Primeiro fazer uma busca
    window.testSearch('teste');
    
    // Depois limpar
    setTimeout(() => {
        console.log('🧹 Executando clearSearch...');
        window.clearSearch();
        
        // Verificar resultado
        setTimeout(() => {
            const input = document.getElementById('searchInput');
            const isEmpty = !input.value && !currentSearchValue;
            console.log(isEmpty ? '✅ Limpeza funcionou!' : '❌ Limpeza falhou!');
        }, 500);
    }, 1000);
};

// Função para limpar busca em caso de travamento
window.clearSearchEmergency = function() {
    console.log('🚨 Limpeza de emergência da busca...');
    
    try {
        // 1. Limpar variável global - FORÇAR string vazia
        currentSearchValue = '';
        window.currentSearchValue = '';
        
        console.log('🔧 Variável currentSearchValue definida como:', currentSearchValue);
        
        // 2. Limpar campo de input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.disabled = false;
            searchInput.style.pointerEvents = 'auto';
            searchInput.style.opacity = '1';
        }
        
        // 3. Garantir que container está visível
        const searchContainer = document.getElementById('searchInputContainer');
        if (searchContainer) {
            searchContainer.style.display = 'flex';
        }
        
        // 4. Limpar qualquer timeout pendente
        if (window.searchTimeout) {
            clearTimeout(window.searchTimeout);
            window.searchTimeout = null;
        }
        
        // 5. Forçar aplicação de filtros sem busca
        try {
            console.log('🔄 Aplicando filtros na emergência...');
            applyFilters();
            
            // Verificar se os dados foram realmente restaurados
            setTimeout(() => {
                if (window.filteredData && window.equipmentData) {
                    const restoredCount = window.filteredData.length;
                    const originalCount = window.equipmentData.length;
                    console.log(`📊 Dados após limpeza: ${restoredCount}/${originalCount}`);
                    
                    if (restoredCount !== originalCount && !currentSearchValue) {
                        console.warn('⚠️ Dados não foram completamente restaurados, forçando...');
                        window.filteredData = [...window.equipmentData];
                        if (typeof window.updateTable === 'function') {
                            window.updateTable();
                        }
                        if (typeof window.updateCards === 'function') {
                            window.updateCards();
                        }
                    }
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Erro ao aplicar filtros na emergência:', error);
            // Se applyFilters falhar, tentar diretamente
            if (window.equipmentData) {
                window.filteredData = [...window.equipmentData];
                console.log('🔧 Forçando restauração direta dos dados...');
                
                if (typeof window.updateTable === 'function') {
                    window.updateTable();
                }
                if (typeof window.updateCards === 'function') {
                    window.updateCards();
                }
            }
        }
        
        console.log('✅ Limpeza de emergência concluída');
        
    } catch (error) {
        console.error('❌ Falha na limpeza de emergência:', error);
        
        // Último recurso: recarregar página
        console.warn('⚠️ Recarregando página como último recurso...');
        location.reload();
    }
};

function setSearchFilter(filterType) {
    console.log(`🎯 Definindo filtro de busca: ${filterType}`);
    
    currentSearchFilter = filterType;
    currentSearchValue = '';
    
    const dropdownButton = document.getElementById('searchFilterDropdown');
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearch');
    
    // Mapear tipos para labels e ícones
    const filterConfig = {
        'patrimonio': { label: 'Patrimônio', icon: 'bi-tag', placeholder: 'Digite o patrimônio...' },
        'prefixo': { label: 'Prefixo', icon: 'bi-hash', placeholder: 'Digite o prefixo...' },
        'hotspot': { label: 'Serial', icon: 'bi-wifi', placeholder: 'Digite o serial/hotspot...' },
        'empresa': { label: 'Empresa', icon: 'bi-building', placeholder: 'Digite a empresa...' },
        'projeto': { label: 'Projeto', icon: 'bi-folder', placeholder: 'Digite o projeto...' },
        'garagem': { label: 'Garagem', icon: 'bi-geo-alt', placeholder: 'Digite a garagem...' }
    };
    
    const config = filterConfig[filterType];
    if (config) {
        dropdownButton.innerHTML = `<i class="${config.icon} me-1"></i> Buscar por ${config.label}`;
        searchInput.placeholder = config.placeholder;
        searchInput.style.display = 'block';
        clearButton.style.display = 'block';
        searchInput.focus();
    }
    
    console.log(`✅ Filtro configurado para: ${config.label}`);
}

function clearSearchFilter() {
    console.log('🧹 Limpando busca universal...');
    
    currentSearchValue = '';
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reaplicar filtros sem a busca
    applyFilters();
    
    console.log('✅ Busca limpa');
}

function applyAdvancedSearch(data) {
    console.log(`🔍 applyAdvancedSearch chamada`);
    console.log(`📊 Dados recebidos: ${data?.length || 0} registros`);
    console.log(`🎯 currentSearchValue: "${currentSearchValue}"`);
    console.log(`📏 Tamanho currentSearchValue: ${currentSearchValue?.length || 0}`);
    console.log(`🔍 Tipo currentSearchValue: ${typeof currentSearchValue}`);
    console.log(`🔍 currentSearchValue === '': ${currentSearchValue === ''}`);
    console.log(`🔍 !currentSearchValue: ${!currentSearchValue}`);
    
    if (!currentSearchValue || currentSearchValue === '' || currentSearchValue.trim() === '') {
        console.log(`✅ SEM BUSCA ATIVA - retornando ${data?.length || 0} registros ORIGINAIS`);
        console.log(`📈 Dados completos sendo retornados para tabela`);
        return data; // Sem valor de busca
    }
    
    console.log(`🔍 BUSCA ATIVA por: "${currentSearchValue}"`);
    
    try {
        const searchLower = currentSearchValue.toLowerCase().trim();
        
        // Proteção contra busca muito longa que pode travar
        if (searchLower.length > 50) {
            console.warn('⚠️ Busca muito longa, limitando...');
            return data;
        }
        
        const startTime = performance.now();
        
        const filtered = data.filter(item => {
            // Procurar em todos os campos importantes
            const searchableFields = [
                item.Patrimonio,
                item.Prefixo,
                item.Hotspot,
                item.Empresa,
                item.PROJETO,
                item.GARAGEM,
                item.Status,
                item.Linha,
                item.OPERADORA_1,
                item['Monitoramento BI']
            ];
            
            // Verificar se algum campo contém o termo de busca
            return searchableFields.some(field => {
                try {
                    const fieldValue = (field || '').toString().toLowerCase();
                    return fieldValue.includes(searchLower);
                } catch (error) {
                    console.warn('⚠️ Erro ao processar campo:', field, error);
                    return false;
                }
            });
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`🎯 Busca universal completada em ${duration.toFixed(2)}ms: ${filtered.length} de ${data.length} registros`);
        
        // Se a busca demorou muito, alertar
        if (duration > 1000) {
            console.warn('⚠️ Busca demorou mais que 1 segundo, considere otimizar');
        }
        
        return filtered;
        
    } catch (error) {
        console.error('❌ Erro na busca universal:', error);
        // Em caso de erro, retornar dados originais
        return data;
    }
}

// Código removido: funções redundantes que causavam conflito com sortTable()
// - window.testEmpresaSort (função de teste específica para empresa)
// - window.forceEmpresaSort (ordenação específica para empresa que interferia)
// - window.setupEmpresaClickDirect (event listeners duplicados)
// - DOMContentLoaded handlers que adicionavam múltiplos listeners
// 
// Agora a coluna Empresa usa a mesma função sortTable() que todas as outras colunas

// ============================================================================
// VERIFICAÇÃO ELÉTRICA - NOVA FUNCIONALIDADE
// ============================================================================

        // Função para abrir modal de Verificação Elétrica
        async function abrirVerificacaoEletricaModal() {
            await carregarProjetosVerificacao();

            // quando mudar o projeto, atualiza garagens
            const selProj = document.getElementById('selectProjetosVerificacao');
            selProj.onchange = preencherGaragensPorProjetoVerificacao;

            // preenche garagens para o projeto inicialmente selecionado (ou todas)
            preencherGaragensPorProjetoVerificacao();

            const el = document.getElementById('verificacaoEletricaModal');
            const modal = new bootstrap.Modal(el);
            el.addEventListener('shown.bs.modal', () => {
                // Configurar event listeners após o modal estar visível
                configurarEventListenersVerificacao();
                
                // Forçar propriedades de scroll no elemento garagens
                const selectGaragens = document.getElementById('selectGaragensVerificacao');
                if (selectGaragens) {
                    selectGaragens.style.overflowY = 'auto';
                    selectGaragens.style.overflowX = 'hidden';
                    selectGaragens.style.maxHeight = '200px';
                    selectGaragens.focus();
                } else if (selProj) {
                    selProj.focus();
                }
            }, { once: true });
            modal.show();
        }

        // Carregar projetos para Verificação Elétrica
        async function carregarProjetosVerificacao() {
            const sel = document.getElementById('selectProjetosVerificacao');
            sel.innerHTML = '<option value="">Carregando...</option>';

            try {
                console.log('🔍 DEBUG: Verificando dados para projetos...');
                console.log('🔍 window.__GRID_ROWS__:', window.__GRID_ROWS__);
                console.log('🔍 equipmentData:', equipmentData);
                console.log('🔍 currentData:', currentData);
                
                // Tentar múltiplas fontes de dados
                let base = [];
                if (Array.isArray(window.__GRID_ROWS__) && window.__GRID_ROWS__.length > 0) {
                    base = window.__GRID_ROWS__;
                    console.log('✅ Usando window.__GRID_ROWS__:', base.length, 'registros');
                } else if (Array.isArray(equipmentData) && equipmentData.length > 0) {
                    base = equipmentData;
                    console.log('✅ Usando equipmentData:', base.length, 'registros');
                } else if (Array.isArray(currentData) && currentData.length > 0) {
                    base = currentData;
                    console.log('✅ Usando currentData:', base.length, 'registros');
                } else {
                    console.warn('❌ Nenhuma fonte de dados disponível');
                }
                
                if (base.length > 0) {
                    console.log('📊 Exemplo de registro:', base[0]);
                    console.log('📊 Chaves disponíveis:', Object.keys(base[0] || {}));
                }
                
                const projetos = [...new Set(base.map(r => 
                    (r.PROJETO ?? r.Projeto ?? "").toString().trim()
                ).filter(Boolean))].sort();

                console.log('📋 Projetos encontrados:', projetos);

                sel.innerHTML = '<option value="">Selecione um projeto</option>';
                projetos.forEach(proj => {
                    const opt = document.createElement('option');
                    opt.value = proj;
                    opt.textContent = proj;
                    sel.appendChild(opt);
                });
                
                console.log('✅ Projetos carregados no select:', projetos.length);
            } catch (e) {
                console.error('❌ Erro ao carregar projetos:', e);
                sel.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        }

        // Preencher garagens por projeto para Verificação Elétrica
        function preencherGaragensPorProjetoVerificacao() {
            const selProj = document.getElementById('selectProjetosVerificacao');
            const selGar = document.getElementById('selectGaragensVerificacao');
            const projetoSelecionado = selProj.value;

            console.log('🏢 Preenchendo garagens para projeto:', projetoSelecionado);

            // Tentar múltiplas fontes de dados
            let base = [];
            if (Array.isArray(window.__GRID_ROWS__) && window.__GRID_ROWS__.length > 0) {
                base = window.__GRID_ROWS__;
            } else if (Array.isArray(equipmentData) && equipmentData.length > 0) {
                base = equipmentData;
            } else if (Array.isArray(currentData) && currentData.length > 0) {
                base = currentData;
            }

            console.log('📊 Base de dados para garagens:', base.length, 'registros');

            const garagensFiltradas = [...new Set(base
                .filter(r => !projetoSelecionado || 
                    (r.PROJETO ?? r.Projeto ?? "").toString().trim() === projetoSelecionado)
                .map(r => (r.GARAGEM ?? r.Garagem ?? "").toString().trim())
                .filter(Boolean)
            )].sort();

            console.log('🏢 Garagens filtradas:', garagensFiltradas);

            selGar.innerHTML = '';
            garagensFiltradas.forEach(gar => {
                const opt = document.createElement('option');
                opt.value = gar;
                opt.textContent = gar;
                selGar.appendChild(opt);
            });
            
            console.log('✅ Garagens adicionadas ao select:', garagensFiltradas.length);
        }

        // Gerar email de Verificação Elétrica
        async function gerarEmailVerificacaoEletrica() {
            console.log('🚀 INICIANDO gerarEmailVerificacaoEletrica');
            
            const status = document.getElementById('statusVerificacaoEletrica');
            const selGar = document.getElementById('selectGaragensVerificacao');
            const selProj = document.getElementById('selectProjetosVerificacao');

            console.log('🔍 Elementos encontrados:', {
                status: !!status,
                selGar: !!selGar,
                selProj: !!selProj
            });

            if (!selGar) {
                console.error('❌ Elemento selectGaragensVerificacao não encontrado');
                return;
            }

            const garagens = Array.from(selGar.selectedOptions).map(o => o.value.trim());
            const projeto = (selProj.value || "").toString().trim();

            console.log('📋 Seleção atual:', { projeto, garagens });

            if (!garagens.length) {
                const msg = 'Selecione ao menos uma garagem.';
                console.warn('⚠️', msg);
                if (status) status.textContent = msg;
                return;
            }

            console.log('🔍 DEBUG: Parâmetros de filtro:');
            console.log('   - Projeto selecionado:', projeto);
            console.log('   - Garagens selecionadas:', garagens);

            // Filtrar dados do grid já carregado - Tentar múltiplas fontes
            let base = [];
            if (Array.isArray(window.__GRID_ROWS__) && window.__GRID_ROWS__.length > 0) {
                base = window.__GRID_ROWS__;
                console.log('✅ Usando window.__GRID_ROWS__:', base.length, 'registros');
            } else if (Array.isArray(equipmentData) && equipmentData.length > 0) {
                base = equipmentData;
                console.log('✅ Usando equipmentData:', base.length, 'registros');
            } else if (Array.isArray(currentData) && currentData.length > 0) {
                base = currentData;
                console.log('✅ Usando currentData:', base.length, 'registros');
            } else {
                console.error('❌ Nenhuma fonte de dados disponível');
                status.textContent = 'Erro: Dados não disponíveis';
                return;
            }

            console.log('🔍 DEBUG: Exemplo de registro:', base[0]);
            console.log('🔍 DEBUG: Chaves disponíveis:', Object.keys(base[0] || {}));

            const garSet = new Set(garagens.map(g => g.toLowerCase().trim()));
            const projNorm = projeto.toLowerCase().trim();

            // Buscar equipamentos sem comunicação e em manutenção
            const semComunicacao = [];
            const emManutencao = [];
            const statusUnicos = new Set(); // Para debug
            const projetosEncontrados = new Set();
            const garagensEncontradas = new Set();
            const registrosFiltrados = [];

            for (const r of base) {
                const proj = (r.PROJETO ?? r.Projeto ?? r.projeto ?? "").toString().trim();
                const gar = (r.GARAGEM ?? r.Garagem ?? r.garagem ?? "").toString().trim();
                
                // Tentar diferentes campos de status
                const statusVal = (
                    r["Monitoramento BI"] ?? 
                    r.Status ?? 
                    r.MONITORAMENTO_BI ?? 
                    r.status ??
                    r.MONITOR_STATUS ??
                    r["Status do Monitor"] ??
                    ""
                ).toString().trim();
                
                const prefixo = (r.PREFIXO ?? r.Prefixo ?? r.PREFIX ?? r.prefixo ?? "").toString().trim();

                // Debug: coletar informações
                if (statusVal) statusUnicos.add(statusVal);
                if (proj) projetosEncontrados.add(proj);
                if (gar) garagensEncontradas.add(gar);

                // Verificar se o registro corresponde aos filtros
                const projetoMatch = !projeto || proj.toLowerCase().trim() === projNorm;
                const garagemMatch = garSet.has(gar.toLowerCase().trim());

                if (projetoMatch && garagemMatch && prefixo) {
                    registrosFiltrados.push({
                        prefixo,
                        projeto: proj,
                        garagem: gar,
                        status: statusVal,
                        registro: r
                    });
                }
            }

            console.log('🔍 DEBUG: Análise dos dados:');
            console.log('   - Projetos encontrados:', Array.from(projetosEncontrados));
            console.log('   - Garagens encontradas:', Array.from(garagensEncontradas)); 
            console.log('   - Status únicos encontrados:', Array.from(statusUnicos));
            console.log('   - Registros filtrados:', registrosFiltrados.length);
            console.log('   - Primeiros 3 registros filtrados:', registrosFiltrados.slice(0, 3));

            // Classificar por status
            for (const item of registrosFiltrados) {
                const statusNorm = item.status.toLowerCase().trim();
                
                console.log(`🔍 Analisando ${item.prefixo} - Status: "${item.status}" (normalizado: "${statusNorm}")`);
                
                // Status sem comunicação (mais abrangente)
                if (statusNorm.includes('atenção') || statusNorm.includes('atencao') || 
                    statusNorm.includes('alerta') || 
                    statusNorm.includes('inativ') ||
                    statusNorm.includes('offline') ||
                    statusNorm === 'atenção' || statusNorm === 'alerta' || statusNorm === 'inativo') {
                    
                    semComunicacao.push({ 
                        prefixo: item.prefixo, 
                        status: "Sem comunicação",
                        statusOriginal: item.status
                    });
                    console.log(`   ✅ Adicionado à lista "sem comunicação"`);
                }
                // Status em manutenção
                else if (statusNorm.includes('manutenção') || statusNorm.includes('manutencao') ||
                         statusNorm.includes('manutenção') || statusNorm === 'manutenção' ||
                         statusNorm === 'em manutenção' || statusNorm.includes('fora de operação')) {
                    
                    emManutencao.push({ 
                        prefixo: item.prefixo, 
                        status: "Em Manutenção",
                        statusOriginal: item.status
                    });
                    console.log(`   ✅ Adicionado à lista "em manutenção"`);
                } else {
                    console.log(`   ⚪ Status "${item.status}" não reconhecido como problema`);
                }
            }

            console.log('� RESULTADO FINAL:');
            console.log('   - Sem comunicação:', semComunicacao.length, semComunicacao);
            console.log('   - Em manutenção:', emManutencao.length, emManutencao);

            // Ordenar por prefixo em ordem crescente
            semComunicacao.sort((a, b) => {
                const prefixoA = a.prefixo.toString().toUpperCase();
                const prefixoB = b.prefixo.toString().toUpperCase();
                return prefixoA.localeCompare(prefixoB);
            });

            emManutencao.sort((a, b) => {
                const prefixoA = a.prefixo.toString().toUpperCase();
                const prefixoB = b.prefixo.toString().toUpperCase();
                return prefixoA.localeCompare(prefixoB);
            });

            // Gerar conteúdo do email
            const totalSemComunicacao = semComunicacao.length;
            const horario = new Date().getHours() < 12 ? "Bom dia" : 
                          new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";

            const assunto = `Verificação de Hotspots sem Comunicação e em Manutenção — ${garagens.join(', ')}`;
            document.getElementById('assuntoVerificacaoEletrica').value = assunto;

            const emailContent = montarEmailVerificacaoEletrica({
                horario,
                totalSemComunicacao,
                semComunicacao,
                emManutencao,
                garagens
            });

            // Save last generated verification to allow structured copy (HTML + plain text)
            try {
                window._lastGeneratedVerificacao = {
                    html: emailContent,
                    horario,
                    totalSemComunicacao,
                    semComunicacao: semComunicacao.slice(),
                    emManutencao: emManutencao.slice(),
                    garagens: garagens.slice()
                };
            } catch (e) {
                console.warn('Não foi possível guardar última verificação:', e);
            }

            const previewPane = document.getElementById('previewVerificacaoEletrica');
            if (previewPane) {
                previewPane.innerHTML = emailContent;
                console.log('✅ Preview de verificação atualizado.');
            }
            if (status) {
                status.textContent = `E-mail gerado: ${totalSemComunicacao} sem comunicação, ${emManutencao.length} em manutenção.`;
            }
        }

        // Montar HTML do email de Verificação Elétrica
                function montarEmailVerificacaoEletrica({ horario, totalSemComunicacao, semComunicacao, emManutencao, garagens }) {
                        // Use a plain div wrapper (no outer table) so only equipment sections render as tables
                        let html = `
                                <div style="max-width:680px; margin:0; font-family: Arial, Helvetica, sans-serif; color:#222222; line-height:1.8; font-size:13px; background:#ffffff;">
                                    <p style="margin:0 0 28px 0; color:#222222;"><strong style="color:#1a1a1a;">${horario},</strong></p>
                        `;

                        // Só mostrar texto introdutório se houver equipamentos sem comunicação
                        if (totalSemComunicacao > 0) {
                            html += `<p style="margin:0 0 24px 0; color:#222222;">Identificamos <strong style="color:#1a1a1a;">${totalSemComunicacao} hotspots</strong> sem comunicação com nossa base. Solicitamos, por gentileza, que verifiquem a parte elétrica desses equipamentos e nos encaminhem uma foto comprovando que os dispositivos estão ligados.</p>`;
                        } else {
                                html += `<p style="margin:0 0 24px 0; color:#222222;">Verificação de Hotspots sem Comunicação e em Manutenção</p>`;
                        }

                        // Tabela de equipamentos sem comunicação
                        if (semComunicacao.length > 0) {
                                html += `
                                        <p style="color:#c0392b; margin:28px 0 16px 0; font-size:14px; font-weight:700;">Hotspots sem comunicação:</p>
                                        <div style="margin:6px 0 32px 0;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; max-width:420px; font-size:13px; background:#ffffff;">
                                                <thead>
                                                    <tr style="background-color:#f0f0f0;">
                                                        <th style="border:1px solid #ccc; padding:8px 14px; text-align:left; font-weight:700; color:#1a1a1a;">PREFIXO</th>
                                                        <th style="border:1px solid #ccc; padding:8px 14px; text-align:left; font-weight:700; color:#1a1a1a;">STATUS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                `;

                                semComunicacao.forEach(item => {
                                        html += `
                                                <tr style="background:#ffffff;">
                                                    <td style="border:1px solid #ccc; padding:8px 14px; font-family:Consolas,monospace; color:#222222;">${item.prefixo}</td>
                                                    <td style="border:1px solid #ccc; padding:8px 14px; color:#c0392b; font-weight:600;">${item.status}</td>
                                                </tr>
                                        `;
                                });

                                html += `
                                                </tbody>
                                            </table>
                                        </div>
                                `;
                        }

                        // Tabela de equipamentos em manutenção (só mostra se houver equipamentos)
                        if (emManutencao.length > 0) {
                        html += `
                                        <p style="margin:28px 0 16px 0; color:#222222;">Favor confirmar também se os seguintes prefixos permanecem em manutenção:</p>
                                        <div style="margin:6px 0 32px 0;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; max-width:420px; font-size:13px; background:#ffffff;">
                                                <thead>
                                                    <tr style="background-color:#f0f0f0;">
                                                                    <th style="border:1px solid #ccc; padding:8px 14px; text-align:left; font-weight:700; color:#1a1a1a;">PREFIXO</th>
                                                                    <th style="border:1px solid #ccc; padding:8px 14px; text-align:left; font-weight:700; color:#1a1a1a;">STATUS</th>
                                                                </tr>
                                                </thead>
                                                <tbody>
                                `;

                                emManutencao.forEach(item => {
                                        html += `
                                                <tr style="background:#ffffff;">
                                                    <td style="border:1px solid #ccc; padding:8px 14px; font-family:Consolas,monospace; color:#222222;">${item.prefixo}</td>
                                                    <td style="border:1px solid #ccc; padding:8px 14px; color:#b58100; font-weight:600;">${item.status}</td>
                                                </tr>
                                        `;
                                });

                                html += `
                                                </tbody>
                                            </table>
                                        </div>
                                `;
                        }

                        html += `
                                    <p style="margin:28px 0 0 0; color:#222222;">Atenciosamente,<br><strong style="color:#1a1a1a;">Equipe WifiMaxx</strong></p>
                                </div>
                        `;
                        return html;
                }

        // Event listeners para Verificação Elétrica - configurar quando modal abrir
        function configurarEventListenersVerificacao() {
            console.log('🔧 Configurando event listeners da verificação...');
            
            const btnGerar = document.getElementById('btnGerarEmailVerificacao');
            if (btnGerar) {
                console.log('✅ Botão de gerar verificação encontrado!');
                
                // Remover listeners antigos para evitar duplicação
                btnGerar.replaceWith(btnGerar.cloneNode(true));
                const newBtnGerar = document.getElementById('btnGerarEmailVerificacao');
                
                newBtnGerar.addEventListener('click', function() {
                    console.log('🔥 Botão Gerar Verificação clicado!');
                    gerarEmailVerificacaoEletrica();
                });
                
                console.log('✅ Event listener adicionado com sucesso!');
            } else {
                console.error('❌ Botão btnGerarEmailVerificacao não encontrado!');
            }

            // Botões de copiar
            const btnCopiarAssunto = document.getElementById('btnCopiarAssuntoVerificacao');
            const btnCopiarCorpo = document.getElementById('btnCopiarCorpoVerificacao');

            if (btnCopiarAssunto) {
                btnCopiarAssunto.addEventListener('click', () => {
                    const assunto = document.getElementById('assuntoVerificacaoEletrica').value;
                    navigator.clipboard.writeText(assunto).then(() => {
                        showToast('Assunto copiado!', 'success');
                    });
                });
            }

            if (btnCopiarCorpo) {
                // HIDE the old button immediately (we'll use the new execCommand-based one)
                btnCopiarCorpo.style.display = 'none';
                
                // Add the new primary button with execCommand
                try {
                    if (!document.getElementById('btnCopiarCorpoVerificacaoNovo')) {
                        const newBtn = document.createElement('button');
                        newBtn.id = 'btnCopiarCorpoVerificacaoNovo';
                        newBtn.type = 'button';
                        newBtn.className = 'btn btn-outline-warning rounded-pill shadow-sm';
                        newBtn.innerHTML = '<i class="bi bi-clipboard-check me-1"></i>Copiar E-Mail';
                        
                        // Insert the new button where the old one was
                        btnCopiarCorpo.parentNode.replaceChild(newBtn, btnCopiarCorpo);

                        newBtn.addEventListener('click', (ev) => {
                            // prevent the delegated document click handler from running as well
                            try { ev.stopPropagation(); } catch (e) { /* ignore */ }
                            console.log('btnCopiarCorpoVerificacaoNovo clicked - using execCommand');
                            const last = window._lastGeneratedVerificacao;
                            const html = last?.html || document.getElementById('previewVerificacaoEletrica')?.innerHTML || '';
                            const ok = forceCopyHtmlUsingExecCommand(html);
                            console.log('btnCopiarCorpoVerificacaoNovo result:', ok, 'window._lastCopyMethod=', window._lastCopyMethod);
                            if (ok) showToast('E-mail copiado com sucesso!', 'success');
                            else showToast('Erro ao copiar E-mail', 'warning');
                        });
                    }
                } catch (e) {
                    console.warn('Erro ao criar novo botão Copiar E-Mail:', e);
                }
            }
        }

        // Delegated fallback: garante captura do clique mesmo se listener direto falhar
        document.addEventListener('click', (ev) => {
            const t = ev.target;
            if (!t) return;
            // Match direto ou via ancestral botão
            const btn = t.id === 'btnGerarEmailVerificacao' ? t : t.closest && t.closest('#btnGerarEmailVerificacao');
            if (btn) {
                console.log('🟢 Delegated: clique no Gerar Verificação');
                try { gerarEmailVerificacaoEletrica(); } catch (e) { console.error('Erro ao gerar verificação:', e); }
            }

            // Updated to use new button ID
            const btnCopiar = t.id === 'btnCopiarCorpoVerificacaoNovo' ? t : t.closest && t.closest('#btnCopiarCorpoVerificacaoNovo');
            if (btnCopiar) {
                console.log('🟢 Delegated: clique em Copiar E-Mail');
                try {
                    const last = window._lastGeneratedVerificacao;
                    const html = last?.html || document.getElementById('previewVerificacaoEletrica')?.innerHTML || '';
                    const ok = forceCopyHtmlUsingExecCommand(html);
                    if (ok) {
                        showToast('E-mail copiado com sucesso!', 'success');
                    } else {
                        showToast('Erro ao copiar E-mail', 'warning');
                    }
                } catch (e) {
                    console.error('Erro ao copiar relatório:', e);
                    showToast('Erro ao copiar relatório', 'error');
                }
            }
        });

        // Tornar função global
        window.abrirVerificacaoEletricaModal = abrirVerificacaoEletricaModal;

        // Função para copiar email com formatação adequada
        function copiarEmailComoHtml(htmlContent) {
            // Reutiliza o utilitário comum que já tenta ClipboardItem + execCommand fallback
            try {
                copiarComoHtml(htmlContent);
            } catch (error) {
                console.error('Erro ao copiar via copiarComoHtml:', error);
                copiarComoTextoLimpo(htmlContent);
            }
        }

        // Função fallback para copiar como texto limpo
        function copiarComoTextoLimpo(htmlContent) {
            const textoLimpo = converterHtmlParaTexto(htmlContent);
            navigator.clipboard.writeText(textoLimpo).then(() => {
                showToast('E-mail copiado como texto!', 'success');
            }).catch(() => {
                showToast('Erro ao copiar e-mail', 'error');
            });
        }

        // Converter HTML para texto limpo mantendo a estrutura
        function converterHtmlParaTexto(html) {
            // Criar um elemento temporário para processar o HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Substituir elementos HTML por equivalentes em texto
            tempDiv.querySelectorAll('h3').forEach(h3 => {
                h3.outerHTML = '\n\n' + h3.textContent + '\n' + '='.repeat(h3.textContent.length) + '\n\n';
            });
            
            tempDiv.querySelectorAll('p').forEach(p => {
                p.outerHTML = p.textContent + '\n\n\n';
            });
            
            tempDiv.querySelectorAll('table').forEach(table => {
                let tableText = '\n';
                const rows = table.querySelectorAll('tr');
                
                rows.forEach((row, index) => {
                    const cells = row.querySelectorAll('th, td');
                    const rowText = Array.from(cells).map(cell => cell.textContent.trim()).join('\t');
                    tableText += rowText + '\n';
                    
                    // Adicionar linha separadora após o cabeçalho
                    if (index === 0 && row.querySelectorAll('th').length > 0) {
                        tableText += '-'.repeat(50) + '\n';
                    }
                });
                
                table.outerHTML = tableText + '\n';
            });
            
            // Obter texto final e limpar espaços extras
            let textoFinal = tempDiv.textContent || tempDiv.innerText || '';
            
            // Limpar múltiplas quebras de linha excessivas (mais de 3)
            textoFinal = textoFinal.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n\n');
            textoFinal = textoFinal.trim();
            
            return textoFinal;
        }

        // Tornar função global para uso em outros lugares
        window.copiarEmailComoHtml = copiarEmailComoHtml;

// ============================================================================
// FUNÇÕES PARA O MENU GERENCIAR - ALIASES PARA COMPATIBILIDADE
// ============================================================================

/**
 * Função chamada pelo menu "Gerenciar > Adicionar Garagem"
 * Alias para adicionarEndereco()
 */
function showAddGaragem() {
    console.log('🏢 Menu Gerenciar > Adicionar Garagem clicado');
    adicionarEndereco();
}

// Copiar e-mail de verificação usando dados estruturados (HTML + texto bem formatado)
function copiarEmailVerificacaoEstruturado(last) {
    try {
        // Prefer the last generated HTML payload; fallback to preview pane
        const htmlContent = (last && last.html) ? last.html : (document.getElementById('previewVerificacaoEletrica')?.innerHTML || '');

        // Use the existing copier that includes both HTML and a cleaned plain-text alternative
        // copiarEmailComoHtml already prepares both 'text/html' and 'text/plain' using converterHtmlParaTexto
        copiarEmailComoHtml(htmlContent);
    } catch (err) {
        console.error('Erro copiarEmailVerificacaoEstruturado:', err);
        showToast('Erro ao copiar e-mail', 'error');
    }
}

/**
 * Função chamada pelo menu "Gerenciar > Adicionar Técnico"
 * Alias para adicionarTecnico()
 */
function showAddTecnico() {
    console.log('👨‍🔧 Menu Gerenciar > Adicionar Técnico clicado');
    adicionarTecnico();
}

/**
 * Função chamada pelo menu "Admin > Editar Garagens"
 * Mostra modal para edição/remoção de garagem com lista de garagens cadastradas
 */
function showEditGaragens() {
    console.log('🔧 Menu Admin > Editar Garagens clicado');
    
    // Abrir modal de edição de garagens
    const modal = new bootstrap.Modal(document.getElementById('removeGarageModal'));
    modal.show();
    
    // Carregar lista de garagens
    loadGaragensForRemoval();
}

// Alias para compatibilidade
function showRemoveGaragem() {
    showEditGaragens();
}

/**
 * Função chamada pelo menu "Admin > Editar Técnicos"
 * Mostra modal para edição/remoção de técnico com lista de técnicos cadastrados
 */
function showEditTecnicos() {
    console.log('🔧 Menu Admin > Editar Técnicos clicado');
    
    // Abrir modal de edição de técnicos
    const modal = new bootstrap.Modal(document.getElementById('removeTechnicianModal'));
    modal.show();
    
    // Carregar lista de técnicos
    loadTecnicosForRemoval();
}

// Alias para compatibilidade
function showRemoveTecnico() {
    showEditTecnicos();
}

/**
 * Carrega lista de garagens para remoção
 */
async function loadGaragensForRemoval() {
    try {
        console.log('🔄 Carregando garagens para remoção...');
        const response = await fetch('/api/garagens');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const garagens = await response.json();
        const container = document.getElementById('garagesList');
        
        if (!container) {
            console.error('❌ Container garagesList não encontrado');
            return;
        }

        if (!Array.isArray(garagens) || garagens.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-building text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2 mb-0">Nenhuma garagem cadastrada</p>
                </div>
            `;
            return;
        }

        // Criar cards para cada garagem
        const garagensHtml = garagens.map(garagem => `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm h-100" style="border-radius: 10px;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="card-title fw-bold text-primary mb-2">
                                    <i class="bi bi-building me-2"></i>
                                    ${garagem.nome || 'Nome não informado'}
                                </h6>
                                <p class="card-text text-muted small mb-2">
                                    <i class="bi bi-geo-alt me-1"></i>
                                    ${garagem.endereco || 'Endereço não informado'}
                                </p>
                                <div class="d-flex flex-column gap-1 text-muted small">
                                    ${garagem.responsavel ? `<span><i class="bi bi-person me-1"></i>${garagem.responsavel}</span>` : ''}
                                    ${garagem.telefone ? `<span><i class="bi bi-telephone me-1"></i>${garagem.telefone}</span>` : ''}
                                    ${garagem.email ? `<span><i class="bi bi-envelope me-1"></i>${garagem.email}</span>` : ''}
                                </div>
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-outline-primary btn-sm" 
                                        onclick="editGaragem(${garagem.id}, '${(garagem.nome || '').replace(/'/g, '\\\'')}', '${(garagem.endereco || '').replace(/'/g, '\\\'')}', '${(garagem.responsavel || '').replace(/'/g, '\\\'')}', '${(garagem.telefone || '').replace(/'/g, '\\\'')}', '${(garagem.email || '').replace(/'/g, '\\\'')}')"
                                        title="Editar garagem">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-outline-danger btn-sm" 
                                        onclick="confirmDeleteGaragem(${garagem.id}, '${(garagem.nome || '').replace(/'/g, '\\\'')}')"
                                        title="Remover garagem">
                                    <i class="bi bi-trash3"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = garagensHtml;
        console.log(`✅ ${garagens.length} garagens carregadas`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar garagens:', error);
        const container = document.getElementById('garagesList');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2 mb-0">Erro ao carregar garagens: ${error.message}</p>
                    <button class="btn btn-outline-primary btn-sm mt-2" onclick="loadGaragensForRemoval()">
                        <i class="bi bi-arrow-clockwise me-1"></i>
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Carrega lista de técnicos para remoção
 */
async function loadTecnicosForRemoval() {
    try {
        console.log('� Carregando técnicos para remoção...');
        const response = await fetch('/api/tecnicos');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const tecnicos = await response.json();
        const container = document.getElementById('techniciansList');
        
        if (!container) {
            console.error('❌ Container techniciansList não encontrado');
            return;
        }

        if (!Array.isArray(tecnicos) || tecnicos.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-person text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2 mb-0">Nenhum técnico cadastrado</p>
                </div>
            `;
            return;
        }

        // Criar cards para cada técnico
        const tecnicosHtml = tecnicos.map(tecnico => `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm h-100" style="border-radius: 10px;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="card-title fw-bold text-primary mb-2">
                                    <i class="bi bi-person me-2"></i>
                                    ${tecnico.nome || 'Nome não informado'}
                                </h6>
                                <div class="d-flex flex-column gap-1 text-muted small">
                                    ${tecnico.empresa ? `<span><i class="bi bi-building me-1"></i>Empresa: ${tecnico.empresa}</span>` : ''}
                                    ${tecnico.escritorio ? `<span><i class="bi bi-geo-alt me-1"></i>Escritório: ${tecnico.escritorio}</span>` : ''}
                                    ${tecnico.cpf ? `<span><i class="bi bi-card-text me-1"></i>CPF: ${tecnico.cpf}</span>` : ''}
                                    ${tecnico.email ? `<span><i class="bi bi-envelope me-1"></i>${tecnico.email}</span>` : ''}
                                    ${tecnico.telefone ? `<span><i class="bi bi-telephone me-1"></i>${tecnico.telefone}</span>` : ''}
                                    ${tecnico.rg ? `<span><i class="bi bi-card-checklist me-1"></i>RG: ${tecnico.rg}</span>` : ''}
                                </div>
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-outline-primary btn-sm" 
                                        onclick="editTecnico(${tecnico.id}, '${(tecnico.nome || '').replace(/'/g, '\\\'')}', '${(tecnico.cpf || '').replace(/'/g, '\\\'')}', '${(tecnico.rg || '').replace(/'/g, '\\\'')}', '${(tecnico.email || '').replace(/'/g, '\\\'')}', '${(tecnico.telefone || '').replace(/'/g, '\\\'')}', '${(tecnico.empresa || '').replace(/'/g, '\\\'')}', '${(tecnico.escritorio || '').replace(/'/g, '\\\'')}')"
                                        title="Editar técnico">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-outline-danger btn-sm" 
                                        onclick="confirmDeleteTecnico(${tecnico.id}, '${(tecnico.nome || '').replace(/'/g, '\\\'')}')"
                                        title="Remover técnico">
                                    <i class="bi bi-trash3"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = tecnicosHtml;
        console.log(`✅ ${tecnicos.length} técnicos carregados`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar técnicos:', error);
        const container = document.getElementById('techniciansList');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-2 mb-0">Erro ao carregar técnicos: ${error.message}</p>
                    <button class="btn btn-outline-primary btn-sm mt-2" onclick="loadTecnicosForRemoval()">
                        <i class="bi bi-arrow-clockwise me-1"></i>
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Confirma remoção de garagem
 */
async function confirmDeleteGaragem(garagemId, garagemNome) {
    if (!garagemId) {
        console.error('❌ ID da garagem não fornecido');
        return;
    }

    const confirmMessage = `Tem certeza que deseja remover a garagem "${garagemNome}"?\n\nEsta ação não pode ser desfeita!`;
    
    if (confirm(confirmMessage)) {
        try {
            console.log(`🗑️ Removendo garagem ID: ${garagemId}`);
            
            const response = await fetch(`/api/garagens/${garagemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('✅ Garagem removida com sucesso');
                showToast(`Garagem "${garagemNome}" removida com sucesso!`, 'success');
                
                // Recarregar lista de garagens
                loadGaragensForRemoval();
                
                // Invalidar cache se existir
                if (window.invalidate_garagens_cache) {
                    window.invalidate_garagens_cache();
                }
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
                throw new Error(errorData.detail || `Erro HTTP: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao remover garagem:', error);
            showToast(`Erro ao remover garagem: ${error.message}`, 'error');
        }
    }
}

/**
 * Edita uma garagem - abre modal de edição
 */
function editGaragem(id, nome, endereco, responsavel, telefone, email) {
    console.log(`✏️ Editando garagem ID: ${id}`);
    
    // Criar modal de edição dinamicamente
    const modalHtml = `
        <div class="modal fade" id="editGaragemModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 15px;">
                    <div class="modal-header bg-primary text-white" style="border-radius: 15px 15px 0 0;">
                        <h5 class="modal-title fw-bold">
                            <i class="bi bi-building-gear me-2"></i>Editar Garagem
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="formEditGaragem">
                            <input type="hidden" id="editGaragemId" value="${id}">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Nome da Garagem</label>
                                <input type="text" class="form-control" id="editGaragemNome" value="${nome}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Endereço</label>
                                <input type="text" class="form-control" id="editGaragemEndereco" value="${endereco}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Responsável</label>
                                <input type="text" class="form-control" id="editGaragemResponsavel" value="${responsavel}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Telefones <small class="text-muted">(separados por vírgula)</small></label>
                                <textarea class="form-control" id="editGaragemTelefone" rows="2">${telefone || ''}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">E-mails <small class="text-muted">(separados por vírgula)</small></label>
                                <textarea class="form-control" id="editGaragemEmail" rows="2">${email || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer bg-light" style="border-radius: 0 0 15px 15px;">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarEdicaoGaragem()">
                            <i class="bi bi-check-circle me-1"></i>Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal anterior se existir
    const existingModal = document.getElementById('editGaragemModal');
    if (existingModal) existingModal.remove();
    
    // Adicionar novo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('editGaragemModal'));
    modal.show();
}

/**
 * Salva edição de garagem
 */
async function salvarEdicaoGaragem() {
    const id = document.getElementById('editGaragemId').value;
    const dados = {
        nome: document.getElementById('editGaragemNome').value,
        endereco: document.getElementById('editGaragemEndereco').value,
        responsavel: document.getElementById('editGaragemResponsavel').value,
        telefone: document.getElementById('editGaragemTelefone').value,
        email: document.getElementById('editGaragemEmail').value
    };
    
    try {
        const response = await fetch(`/api/garagens/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            showToast('Garagem atualizada com sucesso!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editGaragemModal')).hide();
            loadGaragensForRemoval();
            if (window.invalidate_garagens_cache) window.invalidate_garagens_cache();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Erro ao atualizar');
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar garagem:', error);
        showToast(`Erro: ${error.message}`, 'error');
    }
}

/**
 * Edita um técnico - abre modal de edição
 */
function editTecnico(id, nome, cpf, rg, email, telefone, empresa, escritorio) {
    console.log(`✏️ Editando técnico ID: ${id}`);
    
    // Criar modal de edição dinamicamente
    const modalHtml = `
        <div class="modal fade" id="editTecnicoModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 15px;">
                    <div class="modal-header bg-primary text-white" style="border-radius: 15px 15px 0 0;">
                        <h5 class="modal-title fw-bold">
                            <i class="bi bi-person-gear me-2"></i>Editar Técnico
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="formEditTecnico">
                            <input type="hidden" id="editTecnicoId" value="${id}">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Nome do Técnico</label>
                                <input type="text" class="form-control" id="editTecnicoNome" value="${nome}" required>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">Empresa</label>
                                    <input type="text" class="form-control" id="editTecnicoEmpresa" value="${empresa || ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">Escritório</label>
                                    <input type="text" class="form-control" id="editTecnicoEscritorio" value="${escritorio || ''}">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">CPF</label>
                                    <input type="text" class="form-control" id="editTecnicoCpf" value="${cpf}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">RG</label>
                                    <input type="text" class="form-control" id="editTecnicoRg" value="${rg}">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">E-mail</label>
                                <input type="email" class="form-control" id="editTecnicoEmail" value="${email}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Telefone</label>
                                <input type="text" class="form-control" id="editTecnicoTelefone" value="${telefone}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer bg-light" style="border-radius: 0 0 15px 15px;">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarEdicaoTecnico()">
                            <i class="bi bi-check-circle me-1"></i>Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal anterior se existir
    const existingModal = document.getElementById('editTecnicoModal');
    if (existingModal) existingModal.remove();
    
    // Adicionar novo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('editTecnicoModal'));
    modal.show();
}

/**
 * Salva edição de técnico
 */
async function salvarEdicaoTecnico() {
    const id = document.getElementById('editTecnicoId').value;
    const dados = {
        nome: document.getElementById('editTecnicoNome').value,
        cpf: document.getElementById('editTecnicoCpf').value,
        rg: document.getElementById('editTecnicoRg').value,
        email: document.getElementById('editTecnicoEmail').value,
        telefone: document.getElementById('editTecnicoTelefone').value,
        empresa: document.getElementById('editTecnicoEmpresa').value,
        escritorio: document.getElementById('editTecnicoEscritorio').value
    };
    
    try {
        const response = await fetch(`/api/tecnicos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            showToast('Técnico atualizado com sucesso!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editTecnicoModal')).hide();
            loadTecnicosForRemoval();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Erro ao atualizar');
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar técnico:', error);
        showToast(`Erro: ${error.message}`, 'error');
    }
}

/**
 * Confirma remoção de técnico
 */
async function confirmDeleteTecnico(tecnicoId, tecnicoNome) {
    if (!tecnicoId) {
        console.error('❌ ID do técnico não fornecido');
        return;
    }

    const confirmMessage = `Tem certeza que deseja remover o técnico "${tecnicoNome}"?\n\nEsta ação não pode ser desfeita!`;
    
    if (confirm(confirmMessage)) {
        try {
            console.log(`🗑️ Removendo técnico ID: ${tecnicoId}`);
            
            const response = await fetch(`/api/tecnicos/${tecnicoId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('✅ Técnico removido com sucesso');
                showToast(`Técnico "${tecnicoNome}" removido com sucesso!`, 'success');
                
                // Recarregar lista de técnicos
                loadTecnicosForRemoval();
                
                // Invalidar cache se existir
                if (window.invalidate_tecnicos_cache) {
                    window.invalidate_tecnicos_cache();
                }
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
                throw new Error(errorData.detail || `Erro HTTP: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao remover técnico:', error);
            showToast(`Erro ao remover técnico: ${error.message}`, 'error');
        }
    }
}

// Tornar as funções globais para uso no HTML
window.showAddGaragem = showAddGaragem;
window.showAddTecnico = showAddTecnico;
window.showListarGaragens = showListarGaragens;
window.showListarTecnicos = showListarTecnicos;

// ============================================================================
// FUNÇÕES PARA LISTAR GARAGENS E TÉCNICOS (Consulta)
// ============================================================================

/**
 * Função chamada pelo menu "Gerenciar > Consultar Garagens"
 * Mostra modal com lista de garagens cadastradas (somente leitura)
 */
function showListarGaragens() {
    console.log('📋 Menu Gerenciar > Consultar Garagens clicado');
    
    // Criar modal dinamicamente se não existir
    let modal = document.getElementById('listarGaragensModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'listarGaragensModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="bi bi-building me-2"></i>Garagens Cadastradas</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <input type="text" id="filtroGaragens" class="form-control" placeholder="🔍 Filtrar garagens..." oninput="filtrarListaGaragens()">
                        </div>
                        <div id="listaGaragensContainer" class="row g-2">
                            <div class="text-center py-4">
                                <div class="spinner-border text-primary" role="status"></div>
                                <p class="mt-2 mb-0">Carregando garagens...</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <span id="countGaragens" class="text-muted me-auto"></span>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Abrir modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Carregar garagens
    carregarListaGaragens();
}

/**
 * Carrega e exibe lista de garagens
 */
async function carregarListaGaragens() {
    try {
        const response = await fetch('/api/garagens');
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const garagens = await response.json();
        window._garagensLista = garagens; // Cache para filtro
        renderizarListaGaragens(garagens);
    } catch (error) {
        console.error('❌ Erro ao carregar garagens:', error);
        document.getElementById('listaGaragensContainer').innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-exclamation-circle text-danger" style="font-size: 2rem;"></i>
                <p class="text-danger mt-2 mb-0">Erro ao carregar garagens</p>
            </div>
        `;
    }
}

/**
 * Renderiza lista de garagens
 */
function renderizarListaGaragens(garagens) {
    const container = document.getElementById('listaGaragensContainer');
    const countEl = document.getElementById('countGaragens');
    
    if (!garagens || garagens.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-building text-muted" style="font-size: 2rem;"></i>
                <p class="text-muted mt-2 mb-0">Nenhuma garagem cadastrada</p>
            </div>
        `;
        countEl.textContent = '0 garagens';
        return;
    }
    
    container.innerHTML = garagens.map(g => `
        <div class="col-md-6 garagem-item" data-nome="${(g.nome || g.name || '').toLowerCase()}" data-endereco="${(g.endereco || g.address || '').toLowerCase()}">
            <div class="card border-0 bg-light h-100">
                <div class="card-body py-2">
                    <h6 class="card-title mb-1"><i class="bi bi-building me-1 text-primary"></i>${g.nome || g.name || 'N/A'}</h6>
                    <small class="text-muted d-block">${g.endereco || g.address || 'Endereço não informado'}</small>
                    ${g.email ? `<small class="text-muted d-block"><i class="bi bi-envelope me-1"></i>${g.email}</small>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    countEl.textContent = `${garagens.length} garagem(ns)`;
}

/**
 * Filtra lista de garagens pelo texto digitado
 */
function filtrarListaGaragens() {
    const filtro = (document.getElementById('filtroGaragens')?.value || '').toLowerCase();
    const itens = document.querySelectorAll('.garagem-item');
    
    itens.forEach(item => {
        const nome = item.dataset.nome || '';
        const endereco = item.dataset.endereco || '';
        const visivel = nome.includes(filtro) || endereco.includes(filtro);
        item.style.display = visivel ? '' : 'none';
    });
    
    // Atualizar contador
    const visiveis = document.querySelectorAll('.garagem-item:not([style*="display: none"])').length;
    document.getElementById('countGaragens').textContent = `${visiveis} garagem(ns) encontrada(s)`;
}
window.filtrarListaGaragens = filtrarListaGaragens;

/**
 * Função chamada pelo menu "Gerenciar > Consultar Técnicos"
 * Mostra modal com lista de técnicos cadastrados (somente leitura)
 */
function showListarTecnicos() {
    console.log('📋 Menu Gerenciar > Consultar Técnicos clicado');
    
    let modal = document.getElementById('listarTecnicosModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'listarTecnicosModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title"><i class="bi bi-people me-2"></i>Técnicos Cadastrados</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <input type="text" id="filtroTecnicos" class="form-control" placeholder="🔍 Filtrar técnicos..." oninput="filtrarListaTecnicos()">
                        </div>
                        <div id="listaTecnicosContainer" class="row g-2">
                            <div class="text-center py-4">
                                <div class="spinner-border text-info" role="status"></div>
                                <p class="mt-2 mb-0">Carregando técnicos...</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <span id="countTecnicos" class="text-muted me-auto"></span>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    carregarListaTecnicos();
}

async function carregarListaTecnicos() {
    try {
        const response = await fetch('/api/tecnicos');
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const tecnicos = await response.json();
        window._tecnicosLista = tecnicos;
        renderizarListaTecnicos(tecnicos);
    } catch (error) {
        console.error('❌ Erro ao carregar técnicos:', error);
        document.getElementById('listaTecnicosContainer').innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-exclamation-circle text-danger" style="font-size: 2rem;"></i>
                <p class="text-danger mt-2 mb-0">Erro ao carregar técnicos</p>
            </div>
        `;
    }
}

function renderizarListaTecnicos(tecnicos) {
    const container = document.getElementById('listaTecnicosContainer');
    const countEl = document.getElementById('countTecnicos');
    
    if (!tecnicos || tecnicos.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-people text-muted" style="font-size: 2rem;"></i>
                <p class="text-muted mt-2 mb-0">Nenhum técnico cadastrado</p>
            </div>
        `;
        countEl.textContent = '0 técnicos';
        return;
    }
    
    container.innerHTML = tecnicos.map(t => `
        <div class="col-md-6 tecnico-item" data-nome="${(t.nome || t.name || '').toLowerCase()}" data-email="${(t.email || '').toLowerCase()}">
            <div class="card border-0 bg-light h-100">
                <div class="card-body py-2">
                    <h6 class="card-title mb-1"><i class="bi bi-person me-1 text-info"></i>${t.nome || t.name || 'N/A'}</h6>
                    ${t.email ? `<small class="text-muted d-block"><i class="bi bi-envelope me-1"></i>${t.email}</small>` : ''}
                    ${t.telefone || t.phone ? `<small class="text-muted d-block"><i class="bi bi-telephone me-1"></i>${t.telefone || t.phone}</small>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    countEl.textContent = `${tecnicos.length} técnico(s)`;
}

function filtrarListaTecnicos() {
    const filtro = (document.getElementById('filtroTecnicos')?.value || '').toLowerCase();
    const itens = document.querySelectorAll('.tecnico-item');
    
    itens.forEach(item => {
        const nome = item.dataset.nome || '';
        const email = item.dataset.email || '';
        const visivel = nome.includes(filtro) || email.includes(filtro);
        item.style.display = visivel ? '' : 'none';
    });
    
    const visiveis = document.querySelectorAll('.tecnico-item:not([style*="display: none"])').length;
    document.getElementById('countTecnicos').textContent = `${visiveis} técnico(s) encontrado(s)`;
}
window.filtrarListaTecnicos = filtrarListaTecnicos;

// ============================================================================
// CRIAR CHAMADO RÁPIDO (a partir da dashboard)
// ============================================================================

// Classificações por departamento
// Classificações por departamento - Mapeamento unificado com chamados.js
var CLASSIFICACOES_CONFIG = {
    'CCO': ['Acesso Remoto (N0)', 'Incidente de Segurança – Chip de Dados'],
    'Operações': ['Checklist Elétrico (N3)', 'Atendimento Externo (N4)'],
    'TI': ['Correção da aplicação'],
    'P&D': ['Atualizar Aplicação'],
    'Atendimento': ['Verificar chip'],
    'Business Intelligence (BI)': ['Prefixo entrou em manutenção','Prefixo voltou para operação','Troca de máquina','Prefixo desativado','Máquina Sinistrada','Remanejamento','Troca e prefixo','Atualização da Base do sistema'],
    'Prestador': ['Adesivação', 'Gesso', 'Instalação de Lousa', 'Instalação de lousa de vidro', 'Cabeamento estruturado'],
    'Gerência': ['Solicitações Administrativas']
};

// Mapeamento reverso: Classificação -> Nível de destino
var CLASSIFICACAO_NIVEL_MAP = {
    'Acesso Remoto (N0)': 'N0',
    'Incidente de Segurança – Chip de Dados': 'N0',
    'Checklist Elétrico (N3)': 'N3',
    'Atendimento Externo (N4)': 'N4',
    'Correção da aplicação': 'N5',
    'Atualizar Aplicação': 'N6',
    'Verificar chip': 'N1',
    'Atualização da Base do sistema': 'N2',
    'Prefixo entrou em manutenção': 'N2',
    'Prefixo voltou para operação': 'N2',
    'Troca de máquina': 'N2',
    'Troca e prefixo': 'N2',
    'Prefixo desativado': 'N2',
    'Máquina Sinistrada': 'N2',
    'Remanejamento': 'N2',
    'Adesivação': null,
    'Gesso': null,
    'Instalação de Lousa': null,
    'Instalação de lousa de vidro': null,
    'Cabeamento estruturado': null,
    'Solicitações Administrativas': null
};

// Cache de chamados para verificação rápida
var chamadosPorPrefixo = {};

/**
 * Verifica se há chamados abertos para um prefixo e atualiza a UI
 * (Mesmo padrão da watchlist)
 */
async function verificarChamadosAbertos() {
    try {
        // CORREÇÃO 09/02/2026: Usar endpoint que retorna TODOS os chamados ativos
        // independente do departamento, para mapear corretamente na tabela
        // CORREÇÃO 09/02/2026 (Sessão 7): Agrupamento por PATRIMONIO (único) em vez de prefixo (não único)
        const response = await fetch('/api/chamados/ativos-resumo');
        if (response.ok) {
            const chamadosAtivos = await response.json();
            
            // Limpar cache anterior
            chamadosPorPrefixo = {};
            
            // Agrupar chamados ATIVOS por patrimonio (chave única)
            chamadosAtivos.forEach(chamado => {
                if (chamado.patrimonio) {
                    if (!chamadosPorPrefixo[chamado.patrimonio]) {
                        chamadosPorPrefixo[chamado.patrimonio] = [];
                    }
                    chamadosPorPrefixo[chamado.patrimonio].push(chamado);
                }
            });
            
            // Atualizar UI para cada patrimonio com chamado aberto
            Object.keys(chamadosPorPrefixo).forEach(patrimonio => {
                const chamado = chamadosPorPrefixo[patrimonio][0];
                atualizarStatusChamadoPatrimonio(patrimonio, chamado);
            });
        }
    } catch (error) {
        console.warn('⚠️ Erro ao verificar chamados abertos:', error.message);
    }
}

/**
 * Atualiza a UI do prefixo para mostrar que há um chamado aberto
 * (Mesmo padrão da watchlist)
 */
function atualizarStatusChamadoPatrimonio(patrimonio, chamado) {
    const botaoCriar = document.getElementById(`btn-chamado-${patrimonio}`);
    const chamadoLink = document.getElementById(`chamado-link-${patrimonio}`);
    const numeroSpan = document.getElementById(`chamado-number-${patrimonio}`);
    
    if (botaoCriar && chamadoLink && numeroSpan) {
        // Desabilitar botão de criar chamado (vermelho, mas visível)
        botaoCriar.disabled = true;
        botaoCriar.style.backgroundColor = '#dc3545';
        botaoCriar.style.borderColor = '#dc3545';
        botaoCriar.style.opacity = '0.5';
        botaoCriar.style.cursor = 'not-allowed';
        botaoCriar.title = 'Já existe um chamado aberto para este patrimônio';
        
        // Mostrar número do chamado na coluna Chamados
        numeroSpan.textContent = chamado.id;
        chamadoLink.className = 'badge bg-danger';
        chamadoLink.style.display = 'inline';
        chamadoLink.style.cursor = 'pointer';
        chamadoLink.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            abrirCardChamadoDashboard(chamado);
        };
    }
}

/**
 * Abre um card com os detalhes do chamado na dashboard
 * CORREÇÃO 09/02/2026 (Sessão 4): Busca dados completos do chamado via API
 * pois o endpoint /ativos-resumo retorna apenas dados mínimos.
 */
async function abrirCardChamadoDashboard(chamadoResumo) {
    // Buscar dados completos do chamado
    let chamado = chamadoResumo;
    try {
        const resp = await fetch(`/api/chamados/${chamadoResumo.id}`);
        if (resp.ok) {
            chamado = await resp.json();
        }
    } catch (e) {
        console.warn('⚠️ Erro ao buscar detalhes do chamado, usando dados resumidos:', e.message);
    }
    
    // Criar ou atualizar modal/card
    let card = document.getElementById('cardChamadoDashboard');
    if (!card) {
        const cardHtml = `
            <div id="cardChamadoDashboard" class="position-fixed" style="
                bottom: 20px;
                right: 20px;
                width: 400px;
                background: #0d2137;
                border: 2px solid rgba(76, 175, 80, 0.5);
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                padding: 20px;
                max-height: 600px;
                overflow-y: auto;
                z-index: 9999;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid rgba(76, 175, 80, 0.3); padding-bottom: 10px;">
                    <h6 class="mb-0" style="color: #4CAF50; font-weight: bold;">Detalhes do Chamado</h6>
                    <button type="button" class="btn-close btn-close-white" onclick="fecharCardChamadoDashboard()" style="padding: 0;"></button>
                </div>
                <div id="conteudoCardChamado"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', cardHtml);
        card = document.getElementById('cardChamadoDashboard');
    }
    
    // Preencher conteúdo
    const conteudo = document.getElementById('conteudoCardChamado');
    conteudo.innerHTML = `
        <div style="color: #ffffff;">
            <div style="margin-bottom: 15px;">
                <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">ID do Chamado</label>
                <div style="font-size: 1.2rem; font-weight: bold; color: #4CAF50;">${chamado.id}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Prefixo</label>
                    <div style="font-weight: bold;">${chamado.prefixo || '-'}</div>
                </div>
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Patrimônio</label>
                    <div style="font-weight: bold;">${chamado.patrimonio || '-'}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Projeto</label>
                    <div style="font-weight: bold;">${chamado.projeto || '-'}</div>
                </div>
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Garagem</label>
                    <div style="font-weight: bold;">${chamado.garagem || '-'}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Status</label>
                    <div style="font-weight: bold; color: ${chamado.status === 'aberto' ? '#ffc107' : '#4CAF50'};">
                        ${chamado.status || '-'}
                    </div>
                </div>
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Nível</label>
                    <div style="font-weight: bold;">${chamado.current_level || chamado.currentLevel || '-'}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Departamento</label>
                    <div style="font-weight: bold;">${chamado.departamento || '-'}</div>
                </div>
                <div>
                    <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Classificação</label>
                    <div style="font-weight: bold;">${chamado.classificacao || '-'}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Descrição</label>
                <div style="background: rgba(76, 175, 80, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #4CAF50; font-size: 0.9rem;">
                    ${chamado.description || 'Sem descrição adicional.'}
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Aberto por</label>
                <div style="font-weight: bold;">${chamado.created_by_name || chamado.createdByName || '-'}</div>
                <div style="color: #b0bec5; font-size: 0.85rem;">${formatarDataChamado(chamado.created_at || chamado.createdAt)}</div>
            </div>
            
            ${(() => {
                const history = chamado.history || [];
                if (history.length === 0) return '';
                let html = '<div style="margin-bottom: 15px;"><label style="color: #b0bec5; font-size: 0.85rem; text-transform: uppercase;">Histórico Completo</label>';
                html += '<div style="border-left: 2px solid rgba(76, 175, 80, 0.3); padding-left: 10px; margin-top: 5px;">';
                history.forEach(h => {
                    const dataEvento = h.date ? new Date(h.date).toLocaleString('pt-BR') : '-';
                    html += '<div style="margin-bottom: 8px; font-size: 0.85rem;">';
                    html += '<div style="font-weight: bold; color: #4CAF50;">' + (h.responsible || '-') + ' <span style="color: #b0bec5; font-weight: normal; font-size: 0.8em;">' + dataEvento + '</span></div>';
                    html += '<div style="color: #ffffff;">' + (h.action || '') + '</div>';
                    if (h.notes) html += '<div style="color: #b0bec5; font-style: italic;">' + h.notes + '</div>';
                    if (h.level) html += '<span style="background: rgba(76, 175, 80, 0.2); color: #4CAF50; padding: 1px 6px; border-radius: 3px; font-size: 0.75em;">' + h.level + '</span>';
                    html += '</div>';
                });
                html += '</div></div>';
                return html;
            })()}
        </div>
    `;
}

/**
 * Fecha o card de chamado
 */
function fecharCardChamadoDashboard() {
    const card = document.getElementById('cardChamadoDashboard');
    if (card) {
        card.remove();
    }
}

/**
 * Abre painel com histórico completo de chamados de um patrimônio
 * Busca TODOS os chamados (ativos + encerrados) via API
 */
async function abrirHistoricoChamadosPatrimonio(patrimonio) {
    if (!patrimonio) return;
    
    // Fechar card de detalhes se aberto
    fecharCardChamadoDashboard();
    
    // Criar ou reutilizar o painel de histórico
    let panel = document.getElementById('panelHistoricoChamados');
    if (!panel) {
        const panelHtml = `
            <div id="panelHistoricoChamados" class="position-fixed" style="
                bottom: 20px; right: 20px; width: 460px;
                background: #0d2137; border: 2px solid rgba(76, 175, 80, 0.5);
                border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                padding: 20px; max-height: 650px; overflow-y: auto; z-index: 9999;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid rgba(76, 175, 80, 0.3); padding-bottom: 10px;">
                    <h6 class="mb-0" style="color: #4CAF50; font-weight: bold;">
                        <i class="bi bi-clock-history me-2"></i>Histórico de Chamados
                    </h6>
                    <button type="button" class="btn-close btn-close-white" onclick="fecharHistoricoChamados()" style="padding: 0;"></button>
                </div>
                <div id="historicoPatrimonioLabel" style="color: #b0bec5; font-size: 0.85rem; margin-bottom: 12px;"></div>
                <div id="conteudoHistoricoChamados"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', panelHtml);
        panel = document.getElementById('panelHistoricoChamados');
    }
    
    panel.style.display = 'block';
    document.getElementById('historicoPatrimonioLabel').innerHTML = `Patrimônio: <strong style="color: #fff;">${patrimonio}</strong>`;
    document.getElementById('conteudoHistoricoChamados').innerHTML = '<div style="text-align: center; padding: 30px; color: #b0bec5;"><i class="bi bi-hourglass-split" style="font-size: 1.5rem;"></i><p>Carregando...</p></div>';
    
    try {
        const resp = await fetch(`/api/chamados/historico-patrimonio/${encodeURIComponent(patrimonio)}`);
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);
        const data = await resp.json();
        
        const container = document.getElementById('conteudoHistoricoChamados');
        
        if (!data.chamados || data.chamados.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: #7f8c8d;"><i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>Nenhum chamado encontrado para este patrimônio.</div>';
            return;
        }
        
        container.innerHTML = `<div style="color: #b0bec5; font-size: 0.8rem; margin-bottom: 10px;">${data.total} chamado(s) encontrado(s)</div>`;
        
        data.chamados.forEach(c => {
            const statusColor = _getStatusColor(c.status);
            const dataAbertura = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-';
            const dataUpdate = c.updated_at ? new Date(c.updated_at).toLocaleDateString('pt-BR') : '-';
            
            const itemHtml = `
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid ${statusColor}; border-radius: 6px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s;"
                     onmouseover="this.style.background='rgba(76,175,80,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"
                     onclick="verDetalhesChamadoHistorico('${c.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: bold; color: #fff; font-size: 0.95rem;">#${c.id}</span>
                        <span style="background: ${statusColor}22; color: ${statusColor}; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; border: 1px solid ${statusColor}44;">
                            ${(c.status || '').toUpperCase()}
                        </span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.82rem; color: #b0bec5;">
                        <div><i class="bi bi-building me-1"></i>${c.departamento_destino || c.departamento || '-'}</div>
                        <div><i class="bi bi-layers me-1"></i>${c.current_level || '-'}</div>
                        <div><i class="bi bi-tag me-1"></i>${c.classificacao || '-'}</div>
                        <div><i class="bi bi-calendar me-1"></i>${dataAbertura}</div>
                    </div>
                    ${c.description ? `<div style="font-size: 0.8rem; color: #7f8c8d; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.description}</div>` : ''}
                    <div style="text-align: right; margin-top: 6px;">
                        <span style="color: #4CAF50; font-size: 0.78rem; font-weight: 500;">Ver detalhes <i class="bi bi-chevron-right"></i></span>
                    </div>
                </div>
            `;
            container.innerHTML += itemHtml;
        });
    } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        document.getElementById('conteudoHistoricoChamados').innerHTML = `<div style="text-align: center; padding: 20px; color: #f44336;"><i class="bi bi-exclamation-triangle" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>Erro ao carregar histórico: ${err.message}</div>`;
    }
}

/**
 * Retorna cor do status do chamado
 */
function _getStatusColor(status) {
    const colors = {
        'aberto': '#ffc107',
        'em_andamento': '#2196F3',
        'pendente': '#FF9800',
        'respondido': '#9C27B0',
        'atendido': '#00BCD4',
        'resolvido': '#4CAF50',
        'fechado': '#607D8B'
    };
    return colors[status] || '#9E9E9E';
}

/**
 * Abre detalhes completos de um chamado do histórico
 */
async function verDetalhesChamadoHistorico(chamadoId) {
    try {
        const resp = await fetch(`/api/chamados/${chamadoId}`);
        if (!resp.ok) throw new Error(`Erro ${resp.status}`);
        const chamado = await resp.json();
        
        // Fechar painel de histórico e abrir card de detalhes
        fecharHistoricoChamados();
        abrirCardChamadoDashboard(chamado);
    } catch (err) {
        console.error('Erro ao buscar detalhes:', err);
    }
}

/**
 * Fecha o painel de histórico
 */
function fecharHistoricoChamados() {
    const panel = document.getElementById('panelHistoricoChamados');
    if (panel) panel.remove();
}

/**
 * Formata data para exibição
 */
function formatarDataChamado(dataStr) {
    if (!dataStr) return '-';
    try {
        const data = new Date(dataStr);
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dataStr;
    }
}

/**
 * Abre a página de chamados com o chamado selecionado
 */
function abrirPaginaChamados(chamadoId) {
    // Guardar o ID do chamado em sessionStorage para abrir depois
    sessionStorage.setItem('chamadoParaAbrir', chamadoId);
    // Redirecionar para a página de chamados
    window.location.href = '/chamados';
}

// Variáveis para guardar dados do equipamento selecionado (usar var para evitar TDZ em onclick inline)
var _rapidoPrefixo = '';
var _rapidoPatrimonio = '';
var _rapidoProjeto = '';
var _rapidoGaragem = '';
var _rapidoSerial = '';

function abrirModalCriarChamadoRapido(prefixo, patrimonio, projeto, garagem, serial) {
    // Guardar dados para uso posterior
    _rapidoPrefixo = prefixo;
    _rapidoPatrimonio = patrimonio;
    _rapidoProjeto = projeto;
    _rapidoGaragem = garagem;
    _rapidoSerial = serial || '';
    
    // Criar modal se não existir
    let modal = document.getElementById('modalCriarChamadoRapido');
    if (!modal) {
        const modalHtml = `
            <div class="modal fade" id="modalCriarChamadoRapido" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98)); border: 2px solid rgba(76, 175, 80, 0.3);">
                        <div class="modal-header" style="border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
                            <h5 class="modal-title" style="color: #4CAF50;">
                                <i class="fas fa-plus-circle me-2"></i>Criar Chamado
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formCriarChamadoRapido">
                                <div class="mb-3">
                                    <label class="form-label" style="color: #ffffff; font-weight: 500;">Departamento Destino *</label>
                                    <select class="form-select" id="rapidoDepartamento" required style="background-color: #1a1a2e; color: #ffffff; border-color: rgba(76, 175, 80, 0.5);">
                                        <option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione o departamento...</option>
                                        <option value="CCO" style="background-color: #1a1a2e; color: #ffffff;">CCO</option>
                                        <option value="Operações" style="background-color: #1a1a2e; color: #ffffff;">Operações</option>
                                        <option value="TI" style="background-color: #1a1a2e; color: #ffffff;">TI</option>
                                        <option value="P&D" style="background-color: #1a1a2e; color: #ffffff;">P&D</option>
                                        <option value="Atendimento" style="background-color: #1a1a2e; color: #ffffff;">Atendimento</option>
                                        <option value="Business Intelligence (BI)" style="background-color: #1a1a2e; color: #ffffff;">Business Intelligence (BI)</option>
                                        <option value="Prestador" style="background-color: #1a1a2e; color: #ffffff;">Prestador</option>
                                        <option value="Gerência" style="background-color: #1a1a2e; color: #ffffff;">Gerência</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3" id="rapidoClassificacaoContainer" style="display: none;">
                                    <label class="form-label" style="color: #ffffff; font-weight: 500;">Classificação *</label>
                                    <select class="form-select" id="rapidoClassificacao" onchange="onRapidoClassificacaoChange()" style="background-color: #1a1a2e; color: #ffffff; border-color: rgba(76, 175, 80, 0.5);">
                                        <option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione a classificação...</option>
                                    </select>
                                </div>
                                
                                <!-- Campo de Delegação para Usuário Específico -->
                                <div class="mb-3" id="rapidoDelegarContainer" style="display: none;">
                                    <label class="form-label" style="color: #ffffff; font-weight: 500;">
                                        <i class="fas fa-user-tag me-1"></i>Delegar para (opcional)
                                    </label>
                                    <select class="form-select" id="rapidoDelegarUsuario" style="background-color: #1a1a2e; color: #ffffff; border-color: rgba(76, 175, 80, 0.5);">
                                        <option value="" style="background-color: #1a1a2e; color: #ffffff;">Nenhum - visível para todo departamento</option>
                                    </select>
                                    <small class="text-muted">Se selecionado, apenas este usuário poderá ver o chamado</small>
                                </div>
                                
                                <!-- Campos N4 para Atendimento Externo -->
                                <div class="mb-3" id="rapidoCamposN4Container" style="display: none;">
                                    <div class="alert alert-info mb-2" style="background: rgba(0, 188, 212, 0.2); border-color: rgba(0, 188, 212, 0.5); color: #ffffff;">
                                        <i class="fas fa-user-cog me-2"></i>
                                        <strong>N4 - In Loco:</strong> Selecione o técnico responsável
                                    </div>
                                    <div class="mb-2">
                                        <label class="form-label" style="color: #ffffff; font-weight: 500;">Técnico Responsável *</label>
                                        <select class="form-select" id="rapidoTecnicoResponsavel" style="background-color: #1a1a2e; color: #ffffff; border-color: rgba(76, 175, 80, 0.5);">
                                            <option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione o técnico...</option>
                                        </select>
                                    </div>
                                    <div class="mb-2">
                                        <label class="form-label" style="color: #ffffff; font-weight: 500;">Equipe de Apoio</label>
                                        <select class="form-select" id="rapidoEquipeEmails" multiple size="3" style="background-color: #1a1a2e; color: #ffffff; border-color: rgba(76, 175, 80, 0.5);">
                                        </select>
                                        <small class="text-muted">Segure Ctrl para selecionar múltiplos</small>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label" style="color: #ffffff; font-weight: 500;">Descrição</label>
                                    <textarea class="form-control" id="rapidoDescricao" rows="3" placeholder="Descreva o problema detalhadamente..." style="background-color: #1a1a2e; color: #ffffff; border-color: rgba(76, 175, 80, 0.5);"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid rgba(76, 175, 80, 0.3);">
                            <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success" onclick="criarChamadoRapido()">
                                <i class="fas fa-check me-2"></i>Criar Chamado
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('modalCriarChamadoRapido');
        
        // Registrar evento APENAS uma vez na criação do modal
        document.getElementById('rapidoDepartamento').addEventListener('change', atualizarClassificacoesRapido);
    }
    
    // Limpar campos
    document.getElementById('rapidoDepartamento').value = '';
    document.getElementById('rapidoDescricao').value = '';
    const classificacaoContainer = document.getElementById('rapidoClassificacaoContainer');
    if (classificacaoContainer) classificacaoContainer.style.display = 'none';
    const camposN4Container = document.getElementById('rapidoCamposN4Container');
    if (camposN4Container) camposN4Container.style.display = 'none';
    const delegarContainer = document.getElementById('rapidoDelegarContainer');
    if (delegarContainer) delegarContainer.style.display = 'none';
    
    // Mostrar modal
    new bootstrap.Modal(modal).show();
}

/**
 * Atualiza o select de classificações baseado no departamento selecionado
 * Mostra/oculta o container de classificação conforme necessário
 */
function atualizarClassificacoesRapido() {
    const departamentoSelect = document.getElementById('rapidoDepartamento');
    const classificacaoSelect = document.getElementById('rapidoClassificacao');
    const classificacaoContainer = document.getElementById('rapidoClassificacaoContainer');
    const camposN4Container = document.getElementById('rapidoCamposN4Container');
    const delegarContainer = document.getElementById('rapidoDelegarContainer');
    const departamentoSelecionado = departamentoSelect.value;
    
    // Limpar opções atuais
    classificacaoSelect.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione a classificação...</option>';
    
    // Esconder campos N4 ao mudar departamento
    if (camposN4Container) camposN4Container.style.display = 'none';
    
    // Esconder/mostrar container de delegação
    if (delegarContainer) {
        if (departamentoSelecionado) {
            delegarContainer.style.display = 'block';
            carregarUsuariosDepartamentoRapido(departamentoSelecionado);
        } else {
            delegarContainer.style.display = 'none';
        }
    }
    
    if (!departamentoSelecionado) {
        classificacaoContainer.style.display = 'none';
        return;
    }
    
    // Buscar classificações do departamento selecionado
    if (!CLASSIFICACOES_CONFIG) {
        console.warn('⚠️ CLASSIFICACOES_CONFIG ainda não inicializado');
        classificacaoContainer.style.display = 'none';
        return;
    }
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamentoSelecionado] || [];
    
    if (classificacoesDoDept.length === 0) {
        // Se não há classificações, ocultar o container
        classificacaoContainer.style.display = 'none';
    } else {
        // Mostrar o container e preencher opções
        classificacaoContainer.style.display = 'block';
        classificacoesDoDept.forEach(c => {
            classificacaoSelect.innerHTML += `<option value="${c}" style="background-color: #1a1a2e; color: #ffffff;">${c}</option>`;
        });
    }
    
    // Se departamento for Atendimento (N1 - Verificação de Chip), preencher dados do chip
    if (departamentoSelecionado === 'Atendimento') {
        preencherDadosChipRapido();
    }
}

/**
 * Carrega usuários do departamento para o dropdown de delegação
 */
async function carregarUsuariosDepartamentoRapido(departamento) {
    const select = document.getElementById('rapidoDelegarUsuario');
    if (!select) return;
    
    // Limpar e mostrar loading
    select.innerHTML = '<option value="">Carregando usuários...</option>';
    
    try {
        const response = await fetch(`/api/users/by-department/${encodeURIComponent(departamento)}`);
        if (!response.ok) throw new Error('Erro ao carregar usuários');
        
        const data = await response.json();
        
        // Limpar e preencher
        select.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Nenhum - visível para todo departamento</option>';
        
        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                const displayName = user.display_name || user.username || user.email;
                select.innerHTML += `<option value="${user.email}" style="background-color: #1a1a2e; color: #ffffff;">${displayName} (${user.email})</option>`;
            });
            console.log(`📋 ${data.users.length} usuários carregados para ${departamento}`);
        } else {
            select.innerHTML += '<option value="" disabled style="background-color: #1a1a2e; color: #999;">Nenhum usuário no departamento</option>';
            console.log(`⚠️ Nenhum usuário encontrado para ${departamento}`);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar usuários:', error);
        select.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Nenhum - visível para todo departamento</option>';
        select.innerHTML += '<option value="" disabled style="background-color: #1a1a2e; color: #999;">Erro ao carregar usuários</option>';
    }
}

/**
 * Chamado quando a classificação muda - detecta Atendimento Externo para N4
 */
function onRapidoClassificacaoChange() {
    const classificacaoSelect = document.getElementById('rapidoClassificacao');
    const camposN4Container = document.getElementById('rapidoCamposN4Container');
    
    if (!classificacaoSelect || !camposN4Container) return;
    
    // Atendimento Externo = N4 (In Loco) - precisa de técnico e equipe
    // A classificação vem com o sufixo (N4), então verificamos com e sem o sufixo
    const classificacao = classificacaoSelect.value;
    if (classificacao === 'Atendimento Externo' || classificacao === 'Atendimento Externo (N4)') {
        camposN4Container.style.display = 'block';
        carregarTecnicosRapido();
        console.log('📋 Classificação Atendimento Externo: Campos N4 exibidos');
    } else {
        camposN4Container.style.display = 'none';
    }
}

// Cache de técnicos para criação rápida
var _tecnicosRapido = [];

/**
 * Carrega técnicos para o formulário de criação rápida
 */
async function carregarTecnicosRapido() {
    const selectTecnico = document.getElementById('rapidoTecnicoResponsavel');
    const selectEquipe = document.getElementById('rapidoEquipeEmails');
    
    if (!selectTecnico || !selectEquipe) return;
    
    // Se já carregou, apenas preenche
    if (_tecnicosRapido.length > 0) {
        preencherSelectsTecnicosRapido();
        return;
    }
    
    // Carregar técnicos da API
    try {
        const response = await fetch('/api/chamados/config/tecnicos', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            // API retorna array direto ou objeto com .tecnicos
            _tecnicosRapido = Array.isArray(data) ? data : (data.tecnicos || []);
            console.log('Técnicos carregados para criação rápida:', _tecnicosRapido.length);
            preencherSelectsTecnicosRapido();
        }
    } catch (error) {
        console.error('Erro ao carregar técnicos:', error);
    }
}

/**
 * Preenche os selects de técnico e equipe
 */
function preencherSelectsTecnicosRapido() {
    const selectTecnico = document.getElementById('rapidoTecnicoResponsavel');
    const selectEquipe = document.getElementById('rapidoEquipeEmails');
    
    if (!selectTecnico || !selectEquipe) return;
    
    selectTecnico.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione o técnico...</option>';
    selectEquipe.innerHTML = '';
    
    _tecnicosRapido.forEach(t => {
        const nome = t.nome || t.name || t.email;
        selectTecnico.innerHTML += `<option value="${t.email}" style="background-color: #1a1a2e; color: #ffffff;">${nome}</option>`;
        selectEquipe.innerHTML += `<option value="${t.email}" style="background-color: #1a1a2e; color: #ffffff;">${nome}</option>`;
    });
}

let _isSubmittingChamadoRapido = false;
async function criarChamadoRapido() {
    // 🔒 Anti-double-click: impede envio duplicado
    if (_isSubmittingChamadoRapido) return;
    _isSubmittingChamadoRapido = true;
    
    // Desabilitar botão de submit
    const btnSubmit = document.querySelector('#modalCriarChamadoRapido .btn-success, #modalCriarChamadoRapido [onclick*="criarChamadoRapido"]');
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Criando...'; }
    
    const departamento = document.getElementById('rapidoDepartamento').value;
    const classificacao = document.getElementById('rapidoClassificacao').value.trim();
    const descricao = document.getElementById('rapidoDescricao').value.trim();
    const delegarUsuarioSelect = document.getElementById('rapidoDelegarUsuario');
    const delegarUsuario = delegarUsuarioSelect ? delegarUsuarioSelect.value : '';
    
    // Validação
    if (!departamento) {
        showToast('Selecione um departamento', 'warning');
        return;
    }
    
    // Validar classificação se o departamento possui classificações
    if (!CLASSIFICACOES_CONFIG) {
        console.error('❌ CLASSIFICACOES_CONFIG não inicializado em criarChamadoRapido');
        showToast('Erro interno: configurações não carregadas. Recarregue a página (Ctrl+Shift+R).', 'error');
        return;
    }
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamento] || [];
    if (classificacoesDoDept.length > 0 && !classificacao) {
        showToast('Selecione uma classificação', 'warning');
        return;
    }
    
    // Verificar se é Operações e determinar nível pela classificação
    let nivelOperacoes = null;
    let tecnicoResponsavelEmail = null;
    let equipeEmails = null;
    
    if (departamento === 'Operações') {
        // Determinar nível baseado na classificação:
        // - Checklist Elétrico = N3
        // - Atendimento Externo = N4
        // A classificação pode vir com ou sem o sufixo (N4)
        nivelOperacoes = (classificacao === 'Atendimento Externo' || classificacao === 'Atendimento Externo (N4)') ? 'N4' : 'N3';
        
        // Se for N4 (Atendimento Externo), validar e obter dados do técnico
        if (nivelOperacoes === 'N4') {
            const tecnicoSelect = document.getElementById('rapidoTecnicoResponsavel');
            tecnicoResponsavelEmail = tecnicoSelect ? tecnicoSelect.value : '';
            
            if (!tecnicoResponsavelEmail) {
                showToast('Selecione o técnico responsável para Atendimento Externo', 'warning');
                if (tecnicoSelect) tecnicoSelect.focus();
                return;
            }
            
            // Obter equipe selecionada
            const equipeSelect = document.getElementById('rapidoEquipeEmails');
            if (equipeSelect) {
                equipeEmails = [];
                for (let option of equipeSelect.selectedOptions) {
                    if (option.value) equipeEmails.push(option.value);
                }
                if (equipeEmails.length === 0) equipeEmails = null;
            }
        }
    }
    
    const dados = {
        type: 'manutencao',
        patrimonio: _rapidoPatrimonio,
        prefixo: _rapidoPrefixo,
        projeto: _rapidoProjeto,
        garagem: _rapidoGaragem,
        serial: _rapidoSerial,
        tecnico_responsavel: departamento,
        departamento: departamento,
        classificacao: classificacao || null,
        description: descricao || `Chamado criado para prefixo ${_rapidoPrefixo}`,
        user_email: USER_EMAIL || 'sistema@wifimaxx.com',
        user_name: USER_NAME || 'Usuário',
        // Campos N4 (apenas se for Operações com Atendimento Externo)
        nivel_operacoes: nivelOperacoes,
        tecnico_responsavel_email: tecnicoResponsavelEmail,
        equipe_emails: equipeEmails,
        // Campo de delegação para usuário específico
        delegado_para: delegarUsuario || null
    };
    
    console.log('🔍 DEBUG - Dados do chamado rápido:', {
        prefixo: _rapidoPrefixo,
        patrimonio: _rapidoPatrimonio,
        serial: _rapidoSerial,
        garagem: _rapidoGaragem,
        projeto: _rapidoProjeto,
        delegado_para: delegarUsuario || null
    });
    
    try {
        const response = await fetch('/api/chamados/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        if (!response.ok) {
            // Tentar extrair mensagem de erro detalhada do backend
            const errorData = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
            const errorMessage = errorData.detail || `Erro HTTP ${response.status}`;
            showToast(errorMessage, 'danger');
            return;
        }
        
        const result = await response.json();
        
        showToast(`Chamado ${result.data.id} criado com sucesso!`, 'success');
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalCriarChamadoRapido'))?.hide();
        
        // Atualizar status do patrimonio imediatamente
        atualizarStatusChamadoPatrimonio(_rapidoPatrimonio, result.data);
        
        // Recarregar a tabela
        if (typeof updateTable === 'function') {
            updateTable();
        }
        
        // Reverificar chamados abertos para garantir que a UI está atualizada
        setTimeout(() => {
            verificarChamadosAbertos();
        }, 500);
        
    } catch (error) {
        console.error('Erro ao criar chamado:', error);
        showToast('Erro de conexão. Verifique sua conexão e tente novamente.', 'danger');
    } finally {
        _isSubmittingChamadoRapido = false;
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Criar Chamado'; }
    }
}

/**
 * Preenche automaticamente os dados do chip na descrição quando departamento é Atendimento (Verificação de Chip)
 */
async function preencherDadosChipRapido() {
    const descricaoInput = document.getElementById('rapidoDescricao');
    
    if (!descricaoInput) return;
    
    // Usar variáveis globais que foram preenchidas ao abrir o modal
    const patrimonio = _rapidoPatrimonio || '';
    const prefixo = _rapidoPrefixo || '-';
    const projeto = _rapidoProjeto || '-';
    const garagem = _rapidoGaragem || '-';
    
    if (!patrimonio) {
        console.log('📋 [N1] Sem patrimônio, não preenchendo dados de chip');
        return;
    }
    
    console.log('📋 [N1] Buscando dados do chip para patrimônio:', patrimonio);
    
    // Mostrar loading
    descricaoInput.placeholder = 'Carregando dados do chip...';
    descricaoInput.disabled = true;
    
    try {
        // Buscar dados do patrimônio via API de reforço de sinal
        const response = await fetch('/api/email/reforco-sinal/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ patrimonios: [patrimonio] })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao buscar dados do chip');
        }
        
        const dados = await response.json();
        
        // Função de saudação
        const getSaudacao = () => {
            const hora = new Date().getHours();
            if (hora < 12) return 'Bom dia.';
            if (hora < 18) return 'Boa tarde.';
            return 'Boa noite.';
        };
        
        if (dados && dados.length > 0) {
            const chip = dados[0];
            
            // Montar texto formatado similar ao email de reforço de sinal
            let texto = `${getSaudacao()}\n\n`;
            texto += `Por gentileza, realizar a verificação de sinal no CHIP:\n\n`;
            texto += `PATRIMÔNIO:    ${chip.Patrimonio || patrimonio}\n`;
            texto += `IMEI MODEM:    ${chip.IMEI_MODEM_1 || '-'}\n`;
            texto += `IMEI CHIP:     ${chip.IMEI_CHIP_1 || '-'}\n`;
            texto += `Nº TELEFONE:   ${chip.N_TELEFONE_1 || '-'}\n`;
            texto += `OPERADORA:     ${chip.OPERADORA_1 || '-'}`;
            
            descricaoInput.value = texto;
            // Disparar evento para formulário reconhecer o texto preenchido
            descricaoInput.dispatchEvent(new Event('input', { bubbles: true }));
            descricaoInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ [N1] Dados do chip preenchidos automaticamente');
        } else {
            // Patrimônio não encontrado
            let texto = `${getSaudacao()}\n\n`;
            texto += `Por gentileza, realizar a verificação de sinal no CHIP:\n\n`;
            texto += `PATRIMÔNIO:    ${patrimonio}\n`;
            texto += `IMEI MODEM:    (não encontrado)\n`;
            texto += `IMEI CHIP:     (não encontrado)\n`;
            texto += `Nº TELEFONE:   (não encontrado)\n`;
            texto += `OPERADORA:     (não encontrado)`;
            
            descricaoInput.value = texto;
            // Disparar evento para formulário reconhecer o texto preenchido
            descricaoInput.dispatchEvent(new Event('input', { bubbles: true }));
            descricaoInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('⚠️ [N1] Patrimônio não encontrado na base');
        }
    } catch (error) {
        console.error('❌ [N1] Erro ao buscar dados do chip:', error);
        
        // Preencher com dados básicos
        const getSaudacao = () => {
            const hora = new Date().getHours();
            if (hora < 12) return 'Bom dia.';
            if (hora < 18) return 'Boa tarde.';
            return 'Boa noite.';
        };
        
        let texto = `${getSaudacao()}\n\n`;
        texto += `Por gentileza, realizar a verificação de sinal no CHIP:\n\n`;
        texto += `PATRIMÔNIO:    ${patrimonio}`;
        
        descricaoInput.value = texto;
        // Disparar evento para formulário reconhecer o texto preenchido
        descricaoInput.dispatchEvent(new Event('input', { bubbles: true }));
        descricaoInput.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
        descricaoInput.placeholder = 'Descreva o problema detalhadamente...';
        descricaoInput.disabled = false;
        descricaoInput.focus();
    }
}

window.showRemoveGaragem = showRemoveGaragem;
window.showRemoveTecnico = showRemoveTecnico;
window.loadGaragensForRemoval = loadGaragensForRemoval;
window.loadTecnicosForRemoval = loadTecnicosForRemoval;
window.confirmDeleteGaragem = confirmDeleteGaragem;
window.confirmDeleteTecnico = confirmDeleteTecnico;

// ============================================================================
// RELATÓRIOS - Dashboard de Relatórios (código extraído para top-level)
// ============================================================================

var statusColumnChart = null;
var garagemBarChart = null;

document.addEventListener('DOMContentLoaded', () => {
    const empresaSel = document.getElementById('empresaDbSelect');
    const projetoSel = document.getElementById('projetoSelect');
    
    // Só inicializa se os elementos de relatório existirem na página
    if (empresaSel && projetoSel) {
        carregarEmpresasRelatorio();

        empresaSel.addEventListener('change', async () => {
            const empresa = empresaSel.value;
            if (!empresa) {
                limparTudoRelatorio();
                return;
            }
            await carregarProjetosRelatorio(empresa);
            await carregarRelatorioData();
        });

        projetoSel.addEventListener('change', carregarRelatorioData);
    }
});

async function carregarEmpresasRelatorio() {
    try {
        const res = await fetch('/api/reports/empresas', { credentials: 'include' });
        const json = await res.json();
        if (!json.success) return;

        const sel = document.getElementById('empresaDbSelect');
        sel.innerHTML = '<option value="">Selecione...</option>';
        json.empresas.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e;
            opt.textContent = e;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar empresas:', err);
    }
}

async function carregarProjetosRelatorio(empresaDb) {
    try {
        const res = await fetch(`/api/reports/projetos?empresa_db=${encodeURIComponent(empresaDb)}`, {
            credentials: 'include'
        });
        const json = await res.json();
        const sel = document.getElementById('projetoSelect');
        sel.innerHTML = '<option value="">Todos</option>';

        if (!json.success) return;

        json.projetos.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar projetos:', err);
    }
}

async function carregarRelatorioData() {
    const empresa = document.getElementById('empresaDbSelect').value;
    const projeto = document.getElementById('projetoSelect').value;

    if (!empresa) return;

    let url = `/api/reports/projeto?empresa_db=${encodeURIComponent(empresa)}`;
    if (projeto) url += `&projeto=${encodeURIComponent(projeto)}`;

    try {
        const res = await fetch(url, { credentials: 'include' });
        const json = await res.json();
        if (!json.success) {
            console.warn('Relatório não retornou sucesso:', json.message);
            limparTudoRelatorio();
            return;
        }

        atualizarResumoRelatorio(json.summary);
        atualizarStatusChartRelatorio(json.summary.status_counts);
        atualizarGaragemChartRelatorio(json.by_garagem);
        atualizarOffendersTableRelatorio(json.offenders.garagens);

    } catch (err) {
        console.error('Erro ao carregar relatório:', err);
    }
}

function limparTudoRelatorio() {
    atualizarResumoRelatorio({ total: 0, status_counts: {} });
    atualizarStatusChartRelatorio({});
    atualizarGaragemChartRelatorio([]);
    atualizarOffendersTableRelatorio({ alerta: [], inativo: [], atencao: [] });
}

function atualizarResumoRelatorio(summary) {
    const total = summary?.total || 0;
    const el = document.getElementById('cardTotal');
    if (el) el.textContent = total;
}

function atualizarStatusChartRelatorio(counts) {
    const canvas = document.getElementById('statusColumnChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const data = [
        counts.online || 0,
        counts.atencao || 0,
        counts.alerta || 0,
        counts.inativo || 0,
        counts.manutencao || 0
    ];

    const labels = ['Online', 'Atenção', 'Alerta', 'Inativo', 'Manutenção'];

    if (statusColumnChart) statusColumnChart.destroy();

    statusColumnChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function atualizarGaragemChartRelatorio(byGaragem) {
    const canvas = document.getElementById('garagemBarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = byGaragem.map(g => g.garagem);
    const alerta = byGaragem.map(g => g.alerta);
    const atencao = byGaragem.map(g => g.atencao);
    const inativo = byGaragem.map(g => g.inativo);
    const manutencao = byGaragem.map(g => g.manutencao);

    if (garagemBarChart) garagemBarChart.destroy();

    garagemBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Alerta', data: alerta, stack: 'status' },
                { label: 'Atenção', data: atencao, stack: 'status' },
                { label: 'Inativo', data: inativo, stack: 'status' },
                { label: 'Manutenção', data: manutencao, stack: 'status' }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function atualizarOffendersTableRelatorio(offenders) {
    const tbody = document.querySelector('#offendersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const alerta = offenders.alerta || [];
    const inativo = offenders.inativo || [];
    const atencao = offenders.atencao || [];

    const map = new Map();

    function acum(lista, key) {
        lista.forEach(item => {
            const g = item.garagem || 'N/D';
            const atual = map.get(g) || { garagem: g, alerta: 0, inativo: 0, atencao: 0 };
            atual[key] += item.count || 0;
            map.set(g, atual);
        });
    }

    acum(alerta, 'alerta');
    acum(inativo, 'inativo');
    acum(atencao, 'atencao');

    const rows = Array.from(map.values()).map(r => {
        r.total = r.alerta + r.inativo + r.atencao;
        return r;
    }).sort((a, b) => b.total - a.total);

    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.garagem}</td>
            <td>${r.alerta}</td>
            <td>${r.inativo}</td>
            <td>${r.atencao}</td>
            <td>${r.total}</td>
        `;
        tbody.appendChild(tr);
    });
}