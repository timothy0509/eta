// src/mtr.js
;(function(){
  'use strict';

  // API endpoint builder
  const API = (line, sta, lang='en') =>
    `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php`+
    `?line=${encodeURIComponent(line)}`+
    `&sta=${encodeURIComponent(sta)}`+
    `&lang=${encodeURIComponent(lang)}`;

  const STATIONS = window.TimoETA.MTR_STATIONS;
  const NAME_TO_CODE = window.TimoETA.MTR_NAME_TO_CODE;

  // Official MTR line colors for consistent branding
  const LINE_COLOR = {
    AEL: '#2a888a',  // Airport Express
    EAL: '#53b7e8',  // East Rail Line
    KTL: '#26ab4e',  // Kwun Tong Line
    TWL: '#ed1c24',  // Tsuen Wan Line
    ISL: '#347dc5',  // Island Line
    TCL: '#f7943e',  // Tung Chung Line
    TKL: '#7e459b',  // Tseung Kwan O Line
    TML: '#923011',  // Tuen Ma Line
    DRL: '#f173ac',  // Disneyland Resort Line
    SIL: '#b5bd01'   // South Island Line
  };

  const API_TIMEOUT_MS = 10000; // 10 seconds
  const CACHE_TTL = 60000; // 1 minute for caching

  // In-memory cache for MTR API requests
  const mtrCache = new Map();

  /**
   * Main function to fetch and display MTR train schedules for a station
   * Accepts either a 3-letter station code or station name
   */
  window.TimoETA.buildMTR = async function(){
    const controller = TimoETA.createRequestController();
    const currentLang = TimoETA.getLang();
    const L = TimoETA.ALL_LANGS_DATA.mtr[currentLang];

    const inp = document.getElementById('stopName').value.trim();
    const results = document.getElementById('results');
    results.innerHTML = '';

    if(!inp){ 
      results.innerHTML = `<div class="no-results">${L.noData}</div>`;
      return;
    }

    // Try to match input to station code or name
    const low = inp.toLowerCase();
    const up = inp.toUpperCase();
    let sta = null;
    let lines = [];
    
    // Check if input is a 3-letter station code
    if(/^[A-Za-z]{3}$/.test(up) && STATIONS[up]?.lines){
      sta = up;
      lines = STATIONS[up].lines.slice();
    }
    // Otherwise try to match by station name
    if(!sta && NAME_TO_CODE[low]){
      sta = NAME_TO_CODE[low];
      lines = STATIONS[sta].lines.slice();
    }
    
    if(!sta){ 
      results.innerHTML = `<div class="no-results">${L.stationNotFound}</div>`;
      return;
    }

    // Fetch schedules for all lines serving this station in parallel with caching
    const fetchPromises = lines.map(async (line) => {
      const cacheKey = `${line}-${sta}-${currentLang}`;
      const cached = mtrCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { line, data: cached.data, cached: true };
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        
        const res = await fetch(API(line, sta, currentLang), { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const j = await res.json();
        
        // Cache the result
        mtrCache.set(cacheKey, {
          timestamp: Date.now(),
          data: j
        });
        
        return { line, data: j };
      } catch (e) {
        if (e.name === 'AbortError') {
          console.warn(`Request timeout for line ${line} at station ${sta}`);
        } else {
          console.warn(`Failed to fetch MTR data for ${line}-${sta}:`, e);
        }
        return { line, error: e };
      }
    });

    const responses = await Promise.all(fetchPromises);
    let any = false;

    responses.forEach(res => {
      if (res.data) {
        const key = `${res.line}-${sta}`;
        if (res.data.status === 1 && res.data.data?.[key]) {
          any = true;
          renderBlock(res.data.data[key], res.line);
        }
      }
    });
    
    if(!any) {
      results.innerHTML = `<div class="no-results">${L.noData}</div>`;
    }

    if(TimoETA.isMobile()) TimoETA.alignMobileColumns();
  };

  /**
   * Renders train schedule data for a specific line at a station
   * Creates separate sections for UP and DOWN directions
   * @param {Object} block - Schedule data object with UP and DOWN arrays
   * @param {string} line - MTR line code (e.g., 'TKL', 'ISL')
   */
  function renderBlock(block, line){
    if (!block || typeof block !== 'object') {
      console.warn('Invalid block data passed to renderBlock');
      return;
    }

    const currentLang = TimoETA.getLang();
    const L = TimoETA.ALL_LANGS_DATA.mtr[currentLang];
    const results = document.getElementById('results');
    const bg = LINE_COLOR[line] || '#000';
    const fg = TimoETA.contrastColor(bg);
    const lineName = STATIONS[line]?.name || line;

    ['UP', 'DOWN'].forEach(dir => {
      const arr = block[dir] || [];
      if(!arr.length) return;
      
      // Extract unique destinations for this direction
      const dests = Array.from(new Set(arr.map(e => e.dest).filter(Boolean)))
        .map(d => STATIONS[d]?.name || d)
        .join(' / ');

      // Create header with line name and destinations
      const h3 = document.createElement('h3');
      const spanName = document.createElement('span');
      spanName.textContent = lineName;
      spanName.className = 'line-tag';
      spanName.style.backgroundColor = bg;
      spanName.style.color = fg;
      h3.appendChild(spanName);
      h3.append(` → ${dests}`);
      results.appendChild(h3);

      // Render mobile or desktop view
      if(TimoETA.isMobile()){
        const mobileCards = arr.map(e => {
          const cardData = {
            mode: 'mtr',
            dest: STATIONS[e.dest]?.name || e.dest || 'Unknown',
            platform: e.plat || '',
            routeBgColor: bg,
            routeColor: fg,
            etas: [{ time: (e.time || '').split(' ')[1] || e.time || '' }]
          };
          return TimoETA.createMobileCard(cardData);
        });
        mobileCards.forEach(card => results.appendChild(card));
      } else {
        const desktopHeaders = [L.tableHeaders.Destination, L.tableHeaders.Platform, L.tableHeaders.Time];
        const desktopRows = arr.map(e => {
          return [
            STATIONS[e.dest]?.name || e.dest || 'Unknown',
            e.plat || '',
            (e.time || '').split(' ')[1] || e.time || ''
          ];
        });
        const table = TimoETA.createDesktopTable(desktopHeaders, desktopRows);
        results.appendChild(table);
      }
    });
  }
})();