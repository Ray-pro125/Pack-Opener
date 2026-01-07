let cards = [];
let availableRarities = {};
let collection = JSON.parse(localStorage.getItem("collection")) || {};
let currentSetName = "";

/* ---------- START / NAV ---------- */
function goToStart() {
  document.getElementById("app").classList.add("hidden");
  document.getElementById("start-screen").classList.remove("hidden");
}

function enterApp() {
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

/* ---------- LOAD SET ---------- */
function loadPredefinedSet(name) {
  currentSetName = name;
  fetch(`sets/${name}.json`)
    .then(r => r.json())
    .then(j => initSet(j.data));
}

document.getElementById("jsonInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => initSet(JSON.parse(ev.target.result).data);
  reader.readAsText(file);
});

function initSet(data) {
  cards = data;
  buildRarities();
  buildFilter();
  document.getElementById("openPack").disabled = false;
  document.getElementById("loading").style.display = "none";
  enterApp();
  renderCollection();
  updateCompletion();
}

/* ---------- HELPERS ---------- */
function buildRarities() {
  availableRarities = {};
  cards.forEach(c => {
    if (!availableRarities[c.rarity]) availableRarities[c.rarity] = [];
    availableRarities[c.rarity].push(c);
  });
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pullWeighted(table) {
  const filtered = table.filter(e => availableRarities[e.rarity]?.length);
  const total = filtered.reduce((s,e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (let e of filtered) {
    if (roll < e.weight) return randomFrom(availableRarities[e.rarity]);
    roll -= e.weight;
  }
  return randomFrom(cards);
}

/* ---------- OPEN PACK ---------- */
function openPack() {
  const pack = document.getElementById("pack");
  pack.innerHTML = "";
  const pulls = [];

  // Slots 1–7
  for (let i = 0; i < 7; i++) pulls.push(randomFrom(cards));

  // Slot 8
  pulls.push(pullWeighted([
    { rarity: "Common", weight: 55 },
    { rarity: "Uncommon", weight: 32 },
    { rarity: "Rare", weight: 11 },
    { rarity: "Illustration Rare", weight: 1.5 },
    { rarity: "Special Illustration Rare", weight: 0.4 },
    { rarity: "Hyper Rare", weight: 0.1 }
  ]));

  // Slot 9
  pulls.push(pullWeighted([
    { rarity: "Common", weight: 35 },
    { rarity: "Uncommon", weight: 43 },
    { rarity: "Rare", weight: 18 },
    { rarity: "Illustration Rare", weight: 12 },
    { rarity: "Special Illustration Rare", weight: 2.3 },
    { rarity: "Hyper Rare", weight: 0.7 }
  ]));

  // Slot 10
  pulls.push(pullWeighted([
    { rarity: "Rare", weight: 72 },
    { rarity: "Double Rare", weight: 21 },
    { rarity: "Ultra Rare", weight: 6 },
    { rarity: "Special Illustration Rare", weight: 1.5 },
    { rarity: "Hyper Rare", weight: 0.8 }
  ]));

  pulls.forEach((card, i) => {
    const key = `${card.name}_${card.number}`;
    if (!collection[key]) collection[key] = { ...card, count: 0 };
    collection[key].count++;

    const div = document.createElement("div");
    const rarityClass = card.rarity.replace(/\s+/g, "-");
    div.className = `card rarity-${rarityClass}`;
    div.innerHTML = `<img src="${card.image}">`;
    pack.appendChild(div);

    setTimeout(() => {
      div.classList.add("show");
      if (i >= 7) div.classList.add("reveal-hit"); // slots 8–10
    }, i * 180);
  });

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
      const div = document.createElement("div");
      const r = card.rarity.replace(/\s+/g, "-");
      div.className = `card show rarity-${r}`;
      div.innerHTML = `<img src="${card.image}"><div>${card.name} ×${card.count}</div>`;
      col.appendChild(div);
    });
}

/* ---------- FILTER ---------- */
function buildFilter() {
  const select = document.getElementById("rarityFilter");
  select.innerHTML = `<option value="ALL">All</option>`;
  Object.keys(availableRarities).forEach(r => {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = r;
    select.appendChild(o);
  });
}
document.getElementById("rarityFilter").onchange = renderCollection;

/* ---------- COMPLETION ---------- */
function updateCompletion() {
  const total = cards.length;
  const owned = Object.keys(collection).length;
  document.getElementById("completion").innerHTML =
    `<h3>${currentSetName}</h3><p>Completion: ${owned}/${total}</p>`;
}

/* ---------- STORAGE ---------- */
function saveCollection() {
  localStorage.setItem("collection", JSON.stringify(collection));
}

document.getElementById("openPack").onclick = openPack;
document.getElementById("resetData").onclick = () => {
  if (!confirm("Reset all data?")) return;
  localStorage.clear();
  collection = {};
  renderCollection();
  updateCompletion();
};

goToStart();
