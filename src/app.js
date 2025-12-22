// src/app.js
;(function(){
  // Create a single global namespace
  window.TimoETA = {};

  // Constants
  const MOBILE_BREAKPOINT = 576;
  const LUMINANCE_THRESHOLD = 186;
  const LUMINANCE_WEIGHTS = { R: 0.299, G: 0.587, B: 0.114 };

  /**
   * Determines if the current viewport is mobile-sized
   * @returns {boolean} True if viewport width is at or below mobile breakpoint
   */
  TimoETA.isMobile = function() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  };

  /**
   * Calculates optimal text color (black or white) for a given background color
   * Uses perceived luminance formula to ensure WCAG contrast compliance
   * @param {string} hex - Hex color code (e.g., '#FF5733')
   * @returns {string} '#000' for dark text or '#fff' for light text
   */
  TimoETA.contrastColor = function(hex) {
    if (!hex || typeof hex !== 'string' || hex.length < 7) return '#000';
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    
    // Guard against NaN from invalid hex values
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000';
    
    const luminance = LUMINANCE_WEIGHTS.R * r + LUMINANCE_WEIGHTS.G * g + LUMINANCE_WEIGHTS.B * b;
    return luminance > LUMINANCE_THRESHOLD ? '#000' : '#fff';
  };

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

  /**
   * Gets the currently active language code
   * @returns {string} Language code ('en', 'tc', or 'sc'), defaults to 'en'
   */
  TimoETA.getLang = function(){
    const activeBtn = document.querySelector('.lang-switch button.active');
    return activeBtn ? activeBtn.dataset.value : 'en';
  };

  /**
   * Gets the currently active transport mode
   * @returns {string} Mode code ('kmb', 'mtr', or 'lr'), defaults to 'kmb'
   */
  TimoETA.getMode = function(){
    const activeBtn = document.querySelector('.mode-switch button.active');
    return activeBtn ? activeBtn.dataset.value : 'kmb';
  };

  // Set theme toggle checkbox state on load
  (function(){
    const t = localStorage.getItem('theme');
    const chk = document.getElementById('themeToggle');
    if (chk) chk.checked = (t === 'dark');
  })();

  /**
   * Updates all dynamic UI text and input attributes based on selected mode and language
   * Called when mode or language changes to refresh labels, placeholders, and visibility
   */
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
    document.querySelectorAll('.mode-switch button').forEach((btn, idx, arr)=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.mode-switch button').forEach(b=>{
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        TimoETA.updateUITextAndInputs();
      });
      // Add keyboard navigation
      btn.addEventListener('keydown', (e)=>{
        if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
          e.preventDefault();
          const nextIdx = e.key === 'ArrowRight' ? 
            (idx + 1) % arr.length : 
            (idx - 1 + arr.length) % arr.length;
          arr[nextIdx].click();
          arr[nextIdx].focus();
        }
      });
    });

    document.querySelectorAll('.lang-switch button').forEach((btn, idx, arr)=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.lang-switch button').forEach(b=>{
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        TimoETA.updateUITextAndInputs();
      });
      // Add keyboard navigation
      btn.addEventListener('keydown', (e)=>{
        if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
          e.preventDefault();
          const nextIdx = e.key === 'ArrowRight' ? 
            (idx + 1) % arr.length : 
            (idx - 1 + arr.length) % arr.length;
          arr[nextIdx].click();
          arr[nextIdx].focus();
        }
      });
    });

    // Search form handler
    document.getElementById('searchForm').addEventListener('submit', function(e){
      e.preventDefault();
      
      const mode = TimoETA.getMode();
      const stopName = document.getElementById('stopName').value.trim();
      const routeNumbers = document.getElementById('routeNumbers').value.trim();
      const results = document.getElementById('results');

      // Validate input
      if (!stopName) {
        const currentLang = TimoETA.getLang();
        const L = TimoETA.ALL_LANGS_DATA[mode][currentLang];
        results.innerHTML = `<div class="no-results">${L.stopNotFound || 'Please enter a search term'}</div>`;
        return;
      }

      // Show loading indicator
      results.innerHTML = '<div class="loading-spinner"></div>';
      
      // Update URL with search parameters
      const params = new URLSearchParams();
      params.set('mode', mode);
      params.set('stop', stopName);
      if (routeNumbers) params.set('routes', routeNumbers);
      history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);

      // Execute search based on mode
      try {
        if (mode === 'kmb') TimoETA.buildKMB();
        else if (mode === 'mtr') TimoETA.buildMTR();
        else if (mode === 'lr') TimoETA.buildLR();
      } catch (error) {
        console.error('Search error:', error);
        results.innerHTML = '<div class="no-results">An error occurred. Please try again.</div>';
      }
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

    // Populate KMB stops datalist (deferred for better initial load performance)
    (async function() {
      if (typeof TimoETA.getStops === 'function') {
        try {
          const stops = await TimoETA.getStops();
          const dl = document.getElementById('stopsList');
          if(dl && Array.isArray(stops)) {
            // Use document fragment for better performance
            const fragment = document.createDocumentFragment();
            stops.forEach(s => {
              if (s.name_en) {
                const opt = document.createElement('option');
                opt.value = s.name_en;
                fragment.appendChild(opt);
              }
            });
            dl.innerHTML = '';
            dl.appendChild(fragment);
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
        if (b.dataset.value === mode) {
          b.classList.add('active');
          b.setAttribute('aria-pressed', 'true');
        } else {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        }
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
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    const pct = scrollHeight > 0 ? (doc.scrollTop / scrollHeight * 100) : 0;
    const progressBar = document.querySelector('.progress-bar');
    if(progressBar) progressBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
  });

  // UI Component Generation
  /**
   * Sanitizes a string for safe HTML insertion by escaping special characters
   * Prevents XSS attacks by converting text to HTML entities
   * @param {string} str - The string to sanitize
   * @returns {string} HTML-safe string with escaped special characters
   */
  TimoETA.sanitizeHTML = function(str) {
    if (str == null) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  /**
   * Creates a mobile-optimized card component for displaying ETA information
   * @param {Object} data - Card configuration object
   * @param {string} data.mode - Transport mode ('kmb', 'mtr', 'lr')
   * @param {string} [data.route] - Route number/code
   * @param {string} [data.routeClass] - CSS class for route styling
   * @param {string} [data.routeBgColor] - Background color for route tag
   * @param {string} [data.routeColor] - Text color for route tag
   * @param {string} [data.dest] - Destination name
   * @param {string} [data.platform] - Platform identifier
   * @param {Array<{time: string, isScheduled: boolean}>} [data.etas] - Array of ETA times
   * @param {string} [data.details] - HTML string for expandable details section
   * @returns {HTMLElement} The constructed mobile card element
   */
  TimoETA.createMobileCard = function(data) {
    if (!data || typeof data !== 'object') {
      console.warn('Invalid data passed to createMobileCard');
      return document.createElement('div');
    }

    const card = document.createElement('div');
    card.className = `mobile-card fade-in mobile-${data.mode || 'default'}`;

    // Route tag section
    const cRoute = document.createElement('div');
    cRoute.className = 'mobile-route';
    if (data.route) {
      const tag = document.createElement('span');
      tag.className = `route-tag ${data.routeClass || ''}`;
      tag.textContent = data.route;
      if (data.routeBgColor) {
        tag.style.backgroundColor = data.routeBgColor;
        tag.style.color = data.routeColor || '#000';
      }
      cRoute.appendChild(tag);
    }
    card.appendChild(cRoute);

    // Destination section
    const cDest = document.createElement('div');
    cDest.className = 'mobile-dest';
    cDest.textContent = data.dest || '';
    card.appendChild(cDest);

    // Platform section
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

    // ETA times or warning button
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
    
    // Expandable details functionality
    if (data.details) {
      const toggleDetails = (evt) => {
        if(evt) evt.stopPropagation();
        const nx = card.nextElementSibling;
        if(nx && nx.classList.contains('mobile-details')){
          nx.remove();
          card.classList.remove('expanded');
          card.setAttribute('aria-expanded', 'false');
        } else {
          const md = document.createElement('div');
          md.className = 'mobile-details';
          
          // data.details can be an HTML string or a DocumentFragment
          if (data.details instanceof DocumentFragment || data.details instanceof HTMLElement) {
            md.appendChild(data.details);
          } else {
            md.innerHTML = data.details;
          }
          
          card.insertAdjacentElement('afterend', md);
          card.classList.add('expanded');
          card.setAttribute('aria-expanded', 'true');
        }
      };

      card.setAttribute('aria-expanded', 'false');
      if (data.etas && data.etas.length > 0) {
        card.addEventListener('dblclick', toggleDetails);
        card.style.cursor = 'pointer';
      } else {
        const btn = card.querySelector('.mobile-toggle-btn');
        if (btn) btn.addEventListener('click', toggleDetails);
      }
    }

    return card;
  };

  /**
   * Creates a desktop-optimized HTML table for displaying ETA information
   * @param {Array<string>} headers - Array of column header labels
   * @param {Array<Array<string|Object>>} rows - 2D array of table data
   *   Each cell can be a string or an object with properties:
   *   - {string} text - Cell text content
   *   - {string} html - Raw HTML content (use with caution)
   *   - {string} class - CSS class for the cell
   *   - {number} colspan - Number of columns to span
   * @returns {HTMLElement} The constructed table container element
   */
  TimoETA.createDesktopTable = function(headers, rows) {
    if (!Array.isArray(headers) || !Array.isArray(rows)) {
      console.warn('Invalid arguments passed to createDesktopTable');
      return document.createElement('div');
    }

    const wrap = document.createElement('div');
    wrap.className = 'eta-table-container';
    const table = document.createElement('table');
    table.className = 'eta-results';
    table.setAttribute('role', 'table');
    
    // Create table header
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    trHead.setAttribute('role', 'row');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.setAttribute('role', 'columnheader');
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    rows.forEach(rowData => {
      if (!Array.isArray(rowData)) return;
      const tr = document.createElement('tr');
      tr.className = 'eta-data-row';
      tr.setAttribute('role', 'row');
      rowData.forEach(cellData => {
        const td = document.createElement('td');
        td.setAttribute('role', 'cell');
        if (typeof cellData === 'object' && cellData !== null) {
          if (cellData.html) td.innerHTML = cellData.html;
          else td.textContent = cellData.text || '';
          if (cellData.class) td.className = cellData.class;
          if (cellData.colspan) td.colSpan = cellData.colspan;
        } else {
          td.textContent = cellData != null ? String(cellData) : '';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  };

  /**
   * Displays results with a title heading in the results container
   * @param {string} title - Section title to display
   * @param {HTMLElement|Array<HTMLElement>} content - Element(s) to append
   */
  TimoETA.displayResults = function(title, content) {
    const results = document.getElementById('results');
    if (!results) {
      console.warn('Results container not found');
      return;
    }
    
    const h3 = document.createElement('h3');
    h3.textContent = title;
    results.appendChild(h3);
    
    if (Array.isArray(content)) {
      content.forEach(el => {
        if (el instanceof HTMLElement) results.appendChild(el);
      });
    } else if (content instanceof HTMLElement) {
      results.appendChild(content);
    }
  };

  /**
   * Debounces a function to limit how often it can be called
   * Useful for optimizing expensive operations triggered by frequent events
   * @param {Function} func - The function to debounce
   * @param {number} wait - Milliseconds to wait before executing
   * @returns {Function} Debounced function
   */
  TimoETA.debounce = function(func, wait) {
    if (typeof func !== 'function') {
      throw new TypeError('Expected a function');
    }
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * Aligns mobile card columns by calculating and setting CSS custom properties
   * Ensures consistent column widths across all mobile cards for better visual alignment
   * Optimized to prevent layout thrashing by batching reads and writes
   */
  TimoETA.alignMobileColumns = function(){
    const currentMode = TimoETA.getMode();
    const rootStyle = document.documentElement.style;
    const EXTRA_ETA_PADDING = (currentMode === 'mtr' || currentMode === 'lr') ? 15 : 0;

    // 1. Batch Reads
    const routeEls = document.querySelectorAll('.mobile-card:not(.mobile-mtr) .mobile-route');
    let maxRouteW = 0;
    routeEls.forEach(el => {
      const w = el.getBoundingClientRect().width;
      if (w > maxRouteW) maxRouteW = w;
    });

    const platEls = document.querySelectorAll('.mobile-card .mobile-platform');
    let maxPlatW = 0;
    platEls.forEach(el => {
      if (el.children.length > 0) {
        const w = el.offsetWidth;
        if (w > maxPlatW) maxPlatW = w;
      }
    });

    const timesButtonEls = document.querySelectorAll('.mobile-card .mobile-times, .mobile-card .mobile-toggle-btn');
    let maxTimesW = 0;
    timesButtonEls.forEach(el => {
      const w = el.offsetWidth;
      if (w > maxTimesW) maxTimesW = w;
    });

    // 2. Batch Writes using requestAnimationFrame
    requestAnimationFrame(() => {
      if (maxRouteW > 0) {
        rootStyle.setProperty('--max-route-col-width', maxRouteW + 'px');
      } else {
        rootStyle.setProperty('--max-route-col-width', 'auto');
      }

      if (maxPlatW > 0) {
        rootStyle.setProperty('--max-platform-col-width', maxPlatW + 'px');
      } else {
        rootStyle.setProperty('--max-platform-col-width', 'auto');
      }

      if (maxTimesW > 0) {
        rootStyle.setProperty('--max-times-col-width', (maxTimesW + EXTRA_ETA_PADDING) + 'px');
      } else {
        rootStyle.setProperty('--max-times-col-width', 'auto');
      }
    });
  };
})();