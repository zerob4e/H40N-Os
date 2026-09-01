(() => {
  "use strict";

  const DB = "https://h40n-terminal-default-rtdb.firebaseio.com";
  const nativeFetch = window.fetch.bind(window);

  const isLocal = () =>
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost";

  const token = () => window.__NOAH_TOKEN__?.() || "";

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  function fail(error, status = 500) {
    console.warn("[NØAH STORAGE]", error);
    return jsonResponse(
      { error: String(error?.message || error || "STORAGE_ERROR") },
      status
    );
  }

  function endpointOf(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input);
      const url = new URL(raw, location.href);
      return url.pathname;
    } catch {
      return "";
    }
  }

  async function parseBody(init) {
    if (!init?.body) return {};
    if (typeof init.body === "string") {
      try { return JSON.parse(init.body); }
      catch { return {}; }
    }
    return {};
  }

  async function dbFetch(path, options = {}) {
    const idToken = token();

    if (!idToken) {
      throw new Error("SESSION_TOKEN_MISSING");
    }

    const sep = path.includes("?") ? "&" : "?";
    const url =
      `${DB}/${path}.json${sep}auth=${encodeURIComponent(idToken)}`;

    const response = await nativeFetch(url, {
      cache: "no-store",
      ...options
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await response.json());
      } catch {}
      throw new Error(
        `FIREBASE_${response.status}${detail ? ` // ${detail}` : ""}`
      );
    }

    return response;
  }

  function safeId(id) {
    return encodeURIComponent(String(id || "").trim());
  }

  async function getCollection(base, itemKey, signal) {
    const [recordsRes, deletedRes] = await Promise.all([
      dbFetch(`${base}/records`, { signal }),
      dbFetch(`${base}/deleted`, { signal })
    ]);

    const records = await recordsRes.json();
    const deleted = await deletedRes.json();

    return {
      [itemKey]: Object.values(records || {}),
      deletedIds: Object.keys(deleted || {})
    };
  }

  async function saveItem(base, resultKey, item) {
    if (!item?.id) {
      return fail("INVALID_ID", 400);
    }

    const id = safeId(item.id);

    await dbFetch(`${base}/records/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item)
    });

    // Se esse ID já havia sido apagado antes, remove o tombstone.
    await dbFetch(`${base}/deleted/${id}`, {
      method: "DELETE"
    }).catch(() => {});

    return jsonResponse({ [resultKey]: item });
  }

  async function deleteItem(base, id) {
    if (!id) {
      return fail("INVALID_ID", 400);
    }

    const key = safeId(id);

    await Promise.all([
      dbFetch(`${base}/records/${key}`, {
        method: "DELETE"
      }),
      dbFetch(`${base}/deleted/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "true"
      })
    ]);

    return jsonResponse({ ok: true, id });
  }

  async function handleThoughts(init = {}) {
    const method = String(init.method || "GET").toUpperCase();

    if (method === "GET") {
      return jsonResponse(
        await getCollection(
          "thoughts",
          "thoughts",
          init.signal
        )
      );
    }

    if (method === "POST") {
      const thought = await parseBody(init);
      return saveItem("thoughts", "thought", thought);
    }

    if (method === "DELETE") {
      const body = await parseBody(init);
      return deleteItem("thoughts", body.id);
    }

    return fail("METHOD_NOT_ALLOWED", 405);
  }

  async function handleMoon(init = {}) {
    const method = String(init.method || "GET").toUpperCase();

    if (method === "GET") {
      return jsonResponse(
        await getCollection(
          "moonNotes",
          "notes",
          init.signal
        )
      );
    }

    if (method === "POST") {
      const note = await parseBody(init);
      return saveItem("moonNotes", "note", note);
    }

    if (method === "DELETE") {
      const body = await parseBody(init);
      return deleteItem("moonNotes", body.id);
    }

    return fail("METHOD_NOT_ALLOWED", 405);
  }

  window.fetch = async function(input, init = {}) {
    // Local continua usando os endpoints do PowerShell normalmente.
    if (isLocal()) {
      return nativeFetch(input, init);
    }

    const endpoint = endpointOf(input);

    try {
      if (endpoint === "/api/thoughts") {
        return await handleThoughts(init);
      }

      if (endpoint === "/api/moon-notes") {
        return await handleMoon(init);
      }

      return nativeFetch(input, init);
    } catch (error) {
      return fail(error, 500);
    }
  };

  console.info(
    "[NØAH STORAGE] Firebase bridge mounted // thoughts + moon"
  );
})();
