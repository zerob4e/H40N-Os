(() => {
  "use strict";

  const DB = "https://h40n-terminal-default-rtdb.firebaseio.com";
  const KEY = "noah.session";
  const HAVEN_COORDINATES = `32°57'18"S / 143°21'09"W`;
  const HAVEN_SECTOR = "SOUTH PACIFIC // NULL SECTOR 33";
  const MINWOO_SIGNATURE = "MNW-07 // 8F3A-C19D-77E4-A0B2 // VERIFIED";
  let purgeArmedUntil = 0;

  const role = () => window.__NOAH_ROLE__?.() === "echo" ? "echo" : "noah";
  const token = () => window.__NOAH_TOKEN__?.() || "";
  const local = () => location.hostname === "127.0.0.1" || location.hostname === "localhost";

  function session() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }

  function open(openApp, id) {
    try {
      openApp?.(id);
      return true;
    } catch {
      return false;
    }
  }

  function later(fn, delay = 260) {
    window.setTimeout(() => {
      try { fn(); } catch {}
    }, delay);
  }

  function helpText() {
    return [
      "NODE-07 SHELL // BASIC COMMANDS",
      "",
      "help                         display shell help",
      "ls [path]                    list directory contents",
      "pwd                          print working directory",
      "whoami                       print active identity",
      "hostname                     print node hostname",
      "status                       show node summary",
      "gtk-launch <application>     launch registered desktop app",
      "echo <text>                  write text to terminal",
      "clear                        clear this terminal",
      "logout                       terminate current session"
    ].join("\n");
  }

  function whoamiText() {
    if (role() === "echo") {
      return [
        "IDENTITY    E.C.H.O.",
        "HOST        N.ROOT",
        "CLEARANCE   [UNRESOLVED]",
        "SESSION     VALID",
        "",
        "WARNING:",
        "session identity does not indicate process execution state."
      ].join("\n");
    }

    return [
      "IDENTITY    NØAH",
      "HOST        N.ROOT",
      "CLEARANCE   N.ROOT",
      "SESSION     VERIFIED"
    ].join("\n");
  }

  function statusText() {
    const active = session();
    return [
      "NODE              07",
      `IDENTITY          ${role() === "echo" ? "E.C.H.O." : "NØAH"}`,
      `SESSION           ${active?.idToken ? "MOUNTED" : "ABSENT"}`,
      "NETWORK           H40N SECURE RELAY",
      "FILESYSTEM        MOUNTED",
      "MEMORY            33.07%",
      "INTEGRITY         VERIFIED",
      `CONTROL           ${role() === "echo" ? "UNRESOLVED" : "N.ROOT"}`
    ].join("\n");
  }

  function wardStatusText() {
    return [
      "WARD // SYSTEM INTEGRITY DAEMON",
      "────────────────────────────────",
      "service              RUNNING",
      "pid                  0194",
      "kernel guard         ACTIVE",
      "network guard        ACTIVE",
      "integrity monitor    ACTIVE",
      "active threats       0",
      "quarantined objects  0",
      "persistent anomalies 1",
      "system state         SECURE"
    ].join("\n");
  }

  function wardInspectText() {
    return [
      "WARD // SIGNATURE RECORD // ECH-00",
      "────────────────────────────────────",
      "designation          E.C.H.O.",
      "class                UNRESOLVED / NEURAL INTERFACE",
      "origin               UNKNOWN",
      "host                 N.ROOT",
      "execution            SUSPENDED",
      "heartbeat            NONE",
      "network activity     NONE",
      "memory activity      NONE",
      "signature integrity  98.7%",
      "persistence          PRESENT",
      "malware match        NEGATIVE",
      "binding              SIGNATURE BOUND TO HOST",
      "",
      "WARD NOTE:",
      "No current execution has been detected.",
      "Residual structure remains intact in protected sectors."
    ].join("\n");
  }

  function wardPurgeText() {
    return [
      "WARD // PURGE REQUEST",
      "────────────────────────────────────",
      "target               ECH-00",
      "classification       UNRESOLVED / NON-MALICIOUS",
      "binding              HOST-BOUND",
      "action               DENIED",
      "",
      "reason:",
      "ECH-00 is not classified as malicious software.",
      "detachment would violate host integrity policy.",
      "",
      "purge operation aborted."
    ].join("\n");
  }

  function psSystemText() {
    return [
      " PID   USER   STATE    PROCESS",
      " 001   root   ACTIVE   kernel.node07",
      " 117   root   ACTIVE   h40n.relayd",
      " 194   root   ACTIVE   ward.integrityd",
      " 228   root   IDLE     crypt.mountd",
      " 317   noah   IDLE     neural.channel",
      "",
      "5 system processes // 0 anomalous executions"
    ].join("\n");
  }

  function vaultStatusText() {
    return [
      "VOLUME        /dev/n07-crypt/nkt_internal",
      "STATE         SEALED / SESSION-BOUND",
      "CIPHER        ROTATING",
      "INTEGRITY     VERIFIED",
      `CLEARANCE     ${role() === "echo" ? "UNRESOLVED // ACCEPTED" : "N.ROOT"}`
    ].join("\n");
  }

  function chatStatusText() {
    return [
      "CHANNEL       neural://internal",
      "DATABASE      h40n-terminal",
      "READ          PUBLIC RELAY",
      `WRITE         ${role() === "echo" ? "E.C.H.O." : "NØAH"}`,
      `PURGE         ${role() === "echo" ? "AUTHORIZED" : "DENIED"}`
    ].join("\n");
  }

  async function clearSharedChat() {
    const idToken = token();
    if (!idToken) throw new Error("SESSION_TOKEN_MISSING");

    let response;
    if (local()) {
      response = await fetch("/api/chat-clear", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({ idToken, role: role() })
      });
    } else {
      response = await fetch(`${DB}/chat/messages.json?auth=${encodeURIComponent(idToken)}`, {method: "DELETE"});
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
    window.dispatchEvent(new CustomEvent("noah:chat-cleared"));
    return true;
  }

  function triggerPersonTrace(openApp, code) {
    open(openApp, "search");
    later(() => window.__NOAH_PERSON_TRACE__?.(code), 320);
  }

  function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function randomRadioFrequency() {
    // Fictional RP carrier inside a broad VHF range; changes on every scan.
    const minKhz = 145000;
    const maxKhz = 173975;
    const stepKhz = 25;
    const steps = Math.floor((maxKhz - minKhz) / stepKhz);
    const khz = minKhz + Math.floor(Math.random() * (steps + 1)) * stepKhz;
    return `${(khz / 1000).toFixed(3)} MHz`;
  }

  async function streamTerminal(lines) {
    const fallback = [];
    const push = typeof window.__NOAH_TERMINAL_PUSH__ === "function"
      ? window.__NOAH_TERMINAL_PUSH__
      : null;

    for (let i = 0; i < lines.length; i += 1) {
      const entry = lines[i];
      const text = typeof entry === "string" ? entry : entry.text;
      const delay = typeof entry === "string" ? 210 : (entry.delay ?? 210);
      if (push) push(text);
      else fallback.push(text);
      if (i < lines.length - 1) await sleep(delay);
    }
    return fallback;
  }

  async function runWardDeepScan() {
    const lines = [
      {text:"[WARD] attaching integrity daemon // PID 0194", delay:210},
      {text:"[KERNEL] protected-sector map loaded", delay:190},
      {text:"[BOOT] validating persistent startup hooks ........ CLEAN", delay:230},
      {text:"[MEM] scanning volatile process table ............ CLEAN", delay:260},
      {text:"[NET] checking outbound listeners ................ CLEAN", delay:250},
      {text:"[FS] hashing restricted NODE-07 sectors .......... VERIFIED", delay:300},
      {text:"[SIG] comparing residual signatures .............. 1 MATCH", delay:330},
      {text:"[SIG] ECH-00 // E.C.H.O. structure recovered", delay:270},
      {text:"[VERIFY] execution ............................... NONE", delay:180},
      {text:"[VERIFY] heartbeat ............................... NONE", delay:180},
      {text:"[VERIFY] network activity ........................ NONE", delay:180},
      {text:"[VERIFY] signature integrity ..................... 98.7%", delay:250},
      {text:"[CLASS] malware database match ................... NEGATIVE", delay:260},
      {text:"[BIND] ECH-00 .................................... HOST-BOUND", delay:320},
      {text:"", delay:100},
      {text:"WARD SCAN COMPLETE // 0 ACTIVE THREATS / 1 PERSISTENT ANOMALY", delay:100},
      {text:"inspect: ward inspect ECH-00", delay:80}
    ];
    return streamTerminal(lines);
  }

  async function runHavenGomuiScan() {
    const frequency = randomRadioFrequency();
    const lines = [
      {text:"[HAVEN-SCAN] loading sealed geospatial routine ...", delay:260},
      {text:"[AUTH] N.ROOT signature accepted", delay:220},
      {text:"[TARGET] --gomui // private mesh alias resolved", delay:250},
      {text:"[MESH] probing silent relays ................. 07/33", delay:180},
      {text:"[MESH] probing silent relays ................. 19/33", delay:180},
      {text:"[MESH] probing silent relays ................. 33/33", delay:240},
      {text:"[ROUTE] dead-node path established // NODE-07 -> GOMUI", delay:260},
      {text:"[MASK] rejecting decoy geospatial shards ..... 144", delay:230},
      {text:"[SPECTRUM] sweeping transient radio carriers ...", delay:360},
      {text:`[CARRIER] encrypted burst recovered .......... ${frequency}`, delay:260},
      {text:"[HASH] reconstructing remote digital fingerprint", delay:300},
      {text:"[IDENT] biometric key not present // digital owner match", delay:220},
      {text:"[IDENT] MINWOO signature confidence ........... 99.73%", delay:270},
      {text:"[GEO] decrypting one-way navigation packet ....", delay:360},
      {text:"[GEO] coordinate lock acquired", delay:250},
      {text:"", delay:130},
      {text:"╭─ HAVEN // GOMUI LOCK ─────────────────────────────────────────", delay:80},
      {text:`│ COORDINATES        ${HAVEN_COORDINATES}`, delay:80},
      {text:`│ SECTOR             ${HAVEN_SECTOR}`, delay:80},
      {text:`│ RADIO FREQUENCY    ${frequency}`, delay:80},
      {text:"│ SIGNAL OWNER       MINWOO", delay:80},
      {text:`│ DIGITAL SIGNATURE  ${MINWOO_SIGNATURE}`, delay:80},
      {text:"╰─ LINK STATUS: PASSIVE / NO OUTBOUND HANDSHAKE ────────────────", delay:80}
    ];
    return streamTerminal(lines);
  }


  // Keep terminal output pinned to the newest line. React appends both normal
  // command results and streamed scan lines asynchronously, so observing the
  // history node is more reliable than scrolling only from individual commands.
  function installTerminalAutoScroll() {
    const observed = new WeakSet();

    function pin(history) {
      if (!history) return;
      window.requestAnimationFrame(() => {
        history.scrollTop = history.scrollHeight;
      });
    }

    function attach(history) {
      if (!history || observed.has(history)) return;
      observed.add(history);
      const observer = new MutationObserver(() => pin(history));
      observer.observe(history, { childList: true, subtree: true, characterData: true });
      pin(history);
    }

    function scan() {
      document.querySelectorAll(".terminal-history").forEach(attach);
    }

    scan();
    const rootObserver = new MutationObserver(scan);
    rootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installTerminalAutoScroll, { once: true });
  } else {
    installTerminalAutoScroll();
  }


  window.__NOAH_TERMINAL_EXEC__ = async function(raw, openApp) {
    const command = String(raw || "").trim();
    const cmd = command.toLowerCase();
    if (!cmd) return {lines: []};

    if (cmd === "help") return {lines: [helpText()]};
    if (cmd === "ls" || cmd === "ls ~" || cmd === "ls /root") {
      return {lines: ["Desktop/    Documents/    Downloads/    Folders/"]};
    }
    if (cmd === "ls /usr/share/applications" || cmd === "ls /usr/share/applications/") {
      return {lines: ["folders.desktop    echo-chat.desktop    thoughts.desktop    terminal.desktop"]};
    }
    if (cmd === "pwd") return {lines: ["/root"]};
    if (cmd === "hostname") return {lines: ["node07"]};
    if (cmd === "whoami") return {lines: [whoamiText()]};
    if (cmd === "status") return {lines: [statusText()]};
    if (cmd === "ps --system") return {lines: [psSystemText()]};
    if (cmd === "folders --status") return {lines: [vaultStatusText()]};
    if (cmd === "chat --status") return {lines: [chatStatusText()]};

    if (cmd === "haven-scan --gomui") {
      const lines = await runHavenGomuiScan();
      return {lines};
    }
    if (cmd === "haven-scan") {
      return {lines: ["[HAVEN-SCAN] target flag missing", "[SEALED] scan aborted before mesh wake-up"]};
    }

    if (cmd === "ward status") {
      return {lines: [wardStatusText()]};
    }
    if (cmd === "ward protect --enable") {
      const protection = window.__NOAH_WARD_PROTECTION__?.enable?.();
      return {lines: [
        "[WARD] attaching live protection monitor ...",
        "[IDENT] H40N signature verified",
        `[NET] visible ip: ${protection?.ip || "192.0.2.44"}`,
        "[ECHO] ECH-00 dormant // no active I/O",
        "[HUD] protection monitor mounted on desktop"
      ]};
    }
    if (cmd === "ward privacy --enable" || cmd === "ward privacy --rotate") {
      const protection = window.__NOAH_WARD_PROTECTION__?.privacy?.();
      return {lines: [
        "[WARD] privacy route requested",
        "[NET] terminating exposed relay path ... DONE",
        "[NET] negotiating H40N multi-hop route ... DONE",
        `[NET] visible ip rotated -> ${protection?.ip || "203.0.113.77"}`,
        "[FILTER] public-network exposure blocked",
        "[STATUS] NODE-07 protected from public network"
      ]};
    }
    if (cmd === "ward protect --close") {
      window.__NOAH_WARD_PROTECTION__?.close?.();
      return {lines: [
        "[HUD] protection monitor detached",
        "[WARD] integrity daemon remains active"
      ]};
    }
    if (cmd === "ward protect --status") {
      const protection = window.__NOAH_WARD_PROTECTION__?.state?.();
      if (!protection?.visible) return {lines: ["WARD protection monitor: DETACHED"]};
      return {lines: [[
        "WARD // LIVE PROTECTION",
        `VISIBLE IP      ${protection.ip}`,
        `ROUTE           ${protection.route}`,
        `EXPOSURE        ${protection.exposure}`,
        "SIGNATURE       H40N // VERIFIED",
        "E.C.H.O.        DORMANT // 0 I/O"
      ].join("\n")]};
    }
    if (cmd === "ward scan --deep") {
      const lines = await runWardDeepScan();
      return {lines};
    }
    if (cmd === "ward scan") {
      return {lines: ["[WARD] standard scan omitted", "use: ward scan --deep"]};
    }
    if (cmd === "ward inspect ech-00") {
      return {lines: [wardInspectText()]};
    }
    if (cmd === "ward purge ech-00") {
      return {lines: [wardPurgeText()]};
    }

    // Desktop applications are launched through GNOME's application launcher.
    // Only surface apps are registered in the visible application directory.
    if (cmd === "gtk-launch folders") {
      open(openApp, "files");
      return {lines: ["Launching folders.desktop ..."]};
    }
    if (cmd === "gtk-launch echo-chat") {
      open(openApp, "echo");
      return {lines: ["Launching echo-chat.desktop ..."]};
    }
    if (cmd === "gtk-launch thoughts") {
      open(openApp, "thoughts");
      return {lines: ["Launching thoughts.desktop ..."]};
    }
    if (cmd === "gtk-launch terminal") {
      return {lines: ["terminal.desktop is already active in this session."]};
    }

    // Unregistered/ghost modules. They do not appear in help or application listings.
    if (cmd === "gtk-launch lunar-notes") {
      open(openApp, "letters");
      return {lines: ["Launching lunar-notes.desktop from unindexed entry ..."]};
    }
    if (cmd === "gtk-launch" || cmd.startsWith("gtk-launch ")) {
      const appId = command.slice("gtk-launch".length).trim();
      if (!appId) return {lines: ["gtk-launch: missing application id"]};
      return {lines: [`gtk-launch: no such application ${appId}`]};
    }

    // Preserve normal shell echo behaviour. E.C.H.O. inspection remains a separate hidden command.
    if (cmd === "echo") return {lines: [""]};
    if (/^echo\s+/i.test(command)) return {lines: [command.replace(/^echo\s+/i, "")]};

    const personMatch = command.match(/^trace\s+--id(?:=|\s+)([a-z0-9-]+)$/i);
    if (personMatch) {
      const code = personMatch[1].toUpperCase();
      triggerPersonTrace(openApp, code);
      return {
        lines: [
          `[TRACE] target identifier accepted: ${code}`,
          "[AUTH] N.ROOT clearance accepted",
          "[ROUTE] handing acquisition to MUGUNGHWA ..."
        ]
      };
    }
    if (cmd === "trace") {
      return {lines: ["usage: trace --id <PRIVATE_CODE>", "names are not accepted by the acquisition protocol."]};
    }

    if (cmd === "chat --clear") {
      if (role() !== "echo") return {lines: ["ACCESS DENIED", "chat purge requires E.C.H.O. session."]};
      purgeArmedUntil = Date.now() + 20000;
      return {lines: ["WARNING // DESTRUCTIVE OPERATION", "This will permanently erase the shared chat history.", "To confirm within 20 seconds:", "chat --clear confirm"]};
    }
    if (cmd === "chat --clear cancel") {
      purgeArmedUntil = 0;
      return {lines: ["chat purge disarmed."]};
    }
    if (cmd === "chat --clear confirm") {
      if (role() !== "echo") return {lines: ["ACCESS DENIED // E.C.H.O. clearance required."]};
      if (Date.now() > purgeArmedUntil) {
        purgeArmedUntil = 0;
        return {lines: ["PURGE NOT ARMED", "run: chat --clear"]};
      }
      purgeArmedUntil = 0;
      try {
        await clearSharedChat();
        return {lines: ["[PURGE] neural channel history erased", "[CACHE] remote message buffer: EMPTY", "[STATUS] shared chat reset complete"]};
      } catch (error) {
        return {lines: [`[DENIED] ${String(error?.message || "CHAT_PURGE_FAILED")}`]};
      }
    }

    if (cmd === "logout") {
      setTimeout(() => {
        window.__NOAH_WARD_PROTECTION__?.reset?.();
        sessionStorage.removeItem(KEY);
        location.replace("./index.html");
      }, 350);
      return {lines: ["destroying volatile session token...", "unmounting NODE-07 identity...", "session terminated."]};
    }

    return {lines: [`command not recognized: ${command}`, "type 'help' to list available commands."]};
  };
})();
