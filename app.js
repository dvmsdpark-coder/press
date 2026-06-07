const DEFAULT_CONFIG = {
  topics: [
    { name: "가축전염병 일반", keywords: ["가축전염병", "가축전염병예방법"] },
    { name: "구제역", keywords: ["구제역"] },
    { name: "아프리카돼지열병", keywords: ["아프리카돼지열병"] },
    { name: "고병원성조류인플루엔자", keywords: ["고병원성조류인플루엔자"] },
    { name: "럼피스킨", keywords: ["럼피스킨"] },
    { name: "수의사", keywords: ["수의사"] },
  ],
};

const STORAGE_KEY = "keyword-news-launcher-config-v2";

const state = {
  config: loadConfig(),
};

const els = {
  status: document.querySelector("#status"),
  openAllButton: document.querySelector("#openAllButton"),
  editButton: document.querySelector("#editButton"),
  results: document.querySelector("#results"),
  topicEditor: document.querySelector("#topicEditor"),
  addTopicButton: document.querySelector("#addTopicButton"),
  saveConfigButton: document.querySelector("#saveConfigButton"),
  resetConfigButton: document.querySelector("#resetConfigButton"),
  topicTemplate: document.querySelector("#topicTemplate"),
};

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function normalizeKeyword(keyword) {
  return String(keyword ?? "").trim().replace(/\s+/g, " ");
}

function uniqueKeywords(keywords) {
  const seen = new Set();
  const result = [];
  for (const keyword of keywords.map(normalizeKeyword).filter(Boolean)) {
    const key = keyword.toLocaleLowerCase("ko-KR");
    if (!seen.has(key)) {
      seen.add(key);
      result.push(keyword);
    }
  }
  return result;
}

function normalizeTopics(topics) {
  const result = [];
  for (const topic of topics || []) {
    const name = String(topic.name ?? "").trim();
    const keywords = uniqueKeywords(topic.keywords || []);
    if (name && keywords.length) {
      result.push({ name, keywords });
    }
  }
  return result.length ? result : cloneConfig(DEFAULT_CONFIG).topics;
}

function loadConfig() {
  const saved = safeGetItem(STORAGE_KEY);
  if (!saved) return cloneConfig(DEFAULT_CONFIG);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...cloneConfig(DEFAULT_CONFIG),
      ...parsed,
      topics: normalizeTopics(parsed.topics),
    };
  } catch {
    return cloneConfig(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  return safeSetItem(STORAGE_KEY, JSON.stringify(config));
}

function setStatus(message) {
  els.status.textContent = message;
}

function allKeywords() {
  return uniqueKeywords(state.config.topics.flatMap((topic) => topic.keywords));
}

function naverNewsUrl(keywords) {
  const list = uniqueKeywords(Array.isArray(keywords) ? keywords : [keywords]);
  const query = list.map((keyword) => `"${keyword.replaceAll('"', "")}"`).join(" | ");
  const params = new URLSearchParams({
    where: "news",
    query,
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

function renderResults() {
  const keywords = allKeywords();
  const total = keywords.length;
  const allUrl = naverNewsUrl(keywords);

  const allCard = `
    <section class="bundle-card">
      <div>
        <span class="label">전체 묶음</span>
        <h2>전체 키워드 ${total}개</h2>
      </div>
      <a class="bundle-action" href="${escapeHtml(allUrl)}" target="_blank" rel="noopener">네이버 뉴스 검색</a>
    </section>
  `;

  const topicCards = state.config.topics
    .map((topic) => {
      const topicUrl = naverNewsUrl(topic.keywords);
      const chips = topic.keywords
        .map((keyword) => {
          const keywordUrl = naverNewsUrl(keyword);
          return `<a class="keyword-chip" href="${escapeHtml(keywordUrl)}" target="_blank" rel="noopener">${escapeHtml(keyword)}</a>`;
        })
        .join("");
      return `
        <section class="topic-group">
          <div class="topic-summary">
            <div>
              <h3 class="topic-heading">${escapeHtml(topic.name)}</h3>
              <span>${topic.keywords.length}개 키워드</span>
            </div>
            <a class="search-link compact-link" href="${escapeHtml(topicUrl)}" target="_blank" rel="noopener">
              <span>묶음 검색</span>
              <small>최신순</small>
            </a>
          </div>
          <div class="keyword-row">${chips}</div>
        </section>
      `;
    })
    .join("");

  els.results.innerHTML = `${allCard}${topicCards}`;
  setStatus(`주제 ${state.config.topics.length}개 · 전체 키워드 ${total}개`);
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
        .map(normalizeKeyword)
        .filter(Boolean);
      return { name, keywords: uniqueKeywords(keywords) };
    })
    .filter((topic) => topic.name && topic.keywords.length);

  return {
    ...state.config,
    topics: normalizeTopics(topics),
  };
}

function render() {
  renderResults();
  renderTopics();
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
  const saved = saveConfig(state.config);
  render();
  showTab("results");
  setStatus(saved ? "키워드를 저장했습니다." : "저장은 제한되었지만 현재 화면에는 반영했습니다.");
}

function resetConfig() {
  state.config = cloneConfig(DEFAULT_CONFIG);
  const saved = saveConfig(state.config);
  render();
  showTab("results");
  setStatus(saved ? "기본 키워드로 되돌렸습니다." : "저장은 제한되었지만 기본값을 화면에 반영했습니다.");
}

function openAllKeywords() {
  const keywords = allKeywords();
  if (!keywords.length) {
    setStatus("검색할 키워드가 없습니다.");
    return;
  }
  window.open(naverNewsUrl(keywords), "_blank", "noopener");
}

els.openAllButton.addEventListener("click", openAllKeywords);
els.editButton.addEventListener("click", () => showTab("keywords"));
els.addTopicButton.addEventListener("click", () => addTopicEditor());
els.saveConfigButton.addEventListener("click", saveEditedConfig);
els.resetConfigButton.addEventListener("click", resetConfig);

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

render();
