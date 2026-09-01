(() => {
  "use strict";

  const CONFIG = {
    vault: {
      selector: ".cipher-lock",
      title: "SECURE VOLUME",
      copy: "Encrypted volume bound to the active NODE-07 session.",
      button: "VERIFY SESSION",
      idle: "N.ROOT // SESSION-BOUND ENCRYPTION",
      noah: ["VERIFYING SIGNATURE...", "MOUNTING EPHEMERAL KEY...", "ACCESS GRANTED"],
      echo: ["IDENTITY: E.C.H.O.", "AUTH SOURCE: UNRESOLVED", "ACCESS GRANTED"]
    },
    moon: {
      selector: ".letters-lock",
      title: "ENCRYPTED NOTEBOOK",
      copy: "Private archive bound to the active session keyring.",
      button: "VERIFY SESSION",
      idle: "PRIVATE KEYRING // SESSION-BOUND",
      noah: ["VERIFYING KEYRING...", "DECRYPTING PARTITION...", "ACCESS GRANTED"],
      echo: ["IDENTITY: E.C.H.O.", "KEY OWNER: NØAH", "ACCESS GRANTED"]
    },
    haven: {
      selector: ".locator-lock",
      title: "ISLAND LOCATION IS ENCRYPTED",
      copy: "Geospatial access requires a valid active-session clearance.",
      button: "VERIFY SESSION",
      idle: "CREATOR PROTOCOL // TEMPORARY CLEARANCE",
      noah: ["VERIFYING SESSION...", "ROTATING TRACE KEY...", "ACCESS GRANTED"],
      echo: ["IDENTITY: E.C.H.O.", "CLEARANCE: UNRESOLVED", "ACCESS GRANTED"]
    }
  };

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const role = () => window.__NOAH_ROLE__?.() === "echo" ? "echo" : "noah";

  function enhance(form, key) {
    if (!form || form.dataset.narrativeSecurity === "1") return;

    form.dataset.narrativeSecurity = "1";
    form.dataset.securityKey = key;
    form.classList.add("narrative-secured");

    const cfg = CONFIG[key];
    const title = form.querySelector("h2,h3");
    const paragraph = form.querySelector("p");
    const input = form.querySelector('input[type="password"]');
    const button = form.querySelector('button[type="submit"]');
    const small = form.querySelector("small");

    if (title) title.textContent = cfg.title;
    if (paragraph) paragraph.textContent = cfg.copy;

    if (input) {
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
    }

    if (button) button.textContent = cfg.button;
    if (small) {
      small.textContent = cfg.idle;
      small.classList.remove("locator-error");
    }
  }

  function scan() {
    for (const [key, cfg] of Object.entries(CONFIG)) {
      document.querySelectorAll(cfg.selector).forEach(form => enhance(form, key));
    }
  }

  document.addEventListener("submit", async event => {
    const form = event.target?.closest?.(".narrative-secured");
    if (!form) return;

    if (form.dataset.narrativeBypass === "1") {
      delete form.dataset.narrativeBypass;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (form.dataset.narrativeBusy === "1") return;
    form.dataset.narrativeBusy = "1";

    const cfg = CONFIG[form.dataset.securityKey];
    const button = form.querySelector('button[type="submit"]');
    const small = form.querySelector("small");
    const steps = cfg[role()];

    if (button) button.disabled = true;

    try {
      for (const step of steps) {
        if (button) button.textContent = step;
        if (small) {
          small.textContent = role() === "echo"
            ? "SECURITY RESPONSE // SOURCE NOT RESOLVED"
            : "SESSION SIGNATURE // VALID";
        }
        await wait(230);
      }

      await wait(120);
      form.dataset.narrativeBypass = "1";
      form.dispatchEvent(new Event("submit", {
        bubbles: true,
        cancelable: true
      }));
    } finally {
      form.dataset.narrativeBusy = "0";
      if (button && document.contains(button)) {
        button.disabled = false;
        button.textContent = cfg.button;
      }
      if (small && document.contains(small)) small.textContent = cfg.idle;
    }
  }, true);

  const discovery = setInterval(scan, 350);

  window.addEventListener("DOMContentLoaded", scan, {once:true});
  window.addEventListener("beforeunload", () => clearInterval(discovery), {once:true});
})();