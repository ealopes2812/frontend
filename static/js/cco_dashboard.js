/**
 * CCO Operations Hub — Dashboard JavaScript
 * Conecta aos endpoints existentes do FastAPI para dados em tempo real.
 * Chart.js para gráficos, polling para atualização automática.
 */

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================
const CCO_CONFIG = {
    pollInterval: 30000,       // 30s entre atualizações
    chartColors: {
        primary:  'rgb(59, 130, 246)',
        success:  'rgb(52, 211, 153)',
        warning:  'rgb(245, 158, 11)',
        danger:   'rgb(239, 68, 68)',
        muted:    'rgb(124, 139, 161)',
        border:   'rgb(45, 53, 72)',
        cardBg:   'rgb(28, 35, 51)'
    },
};

let pieChart = null;
let lineChart = null;
let chamadosByUserChart = null;
let chamadosByDeptChart = null;
let statusByDeptPieChart = null;
let pollTimer = null;
let selectedCalendarDate = null;  // 'YYYY-MM-DD' or null for all tasks

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    loadAllData();
    pollTimer = setInterval(loadAllData, CCO_CONFIG.pollInterval);
});

async function loadAllData() {
    try {
        await Promise.all([
            loadDashboardStats(),
            loadChamadosStats(),
            loadChamadosStatsByUser(),
            loadChamadosByDepartment(),
            loadDailySnapshots()
        ]);
        updateTimestamp();
    } catch (err) {
        console.error('[CCO] Erro ao carregar dados:', err);
    }
}

function updateTimestamp() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        const now = new Date();
        el.textContent = 'Atualizado ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
}

// ============================================================================
// KPI CARDS — Dados de máquinas (Power BI) + Chamados
// ============================================================================
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        console.log('[CCO] Dashboard stats recebidos:', data);

        const counts = data.status_counts || {};
        const online = counts.online || 0;
        const atencao = counts.atencao || 0;
        const alerta = counts.alerta || 0;
        const inativo = counts.inativo || 0;
        const manutencao = counts.manutencao || 0;
        const divergencia = counts.divergencia || 0;
        const total = data.total_records || (online + atencao + alerta + inativo + manutencao + divergencia);

        console.log('[CCO] Contagens:', { online, atencao, alerta, inativo, manutencao, divergencia, total });

        // Se não há dados, mostrar estado "indisponível" em vez de zeros
        if (!total && !online && !alerta && !inativo && !manutencao) {
            setKpi('kpiOnline', '—', 'dados indisponíveis');
            setKpi('kpiAlertas', '—', 'dados indisponíveis');
            setKpi('kpiOffline', '—', 'dados indisponíveis');
            return;
        }

        setKpi('kpiOnline', online, `de ${total} total`);
        setKpi('kpiAlertas', alerta, atencao > 0 ? `${atencao} em atenção` : 'monitorando');
        setKpi('kpiOffline', inativo, divergencia > 0 ? `${divergencia} divergentes` : 'ação necessária');

        // Atualizar gráfico de linhas com dados resumidos (sem histórico de 7 dias)
        updateLineChartWithCurrent(online, alerta, inativo);
    } catch (err) {
        console.error('[CCO] Erro dashboard stats:', err);
        setKpi('kpiOnline', '—', 'erro');
        setKpi('kpiAlertas', '—', 'erro');
        setKpi('kpiOffline', '—', 'erro');
    }
}

async function loadChamadosStats() {
    try {
        const res = await fetch('/api/chamados/stats');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const total = data.total || 0;
        const abertos = data.abertos || 0;
        const emAndamento = data.em_andamento || 0;
        const pendentes = data.pendentes || 0;
        const resolvidos = data.resolvidos || 0;
        const ativos = abertos + emAndamento + pendentes;

        setKpi('kpiTotalChamados', total, `${ativos} ativos`);

        // Gráfico de pizza global — fonte única de verdade (sem duplicação por departamento)
        updatePieChart(resolvidos, abertos + emAndamento, pendentes);
    } catch (err) {
        console.error('[CCO] Erro chamados stats:', err);
        setKpi('kpiTotalChamados', '—', 'erro');
    }
}

async function loadChamadosStatsByUser() {
    try {
        const res = await fetch('/api/cco/chamados-stats-by-user');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const statsByUser = data.stats_by_user || [];
        updateChamadosByUserChart(statsByUser);
    } catch (err) {
        console.error('[CCO] Erro chamados stats por usuário:', err);
    }
}

function updateChamadosByUserChart(statsByUser) {
    const ctx = document.getElementById('chartChamadosByUser');
    if (!ctx) return;

    // Limitar a top 10 usuários
    const topUsers = statsByUser.slice(0, 10);
    const labels = topUsers.map(u => u.user_name || u.user_email.split('@')[0]);
    const totals = topUsers.map(u => u.total);

    const data = {
        labels: labels,
        datasets: [{
            label: 'Total de Chamados',
            data: totals,
            backgroundColor: CCO_CONFIG.chartColors.primary,
            borderColor: CCO_CONFIG.chartColors.primary,
            borderWidth: 1
        }]
    };

    const opts = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Gráfico horizontal
        scales: {
            x: {
                beginAtZero: true,
                grid: { color: 'rgba(45,53,72,0.5)', drawBorder: false },
                ticks: { color: CCO_CONFIG.chartColors.muted, font: { size: 12 } }
            },
            y: {
                grid: { display: false, drawBorder: false },
                ticks: { color: CCO_CONFIG.chartColors.muted, font: { size: 11 } }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            datalabels: {
                color: '#fff',
                anchor: 'end',
                align: 'right',
                font: { weight: 'bold', size: 11 },
                formatter: (value) => value > 0 ? value : ''
            },
            tooltip: {
                backgroundColor: CCO_CONFIG.chartColors.cardBg,
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: CCO_CONFIG.chartColors.border,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    afterLabel: function(context) {
                        const user = topUsers[context.dataIndex];
                        return [
                            `Abertos: ${user.abertos}`,
                            `Em Andamento: ${user.em_andamento}`,
                            `Pendentes: ${user.pendentes}`,
                            `Resolvidos: ${user.resolvidos}`
                        ];
                    }
                }
            }
        }
    };

    if (chamadosByUserChart) {
        chamadosByUserChart.data = data;
        chamadosByUserChart.update('none');
    } else {
        chamadosByUserChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: opts,
            plugins: [ChartDataLabels]
        });
    }
}

function setKpi(id, value, subtitle) {
    const valEl = document.getElementById(id);
    const subEl = document.getElementById(id + 'Sub');
    if (valEl) valEl.textContent = value;
    if (subEl) subEl.textContent = subtitle || '';
}

// ============================================================================
// GRÁFICO PIE — Chamados por Status
// ============================================================================
function updatePieChart(concluidos, abertos, pendentes) {
    const ctx = document.getElementById('chartPie');
    if (!ctx) return;

    const data = {
        labels: ['Resolvidos', 'Abertos', 'Pendentes'],
        datasets: [{
            data: [concluidos, abertos, pendentes],
            backgroundColor: [
                CCO_CONFIG.chartColors.success,
                CCO_CONFIG.chartColors.primary,
                CCO_CONFIG.chartColors.warning
            ],
            borderWidth: 0,
            spacing: 4
        }]
    };

    if (pieChart) {
        pieChart.data = data;
        pieChart.update('none');
    } else {
        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: CCO_CONFIG.chartColors.muted,
                            font: { size: 12, family: "'Inter', sans-serif" },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16
                        }
                    },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 14 },
                        formatter: (value, ctx) => {
                            const label = ctx.chart.data.labels[ctx.dataIndex];
                            return value > 0 ? `${value}` : '';
                        }
                    },
                    tooltip: {
                        backgroundColor: CCO_CONFIG.chartColors.cardBg,
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0',
                        borderColor: CCO_CONFIG.chartColors.border,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
}

// ============================================================================
// GRÁFICO LINHA — Máquinas (histórico real via snapshots diários)
// ============================================================================
let lastSnapshotData = null;

async function loadDailySnapshots() {
    try {
        const res = await fetch('/api/cco/daily-snapshots?days=30');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const snapshots = data.snapshots || [];
        lastSnapshotData = snapshots;
        
        if (snapshots.length === 0) {
            // Sem dados históricos ainda, usar dados atuais
            return;
        }
        
        // Pegar últimos 7 dias (ou menos se não houver)
        const recent = snapshots.slice(-7);
        
        const labels = recent.map(s => {
            const d = new Date(s.snapshot_date + 'T00:00:00');
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        const onlineData = recent.map(s => s.online_count || 0);
        const alertaData = recent.map(s => (s.alerta_count || 0));
        const inativasData = recent.map(s => s.inativo_count || 0);
        
        updateLineChartWithHistory(labels, onlineData, alertaData, inativasData);
    } catch (err) {
        console.error('[CCO] Erro ao carregar snapshots:', err);
    }
}

function updateLineChartWithHistory(labels, onlineData, alertaData, inativasData) {
    const ctx = document.getElementById('chartLine');
    if (!ctx) return;

    const data = {
        labels: labels,
        datasets: [
            {
                label: 'Online',
                data: onlineData,
                borderColor: CCO_CONFIG.chartColors.success,
                backgroundColor: 'rgba(52, 211, 153, 0.05)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true
            },
            {
                label: 'Alerta',
                data: alertaData,
                borderColor: CCO_CONFIG.chartColors.warning,
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true
            },
            {
                label: 'Inativas',
                data: inativasData,
                borderColor: CCO_CONFIG.chartColors.danger,
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true
            }
        ]
    };

    const opts = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
            x: {
                grid: { color: 'rgba(45,53,72,0.5)', drawBorder: false },
                ticks: { color: CCO_CONFIG.chartColors.muted, font: { size: 12 } }
            },
            y: {
                grid: { color: 'rgba(45,53,72,0.5)', drawBorder: false },
                ticks: { color: CCO_CONFIG.chartColors.muted, font: { size: 12 } },
                beginAtZero: true
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: CCO_CONFIG.chartColors.muted,
                    font: { size: 12, family: "'Inter', sans-serif" },
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 16
                }
            },
            tooltip: {
                backgroundColor: CCO_CONFIG.chartColors.cardBg,
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: CCO_CONFIG.chartColors.border,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12
            }
        }
    };

    if (lineChart) {
        lineChart.data = data;
        lineChart.update('none');
    } else {
        lineChart = new Chart(ctx, { type: 'line', data, options: opts });
    }
}

function updateLineChartWithCurrent(online, alerta, inativas) {
    // Se já temos dados históricos, não sobrescrever
    if (lastSnapshotData && lastSnapshotData.length > 0) return;
    
    const ctx = document.getElementById('chartLine');
    if (!ctx) return;

    // Sem histórico — mostrar dado atual como ponto único
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    updateLineChartWithHistory([today], [online], [alerta], [inativas]);
}

function exportHistoryXLS() {
    // Abrir diálogo de período ou exportar últimos 30 dias
    const days = prompt('Exportar histórico dos últimos quantos dias? (padrão: 30)', '30');
    if (days === null) return;
    const numDays = parseInt(days) || 30;
    window.open(`/api/cco/daily-snapshots/export?days=${numDays}`, '_blank');
}

// ============================================================================
// CALENDÁRIO MINI
// ============================================================================
let calendarReminders = {};

async function initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const today = now.getDate();

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const titleEl = document.getElementById('calendarTitle');
    if (titleEl) titleEl.textContent = `Agenda — ${monthNames[month]} ${year}`;

    // Carregar lembretes do mês
    try {
        const res = await fetch(`/api/cco/calendar-reminders?month=${month + 1}&year=${year}`);
        const data = await res.json();
        calendarReminders = {};
        (data.reminders || []).forEach(r => {
            const date = new Date(r.reminder_date + 'T00:00:00');
            const day = date.getDate();
            if (!calendarReminders[day]) calendarReminders[day] = [];
            calendarReminders[day].push(r);
        });
    } catch (err) {
        console.error('[CCO] Erro ao carregar lembretes:', err);
    }

    const firstDay = new Date(year, month, 1).getDay(); // 0=Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const headers = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    let html = '';
    // Headers
    headers.forEach(h => {
        html += `<div class="cco-calendar-header">${h}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cco-calendar-day day-empty"></div>';
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today;
        const hasReminders = calendarReminders[d] && calendarReminders[d].length > 0;
        const reminderCount = hasReminders ? calendarReminders[d].length : 0;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedCalendarDate === dateStr;
        const cls = [isToday ? 'day-today' : '', hasReminders ? 'day-has-reminders' : '', isSelected ? 'day-selected' : ''].filter(Boolean).join(' ');
        
        html += `<div class="cco-calendar-day ${cls}" 
                     onclick="selectCalendarDay('${dateStr}', ${d}, this)" 
                     title="${hasReminders ? reminderCount + ' lembrete(s)' : 'Selecionar dia'}">
            ${d}
            ${hasReminders ? `<span class="reminder-badge">${reminderCount}</span>` : ''}
        </div>`;
    }

    grid.innerHTML = html;

    // Mostrar lembretes do dia selecionado ou do dia atual
    const activeDay = selectedCalendarDate ? parseInt(selectedCalendarDate.split('-')[2], 10) : today;
    updateCalendarEvents(activeDay);
}

function updateCalendarEvents(day) {
    const eventsEl = document.getElementById('calendarEvents');
    if (!eventsEl) return;
    
    const reminders = calendarReminders[day] || [];
    
    // Reconstruct dateStr for the reminder button
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const dateStr = selectedCalendarDate || `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    let html = '';
    if (reminders.length === 0) {
        html += '<div style="text-align:center;color:var(--cco-text-muted);padding:12px;font-size:0.85rem;">Nenhum lembrete para este dia</div>';
    } else {
        reminders.forEach(r => {
            html += `
                <div class="cco-calendar-event" onclick="deleteReminder(${r.id}, event)">
                    <div class="event-dot dot-primary"></div>
                    <span>${escapeHtml(r.title)}</span>
                    <button style="background:none;border:none;color:var(--cco-text-muted);cursor:pointer;margin-left:auto;" title="Excluir">
                        <i class="bi bi-x"></i>
                    </button>
                </div>`;
        });
    }
    
    // Add manage reminders button
    html += `<div style="text-align:center;padding:8px 0;border-top:1px solid var(--cco-border, #2d3548);margin-top:8px;">
        <button onclick="showReminderModal('${dateStr}', ${day})" style="background:none;border:none;color:var(--cco-primary);cursor:pointer;font-size:0.8rem;">
            <i class="bi bi-calendar-plus"></i> Gerenciar Lembretes
        </button>
    </div>`;
    
    eventsEl.innerHTML = html;
}

// ============================================================================
// CALENDAR SELECTION
// ============================================================================
function selectCalendarDay(dateStr, day, el) {
    // Toggle: clicking the same day again deselects
    if (selectedCalendarDate === dateStr) {
        clearCalendarFilter();
        return;
    }
    
    selectedCalendarDate = dateStr;
    
    // Highlight selected day
    document.querySelectorAll('.cco-calendar-day').forEach(d => d.classList.remove('day-selected'));
    if (el) el.classList.add('day-selected');
    
    // Update calendar events (reminders for this day)
    updateCalendarEvents(day);
}

function clearCalendarFilter() {
    selectedCalendarDate = null;
    
    // Remove day selection highlight
    document.querySelectorAll('.cco-calendar-day').forEach(d => d.classList.remove('day-selected'));
    
    // Show today's reminders
    updateCalendarEvents(new Date().getDate());
}

function showReminderModal(dateStr, day) {
    const dateObj = new Date(dateStr + 'T00:00:00');
    const title = `Lembretes — ${day}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
    document.getElementById('reminderModalTitle').textContent = title;
    document.getElementById('reminderForm').reset();
    document.getElementById('reminderId').value = '';
    document.getElementById('reminderDate').value = dateStr;
    
    // Mostrar lembretes existentes deste dia
    const reminders = calendarReminders[day] || [];
    const listEl = document.getElementById('reminderExistingList');
    
    if (reminders.length > 0) {
        let html = '';
        reminders.forEach(r => {
            html += `
                <div class="cco-reminder-item" style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem;background:var(--cco-bg);border-radius:8px;margin-bottom:0.5rem;border:1px solid var(--cco-border);">
                    <div class="event-dot dot-primary" style="margin-top:5px;"></div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;color:var(--cco-text);margin-bottom:2px;">${escapeHtml(r.title)}</div>
                        ${r.description ? `<div style="font-size:0.8rem;color:var(--cco-text-muted);white-space:pre-wrap;word-break:break-word;">${escapeHtml(r.description)}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:0.25rem;flex-shrink:0;">
                        <button onclick="editReminderFromModal(${r.id}, '${escapeHtml(r.title).replace(/'/g, "\\'")}', '${(r.description || '').replace(/'/g, "\\'").replace(/\n/g, "\\n")}', '${dateStr}')" 
                                style="background:none;border:none;color:var(--cco-accent);cursor:pointer;padding:4px;" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button onclick="deleteReminderFromModal(${r.id})" 
                                style="background:none;border:none;color:var(--cco-danger, #ef4444);cursor:pointer;padding:4px;" title="Excluir">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>`;
        });
        listEl.innerHTML = html;
        listEl.style.display = 'block';
    } else {
        listEl.innerHTML = '<div style="text-align:center;color:var(--cco-text-muted);padding:0.75rem;font-size:0.85rem;">Nenhum lembrete neste dia</div>';
        listEl.style.display = 'block';
    }
    
    // Esconder formulário de criação, mostrar botão "Novo"
    document.getElementById('reminderFormWrap').style.display = 'none';
    document.getElementById('reminderNewBtnWrap').style.display = 'block';
    
    document.getElementById('reminderModal').style.display = 'flex';
}

function showReminderForm() {
    document.getElementById('reminderFormWrap').style.display = 'block';
    document.getElementById('reminderNewBtnWrap').style.display = 'none';
    document.getElementById('reminderId').value = '';
    document.getElementById('reminderTitle').value = '';
    document.getElementById('reminderDescription').value = '';
    document.getElementById('reminderTitle').focus();
}

function hideReminderForm() {
    document.getElementById('reminderFormWrap').style.display = 'none';
    document.getElementById('reminderNewBtnWrap').style.display = 'block';
}

function editReminderFromModal(id, title, description, dateStr) {
    document.getElementById('reminderId').value = id;
    document.getElementById('reminderDate').value = dateStr;
    document.getElementById('reminderTitle').value = title;
    document.getElementById('reminderDescription').value = description.replace(/\\n/g, '\n');
    document.getElementById('reminderFormWrap').style.display = 'block';
    document.getElementById('reminderNewBtnWrap').style.display = 'none';
    document.getElementById('reminderTitle').focus();
}

async function deleteReminderFromModal(reminderId) {
    if (!confirm('Tem certeza que deseja excluir este lembrete?')) return;
    try {
        const res = await fetch(`/api/cco/calendar-reminders/${reminderId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        closeReminderModal();
        initCalendar();
    } catch (err) {
        console.error('[CCO] Erro ao excluir lembrete:', err);
        alert('Erro ao excluir lembrete. Tente novamente.');
    }
}

function closeReminderModal() {
    document.getElementById('reminderModal').style.display = 'none';
}

async function saveReminder(event) {
    event.preventDefault();
    const reminderId = document.getElementById('reminderId').value;
    const reminderData = {
        title: document.getElementById('reminderTitle').value,
        description: document.getElementById('reminderDescription').value,
        reminder_date: document.getElementById('reminderDate').value
    };
    
    try {
        const url = reminderId ? `/api/cco/calendar-reminders/${reminderId}` : '/api/cco/calendar-reminders';
        const method = reminderId ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reminderData)
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        closeReminderModal();
        initCalendar();
    } catch (err) {
        console.error('[CCO] Erro ao salvar lembrete:', err);
        alert('Erro ao salvar lembrete. Tente novamente.');
    }
}

async function deleteReminder(reminderId, event) {
    event.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este lembrete?')) return;
    
    try {
        const res = await fetch(`/api/cco/calendar-reminders/${reminderId}`, {
            method: 'DELETE'
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        initCalendar();
    } catch (err) {
        console.error('[CCO] Erro ao excluir lembrete:', err);
        alert('Erro ao excluir lembrete. Tente novamente.');
    }
}

// ============================================================================
// CHAT WIDGET (integração com chat existente)
// ============================================================================
let chatOpen = false;

function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chatPanel');
    const chevron = document.getElementById('chatChevron');
    if (panel) panel.classList.toggle('open', chatOpen);
    if (chevron) {
        chevron.className = chatOpen ? 'bi bi-chevron-down' : 'bi bi-chevron-up';
    }

    // Abrir chat completo em vez de carregar mensagens inline
    if (chatOpen) {
        // Redirecionar para a página de chat do sistema
        window.open('/chamados#chat', '_blank');
        chatOpen = false;
        if (panel) panel.classList.remove('open');
        if (chevron) chevron.className = 'bi bi-chevron-up';
    }
}

function sendChatMsg() {
    // Redirecionar para o chat completo do sistema
    window.open('/chamados#chat', '_blank');
}

// ============================================================================
// DEPARTAMENTO FILTER + GRÁFICOS POR DEPARTAMENTO
// ============================================================================
let _allDeptStats = [];       // dados brutos do endpoint
let _selectedDepts = [];      // departamentos selecionados no filtro

function _getSelectedDepts() {
    const sel = document.getElementById('deptFilter');
    if (!sel) return [];
    return Array.from(sel.selectedOptions).map(o => o.value);
}

function _filterDeptStats(stats) {
    if (!_selectedDepts.length) return stats;
    return stats.filter(d => _selectedDepts.includes(d.departamento));
}

function clearDeptFilter() {
    const sel = document.getElementById('deptFilter');
    if (sel) {
        Array.from(sel.options).forEach(o => o.selected = false);
    }
    _selectedDepts = [];
    _applyDeptFilter();
}

function _onDeptFilterChange() {
    _selectedDepts = _getSelectedDepts();
    _applyDeptFilter();
}

function _applyDeptFilter() {
    const filtered = _filterDeptStats(_allDeptStats);
    updateChamadosByDeptChart(filtered);
    // Atualizar o seletor do gráfico de pizza por departamento
    _populateDeptPieSelector(filtered);
    updateStatusPieFromSelector();
}

function _populateDeptFilter(stats) {
    const sel = document.getElementById('deptFilter');
    if (!sel) return;
    const prevSelected = new Set(_selectedDepts);
    sel.innerHTML = '';
    stats.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.departamento;
        opt.textContent = `${d.departamento} (${d.recebidos || d.total})`;
        if (prevSelected.has(d.departamento)) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.removeEventListener('change', _onDeptFilterChange);
    sel.addEventListener('change', _onDeptFilterChange);
}

function _populateDeptPieSelector(stats) {
    const sel = document.getElementById('deptPieSelector');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const list = stats.length ? stats : _allDeptStats;
    list.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.departamento;
        opt.textContent = d.departamento;
        sel.appendChild(opt);
    });
    // Restaurar seleção anterior se ainda existir
    if (prev && Array.from(sel.options).some(o => o.value === prev)) {
        sel.value = prev;
    }
}

async function loadChamadosByDepartment() {
    try {
        const res = await fetch('/api/cco/chamados-stats-by-department');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        _allDeptStats = data.stats_by_department || [];
        _populateDeptFilter(_allDeptStats);
        
        const filtered = _filterDeptStats(_allDeptStats);
        updateChamadosByDeptChart(filtered);
        _populateDeptPieSelector(filtered);
        updateStatusPieFromSelector();
    } catch (err) {
        console.error('[CCO] Erro chamados por departamento:', err);
    }
}

function updateChamadosByDeptChart(statsByDept) {
    const ctx = document.getElementById('chartChamadosByDept');
    if (!ctx) return;

    const labels = statsByDept.map(d => d.departamento || 'Sem Depto');
    const recebidos = statsByDept.map(d => d.recebidos || d.total);

    const data = {
        labels: labels,
        datasets: [{
            label: 'Chamados Recebidos',
            data: recebidos,
            backgroundColor: CCO_CONFIG.chartColors.primary,
            borderColor: CCO_CONFIG.chartColors.primary,
            borderWidth: 1
        }]
    };

    const opts = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(45,53,72,0.5)', drawBorder: false },
                ticks: { color: CCO_CONFIG.chartColors.muted, font: { size: 12 } }
            },
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { color: CCO_CONFIG.chartColors.muted, font: { size: 11 } }
            }
        },
        plugins: {
            legend: { display: false },
            datalabels: {
                color: '#fff',
                anchor: 'end',
                align: 'top',
                font: { weight: 'bold', size: 12 }
            },
            tooltip: {
                backgroundColor: CCO_CONFIG.chartColors.cardBg,
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: CCO_CONFIG.chartColors.border,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    afterLabel: function(context) {
                        const d = statsByDept[context.dataIndex];
                        return [
                            `Abertos: ${d.abertos || 0}`,
                            `Em Andamento: ${d.em_andamento || 0}`,
                            `Pendentes: ${d.pendentes || 0}`,
                            `Respondidos: ${d.respondidos || 0}`,
                            `Resolvidos: ${(d.resolvidos || 0) + (d.concluidos || 0)}`
                        ];
                    }
                }
            }
        }
    };

    if (chamadosByDeptChart) {
        chamadosByDeptChart.data = data;
        chamadosByDeptChart.update('none');
    } else {
        chamadosByDeptChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: opts,
            plugins: [ChartDataLabels]
        });
    }
}

// Gráfico de PIZZA — Status por departamento (um departamento por vez)
function updateStatusPieFromSelector() {
    const sel = document.getElementById('deptPieSelector');
    if (!sel || !sel.value) return;
    const deptName = sel.value;
    const deptData = _allDeptStats.find(d => d.departamento === deptName);
    if (!deptData) return;
    updateStatusByDeptPieChart(deptData);
}

function updateStatusByDeptPieChart(deptData) {
    const ctx = document.getElementById('chartStatusByDeptPie');
    if (!ctx) return;

    const statusLabels = ['Abertos', 'Em Andamento', 'Pendentes', 'Respondidos', 'Resolvidos'];
    const statusValues = [
        deptData.abertos || 0,
        deptData.em_andamento || 0,
        deptData.pendentes || 0,
        deptData.respondidos || 0,
        (deptData.resolvidos || 0) + (deptData.concluidos || 0)
    ];
    const statusColors = [
        'rgb(99, 102, 241)',
        CCO_CONFIG.chartColors.primary,
        CCO_CONFIG.chartColors.warning,
        'rgb(168, 85, 247)',
        CCO_CONFIG.chartColors.success
    ];

    // Filtrar segmentos com valor 0 para não poluir
    const filtered = statusLabels.map((l, i) => ({ label: l, value: statusValues[i], color: statusColors[i] }))
        .filter(s => s.value > 0);

    const data = {
        labels: filtered.map(s => s.label),
        datasets: [{
            data: filtered.map(s => s.value),
            backgroundColor: filtered.map(s => s.color),
            borderWidth: 0,
            spacing: 4
        }]
    };

    const opts = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '45%',
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: CCO_CONFIG.chartColors.muted,
                    font: { size: 12, family: "'Inter', sans-serif" },
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 12
                }
            },
            datalabels: {
                color: '#fff',
                font: { weight: 'bold', size: 13 },
                formatter: (value) => value > 0 ? value : ''
            },
            tooltip: {
                backgroundColor: CCO_CONFIG.chartColors.cardBg,
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: CCO_CONFIG.chartColors.border,
                borderWidth: 1,
                cornerRadius: 8,
                padding: 12,
                callbacks: {
                    label: function(context) {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? Math.round(context.raw / total * 100) : 0;
                        return ` ${context.label}: ${context.raw} (${pct}%)`;
                    }
                }
            }
        }
    };

    if (statusByDeptPieChart) {
        statusByDeptPieChart.data = data;
        statusByDeptPieChart.update('none');
    } else {
        statusByDeptPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: opts,
            plugins: [ChartDataLabels]
        });
    }
}

// ============================================================================
// EXPORTAR DASHBOARD COMO PDF (COM GRÁFICOS — ALTA QUALIDADE)
// ============================================================================
async function exportDashboardPDF() {
    try {
        const btn = event.target.closest('button');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Gerando PDF com gráficos...';
        btn.disabled = true;

        // Capturar imagens em alta resolução (DPI 2x)
        const charts = {};
        const dpr = 2;
        
        function captureHighRes(chartInstance) {
            if (!chartInstance) return null;
            try {
                return chartInstance.toBase64Image('image/png', dpr);
            } catch(e) {
                console.warn('Erro capturando chart:', e);
                return null;
            }
        }
        
        if (pieChart) charts.chartPie = captureHighRes(pieChart);
        if (chamadosByUserChart) charts.chartChamadosByUser = captureHighRes(chamadosByUserChart);
        if (chamadosByDeptChart) charts.chartChamadosByDept = captureHighRes(chamadosByDeptChart);
        if (statusByDeptPieChart) charts.chartStatusByDeptPie = captureHighRes(statusByDeptPieChart);
        if (lineChart) charts.chartLine = captureHighRes(lineChart);

        console.log('[CCO] Gráficos capturados:', Object.keys(charts).length);

        const res = await fetch('/api/cco/export-dashboard-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ charts: charts })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-cco-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        btn.innerHTML = originalHtml;
        btn.disabled = false;
    } catch (err) {
        console.error('[CCO] Erro ao exportar PDF:', err);
        alert('Erro ao gerar PDF. Tente novamente.');
        const btn = event.target.closest('button');
        btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Exportar PDF';
        btn.disabled = false;
    }
}

// ============================================================================
// TOP NAV & MOBILE
// ============================================================================
function toggleSidebar() {
    // Legacy — no-op (sidebar removed, topnav handles its own toggle)
}

// Fechar topnav mobile ao clicar fora
document.addEventListener('click', (e) => {
    const nav = document.getElementById('ccoTopnav');
    if (nav && nav.classList.contains('open') && !nav.contains(e.target)) {
        nav.classList.remove('open');
    }
});

// ============================================================================
// UTIL
// ============================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
