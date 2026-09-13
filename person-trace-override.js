(() => {
  'use strict';

  const PEOPLE = {
    'MW-HVN-041': {
      name: 'MINWOO', status: 'PROTECTED', state: 'protected', confidence: 100,
      location: 'THE ISLAND', region: 'COORDINATES ROTATING', lastSignal: 'CURRENT SIGNAL',
      summary: 'Presence confirmed inside the protected perimeter. Real coordinates remain isolated from external records and rotate with each protection cycle.',
      note: 'Do not expose coordinates. I built that place so nobody would need to disappear again.',
      timeline: [['NOW','Signature recognized by the internal HAVEN mesh.'],['-18 MIN','Authorized access inside the residential sector.'],['-03 H','Geospatial route rotated and external trace scrubbed.']]
    },
    'DT-SF-772': {
      name: 'DANTE', status: 'ACTIVE', state: 'active', confidence: 94,
      location: 'SAN FRANCISCO', region: 'CALIFORNIA // UNITED STATES', lastSignal: '26 MIN AGO',
      summary: 'Digital activity remains compatible with the known pattern. The latest coherent trace is still concentrated in San Francisco.',
      note: 'He keeps moving. Somehow he always returns to the same city.',
      timeline: [['-26 MIN','Known device answered on a local San Francisco network.'],['-02 H','Short movement confirmed inside the urban perimeter.'],['YESTERDAY','Communication pattern recognized. No contact initiated.']]
    },
    'SN-PR-309': {
      name: 'SNNAT', status: 'ACTIVE', state: 'active', confidence: 91,
      location: 'PARIS', region: 'ÎLE-DE-FRANCE // FRANCE', lastSignal: '41 MIN AGO',
      summary: 'Public traces and device signatures continue to place Snnat in Paris. There is no recent evidence of a city change.',
      note: 'Paris suits him. Maybe that is why I never needed to ask if he was okay.',
      timeline: [['-41 MIN','Signature recognized on a public Paris connection.'],['-05 H','Activity recorded in the same right-bank sector.'],['-04 DAYS','Continuous presence in the city confirmed.']]
    },
    'BE-CDA-117': {
      name: 'BEA', status: 'ACTIVE', state: 'active', confidence: 97,
      location: 'CIDADE DOS ANJOS', region: 'CURRENT LOCATION', lastSignal: '12 MIN AGO',
      summary: 'The private signature bound to this code remains active inside Cidade dos Anjos. Recent network fragments indicate continuous presence in the city.',
      note: 'If she needs me, I want to know before she has to ask.',
      timeline: [['-12 MIN','Private code answered on an urban node in Cidade dos Anjos.'],['-01 H','Device signature remained stable inside the same perimeter.'],['YESTERDAY','Presence pattern confirmed. No associated alert.']]
    },
    'MN-ARC-033': {
      name: 'MOON', status: 'DECEASED', state: 'deceased', confidence: 100,
      location: 'LAST KNOWN RECORD', region: 'LOCATION WITHHELD', lastSignal: 'RECORD CLOSED',
      summary: 'No vital or digital activity was detected after the record was closed. The profile was removed from automatic acquisition, but Noah never authorized deletion.',
      note: 'I know what the system found. Keeping the file does not mean I am waiting for an answer.',
      timeline: [['ARCHIVED','Automatic monitoring terminated. State confirmed.'],['LAST SIGNAL','Record preserved in Noah private archive.'],['—','Further automatic trace attempts blocked by system policy.']]
    }
  };

  const SCAN_LINES = [
    'AUTH // N.ROOT clearance accepted',
    'INDEX // resolving encrypted trace code',
    'RELAY // querying private and public trace nodes',
    'CORRELATE // matching device, route and identity fragments',
    'VERIFY // validating latest coherent signal'
  ];

  let overlay = null;
  let pendingCode = null;
  let timers = [];

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function iconPin() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  }

  function createOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.id = 'mugunghwa-shell-overlay';
    overlay.innerHTML = `
      <div class="mso-shell">
        <header class="mso-head">
          <div><b>무궁화</b><span>MUGUNGHWA // TRACE VIEWER</span></div>
          <p>NOAH PRIVATE NETWORK // <strong id="mso-network">STANDBY</strong></p>
        </header>
        <main id="mso-main"></main>
        <footer><span>acquisition: ROOT SHELL ONLY</span><span>viewer: READ-ONLY</span></footer>
      </div>`;
    document.body.appendChild(overlay);
    renderIdle();
    return overlay;
  }

  function setNetwork(text) {
    const node = overlay?.querySelector('#mso-network');
    if (node) node.textContent = text;
  }

  function renderIdle() {
    const main = createOverlay().querySelector('#mso-main');
    setNetwork('STANDBY');
    main.innerHTML = `
      <section class="mso-idle">
        <div class="mso-crosshair"><i></i><i></i><i></i></div>
        <span>NO ACTIVE ACQUISITION</span>
        <h2>TRACE REQUESTS DO NOT START HERE</h2>
        <p>MUGUNGHWA is now a result viewer. A subject can only be resolved from the root shell using a private identifier.</p>
        <div class="mso-command"><span>root@node07:~$</span><code>trace --id &lt;PRIVATE_CODE&gt;</code></div>
        <small>NAMES DISABLED // MANUAL TARGET SELECTION DISABLED</small>
      </section>`;
  }

  function renderScanning(code) {
    const main = createOverlay().querySelector('#mso-main');
    setNetwork('TRACE ACTIVE');
    main.innerHTML = `
      <section class="mso-scan">
        <div class="mso-radar"><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i><i class="sweep"></i><strong id="mso-percent">14%</strong></div>
        <div class="mso-scan-data"><span>TARGET IDENTIFIER</span><b>${code}</b><small>PRIVATE CODE RESOLUTION</small></div>
        <div class="mso-log"><div class="mso-log-head"><span>LIVE TRACE LOG</span><b>PROCESSING</b></div><div id="mso-lines"></div></div>
      </section>`;
  }

  function renderNotFound(code) {
    setNetwork('NO COHERENT SIGNAL');
    createOverlay().querySelector('#mso-main').innerHTML = `
      <section class="mso-notfound">
        <div class="mso-x">×</div><span>TRACE COMPLETE // NO MATCH</span>
        <h2>IDENTIFIER NOT RECOGNIZED</h2>
        <p><b>${code}</b> does not correspond to any subject known by the current mesh.</p>
        <small>NEW ACQUISITION MUST BE REQUESTED FROM ROOT SHELL</small>
      </section>`;
  }

  function renderResult(code, person) {
    setNetwork('SIGNAL LOCKED');
    const initials = person.name.slice(0, 2);
    const events = person.timeline.map(([time, text]) => `<div class="mso-event"><time>${time}</time><i></i><p>${text}</p></div>`).join('');
    createOverlay().querySelector('#mso-main').innerHTML = `
      <section class="mso-result ${person.state}">
        <div class="mso-result-bar"><div><i></i><b>SUBJECT ACQUIRED</b><small>TRACE ID // ${code}</small></div><span>READ-ONLY RESULT</span></div>
        <div class="mso-profile">
          <header><div class="mso-id"><strong>${initials}</strong><div><small>SUBJECT</small><h2>${person.name}</h2><span>${person.status}</span></div></div><div class="mso-confidence"><span>SIGNAL CONFIDENCE</span><b>${person.confidence}%</b><i><em style="width:${person.confidence}%"></em></i></div></header>
          <div class="mso-location">${iconPin()}<div><small>LAST KNOWN LOCATION</small><strong>${person.location}</strong><b>${person.region}</b></div><span>${person.lastSignal}</span></div>
          <div class="mso-meta"><div><span>TRACE ID</span><b>${code}</b></div><div><span>RESOLUTION</span><b>MULTI-NODE CORRELATION</b></div><div><span>STATUS</span><b>${person.state === 'deceased' ? 'ARCHIVED' : 'MONITORING'}</b></div></div>
          <p class="mso-summary">${person.summary}</p>
          <div class="mso-timeline"><span>TRACE HISTORY</span>${events}</div>
          <blockquote><span>N.ROOT // PRIVATE NOTE</span>${person.note}</blockquote>
        </div>
      </section>`;
  }

  function start(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return;
    pendingCode = normalized;
    clearTimers();
    createOverlay();
    renderScanning(normalized);

    SCAN_LINES.forEach((line, index) => {
      const timer = setTimeout(() => {
        const lines = overlay?.querySelector('#mso-lines');
        if (!lines) return;
        const row = document.createElement('div');
        row.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><p>${line}</p><b>OK</b>`;
        lines.appendChild(row);
        const pct = overlay.querySelector('#mso-percent');
        if (pct) pct.textContent = `${Math.min(99, 14 + (index + 1) * 17)}%`;
      }, 320 + index * 470);
      timers.push(timer);
    });

    timers.push(setTimeout(() => {
      const person = PEOPLE[normalized];
      person ? renderResult(normalized, person) : renderNotFound(normalized);
    }, 320 + SCAN_LINES.length * 470 + 650));
  }

  window.__NOAH_PERSON_TRACE__ = start;

  function updatePosition() {
    const app = document.querySelector('.app-search');
    const body = app?.querySelector('.window-body');
    if (!app || app.classList.contains('minimized') || !body) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    const rect = body.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    const node = createOverlay();
    node.style.display = 'block';
    node.style.left = `${Math.round(rect.left)}px`;
    node.style.top = `${Math.round(rect.top)}px`;
    node.style.width = `${Math.round(rect.width)}px`;
    node.style.height = `${Math.round(rect.height)}px`;
    const z = Number.parseInt(app.style.zIndex || '20', 10) || 20;
    node.style.zIndex = String(z + 2);
    if (pendingCode && node.dataset.pendingApplied !== pendingCode) node.dataset.pendingApplied = pendingCode;
  }

  const observer = new MutationObserver(updatePosition);
  observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class','style']});
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);
  setInterval(updatePosition, 120);
})();
