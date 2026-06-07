const DEFAULT_CONFIG = {
  refreshTimes: ["08:00", "12:00", "18:00"],
  topics: [
    { name: "가축전염병 일반", keywords: ["가축전염병", "가축전염병예방법"] },
    { name: "구제역", keywords: ["구제역"] },
    { name: "아프리카돼지열병", keywords: ["아프리카돼지열병"] },
    { name: "고병원성조류인플루엔자", keywords: ["고병원성조류인플루엔자"] },
    { name: "럼피스킨", keywords: ["럼피스킨"] },
    { name: "수의사", keywords: ["수의사"] },
  ],
};

const STORAGE_KEY = "news-watch-local-config-v1";
const LOG_KEY = "news-watch-refresh-log-v1";
const LAST_SLOT_KEY = "news-watch-last-slot-v1";

const state = {
  config: loadConfig(),
  refreshLog: loadRefreshLog(),
  currentSlot: null,
};

const els = {
  status: document.querySelector("#status"),
  refreshButton: document.querySelector("#refreshButton"),
  searchButton: document.querySelector("#searchButton"),
  openAllButton: document.querySelector("#openAllButton"),
  results: document.querySelector("#results"),
  refreshLog: document.querySelector("#refreshLog"),
  schedule: document.querySelector("#schedule"),
  nextRefresh: document.querySelector("#nextRefresh"),
  topicEditor: document.querySelector("#topicEditor"),
  addTopicButton: document.querySelector("#addTopicButton"),
  saveConfigButton: document.querySelector("#saveConfigButton"),
  resetConfigButton: document.querySelector("#resetConfigButton"),
  topicTemplate: document.querySelector("#topicTemplate"),
};

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function loadConfig() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return cloneConfig(DEFAULT_CONFIG);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...cloneConfig(DEFAULT_CONFIG),
      ...parsed,
      refreshTimes: Array.isArray(parsed.refreshTimes) ? parsed.refreshTimes : DEFAULT_CONFIG.refreshTimes,
      topics: Array.isArray(parsed.topics) && parsed.topics.length ? parsed.topics : DEFAULT_CONFIG.topics,
    };
  } catch {
    return cloneConfig(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadRefreshLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRefreshLog() {
  localStorage.setItem(LOG_KEY, JSON.stringify(state.refreshLog.slice(0, 30)));
}

function setStatus(message) {
  els.status.textContent = message;
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function minutesOf(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function getCurrentSlot(date = new Date()) {
  const now = minutesNow(date);
  const sorted = [...state.config.refreshTimes].sort((a, b) => minutesOf(a) - minutesOf(b));
  let selected = sorted[sorted.length - 1];
  for (const time of sorted) {
    if (now >= minutesOf(time)) selected = time;
  }
  return `${formatDateKey(date)} ${selected}`;
}

function getNextRefreshText(date = new Date()) {
  const now = minutesNow(date);
  const sorted = [...state.config.refreshTimes].sort((a, b) => minutesOf(a) - minutesOf(b));
  const nextToday = sorted.find((time) => minutesOf(time) > now);
  if (nextToday) return `다음 자동 갱신 ${nextToday}`;
  return `다음 자동 갱신 내일 ${sorted[0]}`;
}

function refresh(reason = "manual") {
  const slot = getCurrentSlot();
  state.currentSlot = slot;
  localStorage.setItem(LAST_SLOT_KEY, slot);

  const entry = {
    slot,
    reason,
    refreshedAt: new Date().toISOString(),
    topicCount: state.config.topics.length,
    keywordCount: state.config.topics.reduce((sum, topic) => sum + topic.keywords.length, 0),
  };
  state.refreshLog = [entry, ...state.refreshLog.filter((item) => item.slot !== slot)].slice(0, 30);
  saveRefreshLog();
  render();
  setStatus(`${formatTime()} 기준으로 검색 링크를 갱신했습니다.`);
}

function maybeScheduledRefresh() {
  const slot = getCurrentSlot();
  const lastSlot = localStorage.getItem(LAST_SLOT_KEY);
  if (slot !== lastSlot) {
    refresh("scheduled");
    return;
  }
  render();
}

function naverNewsUrl(keyword) {
  const params = new URLSearchParams({
    where: "news",
    query: keyword,
    sort: "1",
  });
  return `https://search.naver.com/search.naver?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSchedule() {
  els.schedule.innerHTML = state.config.refreshTimes
    .map((time) => {
      const isCurrent = state.currentSlot?.endsWith(time);
      return `<span class="slot${isCurrent ? " current" : ""}">${escapeHtml(time)}</span>`;
    })
    .join("");
  els.nextRefresh.textContent = getNextRefreshText();
}

function renderResults() {
  els.results.innerHTML = state.config.topics
    .map((topic) => {
      const links = topic.keywords
        .map((keyword) => {
          const url = naverNewsUrl(keyword);
          return `
            <a class="search-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">
              <span>${escapeHtml(keyword)}</span>
              <small>최신순</small>
            </a>
          `;
        })
        .join("");
      return `
        <section class="topic-group">
          <h3 class="topic-heading">${escapeHtml(topic.name)}</h3>
          <div class="link-grid">${links}</div>
        </section>
      `;
    })
    .join("");
}

function renderLog() {
  if (!state.refreshLog.length) {
    els.refreshLog.innerHTML = `<div class="empty">아직 갱신 기록이 없습니다.</div>`;
    return;
  }

  els.refreshLog.innerHTML = state.refreshLog
    .slice(0, 12)
    .map((entry) => {
      const reason = entry.reason === "scheduled" ? "자동" : "수동";
      return `
        <article class="log-item">
          <strong>${escapeHtml(entry.slot)}</strong>
          <span>${reason} 갱신 · 키워드 ${entry.keywordCount}개</span>
        </article>
      `;
    })
    .join("");
}

function renderTopics() {
  els.topicEditor.innerHTML = "";
  for (const topic of state.config.topics) {
    addTopicEditor(topic);
  }
}

function addTopicEditor(topic = { name: "", keywords: [] }) {
  const node = els.topicTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".topic-name").value = topic.name || "";
  node.querySelector(".topic-keywords").value = (topic.keywords || []).join(", ");
  node.querySelector(".remove-topic").addEventListener("click", () => node.remove());
  els.topicEditor.append(node);
}

function collectConfigFromEditor() {
  const topics = [...els.topicEditor.querySelectorAll(".topic-item")]
    .map((item) => {
      const name = item.querySelector(".topic-name").value.trim();
      const keywords = item
        .querySelector(".topic-keywords")
        .value.split(/[,\n]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean);
      return { name, keywords };
    })
    .filter((topic) => topic.name && topic.keywords.length);

  return {
    ...state.config,
    topics,
  };
}

function render() {
  renderSchedule();
  renderResults();
  renderLog();
}

function showTab(name) {
  for (const button of document.querySelectorAll(".tab")) {
    button.classList.toggle("is-active", button.dataset.tab === name);
  }
  for (const view of document.querySelectorAll(".view")) {
    view.classList.toggle("is-active", view.id === `${name}View`);
  }
}

function saveEditedConfig() {
  const nextConfig = collectConfigFromEditor();
  if (!nextConfig.topics.length) {
    setStatus("최소 1개 이상의 주제와 키워드가 필요합니다.");
    return;
  }
  state.config = nextConfig;
  saveConfig(state.config);
  renderTopics();
  refresh("manual");
  setStatus("키워드를 저장하고 검색 링크를 갱신했습니다.");
}

function resetConfig() {
  state.config = cloneConfig(DEFAULT_CONFIG);
  saveConfig(state.config);
  renderTopics();
  refresh("manual");
  setStatus("기본 키워드로 되돌렸습니다.");
}

function openFirstKeyword() {
  const firstKeyword = state.config.topics.flatMap((topic) => topic.keywords)[0];
  if (!firstKeyword) {
    setStatus("열 수 있는 키워드가 없습니다.");
    return;
  }
  window.open(naverNewsUrl(firstKeyword), "_blank", "noopener");
}

els.refreshButton.addEventListener("click", () => refresh("manual"));
els.searchButton.addEventListener("click", () => refresh("manual"));
els.openAllButton.addEventListener("click", openFirstKeyword);
els.addTopicButton.addEventListener("click", () => addTopicEditor());
els.saveConfigButton.addEventListener("click", saveEditedConfig);
els.resetConfigButton.addEventListener("click", resetConfig);

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

renderTopics();
maybeScheduledRefresh();
setInterval(maybeScheduledRefresh, 60 * 1000);
