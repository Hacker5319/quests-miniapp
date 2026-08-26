const tg = window.Telegram.WebApp;
const API_URL = 'https://www.fantastworld.ru:26312';

let currentNick = '';
let confirmTimer = null;
let currentTicketId = null;
let isAdmin = false;
let ticketPollTimer = null;
let lastTicketUpdatedAt = null;
let lastMessagesSignature = '';

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id !== 'screen-ticket') stopTicketPolling();
}

function api(path, options = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `tma ${tg.initData}`,
      ...(options.headers || {})
    }
  }).then(r => {
    if (!r.ok) throw new Error('API error');
    return r.json();
  });
}

async function init() {
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
    if (data.nickname) {
      renderProfile(data);
      show('screen-profile');
      isAdmin = data.rank >= 5;
      await updateSupportBadge();
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
      renderProfile(profile);
      isAdmin = profile.rank >= 5;
      show('screen-profile');
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
  document.getElementById('btnConfirmNext').disabled = true;
  document.getElementById('confirmError').textContent = '';
  try {
    const res = await api('/api/register/realname', {
      method: 'POST',
      body: JSON.stringify({ nickname: currentNick })
    });
    if (res.status === 'not_found') {
      document.getElementById('confirmError').textContent = 'Убедитесь, что ник корректный и вы зашли на сервер';
      document.getElementById('btnConfirmNext').disabled = false;
    } else if (res.status === 'ok') {
      const profile = await api('/api/profile');
      renderProfile(profile);
      isAdmin = profile.rank >= 5;
      show('screen-profile');
    } else {
      document.getElementById('confirmError').textContent = res.message || 'Ошибка';
      document.getElementById('btnConfirmNext').disabled = false;
    }
  } catch (e) {
    document.getElementById('confirmError').textContent = 'Ошибка сервера';
    document.getElementById('btnConfirmNext').disabled = false;
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
  show('screen-support');
  loadTickets();
});

document.getElementById('btnRefresh').addEventListener('click', async () => {
  try {
    const data = await api('/api/profile');
    renderProfile(data);
    tg.HapticFeedback?.impactOccurred('light');
  } catch (e) {}
});

document.getElementById('btnSupport').addEventListener('click', () => {
  show('screen-support');
  loadTickets();
});

document.getElementById('btnSupportBack').addEventListener('click', () => {
  const profile = document.getElementById('pNick').textContent;
  if (profile && profile !== '—') show('screen-profile');
  else show('screen-register');
  updateSupportBadge();
});

document.getElementById('btnNewTicket').addEventListener('click', () => show('screen-new-ticket'));
document.getElementById('btnNewTicketBack').addEventListener('click', () => show('screen-support'));

document.getElementById('btnSendTicket').addEventListener('click', async () => {
  const text = document.getElementById('ticketText').value.trim();
  if (text.length < 5) {
    document.getElementById('ticketError').textContent = 'Минимум 5 символов';
    return;
  }
  document.getElementById('btnSendTicket').disabled = true;
  document.getElementById('ticketError').textContent = '';
  try {
    const res = await api('/api/support/create', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    if (res.success) {
      document.getElementById('ticketText').value = '';
      show('screen-support');
      loadTickets();
      tg.HapticFeedback?.impactOccurred('success');
    } else {
      document.getElementById('ticketError').textContent = res.error || 'Ошибка';
    }
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка сервера';
  } finally {
    document.getElementById('btnSendTicket').disabled = false;
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
          <span class="ticket-status \( {statusClass}"> \){statusText}</span>
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

function messagesSignature(messages, status) {
  return status + ':' + messages.map(m => `\( {m.id}: \){m.read ? 1 : 0}`).join(',');
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
    div.className = `message \( {isUser ? 'user' : 'admin'} \){isGroupStart ? ' group-start' : ''}`;

    let displayName = msg.nickname || 'Неизвестно';
    if (Number(msg.rank) === 0) {
      if (!String(displayName).startsWith('@') && !String(displayName).startsWith('id')) {
        displayName = displayName;
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
    } catch (e) {}
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
  show('screen-support');
  loadTickets();
  updateSupportBadge();
});

document.getElementById('btnSendTicketReply').addEventListener('click', async () => {
  const text = document.getElementById('ticketReply').value.trim();
  if (!text) return;
  document.getElementById('btnSendTicketReply').disabled = true;
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
    document.getElementById('btnSendTicketReply').disabled = false;
  }
});

document.getElementById('btnCloseTicket').addEventListener('click', async () => {
  if (!confirm('Закрыть тикет?')) return;
  try {
    document.getElementById('btnCloseTicket').disabled = true;
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
    document.getElementById('btnCloseTicket').disabled = false;
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

setInterval(updateSupportBadge, 15000);
init();
