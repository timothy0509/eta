// src/lr.js
;(function(){
  const API = id =>
    `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${encodeURIComponent(id)}`;

  const STOPS = window.TimoETA.LR_STOPS;
  const NAME_TO_ID = window.TimoETA.LR_NAME_TO_ID;

  const COLORS = {
    '505':'#da2128','507':'#25a650','507P':'#25a650','610':'#551b14','614':'#44c0f3',
    '614P':'#f4858d','615':'#f9dd07','615P':'#256684','705':'#72bf44','706':'#b27ab4',
    '751':'#f5821f','761P':'#6f2b91'
  };

  // Use shared utilities from TimoETA namespace
  function contrastColor(hex){ return TimoETA.contrastColor(hex); }
  function getLang(){ return TimoETA.getLang(); }
  function isMobile(){ return TimoETA.isMobile(); }

  window.TimoETA.buildLR = async function(){
    const currentLang=getLang();
    const L=TimoETA.ALL_LANGS_DATA.lr[currentLang];

    const raw = document.getElementById('stopName').value.trim().toLowerCase();
    const results = document.getElementById('results');
    results.innerHTML='';

    const stationId = NAME_TO_ID[raw];
    if (stationId == null) {
      results.innerHTML = `<div class="no-results">${L.stopNotFound}</div>`;
      return;
    }

    try {
      const res = await fetch(API(stationId)),
            j   = await res.json();
      if (j.status!==1 || !j.platform_list?.length) {
        results.innerHTML = `<div class="no-results">${L.noData}</div>`;
        return;
      }

      j.platform_list.forEach(p=>{
        const h3 = document.createElement('h3');
        h3.textContent = `Platform ${p.platform_id || 'Unknown'}`;
        results.appendChild(h3);

        if(isMobile()){
          const mobileCards = (p.route_list || []).map(e => {
            const bg = COLORS[e.route_no];
            const cardData = {
              mode: 'lr',
              route: e.route_no || '',
              routeBgColor: bg,
              routeColor: bg ? contrastColor(bg) : '#000',
              dest: (currentLang==='en'?e.dest_en:e.dest_ch) || '',
              platform: p.platform_id || '',
              etas: [{ time: (currentLang==='en'?e.time_en:e.time_ch) || '' }]
            };
            return TimoETA.createMobileCard(cardData);
          });
          mobileCards.forEach(card => results.appendChild(card));
          TimoETA.alignMobileColumns();
        } else {
          const desktopHeaders = [L.tableHeaders.Route, L.tableHeaders.Destination, L.tableHeaders.Time];
          const desktopRows = (p.route_list || []).map(e => {
            const bg = COLORS[e.route_no];
            const fg = bg ? contrastColor(bg) : '#000';
            return [
              { html: `<span class="route-tag" style="background-color:${bg};color:${fg};">${e.route_no || ''}</span>` },
              (currentLang==='en'?e.dest_en:e.dest_ch) || '',
              (currentLang==='en'?e.time_en:e.time_ch) || ''
            ];
          });
          const table = TimoETA.createDesktopTable(desktopHeaders, desktopRows);
          results.appendChild(table);
        }
      });
    } catch(err){
      console.error(err);
      results.innerHTML = `<div class="no-results">${L.noData}</div>`;
    }
  };
})();