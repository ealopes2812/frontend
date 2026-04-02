/**
 * JavaScript para o módulo de Asbuilt
 * Sistema WifiMaxx PBI Monitor
 * 
 * Atualizado com:
 * - Campo Garagem (obrigatório para todos)
 * - Campo Campanha (quando tipo = Plano de Comunicação)
 * - Ocultar Patrimônio quando tipo = Plano de Comunicação
 * - Prefixo: dropdown para Prestador, texto para Admin/Usuário
 * - Técnico Responsável oculto
 * - Aba Prefixos Adesivados
 * - Removidos: Rascunhos, Salvar Rascunho, Limpar
 */

// Configuração de tipos de fotos por categoria
const FOTOS_CONFIG = {
    "Instalação de Ônibus": [
        { key: "frente_onibus", label: "Frente do ônibus com prefixo", required: true },
        { key: "chicote_porta_fusivel", label: "Chicote elétrico com porta fusível", required: true },
        { key: "maquina_patrimonio", label: "Máquina com patrimônio", required: true },
        { key: "local_instalacao", label: "Local de instalação", required: true },
        { key: "maquina_instalada", label: "Máquina instalada", required: true }
    ],
    "Instalação de Terminal": [
        { key: "maquina_patrimonio", label: "Máquina com patrimônio", required: true },
        { key: "local_instalacao", label: "Local de instalação", required: true },
        { key: "maquina_instalada", label: "Máquina instalada", required: true }
    ],
    "Plano de Comunicação": [
        { key: "frontal_traseira", label: "Frontal ou Traseira (Prefixo e Placa)", required: true },
        { key: "perspectiva_interna", label: "Perspectiva Interna Geral", required: true },
        { key: "visao_lateral", label: "Visão Lateral", required: true },
        { key: "arte_prefixo_interno", label: "Visão Arte + Prefixo Interno", required: true }
    ],
    "Retirada": [
        { key: "frente_onibus", label: "Frente do ônibus com prefixo", required: true },
        { key: "maquina_patrimonio", label: "Máquina com patrimônio", required: true }
    ],
    "Montagem de Máquina": [
        { key: "montagem_maquina", label: "Montagem da Máquina", required: true },
        { key: "modem_chip", label: "Modem e Chip", required: true },
        { key: "patrimonio_foto", label: "Patrimônio", required: true },
        { key: "rb_foto", label: "RB", required: true }
    ],
    "Máquina Violada": [
        { key: "evidencia_1", label: "Evidência #1", required: true },
        { key: "evidencia_2", label: "Evidência #2", required: false },
        { key: "evidencia_3", label: "Evidência #3", required: false },
        { key: "evidencia_4", label: "Evidência #4", required: false }
    ],
    // Tipo que não requer fotos e não gera PDF de asbuilt
    "Não necessário": []
};

// Estado global
let uploadedImages = {};
let currentUserName = null;
let projetosData = [];
let garagensData = [];
let campanhasData = [];
let prefixosDisponiveis = [];
let notificacoesCarregadas = false;
let notificacoesInterval = null;
let ultimoTotalPendentes = 0;
let ultimosResultadosBusca = []; // Para exportar XLS

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 Módulo Asbuilt inicializado');
    console.log('👤 Is Prestador:', IS_PRESTADOR);
    console.log('📧 User Email:', USER_EMAIL);
    
    carregarUsuarioLogado();
    carregarProjetosDimSerial();
    setupEventListeners();
    
    // Carregar garagens para o filtro de busca (Admin/Usuário)
    if (!IS_PRESTADOR) {
        carregarGaragensBusca();
    }
    
    // Se for prestador, inicializar com Plano de Comunicação
    if (IS_PRESTADOR) {
        setTimeout(() => {
            atualizarCamposFotos('Plano de Comunicação');
            controlarCamposPlanoComunicacao(true);
        }, 500);
        
        // Carregar notificações automaticamente para prestadores
        setTimeout(() => {
            verificarNotificacoes();
        }, 2000);
        
        // Verificar notificações a cada 30 segundos (tempo real)
        notificacoesInterval = setInterval(() => {
            verificarNotificacoes();
        }, 30000);
    }
    
    // Inicializar Select2 para Campanha
    if (typeof $ !== 'undefined' && $.fn.select2) {
        $('.select2-campanha').select2({
            theme: 'bootstrap-5',
            placeholder: 'Selecione uma campanha...',
            allowClear: true
        });
    }
});

function setupEventListeners() {
    // Mudança de tipo de Asbuilt
    const tipoAsbuiltEl = document.getElementById('tipoAsbuilt');
    if (tipoAsbuiltEl && !IS_PRESTADOR) {
        tipoAsbuiltEl.addEventListener('change', function() {
            atualizarCamposFotos(this.value);
            controlarDataRetirada(this.value);
            controlarCamposPlanoComunicacao(this.value === 'Plano de Comunicação');
            controlarCamposMontagemMaquina(this.value === 'Montagem de Máquina');
        });
    }
    
    // Mudança de projeto - carregar garagens e prefixos (para prestador)
    const projetoEl = document.getElementById('projeto');
    if (projetoEl) {
        projetoEl.addEventListener('change', function() {
            preencherEmpresaPorProjeto(this.value);
            
            // Para prestador: carregar campanhas primeiro, depois garagens serão carregadas pela campanha
            if (IS_PRESTADOR) {
                carregarCampanhasPorProjeto(this.value);
                // Limpar garagem e prefixos até selecionar campanha
                const garagemSelect = document.getElementById('garagemSelect');
                if (garagemSelect) {
                    garagemSelect.innerHTML = '<option value="">Selecione a campanha primeiro...</option>';
                }
                const prefixoSelect = document.getElementById('prefixo');
                if (prefixoSelect) {
                    prefixoSelect.innerHTML = '<option value="">Selecione a garagem primeiro...</option>';
                }
            } else {
                carregarGaragensPorProjeto(this.value);
                carregarCampanhasPorProjeto(this.value);
            }
        });
    }
    
    // Mudança de garagem select - sincronizar hidden e carregar prefixos da garagem (para prestador)
    const garagemSelectEl = document.getElementById('garagemSelect');
    if (garagemSelectEl) {
        garagemSelectEl.addEventListener('change', function() {
            const garagemHidden = document.getElementById('garagem');
            if (garagemHidden) garagemHidden.value = this.value;
            
            // Para prestador: carregar prefixos APENAS desta garagem na campanha
            if (IS_PRESTADOR && this.value) {
                const campanha = document.getElementById('campanha')?.value;
                if (campanha) {
                    carregarPrefixosPorGaragem(campanha, this.value);
                }
            }
        });
    }
    
    // Mudança de garagem input - sincronizar hidden
    const garagemInputEl = document.getElementById('garagemInput');
    if (garagemInputEl) {
        garagemInputEl.addEventListener('input', function() {
            const garagemHidden = document.getElementById('garagem');
            if (garagemHidden) garagemHidden.value = this.value;
        });
    }
    
    // Mudança de campanha - para prestador: carregar GARAGENS da campanha (não mais prefixos direto)
    const campanhaEl = document.getElementById('campanha');
    if (campanhaEl && IS_PRESTADOR) {
        campanhaEl.addEventListener('change', function() {
            if (this.value) {
                carregarGaragensDaCampanha(this.value);
            } else {
                const garagemSelect = document.getElementById('garagemSelect');
                if (garagemSelect) {
                    garagemSelect.innerHTML = '<option value="">Selecione a campanha primeiro...</option>';
                }
                const prefixoSelect = document.getElementById('prefixo');
                if (prefixoSelect) {
                    prefixoSelect.innerHTML = '<option value="">Selecione a garagem primeiro...</option>';
                }
            }
        });
    }
    
    // Validação de patrimônio ao sair do campo (blur) - apenas se não for Plano de Comunicação
    const patrimonioEl = document.getElementById('patrimonio');
    if (patrimonioEl) {
        patrimonioEl.addEventListener('blur', async function() {
            const tipoAsbuilt = document.getElementById('tipoAsbuilt').value;
            
            // Não validar se for Plano de Comunicação
            if (tipoAsbuilt === 'Plano de Comunicação') {
                return;
            }
            
            const projeto = document.getElementById('projeto').value;
            const patrimonio = this.value.trim();
            
            if (!projeto || !patrimonio) {
                return;
            }
            
            await validarPatrimonioProjeto(projeto, patrimonio);
        });
    }
    
    // Submit do formulário
    const formAsbuilt = document.getElementById('formAsbuilt');
    if (formAsbuilt) {
        formAsbuilt.addEventListener('submit', function(e) {
            e.preventDefault();
            salvarAsbuilt();
        });
    }
}

// ============================================================================
// CONTROLE DE CAMPOS POR TIPO DE ASBUILT
// ============================================================================

function controlarCamposPlanoComunicacao(isPlanoComunicacao) {
    const patrimonioContainer = document.getElementById('patrimonioContainer');
    const campanhaContainer = document.getElementById('campanhaContainer');
    const patrimonioInput = document.getElementById('patrimonio');
    
    // Elementos de Garagem
    const garagemSelect = document.getElementById('garagemSelect');
    const garagemInput = document.getElementById('garagemInput');
    const garagemHidden = document.getElementById('garagem');
    const garagemHelp = document.getElementById('garagemHelp');
    
    if (isPlanoComunicacao) {
        // Ocultar Patrimônio
        if (patrimonioContainer) {
            patrimonioContainer.classList.add('campo-oculto');
        }
        if (patrimonioInput) {
            patrimonioInput.removeAttribute('required');
            patrimonioInput.value = 'N/A'; // Valor padrão para não quebrar validação
        }
        
        // Mostrar Campanha
        if (campanhaContainer) {
            campanhaContainer.classList.remove('campo-oculto');
        }
        
        // PRESTADOR: Garagem continua como SELECT (carregado da campanha)
        // ADMIN: Garagem muda para INPUT texto
        if (IS_PRESTADOR) {
            // Prestador: manter SELECT, mas carregar garagens da campanha
            if (garagemSelect) {
                garagemSelect.classList.remove('campo-oculto');
                garagemSelect.setAttribute('required', 'required');
                garagemSelect.innerHTML = '<option value="">Selecione a campanha primeiro...</option>';
            }
            if (garagemInput) {
                garagemInput.classList.add('campo-oculto');
                garagemInput.removeAttribute('required');
            }
            if (garagemHelp) {
                garagemHelp.innerHTML = '<i class="fas fa-info-circle me-1"></i>Garagens definidas pelo gestor na campanha';
            }
        } else {
            // Admin: Manter SELECT com dropdown de garagens (igual aos demais tipos)
            if (garagemSelect) {
                garagemSelect.classList.remove('campo-oculto');
                garagemSelect.setAttribute('required', 'required');
                // Carregar garagens do projeto selecionado
                const projetoSelecionado = document.getElementById('projeto')?.value;
                if (projetoSelecionado) {
                    carregarGaragensPorProjeto(projetoSelecionado);
                } else {
                    garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
                }
            }
            if (garagemInput) {
                garagemInput.classList.add('campo-oculto');
                garagemInput.removeAttribute('required');
            }
            if (garagemHelp) {
                garagemHelp.innerHTML = '<i class="fas fa-info-circle me-1"></i>Filtrado pelo projeto selecionado';
            }
        }
    } else {
        // Mostrar Patrimônio
        if (patrimonioContainer) {
            patrimonioContainer.classList.remove('campo-oculto');
        }
        if (patrimonioInput) {
            patrimonioInput.setAttribute('required', 'required');
            if (patrimonioInput.value === 'N/A') {
                patrimonioInput.value = '';
            }
        }
        
        // Ocultar Campanha
        if (campanhaContainer) {
            campanhaContainer.classList.add('campo-oculto');
        }
        
        // Garagem: Voltar para select
        if (garagemSelect) {
            garagemSelect.classList.remove('campo-oculto');
            garagemSelect.setAttribute('required', 'required');
        }
        if (garagemInput) {
            garagemInput.classList.add('campo-oculto');
            garagemInput.removeAttribute('required');
        }
        if (garagemHelp) {
            garagemHelp.innerHTML = '<i class="fas fa-info-circle me-1"></i>Filtrado pelo projeto selecionado';
        }
    }
    
    // Sincronizar valor do campo hidden de garagem
    sincronizarGaragem();
}

// Função para sincronizar o valor do campo hidden garagem
function sincronizarGaragem() {
    const garagemSelect = document.getElementById('garagemSelect');
    const garagemInput = document.getElementById('garagemInput');
    const garagemHidden = document.getElementById('garagem');
    
    if (!garagemHidden) return;
    
    // Se o input está visível, usa seu valor; senão, usa o select
    if (garagemInput && !garagemInput.classList.contains('campo-oculto')) {
        garagemHidden.value = garagemInput.value;
    } else if (garagemSelect) {
        garagemHidden.value = garagemSelect.value;
    }
}

// ============================================================================
// CARREGAR DADOS INICIAIS
// ============================================================================

async function carregarUsuarioLogado() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        console.log('📥 Resposta /api/auth/me:', data);
        
        if (data.success && data.user) {
            currentUserName = data.user.nome || data.user.email || data.user.username;
            const tecnicoField = document.getElementById('tecnicoResponsavel');
            if (tecnicoField) {
                tecnicoField.value = currentUserName;
            }
            console.log('👤 Usuário logado:', currentUserName);
        } else {
            currentUserName = localStorage.getItem('userName') || 'Técnico Padrão';
            const tecnicoField = document.getElementById('tecnicoResponsavel');
            if (tecnicoField) {
                tecnicoField.value = currentUserName;
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar usuário:', error);
        currentUserName = 'Técnico Padrão';
        const tecnicoField = document.getElementById('tecnicoResponsavel');
        if (tecnicoField) {
            tecnicoField.value = currentUserName;
        }
    }
}

async function carregarProjetosDimSerial() {
    try {
        console.log('🔄 Carregando projetos da Dim_Serial...');
        
        // Para prestador: usar endpoint filtrado
        let url = '/api/asbuilt/projetos/list';
        if (IS_PRESTADOR) {
            url = `/api/asbuilt/projetos/prestador?usuario_email=${encodeURIComponent(USER_EMAIL)}`;
            console.log('👤 Prestador: buscando projetos atribuídos');
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.projetos) {
            projetosData = data.projetos;
            console.log('✅ Projetos carregados:', projetosData.length);
            
            const selects = [
                document.getElementById('projeto'),
                document.getElementById('buscarProjeto')
            ];
            
            selects.forEach((select, idx) => {
                if (select) {
                    const firstOption = idx === 0 ? 'Selecione um projeto...' : 'Todos os projetos';
                    select.innerHTML = `<option value="">${firstOption}</option>`;
                    
                    projetosData.forEach(proj => {
                        const option = document.createElement('option');
                        option.value = proj.projeto;
                        option.textContent = proj.projeto;
                        option.dataset.empresa = proj.empresa;
                        select.appendChild(option);
                    });
                }
            });
        } else {
            console.error('❌ Erro ao carregar projetos:', data.message);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar projetos:', error);
    }
}

async function carregarGaragensPorProjeto(projeto) {
    const garagemSelect = document.getElementById('garagemSelect');
    const garagemHidden = document.getElementById('garagem');
    if (!garagemSelect) return;
    
    if (!projeto) {
        garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        if (garagemHidden) garagemHidden.value = '';
        return;
    }
    
    garagemSelect.innerHTML = '<option value="">Carregando garagens...</option>';
    
    try {
        const response = await fetch(`/api/asbuilt/garagens/list?projeto=${encodeURIComponent(projeto)}`);
        const data = await response.json();
        
        if (data.success && data.garagens.length > 0) {
            garagensData = data.garagens;
            
            garagemSelect.innerHTML = '<option value="">Selecione a garagem...</option>';
            data.garagens.forEach(garagem => {
                const option = document.createElement('option');
                option.value = garagem;
                option.textContent = garagem;
                garagemSelect.appendChild(option);
            });
            
            // Auto-seleção se houver apenas 1 garagem
            if (data.auto_select && data.auto_select_value) {
                garagemSelect.value = data.auto_select_value;
                if (garagemHidden) garagemHidden.value = data.auto_select_value;
                console.log('✅ Auto-selecionada garagem:', data.auto_select_value);
                
                // Disparar evento change para carregar prefixos (se prestador)
                if (IS_PRESTADOR) {
                    garagemSelect.dispatchEvent(new Event('change'));
                }
            }
            
            console.log(`✅ Carregadas ${data.garagens.length} garagens para projeto ${projeto}`);
        } else {
            garagemSelect.innerHTML = '<option value="">Nenhuma garagem encontrada</option>';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar garagens:', error);
        garagemSelect.innerHTML = '<option value="">Erro ao carregar garagens</option>';
    }
}

async function carregarCampanhasPorProjeto(projeto) {
    const campanhaSelect = document.getElementById('campanha');
    if (!campanhaSelect) return;
    
    if (!projeto) {
        campanhaSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        if ($.fn.select2) {
            $(campanhaSelect).trigger('change');
        }
        return;
    }
    
    try {
        // Para prestador: usar endpoint filtrado
        let url = `/api/asbuilt/campanhas/list?projeto=${encodeURIComponent(projeto)}`;
        if (IS_PRESTADOR) {
            url = `/api/asbuilt/campanhas/prestador?usuario_email=${encodeURIComponent(USER_EMAIL)}&projeto=${encodeURIComponent(projeto)}`;
            console.log('👤 Prestador: buscando campanhas atribuídas');
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.campanhas.length > 0) {
            campanhasData = data.campanhas;
            
            campanhaSelect.innerHTML = '<option value="">Selecione uma campanha...</option>';
            data.campanhas.forEach(campanha => {
                const option = document.createElement('option');
                option.value = campanha;
                option.textContent = campanha;
                campanhaSelect.appendChild(option);
            });
            
            console.log(`✅ Carregadas ${data.campanhas.length} campanhas para projeto ${projeto}`);
        } else {
            campanhaSelect.innerHTML = '<option value="">Nenhuma campanha encontrada</option>';
        }
        
        // Atualizar Select2
        if ($.fn.select2) {
            $(campanhaSelect).trigger('change');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar campanhas:', error);
        campanhaSelect.innerHTML = '<option value="">Erro ao carregar campanhas</option>';
    }
}

async function carregarPrefixosDisponiveis(campanha = null) {
    const prefixoSelect = document.getElementById('prefixo');
    if (!prefixoSelect || !IS_PRESTADOR) return;
    
    const projeto = document.getElementById('projeto').value;
    const campanhaValue = campanha || document.getElementById('campanha')?.value || '';
    
    // Prestador precisa ter projeto selecionado
    if (!projeto) {
        prefixoSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        return;
    }
    
    prefixoSelect.innerHTML = '<option value="">Carregando prefixos...</option>';
    
    try {
        // Para prestador: filtrar por email e opcionalmente por campanha
        let url = `/api/asbuilt/prefixos/disponiveis?projeto=${encodeURIComponent(projeto)}&usuario_email=${encodeURIComponent(USER_EMAIL)}`;
        if (campanhaValue) {
            url += `&campanha=${encodeURIComponent(campanhaValue)}`;
        }
        
        console.log('🔍 Buscando prefixos:', url);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.prefixos.length > 0) {
            prefixosDisponiveis = data.prefixos;
            
            prefixoSelect.innerHTML = '<option value="">Selecione o prefixo...</option>';
            data.prefixos.forEach(prefixo => {
                const option = document.createElement('option');
                option.value = prefixo.codigo_prefixo;
                option.textContent = prefixo.codigo_prefixo;
                option.dataset.prefixoId = prefixo.id;
                prefixoSelect.appendChild(option);
            });
            
            console.log(`✅ Carregados ${data.prefixos.length} prefixos disponíveis`);
        } else {
            prefixoSelect.innerHTML = '<option value="">Nenhum prefixo disponível</option>';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar prefixos:', error);
        prefixoSelect.innerHTML = '<option value="">Erro ao carregar prefixos</option>';
    }
}

// ============================================================================
// FUNÇÕES PARA PRESTADOR - GARAGENS E PREFIXOS POR CAMPANHA
// ============================================================================

/**
 * Carrega as garagens disponíveis de uma campanha específica para o prestador.
 * As garagens são definidas pelo gestor no Plano de Campanha.
 */
async function carregarGaragensDaCampanha(campanha) {
    const garagemSelect = document.getElementById('garagemSelect');
    const garagemHidden = document.getElementById('garagem');
    const prefixoSelect = document.getElementById('prefixo');
    
    if (!garagemSelect || !IS_PRESTADOR) return;
    
    if (!campanha) {
        garagemSelect.innerHTML = '<option value="">Selecione a campanha primeiro...</option>';
        if (garagemHidden) garagemHidden.value = '';
        if (prefixoSelect) prefixoSelect.innerHTML = '<option value="">Selecione a garagem primeiro...</option>';
        return;
    }
    
    garagemSelect.innerHTML = '<option value="">Carregando garagens...</option>';
    if (prefixoSelect) prefixoSelect.innerHTML = '<option value="">Selecione a garagem primeiro...</option>';
    
    try {
        const url = `/api/asbuilt/campanhas/${encodeURIComponent(campanha)}/garagens?usuario_email=${encodeURIComponent(USER_EMAIL)}`;
        console.log('🔍 Buscando garagens da campanha:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.garagens && data.garagens.length > 0) {
            garagensData = data.garagens;
            
            garagemSelect.innerHTML = '<option value="">Selecione a garagem...</option>';
            data.garagens.forEach(garagem => {
                const option = document.createElement('option');
                option.value = garagem;
                option.textContent = garagem;
                garagemSelect.appendChild(option);
            });
            
            // Auto-seleção se houver apenas 1 garagem
            if (data.garagens.length === 1) {
                garagemSelect.value = data.garagens[0];
                if (garagemHidden) garagemHidden.value = data.garagens[0];
                console.log('✅ Auto-selecionada garagem:', data.garagens[0]);
                
                // Carregar prefixos dessa garagem
                await carregarPrefixosPorGaragem(campanha, data.garagens[0]);
            }
            
            console.log(`✅ Carregadas ${data.garagens.length} garagens da campanha ${campanha}`);
        } else {
            garagemSelect.innerHTML = '<option value="">Nenhuma garagem encontrada nesta campanha</option>';
            console.warn('Nenhuma garagem encontrada para a campanha:', campanha);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar garagens da campanha:', error);
        garagemSelect.innerHTML = '<option value="">Erro ao carregar garagens</option>';
    }
}

/**
 * Carrega os prefixos de uma garagem específica dentro de uma campanha.
 * Garante que o prestador só veja prefixos da garagem selecionada.
 */
async function carregarPrefixosPorGaragem(campanha, garagem) {
    const prefixoSelect = document.getElementById('prefixo');
    if (!prefixoSelect || !IS_PRESTADOR) return;
    
    if (!campanha || !garagem) {
        prefixoSelect.innerHTML = '<option value="">Selecione a garagem primeiro...</option>';
        return;
    }
    
    prefixoSelect.innerHTML = '<option value="">Carregando prefixos...</option>';
    
    try {
        const url = `/api/asbuilt/campanhas/${encodeURIComponent(campanha)}/prefixos-por-garagem?garagem=${encodeURIComponent(garagem)}&usuario_email=${encodeURIComponent(USER_EMAIL)}`;
        console.log('🔍 Buscando prefixos por garagem:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.prefixos && data.prefixos.length > 0) {
            prefixosDisponiveis = data.prefixos;
            
            prefixoSelect.innerHTML = '<option value="">Selecione o prefixo...</option>';
            data.prefixos.forEach(prefixo => {
                const option = document.createElement('option');
                option.value = prefixo.codigo_prefixo;
                // Se tiver observação, mostrar um indicador
                let label = prefixo.codigo_prefixo;
                if (prefixo.observacao) {
                    label += ' ⚠️';
                }
                option.textContent = label;
                option.dataset.prefixoId = prefixo.id;
                option.dataset.observacao = prefixo.observacao || '';
                prefixoSelect.appendChild(option);
            });
            
            console.log(`✅ Carregados ${data.prefixos.length} prefixos da garagem ${garagem}`);
        } else {
            prefixoSelect.innerHTML = '<option value="">Nenhum prefixo disponível nesta garagem</option>';
            prefixosDisponiveis = [];
        }
    } catch (error) {
        console.error('❌ Erro ao carregar prefixos por garagem:', error);
        prefixoSelect.innerHTML = '<option value="">Erro ao carregar prefixos</option>';
    }
}

function preencherEmpresaPorProjeto(projetoSelecionado) {
    const empresaField = document.getElementById('empresa');
    
    if (!projetoSelecionado) {
        empresaField.value = '';
        return;
    }
    
    const projetoInfo = projetosData.find(p => p.projeto === projetoSelecionado);
    
    if (projetoInfo) {
        empresaField.value = projetoInfo.empresa;
        console.log(`🏢 Projeto selecionado: ${projetoSelecionado} → Empresa: ${projetoInfo.empresa}`);
    } else {
        empresaField.value = 'Não encontrado';
    }
}

function controlarDataRetirada(tipoAsbuilt) {
    const container = document.getElementById('dataRetiradaContainer');
    const input = document.getElementById('dataRetirada');
    
    if (tipoAsbuilt === 'Retirada') {
        container.style.display = 'block';
        input.required = true;
    } else {
        container.style.display = 'none';
        input.required = false;
        input.value = '';
    }
}

function controlarCamposMontagemMaquina(isMontagemMaquina) {
    const container = document.getElementById('montagemMaquinaContainer');
    if (!container) return;
    
    const serialRb = document.getElementById('serialRb');
    const imeiChip = document.getElementById('imeiChip');
    const imeiModem = document.getElementById('imeiModem');
    const numeroTelefone = document.getElementById('numeroTelefone');
    // Campos novos (opcionais)
    const imeiChip2 = document.getElementById('imeiChip2');
    const imeiModem2 = document.getElementById('imeiModem2');
    const numeroTelefone2 = document.getElementById('numeroTelefone2');
    const operadora1 = document.getElementById('operadora1');
    const operadora2 = document.getElementById('operadora2');
    
    // Containers dos campos que devem ser OCULTADOS para Montagem de Máquina
    const projetoEmpresaGaragemRow = document.getElementById('projetoEmpresaGaragemRow');
    const prefixoRow = document.getElementById('prefixoRow');
    const projetoSelect = document.getElementById('projeto');
    const garagemSelect = document.getElementById('garagemSelect');
    const garagemInput = document.getElementById('garagemInput');
    // Container de campanha (se existir)
    const campanhaRow = document.getElementById('campanhaContainer');
    
    if (isMontagemMaquina) {
        container.classList.remove('campo-oculto');
        if (serialRb) serialRb.setAttribute('required', 'required');
        if (imeiChip) imeiChip.setAttribute('required', 'required');
        if (imeiModem) imeiModem.setAttribute('required', 'required');
        if (numeroTelefone) numeroTelefone.setAttribute('required', 'required');
        
        // OCULTAR Projeto, Empresa, Garagem, Prefixo
        if (projetoEmpresaGaragemRow) projetoEmpresaGaragemRow.classList.add('campo-oculto');
        if (prefixoRow) prefixoRow.classList.add('campo-oculto');
        if (campanhaRow) campanhaRow.classList.add('campo-oculto');
        // Remover required dos campos ocultos
        if (projetoSelect) projetoSelect.removeAttribute('required');
        if (garagemSelect) garagemSelect.removeAttribute('required');
        if (garagemInput) garagemInput.removeAttribute('required');
    } else {
        container.classList.add('campo-oculto');
        if (serialRb) { serialRb.removeAttribute('required'); serialRb.value = ''; }
        if (imeiChip) { imeiChip.removeAttribute('required'); imeiChip.value = ''; }
        if (imeiModem) { imeiModem.removeAttribute('required'); imeiModem.value = ''; }
        if (numeroTelefone) { numeroTelefone.removeAttribute('required'); numeroTelefone.value = ''; }
        // Limpar campos opcionais
        if (imeiChip2) imeiChip2.value = '';
        if (imeiModem2) imeiModem2.value = '';
        if (numeroTelefone2) numeroTelefone2.value = '';
        if (operadora1) operadora1.value = '';
        if (operadora2) operadora2.value = '';
        
        // MOSTRAR de volta Projeto, Empresa, Garagem, Prefixo
        if (projetoEmpresaGaragemRow) projetoEmpresaGaragemRow.classList.remove('campo-oculto');
        if (prefixoRow) prefixoRow.classList.remove('campo-oculto');
        // NÃO mostrar campanhaRow aqui — a visibilidade de campanha é controlada exclusivamente por controlarCamposPlanoComunicacao()
        // Campanha só deve aparecer para tipo "Plano de Comunicação"
        if (projetoSelect) projetoSelect.setAttribute('required', 'required');
    }
}

// ============================================================================
// AUTO-PREENCHIMENTO: Busca telefone pelo IMEI do Chip na Dim_Serial
// ============================================================================

async function buscarTelefoneChip(imeiChip, chipNumber) {
    if (!imeiChip || imeiChip.trim().length < 10) return;
    
    const telefoneField = chipNumber === 1 ? document.getElementById('numeroTelefone') : document.getElementById('numeroTelefone2');
    const operadoraField = chipNumber === 1 ? document.getElementById('operadora1') : document.getElementById('operadora2');
    
    if (!telefoneField) return;
    
    try {
        const response = await fetch('/api/asbuilt/lookup-imei', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ imei_chip: imeiChip.trim() })
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.success && data.telefone) {
            telefoneField.value = data.telefone;
            telefoneField.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`✅ Telefone ${chipNumber} preenchido automaticamente: ${data.telefone}`);
            
            if (data.operadora && operadoraField) {
                operadoraField.value = data.operadora;
            }
        }
    } catch (error) {
        console.error('❌ Erro ao buscar telefone pelo IMEI:', error);
    }
}

// ============================================================================
// VALIDAÇÃO DE PATRIMÔNIO
// ============================================================================

async function validarPatrimonioProjeto(projeto, patrimonio) {
    try {
        console.log('🔍 Validação blur: patrimônio x projeto...');
        const response = await fetch('/api/asbuilt/validate-patrimonio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projeto, patrimonio })
        });
        
        const result = await response.json();
        const patrimonioInput = document.getElementById('patrimonio');
        
        if (result.success && !result.valid) {
            patrimonioInput.classList.add('is-invalid');
            showError('⚠️ O patrimônio informado não faz parte do projeto selecionado');
            return false;
        } else if (result.success && result.valid) {
            patrimonioInput.classList.remove('is-invalid');
            console.log('✅ Patrimônio válido para o projeto');
            return true;
        }
    } catch (error) {
        console.error('❌ Erro na validação blur:', error);
    }
    return true;
}

// ============================================================================
// MANIPULAÇÃO DE FOTOS
// ============================================================================

function atualizarCamposFotos(tipoAsbuilt) {
    const container = document.getElementById('fotosContainer');
    
    if (!tipoAsbuilt || !FOTOS_CONFIG[tipoAsbuilt]) {
        container.innerHTML = `
            <h5 class="text-warning mb-3">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Selecione o tipo de Asbuilt para ver os campos de foto obrigatórios
            </h5>
        `;
        return;
    }
    
    const fotos = FOTOS_CONFIG[tipoAsbuilt];
    uploadedImages = {};
    
    container.innerHTML = `
        <h5 class="text-info mb-3">
            <i class="fas fa-camera me-2"></i>
            Fotos Obrigatórias para ${tipoAsbuilt}
        </h5>
        <div class="row g-3" id="fotosGrid"></div>
    `;
    
    const grid = document.getElementById('fotosGrid');
    
    fotos.forEach(foto => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        col.innerHTML = `
            <div class="mb-3">
                <label class="form-label">
                    <i class="fas fa-image me-2"></i>${foto.label}
                    ${foto.required ? '<span class="text-danger">*</span>' : ''}
                </label>
                <div class="upload-box" id="upload-${foto.key}" 
                     onclick="document.getElementById('file-${foto.key}').click()"
                     ondragover="event.preventDefault(); this.classList.add('drag-over')"
                     ondragleave="event.preventDefault(); this.classList.remove('drag-over')"
                     ondrop="event.preventDefault(); this.classList.remove('drag-over'); handleDroppedFile(event, '${foto.key}')">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p class="mb-0 mt-2">Clique ou arraste a foto aqui</p>
                    <small class="text-muted">JPG, PNG (max 10MB)</small>
                </div>
                <input type="file" id="file-${foto.key}" name="${foto.key}" accept="image/*" style="display: none;" 
                       onchange="handleFileUpload(this, '${foto.key}')" ${foto.required ? 'required' : ''}>
                <div id="preview-${foto.key}"></div>
            </div>
        `;
        grid.appendChild(col);
    });
}

function handleFileUpload(input, key) {
    const file = input.files[0];
    
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        showError('Arquivo muito grande! Tamanho máximo: 10MB');
        input.value = '';
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        showError('Formato inválido! Envie apenas imagens');
        input.value = '';
        return;
    }
    
    // Comprimir imagem antes de armazenar (max 1920px, qualidade 0.8)
    comprimirImagem(file, 1920, 0.8).then(compressedFile => {
        uploadedImages[key] = compressedFile;
        
        const uploadBox = document.getElementById(`upload-${key}`);
        uploadBox.classList.add('has-file');
        const reduction = file.size > 0 ? Math.round((1 - compressedFile.size / file.size) * 100) : 0;
        const sizeKB = Math.round(compressedFile.size / 1024);
        uploadBox.innerHTML = `
            <i class="fas fa-check-circle text-success" style="font-size: 2rem;"></i>
            <p class="mb-0 mt-2">${file.name}</p>
            <small class="text-success">Arquivo selecionado (${sizeKB}KB${reduction > 5 ? `, -${reduction}%` : ''})</small>
        `;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(`preview-${key}`).innerHTML = `
                <img src="${e.target.result}" class="image-preview" alt="Preview">
            `;
        };
        reader.readAsDataURL(compressedFile);
    }).catch(() => {
        // Fallback: usar arquivo original se compressão falhar
        uploadedImages[key] = file;
        
        const uploadBox = document.getElementById(`upload-${key}`);
        uploadBox.classList.add('has-file');
        uploadBox.innerHTML = `
            <i class="fas fa-check-circle text-success" style="font-size: 2rem;"></i>
            <p class="mb-0 mt-2">${file.name}</p>
            <small class="text-success">Arquivo selecionado</small>
        `;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(`preview-${key}`).innerHTML = `
                <img src="${e.target.result}" class="image-preview" alt="Preview">
            `;
        };
        reader.readAsDataURL(file);
    });
}

function handleDroppedFile(event, key) {
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    if (!file.type.startsWith('image/')) {
        showError('Formato inválido! Envie apenas imagens');
        return;
    }
    
    // Criar um DataTransfer para colocar o arquivo no input
    const fileInput = document.getElementById(`file-${key}`);
    if (fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
    }
    
    // Reusar a mesma lógica do handleFileUpload
    handleFileUpload({ files: [file], value: file.name }, key);
}

/**
 * Comprime uma imagem usando Canvas.
 * Redimensiona para maxDim e converte para JPEG com qualidade especificada.
 * @param {File} file - Arquivo de imagem original
 * @param {number} maxDim - Dimensão máxima (largura ou altura) em pixels
 * @param {number} quality - Qualidade JPEG (0.0 a 1.0)
 * @returns {Promise<File>} - Arquivo comprimido
 */
function comprimirImagem(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = function() {
            URL.revokeObjectURL(url);
            let w = img.width;
            let h = img.height;
            
            // Não comprimir se já é pequena o suficiente
            if (w <= maxDim && h <= maxDim && file.size <= 1 * 1024 * 1024) {
                resolve(file);
                return;
            }
            
            // Redimensionar mantendo proporção
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            canvas.toBlob(function(blob) {
                if (blob) {
                    const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                    console.log(`📦 Imagem comprimida: ${Math.round(file.size/1024)}KB → ${Math.round(compressed.size/1024)}KB`);
                    resolve(compressed);
                } else {
                    reject(new Error('Canvas toBlob falhou'));
                }
            }, 'image/jpeg', quality);
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            reject(new Error('Erro ao carregar imagem'));
        };
        img.src = url;
    });
}

// ============================================================================
// SALVAR ASBUILT
// ============================================================================

async function salvarAsbuilt() {
    const btnFinalizar = document.getElementById('btnFinalizar');
    
    try {
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Gerando PDF...';
        
        // Sincronizar valor de garagem antes de obter
        sincronizarGaragem();
        
        // Obter valores
        const tipoAsbuilt = document.getElementById('tipoAsbuilt').value || 
                           (IS_PRESTADOR ? 'Plano de Comunicação' : '');
        const projeto = document.getElementById('projeto').value;
        const garagem = document.getElementById('garagem').value;
        const patrimonio = document.getElementById('patrimonio').value;
        const prefixo = document.getElementById('prefixo').value;
        const campanha = document.getElementById('campanha')?.value || '';
        const dataRetirada = document.getElementById('dataRetirada')?.value || '';
        
        // Validações básicas
        if (!tipoAsbuilt) {
            showError('Selecione o tipo de Asbuilt');
            restaurarBotao(btnFinalizar);
            return;
        }
        
        if (!projeto && tipoAsbuilt !== 'Montagem de Máquina') {
            showError('Selecione um projeto');
            restaurarBotao(btnFinalizar);
            return;
        }
        
        if (!garagem && tipoAsbuilt !== 'Montagem de Máquina') {
            const tipoAsbuilt = document.getElementById('tipoAsbuilt').value;
            if (tipoAsbuilt === 'Plano de Comunicação') {
                showError('Digite uma garagem');
            } else {
                showError('Selecione uma garagem');
            }
            restaurarBotao(btnFinalizar);
            return;
        }
        
        // Validação de patrimônio (não para Plano de Comunicação - que usa N/A)
        if (tipoAsbuilt !== 'Plano de Comunicação' && !patrimonio) {
            showError('Preencha o patrimônio');
            restaurarBotao(btnFinalizar);
            return;
        }
        
        // Validação de campos extras para Montagem de Máquina
        if (tipoAsbuilt === 'Montagem de Máquina') {
            const serialRb = document.getElementById('serialRb')?.value;
            const imeiChip = document.getElementById('imeiChip')?.value;
            const imeiModem = document.getElementById('imeiModem')?.value;
            const numeroTelefone = document.getElementById('numeroTelefone')?.value;
            if (!serialRb) { showError('Preencha o Serial da RB'); restaurarBotao(btnFinalizar); return; }
            if (!imeiChip) { showError('Preencha o IMEI do Chip'); restaurarBotao(btnFinalizar); return; }
            if (!imeiModem) { showError('Preencha o IMEI do Modem'); restaurarBotao(btnFinalizar); return; }
            if (!numeroTelefone) { showError('Preencha o Número de Telefone'); restaurarBotao(btnFinalizar); return; }
        }
        
        // Validação de campanha (para Plano de Comunicação)
        if (tipoAsbuilt === 'Plano de Comunicação' && !campanha) {
            showError('Selecione uma campanha');
            restaurarBotao(btnFinalizar);
            return;
        }
        
        // Validação de prefixo (obrigatório para prestador)
        if (IS_PRESTADOR && !prefixo) {
            showError('Selecione um prefixo');
            restaurarBotao(btnFinalizar);
            return;
        }
        
        // Validação de data de retirada
        if (tipoAsbuilt === 'Retirada' && !dataRetirada) {
            showError('Data de retirada é obrigatória para o tipo Retirada');
            restaurarBotao(btnFinalizar);
            return;
        }
        
        // Validar patrimônio x projeto (não para Plano de Comunicação nem Montagem de Máquina)
        if (tipoAsbuilt !== 'Plano de Comunicação' && tipoAsbuilt !== 'Montagem de Máquina') {
            const patrimonioValido = await validarPatrimonioProjeto(projeto, patrimonio);
            if (!patrimonioValido) {
                restaurarBotao(btnFinalizar);
                return;
            }
        }
        
        // Validar fotos obrigatórias
        const fotosObrigatorias = FOTOS_CONFIG[tipoAsbuilt] || [];
        for (const foto of fotosObrigatorias) {
            if (foto.required && !uploadedImages[foto.key]) {
                showError(`Foto obrigatória não enviada: ${foto.label}`);
                restaurarBotao(btnFinalizar);
                return;
            }
        }
        
        // Preparar FormData
        const formData = new FormData();
        formData.append('tipo_asbuilt', tipoAsbuilt);
        formData.append('projeto', tipoAsbuilt === 'Montagem de Máquina' ? 'Montagem' : projeto);
        formData.append('garagem', tipoAsbuilt === 'Montagem de Máquina' ? 'N/A' : garagem);
        formData.append('patrimonio', tipoAsbuilt === 'Plano de Comunicação' ? 'N/A' : patrimonio);
        formData.append('prefixo', tipoAsbuilt === 'Montagem de Máquina' ? 'N/A' : prefixo);
        formData.append('campanha', campanha);
        formData.append('data_retirada', dataRetirada);
        formData.append('usuario_criador', currentUserName);
        formData.append('is_final', true); // Sempre finaliza (removido rascunho)
        formData.append('user_role', USER_ROLE);
        
        // Campos extras para Montagem de Máquina
        if (tipoAsbuilt === 'Montagem de Máquina') {
            formData.append('serial_rb', document.getElementById('serialRb')?.value || '');
            formData.append('imei_chip', document.getElementById('imeiChip')?.value || '');
            formData.append('operadora_1', document.getElementById('operadora1')?.value || '');
            formData.append('imei_modem', document.getElementById('imeiModem')?.value || '');
            formData.append('numero_telefone', document.getElementById('numeroTelefone')?.value || '');
            // Campos opcionais (Chip/Modem 2)
            const imeiChip2 = document.getElementById('imeiChip2')?.value || '';
            const operadora2 = document.getElementById('operadora2')?.value || '';
            const imeiModem2 = document.getElementById('imeiModem2')?.value || '';
            const numTelefone2 = document.getElementById('numeroTelefone2')?.value || '';
            if (imeiChip2) formData.append('imei_chip_2', imeiChip2);
            if (operadora2) formData.append('operadora_2', operadora2);
            if (imeiModem2) formData.append('imei_modem_2', imeiModem2);
            if (numTelefone2) formData.append('numero_telefone_2', numTelefone2);
        }
        
        // Adicionar imagens
        for (const [key, file] of Object.entries(uploadedImages)) {
            formData.append(key, file);
        }
        
        // Enviar para API
        const response = await fetch('/api/asbuilt/create', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        restaurarBotao(btnFinalizar);
        
        if (result.success) {
            showSuccess(`Asbuilt ${result.asbuilt_id} criado com sucesso!`);
            
            // Se for prestador e usou prefixo do dropdown, marcar como utilizado
            if (IS_PRESTADOR && prefixo) {
                await marcarPrefixoUtilizado(prefixo, result.asbuilt_id);
            }
            
            limparFormulario();
            
            // Oferecer visualização do PDF
            if (result.arquivo_url) {
                setTimeout(() => {
                    if (confirm('Deseja visualizar o PDF gerado?')) {
                        window.open(result.arquivo_url, '_blank');
                    }
                }, 1500);
            }
        } else {
            showError(result.detail || result.message || 'Erro ao criar Asbuilt');
        }
        
    } catch (error) {
        console.error('Erro ao salvar Asbuilt:', error);
        restaurarBotao(btnFinalizar);
        showError('Erro ao salvar Asbuilt: ' + error.message);
    }
}

async function marcarPrefixoUtilizado(codigoPrefixo, asbuiltId) {
    try {
        // Buscar ID do prefixo
        const prefixoData = prefixosDisponiveis.find(p => p.codigo_prefixo === codigoPrefixo);
        if (!prefixoData) return;
        
        const formData = new FormData();
        formData.append('prefixo_id', prefixoData.id);
        formData.append('asbuilt_id', asbuiltId);
        formData.append('usuario_email', USER_EMAIL);
        
        await fetch('/api/asbuilt/prefixos/utilizar', {
            method: 'POST',
            body: formData
        });
        
        console.log('✅ Prefixo marcado como utilizado');
    } catch (error) {
        console.error('Erro ao marcar prefixo como utilizado:', error);
    }
}

function restaurarBotao(btn) {
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Finalizar e Gerar PDF';
    }
}

function limparFormulario() {
    const form = document.getElementById('formAsbuilt');
    if (form) {
        form.reset();
    }
    uploadedImages = {};
    
    // Limpar select de garagem
    const garagemSelect = document.getElementById('garagem');
    if (garagemSelect) {
        garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
    }
    
    // Limpar select de campanha
    const campanhaSelect = document.getElementById('campanha');
    if (campanhaSelect) {
        campanhaSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        if ($.fn.select2) {
            $(campanhaSelect).trigger('change');
        }
    }
    
    // Limpar select de prefixos (para prestador)
    if (IS_PRESTADOR) {
        const prefixoSelect = document.getElementById('prefixo');
        if (prefixoSelect) {
            prefixoSelect.innerHTML = '<option value="">Selecione a garagem primeiro...</option>';
        }
    }
    
    // Resetar campos de foto
    if (!IS_PRESTADOR) {
        atualizarCamposFotos('');
    } else {
        atualizarCamposFotos('Plano de Comunicação');
    }
}

// ============================================================================
// BUSCAR ASBUILTS
// ============================================================================

async function buscarAsbuilts() {
    try {
        const buscarGeral = (document.getElementById('buscarGeral')?.value || '').trim();
        
        const filters = {
            projeto: document.getElementById('buscarProjeto')?.value || '',
            garagem: document.getElementById('buscarGaragem')?.value || '',
            tipo_asbuilt: document.getElementById('buscarTipoAsbuilt')?.value || '',
            frota: document.getElementById('buscarFrota')?.value || '',
            situacao: 'Concluído'
        };
        
        // Campo unificado: detectar se é ID, patrimônio ou prefixo
        if (buscarGeral) {
            // Se contém vírgulas ou quebras de linha, tratar como lista
            const itens = buscarGeral.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
            if (itens.length > 1) {
                // Múltiplos itens - buscar como lista de patrimônios E prefixos
                filters.patrimonios_list = itens;
                filters.prefixos_list = itens;
                filters.busca_geral_list = itens;
            } else {
                // Item único - buscar em todos os campos (ID, patrimônio, prefixo)
                filters.busca_geral = buscarGeral;
            }
        }
        
        const response = await fetch('/api/asbuilt/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        const result = await response.json();
        
        if (result.success) {
            ultimosResultadosBusca = result.asbuilts;
            exibirResultados(result.asbuilts);
        } else {
            showError('Erro ao buscar Asbuilts');
        }
        
    } catch (error) {
        console.error('Erro ao buscar:', error);
        showError('Erro ao buscar: ' + error.message);
    }
}

function exibirResultados(asbuilts) {
    const tbody = document.querySelector('#tabelaResultados tbody');
    const count = document.getElementById('countResultados');
    
    if (!tbody || !count) return;
    
    count.textContent = asbuilts.length;
    
    if (asbuilts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted">Nenhum resultado encontrado</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = asbuilts.map(asb => {
        let frotaBadge = 'bg-secondary';
        if (asb.frota === 'Atual') frotaBadge = 'bg-success';
        else if (asb.frota === 'Retirada') frotaBadge = 'bg-warning';
        
        return `
        <tr>
            <td><strong>${asb.asbuilt_id}</strong></td>
            <td>${asb.tipo_asbuilt}</td>
            <td>${asb.projeto}</td>
            <td>${asb.garagem || '-'}</td>
            <td>${asb.patrimonio}</td>
            <td>${asb.prefixo || '-'}</td>
            <td><span class="badge ${frotaBadge}">${asb.frota}</span></td>
            <td><span class="badge bg-success">Concluído</span></td>
            <td>${new Date(asb.data_criacao).toLocaleDateString('pt-BR')}</td>
            <td>
                ${asb.arquivo_url ? `
                    <button class="btn btn-sm btn-primary" onclick="window.open('${asb.arquivo_url}', '_blank')" title="Visualizar/Baixar PDF">
                        <i class="fas fa-download me-1"></i>PDF
                    </button>
                ` : '<span class="text-muted">Sem arquivo</span>'}
            </td>
        </tr>
        `;
    }).join('');
}

// ============================================================================
// CARREGAR GARAGENS PARA FILTRO DE BUSCA
// ============================================================================

async function carregarGaragensBusca() {
    const garagemSelect = document.getElementById('buscarGaragem');
    if (!garagemSelect) return;
    
    try {
        const response = await fetch('/api/asbuilt/garagens/todas');
        const result = await response.json();
        
        if (result.success && result.garagens) {
            const garagens = [...new Set(result.garagens.map(g => g.nome || g).filter(Boolean))].sort();
            garagemSelect.innerHTML = '<option value="">Todas as garagens</option>';
            garagens.forEach(g => {
                garagemSelect.innerHTML += `<option value="${g}">${g}</option>`;
            });
        }
    } catch (error) {
        console.error('Erro ao carregar garagens para busca:', error);
    }
}

// ============================================================================
// EXPORTAR ASBUILTS PARA XLS
// ============================================================================

async function exportarAsbuiltsXLS() {
    const btn = document.getElementById('btnExportarXLS');
    
    // Se não tem resultados de busca, buscar primeiro
    if (!ultimosResultadosBusca || ultimosResultadosBusca.length === 0) {
        showError('Faça uma busca primeiro antes de exportar');
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exportando...';
    }
    
    try {
        // Construir mesmos filtros da busca
        const buscarGeral = (document.getElementById('buscarGeral')?.value || '').trim();
        
        const filters = {
            projeto: document.getElementById('buscarProjeto')?.value || '',
            garagem: document.getElementById('buscarGaragem')?.value || '',
            tipo_asbuilt: document.getElementById('buscarTipoAsbuilt')?.value || '',
            frota: document.getElementById('buscarFrota')?.value || '',
            situacao: 'Concluído'
        };
        
        if (buscarGeral) {
            const itens = buscarGeral.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
            if (itens.length > 1) {
                filters.busca_geral_list = itens;
            } else {
                filters.busca_geral = buscarGeral;
            }
        }
        
        const response = await fetch('/api/asbuilt/export-xlsx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asbuilts_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        console.error('Erro ao exportar XLS:', error);
        showError('Erro ao exportar: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-excel me-2"></i>Exportar XLS';
        }
    }
}

// ============================================================================
// PREFIXOS ADESIVADOS
// ============================================================================

async function carregarPrefixosAdesivados() {
    try {
        const empresa = document.getElementById('filtroEmpresaAdesivados')?.value || '';
        const prefixo = document.getElementById('filtroPrefixoAdesivados')?.value || '';
        const campanha = document.getElementById('filtroCampanhaAdesivados')?.value || '';
        
        let url = '/api/asbuilt/prefixos/adesivados?';
        if (empresa) url += `empresa=${encodeURIComponent(empresa)}&`;
        if (prefixo) url += `prefixo=${encodeURIComponent(prefixo)}&`;
        if (campanha) url += `campanha=${encodeURIComponent(campanha)}&`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            exibirPrefixosAdesivados(result.prefixos_adesivados);
        } else {
            showError('Erro ao carregar prefixos adesivados');
        }
        
    } catch (error) {
        console.error('Erro ao carregar prefixos adesivados:', error);
        showError('Erro: ' + error.message);
    }
}

function exibirPrefixosAdesivados(prefixos) {
    const tbody = document.getElementById('bodyAdesivados');
    const count = document.getElementById('countAdesivados');
    
    if (!tbody || !count) return;
    
    count.textContent = prefixos.length;
    
    if (prefixos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">Nenhum prefixo adesivado encontrado</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = prefixos.map(p => {
        // Criar botão de download do PDF
        let pdfButton = '-';
        if (p.pdf_url) {
            pdfButton = `<a href="${p.pdf_url}" target="_blank" class="btn btn-sm btn-success" title="Baixar PDF">
                <i class="fas fa-download"></i>
            </a>`;
        } else if (p.asbuilt_id) {
            // Tentar buscar pelo endpoint de download
            pdfButton = `<button class="btn btn-sm btn-outline-secondary" onclick="downloadAsbuiltPdf('${p.asbuilt_id}')" title="Buscar PDF">
                <i class="fas fa-search"></i>
            </button>`;
        }
        
        return `
            <tr>
                <td><strong>${p.codigo_prefixo}</strong></td>
                <td>${p.projeto}</td>
                <td>${p.garagem}</td>
                <td>${p.campanha || '-'}</td>
                <td>${p.asbuilt_id}</td>
                <td>${p.usuario_executor}</td>
                <td>${new Date(p.data_adesivacao).toLocaleDateString('pt-BR')}</td>
                <td>${pdfButton}</td>
            </tr>
        `;
    }).join('');
}

// Função para baixar PDF do AsBuilt
async function downloadAsbuiltPdf(asbuiltId) {
    try {
        const response = await fetch(`/api/asbuilt/${asbuiltId}/download`);
        const result = await response.json();
        
        if (result.success && result.download_url) {
            window.open(result.download_url, '_blank');
        } else {
            showError('PDF não disponível para este AsBuilt');
        }
    } catch (error) {
        console.error('Erro ao buscar PDF:', error);
        showError('Erro ao buscar PDF: ' + error.message);
    }
}

// ============================================================================
// FUNÇÕES DE OBSERVAÇÃO POR PREFIXO (PRESTADOR)
// ============================================================================

let prefixoAtualId = null;
let observacaoSalvaDebounce = null;

/**
 * Verifica se o prefixo selecionado tem observação e exibe o container
 */
function verificarObservacaoPrefixo() {
    const prefixoSelect = document.getElementById('prefixo');
    const observacaoContainer = document.getElementById('observacaoContainer');
    const temObservacaoCheck = document.getElementById('temObservacao');
    const observacaoBody = document.getElementById('observacaoBody');
    const observacaoTextarea = document.getElementById('observacaoPrefixo');
    
    if (!prefixoSelect || !IS_PRESTADOR || !observacaoContainer) return;
    
    const selectedOption = prefixoSelect.options[prefixoSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        observacaoContainer.style.display = 'none';
        prefixoAtualId = null;
        return;
    }
    
    // Mostrar container de observação
    observacaoContainer.style.display = 'block';
    prefixoAtualId = selectedOption.dataset.prefixoId;
    
    // Verificar se tem observação existente
    const observacaoExistente = selectedOption.dataset.observacao || '';
    
    if (observacaoExistente) {
        temObservacaoCheck.checked = true;
        observacaoBody.style.display = 'block';
        observacaoTextarea.value = observacaoExistente;
    } else {
        temObservacaoCheck.checked = false;
        observacaoBody.style.display = 'none';
        observacaoTextarea.value = '';
    }
    
    console.log(`📝 Prefixo selecionado ID: ${prefixoAtualId}, Observação existente: ${observacaoExistente ? 'Sim' : 'Não'}`);
}

/**
 * Alterna a visibilidade do campo de observação
 */
function toggleObservacaoCampo() {
    const temObservacaoCheck = document.getElementById('temObservacao');
    const observacaoBody = document.getElementById('observacaoBody');
    const observacaoTextarea = document.getElementById('observacaoPrefixo');
    
    if (temObservacaoCheck.checked) {
        observacaoBody.style.display = 'block';
        observacaoTextarea.focus();
    } else {
        observacaoBody.style.display = 'none';
        // Se desmarcar, limpar e salvar vazio
        if (observacaoTextarea.value) {
            observacaoTextarea.value = '';
            salvarObservacaoPrefixo();
        }
    }
}

/**
 * Salva a observação do prefixo (chamada no onBlur e com debounce)
 */
async function salvarObservacaoPrefixo() {
    if (!prefixoAtualId || !IS_PRESTADOR) return;
    
    const observacaoTextarea = document.getElementById('observacaoPrefixo');
    const observacaoStatus = document.getElementById('observacaoStatus');
    const observacao = observacaoTextarea.value.trim();
    
    // Limpar debounce anterior se houver
    if (observacaoSalvaDebounce) {
        clearTimeout(observacaoSalvaDebounce);
    }
    
    // Salvar com pequeno delay para evitar múltiplas chamadas
    observacaoSalvaDebounce = setTimeout(async () => {
        try {
            observacaoStatus.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Salvando...';
            
            const response = await fetch(`/api/asbuilt/prefixos/${prefixoAtualId}/observacao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    observacao: observacao,
                    usuario_email: USER_EMAIL
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                observacaoStatus.innerHTML = '<span class="text-success"><i class="fas fa-check-circle me-1"></i>Observação salva!</span>';
                
                // Atualizar o dataset da opção selecionada
                const prefixoSelect = document.getElementById('prefixo');
                const selectedOption = prefixoSelect.options[prefixoSelect.selectedIndex];
                if (selectedOption) {
                    selectedOption.dataset.observacao = observacao;
                    // Atualizar label se tiver observação
                    const codigoPrefixo = selectedOption.value;
                    selectedOption.textContent = observacao ? `${codigoPrefixo} ⚠️` : codigoPrefixo;
                }
                
                console.log('✅ Observação salva com sucesso');
                
                // Limpar mensagem após 3 segundos
                setTimeout(() => {
                    observacaoStatus.innerHTML = '';
                }, 3000);
            } else {
                observacaoStatus.innerHTML = '<span class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Erro ao salvar</span>';
                console.error('Erro ao salvar observação:', result.message);
            }
        } catch (error) {
            observacaoStatus.innerHTML = '<span class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Erro ao salvar</span>';
            console.error('Erro ao salvar observação:', error);
        }
    }, 500);
}

/**
 * Listener para salvar observação com debounce enquanto digita
 */
document.addEventListener('DOMContentLoaded', function() {
    const observacaoTextarea = document.getElementById('observacaoPrefixo');
    if (observacaoTextarea && IS_PRESTADOR) {
        observacaoTextarea.addEventListener('input', function() {
            // Debounce: salvar após 2 segundos sem digitar
            if (observacaoSalvaDebounce) {
                clearTimeout(observacaoSalvaDebounce);
            }
            observacaoSalvaDebounce = setTimeout(() => {
                salvarObservacaoPrefixo();
            }, 2000);
        });
    }
});

// ============================================================================
// UTILIDADES
// ============================================================================

function showSuccess(message) {
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    document.getElementById('successModalBody').textContent = message;
    modal.show();
}

function showError(message) {
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    document.getElementById('errorModalBody').textContent = message;
    modal.show();
}

// ============================================================================
// GESTÃO DE CAMPANHAS (PRESTADOR - Somente Visualização)
// ============================================================================

let dadosGestaoCache = [];

/**
 * Carrega gestão de campanhas simplificada para prestador (somente visualização)
 */
async function carregarGestaoSimplificada() {
    try {
        const response = await fetch('/api/asbuilt/campanhas/gestao');
        const result = await response.json();
        
        if (result.success) {
            dadosGestaoCache = result.campanhas || [];
            exibirGestaoSimplificada(dadosGestaoCache);
            atualizarCardsGestao(dadosGestaoCache);
        } else {
            showError('Erro ao carregar campanhas: ' + (result.message || 'Erro desconhecido'));
        }
        
    } catch (error) {
        console.error('Erro ao carregar gestão:', error);
        showError('Erro: ' + error.message);
    }
}

/**
 * Exibe tabela de gestão para prestador
 */
function exibirGestaoSimplificada(campanhas) {
    const tbody = document.getElementById('bodyGestao');
    const count = document.getElementById('countGestao');
    
    if (!tbody || !count) return;
    
    count.textContent = campanhas.length;
    
    if (campanhas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted">Nenhuma campanha encontrada</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = campanhas.map((c, idx) => {
        const total = parseInt(c.total_prefixos) || 0;
        const adesivados = parseInt(c.adesivados) || 0;
        const pendentes = parseInt(c.pendentes) || 0;
        const progresso = total > 0 ? Math.round((adesivados / total) * 100) : 0;
        
        // Classe de cor da barra de progresso
        let progressClass = 'bg-danger';
        if (progresso >= 100) progressClass = 'bg-success';
        else if (progresso >= 50) progressClass = 'bg-warning';
        else if (progresso > 0) progressClass = 'bg-info';
        
        // Criar ID seguro para a campanha (remover caracteres especiais)
        const campanhaId = `campanha_${idx}`;
        
        return `
            <tr class="campanha-row" data-campanha="${encodeURIComponent(c.campanha)}" data-projeto="${encodeURIComponent(c.projeto)}">
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary expand-btn" onclick="toggleDetalhesCampanha('${campanhaId}', '${encodeURIComponent(c.campanha)}', '${encodeURIComponent(c.projeto)}')" title="Ver detalhes">
                        <i class="fas fa-plus" id="icon_${campanhaId}"></i>
                    </button>
                </td>
                <td><strong>${c.campanha}</strong></td>
                <td>${c.projeto}</td>
                <td>${c.garagens || '-'}</td>
                <td class="text-center">${total}</td>
                <td class="text-center"><span class="badge bg-success">${adesivados}</span></td>
                <td class="text-center"><span class="badge bg-warning text-dark">${pendentes}</span></td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${progressClass}" role="progressbar" 
                             style="width: ${progresso}%;" 
                             aria-valuenow="${progresso}" aria-valuemin="0" aria-valuemax="100">
                            ${progresso}%
                        </div>
                    </div>
                </td>
                <td>${c.data_criacao ? new Date(c.data_criacao).toLocaleDateString('pt-BR') : '-'}</td>
            </tr>
            <tr id="detalhes_${campanhaId}" class="detalhes-row" style="display: none;">
                <td colspan="9" style="padding: 0; background: rgba(0,0,0,0.2);">
                    <div class="p-3" id="conteudo_${campanhaId}">
                        <div class="text-center text-muted">
                            <i class="fas fa-spinner fa-spin me-2"></i>Carregando detalhes...
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Atualiza cards de estatísticas da gestão
 */
function atualizarCardsGestao(campanhas) {
    let totalPrefixos = 0;
    let totalAdesivados = 0;
    let totalPendentes = 0;
    
    campanhas.forEach(c => {
        totalPrefixos += parseInt(c.total_prefixos) || 0;
        totalAdesivados += parseInt(c.adesivados) || 0;
        totalPendentes += parseInt(c.pendentes) || 0;
    });
    
    const elemTotal = document.getElementById('totalPrefixosGestao');
    const elemAdesivados = document.getElementById('totalAdesivadosGestao');
    const elemPendentes = document.getElementById('totalPendentesGestao');
    
    if (elemTotal) elemTotal.textContent = totalPrefixos;
    if (elemAdesivados) elemAdesivados.textContent = totalAdesivados;
    if (elemPendentes) elemPendentes.textContent = totalPendentes;
}

/**
 * Exporta dados de gestão para XLSX com detalhes completos
 */
async function exportarGestaoXlsx() {
    if (dadosGestaoCache.length === 0) {
        showError('Nenhuma campanha para exportar. Carregue os dados primeiro.');
        return;
    }
    
    try {
        // Verificar se SheetJS está disponível
        if (typeof XLSX === 'undefined') {
            await carregarSheetJS();
        }
        
        // Mostrar loading
        const btnExport = document.querySelector('[onclick="exportarGestaoXlsx()"]');
        const btnOriginal = btnExport ? btnExport.innerHTML : '';
        if (btnExport) {
            btnExport.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exportando...';
            btnExport.disabled = true;
        }
        
        // Carregar detalhes de todas as campanhas
        const todosDetalhes = [];
        
        for (const c of dadosGestaoCache) {
            try {
                const url = `/api/asbuilt/campanhas/${encodeURIComponent(c.campanha)}/prefixos?projeto=${encodeURIComponent(c.projeto)}`;
                const response = await fetch(url);
                const result = await response.json();
                
                if (result.success && result.prefixos) {
                    result.prefixos.forEach(p => {
                        todosDetalhes.push({
                            'Campanha': c.campanha,
                            'Projeto': c.projeto,
                            'Garagem': p.garagem || '-',
                            'Prefixo': p.codigo_prefixo,
                            'Status': p.status === 'utilizado' ? 'Adesivado' : 'Pendente',
                            'Asbuilt ID': p.asbuilt_id || '-',
                            'Observação': p.observacao || '-',
                            'Data Criação': p.data_criacao ? new Date(p.data_criacao).toLocaleDateString('pt-BR') : '-'
                        });
                    });
                }
            } catch (err) {
                console.warn(`Erro ao carregar detalhes de ${c.campanha}:`, err);
            }
        }
        
        // Criar workbook
        const wb = XLSX.utils.book_new();
        
        // Aba 1: Resumo por Campanha
        const dadosResumo = dadosGestaoCache.map(c => ({
            'Campanha': c.campanha,
            'Projeto': c.projeto,
            'Garagens': c.garagens || '-',
            'Total Prefixos': parseInt(c.total_prefixos) || 0,
            'Adesivados': parseInt(c.adesivados) || 0,
            'Pendentes': parseInt(c.pendentes) || 0,
            'Progresso (%)': c.total_prefixos > 0 ? 
                Math.round((parseInt(c.adesivados) / parseInt(c.total_prefixos)) * 100) : 0,
            'Data Criação': c.data_criacao ? new Date(c.data_criacao).toLocaleDateString('pt-BR') : '-'
        }));
        
        const wsResumo = XLSX.utils.json_to_sheet(dadosResumo);
        wsResumo['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 14 },
            { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }
        ];
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Campanhas');
        
        // Aba 2: Detalhes (todos os prefixos)
        if (todosDetalhes.length > 0) {
            const wsDetalhes = XLSX.utils.json_to_sheet(todosDetalhes);
            wsDetalhes['!cols'] = [
                { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
                { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 14 }
            ];
            XLSX.utils.book_append_sheet(wb, wsDetalhes, 'Detalhes Prefixos');
        }
        
        // Gerar arquivo
        const dataHora = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
        XLSX.writeFile(wb, `gestao_campanhas_${dataHora}.xlsx`);
        
        // Restaurar botão
        if (btnExport) {
            btnExport.innerHTML = btnOriginal;
            btnExport.disabled = false;
        }
        
        showSuccess(`Arquivo exportado com sucesso! ${dadosGestaoCache.length} campanhas e ${todosDetalhes.length} prefixos.`);
        
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showError('Erro ao exportar: ' + error.message);
        
        // Restaurar botão em caso de erro
        const btnExport = document.querySelector('[onclick="exportarGestaoXlsx()"]');
        if (btnExport) {
            btnExport.innerHTML = '<i class="fas fa-file-excel me-2"></i>Exportar XLSX';
            btnExport.disabled = false;
        }
    }
}

/**
 * Carrega biblioteca SheetJS dinamicamente
 */
function carregarSheetJS() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Falha ao carregar SheetJS'));
        document.head.appendChild(script);
    });
}

// Cache para detalhes das campanhas (usado na exportação)
let detalhesCache = {};

/**
 * Toggle para mostrar/ocultar detalhes de uma campanha
 */
async function toggleDetalhesCampanha(campanhaId, campanhaEncoded, projetoEncoded) {
    const detalhesRow = document.getElementById(`detalhes_${campanhaId}`);
    const conteudo = document.getElementById(`conteudo_${campanhaId}`);
    const icon = document.getElementById(`icon_${campanhaId}`);
    
    if (!detalhesRow) return;
    
    const isVisible = detalhesRow.style.display !== 'none';
    
    if (isVisible) {
        // Ocultar
        detalhesRow.style.display = 'none';
        icon.classList.remove('fa-minus');
        icon.classList.add('fa-plus');
    } else {
        // Mostrar e carregar dados
        detalhesRow.style.display = 'table-row';
        icon.classList.remove('fa-plus');
        icon.classList.add('fa-minus');
        
        // Carregar detalhes
        await carregarDetalhesCampanha(campanhaId, decodeURIComponent(campanhaEncoded), decodeURIComponent(projetoEncoded));
    }
}

/**
 * Carrega detalhes de uma campanha (prefixos, garagens, status)
 */
async function carregarDetalhesCampanha(campanhaId, campanha, projeto) {
    const conteudo = document.getElementById(`conteudo_${campanhaId}`);
    
    try {
        const url = `/api/asbuilt/campanhas/${encodeURIComponent(campanha)}/prefixos?projeto=${encodeURIComponent(projeto)}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && result.prefixos) {
            const prefixos = result.prefixos;
            
            // Armazenar no cache para exportação
            detalhesCache[`${campanha}_${projeto}`] = prefixos;
            
            if (prefixos.length === 0) {
                conteudo.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-info-circle me-2"></i>Nenhum prefixo encontrado nesta campanha
                    </div>
                `;
                return;
            }
            
            // Agrupar por garagem
            const porGaragem = {};
            prefixos.forEach(p => {
                const garagem = p.garagem || 'Sem Garagem';
                if (!porGaragem[garagem]) {
                    porGaragem[garagem] = [];
                }
                porGaragem[garagem].push(p);
            });
            
            // Renderizar tabela de detalhes
            let html = `
                <div class="table-responsive">
                    <table class="table table-sm table-bordered" style="margin-bottom: 0; background: rgba(255,255,255,0.05);">
                        <thead style="background: rgba(76, 175, 80, 0.2);">
                            <tr>
                                <th style="color: #4CAF50;">Garagem</th>
                                <th style="color: #4CAF50;">Prefixo</th>
                                <th style="color: #4CAF50;">Status</th>
                                <th style="color: #4CAF50;">Asbuilt ID</th>
                                <th style="color: #4CAF50;">Observação</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            Object.keys(porGaragem).sort().forEach(garagem => {
                const prefixosGaragem = porGaragem[garagem];
                prefixosGaragem.forEach((p, idx) => {
                    const statusClass = p.status === 'utilizado' ? 'bg-success' : 'bg-warning text-dark';
                    const statusText = p.status === 'utilizado' ? 'Adesivado' : 'Pendente';
                    
                    html += `
                        <tr>
                            ${idx === 0 ? `<td rowspan="${prefixosGaragem.length}" style="vertical-align: middle; font-weight: bold; color: #ecf0f1;">${garagem}</td>` : ''}
                            <td style="color: #ecf0f1;">${p.codigo_prefixo}</td>
                            <td><span class="badge ${statusClass}">${statusText}</span></td>
                            <td style="color: #bdc3c7;">${p.asbuilt_id || '-'}</td>
                            <td style="color: #bdc3c7; font-size: 0.85em;">${p.observacao || '-'}</td>
                        </tr>
                    `;
                });
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            conteudo.innerHTML = html;
            
        } else {
            conteudo.innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>Erro ao carregar detalhes
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        conteudo.innerHTML = `
            <div class="text-center text-danger">
                <i class="fas fa-exclamation-circle me-2"></i>Erro: ${error.message}
            </div>
        `;
    }
}

// ============================================================================
// SISTEMA DE NOTIFICAÇÕES PARA PRESTADORES
// ============================================================================

let ultimasNotificacoes = [];

/**
 * Verifica notificações automaticamente (sem abrir dropdown)
 */
async function verificarNotificacoes() {
    if (!IS_PRESTADOR) return;
    
    try {
        const response = await fetch('/api/asbuilt/notificacoes');
        
        // Verificar se a resposta é válida
        if (!response.ok) {
            console.warn(`⚠️ Notificações: HTTP ${response.status}`);
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            const badge = document.getElementById('badgeNotificacoes');
            const totalNovas = result.total_novas || 0;
            const totalPendentes = result.total_pendentes || 0;
            
            // Detectar se há novas notificações desde a última verificação
            if (totalPendentes > ultimoTotalPendentes && ultimoTotalPendentes > 0) {
                // Novas campanhas chegaram! Mostrar alerta visual
                mostrarAlertaNovaNotificacao(totalPendentes - ultimoTotalPendentes);
            }
            ultimoTotalPendentes = totalPendentes;
            
            // Mostrar badge se houver notificações novas
            if (badge) {
                if (totalNovas > 0) {
                    badge.textContent = totalNovas > 9 ? '9+' : totalNovas;
                    badge.style.display = 'inline-block';
                    badge.classList.add('notification-badge-pulse');
                } else if (totalPendentes > 0) {
                    badge.textContent = totalPendentes > 99 ? '99+' : totalPendentes;
                    badge.style.display = 'inline-block';
                    badge.classList.remove('notification-badge-pulse');
                } else {
                    badge.style.display = 'none';
                }
            }
            
            ultimasNotificacoes = result.notificacoes || [];
            
            console.log(`📬 Notificações: ${totalNovas} novas, ${totalPendentes} pendentes`);
        }
        
    } catch (error) {
        // Silenciar erros de rede para não poluir console
        if (error.name !== 'TypeError') {
            console.warn('⚠️ Erro ao verificar notificações:', error.message);
        }
    }
}

/**
 * Mostra alerta visual quando novas campanhas chegam
 */
function mostrarAlertaNovaNotificacao(quantidade) {
    // Piscar o ícone de notificação
    const bellIcon = document.querySelector('#notificacoesDropdown i');
    if (bellIcon) {
        bellIcon.style.animation = 'shake 0.5s ease-in-out 3';
        setTimeout(() => {
            bellIcon.style.animation = '';
        }, 1500);
    }
    
    // Mostrar toast notification (se suportado)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('WifiMaxx - Nova Campanha!', {
            body: `${quantidade} novo(s) prefixo(s) disponível(is)`,
            icon: '/static/logo.png'
        });
    }
    
    console.log(`🔔 ALERTA: ${quantidade} nova(s) notificação(ões)!`);
}

/**
 * Solicita permissão para notificações do navegador
 */
function solicitarPermissaoNotificacoes() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Carrega e exibe notificações no dropdown
 */
async function carregarNotificacoes() {
    const conteudo = document.getElementById('notificacoesConteudo');
    if (!conteudo) return;
    
    // Mostrar loading
    conteudo.innerHTML = `
        <div class="text-center text-muted p-3">
            <i class="fas fa-spinner fa-spin me-2"></i>Carregando...
        </div>
    `;
    
    try {
        const response = await fetch('/api/asbuilt/notificacoes');
        
        // Verificar se a resposta é válida
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            const notificacoes = result.notificacoes || [];
            const resumoPendentes = result.resumo_pendentes || [];
            
            if (notificacoes.length === 0 && resumoPendentes.length === 0) {
                conteudo.innerHTML = `
                    <div class="notification-empty">
                        <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                        <p class="mb-0">Nenhuma notificação</p>
                        <small class="text-muted">Você está em dia!</small>
                    </div>
                `;
                return;
            }
            
            let html = '';
            
            // Seção de Novas Campanhas
            if (notificacoes.length > 0) {
                html += `
                    <li class="dropdown-item" style="background: rgba(76, 175, 80, 0.1); pointer-events: none;">
                        <small class="text-success"><i class="fas fa-bullhorn me-1"></i>Novas Campanhas (últimos 7 dias)</small>
                    </li>
                `;
                
                notificacoes.forEach(n => {
                    const dataFormatada = n.data ? new Date(n.data).toLocaleDateString('pt-BR') : '';
                    html += `
                        <li>
                            <a class="dropdown-item notification-item" href="#" onclick="irParaCampanha('${encodeURIComponent(n.campanha)}')">
                                <div class="notification-title">
                                    <i class="fas fa-tag me-1"></i>${n.campanha}
                                </div>
                                <div class="notification-message">${n.mensagem}</div>
                                <div class="notification-time">
                                    <i class="fas fa-building me-1"></i>${n.projeto} &bull; ${dataFormatada}
                                </div>
                            </a>
                        </li>
                    `;
                });
            }
            
            // Seção de Pendentes
            if (resumoPendentes.length > 0) {
                html += `
                    <li><hr class="dropdown-divider" style="border-color: rgba(76, 175, 80, 0.3);"></li>
                    <li class="dropdown-item" style="background: rgba(255, 193, 7, 0.1); pointer-events: none;">
                        <small class="text-warning"><i class="fas fa-clock me-1"></i>Prefixos Pendentes</small>
                    </li>
                `;
                
                resumoPendentes.forEach(p => {
                    html += `
                        <li>
                            <a class="dropdown-item notification-item" href="#" onclick="irParaCampanha('${encodeURIComponent(p.campanha)}')">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span style="color: #ecf0f1;">${p.campanha}</span>
                                    <span class="badge bg-warning text-dark">${p.pendentes} pendentes</span>
                                </div>
                                <small class="text-muted">${p.projeto}</small>
                            </a>
                        </li>
                    `;
                });
            }
            
            // Link para gestão
            html += `
                <li><hr class="dropdown-divider" style="border-color: rgba(76, 175, 80, 0.3);"></li>
                <li>
                    <a class="dropdown-item text-center" href="#" onclick="abrirAbaGestao()" style="color: #4CAF50;">
                        <i class="fas fa-chart-bar me-1"></i>Ver Gestão de Campanhas
                    </a>
                </li>
            `;
            
            conteudo.innerHTML = html;
            
            // Limpar badge após visualizar
            const badge = document.getElementById('badgeNotificacoes');
            if (badge) {
                badge.classList.remove('notification-badge-pulse');
            }
            
        } else {
            conteudo.innerHTML = `
                <div class="notification-empty text-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>Erro ao carregar
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
        conteudo.innerHTML = `
            <div class="notification-empty text-danger">
                <i class="fas fa-exclamation-circle me-2"></i>Erro: ${error.message}
            </div>
        `;
    }
}

/**
 * Navega para a campanha específica
 */
function irParaCampanha(campanhaEncoded) {
    const campanha = decodeURIComponent(campanhaEncoded);
    console.log('📌 Navegar para campanha:', campanha);
    
    // Fechar dropdown
    const dropdown = document.getElementById('notificacoesDropdown');
    if (dropdown) {
        const bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
        if (bsDropdown) bsDropdown.hide();
    }
    
    // Abrir aba de criação e selecionar campanha
    const criarTab = document.getElementById('criar-tab');
    if (criarTab) {
        criarTab.click();
        
        // Esperar e selecionar a campanha
        setTimeout(() => {
            const campanhaSelect = document.getElementById('campanha');
            if (campanhaSelect) {
                // Se for Select2
                if ($(campanhaSelect).data('select2')) {
                    $(campanhaSelect).val(campanha).trigger('change');
                } else {
                    campanhaSelect.value = campanha;
                    campanhaSelect.dispatchEvent(new Event('change'));
                }
            }
        }, 500);
    }
}

/**
 * Abre a aba de Gestão de Campanhas
 */
function abrirAbaGestao() {
    // Fechar dropdown
    const dropdown = document.getElementById('notificacoesDropdown');
    if (dropdown) {
        const bsDropdown = bootstrap.Dropdown.getInstance(dropdown);
        if (bsDropdown) bsDropdown.hide();
    }
    
    // Clicar na aba de gestão
    const gestaoTab = document.getElementById('gestao-tab');
    if (gestaoTab) {
        gestaoTab.click();
    }
}
