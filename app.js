const tg = window.Telegram.WebApp;
const API_URL = 'https://fantastworld.ru:26312';

let currentNick = '';
let confirmTimer = null;
let currentTicketId = null;
let isAdmin = false;
let ticketPollTimer = null;
let lastTicketUpdatedAt = null;
let lastMessagesSignature = '';
let currentUser = null;
let currentEditQuestId = null;
let currentQuestImage = null;
let allTickets = false;

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id !== 'screen-ticket') stopTicketPolling();
  updateTabHighlight(id);
}

function updateTabHighlight(screenId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.screen === screenId) {
      btn.classList.add('active');
    }
  });
}

function showNav(show) {
  const nav = document.querySelector('.bottom-nav');
  if (nav) {
    nav.style.display = show ? 'flex' : 'none';
  }
}

function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (tg && tg.initData) {
    headers['Authorization'] = `tma ${tg.initData}`;
  }
  
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers
  }).then(r => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  }).catch(error => {
    console.error(`API Error [${path}]:`, error);
    throw error;
  });
}

async function init() {
  showNav(false);
  if (confirmTimer) {
    clearInterval(confirmTimer);
    confirmTimer = null;
  }
  
  document.title = 'BlazeQuest';
  if (!tg || !tg.initDataUnsafe?.user) {
    show('screen-blocked');
    return;
  }
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0a0a12');
  tg.setBackgroundColor('#0a0a12');

  try {
    const data = await api('/api/profile');
    currentUser = data;
    if (data.nickname) {
      renderProfile(data);
      show('screen-profile');
      showNav(true);
      isAdmin = data.rank >= 5;
      if (isAdmin) {
        document.getElementById('tabAdmin').style.display = 'flex';
      } else {
        document.getElementById('tabAdmin').style.display = 'none';
      }
      loadQuests();
    } else {
      document.getElementById('btnSupportFromReg').style.display = 'block';
      show('screen-register');
    }
  } catch (e) {
    document.getElementById('btnSupportFromReg').style.display = 'block';
    show('screen-register');
  }
}

function renderProfile(data) {
  document.getElementById('pNick').textContent = data.nickname || '—';
  document.getElementById('pRank').textContent = data.rankName || '—';
  document.getElementById('pPoints').textContent = data.points ?? '—';
  if (data.game && data.time) {
    document.getElementById('pGameRow').style.display = 'flex';
    document.getElementById('pGame').textContent = `${data.game} в ${data.time}`;
  } else {
    document.getElementById('pGameRow').style.display = 'none';
  }
}

document.getElementById('btnNextNick').addEventListener('click', async () => {
  const nick = document.getElementById('nickInput').value.trim();
  const err = document.getElementById('nickError');
  err.textContent = '';
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
    err.textContent = 'Никнейм: 3–16 символов (латиница, цифры, _)';
    return;
  }
  currentNick = nick;
  document.getElementById('btnNextNick').disabled = true;
  try {
    const res = await api('/api/register/check', {
      method: 'POST',
      body: JSON.stringify({ nickname: nick })
    });
    if (res.taken) show('screen-taken');
    else await startRealname(nick);
  } catch (e) {
    err.textContent = 'Ошибка сервера. Попробуйте позже.';
  } finally {
    document.getElementById('btnNextNick').disabled = false;
  }
});

async function startRealname(nick) {
  show('screen-loading');
  try {
    const res = await api('/api/register/realname', {
      method: 'POST',
      body: JSON.stringify({ nickname: nick })
    });
    if (res.status === 'not_found') {
      document.getElementById('confirmText').textContent = `Пожалуйста, зайдите на сервер, чтобы подтвердить ${nick}`;
      document.getElementById('confirmError').textContent = '';
      const btn = document.getElementById('btnConfirmNext');
      btn.disabled = true;
      let left = 3;
      btn.textContent = `Далее (${left})`;
      clearInterval(confirmTimer);
      confirmTimer = setInterval(() => {
        left--;
        if (left <= 0) {
          clearInterval(confirmTimer);
          btn.disabled = false;
          btn.textContent = 'Далее';
        } else btn.textContent = `Далее (${left})`;
      }, 1000);
      show('screen-confirm');
    } else if (res.status === 'ok') {
      const profile = await api('/api/profile');
      currentUser = profile;
      renderProfile(profile);
      showNav(true);
      isAdmin = profile.rank >= 5;
      if (isAdmin) {
        document.getElementById('tabAdmin').style.display = 'flex';
      } else {
        document.getElementById('tabAdmin').style.display = 'none';
      }
      show('screen-profile');
      loadQuests();
    } else {
      document.getElementById('nickError').textContent = res.message || 'Ошибка';
      show('screen-register');
    }
  } catch (e) {
    document.getElementById('nickError').textContent = 'Не удалось проверить ник';
    show('screen-register');
  }
}

document.getElementById('btnConfirmNext').addEventListener('click', async () => {
  const btn = document.getElementById('btnConfirmNext');
  if (btn.disabled) return;
  
  btn.disabled = true;
  document.getElementById('confirmError').textContent = '';
  try {
    const res = await api('/api/register/realname', {
      method: 'POST',
      body: JSON.stringify({ nickname: currentNick })
    });
    if (res.status === 'not_found') {
      document.getElementById('confirmError').textContent = 'Убедитесь, что ник корректный и вы зашли на сервер';
      btn.disabled = false;
    } else if (res.status === 'ok') {
      const profile = await api('/api/profile');
      currentUser = profile;
      renderProfile(profile);
      showNav(true);
      isAdmin = profile.rank >= 5;
      if (isAdmin) {
        document.getElementById('tabAdmin').style.display = 'flex';
      } else {
        document.getElementById('tabAdmin').style.display = 'none';
      }
      show('screen-profile');
      loadQuests();
    } else {
      document.getElementById('confirmError').textContent = res.message || 'Ошибка';
      btn.disabled = false;
    }
  } catch (e) {
    document.getElementById('confirmError').textContent = 'Ошибка сервера';
    btn.disabled = false;
  }
});

document.getElementById('btnConfirmBack').addEventListener('click', () => {
  clearInterval(confirmTimer);
  show('screen-register');
});
document.getElementById('btnBackToNick').addEventListener('click', () => show('screen-register'));
document.getElementById('btnMyAccount').addEventListener('click', () => show('screen-claim'));
document.getElementById('btnClaimBack').addEventListener('click', () => show('screen-taken'));

document.querySelectorAll('.claim-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.claim;
    if (type === '1') show('screen-claim1');
    else sendSupport(type);
  });
});

document.getElementById('btnClaim1Back').addEventListener('click', () => show('screen-claim'));
document.getElementById('btnSendClaim1').addEventListener('click', async () => {
  const text = document.getElementById('claim1Text').value.trim();
  if (text.length < 5) return;
  await api('/api/support/claim', {
    method: 'POST',
    body: JSON.stringify({ type: 1, nickname: currentNick, text })
  });
  tg.close();
});

async function sendSupport(type) {
  await api('/api/support/claim', {
    method: 'POST',
    body: JSON.stringify({ type: Number(type), nickname: currentNick })
  });
  tg.close();
}

document.getElementById('btnSupportFromReg').addEventListener('click', () => {
  currentNick = '';
  allTickets = false;
  show('screen-support');
  loadTickets();
});

document.getElementById('btnRefresh').addEventListener('click', async () => {
  try {
    const data = await api('/api/profile');
    currentUser = data;
    renderProfile(data);
    tg.HapticFeedback?.impactOccurred('light');
  } catch (e) {}
});

document.getElementById('btnNewTicket').addEventListener('click', () => show('screen-new-ticket'));
document.getElementById('btnNewTicketBack').addEventListener('click', () => {
  if (allTickets) {
    show('screen-admin-tickets');
  } else {
    show('screen-support');
  }
  loadTickets();
});

document.getElementById('btnSendTicket').addEventListener('click', async () => {
  const btn = document.getElementById('btnSendTicket');
  if (btn.disabled) return;
  
  const text = document.getElementById('ticketText').value.trim();
  if (text.length < 5) {
    document.getElementById('ticketError').textContent = 'Минимум 5 символов';
    return;
  }
  btn.disabled = true;
  document.getElementById('ticketError').textContent = '';
  try {
    const res = await api('/api/support/create', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    if (res.success) {
      document.getElementById('ticketText').value = '';
      if (allTickets) {
        show('screen-admin-tickets');
      } else {
        show('screen-support');
      }
      loadTickets();
      tg.HapticFeedback?.impactOccurred('success');
    } else {
      document.getElementById('ticketError').textContent = res.error || 'Ошибка';
    }
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка сервера';
  } finally {
    btn.disabled = false;
  }
});

async function loadTickets() {
  try {
    const tickets = await api('/api/support/tickets');
    const container = document.getElementById('ticketsList');
    container.innerHTML = '';
    if (!tickets.length) {
      container.innerHTML = '<p class="hint">У вас ещё не было обращений</p>';
      return;
    }
    for (const ticket of tickets) {
      const div = document.createElement('div');
      div.className = 'ticket-item';
      const statusClass = ticket.status === 'open' ? 'open' : 'closed';
      const statusText = ticket.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт';
      const unreadMark = ticket.unread > 0 ? `<span class="badge">${ticket.unread}</span>` : '';
      div.innerHTML = `
        <div class="ticket-header">
          <span class="ticket-id">#${ticket.id}</span>
          <span class="ticket-status ${statusClass}">${statusText}</span>
          <span class="ticket-nick">${ticket.nickname || ''}</span>
          ${unreadMark}
        </div>
        <div class="ticket-preview">${ticket.lastMessage || 'Нет сообщений'}</div>
      `;
      div.addEventListener('click', () => openTicket(ticket.id));
      container.appendChild(div);
    }
  } catch (e) {
    document.getElementById('ticketsList').innerHTML = '<p class="error-text">Ошибка загрузки</p>';
  }
}

async function loadAllTickets() {
  try {
    const tickets = await api('/api/support/all');
    const container = document.getElementById('adminTicketsList');
    container.innerHTML = '';
    if (!tickets.length) {
      container.innerHTML = '<p class="hint">Нет тикетов</p>';
      return;
    }
    for (const ticket of tickets) {
      const div = document.createElement('div');
      div.className = 'ticket-item';
      const statusClass = ticket.status === 'open' ? 'open' : 'closed';
      const statusText = ticket.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт';
      const unreadMark = ticket.unread > 0 ? `<span class="badge">${ticket.unread}</span>` : '';
      div.innerHTML = `
        <div class="ticket-header">
          <span class="ticket-id">#${ticket.id}</span>
          <span class="ticket-status ${statusClass}">${statusText}</span>
          <span class="ticket-nick">${ticket.nickname || ''}</span>
          ${unreadMark}
        </div>
        <div class="ticket-preview">${ticket.lastMessage || 'Нет сообщений'}</div>
      `;
      div.addEventListener('click', () => openTicket(ticket.id));
      container.appendChild(div);
    }
  } catch (e) {
    document.getElementById('adminTicketsList').innerHTML = '<p class="error-text">Ошибка загрузки</p>';
  }
}

function messagesSignature(messages, status) {
  return status + ':' + messages.map(m => `${m.id}:${m.read ? 1 : 0}`).join(',');
}

async function openTicket(ticketId) {
  try {
    const ticket = await api(`/api/support/ticket/${ticketId}`);
    currentTicketId = ticketId;
    lastTicketUpdatedAt = ticket.updatedAt;
    lastMessagesSignature = messagesSignature(ticket.messages || [], ticket.status);
    show('screen-ticket');
    renderTicket(ticket);
    startTicketPolling();
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка загрузки тикета';
  }
}

function renderTicket(ticket) {
  document.getElementById('ticketIdDisplay').textContent = `#${ticket.id}`;
  document.getElementById('ticketStatusDisplay').textContent =
    ticket.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт';

  const container = document.getElementById('ticketMessages');
  container.innerHTML = '';

  let lastSenderId = null;
  let lastSenderType = null;

  for (const msg of ticket.messages) {
    const div = document.createElement('div');
    const isUser = msg.senderType === 'user';
    const isGroupStart = lastSenderId !== msg.senderId || lastSenderType !== msg.senderType;
    div.className = `message ${isUser ? 'user' : 'admin'}${isGroupStart ? ' group-start' : ''}`;

    let displayName = msg.nickname || 'Неизвестно';
    if (Number(msg.rank) === 0) {
      if (!displayName.startsWith('@') && !displayName.startsWith('id')) {
        displayName = '@' + displayName;
      }
    }

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    if (isGroupStart) {
      if (msg.avatarUrl) {
        const img = document.createElement('img');
        img.src = msg.avatarUrl;
        img.alt = '';
        avatarDiv.appendChild(img);
      } else {
        avatarDiv.textContent = String(displayName).replace('@', '').charAt(0).toUpperCase() || '?';
      }
    } else {
      avatarDiv.style.visibility = 'hidden';
    }

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'message-body';

    if (isGroupStart) {
      const headerDiv = document.createElement('div');
      headerDiv.className = 'message-header';
      const senderSpan = document.createElement('span');
      senderSpan.className = 'message-sender';
      senderSpan.style.color = msg.rankColor || '#808080';
      const rankDisplay = msg.rankName || '[0] Пользователь';
      senderSpan.textContent = `${rankDisplay} ${displayName}`;
      const timeSpan = document.createElement('span');
      timeSpan.className = 'message-time';
      timeSpan.textContent = new Date(msg.timestamp).toLocaleString();
      headerDiv.appendChild(senderSpan);
      headerDiv.appendChild(timeSpan);
      bodyDiv.appendChild(headerDiv);
    }

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = msg.text;
    bodyDiv.appendChild(textDiv);

    div.appendChild(avatarDiv);
    div.appendChild(bodyDiv);
    container.appendChild(div);

    lastSenderId = msg.senderId;
    lastSenderType = msg.senderType;
  }

  container.scrollTop = container.scrollHeight;

  const isOpen = ticket.status === 'open';
  document.getElementById('ticketReplyArea').style.display = isOpen ? 'block' : 'none';
  document.getElementById('btnCloseTicket').style.display = isOpen ? 'block' : 'none';
  document.getElementById('btnCloseTicket').disabled = !isOpen;
  document.getElementById('btnReopenTicket').style.display = (!isOpen && isAdmin) ? 'block' : 'none';
  document.getElementById('ticketAdminActions').style.display = isAdmin ? 'block' : 'none';
}

function startTicketPolling() {
  stopTicketPolling();
  ticketPollTimer = setInterval(async () => {
    if (!currentTicketId) return;
    try {
      const ticket = await api(`/api/support/ticket/${currentTicketId}`);
      const sig = messagesSignature(ticket.messages || [], ticket.status);
      if (sig !== lastMessagesSignature) {
        lastMessagesSignature = sig;
        lastTicketUpdatedAt = ticket.updatedAt;
        renderTicket(ticket);
      } else if (ticket.status !== 'open') {
        renderTicket(ticket);
      }
    } catch (e) {
      console.warn('Polling error:', e);
    }
  }, 3000);
}

function stopTicketPolling() {
  if (ticketPollTimer) {
    clearInterval(ticketPollTimer);
    ticketPollTimer = null;
  }
}

document.getElementById('btnTicketBack').addEventListener('click', () => {
  stopTicketPolling();
  if (allTickets) {
    show('screen-admin-tickets');
  } else {
    show('screen-support');
  }
  loadTickets();
});

document.getElementById('btnSendTicketReply').addEventListener('click', async () => {
  const btn = document.getElementById('btnSendTicketReply');
  if (btn.disabled) return;
  
  const text = document.getElementById('ticketReply').value.trim();
  if (!text) return;
  btn.disabled = true;
  try {
    const res = await api('/api/support/reply', {
      method: 'POST',
      body: JSON.stringify({ ticketId: currentTicketId, text })
    });
    if (res.success) {
      document.getElementById('ticketReply').value = '';
      const ticket = await api(`/api/support/ticket/${currentTicketId}`);
      lastMessagesSignature = messagesSignature(ticket.messages || [], ticket.status);
      renderTicket(ticket);
      tg.HapticFeedback?.impactOccurred('light');
    } else {
      document.getElementById('ticketError').textContent = res.error || 'Ошибка';
    }
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка отправки';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnCloseTicket').addEventListener('click', async () => {
  const btn = document.getElementById('btnCloseTicket');
  if (btn.disabled) return;
  
  if (!confirm('Закрыть тикет?')) return;
  try {
    btn.disabled = true;
    await api('/api/support/close', {
      method: 'POST',
      body: JSON.stringify({ ticketId: currentTicketId })
    });
    const ticket = await api(`/api/support/ticket/${currentTicketId}`);
    lastMessagesSignature = messagesSignature(ticket.messages || [], ticket.status);
    renderTicket(ticket);
    tg.HapticFeedback?.impactOccurred('success');
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка при закрытии';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnReopenTicket').addEventListener('click', async () => {
  try {
    await api('/api/support/reopen', {
      method: 'POST',
      body: JSON.stringify({ ticketId: currentTicketId })
    });
    const ticket = await api(`/api/support/ticket/${currentTicketId}`);
    lastMessagesSignature = messagesSignature(ticket.messages || [], ticket.status);
    renderTicket(ticket);
    tg.HapticFeedback?.impactOccurred('success');
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка';
  }
});

async function updateSupportBadge() {
  try {
    const unread = await api('/api/support/unread');
    const badge = document.getElementById('supportBadge');
    if (unread.count > 0) {
      badge.style.display = 'inline';
      badge.textContent = unread.count;
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {}
}

document.getElementById('tabProfile').addEventListener('click', () => {
  show('screen-profile');
});

document.getElementById('tabQuests').addEventListener('click', () => {
  show('screen-quests');
  loadQuests();
});

document.getElementById('tabSupport').addEventListener('click', () => {
  allTickets = false;
  show('screen-support');
  loadTickets();
  updateSupportBadge();
});

document.getElementById('tabAdmin').addEventListener('click', () => {
  if (isAdmin) {
    show('screen-admin');
  }
});

document.getElementById('btnAdminTickets').addEventListener('click', () => {
  allTickets = true;
  show('screen-admin-tickets');
  loadAllTickets();
});

document.getElementById('btnAdminQuests').addEventListener('click', () => {
  show('screen-admin-quests');
  loadAdminQuests();
});

document.getElementById('btnAdminConsole').addEventListener('click', () => {
  show('screen-admin-console');
});

document.getElementById('btnAdminConsoleBack').addEventListener('click', () => {
  show('screen-admin');
});

document.getElementById('btnAdminTicketsBack').addEventListener('click', () => {
  show('screen-admin');
});

document.getElementById('btnAdminQuestsBack').addEventListener('click', () => {
  show('screen-admin');
});

document.getElementById('btnAdminConsoleSend').addEventListener('click', async () => {
  const input = document.getElementById('adminConsoleInput');
  const text = input.value.trim();
  if (!text) return;
  
  const btn = document.getElementById('btnAdminConsoleSend');
  btn.disabled = true;
  document.getElementById('adminConsoleError').textContent = '';
  
  try {
    const response = await api('/api/admin/console', {
      method: 'POST',
      body: JSON.stringify({ command: text })
    });
    if (response.success) {
      input.value = '';
      tg.HapticFeedback?.impactOccurred('success');
      document.getElementById('adminConsoleError').style.color = 'var(--success)';
      document.getElementById('adminConsoleError').textContent = '✅ Команда отправлена';
      setTimeout(() => {
        document.getElementById('adminConsoleError').textContent = '';
        document.getElementById('adminConsoleError').style.color = 'var(--danger)';
      }, 2000);
    } else {
      document.getElementById('adminConsoleError').textContent = response.error || 'Ошибка отправки';
    }
  } catch (e) {
    document.getElementById('adminConsoleError').textContent = 'Ошибка отправки';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnAdminQuestNew').addEventListener('click', () => {
  currentEditQuestId = null;
  currentQuestImage = null;
  document.getElementById('adminQuestFormTitle').textContent = 'Новый квест';
  document.getElementById('adminQuestName').value = '';
  document.getElementById('adminQuestDescription').value = '';
  document.getElementById('adminQuestGenre').value = '';
  document.getElementById('adminQuestRules').value = '';
  document.getElementById('adminQuestBooking').checked = false;
  document.getElementById('adminQuestImagePreview').style.display = 'none';
  document.getElementById('adminQuestImageInput').value = '';
  document.getElementById('adminQuestCustomTags').value = '';
  document.getElementById('adminQuestError').textContent = '';
  document.getElementById('adminQuestPreview').style.display = 'none';
  show('screen-admin-quest-form');
});

document.getElementById('btnAdminQuestFormBack').addEventListener('click', () => {
  show('screen-admin-quests');
  loadAdminQuests();
});

document.getElementById('btnSelectQuestImage').addEventListener('click', () => {
  document.getElementById('adminQuestImageInput').click();
});

document.getElementById('adminQuestImageInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    currentQuestImage = base64;
    const preview = document.getElementById('adminQuestImagePreview');
    const img = document.getElementById('adminQuestImagePreviewImg');
    img.src = base64;
    preview.style.display = 'block';
    updateQuestPreview();
  };
  reader.readAsDataURL(file);
});

document.getElementById('btnRemoveQuestImage').addEventListener('click', () => {
  currentQuestImage = null;
  document.getElementById('adminQuestImagePreview').style.display = 'none';
  document.getElementById('adminQuestImageInput').value = '';
  updateQuestPreview();
});

document.getElementById('adminQuestName').addEventListener('input', updateQuestPreview);
document.getElementById('adminQuestDescription').addEventListener('input', updateQuestPreview);
document.getElementById('adminQuestGenre').addEventListener('input', updateQuestPreview);
document.getElementById('adminQuestRules').addEventListener('input', updateQuestPreview);
document.getElementById('adminQuestBooking').addEventListener('change', updateQuestPreview);
document.getElementById('adminQuestCustomTags').addEventListener('input', updateQuestPreview);

function updateQuestPreview() {
  const name = document.getElementById('adminQuestName').value.trim() || 'Название квеста';
  const description = document.getElementById('adminQuestDescription').value.trim() || 'Описание квеста';
  const genre = document.getElementById('adminQuestGenre').value.trim();
  const booking = document.getElementById('adminQuestBooking').checked;
  const customTags = document.getElementById('adminQuestCustomTags').value.trim();
  
  const preview = document.getElementById('adminQuestPreview');
  const previewContent = document.getElementById('adminQuestPreviewContent');
  
  let tags = '';
  if (genre) tags += `<span class="quest-tag">${genre}</span>`;
  if (booking) tags += `<span class="quest-tag booking">🔒 Бронь</span>`;
  if (customTags) {
    customTags.split(',').forEach(t => {
      const parts = t.trim().split(':');
      const tagName = parts[0].trim();
      const tagColor = parts[1] ? parts[1].trim() : '#7a8ba0';
      if (tagName) {
        tags += `<span class="quest-tag" style="background:${tagColor}20;color:${tagColor};">${tagName}</span>`;
      }
    });
  }
  
  const imageHtml = currentQuestImage ? `<img src="${currentQuestImage}" style="max-width:100%;border-radius:8px;max-height:150px;margin-bottom:10px;">` : '';
  
  previewContent.innerHTML = `
    ${imageHtml}
    <div class="quest-preview-name">${name}</div>
    <div class="quest-preview-tags">${tags}</div>
    <div class="quest-preview-description">${description}</div>
  `;
  preview.style.display = 'block';
}

document.getElementById('btnAdminQuestFormSave').addEventListener('click', async () => {
  const name = document.getElementById('adminQuestName').value.trim();
  const description = document.getElementById('adminQuestDescription').value.trim();
  const genre = document.getElementById('adminQuestGenre').value.trim();
  const rules = document.getElementById('adminQuestRules').value.trim();
  const booking = document.getElementById('adminQuestBooking').checked;
  const customTags = document.getElementById('adminQuestCustomTags').value.trim();
  
  if (!name) {
    document.getElementById('adminQuestError').textContent = 'Введите название квеста';
    return;
  }
  
  const btn = document.getElementById('btnAdminQuestFormSave');
  btn.disabled = true;
  document.getElementById('adminQuestError').textContent = '';
  
  try {
    let questId = currentEditQuestId;
    if (!questId) {
      const response = await api('/api/admin/quests', {
        method: 'POST',
        body: JSON.stringify({ name, description, genre, rules, booking, customTags, active: false })
      });
      questId = response.id;
    } else {
      await api(`/api/admin/quests/${questId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description, genre, rules, booking, customTags, active: false })
      });
    }
    
    if (currentQuestImage) {
      await api('/api/admin/quests/image', {
        method: 'POST',
        body: JSON.stringify({ questId, image: currentQuestImage })
      });
    }
    
    show('screen-admin-quests');
    loadAdminQuests();
    loadQuests();
    tg.HapticFeedback?.impactOccurred('success');
  } catch (e) {
    document.getElementById('adminQuestError').textContent = 'Ошибка сервера';
  } finally {
    btn.disabled = false;
  }
});

async function loadQuests() {
  try {
    const quests = await api('/api/quests');
    const container = document.getElementById('questsList');
    container.innerHTML = '';
    if (!quests.length) {
      container.innerHTML = '<p class="hint">Квестов пока нет</p>';
      return;
    }
    for (const quest of quests) {
      const div = document.createElement('div');
      div.className = 'quest-item';
      div.addEventListener('click', () => showQuestDetail(quest));
      
      let tags = '';
      if (quest.genre) tags += `<span class="quest-tag">${quest.genre}</span>`;
      if (quest.booking) tags += `<span class="quest-tag booking">🔒 Бронь</span>`;
      if (quest.custom_tags) {
        const customTags = quest.custom_tags.split(',');
        customTags.forEach(t => {
          const parts = t.trim().split(':');
          const tagName = parts[0].trim();
          const tagColor = parts[1] ? parts[1].trim() : '#7a8ba0';
          if (tagName) {
            tags += `<span class="quest-tag" style="background:${tagColor}20;color:${tagColor};">${tagName}</span>`;
          }
        });
      }
      
      const imageHtml = quest.image_url ? `<img src="${quest.image_url}" style="max-width:100%;border-radius:8px;max-height:120px;margin-bottom:8px;">` : '';
      
      div.innerHTML = `
        ${imageHtml}
        <div class="quest-name">${quest.name}</div>
        <div class="quest-tags">${tags}</div>
        <div class="quest-description">${quest.description || 'Нет описания'}</div>
        <span class="quest-status ${quest.active ? 'active' : 'inactive'}">${quest.active ? '🟢 Доступен' : '🔴 Недоступен'}</span>
      `;
      container.appendChild(div);
    }
  } catch (e) {
    document.getElementById('questsList').innerHTML = '<p class="error-text">Ошибка загрузки квестов</p>';
  }
}

function showQuestDetail(quest) {
  document.getElementById('questDetailName').textContent = quest.name;
  
  let tags = '';
  if (quest.genre) tags += `<span class="quest-tag">${quest.genre}</span>`;
  if (quest.booking) tags += `<span class="quest-tag booking">🔒 Бронь</span>`;
  if (quest.custom_tags) {
    const customTags = quest.custom_tags.split(',');
    customTags.forEach(t => {
      const parts = t.trim().split(':');
      const tagName = parts[0].trim();
      const tagColor = parts[1] ? parts[1].trim() : '#7a8ba0';
      if (tagName) {
        tags += `<span class="quest-tag" style="background:${tagColor}20;color:${tagColor};">${tagName}</span>`;
      }
    });
  }
  document.getElementById('questDetailTags').innerHTML = tags;
  
  const imageHtml = quest.image_url ? `<img src="${quest.image_url}" style="max-width:100%;border-radius:8px;max-height:200px;">` : '';
  document.getElementById('questDetailImage').innerHTML = imageHtml;
  
  document.getElementById('questDetailDescription').textContent = quest.description || 'Нет описания';
  document.getElementById('questDetailRules').textContent = quest.rules || 'Нет правил';
  document.getElementById('questDetailStatus').textContent = quest.active ? '🟢 Доступен' : '🔴 Недоступен';
  document.getElementById('questDetailStatus').className = `quest-status ${quest.active ? 'active' : 'inactive'}`;
  
  document.getElementById('questDetailPlay').style.display = quest.active ? 'block' : 'none';
  
  show('screen-quest-detail');
}

document.getElementById('btnQuestDetailBack').addEventListener('click', () => {
  show('screen-quests');
  loadQuests();
});

document.getElementById('btnQuestDetailPlay').addEventListener('click', () => {
  tg.HapticFeedback?.impactOccurred('light');
  alert('Функция бронирования будет добавлена позже');
});

async function loadAdminQuests() {
  try {
    const quests = await api('/api/quests');
    const container = document.getElementById('adminQuestsList');
    container.innerHTML = '';
    if (!quests.length) {
      container.innerHTML = '<p class="hint">Квестов нет</p>';
      return;
    }
    for (const quest of quests) {
      const div = document.createElement('div');
      div.className = 'admin-quest-item';
      
      let tags = '';
      if (quest.genre) tags += `<span class="quest-tag">${quest.genre}</span>`;
      if (quest.booking) tags += `<span class="quest-tag booking">🔒 Бронь</span>`;
      if (quest.custom_tags) {
        const customTags = quest.custom_tags.split(',');
        customTags.forEach(t => {
          const parts = t.trim().split(':');
          const tagName = parts[0].trim();
          const tagColor = parts[1] ? parts[1].trim() : '#7a8ba0';
          if (tagName) {
            tags += `<span class="quest-tag" style="background:${tagColor}20;color:${tagColor};">${tagName}</span>`;
          }
        });
      }
      
      const imageHtml = quest.image_url ? `<img src="${quest.image_url}" style="max-width:100%;border-radius:8px;max-height:80px;margin-bottom:8px;">` : '';
      
      div.innerHTML = `
        ${imageHtml}
        <div class="admin-quest-header">
          <span class="admin-quest-name">${quest.name}</span>
          <span class="quest-status ${quest.active ? 'active' : 'inactive'}">${quest.active ? '✅ Активен' : '❌ Неактивен'}</span>
        </div>
        <div class="admin-quest-tags">${tags}</div>
        <div class="admin-quest-description">${quest.description || 'Нет описания'}</div>
        <div class="admin-quest-actions">
          <button class="neon-btn secondary admin-quest-edit" data-id="${quest.id}" style="flex:1;margin-top:4px;">✏️ Изменить</button>
          <button class="neon-btn admin-quest-toggle" data-id="${quest.id}" style="flex:1;margin-top:4px;background:${quest.active ? 'var(--danger)' : 'var(--success)'};">${quest.active ? '🔴 Отключить' : '🟢 Включить'}</button>
          <button class="neon-btn admin-quest-delete" data-id="${quest.id}" style="flex:1;margin-top:4px;background:var(--danger);">🗑️ Удалить</button>
        </div>
      `;
      container.appendChild(div);
    }
    
    document.querySelectorAll('.admin-quest-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        if (!confirm('Удалить квест?')) return;
        try {
          const response = await api(`/api/admin/quests/${id}`, {
            method: 'DELETE'
          });
          if (response.success) {
            loadAdminQuests();
            loadQuests();
            tg.HapticFeedback?.impactOccurred('success');
          }
        } catch (e) {
          document.getElementById('adminQuestError').textContent = 'Ошибка удаления';
        }
      });
    });
    
    document.querySelectorAll('.admin-quest-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        try {
          const quest = await api(`/api/quests/${id}`);
          const newActive = !quest.active;
          await api(`/api/admin/quests/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ 
              name: quest.name,
              description: quest.description || '',
              genre: quest.genre || '',
              rules: quest.rules || '',
              booking: !!quest.booking,
              customTags: quest.custom_tags || '',
              active: newActive
            })
          });
          loadAdminQuests();
          loadQuests();
          tg.HapticFeedback?.impactOccurred('success');
        } catch (e) {
          document.getElementById('adminQuestError').textContent = 'Ошибка изменения статуса';
        }
      });
    });
    
    document.querySelectorAll('.admin-quest-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        try {
          const quest = await api(`/api/quests/${id}`);
          currentEditQuestId = id;
          document.getElementById('adminQuestFormTitle').textContent = 'Редактировать квест';
          document.getElementById('adminQuestName').value = quest.name;
          document.getElementById('adminQuestDescription').value = quest.description || '';
          document.getElementById('adminQuestGenre').value = quest.genre || '';
          document.getElementById('adminQuestRules').value = quest.rules || '';
          document.getElementById('adminQuestBooking').checked = !!quest.booking;
          document.getElementById('adminQuestCustomTags').value = quest.custom_tags || '';
          document.getElementById('adminQuestError').textContent = '';
          
          if (quest.image_url) {
            const preview = document.getElementById('adminQuestImagePreview');
            const img = document.getElementById('adminQuestImagePreviewImg');
            img.src = quest.image_url;
            preview.style.display = 'block';
            currentQuestImage = quest.image_url;
          } else {
            document.getElementById('adminQuestImagePreview').style.display = 'none';
            currentQuestImage = null;
          }
          
          updateQuestPreview();
          show('screen-admin-quest-form');
        } catch (e) {
          document.getElementById('adminQuestError').textContent = 'Ошибка загрузки квеста';
        }
      });
    });
  } catch (e) {
    document.getElementById('adminQuestsList').innerHTML = '<p class="error-text">Ошибка загрузки</p>';
  }
}

async function updateBotStatus() {
  try {
    const status = await api('/api/admin/status');
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (dot && text) {
      if (status.connected) {
        dot.className = 'status-dot online';
        text.textContent = 'Бот подключен';
      } else {
        dot.className = 'status-dot offline';
        text.textContent = 'Бот отключен';
      }
    }
  } catch (e) {}
}

setInterval(updateSupportBadge, 15000);
setInterval(updateBotStatus, 10000);
init();
