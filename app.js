const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#0f0f0f');
tg.setBackgroundColor('#0f0f0f');

const API_URL = 'https://d1.aurorix.net:26312';

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function loadUserInfo() {
  const user = tg.initDataUnsafe?.user;
  document.getElementById('userInfo').textContent = user?.username
    ? `@${user.username}`
    : user ? `ID ${user.id}` : 'Гость';
}

async function api(path) {
  const res = await fetch(`\( {API_URL} \){path}`, {
    headers: {
      'Authorization': `tma ${tg.initData}`
    }
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function loadProfile() {
  try {
    const data = await api('/api/profile');
    document.getElementById('nickname').textContent = data.nickname || 'Не зарегистрирован';
    document.getElementById('rank').textContent = data.rankName || '—';
    document.getElementById('points').textContent = data.points ?? '—';

    if (data.game && data.time) {
      document.getElementById('gameRow').style.display = 'flex';
      document.getElementById('currentGame').textContent = `${data.game} в ${data.time}`;
    } else {
      document.getElementById('gameRow').style.display = 'none';
    }
  } catch (e) {
    document.getElementById('nickname').textContent = 'Ошибка загрузки';
    console.error(e);
  }
}

async function loadGames() {
  const list = document.getElementById('gamesList');
  list.innerHTML = '<div class="loading">Загрузка...</div>';
  try {
    const data = await api('/api/games');
    list.innerHTML = data.map(g => `
      <div class="game-item">
        <div class="game-name">${g.name}</div>
        <div class="game-status ${g.active ? 'online' : 'offline'}">
          ${g.active ? 'Активна' : 'Неактивна'}
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<div class="loading">Не удалось загрузить</div>';
  }
}

async function loadShop() {
  const list = document.getElementById('shopList');
  list.innerHTML = '<div class="loading">Загрузка...</div>';
  try {
    const data = await api('/api/shop');
    list.innerHTML = Object.entries(data).map(([name, price]) => `
      <div class="shop-item">
        <div class="item-name">${name}</div>
        <div class="item-price">${price} очков</div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<div class="loading">Не удалось загрузить</div>';
  }
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  loadProfile();
  tg.HapticFeedback?.impactOccurred('light');
});

document.querySelector('[data-tab="games"]').addEventListener('click', loadGames);
document.querySelector('[data-tab="shop"]').addEventListener('click', loadShop);

loadUserInfo();
loadProfile();
