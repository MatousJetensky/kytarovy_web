const pages = ['home', 'about', 'chords', 'gallery'];

let currentIndex = parseInt(localStorage.getItem('currentIndex')) || 0;
let rotation = parseInt(localStorage.getItem('rotation')) || 0;

const wheel = document.getElementById('wheel');
const arrowLeft = document.querySelector('.arrow-left');
const arrowRight = document.querySelector('.arrow-right');
const content = document.getElementById('page-content');

// Ošetření pro případ že některý prvek neexistuje (např. při testování)
if (wheel) {
  wheel.style.transition = 'none';
  wheel.style.transform = `rotate(${rotation}deg)`;
  setTimeout(() => { wheel.style.transition = ''; }, 50);
}

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
//  SDÍLENÉ FUNKCE — oblíbené (localStorage)
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

  // --- Akordy z textu ---
  function extractChords(lyrics) {
    const matches = [...lyrics.matchAll(/\[([A-G][#b]?(?:m|maj|min|aug|dim|sus|add)?[0-9]*)\]/g)];
    const unique  = [...new Set(matches.map(m => m[1]))];
    if (!unique.length) { chordsCard.style.display = 'none'; return; }

    chordsCard.style.display = 'block';
    renderChordTags(unique, 'chordsGrid');
  }

  // --- Ruční akord ---
  function lookupChord(chord) {
    if (!chord) return;
    renderChordTags([chord], 'singleChordGrid');
  }

  // --- Render tagů akordů (kliknutelné) ---
  function renderChordTags(chords, gridId) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = chords.map(c =>
      `<span class="tag" style="cursor:pointer" onclick="showChordDiagram('${c}')">${c}</span>`
    ).join('');
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

// --- Diagram akordu (globální, volá se z onclick v tagu) ---
async function showChordDiagram(chord) {
  // Najdeme grid kam vykreslit — buď singleChordGrid nebo chordsGrid
  const grid = document.getElementById('singleChordGrid') || document.getElementById('chordsGrid');
  if (!grid) return;

  try {
    const res  = await fetch(`https://api.uberchord.com/v1/chords/${encodeURIComponent(chord)}`);
    const data = await res.json();
    if (data && data[0]) {
      grid.innerHTML = buildChordSVG(chord, data[0]);
    } else {
      grid.innerHTML = `<span class="tag">${chord} — diagram nenalezen</span>`;
    }
  } catch {
    grid.innerHTML = `<span class="tag">${chord} — chyba načítání</span>`;
  }
}

function buildChordSVG(name, data) {
  const strings = (data.strings || '').split(',').map(s => s.trim());
  const fingers = (data.fingers || '').split(',').map(s => s.trim());
  const frets   = strings.map(Number);

  const W = 80, H = 90, cols = 6, rows = 5;
  const padL = 14, padT = 18, padR = 6;
  const cw = (W - padL - padR) / (cols - 1);
  const rh = (H - padT - 10) / rows;

  const played   = frets.filter(f => f > 0);
  const minFret  = played.length ? Math.min(...played) : 1;
  const startFret = minFret > 1 ? minFret : 1;

  let svg = `<div style="text-align:center;display:inline-block;margin:8px">
    <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#e8a030;margin-bottom:6px">${name}</div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  if (startFret > 1) {
    svg += `<text x="${padL-2}" y="${padT + rh*0.6}" font-size="7" fill="rgba(232,160,48,0.6)" text-anchor="end">${startFret}fr</text>`;
  }

  for (let r = 0; r <= rows; r++) {
    const y  = padT + r * rh;
    const sw = r === 0 ? 2.5 : 0.8;
    svg += `<line x1="${padL}" y1="${y}" x2="${padL + cw*(cols-1)}" y2="${y}" stroke="rgba(245,237,224,0.5)" stroke-width="${sw}"/>`;
  }
  for (let c = 0; c < cols; c++) {
    const x = padL + c * cw;
    svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + rows*rh}" stroke="rgba(245,237,224,0.4)" stroke-width="0.8"/>`;
  }

  for (let c = 0; c < cols; c++) {
    const x = padL + c * cw;
    const f = frets[c];
    const fin = fingers[c] || '0';

    if (f === 0) {
      svg += `<text x="${x}" y="${padT-5}" font-size="7" fill="rgba(245,237,224,0.6)" text-anchor="middle">O</text>`;
    } else if (isNaN(f) || f < 0) {
      svg += `<text x="${x}" y="${padT-5}" font-size="7" fill="rgba(232,160,48,0.6)" text-anchor="middle">×</text>`;
    } else {
      const row = f - startFret;
      if (row >= 0 && row < rows) {
        const cy = padT + row * rh + rh / 2;
        svg += `<circle cx="${x}" cy="${cy}" r="${cw*0.38}" fill="#e8a030"/>`;
        if (fin !== '0') svg += `<text x="${x}" y="${cy+2.5}" font-size="6.5" fill="#0a0604" text-anchor="middle" dominant-baseline="middle">${fin}</text>`;
      }
    }
  }

  svg += `</svg></div>`;
  return svg;
}


// =============================================
//  CHORDS (= Oblíbené) — zobrazí uložené písně
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