// src/app.js
;(function(){
  // Create a single global namespace
  window.TimoETA = {};

  // Centralized language data for all modes
  window.TimoETA.ALL_LANGS_DATA = {
    kmb: {
      en: {
        stopNameLabel: 'Stop Name (partial)',
        stopNamePlaceholder: 'e.g. Kai Yip Estate',
        routeNumbersLabel: 'Route Numbers (comma-sep, optional)',
        routeNumbersPlaceholder: 'e.g. 14, 62P, 62X, 259D, X42C',
        searchButton: 'Search ETAs',
        noEtas: 'No ETAs available',
        stopNotFound: 'Stop not found',
        tableHeaders: { Route: 'Route', Destination: 'Destination', Platform: 'Platform', StopCode: 'StopCode', ETA1: 'ETA1', ETA2: 'ETA2', ETA3: 'ETA3', Remarks: 'Remarks' },
        favorites: 'Favorites',
        addToFavorites: 'Add to Favorites',
        removeFromFavorites: 'Remove from Favorites',
        noFavorites: 'No favorites yet',
        favoriteAdded: 'Added to favorites',
        favoriteRemoved: 'Removed from favorites',
        clearAll: 'Clear All',
        clearAllConfirm: 'Are you sure you want to clear all favorites?'
      },
      tc: {
        stopNameLabel: '巴士站名稱 (部分字串)',
        stopNamePlaceholder: '例如：啟業邨',
        routeNumbersLabel: '路線號碼 (以逗號分隔，非必須)',
        routeNumbersPlaceholder: '例如：14, 62P, 62X, 259D, X42C',
        searchButton: '查詢到站時間',
        noEtas: '沒有到站時間',
        stopNotFound: '找不到巴士站',
        tableHeaders: { Route: '路線', Destination: '目的地', Platform: '月台', StopCode: '站號', ETA1: '到站1', ETA2: '到站2', ETA3: '到站3', Remarks: '備註' },
        favorites: '我的最愛',
        addToFavorites: '加入最愛',
        removeFromFavorites: '從最愛移除',
        noFavorites: '尚未加入最愛',
        favoriteAdded: '已加入最愛',
        favoriteRemoved: '已從最愛移除',
        clearAll: '全部清除',
        clearAllConfirm: '確定要清除所有最愛嗎？'
      },
      sc: {
        stopNameLabel: '巴士站名稱 (部分字串)',
        stopNamePlaceholder: '例如：啟業邨',
        routeNumbersLabel: '路线号码 (以逗号分隔，非必须)',
        routeNumbersPlaceholder: '例如：14, 62P, 62X, 259D, X42C',
        searchButton: '查询到站时间',
        noEtas: '没有到站时间',
        stopNotFound: '找不到巴士站',
        tableHeaders: { Route: '路线', Destination: '目的地', Platform: '站台', StopCode: '站号', ETA1: '到站1', ETA2: '到站2', ETA3: '到站3', Remarks: '备注' },
        favorites: '我的收藏',
        addToFavorites: '加入收藏',
        removeFromFavorites: '从收藏移除',
        noFavorites: '尚未加入收藏',
        favoriteAdded: '已加入收藏',
        favoriteRemoved: '已从收藏移除',
        clearAll: '全部清除',
        clearAllConfirm: '确定要清除所有收藏吗？'
      }
    },
    mtr: {
      en: {
        inputLabel: 'Station Code / Name',
        inputPlaceholder: 'e.g. TIK  Tiu Keng Leng',
        searchButton: 'Search Trains',
        noData: 'No train data available',
        stationNotFound: 'Station not found',
        tableHeaders: { Destination: 'Destination', Platform: 'Platform', Time: 'Time' },
        favorites: 'Favorites',
        addToFavorites: 'Add to Favorites',
        removeFromFavorites: 'Remove from Favorites',
        noFavorites: 'No favorites yet',
        favoriteAdded: 'Added to favorites',
        favoriteRemoved: 'Removed from favorites',
        clearAll: 'Clear All',
        clearAllConfirm: 'Are you sure you want to clear all favorites?'
      },
      tc: {
        inputLabel: '站點代號 / 名稱',
        inputPlaceholder: '例如：TIK  調景嶺',
        searchButton: '查詢列車',
        noData: '沒有列車資料',
        stationNotFound: '找不到車站',
        tableHeaders: { Destination: '目的地', Platform: '月台', Time: '時間' },
        favorites: '我的最愛',
        addToFavorites: '加入最愛',
        removeFromFavorites: '從最愛移除',
        noFavorites: '尚未加入最愛',
        favoriteAdded: '已加入最愛',
        favoriteRemoved: '已從最愛移除',
        clearAll: '全部清除',
        clearAllConfirm: '確定要清除所有最愛嗎？'
      },
      sc: {
        inputLabel: '站点编号 / 名称',
        inputPlaceholder: '例如：TIK  调景岭',
        searchButton: '查询列车',
        noData: '没有列车资料',
        stationNotFound: '找不到车站',
        tableHeaders: { Destination: '目的地', Platform: '站台', Time: '时间' },
        favorites: '我的收藏',
        addToFavorites: '加入收藏',
        removeFromFavorites: '从收藏移除',
        noFavorites: '尚未加入收藏',
        favoriteAdded: '已加入收藏',
        favoriteRemoved: '已从收藏移除',
        clearAll: '全部清除',
        clearAllConfirm: '确定要清除所有收藏吗？'
      }
    },
    lr: {
      en: {
        inputLabel: 'Light Rail Stop Name',
        inputPlaceholder: 'e.g. Butterfly',
        searchButton: 'Search Trains',
        noData: 'No train data available',
        stopNotFound: 'Stop not found',
        tableHeaders: { Route: 'Route', Destination: 'Destination', Time: 'Time' },
        favorites: 'Favorites',
        addToFavorites: 'Add to Favorites',
        removeFromFavorites: 'Remove from Favorites',
        noFavorites: 'No favorites yet',
        favoriteAdded: 'Added to favorites',
        favoriteRemoved: 'Removed from favorites',
        clearAll: 'Clear All',
        clearAllConfirm: 'Are you sure you want to clear all favorites?'
      },
      tc: {
        inputLabel: '輕鐵站名',
        inputPlaceholder: '例如：蝴蝶',
        searchButton: '查詢列車',
        noData: '沒有列車資料',
        stopNotFound: '找不到輕鐵站',
        tableHeaders: { Route: '路線', Destination: '目的地', Time: '時間' },
        favorites: '我的最愛',
        addToFavorites: '加入最愛',
        removeFromFavorites: '從最愛移除',
        noFavorites: '尚未加入最愛',
        favoriteAdded: '已加入最愛',
        favoriteRemoved: '已從最愛移除',
        clearAll: '全部清除',
        clearAllConfirm: '確定要清除所有最愛嗎？'
      },
      sc: {
        inputLabel: '轻铁站名',
        inputPlaceholder: '例如：蝴蝶',
        searchButton: '查询列车',
        noData: '没有列车资料',
        stopNotFound: '找不到轻铁站',
        tableHeaders: { Route: '路线', Destination: '目的地', Time: '时间' },
        favorites: '我的收藏',
        addToFavorites: '加入收藏',
        removeFromFavorites: '从收藏移除',
        noFavorites: '尚未加入收藏',
        favoriteAdded: '已加入收藏',
        favoriteRemoved: '已从收藏移除',
        clearAll: '全部清除',
        clearAllConfirm: '确定要清除所有收藏吗？'
      }
    }
  };

  // Return active language code
  TimoETA.getLang = function(){
    return document.querySelector('.lang-switch button.active').dataset.value;
  };

  // Return active mode code
  TimoETA.getMode = function(){
    return document.querySelector('.mode-switch button.active').dataset.value;
  };

  // Favorites management
  TimoETA.getFavorites = function() {
    const stored = localStorage.getItem('timoeta-favorites');
    return stored ? JSON.parse(stored) : [];
  };

  TimoETA.saveFavorites = function(favorites) {
    localStorage.setItem('timoeta-favorites', JSON.stringify(favorites));
  };

  TimoETA.addFavorite = function(mode, stop, routes) {
    const favorites = TimoETA.getFavorites();
    const newFav = { mode, stop, routes: routes || '', timestamp: Date.now() };
    
    // Check if already exists
    const exists = favorites.some(f => 
      f.mode === mode && f.stop === stop && f.routes === routes
    );
    
    if (!exists) {
      favorites.push(newFav);
      TimoETA.saveFavorites(favorites);
      return true;
    }
    return false;
  };

  TimoETA.removeFavorite = function(index) {
    const favorites = TimoETA.getFavorites();
    favorites.splice(index, 1);
    TimoETA.saveFavorites(favorites);
  };

  TimoETA.isFavorite = function(mode, stop, routes) {
    const favorites = TimoETA.getFavorites();
    return favorites.some(f => 
      f.mode === mode && f.stop === stop && f.routes === (routes || '')
    );
  };

  // Immediately apply saved theme and set toggle
  (function(){
    const t = localStorage.getItem('theme');
    if (t === 'dark') document.documentElement.classList.add('dark-mode');
    const chk = document.getElementById('themeToggle');
    if (chk) chk.checked = (t === 'dark');
  })();

  // Main function to update all dynamic UI text and input attributes
  TimoETA.updateUITextAndInputs = function() {
    const currentMode = TimoETA.getMode();
    const currentLang = TimoETA.getLang();
    const modeSpecificLangData = TimoETA.ALL_LANGS_DATA[currentMode][currentLang];

    const labelStopName = document.getElementById('labelStopName');
    const stopNameInput = document.getElementById('stopName');
    const labelRouteNumbers = document.getElementById('labelRouteNumbers');
    const routeNumbersInput = document.getElementById('routeNumbers');
    const routeNumbersDiv = routeNumbersInput.parentElement;
    const searchButton = document.querySelector('#searchForm button[type="submit"]');
    const clearButton = document.getElementById('clearButton');
    const viewFavoritesButton = document.getElementById('viewFavoritesButton');
    const favoritesTitle = document.getElementById('favoritesTitle');
    const clearAllFavorites = document.getElementById('clearAllFavorites');

    labelStopName.textContent = modeSpecificLangData.inputLabel || modeSpecificLangData.stopNameLabel;
    stopNameInput.placeholder = modeSpecificLangData.inputPlaceholder || modeSpecificLangData.stopNamePlaceholder;
    searchButton.textContent = modeSpecificLangData.searchButton;
    if(clearButton) clearButton.textContent = 'Clear'; // Or add to lang data
    if(viewFavoritesButton) viewFavoritesButton.textContent = modeSpecificLangData.favorites;
    if(favoritesTitle) favoritesTitle.textContent = modeSpecificLangData.favorites;
    if(clearAllFavorites) clearAllFavorites.textContent = modeSpecificLangData.clearAll;

    if (currentMode === 'kmb') {
      routeNumbersDiv.style.display = '';
      labelRouteNumbers.textContent = modeSpecificLangData.routeNumbersLabel;
      routeNumbersInput.placeholder = modeSpecificLangData.routeNumbersPlaceholder;
      stopNameInput.setAttribute('list', 'stopsList');
    } else {
      routeNumbersDiv.style.display = 'none';
      stopNameInput.removeAttribute('list');
    }
  };

  // Consolidated DOMContentLoaded listener
  document.addEventListener('DOMContentLoaded', function(){
    // Theme toggle listener
    const chk = document.getElementById('themeToggle');
    if(chk) {
      chk.addEventListener('change', function(){
        document.documentElement.classList.toggle('dark-mode', this.checked);
        localStorage.setItem('theme', this.checked ? 'dark' : 'light');
      });
    }

    // Mode & language segmented controls
    document.querySelectorAll('.mode-switch button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.mode-switch button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        TimoETA.updateUITextAndInputs();
      });
    });

    document.querySelectorAll('.lang-switch button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.lang-switch button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        TimoETA.updateUITextAndInputs();
      });
    });

    // Search form handler
    document.getElementById('searchForm').addEventListener('submit', function(e){
      e.preventDefault();
      const results = document.getElementById('results');
      results.innerHTML = '<div class="loading-spinner"></div>';
      
      const mode = TimoETA.getMode();
      const stopName = document.getElementById('stopName').value;
      const routeNumbers = document.getElementById('routeNumbers').value;

      const params = new URLSearchParams();
      params.set('mode', mode);
      params.set('stop', stopName);
      if (routeNumbers) params.set('routes', routeNumbers);
      history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

      if (mode==='kmb') TimoETA.buildKMB();
      else if (mode==='mtr') TimoETA.buildMTR();
      else if (mode==='lr') TimoETA.buildLR();
    });

    // Clear button handler
    const clearButton = document.getElementById('clearButton');
    if(clearButton) {
      clearButton.addEventListener('click', function() {
        document.getElementById('stopName').value = '';
        document.getElementById('routeNumbers').value = '';
        document.getElementById('results').innerHTML = '';
        history.replaceState({}, '', window.location.pathname);
        updateFavButton();
      });
    }

    // Favorite button handler
    const favButton = document.getElementById('favButton');
    const updateFavButton = function() {
      if (!favButton) return;
      const mode = TimoETA.getMode();
      const stop = document.getElementById('stopName').value.trim();
      const routes = document.getElementById('routeNumbers').value.trim();
      const currentLang = TimoETA.getLang();
      const L = TimoETA.ALL_LANGS_DATA[mode][currentLang];
      
      if (!stop) {
        favButton.disabled = true;
        favButton.title = '';
        return;
      }
      
      favButton.disabled = false;
      const isFav = TimoETA.isFavorite(mode, stop, routes);
      favButton.textContent = isFav ? '★' : '☆';
      favButton.title = isFav ? L.removeFromFavorites : L.addToFavorites;
      favButton.classList.toggle('favorited', isFav);
    };

    if(favButton) {
      favButton.addEventListener('click', function() {
        const mode = TimoETA.getMode();
        const stop = document.getElementById('stopName').value.trim();
        const routes = document.getElementById('routeNumbers').value.trim();
        const currentLang = TimoETA.getLang();
        const L = TimoETA.ALL_LANGS_DATA[mode][currentLang];
        
        if (!stop) return;
        
        if (TimoETA.isFavorite(mode, stop, routes)) {
          const favorites = TimoETA.getFavorites();
          const index = favorites.findIndex(f => 
            f.mode === mode && f.stop === stop && f.routes === routes
          );
          if (index !== -1) {
            TimoETA.removeFavorite(index);
            showToast(L.favoriteRemoved);
          }
        } else {
          TimoETA.addFavorite(mode, stop, routes);
          showToast(L.favoriteAdded);
        }
        updateFavButton();
      });
      
      document.getElementById('stopName').addEventListener('input', updateFavButton);
      document.getElementById('routeNumbers').addEventListener('input', updateFavButton);
    }

    // Toast notification
    function showToast(message) {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }

    // View favorites button handler
    const viewFavoritesButton = document.getElementById('viewFavoritesButton');
    const favoritesModal = document.getElementById('favoritesModal');
    const closeFavoritesModal = document.getElementById('closeFavoritesModal');

    function renderFavoritesList() {
      const favorites = TimoETA.getFavorites();
      const favoritesList = document.getElementById('favoritesList');
      const currentLang = TimoETA.getLang();
      const currentMode = TimoETA.getMode();
      const L = TimoETA.ALL_LANGS_DATA[currentMode][currentLang];
      
      if (favorites.length === 0) {
        favoritesList.innerHTML = `<div class="no-favorites">${L.noFavorites}</div>`;
        return;
      }
      
      favoritesList.innerHTML = '';
      favorites.forEach((fav, index) => {
        const favItem = document.createElement('div');
        favItem.className = 'favorite-item';
        
        const favInfo = document.createElement('div');
        favInfo.className = 'favorite-info';
        
        const modeLabel = document.createElement('span');
        modeLabel.className = 'favorite-mode';
        modeLabel.textContent = fav.mode.toUpperCase();
        favInfo.appendChild(modeLabel);
        
        const stopLabel = document.createElement('span');
        stopLabel.className = 'favorite-stop';
        stopLabel.textContent = fav.stop;
        favInfo.appendChild(stopLabel);
        
        if (fav.routes) {
          const routesLabel = document.createElement('span');
          routesLabel.className = 'favorite-routes';
          routesLabel.textContent = `Routes: ${fav.routes}`;
          favInfo.appendChild(routesLabel);
        }
        
        favItem.appendChild(favInfo);
        
        const favActions = document.createElement('div');
        favActions.className = 'favorite-actions';
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn-fav-load';
        loadBtn.textContent = '→';
        loadBtn.title = 'Load and search';
        loadBtn.addEventListener('click', () => {
          document.querySelectorAll('.mode-switch button').forEach(b => {
            if (b.dataset.value === fav.mode) b.classList.add('active');
            else b.classList.remove('active');
          });
          document.getElementById('stopName').value = fav.stop;
          document.getElementById('routeNumbers').value = fav.routes;
          TimoETA.updateUITextAndInputs();
          favoritesModal.style.display = 'none';
          document.getElementById('searchForm').dispatchEvent(new Event('submit', { bubbles: true }));
        });
        favActions.appendChild(loadBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-fav-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', () => {
          TimoETA.removeFavorite(index);
          renderFavoritesList();
          updateFavButton();
        });
        favActions.appendChild(deleteBtn);
        
        favItem.appendChild(favActions);
        favoritesList.appendChild(favItem);
      });
    }

    if(viewFavoritesButton) {
      viewFavoritesButton.addEventListener('click', function() {
        renderFavoritesList();
        favoritesModal.style.display = 'flex';
      });
    }

    if(closeFavoritesModal) {
      closeFavoritesModal.addEventListener('click', function() {
        favoritesModal.style.display = 'none';
      });
    }

    if(favoritesModal) {
      favoritesModal.addEventListener('click', function(e) {
        if (e.target === favoritesModal) {
          favoritesModal.style.display = 'none';
        }
      });
    }

    // Clear all favorites button
    const clearAllFavorites = document.getElementById('clearAllFavorites');
    if(clearAllFavorites) {
      clearAllFavorites.addEventListener('click', function() {
        const currentMode = TimoETA.getMode();
        const currentLang = TimoETA.getLang();
        const L = TimoETA.ALL_LANGS_DATA[currentMode][currentLang];
        
        if (confirm(L.clearAllConfirm)) {
          TimoETA.saveFavorites([]);
          renderFavoritesList();
          updateFavButton();
          showToast(L.favoriteRemoved);
        }
      });
    }

    // Populate KMB stops datalist
    (async function() {
      if (typeof TimoETA.getStops === 'function') {
        try {
          const stops = await TimoETA.getStops();
          const dl = document.getElementById('stopsList');
          if(dl) {
            dl.innerHTML = '';
            stops.forEach(s=>{
              const opt = document.createElement('option');
              opt.value = s.name_en;
              dl.appendChild(opt);
            });
          }
        } catch (e) {
          console.error("Failed to populate KMB datalist:", e);
        }
      }
    })();

    // On page load, check for URL params and perform search
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const stop = params.get('stop');
    const routes = params.get('routes');

    if (mode && stop) {
      document.querySelectorAll('.mode-switch button').forEach(b => {
        if (b.dataset.value === mode) b.classList.add('active');
        else b.classList.remove('active');
      });

      document.getElementById('stopName').value = stop;
      if (routes) document.getElementById('routeNumbers').value = routes;
      
      TimoETA.updateUITextAndInputs();
      document.getElementById('searchForm').dispatchEvent(new Event('submit', { bubbles: true }));
    } else {
      TimoETA.updateUITextAndInputs();
    }
  });

  // Ripple effect
  document.addEventListener('click', function(e){
    const el = e.target.closest('.ripple');
    if (!el) return;
    el.classList.remove('animate');
    void el.offsetWidth;
    el.classList.add('animate');
  });

  // Scroll-progress bar
  window.addEventListener('scroll', function(){
    const doc = document.documentElement;
    const pct = (doc.scrollTop) /
      (doc.scrollHeight - doc.clientHeight) * 100;
    const progressBar = document.querySelector('.progress-bar');
    if(progressBar) progressBar.style.width = pct + '%';
  });

  // UI Component Generation
  TimoETA.createMobileCard = function(data) {
    const card = document.createElement('div');
    card.className = `mobile-card fade-in mobile-${data.mode}`;

    const cRoute = document.createElement('div');
    cRoute.className = 'mobile-route';
    if (data.route) {
      const tag = document.createElement('span');
      tag.className = `route-tag ${data.routeClass || ''}`;
      tag.textContent = data.route;
      if (data.routeBgColor) {
        tag.style.backgroundColor = data.routeBgColor;
        tag.style.color = data.routeColor;
      }
      cRoute.appendChild(tag);
    }
    card.appendChild(cRoute);

    const cDest = document.createElement('div');
    cDest.className = 'mobile-dest';
    cDest.textContent = data.dest;
    card.appendChild(cDest);

    const cPlatform = document.createElement('div');
    cPlatform.className = 'mobile-platform';
    if (data.platform) {
      const circle = document.createElement('span');
      circle.className = 'platform-circle';
      circle.textContent = data.platform;
      if (data.routeBgColor) {
        circle.style.backgroundColor = data.routeBgColor;
        circle.style.color = data.routeColor;
      }
      cPlatform.appendChild(circle);
    }
    card.appendChild(cPlatform);

    if (data.etas && data.etas.length > 0) {
      const cTimes = document.createElement('div');
      cTimes.className = 'mobile-times';
      data.etas.forEach((eta, i) => {
        const d = document.createElement('div');
        d.className = 'eta-time' + (i === 0 ? ' eta-first' : '');
        if (eta.isScheduled) d.classList.add('scheduled-eta');
        d.textContent = eta.time;
        cTimes.appendChild(d);
      });
      card.appendChild(cTimes);
    } else {
      const btn = document.createElement('button');
      btn.className = 'mobile-toggle-btn warning';
      btn.setAttribute('aria-label', 'Toggle details');
      btn.innerHTML = '&#9888;';
      card.appendChild(btn);
    }
    
    if (data.details) {
      const toggleDetails = (evt) => {
        if(evt) evt.stopPropagation();
        const nx = card.nextElementSibling;
        if(nx && nx.classList.contains('mobile-details')){
          nx.remove();
          card.classList.remove('expanded');
        } else {
          const md = document.createElement('div');
          md.className = 'mobile-details';
          md.innerHTML = data.details;
          card.insertAdjacentElement('afterend', md);
          card.classList.add('expanded');
        }
      };

      if (data.etas && data.etas.length > 0) {
        card.addEventListener('dblclick', toggleDetails);
      } else {
        const btn = card.querySelector('.mobile-toggle-btn');
        if (btn) btn.addEventListener('click', toggleDetails);
      }
    }

    return card;
  };

  TimoETA.createDesktopTable = function(headers, rows) {
    const wrap = document.createElement('div');
    wrap.className = 'eta-table-container';
    const table = document.createElement('table');
    table.className = 'eta-results';
    
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(rowData => {
      const tr = document.createElement('tr');
      tr.className = 'eta-data-row';
      rowData.forEach(cellData => {
        const td = document.createElement('td');
        if (typeof cellData === 'object' && cellData !== null) {
          if (cellData.html) td.innerHTML = cellData.html;
          else td.textContent = cellData.text;
          if (cellData.class) td.className = cellData.class;
          if (cellData.colspan) td.colSpan = cellData.colspan;
        } else {
          td.textContent = cellData;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  };

  TimoETA.displayResults = function(title, content) {
    const results = document.getElementById('results');
    const h3 = document.createElement('h3');
    h3.textContent = title;
    results.appendChild(h3);
    if (Array.isArray(content)) {
      content.forEach(el => results.appendChild(el));
    } else {
      results.appendChild(content);
    }
  };

  // Mobile column alignment
  TimoETA.alignMobileColumns = function(){
    const currentMode = TimoETA.getMode();
    const rootStyle = document.documentElement.style;

    const routeEls = document.querySelectorAll('.mobile-card:not(.mobile-mtr) .mobile-route');
    let maxRouteW = 0;
    rootStyle.setProperty('--max-route-col-width', 'auto');
    routeEls.forEach(el=>{
      const w = el.getBoundingClientRect().width;
      if (w > maxRouteW) maxRouteW = w;
    });
    rootStyle.setProperty('--max-route-col-width', maxRouteW + 'px');

    const platEls = document.querySelectorAll('.mobile-card .mobile-platform');
    let maxPlatW = 0;
    rootStyle.setProperty('--max-platform-col-width', 'auto');
    platEls.forEach(el=>{
      if (el.children.length > 0) {
        const w = el.offsetWidth;
        if (w > maxPlatW) maxPlatW = w;
      }
    });
    rootStyle.setProperty('--max-platform-col-width', maxPlatW + 'px');

    const timesButtonEls = document.querySelectorAll('.mobile-card .mobile-times, .mobile-card .mobile-toggle-btn');
    let maxTimesW = 0;
    let EXTRA_ETA_PADDING = (currentMode === 'mtr' || currentMode === 'lr') ? 15 : 0;
    rootStyle.setProperty('--max-times-col-width', 'auto');
    timesButtonEls.forEach(el=>{
      const w = el.offsetWidth;
      if (w > maxTimesW) maxTimesW = w;
    });
    rootStyle.setProperty('--max-times-col-width', (maxTimesW + EXTRA_ETA_PADDING) + 'px');
  };
})();