const GITHUB_AIRSPACE_URL = "https://raw.githubusercontent.com/sqdwz/hainan-airspace/main/data/latest.json";
const DATA_KEY = "airspace:latest";

function jsonResponse(body, { storage, syncedAt } = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "X-Airspace-Storage": storage || "cloudflare-kv"
  });
  if (syncedAt) headers.set("X-Airspace-Synced-At", syncedAt);
  return new Response(body, { headers });
}

async function fetchLatestFromGitHub() {
  const response = await fetch(GITHUB_AIRSPACE_URL, {
    headers: { "Cache-Control": "no-cache" },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

  const body = await response.text();
  JSON.parse(body);
  return body;
}

async function syncAirspaceData(env) {
  const body = await fetchLatestFromGitHub();
  const current = await env.AIRSPACE_DATA.getWithMetadata(DATA_KEY);
  const syncedAt = new Date().toISOString();

  if (current.value !== body) {
    await env.AIRSPACE_DATA.put(DATA_KEY, body, {
      metadata: { source: "sqdwz/hainan-airspace", syncedAt }
    });
    return { body, syncedAt, updated: true };
  }

  return { body, syncedAt: current.metadata?.syncedAt || syncedAt, updated: false };
}

async function serveAirspaceData(request, env) {
  const stored = await env.AIRSPACE_DATA.getWithMetadata(DATA_KEY);
  if (stored.value) {
    return jsonResponse(stored.value, {
      storage: "cloudflare-kv",
      syncedAt: stored.metadata?.syncedAt
    });
  }

  try {
    const synced = await syncAirspaceData(env);
    return jsonResponse(synced.body, { storage: "cloudflare-kv", syncedAt: synced.syncedAt });
  } catch (error) {
    console.error("Cloudflare KV is empty and GitHub sync failed", error);
    return env.ASSETS.fetch(request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/data/airspace.json") {
      return serveAirspaceData(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    try {
      const result = await syncAirspaceData(env);
      console.log("Airspace sync completed", { cron: controller.cron, updated: result.updated, syncedAt: result.syncedAt });
    } catch (error) {
      controller.noRetry();
      console.error("Airspace sync failed", { cron: controller.cron, error: String(error) });
    }
  }
};
