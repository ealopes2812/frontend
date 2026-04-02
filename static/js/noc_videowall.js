/* ============================================================================
   NOC VIDEO WALL — Real-time data fetching & Chart.js rendering
   Revised layout: 6 screens — polls every 30 seconds
   ============================================================================ */

(function () {
    'use strict';

    // ---- Configuration ----
    const POLL_INTERVAL = 30000;
    const CHART_FONT_COLOR = '#c8d6e5';
    const GRID_COLOR = 'rgba(26, 35, 64, .6)';
    const COLORS = {
        green: '#00ff88',
        greenBg: 'rgba(0,255,136,.15)',
        amber: '#ffaa00',
        amberBg: 'rgba(255,170,0,.15)',
        red: '#ff3355',
        redBg: 'rgba(255,51,85,.15)',
        cyan: '#00d4ff',
        cyanBg: 'rgba(0,212,255,.12)',
        purple: '#a855f7',
        purpleBg: 'rgba(168,85,247,.12)',
        dimText: '#576574'
    };

    // ---- Chart.js global defaults ----
    Chart.defaults.color = CHART_FONT_COLOR;
    Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.padding = 6;
    Chart.defaults.animation.duration = 600;

    // Register datalabels plugin
    Chart.register(ChartDataLabels);

    // ---- Chart instances ----
    let chartMachineHistory = null;

    // ============================================================================
    // CLOCKS
    // ============================================================================
    function updateClocks() {
        const now = new Date();
        document.getElementById('clockLocal').textContent =
            now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('clockUTC').textContent =
            now.toUTCString().slice(17, 25);
    }
    setInterval(updateClocks, 1000);
    updateClocks();

    // ============================================================================
    // DATA FLOW DOTS (Screen 5 animation)
    // ============================================================================
    function initDataFlow() {
        const container = document.getElementById('dataFlow');
        if (!container) return;
        for (let i = 0; i < 18; i++) {
            const dot = document.createElement('div');
            dot.className = 'data-dot';
            dot.style.left = (Math.random() * 100) + '%';
            dot.style.animationDuration = (3 + Math.random() * 5) + 's';
            dot.style.animationDelay = (Math.random() * 6) + 's';
            container.appendChild(dot);
        }
    }
    initDataFlow();

    // ============================================================================
    // FETCH HELPERS
    // ============================================================================
    async function fetchJSON(url) {
        try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    // ============================================================================
    // LEFT COLUMN — PROJECT HEALTH LIST
    // ============================================================================
    function updateProjectHealth(projects) {
        const container = document.getElementById('projectHealthList');
        if (!container || !projects || !Array.isArray(projects)) return;

        container.innerHTML = projects.map((p, i) => {
            const total = p.total || 1;
            const onPct = Math.round((p.online || 0) / total * 100);
            const atPct = Math.round((p.atencao || 0) / total * 100);
            const alPct = Math.round((p.alerta || 0) / total * 100);
            const inPct = Math.round((p.inativo || 0) / total * 100);
            const dvPct = Math.max(0, 100 - onPct - atPct - alPct - inPct);
            const hp = p.health_pct != null ? p.health_pct : onPct;

            let cls = '';
            if (hp <= 49) cls = 'health-danger';
            else if (hp <= 69) cls = 'health-warning';

            let pctColor = COLORS.green;
            if (hp <= 49) pctColor = COLORS.red;
            else if (hp <= 69) pctColor = COLORS.amber;

            return '<div class="project-health-item ' + cls + '">' +
                '<div class="project-rank">' + (i + 1) + '</div>' +
                '<div class="project-info">' +
                    '<div class="project-name" title="' + escapeHtml(p.projeto) + '">' + escapeHtml(p.projeto) + '</div>' +
                    '<div class="project-bar-track">' +
                        '<div class="project-bar-online" style="width:' + onPct + '%"></div>' +
                        '<div class="project-bar-atencao" style="width:' + atPct + '%"></div>' +
                        '<div class="project-bar-alert" style="width:' + alPct + '%"></div>' +
                        '<div class="project-bar-offline" style="width:' + inPct + '%"></div>' +
                        '<div class="project-bar-divergente" style="width:' + dvPct + '%"></div>' +
                    '</div>' +
                    '<div class="project-stats">' +
                        '<span class="color-green">' + (p.online || 0) + ' Online</span> ' +
                        '<span class="color-amber">' + (p.atencao || 0) + ' Atenção</span> ' +
                        '<span class="color-red">' + (p.alerta || 0) + ' Alerta</span> ' +
                        '<span style="color:#8395a7">' + (p.inativo || 0) + ' Inativos</span> ' +
                        '<span class="color-purple">' + (p.divergencia || 0) + ' Divergentes</span>' +
                    '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="project-pct" style="color:' + pctColor + '">' + hp + '%</div>' +
                    '<div class="project-total">' + total + ' equip</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ============================================================================
    // SCREEN 5 — HEALTH SCORE + KPIs
    // ============================================================================
    function updateHealthScore(stats) {
        if (!stats) return;
        const counts = stats.status_counts || {};
        const total = stats.total_records || 0;
        const online = counts.online || 0;
        const pct = total > 0 ? Math.round((online / total) * 100) : 0;

        // Total de máquinas abaixo do título
        document.getElementById('healthTotal').textContent = total.toLocaleString('pt-BR') + ' máquinas';

        const pctEl = document.getElementById('healthPct');
        pctEl.textContent = pct + '%';

        const ring = document.getElementById('healthRing');
        const circumference = 326.73;
        const offset = circumference - (circumference * pct / 100);
        ring.style.strokeDashoffset = offset;

        if (pct >= 90) {
            pctEl.style.color = COLORS.green;
            pctEl.style.textShadow = '0 0 20px ' + COLORS.greenBg + ', 0 0 40px ' + COLORS.greenBg;
            ring.style.stroke = COLORS.green;
        } else if (pct >= 70) {
            pctEl.style.color = COLORS.amber;
            pctEl.style.textShadow = '0 0 20px ' + COLORS.amberBg;
            ring.style.stroke = COLORS.amber;
        } else {
            pctEl.style.color = COLORS.red;
            pctEl.style.textShadow = '0 0 20px ' + COLORS.redBg;
            ring.style.stroke = COLORS.red;
        }

        document.getElementById('kpiOnline').textContent = online.toLocaleString('pt-BR');
        document.getElementById('kpiAtencao').textContent = (counts.atencao || 0).toLocaleString('pt-BR');
        document.getElementById('kpiAlerta').textContent = (counts.alerta || 0).toLocaleString('pt-BR');
        document.getElementById('kpiManutencao').textContent = (counts.manutencao || 0).toLocaleString('pt-BR');
        document.getElementById('kpiInativo').textContent = (counts.inativo || 0).toLocaleString('pt-BR');
        document.getElementById('kpiDivergente').textContent = (counts.divergencia || 0).toLocaleString('pt-BR');
        document.getElementById('kpiSinistro').textContent = (counts.sinistro || 0).toLocaleString('pt-BR');
    }

    // ============================================================================
    // SCREEN 6 — STATUS DE CHAMADOS (ring like health score)
    // ============================================================================
    function updateChamadosRing(chamadoStats) {
        if (!chamadoStats) return;

        const total = chamadoStats.total || 0;
        const resolvidos = chamadoStats.resolvidos || 0;
        const pct = total > 0 ? Math.round((resolvidos / total) * 100) : 0;

        const pctEl = document.getElementById('chamadosPct');
        pctEl.textContent = total;

        const ring = document.getElementById('chamadosRing');
        const circumference = 326.73;
        const offset = circumference - (circumference * pct / 100);
        ring.style.strokeDashoffset = offset;

        // Color based on resolution rate
        if (pct >= 70) {
            ring.style.stroke = COLORS.green;
        } else if (pct >= 40) {
            ring.style.stroke = COLORS.cyan;
        } else {
            ring.style.stroke = COLORS.red;
        }

        document.getElementById('kpiChamadosAbertos').textContent =
            (chamadoStats.abertos || 0).toLocaleString('pt-BR');
        document.getElementById('kpiChamadosAndamento').textContent =
            (chamadoStats.em_andamento || 0).toLocaleString('pt-BR');
        document.getElementById('kpiChamadosPendentes').textContent =
            (chamadoStats.pendentes || 0).toLocaleString('pt-BR');
        document.getElementById('kpiChamadosResolvidos').textContent =
            (chamadoStats.resolvidos || 0).toLocaleString('pt-BR');
    }

    // ============================================================================
    // ============================================================================
    // SCREEN 3 — SLA DOS CHAMADOS
    // ============================================================================
    function updateSLAPanel(chamadoStats) {
        if (!chamadoStats) return;

        const tempoMedio = chamadoStats.tempo_medio_horas;
        const el = document.getElementById('slaTempoMedio');
        if (el) {
            if (tempoMedio != null) {
                if (tempoMedio >= 24) {
                    const dias = Math.floor(tempoMedio / 24);
                    const horas = Math.round(tempoMedio % 24);
                    el.textContent = dias + 'd ' + horas + 'h';
                } else {
                    el.textContent = tempoMedio.toFixed(1) + 'h';
                }
            } else {
                el.textContent = '--';
            }
        }

        const setCnt = (id, val) => {
            const e = document.getElementById(id);
            if (e) e.textContent = (val || 0).toLocaleString('pt-BR');
        };
        setCnt('slaCumprido', chamadoStats.sla_cumprido);
        setCnt('slaExcedido', chamadoStats.sla_excedido);
        setCnt('slaTotal', chamadoStats.total);
        setCnt('slaAbertos', (chamadoStats.abertos || 0) + (chamadoStats.em_andamento || 0) + (chamadoStats.pendentes || 0));
    }

    // ============================================================================
    // BOTTOM — HISTÓRICO DE MÁQUINAS (Line chart — 7 days)
    // ============================================================================
    function updateMachineHistoryChart(snapshots) {
        if (!snapshots || !Array.isArray(snapshots)) return;
        const ctx = document.getElementById('chartMachineHistory');
        if (!ctx) return;

        // Use last 7 entries (daily snapshots)
        const recent = snapshots.slice(-7);
        const labels = recent.map(s => {
            const d = s.snapshot_date || s.date || '';
            if (d.length >= 10) {
                const parts = d.slice(0, 10).split('-');
                return parts[2] + '/' + parts[1];
            }
            return d;
        });
        const onlineData = recent.map(s => s.online_count || 0);
        const alertaData = recent.map(s => s.alerta_count || 0);
        const inativasData = recent.map(s => s.inativo_count || 0);

        if (chartMachineHistory) {
            chartMachineHistory.data.labels = labels;
            chartMachineHistory.data.datasets[0].data = onlineData;
            chartMachineHistory.data.datasets[1].data = alertaData;
            chartMachineHistory.data.datasets[2].data = inativasData;
            chartMachineHistory.update('none');
            return;
        }

        chartMachineHistory = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Online',
                        data: onlineData,
                        borderColor: COLORS.green,
                        backgroundColor: COLORS.greenBg,
                        fill: true,
                        tension: .3,
                        pointRadius: 3,
                        pointBackgroundColor: COLORS.green,
                        borderWidth: 2
                    },
                    {
                        label: 'Alerta',
                        data: alertaData,
                        borderColor: COLORS.amber,
                        backgroundColor: COLORS.amberBg,
                        fill: true,
                        tension: .3,
                        pointRadius: 3,
                        pointBackgroundColor: COLORS.amber,
                        borderWidth: 2
                    },
                    {
                        label: 'Inativas',
                        data: inativasData,
                        borderColor: COLORS.red,
                        backgroundColor: COLORS.redBg,
                        fill: true,
                        tension: .3,
                        pointRadius: 3,
                        pointBackgroundColor: COLORS.red,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { font: { size: 10 }, padding: 8 }
                    },
                    tooltip: {
                        backgroundColor: '#0d1321',
                        borderColor: '#1a2340',
                        borderWidth: 1,
                        titleColor: COLORS.cyan,
                        bodyColor: CHART_FONT_COLOR
                    },
                    datalabels: {
                        color: function(ctx) {
                            return ctx.dataset.borderColor;
                        },
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        font: { size: 10, weight: '700', family: "'JetBrains Mono', monospace" },
                        formatter: function(value) {
                            if (value == null) return '';
                            return value.toLocaleString('pt-BR');
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: GRID_COLOR },
                        ticks: { font: { size: 10, weight: '600' } }
                    },
                    y: {
                        grid: { color: GRID_COLOR },
                        beginAtZero: true,
                        ticks: { font: { size: 9 } }
                    }
                }
            }
        });
    }

    // ============================================================================
    // SCREEN 2 — ALERTS FEED
    // ============================================================================
    function updateAlertsFeed(dashStats, chamadoStats) {
        const container = document.getElementById('alertsFeed');
        if (!container) return;

        const alerts = [];
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (dashStats) {
            const counts = dashStats.status_counts || {};
            if ((counts.alerta || 0) > 0) {
                alerts.push({ level: 'critical', msg: counts.alerta + ' equipamento(s) em ALERTA critico', time: timeStr });
            }
            if ((counts.atencao || 0) > 0) {
                alerts.push({ level: 'warning', msg: counts.atencao + ' equipamento(s) em ATENCAO', time: timeStr });
            }
            if ((counts.inativo || 0) > 0) {
                alerts.push({ level: 'critical', msg: counts.inativo + ' equipamento(s) INATIVO(S)', time: timeStr });
            }
            if ((counts.divergencia || 0) > 0) {
                alerts.push({ level: 'warning', msg: counts.divergencia + ' divergencia(s) BI vs Keep Alive', time: timeStr });
            }
            if ((counts.manutencao || 0) > 0) {
                alerts.push({ level: 'info', msg: counts.manutencao + ' em manutencao', time: timeStr });
            }
            const total = dashStats.total_records || 0;
            const online = counts.online || 0;
            if (total > 0) {
                const pct = Math.round((online / total) * 100);
                alerts.push({ level: pct >= 90 ? 'info' : 'warning', msg: 'Health Score: ' + pct + '% (' + online + '/' + total + ' online)', time: timeStr });
            }
        }

        if (chamadoStats) {
            if ((chamadoStats.abertos || 0) > 0) {
                alerts.push({ level: 'warning', msg: chamadoStats.abertos + ' chamado(s) aberto(s)', time: timeStr });
            }
            if ((chamadoStats.sla_excedido || 0) > 0) {
                alerts.push({ level: 'critical', msg: chamadoStats.sla_excedido + ' chamado(s) com SLA excedido', time: timeStr });
            }
            alerts.push({
                level: 'info',
                msg: 'Total chamados: ' + (chamadoStats.total || 0) + ' | Resolvidos: ' + (chamadoStats.resolvidos || 0),
                time: timeStr
            });
        }

        if (alerts.length === 0) {
            alerts.push({ level: 'info', msg: 'Todos os sistemas operacionais', time: timeStr });
        }

        container.innerHTML = alerts.map(function(a) {
            return '<div class="alert-row ' + a.level + '">' +
                '<span class="alert-time">' + escapeHtml(a.time) + '</span>' +
                '<span class="alert-msg">' + escapeHtml(a.msg) + '</span>' +
            '</div>';
        }).join('');
    }

    // ============================================================================
    // HOTSPOT MAP (mini dots on Screen 5)
    // ============================================================================
    function updateHotspotMap(dashStats) {
        const container = document.getElementById('hotspotMap');
        if (!container || !dashStats) return;

        const counts = dashStats.status_counts || {};
        const online = counts.online || 0;
        const offline = counts.inativo || 0;
        const alert = (counts.alerta || 0) + (counts.atencao || 0);

        container.innerHTML =
            '<span class="map-dot active"></span>' +
            '<span class="map-label">' + online + ' hotspots online</span>' +
            '<span class="map-dot inactive" style="margin-left:8px;"></span>' +
            '<span class="map-label">' + (offline + alert) + ' com problemas</span>';
    }

    // ============================================================================
    // MAIN POLL LOOP
    // ============================================================================
    async function pollAll() {
        const [dashStats, chamadoStats, snapshots, projectHealth] =
            await Promise.all([
                fetchJSON('/api/dashboard/stats'),
                fetchJSON('/api/chamados/stats'),
                fetchJSON('/api/cco/daily-snapshots?days=30'),
                fetchJSON('/api/noc/project-health')
            ]);

        // Update timestamp
        const now = new Date();
        document.getElementById('lastUpdate').textContent =
            'Ultima atualizacao: ' + now.toLocaleTimeString('pt-BR');

        // Left column — Project Health
        updateProjectHealth(projectHealth);

        // Screen 2 — Alerts Feed
        updateAlertsFeed(dashStats, chamadoStats);

        // Screen 3 — SLA dos Chamados
        updateSLAPanel(chamadoStats);

        // Screen 5 — Health Score
        updateHealthScore(dashStats);
        updateHotspotMap(dashStats);

        // Screen 6 — Chamados Ring
        updateChamadosRing(chamadoStats);

        // Bottom — Machine History (7 days)
        const snapshotList = snapshots ? (snapshots.snapshots || snapshots) : null;
        updateMachineHistoryChart(Array.isArray(snapshotList) ? snapshotList : null);
    }

    // ---- Utility ----
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // ---- Start ----
    pollAll();
    setInterval(pollAll, POLL_INTERVAL);

})();
