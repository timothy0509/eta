// src/lr.js
;(function(){
  'use strict';

  // API endpoint builder
  const API = id =>
    `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${encodeURIComponent(id)}`;

  const STOPS = window.TimoETA.LR_STOPS;
  const NAME_TO_ID = window.TimoETA.LR_NAME_TO_ID;

  // Official MTR Light Rail route colors
  const COLORS = {
    '505':  '#da2128',  // Red
    '507':  '#25a650',  // Green
    '507P': '#25a650',  // Green
    '610':  '#551b14',  // Brown
    '614':  '#44c0f3',  // Light Blue
    '614P': '#f4858d',  // Pink
    '615':  '#f9dd07',  // Yellow
    '615P': '#256684',  // Dark Blue
    '705':  '#72bf44',  // Light Green
    '706':  '#b27ab4',  // Purple
    '751':  '#f5821f',  // Orange
    '761P': '#6f2b91'   // Dark Purple
  };

  const API_TIMEOUT_MS = 10000; // 10 seconds
  const CACHE_TTL = 60000; // 1 minute for caching

  // In-memory cache for Light Rail API requests
  const lrCache = new Map();

  /**
   * Main function to fetch and display Light Rail train schedules for a station
   * Accepts station name and displays schedules organized by platform
   */
  window.TimoETA.buildLR = async function(){
    const controller = TimoETA.createRequestController();
    const currentLang = TimoETA.getLang();
    const L = TimoETA.ALL_LANGS_DATA.lr[currentLang];

    const raw = document.getElementById('stopName').value.trim().toLowerCase();
    const results = document.getElementById('results');
    results.innerHTML = '';

    // Look up station ID from name
    const stationId = NAME_TO_ID[raw];
    if (stationId == null) {
      results.innerHTML = `<div class="no-results">${L.stopNotFound}</div>`;
      return;
    }

    try {
      // Check cache first
      const cacheKey = stationId;
      const cached = lrCache.get(cacheKey);
      let j;
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        j = cached.data;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        
        const res = await fetch(API(stationId), { signal: controller.signal });
        clearTimeout(timeoutId);
        
        j = await res.json();
        
        // Cache the result
        lrCache.set(cacheKey, {
          timestamp: Date.now(),
          data: j
        });
      }
      
      if (j.status !== 1 || !j.platform_list?.length) {
        results.innerHTML = `<div class="no-results">${L.noData}</div>`;
        return;
      }

      // Process each platform's schedule
      j.platform_list.forEach(p => {
        const h3 = document.createElement('h3');
        h3.textContent = `Platform ${p.platform_id || 'Unknown'}`;
        results.appendChild(h3);

        const routes = p.route_list || [];
        if (!routes.length) return;

        if(TimoETA.isMobile()){
          const mobileCards = routes.map(e => {
            const bg = COLORS[e.route_no];
            const cardData = {
              mode: 'lr',
              route: e.route_no || '',
              routeBgColor: bg,
              routeColor: bg ? TimoETA.contrastColor(bg) : '#000',
              dest: (currentLang === 'en' ? e.dest_en : e.dest_ch) || '',
              platform: p.platform_id || '',
              etas: [{ time: (currentLang === 'en' ? e.time_en : e.time_ch) || '' }]
            };
            return TimoETA.createMobileCard(cardData);
          });
          mobileCards.forEach(card => results.appendChild(card));
          TimoETA.alignMobileColumns();
        } else {
          const desktopHeaders = [L.tableHeaders.Route, L.tableHeaders.Destination, L.tableHeaders.Time];
          const desktopRows = routes.map(e => {
            const bg = COLORS[e.route_no];
            const fg = bg ? TimoETA.contrastColor(bg) : '#000';
            return [
              { html: `<span class="route-tag" style="background-color:${bg};color:${fg};">${e.route_no || ''}</span>` },
              (currentLang === 'en' ? e.dest_en : e.dest_ch) || '',
              (currentLang === 'en' ? e.time_en : e.time_ch) || ''
            ];
          });
          const table = TimoETA.createDesktopTable(desktopHeaders, desktopRows);
          results.appendChild(table);
        }
      });
    } catch(err){
      if (err.name === 'AbortError') {
        console.error(`Request timeout for Light Rail station ${stationId}`);
      } else {
        console.error('Failed to fetch Light Rail data:', err);
      }
      results.innerHTML = `<div class="no-results">${L.noData}</div>`;
    }
  };
})();