(() => {
  "use strict";

  const STORAGE_KEY = "noah.ward.protection";

  const defaultState = () => ({
    visible: false,
    protected: false,
    ip: randomSyntheticIp(),
    route: "H40N RELAY",
    exposure: "MONITORED",
    updatedAt: Date.now()
  });

  function readState() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" ? { ...defaultState(), ...parsed } : defaultState();
    } catch {
      return defaultState();
    }
  }

  let state = readState();
  let panel = null;

  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function randomSyntheticIp() {
    // RFC 5737 TEST-NET blocks: reserved exclusively for documentation/examples.
    // This function is fully local and never reads, requests, or derives the user's real IP.
    const pools = ["192.0.2", "198.51.100", "203.0.113"];
    const prefix = pools[Math.floor(Math.random() * pools.length)];
    const octet = Math.floor(Math.random() * 254) + 1;
    return `${prefix}.${octet}`;
  }

  function stamp() {
    return new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function ensurePanel() {
    if (panel && panel.isConnected) return panel;

    panel = document.createElement("aside");
    panel.id = "ward-protection-monitor";
    panel.className = "ward-protection-monitor";
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <div class="wpm-head">
        <div>
          <i class="wpm-dot"></i>
          <span>WARD // LIVE PROTECTION</span>
        </div>
        <b>NODE-07</b>
      </div>
      <div class="wpm-state">
        <small>NETWORK STATE</small>
        <strong data-wpm="state">MONITORED</strong>
      </div>
      <dl>
        <div><dt>VISIBLE IP</dt><dd data-wpm="ip">${state.ip}</dd></div>
        <div><dt>ROUTE</dt><dd data-wpm="route">H40N RELAY</dd></div>
        <div><dt>EXPOSURE</dt><dd data-wpm="exposure">MONITORED</dd></div>
        <div><dt>SIGNATURE</dt><dd>H40N // VERIFIED</dd></div>
        <div><dt>E.C.H.O.</dt><dd>DORMANT // 0 I/O</dd></div>
        <div><dt>ECH-00</dt><dd>98.7% // NO HEARTBEAT</dd></div>
      </dl>
      <div class="wpm-foot">
        <span>WARD.INTEGRITYD / PID 0194</span>
        <b data-wpm="time">${stamp()}</b>
      </div>`;

    document.body.appendChild(panel);
    return panel;
  }

  function render(animateUpdate = false) {
    const el = ensurePanel();
    el.querySelector('[data-wpm="ip"]').textContent = state.ip;
    el.querySelector('[data-wpm="route"]').textContent = state.route;
    el.querySelector('[data-wpm="exposure"]').textContent = state.exposure;
    el.querySelector('[data-wpm="state"]').textContent = state.protected ? "NETWORK PROTECTED" : "ACTIVE MONITOR";
    el.querySelector('[data-wpm="time"]').textContent = stamp();
    el.classList.toggle("is-protected", !!state.protected);
    el.classList.toggle("is-visible", !!state.visible);

    if (animateUpdate && state.visible) {
      el.classList.remove("is-updating");
      void el.offsetWidth;
      el.classList.add("is-updating");
      window.setTimeout(() => el?.classList.remove("is-updating"), 700);
    }
  }

  function enable() {
    state = {
      ...state,
      visible: true,
      protected: false,
      ip: randomSyntheticIp(),
      route: "H40N RELAY",
      exposure: "MONITORED",
      updatedAt: Date.now()
    };
    save();
    render(true);
    return { ...state };
  }

  function privacy() {
    state = {
      ...state,
      visible: true,
      protected: true,
      ip: randomSyntheticIp(),
      route: "H40N // MULTI-HOP",
      exposure: "BLOCKED FROM PUBLIC NETWORK",
      updatedAt: Date.now()
    };
    save();
    render(true);
    return { ...state };
  }

  function close() {
    state = { ...state, visible: false, updatedAt: Date.now() };
    save();
    render(false);
    return { ...state };
  }

  function reset() {
    state = defaultState();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    render(false);
  }

  window.__NOAH_WARD_PROTECTION__ = {
    enable,
    privacy,
    close,
    reset,
    state: () => ({ ...state })
  };

  const boot = () => render(false);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
