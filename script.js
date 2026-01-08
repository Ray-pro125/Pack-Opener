let cards = [], availableRarities = {};
let stats = JSON.parse(localStorage.getItem("packStats")) || { packsOpened: 0, totalCards: 0, rarities: {} };
let collection = JSON.parse(localStorage.getItem("collection")) || {};

/* ---------------- DOM ---------------- */
const startScreen = document.getElementById("startScreen");
const app = document.getElementById("app");
const openPackBtn = document.getElementById("openPack");
const viewCollectionBtn = document.getElementById("viewCollection");
const backToStartBtn = document.getElementById("backToStart");
const packDiv = document.getElementById("pack");
const collectionDiv = document.getElementById("collection");
const statsDiv = document.getElementById("stats");
const loadingDiv = document.getElementById("loading");
const availableSetsDiv = document.getElementById("availableSets");
const importSetBtn = document.getElementById("importSet");
const jsonInput = document.getElementById("jsonInput");
const resetBtn = document.getElementById("resetData");

/* ---------------- STATS & COLLECTION ---------------- */
function saveStats() { localStorage.setItem("packStats", JSON.stringify(stats)); }
function saveCollection() { localStorage.setItem("collection", JSON.stringify(collection)); }

function updateStatsDisplay() {
  let html = `<h3>Packs Opened: ${stats.packsOpened}</h3>
              <h3>Total cards: ${stats.totalCards}</h3>
              <ul>`;
  ["Common", "Uncommon", "Rare", "Double Rare", "Illustration Rare", "Ultra Rare", "Special Illustration Rare", "Hyper Rare"]
    .forEach(r => html += `<li>${r}: ${stats.rarities[r] || 0}</li>`);
  html += "</ul>";
  statsDiv.innerHTML = html;
}

function renderCollection() {
  collectionDiv.innerHTML = "";
  const arr = Object.values(collection);
  arr.sort((a, b) => {
    const ma = a.number.match(/^(\d+)([a-z]?)$/i);
    const mb = b.number.match(/^(\d+)([a-z]?)$/i);
    const na = parseInt(ma[1]), nb = parseInt(mb[1]);
    const la = ma[2] || '', lb = mb[2] || '';
    if (na !== nb) return na - nb;
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
  });

  arr.forEach(c => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g,'-')}`;
    div.innerHTML = `<img src="${c.image}"><div>${c.name} ×${c.count}</div>`;
    collectionDiv.appendChild(div);
  });
}

/* ---------------- LOAD SET ---------------- */
function buildAvailableRarities() {
  availableRarities = {};
  cards.forEach(c => {
    if (!availableRarities[c.rarity]) availableRarities[c.rarity] = [];
    availableRarities[c.rarity].push(c);
  });
}

function loadSet(fileOrJSON) {
  loadingDiv.style.display = "block";
  if (typeof fileOrJSON === "string") {
    fetch(fileOrJSON)
      .then(r => r.json())
      .then(j => {
        cards = j.data;
        buildAvailableRarities();
        loadingDiv.style.display = "none";
        openPackBtn.disabled = false;
        startScreen.classList.add("hidden");
        app.classList.remove("hidden");
      });
  } else {
    try {
      const j = JSON.parse(fileOrJSON);
      cards = j.data;
      buildAvailableRarities();
      loadingDiv.style.display = "none";
      openPackBtn.disabled = false;
      startScreen.classList.add("hidden");
      app.classList.remove("hidden");
    } catch { alert("Invalid JSON"); }
  }
}

/* ---------------- HELPERS ---------------- */
function randomFrom(arr) { if (!arr || !arr.length) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function getByRarity(r) { return availableRarities[r] || []; }
function weightedRoll(table) {
  const filtered = table.filter(e => getByRarity(e.rarity).length);
  if (!filtered.length) return null;
  let total = filtered.reduce((s, e) => s + e.weight, 0), roll = Math.random() * total;
  for (let e of filtered) { if (roll < e.weight) return e.rarity; roll -= e.weight; }
  return filtered[filtered.length - 1].rarity;
}
function pullWeighted(table) { const r = weightedRoll(table); return randomFrom(getByRarity(r)) || randomFrom(cards); }

/* ---------------- OPEN PACK ---------------- */
function openPack() {
  if (!cards.length) { alert("Set not loaded"); return; }
  packDiv.innerHTML = "";

  const pulls = [];
  for (let i = 0; i < 4; i++) pulls.push(randomFrom(getByRarity("Common")) || randomFrom(cards));
  for (let i = 0; i < 3; i++) pulls.push(randomFrom(getByRarity("Uncommon")) || randomFrom(cards));
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
  pulls.forEach(c => stats.rarities[c.rarity] = (stats.rarities[c.rarity] || 0) + 1);
  pulls.forEach(c => { const key = `${c.name}_${c.number}`; if (!collection[key]) collection[key] = { ...c, count: 0 }; collection[key].count++; });

  saveCollection(); renderCollection(); saveStats(); updateStatsDisplay();

  pulls.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g,'-')}`;
    if (i >= pulls.length - 3) div.classList.add("last-three-hidden");
    div.innerHTML = `<img src="${c.image}" alt="${c.name}">`;
    packDiv.appendChild(div);
    if (i < pulls.length - 3) setTimeout
