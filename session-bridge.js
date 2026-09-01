(() => {
  "use strict";

  const KEY = "noah.session";

  function getSession() {
    try {
      const data = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (!data || !["noah","echo"].includes(data.role)) return null;
      if (!data.idToken || Number(data.expiresAt) <= Date.now() + 5000) return null;
      return data;
    } catch {
      return null;
    }
  }

  function sessionValid() {
    return !!getSession();
  }

  window.__NOAH_SESSION_VALID__ = sessionValid;
  window.__NOAH_CLEARANCE__ = () => sessionValid();
  window.__NOAH_ROLE__ = () => getSession()?.role || "noah";
  window.__NOAH_TOKEN__ = () => getSession()?.idToken || "";

  if (!sessionValid()) {
    location.replace("./index.html");
    return;
  }

  function logout() {
    sessionStorage.removeItem(KEY);
    location.replace("./index.html");
  }

  // Ctrl+Shift+E não troca mais personagem: a identidade vem do login.
  // Ctrl+Shift+L encerra a sessão.
  window.addEventListener("keydown", event => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      event.stopImmediatePropagation();
      logout();
    }
  }, true);

  document.addEventListener("click", event => {
    const button = event.target.closest?.('button[aria-label="Bloquear sessão"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    logout();
  }, true);

  function unlockReactAccess() {
    const form = document.querySelector(".access-form");
    if (!form || form.dataset.sessionAutoUnlock === "1") return false;
    form.dataset.sessionAutoUnlock = "1";

    setTimeout(() => {
      if (!document.contains(form)) return;
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", {bubbles:true,cancelable:true}));
    }, 20);
    return true;
  }

  function decorateSession() {
    const system = document.querySelector(".linux-system-area");
    if (system && !system.dataset.sessionDecorated) {
      system.dataset.sessionDecorated = "1";
      const first = system.querySelector("span");
      if (first) {
        first.textContent = window.__NOAH_ROLE__() === "echo"
          ? "node-07 // ECHO"
          : "node-07 // NØAH";
      }
    }
  }

  const observer = new MutationObserver(() => {
    unlockReactAccess();
    decorateSession();
  });

  window.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, {childList:true, subtree:true});
    unlockReactAccess();
    decorateSession();
  }, {once:true});
})();