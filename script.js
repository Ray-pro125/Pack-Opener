let cards = [];
let availableRarities = {};
let collection = {};
let stats = JSON.parse(localStorage.getItem("packStats")) || {
  packsOpened: 0,
  totalCards: 0,
  rarities: {}
};

const regularRarities = ["Common", "Uncommon", "Rare"];
const masterRarities = [
  "Double Rare",
  "Illustration Rare",
  "Ultra Rare",
  "Special Illustration Rare",
  "Hyper Rare"
];

const startScreen = document.getElementById("start-screen");
const app = document.getElementById("app");
const loading = document.getElementById("loading");
const packDiv = document.getElementById("pack");
const collectionDiv = document.getElementById("collection");
const filterSelect = document.getElementById("rarityFilter");

/* ---------- LOAD SET ---------- */
document.getElementById("loadDefault").onclick = () =>
  loadSet("sets/Z-Genesis_Melemele.json");

document.getElementById("importSet").onclick = () =>
  document.getElementById("fileInput").click();

document.getElementById("fileInput").addEventListener("change", e => {
  const reader = new FileReader();
  reader.onload = ev => initSet(JSON.parse(ev.target.result).data);
  reader.readAsText(e.target.files[0]);
});

function loadSet(path) {
  loading.style.display = "block";
  fetch(path).then(r => r.json()).then(j => initSet(j.data));
}

function initSet(data) {
  cards = data;
  collection = {};
  availableRarities = {};

  cards.forEach(c => {
    if (!availableRarities[c.rarity]) availableRarities[c.rarity] = [];
    availableRarities[c.rarity].push(c);
  });

  buildFilter();
  startScreen.classList.add("hidden");
  app.classList.remove("hidden");
  document.getElementById("openPack").disabled = false;
  loading.style.display = "none";

  renderCollection();
  updateStats();
  updateCompletion();
}

/* ---------- HELPERS ---------- */
function randomFrom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pullWeighted(table) {
  const valid = table.filter(e => availableRarities[e.rarity]?.length);
  let total = valid.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (let e of valid) {
    if (roll < e.weight) return randomFrom(availableRarities[e.rarity]);
    roll -= e.weight;
  }
  return randomFrom(cards);
}

/* ---------- OPEN PACK ---------- */
document.getElementById("openPack").onclick = () => {
  packDiv.innerHTML = "";
  const pulls = [];

  for (let i = 0; i < 4; i++) pulls.push(randomFrom(availableRarities["Common"] || cards));
  for (let i = 0; i < 3; i++) pulls.push(randomFrom(availableRarities["Uncommon"] || cards));

  pulls.push(pullWeighted([
    { rarity: "Common", weight: 55 },
    { rarity: "Uncommon", weight: 32 },
    { rarity: "Rare", weight: 11 },
    { rarity: "Illustration Rare", weight: 1.5 },
    { rarity: "Special Illustration Rare", weight: 0.4 },
    { rarity: "Hyper Rare", weight: 0.1 }
  ]));

  pulls.push(pullWeighted([
    { rarity: "Common", weight: 35 },
    { rarity: "Uncommon", weight: 43 },
    { rarity: "Rare", weight: 18 },
    { rarity: "Illustration Rare", weight: 12 },
    { rarity: "Special Illustration Rare", weight: 2.3 },
    { rarity: "Hyper Rare", weight: 0.7 }
  ]));

  pulls.push(pullWeighted([
    { rarity: "Rare", weight: 11 },
    { rarity: "Double Rare", weight: 3 },
    { rarity: "Ultra Rare", weight: 1 }
  ]));

  stats.packsOpened++;
  stats.totalCards += pulls.length;

  pulls.forEach(card => {
    stats.rarities[card.rarity] = (stats.rarities[card.rarity] || 0) + 1;
    const key = card.name + "_" + card.number;
    if (!collection[key]) collection[key] = { ...card, count: 0 };
    collection[key].count++;
  });

  renderPack(pulls);
  renderCollection();
  updateStats();
  updateCompletion();
};

/* ---------- RENDER ---------- */
function renderPack(pulls) {
  pulls.forEach((card, i) => {
    const div = document.createElement("div");
    const cls = card.rarity.replace(/\s+/g, "-");
    div.className = `card rarity-${cls}`;
    div.innerHTML = `<img src="${card.image}">`;
    packDiv.appendChild(div);
    setTimeout(() => div.classList.add("show"), i * 250);
  });
}

function renderCollection() {
  const filter = filterSelect.value;
  collectionDiv.innerHTML = "";

  Object.values(collection)
    .filter(c => filter === "All" || c.rarity === filter)
    .forEach(card => {
      const cls = card.rarity.replace(/\s+/g, "-");
      const div = document.createElement("div");
      div.className = `card rarity-${cls} show`;
      div.innerHTML = `<img src="${card.image}"><div>${card.name} ×${card.count}</div>`;
      collectionDiv.appendChild(div);
    });
}

/* ---------- FILTER ---------- */
function buildFilter() {
  filterSelect.innerHTML = `<option value="All">All</option>`;
  Object.keys(availableRarities).forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    filterSelect.appendChild(opt);
  });
}

filterSelect.onchange = renderCollection;

/* ---------- COMPLETION ---------- */
function updateCompletion() {
  const uniqueOwned = Object.keys(collection);
  const totalRegular = cards.filter(c => regularRarities.includes(c.rarity)).length;
  const ownedRegular = uniqueOwned.filter(k =>
    regularRarities.includes(collection[k].rarity)
  ).length;

  const regPct = Math.floor((ownedRegular / totalRegular) * 100);
  document.getElementById("regularLabel").textContent =
    `Regular: ${ownedRegular}/${totalRegular} (${regPct}%)`;
  document.getElementById("regularBar").style.width = regPct + "%";

  const hasMaster = cards.some(c => masterRarities.includes(c.rarity));
  const masterBox = document.getElementById("masterContainer");

  if (!hasMaster) {
    masterBox.style.display = "none";
    return;
  }

  const totalMaster = cards.length;
  const ownedMaster = uniqueOwned.length;
  const masPct = Math.floor((ownedMaster / totalMaster) * 100);

  document.getElementById("masterLabel").textContent =
    `Master: ${ownedMaster}/${totalMaster} (${masPct}%)`;
  document.getElementById("masterBar").style.width = masPct + "%";
}

/* ---------- STATS ---------- */
function updateStats() {
  const statsDiv = document.getElementById("stats");
  let html = `<h3>Packs: ${stats.packsOpened}</h3>
              <h3>Total Cards: ${stats.totalCards}</h3><ul>`;
  Object.entries(stats.rarities).forEach(([r, c]) => {
    html += `<li>${r}: ${c}</li>`;
  });
  html += "</ul>";
  statsDiv.innerHTML = html;
}

/* ---------- NAV ---------- */
document.getElementById("backToStart").onclick = () => {
  app.classList.add("hidden");
  startScreen.classList.remove("hidden");
};

document.getElementById("resetData").onclick = () => {
  if (!confirm("Reset all data?")) return;
  localStorage.clear();
  stats = { packsOpened: 0, totalCards: 0, rarities: {} };
  collection = {};
  renderCollection();
  updateStats();
  updateCompletion();
};
