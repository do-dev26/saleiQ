(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  const cfg = window.AiWidgetConfig || {};
  const WIDGET_ID  = cfg.widgetId;
  const API_BASE   = cfg.apiBase || 'https://your-app.onrender.com/api';

  if (!WIDGET_ID) {
    console.warn('[AiWidget] No widgetId configured.');
    return;
  }

  // ── State ───────────────────────────────────────────────────────────────────
  let settings   = null;
  let sessionId  = sessionStorage.getItem('ai_session_' + WIDGET_ID) || null;
  let history    = [];
  let isOpen     = false;
  let isTyping   = false;

  // ── Load CSS ─────────────────────────────────────────────────────────────────
  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  link.href   = (cfg.apiBase || 'https://your-app.onrender.com') + '/widget.css';
  document.head.appendChild(link);

  // ── Fetch widget settings ────────────────────────────────────────────────────
  async function loadSettings() {
    try {
      const res  = await fetch(`${API_BASE}/widgets/${WIDGET_ID}/public`);
      const json = await res.json();
      if (!json.success) throw new Error('Widget not found');
      settings = json.data;
      buildUI();
    } catch (e) {
      console.warn('[AiWidget] Failed to load settings:', e.message);
    }
  }

  // ── Build DOM ────────────────────────────────────────────────────────────────
  function buildUI() {
    const color    = settings.color    || '#6366f1';
    const position = settings.position || 'bottom-right';

    // Inject CSS variable
    document.documentElement.style.setProperty('--ai-color', color);

    // Root
    const root = document.createElement('div');
    root.id    = 'ai-widget-root';
    if (position === 'bottom-left') {
      root.style.cssText = '--pos-right:auto;--pos-left:24px';
    }

    // Button
    root.innerHTML = `
      <button id="ai-widget-btn" aria-label="Open chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <div id="ai-widget-window" role="dialog" aria-label="Chat">
        <div id="ai-widget-header">
          <div id="ai-widget-avatar">🤖</div>
          <div id="ai-widget-header-info">
            <div id="ai-widget-title">${escHtml(settings.name || 'AI Assistant')}</div>
            <div id="ai-widget-status">Online</div>
          </div>
          <button id="ai-widget-close" aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div id="ai-widget-messages"></div>

        <div id="ai-widget-footer">
          <textarea id="ai-widget-input" placeholder="Type a message..." rows="1" maxlength="2000"></textarea>
          <button id="ai-widget-send" aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Events
    document.getElementById('ai-widget-btn').addEventListener('click', toggleChat);
    document.getElementById('ai-widget-close').addEventListener('click', closeChat);
    document.getElementById('ai-widget-send').addEventListener('click', sendMessage);
    const input = document.getElementById('ai-widget-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    });

    // Show welcome message
    addBotMessage(settings.welcomeMessage || 'Hi! How can I help you today? 👋');
  }

  // ── Chat logic ───────────────────────────────────────────────────────────────
  function toggleChat() { isOpen ? closeChat() : openChat(); }

  function openChat() {
    isOpen = true;
    document.getElementById('ai-widget-window').classList.add('open');
    document.getElementById('ai-widget-btn').innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`;
    setTimeout(() => document.getElementById('ai-widget-input')?.focus(), 200);
  }

  function closeChat() {
    isOpen = false;
    document.getElementById('ai-widget-window').classList.remove('open');
    document.getElementById('ai-widget-btn').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>`;
  }

  async function sendMessage() {
    const input   = document.getElementById('ai-widget-input');
    const message = input.value.trim();
    if (!message || isTyping) return;

    addUserMessage(message);
    input.value      = '';
    input.style.height = 'auto';
    history.push({ role: 'user', content: message });

    showTyping();
    document.getElementById('ai-widget-send').disabled = true;
    isTyping = true;

    try {
      const res  = await fetch(`${API_BASE}/chat/${WIDGET_ID}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message, sessionId, history: history.slice(-8) }),
      });
      const json = await res.json();

      if (json.success) {
        if (json.data.sessionId) {
          sessionId = json.data.sessionId;
          sessionStorage.setItem('ai_session_' + WIDGET_ID, sessionId);
        }
        removeTyping();
        addBotMessage(json.data.reply);
        history.push({ role: 'assistant', content: json.data.reply });
      } else {
        removeTyping();
        addBotMessage('Sorry, something went wrong. Please try again!');
      }
    } catch (err) {
      removeTyping();
      addBotMessage('Unable to connect. Please check your connection and try again.');
    } finally {
      isTyping = false;
      document.getElementById('ai-widget-send').disabled = false;
      document.getElementById('ai-widget-input').focus();
    }
  }

  // ── Message helpers ──────────────────────────────────────────────────────────
  function addBotMessage(text) {
    appendMessage('bot', escHtml(text));
  }
  function addUserMessage(text) {
    appendMessage('user', escHtml(text));
  }
  function appendMessage(type, html) {
    const msgs = document.getElementById('ai-widget-messages');
    const div  = document.createElement('div');
    div.className = `ai-msg ${type}`;
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function showTyping() {
    const msgs = document.getElementById('ai-widget-messages');
    const div  = document.createElement('div');
    div.className = 'ai-msg typing';
    div.id        = 'ai-typing-indicator';
    div.innerHTML = '<div class="ai-typing-dots"><span></span><span></span><span></span></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function removeTyping() {
    document.getElementById('ai-typing-indicator')?.remove();
  }
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettings);
  } else {
    loadSettings();
  }
})();
