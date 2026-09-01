(() => {
  "use strict";

  const DB = "https://h40n-terminal-default-rtdb.firebaseio.com";
  const role = () => window.__NOAH_ROLE__?.() === "echo" ? "echo" : "noah";
  const token = () => window.__NOAH_TOKEN__?.() || "";
  const local = () => location.hostname === "127.0.0.1" || location.hostname === "localhost";

  let messages = [];
  let notice = "";
  let noticePrimed = false;
  let noticeBaseline = "";
  let noticeTimer = null;
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

  function decodeNotice(raw) {
    if (typeof raw !== "string" || !raw) {
      return { key: "", text: "", expired: false };
    }

    try {
      const parsed = JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.text === "string"
      ) {
        const expiresAt = Number(parsed.expiresAt || 0);
        const createdAt = Number(parsed.createdAt || 0);

        // Novo formato: se passou da janela, jamais exibe.
        if (expiresAt && Date.now() > expiresAt) {
          return { key: raw, text: "", expired: true };
        }

        // Compatibilidade com a versão anterior que tinha apenas createdAt.
        // Qualquer aviso com mais de 15 s é considerado antigo.
        if (!expiresAt && createdAt && Date.now() - createdAt > 15000) {
          return { key: raw, text: "", expired: true };
        }

        return {
          key: raw,
          text: parsed.text.trim(),
          expired: false
        };
      }
    } catch {}

    // Notices legados em string simples não devem reaparecer.
    return {
      key: raw,
      text: "",
      expired: true
    };
  }

  function hideNotice() {
    notice = "";

    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }

    document.querySelector(".session-live-notice")?.remove();
  }

  function showNotice(text) {
    notice = String(text || "").trim();

    if (!notice) {
      hideNotice();
      return;
    }

    renderNotice();

    if (noticeTimer) clearTimeout(noticeTimer);

    noticeTimer = setTimeout(() => {
      notice = "";
      document.querySelector(".session-live-notice")?.remove();
      noticeTimer = null;
    }, 9000);
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

      const incomingNotice = decodeNotice(data?.notice);

      // O notice encontrado no PRIMEIRO snapshot vira apenas baseline.
      // Assim uma mensagem antiga do Firebase não reaparece ao abrir/recarregar.
      if (!noticePrimed) {
        noticeBaseline = incomingNotice.key;
        noticePrimed = true;

        // Primeiro snapshot é sempre silencioso.
        hideNotice();

        if (incomingNotice.expired && role() === "echo" && incomingNotice.key) {
          void deleteRemoteNotice(incomingNotice.key);
        }
      } else if (incomingNotice.key !== noticeBaseline) {
        noticeBaseline = incomingNotice.key;

        if (incomingNotice.expired) {
          hideNotice();

          if (role() === "echo" && incomingNotice.key) {
            void deleteRemoteNotice(incomingNotice.key);
          }
        } else if (incomingNotice.text) {
          showNotice(incomingNotice.text);
        } else {
          hideNotice();
        }
      }

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

  async function deleteRemoteNotice(expectedWire = "") {
    try {
      if (!token()) return;

      let response;

      if (local()) {
        // O servidor local pode não ter endpoint específico de DELETE.
        // Nesse caso, usamos o Firebase diretamente.
        response = await fetchTimed(
          `${DB}/chat/notice.json?auth=${encodeURIComponent(token())}`,
          { method:"DELETE" },
          8000
        );
      } else {
        response = await fetchTimed(
          `${DB}/chat/notice.json?auth=${encodeURIComponent(token())}`,
          { method:"DELETE" },
          8000
        );
      }

      if (!response.ok) {
        throw new Error(`NOTICE_DELETE_HTTP_${response.status}`);
      }

      if (!expectedWire || noticeBaseline === expectedWire) {
        noticeBaseline = "";
      }
    } catch (error) {
      console.warn("[NØAH OS] notice cleanup failed", error);
    }
  }

  async function transmitNotice(text) {
    if (role() !== "echo") throw new Error("ECHO_CLEARANCE_REQUIRED");

    setRuntime("tx", "NOTICE INJECT");

    const cleanText = String(text || "").trim();
    if (!cleanText) throw new Error("EMPTY_NOTICE");

    const createdAt = Date.now();

    // Continua sendo uma string para manter compatibilidade com as rules atuais.
    const wireNotice = JSON.stringify({
      text: cleanText,
      createdAt,
      expiresAt: createdAt + 10000
    });

    let response;

    if (local()) {
      response = await fetchTimed("/api/chat-notice", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          idToken:token(),
          role:"echo",
          text:wireNotice
        })
      }, 10000);
    } else {
      response = await fetchTimed(
        `${DB}/chat/notice.json?auth=${encodeURIComponent(token())}`,
        {
          method:"PUT",
          headers:{"content-type":"application/json"},
          body:JSON.stringify(wireNotice)
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

    noticePrimed = true;
    noticeBaseline = wireNotice;
    showNotice(cleanText);
    setRuntime("tx", "NOTICE DELIVERED");

    // O aviso é um EVENTO, não um registro permanente.
    // Após 10 s, remove o próprio valor do Firebase.
    setTimeout(() => {
      void deleteRemoteNotice(wireNotice);
    }, 10000);
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
    // Defesa adicional: o bundle legado ainda sabe criar .echo-notice sozinho.
    // Só notices autenticados desta camada (.session-live-notice) ficam visíveis.
    const legacyNoticeStyle = document.createElement("style");
    legacyNoticeStyle.textContent =
      ".echo-notice:not(.session-live-notice){display:none!important}";
    document.head.appendChild(legacyNoticeStyle);

    discoverChannels();

    discoverTimer = setInterval(discoverChannels, 450);

    snapshot();
    pollTimer = setInterval(snapshot, 1500);
  }, {once:true});

  window.addEventListener("beforeunload", () => {
    if (discoverTimer) clearInterval(discoverTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (noticeTimer) clearTimeout(noticeTimer);
  }, {once:true});
})();
