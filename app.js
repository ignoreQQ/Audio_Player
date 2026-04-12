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

let currentIsFavorites = false;
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
  id: "s1", 
  title: "Lemon", 
  artist: "米津玄師", 
  audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/Lemon.mp3", 
  lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/Lemon.json" 
  },
  { id: "s2", 
    title: "ベテルギウス", 
    artist: "優里Yuuri", 
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/%E3%83%99%E3%83%86%E3%83%AB%E3%82%AE%E3%82%A6%E3%82%B9.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/%E3%83%99%E3%83%86%E3%83%AB%E3%82%AE%E3%82%A6%E3%82%B9.json" 
  },
  { id: "s3", 
    title: "Teacher", 
    artist: "友成空", 
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/Teacher.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/Teacher.json" 
  },
  { 
    id: "s4",
    title: "バイバイ YESTERDAY", 
    artist: "歌手名", 
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/バイバイ YESTERDAY.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/バイバイ YESTERDAY.json" 
  },

];
/*
範本
{ 
    id: "",
    title: "歌名", 
    artist: "歌手名", 
    audio: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Music/歌名.mp3", 
    lyrics: "https://raw.githubusercontent.com/ignoreQQ/Music/main/Lyrics/歌詞.json" 
},
*/


// ==========================================
// 3. 視圖切換
// ==========================================
function hideAllViews() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

function showHome() { hideAllViews(); document.getElementById('home-view').classList.add('active'); }

function showLibrary(onlyFavorites) {
  hideAllViews();
  currentIsFavorites = onlyFavorites;
  document.getElementById('library-view').classList.add('active');
  document.getElementById('library-title').innerText = onlyFavorites ? "我的收藏" : "全部歌曲";
  document.getElementById('search-input').value = "";
  renderSongList();
}

function showPlayerView() {
  hideAllViews();
  document.getElementById('player-view').classList.add('active');
}

function renderSongList(searchQuery = "") {
  const listContainer = document.getElementById('song-list');
  listContainer.innerHTML = ''; 

  currentPlaylist = allSongs.filter(song => {
    if (currentIsFavorites && !favoriteIds.includes(song.id)) return false;
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
        <div style="font-size: 14px; color: #555;">${song.artist}</div>
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
  
  showPlayerView(); 
  
  audioPlayer.src = song.audio;
  audioPlayer.playbackRate = speeds[speedIndex]; 
  fetchLyrics(song.lyrics);
  audioPlayer.play();
  playPauseBtn.innerText = '⏸';

  updateMediaSession(song);
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
function initSettings() {
  let savedVolume = localStorage.getItem('mySavedVolume');
  if (savedVolume !== null) {
    audioPlayer.volume = parseFloat(savedVolume);
    volumeBar.value = audioPlayer.volume * 100;
    updateVolumeIcon(audioPlayer.volume);
  }
}

volumeBar.addEventListener('input', (e) => {
  const vol = e.target.value / 100;
  audioPlayer.volume = vol;
  localStorage.setItem('mySavedVolume', vol);
  updateVolumeIcon(vol);
});

// ...前面的音量邏輯...
function updateVolumeIcon(vol) {
  if (vol === 0) volumeIcon.innerText = '🔇';
  else if (vol < 0.5) volumeIcon.innerText = '🔉';
  else volumeIcon.innerText = '🔊';
}

// 🌟 改用 durationchange，對網路串流音檔支援度最好
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
  
  // 🌟 雙重保險：確保音樂播放時能確實更新總長度與進度條
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

  // 歌詞同步處理
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
  lyricsContainer.innerHTML = '歌詞載入中...';
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
      lineDiv.innerHTML = `<div>${wordsHTML}</div><div class="translation">${line.translation}</div>`;
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
    icon.innerText = '🔼'; // 縮小時變成向上箭頭，提示可以展開
  } else {
    icon.innerText = '🔽'; // 展開時變成向下箭頭
  }
}

initSettings();

