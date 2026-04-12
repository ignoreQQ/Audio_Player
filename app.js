if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: '歌曲名稱',
    artist: '歌手名字',
    album: '日文歌學習專案',
    artwork: [
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  });

  // 讓鎖定畫面的播放/暫停按鈕也能控制你的播放器
  navigator.mediaSession.setActionHandler('play', () => audioPlayer.play());
  navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
}

// 1. 建立你的「滿滿曲庫」陣列
const allSongs = [
  { id: "s1", title: "Lemon", artist: "米津玄師", audio: "url...", lyrics: "url..." },
  { id: "s2", title: "ベテルギウス", artist: "優里Yuuri", audio: "url...", lyrics: "url..." },
  { id: "s3", title: "Teacher", artist: "友成空", audio: "url...", lyrics: "url..." }
  // 以後用 Python 產生的歌就一直往下加
];

let currentIsFavorites = false;

// 2. 從手機讀取收藏紀錄 (如果是空的就給一個空陣列)
let favoriteIds = JSON.parse(localStorage.getItem('myFavSongs')) || [];

// --- 畫面切換控制 ---
function hideAllViews() {
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('library-view').style.display = 'none';
  document.getElementById('player-view').style.display = 'none';
}

function showHome() {
  hideAllViews();
  document.getElementById('home-view').style.display = 'block';
}

function showLibrary(onlyFavorites) {
  hideAllViews();
  currentIsFavorites = onlyFavorites;
  document.getElementById('library-view').style.display = 'block';
  document.getElementById('library-title').innerText = onlyFavorites ? "我的收藏" : "全部歌曲";
  
  // 清空搜尋框並重新渲染列表
  document.getElementById('search-input').value = "";
  renderSongList();
}

// --- 渲染清單與搜尋功能 ---
function renderSongList(searchQuery = "") {
  const listContainer = document.getElementById('song-list');
  listContainer.innerHTML = ''; // 清空目前的清單

  // 篩選邏輯：先看是不是收藏模式，再看搜尋框有沒有字
  let filteredSongs = allSongs.filter(song => {
    // 檢查收藏
    if (currentIsFavorites && !favoriteIds.includes(song.id)) return false;
    // 檢查搜尋 (轉小寫比對)
    const query = searchQuery.toLowerCase();
    const matchTitle = song.title.toLowerCase().includes(query);
    const matchArtist = song.artist.toLowerCase().includes(query);
    return matchTitle || matchArtist;
  });

  // 把過濾後的歌曲變成 HTML 塞進去
  filteredSongs.forEach(song => {
    const li = document.createElement('li');
    li.className = 'song-item';
    
    // 判斷這首歌有沒有在收藏名單內
    const isFav = favoriteIds.includes(song.id);
    const starClass = isFav ? "fav-icon active" : "fav-icon";
    const starSymbol = isFav ? "♥" : "♡";

    li.innerHTML = `
      <div onclick="playSong('${song.id}')">
        <div style="font-size: 18px; font-weight: bold;">${song.title}</div>
        <div style="font-size: 14px; color: gray;">${song.artist}</div>
      </div>
      <div class="${starClass}" onclick="toggleFavorite('${song.id}', event)">${starSymbol}</div>
    `;
    listContainer.appendChild(li);
  });
}

// 搜尋框輸入時觸發
function filterSongs() {
  const query = document.getElementById('search-input').value;
  renderSongList(query);
}

// --- 收藏功能切換 ---
function toggleFavorite(songId, event) {
  event.stopPropagation(); // 防止點擊愛心時觸發播放歌曲
  
  if (favoriteIds.includes(songId)) {
    // 移除收藏
    favoriteIds = favoriteIds.filter(id => id !== songId);
  } else {
    // 加入收藏
    favoriteIds.push(songId);
  }
  
  // 儲存進手機的 localStorage
  localStorage.setItem('myFavSongs', JSON.stringify(favoriteIds));
  
  // 重新渲染畫面更新愛心狀態
  filterSongs(); 
}

// --- 播放邏輯整合 ---
function playSong(songId) {
  // 找出選中的歌曲
  const song = allSongs.find(s => s.id === songId);
  
  hideAllViews();
  document.getElementById('player-view').style.display = 'block';
  document.getElementById('player-title').innerText = song.title;
  
  // 這裡接上你原本寫好的 fetchLyrics() 與播放邏輯
  // audioPlayer.src = song.audio;
  // loadLyrics(song.lyrics);
  // audioPlayer.play();
}

// ==========================================
    // 6. 音量控制與記憶邏輯
    // ==========================================
    const volumeBar = document.getElementById('volume-bar');
    const volumeIcon = document.getElementById('volume-icon');
    
    // 從 localStorage 讀取上次的音量，如果沒有就預設 1.0 (最大聲)
    let savedVolume = localStorage.getItem('mySavedVolume');
    if (savedVolume !== null) {
      audioPlayer.volume = parseFloat(savedVolume);
      volumeBar.value = audioPlayer.volume * 100;
      updateVolumeIcon(audioPlayer.volume);
    }

    // 監聽音量拉桿拖曳
    volumeBar.addEventListener('input', (e) => {
      const vol = e.target.value / 100;
      audioPlayer.volume = vol;
      localStorage.setItem('mySavedVolume', vol); // 存進個人端
      updateVolumeIcon(vol);
    });

    // 點擊喇叭圖示切換靜音
    function toggleMute() {
      if (audioPlayer.volume > 0) {
        // 記憶靜音前的音量
        audioPlayer.dataset.lastVol = audioPlayer.volume;
        audioPlayer.volume = 0;
        volumeBar.value = 0;
      } else {
        // 恢復靜音前的音量
        const restoreVol = audioPlayer.dataset.lastVol || 1;
        audioPlayer.volume = restoreVol;
        volumeBar.value = restoreVol * 100;
      }
      localStorage.setItem('mySavedVolume', audioPlayer.volume);
      updateVolumeIcon(audioPlayer.volume);
    }

    // 根據音量大小更換圖示
    function updateVolumeIcon(vol) {
      if (vol === 0) volumeIcon.innerText = '🔇';
      else if (vol < 0.5) volumeIcon.innerText = '🔉';
      else volumeIcon.innerText = '🔊';
    }
    
const speeds = [0.75, 1.0, 1.25, 1.5];
let speedIndex = 1; // 預設 1.0x

function toggleSpeed() {
  speedIndex = (speedIndex + 1) % speeds.length;
  const newSpeed = speeds[speedIndex];
  audioPlayer.playbackRate = newSpeed;
  document.getElementById('speed-btn').innerText = newSpeed + 'x';
}

// 記得在 playSong 時重置速度，避免上一首歌的速度影響到下一首
// audioPlayer.playbackRate = speeds[speedIndex];