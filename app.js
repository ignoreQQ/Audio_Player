// ==========================================
// 1. 初始化 DOM 元素與全域變數
// ==========================================
const audioPlayer = document.getElementById('audio-player');
const lyricsContainer = document.getElementById('lyrics-container');
const globalPlayer = document.getElementById('global-player');
const playPauseBtn = document.getElementById('play-pause-btn');
const progressBar = document.getElementById('progress-bar');
const timeCurrentLabel = document.getElementById('time-current');
const timeTotalLabel = document.getElementById('time-total');
const volumeBar = document.getElementById('volume-bar');
const volumeIcon = document.getElementById('volume-icon');
const repeatBtn = document.getElementById('repeat-btn');

let currentCategory = 'all'; // 統一使用 currentCategory 管理狀態
let favoriteIds = JSON.parse(localStorage.getItem('myFavSongs')) || [];
let currentSongIndexInList = 0;
let currentPlaylist = [];
let lyricsData = [];
let currentLineIndex = -1;
let isDragging = false;
let repeatMode = 0; 
let showTranslation = true;
let isShuffle = false;
const speeds = [0.75, 1.0, 1.25, 1.5];
let speedIndex = 1; 

// ==========================================
// 2. 曲庫資料庫 
// ==========================================
const allSongs = [
  { 
    id: "N1", title: "Lemon", artist: "米津玄師", category: "日文",
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/Lemon.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/Lemon.json" 
  },
  { 
    id: "N2", title: "ベテルギウス", artist: "優里Yuuri", category: "日文",
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/%E3%83%99%E3%83%86%E3%83%AB%E3%82%AE%E3%82%A6%E3%82%B9.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/%E3%83%99%E3%83%86%E3%83%AB%E3%82%AE%E3%82%A6%E3%82%B9.json" 
  },
  { 
    id: "N3", title: "Teacher", artist: "友成空", category: "日文",
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/Teacher.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/Teacher.json" 
  },
  { 
    id: "N4", title: "バイバイ YESTERDAY", artist: "3年E組", category: "日文",
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/バイバイ YESTERDAY.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/バイバイ YESTERDAY.json" 
  }
];

// ==========================================
// 3. 視圖切換
// ==========================================
function hideAllViews() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

function showHome() { 
  hideAllViews(); 
  document.getElementById('home-view').classList.add('active'); 
}

function showSettings() {
  hideAllViews();
  document.getElementById('settings-view').classList.add('active');
}

function showLibrary(mode) {
  hideAllViews();
  document.getElementById('library-view').classList.add('active');
  document.getElementById('search-input').value = "";
  
  if (mode === 'favorites') {
    document.getElementById('library-title').innerText = "我的收藏 🤍";
    document.getElementById('category-tabs').style.display = 'none'; 
    currentCategory = 'favorites';
    renderSongList();
  } else {
    document.getElementById('library-title').innerText = "曲庫";
    document.getElementById('category-tabs').style.display = 'flex'; 
    changeCategory(mode === 'all' ? 'all' : mode); 
  }
}

function changeCategory(category) {
  currentCategory = category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });
  renderSongList();
}

function renderSongList(searchQuery = "") {
  const listContainer = document.getElementById('song-list');
  listContainer.innerHTML = ''; 

  currentPlaylist = allSongs.filter(song => {
    if (currentCategory === 'favorites' && !favoriteIds.includes(song.id)) return false;
    if (currentCategory !== 'all' && currentCategory !== 'favorites' && song.category !== currentCategory) return false;
    const query = searchQuery.toLowerCase();
    return song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query);
  });

  currentPlaylist.forEach((song, index) => {
    const li = document.createElement('li');
    li.className = 'song-item glass-panel';
    const isFav = favoriteIds.includes(song.id);
    const starSymbol = isFav ? "♥" : "♡";
    const starClass = isFav ? "fav-icon active" : "fav-icon";

    li.innerHTML = `
      <div style="flex-grow: 1;" onclick="playSong(${index})">
        <div style="font-size: 18px; font-weight: bold;">${song.title}</div>
        <div style="font-size: 14px; color: #555;">${song.artist} <span style="background:#eee; padding:2px 6px; border-radius:10px; font-size:10px; margin-left:5px;">${song.category || '未分類'}</span></div>
      </div>
      <div class="${starClass}" onclick="toggleFavorite('${song.id}', event)">${starSymbol}</div>
    `;
    listContainer.appendChild(li);
  });
}

function filterSongs() { renderSongList(document.getElementById('search-input').value); }

function toggleFavorite(songId, event) {
  event.stopPropagation(); 
  if (favoriteIds.includes(songId)) favoriteIds = favoriteIds.filter(id => id !== songId);
  else favoriteIds.push(songId);
  localStorage.setItem('myFavSongs', JSON.stringify(favoriteIds));
  filterSongs(); 
}

// ==========================================
// 4. 播放控制邏輯
// ==========================================
function playSong(index) {
  if (index < 0 || index >= currentPlaylist.length) return;
  currentSongIndexInList = index;
  const song = currentPlaylist[index];
  
  document.getElementById('ui-title').innerText = song.title;
  document.getElementById('ui-artist').innerText = song.artist;
  
  globalPlayer.classList.add('active-player');
  // 自動進入迷你模式以免擋住歌詞
  globalPlayer.classList.add('mini-mode'); 
  document.getElementById('toggle-icon').innerText = '🔼'; 
  
  showPlayerView(); 
  
  audioPlayer.src = song.audio;
  audioPlayer.playbackRate = speeds[speedIndex]; 
  fetchLyrics(song.lyrics);
  audioPlayer.play();
  playPauseBtn.innerText = '⏸';

  updateMediaSession(song);
}

function showPlayerView() {
  hideAllViews();
  document.getElementById('player-view').classList.add('active');
}

function togglePlay() {
  if (audioPlayer.paused) { audioPlayer.play(); playPauseBtn.innerText = '⏸'; }
  else { audioPlayer.pause(); playPauseBtn.innerText = '▶️'; }
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 2;
  repeatBtn.innerText = (repeatMode === 0) ? '🔁' : '🔂';
  repeatBtn.classList.toggle('active', repeatMode === 1);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  const shuffleBtn = document.getElementById('shuffle-btn');
  shuffleBtn.classList.toggle('active', isShuffle);
}

function playNext() { 
  let nextIndex;
  if (isShuffle) {
    do { nextIndex = Math.floor(Math.random() * currentPlaylist.length); } 
    while (nextIndex === currentSongIndexInList && currentPlaylist.length > 1);
  } else {
    nextIndex = (currentSongIndexInList + 1) % currentPlaylist.length;
  }
  playSong(nextIndex); 
}

function playPrevious() { playSong((currentSongIndexInList - 1 + currentPlaylist.length) % currentPlaylist.length); }
function skipTime(seconds) { audioPlayer.currentTime += seconds; }

// ==========================================
// 5. 音量與進度條監聽
// ==========================================
volumeBar.addEventListener('input', (e) => {
  const vol = e.target.value / 100;
  audioPlayer.volume = vol;
  localStorage.setItem('mySavedVolume', vol);
  updateVolumeIcon(vol);
});

function toggleMute() {
  if (audioPlayer.volume > 0) {
    audioPlayer.dataset.lastVol = audioPlayer.volume;
    audioPlayer.volume = 0;
    volumeBar.value = 0;
  } else {
    const restoreVol = audioPlayer.dataset.lastVol || 1;
    audioPlayer.volume = restoreVol;
    volumeBar.value = restoreVol * 100;
  }
  localStorage.setItem('mySavedVolume', audioPlayer.volume);
  updateVolumeIcon(audioPlayer.volume);
}

function updateVolumeIcon(vol) {
  if (vol === 0) volumeIcon.innerText = '🔇';
  else if (vol < 0.5) volumeIcon.innerText = '🔉';
  else volumeIcon.innerText = '🔊';
}

audioPlayer.addEventListener('durationchange', () => {
  if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
    timeTotalLabel.innerText = formatTime(audioPlayer.duration);
  }
});

progressBar.addEventListener('input', (e) => {
  isDragging = true;
  if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
    const targetTime = (e.target.value / 100) * audioPlayer.duration;
    timeCurrentLabel.innerText = formatTime(targetTime);
  }
});

progressBar.addEventListener('change', (e) => {
  isDragging = false;
  if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
  }
});

audioPlayer.addEventListener('timeupdate', () => {
  if (audioPlayer.ended) { 
    if (repeatMode === 1) { audioPlayer.currentTime = 0; audioPlayer.play(); }
    else { playNext(); }
  }
  
  if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
    if (timeTotalLabel.innerText === "0:00") {
      timeTotalLabel.innerText = formatTime(audioPlayer.duration);
    }
    
    if (!isDragging) {
      const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      progressBar.value = percent;
      timeCurrentLabel.innerText = formatTime(audioPlayer.currentTime);
    }
  }

  const activeIndex = lyricsData.findLastIndex(line => audioPlayer.currentTime >= line.startTime);
  if (activeIndex !== currentLineIndex && activeIndex !== -1) {
    const oldLine = document.getElementById(`line-${currentLineIndex}`);
    if(oldLine) oldLine.classList.remove('active');
    currentLineIndex = activeIndex;
    const activeLine = document.getElementById(`line-${currentLineIndex}`);
    if(activeLine) {
      activeLine.classList.add('active');
      activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

// ==========================================
// 6. 輔助功能
// ==========================================
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function fetchLyrics(url) {
  lyricsContainer.innerHTML = '<div style="text-align:center; color:#888;">歌詞載入中...</div>';
  currentLineIndex = -1;
  try {
    const response = await fetch(url);
    lyricsData = await response.json();
    lyricsContainer.innerHTML = ''; 
    lyricsData.forEach((line, index) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'lyric-line';
      lineDiv.id = `line-${index}`;
      let wordsHTML = line.words.map(w => `<ruby>${w.text}<rt>${w.furigana || ''}</rt></ruby>`).join('');
      const hiddenClass = showTranslation ? '' : 'hidden';
      lineDiv.innerHTML = `<div>${wordsHTML}</div><div class="translation ${hiddenClass}">${line.translation}</div>`;
      lineDiv.onclick = () => { audioPlayer.currentTime = line.startTime + 0.01; audioPlayer.play(); };
      lyricsContainer.appendChild(lineDiv);
    });
  } catch (e) { lyricsContainer.innerHTML = "歌詞載入失敗"; }
}

function updateMediaSession(song) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title, artist: song.artist, album: '日文歌學習',
      artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }]
    });
    navigator.mediaSession.setActionHandler('play', () => audioPlayer.play());
    navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  }
}

// ==========================================
// 7. 迷你播放器切換
// ==========================================
function togglePlayerMode() {
  globalPlayer.classList.toggle('mini-mode');
  const icon = document.getElementById('toggle-icon');
  
  if (globalPlayer.classList.contains('mini-mode')) {
    icon.innerText = '🔼'; 
  } else {
    icon.innerText = '🔽'; 
  }
}

// ==========================================
// 8. 系統設定 (合併音量與字體大小記憶)
// ==========================================
function changeFontSize(baseSize) {
  const size = parseInt(baseSize);
  document.documentElement.style.setProperty('--lyric-font-size', size + 'px');
  document.documentElement.style.setProperty('--lyric-ruby-size', Math.max(10, size * 0.5) + 'px');
  document.documentElement.style.setProperty('--lyric-trans-size', Math.max(12, size * 0.65) + 'px');
  
  localStorage.setItem('myLyricFontSize', size); 
}
function initSettings() {
  // 1. 讀取音量設定
  let savedVolume = localStorage.getItem('mySavedVolume');
  if (savedVolume !== null) {
    audioPlayer.volume = parseFloat(savedVolume);
    volumeBar.value = audioPlayer.volume * 100;
    updateVolumeIcon(audioPlayer.volume);
  }

  // 2. 讀取字體大小設定
  let savedFontSize = localStorage.getItem('myLyricFontSize');
  if (savedFontSize) {
    document.getElementById('font-size-slider').value = savedFontSize;
    changeFontSize(savedFontSize);
  }

  // 🌟 3. 讀取翻譯顯示設定
  let savedTranslation = localStorage.getItem('myShowTranslation');
  if (savedTranslation !== null) {
    showTranslation = (savedTranslation === 'true'); // localStorage 存的是字串
    document.getElementById('translation-toggle').checked = showTranslation;
    toggleTranslationSetting(showTranslation); // 套用到畫面上
  }
}

function toggleTranslationSetting(isChecked) {
  showTranslation = isChecked;
  localStorage.setItem('myShowTranslation', isChecked); // 記憶到手機端
  
  // 立即更新畫面上所有的翻譯區塊 (包含預覽區塊和歌詞區塊)
  document.querySelectorAll('.translation').forEach(el => {
    el.classList.toggle('hidden', !showTranslation);
  });
}

// 執行初始化
initSettings();