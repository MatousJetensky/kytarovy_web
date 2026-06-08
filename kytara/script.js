const pages = ['home', 'about', 'chords', 'gallery'];

let currentIndex = parseInt(localStorage.getItem('currentIndex')) || 0;
let rotation = parseInt(localStorage.getItem('rotation')) || 0;

const wheel = document.getElementById('wheel');
const arrowLeft = document.querySelector('.arrow-left');
const arrowRight = document.querySelector('.arrow-right');
const content = document.getElementById('page-content');

async function loadPage(name) {
  if (!content) return;
  try {
    const res = await fetch(`pages/${name}.html`);
    if (!res.ok) throw new Error('Page not found: ' + res.status);
    const html = await res.text();
    content.innerHTML = html;
    content.style.animation = 'none';
    content.offsetHeight;
    content.style.animation = '';

    if (name === 'home')   initHome();
    if (name === 'chords') initFavorites();

  } catch (e) {
    console.error('loadPage error', e);
    content.innerHTML = '<p>Obsah se nepodařilo načíst.</p>';
  }
}

function navigate(direction) {
  rotation += direction * -90;
  if (wheel) wheel.style.transform = `rotate(${rotation}deg)`;
  currentIndex = (currentIndex - direction + pages.length) % pages.length;
  localStorage.setItem('currentIndex', currentIndex);
  localStorage.setItem('rotation', rotation);
  loadPage(pages[currentIndex]);
}
if (arrowRight) arrowRight.addEventListener('click', () => navigate(1));
if (arrowLeft)  arrowLeft.addEventListener('click',  () => navigate(-1));

// Načti počáteční stránku
loadPage(pages[currentIndex]);


// =============================================
// oblíbené (localStorage)
// =============================================
function getFavs() {
  return JSON.parse(localStorage.getItem('mg_favs') || '[]');
}
function saveFavs(favs) {
  localStorage.setItem('mg_favs', JSON.stringify(favs));
}


// =============================================
//  HOME — vyhledávání + akordy
// =============================================
function initHome() {
  const searchBtn  = document.getElementById('searchBtn');
  const titleInput = document.getElementById('titleInput');
  const statusEl   = document.getElementById('searchStatus');
  const resultCard = document.getElementById('resultCard');
  const chordsCard = document.getElementById('chordsCard');
  const favBtn     = document.getElementById('favBtn');
  const chordBtn   = document.getElementById('chordBtn');
  const chordInput = document.getElementById('chordInput');

  titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchSong(); });
  searchBtn.addEventListener('click', searchSong);
  favBtn.addEventListener('click', toggleFav);
  chordBtn.addEventListener('click', () => lookupChord(chordInput.value.trim()));
  chordInput.addEventListener('keydown', e => { if (e.key === 'Enter') lookupChord(chordInput.value.trim()); });

  // --- Vyhledání písně ---
  async function searchSong() {
    const title = titleInput.value.trim();
    if (!title) { setStatus('Zadej název skladby.', true); return; }

    searchBtn.disabled = true;
    setStatus('Hledám…');
    resultCard.style.display = 'none';
    chordsCard.style.display = 'none';

    try {
      const suggestRes  = await fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(title)}`);
      const suggestData = await suggestRes.json();

      if (!suggestData.data || !suggestData.data.length) {
        setStatus('Skladba nenalezena. Zkus jiný název.', true);
        searchBtn.disabled = false;
        return;
      }

      const song   = suggestData.data[0];
      const artist = song.artist.name;
      const name   = song.title;

      const lyricsRes  = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(name)}`);
      const lyricsData = await lyricsRes.json();

      if (lyricsData.error || !lyricsData.lyrics) {
        setStatus('Text písně nebyl nalezen.', true);
        searchBtn.disabled = false;
        return;
      }

      setStatus('');
      showResult(artist, name, lyricsData.lyrics);

    } catch {
      setStatus('Chyba připojení. Zkus to znovu.', true);
    }
    searchBtn.disabled = false;
  }

  // --- Zobraz výsledek ---
  function showResult(artist, title, lyrics) {
    document.getElementById('songTitle').textContent   = title;
    document.getElementById('songArtist').textContent  = artist;
    document.getElementById('lyricsBlock').textContent = lyrics;

    resultCard.dataset.artist = artist;
    resultCard.dataset.title  = title;
    resultCard.style.display  = 'block';

    updateFavBtn(artist, title);
    extractChords(lyrics);
  }
  

  // --- Oblíbené ---
  function toggleFav() {
    const artist = resultCard.dataset.artist;
    const title  = resultCard.dataset.title;
    if (!artist || !title) return;

    const key  = `${artist}|||${title}`;
    let favs   = getFavs();
    const idx  = favs.findIndex(f => f.key === key);
    if (idx === -1) favs.push({ key, artist, title });
    else favs.splice(idx, 1);

    saveFavs(favs);
    updateFavBtn(artist, title);
  }

  function updateFavBtn(artist, title) {
    const saved = getFavs().some(f => f.key === `${artist}|||${title}`);
    favBtn.textContent = saved ? '♥ V oblíbených' : '♡ Přidat do oblíbených';
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#e05252' : 'rgba(245,237,224,0.5)';
  }
}




// =============================================
//   (= Oblíbené) — zobrazí uložené písně
// =============================================
function initFavorites() {
  renderFavoritesList();
}

function renderFavoritesList() {
  const list = document.getElementById('favList');
  const favs = getFavs();

  if (!favs.length) {
    list.innerHTML = '<li class="empty-note">Zatím žádné oblíbené. Vyhledej píseň na hlavní stránce!</li>';
    return;
  }

  list.innerHTML = favs.map(f => `
    <li class="fav-item">
      <div>
        <span class="fav-title">${f.title}</span>
        <span class="fav-artist">${f.artist}</span>
      </div>
      <button class="fav-del" data-key="${f.key}">✕</button>
    </li>
  `).join('');

  list.querySelectorAll('.fav-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const favs = getFavs().filter(f => f.key !== btn.dataset.key);
      saveFavs(favs);
      renderFavoritesList();
    });
  });
}
