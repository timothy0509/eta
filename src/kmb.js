// src/kmb.js
;(function(){
  'use strict';

  // Constants
  const SUFFIX = { en:'en', tc:'tc', sc:'sc' };
  const API = {
    STOP_LIST: 'https://data.etabus.gov.hk/v1/transport/kmb/stop/',
    STOP_ETA: id=>`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${id}`
  };
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  const API_TIMEOUT_MS = 10000; // 10 seconds
  const CACHE_TTL = 60000; // 1 minute for ETA caching
  const MAX_RETRIES = 2; // Maximum retry attempts

  // In-memory cache for ETA requests
  const etaCache = new Map();

  /**
   * Helper function to retry failed fetch requests
   * @param {Function} fetchFn - Function that returns a fetch promise
   * @param {number} retries - Number of retry attempts remaining
   * @param {AbortSignal} signal - AbortSignal for request cancellation
   * @returns {Promise} Resolved fetch response
   */
  async function fetchWithRetry(fetchFn, retries = MAX_RETRIES, signal = null) {
    try {
      return await fetchFn();
    } catch (e) {
      if (retries <= 0 || signal?.aborted) throw e;
      console.warn(`Request failed, retrying... (${retries} attempts left)`, e);
      await new Promise(resolve => setTimeout(resolve, 1000 * (MAX_RETRIES - retries + 1)));
      return fetchWithRetry(fetchFn, retries - 1, signal);
    }
  }

  /**
   * Fetches and caches the complete list of KMB bus stops
   * Tries to load from local cache first, falls back to API
   * @returns {Promise<Array>} Array of stop objects with stop IDs and multilingual names
   */
  async function getStops(){
    if(!getStops.cache){
      // Try loading from local cache file first
      try{
        const r = await fetch('cache/kmb_stops.json');
        if(r.ok){
          const j = await r.json();
          getStops.cache = j.data || j;
          if (Array.isArray(getStops.cache) && getStops.cache.length > 0) {
            return getStops.cache;
          }
        }
      }catch(e){
        console.warn('Failed to load cached stops, fetching from API:', e);
      }
      
      // Fallback to API with retry logic
      try{
        const r = await fetchWithRetry(() => fetch(API.STOP_LIST));
        if(!r.ok) throw new Error(`API returned ${r.status}`);
        const j = await r.json();
        getStops.cache = Array.isArray(j.data) ? j.data : [];
      }catch(e){
        console.error('Failed to fetch stops from API:', e);
        getStops.cache = [];
      }
    }
    return getStops.cache;
  }
  window.TimoETA.getStops = getStops;

  /**
   * Fetches ETA data for a specific KMB stop with caching
   * @param {string} stopId - The unique stop identifier
   * @returns {Promise<Array>} Array of ETA objects containing route, destination, and timing info
   */
  async function getETAs(stopId){
    if (!stopId) {
      console.warn('getETAs called with empty stopId');
      return [];
    }

    // Check cache first
    const cacheKey = stopId;
    const cached = etaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try{
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      
      const r = await fetchWithRetry(
        () => fetch(API.STOP_ETA(stopId), { signal: controller.signal }),
        MAX_RETRIES,
        controller.signal
      );
      clearTimeout(timeoutId);
      
      if(!r.ok) throw new Error(`API returned ${r.status}`);
      const j = await r.json();
      const data = Array.isArray(j.data) ? j.data : [];
      
      // Cache result
      etaCache.set(cacheKey, {
        timestamp: Date.now(),
        data: data
      });
      
      return data;
    }catch(e){
      if (e.name === 'AbortError') {
        console.error(`Request timeout for stop ${stopId}`);
      } else {
        console.error(`Failed to fetch ETAs for stop ${stopId}:`, e);
      }
      return [];
    }
      return [];
    }
  }

  /**
   * Parses stop name to extract platform and stop code information
   * Example: "Jordan Ferry (BT2) (JO01-N-1050-0)" -> {title: "Jordan Ferry", platform: "BT2", stopCode: "JO01"}
   * @param {string} name - The full stop name with potential platform/stop code in parentheses
   * @returns {Object} Object with title, platform, and stopCode properties
   */
  function parseStopInfo(name){
    if (!name || typeof name !== 'string') {
      return { title: '', platform: '', stopCode: '' };
    }
    let title = name;
    let platform = '';
    let stopCode = '';
    const rx = /[\(（]([^\)）]*)[\)）]/g;
    let m;
    
    while((m = rx.exec(name)) !== null){
      const raw = m[0];
      const inner = m[1].trim();
      const up = inner.toUpperCase();
      
      // Platform pattern: letter followed by 1-2 digits (e.g., "A1", "BT2")
      if(!platform && /^[A-Z]{1,2}\d{1,2}$/.test(up)){
        platform = up;
        title = title.replace(raw, '');
      } 
      // Stop code pattern: 2 letters followed by 2-3 digits (e.g., "JO01")
      else if(!stopCode && /^[A-Z]{2}\d{2,3}$/.test(up)){
        stopCode = up;
        title = title.replace(raw, '');
      }
    }
    return { title: title.trim(), platform, stopCode };
  }

  /**
   * Formats an ISO 8601 timestamp to display only the time portion
   * @param {string} iso - ISO 8601 formatted date-time string
   * @returns {string} Time in HH:MM:SS format, or empty string if invalid
   */
  function formatTimeOnly(iso){
    if (!iso || typeof iso !== 'string') return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  window.TimoETA.formatTimeOnly = formatTimeOnly;

  /**
   * Parses a route string into prefix, numeric, and suffix components
   * Example: "62X" -> {prefix: "", num: 62, suffix: "X"}
   * Example: "N118" -> {prefix: "N", num: 118, suffix: ""}
   * @param {string} r - Route string to parse
   * @returns {Object} Object with prefix, num, and suffix properties
   */
  function parseRouteStr(r){
    if (!r || typeof r !== 'string') {
      return {prefix: '', num: 0, suffix: ''};
    }
    const m = r.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
    return m ? {prefix: m[1], num: +m[2], suffix: m[3]} : {prefix: r, num: 0, suffix: ''};
  }

  /**
   * Comparison function for sorting routes alphanumerically
   * Sorts by prefix alphabetically, then by number, then by suffix
   * @param {Object} a - First route object with route property
   * @param {Object} b - Second route object with route property
   * @returns {number} Negative if a < b, positive if a > b, 0 if equal
   */
  function compareRoute(a, b){
    const x = parseRouteStr(a.route);
    const y = parseRouteStr(b.route);
    if(x.prefix !== y.prefix) return x.prefix.localeCompare(y.prefix);
    if(x.num !== y.num) return x.num - y.num;
    return x.suffix.localeCompare(y.suffix);
  }
  window.TimoETA.compareRoute = compareRoute;

  /**
   * Determines the CSS class for styling a route tag based on route characteristics
   * Routes are categorized for visual distinction (e.g., Airport, Express, Night buses)
   * @param {string} r - Route number/code
   * @returns {string} CSS class name for the route tag
   */
  function routeTagClass(r){
    if (!r || typeof r !== 'string') return 'route-normal';
    const up = r.toUpperCase();
    const {prefix, num} = parseRouteStr(up);
    
    if(prefix === 'A') return 'route-A';                    // Airport routes
    if(/^[ES]/.test(prefix)) return 'route-ES';            // Express/Special routes
    if(prefix === 'HK') return 'route-HK';                  // Hong Kong routes
    if(prefix === 'N') return 'route-N';                    // Night buses
    if(num >= 100 && num < 200) return 'route-1XX';         // 100-series routes
    if(num >= 300 && num < 400) return 'route-3XX';         // 300-series routes
    if(num >= 600 && num < 700) return 'route-6XX';         // 600-series routes
    if(num >= 900 && num < 1000) {
      return prefix === 'P' ? 'route-P9XX' : 'route-9XX';   // 900-series routes
    }
    return 'route-normal';
  }
  window.TimoETA.routeTagClass = routeTagClass;

  // No changes needed here, just removing the wrapper line if it was redundant but it's used as a local shorthand. Actually, looking at the code, it's fine. Wait, the instructions said to remove redundant utility wrappers. Let's see.

  /**
   * Main function to fetch and display KMB bus ETAs for stops matching search criteria
   * Supports partial stop name matching and optional route filtering
   * Groups results by stop name and displays in mobile cards or desktop tables
   */
  window.TimoETA.buildKMB = async function(){
    const controller = TimoETA.createRequestController();
    const currentLang = TimoETA.getLang();
    const L = TimoETA.ALL_LANGS_DATA.kmb[currentLang];
    const suffix = SUFFIX[currentLang];

    const stopIn = document.getElementById('stopName').value.trim().toLowerCase();
    const rawR = document.getElementById('routeNumbers').value.trim().toUpperCase();
    const filter = rawR.split(',').map(r => r.trim()).filter(Boolean);
    const results = document.getElementById('results');
    results.innerHTML = '';

    // Validate input
    if (!stopIn) {
      results.innerHTML = `<div class="no-results">${L.stopNotFound}</div>`;
      return;
    }

    // Fetch all stops and filter by name
    const allStops = await getStops();
    if (!Array.isArray(allStops) || allStops.length === 0) {
      results.innerHTML = `<div class="no-results">${L.stopNotFound}</div>`;
      return;
    }

    const matches = allStops.filter(s =>
      (s.name_en && s.name_en.toLowerCase().includes(stopIn)) ||
      (s.name_tc && s.name_tc.toLowerCase().includes(stopIn)) ||
      (s.name_sc && s.name_sc.toLowerCase().includes(stopIn))
    );

    if(!matches.length){
      results.innerHTML = `<div class="no-results">${L.stopNotFound}</div>`;
      return;
    }

    // Group stops by name (removing platform/code info)
    const groups = {};
    matches.forEach(s => {
      const full = s[`name_${currentLang}`] || s.name_en || '';
      const info = parseStopInfo(full);
      // Fallback to English name if stop code not found in current language
      if(!info.stopCode) {
        info.stopCode = parseStopInfo(s.name_en).stopCode;
      }
      (groups[info.title] = groups[info.title] || []).push({
        stopId: s.stop,
        platform: info.platform,
        stopCode: info.stopCode
      });
    });

    // Process each stop group
    for(const [title, infos] of Object.entries(groups)){
      // Fetch ETAs for all stops in this group in parallel
      const etasArr = await Promise.all(infos.map(i => getETAs(i.stopId)));
      const rows = [];
      
      infos.forEach((info, idx) => {
        let data = etasArr[idx];
        
        // Apply route filter if specified
        if(filter.length){
          data = data.filter(e => filter.includes(e.route.toUpperCase()));
        }
        
        // Group ETAs by route and destination
        const byKey = {};
        data.forEach(e => {
          const key = `${e.route}|${e.dest_en}`;
          (byKey[key] = byKey[key] || []).push(e);
        });
        
        // Process each route-destination group
        Object.values(byKey).forEach(ent => {
          ent.sort((a, b) => a.eta_seq - b.eta_seq);
          
          // Select best service type (prefer 1, then 2, then 3)
          const svcOrder = ['1', '2', '3'];
          const chosen = [];
          for(const svc of svcOrder){
            const tmp = ent.filter(x => String(x.service_type) === svc && x.eta);
            if(tmp.length){ 
              chosen.push(...tmp);
              break;
            }
          }
          if(!chosen.length) chosen.push(...ent.filter(x => x.eta));
          
          // Take up to 3 ETAs
          const sliced = [chosen[0] || {}, chosen[1] || {}, chosen[2] || {}];
          const base = chosen[0] || ent[0] || {};
          
          // Extract remarks
          const numberedRemarks = sliced
            .filter(x => x.eta && x[`rmk_${suffix}`])
            .map(x => `ETA${x.eta_seq}: ${x[`rmk_${suffix}`]}`);
          const noetaRemarks = ent
            .filter(x => x[`rmk_${suffix}`])
            .map(x => x[`rmk_${suffix}`]);

          rows.push({
            stopId: info.stopId,
            route: base.route,
            dest: base[`dest_${suffix}`],
            platform: info.platform,
            stopCode: info.stopCode,
            etas: sliced,
            numberedRemarks,
            noetaRemarks,
            serviceType: base.service_type
          });
        });
      });

      // Sort: routes with ETAs first, then alphabetically
      rows.sort((a, b) => {
        const aHas = a.etas.some(e => e.eta);
        const bHas = b.etas.some(e => e.eta);
        if(aHas !== bHas) return aHas ? -1 : 1;
        return compareRoute(a, b);
      });

      // Create stop title heading
      const h3 = document.createElement('h3');
      h3.textContent = title;
      results.appendChild(h3);

      if(TimoETA.isMobile()){
        const mobileCards = rows.map(r => {
          const cardData = {
            mode: 'kmb',
            route: r.route,
            routeClass: TimoETA.routeTagClass(r.route),
            dest: r.dest,
            platform: r.platform,
            etas: r.etas.filter(e => e.eta).map(e => ({
              time: TimoETA.formatTimeOnly(e.eta),
              isScheduled: e.rmk_en?.includes('Scheduled Bus')
            })),
            details: (() => {
              const frag = document.createDocumentFragment();
              const items = [
                { label: 'Stop Code', value: r.stopCode || 'N/A' },
                { label: 'Platform', value: r.platform || 'N/A' },
                { label: 'Remarks', value: r.etas.some(e => e.eta) ? r.numberedRemarks.join('; ') : (r.noetaRemarks.join('; ') || L.noEtas) }
              ];
              items.forEach(item => {
                const div = document.createElement('div');
                const strong = document.createElement('strong');
                strong.textContent = `${item.label}: `;
                div.appendChild(strong);
                div.append(item.value);
                frag.appendChild(div);
              });
              return frag;
            })()
          };
          return TimoETA.createMobileCard(cardData);
        });
        mobileCards.forEach(card => results.appendChild(card));
        TimoETA.alignMobileColumns();
      } else {
        const showPlat=rows.some(r=>r.platform);
        const desktopHeaders = [
          L.tableHeaders.Route, L.tableHeaders.Destination,
          ...(showPlat ? [L.tableHeaders.Platform] : []),
          L.tableHeaders.StopCode, L.tableHeaders.ETA1, L.tableHeaders.ETA2, L.tableHeaders.ETA3, L.tableHeaders.Remarks
        ];
        const desktopRows = rows.map(r => {
          const noEta = !r.etas.some(e => e.eta);
          const row = [];
          row.push({ html: `<span class="route-tag ${TimoETA.routeTagClass(r.route)}">${r.route}</span>` });
          row.push(r.dest);
          if (showPlat) row.push(r.platform);
          row.push(r.stopCode);

          if (noEta) {
            row.push({ text: r.noetaRemarks[0] || L.noEtas, colspan: 4 });
          } else {
            r.etas.forEach(e => {
              row.push({
                text: TimoETA.formatTimeOnly(e.eta),
                class: e.rmk_en?.includes('Scheduled Bus') ? 'scheduled-eta' : ''
              });
            });
            row.push(r.numberedRemarks.join('; '));
          }
          return row;
        });
        const table = TimoETA.createDesktopTable(desktopHeaders, desktopRows);
        results.appendChild(table);
      }
    }
  };
})();