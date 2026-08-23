const tg = window.Telegram.WebApp;
const API_URL = 'https://d1.aurorix.net:26312';

let currentNick = '';
let confirmTimer = null;

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function api(path, options = {}) {
  return fetch(`\( {API_URL} \){path}`, {
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
  sendSupport(3);
});

document.getElementById('btnRefresh').addEventListener('click', async () => {
  try {
    const data = await api('/api/profile');
    renderProfile(data);
    tg.HapticFeedback?.impactOccurred('light');
  } catch (e) {}
});

init();
