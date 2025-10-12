// src/mtr.js
;(function(){
  const API = (line,sta,lang='en') =>
    `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php`+
    `?line=${encodeURIComponent(line)}`+
    `&sta=${encodeURIComponent(sta)}`+
    `&lang=${encodeURIComponent(lang)}`;

  const STATIONS    = window.TimoETA.MTR_STATIONS;
  const NAME_TO_CODE= window.TimoETA.MTR_NAME_TO_CODE;

  const LINE_COLOR = {
    AEL:'#2a888a',EAL:'#53b7e8',KTL:'#26ab4e',TWL:'#ed1c24',
    ISL:'#347dc5',TCL:'#f7943e',TKL:'#7e459b',TML:'#923011',
    DRL:'#f173ac',SIL:'#b5bd01'
  };

  // Use shared utilities from TimoETA namespace
  function contrastColor(hex){ return TimoETA.contrastColor(hex); }
  function getLang(){ return TimoETA.getLang(); }
  function isMobile(){ return TimoETA.isMobile(); }

  window.TimoETA.buildMTR = async function(){
    const currentLang=getLang();
    const L=TimoETA.ALL_LANGS_DATA.mtr[currentLang];

    const inp=document.getElementById('stopName').value.trim();
    const results=document.getElementById('results');
    results.innerHTML='';

    if(!inp){ 
      results.innerHTML = `<div class="no-results">${L.noData}</div>`;
      return;
    }
    const low=inp.toLowerCase();
    let sta=null,lines=[];
    const up=inp.toUpperCase();
    if(/^[A-Za-z]{3}$/.test(up) && STATIONS[up]?.lines){
      sta=up; lines=STATIONS[up].lines.slice();
    }
    if(!sta && NAME_TO_CODE[low]){
      sta=NAME_TO_CODE[low];
      lines=STATIONS[sta].lines.slice();
    }
    if(!sta){ 
      results.innerHTML = `<div class="no-results">${L.stationNotFound}</div>`;
      return;
    }

    let any=false;
    for(const line of lines){
      try{
        const res=await fetch(API(line,sta,currentLang)), j=await res.json();
        const key=`${line}-${sta}`;
        if(j.status===1 && j.data?.[key]){
          any=true; renderBlock(j.data[key], line);
        }
      }catch(e){ console.warn(e); }
    }
    if(!any) {
      results.innerHTML = `<div class="no-results">${L.noData}</div>`;
    }

    if(isMobile()) TimoETA.alignMobileColumns();
  };

  function renderBlock(block,line){
    const currentLang=getLang();
    const L=TimoETA.ALL_LANGS_DATA.mtr[currentLang];
    const results=document.getElementById('results');
    const bg=LINE_COLOR[line]||'#000', fg=contrastColor(bg);
    const lineName=STATIONS[line].name;

    ['UP','DOWN'].forEach(dir=>{
      const arr=block[dir]||[];
      if(!arr.length) return;
      const dests=Array.from(new Set(arr.map(e=>e.dest)))
        .map(d=>STATIONS[d]?.name||d).join(' / ');

      const h3=document.createElement('h3');
      const spanName=document.createElement('span');
      spanName.textContent=lineName;
      spanName.className='line-tag';
      spanName.style.backgroundColor=bg;
      spanName.style.color=fg;
      h3.appendChild(spanName);
      h3.append(` → ${dests}`);
      results.appendChild(h3);

      if(isMobile()){
        const mobileCards = arr.map(e => {
          const cardData = {
            mode: 'mtr',
            dest: STATIONS[e.dest]?.name || e.dest,
            platform: e.plat,
            routeBgColor: bg,
            routeColor: fg,
            etas: [{ time: (e.time||'').split(' ')[1]||e.time }]
          };
          return TimoETA.createMobileCard(cardData);
        });
        mobileCards.forEach(card => results.appendChild(card));
      } else {
        const desktopHeaders = [L.tableHeaders.Destination, L.tableHeaders.Platform, L.tableHeaders.Time];
        const desktopRows = arr.map(e => {
          return [
            STATIONS[e.dest]?.name || e.dest,
            e.plat,
            (e.time||'').split(' ')[1]||e.time
          ];
        });
        const table = TimoETA.createDesktopTable(desktopHeaders, desktopRows);
        results.appendChild(table);
      }
    });
  }
})();