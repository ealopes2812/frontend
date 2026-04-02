/**
 * Chat Widget - Sistema de Chat 1:1 entre Usuários
 * Usuários são agrupados por departamento na lista (departamento = separador visual).
 * Arquivo auto-contido que cria HTML/CSS dinamicamente.
 * Basta incluir <script src="/static/js/chat.js"></script> em qualquer página.
 *
 * Variáveis esperadas no escopo global (definidas pelo Jinja2):
 *   - USER_EMAIL, USER_NAME, USER_DEPARTMENT, IS_ADMIN
 */
(function () {
    'use strict';

    // =========================================================================
    // CONSTANTES
    // =========================================================================
    const POLL_INTERVAL = 4000;
    const HEARTBEAT_INTERVAL = 25000;
    const USER_REFRESH = 15000;
    const UNREAD_POLL = 10000;

    // =========================================================================
    // ESTADO
    // =========================================================================
    let chatOpen = false;
    let activeUser = null;          // {email, name, dept} do usuário selecionado
    let lastMessageId = 0;
    let pollTimer = null;
    let heartbeatTimer = null;
    let userRefreshTimer = null;
    let unreadTimer = null;
    let myEmail = '';
    let myName = '';
    let myDept = '';
    let isInitialized = false;
    let pendingFile = null;
    let lastKnownUnread = -1;       // -1 = primeiro check (não toca som)
    let isSending = false;           // Flag para prevenir envios duplicados

    // =========================================================================
    // NOTIFICATION SOUND (Web Audio API — sem arquivo externo)
    // =========================================================================
    function playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const play = function () {
                // Beep 1 — volume mais alto
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.value = 880;
                gain1.gain.setValueAtTime(0.3, ctx.currentTime);
                gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(ctx.currentTime);
                osc1.stop(ctx.currentTime + 0.35);
                // Beep 2
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.value = 1100;
                gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.18);
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(ctx.currentTime + 0.18);
                osc2.stop(ctx.currentTime + 0.5);
                // Beep 3 — nota mais alta para destaque
                const osc3 = ctx.createOscillator();
                const gain3 = ctx.createGain();
                osc3.type = 'sine';
                osc3.frequency.value = 1320;
                gain3.gain.setValueAtTime(0.22, ctx.currentTime + 0.38);
                gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
                osc3.connect(gain3);
                gain3.connect(ctx.destination);
                osc3.start(ctx.currentTime + 0.38);
                osc3.stop(ctx.currentTime + 0.65);
            };
            if (ctx.state === 'suspended') {
                ctx.resume().then(play);
            } else {
                play();
            }
        } catch (e) {
            // AudioContext pode falhar se o navegador bloquear autoplay
        }
    }

    // =========================================================================
    // DRAG OVERLAY + BROWSER NOTIFICATIONS + TITLE FLASH
    // =========================================================================
    function ensureDragOverlay() {
        if (document.getElementById('chat-drag-overlay')) return;
        const b = document.getElementById('chat-body');
        if (!b) return;
        const d = document.createElement('div');
        d.className = 'chat-drag-overlay';
        d.id = 'chat-drag-overlay';
        d.innerHTML = '<i class="fas fa-cloud-upload-alt" style="margin-right:8px"></i> Solte o arquivo aqui';
        b.appendChild(d);
    }

    let notifPermission = 'default';
    function requestNotifPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(function (p) { notifPermission = p; });
        } else if ('Notification' in window) {
            notifPermission = Notification.permission;
        }
    }

    function showBrowserNotification(title, body) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            var n = new Notification(title, {
                body: body,
                tag: 'chat-msg',
                renotify: true
            });
            setTimeout(function () { n.close(); }, 6000);
        } catch (e) { /* mobile / SW-only browsers */ }
    }

    let _origTitle = '';
    let _titleFlash = null;
    function startTitleFlash(count) {
        if (_titleFlash) return;
        _origTitle = _origTitle || document.title;
        var show = true;
        _titleFlash = setInterval(function () {
            document.title = show ? '\uD83D\uDCAC (' + count + ') Nova mensagem!' : _origTitle;
            show = !show;
        }, 1200);
    }
    function stopTitleFlash() {
        if (_titleFlash) { clearInterval(_titleFlash); _titleFlash = null; }
        if (_origTitle) document.title = _origTitle;
    }

    // =========================================================================
    // CSS
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('chat-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'chat-widget-styles';
        style.textContent = `
            /* Garantir que body/html não recortem elementos fixed */
            html, body {
                overflow-x: visible !important;
            }
            
            /* === FAB === */
            #chat-fab {
                position: fixed !important;
                bottom: 24px !important;
                right: 24px !important;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: #0d6efd;
                color: #fff;
                border: none;
                box-shadow: 0 4px 12px rgba(0,0,0,.3);
                cursor: pointer;
                z-index: 2147483647 !important;
                display: flex !important;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: transform .2s, background .2s;
                overflow: visible !important;
                isolation: isolate;
                contain: layout style;
                will-change: transform;
            }
            #chat-fab:hover { transform: scale(1.08); background: #0b5ed7; }
            #chat-fab .badge-unread {
                position: absolute !important;
                top: -8px !important;
                right: -8px !important;
                background: #ff1744;
                color: #fff !important;
                border-radius: 14px;
                min-width: 28px;
                height: 28px;
                font-size: 14px;
                font-weight: 800;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 0 7px;
                z-index: 2147483647 !important;
                box-shadow: 0 0 0 3px #fff, 0 0 12px 4px rgba(255,23,68,.6);
                animation: chatBadgePulse 1.5s ease-in-out infinite;
                pointer-events: none !important;
                transform-origin: center;
                will-change: transform;
            }
            #chat-fab .badge-unread.badge-visible {
                display: flex !important;
            }
            #chat-fab.has-unread {
                animation: chatFabGlow 2s ease-in-out infinite;
            }
            @keyframes chatBadgePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.18); }
            }
            @keyframes chatFabGlow {
                0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,.3); }
                50% { box-shadow: 0 4px 12px rgba(0,0,0,.3), 0 0 20px 6px rgba(255,23,68,.5); }
            }

            /* === Panel === */
            #chat-panel {
                position: fixed; bottom: 90px; right: 24px;
                width: 420px; height: 520px; background: #fff;
                border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.25);
                z-index: 10001; display: none; flex-direction: column;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #212529 !important;
            }
            #chat-panel.open { display: flex; }
            #chat-panel * { color: inherit; }

            /* Header */
            #chat-panel .chat-header {
                background: #0d6efd; color: #fff; padding: 12px 16px;
                display: flex; align-items: center; justify-content: space-between;
                flex-shrink: 0;
            }
            #chat-panel .chat-header h6 { margin: 0; font-size: 15px; font-weight: 600; }
            #chat-panel .chat-header .btn-back {
                background: none; border: none; color: #fff;
                font-size: 18px; cursor: pointer; padding: 0 8px; display: none;
            }
            #chat-panel .chat-header .btn-close-chat {
                background: none; border: none; color: #fff;
                font-size: 18px; cursor: pointer; padding: 0; opacity: .8;
            }
            #chat-panel .chat-header .btn-close-chat:hover { opacity: 1; }

            /* Body */
            #chat-panel .chat-body { flex: 1; overflow-y: auto; padding: 0; }

            /* === Department section header (separador) === */
            .chat-dept-header {
                padding: 10px 16px; background: #f1f3f5; border-bottom: 1px solid #dee2e6;
                font-weight: 700; font-size: 11px; color: #6c757d !important;
                text-transform: uppercase; letter-spacing: .5px;
                display: flex; align-items: center; justify-content: space-between;
                position: sticky; top: 0; z-index: 2;
            }
            .chat-dept-header.my-dept { background: #dbeafe; color: #1d4ed8 !important; }
            .chat-dept-header .dept-online-count {
                font-size: 11px; font-weight: 400; color: #198754;
            }

            /* === User list inside dept === */
            .chat-user-list { list-style: none; margin: 0; padding: 0; }
            .chat-user-list li {
                padding: 10px 16px 10px 24px; border-bottom: 1px solid #f0f0f0;
                cursor: pointer; display: flex; align-items: center;
                justify-content: space-between; transition: background .15s;
            }
            .chat-user-list li:hover { background: #f0f4ff; }
            .chat-user-list li .user-info {
                display: flex; align-items: center; gap: 8px; min-width: 0;
            }
            .chat-user-list li .user-name {
                font-size: 14px; color: #212529 !important;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .chat-user-list li .dot-online {
                display: inline-block; width: 8px; height: 8px;
                border-radius: 50%; background: #198754; flex-shrink: 0;
            }
            .chat-user-list li .dot-offline {
                display: inline-block; width: 8px; height: 8px;
                border-radius: 50%; background: #adb5bd; flex-shrink: 0;
            }
            .chat-user-list li .unread-badge {
                background: #dc3545; color: #fff !important; border-radius: 10px;
                min-width: 20px; height: 20px; font-size: 11px; font-weight: 700;
                display: flex; align-items: center; justify-content: center;
                padding: 0 6px; flex-shrink: 0;
            }

            /* === Conversa === */
            .chat-messages {
                padding: 12px 16px; display: flex; flex-direction: column;
                gap: 8px; min-height: 100%;
            }
            .chat-msg {
                max-width: 80%; padding: 8px 12px; border-radius: 12px;
                font-size: 13px; line-height: 1.4; word-wrap: break-word;
                position: relative;
            }
            .chat-msg.mine {
                align-self: flex-end; background: #0d6efd; color: #fff !important;
                border-bottom-right-radius: 4px;
            }
            .chat-msg.theirs {
                align-self: flex-start; background: #e9ecef; color: #212529 !important;
                border-bottom-left-radius: 4px;
            }
            .chat-msg .msg-sender { font-size: 11px; font-weight: 600; margin-bottom: 2px; opacity: .8; }
            .chat-msg .msg-time { font-size: 10px; opacity: .6; margin-top: 4px; text-align: right; }
            .chat-empty {
                text-align: center; color: #adb5bd !important; padding: 40px 20px; font-size: 14px;
            }

            /* === Input === */
            #chat-panel .chat-input-area {
                display: none; padding: 10px 12px; border-top: 1px solid #e9ecef;
                gap: 8px; flex-shrink: 0; background: #fff;
            }
            #chat-panel .chat-input-area.active { display: flex; }
            #chat-panel .chat-input-area input[type="text"] {
                flex: 1; border: 1px solid #dee2e6; border-radius: 20px;
                padding: 8px 16px; font-size: 13px; outline: none;
                color: #212529 !important; background: #fff !important;
            }
            #chat-panel .chat-input-area input[type="text"]:focus { border-color: #0d6efd; }
            #chat-panel .chat-input-area button {
                width: 36px; height: 36px; border-radius: 50%; border: none;
                background: #0d6efd; color: #fff; cursor: pointer;
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
            }
            #chat-panel .chat-input-area button:hover { background: #0b5ed7; }
            #chat-panel .chat-input-area button:disabled { background: #adb5bd; cursor: default; }
            #chat-panel .chat-input-area .btn-attach { background: #6c757d; }
            #chat-panel .chat-input-area .btn-attach:hover { background: #5a6268; }

            /* === Attach preview === */
            .chat-attach-preview {
                display: none; padding: 6px 12px; border-top: 1px solid #e9ecef;
                background: #f8f9fa; align-items: center; gap: 8px;
                font-size: 12px; color: #495057 !important;
            }
            .chat-attach-preview.active { display: flex; }
            .chat-attach-preview .attach-name {
                flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .chat-attach-preview .attach-remove {
                cursor: pointer; color: #dc3545; font-weight: bold; padding: 0 4px;
            }
            .chat-attach-preview .attach-thumb {
                width: 32px; height: 32px; object-fit: cover; border-radius: 4px;
            }

            /* === Drag overlay === */
            .chat-drag-overlay {
                display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(13,110,253,.15); border: 2px dashed #0d6efd;
                border-radius: 12px; z-index: 10; align-items: center; justify-content: center;
                font-size: 15px; font-weight: 600; color: #0d6efd;
                pointer-events: none;
            }
            .chat-drag-overlay.active { display: flex; }

            /* === Image in message === */
            .chat-msg img.chat-attachment-img {
                max-width: 100%; max-height: 200px; border-radius: 8px;
                margin-top: 4px; cursor: pointer;
            }
            .chat-msg .chat-attachment-file {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 4px 10px; background: rgba(0,0,0,.08); border-radius: 8px;
                margin-top: 4px; font-size: 12px; text-decoration: none; color: inherit;
            }
            .chat-msg.mine .chat-attachment-file { background: rgba(255,255,255,.2); }

            @media (max-width: 480px) {
                #chat-panel { width: calc(100vw - 16px); right: 8px; bottom: 80px; height: 60vh; }
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // HTML
    // =========================================================================
    function buildHTML() {
        if (document.getElementById('chat-fab')) return;

        // FAB
        const fab = document.createElement('button');
        fab.id = 'chat-fab';
        fab.title = 'Chat';
        fab.innerHTML = '<i class="fas fa-comments"></i><span class="badge-unread" style="display:none" id="chat-unread-badge"></span>';
        fab.onclick = toggleChat;
        document.body.appendChild(fab);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'chat-panel';
        panel.innerHTML = `
            <div class="chat-header">
                <button class="btn-back" id="chat-btn-back" onclick="window._chatBack()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h6 id="chat-header-title">Chat</h6>
                <button class="btn-close-chat" onclick="window._chatToggle()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="chat-body" id="chat-body" style="position:relative;">
                <div class="chat-empty">Carregando...</div>
                <div class="chat-drag-overlay" id="chat-drag-overlay">
                    <i class="fas fa-cloud-upload-alt" style="margin-right:8px"></i> Solte o arquivo aqui
                </div>
            </div>
            <div class="chat-attach-preview" id="chat-attach-preview">
                <i class="fas fa-paperclip"></i>
                <span class="attach-name" id="chat-attach-name"></span>
                <span class="attach-remove" onclick="window._chatClearAttach()">✕</span>
            </div>
            <div class="chat-input-area" id="chat-input-area">
                <input type="file" id="chat-file-input" style="display:none"
                       accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z"
                       onchange="window._chatFileSelected(this)">
                <button class="btn-attach" onclick="document.getElementById('chat-file-input').click()" title="Anexar arquivo">
                    <i class="fas fa-paperclip"></i>
                </button>
                <input type="text" id="chat-input" placeholder="Digite uma mensagem..." maxlength="2000"
                       onkeydown="if(event.key==='Enter')window._chatSend()"
                       onpaste="window._chatPaste(event)">
                <button id="chat-send-btn" onclick="window._chatSend()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
        document.body.appendChild(panel);

        // Drag-and-drop events (com dragCounter para evitar flicker)
        const body = panel.querySelector('#chat-body');
        let dragCounter = 0;

        body.addEventListener('dragover', (e) => {
            e.preventDefault();  // necessário para permitir drop
        });
        body.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (activeUser) { const ov = document.getElementById('chat-drag-overlay'); if (ov) ov.classList.add('active'); }
        });
        body.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                const ov = document.getElementById('chat-drag-overlay');
                if (ov) ov.classList.remove('active');
            }
        });
        body.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            const ov = document.getElementById('chat-drag-overlay');
            if (ov) ov.classList.remove('active');
            if (!activeUser) return;
            const files = e.dataTransfer.files;
            if (files.length > 0) setPendingFile(files[0]);
        });
    }

    // =========================================================================
    // TOGGLE / NAVEGAÇÃO
    // =========================================================================
    function toggleChat() {
        chatOpen = !chatOpen;
        const panel = document.getElementById('chat-panel');
        if (chatOpen) {
            panel.classList.add('open');
            if (!isInitialized) {
                initialize();
                isInitialized = true;
            }
            showUserList();
        } else {
            panel.classList.remove('open');
            stopPoll();
            activeUser = null;
        }
    }

    function showUserList() {
        activeUser = null;
        lastMessageId = 0;
        stopPoll();
        clearPendingFile();

        document.getElementById('chat-header-title').textContent = 'Chat';
        document.getElementById('chat-btn-back').style.display = 'none';
        document.getElementById('chat-input-area').classList.remove('active');
        document.getElementById('chat-body').innerHTML = '<div class="chat-empty">Carregando...</div>';
        ensureDragOverlay();

        loadUsers();
    }

    function openConversation(email, name, dept) {
        activeUser = { email: email, name: name, dept: dept };
        lastMessageId = 0;

        document.getElementById('chat-header-title').textContent = name;
        document.getElementById('chat-btn-back').style.display = 'block';
        document.getElementById('chat-input-area').classList.add('active');
        document.getElementById('chat-body').innerHTML = '<div class="chat-messages" id="chat-messages-container"></div>';
        ensureDragOverlay();

        loadMessages(false);
        startPoll();

        setTimeout(() => {
            const inp = document.getElementById('chat-input');
            if (inp) inp.focus();
        }, 100);
    }

    // =========================================================================
    // API CALLS
    // =========================================================================
    async function apiCall(url, options = {}) {
        try {
            const resp = await fetch(url, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                ...options
            });
            const json = await resp.json();
            if (!resp.ok) {
                console.warn('[Chat] API ' + url + ' status=' + resp.status, json);
            }
            return json;
        } catch (e) {
            console.error('[Chat] API error:', url, e);
            return null;
        }
    }

    function sendHeartbeat() {
        apiCall('/api/chat/heartbeat', { method: 'POST', body: '{}' });
    }

    async function loadUsers() {
        const data = await apiCall('/api/chat/departments');
        if (!data || !data.departments) {
            var errMsg = 'Erro ao carregar usuários';
            if (data && data.error) {
                if (data.error.indexOf('autenticado') !== -1 || data.error.indexOf('Não autenticado') !== -1) {
                    errMsg = 'Sessão expirada — recarregue a página';
                } else {
                    errMsg = 'Erro: ' + data.error;
                }
            } else if (!data) {
                errMsg = 'Falha de conexão — tente novamente';
            }
            document.getElementById('chat-body').innerHTML = '<div class="chat-empty">' + errMsg + '</div>';
            return;
        }

        myEmail = data.my_email;
        myName = data.my_name;
        myDept = data.my_dept;

        const body = document.getElementById('chat-body');
        let html = '';

        for (const dept of data.departments) {
            const isMyDept = dept.is_my_dept;
            const headerClass = isMyDept ? 'chat-dept-header my-dept' : 'chat-dept-header';
            const deptLabel = isMyDept ? dept.name + ' (Meu Depto)' : dept.name;
            const onlineText = dept.online_count > 0 ? dept.online_count + ' online' : '';

            html += '<div class="chat-dept-section">';
            html += '<div class="' + headerClass + '"><span>' + escapeHtml(deptLabel) + '</span><span class="dept-online-count">' + onlineText + '</span></div>';

            if (!dept.users || dept.users.length === 0) {
                html += '<ul class="chat-user-list"><li style="color:#adb5bd;cursor:default;font-size:13px;padding-left:32px;">Nenhum usuário</li></ul>';
            } else {
                html += '<ul class="chat-user-list">';
                for (const u of dept.users) {
                    const dotCls = u.online ? 'dot-online' : 'dot-offline';
                    const unreadHtml = u.unread > 0
                        ? '<span class="unread-badge">' + u.unread + '</span>'
                        : '';
                    const safeEmail = u.email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                    const safeName = u.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                    const safeDept = dept.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

                    html += '<li onclick="window._chatOpenConv(\'' + safeEmail + '\',\'' + safeName + '\',\'' + safeDept + '\')">'
                        + '<div class="user-info">'
                        + '<span class="' + dotCls + '"></span>'
                        + '<span class="user-name">' + escapeHtml(u.name) + '</span>'
                        + '</div>'
                        + unreadHtml
                        + '</li>';
                }
                html += '</ul>';
            }
            html += '</div>';
        }

        if (!html) {
            html = '<div class="chat-empty">Nenhum usuário disponível</div>';
        }
        body.innerHTML = html;
        ensureDragOverlay();
    }

    async function loadMessages(append) {
        if (!activeUser) return;

        const url = '/api/chat/messages/' + encodeURIComponent(activeUser.email) +
            (append && lastMessageId > 0 ? '?after_id=' + lastMessageId : '');

        const data = await apiCall(url);
        if (!data || !data.messages) return;

        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        if (!append && data.messages.length === 0) {
            container.innerHTML = '<div class="chat-empty">Nenhuma mensagem ainda. Diga olá! 👋</div>';
            return;
        }

        if (!append) {
            container.innerHTML = '';
        }

        if (append && data.messages.length === 0) return;

        // Som + notificação quando recebe novas mensagens de outros (durante polling)
        if (append && data.messages.length > 0) {
            const newFromOthers = data.messages.filter(function(m) { return m.sender_email.toLowerCase() !== myEmail.toLowerCase(); });
            if (newFromOthers.length > 0) {
                playNotificationSound();
                if (document.hidden) {
                    var last = newFromOthers[newFromOthers.length - 1];
                    showBrowserNotification(last.sender_name || 'Chat', last.message || 'Enviou um arquivo');
                }
            }
        }

        const placeholder = container.querySelector('.chat-empty');
        if (placeholder) placeholder.remove();

        for (const msg of data.messages) {
            const isMine = msg.sender_email.toLowerCase() === myEmail.toLowerCase();
            const div = document.createElement('div');
            div.className = 'chat-msg ' + (isMine ? 'mine' : 'theirs');
            div.dataset.msgId = msg.id;

            const time = formatTime(msg.created_at);

            // Renderizar anexo
            let attachHtml = '';
            if (msg.attachment_url) {
                const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
                const fname = (msg.attachment_name || '').toLowerCase();
                const isImg = imgExts.some(function (ext) { return fname.endsWith(ext); });
                // Garantir que usamos URL local (/api/chat/files/) para exibição inline
                var displayUrl = msg.attachment_url;
                if (displayUrl && displayUrl.indexOf('drive.google.com') !== -1) {
                    // URL do Drive não funciona como src de imagem — usar fallback local se disponível
                    displayUrl = '/api/chat/files/' + (msg.attachment_name || 'file');
                }
                if (isImg) {
                    attachHtml = '<img class="chat-attachment-img" src="' + displayUrl + '" alt="' + escapeHtml(msg.attachment_name) + '" style="cursor:pointer;max-width:100%;border-radius:8px;" onclick="(function(){ var a=document.createElement(\'a\'); a.href=\'' + displayUrl + '\'; a.download=\'' + escapeHtml(msg.attachment_name) + '\'; a.click(); })()">';
                } else {
                    attachHtml = '<a class="chat-attachment-file" href="' + displayUrl + '" target="_blank" download="' + escapeHtml(msg.attachment_name) + '"><i class="fas fa-file"></i> ' + escapeHtml(msg.attachment_name) + '</a>';
                }
            }

            // Texto (ocultar se é só emoji de anexo)
            const msgText = msg.attachment_url && (msg.message || '').match(/^[📎🖼️]/)
                ? ''
                : '<div class="msg-text">' + escapeHtml(msg.message || '') + '</div>';

            div.innerHTML =
                (!isMine ? '<div class="msg-sender">' + escapeHtml(msg.sender_name) + '</div>' : '')
                + msgText
                + attachHtml
                + '<div class="msg-time">' + time + '</div>';

            container.appendChild(div);

            if (msg.id > lastMessageId) lastMessageId = msg.id;
        }

        // Scroll to bottom
        const bodyEl = document.getElementById('chat-body');
        bodyEl.scrollTop = bodyEl.scrollHeight;

        // Marcar mensagens como lidas após carregar
        if (lastMessageId > 0) {
            markAsRead();
        }
    }

    async function sendMessage() {
        if (!activeUser || isSending) return;
        const input = document.getElementById('chat-input');
        const text = input.value.trim();

        // Upload de arquivo
        if (pendingFile) {
            isSending = true;
            const btn = document.getElementById('chat-send-btn');
            btn.disabled = true;
            const file = pendingFile;
            clearPendingFile();
            input.value = '';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('to_email', activeUser.email);

            try {
                const resp = await fetch('/api/chat/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                const data = await resp.json();
                if (data && data.success) {
                    await loadMessages(true);
                } else {
                    alert('Erro ao enviar arquivo: ' + (data.error || 'desconhecido'));
                }
            } catch (e) {
                console.error('[Chat] Upload error:', e);
                alert('Erro ao enviar arquivo');
            } finally {
                btn.disabled = false;
                isSending = false;
            }
            input.focus();
            return;
        }

        if (!text) return;

        isSending = true;
        const btn = document.getElementById('chat-send-btn');
        btn.disabled = true;
        input.value = '';

        try {
            const data = await apiCall('/api/chat/send', {
                method: 'POST',
                body: JSON.stringify({ to_email: activeUser.email, message: text })
            });

            if (data && data.success) {
                await loadMessages(true);
            } else {
                alert('Erro ao enviar mensagem');
                input.value = text; // Restaurar mensagem em caso de erro
            }
        } catch (e) {
            console.error('[Chat] Send error:', e);
            alert('Erro ao enviar mensagem');
            input.value = text; // Restaurar mensagem em caso de erro
        } finally {
            btn.disabled = false;
            isSending = false;
        }

        input.focus();
    }

    async function markAsRead() {
        if (!activeUser || lastMessageId === 0) return;

        const channel = [myEmail.toLowerCase(), activeUser.email.toLowerCase()].sort().join('__');
        
        try {
            await apiCall('/api/chat/mark-read', {
                method: 'POST',
                body: JSON.stringify({
                    channel: channel,
                    last_read_id: lastMessageId
                })
            });
            
            // Atualizar badge imediatamente após marcar como lido
            await checkUnread();
        } catch (e) {
            console.error('[Chat] Mark read error:', e);
        }
    }

    async function checkUnread() {
        const data = await apiCall('/api/chat/unread-total');
        if (!data) return;

        const newTotal = data.total || 0;

        // Som + notificação do browser quando há novas não-lidas (skip primeiro check)
        if (lastKnownUnread >= 0 && newTotal > lastKnownUnread) {
            playNotificationSound();
            if (document.hidden) {
                showBrowserNotification('Chat — Nova mensagem', 'Você tem ' + newTotal + ' mensagem(ns) não lida(s)');
            }
        }
        lastKnownUnread = newTotal;

        // Title flash quando há não-lidas e aba não focada
        if (newTotal > 0 && document.hidden) {
            startTitleFlash(newTotal);
        } else if (newTotal === 0) {
            stopTitleFlash();
        }

        const badge = document.getElementById('chat-unread-badge');
        const fab = document.getElementById('chat-fab');
        if (badge) {
            if (newTotal > 0) {
                badge.textContent = newTotal > 99 ? '99+' : newTotal;
                badge.classList.add('badge-visible');
                if (fab) fab.classList.add('has-unread');
            } else {
                badge.textContent = '';
                badge.classList.remove('badge-visible');
                if (fab) fab.classList.remove('has-unread');
            }
        }
    }

    // =========================================================================
    // FILE ATTACHMENT
    // =========================================================================
    function setPendingFile(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('Arquivo muito grande (máximo 10MB)');
            return;
        }
        pendingFile = file;
        const preview = document.getElementById('chat-attach-preview');
        const nameEl = document.getElementById('chat-attach-name');
        if (preview && nameEl) {
            nameEl.textContent = file.name;
            const oldThumb = preview.querySelector('.attach-thumb');
            if (oldThumb) oldThumb.remove();
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.className = 'attach-thumb';
                img.src = URL.createObjectURL(file);
                preview.insertBefore(img, nameEl);
            }
            preview.classList.add('active');
        }
    }

    function clearPendingFile() {
        pendingFile = null;
        const preview = document.getElementById('chat-attach-preview');
        if (preview) {
            preview.classList.remove('active');
            const thumb = preview.querySelector('.attach-thumb');
            if (thumb) thumb.remove();
        }
        const fileInput = document.getElementById('chat-file-input');
        if (fileInput) fileInput.value = '';
    }

    function handleFileSelected(input) {
        if (input.files && input.files.length > 0) {
            setPendingFile(input.files[0]);
        }
    }

    function handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file') {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) setPendingFile(file);
                return;
            }
        }
    }

    // =========================================================================
    // POLLING
    // =========================================================================
    function startPoll() {
        stopPoll();
        pollTimer = setInterval(function () {
            if (activeUser) loadMessages(true);
        }, POLL_INTERVAL);
    }

    function stopPoll() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // =========================================================================
    // UTILS
    // =========================================================================
    function formatTime(isoStr) {
        try {
            const d = new Date(isoStr);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            if (isToday) return hh + ':' + mm;
            const dd = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            return dd + '/' + mo + ' ' + hh + ':' + mm;
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =========================================================================
    // INIT
    // =========================================================================
    function initialize() {
        // Limpar timers duplicados do boot() antes de recriar
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (unreadTimer) clearInterval(unreadTimer);

        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        userRefreshTimer = setInterval(function () {
            if (chatOpen && !activeUser) loadUsers();
        }, USER_REFRESH);
        checkUnread();
        unreadTimer = setInterval(checkUnread, UNREAD_POLL);
    }

    // =========================================================================
    // EXPOSE
    // =========================================================================
    window._chatToggle = toggleChat;
    window._chatBack = showUserList;
    window._chatSend = sendMessage;
    window._chatOpenConv = openConversation;
    window._chatClearAttach = clearPendingFile;
    window._chatFileSelected = handleFileSelected;
    window._chatPaste = handlePaste;

    // =========================================================================
    // BOOT
    // =========================================================================
    function boot() {
        if (typeof USER_EMAIL === 'undefined' || !USER_EMAIL) return;

        injectStyles();
        buildHTML();

        // Pedir permissão de notificação no primeiro clique do usuário
        requestNotifPermission();
        document.addEventListener('click', function () {
            requestNotifPermission();
        }, { once: true });

        // Parar flash do título quando aba recebe foco
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) stopTitleFlash();
        });

        // Heartbeat e unread mesmo sem abrir o chat
        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        checkUnread();
        unreadTimer = setInterval(checkUnread, UNREAD_POLL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
