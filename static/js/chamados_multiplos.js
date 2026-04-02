// ============================================================================
// CRIAÇÃO MÚLTIPLA DE CHAMADOS - Código adicional
// ============================================================================

// Controlar visibilidade dos botões baseado na aba ativa
document.addEventListener('DOMContentLoaded', function() {
    const individualTab = document.getElementById('individual-tab');
    const multiploTab = document.getElementById('multiplo-tab');
    const btnCriarChamado = document.getElementById('btnCriarChamado');
    const btnCriarMultiplos = document.getElementById('btnCriarMultiplos');
    
    // Mostrar botão individual inicialmente
    if (btnCriarChamado) btnCriarChamado.style.display = 'inline-block';
    if (btnCriarMultiplos) btnCriarMultiplos.style.display = 'none';
    
    // Alternar botões quando trocar de aba
    if (individualTab) {
        individualTab.addEventListener('shown.bs.tab', function() {
            if (btnCriarChamado) btnCriarChamado.style.display = 'inline-block';
            if (btnCriarMultiplos) btnCriarMultiplos.style.display = 'none';
        });
    }
    
    if (multiploTab) {
        multiploTab.addEventListener('shown.bs.tab', function() {
            if (btnCriarChamado) btnCriarChamado.style.display = 'none';
            if (btnCriarMultiplos) btnCriarMultiplos.style.display = 'inline-block';
            // Carregar selects da aba múltipla
            carregarSelectsMultiplos();
        });
    }
    
    // Adicionar listeners para atualizar preview
    const multiploGaragem = document.getElementById('multiploGaragem');
    const multiploStatus = document.getElementById('multiploStatus');
    
    if (multiploGaragem) {
        multiploGaragem.addEventListener('change', atualizarPreviewMultiplo);
    }
    if (multiploStatus) {
        multiploStatus.addEventListener('change', atualizarPreviewMultiplo);
    }
});

// Carregar selects da aba de criação múltipla
function carregarSelectsMultiplos() {
    // Preencher Projeto (reutiliza projetos do chamados.js)
    const multiploProjetoSelect = document.getElementById('multiploProjeto');
    if (multiploProjetoSelect && multiploProjetoSelect.options.length <= 1) {
        multiploProjetoSelect.innerHTML = '<option value="">Selecione o projeto...</option>';
        if (typeof projetos !== 'undefined' && Array.isArray(projetos)) {
            projetos.forEach(p => {
                multiploProjetoSelect.innerHTML += `<option value="${p}">${p}</option>`;
            });
        }
    }

    // Preencher Departamentos (reutiliza departamentos do chamados.js)
    const multiploDepartamentoSelect = document.getElementById('multiploDepartamento');
    if (multiploDepartamentoSelect && multiploDepartamentoSelect.options.length <= 1) {
        multiploDepartamentoSelect.innerHTML = '<option value="">Selecione o departamento...</option>';
        if (typeof departamentos !== 'undefined' && Array.isArray(departamentos)) {
            departamentos.forEach(d => {
                multiploDepartamentoSelect.innerHTML += `<option value="${d}">${d}</option>`;
            });
        }
    }
}

// Quando selecionar projeto no formulário múltiplo
function onMultiploProjetoChange() {
    const projetoSelect = document.getElementById('multiploProjeto');
    const garagemSelect = document.getElementById('multiploGaragem');
    const previewDiv = document.getElementById('multiploPreview');
    
    const projetoSelecionado = projetoSelect.value;
    
    if (!projetoSelecionado) {
        garagemSelect.innerHTML = '<option value="">Selecione o projeto primeiro...</option>';
        garagemSelect.disabled = true;
        if (previewDiv) {
            previewDiv.innerHTML = '<small class="text-muted">Selecione os filtros acima para ver quais equipamentos serão incluídos</small>';
        }
        return;
    }
    
    // Buscar garagens do projeto usando o mesmo mapeamento da aba individual (garagensPorProjeto de chamados.js)
    const garagensDoProjeto = (typeof garagensPorProjeto !== 'undefined' && garagensPorProjeto[projetoSelecionado]) || [];
    
    // Limpar select de garagem
    garagemSelect.innerHTML = '<option value="">Todas as garagens</option>';
    
    if (garagensDoProjeto.length > 0) {
        garagensDoProjeto.forEach(g => {
            garagemSelect.innerHTML += `<option value="${g}">${g}</option>`;
        });
        garagemSelect.disabled = false;
    } else {
        garagemSelect.innerHTML = '<option value="">Nenhuma garagem disponível</option>';
        garagemSelect.disabled = false;
    }
    
    // Atualizar preview
    atualizarPreviewMultiplo();
}

// Quando mudar departamento no formulário múltiplo
function onMultiploDepartamentoChange() {
    const departamento = document.getElementById('multiploDepartamento').value;
    const classificacaoContainer = document.getElementById('multiploClassificacaoContainer');
    const classificacaoSelect = document.getElementById('multiploClassificacao');
    const camposN4Container = document.getElementById('multiploCamposN4Container');
    
    // Esconder campos N4 por padrão ao mudar departamento
    if (camposN4Container) camposN4Container.style.display = 'none';
    
    // Mostrar/ocultar classificação baseado no departamento
    if (CLASSIFICACOES_CONFIG[departamento] && CLASSIFICACOES_CONFIG[departamento].length > 0) {
        classificacaoSelect.innerHTML = '<option value="">Selecione a classificação...</option>';
        CLASSIFICACOES_CONFIG[departamento].forEach(c => {
            classificacaoSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
        classificacaoContainer.style.display = 'block';
        
        // Se for Operações, ao selecionar Atendimento Externo (N4), mostrar campos N4
        if (departamento === 'Operações') {
            // Remover listener anterior para evitar duplicação
            const newSelect = classificacaoSelect.cloneNode(true);
            classificacaoSelect.parentNode.replaceChild(newSelect, classificacaoSelect);
            
            newSelect.addEventListener('change', function() {
                // Verificar se contém "Atendimento Externo" ou é "N4"
                if (this.value.includes('Atendimento Externo') || this.value.includes('(N4)')) {
                    camposN4Container.style.display = 'block';
                    carregarTecnicosN4Multiplos();
                } else {
                    camposN4Container.style.display = 'none';
                }
            });
        }
    } else {
        classificacaoContainer.style.display = 'none';
        if (camposN4Container) camposN4Container.style.display = 'none';
    }
}

// Carregar técnicos N4 para formulário múltiplo
async function carregarTecnicosN4Multiplos() {
    try {
        const response = await fetch('/api/chamados/config/tecnicos', { credentials: 'include' });
        if (response.ok) {
            const tecnicos = await response.json();
            const select = document.getElementById('multiploTecnicoResponsavel');
            if (select) {
                select.innerHTML = '<option value="">Selecione o técnico...</option>';
                tecnicos.forEach(t => {
                    select.innerHTML += `<option value="${t.email}">${t.nome} (${t.email})</option>`;
                });
            }
            
            // Carregar equipe de apoio também
            const equipeSelect = document.getElementById('multiploEquipeApoio');
            if (equipeSelect) {
                equipeSelect.innerHTML = '';
                tecnicos.forEach(t => {
                    equipeSelect.innerHTML += `<option value="${t.email}">${t.nome} (${t.email})</option>`;
                });
            }
        }
    } catch (error) {
        console.error('Erro ao carregar técnicos N4:', error);
    }
}

// Atualizar preview de equipamentos que serão incluídos
async function atualizarPreviewMultiplo() {
    const projeto = document.getElementById('multiploProjeto').value;
    const garagem = document.getElementById('multiploGaragem').value;
    const status = document.getElementById('multiploStatus').value;
    const previewDiv = document.getElementById('multiploPreview');
    
    if (!previewDiv) {
        console.error('multiploPreview div não encontrada!');
        return;
    }
    
    if (!projeto || !status) {
        previewDiv.innerHTML = '<small class="text-muted">Selecione Projeto e Status para visualizar os equipamentos</small>';
        return;
    }
    
    // Mostrar loading
    previewDiv.innerHTML = '<small class="text-info"><i class="fas fa-spinner fa-spin me-2"></i>Buscando equipamentos...</small>';
    
    try {
        // Buscar equipamentos da API (caminho absoluto, não usa API_BASE)
        let url = `/api/dashboard/equipamentos?projeto=${encodeURIComponent(projeto)}&status=${encodeURIComponent(status)}`;
        if (garagem) {
            url += `&garagem=${encodeURIComponent(garagem)}`;
        }
        
        console.log('🔍 Buscando preview de equipamentos:', url);
        
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        const equipamentos = result.data || [];
        
        console.log(`✅ Preview: ${equipamentos.length} equipamentos encontrados`);
        
        // Mostrar resultado
        if (equipamentos.length === 0) {
            previewDiv.innerHTML = '<small class="text-warning"><i class="fas fa-exclamation-triangle me-2"></i>Nenhum equipamento encontrado com estes filtros</small>';
        } else {
            previewDiv.innerHTML = `
                <small class="text-success">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong>${equipamentos.length}</strong> equipamento(s) encontrado(s)
                </small>
                <br>
                <small class="text-muted">
                    Projeto: <strong>${projeto}</strong>
                    ${garagem ? `, Garagem: <strong>${garagem}</strong>` : ''}
                    , Status: <strong>${status}</strong>
                </small>
            `;
        }
    } catch (error) {
        console.error('❌ Erro ao buscar preview de equipamentos:', error);
        previewDiv.innerHTML = `<small class="text-danger"><i class="fas fa-times-circle me-2"></i>Erro ao buscar equipamentos: ${error.message}</small>`;
    }
}

// Criar múltiplos chamados
async function criarChamadosMultiplos() {
    console.log('🚀 Iniciando criação de múltiplos chamados');
    
    const projeto = document.getElementById('multiploProjeto').value;
    const garagem = document.getElementById('multiploGaragem').value;
    const status = document.getElementById('multiploStatus').value;
    const departamento = document.getElementById('multiploDepartamento').value;
    const classificacao = document.getElementById('multiploClassificacao').value;
    const descricao = document.getElementById('multiploDescricao').value.trim();
    
    console.log('📋 Valores do formulário:', { projeto, garagem, status, departamento, classificacao });
    
    // Validação
    if (!projeto || !status || !departamento) {
        console.warn('⚠️ Validação falhou - campos obrigatórios faltando');
        mostrarToast('Preencha todos os campos obrigatórios (Projeto, Status e Departamento)', 'warning');
        return;
    }
    
    // Validar classificação se necessário
    const classificacoesDoDept = CLASSIFICACOES_CONFIG[departamento] || [];
    if (classificacoesDoDept.length > 0 && !classificacao) {
        mostrarToast('Selecione uma classificação', 'warning');
        return;
    }
    
    // Se for N4, validar técnico
    let tecnicoResponsavelEmail = null;
    let equipeEmails = null;
    if (departamento === 'Operações' && classificacao === 'Atendimento Externo') {
        const tecnicoSelect = document.getElementById('multiploTecnicoResponsavel');
        if (tecnicoSelect) {
            tecnicoResponsavelEmail = tecnicoSelect.value;
        }
        if (!tecnicoResponsavelEmail) {
            mostrarToast('Selecione o técnico responsável para Atendimento Externo', 'warning');
            return;
        }
        
        // Coletar equipe de apoio
        const equipeSelect = document.getElementById('multiploEquipeApoio');
        if (equipeSelect) {
            equipeEmails = Array.from(equipeSelect.selectedOptions).map(opt => opt.value);
        }
    }
    
    // Desabilitar botão e mostrar loading
    const btnCriar = document.getElementById('btnCriarMultiplos');
    if (!btnCriar) {
        console.error('Botão btnCriarMultiplos não encontrado!');
        mostrarToast('Erro ao criar chamados. Recarregue a página.', 'danger');
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
    
    btnCriar.disabled = true;
    if (btnIcon) {
        btnIcon.className = 'fas fa-spinner fa-spin me-2';
    }
    if (btnText) {
        btnText.textContent = 'Buscando equipamentos...';
    }
    
    
    try {
        // Buscar equipamentos da API (caminho absoluto, não usa API_BASE)
        let equipamentosUrl = `/api/dashboard/equipamentos?projeto=${encodeURIComponent(projeto)}&status=${encodeURIComponent(status)}`;
        if (garagem) {
            equipamentosUrl += `&garagem=${encodeURIComponent(garagem)}`;
        }
        
        console.log('🔍 Buscando equipamentos da URL:', equipamentosUrl);
        
        const equipamentosResponse = await fetch(equipamentosUrl, { credentials: 'include' });
        
        console.log('📡 Resposta da API:', equipamentosResponse.status, equipamentosResponse.statusText);
        
        if (!equipamentosResponse.ok) {
            throw new Error(`Erro ao buscar equipamentos: ${equipamentosResponse.status}`);
        }
        
        const result = await equipamentosResponse.json();
        const equipamentos = result.data || [];
        
        console.log(`📦 Equipamentos recebidos:`, equipamentos.length, equipamentos);
        
        if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
            console.warn('⚠️ Nenhum equipamento encontrado');
            mostrarToast('Nenhum equipamento encontrado com estes filtros', 'warning');
            return;
        }
        
        // Confirmar com o usuário
        console.log(`❓ Solicitando confirmação para criar ${equipamentos.length} chamados`);
        if (!confirm(`Criar ${equipamentos.length} chamado(s) para o departamento ${departamento}?\n\nEsta operação não pode ser desfeita.`)) {
            console.log('❌ Usuário cancelou a operação');
            return;
        }
        
        btnText.textContent = `Criando 0/${equipamentos.length}...`;
        
        let sucessos = 0;
        let falhas = 0;
        let erros = [];
        
        // Criar chamados um por um
        for (let i = 0; i < equipamentos.length; i++) {
            const eq = equipamentos[i];
            try {
                const nivelOperacoes = (departamento === 'Operações' && classificacao === 'Atendimento Externo') ? 'N4' : null;
                
                const dados = {
                    type: 'manutencao',
                    patrimonio: eq.Patrimonio || eq.patrimonio || '',
                    prefixo: eq.Prefixo || eq.prefixo || '',
                    projeto: eq.PROJETO || eq.projeto || projeto,
                    garagem: eq.GARAGEM || eq.garagem || garagem || '',
                    serial: eq.Hotspot || eq.hotspot || eq.serial || '',
                    tecnico_responsavel: departamento,
                    departamento: departamento,
                    classificacao: classificacao || null,
                    description: descricao || `Chamado aberto automaticamente - Status: ${status}`,
                    user_email: USER_EMAIL || 'sistema@wifimaxx.com',
                    user_name: USER_NAME || 'Usuário',
                    nivel_operacoes: nivelOperacoes,
                    tecnico_responsavel_email: tecnicoResponsavelEmail,
                    equipe_emails: equipeEmails
                };
                
                const response = await fetch(`${API_BASE}/`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                
                if (response.ok) {
                    sucessos++;
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    falhas++;
                    
                    // Mensagem mais amigável para duplicidade
                    let msgErro = errorData.detail || 'Erro desconhecido';
                    if (response.status === 400 && msgErro.includes('Já existe um chamado')) {
                        // Extrair apenas a informação relevante
                        erros.push(`⚠️ Patrimônio ${dados.patrimonio}: Já possui chamado aberto`);
                    } else {
                        erros.push(`❌ ${dados.patrimonio}: ${msgErro}`);
                    }
                }
                
                // Atualizar progresso
                btnText.textContent = `Criando ${sucessos + falhas}/${equipamentos.length}...`;
                
            } catch (error) {
                falhas++;
                erros.push(`❌ ${eq.Patrimonio || eq.patrimonio}: ${error.message}`);
            }
        }
        
        // Mostrar resultado
        const temDuplicados = erros.some(e => e.includes('Já possui chamado'));
        
        if (sucessos > 0 && falhas > 0) {
            if (temDuplicados) {
                mostrarToast(`✅ ${sucessos} chamado(s) criado(s). ${falhas} patrimônio(s) já tinham chamados abertos.`, 'info');
            } else {
                mostrarToast(`✅ ${sucessos} chamado(s) criado(s) com sucesso! (${falhas} falha(s))`, 'warning');
            }
        } else if (sucessos > 0) {
            mostrarToast(`✅ ${sucessos} chamado(s) criado(s) com sucesso!`, 'success');
        } else if (temDuplicados) {
            mostrarToast(`⚠️ Nenhum chamado criado. Todos os ${falhas} patrimônio(s) já possuem chamados abertos.`, 'warning');
        } else {
            mostrarToast(`❌ Falha ao criar chamados. Nenhum chamado foi criado.`, 'danger');
        }
        
        // Limpar formulário se teve algum sucesso
        if (sucessos > 0) {
            const form = document.getElementById('formMultiplosChamados');
            if (form) form.reset();
            const previewDiv = document.getElementById('multiploPreview');
            if (previewDiv) {
                previewDiv.innerHTML = '<small class="text-muted">Selecione os filtros acima para ver quais equipamentos serão incluídos</small>';
            }
            
            // Fechar modal
            const modal = document.getElementById('modalNovoChamado');
            if (modal) {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }
            
            // Atualizar UI
            if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
            if (typeof renderizarChamados === 'function') renderizarChamados();
        }
        
        // Mostrar detalhes dos erros em console e toasts (máximo 5)
        if (erros.length > 0) {
            console.log('📋 Detalhes da criação múltipla:', erros);
            setTimeout(() => {
                erros.slice(0, 5).forEach(err => mostrarToast(err, err.includes('⚠️') ? 'info' : 'warning'));
                if (erros.length > 5) {
                    mostrarToast(`... e mais ${erros.length - 5} patrimônio(s) com problemas`, 'info');
                }
            }, 500);
        }
        
    } catch (error) {
        console.error('Erro ao criar chamados múltiplos:', error);
        mostrarToast('Erro ao criar chamados. Verifique sua conexão.', 'danger');
    } finally {
        // Reabilitar botão
        if (btnCriar) {
            btnCriar.disabled = false;
        }
        if (btnIcon) {
            btnIcon.className = 'fas fa-check-double me-2';
        }
        if (btnText) {
            btnText.textContent = 'Criar Chamados';
        }
    }
}
