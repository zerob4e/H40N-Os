(() => {
  "use strict";

  const DB = "https://h40n-terminal-default-rtdb.firebaseio.com";
  const role = () => window.__NOAH_ROLE__?.() === "echo" ? "echo" : "noah";
  const token = () => window.__NOAH_TOKEN__?.() || "";
  const local = () => location.hostname === "127.0.0.1" || location.hostname === "localhost";

  let messages = [];
  let notice = "";
  let pollTimer = null;
  let discoverTimer = null;
  let snapshotBusy = false;

  const runtime = {
    link: "INITIALIZING",
    sync: "--",
    tx: "IDLE",
    identity: ""
  };

  const esc = value => String(value ?? "").replace(/[&<>"]/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  }[ch]));

  function setReactInput(input, value) {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", {bubbles:true}));
    input.dispatchEvent(new Event("change", {bubbles:true}));
  }

  async function fetchTimed(url, options = {}, timeout = 6500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {...options, signal:controller.signal});
    } finally {
      clearTimeout(timer);
    }
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .map(([id,v]) => ({
        id,
        from: v?.from === "echo" ? "echo" : "noah",
        body: String(v?.body || ""),
        createdAt: Number(v?.createdAt) || 0
      }))
      .filter(v => v.body)
      .sort((a,b) => a.createdAt - b.createdAt)
      .slice(-250);
  }

  function messageKey() {
    return messages.map(m => `${m.id}:${m.createdAt}:${m.from}:${m.body}`).join("|");
  }

  function sideLines() {
    const who = role() === "echo" ? "E.C.H.O." : "NØAH";
    const clearance = role() === "echo" ? "UNRESOLVED" : "N.ROOT";

    return [
      `$ echo.channel --watch`,
      `> route: neural://internal`,
      `> host: N.ROOT`,
      `> identity: ${who}`,
      `> clearance: ${clearance}`,
      ``,
      `[CHANNEL] binding shared relay`,
      `[AUTH] session token mounted`,
      `[CACHE] local buffer active`,
      `[SYNC] listening /chat/messages`,
      `[SYNC] listening /chat/notice`,
      ``,
      `> link: ${runtime.link}`,
      `> last_sync: ${runtime.sync}`,
      `> tx: ${runtime.tx}`,
      ``,
      `[PROCESS] echo.overlay.attach()`,
      `[PROCESS] neural.route.lock()`,
      `[PROCESS] relay.integrity.verify()`,
      `[PROCESS] message.buffer.watch()`
    ];
  }

  function updateSideLog() {
    runtime.identity = role();

    document.querySelectorAll(".echo-side-log").forEach(side => {
      // Reuse the terminal that already belongs to the original UI.
      // This avoids the duplicated PROCESS OUTPUT block from the previous version.
      const pre = side.querySelector(":scope > pre");
      const injected = side.querySelector(":scope > .session-runtime-log");
      if (injected) injected.remove();

      if (pre) {
        pre.classList.add("session-runtime-log");
        const next = sideLines().join("\n");
        if (pre.textContent !== next) {
          pre.textContent = next;
          pre.scrollTop = pre.scrollHeight;
        }
      }
    });
  }

  function setRuntime(key, value) {
    runtime[key] = value;
    updateSideLog();
  }

  async function snapshot() {
    if (snapshotBusy) return;
    snapshotBusy = true;

    try {
      let data;

      if (local()) {
        const response = await fetchTimed("/api/chat-snapshot", {cache:"no-store"}, 6500);
        data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
      } else {
        // Firebase rules grant read access on these child nodes, not on /chat itself.
        const [messagesResponse, noticeResponse] = await Promise.all([
          fetchTimed(`${DB}/chat/messages.json`, {cache:"no-store"}, 6500),
          fetchTimed(`${DB}/chat/notice.json`, {cache:"no-store"}, 6500)
        ]);

        if (!messagesResponse.ok) throw new Error(`MESSAGES_HTTP_${messagesResponse.status}`);
        if (!noticeResponse.ok) throw new Error(`NOTICE_HTTP_${noticeResponse.status}`);

        data = {
          messages: await messagesResponse.json(),
          notice: await noticeResponse.json()
        };
      }

      messages = normalize(data?.messages);
      notice = typeof data?.notice === "string" ? data.notice : "";
      renderData();

      setRuntime("link", "CONNECTED");
      setRuntime("sync", new Date().toLocaleTimeString("pt-BR", {
        hour:"2-digit", minute:"2-digit", second:"2-digit"
      }));
    } catch (error) {
      console.warn("[NØAH OS] chat snapshot failed", error);
      setRuntime("link", "DEGRADED");
      setRuntime("sync", String(error?.message || "READ FAILED").slice(0, 28));
    } finally {
      snapshotBusy = false;
    }
  }

  async function transmit(body) {
    const createdAt = Date.now();
    const payload = {
      idToken: token(),
      role: role(),
      body,
      createdAt
    };

    setRuntime("tx", "TRANSMITTING");

    let response;

    if (local()) {
      response = await fetchTimed("/api/chat-send", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload)
      }, 10000);
    } else {
      response = await fetchTimed(
        `${DB}/chat/messages.json?auth=${encodeURIComponent(token())}`,
        {
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({
            from:role(),
            body,
            createdAt
          })
        },
        10000
      );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data.error || `HTTP_${response.status}`;
      setRuntime("tx", `DENIED // ${reason}`);
      throw new Error(reason);
    }

    // Optimistic local rendering so the sender sees the message immediately.
    messages = [
      ...messages,
      {
        id: data?.name || `local-${createdAt}`,
        from: role(),
        body,
        createdAt
      }
    ].sort((a,b) => a.createdAt - b.createdAt).slice(-250);

    renderData();
    setRuntime("tx", "DELIVERED");

    return data;
  }

  async function transmitNotice(text) {
    if (role() !== "echo") throw new Error("ECHO_CLEARANCE_REQUIRED");

    setRuntime("tx", "NOTICE INJECT");

    let response;

    if (local()) {
      response = await fetchTimed("/api/chat-notice", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          idToken:token(),
          role:"echo",
          text
        })
      }, 10000);
    } else {
      response = await fetchTimed(
        `${DB}/chat/notice.json?auth=${encodeURIComponent(token())}`,
        {
          method:"PUT",
          headers:{"content-type":"application/json"},
          body:JSON.stringify(text)
        },
        10000
      );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data.error || `HTTP_${response.status}`;
      setRuntime("tx", `DENIED // ${reason}`);
      throw new Error(reason);
    }

    notice = text;
    renderNotice();
    setRuntime("tx", "NOTICE DELIVERED");
  }

  function mountChannel(channel) {
    if (!channel || channel.dataset.sessionChatMounted === "1") return;
    channel.dataset.sessionChatMounted = "1";

    const original = channel.querySelector(":scope > .echo-messages");
    const composer = channel.querySelector(":scope > .echo-composer");
    const header = channel.querySelector(":scope > header");
    const layout = channel.closest(".echo-layout");

    if (original) original.style.display = "none";

    let live = channel.querySelector(":scope > .session-live-messages");
    if (!live && original) {
      live = document.createElement("div");
      live.className = "echo-messages session-live-messages";
      original.insertAdjacentElement("afterend", live);
    }

    if (composer) {
      composer.dataset.sessionChat = "1";
      const input = composer.querySelector("input");
      const button = composer.querySelector('button[type="submit"]');

      if (input) {
        input.placeholder = role() === "echo"
          ? "E.C.H.O. direct output // /notify mensagem"
          : "send as NØAH through neural channel...";
      }
      if (button) button.textContent = role() === "echo" ? "INJECT" : "TRANSMIT";
    }

    if (layout) layout.classList.toggle("echo-operated", role() === "echo");

    // The central chat should contain messages only.
    if (header) header.style.display = "none";

    renderMessages(live);
    updateSideLog();
  }

  function discoverChannels() {
    document.querySelectorAll(".echo-channel").forEach(mountChannel);
    updateSideLog();
  }

  function renderMessages(box) {
    if (!box) return;

    const key = messageKey();
    if (box.dataset.renderKey === key) return;
    box.dataset.renderKey = key;

    // Empty means visually empty. Runtime information belongs in PROCESS OUTPUT.
    if (!messages.length) {
      box.innerHTML = "";
      return;
    }

    box.innerHTML = messages.map(m => `
      <div class="echo-line ${m.from}">
        <span>${m.from === "echo" ? "E.C.H.O." : "NØAH"}</span>
        <p>${esc(m.body)}</p>
        <time>${new Date(m.createdAt).toLocaleTimeString("pt-BR",{
          hour:"2-digit", minute:"2-digit"
        })}</time>
      </div>`).join("");

    box.scrollTop = box.scrollHeight;
  }

  function renderNotice() {
    const existing = document.querySelector(".session-live-notice");

    if (!notice) {
      existing?.remove();
      return;
    }

    if (existing?.dataset.notice === notice) return;
    existing?.remove();

    const desktop = document.querySelector(".desktop");
    if (!desktop) return;

    const el = document.createElement("div");
    el.className = "echo-notice session-live-notice";
    el.dataset.notice = notice;
    el.innerHTML = `<span>E.C.H.O. // AUTHENTICATED NOTICE</span><p>${esc(notice)}</p>`;
    desktop.appendChild(el);
  }

  function renderData() {
    document.querySelectorAll(".session-live-messages").forEach(renderMessages);
    renderNotice();
  }

  document.addEventListener("submit", async event => {
    const form = event.target?.closest?.(".echo-composer");
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const input = form.querySelector("input");
    const button = form.querySelector('button[type="submit"]');
    const text = String(input?.value || "").trim();
    if (!text) return;

    if (button) button.disabled = true;

    try {
      const command = role() === "echo"
        ? text.match(/^\/(?:notify|notice)\s+(.+)/i)?.[1]?.trim()
        : null;

      if (command) {
        await transmitNotice(command);
      } else {
        await transmit(text);
      }

      setReactInput(input, "");
      // Reconcile the optimistic item with the shared database.
      setTimeout(snapshot, 150);
    } catch (error) {
      console.warn("[NØAH OS] transmission failed", error);
      if (button) {
        const normal = role() === "echo" ? "INJECT" : "TRANSMIT";
        button.textContent = "DENIED";
        setTimeout(() => {
          if (document.contains(button)) button.textContent = normal;
        }, 900);
      }
    } finally {
      if (button && document.contains(button)) button.disabled = false;
      input?.focus();
    }
  }, true);


  window.addEventListener("noah:chat-cleared", () => {
    messages = [];
    renderData();
    setRuntime("tx", "CHAT PURGED");
    setTimeout(snapshot, 120);
  });

  window.addEventListener("DOMContentLoaded", () => {
    discoverChannels();

    discoverTimer = setInterval(discoverChannels, 450);

    snapshot();
    pollTimer = setInterval(snapshot, 1500);
  }, {once:true});

  window.addEventListener("beforeunload", () => {
    if (discoverTimer) clearInterval(discoverTimer);
    if (pollTimer) clearInterval(pollTimer);
  }, {once:true});
})();