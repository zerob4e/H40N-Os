(() => {
  "use strict";

  const REPO = "zerob4e/H40N-Os";
  const BRANCH = "main";
  const FOLDER = "nekutai";
  const CACHE_KEY = "noah.vault.dynamic.index.v1";
  const CACHE_MS = 5 * 60 * 1000;

  let files = [];
  let selected = null;
  let loading = false;
  let lastMount = null;

  const KNOWN_META = {
    "arq-noah_operador.html": "N.ROOT / INTEGRIDADE H40N–ECH0",
    "arq-kitsune_relatorio.html": "KITSUNE / RELATÓRIO RESTRITO",
    "arq-kitsune_anexos.html": "KITSUNE / MÓDULO CORROMPIDO",
    "arq-amanecer_relatorio.html": "AMANECER / RELATÓRIO RESTRITO",
    "arq-amanecer_experimento.html": "AMANECER / LOGS L03–L07"
  };

  function genericMeta(name) {
  const clean = name
    .replace(/\.html$/i, "")
    .replace(/^arq[-_]/i, "")
    .replace(/[-_]+/g, " / ")
    .toUpperCase();

  return clean || "NKT / DOCUMENTO CRIPTOGRAFADO";
  }
  
  function metaFor(name) {
    return KNOWN_META[name] || genericMeta(name);
  }
  
  function displayName(name) {
    return name
      .replace(/\.html$/i, "")
      .replace(/^arq[-_]/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
  }

  function relativeUrl(name) {
    return `./${FOLDER}/${encodeURIComponent(name)}`;
  }

  function fileIcon() {
    return `
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
           stroke="currentColor" stroke-width="1.7"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v7"/>
        <path d="M14 2v6h6"/>
        <path d="M20 8v10a2 2 0 0 1-2 2h-7"/>
        <circle cx="5" cy="18" r="3"/>
        <path d="m7.2 15.8 2-2"/>
      </svg>`;
  }

  function chevronIcon() {
    return `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
           stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="m9 18 6-6-6-6"/>
      </svg>`;
  }

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !Array.isArray(cached.files)) return null;
      if (Date.now() - Number(cached.time || 0) > CACHE_MS) return null;
      return cached.files;
    } catch {
      return null;
    }
  }

  function writeCache(list) {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ time: Date.now(), files: list })
      );
    } catch {}
  }

  async function fetchFiles() {
    const cached = readCache();
    if (cached) return cached;

    const url =
      `https://api.github.com/repos/${REPO}/contents/${FOLDER}` +
      `?ref=${encodeURIComponent(BRANCH)}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`GITHUB_${response.status}`);
    }

    const data = await response.json();

    const list = Array.isArray(data)
      ? data
          .filter(item =>
            item &&
            item.type === "file" &&
            /\.html$/i.test(item.name)
          )
          .map(item => ({
            name: item.name,
            path: item.path,
            sha: item.sha
          }))
          .sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR", {
              numeric: true,
              sensitivity: "base"
            })
          )
      : [];

    writeCache(list);
    return list;
  }

  function updateCount(vaultMain, count, state = "") {
    const pathbar = vaultMain.querySelector(".pathbar");
    if (!pathbar) return;

    const spans = pathbar.querySelectorAll("span");
    const target = spans[spans.length - 1];

    if (target) {
      target.textContent = state || `${count} FILES // READ ONLY`;
    }
  }

  function renderReader(reader, file) {
    if (!reader || !file) return;

    const header = reader.querySelector("header");
    const nameEl = header?.querySelector(":scope > span");
    const actions = header?.querySelector(":scope > div");
    const iframe = reader.querySelector("iframe");

    if (nameEl) nameEl.textContent = displayName(file.name);

    if (actions) {
      actions.innerHTML = "";

      const open = document.createElement("a");
      open.href = relativeUrl(file.name);
      open.target = "_blank";
      open.rel = "noreferrer";
      open.textContent = "OPEN RAW ↗";

      const meta = document.createElement("b");
      meta.textContent = metaFor(file.name);

      actions.append(open, meta);
    }

    if (iframe) {
      iframe.src = relativeUrl(file.name);
      iframe.title = `Documento Nekutai: ${file.name}`;
    }
  }

  function selectFile(browser, file) {
    selected = file.name;

    browser.querySelectorAll(".file-list button").forEach(button => {
      button.classList.toggle(
        "selected",
        button.dataset.dynamicFile === file.name
      );
    });

    renderReader(
      browser.querySelector(".document-reader"),
      file
    );
  }

  function renderList(vaultMain, list) {
    const browser = vaultMain.querySelector(".file-browser");
    const listEl = browser?.querySelector(".file-list");
    const reader = browser?.querySelector(".document-reader");

    if (!browser || !listEl || !reader) return false;

    browser.dataset.dynamicVault = "1";
    listEl.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "padding:18px;color:#777;font:10px ui-monospace,Consolas,monospace;" +
        "letter-spacing:.08em;";
      empty.textContent = "NO HTML REPORTS FOUND";
      listEl.appendChild(empty);

      reader.innerHTML = `
        <div style="
          height:100%;
          display:grid;
          place-items:center;
          color:#777;
          font:10px ui-monospace,Consolas,monospace;
          letter-spacing:.08em;
        ">NKT INDEX EMPTY</div>`;

      updateCount(vaultMain, 0);
      return true;
    }

    for (const file of list) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.dynamicFile = file.name;

      button.innerHTML = `
        ${fileIcon()}
        <span>
          <b>${escapeHtml(displayName(file.name))}</b>
          <small>${escapeHtml(metaFor(file.name))}</small>
        </span>
        ${chevronIcon()}
      `;

      button.addEventListener("click", () => {
        selectFile(browser, file);
      });

      listEl.appendChild(button);
    }

    updateCount(vaultMain, list.length);

    const wanted =
      list.find(file => file.name === selected) ||
      list[0];

    selectFile(browser, wanted);
    return true;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  async function mount(vaultMain) {
    if (!vaultMain) return;

    const browser = vaultMain.querySelector(".file-browser");

    // O Vault ainda está na tela narrativa de verificação.
    if (!browser) return;

    // React pode reconstruir o navegador. Se for o mesmo DOM e
    // nossa camada ainda estiver presente, não fazemos nada.
    if (
      lastMount === browser &&
      browser.dataset.dynamicVault === "1"
    ) {
      return;
    }

    lastMount = browser;

    if (files.length) {
      renderList(vaultMain, files);
      return;
    }

    if (loading) return;
    loading = true;

    updateCount(vaultMain, 0, "SYNCING NKT INDEX // GITHUB");

    try {
      files = await fetchFiles();
      renderList(vaultMain, files);
    } catch (error) {
      console.warn("[NKT VAULT] dynamic index failed", error);
      updateCount(
        vaultMain,
        0,
        "INDEX DEGRADED // STATIC FALLBACK"
      );

      // Não destrói o índice embutido se GitHub estiver indisponível.
      browser.dataset.dynamicVault = "fallback";
    } finally {
      loading = false;
    }
  }

  function scan() {
    document.querySelectorAll(".vault-main").forEach(mount);
  }

  window.addEventListener("DOMContentLoaded", () => {
    scan();

    // Timer leve: necessário porque o app Vault só entra no DOM
    // quando a janela é aberta/descriptografada.
    setInterval(scan, 450);
  }, { once: true });

  // Útil depois de adicionar/remover um arquivo no GitHub:
  // abra o Console e rode window.NOAH_VAULT_REFRESH()
  window.NOAH_VAULT_REFRESH = async () => {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch {}

    files = [];
    selected = null;
    lastMount = null;

    await Promise.all(
      [...document.querySelectorAll(".vault-main")].map(mount)
    );
  };
})();
