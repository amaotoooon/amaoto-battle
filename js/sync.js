(function () {
  const cfg = window.AM_SYNC_CONFIG || { mode: "local" };
  const localCacheKey = (roomCode) => `amaoto_battle_remote_cache__${roomCode}`;

  function isEnabled() {
    return cfg.mode === "supabase" && !!cfg.supabaseUrl && !!cfg.supabaseAnonKey;
  }

  function getHeaders() {
    return {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${cfg.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    };
  }

  async function pushState(state) {
    if (!isEnabled()) return;
    const payload = {
      room_code: state.roomCode,
      state_json: state,
      updated_at: new Date(state.updatedAt || Date.now()).toISOString()
    };
    const url = `${cfg.supabaseUrl}/rest/v1/${cfg.tableName}?on_conflict=room_code`;
    try {
      await fetch(url, {
        method: "POST",
        headers: Object.assign({}, getHeaders(), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(payload)
      });
      localStorage.setItem(localCacheKey(state.roomCode), JSON.stringify(state));
    } catch (error) {
      console.warn("supabase push failed", error);
    }
  }

  async function fetchRemoteState(roomCode) {
    if (!isEnabled()) return null;
    const url = `${cfg.supabaseUrl}/rest/v1/${cfg.tableName}?select=state_json,updated_at&room_code=eq.${encodeURIComponent(roomCode)}&limit=1`;
    try {
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || !json.length || !json[0].state_json) return null;
      const state = json[0].state_json;
      if (json[0].updated_at && !state.updatedAt) state.updatedAt = Date.parse(json[0].updated_at);
      localStorage.setItem(localCacheKey(roomCode), JSON.stringify(state));
      return state;
    } catch (error) {
      console.warn("supabase fetch failed", error);
      try {
        const cached = localStorage.getItem(localCacheKey(roomCode));
        return cached ? JSON.parse(cached) : null;
      } catch (_) {
        return null;
      }
    }
  }

  function subscribe(roomCode, onRemoteState) {
    if (!isEnabled()) return function noop() {};
    let alive = true;
    const interval = cfg.pollIntervalMs || 1500;
    let lastSeen = 0;

    async function tick() {
      const remoteState = await fetchRemoteState(roomCode);
      if (!alive || !remoteState) return;
      const stamp = Number(remoteState.updatedAt || 0);
      if (stamp > lastSeen) {
        lastSeen = stamp;
        onRemoteState(remoteState);
      }
    }

    tick();
    const timer = setInterval(tick, interval);
    return function unsubscribe() {
      alive = false;
      clearInterval(timer);
    };
  }

  window.AM_SYNC = { isEnabled, pushState, fetchRemoteState, subscribe };
})();
