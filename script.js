let cards = [];
let availableRarities = {};
let collection = JSON.parse(localStorage.getItem("collection")) || {};
let currentSetName = "";

/* ---------- NAV ---------- */
function goToStart() {
  document.getElementById("app").classList.add("hidden");
  document.getElementById("start-screen").classList.remove("hidden");
}

/* ---------- LOAD ---------- */
function loadPredefinedSet(name) {
  currentSetName = name;
  showLoading(true);

  fetch(`sets/${name}.json`)
    .then(r => r.json())
    .then(j => initSet(j.data))
    .catch(() => alert("Failed to load set"));
}

document.getElementById("jsonInput").addEventListener("change", e => {
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const json = JSON.parse(ev.target.result);
      currentSetName = json.name || "Custom Set";
      initSet(json.data);
    } catch {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(e.target.files[0]);
});

/* ---------- INIT ---------- */
function initSet(data) {
  if (!Array.isArray(data) || data.length === 0) {
    alert("Set contains no cards");
    showLoading(false);
    return;
  }

  cards = data;
  buildRarities();
  buildFilter();

  document.getElementById("openPack").disabled = false;

  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  showLoading(false);
  renderCollection();
  updateCompletion();
}

function showLoading(state) {
  document.getElementById("loading").classList.toggle("hidden", !state);
}

/* ---------- HELPERS ---------- */
function buildRarities() {
  availableRarities = {};
  cards.forEach(c => {
    if (!availableRarities[c.rarity]) {
      availableRarities[c.rarity] = [];
    }
    availableRarities[c.rarity].push(c);
  });
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- GOD PACK ---------- */
function isGodPack() {
  return Math.random() < 0.0008;
}

/* ---------- PACK ---------- */
function openPack() {
  const pack = document.getElementById("pack");
  pack.innerHTML = "";

  const god = isGodPack();

  for (let i = 0; i < 10; i++) {
    const card = god
      ? randomFrom(availableRarities["Illustration Rare"] || cards)
      : randomFrom(cards);

    const key = `${card.name}_${card.number}`;
    if (!collection[key]) collection[key] = { ...card, count: 0 };
    collection[key].count++;

    const rarityClass = card.rarity.replace(/\s+/g, "-");

    const div = document.createElement("div");
    div.className = `card rarity-${rarityClass}`;
    div.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back"></div>
        <div class="card-face card-front">
          <img src="${card.image}">
        </div>
      </div>
    `;

    pack.appendChild(div);

    setTimeout(() => {
      div.classList.add("flipped");
      if (i >= 7) div.classList.add("reveal-hit");
    }, i * 200);
  }

  saveCollection();
  renderCollection();
  updateCompletion();
}

/* ---------- COLLECTION ---------- */
function renderCollection() {
  const filter = document.getElementById("rarityFilter").value;
  const col = document.getElementById("collection");
  col.innerHTML = "";

  Object.values(collection)
    .filter(c => filter === "ALL" || c.rarity === filter)
    .forEach(card => {
      const r = card.rarity.replace(/\s+/g, "-");
      const d = document.createElement("div");
      d.className = `card rarity-${r}`;
      d.innerHTML = `<img src="${card.image}"><div>${card.name} ×${card.count}</div>`;
      col.appendChild(d);
    });
}

/* ---------- FILTER ---------- */
function buildFilter() {
  const s = document.getElementById("rarityFilter");
  s.innerHTML = `<option value="ALL">All</option>`;
  Object.keys(availableRarities).forEach(r => {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = r;
    s.appendChild(o);
  });
}
document.getElementById("rarityFilter").onchange = renderCollection;

/* ---------- COMPLETION ---------- */
function updateCompletion() {
  const owned = Object.keys(collection).length;
  const total = cards.length;
  const pct = Math.floor((owned / total) * 100);

  document.getElementById("completion").innerHTML = `
    <h3>${currentSetName}</h3>
    <div class="progress">
      <div class="progress-bar" style="width:${pct}%"></div>
    </div>
    <p>${owned}/${total} (${pct}%)</p>
  `;
}

/* ---------- STORAGE ---------- */
function saveCollection() {
  localStorage.setItem("collection", JSON.stringify(collection));
}

document.getElementById("openPack").onclick = openPack;
document.getElementById("resetData").onclick = () => {
  if (!confirm("Reset collection?")) return;
  localStorage.clear();
  collection = {};
  renderCollection();
  updateCompletion();
};
