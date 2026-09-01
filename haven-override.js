(() => {
  'use strict';

  const TRACE_COMMANDS = new Set([
    'trace',
    'trace --current',
    './trace --request=current --auth=creator',
    'haven.trace'
  ]);

  const COORDS = [
    { display: `32°57'18\"S / 143°21'09\"W`, sector: 'SOUTH PACIFIC // NULL SECTOR 33' },
    { display: `18°04'33\"N / 172°11'47\"E`, sector: 'NORTH PACIFIC // SILENT CORRIDOR 07' },
    { display: `47°33'01\"S / 102°07'19\"W`, sector: 'SOUTH PACIFIC // BLIND ZONE 19' }
  ];

  const SCAN_LINES = [
    '[OWNER] signature H40N / N.ROOT detected',
    '[OK] creator key accepted — privilege level: ARCHITECT',
    '[MESH] waking 33 silent beacons... 33/33',
    '[ROUTE] opening one-use channel through NODE-07',
    '[MASK] discarding 144 decoy coordinate sets',
    '[PULSE] secure perimeter responded to Noah handshake',
    '[DECRYPT] rebuilding ephemeral geospatial shard',
    '[VERIFY] threat signatures: 0 / safe-zone integrity: 100%',
    '[FOUND] coordinate disclosure authorized'
  ];

  const DECOYS = [
    '[COVER] broadcasting false geospatial shard',
    '[RELAY] bouncing signal through unmapped node',
    '[DECOY] publishing synthetic coordinate pair',
    '[SCRUB] removing route from volatile memory',
    '[NOISE] injecting corrupted satellite telemetry',
    '[MASK] rotating ocean-sector identifiers',
    '[GHOST] mirroring handshake across dead relay',
    '[NULL] invalidating previous origin signature'
  ];

  let overlay = null;
  let targetBody = null;
  let currentCoord = 0;
  let phase = 'idle';
  let scanTimers = [];
  let countdownTimer = null;
  let decoyTimer = null;
  let countdown = 5;

  function clearTimers() {
    scanTimers.forEach(clearTimeout);
    scanTimers = [];
    clearInterval(countdownTimer);
    countdownTimer = null;
    clearInterval(decoyTimer);
    decoyTimer = null;
  }

  function createOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.id = 'haven-safe-overlay';
    overlay.setAttribute('aria-label', 'HAVEN TRACE command interface');
    overlay.innerHTML = `
      <div class="hso-shell">
        <header class="hso-header">
          <div>
            <span class="hso-dot"></span>
            <span><b>HAVEN TRACE</b><small>mobile coordinate protocol // authored by NØAH</small></span>
          </div>
          <div class="hso-owner"><span>CREATOR ACCESS</span><b>H40N / N.ROOT</b></div>
        </header>

        <div class="hso-main">
          <section class="hso-terminal">
            <div class="hso-terminal-head">
              <span>⌘ root@node07:/haven/trace.sh</span>
              <b id="hso-state">IDLE</b>
            </div>
            <div id="hso-log" class="hso-log" aria-live="polite">
              <pre>[HAVEN] secure mesh dormant // command interface armed</pre>
              <pre>[INFO] type <b>help</b> to list available commands</pre>
            </div>
            <form id="hso-form" class="hso-command">
              <span>root@node07:/haven$</span>
              <input id="hso-input" autocomplete="off" spellcheck="false" placeholder="type command..." />
            </form>
            <footer>
              <span>connection: AIR-GAPPED RELAY</span>
              <span>echo access: DENIED</span>
            </footer>
          </section>

          <section id="hso-radar-panel" class="hso-radar-panel" hidden>
            <div class="hso-radar-toolbar">
              <span><i></i> TEMPORARY RADAR LOCK</span>
              <b id="hso-expire">EXPIRES 00:05</b>
            </div>
            <div class="hso-radar">
              <i class="hso-ring r1"></i>
              <i class="hso-ring r2"></i>
              <i class="hso-ring r3"></i>
              <i class="hso-axis ax"></i>
              <i class="hso-axis ay"></i>
              <i class="hso-sweep"></i>
              <i class="hso-ping"></i>
              <div class="hso-coords">
                <span>LOCKED COORDINATES</span>
                <strong id="hso-coord">--</strong>
                <small id="hso-sector">--</small>
              </div>
            </div>
            <div class="hso-readout">
              <span>ONE-TIME COORDINATE SHARD // 5 SEC</span>
              <strong id="hso-coord-copy">--</strong>
              <small id="hso-sector-copy">--</small>
            </div>
          </section>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#hso-form').addEventListener('submit', onCommand);
    return overlay;
  }

  function log(text, cls = '') {
    const area = overlay?.querySelector('#hso-log');
    if (!area) return;
    const pre = document.createElement('pre');
    if (cls) pre.className = cls;
    pre.textContent = text;
    area.appendChild(pre);
    while (area.children.length > 80) area.firstElementChild?.remove();
    area.scrollTop = area.scrollHeight;
  }

  function setState(text) {
    const node = overlay?.querySelector('#hso-state');
    if (node) node.textContent = text;
  }

  function setInputEnabled(enabled) {
    const input = overlay?.querySelector('#hso-input');
    if (!input) return;
    input.disabled = !enabled;
    input.placeholder = enabled ? 'type command...' : 'trace in progress...';
    if (enabled) setTimeout(() => input.focus(), 20);
  }

  function onCommand(event) {
    event.preventDefault();
    const input = overlay.querySelector('#hso-input');
    const raw = input.value.trim();
    if (!raw) return;
    input.value = '';
    const cmd = raw.toLowerCase();
    log(`$ ${raw}`);

    if (cmd === 'help') {
      log('[CMD] trace --current');
      log('[CMD] ./trace --request=current --auth=creator');
      log('[INFO] coordinate exposure window: 5 seconds');
      return;
    }

    if (TRACE_COMMANDS.has(cmd)) {
      if (phase === 'scanning' || phase === 'located') {
        log('[BUSY] active trace has not been purged yet');
        return;
      }
      startTrace();
      return;
    }

    if (cmd === 'clear') {
      const area = overlay.querySelector('#hso-log');
      area.innerHTML = '<pre>[HAVEN] terminal buffer cleared</pre>';
      return;
    }

    log('[ERR] UNKNOWN COMMAND // type: help');
  }

  function startTrace() {
    clearTimers();
    phase = 'scanning';
    setState('RESOLVING');
    setInputEnabled(false);
    const radar = overlay.querySelector('#hso-radar-panel');
    radar.hidden = true;

    SCAN_LINES.forEach((line, index) => {
      const timer = setTimeout(() => {
        log(line, line.includes('FOUND') ? 'found' : line.includes('VERIFY') ? 'verified' : '');
        if (index === SCAN_LINES.length - 1) {
          setTimeout(revealCoordinates, 280);
        }
      }, 180 + index * 260);
      scanTimers.push(timer);
    });
  }

  function revealCoordinates() {
    phase = 'located';
    countdown = 5;
    const coord = COORDS[currentCoord % COORDS.length];
    currentCoord += 1;

    overlay.querySelector('#hso-coord').textContent = coord.display;
    overlay.querySelector('#hso-sector').textContent = coord.sector;
    overlay.querySelector('#hso-coord-copy').textContent = coord.display;
    overlay.querySelector('#hso-sector-copy').textContent = coord.sector;
    overlay.querySelector('#hso-radar-panel').hidden = false;
    overlay.querySelector('#hso-expire').textContent = 'EXPIRES 00:05';
    setState('EXPOSURE 00:05');

    let decoyIndex = 0;
    decoyTimer = setInterval(() => {
      const n = String((decoyIndex * 37 + 19) % 997).padStart(3, '0');
      log(`${DECOYS[decoyIndex % DECOYS.length]} // NULL-${n}`);
      decoyIndex += 1;
    }, 720);

    countdownTimer = setInterval(() => {
      countdown -= 1;
      const text = `00:0${Math.max(0, countdown)}`;
      overlay.querySelector('#hso-expire').textContent = `EXPIRES ${text}`;
      setState(`EXPOSURE ${text}`);
      if (countdown <= 0) purgeCoordinates();
    }, 1000);
  }

  function purgeCoordinates() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    phase = 'masking';
    overlay.querySelector('#hso-radar-panel').hidden = true;
    setState('COVER ACTIVE');
    log('[PURGE] coordinate shard destroyed after 5-second window');
    log('[COVER] continuing autonomous misdirection protocol');
    setInputEnabled(true);
  }

  function updateOverlayPosition() {
    const app = document.querySelector('.app-locator');
    const ready = app?.querySelector('.locator-ready');
    const body = app?.querySelector('.window-body');

    if (!app || app.classList.contains('minimized') || !ready || !body) {
      if (overlay) overlay.style.display = 'none';
      targetBody = null;
      return;
    }

    targetBody = body;
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
  }

  const observer = new MutationObserver(updateOverlayPosition);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  window.addEventListener('resize', updateOverlayPosition);
  window.addEventListener('scroll', updateOverlayPosition, true);
  setInterval(updateOverlayPosition, 120);
})();
