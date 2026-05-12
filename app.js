const audioPlayer = document.getElementById('audio-player');
const lyricsContainer = document.getElementById('lyrics-container');
const playPauseBtn = document.getElementById('play-pause-btn');
const miniPlayBtn = document.getElementById('mini-play-btn');
const flPlayBtn = document.getElementById('fl-play-btn'); 
const progressBar = document.getElementById('progress-bar');
const timeCurrentLabel = document.getElementById('time-current');
const timeTotalLabel = document.getElementById('time-total');
const volumeBar = document.getElementById('volume-bar');
const volumeIcon = document.getElementById('volume-icon');
const repeatBtn = document.getElementById('repeat-btn');
const shuffleBtn = document.getElementById('shuffle-btn');

let currentCategory = 'all';
let favoriteIds = JSON.parse(localStorage.getItem('myFavSongs')) || [];
let recentSongIds = JSON.parse(localStorage.getItem('myRecentSongs')) || [];
let currentSongIndexInList = 0;
let currentPlaylist = [];
let lyricsData = [];
let currentLineIndex = -1;
let isDragging = false;
let repeatMode = 0; 
let showTranslation = true;
let isShuffle = false;
let currentSortMode = 'default';

let currentPlayModeState = 0;
let allSongs = [];

function switchNav(tab) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav-${tab}`).classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');
  if (tab === 'home') renderHome();
  else if (tab === 'library') changeCategory(currentCategory);
  else if (tab === 'search') filterSearch();
}

function toggleNowPlaying(open) {
  const overlay = document.getElementById('page-now-playing');
  const miniLyricsBar = document.getElementById('mini-lyrics-bar');
  const miniPlayer = document.getElementById('mini-player');
  const bottomNav = document.querySelector('.bottom-nav');

  if (open && audioPlayer.src && audioPlayer.src !== window.location.href) {
    overlay.classList.add('active');
    if (miniLyricsBar) miniLyricsBar.classList.add('hidden');
    if (miniPlayer) miniPlayer.classList.add('hidden');
    if (bottomNav) bottomNav.classList.add('hidden');
  } else {
    overlay.classList.remove('active');
    if (miniLyricsBar) miniLyricsBar.classList.remove('hidden');
    if (miniPlayer) miniPlayer.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');
  }
}

// 🌟 展開或關閉更多設定面板
function toggleMoreOptions(show) {
  const sheet = document.getElementById('more-options-sheet');
  if (!sheet) return;
  if (show) {
    sheet.classList.add('active');
  } else {
    sheet.classList.remove('active');
  }
}

// 🌟 設定播放倍速，並同步更新 UI 與本機儲存
function setPlaySpeed(speed) {
  audioPlayer.playbackRate = speed;
  localStorage.setItem('myPlaySpeed', speed);
  
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.innerText) === speed);
  });
  
  // 延遲一點點收攏面板，讓點擊回饋更有手感
  setTimeout(() => toggleMoreOptions(false), 150);
}

function cycleLyricsMode() {
  currentPlayModeState = (currentPlayModeState + 1) % 3;
  const page = document.getElementById('page-now-playing');
  const icon = document.getElementById('mode-btn-icon');
  const text = document.getElementById('mode-btn-text');

  page.classList.remove('mode-full-lyrics', 'mode-focus-singing');

  if (currentPlayModeState === 0) {
    icon.className = 'ti ti-photo'; text.innerText = '封面';
  } else if (currentPlayModeState === 1) {
    page.classList.add('mode-full-lyrics');
    icon.className = 'ti ti-file-text'; text.innerText = '全頁歌詞';
  } else if (currentPlayModeState === 2) {
    page.classList.add('mode-focus-singing');
    icon.className = 'ti ti-microphone'; text.innerText = 'KTV專注';
  }

  if (currentLineIndex !== -1) {
    const activeLine = document.getElementById(`line-${currentLineIndex}`);
    if (activeLine) activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

const npLyricsWrapper = document.getElementById('np-lyrics-wrapper');
npLyricsWrapper.addEventListener('click', (e) => {
  if (currentPlayModeState === 2 && (e.target === npLyricsWrapper || e.target.id === 'lyrics-container' || e.target.id === 'ktv-pause-hint')) {
    togglePlay();
  }
});

function renderHome() {
  const recRow = document.getElementById('recommend-row');
  recRow.innerHTML = '';
  const shuffled = [...allSongs].sort(() => 0.5 - Math.random()).slice(0, 5);
  shuffled.forEach((song, idx) => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.innerHTML = `<div class="album-thumb grad-${(idx%4)+1}"><i class="ti ti-music"></i></div>
                      <div class="album-card-name">${song.title}</div>
                      <div class="album-card-artist">${song.artist}</div>`;
    card.onclick = () => playSongById(song.id);
    recRow.appendChild(card);
  });

  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = '';
  const recentSongs = recentSongIds.map(id => allSongs.find(s => s.id === id)).filter(Boolean);
  if (recentSongs.length === 0) {
    recentList.innerHTML = '<div style="text-align:center; color:var(--color-text-tertiary); font-size:13px; padding:10px 0;">尚無播放紀錄</div>';
    return;
  }
  recentSongs.forEach(song => {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.innerHTML = `<div class="track-thumb grad-1"><i class="ti ti-music"></i></div>
                      <div class="track-info" onclick="playSongById('${song.id}')">
                        <div class="track-name">${song.title}</div>
                        <div class="track-meta">${song.artist}<span class="category-tag">${song.category}</span></div>
                      </div>`;
    recentList.appendChild(item);
  });
}

function clearRecent() {
  recentSongIds = []; localStorage.removeItem('myRecentSongs'); renderHome();
}

function changeCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('#category-tabs .cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  document.getElementById('library-title').innerText = cat === 'favorites' ? "我的收藏 🤍" : "音樂庫";
  renderCustomList('library-song-list', cat, '');
}

function filterSearch() {
  const query = document.getElementById('search-input').value;
  renderCustomList('search-result-list', 'all', query);
}

function changeSortMode(mode) {
  currentSortMode = mode;
  if (document.getElementById('page-search').classList.contains('active')) filterSearch();
  else changeCategory(currentCategory);
}

function renderCustomList(containerId, cat, query) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  let filtered = allSongs.filter(s => {
    if (cat === 'favorites' && !favoriteIds.includes(s.id)) return false;
    if (cat !== 'all' && cat !== 'favorites' && s.category !== cat) return false;
    return s.title.toLowerCase().includes(query.toLowerCase()) || s.artist.toLowerCase().includes(query.toLowerCase());
  });

  if (currentSortMode === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
  else if (currentSortMode === 'artist') filtered.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-Hant'));

  currentPlaylist = filtered;
  filtered.forEach((song, idx) => {
    const isFav = favoriteIds.includes(song.id);
    const li = document.createElement('li');
    li.className = 'track-item';
    li.innerHTML = `<div class="track-thumb grad-1"><i class="ti ti-music"></i></div>
                    <div class="track-info" onclick="playSong(${idx})">
                      <div class="track-name">${song.title}</div>
                      <div class="track-meta">${song.artist}<span class="category-tag">${song.category}</span></div>
                    </div>
                    <i class="ti ti-heart ${isFav ? 'active' : ''}" onclick="toggleFavFromList('${song.id}', event)"></i>`;
    container.appendChild(li);
  });
}

function toggleFavFromList(songId, event) {
  event.stopPropagation();
  if (favoriteIds.includes(songId)) favoriteIds = favoriteIds.filter(id => id !== songId);
  else favoriteIds.push(songId);
  localStorage.setItem('myFavSongs', JSON.stringify(favoriteIds));
  
  if (document.getElementById('page-library').classList.contains('active')) changeCategory(currentCategory);
  if (document.getElementById('page-search').classList.contains('active')) filterSearch();
  
  const cur = currentPlaylist[currentSongIndexInList];
  if (cur && cur.id === songId) updateFavBtnUI(favoriteIds.includes(songId));
}

function toggleCurrentFavorite() {
  const cur = currentPlaylist[currentSongIndexInList];
  if (!cur) return;
  if (favoriteIds.includes(cur.id)) favoriteIds = favoriteIds.filter(id => id !== cur.id);
  else favoriteIds.push(cur.id);
  localStorage.setItem('myFavSongs', JSON.stringify(favoriteIds));
  updateFavBtnUI(favoriteIds.includes(cur.id));
  if (document.getElementById('page-library').classList.contains('active')) changeCategory(currentCategory);
}

function updateFavBtnUI(isFav) {
  document.getElementById('np-fav-btn').className = isFav ? 'ti ti-heart active' : 'ti ti-heart';
}

function playSongById(id) {
  const song = allSongs.find(s => s.id === id);
  if (!song) return; currentPlaylist = [song]; playSong(0);
}

function playSong(index) {
  const song = currentPlaylist[index];
  if (!song) return; currentSongIndexInList = index;
  
  document.getElementById('mini-title').innerText = song.title;
  document.getElementById('mini-artist').innerText = song.artist;
  document.getElementById('np-title').innerText = song.title;
  document.getElementById('np-artist').innerText = song.artist;
  document.getElementById('np-category').innerText = song.category || '未分類';
  
  document.getElementById('fl-title').innerText = song.title;
  document.getElementById('fl-artist').innerText = song.artist;

  updateFavBtnUI(favoriteIds.includes(song.id));
  
  recentSongIds = [song.id, ...recentSongIds.filter(i => i !== song.id)].slice(0, 20);
  localStorage.setItem('myRecentSongs', JSON.stringify(recentSongIds));
  if (document.getElementById('page-home').classList.contains('active')) renderHome();

  audioPlayer.src = song.audio; 
  
  // 🌟 確保換歌時繼承使用者設定的播放倍速
  let savedSpeed = parseFloat(localStorage.getItem('myPlaySpeed')) || 1.0;
  audioPlayer.playbackRate = savedSpeed;
  
  fetchLyrics(song.lyrics); 
  audioPlayer.play(); 
  updatePlayPauseUI(true);
  
  toggleNowPlaying(true);
}

function togglePlay() {
  if (audioPlayer.paused) { audioPlayer.play(); updatePlayPauseUI(true); }
  else { audioPlayer.pause(); updatePlayPauseUI(false); }
}

function updatePlayPauseUI(playing) {
  const icon = playing ? 'ti ti-player-pause' : 'ti ti-player-play';
  playPauseBtn.innerHTML = `<i class="${icon}"></i>`;
  miniPlayBtn.className = icon;
  if (flPlayBtn) flPlayBtn.className = icon; 
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 2; repeatBtn.classList.toggle('active', repeatMode === 1);
  repeatBtn.innerHTML = `<i class="${repeatMode === 1 ? 'ti ti-repeat-once' : 'ti ti-repeat'}"></i>`;
}

function toggleShuffle() {
  isShuffle = !isShuffle; shuffleBtn.classList.toggle('active', isShuffle);
}

function playNext() { 
  if (currentPlaylist.length === 0) return;
  let nextIdx = isShuffle && currentPlaylist.length > 1 ? 
    Math.floor(Math.random() * currentPlaylist.length) : (currentSongIndexInList + 1) % currentPlaylist.length;
  playSong(nextIdx); 
}

function playPrevious() { 
  if (currentPlaylist.length === 0) return;
  playSong((currentSongIndexInList - 1 + currentPlaylist.length) % currentPlaylist.length); 
}

progressBar.addEventListener('input', (e) => {
  isDragging = true;
  if (audioPlayer.duration) timeCurrentLabel.innerText = formatTime((e.target.value / 100) * audioPlayer.duration);
});

progressBar.addEventListener('change', (e) => {
  isDragging = false;
  if (audioPlayer.duration) audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
});

volumeBar.addEventListener('input', (e) => {
  audioPlayer.volume = e.target.value / 100; localStorage.setItem('mySavedVolume', audioPlayer.volume); updateVolumeIcon(audioPlayer.volume);
});

function toggleMute() {
  if (audioPlayer.volume > 0) { audioPlayer.dataset.lastVol = audioPlayer.volume; audioPlayer.volume = 0; } 
  else { audioPlayer.volume = audioPlayer.dataset.lastVol || 1; }
  volumeBar.value = audioPlayer.volume * 100; localStorage.setItem('mySavedVolume', audioPlayer.volume); updateVolumeIcon(audioPlayer.volume);
}

function updateVolumeIcon(v) {
  const icon = document.getElementById('volume-icon');
  if (v === 0) icon.className = 'ti ti-volume-3'; else if (v < 0.5) icon.className = 'ti ti-volume-2'; else icon.className = 'ti ti-volume';
}

audioPlayer.addEventListener('timeupdate', () => {
  if (audioPlayer.ended) {
    if (repeatMode === 1) { audioPlayer.currentTime = 0; audioPlayer.play(); } else playNext();
  }

  if (audioPlayer.duration && !isDragging) {
    progressBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    timeCurrentLabel.innerText = formatTime(audioPlayer.currentTime); timeTotalLabel.innerText = formatTime(audioPlayer.duration);
  }

  const activeIndex = lyricsData.findLastIndex(l => audioPlayer.currentTime >= l.startTime);
  if (activeIndex !== -1 && activeIndex !== currentLineIndex) {
    const firstLine = document.getElementById('line-0');
    if (firstLine) firstLine.classList.remove('ready-line');

    currentLineIndex = activeIndex;
    document.querySelectorAll('.lyric-line').forEach(l => l.classList.remove('active'));
    const activeLine = document.getElementById(`line-${currentLineIndex}`);
    if (activeLine) {
      activeLine.classList.add('active');
      activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    const cur = lyricsData[currentLineIndex];
    if (cur) {
      document.getElementById('mini-lyric-text').innerHTML = cur.words.map(w => `<ruby>${w.text}<rt>${w.furigana || ''}</rt></ruby>`).join('');
      const originalText = cur.words.map(w => w.text).join('');
      const transEl = document.getElementById('mini-lyric-trans');
      if (cur.translation && cur.translation !== originalText) {
        transEl.innerText = cur.translation; transEl.classList.toggle('hidden', !showTranslation);
      } else { transEl.classList.add('hidden'); }
    }
  }
});

async function fetchLyrics(url) {
  lyricsContainer.innerHTML = '<div style="text-align:center; color:var(--color-text-secondary); font-size:14px;">歌詞載入中...</div>';
  currentLineIndex = -1;
  try {
    const res = await fetch(url); lyricsData = await res.json(); lyricsContainer.innerHTML = '';
    lyricsData.forEach((line, idx) => {
      const lineDiv = document.createElement('div'); lineDiv.className = 'lyric-line'; lineDiv.id = `line-${idx}`;
      const wordsHTML = line.words.map(w => `<ruby>${w.text}<rt>${w.furigana || ''}</rt></ruby>`).join('');
      const originalText = line.words.map(w => w.text).join('');
      let transHTML = '';
      if (line.translation && line.translation.trim() !== '' && line.translation !== originalText) {
        transHTML = `<div class="translation ${showTranslation ? '' : 'hidden'}">${line.translation}</div>`;
      }
      lineDiv.innerHTML = `<div>${wordsHTML}</div>${transHTML}`;
      lineDiv.onclick = (e) => {
        e.stopPropagation(); audioPlayer.currentTime = line.startTime + 0.01; audioPlayer.play(); updatePlayPauseUI(true);
      };
      lyricsContainer.appendChild(lineDiv);
    });

    setTimeout(() => {
      const firstLine = document.getElementById('line-0'); if (firstLine) firstLine.classList.add('ready-line');
    }, 100);

  } catch (e) {
    lyricsContainer.innerHTML = '<div style="text-align:center; color:var(--color-text-secondary); font-size:14px;">純音樂或載入失敗</div>';
  }
}

function formatTime(s) {
  if (isNaN(s)) return "0:00"; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function changeFontSize(s) {
  const size = parseInt(s);
  document.documentElement.style.setProperty('--lyric-font-size', size + 'px');
  document.documentElement.style.setProperty('--lyric-ruby-size', Math.max(10, size * 0.5) + 'px');
  document.documentElement.style.setProperty('--lyric-trans-size', Math.max(12, size * 0.65) + 'px');
  localStorage.setItem('myLyricFontSize', size);
}

function toggleTranslationSetting(c) {
  showTranslation = c; localStorage.setItem('myShowTranslation', c);
  document.querySelectorAll('.translation').forEach(el => el.classList.toggle('hidden', !c));
  const miniTrans = document.getElementById('mini-lyric-trans');
  if (miniTrans && miniTrans.innerText.trim() !== '') miniTrans.classList.toggle('hidden', !c);
}

function initSettings() {
  let savedVol = localStorage.getItem('mySavedVolume');
  if (savedVol !== null) { audioPlayer.volume = parseFloat(savedVol); volumeBar.value = audioPlayer.volume * 100; updateVolumeIcon(audioPlayer.volume); }
  
  let savedSize = localStorage.getItem('myLyricFontSize');
  if (savedSize) { document.getElementById('font-size-slider').value = savedSize; changeFontSize(savedSize); }
  
  let savedTrans = localStorage.getItem('myShowTranslation');
  if (savedTrans !== null) { showTranslation = savedTrans === 'true'; document.getElementById('translation-toggle').checked = showTranslation; toggleTranslationSetting(showTranslation); }
  
  // 🌟 讀取自訂的播放速度設定並更新按鈕狀態
  let savedSpeed = parseFloat(localStorage.getItem('myPlaySpeed')) || 1.0;
  audioPlayer.playbackRate = savedSpeed;
  setTimeout(() => {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.innerText) === savedSpeed);
    });
  }, 100);

  renderHome();
}

async function loadSongsAndInit() {
  try {
    const response = await fetch('songs.json');
    if (!response.ok) throw new Error('無法讀取歌單檔案');
    allSongs = await response.json();
    initSettings();
  } catch (error) {
    console.error('載入歌單失敗:', error);
    if (lyricsContainer) {
      lyricsContainer.innerHTML = '<div style="text-align:center; color:var(--color-text-secondary); font-size:14px;">載入歌單失敗，請確認 songs.json 檔案是否存在。</div>';
    }
  }
}

loadSongsAndInit();