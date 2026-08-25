const tg = window.Telegram.WebApp;
const API_URL = 'https://www.fantastworld.ru:26312';

let currentNick = '';
let confirmTimer = null;
let currentTicketId = null;
let supportMessages = [];
let isAdmin = false;

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function api(path, options = {}) {
  const url = `${API_URL}${path}`;
  return fetch(url, {
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
    if (data.nickname && data.nickname !== ' ') {
      renderProfile(data);
      show('screen-profile');
      
      const profile = await api('/api/profile');
      isAdmin = profile.rank >= 5;
      
      const unread = await api('/api/support/unread');
      if (unread.count > 0) {
        document.getElementById('supportBadge').style.display = 'inline';
        document.getElementById('supportBadge').textContent = unread.count;
      }
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

    if (res.taken) {
      show('screen-taken');
    } else {
      await startRealname(nick);
    }
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
        } else {
          btn.textContent = `Далее (${left})`;
        }
      }, 1000);
      show('screen-confirm');
    } else if (res.status === 'ok') {
      const profile = await api('/api/profile');
      renderProfile(profile);
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
  show('screen-profile');
  updateSupportBadge();
});

document.getElementById('btnNewTicket').addEventListener('click', () => {
  show('screen-new-ticket');
});

document.getElementById('btnNewTicketBack').addEventListener('click', () => {
  show('screen-support');
});

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

    if (tickets.length === 0) {
      container.innerHTML = '<p class="hint">Нет тикетов</p>';
      return;
    }

    for (const ticket of tickets) {
      const div = document.createElement('div');
      div.className = 'ticket-item';
      
      const statusClass = ticket.status === 'open' ? 'open' : 'closed';
      const statusText = ticket.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт';
      
      div.innerHTML = `
        <div class="ticket-header" data-id="${ticket.id}">
          <span class="ticket-id">#${ticket.id}</span>
          <span class="ticket-status ${statusClass}">${statusText}</span>
          <span class="ticket-nick">${ticket.nickname}</span>
        </div>
        <div class="ticket-preview">${ticket.lastMessage || 'Нет сообщений'}</div>
      `;
      
      div.querySelector('.ticket-header').addEventListener('click', () => {
        openTicket(ticket.id);
      });
      
      container.appendChild(div);
    }
  } catch (e) {
    document.getElementById('ticketsList').innerHTML = '<p class="error-text">Ошибка загрузки</p>';
  }
}

async function openTicket(ticketId) {
  try {
    const ticket = await api(`/api/support/ticket/${ticketId}`);
    currentTicketId = ticketId;
    supportMessages = ticket.messages || [];
    
    show('screen-ticket');
    renderTicket(ticket);
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка загрузки тикета';
  }
}

function renderTicket(ticket) {
  document.getElementById('ticketIdDisplay').textContent = `#${ticket.id}`;
  document.getElementById('ticketStatusDisplay').textContent = ticket.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт';
  
  const container = document.getElementById('ticketMessages');
  container.innerHTML = '';
  
  for (const msg of ticket.messages) {
    const div = document.createElement('div');
    div.className = `message ${msg.senderType === 'admin' ? 'admin' : 'user'}`;
    
    const rank = msg.rank || 0;
    const rankName = ['[0] Пользователь', '[1] Игрок', '[2] Бывалый', '[3] Опытный', '[4] Элита', '[5] Ведущий', '[6] Главный'][rank] || '[0] Пользователь';
    const color = ['#808080', '#FFFFFF', '#55FF55', '#55FFFF', '#FFAA00', '#FF5555', '#FF00FF'][rank] || '#FFFFFF';
    
    div.innerHTML = `
      <div class="message-header">
        <span class="message-sender" style="color:${color}">${rankName} ${msg.nickname}</span>
        <span class="message-time">${new Date(msg.timestamp).toLocaleString()}</span>
        ${msg.read ? '' : '<span class="message-unread">●</span>'}
      </div>
      <div class="message-text">${msg.text}</div>
    `;
    
    container.appendChild(div);
  }
  
  if (ticket.status === 'open') {
    document.getElementById('ticketReplyArea').style.display = 'block';
    document.getElementById('ticketCloseBtn').style.display = 'block';
  } else {
    document.getElementById('ticketReplyArea').style.display = 'none';
    document.getElementById('ticketCloseBtn').style.display = 'none';
  }
  
  if (isAdmin) {
    document.getElementById('ticketAdminActions').style.display = 'block';
  } else {
    document.getElementById('ticketAdminActions').style.display = 'none';
  }
}

document.getElementById('btnTicketBack').addEventListener('click', () => {
  show('screen-support');
  loadTickets();
  updateSupportBadge();
});

document.getElementById('btnSendTicketReply').addEventListener('click', async () => {
  const text = document.getElementById('ticketReply').value.trim();
  if (text.length < 1) return;
  
  document.getElementById('btnSendTicketReply').disabled = true;
  
  try {
    const res = await api('/api/support/reply', {
      method: 'POST',
      body: JSON.stringify({ ticketId: currentTicketId, text })
    });
    
    if (res.success) {
      document.getElementById('ticketReply').value = '';
      openTicket(currentTicketId);
      tg.HapticFeedback?.impactOccurred('light');
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
    await api('/api/support/close', {
      method: 'POST',
      body: JSON.stringify({ ticketId: currentTicketId })
    });
    openTicket(currentTicketId);
    tg.HapticFeedback?.impactOccurred('success');
  } catch (e) {
    document.getElementById('ticketError').textContent = 'Ошибка';
  }
});

document.getElementById('btnReopenTicket').addEventListener('click', async () => {
  try {
    await api('/api/support/reopen', {
      method: 'POST',
      body: JSON.stringify({ ticketId: currentTicketId })
    });
    openTicket(currentTicketId);
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

setInterval(updateSupportBadge, 30000);

init();
