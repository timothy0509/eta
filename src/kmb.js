// src/kmb.js
;(function(){
  const SUFFIX = { en:'en', tc:'tc', sc:'sc' };

  const API = {
    STOP_LIST: 'https://data.etabus.gov.hk/v1/transport/kmb/stop/',
    STOP_ETA: id=>`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${id}`
  };

  async function getStops(){
    if(!getStops.cache){
      try{
        const r=await fetch('cache/kmb_stops.json');
        if(r.ok){
          const j=await r.json();
          getStops.cache=j.data||j;
          return getStops.cache;
        }
      }catch(e){
        console.warn('Failed to load cached stops, fetching from API:', e);
      }
      try{
        const r=await fetch(API.STOP_LIST);
        if(!r.ok) throw new Error(`API returned ${r.status}`);
        const j=await r.json();
        getStops.cache=j.data||[];
      }catch(e){
        console.error('Failed to fetch stops from API:', e);
        getStops.cache=[];
      }
    }
    return getStops.cache;
  }
  window.TimoETA.getStops=getStops;

  async function getETAs(stopId){
    try{
      const r=await fetch(API.STOP_ETA(stopId));
      if(!r.ok) throw new Error(`API returned ${r.status}`);
      const j=await r.json();
      return j.data||[];
    }catch(e){
      console.error(`Failed to fetch ETAs for stop ${stopId}:`, e);
      return [];
    }
  }

  function parseStopInfo(name){
    if (!name || typeof name !== 'string') {
      return { title: '', platform: '', stopCode: '' };
    }
    let title=name, platform='', stopCode='';
    const rx=/[\(（]([^\)）]*)[\)）]/g;
    let m;
    while((m=rx.exec(name))!==null){
      const raw=m[0], inner=m[1].trim(), up=inner.toUpperCase();
      if(!platform && /^[A-Z]\d{1,2}$/.test(up)){
        platform=up; title=title.replace(raw,'');
      } else if(!stopCode && /^[A-Z]{2}\d{3}$/.test(up)){
        stopCode=up; title=title.replace(raw,'');
      }
    }
    return { title:title.trim(), platform, stopCode };
  }

  function formatTimeOnly(iso){
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-GB',{
      hour12:false, hour:'2-digit',
      minute:'2-digit', second:'2-digit'
    });
  }
  window.TimoETA.formatTimeOnly = formatTimeOnly;

  function parseRouteStr(r){
    if (!r || typeof r !== 'string') {
      return {prefix:'',num:0,suffix:''};
    }
    const m=r.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
    return m?{prefix:m[1],num:+m[2],suffix:m[3]}:{prefix:r,num:0,suffix:''};
  }
  function compareRoute(a,b){
    const x=parseRouteStr(a.route), y=parseRouteStr(b.route);
    if(x.prefix!==y.prefix) return x.prefix.localeCompare(y.prefix);
    if(x.num!==y.num) return x.num-y.num;
    return x.suffix.localeCompare(y.suffix);
  }
  window.TimoETA.compareRoute = compareRoute;

  function routeTagClass(r){
    const up=r.toUpperCase(),{prefix,num}=parseRouteStr(up);
    if(prefix==='A') return 'route-A';
    if(/^[ES]/.test(prefix)) return 'route-ES';
    if(prefix==='HK') return 'route-HK';
    if(prefix==='N') return 'route-N';
    if(num>=100&&num<200) return 'route-1XX';
    if(num>=300&&num<400) return 'route-3XX';
    if(num>=600&&num<700) return 'route-6XX';
    if(num>=900&&num<1000)
      return prefix==='P'?'route-P9XX':'route-9XX';
    return 'route-normal';
  }
  window.TimoETA.routeTagClass = routeTagClass;

  // Use shared utility from TimoETA namespace
  function isMobile(){ return TimoETA.isMobile(); }

  window.TimoETA.buildKMB=async function(){
    const currentLang=TimoETA.getLang();
    const L=TimoETA.ALL_LANGS_DATA.kmb[currentLang];
    const suffix=SUFFIX[currentLang];

    const stopIn=document.getElementById('stopName').value.trim().toLowerCase();
    const rawR=document.getElementById('routeNumbers').value.trim().toUpperCase();
    const filter=rawR.split(',').map(r=>r.trim()).filter(Boolean);
    const results=document.getElementById('results');
    results.innerHTML='';

    const allStops=await getStops();
    const matches=allStops.filter(s=>
      (s.name_en && s.name_en.toLowerCase().includes(stopIn))||
      (s.name_tc && s.name_tc.toLowerCase().includes(stopIn))||
      (s.name_sc && s.name_sc.toLowerCase().includes(stopIn))
    );

    if(!matches.length){
      results.innerHTML = `<div class="no-results">${L.stopNotFound}</div>`;
      return;
    }

    const groups={};
    matches.forEach(s=>{
      const full=s[`name_${currentLang}`],
            info=parseStopInfo(full);
      if(!info.stopCode) info.stopCode=parseStopInfo(s.name_en).stopCode;
      (groups[info.title]=groups[info.title]||[]).push({
        stopId:s.stop, platform:info.platform, stopCode:info.stopCode
      });
    });

    for(const [title,infos] of Object.entries(groups)){
      const etasArr=await Promise.all(infos.map(i=>getETAs(i.stopId)));
      const rows=[];
      infos.forEach((info,idx)=>{
        let data=etasArr[idx];
        if(filter.length){
          data=data.filter(e=>filter.includes(e.route.toUpperCase()));
        }
        const byKey={};
        data.forEach(e=>{
          const key=`${e.route}|${e.dest_en}`;
          (byKey[key]=byKey[key]||[]).push(e);
        });
        Object.values(byKey).forEach(ent=>{
          ent.sort((a,b)=>a.eta_seq-b.eta_seq);
          const svcOrder=['1','2','3'], chosen=[];
          for(const svc of svcOrder){
            const tmp=ent.filter(x=>String(x.service_type)===svc&&x.eta);
            if(tmp.length){ chosen.push(...tmp); break; }
          }
          if(!chosen.length) chosen.push(...ent.filter(x=>x.eta));
          const sliced=[chosen[0]||{},chosen[1]||{},chosen[2]||{}];
          const base=chosen[0]||ent[0]||{};
          const numberedRemarks=sliced
            .filter(x=>x.eta&&x[`rmk_${suffix}`])
            .map(x=>`ETA${x.eta_seq}: ${x[`rmk_${suffix}`]}`);
          const noetaRemarks=ent
            .filter(x=>x[`rmk_${suffix}`])
            .map(x=>x[`rmk_${suffix}`]);

          rows.push({
            stopId:info.stopId, route:base.route,
            dest:base[`dest_${suffix}`], platform:info.platform,
            stopCode:info.stopCode, etas:sliced,
            numberedRemarks, noetaRemarks,
            serviceType:base.service_type
          });
        });
      });

      rows.sort((a,b)=>{
        const aHas=a.etas.some(e=>e.eta),
              bHas=b.etas.some(e=>e.eta);
        if(aHas!==bHas) return aHas?-1:1;
        return compareRoute(a,b);
      });

      const h3=document.createElement('h3');
      h3.textContent=title;
      results.appendChild(h3);

      if(isMobile()){
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
            details: `<div><strong>Stop Code:</strong> ${TimoETA.sanitizeHTML(r.stopCode || 'N/A')}</div>
                      <div><strong>Platform:</strong> ${TimoETA.sanitizeHTML(r.platform || 'N/A')}</div>
                      <div><strong>Remarks:</strong> ${TimoETA.sanitizeHTML(r.etas.some(e => e.eta) ? r.numberedRemarks.join('; ') : (r.noetaRemarks.join('; ') || L.noEtas))}</div>`
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