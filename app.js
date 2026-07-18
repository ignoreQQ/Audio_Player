'use strict';

/* =========================================================
   DOM
========================================================= */

const audioPlayer = document.getElementById('audio-player');

const lyricsContainer =
  document.getElementById('lyrics-container');

const progressBar =
  document.getElementById('progress-bar');

const currentTimeLabel =
  document.getElementById('time-current');

const totalTimeLabel =
  document.getElementById('time-total');

const volumeBar =
  document.getElementById('volume-bar');

const volumeIcon =
  document.getElementById('volume-icon');

/* =========================================================
   狀態
========================================================= */

let allSongs = [];
let currentPlaylist = [];
let currentSongIndex = -1;

let currentContentFilter = 'all';
let currentArtistFilter = 'all';
let currentLanguageFilter = 'all';
let currentSortMode = 'default';

let favorites =
  JSON.parse(localStorage.getItem('myFavSongs') || '[]');

let recentSongs =
  JSON.parse(localStorage.getItem('myRecentSongs') || '[]');

let lyricsData = [];
let currentLyricIndex = -1;

let youtubePlayer = null;
let youtubeReady = false;
let pendingSong = null;
let youtubeUpdateTimer = null;

let activePlayerType = null;

let isDraggingProgress = false;
let isShuffle = false;
let isRepeatOne = false;
let isVideoMode = true;

let showTranslation =
  localStorage.getItem('myShowTranslation') !== 'false';

let currentVolume =
  Number(localStorage.getItem('mySavedVolume') ?? 1);

let lastVolume =
  currentVolume > 0 ? currentVolume : 1;

let currentPlaybackRate =
  Number(localStorage.getItem('myPlaySpeed') ?? 1);

/* =========================================================
   工具函式
========================================================= */

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return entities[character];
  });
}

function formatTime(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value < 0) {
    return '0:00';
  }

  const minutes = Math.floor(value / 60);
  const remainingSeconds = Math.floor(value % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getSongLanguage(song) {
  return song?.category || song?.language || '其他';
}

function hasValidYouTubeId(song) {
  return Boolean(
    song &&
    typeof song.youtubeId === 'string' &&
    /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId.trim())
  );
}

function getYouTubeCover(song) {
  if (!song) {
    return '';
  }

  if (typeof song.cover === 'string' && song.cover.trim()) {
    return song.cover.trim();
  }

  if (hasValidYouTubeId(song)) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(
      song.youtubeId.trim()
    )}/hqdefault.jpg`;
  }

  return '';
}

function getCurrentSong() {
  return currentPlaylist[currentSongIndex] || null;
}

function getSongById(songId) {
  return allSongs.find(song => song.id === songId);
}

function getCurrentTime() {
  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer
  ) {
    return Number(youtubePlayer.getCurrentTime()) || 0;
  }

  if (activePlayerType === 'audio') {
    return Number(audioPlayer.currentTime) || 0;
  }

  return 0;
}

function getDuration() {
  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer
  ) {
    return Number(youtubePlayer.getDuration()) || 0;
  }

  if (activePlayerType === 'audio') {
    return Number(audioPlayer.duration) || 0;
  }

  return 0;
}

function isPlaying() {
  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer &&
    window.YT
  ) {
    return (
      youtubePlayer.getPlayerState() ===
      YT.PlayerState.PLAYING
    );
  }

  if (activePlayerType === 'audio') {
    return !audioPlayer.paused;
  }

  return false;
}

/* =========================================================
   YouTube
========================================================= */

window.onYouTubeIframeAPIReady = function () {
  youtubePlayer = new YT.Player('youtube-player', {
    width: '100%',
    height: '100%',

    playerVars: {
      playsinline: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin
    },

    events: {
      onReady: handleYouTubeReady,
      onStateChange: handleYouTubeStateChange,
      onError: handleYouTubeError
    }
  });
};

function handleYouTubeReady() {
  youtubeReady = true;

  youtubePlayer.setVolume(
    Math.round(currentVolume * 100)
  );

  if (pendingSong) {
    const song = pendingSong;
    pendingSong = null;

    startYouTubeSong(song);
  }
}

function handleYouTubeStateChange(event) {
  if (!window.YT) {
    return;
  }

  if (event.data === YT.PlayerState.PLAYING) {
    updatePlayButtons(true);
    startPlaybackUpdater();

    window.setTimeout(() => {
      applyPlaybackRate(currentPlaybackRate);
    }, 300);
  }

  if (event.data === YT.PlayerState.PAUSED) {
    updatePlayButtons(false);
  }

  if (event.data === YT.PlayerState.ENDED) {
    updatePlayButtons(false);

    if (isRepeatOne) {
      seekTo(0);
      playMedia();
    } else {
      playNext();
    }
  }
}

function handleYouTubeError(event) {
  console.error('YouTube 播放錯誤：', event.data);

  const song = getCurrentSong();

  /*
    若原本 songs.json 還保留 audio，
    YouTube 無法播放時自動使用 MP3 備援。
  */
  if (song?.audio) {
    startAudioSong(song);
    return;
  }

  showLyricsMessage(
    '此 YouTube 影片無法播放，可能未開放嵌入或影片已被移除。'
  );
}

/* =========================================================
   導覽
========================================================= */

function switchNav(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.page === pageName
    );
  });

  document
    .getElementById(`page-${pageName}`)
    ?.classList.add('active');

  if (pageName === 'home') {
    renderHome();
  }

  if (pageName === 'library') {
    renderLibrary();
  }

  if (pageName === 'search') {
    renderSearch();
  }
}

document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    switchNav(button.dataset.page);
  });
});

/* =========================================================
   問候
========================================================= */

function updateGreeting() {
  const hour = new Date().getHours();
  const element = document.getElementById('greeting-text');

  if (hour < 5) {
    element.textContent = '夜深了 🌙';
  } else if (hour < 12) {
    element.textContent = '早安 👋';
  } else if (hour < 18) {
    element.textContent = '午安 ☀️';
  } else {
    element.textContent = '晚安 🌙';
  }
}

/* =========================================================
   首頁
========================================================= */

function renderHome() {
  renderRecommendations();
  renderRecentSongs();
}

function renderRecommendations() {
  const container = document.getElementById('recommend-row');

  const featured = allSongs.filter(song => song.featured);

  const songs = (
    featured.length > 0 ? featured : allSongs
  ).slice(0, 10);

  container.innerHTML = '';

  songs.forEach(song => {
    const cover = getYouTubeCover(song);

    const card = document.createElement('article');
    card.className = 'album-card';

    card.innerHTML = `
      <div class="album-thumb">
        ${
          cover
            ? `<img src="${escapeHTML(cover)}" alt="${escapeHTML(song.title)}" loading="lazy" decoding="async">`
            : `<div class="cover-placeholder">
                <i class="ti ti-music"></i>
              </div>`
        }

        <span class="album-play-icon">
          <i class="ti ti-player-play-filled"></i>
        </span>
      </div>

      <div class="album-card-name">
        ${escapeHTML(song.title)}
      </div>

      <div class="album-card-artist">
        ${escapeHTML(song.artist)}
      </div>
    `;

    card.addEventListener('click', () => {
      playSongById(song.id);
    });

    container.appendChild(card);
  });
}

function renderRecentSongs() {
  const container = document.getElementById('recent-list');

  const songs = recentSongs
    .map(getSongById)
    .filter(Boolean);

  if (songs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-history"></i>
        <strong>尚無播放紀錄</strong>
        <span>播放歌曲後會顯示在這裡</span>
      </div>
    `;

    return;
  }

  container.innerHTML = '';

  songs.forEach(song => {
    container.appendChild(createSongRow(song, songs));
  });
}

function clearRecent() {
  recentSongs = [];

  localStorage.removeItem('myRecentSongs');

  renderRecentSongs();
}

/* =========================================================
   動態分類
========================================================= */

function renderFilters() {
  renderArtistFilters();
  renderLanguageFilters();
}

function renderArtistFilters() {
  const container = document.getElementById('artist-tabs');

  const artists = [
    ...new Set(
      allSongs
        .map(song => song.artist)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  container.innerHTML = '';

  container.appendChild(
    createFilterButton(
      '全部歌手',
      'all',
      currentArtistFilter === 'all',
      value => {
        currentArtistFilter = value;
        renderFilters();
        renderLibrary();
      }
    )
  );

  artists.forEach(artist => {
    container.appendChild(
      createFilterButton(
        artist,
        artist,
        currentArtistFilter === artist,
        value => {
          currentArtistFilter = value;
          renderFilters();
          renderLibrary();
        }
      )
    );
  });
}

function renderLanguageFilters() {
  const container =
    document.getElementById('language-tabs');

  const languages = [
    ...new Set(allSongs.map(getSongLanguage))
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  container.innerHTML = '';

  container.appendChild(
    createFilterButton(
      '全部語言',
      'all',
      currentLanguageFilter === 'all',
      value => {
        currentLanguageFilter = value;
        renderFilters();
        renderLibrary();
      }
    )
  );

  languages.forEach(language => {
    container.appendChild(
      createFilterButton(
        getLanguageLabel(language),
        language,
        currentLanguageFilter === language,
        value => {
          currentLanguageFilter = value;
          renderFilters();
          renderLibrary();
        }
      )
    );
  });
}

function createFilterButton(label, value, active, callback) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = `cat-btn ${active ? 'active' : ''}`;
  button.textContent = label;

  button.addEventListener('click', () => callback(value));

  return button;
}

function getLanguageLabel(language) {
  const labels = {
    日文: '🇯🇵 日文',
    日語: '🇯🇵 日語',
    華語: '🇹🇼 華語',
    中文: '🇹🇼 中文',
    英文: '🇺🇸 英文',
    英語: '🇺🇸 英語',
    韓文: '🇰🇷 韓文',
    韓語: '🇰🇷 韓語',
    其他: '🎵 其他'
  };

  return labels[language] || `🎵 ${language}`;
}

document
  .querySelectorAll('#content-tabs .cat-btn')
  .forEach(button => {
    button.addEventListener('click', () => {
      currentContentFilter = button.dataset.content;

      document
        .querySelectorAll('#content-tabs .cat-btn')
        .forEach(item => {
          item.classList.toggle(
            'active',
            item === button
          );
        });

      renderLibrary();
    });
  });

/* =========================================================
   曲庫
========================================================= */

function getFilteredSongs() {
  let songs = [...allSongs];

  if (currentContentFilter === 'favorites') {
    songs = songs.filter(song =>
      favorites.includes(song.id)
    );
  }

  if (currentArtistFilter !== 'all') {
    songs = songs.filter(song =>
      song.artist === currentArtistFilter
    );
  }

  if (currentLanguageFilter !== 'all') {
    songs = songs.filter(song =>
      getSongLanguage(song) === currentLanguageFilter
    );
  }

  return sortSongs(songs);
}

function sortSongs(songs) {
  const result = [...songs];

  if (currentSortMode === 'title') {
    result.sort((a, b) =>
      a.title.localeCompare(b.title, 'zh-Hant')
    );
  }

  if (currentSortMode === 'artist') {
    result.sort((a, b) =>
      a.artist.localeCompare(b.artist, 'zh-Hant')
    );
  }

  return result;
}

function renderLibrary() {
  const songs = getFilteredSongs();

  currentPlaylist = songs;

  document.getElementById('library-count').textContent =
    `${songs.length} 首歌曲`;

  document.getElementById('library-title').textContent =
    currentContentFilter === 'favorites'
      ? '我的收藏'
      : '音樂庫';

  const container =
    document.getElementById('library-song-list');

  if (songs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-music-off"></i>
        <strong>沒有符合條件的歌曲</strong>
        <span>請嘗試清除篩選條件</span>
      </div>
    `;

    return;
  }

  container.innerHTML = '';

  songs.forEach(song => {
    container.appendChild(createSongRow(song, songs));
  });
}

document
  .getElementById('library-sort')
  .addEventListener('change', event => {
    currentSortMode = event.target.value;
    document.getElementById('search-sort').value =
      currentSortMode;

    renderLibrary();
  });

document
  .getElementById('reset-filter-button')
  .addEventListener('click', () => {
    currentContentFilter = 'all';
    currentArtistFilter = 'all';
    currentLanguageFilter = 'all';
    currentSortMode = 'default';

    document.getElementById('library-sort').value =
      'default';

    document.getElementById('search-sort').value =
      'default';

    document
      .querySelectorAll('#content-tabs .cat-btn')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.content === 'all'
        );
      });

    renderFilters();
    renderLibrary();
  });

document
  .getElementById('play-all-button')
  .addEventListener('click', () => {
    const songs = getFilteredSongs();

    if (songs.length === 0) {
      return;
    }

    currentPlaylist = songs;
    playSong(0);
  });

/* =========================================================
   搜尋
========================================================= */

function renderSearch() {
  const query = document
    .getElementById('search-input')
    .value
    .trim()
    .toLocaleLowerCase();

  let songs = allSongs.filter(song => {
    const text = [
      song.title,
      song.artist,
      getSongLanguage(song),
      ...(Array.isArray(song.tags) ? song.tags : [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return text.includes(query);
  });

  songs = sortSongs(songs);

  const container =
    document.getElementById('search-result-list');

  document.getElementById('search-count').textContent =
    query
      ? `找到 ${songs.length} 首歌曲`
      : `${songs.length} 首歌曲`;

  document.getElementById('clear-search-button').hidden =
    query === '';

  if (songs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-search-off"></i>
        <strong>找不到歌曲</strong>
        <span>請嘗試其他關鍵字</span>
      </div>
    `;

    return;
  }

  container.innerHTML = '';

  songs.forEach(song => {
    container.appendChild(createSongRow(song, songs));
  });
}

document
  .getElementById('search-input')
  .addEventListener('input', renderSearch);

document
  .getElementById('clear-search-button')
  .addEventListener('click', () => {
    const input = document.getElementById('search-input');

    input.value = '';
    input.focus();

    renderSearch();
  });

document
  .getElementById('search-sort')
  .addEventListener('change', event => {
    currentSortMode = event.target.value;
    document.getElementById('library-sort').value =
      currentSortMode;

    renderSearch();
  });

/* =========================================================
   歌曲列
========================================================= */

function createSongRow(song, sourcePlaylist) {
  const item = document.createElement('li');

  item.className = 'track-item';

  const cover = getYouTubeCover(song);
  const isFavorite = favorites.includes(song.id);

  item.innerHTML = `
    <button type="button" class="track-main">
      <div class="track-thumb">
        ${
          cover
            ? `<img src="${escapeHTML(cover)}" alt="" loading="lazy" decoding="async">`
            : `<i class="ti ti-music"></i>`
        }

        <span class="track-overlay">
          <i class="ti ti-player-play-filled"></i>
        </span>
      </div>

      <div class="track-info">
        <div class="track-name">
          ${escapeHTML(song.title)}
        </div>

        <div class="track-meta">
          <span>${escapeHTML(song.artist)}</span>

          <span class="category-tag">
            ${escapeHTML(getSongLanguage(song))}
          </span>
        </div>
      </div>
    </button>

    <button
      type="button"
      class="track-favorite ${isFavorite ? 'active' : ''}"
      aria-label="收藏"
    >
      <i class="ti ${
        isFavorite ? 'ti-heart-filled' : 'ti-heart'
      }"></i>
    </button>
  `;

  item
    .querySelector('.track-main')
    .addEventListener('click', () => {
      currentPlaylist = [...sourcePlaylist];

      const index = currentPlaylist.findIndex(
        target => target.id === song.id
      );

      playSong(index);
    });

  item
    .querySelector('.track-favorite')
    .addEventListener('click', () => {
      toggleFavorite(song.id);
    });

  return item;
}

/* =========================================================
   收藏
========================================================= */

function toggleFavorite(songId) {
  if (favorites.includes(songId)) {
    favorites = favorites.filter(id => id !== songId);
  } else {
    favorites.push(songId);
  }

  localStorage.setItem(
    'myFavSongs',
    JSON.stringify(favorites)
  );

  updateFavoriteButton();
  renderHome();
  renderLibrary();
  renderSearch();
}

function updateFavoriteButton() {
  const song = getCurrentSong();
  const button =
    document.getElementById('np-favorite-button');

  if (!song) {
    return;
  }

  const active = favorites.includes(song.id);

  button.classList.toggle('active', active);

  button.innerHTML = `
    <i class="ti ${
      active ? 'ti-heart-filled' : 'ti-heart'
    }"></i>
  `;
}

document
  .getElementById('np-favorite-button')
  .addEventListener('click', () => {
    const song = getCurrentSong();

    if (song) {
      toggleFavorite(song.id);
    }
  });

/* =========================================================
   播放歌曲
========================================================= */

function playSongById(songId) {
  currentPlaylist = [...allSongs];

  const index = currentPlaylist.findIndex(
    song => song.id === songId
  );

  playSong(index);
}

function playSong(index) {
  if (index < 0 || index >= currentPlaylist.length) {
    return;
  }

  currentSongIndex = index;

  const song = getCurrentSong();

  stopCurrentMedia();
  resetProgress();
  updateSongInformation(song);
  updateRecent(song.id);
  loadLyrics(song.lyrics);

  if (hasValidYouTubeId(song)) {
    startYouTubeSong(song);
  } else if (song.audio) {
    startAudioSong(song);
  } else {
    activePlayerType = null;

    showLyricsMessage(
      '這首歌尚未設定 youtubeId，也沒有備用 audio。'
    );
  }

  openNowPlaying();
}

function startYouTubeSong(song) {
  activePlayerType = 'youtube';

  audioPlayer.pause();

  if (!youtubeReady || !youtubePlayer) {
    pendingSong = song;
    showLyricsMessage('YouTube 播放器載入中，請稍候...');
    return;
  }

  youtubePlayer.loadVideoById({
    videoId: song.youtubeId.trim(),
    startSeconds: 0
  });

  youtubePlayer.setVolume(
    Math.round(currentVolume * 100)
  );

  startPlaybackUpdater();
}

function startAudioSong(song) {
  activePlayerType = 'audio';

  if (youtubeReady && youtubePlayer) {
    youtubePlayer.stopVideo();
  }

  audioPlayer.src = song.audio;
  audioPlayer.volume = currentVolume;
  audioPlayer.playbackRate = currentPlaybackRate;

  audioPlayer.play().catch(error => {
    console.error('Audio 播放失敗：', error);

    showLyricsMessage('備用 Audio 播放失敗。');
  });
}

function stopCurrentMedia() {
  stopPlaybackUpdater();

  audioPlayer.pause();

  if (youtubeReady && youtubePlayer) {
    youtubePlayer.stopVideo();
  }
}

function updateRecent(songId) {
  recentSongs = [
    songId,
    ...recentSongs.filter(id => id !== songId)
  ].slice(0, 20);

  localStorage.setItem(
    'myRecentSongs',
    JSON.stringify(recentSongs)
  );

  renderRecentSongs();
}

/* =========================================================
   歌曲 UI
========================================================= */

function updateSongInformation(song) {
  const cover = getYouTubeCover(song);

  document.getElementById('mini-title').textContent =
    song.title;

  document.getElementById('mini-artist').textContent =
    song.artist;

  document.getElementById('np-title').textContent =
    song.title;

  document.getElementById('np-artist').textContent =
    song.artist;

  document.getElementById('np-category').textContent =
    getSongLanguage(song);

  updateImage(
    document.getElementById('mini-cover'),
    document.getElementById('mini-cover-placeholder'),
    cover
  );

  const background =
    document.getElementById('np-background');

  if (cover) {
    background.src = cover;
    background.hidden = false;
  } else {
    background.removeAttribute('src');
    background.hidden = true;
  }

  updateFavoriteButton();
}

function updateImage(image, placeholder, source) {
  if (!source) {
    image.hidden = true;
    placeholder.hidden = false;
    return;
  }

  image.onload = () => {
    image.hidden = false;
    placeholder.hidden = true;
  };

  image.onerror = () => {
    image.hidden = true;
    placeholder.hidden = false;
  };

  image.src = source;
}

/* =========================================================
   正在播放頁
========================================================= */

function openNowPlaying() {
  const page =
    document.getElementById('page-now-playing');

  page.classList.add('active');
  page.setAttribute('aria-hidden', 'false');

  document
    .getElementById('mini-player')
    .classList.add('hidden');

  document
    .getElementById('mini-lyrics-bar')
    .classList.add('hidden');

  document
    .querySelector('.bottom-nav')
    .classList.add('hidden');
}

function closeNowPlaying() {
  const page =
    document.getElementById('page-now-playing');

  page.classList.remove('active');
  page.setAttribute('aria-hidden', 'true');

  document
    .getElementById('mini-player')
    .classList.remove('hidden');

  document
    .getElementById('mini-lyrics-bar')
    .classList.remove('hidden');

  document
    .querySelector('.bottom-nav')
    .classList.remove('hidden');
}

document
  .getElementById('close-now-playing')
  .addEventListener('click', closeNowPlaying);

document
  .getElementById('mini-player')
  .addEventListener('click', event => {
    if (!event.target.closest('button') && getCurrentSong()) {
      openNowPlaying();
    }
  });

document
  .getElementById('mini-lyrics-bar')
  .addEventListener('click', () => {
    if (getCurrentSong()) {
      openNowPlaying();
    }
  });

/* =========================================================
   影片／歌詞模式
========================================================= */

function applyDisplayMode() {
  document
    .getElementById('video-panel')
    .classList.toggle('compact', !isVideoMode);

  document
    .getElementById('lyrics-panel')
    .classList.toggle('focus', !isVideoMode);

  document.getElementById('display-mode-icon').className =
    isVideoMode
      ? 'ti ti-file-text'
      : 'ti ti-brand-youtube';

  document.getElementById('display-mode-text').textContent =
    isVideoMode ? '歌詞' : '影片';
}

document
  .getElementById('display-mode-button')
  .addEventListener('click', () => {
    isVideoMode = !isVideoMode;
    applyDisplayMode();

    if (!isVideoMode && currentLyricIndex >= 0) {
      scrollLyricPanelToLine(document.getElementById(`lyric-${currentLyricIndex}`), 'smooth');
    }
  });

/* =========================================================
   播放控制
========================================================= */

function togglePlay() {
  if (!getCurrentSong()) {
    return;
  }

  if (isPlaying()) {
    pauseMedia();
  } else {
    playMedia();
  }
}

function playMedia() {
  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer
  ) {
    youtubePlayer.playVideo();
  }

  if (activePlayerType === 'audio') {
    audioPlayer.play();
  }
}

function pauseMedia() {
  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer
  ) {
    youtubePlayer.pauseVideo();
  }

  if (activePlayerType === 'audio') {
    audioPlayer.pause();
  }
}

function updatePlayButtons(playing) {
  document.getElementById('main-play-icon').className =
    playing
      ? 'ti ti-player-pause'
      : 'ti ti-player-play';

  document.getElementById('mini-play-icon').className =
    playing
      ? 'ti ti-player-pause'
      : 'ti ti-player-play';
}

function playNext() {
  if (currentPlaylist.length === 0) {
    return;
  }

  let nextIndex;

  if (isShuffle && currentPlaylist.length > 1) {
    do {
      nextIndex = Math.floor(
        Math.random() * currentPlaylist.length
      );
    } while (nextIndex === currentSongIndex);
  } else {
    nextIndex =
      (currentSongIndex + 1) % currentPlaylist.length;
  }

  playSong(nextIndex);
}

function playPrevious() {
  if (currentPlaylist.length === 0) {
    return;
  }

  if (getCurrentTime() > 5) {
    seekTo(0);
    return;
  }

  const previousIndex =
    (
      currentSongIndex -
      1 +
      currentPlaylist.length
    ) % currentPlaylist.length;

  playSong(previousIndex);
}

document
  .getElementById('main-play-button')
  .addEventListener('click', togglePlay);

document
  .getElementById('mini-play-button')
  .addEventListener('click', event => {
    event.stopPropagation();
    togglePlay();
  });

document
  .getElementById('next-button')
  .addEventListener('click', playNext);

document
  .getElementById('mini-next-button')
  .addEventListener('click', event => {
    event.stopPropagation();
    playNext();
  });

document
  .getElementById('previous-button')
  .addEventListener('click', playPrevious);

document
  .getElementById('shuffle-button')
  .addEventListener('click', event => {
    isShuffle = !isShuffle;

    event.currentTarget.classList.toggle(
      'active',
      isShuffle
    );
  });

document
  .getElementById('repeat-button')
  .addEventListener('click', event => {
    isRepeatOne = !isRepeatOne;

    event.currentTarget.classList.toggle(
      'active',
      isRepeatOne
    );

    event.currentTarget.innerHTML = `
      <i class="${
        isRepeatOne
          ? 'ti ti-repeat-once'
          : 'ti ti-repeat'
      }"></i>
    `;
  });

/* =========================================================
   進度
========================================================= */

function startPlaybackUpdater() {
  stopPlaybackUpdater();

  youtubeUpdateTimer = window.setInterval(() => {
    updateProgress();
    updateActiveLyric();
  }, 250);
}

function stopPlaybackUpdater() {
  if (youtubeUpdateTimer) {
    clearInterval(youtubeUpdateTimer);
    youtubeUpdateTimer = null;
  }
}

function updateProgress() {
  const current = getCurrentTime();
  const duration = getDuration();

  if (!isDraggingProgress && duration > 0) {
    progressBar.value = Math.round(
      (current / duration) * 1000
    );
  }

  currentTimeLabel.textContent = formatTime(current);
  totalTimeLabel.textContent = formatTime(duration);
}

function resetProgress() {
  progressBar.value = 0;
  currentTimeLabel.textContent = '0:00';
  totalTimeLabel.textContent = '0:00';
}

function seekTo(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);

  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer
  ) {
    youtubePlayer.seekTo(safeSeconds, true);
  }

  if (activePlayerType === 'audio') {
    audioPlayer.currentTime = safeSeconds;
  }
}

progressBar.addEventListener('input', event => {
  isDraggingProgress = true;

  const duration = getDuration();
  const target =
    (Number(event.target.value) / 1000) * duration;

  currentTimeLabel.textContent = formatTime(target);
});

progressBar.addEventListener('change', event => {
  const duration = getDuration();
  const target =
    (Number(event.target.value) / 1000) * duration;

  seekTo(target);
  isDraggingProgress = false;
});

/* =========================================================
   Audio 備援事件
========================================================= */

audioPlayer.addEventListener('play', () => {
  if (activePlayerType === 'audio') {
    updatePlayButtons(true);
    startPlaybackUpdater();
  }
});

audioPlayer.addEventListener('pause', () => {
  if (activePlayerType === 'audio') {
    updatePlayButtons(false);
  }
});

audioPlayer.addEventListener('ended', () => {
  if (isRepeatOne) {
    seekTo(0);
    playMedia();
  } else {
    playNext();
  }
});

/* =========================================================
   音量
========================================================= */

function setVolume(value) {
  currentVolume = Math.max(0, Math.min(1, value));

  if (currentVolume > 0) {
    lastVolume = currentVolume;
  }

  audioPlayer.volume = currentVolume;

  if (youtubeReady && youtubePlayer) {
    youtubePlayer.setVolume(
      Math.round(currentVolume * 100)
    );
  }

  volumeBar.value = Math.round(currentVolume * 100);

  localStorage.setItem(
    'mySavedVolume',
    String(currentVolume)
  );

  if (currentVolume === 0) {
    volumeIcon.className = 'ti ti-volume-3';
  } else if (currentVolume < 0.5) {
    volumeIcon.className = 'ti ti-volume-2';
  } else {
    volumeIcon.className = 'ti ti-volume';
  }
}

volumeBar.addEventListener('input', event => {
  setVolume(Number(event.target.value) / 100);
});

document
  .getElementById('volume-button')
  .addEventListener('click', () => {
    if (currentVolume > 0) {
      lastVolume = currentVolume;
      setVolume(0);
    } else {
      setVolume(lastVolume || 1);
    }
  });

/* =========================================================
   播放速度
========================================================= */

function applyPlaybackRate(rate) {
  currentPlaybackRate = Math.max(
    0.25,
    Math.min(2, Number(rate) || 1)
  );

  audioPlayer.playbackRate = currentPlaybackRate;

  if (
    activePlayerType === 'youtube' &&
    youtubeReady &&
    youtubePlayer
  ) {
    const available =
      youtubePlayer.getAvailablePlaybackRates?.() || [];

    if (available.includes(currentPlaybackRate)) {
      youtubePlayer.setPlaybackRate(currentPlaybackRate);
    } else if (available.length > 0) {
      const closest = available.reduce((previous, current) => {
        return (
          Math.abs(current - currentPlaybackRate) <
          Math.abs(previous - currentPlaybackRate)
        )
          ? current
          : previous;
      });

      youtubePlayer.setPlaybackRate(closest);
    }
  }

  localStorage.setItem(
    'myPlaySpeed',
    String(currentPlaybackRate)
  );

  document.getElementById('speed-button').textContent =
    `${Number(currentPlaybackRate.toFixed(2))}x`;

  document.getElementById('speed-display').textContent =
    `${Number(currentPlaybackRate.toFixed(2))}x`;

  document.getElementById('speed-slider').value =
    currentPlaybackRate;
}

function openSpeedSheet() {
  document
    .getElementById('speed-sheet')
    .classList.add('active');
}

function closeSpeedSheet() {
  document
    .getElementById('speed-sheet')
    .classList.remove('active');
}

document
  .getElementById('speed-button')
  .addEventListener('click', openSpeedSheet);

document
  .getElementById('close-speed-sheet')
  .addEventListener('click', closeSpeedSheet);

document
  .getElementById('speed-sheet')
  .addEventListener('click', event => {
    if (event.target.id === 'speed-sheet') {
      closeSpeedSheet();
    }
  });

document
  .getElementById('speed-slider')
  .addEventListener('input', event => {
    applyPlaybackRate(event.target.value);
  });

document
  .querySelectorAll('[data-speed]')
  .forEach(button => {
    button.addEventListener('click', () => {
      applyPlaybackRate(button.dataset.speed);
      closeSpeedSheet();
    });
  });

/* =========================================================
   歌詞
========================================================= */

async function loadLyrics(url) {
  lyricsData = [];
  currentLyricIndex = -1;

  lyricsContainer.innerHTML = `
    <div class="lyrics-message">
      <span class="loader"></span>
      歌詞載入中...
    </div>
  `;

  if (!url) {
    showLyricsMessage('這首歌沒有提供歌詞。');
    return;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('歌詞 JSON 最外層必須是陣列');
    }

    /*
      保留相同 startTime 的原始順序。
      你的字幕格式可以直接使用。
    */
    lyricsData = data
      .map((line, originalIndex) => ({
        ...line,
        originalIndex,
        startTime: Number(
          line.startTime ?? line.time ?? 0
        )
      }))
      .filter(line => Number.isFinite(line.startTime))
      .sort((a, b) => {
        if (a.startTime === b.startTime) {
          return a.originalIndex - b.originalIndex;
        }

        return a.startTime - b.startTime;
      });

    renderLyrics();
  } catch (error) {
    console.error('歌詞載入失敗：', error);

    showLyricsMessage(
      '歌詞載入失敗，請確認網址與 JSON 格式。'
    );
  }
}

function renderLyrics() {
  if (lyricsData.length === 0) {
    showLyricsMessage('這首歌沒有提供歌詞。');
    return;
  }

  lyricsContainer.innerHTML = '';

  lyricsData.forEach((line, index) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'lyric-line';
    button.id = `lyric-${index}`;

    const original = renderLyricWords(line);
    const originalText = getOriginalText(line);

    const translation =
      typeof line.translation === 'string'
        ? line.translation.trim()
        : '';

    const showTranslationLine =
      translation && translation !== originalText.trim();

    button.innerHTML = `
      <span class="lyric-original">
        ${original}
      </span>

      ${
        showTranslationLine
          ? `<span class="translation ${
              showTranslation ? '' : 'hidden'
            }">
              ${escapeHTML(translation)}
            </span>`
          : ''
      }
    `;

    button.addEventListener('click', () => {
      seekTo(line.startTime + 0.01);
      playMedia();
    });

    lyricsContainer.appendChild(button);
  });
}

function renderLyricWords(line) {
  if (!Array.isArray(line.words)) {
    return escapeHTML(line.text || '');
  }

  return line.words
    .map(word => {
      const text = escapeHTML(word.text || '');

      const furigana =
        typeof word.furigana === 'string'
          ? word.furigana.trim()
          : '';

      if (!furigana) {
        return text;
      }

      return `<ruby>${text}<rt>${escapeHTML(
        furigana
      )}</rt></ruby>`;
    })
    .join('');
}

function getOriginalText(line) {
  if (Array.isArray(line.words)) {
    return line.words
      .map(word => word.text || '')
      .join('');
  }

  return String(line.text || '');
}

function scrollLyricPanelToLine(lineElement, behavior = 'smooth') {
  const panel = document.getElementById('lyrics-panel');
  if (!panel || !lineElement) return;

  // Use element rectangles so nested offset parents do not corrupt the target.
  const panelRect = panel.getBoundingClientRect();
  const lineRect = lineElement.getBoundingClientRect();
  const currentRelativeTop = lineRect.top - panelRect.top + panel.scrollTop;
  const targetTop = currentRelativeTop - (panel.clientHeight - lineElement.offsetHeight) / 2;

  panel.scrollTo({
    top: Math.max(0, targetTop),
    behavior
  });
}

function updateActiveLyric() {
  if (lyricsData.length === 0) {
    return;
  }

  const currentTime = getCurrentTime();

  const index = lyricsData.findLastIndex(
    line => currentTime >= line.startTime
  );

  if (index < 0 || index === currentLyricIndex) {
    return;
  }

  currentLyricIndex = index;

  document
    .querySelectorAll('.lyric-line')
    .forEach(element => {
      element.classList.remove('active');
    });

  const activeLine =
    document.getElementById(`lyric-${index}`);

  activeLine?.classList.add('active');

  scrollLyricPanelToLine(activeLine, 'smooth');

  updateMiniLyrics(lyricsData[index]);
}

function updateMiniLyrics(line) {
  const original =
    document.getElementById('mini-lyric-text');

  const translation =
    document.getElementById('mini-lyric-trans');

  original.innerHTML = renderLyricWords(line);

  const translationText =
    String(line.translation || '').trim();

  const originalText = getOriginalText(line).trim();

  if (
    translationText &&
    translationText !== originalText
  ) {
    translation.textContent = translationText;

    translation.classList.toggle(
      'hidden',
      !showTranslation
    );
  } else {
    translation.textContent = '';
    translation.classList.add('hidden');
  }
}

function showLyricsMessage(message) {
  lyricsContainer.innerHTML = `
    <div class="lyrics-message">
      <i class="ti ti-music-off"></i>
      ${escapeHTML(message)}
    </div>
  `;
}

/* =========================================================
   設定
========================================================= */

function applyFontSize(value) {
  const size = Number(value);

  document.documentElement.style.setProperty(
    '--lyric-font-size',
    `${size}px`
  );

  document.documentElement.style.setProperty(
    '--lyric-ruby-size',
    `${Math.max(9, size * 0.48)}px`
  );

  document.documentElement.style.setProperty(
    '--lyric-translation-size',
    `${Math.max(12, size * 0.65)}px`
  );

  localStorage.setItem(
    'myLyricFontSize',
    String(size)
  );
}

function applyTranslationSetting(checked) {
  showTranslation = checked;

  localStorage.setItem(
    'myShowTranslation',
    String(checked)
  );

  document.querySelectorAll('.translation').forEach(element => {
    element.classList.toggle('hidden', !checked);
  });

  const miniTranslation =
    document.getElementById('mini-lyric-trans');

  if (miniTranslation.textContent.trim()) {
    miniTranslation.classList.toggle(
      'hidden',
      !checked
    );
  }
}

document
  .getElementById('font-size-slider')
  .addEventListener('input', event => {
    applyFontSize(event.target.value);
  });

document
  .getElementById('translation-toggle')
  .addEventListener('change', event => {
    applyTranslationSetting(event.target.checked);
  });

document
  .getElementById('default-video-toggle')
  .addEventListener('change', event => {
    localStorage.setItem(
      'myDefaultVideoMode',
      String(event.target.checked)
    );
  });

/* =========================================================
   初始化
========================================================= */

function initSettings() {
  const savedFontSize =
    Number(localStorage.getItem('myLyricFontSize') || 24);

  document.getElementById('font-size-slider').value =
    savedFontSize;

  applyFontSize(savedFontSize);

  document.getElementById('translation-toggle').checked =
    showTranslation;

  applyTranslationSetting(showTranslation);

  const defaultVideo =
    localStorage.getItem('myDefaultVideoMode') !== 'false';

  document.getElementById('default-video-toggle').checked =
    defaultVideo;

  isVideoMode = defaultVideo;
  applyDisplayMode();

  setVolume(
    Number.isFinite(currentVolume) ? currentVolume : 1
  );

  applyPlaybackRate(
    Number.isFinite(currentPlaybackRate)
      ? currentPlaybackRate
      : 1
  );
}

async function loadSongs() {
  try {
    const response = await fetch('songs.json', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const songs = await response.json();

    if (!Array.isArray(songs)) {
      throw new Error('songs.json 最外層必須是陣列');
    }

    allSongs = songs.map(song => ({
      ...song,

      category:
        song.category || song.language || '其他',

      youtubeId:
        typeof song.youtubeId === 'string'
          ? song.youtubeId.trim()
          : '',

      cover:
        typeof song.cover === 'string'
          ? song.cover.trim()
          : '',

      featured: Boolean(song.featured)
    }));

    currentPlaylist = [...allSongs];

    renderFilters();
    renderHome();
    renderLibrary();
    renderSearch();
  } catch (error) {
    console.error('songs.json 載入失敗：', error);

    showLyricsMessage(
      'songs.json 載入失敗，請確認檔案格式。'
    );
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./Service_Worker.js')
      .catch(error => {
        console.error('Service Worker 註冊失敗：', error);
      });
  });
}

updateGreeting();
initSettings();
loadSongs();
registerServiceWorker();