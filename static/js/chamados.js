/**
 * Chamados - Controle de Chamados
 * Sistema de Gerenciamento de Chamados para tratativa de prefixos de frota
 */

// ============================================================================
// CONFIGURAÇÕES E DADOS
// ============================================================================

// Configurações de níveis
const NIVEIS_CONFIG = {
    N0: { label: 'N0 - Abertura de Chamados (CCO)', dept: 'CCO', slaHoras: 24 },
    N1: { label: 'N1 - Verificação Chip (Atendimento)', dept: 'Atendimento', slaHoras: 24 },
    N2: { label: 'N2 - Base/Sistema (Business Intelligence)', dept: 'Business Intelligence', slaHoras: 48 },
    N3: { label: 'N3 - Checklist Elétrico (Operações)', dept: 'Operações', slaHoras: 72 },
    N4: { label: 'N4 - In Loco (Operações)', dept: 'Operações', slaHoras: 96 },
    N5: { label: 'N5 - Erros na Aplicação (TI)', dept: 'TI', slaHoras: 120 },
    N6: { label: 'N6 - Atualização da Aplicação (P&D)', dept: 'P&D', slaHoras: 168 },
    N7: { label: 'N7 - Aprovação Gerencial (Gerência)', dept: 'Gerência', slaHoras: 192 },
    N8: { label: 'N8 - Serviços Externos (Prestador)', dept: 'Prestador', slaHoras: 240 }
};

const STATUS_CONFIG = {
    aberto: { label: 'Aberto', class: 'status-aberto' },
    em_andamento: { label: 'Em Andamento', class: 'status-em_andamento' },
    pendente: { label: 'Pendente', class: 'status-pendente' },
    respondido: { label: 'Respondido', class: 'status-respondido' },
    atendido: { label: 'Atendido', class: 'status-atendido' },
    resolvido: { label: 'Resolvido', class: 'status-resolvido' },
    fechado: { label: 'Fechado', class: 'status-fechado' }
};

const TIPO_CONFIG = {
    manutencao: { label: 'Manutenção', icon: '🔧' },
    implementacao: { label: 'Implementação', icon: '🚀' }
};

// Fallback para tipos desconhecidos
const TIPO_DEFAULT = { label: 'Manutenção', icon: '🔧' };
function getTipoConfig(type) {
    return TIPO_CONFIG[type] || TIPO_DEFAULT;
}

// Classificações por departamento - Mapeamento atualizado
const CLASSIFICACOES_CONFIG = {
    'CCO': ['Acesso Remoto (N0)', 'Incidente de Segurança – Chip de Dados'],
    'Operações': ['Checklist Elétrico (N3)', 'Atendimento Externo (N4)'],
    'TI': ['Correção da aplicação'],
    'P&D': ['Atualizar Aplicação'],
    'Atendimento': ['Verificar chip', 'Incidente de Segurança - Bloquear Chip', 'Máquina está funcionando'],
    'Business Intelligence (BI)': ['Prefixo entrou em manutenção','Prefixo voltou para operação','Troca de máquina','Prefixo desativado','Maquina Sinistrada','Remanejamento','Atualização da Base do sistema'],
    'Prestador': ['Adesivação', 'Gesso', 'Instalação de Lousa', 'Instalação de lousa de vidro', 'Cabeamento estruturado'],
    'Gerência': ['Solicitações Administrativas']
};

// Mapeamento reverso: Classificação -> Nível de destino
const CLASSIFICACAO_NIVEL_MAP = {
    'Acesso Remoto (N0)': 'N0',
    'Incidente de Segurança – Chip de Dados': 'N0',
    'Checklist Elétrico (N3)': 'N3',
    'Atendimento Externo (N4)': 'N4',
    'Correção da aplicação': 'N5',
    'Atualizar Aplicação': 'N6',
    'Verificar chip': 'N1',
    'Incidente de Segurança - Bloquear Chip': 'N1',
    'Máquina está funcionando': 'N1',
    'Atualização da Base do sistema': 'N2',
    'Prefixo entrou em manutenção': 'N2',
    'Prefixo voltou para operação': 'N2',
    'Troca de máquina': 'N2',
    'Prefixo desativado': 'N2',
    'Maquina Sinistrada': 'N2',
    'Remanejamento': 'N2',
    'Adesivação': 'N8',
    'Gesso': 'N8',
    'Instalação de Lousa': 'N8',
    'Instalação de lousa de vidro': 'N8',
    'Cabeamento estruturado': 'N8',
    'Solicitações Administrativas': 'N7'
};

// API Base URL
const API_BASE = '/api/chamados';

// Função para normalizar dados do chamado da API
function normalizarChamado(c) {
    return {
        ...c,
        currentLevel: c.current_level || c.currentLevel,
        slaDate: c.sla_date || c.slaDate,
        slaCumprido: c.sla_cumprido ?? c.slaCumprido,
        createdAt: c.created_at || c.createdAt,
        updatedAt: c.updated_at || c.updatedAt,
        createdBy: c.created_by || c.createdBy,
        createdByName: c.created_by_name || c.createdByName,
        tecnicoResponsavel: c.tecnico_responsavel || c.tecnicoResponsavel,
        usuarioResponsavelEmail: c.usuario_responsavel_email || c.usuarioResponsavelEmail,
        usuarioResponsavelNome: c.usuario_responsavel_nome || c.usuarioResponsavelNome,
        departamentoDestino: c.departamento_destino || c.departamentoDestino || c.departamento,
        originChamadoId: c.origin_chamado_id || c.originChamadoId || null,
        createdFromTransition: c.created_from_transition ?? c.createdFromTransition ?? false,
        slaInfo: c.sla_info || c.slaInfo || {
            openedAt: c.created_at || c.createdAt,
            openedBy: c.created_by_name || c.createdByName,
            levelChanges: []
        }
    };
}

// Dados carregados
let chamados = [];
let departamentos = [];
let garagens = [];
let projetos = [];
let tecnicos = [];
let garagensPorProjeto = {}; // Mapeamento projeto -> garagens

// Estado atual
let chamadoSelecionado = null;
let acaoSelecionada = null;
let useApi = true; // Flag para tentar usar API ou fallback para mock
let filtroCardAtivo = null; // Filtro de card de estatísticas ativo

// Sistema de notificação em tempo real
let ultimosIdsChamados = new Set(); // Rastrear IDs dos chamados já conhecidos
let pollingInterval = null;
let notificationSound = null;
const POLLING_INTERVAL_MS = 30000; // ⚡ PERFORMANCE: Atualizar a cada 30 segundos (reduzido de 15s)
let _ultimoHashChamados = ''; // Hash para detectar se dados mudaram (evita re-render desnecessário)

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎫 Inicializando sistema de Chamados...');
    
    // Inicializar som de notificação
    inicializarSomNotificacao();
    
    // Inicializar listeners dos cards de estatísticas
    initStatCardListeners();
    
    // Tentar carregar dados da API, com fallback para dados mock
    carregarDados();
    
    // Iniciar polling para atualizações em tempo real
    iniciarPolling();
    
    // Resetar botão "Criar Chamado" sempre que o modal for aberto
    const modalNovoChamado = document.getElementById('modalNovoChamado');
    if (modalNovoChamado) {
        modalNovoChamado.addEventListener('shown.bs.modal', function() {
            const btn = document.getElementById('btnCriarChamado');
            if (btn) {
                btn.disabled = false;
                const icon = btn.querySelector('i');
                const span = btn.querySelector('span');
                if (icon) icon.className = 'fas fa-check me-2';
                if (span) span.textContent = 'Criar Chamado';
            }
        });
    }

    // Verificar se há um chamado específico para abrir (vindo da dashboard)
    setTimeout(function() {
        const chamadoIdDashboard = sessionStorage.getItem('chamadoIdParaAbrir');
        if (chamadoIdDashboard) {
            console.log('📋 Abrindo chamado da dashboard:', chamadoIdDashboard);
            sessionStorage.removeItem('chamadoIdParaAbrir');
            // Encontrar e selecionar o chamado após carregamento de dados
            const encontrarEAbrir = setInterval(() => {
                const chamado = chamados.find(c => c.id == chamadoIdDashboard);
                if (chamado) {
                    clearInterval(encontrarEAbrir);
                    selecionarChamado(chamado);
                    // Rolar até a visualização do chamado
                    document.querySelector('#detalhes-chamado')?.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
            // Timeout se não encontrar em 5 segundos
            setTimeout(() => clearInterval(encontrarEAbrir), 5000);
        }
    }, 1000);
    
    // ⚡ PERFORMANCE: Re-renderizar ao trocar de aba (já que só renderiza a aba ativa)
    ['dashboard-tab', 'kanban-tab', 'tabela-tab'].forEach(function(tabId) {
        var tabEl = document.getElementById(tabId);
        if (tabEl) {
            tabEl.addEventListener('shown.bs.tab', function() {
                console.log('📑 Aba trocada para:', tabId, '- re-renderizando');
                renderizarChamados(true);
            });
        }
    });
});

// ============================================================================
// SISTEMA DE NOTIFICAÇÃO EM TEMPO REAL
// ============================================================================

/**
 * Inicializa o som de notificação
 */
function inicializarSomNotificacao() {
    try {
        // Criar elemento de áudio para notificação
        notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiM0fPTgjMGHm7A7+OZSSA1UpjnyKNcHhBHm+DxvWkhBjeJ0fPTgDIGIG7A7+KZSSA1UpjnyqJcHhFFm+DxvWkhBjeJ0fPTgjIGH27A7+GZSSA1Upjny6NcHhBGm+DxvWkhBzeI0fPTgjMGHm7A7+KZSSA1UpjnyqNcHxBGm+DxvWkhBjeJ0fPTgjIGIG7A7+GZSSA1UpjnyqNcHhFFm+DxvWkhBjeI0fPTgjIGIG/A7+GZSSA1UpjnyqNcHhBGm+DxvWkhBjeJ0fPTgjIGH27A7+GZSSA1UpjnyqJcHhBGm+DxvWkhBjeI0fPTgjMGIG7A7+GZSSA1UpjnyKJcHhBGm+DxvWkhBzeI0fPTgjMGHm7A7+GZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGHm7A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeJ0fPUgjMGIG7A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGIG/A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+GZSSA1UpjnyqNcHhBGm+DxvWkhBzeJ0fPTgjMGHm7A7+GZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGHm7A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGIG/A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1Upjny6NcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZSSA1UpjnyqNcHhBGm+DxvWkhBzeI0fPTgjMGH27A7+KZ');
        notificationSound.volume = 0.5;
        console.log('🔔 Som de notificação inicializado');
    } catch (error) {
        console.warn('⚠️ Não foi possível inicializar som de notificação:', error);
    }
}

/**
 * Inicia o polling para atualizações em tempo real
 */
function iniciarPolling() {
    console.log('🔄 Iniciando polling para atualizações em tempo real...');
    
    // Limpar polling anterior se existir
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // Iniciar novo polling
    pollingInterval = setInterval(async () => {
        await atualizarChamadosEmTempoReal();
    }, POLLING_INTERVAL_MS);
    
    console.log(`✅ Polling iniciado (atualização a cada ${POLLING_INTERVAL_MS/1000}s)`);
}

/**
 * Atualiza chamados em tempo real e detecta novos chamados
 */
async function atualizarChamadosEmTempoReal() {
    try {
        // Mostrar indicador de atualização
        mostrarIndicadorAtualizacao();
        
        // Construir URL com parâmetros de controle de acesso
        const params = new URLSearchParams();
        if (typeof USER_EMAIL !== 'undefined') params.append('user_email', USER_EMAIL);
        if (typeof USER_DEPARTMENT !== 'undefined') params.append('user_departamento', USER_DEPARTMENT);
        if (typeof USER_ROLE !== 'undefined') params.append('is_admin', USER_ROLE === 'admin');
        // Adicionar empresas permitidas para filtro
        if (typeof USER_ALLOWED_COMPANIES !== 'undefined' && Array.isArray(USER_ALLOWED_COMPANIES) && USER_ALLOWED_COMPANIES.length > 0) {
            params.append('allowed_companies', JSON.stringify(USER_ALLOWED_COMPANIES));
        }
        
        const url = `${API_BASE}/?${params.toString()}`;
        
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            console.warn('⚠️ Erro ao atualizar chamados:', response.status);
            return;
        }
        
        const novosChamados = await response.json();
        const chamadosNormalizados = novosChamados.map(normalizarChamado);
        
        // ⚡ PERFORMANCE: Hash rápido sem sort()/join() — usa soma de hashes numéricos
        let _hashAcc = 0;
        for (let i = 0, len = chamadosNormalizados.length; i < len; i++) {
            const c = chamadosNormalizados[i];
            const key = `${c.id}:${c.status}:${c.currentLevel}:${c.usuarioResponsavelEmail || ''}`;
            let h = 0;
            for (let j = 0; j < key.length; j++) {
                h = ((h << 5) - h + key.charCodeAt(j)) | 0;
            }
            _hashAcc = (_hashAcc + (h >>> 0)) | 0;
        }
        const novoHash = String(_hashAcc) + ':' + chamadosNormalizados.length;
        
        // Detectar novos chamados
        const novosIds = new Set(chamadosNormalizados.map(c => c.id));
        const chamadosAdicionados = [];
        
        // Se é a primeira carga, apenas inicializar sem notificar
        if (ultimosIdsChamados.size === 0) {
            ultimosIdsChamados = novosIds;
            chamados = chamadosNormalizados;
            _ultimoHashChamados = novoHash;
            return;
        }
        
        // Verificar quais chamados são novos
        for (const chamado of chamadosNormalizados) {
            if (!ultimosIdsChamados.has(chamado.id)) {
                chamadosAdicionados.push(chamado);
            }
        }
        
        // Atualizar lista de IDs conhecidos
        ultimosIdsChamados = novosIds;
        
        // Atualizar array de chamados
        chamados = chamadosNormalizados;
        
        // Se há novos chamados, notificar
        if (chamadosAdicionados.length > 0) {
            notificarNovosChamados(chamadosAdicionados);
        }
        
        // 🔒 Se os dados NÃO mudaram, NÃO re-renderizar o DOM
        // Isso evita que o scroll volte ao topo quando não há alterações
        if (novoHash === _ultimoHashChamados) {
            console.log('🔄 Dados não mudaram, pulando re-render');
            return;
        }
        _ultimoHashChamados = novoHash;
        
        // 🔒 Preservar scroll durante re-render (DOM diffing evita scroll reset na maioria dos casos)
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        
        // Atualizar interface
        atualizarEstatisticas();
        renderizarChamados(true);
        
        // Restaurar scroll por segurança (DOM diffing deve preservar, mas garantir)
        if (scrollY > 50) {
            window.scrollTo(0, scrollY);
            // Segundo restore após próximo frame para cobrir reflows assíncronos
            requestAnimationFrame(() => {
                window.scrollTo(0, scrollY);
            });
        }
        
        console.log(`🔄 Atualização em tempo real: ${chamados.length} chamados (${chamadosAdicionados.length} novos)`);
        
    } catch (error) {
        console.warn('⚠️ Erro ao atualizar chamados em tempo real:', error);
    }
}

/**
 * Notifica o usuário sobre novos chamados
 */
function notificarNovosChamados(novosChamados) {
    console.log('🔔 Novos chamados detectados:', novosChamados.length);
    
    // Tocar som de notificação
    if (notificationSound) {
        try {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => {
                console.warn('⚠️ Não foi possível tocar som de notificação:', e);
            });
        } catch (error) {
            console.warn('⚠️ Erro ao tocar som:', error);
        }
    }
    
    // Mostrar notificação toast
    const mensagem = novosChamados.length === 1 
        ? `Novo chamado: ${novosChamados[0].id}` 
        : `${novosChamados.length} novos chamados recebidos`;
    
    mostrarToast(mensagem, 'info', 5000);
    
    // Destacar novos chamados na lista (adicionar classe temporária)
    setTimeout(() => {
        novosChamados.forEach(chamado => {
            const cardElement = document.querySelector(`[data-chamado-id="${chamado.id}"]`);
            if (cardElement) {
                cardElement.classList.add('chamado-novo-destaque');
                // Remover destaque após 10 segundos
                setTimeout(() => {
                    cardElement.classList.remove('chamado-novo-destaque');
                }, 10000);
            }
        });
    }, 500);
    
    // Tentar mostrar notificação do navegador (se permitido)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Novo Chamado', {
            body: mensagem,
            icon: '/static/logo.png',
            badge: '/static/logo.png'
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        // Solicitar permissão para notificações
        Notification.requestPermission();
    }
}

/**
 * Mostra indicador visual de atualização
 */
function mostrarIndicadorAtualizacao() {
    const indicator = document.getElementById('realtimeIndicator');
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
}

// ============================================================================
// CARREGAMENTO DE DADOS
// ============================================================================

// Variável para armazenar estado dos filtros entre recarregamentos
let estadoFiltrosAnterior = null;
// Flag para saber se os filtros já foram inicializados
let filtrosInicializados = false;

async function carregarDados() {
    // Salvar estado dos filtros antes de recarregar (se já estiver inicializado)
    if (filtrosInicializados) {
        estadoFiltrosAnterior = salvarEstadoFiltros();
        console.log('💾 Estado dos filtros salvo:', estadoFiltrosAnterior);
    }
    
    try {
        // Construir URL com parâmetros de controle de acesso
        const params = new URLSearchParams();
        if (typeof USER_EMAIL !== 'undefined') params.append('user_email', USER_EMAIL);
        if (typeof USER_DEPARTMENT !== 'undefined') params.append('user_departamento', USER_DEPARTMENT);
        if (typeof USER_ROLE !== 'undefined') params.append('is_admin', USER_ROLE === 'admin');
        // Adicionar empresas permitidas para filtro
        if (typeof USER_ALLOWED_COMPANIES !== 'undefined' && Array.isArray(USER_ALLOWED_COMPANIES) && USER_ALLOWED_COMPANIES.length > 0) {
            params.append('allowed_companies', JSON.stringify(USER_ALLOWED_COMPANIES));
        }
        
        const url = `${API_BASE}/?${params.toString()}`;
        
        // Carregar chamados da API
        const chamadosRes = await fetch(url, { credentials: 'include' });
        
        if (chamadosRes.ok) {
            chamados = await chamadosRes.json();
            // Normalizar campos da API para o formato esperado pelo frontend
            chamados = chamados.map(normalizarChamado);
            console.log('✅ Chamados carregados da API:', chamados.length);
            useApi = true;
        } else {
            throw new Error('API de chamados não disponível');
        }
        
        // Carregar garagens e projetos do mesmo endpoint usado no Dashboard (PowerBI - Dim_Serial)
        // ⚡ PERFORMANCE: Cache — só busca /api/data na primeira vez
        if (projetos.length === 0) {
        try {
            // Usar /api/equipment/all (sem filtros de empresa/projeto) para
            // que TODOS os departamentos vejam todos projetos/garagens ao criar chamados
            const dataRes = await fetch('/api/equipment/all', { credentials: 'include' });
            if (dataRes.ok) {
                const allEquipments = await dataRes.json();
                if (Array.isArray(allEquipments) && allEquipments.length > 0) {
                    // Extrair PROJETO e GARAGEM únicos dos dados do PowerBI (Dim_Serial)
                    const projetosSet = new Set();
                    const garagensSet = new Set();
                    garagensPorProjeto = {}; // Resetar mapeamento
                    
                    allEquipments.forEach(item => {
                        const projeto = item.PROJETO || item.projeto || item.Projeto;
                        const garagem = item.GARAGEM || item.garagem || item.Garagem;
                        if (projeto) {
                            projetosSet.add(projeto);
                            // Criar mapeamento projeto -> garagens
                            if (!garagensPorProjeto[projeto]) {
                                garagensPorProjeto[projeto] = new Set();
                            }
                            if (garagem) {
                                garagensPorProjeto[projeto].add(garagem);
                            }
                        }
                        if (garagem) garagensSet.add(garagem);
                    });
                    
                    // Converter Sets para Arrays ordenados
                    for (const proj in garagensPorProjeto) {
                        garagensPorProjeto[proj] = [...garagensPorProjeto[proj]].sort();
                    }
                    
                    projetos = [...projetosSet].sort();
                    garagens = [...garagensSet].sort();
                    
                    console.log('✅ Projetos carregados (equipment/all):', projetos.length);
                    console.log('✅ Garagens carregadas (equipment/all):', garagens.length);
                    console.log('✅ Mapeamento projeto->garagens criado:', Object.keys(garagensPorProjeto).length, 'projetos');
                } else {
                    console.warn('⚠️ Dados do PowerBI vazios ou inválidos');
                }
            } else {
                console.warn('⚠️ Não foi possível carregar dados do PowerBI');
            }
        } catch (optError) {
            console.warn('⚠️ Erro ao carregar dados do PowerBI:', optError.message);
        }
        } // fim do cache /api/equipment/all
        
        // Departamentos fixos (lista definida pelo cliente)
        departamentos = ['CCO', 'Operações', 'TI', 'P&D', 'Atendimento', 'Business Intelligence (BI)', 'Prestador', 'Gerência'];
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error.message);
        mostrarToast('Erro ao carregar dados. Verifique sua conexão.', 'danger');
        useApi = false;
        // Apenas carregar departamentos para filtros, sem dados mock
        departamentos = ['CCO', 'Operações', 'TI', 'P&D', 'Atendimento', 'Business Intelligence (BI)', 'Prestador', 'Gerência'];
    }
    
    // Configurar filtros e renderizar
    carregarFiltros();
    configurarEventosFiltro();
    
    // Restaurar estado dos filtros se existir
    if (estadoFiltrosAnterior) {
        restaurarEstadoFiltros(estadoFiltrosAnterior);
    }
    
    atualizarEstatisticas();
    renderizarChamados();
    
    console.log('✅ Sistema de Chamados inicializado');
}

// ============================================================================
// CARREGAMENTO DE FILTROS
// ============================================================================

/**
 * Salva o estado atual dos filtros
 */
function salvarEstadoFiltros() {
    return {
        filtroVisualizacao: document.getElementById('filtroVisualizacao')?.value || 'ativos',
        filtroSearch: document.getElementById('filtroSearch')?.value || '',
        filtroStatus: document.getElementById('filtroStatus')?.value || 'all',
        filtroNivel: document.getElementById('filtroNivel')?.value || 'all',
        filtroTipo: document.getElementById('filtroTipo')?.value || 'all',
        filtroGaragem: document.getElementById('filtroGaragem')?.value || 'all',
        filtroDepartamento: document.getElementById('filtroDepartamento')?.value || 'all',
        filtroCardAtivo: filtroCardAtivo
    };
}

/**
 * Restaura o estado dos filtros
 */
function restaurarEstadoFiltros(estado) {
    if (!estado) return;
    
    const campos = ['filtroVisualizacao', 'filtroSearch', 'filtroStatus', 'filtroNivel', 'filtroTipo', 'filtroGaragem', 'filtroDepartamento'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el && estado[id] !== undefined) {
            el.value = estado[id];
        }
    });
    
    // Restaurar filtro de card ativo
    filtroCardAtivo = estado.filtroCardAtivo;
}

function carregarFiltros() {
    // Se já inicializou os filtros, não inicializa novamente
    if (filtrosInicializados) {
        console.log('🔄 Filtros já inicializados, pulando...');
        return;
    }
    
    // Preencher filtros de garagem
    const filtroGaragem = document.getElementById('filtroGaragem');
    if (filtroGaragem) {
        // Limpar opções existentes (exceto a primeira "Todos")
        filtroGaragem.innerHTML = '<option value="all">Todas</option>';
        garagens.forEach(g => {
            filtroGaragem.innerHTML += `<option value="${g}">${g}</option>`;
        });
    }
    
    // Preencher filtros de departamento
    const filtroDepartamento = document.getElementById('filtroDepartamento');
    if (filtroDepartamento) {
        // Limpar opções existentes
        filtroDepartamento.innerHTML = '<option value="all">Todos</option>';
        departamentos.forEach(d => {
            filtroDepartamento.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }
    
    // Preencher selects do modal de novo chamado
    const novoProjeto = document.getElementById('novoProjeto');
    if (novoProjeto) {
        novoProjeto.innerHTML = '<option value="">Selecione o projeto...</option>';
        projetos.forEach(p => {
            novoProjeto.innerHTML += `<option value="${p}">${p}</option>`;
        });
    }
    
    // Evento de mudança de projeto para filtrar garagens
    if (novoProjeto) {
        novoProjeto.addEventListener('change', atualizarGaragensPorProjeto);
    }
    
    // Inicializar garagens (vazio até selecionar projeto)
    const novoGaragem = document.getElementById('novoGaragem');
    if (novoGaragem) {
        novoGaragem.innerHTML = '<option value="">Selecione um projeto primeiro...</option>';
    }
    
    // Preencher select de departamento destino
    const novoDepartamentoDestino = document.getElementById('novoDepartamentoDestino');
    if (novoDepartamentoDestino) {
        novoDepartamentoDestino.innerHTML = '<option value="">Selecione o departamento...</option>';
        departamentos.forEach(d => {
            novoDepartamentoDestino.innerHTML += `<option value="${d}">${d}</option>`;
        });
        
        // Evento de mudança de departamento para carregar classificações
        novoDepartamentoDestino.addEventListener('change', atualizarClassificacoes);
    }
    
    // Inicializar o estado de classificações (escondido por padrão)
    atualizarClassificacoes();
    
    // ========================================
    // PREENCHER SELECTS DO FORMULÁRIO DE MÚLTIPLOS CHAMADOS
    // ========================================
    const multiploProjeto = document.getElementById('multiploProjeto');
    if (multiploProjeto) {
        multiploProjeto.innerHTML = '<option value="">Selecione o projeto...</option>';
        projetos.forEach(p => {
            multiploProjeto.innerHTML += `<option value="${p}">${p}</option>`;
        });
    }
    
    const multiploDepartamento = document.getElementById('multiploDepartamento');
    if (multiploDepartamento) {
        multiploDepartamento.innerHTML = '<option value="">Selecione o departamento...</option>';
        departamentos.forEach(d => {
            multiploDepartamento.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }
    
    // ========================================
    // CONTROLAR VISIBILIDADE DOS BOTÕES BASEADO NA ABA ATIVA
    // ========================================
    const btnCriarChamado = document.getElementById('btnCriarChamado');
    const btnCriarMultiplos = document.getElementById('btnCriarMultiplos');
    const individualTab = document.getElementById('individual-tab');
    const multiploTab = document.getElementById('multiplo-tab');
    
    if (individualTab && multiploTab && btnCriarChamado && btnCriarMultiplos) {
        // Mostrar botão individual por padrão (aba individual está ativa)
        btnCriarChamado.style.display = 'block';
        btnCriarMultiplos.style.display = 'none';
        
        // Quando clicar na aba Individual
        individualTab.addEventListener('click', function() {
            btnCriarChamado.style.display = 'block';
            btnCriarMultiplos.style.display = 'none';
        });
        
        // Quando clicar na aba Múltiplos
        multiploTab.addEventListener('click', function() {
            btnCriarChamado.style.display = 'none';
            btnCriarMultiplos.style.display = 'block';
        });
    }
    
    // Marcar filtros como inicializados
    filtrosInicializados = true;
    console.log('✅ Filtros inicializados');
}

/**
 * Atualiza o select de garagens baseado no projeto selecionado
 * Se houver apenas uma garagem, seleciona automaticamente
 */
function atualizarGaragensPorProjeto() {
    const projetoSelect = document.getElementById('novoProjeto');
    const garagemSelect = document.getElementById('novoGaragem');
    const projetoSelecionado = projetoSelect.value;
    
    // Limpar opções atuais
    garagemSelect.innerHTML = '';
    
    if (!projetoSelecionado) {
        garagemSelect.innerHTML = '<option value="">Selecione um projeto primeiro...</option>';
        return;
    }
    
    // Buscar garagens do projeto selecionado
    const garagensDoProjeto = garagensPorProjeto[projetoSelecionado] || [];
    
    if (garagensDoProjeto.length === 0) {
        garagemSelect.innerHTML = '<option value="">Nenhuma garagem disponível</option>';
        return;
    }
    
    if (garagensDoProjeto.length === 1) {
        // Se tiver apenas uma garagem, já seleciona automaticamente
        garagemSelect.innerHTML = `<option value="${garagensDoProjeto[0]}" selected>${garagensDoProjeto[0]}</option>`;
    } else {
        // Se tiver mais de uma, mostra opção de seleção
        garagemSelect.innerHTML = '<option value="">Selecione a garagem...</option>';
        garagensDoProjeto.forEach(g => {
            garagemSelect.innerHTML += `<option value="${g}">${g}</option>`;
        });
    }
}

/**
 * Atualiza o select de classificações baseado no departamento selecionado
 * Mostra/oculta o container de classificação conforme necessário
 */
function atualizarClassificacoes() {
    const departamentoSelect = document.getElementById('novoDepartamentoDestino');
    const classificacaoSelect = document.getElementById('novaClassificacao');
    const classificacaoContainer = document.getElementById('novaClassificacaoContainer');
    const camposN4Container = document.getElementById('novoCamposN4Container');
    const departamentoSelecionado = departamentoSelect.value;
    
    // Limpar opções atuais
    classificacaoSelect.innerHTML = '<option value="">Selecione a classificação...</option>';
    
    if (!departamentoSelecionado) {
        classificacaoContainer.style.display = 'none';
        if (camposN4Container) camposN4Container.style.display = 'none';
        return;
    }
    
    // Esconder campos N4 ao mudar departamento
    if (camposN4Container) camposN4Container.style.display = 'none';
    
    // Buscar classificações do departamento selecionado
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamentoSelecionado] || [];
    
    if (classificacoesDoDept.length === 0) {
        // Se não há classificações, ocultar o container
        classificacaoContainer.style.display = 'none';
    } else {
        // Mostrar o container e preencher opções
        classificacaoContainer.style.display = 'block';
        classificacoesDoDept.forEach(c => {
            classificacaoSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }
}

/**
 * Chamado quando a classificação muda - detecta Atendimento Externo para N4
 */
function onNovaClassificacaoChange() {
    console.log('🔥 onNovaClassificacaoChange CHAMADA');
    
    const classificacaoSelect = document.getElementById('novaClassificacao');
    const camposN4Container = document.getElementById('novoCamposN4Container');
    
    console.log('📌 Classificação selecionada:', classificacaoSelect ? classificacaoSelect.value : 'SELECT NÃO ENCONTRADO');
    console.log('📌 Container N4 encontrado:', camposN4Container ? 'SIM' : 'NÃO');
    
    if (!classificacaoSelect || !camposN4Container) {
        console.error('❌ Elementos não encontrados!');
        return;
    }
    
    // Atendimento Externo = N4 (In Loco) - precisa de técnico e equipe
    // A classificação vem com o sufixo (N4), então verificamos com e sem o sufixo
    if (classificacaoSelect.value === 'Atendimento Externo' || classificacaoSelect.value === 'Atendimento Externo (N4)') {
        camposN4Container.style.display = 'block';
        carregarTecnicosParaNovoChamado();
        console.log('✅ Classificação Atendimento Externo: Campos N4 exibidos');
    } else {
        camposN4Container.style.display = 'none';
        console.log('ℹ️ Classificação diferente de Atendimento Externo - N4 escondido');
    }
    
    // Verificar chip = N1 (Atendimento) - preencher dados do chip automaticamente
    if (classificacaoSelect.value === 'Verificar chip') {
        console.log('📋 Classificação Verificar chip detectada, preenchendo dados...');
        preencherDadosChipNovoChamado();
    }
}

/**
 * Preenche automaticamente os dados do chip na descrição do novo chamado (Verificação de Chip)
 */
async function preencherDadosChipNovoChamado() {
    const patrimonioInput = document.getElementById('novoPatrimonio');
    const prefixoInput = document.getElementById('novoPrefixo');
    const descricaoInput = document.getElementById('novoDescricao');
    
    if (!patrimonioInput || !descricaoInput) {
        console.error('❌ Campos do formulário não encontrados');
        return;
    }
    
    const patrimonio = patrimonioInput.value.trim();
    const prefixo = prefixoInput ? prefixoInput.value.trim() : '';
    
    if (!patrimonio) {
        console.log('📋 [N1] Patrimônio não informado ainda');
        mostrarToast('Preencha o patrimônio para buscar dados do chip automaticamente', 'info');
        return;
    }
    
    console.log('📋 [N1] Buscando dados do chip para patrimônio:', patrimonio);
    
    try {
        const response = await fetch('/api/email/reforco-sinal/data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                patrimonios: [patrimonio]
            })
        });
        
        if (!response.ok) {
            console.error('❌ Erro ao buscar dados do chip:', response.status);
            return;
        }
        
        const data = await response.json();
        console.log('📋 [N1] Dados recebidos:', data);
        
        // A API retorna array direto, não {dados: [...]}
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log('📋 [N1] Nenhum dado de chip encontrado para o patrimônio');
            return;
        }
        
        // Pegar dados do chip
        const chipData = data[0];
        
        // Construir saudação baseada no horário
        const saudacao = getSaudacaoHorario();
        
        // Construir texto com dados do chip (formato padrão)
        const textoChip = `${saudacao}

Por gentileza, realizar a verificação de sinal no CHIP:

PATRIMÔNIO:    ${chipData.Patrimonio || patrimonio}
IMEI MODEM:    ${chipData.IMEI_MODEM_1 || '-'}
IMEI CHIP:     ${chipData.IMEI_CHIP_1 || '-'}
Nº TELEFONE:   ${chipData.N_TELEFONE_1 || '-'}
OPERADORA:     ${chipData.OPERADORA_1 || '-'}`;
        
        // Preencher descrição (se estiver vazio ou apenas com texto padrão)
        if (!descricaoInput.value.trim() || descricaoInput.value.trim() === '') {
            descricaoInput.value = textoChip;
            console.log('📋 [N1] Dados do chip preenchidos na descrição');
            mostrarToast('Dados do chip preenchidos automaticamente', 'success');
        } else {
            // Adicionar ao final se já houver texto
            descricaoInput.value += '\n\n' + textoChip;
            console.log('📋 [N1] Dados do chip adicionados à descrição');
            mostrarToast('Dados do chip adicionados à descrição', 'success');
        }
        
        // Disparar evento de input para que o formulário reconheça o texto
        descricaoInput.dispatchEvent(new Event('input', { bubbles: true }));
        descricaoInput.dispatchEvent(new Event('change', { bubbles: true }));
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados do chip:', error);
    }
}

/**
 * Carrega técnicos para o formulário de novo chamado
 */
async function carregarTecnicosParaNovoChamado() {
    const selectTecnico = document.getElementById('novoTecnicoResponsavel');
    const selectEquipe = document.getElementById('novoEquipeEmails');
    
    if (!selectTecnico || !selectEquipe) return;
    
    // Se já carregou técnicos globais, usar esses
    if (tecnicos.length > 0) {
        preencherSelectsTecnicosNovoChamado();
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
            tecnicos = Array.isArray(data) ? data : (data.tecnicos || []);
            console.log('Técnicos carregados para novo chamado:', tecnicos.length);
            preencherSelectsTecnicosNovoChamado();
        }
    } catch (error) {
        console.error('Erro ao carregar técnicos:', error);
    }
}

/**
 * Preenche os selects de técnico e equipe no formulário de novo chamado
 */
function preencherSelectsTecnicosNovoChamado() {
    const selectTecnico = document.getElementById('novoTecnicoResponsavel');
    const selectEquipe = document.getElementById('novoEquipeEmails');
    
    if (!selectTecnico || !selectEquipe) return;
    
    selectTecnico.innerHTML = '<option value="">Selecione o técnico...</option>';
    selectEquipe.innerHTML = '';
    
    tecnicos.forEach(t => {
        const nome = t.nome || t.name || t.email;
        selectTecnico.innerHTML += `<option value="${t.email}">${nome}</option>`;
        selectEquipe.innerHTML += `<option value="${t.email}">${nome}</option>`;
    });
}

// ============================================================================
// FUNÇÕES DO FORMULÁRIO DE MÚLTIPLOS CHAMADOS
// ============================================================================

/**
 * Atualiza garagens quando o projeto é selecionado no formulário de múltiplos
 */
function onMultiploProjetoChange() {
    const projetoSelect = document.getElementById('multiploProjeto');
    const garagemSelect = document.getElementById('multiploGaragem');
    const projetoSelecionado = projetoSelect ? projetoSelect.value : '';
    
    if (!garagemSelect) return;
    
    // Limpar opções atuais
    garagemSelect.innerHTML = '';
    
    if (!projetoSelecionado) {
        garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        return;
    }
    
    // Buscar garagens do projeto selecionado
    const garagensDoProjeto = garagensPorProjeto[projetoSelecionado] || [];
    
    if (garagensDoProjeto.length === 0) {
        garagemSelect.innerHTML = '<option value="">Nenhuma garagem disponível</option>';
        return;
    }
    
    // Adicionar opção de seleção
    garagemSelect.innerHTML = '<option value="">Selecione a garagem...</option>';
    garagensDoProjeto.forEach(g => {
        garagemSelect.innerHTML += `<option value="${g}">${g}</option>`;
    });
}

/**
 * Atualiza classificações quando o departamento é selecionado no formulário de múltiplos
 */
function onMultiploDepartamentoChange() {
    const departamentoSelect = document.getElementById('multiploDepartamento');
    const classificacaoSelect = document.getElementById('multiploClassificacao');
    const classificacaoContainer = document.getElementById('multiploClassificacaoContainer');
    const camposN4Container = document.getElementById('multiploCamposN4Container');
    const departamentoSelecionado = departamentoSelect ? departamentoSelect.value : '';
    
    if (!classificacaoSelect || !classificacaoContainer) return;
    
    // Limpar opções atuais
    classificacaoSelect.innerHTML = '<option value="">Selecione a classificação...</option>';
    
    if (!departamentoSelecionado) {
        classificacaoContainer.style.display = 'none';
        if (camposN4Container) camposN4Container.style.display = 'none';
        return;
    }
    
    // Esconder campos N4 ao mudar departamento
    if (camposN4Container) camposN4Container.style.display = 'none';
    
    // Buscar classificações do departamento selecionado
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamentoSelecionado] || [];
    
    if (classificacoesDoDept.length === 0) {
        // Se não há classificações, ocultar o container
        classificacaoContainer.style.display = 'none';
    } else {
        // Mostrar o container e preencher opções
        classificacaoContainer.style.display = 'block';
        classificacoesDoDept.forEach(c => {
            classificacaoSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }
}

// ============================================================================
// EVENTOS E FILTROS
// ============================================================================

// Flag para saber se os eventos de filtro já foram configurados
let eventosFiltroConfigurados = false;

function configurarEventosFiltro() {
    // Se já configurou os eventos, não configura novamente
    if (eventosFiltroConfigurados) {
        console.log('🔄 Eventos de filtro já configurados, pulando...');
        return;
    }
    
    // Eventos de filtro em tempo real
    ['filtroVisualizacao', 'filtroSearch', 'filtroStatus', 'filtroNivel', 'filtroTipo', 'filtroGaragem', 'filtroDepartamento'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'filtroSearch') {
                // Busca textual: só dispara ao pressionar Enter ou clicar no botão lupa
                element.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFiltros();
                    }
                });
            } else {
                element.addEventListener('change', aplicarFiltros);
            }
        }
    });
    
    eventosFiltroConfigurados = true;
    console.log('✅ Eventos de filtro configurados');
}

function aplicarFiltros() {
    renderizarChamados();
}

function limparFiltros() {
    document.getElementById('filtroVisualizacao').value = 'ativos';
    document.getElementById('filtroSearch').value = '';
    document.getElementById('filtroStatus').value = 'all';
    document.getElementById('filtroNivel').value = 'all';
    document.getElementById('filtroTipo').value = 'all';
    document.getElementById('filtroGaragem').value = 'all';
    document.getElementById('filtroDepartamento').value = 'all';
    const filtroOrigem = document.getElementById('filtroOrigem');
    if (filtroOrigem) filtroOrigem.value = 'all';
    aplicarFiltros();
    mostrarToast('Filtros limpos', 'info');
}

/**
 * Verifica se o usuário/departamento participou do chamado (no histórico)
 * Retorna true se o usuário ou departamento está no histórico
 */
function usuarioParticipouDoChamado(chamado, userEmail, userDepartment) {
    if (!chamado) return false;
    
    const emailLower = (userEmail || '').toLowerCase();
    const deptLower = (userDepartment || '').toLowerCase();
    
    // Verificar se é o criador
    if (emailLower && chamado.created_by && chamado.created_by.toLowerCase() === emailLower) {
        return true;
    }
    if (emailLower && chamado.createdBy && chamado.createdBy.toLowerCase() === emailLower) {
        return true;
    }
    
    // Verificar no histórico se participou em algum momento
    const history = chamado.history || [];
    for (const evento of history) {
        // Verificar por email
        if (emailLower) {
            const responsibleEmail = (evento.responsible_email || evento.responsibleEmail || '').toLowerCase();
            if (responsibleEmail === emailLower) {
                return true;
            }
        }
        // Verificar por departamento (através do nível)
        if (deptLower && evento.level) {
            const nivelConfig = NIVEIS_CONFIG[evento.level];
            if (nivelConfig && nivelConfig.dept && nivelConfig.dept.toLowerCase() === deptLower) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Busca a última ação realizada pelo departamento do usuário neste chamado
 * Retorna { acao, data, responsavel, statusEtapa } ou null
 */
function getMinhaUltimaAcao(chamado, userDepartment) {
    if (!chamado || !userDepartment) return null;
    
    const history = chamado.history || [];
    const deptLower = userDepartment.toLowerCase();
    
    // Ordenar histórico do mais recente para o mais antigo
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const evento of sortedHistory) {
        // Verificar se o evento foi no departamento do usuário
        if (evento.level) {
            const nivelConfig = NIVEIS_CONFIG[evento.level];
            if (nivelConfig && nivelConfig.dept && nivelConfig.dept.toLowerCase() === deptLower) {
                return {
                    acao: evento.action || 'Ação registrada',
                    data: evento.date,
                    responsavel: evento.responsible || 'Sistema',
                    nivel: evento.level,
                    notes: evento.notes,
                    // Novo campo: status_etapa_remetente indica que o remetente concluiu sua etapa
                    statusEtapa: evento.status_etapa_remetente || null,
                    deptoOrigem: evento.depto_origem || null,
                    deptoDestino: evento.depto_destino || null
                };
            }
        }
        // Também verificar por depto_origem para encaminhamentos
        if (evento.depto_origem) {
            if (evento.depto_origem.toLowerCase() === deptLower) {
                return {
                    acao: evento.action || 'Ação registrada',
                    data: evento.date,
                    responsavel: evento.responsible || 'Sistema',
                    nivel: evento.level,
                    notes: evento.notes,
                    statusEtapa: evento.status_etapa_remetente || null,
                    deptoOrigem: evento.depto_origem || null,
                    deptoDestino: evento.depto_destino || null
                };
            }
        }
    }
    
    return null;
}

/**
 * Verifica se o chamado está atualmente no departamento do usuário
 */
function chamadoNoMeuDepartamento(chamado, userDepartment) {
    if (!userDepartment) return true;
    const deptChamado = chamado.departamento_destino || chamado.departamentoDestino || chamado.departamento || '';
    return deptChamado.toLowerCase() === userDepartment.toLowerCase();
}

/**
 * Retorna o modo de visualização atual
 */
function getModoVisualizacao() {
    // Com a nova estrutura de seções, sempre retornamos 'todos' para carregar todos os chamados
    // A separação é feita na renderização por seções
    return 'todos';
}

function getChamadosFiltrados() {
    const visualizacao = getModoVisualizacao();
    const search = document.getElementById('filtroSearch')?.value?.toLowerCase() || '';
    const status = document.getElementById('filtroStatus')?.value || 'all';
    const nivel = document.getElementById('filtroNivel')?.value || 'all';
    const tipo = document.getElementById('filtroTipo')?.value || 'all';
    const garagem = document.getElementById('filtroGaragem')?.value || 'all';
    const departamento = document.getElementById('filtroDepartamento')?.value || 'all';
    
    console.log('🔍 Filtrando chamados - visualizacao:', visualizacao, 'user_dept:', USER_DEPARTMENT, '- total:', chamados.length);
    
    // ⚡ PERFORMANCE: Pre-computar set de participação para evitar O(H) scan por chamado
    const userEmailLower = (typeof USER_EMAIL !== 'undefined' ? USER_EMAIL : '').toLowerCase();
    const userDeptLower = (typeof USER_DEPARTMENT !== 'undefined' ? USER_DEPARTMENT : '').toLowerCase();
    let participouSet = null;
    if (!IS_ADMIN) {
        participouSet = new Set();
        for (let i = 0, len = chamados.length; i < len; i++) {
            const c = chamados[i];
            if (userEmailLower) {
                const cb = (c.created_by || c.createdBy || '').toLowerCase();
                if (cb === userEmailLower) { participouSet.add(c.id); continue; }
            }
            const history = c.history || [];
            for (let j = 0; j < history.length; j++) {
                const h = history[j];
                if (userEmailLower && (h.responsible_email || h.responsibleEmail || '').toLowerCase() === userEmailLower) {
                    participouSet.add(c.id); break;
                }
                if (userDeptLower && h.level) {
                    const nc = NIVEIS_CONFIG[h.level];
                    if (nc && nc.dept && nc.dept.toLowerCase() === userDeptLower) {
                        participouSet.add(c.id); break;
                    }
                }
            }
        }
    }
    
    let filtrados = chamados.filter(c => {
        // ============================================
        // FILTRO POR VISUALIZAÇÃO (Ativos/Histórico)
        // ============================================
        const deptCh = (c.departamento_destino || c.departamentoDestino || c.departamento || '').toLowerCase();
        const noMeuDept = userDeptLower ? deptCh === userDeptLower : true;
        
        if (!IS_ADMIN) {
            const participei = participouSet.has(c.id);
            if (visualizacao === 'ativos') {
                if (!noMeuDept) return false;
            } else if (visualizacao === 'historico') {
                if (!participei || noMeuDept) return false;
            } else if (visualizacao === 'todos') {
                if (!noMeuDept && !participei) return false;
            }
        }
        
        // ============================================
        // FILTROS GERAIS
        // ============================================
        
        // Busca textual
        if (search && !(
            c.id.toLowerCase().includes(search) ||
            c.prefixo.toLowerCase().includes(search) ||
            c.patrimonio.toLowerCase().includes(search) ||
            (c.description || '').toLowerCase().includes(search)
        )) return false;
        
        // Filtros de select
        if (status !== 'all' && c.status !== status) return false;
        if (nivel !== 'all' && c.currentLevel !== nivel) return false;
        if (tipo !== 'all' && c.type !== tipo) return false;
        if (garagem !== 'all' && c.garagem !== garagem) return false;
        const deptDestino = c.departamento_destino || c.departamentoDestino || c.departamento;
        if (departamento !== 'all' && deptDestino !== departamento) return false;
        
        // Filtro de origem (original/transição)
        const origem = document.getElementById('filtroOrigem')?.value || 'all';
        if (origem === 'originais' && c.createdFromTransition) return false;
        if (origem === 'transicoes' && !c.createdFromTransition) return false;
        
        return true;
    });
    
    // Aplicar filtro de card se ativo
    if (filtroCardAtivo) {
        const chamadosFiltradosPorCard = filtrarPorCard(filtroCardAtivo);
        // ⚡ PERFORMANCE: Usar Set para lookup O(1) em vez de .some() O(N)
        const idsPermitidos = new Set(chamadosFiltradosPorCard.map(fc => fc.id));
        filtrados = filtrados.filter(c => idsPermitidos.has(c.id));
    }
    
    return filtrados;
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

function calcularEstatisticas() {
    // Usar apenas os chamados já filtrados pela API (que respeita user_departamento)
    const hoje = new Date();
    
    // ⚡ PERFORMANCE: Single-pass — conta status + SLA em uma única iteração
    let slaOk = 0;
    let slaExcedido = 0;
    let abertos = 0;
    let emAndamento = 0;
    let pendentesCount = 0;
    let respondidos = 0;
    let resolvidos = 0;
    
    for (let i = 0, len = chamados.length; i < len; i++) {
        const c = chamados[i];
        const st = c.status;
        
        // Contagem de status
        switch (st) {
            case 'aberto':       abertos++;       break;
            case 'em_andamento': emAndamento++;    break;
            case 'pendente':     pendentesCount++; break;
            case 'respondido':   respondidos++;    break;
            case 'atendido':     resolvidos++;     break;
            case 'resolvido':
            case 'fechado':      resolvidos++;     break;
        }
        
        // Contagem de SLA
        // ⚡ FIX: Incluir TODOS os chamados no cálculo de SLA (inclusive resolvidos/fechados)
        // para que o total bata: resolvidos = slaOk + slaExcedido
        if (c.slaCumprido === true) {
            slaOk++;
        } else if (c.slaCumprido === false) {
            slaExcedido++;
        } else {
            // Chamados sem slaCumprido definido: calcular baseado na data
            const slaDateTime = parseSlaDate(c);
            if (slaDateTime) {
                if (slaDateTime < hoje) {
                    slaExcedido++;
                } else {
                    slaOk++;
                }
            }
            // Se não tem slaDateTime, não conta em nenhum contador de SLA
        }
    }
    
    const stats = {
        total: chamados.length,
        abertos: abertos,
        emAndamento: emAndamento,
        pendentes: pendentesCount,
        respondidos: respondidos,
        resolvidos: resolvidos,
        slaCumprido: slaOk,
        slaExcedido: slaExcedido
    };
    
    console.log('📊 Estatísticas calculadas:', stats, 'Total de chamados carregados:', chamados.length);
    
    return stats;
}

function atualizarEstatisticas() {
    const stats = calcularEstatisticas();
    
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statAbertos').textContent = stats.abertos;
    document.getElementById('statEmAndamento').textContent = stats.emAndamento;
    document.getElementById('statPendentes').textContent = stats.pendentes;
    const respondidosEl = document.getElementById('statRespondidos');
    if (respondidosEl) respondidosEl.textContent = stats.respondidos;
    document.getElementById('statResolvidos').textContent = stats.resolvidos;
    document.getElementById('statSlaCumprido').textContent = stats.slaCumprido;
    document.getElementById('statSlaExcedido').textContent = stats.slaExcedido;
}

// Helper para parsear data de SLA (duplicada aqui pois precisa estar definida antes de ser usada)
function parseSlaDate(chamado) {
    const slaValue = chamado.slaDate || chamado.sla_date;
    if (!slaValue) return null;
    
    // Se já é um Date object
    if (slaValue instanceof Date) return slaValue;
    
    // Se é string, parsear
    if (typeof slaValue === 'string') {
        // Se tem 'T' é datetime ISO completo
        if (slaValue.includes('T')) {
            return new Date(slaValue);
        }
        // Se é só data (YYYY-MM-DD), adicionar horário padrão do SLA (17:00)
        if (/^\d{4}-\d{2}-\d{2}$/.test(slaValue)) {
            return new Date(slaValue + 'T17:00:00');
        }
        // Tentar parsear como está
        return new Date(slaValue);
    }
    
    return null;
}

// Filtrar chamados por card clicado
function filtrarPorCard(filtro) {
    const hoje = new Date();
    
    if (filtro === 'all' || !filtro) {
        return chamados;
    }
    
    if (filtro === 'sla_ok') {
        return chamados.filter(c => {
            if (c.slaCumprido === true) return true;
            if (c.slaCumprido === null && c.status !== 'resolvido' && c.status !== 'fechado') {
                const slaDate = parseSlaDate(c);
                if (slaDate) {
                    return slaDate >= hoje;
                }
            }
            return false;
        });
    }
    
    if (filtro === 'sla_excedido') {
        return chamados.filter(c => {
            if (c.slaCumprido === false) return true;
            if (c.slaCumprido === null && c.status !== 'resolvido' && c.status !== 'fechado') {
                const slaDate = parseSlaDate(c);
                if (slaDate) {
                    return slaDate < hoje;
                }
            }
            return false;
        });
    }
    
    if (filtro === 'resolvido') {
        return chamados.filter(c => c.status === 'resolvido' || c.status === 'fechado');
    }
    
    return chamados.filter(c => c.status === filtro);
}

// Handler para clique nos cards de estatísticas
function onStatCardClick(e) {
    const card = e.currentTarget;
    const filtro = card.dataset.filter;
    
    // Toggle: se clicar no mesmo card ativo, desativa o filtro
    if (filtroCardAtivo === filtro) {
        filtroCardAtivo = null;
        document.querySelectorAll('.clickable-stat-card').forEach(c => c.classList.remove('active'));
        renderizarChamados();
        return;
    }
    
    // Ativar o card clicado
    document.querySelectorAll('.clickable-stat-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    
    filtroCardAtivo = filtro;
    renderizarChamados();
}

// Inicializar listeners dos cards
function initStatCardListeners() {
    document.querySelectorAll('.clickable-stat-card').forEach(card => {
        card.addEventListener('click', onStatCardClick);
    });
}

// ============================================================================
// RENDERIZAÇÃO
// ============================================================================

function renderizarChamados(skipScroll) {
    // 🔒 Salvar posição do scroll antes de atualizar
    const savedScrollY = !skipScroll ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
    
    const filtrados = getChamadosFiltrados();
    const visualizacao = getModoVisualizacao();
    
    // Atualizar contador total
    document.getElementById('countChamados').textContent = filtrados.length;
    
    // ⚡ PERFORMANCE: Detectar aba ativa e renderizar APENAS essa view
    var abaAtiva = 'dashboard'; // default
    var kanbanTab = document.getElementById('kanban-tab');
    var tabelaTab = document.getElementById('tabela-tab');
    if (kanbanTab && kanbanTab.classList.contains('active')) {
        abaAtiva = 'kanban';
    } else if (tabelaTab && tabelaTab.classList.contains('active')) {
        abaAtiva = 'tabela';
    }
    
    if (abaAtiva === 'kanban') {
        renderizarKanban(filtrados.filter(c => c.status !== 'resolvido' && c.status !== 'fechado'));
    } else if (abaAtiva === 'tabela') {
        renderizarTabela(filtrados, visualizacao);
    } else {
        // Grid (dashboard) — usa DOM diffing
        renderizarGridPorSecoes(filtrados);
    }
    
    // 🔒 Restaurar posição do scroll após atualização (segurança extra)
    if (!skipScroll && savedScrollY > 50) {
        window.scrollTo(0, savedScrollY);
        requestAnimationFrame(() => {
            window.scrollTo(0, savedScrollY);
        });
    }
}

/**
 * Renderiza os chamados organizados em seções
 */
function renderizarGridPorSecoes(todosChamados) {
    const userEmail = (typeof USER_EMAIL !== 'undefined' ? USER_EMAIL : '').toLowerCase().trim();
    
    // ⚡ PERFORMANCE: Pre-computar Set de chamados onde o usuário trabalhou
    // Evita scan O(H) no histórico de cada chamado dentro do loop de classificação
    const trabalheiSet = new Set();
    const crieiSet = new Set();
    for (let i = 0, len = todosChamados.length; i < len; i++) {
        const c = todosChamados[i];
        const cb = (c.createdBy || c.created_by || '').toLowerCase().trim();
        if (cb === userEmail) crieiSet.add(c.id);
        
        if (c.history) {
            for (let j = 0; j < c.history.length; j++) {
                const histEmail = (c.history[j].responsible_email || '').toLowerCase().trim();
                if (histEmail === userEmail) { trabalheiSet.add(c.id); break; }
            }
        }
        if (!trabalheiSet.has(c.id) && c.slaInfo && c.slaInfo.levelChanges) {
            for (let j = 0; j < c.slaInfo.levelChanges.length; j++) {
                const lc = c.slaInfo.levelChanges[j];
                const changedByEmail = (lc.changed_by_email || lc.changedByEmail || '').toLowerCase().trim();
                const changedBy = (lc.changed_by || lc.changedBy || '').toLowerCase().trim();
                if (changedByEmail === userEmail || changedBy === userEmail) { trabalheiSet.add(c.id); break; }
            }
        }
    }
    
    // Classificar chamados em categorias
    const meusEmAtendimento = [];  // Chamados onde EU sou o responsável e status = em_andamento
    const pendentes = [];          // Chamados com status = pendente (aguardando resposta)
    const respondidos = [];        // Chamados com status = respondido (apenas CCO)
    const novosDisponiveis = [];   // Chamados abertos/atendidos sem responsável (disponíveis para assumir)
    const historico = [];          // Chamados finalizados ou onde já atuei
    
    // Detectar se o usuário é do departamento CCO
    const isCCO = (typeof USER_DEPARTMENT !== 'undefined' && USER_DEPARTMENT.toUpperCase() === 'CCO');
    
    todosChamados.forEach(c => {
        const responsavelEmail = (c.usuarioResponsavelEmail || c.usuario_responsavel_email || '').toLowerCase().trim();
        const souResponsavel = responsavelEmail === userEmail;
        const statusChamado = c.status;
        
        // ⚡ PERFORMANCE: Usar Sets pre-computados em vez de scan O(H) por chamado
        const trabalheiNeste = trabalheiSet.has(c.id);
        const crieiEste = crieiSet.has(c.id);
        
        // Para classificação de histórico: trabalhei OU criei
        const deveAparecerNoHistorico = trabalheiNeste || crieiEste;
        
        // Usar flags do backend se disponíveis
        const canAssume = c.can_assume === true;
        const readOnly = c.read_only === true;
        const visibilityContext = c.visibility_context || 'active';
        
        // Classificar o chamado
        // ⚡ PRIORIDADE: Chamados RESPONDIDO para CCO (deve vir ANTES de canAssume e outras regras)
        if (statusChamado === 'respondido' && isCCO) {
            // CCO: chamados respondidos vão para seção dedicada
            respondidos.push(c);
        } else if (statusChamado === 'em_andamento' && souResponsavel) {
            // Meu chamado em atendimento
            meusEmAtendimento.push(c);
        } else if (statusChamado === 'pendente' && (souResponsavel || deveAparecerNoHistorico)) {
            // Pendente (aguardando resposta de alguém) - só mostro se sou responsável ou trabalhei/criei
            // Se backend diz que é histórico (chamado em outro dept), respeitar
            if (visibilityContext === 'history' || readOnly) {
                historico.push(c);
            } else {
                pendentes.push(c);
            }
        } else if (statusChamado === 'aberto' && souResponsavel) {
            // Chamado delegado para mim mas ainda não assumi (status aberto + sou responsável)
            // Deve aparecer como "novo" para eu poder assumir e começar a trabalhar
            novosDisponiveis.push(c);
        } else if (canAssume && !readOnly) {
            // Backend diz que posso assumir - vai para Novos
            novosDisponiveis.push(c);
        } else if (visibilityContext === 'history' || readOnly) {
            // Backend diz que é histórico ou read_only
            historico.push(c);
        } else if ((statusChamado === 'aberto' || statusChamado === 'atendido' || statusChamado === 'respondido') && !responsavelEmail) {
            // Fallback: Novo/Disponível para assumir
            novosDisponiveis.push(c);
        } else if (statusChamado === 'resolvido' || statusChamado === 'fechado') {
            // Chamados finalizados vão para o histórico
            historico.push(c);
        } else if (deveAparecerNoHistorico) {
            // Chamado onde trabalhei ou criei - vai pro histórico
            historico.push(c);
        } else if ((statusChamado === 'aberto' || statusChamado === 'atendido' || statusChamado === 'respondido') && responsavelEmail) {
            // Chamado com responsável (outro usuário assumiu) - vai pro histórico se trabalhei/criei
            if (deveAparecerNoHistorico) {
                historico.push(c);
            } else if (typeof IS_ADMIN !== 'undefined' && IS_ADMIN) {
                // Admin vê chamados assumidos por outros na seção adequada
                novosDisponiveis.push(c);
            }
        } else {
            // Catch-all: chamados que não caíram em nenhuma regra acima
            // Admin: mostrar em Novos/Disponíveis para ter visibilidade total
            // Outros: mostrar no histórico
            if (typeof IS_ADMIN !== 'undefined' && IS_ADMIN) {
                if (statusChamado === 'em_andamento') {
                    meusEmAtendimento.push(c);
                } else {
                    novosDisponiveis.push(c);
                }
            } else {
                historico.push(c);
            }
        }
    });
    
    // Atualizar contadores
    document.getElementById('countMeusAtendimentos').textContent = meusEmAtendimento.length;
    document.getElementById('countPendentes').textContent = pendentes.length;
    document.getElementById('countNovos').textContent = novosDisponiveis.length;
    document.getElementById('countHistorico').textContent = historico.length;
    
    // CCO: atualizar contador de respondidos se a seção existir
    const countRespondidosEl = document.getElementById('countRespondidos');
    if (countRespondidosEl) {
        countRespondidosEl.textContent = respondidos.length;
    }
    
    // ⚡ PERFORMANCE: Todas as seções paginadas com limite de 10 cards
    renderizarSecaoPaginada('gridMeusAtendimentos', meusEmAtendimento, 'atendimento', 10);
    renderizarSecaoPaginada('gridPendentes', pendentes, 'pendente', 10);
    if (document.getElementById('gridRespondidos')) {
        renderizarSecaoPaginada('gridRespondidos', respondidos, 'respondido', 10);
    }
    renderizarSecaoPaginada('gridNovos', novosDisponiveis, 'novo', 10);
    renderizarSecaoPaginada('gridHistorico', historico, 'historico', 10);
    
    // Mostrar/ocultar seções vazias
    toggleSecaoVazia('secaoMeusAtendimentos', meusEmAtendimento.length === 0);
    toggleSecaoVazia('secaoPendentes', pendentes.length === 0);
    toggleSecaoVazia('secaoNovos', novosDisponiveis.length === 0);
    if (document.getElementById('secaoRespondidos')) {
        toggleSecaoVazia('secaoRespondidos', respondidos.length === 0);
    }
    // Histórico sempre visível mas colapsado por padrão
}

/**
 * Renderiza uma seção específica de chamados (com DOM diffing para evitar scroll reset)
 */
function renderizarSecao(containerId, chamadosList, tipoSecao) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (chamadosList.length === 0) {
        const mensagens = {
            'atendimento': '<i class="fas fa-check-circle text-success"></i><span class="ms-2">Você não tem chamados em atendimento</span>',
            'pendente': '<i class="fas fa-check-circle text-success"></i><span class="ms-2">Nenhum chamado pendente</span>',
            'novo': '<i class="fas fa-inbox"></i><span class="ms-2">Nenhum chamado disponível para assumir</span>',
            'historico': '<i class="fas fa-folder-open"></i><span class="ms-2">Nenhum chamado no histórico</span>'
        };
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state-mini">
                    ${mensagens[tipoSecao] || mensagens['novo']}
                </div>
            </div>
        `;
        return;
    }
    
    // === DOM DIFFING: Atualizar apenas cards que mudaram ===
    // Gerar hash por chamado para detectar mudanças individuais
    const novosIds = chamadosList.map(c => String(c.id));
    const existingCards = container.querySelectorAll('[data-chamado-id]');
    const existingIdMap = {};
    existingCards.forEach(card => {
        // O card com data-chamado-id está dentro de col-md-6 wrapper
        const wrapper = card.closest('.col-md-6') || card.parentElement;
        existingIdMap[card.getAttribute('data-chamado-id')] = wrapper;
    });
    const existingIds = Object.keys(existingIdMap);
    
    // Se primeira renderização ou contêm empty-state, fazer innerHTML completo
    if (existingIds.length === 0 || container.querySelector('.empty-state-mini')) {
        container.innerHTML = chamadosList.map(c => renderizarCardChamado(c, tipoSecao)).join('');
        return;
    }
    
    // Gerar hash individual por chamado para detectar mudanças de conteúdo
    function chamadoHash(c) {
        return `${c.id}:${c.status}:${c.currentLevel}:${c.usuarioResponsavelEmail || ''}:${c.prefixo_status || ''}`;
    }
    
    // Cache de hashes anteriores neste container
    if (!container._chamadoHashes) container._chamadoHashes = {};
    
    const novosIdsSet = new Set(novosIds);
    const existingIdsSet = new Set(existingIds);
    
    // 1. Remover cards que não existem mais nos novos dados
    existingIds.forEach(id => {
        if (!novosIdsSet.has(id)) {
            const wrapper = existingIdMap[id];
            if (wrapper && wrapper.parentNode === container) {
                container.removeChild(wrapper);
            }
            delete container._chamadoHashes[id];
        }
    });
    
    // 2. Atualizar ou adicionar cards
    let previousElement = null;
    chamadosList.forEach((c, index) => {
        const cId = String(c.id);
        const newHash = chamadoHash(c);
        const existingWrapper = existingIdMap[cId];
        
        if (existingWrapper && existingWrapper.parentNode === container) {
            // Card existe — verificar se mudou
            if (container._chamadoHashes[cId] !== newHash) {
                // Conteúdo mudou — atualizar o HTML in-place
                const temp = document.createElement('div');
                temp.innerHTML = renderizarCardChamado(c, tipoSecao);
                const newWrapper = temp.firstElementChild;
                container.replaceChild(newWrapper, existingWrapper);
                container._chamadoHashes[cId] = newHash;
                previousElement = newWrapper;
            } else {
                // Sem mudança, manter como está
                previousElement = existingWrapper;
            }
        } else {
            // Card novo — inserir na posição correta
            const temp = document.createElement('div');
            temp.innerHTML = renderizarCardChamado(c, tipoSecao);
            const newWrapper = temp.firstElementChild;
            
            if (previousElement && previousElement.nextSibling) {
                container.insertBefore(newWrapper, previousElement.nextSibling);
            } else if (!previousElement && container.firstChild) {
                container.insertBefore(newWrapper, container.firstChild);
            } else {
                container.appendChild(newWrapper);
            }
            container._chamadoHashes[cId] = newHash;
            previousElement = newWrapper;
        }
    });
}

/**
 * ⚡ PERFORMANCE: Renderiza seção com paginação "Carregar mais"
 * Renderiza apenas os primeiros `pageSize` cards inicialmente,
 * com botão para carregar mais em lotes.
 */
function renderizarSecaoPaginada(containerId, chamadosList, tipoSecao, pageSize) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (chamadosList.length === 0) {
        const mensagens = {
            'atendimento': '<i class="fas fa-check-circle text-success"></i><span class="ms-2">Você não tem chamados em atendimento</span>',
            'pendente': '<i class="fas fa-check-circle text-success"></i><span class="ms-2">Nenhum chamado pendente</span>',
            'respondido': '<i class="fas fa-reply text-info"></i><span class="ms-2">Nenhum chamado respondido</span>',
            'novo': '<i class="fas fa-inbox"></i><span class="ms-2">Nenhum chamado disponível para assumir</span>',
            'historico': '<i class="fas fa-folder-open"></i><span class="ms-2">Nenhum chamado no histórico</span>'
        };
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state-mini">
                    ${mensagens[tipoSecao] || '<i class="fas fa-inbox"></i><span class="ms-2">Nenhum item</span>'}
                </div>
            </div>
        `;
        return;
    }
    
    // Quantos já estão renderizados (preservar durante polling re-renders)
    const currentRendered = container._paginatedRendered || 0;
    const renderCount = Math.max(pageSize, currentRendered);
    const visibleSlice = chamadosList.slice(0, renderCount);
    const remaining = chamadosList.length - visibleSlice.length;
    
    // Renderizar o slice visível com DOM diffing (reutiliza renderizarSecao)
    renderizarSecao(containerId, visibleSlice, tipoSecao);
    container._paginatedRendered = visibleSlice.length;
    container._paginatedTotal = chamadosList;
    container._paginatedPageSize = pageSize;
    container._paginatedTipoSecao = tipoSecao;
    
    // Remover botão existente (se houver)
    const existingBtn = container.parentElement?.querySelector('.btn-carregar-mais');
    if (existingBtn) existingBtn.remove();
    
    // Adicionar botão "Carregar mais" se houver restantes
    if (remaining > 0) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'col-12 text-center mt-3 btn-carregar-mais';
        btnContainer.innerHTML = `
            <button class="btn btn-outline-secondary btn-sm" onclick="carregarMaisHistorico('${containerId}')">
                <i class="fas fa-chevron-down me-1"></i>
                Carregar mais ${Math.min(remaining, pageSize)} de ${remaining} restantes
            </button>
        `;
        container.parentElement.insertBefore(btnContainer, container.nextSibling);
    }
}

/**
 * Carrega mais cards na seção paginada
 */
function carregarMaisHistorico(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !container._paginatedTotal) return;
    
    const all = container._paginatedTotal;
    const pageSize = container._paginatedPageSize || 10;
    const current = container._paginatedRendered || 0;
    const tipoSecao = container._paginatedTipoSecao || 'historico';
    
    const newCount = Math.min(current + pageSize, all.length);
    const visibleSlice = all.slice(0, newCount);
    
    renderizarSecao(containerId, visibleSlice, tipoSecao);
    container._paginatedRendered = newCount;
    
    // Atualizar/remover botão
    const existingBtn = container.parentElement?.querySelector('.btn-carregar-mais');
    if (existingBtn) existingBtn.remove();
    
    const remaining = all.length - newCount;
    if (remaining > 0) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'col-12 text-center mt-3 btn-carregar-mais';
        btnContainer.innerHTML = `
            <button class="btn btn-outline-secondary btn-sm" onclick="carregarMaisHistorico('${containerId}')">
                <i class="fas fa-chevron-down me-1"></i>
                Carregar mais ${Math.min(remaining, pageSize)} de ${remaining} restantes
            </button>
        `;
        container.parentElement.insertBefore(btnContainer, container.nextSibling);
    }
}

/**
 * Renderiza um card de chamado
 */
function renderizarCardChamado(c, tipoSecao = 'default') {
    const isHistorico = tipoSecao === 'historico';
    const userEmail = (typeof USER_EMAIL !== 'undefined' ? USER_EMAIL : '').toLowerCase().trim();
    
    // Buscar minha última ação se estiver no modo histórico
    const minhaAcao = isHistorico ? getMinhaUltimaAcao(c, USER_DEPARTMENT) : null;
    
    // Determinar status a exibir
    let statusExibir = c.status;
    
    // Se está no histórico, mostrar status baseado na minha última ação
    if (isHistorico) {
        // Se o chamado já foi resolvido/fechado globalmente, SEMPRE mostrar o status real
        // Não sobrescrever com "atendido" — o usuário finalizou e o chamado está concluído
        if (c.status === 'resolvido' || c.status === 'fechado') {
            statusExibir = c.status;
        } else if (c.read_only) {
            // Chamado em andamento em outro setor — eu já completei minha parte
            statusExibir = 'atendido';
        } else if (minhaAcao) {
            // Usar minhaAcao apenas para chamados NÃO finalizados
            if (minhaAcao.statusEtapa) {
                statusExibir = minhaAcao.statusEtapa;
            } else if (minhaAcao.acao.toLowerCase().includes('concluído') || 
                       minhaAcao.acao.toLowerCase().includes('enviado') ||
                       minhaAcao.acao.toLowerCase().includes('verificação') ||
                       minhaAcao.acao.toLowerCase().includes('encaminhado')) {
                statusExibir = 'atendido';
            }
        }
    }
    
    // Estilos especiais por tipo de seção e status
    // Chamados RESPONDIDO têm destaque especial (roxo) - aguardando resposta de outro setor
    const isRespondido = c.status === 'respondido';
    let extraClass = tipoSecao === 'atendimento' ? 'border-warning' : 
                     tipoSecao === 'pendente' ? 'border-orange' :
                     tipoSecao === 'respondido' ? 'border-respondido chamado-respondido' :
                     tipoSecao === 'novo' ? (isRespondido ? 'border-respondido' : 'border-info') :
                     tipoSecao === 'historico' ? 'ticket-historico' : '';
    
    // Se é respondido na seção de novos, adicionar classe extra para destaque
    if (tipoSecao === 'novo' && isRespondido) {
        extraClass += ' chamado-respondido';
    }
    
    return `
    <div class="col-md-6 col-lg-4">
        <div class="ticket-card ${extraClass}" onclick="abrirDetalhe('${c.id}')" role="button" tabindex="0" 
             onkeydown="if(event.key==='Enter')abrirDetalhe('${c.id}')" data-chamado-id="${c.id}">
            <div class="ticket-header">
                <span class="ticket-id">${c.id}</span>
                <span class="badge ${STATUS_CONFIG[statusExibir]?.class || 'bg-secondary'}">${STATUS_CONFIG[statusExibir]?.label || statusExibir}</span>
                ${c.createdFromTransition ? '<span class="badge bg-info ms-1" title="Transição do Atendimento"><i class="fas fa-exchange-alt"></i></span>' : ''}
            </div>
            <div class="ticket-type mb-2">
                ${getTipoConfig(c.type).icon} ${getTipoConfig(c.type).label}
            </div>
            <div class="ticket-info">
                <div><span><i class="fas fa-bus me-1 text-success"></i>Prefixo:</span> <strong>${c.prefixo}</strong></div>
                <div><span><i class="fas fa-tag me-1 text-success"></i>Patrimônio:</span> <strong>${c.patrimonio}</strong></div>
                ${c.serial ? `<div><span><i class="fas fa-barcode me-1 text-success"></i>Serial:</span> <strong>${c.serial}</strong></div>` : ''}
                <div><span><i class="fas fa-warehouse me-1 text-success"></i>Garagem:</span> <strong>${c.garagem}</strong></div>
                <div><span><i class="fas fa-folder me-1 text-success"></i>Projeto:</span> <strong>${c.projeto}</strong></div>
            </div>
            ${c.prefixo_status ? `
            <div class="ticket-status-prefixo" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <i class="fas fa-circle me-1" style="font-size: 0.5rem; color: ${getStatusColor(c.prefixo_status)};"></i>
                <span style="color: ${getStatusColor(c.prefixo_status)}; font-weight: 500;">Status: ${c.prefixo_status}</span>
            </div>
            ` : ''}
            ${minhaAcao ? `
            <div class="ticket-minha-acao" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(139, 92, 246, 0.3); background: rgba(139, 92, 246, 0.1); padding: 0.5rem; border-radius: 4px;">
                <div style="color: #a78bfa; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.25rem;">
                    <i class="fas fa-history me-1"></i>Minha Última Ação
                </div>
                <div style="color: #e5e7eb; font-weight: 500;">${minhaAcao.acao}</div>
                <div style="color: #9ca3af; font-size: 0.75rem;">
                    <i class="far fa-clock me-1"></i>${formatarDataHora(minhaAcao.data)}
                    <span class="ms-2"><i class="fas fa-user me-1"></i>${minhaAcao.responsavel}</span>
                </div>
            </div>
            ` : ''}
            <div class="ticket-footer">
                <span class="badge nivel-${c.currentLevel?.toLowerCase() || 'n0'}">${NIVEIS_CONFIG[c.currentLevel]?.label || c.currentLevel}</span>
                <span class="${getSlaClass(c)}">${getSlaIcon(c)} ${getSlaText(c)}</span>
            </div>
        </div>
    </div>
    `;
}

/**
 * Toggle para mostrar/ocultar seção vazia
 */
function toggleSecaoVazia(secaoId, isEmpty) {
    const secao = document.getElementById(secaoId);
    if (!secao) return;
    
    // Não ocultar seções, apenas mostrar mensagem de vazio
    // secao.style.display = isEmpty ? 'none' : 'block';
}

/**
 * Toggle para expandir/colapsar uma seção
 */
function toggleSection(sectionName) {
    const content = document.getElementById(`content${capitalizeFirst(sectionName)}`);
    const btn = document.getElementById(`btnToggle${capitalizeFirst(sectionName)}`);
    
    if (!content || !btn) return;
    
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Manter a função renderizarGrid para compatibilidade (não mais usada diretamente)
function renderizarGrid(chamadosList, visualizacao = 'ativos') {
    // Esta função agora delega para renderizarGridPorSecoes
    renderizarGridPorSecoes(chamadosList);
}

function renderizarKanban(chamadosList) {
    // Contador por nível e arrays de chamados por nível
    const countPerLevel = {};
    const chamadosPerLevel = {};
    Object.keys(NIVEIS_CONFIG).forEach(nivel => {
        countPerLevel[nivel] = 0;
        chamadosPerLevel[nivel] = [];
    });
    
    // Distribuir chamados nos arrays por nível
    chamadosList.forEach(c => {
        // Não exibir chamados fechados no Kanban
        if (c.status === 'resolvido' || c.status === 'fechado') return;
        
        if (chamadosPerLevel.hasOwnProperty(c.currentLevel)) {
            chamadosPerLevel[c.currentLevel].push(c);
            countPerLevel[c.currentLevel]++;
        }
    });
    
    // ⚡ PAGINAÇÃO: Renderizar 10 chamados por vez em cada coluna
    const pageSize = 10;
    
    Object.keys(NIVEIS_CONFIG).forEach(nivel => {
        const coluna = document.getElementById(`kanban-${nivel}`);
        if (!coluna) return;
        
        const chamadosNivel = chamadosPerLevel[nivel];
        const currentRendered = coluna._kanbanRendered || 0;
        const renderCount = Math.max(pageSize, currentRendered);
        const visibleChamados = chamadosNivel.slice(0, renderCount);
        const remaining = chamadosNivel.length - visibleChamados.length;
        
        // Salvar estado de paginação
        coluna._kanbanRendered = visibleChamados.length;
        coluna._kanbanTotal = chamadosNivel;
        
        // Renderizar chamados visíveis
        let html = '';
        visibleChamados.forEach(c => {
            html += `
                <div class="kanban-card" 
                     id="kanban-card-${c.id}"
                     draggable="true"
                     ondragstart="handleDragStart(event, '${c.id}')"
                     ondragend="handleDragEnd(event)"
                     onclick="abrirDetalhe('${c.id}')"
                     data-chamado-id="${c.id}">
                    <div class="kanban-card-header">
                        <span class="kanban-card-id">${c.id}</span>
                        <span class="badge ${STATUS_CONFIG[c.status].class}" style="font-size: 0.65rem; padding: 0.25rem 0.5rem;">
                            ${STATUS_CONFIG[c.status].label}
                        </span>
                        ${c.createdFromTransition ? '<span class="badge bg-info ms-1" style="font-size: 0.55rem; padding: 0.15rem 0.35rem;" title="Transição"><i class="fas fa-exchange-alt"></i></span>' : ''}
                    </div>
                    <div class="kanban-card-prefixo">
                        <i class="fas fa-bus me-1"></i>${c.prefixo}
                    </div>
                    <div class="kanban-card-garagem">
                        <i class="fas fa-warehouse me-1"></i>${c.garagem}
                    </div>
                    ${c.prefixo_status ? `
                    <div class="kanban-card-status-prefixo" style="font-size: 0.75rem; color: #6c757d; margin-top: 0.25rem;">
                        <i class="fas fa-circle me-1" style="font-size: 0.5rem; color: ${getStatusColor(c.prefixo_status)};"></i>
                        Status: ${c.prefixo_status}
                    </div>
                    ` : ''}
                    <div class="kanban-card-sla ${getSlaClass(c)}">
                        ${getSlaIcon(c)} ${getSlaText(c)}
                    </div>
                </div>
            `;
        });
        
        // Mostrar mensagem de vazio se não houver chamados
        if (chamadosNivel.length === 0) {
            html = `
                <div class="text-center text-muted small py-4">
                    <i class="fas fa-inbox mb-2 d-block" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    Nenhum chamado
                </div>
            `;
        }
        
        // Adicionar botão "Carregar mais" se houver itens restantes
        if (remaining > 0) {
            html += `
                <div class="text-center mt-3">
                    <button onclick="carregarMaisKanbanChamados('kanban-${nivel}')" 
                            class="btn btn-outline-secondary btn-sm" 
                            style="width:100%;font-size:0.75rem;">
                        <i class="fas fa-chevron-down me-1"></i>
                        Carregar mais ${Math.min(remaining, pageSize)} de ${remaining} restantes
                    </button>
                </div>
            `;
        }
        
        coluna.innerHTML = html;
    });
    
    // Atualizar contadores nas colunas (mostra total, não apenas visíveis)
    Object.keys(NIVEIS_CONFIG).forEach(nivel => {
        const countEl = document.getElementById(`count-${nivel}`);
        if (countEl) {
            countEl.textContent = countPerLevel[nivel];
        }
    });
}

/**
 * Carrega mais chamados em uma coluna do Kanban
 */
function carregarMaisKanbanChamados(colunaId) {
    const coluna = document.getElementById(colunaId);
    if (!coluna || !coluna._kanbanTotal) return;
    
    const pageSize = 10;
    const current = coluna._kanbanRendered || 0;
    const all = coluna._kanbanTotal;
    
    const newCount = Math.min(current + pageSize, all.length);
    coluna._kanbanRendered = newCount;
    
    const visibleChamados = all.slice(0, newCount);
    const remaining = all.length - newCount;
    
    // Renderizar chamados visíveis
    let html = '';
    visibleChamados.forEach(c => {
        html += `
            <div class="kanban-card" 
                 id="kanban-card-${c.id}"
                 draggable="true"
                 ondragstart="handleDragStart(event, '${c.id}')"
                 ondragend="handleDragEnd(event)"
                 onclick="abrirDetalhe('${c.id}')"
                 data-chamado-id="${c.id}">
                <div class="kanban-card-header">
                    <span class="kanban-card-id">${c.id}</span>
                    <span class="badge ${STATUS_CONFIG[c.status].class}" style="font-size: 0.65rem; padding: 0.25rem 0.5rem;">
                        ${STATUS_CONFIG[c.status].label}
                    </span>
                </div>
                <div class="kanban-card-prefixo">
                    <i class="fas fa-bus me-1"></i>${c.prefixo}
                </div>
                <div class="kanban-card-garagem">
                    <i class="fas fa-warehouse me-1"></i>${c.garagem}
                </div>
                ${c.prefixo_status ? `
                <div class="kanban-card-status-prefixo" style="font-size: 0.75rem; color: #6c757d; margin-top: 0.25rem;">
                    <i class="fas fa-circle me-1" style="font-size: 0.5rem; color: ${getStatusColor(c.prefixo_status)};"></i>
                    Status: ${c.prefixo_status}
                </div>
                ` : ''}
                <div class="kanban-card-sla ${getSlaClass(c)}">
                    ${getSlaIcon(c)} ${getSlaText(c)}
                </div>
            </div>
        `;
    });
    
    // Adicionar botão "Carregar mais" se ainda houver itens restantes
    if (remaining > 0) {
        html += `
            <div class="text-center mt-3">
                <button onclick="carregarMaisKanbanChamados('${colunaId}')" 
                        class="btn btn-outline-secondary btn-sm" 
                        style="width:100%;font-size:0.75rem;">
                    <i class="fas fa-chevron-down me-1"></i>
                    Carregar mais ${Math.min(remaining, pageSize)} de ${remaining} restantes
                </button>
            </div>
        `;
    }
    
    coluna.innerHTML = html;
}

// ============================================================================
// DRAG AND DROP HANDLERS
// ============================================================================

function handleDragStart(event, chamadoId) {
    draggedChamadoId = chamadoId;
    const chamado = chamados.find(c => c.id === chamadoId);
    if (chamado) {
        dragSourceNivel = chamado.currentLevel;
    }
    
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', chamadoId);
    
    // Adicionar classe visual a todas as colunas exceto a atual
    setTimeout(() => {
        document.querySelectorAll('.kanban-column').forEach(col => {
            if (col.getAttribute('data-nivel') !== dragSourceNivel) {
                col.style.opacity = '0.8';
            }
        });
    }, 0);
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedChamadoId = null;
    dragSourceNivel = null;
    
    // Remover classes visuais
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.classList.remove('drag-over');
        col.style.opacity = '1';
    });
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const column = event.currentTarget;
    const targetNivel = column.getAttribute('data-nivel');
    
    // Não permitir soltar na mesma coluna
    if (targetNivel !== dragSourceNivel) {
        column.classList.add('drag-over');
    }
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event, targetNivel) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const chamadoId = event.dataTransfer.getData('text/plain');
    const chamado = chamados.find(c => c.id === chamadoId);
    
    if (!chamado) return;
    
    // Verificar se é para o mesmo nível
    if (chamado.currentLevel === targetNivel) {
        mostrarToast('O chamado já está neste nível', 'info');
        return;
    }
    
    // Verificar se o chamado está fechado
    if (chamado.status === 'resolvido' || chamado.status === 'fechado') {
        mostrarToast('Não é possível mover chamados fechados', 'warning');
        return;
    }
    
    // Selecionar o chamado e abrir modal de ação pré-configurado
    chamadoSelecionado = chamado;
    abrirModalAcao(true, targetNivel);
}

// ============================================================================
// PAGINAÇÃO DA ABA TABELA (30 chamados por página)
// ============================================================================
let _tabelaPaginaAtual = 1;
const _TABELA_PAGE_SIZE = 30;
let _tabelaChamadosCache = [];
let _tabelaVisualizacaoCache = 'ativos';

function renderizarTabela(chamadosList, visualizacao = 'ativos') {
    // Salvar cache para paginação
    _tabelaChamadosCache = chamadosList;
    _tabelaVisualizacaoCache = visualizacao;
    _tabelaPaginaAtual = 1;
    _renderizarPaginaTabela();
}

function _renderizarPaginaTabela() {
    const chamadosList = _tabelaChamadosCache;
    const visualizacao = _tabelaVisualizacaoCache;
    const tbody = document.getElementById('bodyChamados');
    const isHistorico = visualizacao === 'historico';
    
    if (chamadosList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Nenhum chamado encontrado</td></tr>';
        _atualizarPaginacaoTabela(0);
        return;
    }
    
    const totalPages = Math.ceil(chamadosList.length / _TABELA_PAGE_SIZE);
    const start = (_tabelaPaginaAtual - 1) * _TABELA_PAGE_SIZE;
    const end = start + _TABELA_PAGE_SIZE;
    const pagina = chamadosList.slice(start, end);
    
    tbody.innerHTML = pagina.map(c => {
        // Buscar minha última ação se estiver no modo histórico
        const minhaAcao = isHistorico ? getMinhaUltimaAcao(c, USER_DEPARTMENT) : null;
        
        // Determinar status a exibir:
        // - Se for histórico e existe status_etapa_remetente, mostrar esse status (ex: "atendido")
        // - Senão, se a ação foi "Concluído/Enviado", mostrar "atendido"
        // - Caso contrário, mostrar o status global do chamado
        let statusExibir = c.status;
        // Se o chamado já está resolvido/fechado, SEMPRE mostrar o status real
        // Não sobrescrever com "atendido" para chamados que o usuário finalizou
        if (isHistorico && c.status !== 'resolvido' && c.status !== 'fechado' && minhaAcao) {
            if (minhaAcao.statusEtapa) {
                statusExibir = minhaAcao.statusEtapa;
            } else if (minhaAcao.acao.toLowerCase().includes('concluído') || 
                       minhaAcao.acao.toLowerCase().includes('enviado') ||
                       minhaAcao.acao.toLowerCase().includes('verificação') ||
                       minhaAcao.acao.toLowerCase().includes('encaminhado')) {
                statusExibir = 'atendido';
            }
        }
        
        return `
        <tr style="cursor: pointer;" onclick="abrirDetalhe('${c.id}')" role="button" tabindex="0"
            onkeydown="if(event.key==='Enter')abrirDetalhe('${c.id}')">
            <td><strong class="text-success">${c.id}</strong></td>
            <td>${getTipoConfig(c.type).icon} ${getTipoConfig(c.type).label}</td>
            <td><i class="fas fa-bus me-1 text-muted"></i>${c.prefixo}</td>
            <td><i class="fas fa-tag me-1 text-muted"></i>${c.patrimonio}</td>
            <td>${c.projeto}</td>
            <td>${c.garagem}</td>
            <td>
                ${c.classificacao ? `<span class="badge bg-info" style="font-size: 0.8rem;">${c.classificacao}</span>` : '<span class="text-muted">-</span>'}
            </td>
            <td><span class="badge nivel-${c.currentLevel.toLowerCase()}">${c.currentLevel}</span></td>
            <td>
                <span class="badge ${STATUS_CONFIG[statusExibir].class}">${STATUS_CONFIG[statusExibir].label}</span>
                ${c.createdFromTransition ? '<span class="badge bg-info ms-1" title="Chamado de transição do Atendimento"><i class="fas fa-exchange-alt"></i></span>' : ''}
            </td>
            <td class="${getSlaClass(c)}">${getSlaIcon(c)} ${getSlaText(c)}</td>
            <td>${formatarData(c.createdAt)}</td>
            <td>
                ${isHistorico && minhaAcao ? `<span style="color: #a78bfa; font-size: 0.75rem;">${minhaAcao.acao}</span>` : 
                `<button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); abrirDetalhe('${c.id}')" title="Ver detalhes">
                    <i class="fas fa-eye"></i>
                </button>`}
            </td>
        </tr>
    `}).join('');
    
    _atualizarPaginacaoTabela(chamadosList.length);
}

function _atualizarPaginacaoTabela(totalItems) {
    const container = document.getElementById('tabelaPaginacao');
    const info = document.getElementById('tabelaPaginacaoInfo');
    const nav = document.getElementById('tabelaPaginacaoNav');
    
    if (!container) return;
    
    if (totalItems <= _TABELA_PAGE_SIZE) {
        container.style.display = 'none';
        if (totalItems > 0) {
            info.textContent = `Mostrando ${totalItems} chamado(s)`;
            container.style.display = 'flex';
            nav.innerHTML = '';
        }
        return;
    }
    
    container.style.display = 'flex';
    
    const totalPages = Math.ceil(totalItems / _TABELA_PAGE_SIZE);
    const start = (_tabelaPaginaAtual - 1) * _TABELA_PAGE_SIZE + 1;
    const end = Math.min(_tabelaPaginaAtual * _TABELA_PAGE_SIZE, totalItems);
    
    info.textContent = `Mostrando ${start}–${end} de ${totalItems} chamados`;
    
    let html = '';
    
    // Botão anterior
    html += `<li class="page-item ${_tabelaPaginaAtual <= 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="event.preventDefault(); irParaPaginaTabela(${_tabelaPaginaAtual - 1})" style="background: rgba(30,30,50,0.9); border-color: rgba(76,175,80,0.3); color: #4CAF50;">
            <i class="fas fa-chevron-left"></i>
        </a>
    </li>`;
    
    // Páginas com elipses
    const maxVisible = 5;
    let startPage = Math.max(1, _tabelaPaginaAtual - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += _paginaBtnHtml(1, false);
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link" style="background:transparent;border-color:rgba(76,175,80,0.2);color:#666;">...</span></li>`;
    }
    
    for (let p = startPage; p <= endPage; p++) {
        html += _paginaBtnHtml(p, p === _tabelaPaginaAtual);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link" style="background:transparent;border-color:rgba(76,175,80,0.2);color:#666;">...</span></li>`;
        html += _paginaBtnHtml(totalPages, false);
    }
    
    // Botão próximo
    html += `<li class="page-item ${_tabelaPaginaAtual >= totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="event.preventDefault(); irParaPaginaTabela(${_tabelaPaginaAtual + 1})" style="background: rgba(30,30,50,0.9); border-color: rgba(76,175,80,0.3); color: #4CAF50;">
            <i class="fas fa-chevron-right"></i>
        </a>
    </li>`;
    
    nav.innerHTML = html;
}

function _paginaBtnHtml(page, active) {
    return `<li class="page-item ${active ? 'active' : ''}">
        <a class="page-link" href="#" onclick="event.preventDefault(); irParaPaginaTabela(${page})" 
           style="background: ${active ? 'rgba(76,175,80,0.8)' : 'rgba(30,30,50,0.9)'}; border-color: rgba(76,175,80,0.3); color: ${active ? '#fff' : '#4CAF50'};">
            ${page}
        </a>
    </li>`;
}

function irParaPaginaTabela(page) {
    const totalPages = Math.ceil(_tabelaChamadosCache.length / _TABELA_PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    _tabelaPaginaAtual = page;
    _renderizarPaginaTabela();
    // Scroll para o topo da tabela
    const tabela = document.getElementById('tabelaChamados');
    if (tabela) tabela.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================================
// UTILITÁRIOS DE SLA
// ============================================================================

function getSlaClass(chamado) {
    if (chamado.slaCumprido === true) return 'sla-ok';
    if (chamado.slaCumprido === false) return 'sla-danger';
    
    const hoje = new Date();
    const slaDate = parseSlaDate(chamado);
    if (!slaDate) return 'sla-ok';
    
    const diffHoras = (slaDate - hoje) / (1000 * 60 * 60);
    
    if (diffHoras < 0) return 'sla-danger';
    if (diffHoras < 24) return 'sla-warning';
    return 'sla-ok';
}

function getSlaIcon(chamado) {
    const classe = getSlaClass(chamado);
    if (classe === 'sla-ok') return '<i class="fas fa-check-circle"></i>';
    if (classe === 'sla-warning') return '<i class="fas fa-clock"></i>';
    return '<i class="fas fa-exclamation-triangle"></i>';
}

function getSlaText(chamado) {
    // Se está finalizado, mostrar tempo médio de atendimento
    if (chamado.status === 'resolvido' || chamado.status === 'fechado') {
        if (chamado.slaInfo && chamado.slaInfo.closed_at && chamado.slaInfo.opened_at) {
            const closedDate = new Date(chamado.slaInfo.closed_at);
            const openedDate = new Date(chamado.slaInfo.opened_at);
            const diffMs = closedDate - openedDate;
            return formatarDuracaoDetalhada(diffMs);
        }
        return 'Finalizado';
    }
    
    if (chamado.slaCumprido === true) return 'SLA OK';
    if (chamado.slaCumprido === false) return 'SLA Excedido';
    
    const hoje = new Date();
    const slaDate = parseSlaDate(chamado);
    if (!slaDate) return 'N/A';
    
    const diffHoras = Math.ceil((slaDate - hoje) / (1000 * 60 * 60));
    
    if (diffHoras < 0) return `Excedido há ${Math.abs(diffHoras)}h`;
    return `${diffHoras}h restantes`;
}

// ============================================================================
// DETALHES DO CHAMADO (Enhanced)
// ============================================================================

function abrirDetalhe(chamadoId) {
    chamadoSelecionado = chamados.find(c => c.id === chamadoId);
    if (!chamadoSelecionado) return;
    
    // Reset modo acompanhar ao abrir novo chamado
    modoAcompanhar = false;
    
    const c = chamadoSelecionado;
    
    // Verificar flags de permissão retornadas pelo backend
    // Prioridade: usar as flags can_assume e read_only se existirem
    const canAssume = c.can_assume === true;
    const readOnly = c.read_only === true;
    const visibilityContext = c.visibility_context || 'active';
    
    // Fallback para lógica antiga se flags não existirem (compatibilidade)
    const isAberto = c.status === 'aberto';
    const responsavelEmail = c.usuario_responsavel_email || c.usuarioResponsavelEmail;
    const semResponsavel = !responsavelEmail || responsavelEmail === '' || responsavelEmail === null;
    const isAdmin = typeof USER_ROLE !== 'undefined' && USER_ROLE === 'admin';
    
    console.log('🔍 Verificando chamado:', {
        id: c.id,
        status: c.status,
        isAberto,
        responsavelEmail,
        semResponsavel,
        isAdmin,
        USER_ROLE,
        // Novas flags
        can_assume: canAssume,
        read_only: readOnly,
        visibility_context: visibilityContext
    });
    
    // Se o backend retornou as flags, usar elas
    // Caso contrário, manter lógica antiga para compatibilidade
    const devePerguntar = c.hasOwnProperty('can_assume') 
        ? (canAssume && !readOnly)
        : (isAberto && semResponsavel && !isAdmin);
    
    if (devePerguntar) {
        // Mostrar modal de confirmação para assumir o chamado
        console.log('📢 Mostrando modal de assumir chamado');
        mostrarModalAssumirChamado(c);
        return;
    }
    
    // Se é read_only (histórico), informar no console
    if (readOnly) {
        console.log('🔒 Chamado em modo read_only (histórico):', c.id, '- context:', visibilityContext);
    }
    
    // Se já tem responsável ou é admin ou é read_only, mostrar detalhes normalmente
    mostrarDetalhesChamado(c);
}

function mostrarModalAssumirChamado(c) {
    // Criar/Atualizar modal de assumir
    let modal = document.getElementById('modalAssumirChamado');
    if (!modal) {
        const modalHtml = `
            <div class="modal fade" id="modalAssumirChamado" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="background: #0d2137; border: 1px solid rgba(76, 175, 80, 0.3);">
                        <div class="modal-header border-0">
                            <h5 class="modal-title text-light">
                                <i class="fas fa-hand-paper text-warning me-2"></i>Assumir Chamado
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center py-4">
                            <div class="mb-3">
                                <i class="fas fa-ticket-alt fa-3x text-success mb-3"></i>
                            </div>
                            <h5 class="text-light mb-2" id="modalAssumirChamadoId"></h5>
                            <p class="mb-4" style="color: #b0bec5;">
                                Este chamado está disponível para atendimento.<br>
                                <strong class="text-warning">Deseja assumir este chamado?</strong>
                            </p>
                            <div class="alert" style="background: rgba(33, 150, 243, 0.15); border: 1px solid rgba(33, 150, 243, 0.3); color: #90caf9;">
                                <i class="fas fa-info-circle me-2"></i>
                                <small style="color: #b0bec5;">Ao assumir, o chamado ficará sob sua responsabilidade e não será mais visível para outros usuários do departamento.</small>
                            </div>
                        </div>
                        <div class="modal-footer border-0 justify-content-center gap-3">
                            <button type="button" class="btn btn-outline-secondary px-4" data-bs-dismiss="modal">
                                <i class="fas fa-times me-2"></i>Cancelar
                            </button>
                            <button type="button" class="btn btn-outline-info px-4" onclick="acompanharChamado()">
                                <i class="fas fa-eye me-2"></i>Apenas Acompanhar
                            </button>
                            <button type="button" class="btn btn-success px-4" onclick="confirmarAssumirChamado()">
                                <i class="fas fa-check me-2"></i>Sim, Assumir Chamado
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('modalAssumirChamado');
    }
    
    // Atualizar informações do modal
    document.getElementById('modalAssumirChamadoId').textContent = `Chamado ${c.id}`;
    
    // Mostrar modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// ============================================================================
// ESTADO GLOBAL DE SUBMISSÃO (Anti-double-click)
// ============================================================================
let isSubmittingAction = false;
let modoAcompanhar = false;  // Flag: true quando o usuário escolheu "Apenas Acompanhar"

async function confirmarAssumirChamado() {
    if (!chamadoSelecionado) return;
    
    // Anti-double-click: verificar se já está enviando
    if (isSubmittingAction) {
        console.log('⚠️ Ação já em andamento, ignorando clique duplicado');
        return;
    }
    
    const c = chamadoSelecionado;
    const btnConfirmar = document.querySelector('#modalAssumirChamado .btn-success');
    
    try {
        // Ativar estado de loading
        isSubmittingAction = true;
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Assumindo...';
        }
        
        const response = await fetch(`${API_BASE}/${c.id}/assumir`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_email: USER_EMAIL,
                user_name: USER_NAME,
                user_departamento: USER_DEPARTMENT,
                is_admin: IS_ADMIN || false
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Fechar modal de assumir
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalAssumirChamado'));
            modal?.hide();
            
            // Atualizar chamado local
            const index = chamados.findIndex(ch => ch.id === c.id);
            if (index >= 0) {
                chamados[index] = {
                    ...result.data,
                    currentLevel: result.data.current_level || result.data.currentLevel,
                    slaDate: result.data.sla_date || result.data.slaDate,
                    slaCumprido: result.data.sla_cumprido ?? result.data.slaCumprido,
                    createdAt: result.data.created_at || result.data.createdAt,
                    updatedAt: result.data.updated_at || result.data.updatedAt,
                    createdBy: result.data.created_by || result.data.createdBy,
                    createdByName: result.data.created_by_name || result.data.createdByName,
                    usuarioResponsavelEmail: result.data.usuario_responsavel_email,
                    usuarioResponsavelNome: result.data.usuario_responsavel_nome,
                    slaInfo: result.data.sla_info || result.data.slaInfo
                };
                chamadoSelecionado = chamados[index];
            }
            
            mostrarToast('Chamado assumido com sucesso! Agora você é o responsável.', 'success');
            
            // Resetar modo acompanhar — agora o usuário é responsável
            modoAcompanhar = false;
            
            // Atualizar UI
            atualizarEstatisticas();
            renderizarChamados();
            
            // Mostrar detalhes do chamado
            mostrarDetalhesChamado(chamadoSelecionado);
            
        } else {
            // Se for erro 403 (modo read_only), mostrar mensagem específica
            if (response.status === 403) {
                mostrarToast(result.detail || 'Este chamado está em modo histórico (somente leitura)', 'warning');
            } else {
                mostrarToast(result.detail || 'Erro ao assumir chamado', 'error');
            }
        }
    } catch (error) {
        console.error('Erro ao assumir chamado:', error);
        mostrarToast('Erro ao assumir chamado. Tente novamente.', 'error');
    } finally {
        // Restaurar estado do botão
        isSubmittingAction = false;
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fas fa-check me-2"></i>Sim, Assumir Chamado';
        }
    }
}

/**
 * Acompanhar chamado - Exibe detalhes sem assumir
 */
function acompanharChamado() {
    if (!chamadoSelecionado) return;
    
    // Fechar modal de assumir
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalAssumirChamado'));
    modal?.hide();
    
    // Sinalizar modo acompanhamento — não pode gerenciar/delegar
    modoAcompanhar = true;
    
    // Mostrar detalhes do chamado sem assumir
    mostrarDetalhesChamado(chamadoSelecionado);
}

/**
 * Assumir chamado a partir do painel de detalhes (modo acompanhar)
 * Fecha o offcanvas, chama confirmarAssumirChamado diretamente
 */
async function assumirChamadoDoDetalhe() {
    if (!chamadoSelecionado) return;
    
    // Resetar modo acompanhar ao assumir
    modoAcompanhar = false;
    
    // Fechar o offcanvas de detalhes
    const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasDetalhe'));
    offcanvas?.hide();
    
    // Reutilizar o fluxo de confirmarAssumirChamado
    await confirmarAssumirChamado();
}

// ============================================================================
// DELEGAÇÃO (ADMIN ONLY)
// ============================================================================

function abrirModalDelegacao() {
    if (!chamadoSelecionado) return;
    
    // Criar/Atualizar modal de delegação
    let modal = document.getElementById('modalDelegarChamado');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="modalDelegarChamado" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content" style="background: #1e1e1e; border: 1px solid rgba(76, 175, 80, 0.3);">
                        <div class="modal-header" style="border-color: rgba(76, 175, 80, 0.3);">
                            <h5 class="modal-title text-light">
                                <i class="fas fa-user-cog text-warning me-2"></i>Delegar Chamado
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <h5 class="text-light mb-3" id="modalDelegarChamadoId"></h5>
                            
                            <div class="mb-3">
                                <label class="form-label text-light">Tipo de Delegação</label>
                                <select class="form-select" id="delegacaoTipo" onchange="toggleDelegacaoTipo()">
                                    <option value="">Selecione...</option>
                                    <option value="usuario">Para Usuário Específico</option>
                                    <option value="setor">Para Departamento</option>
                                </select>
                            </div>
                            
                            <!-- Delegação para Usuário -->
                            <div id="delegacaoUsuarioFields" style="display: none;">
                                <div class="mb-3">
                                    <label class="form-label text-light">Selecione o Usuário</label>
                                    <select class="form-select" id="delegadoUsuarioSelect">
                                        <option value="">Carregando usuários...</option>
                                    </select>
                                    <small class="text-muted">O chamado será atribuído diretamente ao usuário selecionado</small>
                                </div>
                            </div>
                            
                            <!-- Delegação para Setor -->
                            <div id="delegacaoSetorFields" style="display: none;">
                                <div class="mb-3">
                                    <label class="form-label text-light">Selecione o Departamento</label>
                                    <select class="form-select" id="delegadoSetor" onchange="onDelegacaoSetorChange()">
                                        <option value="">Carregando departamentos...</option>
                                    </select>
                                    <small class="text-muted">O chamado ficará disponível para qualquer membro do departamento assumir</small>
                                </div>
                            </div>
                            
                            <!-- Classificação para delegação de setor -->
                            <div id="delegacaoClassificacaoFields" style="display: none;">
                                <div class="mb-3">
                                    <label class="form-label text-light">Classificação</label>
                                    <select class="form-select" id="delegacaoClassificacao" onchange="onDelegacaoClassificacaoChange()">
                                        <option value="">Selecione a classificação...</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Campos N4 para delegação -->
                            <div id="delegacaoN4Container" class="card mb-3" style="display: none; background: #2a2a2a; border: 1px solid rgba(255, 193, 7, 0.5);">
                                <div class="card-header" style="background: rgba(255, 193, 7, 0.15); padding: 8px 12px;">
                                    <i class="fas fa-user-cog me-2 text-warning"></i>
                                    <strong class="text-light">Atribuição N4 - In Loco</strong>
                                    <span class="text-muted small ms-2">(obrigatório para N4)</span>
                                </div>
                                <div class="card-body py-3">
                                    <div class="row">
                                        <div class="col-md-6 mb-3 mb-md-0">
                                            <label class="form-label text-light">
                                                <i class="fas fa-user me-1 text-warning"></i>
                                                Técnico Responsável <span class="text-danger">*</span>
                                            </label>
                                            <select id="delegacaoTecnicoResponsavel" class="form-select">
                                                <option value="">Selecione o técnico...</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label text-light">
                                                <i class="fas fa-users me-1 text-info"></i>
                                                Equipe de Apoio <span class="text-muted small">(opcional)</span>
                                            </label>
                                            <select id="delegacaoEquipeEmails" class="form-select" multiple style="height: 100px;">
                                            </select>
                                            <div class="form-text text-muted small mt-1">
                                                <i class="fas fa-info-circle me-1"></i>
                                                Segure Ctrl para selecionar múltiplos técnicos.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label text-light">Motivo da Delegação*</label>
                                <textarea class="form-control" id="delegacaoMotivo" rows="3" 
                                          placeholder="Explique o motivo da delegação..."></textarea>
                            </div>
                            
                            <div class="alert alert-info" style="background: rgba(33, 150, 243, 0.1); border-color: #2196F3;">
                                <i class="fas fa-info-circle me-1"></i>
                                <strong>Atenção:</strong> O chamado permanecerá em aberto após a delegação.
                            </div>
                        </div>
                        <div class="modal-footer" style="border-color: rgba(76, 175, 80, 0.3);">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-warning" onclick="confirmarDelegacao()">
                                <i class="fas fa-check me-2"></i>Delegar Chamado
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('modalDelegarChamado');
    }
    
    // Atualizar informações do chamado
    document.getElementById('modalDelegarChamadoId').textContent = `Chamado ${chamadoSelecionado.id}`;
    
    // Limpar campos
    document.getElementById('delegacaoTipo').value = '';
    document.getElementById('delegacaoMotivo').value = '';
    toggleDelegacaoTipo();
    
    // Limpar campos de classificação e N4 da delegação
    const delegClassFields = document.getElementById('delegacaoClassificacaoFields');
    if (delegClassFields) delegClassFields.style.display = 'none';
    const delegN4Container = document.getElementById('delegacaoN4Container');
    if (delegN4Container) delegN4Container.style.display = 'none';
    const delegClassSelect = document.getElementById('delegacaoClassificacao');
    if (delegClassSelect) delegClassSelect.innerHTML = '<option value="">Selecione a classificação...</option>';
    
    // Carregar usuários e departamentos
    carregarUsuariosParaDelegacao();
    carregarDepartamentosParaDelegacao();
    
    // Mostrar modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function toggleDelegacaoTipo() {
    const tipo = document.getElementById('delegacaoTipo').value;
    const usuarioFields = document.getElementById('delegacaoUsuarioFields');
    const setorFields = document.getElementById('delegacaoSetorFields');
    
    if (tipo === 'usuario') {
        usuarioFields.style.display = 'block';
        setorFields.style.display = 'none';
    } else if (tipo === 'setor') {
        usuarioFields.style.display = 'none';
        setorFields.style.display = 'block';
    } else {
        usuarioFields.style.display = 'none';
        setorFields.style.display = 'none';
    }
}

async function carregarUsuariosParaDelegacao() {
    try {
        const response = await fetch('/api/usuarios/', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('delegadoUsuarioSelect');
            
            select.innerHTML = '<option value="">Selecione um usuário...</option>';
            
            if (data.usuarios && data.usuarios.length > 0) {
                data.usuarios.forEach(usuario => {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({
                        email: usuario.email,
                        nome: usuario.nome || usuario.email.split('@')[0]
                    });
                    option.textContent = `${usuario.nome || usuario.email.split('@')[0]} (${usuario.email})`;
                    if (usuario.departamento) {
                        option.textContent += ` - ${usuario.departamento}`;
                    }
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

async function carregarDepartamentosParaDelegacao() {
    // Usar a mesma lista de níveis da ação de gerenciamento de chamados
    const select = document.getElementById('delegadoSetor');
    
    select.innerHTML = '<option value="">Selecione o nível/departamento...</option>';
    
    // Lista de níveis - mesma usada na gestão de chamados (incluindo N7/N8)
    const niveis = [
        { value: 'N0', label: 'N0 - Abertura de Chamados (CCO)' },
        { value: 'N1', label: 'N1 - Verificação Chip (Atendimento)' },
        { value: 'N2', label: 'N2 - Base/Sistema (Business Intelligence)' },
        { value: 'N3', label: 'N3 - Checklist Elétrico (Operações)' },
        { value: 'N4', label: 'N4 - In Loco (Operações)' },
        { value: 'N5', label: 'N5 - Erros na Aplicação (TI)' },
        { value: 'N6', label: 'N6 - Atualização da Aplicação (P&D)' },
        { value: 'N7', label: 'N7 - Aprovação Gerencial (Gerência)' },
        { value: 'N8', label: 'N8 - Serviços Externos (Prestador)' }
    ];
    
    niveis.forEach(nivel => {
        const option = document.createElement('option');
        option.value = nivel.value;
        option.textContent = nivel.label;
        select.appendChild(option);
    });
}

/**
 * Quando o nível/departamento de delegação muda, popula classificações e mostra/oculta campos N4
 */
function onDelegacaoSetorChange() {
    const nivelSelecionado = document.getElementById('delegadoSetor').value;
    const classContainer = document.getElementById('delegacaoClassificacaoFields');
    const classSelect = document.getElementById('delegacaoClassificacao');
    const n4Container = document.getElementById('delegacaoN4Container');
    
    // Reset
    if (classSelect) classSelect.innerHTML = '<option value="">Selecione a classificação...</option>';
    if (n4Container) n4Container.style.display = 'none';
    
    if (!nivelSelecionado || !classContainer) {
        if (classContainer) classContainer.style.display = 'none';
        return;
    }
    
    // Mapear nível → departamento via NIVEIS_CONFIG
    const nivelConfig = NIVEIS_CONFIG[nivelSelecionado];
    if (!nivelConfig) {
        classContainer.style.display = 'none';
        return;
    }
    
    // Mapear nome do departamento para a chave do CLASSIFICACOES_CONFIG
    const DEPT_KEY_MAP = {
        'Business Intelligence': 'Business Intelligence (BI)'
    };
    const deptKey = DEPT_KEY_MAP[nivelConfig.dept] || nivelConfig.dept;
    
    // Buscar classificações do departamento
    const classificacoes = CLASSIFICACOES_CONFIG[deptKey] || [];
    
    if (classificacoes.length === 0) {
        classContainer.style.display = 'none';
    } else {
        classContainer.style.display = 'block';
        classificacoes.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            classSelect.appendChild(option);
        });
    }
    
    // Se nível for N4, mostrar campos N4 diretamente
    if (nivelSelecionado === 'N4') {
        if (n4Container) n4Container.style.display = 'block';
        popularDelegacaoN4Tecnicos();
    }
    
    console.log(`📋 Delegação: nível ${nivelSelecionado} selecionado, dept=${deptKey}, ${classificacoes.length} classificações`);
}

/**
 * Quando a classificação de delegação muda, mostra campos N4 se necessário
 */
function onDelegacaoClassificacaoChange() {
    const classificacao = document.getElementById('delegacaoClassificacao').value;
    const n4Container = document.getElementById('delegacaoN4Container');
    const nivelSelecionado = document.getElementById('delegadoSetor').value;
    
    // Verificar se a classificação mapeia para N4
    const nivelDestino = CLASSIFICACAO_NIVEL_MAP[classificacao] || null;
    
    if (nivelDestino === 'N4' || nivelSelecionado === 'N4') {
        if (n4Container) n4Container.style.display = 'block';
        popularDelegacaoN4Tecnicos();
    } else {
        if (n4Container) n4Container.style.display = 'none';
    }
}

/**
 * Popula os selects de técnico e equipe no modal de delegação
 */
function popularDelegacaoN4Tecnicos() {
    const selectTecnico = document.getElementById('delegacaoTecnicoResponsavel');
    const selectEquipe = document.getElementById('delegacaoEquipeEmails');
    
    if (!selectTecnico || !selectEquipe) return;
    
    // Carregar técnicos se ainda não carregou
    if (tecnicos.length === 0) {
        carregarTecnicosN4().then(() => {
            preencherSelectsDelegacaoN4(selectTecnico, selectEquipe);
        });
    } else {
        preencherSelectsDelegacaoN4(selectTecnico, selectEquipe);
    }
}

/**
 * Preenche os selects de técnico/equipe para delegação
 */
function preencherSelectsDelegacaoN4(selectTecnico, selectEquipe) {
    selectTecnico.innerHTML = '<option value="">Selecione o técnico...</option>';
    selectEquipe.innerHTML = '';
    
    for (const tecnico of tecnicos) {
        const nome = tecnico.nome || tecnico.email.split('@')[0];
        
        const optTecnico = document.createElement('option');
        optTecnico.value = tecnico.email;
        optTecnico.textContent = nome;
        selectTecnico.appendChild(optTecnico);
        
        const optEquipe = document.createElement('option');
        optEquipe.value = tecnico.email;
        optEquipe.textContent = nome;
        selectEquipe.appendChild(optEquipe);
    }
}

async function confirmarDelegacao() {
    if (!chamadoSelecionado) return;
    
    // Anti-double-click
    if (isSubmittingAction) {
        console.log('⚠️ Delegação já em andamento, ignorando clique duplicado');
        return;
    }
    
    const tipo = document.getElementById('delegacaoTipo').value;
    const motivo = document.getElementById('delegacaoMotivo').value.trim();
    
    // Validações
    if (!tipo) {
        mostrarToast('Selecione o tipo de delegação', 'error');
        return;
    }
    
    if (!motivo) {
        mostrarToast('Informe o motivo da delegação', 'error');
        return;
    }
    
    let payload = {
        motivo: motivo,
        admin_email: USER_EMAIL,
        admin_nome: USER_NAME,
        delegado_para_email: null,
        delegado_para_nome: null,
        delegado_para_setor: null
    };
    
    if (tipo === 'usuario') {
        const usuarioSelect = document.getElementById('delegadoUsuarioSelect');
        const usuarioData = usuarioSelect.value;
        
        if (!usuarioData) {
            mostrarToast('Selecione um usuário', 'error');
            return;
        }
        
        try {
            const usuario = JSON.parse(usuarioData);
            payload.delegado_para_email = usuario.email;
            payload.delegado_para_nome = usuario.nome;
        } catch (e) {
            mostrarToast('Erro ao processar dados do usuário', 'error');
            return;
        }
    } else if (tipo === 'setor') {
        const setor = document.getElementById('delegadoSetor').value;
        
        if (!setor) {
            mostrarToast('Selecione o departamento de destino', 'error');
            return;
        }
        
        payload.delegado_para_setor = setor;
        
        // Classificação (opcional, depende do departamento)
        const classificacaoSelect = document.getElementById('delegacaoClassificacao');
        if (classificacaoSelect && classificacaoSelect.value) {
            payload.classificacao = classificacaoSelect.value;
        }
        
        // Campos N4: técnico responsável e equipe
        const n4Container = document.getElementById('delegacaoN4Container');
        if (n4Container && n4Container.style.display !== 'none') {
            const tecnicoEmail = document.getElementById('delegacaoTecnicoResponsavel').value;
            if (!tecnicoEmail) {
                mostrarToast('Selecione o técnico responsável para N4', 'warning');
                document.getElementById('delegacaoTecnicoResponsavel').focus();
                return;
            }
            payload.tecnico_responsavel_email = tecnicoEmail;
            
            // Equipe (opcional)
            const selectEquipe = document.getElementById('delegacaoEquipeEmails');
            if (selectEquipe) {
                const equipeEmails = [];
                for (let option of selectEquipe.selectedOptions) {
                    if (option.value) equipeEmails.push(option.value);
                }
                if (equipeEmails.length > 0) {
                    payload.equipe_emails = equipeEmails;
                }
            }
        }
    }
    
    // Ativar loading
    const btnDelegar = document.querySelector('#modalDelegarChamado .btn-warning');
    isSubmittingAction = true;
    if (btnDelegar) {
        btnDelegar.disabled = true;
        btnDelegar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Delegando...';
    }
    
    try {
        const response = await fetch(`${API_BASE}/${chamadoSelecionado.id}/delegar`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalDelegarChamado'));
            modal?.hide();
            
            // Atualizar chamado local
            const index = chamados.findIndex(ch => ch.id === chamadoSelecionado.id);
            if (index >= 0) {
                chamados[index] = {
                    ...result.data,
                    currentLevel: result.data.current_level || result.data.currentLevel,
                    slaDate: result.data.sla_date || result.data.slaDate,
                    slaCumprido: result.data.sla_cumprido ?? result.data.slaCumprido,
                    createdAt: result.data.created_at || result.data.createdAt,
                    updatedAt: result.data.updated_at || result.data.updatedAt,
                    createdBy: result.data.created_by || result.data.createdBy,
                    createdByName: result.data.created_by_name || result.data.createdByName,
                    usuarioResponsavelEmail: result.data.usuario_responsavel_email,
                    usuarioResponsavelNome: result.data.usuario_responsavel_nome,
                    departamentoDestino: result.data.departamento_destino,
                    slaInfo: result.data.sla_info || result.data.slaInfo
                };
                chamadoSelecionado = chamados[index];
            }
            
            const destino = payload.delegado_para_nome || payload.delegado_para_setor;
            mostrarToast(`Chamado delegado com sucesso para ${destino}!`, 'success');
            
            // Atualizar UI
            atualizarEstatisticas();
            renderizarChamados();
            
            // Atualizar detalhes
            mostrarDetalhesChamado(chamadoSelecionado);
            
        } else {
            mostrarToast(result.detail || 'Erro ao delegar chamado', 'error');
        }
    } catch (error) {
        console.error('Erro ao delegar chamado:', error);
        mostrarToast('Erro ao delegar chamado. Tente novamente.', 'error');
    } finally {
        isSubmittingAction = false;
        if (btnDelegar) {
            btnDelegar.disabled = false;
            btnDelegar.innerHTML = '<i class="fas fa-check me-2"></i>Delegar Chamado';
        }
    }
}

function _getSuccessorLink(c) {
    // Busca chamado sucessor (que tem origin_chamado_id = c.id)
    const successor = chamados.find(ch => (ch.origin_chamado_id || ch.originChamadoId) === c.id);
    if (!successor) return '';
    return `
        <div class="mb-3 p-3" style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 8px;">
            <span class="text-muted small text-uppercase"><i class="fas fa-arrow-right me-1"></i>Chamado Sucessor</span>
            <div class="mt-1">
                <span class="text-light">Sucessor:</span>
                <a href="#" class="text-success fw-bold" onclick="event.preventDefault(); abrirDetalhe('${successor.id}')">${successor.id}</a>
                <span class="badge ${STATUS_CONFIG[successor.status]?.class || 'bg-secondary'} ms-2">${STATUS_CONFIG[successor.status]?.label || successor.status}</span>
            </div>
        </div>
    `;
}

function mostrarDetalhesChamado(c) {
    chamadoSelecionado = c;
    
    const statusConfig = STATUS_CONFIG[c.status];
    const nivelConfig = NIVEIS_CONFIG[c.currentLevel];
    const tipoConfig = getTipoConfig(c.type);
    const isClosed = c.status === 'resolvido' || c.status === 'fechado';
    const slaClass = getSlaClass(c);
    const slaCardClass = slaClass === 'sla-danger' ? 'sla-danger-bg' : 
                         slaClass === 'sla-warning' ? 'sla-warning-bg' : 'sla-ok-bg';
    // Verificar se é admin: usar IS_ADMIN (booleano global) ou USER_ROLE === 'admin'
    const isAdmin = (typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true) || 
                    (typeof USER_ROLE !== 'undefined' && USER_ROLE === 'admin');
    
    // Verificar flags de permissão retornadas pelo backend
    const readOnly = c.read_only === true;
    const canManage = c.can_manage === true;
    const visibilityContext = c.visibility_context || 'active';
    
    // Usar can_manage do backend se disponível, senão usar lógica de isClosed
    let podeGerenciar = c.hasOwnProperty('can_manage') 
        ? (canManage && !readOnly) 
        : (!isClosed);
    
    // Se o usuário entrou via "Apenas Acompanhar", NUNCA mostrar botões de gerenciar/delegar
    if (modoAcompanhar) {
        podeGerenciar = false;
    }
    
    // Cabeçalho com ID e Badge de Status
    document.getElementById('detalheId').innerHTML = `
        <span class="me-2">${c.id}</span>
        <span class="badge ${statusConfig.class}">${statusConfig.label}</span>
        ${c.createdFromTransition ? '<span class="badge bg-info ms-2" title="Chamado de transição do Atendimento"><i class="fas fa-exchange-alt me-1"></i>Transição</span>' : ''}
        ${readOnly ? '<span class="badge bg-secondary ms-2" title="Modo histórico - somente leitura"><i class="fas fa-eye"></i> Histórico</span>' : ''}
    `;
    
    // Calcular tempo restante do SLA
    const slaStatusText = getSlaStatusText(c);
    
    // Montar HTML do offcanvas
    document.getElementById('offcanvasDetalheBody').innerHTML = `
        <!-- 1.1 Botões de Ação (movido para o topo) -->
        ${podeGerenciar ? `
        <div class="mb-4 pb-3" style="border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
            <button class="btn btn-success btn-action-full" onclick="abrirModalAcao()">
                <i class="fas fa-cog me-2"></i>Gerenciar Chamado
            </button>
            ${isAdmin ? `
            <button class="btn btn-outline-warning btn-action-full mt-2" onclick="abrirModalDelegacao()">
                <i class="fas fa-user-cog me-2"></i>Delegar Chamado
            </button>
            ` : ''}
        </div>
        ` : readOnly ? `
        <div class="mb-4 pb-3 text-center" style="border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
            <div class="alert mb-0" style="background: rgba(158, 158, 158, 0.15); border: 1px solid rgba(158, 158, 158, 0.3); color: #b0bec5;">
                <i class="fas fa-history me-2"></i>
                <span>Visualização em modo histórico - somente leitura</span>
            </div>
        </div>
        ` : isClosed ? `
        <div class="mb-4 pb-3 text-center" style="border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
            <span class="badge bg-secondary px-4 py-2">
                <i class="fas fa-lock me-1"></i>Chamado Encerrado
            </span>
        </div>
        ` : `
        <div class="mb-4 pb-3" style="border-bottom: 1px solid rgba(76, 175, 80, 0.3);">
            <div class="alert mb-3" style="background: rgba(33, 150, 243, 0.1); border: 1px solid rgba(33, 150, 243, 0.3); color: #90caf9;">
                <i class="fas fa-eye me-2"></i>
                <span>Modo Acompanhamento — somente visualização</span>
            </div>
            <button class="btn btn-primary btn-action-full" onclick="assumirChamadoDoDetalhe()">
                <i class="fas fa-hand-paper me-2"></i>Assumir Chamado
            </button>
        </div>
        `}
        
        <!-- 1.2 Info do Criador -->
        <div class="creator-info-block">
            <div class="d-flex align-items-center gap-3">
                <div class="d-flex align-items-center justify-content-center" 
                     style="width: 45px; height: 45px; background: rgba(76, 175, 80, 0.2); border-radius: 50%;">
                    <i class="fas fa-user-check text-success fa-lg"></i>
                </div>
                <div>
                    <div class="fw-bold text-light">Aberto por: ${c.createdByName}</div>
                    <div class="small text-muted">
                        <i class="far fa-calendar-alt me-1"></i>${formatarDataHoraCompleta(c.createdAt)}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tipo do Chamado -->
        <div class="mb-3">
            <span class="text-muted small text-uppercase">Tipo do Chamado</span>
            <div class="fw-bold mt-1 text-light">${tipoConfig.icon} ${tipoConfig.label}</div>
        </div>
        
        <!-- Vínculo de Transição -->
        ${c.createdFromTransition && c.originChamadoId ? `
        <div class="mb-3 p-3" style="background: rgba(33, 150, 243, 0.1); border: 1px solid rgba(33, 150, 243, 0.3); border-radius: 8px;">
            <span class="text-muted small text-uppercase"><i class="fas fa-exchange-alt me-1"></i>Chamado de Transição</span>
            <div class="mt-1">
                <span class="text-light">Origem:</span>
                <a href="#" class="text-info fw-bold" onclick="event.preventDefault(); abrirDetalhe('${c.originChamadoId}')">${c.originChamadoId}</a>
            </div>
        </div>
        ` : ''}
        ${_getSuccessorLink(c)}
        
        <!-- 1.3 Nível Atual -->
        <div class="level-card">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <span class="text-muted small text-uppercase">Nível Atual</span>
                    <div class="mt-2">
                        <span class="badge nivel-${c.currentLevel.toLowerCase()} px-3 py-2" style="font-size: 0.9rem;">
                            ${nivelConfig.label}
                        </span>
                    </div>
                </div>
                <div class="text-end">
                    <span class="text-muted small text-uppercase">Departamento</span>
                    <div class="fw-bold mt-2 text-light">${nivelConfig.dept}</div>
                </div>
            </div>
        </div>
        
        <!-- 1.4 Status do SLA -->
        <div class="sla-card ${slaCardClass}">
            <div class="d-flex align-items-center gap-3 mb-3">
                <div class="d-flex align-items-center justify-content-center" 
                     style="width: 40px; height: 40px; background: ${getSlaIconBg(c)}; border-radius: 10px;">
                    ${getSlaIconLarge(c)}
                </div>
                <div>
                    <div class="fw-bold ${slaClass}" style="font-size: 1.1rem;">
                        ${c.slaCumprido === true ? '✓ SLA Cumprido' : 
                          c.slaCumprido === false ? '✗ SLA Excedido' : 
                          '⏳ SLA em Andamento'}
                    </div>
                    <div class="small text-muted">Prazo final: ${formatarData(c.slaDate)}</div>
                </div>
            </div>
            
            <hr style="border-color: rgba(255,255,255,0.1); margin: 0.75rem 0;">
            
            <div class="small">
                <div class="d-flex justify-content-between align-items-center py-1">
                    <span class="text-muted"><i class="fas fa-play-circle me-1"></i>Abertura:</span>
                    <span class="text-light">${formatarDataHoraBrasilia(c.slaInfo?.openedAt || c.createdAt)} - ${c.slaInfo?.openedBy || c.createdByName || 'Usuário'}</span>
                </div>
                
                ${c.slaInfo.closedAt ? `
                <div class="d-flex justify-content-between align-items-center py-1">
                    <span class="text-muted"><i class="fas fa-flag-checkered me-1"></i>Fechamento:</span>
                    <span class="text-light">${formatarDataHoraBrasilia(c.slaInfo.closedAt)} - ${c.slaInfo.closedBy}</span>
                </div>
                ` : ''}
                
                ${c.slaInfo.levelChanges && c.slaInfo.levelChanges.length > 1 ? `
                <hr style="border-color: rgba(255,255,255,0.1); margin: 0.75rem 0;">
                <div class="text-muted mb-2"><i class="fas fa-exchange-alt me-1"></i>Mudanças de Nível:</div>
                ${c.slaInfo.levelChanges.map((change, index) => `
                    <div class="sla-level-change">
                        <span class="badge nivel-${change.level.toLowerCase()}" style="min-width: 35px;">${change.level}</span>
                        <i class="fas fa-long-arrow-alt-right text-muted mx-1"></i>
                        <span class="text-light">${formatarDataHoraBrasilia(change.changedAt)}</span>
                        <span class="text-muted">- ${change.changedBy}</span>
                    </div>
                `).join('')}
                ` : ''}
            </div>
        </div>
        
        <!-- 1.5 Grid de Detalhes (2 colunas) -->
        <div class="detail-grid-enhanced">
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-bus"></i></div>
                <div class="detail-label">Prefixo</div>
                <div class="detail-value">${c.prefixo}</div>
            </div>
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-tag"></i></div>
                <div class="detail-label">Patrimônio</div>
                <div class="detail-value">${c.patrimonio}</div>
            </div>
            ${c.serial ? `
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-barcode"></i></div>
                <div class="detail-label">Serial</div>
                <div class="detail-value">${c.serial}</div>
            </div>
            ` : ''}
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-warehouse"></i></div>
                <div class="detail-label">Garagem</div>
                <div class="detail-value">${c.garagem}</div>
            </div>
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-folder-open"></i></div>
                <div class="detail-label">Projeto</div>
                <div class="detail-value">${c.projeto}</div>
            </div>
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-building"></i></div>
                <div class="detail-label">Departamento</div>
                <div class="detail-value">${c.departamento || c.tecnicoResponsavel}</div>
            </div>
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-calendar-plus"></i></div>
                <div class="detail-label">Abertura</div>
                <div class="detail-value">${formatarData(c.createdAt)}</div>
            </div>
            ${c.classificacao ? `
            <div class="detail-item">
                <div class="detail-icon"><i class="fas fa-layer-group"></i></div>
                <div class="detail-label">Classificação</div>
                <div class="detail-value">
                    <span class="badge bg-info" style="font-size: 0.85rem;">${c.classificacao}</span>
                </div>
            </div>
            ` : ''}
        </div>
        
        <!-- 1.6 Descrição -->
        <div class="mb-4">
            <h6 class="mb-2 text-muted text-uppercase" style="font-size: 0.8rem;">
                <i class="fas fa-align-left me-1"></i>Descrição
            </h6>
            <div class="description-box">${c.description || 'Sem descrição adicional.'}</div>
        </div>
        
        <hr style="border-color: rgba(76, 175, 80, 0.3);">
        
        <!-- 1.7 Histórico/Timeline -->
        <div class="mb-4">
            <h6 class="mb-3 text-muted text-uppercase" style="font-size: 0.8rem;">
                <i class="fas fa-history me-1"></i>Histórico do Chamado
            </h6>
            <div class="timeline-enhanced">
                ${renderizarHistoricoComTempo(c.history)}
            </div>
        </div>
    `;
    
    // Abrir offcanvas
    const offcanvas = new bootstrap.Offcanvas(document.getElementById('offcanvasDetalhe'));
    offcanvas.show();
}

/**
 * Retorna cor para o status do prefixo
 */
function getStatusColor(status) {
    const statusUpper = status ? status.toUpperCase() : '';
    if (statusUpper.includes('ONLINE') || statusUpper.includes('OPERAÇÃO') || statusUpper.includes('ATIVO')) {
        return '#22c55e'; // Verde
    } else if (statusUpper.includes('DIVERGENTE') || statusUpper.includes('DIVERGÊNCIA')) {
        return '#8b5cf6'; // Roxo/Violeta
    } else if (statusUpper.includes('ATENÇÃO') || statusUpper.includes('ATENCAO') || statusUpper.includes('WARNING')) {
        return '#f59e0b'; // Laranja
    } else if (statusUpper.includes('ALERTA') || statusUpper.includes('CRÍTICO') || statusUpper.includes('CRITICO')) {
        return '#f97316'; // Laranja escuro
    } else if (statusUpper.includes('INATIVO') || statusUpper.includes('OFFLINE') || statusUpper.includes('DESLIGADO')) {
        return '#ef4444'; // Vermelho
    } else if (statusUpper.includes('MANUTENÇÃO') || statusUpper.includes('MANUT')) {
        return '#6366f1'; // Índigo
    }
    return '#6c757d'; // Cinza padrão
}

// Funções auxiliares para SLA
function getSlaStatusText(chamado) {
    if (chamado.slaCumprido === true) return 'SLA Cumprido';
    if (chamado.slaCumprido === false) return 'SLA Excedido';
    
    const hoje = new Date();
    const slaDate = new Date(chamado.slaDate);
    const diffHoras = Math.ceil((slaDate - hoje) / (1000 * 60 * 60));
    
    if (diffHoras < 0) return `Excedido há ${Math.abs(diffHoras)}h`;
    if (diffHoras < 24) return `${diffHoras}h restantes`;
    return `${Math.ceil(diffHoras / 24)} dias restantes`;
}

function getSlaIconBg(chamado) {
    const slaClass = getSlaClass(chamado);
    if (slaClass === 'sla-ok') return 'rgba(34, 197, 94, 0.2)';
    if (slaClass === 'sla-warning') return 'rgba(234, 179, 8, 0.2)';
    return 'rgba(239, 68, 68, 0.2)';
}

function getSlaIconLarge(chamado) {
    const classe = getSlaClass(chamado);
    if (classe === 'sla-ok') return '<i class="fas fa-check-circle text-success fa-lg"></i>';
    if (classe === 'sla-warning') return '<i class="fas fa-clock text-warning fa-lg"></i>';
    return '<i class="fas fa-exclamation-triangle text-danger fa-lg"></i>';
}

// ============================================================================
// AÇÕES NO CHAMADO (Enhanced)
// ============================================================================

/**
 * Renderiza o histórico do chamado com tempo entre cada evento
 */
function renderizarHistoricoComTempo(history) {
    if (!history || history.length === 0) {
        return '<div class="text-muted small">Nenhum histórico disponível</div>';
    }
    
    // Ordenar histórico do mais recente para o mais antigo
    const sortedHistory = history.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    
    for (let i = 0; i < sortedHistory.length; i++) {
        const h = sortedHistory[i];
        const nextEvent = sortedHistory[i + 1]; // Evento anterior cronologicamente
        
        // Calcular tempo no nível (diferença entre este evento e o próximo na lista)
        let tempoNoNivel = '';
        let labelTempo = '';
        if (nextEvent) {
            const diffMs = new Date(h.date) - new Date(nextEvent.date);
            tempoNoNivel = formatarDuracaoDetalhada(diffMs);
            
            // Definir label mais claro indicando de qual nível é esse tempo
            if (h.level) {
                labelTempo = `Tempo em ${h.level}`;
            } else if (h.action && h.action.includes('Enviado para')) {
                // Se é um "Enviado para", o tempo anterior é do nível que saiu
                const nextLevel = h.from_level || nextEvent.level || 'anterior';
                labelTempo = `Tempo em ${nextLevel}`;
            } else if (h.action && h.action.includes('Avançado para')) {
                const nextLevel = h.from_level || nextEvent.level || 'anterior';
                labelTempo = `Tempo em ${nextLevel}`;
            } else {
                labelTempo = 'Tempo no nível';
            }
        }
        
        html += `
            <div class="timeline-enhanced-item">
                <div class="timeline-date">${formatarDataHoraCompleta(h.date)}</div>
                <div class="timeline-action">${h.action}</div>
                <div class="timeline-responsible">${h.responsible || 'Usuário'}</div>
                ${tempoNoNivel ? `
                <div class="timeline-duration">
                    <i class="fas fa-clock me-1"></i>${labelTempo}: ${tempoNoNivel}
                </div>
                ` : ''}
                ${h.notes ? `
                <div class="timeline-notes-card">
                    <i class="fas fa-comment-alt me-1"></i>${h.notes}
                </div>
                ` : ''}
                ${h.attachments && h.attachments.length > 0 ? `
                <div class="timeline-attachments">
                    <div class="small text-muted mb-1"><i class="fas fa-paperclip me-1"></i>Anexos:</div>
                    ${h.attachments.map(att => `
                        <a href="${att.url}" target="_blank" class="attachment-badge" title="${att.name}">
                            <i class="fas fa-${getFileIconFromUrl(att.name)} me-1"></i>
                            ${att.name}
                        </a>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;
    }
    
    return html;
}

/**
 * Retorna ícone baseado na URL/nome do arquivo
 */
function getFileIconFromUrl(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'file-pdf',
        'doc': 'file-word',
        'docx': 'file-word',
        'xls': 'file-excel',
        'xlsx': 'file-excel',
        'txt': 'file-alt',
        'jpg': 'file-image',
        'jpeg': 'file-image',
        'png': 'file-image',
        'gif': 'file-image',
        'bmp': 'file-image'
    };
    return icons[ext] || 'file';
}

/**
 * Formata duração em milissegundos para formato legível
 */
function formatarDuracaoDetalhada(ms) {
    if (!ms || ms <= 0) return '';
    
    const segundos = Math.floor(ms / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (dias > 0) {
        const horasRestantes = horas % 24;
        return `${dias}d ${horasRestantes}h`;
    } else if (horas > 0) {
        const minutosRestantes = minutos % 60;
        return `${horas}h ${minutosRestantes}min`;
    } else if (minutos > 0) {
        return `${minutos} min`;
    } else {
        return 'menos de 1 min';
    }
}

// Estado de drag-and-drop
let draggedChamadoId = null;
let dragSourceNivel = null;

function abrirModalAcao(fromDragDrop = false, targetNivel = null) {
    if (!chamadoSelecionado) return;
    
    // Fechar offcanvas se estiver aberto
    const offcanvasEl = document.getElementById('offcanvasDetalhe');
    const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
    if (offcanvasInstance) {
        offcanvasInstance.hide();
    }
    
    // Configurar modal
    document.getElementById('acaoChamadoId').value = chamadoSelecionado.id;
    document.getElementById('acaoComentario').value = '';
    document.getElementById('acaoComentario').classList.remove('validation-error');
    document.getElementById('acaoNivelDestino').value = '';
    document.getElementById('acaoFromDragDrop').value = fromDragDrop ? 'true' : 'false';
    document.getElementById('acaoDragDropNivel').value = targetNivel || '';
    
    // Limpar e esconder containers de seleção
    const selectDeptContainer = document.getElementById('selectDepartamentoContainer');
    const selectClassContainer = document.getElementById('selectClassificacaoContainer');
    if (selectDeptContainer) selectDeptContainer.style.display = 'none';
    if (selectClassContainer) selectClassContainer.style.display = 'none';
    
    // Limpar dropdowns de departamento e classificação
    const deptSelect = document.getElementById('acaoDepartamentoDestino');
    const classSelect = document.getElementById('acaoClassificacao');
    if (deptSelect) deptSelect.value = '';
    if (classSelect) classSelect.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione a classificação...</option>';
    
    // Limpar e esconder campos N4
    const camposN4 = document.getElementById('camposN4Container');
    if (camposN4) camposN4.style.display = 'none';
    const selectTecnico = document.getElementById('acaoTecnicoResponsavel');
    const selectEquipe = document.getElementById('acaoEquipeEmails');
    if (selectTecnico) selectTecnico.value = '';
    if (selectEquipe) {
        for (let option of selectEquipe.options) {
            option.selected = false;
        }
    }
    
    // Resetar seleção de ações
    document.querySelectorAll('.action-option-enhanced').forEach(el => {
        el.classList.remove('selected', 'selected-advance', 'selected-goto', 'selected-close');
    });
    document.querySelectorAll('input[name="tipoAcao"]').forEach(el => el.checked = false);
    acaoSelecionada = null;
    
    // Resetar botão
    const btn = document.getElementById('btnExecutarAcao');
    btn.disabled = true;
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Ação';
    
    // Lógica especial para departamento Atendimento
    const isAtendimento = USER_DEPARTMENT === 'Atendimento';
    const optionGoto = document.getElementById('optionGoto');
    const optionClose = document.getElementById('optionClose');
    const optionComplete = document.getElementById('optionComplete');
    
    if (isAtendimento) {
        // Departamento Atendimento: esconder "Enviar para nível" e "Finalizar Chamado", mostrar apenas "Concluir Verificação"
        if (optionGoto) optionGoto.style.display = 'none';
        if (optionClose) optionClose.style.display = 'none';
        if (optionComplete) optionComplete.style.display = 'block';
    } else {
        // Outros departamentos: mostrar "Enviar para nível" e "Finalizar Chamado", esconder "Concluir Verificação"
        if (optionGoto) optionGoto.style.display = 'block';
        if (optionClose) optionClose.style.display = 'block';
        if (optionComplete) optionComplete.style.display = 'none';
    }
    
    // Configurar drag-and-drop indicator
    const dragIndicator = document.getElementById('dragSourceIndicator');
    if (fromDragDrop && targetNivel) {
        dragIndicator.classList.remove('d-none');
        document.getElementById('dragSourceText').innerHTML = `
            Movendo <strong>${chamadoSelecionado.id}</strong> de 
            <span class="badge nivel-${chamadoSelecionado.currentLevel.toLowerCase()}">${chamadoSelecionado.currentLevel}</span> 
            para <span class="badge nivel-${targetNivel.toLowerCase()}">${targetNivel}</span>
        `;
        
        // Pré-selecionar "Enviar para nível específico" e definir o nível
        setTimeout(() => {
            selecionarAcao('goto');
            document.getElementById('acaoNivelDestino').value = targetNivel;
            
            // ⚡ Auto-detect encaminhamento: preencher departamento automaticamente
            const nivelConfig = NIVEIS_CONFIG[targetNivel];
            if (nivelConfig) {
                // Mapear dept do NIVEIS_CONFIG para o value do <option> no select HTML
                const DEPT_OPTION_MAP = {
                    'Business Intelligence': 'Business Intelligence (BI)'
                };
                const targetDeptOption = DEPT_OPTION_MAP[nivelConfig.dept] || nivelConfig.dept;
                
                const deptSelect = document.getElementById('acaoDepartamentoDestino');
                deptSelect.value = targetDeptOption;
                
                // Esconder seleção de departamento (já pré-preenchido pelo drag-drop)
                document.getElementById('selectDepartamentoContainer').style.display = 'none';
                
                // Disparar carregamento das classificações e exibir
                atualizarClassificacoesAcao();
                
                console.log(`📋 Encaminhamento drag-drop: departamento '${targetDeptOption}' pré-selecionado automaticamente`);
            }
        }, 100);
    } else {
        dragIndicator.classList.add('d-none');
    }
    
    // Configurar evento de input no comentário
    const comentarioInput = document.getElementById('acaoComentario');
    comentarioInput.removeEventListener('input', validarComentario);
    comentarioInput.addEventListener('input', validarComentario);
    
    // Configurar evento de mudança nos anexos
    const anexosInput = document.getElementById('acaoAnexos');
    if (anexosInput) {
        anexosInput.value = ''; // Limpar anexos anteriores
        document.getElementById('listaAnexos').innerHTML = '';
        anexosInput.removeEventListener('change', atualizarListaAnexos);
        anexosInput.addEventListener('change', atualizarListaAnexos);
    }
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalAcao'));
    modal.show();
    
    // Adicionar listener para limpar seleção ao fechar o modal
    const modalElement = document.getElementById('modalAcao');
    modalElement.addEventListener('hidden.bs.modal', function limparSelecao() {
        // Resetar seleção de ações
        document.querySelectorAll('.action-option-enhanced').forEach(el => {
            el.classList.remove('selected', 'selected-advance', 'selected-goto', 'selected-close', 'selected-update', 'selected-complete');
        });
        document.querySelectorAll('input[name="tipoAcao"]').forEach(el => el.checked = false);
        acaoSelecionada = null;
        
        // Remover este listener após execução (evitar múltiplos listeners)
        modalElement.removeEventListener('hidden.bs.modal', limparSelecao);
    }, { once: true });
}

/**
 * Atualiza a lista de anexos selecionados
 */
function atualizarListaAnexos() {
    const anexosInput = document.getElementById('acaoAnexos');
    const listaAnexos = document.getElementById('listaAnexos');
    
    if (!anexosInput || !anexosInput.files || anexosInput.files.length === 0) {
        listaAnexos.innerHTML = '';
        return;
    }
    
    let html = '<div class="mt-2"><small class="text-muted">Arquivos selecionados:</small><ul class="list-group list-group-sm mt-1">';
    
    for (let i = 0; i < anexosInput.files.length; i++) {
        const file = anexosInput.files[i];
        const sizeKB = (file.size / 1024).toFixed(1);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
        
        // Verificar tamanho máximo (10MB)
        const isTooBig = file.size > 10 * 1024 * 1024;
        const className = isTooBig ? 'list-group-item-danger' : 'list-group-item-light';
        
        html += `
            <li class="list-group-item ${className} d-flex justify-content-between align-items-center py-1 px-2" style="font-size: 0.85rem;">
                <span>
                    <i class="fas fa-${getFileIcon(file.name)} me-1"></i>
                    ${file.name}
                </span>
                <span class="badge ${isTooBig ? 'bg-danger' : 'bg-secondary'}">${sizeText}</span>
            </li>
        `;
    }
    
    html += '</ul></div>';
    listaAnexos.innerHTML = html;
}

/**
 * Retorna o ícone apropriado baseado na extensão do arquivo
 */
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'file-pdf',
        'doc': 'file-word',
        'docx': 'file-word',
        'xls': 'file-excel',
        'xlsx': 'file-excel',
        'txt': 'file-alt',
        'jpg': 'file-image',
        'jpeg': 'file-image',
        'png': 'file-image',
        'gif': 'file-image',
        'bmp': 'file-image'
    };
    return icons[ext] || 'file';
}

function validarComentario() {
    const comentario = document.getElementById('acaoComentario').value.trim();
    const btn = document.getElementById('btnExecutarAcao');
    
    if (acaoSelecionada && comentario.length >= 5) {
        btn.disabled = false;
        document.getElementById('acaoComentario').classList.remove('validation-error');
    } else {
        btn.disabled = true;
    }
}

function selecionarAcao(tipo) {
    acaoSelecionada = tipo;
    
    // Atualizar UI - remover todas as classes de seleção
    document.querySelectorAll('.action-option-enhanced').forEach(el => {
        el.classList.remove('selected', 'selected-advance', 'selected-goto', 'selected-close', 'selected-update', 'selected-complete');
    });
    
    // Adicionar classe específica baseada no tipo
    const selectedOption = document.getElementById(`option${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    if (selectedOption) {
        selectedOption.classList.add('selected', `selected-${tipo}`);
    }
    
    // Marcar radio button
    const radioBtn = document.querySelector(`input[value="${tipo}"]`);
    if (radioBtn) radioBtn.checked = true;
    
    // Mostrar/ocultar containers de departamento/classificação
    const selectDeptContainer = document.getElementById('selectDepartamentoContainer');
    const selectClassContainer = document.getElementById('selectClassificacaoContainer');
    const camposN4 = document.getElementById('camposN4Container');
    
    if (tipo === 'goto') {
        // Mostrar dropdown de departamento
        if (selectDeptContainer) selectDeptContainer.style.display = 'block';
        // Esconder campos N4 (será mostrado quando classificação for "Atendimento Externo (N4)")
        if (camposN4) camposN4.style.display = 'none';
        document.getElementById('acaoNivelDestino').value = '';
    } else {
        // Para outras ações (close, complete, update), esconder departamento/classificação e campos N4
        if (selectDeptContainer) selectDeptContainer.style.display = 'none';
        if (selectClassContainer) selectClassContainer.style.display = 'none';
        if (camposN4) camposN4.style.display = 'none';
        document.getElementById('acaoNivelDestino').value = '';
        // Limpar dropdowns
        const deptSelect = document.getElementById('acaoDepartamentoDestino');
        const classSelect = document.getElementById('acaoClassificacao');
        if (deptSelect) deptSelect.value = '';
        if (classSelect) classSelect.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione a classificação...</option>';
    }
    
    // Atualizar botão com cor específica
    const btn = document.getElementById('btnExecutarAcao');
    if (tipo === 'close') {
        btn.className = 'btn btn-success';
        btn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Finalizar Chamado';
    } else if (tipo === 'complete') {
        btn.className = 'btn btn-success';
        btn.innerHTML = '<i class="fas fa-clipboard-check me-2"></i>Concluir Verificação';
    } else if (tipo === 'update') {
        btn.className = 'btn btn-info';
        btn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Atualizar Andamento';
    } else {
        btn.className = 'btn btn-warning';
        btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Enviar para Nível';
    }
    
    // Validar se pode habilitar botão
    validarComentario();
}

/**
 * Atualiza as classificações disponíveis baseado no departamento selecionado
 */
function atualizarClassificacoesAcao() {
    const deptSelect = document.getElementById('acaoDepartamentoDestino');
    const classSelect = document.getElementById('acaoClassificacao');
    const classContainer = document.getElementById('selectClassificacaoContainer');
    const camposN4 = document.getElementById('camposN4Container');
    const optionClose = document.getElementById('optionClose');
    const departamento = deptSelect.value;
    
    // Limpar opções atuais
    classSelect.innerHTML = '<option value="" style="background-color: #1a1a2e; color: #ffffff;">Selecione a classificação...</option>';
    
    // Esconder campos N4 ao mudar departamento
    if (camposN4) camposN4.style.display = 'none';
    document.getElementById('acaoNivelDestino').value = '';
    
    // Mostrar novamente o botão Finalizar (pode ter sido escondido por Atendimento Externo)
    if (optionClose && USER_DEPARTMENT !== 'Atendimento') {
        optionClose.style.display = 'block';
    }
    
    if (!departamento) {
        if (classContainer) classContainer.style.display = 'none';
        return;
    }
    
    // Buscar classificações do departamento selecionado
    const classificacoes = CLASSIFICACOES_CONFIG[departamento] || [];
    
    if (classificacoes.length === 0) {
        // Se não há classificações, ocultar o container
        if (classContainer) classContainer.style.display = 'none';
    } else {
        // Mostrar o container e preencher opções
        if (classContainer) classContainer.style.display = 'block';
        classificacoes.forEach(c => {
            classSelect.innerHTML += `<option value="${c}" style="background-color: #1a1a2e; color: #ffffff;">${c}</option>`;
        });
    }
    
    // Revalidar formulário
    validarComentario();
}

/**
 * Chamado quando a classificação muda
 */
function onClassificacaoChange() {
    const classSelect = document.getElementById('acaoClassificacao');
    const camposN4 = document.getElementById('camposN4Container');
    const optionClose = document.getElementById('optionClose');
    const classificacao = classSelect.value;
    
    // Verificar se é Atendimento Externo (N4) - precisa de técnico e equipe
    if (classificacao === 'Atendimento Externo (N4)') {
        if (camposN4) camposN4.style.display = 'block';
        // Definir nível destino como N4
        document.getElementById('acaoNivelDestino').value = 'N4';
        // Carregar técnicos se ainda não carregou
        if (tecnicos.length === 0) {
            carregarTecnicosN4();
        }
        // Esconder botão Finalizar para N4 (Atendimento Externo)
        if (optionClose) optionClose.style.display = 'none';
        console.log('📋 Classificação Atendimento Externo (N4): Campos N4 exibidos, Finalizar oculto');
    } else if (classificacao === 'Verificar chip') {
        // Verificar chip = N1 (Atendimento) - preencher dados do chip automaticamente
        if (camposN4) camposN4.style.display = 'none';
        document.getElementById('acaoNivelDestino').value = 'N1';
        // Mostrar novamente o botão Finalizar (se não for Atendimento)
        if (optionClose && USER_DEPARTMENT !== 'Atendimento') {
            optionClose.style.display = 'block';
        }
        // Preencher dados do chip automaticamente
        if (chamadoSelecionado) {
            preencherDadosChipN1(chamadoSelecionado);
        }
        console.log('📋 Classificação Verificar chip: Preenchendo dados do chip automaticamente');
    } else {
        if (camposN4) camposN4.style.display = 'none';
        // Definir nível destino baseado na classificação
        const nivelDestino = CLASSIFICACAO_NIVEL_MAP[classificacao] || null;
        document.getElementById('acaoNivelDestino').value = nivelDestino || '';
        // Mostrar novamente o botão Finalizar (se não for Atendimento)
        if (optionClose && USER_DEPARTMENT !== 'Atendimento') {
            optionClose.style.display = 'block';
        }
    }
    
    // Revalidar formulário
    validarComentario();
}

async function executarAcao() {
    if (!acaoSelecionada) {
        mostrarToast('Selecione uma ação', 'warning');
        return;
    }
    
    // Anti-double-click: verificar se já está enviando
    if (isSubmittingAction) {
        console.log('⚠️ Ação já em andamento, ignorando clique duplicado');
        return;
    }
    
    const chamadoId = document.getElementById('acaoChamadoId').value;
    const comentario = document.getElementById('acaoComentario').value.trim();
    const nivelDestino = document.getElementById('acaoNivelDestino').value;
    const departamentoDestino = document.getElementById('acaoDepartamentoDestino')?.value || '';
    const classificacao = document.getElementById('acaoClassificacao')?.value || '';
    const btnConfirmarAcao = document.getElementById('btnExecutarAcao');
    
    // Validar comentário obrigatório
    if (!comentario || comentario.length < 5) {
        document.getElementById('acaoComentario').classList.add('validation-error');
        document.getElementById('acaoComentario').focus();
        mostrarToast('Comentário obrigatório (mínimo 5 caracteres)', 'danger');
        return;
    }
    
    // Validações para ação "goto" - requer departamento e classificação
    if (acaoSelecionada === 'goto') {
        if (!departamentoDestino) {
            mostrarToast('Selecione o departamento de destino', 'warning');
            return;
        }
        // Verificar se departamento tem classificações e se foi selecionada
        const classificacoes = CLASSIFICACOES_CONFIG[departamentoDestino] || [];
        if (classificacoes.length > 0 && !classificacao) {
            mostrarToast('Selecione a classificação', 'warning');
            return;
        }
    }
    
    // Validar campos N4 se o destino for N4
    if (acaoSelecionada === 'goto' && nivelDestino === 'N4') {
        if (!validarCamposN4()) {
            return;
        }
    }
    
    // Ativar estado de loading após validações passarem
    isSubmittingAction = true;
    if (btnConfirmarAcao) {
        btnConfirmarAcao.disabled = true;
        btnConfirmarAcao.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processando...';
    }
    
    // Encontrar chamado
    const chamado = chamados.find(c => c.id === chamadoId);
    if (!chamado) {
        isSubmittingAction = false;
        if (btnConfirmarAcao) { btnConfirmarAcao.disabled = false; btnConfirmarAcao.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Ação'; }
        return;
    }
    
    const nivelOrder = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
    let targetLevel = nivelDestino;
    
    if (acaoSelecionada === 'goto') {
        // Para goto, usar o nivelDestino já calculado pela classificação selecionada
        // Se não houver mapeamento (ex: Prestador, Gerência), manter nível atual
        if (!targetLevel) {
            targetLevel = chamado.currentLevel;
            console.log('📋 Classificação sem nível mapeado, mantendo nível atual:', targetLevel);
        }
    } else if (acaoSelecionada === 'complete') {
        // Concluir Verificação (Atendimento): Retornar para o setor que enviou
        // Se não houver histórico de mudanças de nível ou houver apenas 1 entrada (aberto diretamente no Atendimento)
        // retornar para CCO (N0). Caso contrário, retornar para o nível anterior.
        if (!chamado.slaInfo || !chamado.slaInfo.levelChanges || chamado.slaInfo.levelChanges.length <= 1) {
            // Sem histórico suficiente: enviar para CCO (N0)
            targetLevel = 'N0';
            console.log('🔄 Concluir Verificação: Sem nível anterior identificado, enviando para CCO (N0)');
        } else {
            // Pegar o penúltimo nível (o anterior ao Atendimento/N1)
            const previousLevel = chamado.slaInfo.levelChanges[chamado.slaInfo.levelChanges.length - 2];
            targetLevel = previousLevel.level;
            console.log('🔄 Concluir Verificação: Retornando para', targetLevel);
        }
    } else if (acaoSelecionada === 'close') {
        // Para fechar, não precisa de targetLevel (mantém o atual)
        targetLevel = chamado.currentLevel;
    } else if (acaoSelecionada === 'update') {
        // Para atualizar, não muda o nível (mantém o atual)
        targetLevel = chamado.currentLevel;
    }
    
    // Validar que targetLevel foi definido
    if (!targetLevel && acaoSelecionada !== 'close' && acaoSelecionada !== 'update') {
        console.error('❌ targetLevel não definido para ação:', acaoSelecionada);
        mostrarToast('Erro: Nível de destino não definido', 'danger');
        isSubmittingAction = false;
        if (btnConfirmarAcao) { btnConfirmarAcao.disabled = false; btnConfirmarAcao.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Ação'; }
        return;
    }
    
    console.log('📤 Executando ação:', acaoSelecionada, '| Target Level:', targetLevel);
    
    // Verificar se está tentando mover para o mesmo nível (não aplicável para 'update')
    if (acaoSelecionada === 'goto' && targetLevel === chamado.currentLevel) {
        mostrarToast('O chamado já está neste nível', 'warning');
        isSubmittingAction = false;
        if (btnConfirmarAcao) { btnConfirmarAcao.disabled = false; btnConfirmarAcao.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Ação'; }
        return;
    }
    
    try {
        if (useApi) {
            // Usar API
            // Verificar se há anexos
            const anexosInput = document.getElementById('acaoAnexos');
            const hasFiles = anexosInput && anexosInput.files && anexosInput.files.length > 0;
            
            if (hasFiles) {
                // Enviar como FormData quando há anexos
                const formData = new FormData();
                formData.append('action', acaoSelecionada);
                formData.append('target_level', targetLevel || '');
                formData.append('notes', comentario);
                formData.append('user_email', USER_EMAIL);
                formData.append('user_name', USER_NAME);
                formData.append('user_departamento', USER_DEPARTMENT || '');  // Para validação de permissão
                formData.append('is_admin', IS_ADMIN || false);  // Flag de administrador
                
                // Adicionar departamento e classificação se for ação "goto"
                if (acaoSelecionada === 'goto') {
                    formData.append('departamento_destino', departamentoDestino);
                    if (classificacao) {
                        formData.append('classificacao', classificacao);
                    }
                }
                
                // Adicionar dados N4 se aplicável
                const dadosN4 = obterDadosN4();
                if (dadosN4) {
                    if (dadosN4.tecnico_responsavel_email) {
                        formData.append('tecnico_responsavel_email', dadosN4.tecnico_responsavel_email);
                    }
                    if (dadosN4.equipe_emails && dadosN4.equipe_emails.length > 0) {
                        formData.append('equipe_emails', JSON.stringify(dadosN4.equipe_emails));
                    }
                }
                
                // Adicionar arquivos
                for (let i = 0; i < anexosInput.files.length; i++) {
                    formData.append('files', anexosInput.files[i]);
                }
                
                const response = await fetch(`${API_BASE}/${chamadoId}/action`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                    // NÃO adicionar Content-Type, o browser define automaticamente com boundary
                });
                
                if (!response.ok) {
                    const errorResult = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
                    console.error('❌ Erro da API:', errorResult);
                    throw new Error(errorResult.detail || `Erro HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                const chamadoAtualizado = result.data;
                
                // Atualizar chamado no array local
                const index = chamados.findIndex(c => c.id === chamadoId);
                if (index >= 0) {
                    chamados[index] = normalizarChamado(chamadoAtualizado);
                }
                
                const msg = acaoSelecionada === 'close' ? 'Chamado finalizado com sucesso!' :
                            acaoSelecionada === 'complete' ? `Verificação concluída! Chamado retornou para ${targetLevel}.` :
                            `Chamado enviado para ${departamentoDestino}! Classificação: ${classificacao || 'N/A'}`;
                mostrarToast(msg, 'success');
                
            } else {
                // Enviar como JSON quando NÃO há anexos (backward compatibility)
                // Para JSON, ainda precisamos enviar como FormData por causa dos novos campos N4
                const formData = new FormData();
                formData.append('action', acaoSelecionada);
                formData.append('target_level', targetLevel || '');
                formData.append('notes', comentario);
                formData.append('user_email', USER_EMAIL);
                formData.append('user_name', USER_NAME);
                formData.append('user_departamento', USER_DEPARTMENT || '');  // Para validação de permissão
                formData.append('is_admin', IS_ADMIN || false);  // Flag de administrador
                
                // Adicionar departamento e classificação se for ação "goto"
                if (acaoSelecionada === 'goto') {
                    formData.append('departamento_destino', departamentoDestino);
                    if (classificacao) {
                        formData.append('classificacao', classificacao);
                    }
                }
                
                // Adicionar dados N4 se aplicável
                const dadosN4 = obterDadosN4();
                if (dadosN4) {
                    if (dadosN4.tecnico_responsavel_email) {
                        formData.append('tecnico_responsavel_email', dadosN4.tecnico_responsavel_email);
                    }
                    if (dadosN4.equipe_emails && dadosN4.equipe_emails.length > 0) {
                        formData.append('equipe_emails', JSON.stringify(dadosN4.equipe_emails));
                    }
                }
                
                const response = await fetch(`${API_BASE}/${chamadoId}/action`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorResult = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
                    console.error('❌ Erro da API:', errorResult);
                    throw new Error(errorResult.detail || `Erro HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                const chamadoAtualizado = result.data;
                
                // Atualizar chamado no array local
                const index = chamados.findIndex(c => c.id === chamadoId);
                if (index >= 0) {
                    chamados[index] = normalizarChamado(chamadoAtualizado);
                }
                
                const msg = acaoSelecionada === 'close' ? 'Chamado finalizado com sucesso!' :
                            acaoSelecionada === 'complete' ? `Verificação concluída! Chamado retornou para ${targetLevel}.` :
                            acaoSelecionada === 'update' ? 'Histórico atualizado com sucesso!' :
                            `Chamado enviado para ${departamentoDestino}! Classificação: ${classificacao || 'N/A'}`;
                mostrarToast(msg, 'success');
            }
            
        } else {
            // Fallback local
            executarAcaoLocal(chamado, acaoSelecionada, targetLevel, comentario);
        }
        
        // Fechar modal e atualizar UI
        bootstrap.Modal.getInstance(document.getElementById('modalAcao'))?.hide();
        
        // Recarregar chamados do servidor para garantir dados atualizados
        await carregarDados();
        
        atualizarEstatisticas();
        renderizarChamados();
        
    } catch (error) {
        console.error('Erro ao executar ação:', error);
        
        // Extrair mensagem de erro detalhada do backend
        let errorMessage = 'Erro ao executar ação';
        
        if (error.message) {
            // Se a mensagem contém "Erro HTTP", extrair a parte detalhada
            if (error.message.includes('Erro HTTP')) {
                errorMessage = error.message;
            } else if (error.message.includes('403')) {
                errorMessage = 'Este chamado está em modo histórico (somente leitura)';
            } else {
                errorMessage = error.message;
            }
        }
        
        // Mostrar mensagem específica ao usuário
        mostrarToast(errorMessage, 'danger');
        
        // Não fazer fallback em caso de erro de validação (400, 403, etc)
        if (!error.message || (!error.message.includes('403') && !error.message.includes('400') && !error.message.includes('já existe'))) {
            console.log('🔄 Tentando fallback local...');
            executarAcaoLocal(chamado, acaoSelecionada, targetLevel, comentario);
            
            // Atualizar UI mesmo no fallback
            bootstrap.Modal.getInstance(document.getElementById('modalAcao'))?.hide();
            
            // Recarregar chamados do servidor
            try {
                await carregarDados();
            } catch (e) {
                console.warn('Erro ao recarregar dados:', e);
            }
            
            atualizarEstatisticas();
            renderizarChamados();
        }
    } finally {
        // Restaurar estado do botão (sempre executar)
        isSubmittingAction = false;
        if (btnConfirmarAcao) {
            btnConfirmarAcao.disabled = false;
            btnConfirmarAcao.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Ação';
        }
    }
}

function executarAcaoLocal(chamado, acao, targetLevel, comentario) {
    const now = new Date().toISOString();
    const userName = USER_NAME || 'Usuário Atual';
    
    if (acao === 'close') {
        // Fechar chamado
        const slaDate = new Date(chamado.slaDate);
        chamado.status = 'resolvido';
        chamado.slaCumprido = slaDate >= new Date();
        chamado.updatedAt = now;
        chamado.history.push({
            id: `h${chamado.history.length + 1}`,
            date: now,
            action: 'Chamado concluído',
            responsible: userName,
            level: chamado.currentLevel,
            notes: comentario
        });
        chamado.slaInfo.closedAt = now;
        chamado.slaInfo.closedBy = userName;
        
        mostrarToast('Chamado concluído com sucesso!', 'success');
    } else if (acao === 'update') {
        // Atualizar andamento - muda status para PENDENTE para melhor controle
        const statusAnterior = chamado.status;
        chamado.status = 'pendente';
        chamado.updatedAt = now;
        chamado.history.push({
            id: `h${chamado.history.length + 1}`,
            date: now,
            action: 'Atualização de andamento',
            responsible: userName,
            level: chamado.currentLevel,
            notes: comentario,
            status_anterior: statusAnterior,
            status_novo: 'pendente'
        });
        
        mostrarToast('Histórico atualizado - Chamado marcado como pendente', 'success');
    } else {
        // Enviar para nível
        const acaoText = `Enviado para ${targetLevel}`;
        const oldLevel = chamado.currentLevel;
        
        chamado.currentLevel = targetLevel;
        // Atualizar departamento_destino baseado no novo nível
        chamado.departamento_destino = NIVEIS_CONFIG[targetLevel]?.departamento || 'CCO';
        chamado.departamentoDestino = chamado.departamento_destino;
        // Ao mudar de nível, o chamado volta para ABERTO para que o próximo setor possa assumir
        chamado.status = 'aberto';
        // Limpar responsável para que outro usuário possa assumir
        chamado.usuario_responsavel_email = null;
        chamado.usuario_responsavel_nome = null;
        chamado.usuarioResponsavelEmail = null;
        chamado.usuarioResponsavelNome = null;
        chamado.updatedAt = now;
        chamado.history.push({
            id: `h${chamado.history.length + 1}`,
            date: now,
            action: acaoText,
            responsible: userName,
            level: targetLevel,
            fromLevel: oldLevel,
            toLevel: targetLevel,
            notes: comentario
        });
        chamado.slaInfo.levelChanges.push({
            level: targetLevel,
            changedAt: now,
            changedBy: userName
        });
        
        // Recalcular SLA baseado no novo nível
        const nivelConfig = NIVEIS_CONFIG[targetLevel];
        if (nivelConfig) {
            const novoSlaDate = new Date();
            novoSlaDate.setHours(novoSlaDate.getHours() + nivelConfig.slaHoras);
            chamado.slaDate = novoSlaDate.toISOString().split('T')[0];
        }
        
        mostrarToast(`Chamado enviado para ${targetLevel}!`, 'success');
    }
}

// ============================================================================
// CRIAR CHAMADO
// ============================================================================

async function criarChamado() {
    // Anti-double-click
    if (isSubmittingAction) {
        console.log('⚠️ Criação já em andamento, ignorando clique duplicado');
        return;
    }
    
    const tipo = document.getElementById('novoTipo').value;
    const departamentoDestino = document.getElementById('novoDepartamentoDestino').value;
    const classificacao = document.getElementById('novaClassificacao').value.trim();
    const descricao = document.getElementById('novoDescricao').value.trim();
    
    // Verificar se há equipamentos encontrados na busca
    if (!_equipamentosParaChamado || _equipamentosParaChamado.length === 0) {
        mostrarToast('Busque os patrimônios primeiro clicando em "Buscar Dados"', 'warning');
        return;
    }
    
    // Validação básica
    if (!tipo || !departamentoDestino) {
        mostrarToast('Preencha todos os campos obrigatórios', 'warning');
        return;
    }
    
    // Validar classificação se o departamento possui classificações
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamentoDestino] || [];
    if (classificacoesDoDept.length > 0 && !classificacao) {
        mostrarToast('Selecione uma classificação', 'warning');
        return;
    }
    
    // Desabilitar botão e mostrar loading
    const btnCriar = document.getElementById('btnCriarChamado');
    if (!btnCriar) {
        console.error('Botão btnCriarChamado não encontrado!');
        mostrarToast('Erro ao criar chamado. Recarregue a página.', 'danger');
        return;
    }
    
    let btnText = btnCriar.querySelector('span');
    let btnIcon = btnCriar.querySelector('i');
    
    if (!btnText || !btnIcon) {
        const children = Array.from(btnCriar.childNodes);
        btnIcon = btnIcon || children.find(n => n.tagName === 'I');
        btnText = btnText || children.find(n => n.tagName === 'SPAN');
    }
    
    const originalText = btnText ? btnText.textContent : 'Criar Chamado';
    
    btnCriar.disabled = true;
    isSubmittingAction = true;
    if (btnIcon) btnIcon.className = 'fas fa-spinner fa-spin me-2';
    if (btnText) btnText.textContent = 'Criando...';
    
    try {
    
    // Verificar se é Operações e determinar nível pela classificação
    let nivelOperacoes = null;
    let tecnicoResponsavelEmail = null;
    let equipeEmails = null;
    
    if (departamentoDestino === 'Operações') {
        nivelOperacoes = (classificacao === 'Atendimento Externo' || classificacao === 'Atendimento Externo (N4)') ? 'N4' : 'N3';
        
        if (nivelOperacoes === 'N4') {
            const tecnicoSelect = document.getElementById('novoTecnicoResponsavel');
            tecnicoResponsavelEmail = tecnicoSelect ? tecnicoSelect.value : '';
            
            if (!tecnicoResponsavelEmail) {
                mostrarToast('Selecione o técnico responsável para Atendimento Externo', 'warning');
                btnCriar.disabled = false;
                if (btnIcon) btnIcon.className = 'fas fa-check me-2';
                if (btnText) btnText.textContent = originalText;
                return;
            }
            
            const equipeSelect = document.getElementById('novoEquipeEmails');
            if (equipeSelect) {
                equipeEmails = Array.from(equipeSelect.selectedOptions).map(o => o.value).filter(v => v);
                if (equipeEmails.length === 0) equipeEmails = null;
            }
        }
    }
    
    // Verificar duplicidade para cada patrimônio (exceto N4)
    const isN4 = nivelOperacoes === 'N4';
    const equipamentosValidos = [];
    const equipamentosDuplicados = [];
    
    for (const eq of _equipamentosParaChamado) {
        if (!isN4) {
            const chamadoExistente = chamados.find(c => 
                c.patrimonio === eq.patrimonio && 
                c.status !== 'fechado' && 
                c.status !== 'resolvido'
            );
            
            if (chamadoExistente) {
                equipamentosDuplicados.push({
                    patrimonio: eq.patrimonio,
                    chamadoId: chamadoExistente.id
                });
            } else {
                equipamentosValidos.push(eq);
            }
        } else {
            equipamentosValidos.push(eq);
        }
    }
    
    // Se todos são duplicados
    if (equipamentosValidos.length === 0) {
        const msgs = equipamentosDuplicados.map(d => `${d.patrimonio} (${d.chamadoId})`).join(', ');
        mostrarToast(`Todos os patrimônios já possuem chamados abertos: ${msgs}`, 'warning');
        btnCriar.disabled = false;
        if (btnIcon) btnIcon.className = 'fas fa-check me-2';
        if (btnText) btnText.textContent = originalText;
        return;
    }
    
    // Avisar sobre duplicados
    if (equipamentosDuplicados.length > 0) {
        const msgs = equipamentosDuplicados.map(d => `${d.patrimonio}`).join(', ');
        mostrarToast(`Patrimônios ignorados (já têm chamados): ${msgs}`, 'info');
    }
    
    // Criar chamados para cada equipamento válido
    let chamadosCriados = 0;
    let erros = 0;
    
    for (const eq of equipamentosValidos) {
        const dados = {
            type: tipo,
            patrimonio: eq.patrimonio,
            prefixo: eq.prefixo,
            projeto: eq.projeto,
            garagem: eq.garagem,
            serial: eq.serial || '',
            tecnico_responsavel: departamentoDestino,
            departamento: departamentoDestino,
            classificacao: classificacao || null,
            description: descricao || `Chamado criado para prefixo ${eq.prefixo}`,
            user_email: USER_EMAIL || 'sistema@wifimaxx.com',
            user_name: USER_NAME || 'Usuário',
            nivel_operacoes: nivelOperacoes,
            tecnico_responsavel_email: tecnicoResponsavelEmail,
            equipe_emails: equipeEmails
        };
        
        try {
            const response = await fetch(`${API_BASE}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            
            if (response.ok) {
                chamadosCriados++;
            } else {
                erros++;
            }
        } catch (e) {
            console.error('Erro ao criar chamado:', e);
            erros++;
        }
    }
    
    // Feedback final
    if (chamadosCriados > 0) {
        mostrarToast(`${chamadosCriados} chamado(s) criado(s) com sucesso!`, 'success');
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNovoChamado'));
        if (modal) modal.hide();
        
        // Limpar cache
        _equipamentosParaChamado = [];
        
        // Limpar formulário e resultados da busca de patrimônios
        const formNovoChamado = document.getElementById('formNovoChamado');
        if (formNovoChamado) formNovoChamado.reset();
        
        const novoPatrimoniosInput = document.getElementById('novoPatrimoniosInput');
        if (novoPatrimoniosInput) novoPatrimoniosInput.value = '';
        
        const previewContainer = document.getElementById('previewEquipamentosContainer');
        if (previewContainer) previewContainer.style.display = 'none';
        
        const listaEquipamentos = document.getElementById('listaEquipamentosEncontrados');
        if (listaEquipamentos) listaEquipamentos.innerHTML = '';
        
        const contadorEquipamentos = document.getElementById('contadorEquipamentosEncontrados');
        if (contadorEquipamentos) contadorEquipamentos.textContent = '0';
        
        const alertaNaoEncontrados = document.getElementById('alertPatrimoniosNaoEncontrados');
        if (alertaNaoEncontrados) alertaNaoEncontrados.style.display = 'none';
        
        const listaNaoEncontrados = document.getElementById('listaPatrimoniosNaoEncontrados');
        if (listaNaoEncontrados) listaNaoEncontrados.textContent = '';
        
        // Recarregar lista de chamados
        await carregarDados();
    }
    
    if (erros > 0) {
        mostrarToast(`${erros} chamado(s) não puderam ser criados`, 'danger');
    }
    
    } finally {
        // Restaurar botão SEMPRE, mesmo se houver erro
        isSubmittingAction = false;
        btnCriar.disabled = false;
        if (btnIcon) btnIcon.className = 'fas fa-check me-2';
        if (btnText) btnText.textContent = originalText;
    }
}

// Função legada mantida para compatibilidade - agora usa a nova lógica
async function criarChamadoLegacy() {
    const tipo = document.getElementById('novoTipo').value;
    const patrimonio = document.getElementById('novoPatrimonio').value.trim();
    const prefixo = document.getElementById('novoPrefixo').value.trim();
    const projeto = document.getElementById('novoProjeto').value;
    const garagem = document.getElementById('novoGaragem').value;
    const departamentoDestino = document.getElementById('novoDepartamentoDestino').value;
    const classificacao = document.getElementById('novaClassificacao').value.trim();
    const descricao = document.getElementById('novoDescricao').value.trim();
    
    // Validação
    if (!tipo || !patrimonio || !prefixo || !projeto || !garagem || !departamentoDestino) {
        mostrarToast('Preencha todos os campos obrigatórios', 'warning');
        return;
    }
    
    // Validar classificação se o departamento possui classificações
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamentoDestino] || [];
    if (classificacoesDoDept.length > 0 && !classificacao) {
        mostrarToast('Selecione uma classificação', 'warning');
        return;
    }
    
    // Verificar duplicidade de patrimônio em chamados abertos
    // EXCEÇÃO: N4 não bloqueia duplicidade (regra existente mantida)
    const isN4 = departamentoDestino === 'Operações' && classificacao && classificacao.toLowerCase().includes('n4');
    
    if (!isN4) {
        const chamadoExistente = chamados.find(c => 
            c.patrimonio === patrimonio && 
            c.status !== 'fechado' && 
            c.status !== 'resolvido'
        );
        
        if (chamadoExistente) {
            const deptoExistente = chamadoExistente.departamento_destino || chamadoExistente.departamento || 'desconhecido';
            mostrarToast(`Não foi possível abrir o chamado. Já existe um chamado para o patrimônio '${patrimonio}' aberto no departamento '${deptoExistente}'.`, 'warning');
            return;
        }
    }
    
    // Desabilitar botão e mostrar loading
    const btnCriar = document.getElementById('btnCriarChamado');
    if (!btnCriar) {
        console.error('Botão btnCriarChamado não encontrado!');
        mostrarToast('Erro ao criar chamado. Recarregue a página.', 'danger');
        return;
    }
    
    // Buscar elementos com fallback
    let btnText = btnCriar.querySelector('span');
    let btnIcon = btnCriar.querySelector('i');
    
    // Se não encontrar, procurar nos childNodes diretamente
    if (!btnText || !btnIcon) {
        const children = Array.from(btnCriar.childNodes);
        btnIcon = btnIcon || children.find(n => n.tagName === 'I');
        btnText = btnText || children.find(n => n.tagName === 'SPAN');
    }
    
    const originalText = btnText ? btnText.textContent : 'Criar Chamado';
    
    btnCriar.disabled = true;
    if (btnIcon) {
        btnIcon.className = 'fas fa-spinner fa-spin me-2';
    }
    if (btnText) {
        btnText.textContent = 'Criando...';
    }
    
    
    // Verificar se é Operações e determinar nível pela classificação
    let nivelOperacoes = null;
    let tecnicoResponsavelEmail = null;
    let equipeEmails = null;
    
    if (departamentoDestino === 'Operações') {
        // Determinar nível baseado na classificação:
        // - Checklist Elétrico = N3
        // - Atendimento Externo = N4
        nivelOperacoes = (classificacao === 'Atendimento Externo') ? 'N4' : 'N3';
        
        // Se for N4 (Atendimento Externo), validar e obter dados do técnico
        if (nivelOperacoes === 'N4') {
            const tecnicoSelect = document.getElementById('novoTecnicoResponsavel');
            tecnicoResponsavelEmail = tecnicoSelect ? tecnicoSelect.value : '';
            
            if (!tecnicoResponsavelEmail) {
                mostrarToast('Selecione o técnico responsável para Atendimento Externo', 'warning');
                // Reabilitar botão
                btnCriar.disabled = false;
                btnIcon.className = 'fas fa-check me-2';
                btnText.textContent = originalText;
                if (tecnicoSelect) tecnicoSelect.focus();
                return;
            }
            
            // Obter equipe selecionada
            const equipeSelect = document.getElementById('novoEquipeEmails');
            if (equipeSelect) {
                equipeEmails = [];
                for (let option of equipeSelect.selectedOptions) {
                    if (option.value) equipeEmails.push(option.value);
                }
                if (equipeEmails.length === 0) equipeEmails = null;
            }
        }
    }
    
    // Técnico responsável será definido pelo departamento (não mais por seleção individual)
    const dados = {
        type: tipo,
        patrimonio: patrimonio,
        prefixo: prefixo,
        projeto: projeto,
        garagem: garagem,
        tecnico_responsavel: departamentoDestino, // Vincula ao departamento, não a um técnico específico
        departamento: departamentoDestino,
        classificacao: classificacao || null,
        description: descricao || 'Chamado aberto sem descrição adicional',
        user_email: USER_EMAIL || 'sistema@wifimaxx.com',
        user_name: USER_NAME || 'Usuário',
        // Campos N4 (apenas se for Operações N4)
        nivel_operacoes: nivelOperacoes,
        tecnico_responsavel_email: tecnicoResponsavelEmail,
        equipe_emails: equipeEmails
    };
    
    try {
        if (useApi) {
            // Usar API
            const response = await fetch(`${API_BASE}/`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Erro ao criar chamado na API');
            }
            
            const result = await response.json();
            const novoChamado = result.data;
            
            // Normalizar e adicionar ao array
            chamados.unshift({
                ...novoChamado,
                currentLevel: novoChamado.current_level || novoChamado.currentLevel,
                slaDate: novoChamado.sla_date || novoChamado.slaDate,
                slaCumprido: novoChamado.sla_cumprido ?? novoChamado.slaCumprido,
                createdAt: novoChamado.created_at || novoChamado.createdAt,
                updatedAt: novoChamado.updated_at || novoChamado.updatedAt,
                createdBy: novoChamado.created_by || novoChamado.createdBy,
                createdByName: novoChamado.created_by_name || novoChamado.createdByName,
                tecnicoResponsavel: novoChamado.tecnico_responsavel || novoChamado.tecnicoResponsavel,
                slaInfo: novoChamado.sla_info || novoChamado.slaInfo
            });
            
            mostrarToast(`Chamado ${novoChamado.id} criado com sucesso!`, 'success');
        } else {
            // API não disponível
            throw new Error('Sistema indisponível. Tente novamente mais tarde.');
        }
        
        // Limpar formulário
        document.getElementById('formNovoChamado').reset();
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalNovoChamado'))?.hide();
        
        // Atualizar UI
        atualizarEstatisticas();
        renderizarChamados();
        
    } catch (error) {
        console.error('Erro ao criar chamado:', error);
        mostrarToast(error.message || 'Erro ao criar chamado. Verifique sua conexão e tente novamente.', 'danger');
    } finally {
        // Reabilitar botão
        if (btnCriar) {
            btnCriar.disabled = false;
        }
        if (btnIcon) {
            btnIcon.className = 'fas fa-check me-2';
        }
        if (btnText) {
            btnText.textContent = originalText;
        }
    }
}


function formatarData(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Converte data UTC para horário de Brasília (GMT-3) e formata
 */
function formatarDataHoraBrasilia(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    // Formatar diretamente com timezone de Brasília
    return data.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Converte data UTC para horário de Brasília (GMT-3) e formata apenas a data
 */
function formatarDataBrasilia(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    // Formatar diretamente com timezone de Brasília
    return data.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    });
}

/**
 * Formata data/hora completa para exibição no histórico (com 'às')
 */
function formatarDataHoraCompleta(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    // Formatar diretamente com timezone de Brasília
    return data.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', ' às');
}

function mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    const toastId = `toast-${Date.now()}`;
    
    const icons = {
        success: 'fa-check-circle text-success',
        warning: 'fa-exclamation-triangle text-warning',
        danger: 'fa-times-circle text-danger',
        info: 'fa-info-circle text-info'
    };
    
    const toastHTML = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4000">
            <div class="toast-header" style="background: rgba(26, 26, 46, 0.95); color: #ecf0f1;">
                <i class="fas ${icons[tipo]} me-2"></i>
                <strong class="me-auto">Controle de Chamados</strong>
                <small>Agora</small>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body" style="background: rgba(22, 33, 62, 0.95); color: #ecf0f1;">
                ${mensagem}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// ============================================================================
// EXPORTAÇÃO DE RELATÓRIOS
// ============================================================================

/**
 * Exporta relatório completo de chamados em formato Excel
 * Inclui todas as informações dos chamados e histórico completo
 */
async function exportarRelatorioExcel() {
    try {
        // Mostrar indicador de loading
        mostrarToast('Gerando relatório Excel... Aguarde.', 'info');
        
        // Construir URL com parâmetros de controle de acesso (mesmos filtros da listagem)
        const params = new URLSearchParams();
        if (typeof USER_EMAIL !== 'undefined' && USER_EMAIL) params.append('user_email', USER_EMAIL);
        if (typeof USER_DEPARTMENT !== 'undefined' && USER_DEPARTMENT) params.append('user_departamento', USER_DEPARTMENT);
        if (typeof USER_ROLE !== 'undefined') params.append('is_admin', USER_ROLE === 'admin');
        
        const url = `${API_BASE}/export-excel?${params.toString()}`;
        
        console.log('📊 Iniciando exportação Excel:', url);
        
        // Fazer requisição para gerar o Excel
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Resposta do servidor:', response.status, response.statusText, errorText);
            throw new Error(`Erro ao gerar relatório: ${response.status} - ${response.statusText}`);
        }
        
        // Obter o blob do arquivo
        const blob = await response.blob();
        
        // Extrair nome do arquivo do header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'Relatorio_Chamados.xlsx';
        if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        
        // Criar URL temporária para download
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // Criar elemento <a> temporário e acionar download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // Limpar
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        console.log('✅ Relatório Excel exportado com sucesso:', filename);
        mostrarToast('Relatório Excel gerado com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao exportar relatório Excel:', error);
        mostrarToast('Erro ao gerar relatório Excel. Tente novamente.', 'error');
    }
}

// ============================================================================
// INTEGRAÇÃO N4: Campos Técnico e Equipe
// ============================================================================

/**
 * Carrega a lista de técnicos do departamento Operações para o modal N4
 */
async function carregarTecnicosN4() {
    try {
        // Buscar técnicos ativos da tabela tecnicos (mesmo padrão da RAT)
        const response = await fetch('/api/chamados/config/tecnicos', { credentials: 'include' });
        if (!response.ok) {
            console.warn('⚠️ Não foi possível carregar lista de técnicos');
            return;
        }
        
        const data = await response.json();
        // API retorna lista de técnicos [{id, nome, email, empresa, escritorio, telefone}]
        tecnicos = Array.isArray(data) ? data : (data.tecnicos || []);
        
        // Popular selects
        popularSelectTecnicos();
        console.log(`✅ Carregados ${tecnicos.length} técnicos para N4`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar técnicos:', error);
        // Fallback: deixar campos vazios ou usar lista do contexto
    }
}

/**
 * Popula os selects de técnico e equipe com os dados carregados
 */
function popularSelectTecnicos() {
    const selectTecnico = document.getElementById('acaoTecnicoResponsavel');
    const selectEquipe = document.getElementById('acaoEquipeEmails');
    
    if (!selectTecnico || !selectEquipe) return;
    
    // Limpar opções existentes
    selectTecnico.innerHTML = '<option value="">Selecione o técnico...</option>';
    selectEquipe.innerHTML = '';
    
    // Adicionar técnicos
    for (const tecnico of tecnicos) {
        const nome = tecnico.nome || tecnico.email.split('@')[0];
        const optionTecnico = document.createElement('option');
        optionTecnico.value = tecnico.email;
        optionTecnico.textContent = nome;
        selectTecnico.appendChild(optionTecnico);
        
        const optionEquipe = document.createElement('option');
        optionEquipe.value = tecnico.email;
        optionEquipe.textContent = nome;
        selectEquipe.appendChild(optionEquipe);
    }
}

/**
 * Callback quando o nível de destino muda
 */
function onNivelDestinoChange() {
    const nivelDestino = document.getElementById('acaoNivelDestino').value;
    const camposN4 = document.getElementById('camposN4Container');
    
    if (!camposN4) return;
    
    if (nivelDestino === 'N4') {
        // Mostrar campos N4
        camposN4.style.display = 'block';
        
        // Carregar técnicos se ainda não carregou
        if (tecnicos.length === 0) {
            carregarTecnicosN4();
        }
        
        console.log('📋 Campos N4 exibidos');
    } else {
        // Esconder campos N4
        camposN4.style.display = 'none';
        
        // Limpar seleções
        const selectTecnico = document.getElementById('acaoTecnicoResponsavel');
        const selectEquipe = document.getElementById('acaoEquipeEmails');
        if (selectTecnico) selectTecnico.value = '';
        if (selectEquipe) {
            for (let option of selectEquipe.options) {
                option.selected = false;
            }
        }
    }
    
    // Se destino for N1 (Verificação de Chip), preencher automaticamente dados do chip
    if (nivelDestino === 'N1' && chamadoSelecionado) {
        preencherDadosChipN1(chamadoSelecionado);
    }
    
    // Validar comentário
    validarComentario();
}

/**
 * Valida campos obrigatórios do N4 (técnico)
 */
function validarCamposN4() {
    const nivelDestino = document.getElementById('acaoNivelDestino').value;
    if (nivelDestino !== 'N4') return true; // Não é N4, não precisa validar
    
    const tecnico = document.getElementById('acaoTecnicoResponsavel').value;
    if (!tecnico) {
        mostrarToast('Selecione o técnico responsável para N4', 'warning');
        document.getElementById('acaoTecnicoResponsavel').focus();
        return false;
    }
    
    return true;
}

/**
 * Obtém os dados N4 do formulário (técnico e equipe)
 */
function obterDadosN4() {
    const nivelDestino = document.getElementById('acaoNivelDestino').value;
    if (nivelDestino !== 'N4') return null;
    
    const tecnicoEmail = document.getElementById('acaoTecnicoResponsavel').value;
    const selectEquipe = document.getElementById('acaoEquipeEmails');
    
    const equipeEmails = [];
    if (selectEquipe) {
        for (let option of selectEquipe.selectedOptions) {
            if (option.value) equipeEmails.push(option.value);
        }
    }
    
    return {
        tecnico_responsavel_email: tecnicoEmail,
        equipe_emails: equipeEmails.length > 0 ? equipeEmails : null
    };
}

/**
 * Preenche automaticamente os dados do chip no comentário quando destino é N1 (Verificação de Chip)
 * @param {string|object} chamadoOuId - ID do chamado ou objeto do chamado
 */
async function preencherDadosChipN1(chamadoOuId) {
    // Aceita tanto objeto quanto ID
    let chamado;
    if (typeof chamadoOuId === 'object' && chamadoOuId !== null) {
        chamado = chamadoOuId;
    } else {
        chamado = chamados.find(c => c.id === chamadoOuId);
    }
    
    if (!chamado || !chamado.patrimonio) {
        console.log('📋 [N1] Chamado sem patrimônio, não preenchendo dados de chip');
        return;
    }
    
    console.log('📋 [N1] Buscando dados do chip para patrimônio:', chamado.patrimonio);
    
    const patrimonio = chamado.patrimonio;
    const comentarioInput = document.getElementById('acaoComentario');
    
    if (!comentarioInput) return;
    
    // Mostrar loading no campo
    comentarioInput.placeholder = 'Carregando dados do chip...';
    comentarioInput.disabled = true;
    
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
        
        if (dados && dados.length > 0) {
            const chip = dados[0];
            
            // Montar texto formatado similar ao email de reforço de sinal
            const saudacao = getSaudacaoHorario();
            let texto = `${saudacao}\n\n`;
            texto += `Por gentileza, realizar a verificação de sinal no CHIP:\n\n`;
            texto += `PATRIMÔNIO:    ${chip.Patrimonio || patrimonio}\n`;
            texto += `IMEI MODEM:    ${chip.IMEI_MODEM_1 || '-'}\n`;
            texto += `IMEI CHIP:     ${chip.IMEI_CHIP_1 || '-'}\n`;
            texto += `Nº TELEFONE:   ${chip.N_TELEFONE_1 || '-'}\n`;
            texto += `OPERADORA:     ${chip.OPERADORA_1 || '-'}`;
            
            comentarioInput.value = texto;
            // Disparar evento para formulário reconhecer
            comentarioInput.dispatchEvent(new Event('input', { bubbles: true }));
            comentarioInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ [N1] Dados do chip preenchidos automaticamente');
        } else {
            // Patrimônio não encontrado, preencher com dados básicos
            const saudacao = getSaudacaoHorario();
            let texto = `${saudacao}\n\n`;
            texto += `Por gentileza, realizar a verificação de sinal no CHIP:\n\n`;
            texto += `PATRIMÔNIO:    ${patrimonio}\n`;
            texto += `IMEI MODEM:    (não encontrado)\n`;
            texto += `IMEI CHIP:     (não encontrado)\n`;
            texto += `Nº TELEFONE:   (não encontrado)\n`;
            texto += `OPERADORA:     (não encontrado)`;
            
            comentarioInput.value = texto;
            // Disparar evento para formulário reconhecer
            comentarioInput.dispatchEvent(new Event('input', { bubbles: true }));
            comentarioInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('⚠️ [N1] Patrimônio não encontrado na base, preenchido com dados básicos');
        }
    } catch (error) {
        console.error('❌ [N1] Erro ao buscar dados do chip:', error);
        
        // Preencher com dados básicos em caso de erro
        const saudacao = getSaudacaoHorario();
        let texto = `${saudacao}\n\n`;
        texto += `Por gentileza, realizar a verificação de sinal no CHIP:\n\n`;
        texto += `PATRIMÔNIO:    ${patrimonio}`;
        
        comentarioInput.value = texto;
        // Disparar evento para formulário reconhecer
        comentarioInput.dispatchEvent(new Event('input', { bubbles: true }));
        comentarioInput.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
        comentarioInput.placeholder = 'Adicione um comentário...';
        comentarioInput.disabled = false;
        comentarioInput.focus();
    }
}

/**
 * Retorna a saudação baseada no horário
 */
function getSaudacaoHorario() {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia.';
    if (hora < 18) return 'Boa tarde.';
    return 'Boa noite.';
}
// ============================================================================
// CRIAR CHAMADO INDIVIDUAL - BUSCA POR PATRIMÔNIO
// ============================================================================

// Cache dos equipamentos encontrados para criar chamados
let _equipamentosParaChamado = [];

/**
 * Busca dados dos patrimônios informados no campo de texto
 * Faz lookup na base do Power BI via API /api/dashboard/data
 */
async function buscarDadosPatrimonios() {
    const textareaPatrimonios = document.getElementById('novoPatrimoniosInput');
    const previewContainer = document.getElementById('previewEquipamentosContainer');
    const listaEquipamentos = document.getElementById('listaEquipamentosEncontrados');
    const contadorEquipamentos = document.getElementById('contadorEquipamentosEncontrados');
    const alertaNaoEncontrados = document.getElementById('alertPatrimoniosNaoEncontrados');
    const listaNaoEncontrados = document.getElementById('listaPatrimoniosNaoEncontrados');
    
    if (!textareaPatrimonios || !textareaPatrimonios.value.trim()) {
        mostrarToast('Digite pelo menos um patrimônio', 'warning');
        return;
    }
    
    // Parse dos patrimônios (separados por vírgula, espaço ou quebra de linha)
    const patrimoniosInput = textareaPatrimonios.value
        .split(/[,\n\r]+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
    
    if (patrimoniosInput.length === 0) {
        mostrarToast('Nenhum patrimônio válido encontrado', 'warning');
        return;
    }
    
    console.log('🔍 Buscando dados para patrimônios:', patrimoniosInput);
    
    // Mostrar loading
    if (listaEquipamentos) {
        listaEquipamentos.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Buscando dados na base...</div>';
    }
    if (previewContainer) previewContainer.style.display = 'block';
    if (alertaNaoEncontrados) alertaNaoEncontrados.style.display = 'none';
    
    try {
        // Buscar TODOS os dados da base (dim_serial completa)
        const response = await fetch('/api/equipment/all', { credentials: 'include' });
        
        if (!response.ok) {
            const statusCode = response.status;
            let detail = '';
            try { detail = (await response.json()).error || ''; } catch(_) {}
            throw new Error(`Erro ao buscar dados da base (HTTP ${statusCode}${detail ? ': ' + detail : ''})`);
        }
        
        const allEquipments = await response.json();
        // /api/equipment/all retorna array direto
        console.log('📊 Total de equipamentos na base:', Array.isArray(allEquipments) ? allEquipments.length : 'N/A');
        
        // ⚡ PERFORMANCE: Construir Map para lookup O(1) ao invés de .find() O(N) por patrimônio
        const equipMap = new Map();
        for (let i = 0, len = allEquipments.length; i < len; i++) {
            const e = allEquipments[i];
            const key = (e.Patrimonio || e.patrimonio || '').toString().toUpperCase().trim();
            if (key) equipMap.set(key, e);
        }
        
        // Filtrar equipamentos pelos patrimônios informados (BUSCA EXATA)
        const equipamentosEncontrados = [];
        const patrimoniosNaoEncontrados = [];
        
        patrimoniosInput.forEach(pat => {
            const patUpper = pat.toUpperCase().trim();
            const equipamento = equipMap.get(patUpper);
            
            if (equipamento) {
                equipamentosEncontrados.push({
                    patrimonio: equipamento.Patrimonio || equipamento.patrimonio || pat,
                    prefixo: equipamento.Prefixo || equipamento.prefixo || '',
                    projeto: equipamento.PROJETO || equipamento.projeto || equipamento.Projeto || '',
                    garagem: equipamento.GARAGEM || equipamento.garagem || equipamento.Garagem || '',
                    serial: equipamento.Hotspot || equipamento.hotspot || equipamento.Serial || '',
                    linha: equipamento.Linha || equipamento.linha || '',
                    status: equipamento['Monitoramento BI'] || equipamento.monitoramento_bi || ''
                });
            } else {
                patrimoniosNaoEncontrados.push(pat);
            }
        });
        
        // Atualizar cache
        _equipamentosParaChamado = equipamentosEncontrados;
        
        // Atualizar UI
        if (contadorEquipamentos) {
            contadorEquipamentos.textContent = equipamentosEncontrados.length;
        }
        
        if (listaEquipamentos) {
            if (equipamentosEncontrados.length > 0) {
                let html = '<table class="table table-sm table-borderless mb-0" style="font-size: 0.85em;">';
                html += '<thead><tr><th>Patrimônio</th><th>Prefixo</th><th>Projeto</th><th>Garagem</th></tr></thead>';
                html += '<tbody>';
                equipamentosEncontrados.forEach(eq => {
                    html += `<tr>
                        <td><strong>${eq.patrimonio}</strong></td>
                        <td>${eq.prefixo}</td>
                        <td>${eq.projeto}</td>
                        <td>${eq.garagem}</td>
                    </tr>`;
                });
                html += '</tbody></table>';
                listaEquipamentos.innerHTML = html;
                
                // Preencher campos ocultos com os dados do primeiro equipamento (se único)
                // ou preparar para múltiplos
                if (equipamentosEncontrados.length === 1) {
                    const eq = equipamentosEncontrados[0];
                    document.getElementById('novoPatrimonio').value = eq.patrimonio;
                    document.getElementById('novoPrefixo').value = eq.prefixo;
                    document.getElementById('novoProjeto').value = eq.projeto;
                    document.getElementById('novoGaragem').value = eq.garagem;
                    document.getElementById('novoSerial').value = eq.serial;
                }
            } else {
                listaEquipamentos.innerHTML = '<div class="text-muted">Nenhum equipamento encontrado</div>';
            }
        }
        
        // Mostrar patrimônios não encontrados
        if (patrimoniosNaoEncontrados.length > 0 && alertaNaoEncontrados && listaNaoEncontrados) {
            listaNaoEncontrados.textContent = patrimoniosNaoEncontrados.join(', ');
            alertaNaoEncontrados.style.display = 'block';
        }
        
        if (equipamentosEncontrados.length > 0) {
            mostrarToast(`${equipamentosEncontrados.length} equipamento(s) encontrado(s)`, 'success');
        } else {
            mostrarToast('Nenhum equipamento encontrado para os patrimônios informados', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados dos patrimônios:', error);
        mostrarToast('Erro ao buscar dados. Tente novamente.', 'danger');
        if (listaEquipamentos) {
            listaEquipamentos.innerHTML = '<div class="text-danger">Erro ao buscar dados</div>';
        }
    }
}