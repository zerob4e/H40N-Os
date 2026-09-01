(() => {
  "use strict";

  const DB = "https://h40n-terminal-default-rtdb.firebaseio.com";
  const KEY = "noah.session";
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

  function helpText() {
    return [
      "AVAILABLE COMMANDS",
      "",
      "help                     list available commands",
      "ls                       list mounted sectors",
      "whoami                   inspect active identity",
      "status                   inspect NODE-07 status",
      "echo --status            inspect E.C.H.O. process",
      "echo --channel           open shared neural channel",
      "vault                    open NKT Vault",
      "vault --status           inspect encrypted volume",
      "moon                     open Lunar Notes",
      "thoughts                 open cognitive archive",
      "mugunghwa                open person trace",
      "haven                    open HAVEN TRACE",
      "trace                    open HAVEN and execute trace",
      "chat --status            inspect shared chat",
      "chat --clear             arm chat history purge [E.C.H.O.]",
      "chat --clear confirm     permanently clear shared chat",
      "clear                    clear this terminal only",
      "logout                   terminate current session"
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
        "authentication origin unavailable."
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
      "MEMORY            33.07%",
      "NEURAL CHANNEL    LISTENING",
      "HAVEN MESH        DORMANT",
      `CONTROL           ${role() === "echo" ? "DISPUTED" : "N.ROOT"}`
    ].join("\n");
  }

  function echoStatusText() {
    const lines = [
      "PROCESS              E.C.H.O.",
      "STATE                ACTIVE",
      "HOST                 N.ROOT",
      "NEURAL CHANNEL       ACTIVE",
      "MEMORY ACCESS        ACTIVE",
      "PROCESS TERMINATION  DENIED"
    ];

    if (role() === "echo") {
      lines.splice(3, 0,
        "ORIGIN               UNKNOWN",
        "OWNER                NØAH",
        "AUTHORIZATION        SOURCE NOT FOUND"
      );
    } else {
      lines.splice(3, 0,
        "ORIGIN               UNKNOWN",
        "OWNER                NØAH",
        "AUTHORIZATION        OBSERVED"
      );
    }

    return lines.join("\n");
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
        body: JSON.stringify({
          idToken,
          role: role()
        })
      });
    } else {
      response = await fetch(
        `${DB}/chat/messages.json?auth=${encodeURIComponent(idToken)}`,
        {method: "DELETE"}
      );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP_${response.status}`);
    }

    window.dispatchEvent(new CustomEvent("noah:chat-cleared"));
    return true;
  }

  function triggerTrace(openApp) {
    open(openApp, "locator");

    const started = Date.now();
    const timer = setInterval(() => {
      const input = document.querySelector("#hso-input");
      const form = document.querySelector("#hso-form");

      if (input && form) {
        clearInterval(timer);
        input.value = "trace";
        form.dispatchEvent(new Event("submit", {
          bubbles: true,
          cancelable: true
        }));
        return;
      }

      if (Date.now() - started > 4000) {
        clearInterval(timer);
      }
    }, 80);
  }

  window.__NOAH_TERMINAL_EXEC__ = async function(raw, openApp) {
    const command = String(raw || "").trim();
    const cmd = command.toLowerCase();

    if (!cmd) return {lines: []};

    if (cmd === "help") return {lines: [helpText()]};

    if (cmd === "ls") {
      return {
        lines: [
          "nkt/    echo/    haven/    lunar/    mugunghwa/    thoughts/    archive/"
        ]
      };
    }

    if (cmd === "whoami") return {lines: [whoamiText()]};
    if (cmd === "status") return {lines: [statusText()]};
    if (cmd === "echo --status") return {lines: [echoStatusText()]};
    if (cmd === "vault --status" || cmd === "nekutai --status") {
      return {lines: [vaultStatusText()]};
    }
    if (cmd === "chat --status") return {lines: [chatStatusText()]};

    if (cmd === "echo" || cmd === "echo --channel") {
      open(openApp, "echo");
      return {lines: ["opening neural://internal ..."]};
    }

    if (cmd === "vault" || cmd === "nekutai") {
      open(openApp, "files");
      return {lines: ["mounting /dev/n07-crypt/nkt_internal ..."]};
    }

    if (cmd === "moon" || cmd === "lunar") {
      open(openApp, "letters");
      return {lines: ["opening encrypted lunar partition ..."]};
    }

    if (cmd === "thoughts") {
      open(openApp, "thoughts");
      return {lines: ["opening H40N cognitive archive ..."]};
    }

    if (cmd === "mugunghwa" || cmd === "korea") {
      open(openApp, "search");
      return {lines: ["opening MUGUNGHWA person trace ..."]};
    }

    if (cmd === "haven" || cmd === "island" || cmd === "locate") {
      open(openApp, "locator");
      return {lines: ["opening HAVEN secure mesh ..."]};
    }

    if (
      cmd === "trace" ||
      cmd === "trace --current" ||
      cmd === "./trace --request=current --auth=creator" ||
      cmd === "haven.trace"
    ) {
      triggerTrace(openApp);
      return {
        lines: [
          "routing command to /haven/trace.sh ...",
          "creator handshake requested."
        ]
      };
    }

    if (cmd === "chat --clear") {
      if (role() !== "echo") {
        return {
          lines: [
            "ACCESS DENIED",
            "chat purge requires E.C.H.O. session."
          ]
        };
      }

      purgeArmedUntil = Date.now() + 20000;
      return {
        lines: [
          "WARNING // DESTRUCTIVE OPERATION",
          "This will permanently erase the shared chat history.",
          "To confirm within 20 seconds:",
          "chat --clear confirm"
        ]
      };
    }

    if (cmd === "chat --clear cancel") {
      purgeArmedUntil = 0;
      return {lines: ["chat purge disarmed."]};
    }

    if (cmd === "chat --clear confirm") {
      if (role() !== "echo") {
        return {lines: ["ACCESS DENIED // E.C.H.O. clearance required."]};
      }

      if (Date.now() > purgeArmedUntil) {
        purgeArmedUntil = 0;
        return {
          lines: [
            "PURGE NOT ARMED",
            "run: chat --clear"
          ]
        };
      }

      purgeArmedUntil = 0;

      try {
        await clearSharedChat();
        return {
          lines: [
            "[PURGE] neural channel history erased",
            "[CACHE] remote message buffer: EMPTY",
            "[STATUS] shared chat reset complete"
          ]
        };
      } catch (error) {
        return {
          lines: [
            `[DENIED] ${String(error?.message || "CHAT_PURGE_FAILED")}`
          ]
        };
      }
    }

    if (cmd === "logout") {
      setTimeout(() => {
        sessionStorage.removeItem(KEY);
        location.replace("./index.html");
      }, 350);

      return {
        lines: [
          "destroying volatile session token...",
          "unmounting NODE-07 identity...",
          "session terminated."
        ]
      };
    }

    return {
      lines: [
        `command not recognized: ${command}`,
        "type 'help' to list available commands."
      ]
    };
  };
})();