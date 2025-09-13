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
        tableHeaders: { Route: 'Route', Destination: 'Destination', Platform: 'Platform', StopCode: 'StopCode', ETA1: 'ETA1', ETA2: 'ETA2', ETA3: 'ETA3', Remarks: 'Remarks' }
      },
      tc: {
        stopNameLabel: '巴士站名稱 (部分字串)',
        stopNamePlaceholder: '例如：啟業邨',
        routeNumbersLabel: '路線號碼 (以逗號分隔，非必須)',
        routeNumbersPlaceholder: '例如：14, 62P, 62X, 259D, X42C',
        searchButton: '查詢到站時間',
        noEtas: '沒有到站時間',
        stopNotFound: '找不到巴士站',
        tableHeaders: { Route: '路線', Destination: '目的地', Platform: '月台', StopCode: '站號', ETA1: '到站1', ETA2: '到站2', ETA3: '到站3', Remarks: '備註' }
      },
      sc: {
        stopNameLabel: '巴士站名稱 (部分字串)',
        stopNamePlaceholder: '例如：啟業邨',
        routeNumbersLabel: '路线号码 (以逗号分隔，非必须)',
        routeNumbersPlaceholder: '例如：14, 62P, 62X, 259D, X42C',
        searchButton: '查询到站时间',
        noEtas: '没有到站时间',
        stopNotFound: '找不到巴士站',
        tableHeaders: { Route: '路线', Destination: '目的地', Platform: '站台', StopCode: '站号', ETA1: '到站1', ETA2: '到站2', ETA3: '到站3', Remarks: '备注' }
      }
    },
    mtr: {
      en: {
        inputLabel: 'Station Code / Name',
        inputPlaceholder: 'e.g. TIK  Tiu Keng Leng',
        searchButton: 'Search Trains',
        noData: 'No train data available',
        stationNotFound: 'Station not found',
        tableHeaders: { Destination: 'Destination', Platform: 'Platform', Time: 'Time' }
      },
      tc: {
        inputLabel: '站點代號 / 名稱',
        inputPlaceholder: '例如：TIK  調景嶺',
        searchButton: '查詢列車',
        noData: '沒有列車資料',
        stationNotFound: '找不到車站',
        tableHeaders: { Destination: '目的地', Platform: '月台', Time: '時間' }
      },
      sc: {
        inputLabel: '站点编号 / 名称',
        inputPlaceholder: '例如：TIK  调景岭',
        searchButton: '查询列车',
        noData: '没有列车资料',
        stationNotFound: '找不到车站',
        tableHeaders: { Destination: '目的地', Platform: '站台', Time: '时间' }
      }
    },
    lr: {
      en: {
        inputLabel: 'Light Rail Stop Name',
        inputPlaceholder: 'e.g. Butterfly',
        searchButton: 'Search Trains',
        noData: 'No train data available',
        stopNotFound: 'Stop not found',
        tableHeaders: { Route: 'Route', Destination: 'Destination', Time: 'Time' }
      },
      tc: {
        inputLabel: '輕鐵站名',
        inputPlaceholder: '例如：蝴蝶',
        searchButton: '查詢列車',
        noData: '沒有列車資料',
        stopNotFound: '找不到輕鐵站',
        tableHeaders: { Route: '路線', Destination: '目的地', Time: '時間' }
      },
      sc: {
        inputLabel: '轻铁站名',
        inputPlaceholder: '例如：蝴蝶',
        searchButton: '查询列车',
        noData: '没有列车资料',
        stopNotFound: '找不到轻铁站',
        tableHeaders: { Route: '路线', Destination: '目的地', Time: '时间' }
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

    labelStopName.textContent = modeSpecificLangData.inputLabel || modeSpecificLangData.stopNameLabel;
    stopNameInput.placeholder = modeSpecificLangData.inputPlaceholder || modeSpecificLangData.stopNamePlaceholder;
    searchButton.textContent = modeSpecificLangData.searchButton;
    if(clearButton) clearButton.textContent = 'Clear'; // Or add to lang data

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