const DATA_ENDPOINTS = {
  airspace: "/data/airspace.json",
  airspaceFallback: "https://raw.githubusercontent.com/sqdwz/hainan-airspace/main/data/latest.json"
};
const statusMeta = { active: ["正在生效", "pill--active"], upcoming: ["即将生效", "pill--upcoming"], ended: ["已结束", "pill--ended"], new: ["本轮新增", "pill--upcoming"] };
let airspaceData;

const $ = (selector, scope = document) => scope.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function route() {
  const id = location.hash.slice(1) || "home";
  const page = document.querySelector(`[data-page="${id}"]`) ? id : "home";
  document.querySelectorAll("[data-page]").forEach(node => node.classList.toggle("is-active", node.dataset.page === page));
  document.querySelectorAll("[data-route]").forEach(node => node.toggleAttribute("aria-current", node.dataset.route === page));
  window.scrollTo({ top: 0, behavior: "instant" });
}

function preferredSources(sources = []) {
  return [...sources].sort((a, b) => Number(b.type === "official") - Number(a.type === "official") || b.authority - a.authority).slice(0, 4);
}

function normalizeNotice(notice) {
  const linkedSources = notice.sources?.length
    ? notice.sources
    : (notice.links || []).map(link => ({
      name: link.name,
      url: link.url,
      type: link.type === "official" ? "official" : "media",
      authority: link.type === "official" ? 5 : Math.max(1, 6 - (link.rank || 5))
    }));
  const fallbackSource = notice.primary_url || notice.url
    ? [{ name: notice.origin_publisher || notice.publisher || "原始来源", url: notice.primary_url || notice.url, type: notice.source_type === "official" ? "official" : "media", authority: notice.source_type === "official" ? 5 : 3 }]
    : [];
  return {
    ...notice,
    region: notice.region || notice.area || "未说明区域",
    published_at: notice.published_at || notice.publish_date || "未说明",
    start_at: notice.start_at || notice.start_time,
    end_at: notice.end_at || notice.end_time,
    sources: linkedSources.length ? linkedSources : fallbackSource
  };
}

function normalizeAirspaceData(data) {
  return {
    ...data,
    notices: (data.notices || []).map(normalizeNotice),
    ended_recent: (data.ended_recent || []).map(normalizeNotice),
    sources: (data.sources || []).map(source => typeof source === "string" ? source : source.name).filter(Boolean)
  };
}

function noticeCard(notice) {
  const [label, className] = statusMeta[notice.status] || statusMeta.new;
  const sources = preferredSources(notice.sources);
  const primarySource = sources[0];
  const official = sources.some(source => source.type === "official");
  const sourceLinks = sources.length
    ? sources.map(source => `<a class="notice-link ${source.type === "official" ? "notice-link--official" : ""}" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.name)} <span aria-hidden="true">↗</span></a>`).join("")
    : "暂未提供";
  const sourceLabel = official ? "官方发布" : "权威转载";
  return `<article class="notice-card notice-card--${escapeHtml(notice.status)}"><div class="notice-card__heading"><h3>${escapeHtml(notice.title)}</h3><div class="notice-flags"><span class="flag flag--source ${official ? "flag--official" : ""}">${sourceLabel}</span><span class="flag flag--status ${className}">${label}</span></div></div><dl class="notice-table"><div><dt>发布机构</dt><dd>${escapeHtml(primarySource?.name || "暂未提供")}</dd></div><div><dt>发布日期</dt><dd>${escapeHtml(notice.published_at)}</dd></div><div><dt>管制区域</dt><dd>${escapeHtml(notice.region)}</dd></div><div><dt>管制时段</dt><dd>${escapeHtml(notice.time_text)}</dd></div><div><dt>通告链接</dt><dd class="notice-links">${sourceLinks}</dd></div><div><dt>摘要</dt><dd>${escapeHtml(notice.summary)}</dd></div></dl><div class="card-actions"><button class="button button--primary" type="button" data-detail="${escapeHtml(notice.id)}">查看详情</button></div></article>`;
}

function renderGroup(selector, notices, emptyText) {
  $(selector).innerHTML = notices.length ? notices.map(noticeCard).join("") : `<div class="empty-card">${emptyText}</div>`;
}

function renderAirspace(data) {
  const notices = data.notices || [];
  const ended = data.ended_recent || [];
  const summary = data.summary || {};
  $("#airspace-updated").textContent = `最近更新 · ${data.generated_at || "暂无时间"}`;
  $("[data-summary-message]").textContent = data.message || "暂未生成巡检结论。";
  $("#new-date").textContent = data.generated_at ? `巡检时间 · ${data.generated_at.slice(0, 10)}` : "";
  $("#airspace-stats").innerHTML = [["本次巡检新增", summary.new || 0], ["当前生效", summary.active || 0], ["即将生效", summary.upcoming || 0]].map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}<em>条</em></b></div>`).join("");
  const isNew = notice => notice.is_new_scan || notice.status === "new";
  renderGroup("#new-list", notices.filter(isNew), "本轮巡检未发现新增公告；后续新增内容会优先显示在这里。");
  renderGroup("#active-list", notices.filter(item => item.status === "active"), "当前没有仍在生效的公告。");
  renderGroup("#upcoming-list", notices.filter(item => item.status === "upcoming"), "暂未发现即将生效的公告。");
  renderGroup("#ended-list", ended, "近期没有需要保留的结束公告。");
  $("#source-list").innerHTML = (data.sources || []).map(source => `<li>${escapeHtml(source)}</li>`).join("");
  $("#home-airspace-metric").textContent = `本轮新增 ${summary.new || 0} 条 · 当前生效 ${summary.active || 0} 条`;
}

function openDetail(id) {
  const notice = [...(airspaceData?.notices || []), ...(airspaceData?.ended_recent || [])].find(item => item.id === id);
  if (!notice) return;
  const sources = preferredSources(notice.sources).map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.name)}${source.type === "official" ? "（官方）" : ""}</a>`).join("");
  $("#dialog-content").innerHTML = `<p class="eyebrow"><span></span>${escapeHtml(notice.region)}</p><h2 id="dialog-title">${escapeHtml(notice.title)}</h2><div class="meta"><span class="pill">发布时间 ${escapeHtml(notice.published_at)}</span><span class="pill">${escapeHtml(notice.time_text)}</span></div><p class="dialog-summary">${escapeHtml(notice.summary)}</p><h3>相关来源</h3><div class="dialog-sources">${sources || "暂无可跳转的来源"}</div>`;
  $("#notice-dialog").showModal();
}

async function initData() {
  try {
    const freshUrl = `${DATA_ENDPOINTS.airspace}?v=${Date.now()}`;
    let response = await fetch(freshUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
    airspaceData = normalizeAirspaceData(await response.json());
    renderAirspace(airspaceData);
  } catch (error) {
    try {
      const fallback = await fetch(`${DATA_ENDPOINTS.airspaceFallback}?v=${Date.now()}`, { cache: "no-store" });
      if (!fallback.ok) throw new Error(`Fallback HTTP ${fallback.status}`);
      airspaceData = normalizeAirspaceData(await fallback.json());
      renderAirspace(airspaceData);
      $("#airspace-updated").textContent = `${$("#airspace-updated").textContent} · Cloudflare 备份暂不可用，已直连 GitHub`;
      console.warn("Cloudflare airspace data unavailable; using GitHub fallback", error);
    } catch (fallbackError) {
      $("#airspace-updated").textContent = "空域数据暂时无法读取";
      $("[data-summary-message]").textContent = "数据暂未载入，请稍后重试。";
      $("#active-list").innerHTML = '<div class="empty-card">无法读取 Cloudflare 备份及 GitHub 信息源。</div>';
      $("#home-airspace-metric").textContent = "数据暂未载入";
      console.error("Failed to load airspace data", fallbackError);
    }
  }
}

document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => { location.hash = button.dataset.go; }));
document.addEventListener("click", event => { const button = event.target.closest("[data-detail]"); if (button) openDetail(button.dataset.detail); if (event.target.matches("[data-close-dialog]")) $("#notice-dialog").close(); });
$("#notice-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
window.addEventListener("hashchange", route);
route();
initData();
