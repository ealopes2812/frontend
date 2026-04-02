/**
 * Relatórios - Frontend de gráficos e análises
 * Utiliza Chart.js para visualizações e Fetch API para comunicação com backend
 */

let statusColumnChart = null;
let garagemBarChart = null;
let currentReportData = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Carregando Relatórios Module...');
    
    // Verificar se elementos essenciais estão presentes
    const elementosEssenciais = [
        'empresaDbSelect', 'projetoSelect', 'cardTotal', 
        'statusColumnChart', 'garagemBarChart', 'offendersTable'
    ];
    
    const elementosFaltantes = [];
    elementosEssenciais.forEach(id => {
        if (!document.getElementById(id)) {
            elementosFaltantes.push(id);
        }
    });
    
    if (elementosFaltantes.length > 0) {
        console.error('❌ ELEMENTOS FALTANDO NO DOM:', elementosFaltantes);
        console.log('📍 Elementos encontrados:', Array.from(document.querySelectorAll('[id]')).map(e => e.id).slice(0, 20));
    } else {
        console.log('✅ Todos os elementos essenciais encontrados');
    }
    
    carregarEmpresas();
    
    const empresaSel = document.getElementById('empresaDbSelect');
    const projetoSel = document.getElementById('projetoSelect');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnExportPDF = document.getElementById('btnExportPDF');
    
    if (empresaSel) {
        empresaSel.addEventListener('change', async () => {
            const empresa = empresaSel.value;
            if (!empresa) {
                limparTudo();
                return;
            }
            await carregarProjetos(empresa);
            await carregarRelatorio();
        });
    }
    
    if (projetoSel) {
        projetoSel.addEventListener('change', carregarRelatorio);
    }
    
    if (btnRefresh) {
        btnRefresh.addEventListener('click', carregarRelatorio);
    }
    
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', exportarRelatorioPDF);
    }
    
    console.log('✅ Relatórios Module inicializado');
});

/**
 * Carrega lista de empresas e popula o select
 */
async function carregarEmpresas() {
    try {
        mostrarCarregando(true);
        const res = await fetch('/api/reports/empresas', { credentials: 'include' });
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const json = await res.json();
        mostrarCarregando(false);
        
        if (!json.success) {
            console.warn('⚠️ Erro ao carregar empresas:', json.message);
            return;
        }
        
        const sel = document.getElementById('empresaDbSelect');
        sel.innerHTML = '<option value="">Selecione uma empresa...</option>';
        
        if (json.empresas && json.empresas.length > 0) {
            json.empresas.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e;
                opt.textContent = e;
                sel.appendChild(opt);
            });
            console.log(`✅ ${json.empresas.length} empresa(s) carregada(s)`);
        } else {
            mostrarErro('Nenhuma empresa disponível');
        }
    } catch (err) {
        mostrarCarregando(false);
        console.error('❌ Erro ao carregar empresas:', err);
        mostrarErro('Erro ao carregar lista de empresas');
    }
}

/**
 * Carrega lista de projetos para uma empresa específica
 */
async function carregarProjetos(empresaDb) {
    try {
        const res = await fetch(`/api/reports/projetos?empresa_db=${encodeURIComponent(empresaDb)}`, {
            credentials: 'include'
        });
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const json = await res.json();
        
        const sel = document.getElementById('projetoSelect');
        sel.innerHTML = '<option value="">Todos os projetos</option>';
        
        if (!json.success) {
            console.warn('⚠️ Erro ao carregar projetos:', json);
            return;
        }
        
        if (json.projetos && json.projetos.length > 0) {
            json.projetos.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                sel.appendChild(opt);
            });
            console.log(`✅ ${json.projetos.length} projeto(s) carregado(s)`);
        }
    } catch (err) {
        console.error('❌ Erro ao carregar projetos:', err);
        mostrarErro('Erro ao carregar lista de projetos');
    }
}

/**
 * Carrega relatório com dados de status, garagens e ofensores
 */
async function carregarRelatorio() {
    const empresa = document.getElementById('empresaDbSelect').value;
    const projeto = document.getElementById('projetoSelect').value;
    
    if (!empresa) {
        mostrarErro('Por favor, selecione uma empresa');
        return;
    }
    
    mostrarCarregando(true);
    limparTodo();
    
    let url = `/api/reports/projeto?empresa_db=${encodeURIComponent(empresa)}`;
    if (projeto) {
        url += `&projeto=${encodeURIComponent(projeto)}`;
    }
    
    try {
        const res = await fetch(url, { credentials: 'include' });
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const json = await res.json();
        mostrarCarregando(false);
        
        if (!json.success) {
            console.warn('⚠️ Relatório não retornou sucesso:', json.message);
            mostrarErro(json.message || 'Erro ao carregar relatório');
            limparTudo();
            return;
        }
        
        currentReportData = json;
        console.log('✅ Dados de relatório carregados:', json);
        
        // Atualizar todos os componentes
        atualizarResumo(json.summary);
        atualizarStatusChart(json.summary.status_counts);
        atualizarGaragemChart(json.by_garagem);
        atualizarOffendersTable(json.offenders.garagens);
        
        limparErro();
        
    } catch (err) {
        mostrarCarregando(false);
        console.error('❌ Erro ao carregar relatório:', err);
        mostrarErro('Erro ao carregar dados do relatório');
        limparTudo();
    }
}

/**
 * Limpa todos os dados exibidos
 */
function limparTudo() {
    atualizarResumo({ total: 0, status_counts: {} });
    atualizarStatusChart({});
    atualizarGaragemChart([]);
    atualizarOffendersTable({ alerta: [], inativo: [], atencao: [] });
}

/**
 * Função auxiliar para limpar tudo (typo-safe)
 */
function limparTodo() {
    // Alias para limparTudo
    limparTudo();
}

/**
 * Atualiza cards de resumo com totais por status
 * CORREÇÃO: Usando mesma lógica da dashboard (Monitoramento BI + Keep Alive)
 */
function atualizarResumo(summary) {
    const total = summary?.total || 0;
    const counts = summary?.status_counts || {};
    
    // Verificar e atualizar cada elemento com segurança
    const elementos = {
        'cardTotal': total,
        'cardOnline': counts.online || 0,
        'cardAtencao': counts.atencao || 0,
        'cardAlerta': counts.alerta || 0,
        'cardInativo': counts.inativo || 0,
        'cardManutencao': counts.manutencao || 0,
        'cardDivergencia': counts.divergencia || 0
    };
    
    for (const [id, valor] of Object.entries(elementos)) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = valor.toLocaleString('pt-BR');
        } else {
            console.warn(`⚠️ Elemento ${id} não encontrado no DOM`);
        }
    }
    
    console.log('📋 Cards de resumo atualizados');
}

/**
 * Desenha gráfico de coluna com distribuição por status
 */
function atualizarStatusChart(counts) {
    const ctx = document.getElementById('statusColumnChart');
    if (!ctx) {
        console.warn('⚠️ Canvas statusColumnChart não encontrado - página pode estar em loading ou template incorreto');
        console.log('📍 Elementos encontrados no DOM:', Array.from(document.querySelectorAll('[id]')).map(e => e.id).slice(0, 20));
        return;
    }

    const rawData = [
        counts.online || 0,
        counts.atencao || 0,
        counts.alerta || 0,
        counts.inativo || 0,
        counts.manutencao || 0
    ];

    // Converter para percentuais (0-100)
    const total = rawData.reduce((a, b) => a + b, 0);
    const data = total > 0 ? rawData.map(v => (v / total) * 100) : [0, 0, 0, 0, 0];

    const labels = ['Online', 'Atenção', 'Alerta', 'Inativo', 'Manutenção'];

    // Cores vibrantes e harmônicas
    const colors = ['#4CAF50','#FFC107','#F44336','#9E9E9E','#2196F3'];

    // Destruir gráfico anterior se existir
    if (statusColumnChart) {
        statusColumnChart.destroy();
    }

    statusColumnChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '%',
                data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            const percentage = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                            return `${percentage.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#ecf0f1', font: { size: 12 } } },
                y: { beginAtZero: true, max: 100, ticks: { color: '#ecf0f1', font: { size: 12 } } }
            }
        },
        plugins: [
            {
                id: 'statusDatalabels',
                afterDatasetsDraw(chart) {
                    try {
                        const { ctx: canvasCtx, data } = chart;
                        const meta = chart.getDatasetMeta(0);
                        const dataset = data.datasets[0];
                        
                        canvasCtx.save();
                        canvasCtx.font = 'bold 16px Arial';
                        canvasCtx.fillStyle = '#fff';
                        canvasCtx.textAlign = 'center';
                        canvasCtx.textBaseline = 'bottom';
                        
                        meta.data.forEach((bar, index) => {
                            const percentage = dataset.data[index] || 0;
                            if (percentage < 1) return; // Não desenhar se < 1%
                            const x = bar.x;
                            const y = bar.y - 8;
                            canvasCtx.fillText(percentage.toFixed(1) + '%', x, y);
                        });
                        
                        canvasCtx.restore();
                    } catch (err) {
                        console.warn('Erro ao desenhar labels status:', err);
                    }
                }
            }
        ]
    });

    console.log('📊 Gráfico de colunas atualizado');
}

/**
 * Desenha gráfico de barras empilhadas com status por garagem
 */
function atualizarGaragemChart(byGaragem) {
    const ctx = document.getElementById('garagemBarChart');
    if (!ctx) {
        console.warn('⚠️ Canvas garagemBarChart não encontrado');
        return;
    }
    
    if (!byGaragem || byGaragem.length === 0) {
        console.warn('⚠️ Nenhuma garagem encontrada');
        if (garagemBarChart) {
            garagemBarChart.destroy();
        }
        return;
    }
    
    // Limitar a 15 garagens para não poluir o gráfico
    const garagensFiltradas = byGaragem.slice(0, 15);
    
    const labels = garagensFiltradas.map(g => g.garagem || 'N/D');
    
    // Calcular totais por status e converter para percentuais
    const rawAlerta = garagensFiltradas.map(g => g.alerta || 0);
    const rawAtencao = garagensFiltradas.map(g => g.atencao || 0);
    const rawInativo = garagensFiltradas.map(g => g.inativo || 0);
    const rawManutencao = garagensFiltradas.map(g => g.manutencao || 0);
    
    // Total geral de máquinas em problemas
    const totalProblems = rawAlerta.concat(rawAtencao, rawInativo, rawManutencao).reduce((a, b) => a + b, 0);
    
    // Converter para percentuais
    const alerta = totalProblems > 0 ? rawAlerta.map(v => (v / totalProblems) * 100) : rawAlerta;
    const atencao = totalProblems > 0 ? rawAtencao.map(v => (v / totalProblems) * 100) : rawAtencao;
    const inativo = totalProblems > 0 ? rawInativo.map(v => (v / totalProblems) * 100) : rawInativo;
    const manutencao = totalProblems > 0 ? rawManutencao.map(v => (v / totalProblems) * 100) : rawManutencao;
    
    if (garagemBarChart) {
        garagemBarChart.destroy();
    }
    
    garagemBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Alerta',
                    data: alerta,
                    backgroundColor: '#F44336',
                    borderColor: '#EF5350',
                    borderWidth: 0,
                    borderRadius: 4
                },
                {
                    label: 'Atenção',
                    data: atencao,
                    backgroundColor: '#FFC107',
                    borderColor: '#FFD54F',
                    borderWidth: 0,
                    borderRadius: 4
                },
                {
                    label: 'Inativo',
                    data: inativo,
                    backgroundColor: '#9E9E9E',
                    borderColor: '#BDBDBD',
                    borderWidth: 0,
                    borderRadius: 4
                },
                {
                    label: 'Manutenção',
                    data: manutencao,
                    backgroundColor: '#2196F3',
                    borderColor: '#42A5F5',
                    borderWidth: 0,
                    borderRadius: 4
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: { size: 13, weight: 'bold', family: "'Segoe UI', sans-serif" },
                        color: '#ecf0f1',
                        usePointStyle: true,
                        pointStyle: 'rect'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    borderColor: 'rgba(76, 175, 80, 0.5)',
                    borderWidth: 1,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.x.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(76, 175, 80, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 11, weight: '500' },
                        color: '#bdc3c7'
                    }
                },
                y: {
                    stacked: true,
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 11, weight: '600' },
                        color: '#ecf0f1'
                    }
                }
            }
        },
        plugins: [
            {
                id: 'garagemDatalabels',
                afterDatasetsDraw(chart) {
                    try {
                        const { ctx: canvasCtx, data } = chart;
                        const datasets = data.datasets;
                        
                        canvasCtx.save();
                        canvasCtx.font = 'bold 13px Arial';
                        canvasCtx.fillStyle = '#fff';
                        canvasCtx.textAlign = 'center';
                        canvasCtx.textBaseline = 'middle';
                        
                        // Desenhar rótulos para cada dataset (bar stack)
                        datasets.forEach((dataset, datasetIndex) => {
                            const meta = chart.getDatasetMeta(datasetIndex);
                            
                            // NOVO: Verificar se o dataset está visível
                            if (meta.hidden || !chart.isDatasetVisible(datasetIndex)) {
                                return; // Pular este dataset se estiver oculto
                            }
                            
                            meta.data.forEach((bar, index) => {
                                const value = dataset.data[index] || 0;
                                
                                // Calcular percentual considerando apenas datasets visíveis
                                let totalVisible = 0;
                                datasets.forEach((ds, i) => {
                                    if (chart.isDatasetVisible(i)) {
                                        totalVisible += (ds.data[index] || 0);
                                    }
                                });
                                
                                const percentage = totalVisible > 0 ? (value / totalVisible) * 100 : 0;
                                
                                if (percentage < 2) return; // Não desenhar se < 2% (muito pequeno)
                                
                                const x = bar.x;
                                const y = bar.y;
                                canvasCtx.fillText(percentage.toFixed(1) + '%', x, y);
                            });
                        });
                        
                        canvasCtx.restore();
                    } catch (err) {
                        console.warn('Erro ao desenhar labels garagem:', err);
                    }
                }
            }
        ]
    });
    
    console.log('📊 Gráfico de garagens atualizado');
}

/**
 * Popula tabela de maiores ofensores
 */
function atualizarOffendersTable(offenders) {
    const tbody = document.querySelector('#offendersTable tbody');
    if (!tbody) {
        console.warn('⚠️ Tabela de ofensores não encontrada');
        console.log('📍 Elementos table encontrados:', Array.from(document.querySelectorAll('table')).length);
        return;
    }
    
    tbody.innerHTML = '';
    
    const alerta = offenders.alerta || [];
    const inativo = offenders.inativo || [];
    const atencao = offenders.atencao || [];
    
    // Agregar dados por garagem
    const map = new Map();
    
    function acumular(lista, statusKey) {
        lista.forEach(item => {
            const garagem = item.garagem || 'N/D';
            const atual = map.get(garagem) || {
                garagem: garagem,
                alerta: 0,
                inativo: 0,
                atencao: 0
            };
            atual[statusKey] = (atual[statusKey] || 0) + (item.count || 0);
            map.set(garagem, atual);
        });
    }
    
    acumular(alerta, 'alerta');
    acumular(inativo, 'inativo');
    acumular(atencao, 'atencao');
    
    // Converter para array, calcular total e ordenar
    const rows = Array.from(map.values())
        .map(r => {
            r.total = (r.alerta || 0) + (r.inativo || 0) + (r.atencao || 0);
            return r;
        })
        .sort((a, b) => b.total - a.total);
    
    // Limitar a 20 maiores ofensores
    rows.slice(0, 20).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-start fw-bold">${sanitizeHtml(r.garagem)}</td>
            <td class="text-center">
                <span class="badge bg-danger">${r.alerta || 0}</span>
            </td>
            <td class="text-center">
                <span class="badge bg-secondary">${r.inativo || 0}</span>
            </td>
            <td class="text-center">
                <span class="badge bg-warning text-dark">${r.atencao || 0}</span>
            </td>
            <td class="text-center">
                <span class="badge bg-dark">${r.total}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="5" class="text-center text-muted py-3">Nenhum registro encontrado</td>';
        tbody.appendChild(tr);
    }
    
    console.log(`📋 Tabela de ofensores atualizada (${rows.length} garagens)`);
}

/**
 * Mostra/oculta indicador de carregamento
 */
function mostrarCarregando(ativo) {
    const el = document.getElementById('loadingIndicator');
    if (el) {
        if (ativo) {
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    }
}

/**
 * Mostra mensagem de erro
 */
function mostrarErro(mensagem) {
    const el = document.getElementById('errorIndicator');
    if (el) {
        el.textContent = mensagem;
        el.classList.remove('d-none');
    }
}

/**
 * Limpa mensagens de erro
 */
function limparErro() {
    const el = document.getElementById('errorIndicator');
    if (el) {
        el.classList.add('d-none');
    }
}

/**
 * Sanitiza strings para evitar XSS
 */
function sanitizeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Função stub para exportar dados (compatibilidade com onclick handlers)
 */
function exportData() {
    console.log('📥 Exportar dados - funcionalidade ainda não implementada');
    alert('Funcionalidade de exportação será adicionada em breve');
}

/**
 * Exporta o relatório atual em PDF
 */
async function exportarRelatorioPDF() {
    const empresa = document.getElementById('empresaDbSelect').value;
    const projeto = document.getElementById('projetoSelect').value;
    
    if (!empresa) {
        alert('Por favor, selecione uma empresa primeiro');
        return;
    }
    
    if (!currentReportData) {
        alert('Nenhum relatório carregado. Por favor, selecione uma empresa e projeto.');
        return;
    }
    
    const btnExport = document.getElementById('btnExportPDF');
    const textoBotaoOriginal = btnExport.innerHTML;
    
    try {
        btnExport.disabled = true;
        btnExport.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Gerando PDF...';
        
        // Criar container temporário para gráficos com labels
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.visibility = 'hidden';
        document.body.appendChild(tempContainer);

        const chartsPNG = {};

        // Helper para renderizar um gráfico temporário e retornar dataURL
        async function renderTempChart(createChartFn, canvasWidth = 800, canvasHeight = 500) {
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            tempContainer.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            const chart = createChartFn(ctx);
            // Forçar render e esperar múltiplos frames + delay para garantir plugins executem e canvas renderize
            chart.update();
            await new Promise(r => setTimeout(r, 100)); // Esperar 100ms para renderização completa
            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => requestAnimationFrame(r));
            const dataUrl = canvas.toDataURL('image/png');
            chart.destroy();
            tempContainer.removeChild(canvas);
            return dataUrl;
        }

        // Função que cria os imagens (status + garagem) para um objeto de dados
        async function createChartsFromData(report) {
            const result = { statusColumn: null, garagemBar: null };

            // Status pie
            if (report && report.summary) {
                const counts = report.summary.status_counts || {};
                const rawData = [counts.online || 0, counts.atencao || 0, counts.alerta || 0, counts.inativo || 0, counts.manutencao || 0];
                const total = rawData.reduce((a, b) => a + b, 0);
                // Usar valores absolutos para gráfico com escala dinâmica
                const data = rawData;
                const labels = ['Online', 'Atenção', 'Alerta', 'Inativo', 'Manutenção'];
                const colors = ['#4CAF50', '#FFC107', '#F44336', '#9E9E9E', '#2196F3'];
                const borderColors = ['#66BB6A', '#FFD54F', '#EF5350', '#BDBDBD', '#42A5F5'];

                // Calcular escala dinâmica do eixo Y
                const maxValue = Math.max(...data, 1);
                const yMax = Math.ceil(maxValue * 1.15 / 10) * 10; // Arredonda para múltiplo de 10 com 15% margem

                const createStatusChart = (ctx) => new Chart(ctx, {
                    type: 'bar',
                    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: borderColors, borderWidth: 0 }] },
                    options: { 
                        responsive: false, 
                        maintainAspectRatio: false, 
                        plugins: { legend: { display: false }, tooltip: { enabled: false } }, 
                        scales: { 
                            x: { ticks: { color: '#000', font: { size: 12 } } }, 
                            y: { beginAtZero: true, min: 0, max: yMax, ticks: { color: '#000', stepSize: Math.ceil(yMax / 10), font: { size: 12 } } } 
                        } 
                    },
                    plugins: [
                        {
                            id: 'barDatalabels',
                            afterDatasetsDraw(chart) {
                                try {
                                    const { ctx, data } = chart;
                                    const meta = chart.getDatasetMeta(0);
                                    const dataset = data.datasets[0];
                                    ctx.save();
                                    ctx.font = 'bold 14px Arial';
                                    ctx.fillStyle = '#000';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'bottom';
                                    meta.data.forEach((bar, index) => {
                                        const value = dataset.data[index] || 0;
                                        if (value === 0) return;
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                        const x = bar.x;
                                        const y = bar.y - 8;
                                        ctx.fillText(`${value} (${percentage}%)`, x, y);
                                    });
                                    ctx.restore();
                                } catch (err) {
                                    // não bloquear a renderização por conta dos labels
                                    console.warn('Erro no plugin barDatalabels:', err);
                                }
                            }
                        }
                    ]
                });

                try {
                    result.statusColumn = await renderTempChart(createStatusChart, 1000, 600);
                } catch (e) {
                    console.warn('Erro ao renderizar statusColumn temporário:', e);
                }
            }

            // Garagem bar
            if (report && report.by_garagem && report.by_garagem.length) {
                const g = report.by_garagem.slice(0, 15); // Limite para melhor visualização
                const labels = g.map(x => x.garagem || 'N/D');
                
                // Usar valores absolutos
                const alerta = g.map(x => x.alerta || 0);
                const atencao = g.map(x => x.atencao || 0);
                const inativo = g.map(x => x.inativo || 0);
                const manutencao = g.map(x => x.manutencao || 0);
                
                // Calcular totais por garagem para porcentagens
                const totaisPorGaragem = g.map((item, idx) => 
                    (alerta[idx] || 0) + (atencao[idx] || 0) + (inativo[idx] || 0) + (manutencao[idx] || 0)
                );
                const maxTotal = Math.max(...totaisPorGaragem, 1);
                const xMax = Math.ceil(maxTotal * 1.15 / 5) * 5; // Arredonda para múltiplo de 5 com 15% margem

                const createGaragemChart = (ctx) => new Chart(ctx, {
                    type: 'bar',
                    data: { labels, datasets: [
                        { label: 'Alerta', data: alerta, backgroundColor: '#F44336' },
                        { label: 'Atenção', data: atencao, backgroundColor: '#FFC107' },
                        { label: 'Inativo', data: inativo, backgroundColor: '#9E9E9E' },
                        { label: 'Manutenção', data: manutencao, backgroundColor: '#2196F3' }
                    ] },
                    options: { indexAxis: 'y', responsive: false, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#000', font: { size: 13, weight: 'bold' } } }, tooltip: { enabled: false } }, scales: { x: { stacked: true, min: 0, max: xMax, ticks: { color: '#000', stepSize: Math.ceil(xMax / 10), font: { size: 12 } } }, y: { stacked: true, ticks: { color: '#000', font: { size: 11 } } } } },
                    plugins: [
                        {
                            id: 'barDatalabels',
                            afterDatasetsDraw(chart) {
                                try {
                                    const { ctx, data } = chart;
                                    const datasets = data.datasets;
                                    
                                    ctx.save();
                                    ctx.font = 'bold 11px Arial';
                                    ctx.fillStyle = '#fff';
                                    ctx.strokeStyle = '#000';
                                    ctx.lineWidth = 2;
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    
                                    // Desenhar rótulos para cada dataset (bar stack)
                                    datasets.forEach((dataset, datasetIndex) => {
                                        const meta = chart.getDatasetMeta(datasetIndex);
                                        meta.data.forEach((bar, index) => {
                                            const value = dataset.data[index] || 0;
                                            const totalGaragem = totaisPorGaragem[index] || 1;
                                            const percentage = ((value / totalGaragem) * 100).toFixed(1);
                                            if (value === 0) return; // Não desenhar se zero
                                            const barWidth = Math.abs(bar.width);
                                            // Só mostrar label se houver espaço (largura da barra > 25px)
                                            if (barWidth < 25) return;
                                            const x = bar.x;
                                            const y = bar.y;
                                            const text = `${value} (${percentage}%)`;
                                            ctx.strokeText(text, x, y);
                                            ctx.fillText(text, x, y);
                                        });
                                    });
                                    ctx.restore();
                                } catch (err) {
                                    console.warn('Erro no plugin barDatalabels garagem:', err);
                                }
                            }
                        }
                    ]
                });

                try {
                    result.garagemBar = await renderTempChart(createGaragemChart, 1200, 800);
                } catch (e) {
                    console.warn('Erro ao renderizar garagemBar temporário:', e);
                }
            }

            return result;
        }

        // Se nenhum projeto selecionado, gerar por projeto
        const reportsToSend = [];
        if (!projeto) {
            // coletar opções de projeto do select (exclui option vazia)
            const projetoSel = document.getElementById('projetoSelect');
            const projetos = Array.from(projetoSel.options).map(o => o.value).filter(v => v && v.trim());
            // buscar dados por projeto sequencialmente (limit to 10 to avoid overload)
            const projetosPara = projetos.slice(0, 10);
            for (const p of projetosPara) {
                const res = await fetch(`/api/reports/projeto?empresa_db=${encodeURIComponent(empresa)}&projeto=${encodeURIComponent(p)}`, { credentials: 'include' });
                if (!res.ok) continue;
                const json = await res.json();
                if (!json.success) continue;
                const imgs = await createChartsFromData(json);
                reportsToSend.push({ projeto: p, data: json, charts: imgs });
            }
            // also include aggregated 'todos'
            try {
                const resAll = await fetch(`/api/reports/projeto?empresa_db=${encodeURIComponent(empresa)}`, { credentials: 'include' });
                if (resAll.ok) {
                    const jsonAll = await resAll.json();
                    if (jsonAll.success) {
                        const imgsAll = await createChartsFromData(jsonAll);
                        reportsToSend.unshift({ projeto: 'Todos', data: jsonAll, charts: imgsAll });
                    }
                }
            } catch (e) { }
        } else {
            // single project - use currentReportData if available otherwise fetch
            let reportData = currentReportData;
            if (!reportData || (reportData.filters && reportData.filters.projeto !== projeto)) {
                const res = await fetch(`/api/reports/projeto?empresa_db=${encodeURIComponent(empresa)}&projeto=${encodeURIComponent(projeto)}`, { credentials: 'include' });
                if (res.ok) reportData = await res.json();
            }
            const imgs = await createChartsFromData(reportData);
            reportsToSend.push({ projeto: projeto || 'Todos', data: reportData, charts: imgs });
        }

        // atribuir chartsPNG para backend como array de reports
        chartsPNG.reports = reportsToSend;
        // limpar container
        try { document.body.removeChild(tempContainer); } catch (e) {}
        // Compatibilidade: expor as chaves antigas para backend que espera nome único
        if (chartsPNG.reports && chartsPNG.reports.length > 0) {
            const first = chartsPNG.reports[0].charts || {};
            chartsPNG.statusColumn = first.statusColumn || null;
            chartsPNG.garagemBar = first.garagemBar || null;
        }
        
        // Preparar dados para envio
        const dataExport = {
            empresa_db: empresa,
            projeto: projeto,
            summary: currentReportData.summary,
            by_garagem: currentReportData.by_garagem,
            offenders: currentReportData.offenders,
            charts: chartsPNG,
            timestamp: new Date().toISOString()
        };
        
        // Enviar para backend gerar PDF
        const response = await fetch('/api/reports/export-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(dataExport)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        // Baixar PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-${empresa}-${projeto || 'todos'}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✅ PDF exportado com sucesso');
        mostrarErro(''); // Limpar erros
        
    } catch (err) {
        console.error('❌ Erro ao exportar PDF:', err);
        mostrarErro(`Erro ao gerar PDF: ${err.message}`);
    } finally {
        btnExport.disabled = false;
        btnExport.innerHTML = textoBotaoOriginal;
    }
}

console.log('✅ reports.js carregado com sucesso');
