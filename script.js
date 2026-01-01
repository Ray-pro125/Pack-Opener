let cards = [];

/* ---------------- STATS ---------------- */

let stats = JSON.parse(localStorage.getItem("packStats")) || {
  packsOpened: 0,
  rarities: {}
};

function saveStats() {
  localStorage.setItem("packStats", JSON.stringify(stats));
}

function updateStatsDisplay() {
  const statsDiv = document.getElementById("stats");
  let html = `<h3>Packs Opened: ${stats.packsOpened}</h3><ul>`;

  for (let r in stats.rarities) {
    html += `<li>${r}: ${stats.rarities[r]}</li>`;
  }

  html += "</ul>";
  statsDiv.innerHTML = html;
}

/* ---------------- COLLECTION ---------------- */

let collection = JSON.parse(localStorage.getItem("collection")) || {};

function saveCollection() {
  localStorage.setItem("collection", JSON.stringify(collection));
}

function renderCollection() {
  const colDiv = document.getElementById("collection");
  colDiv.innerHTML = "";

  Object.values(collection).forEach(card => {
    const div = document.createElement("div");
    div.className = "card show";
    div.innerHTML = `
      <img src="${card.image}">
      <div>${card.name} ×${card.count}</div>
    `;
    colDiv.appendChild(div);
  });
}

/* ---------------- LOAD SET ---------------- */

fetch("sets/Z-Genesis_Melemele.json")
  .then(res => res.json())
  .then(json => cards = json.data);

/* ---------------- HELPERS ---------------- */

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getByRarity(rarity) {
  return cards.filter(c => c.rarity === rarity);
}

function weightedRoll(table) {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;

  for (let entry of table) {
    if (roll < entry.weight) return entry.rarity;
    roll -= entry.weight;
  }
}

/* ---------------- OPEN PACK ---------------- */

function openPack() {
  const pack = document.getElementById("pack");
  pack.innerHTML = "";

  const pulls = [];

  // Slots 1–7
  for (let i = 0; i < 7; i++) {
    pulls.push(randomFrom(getByRarity(weightedRoll([
      { rarity: "Common", weight: 4 },
      { rarity: "Uncommon", weight: 3 }
    ]))));
  }

  // Slot 8
  pulls.push(randomFrom(getByRarity(weightedRoll([
    { rarity: "Common", weight: 33 },
    { rarity: "Uncommon", weight: 133 },
    { rarity: "Illustration Rare", weight: 6.25 },
    { rarity: "Special Illustration Rare", weight: 1.75 },
    { rarity: "Hyper Rare", weight: 1 }
  ]))));

  // Slot 9
  pulls.push(randomFrom(getByRarity(weightedRoll([
    { rarity: "Common", weight: 85 },
    { rarity: "Uncommon", weight: 232 },
    { rarity: "Illustration Rare", weight: 17 },
    { rarity: "Special Illustration Rare", weight: 3.8 },
    { rarity: "Hyper Rare", weight: 2.2 }
  ]))));

  // Slot 10
  pulls.push(randomFrom(getByRarity(weightedRoll([
    { rarity: "Rare", weight: 11 },
    { rarity: "Double Rare", weight: 3 },
    { rarity: "Ultra Rare", weight: 1 }
  ]))));

  /* ---- STATS (ONCE) ---- */
  stats.packsOpened++;
  pulls.forEach(card => {
    stats.rarities[card.rarity] =
      (stats.rarities[card.rarity] || 0) + 1;
  });
  saveStats();
  updateStatsDisplay();

  /* ---- COLLECTION (ONCE) ---- */
  const packCounts = {};
  pulls.forEach(card => {
    packCounts[card.name] = (packCounts[card.name] || 0) + 1;
  });

  for (let name in packCounts) {
    const card = pulls.find(c => c.name === name);
    if (!collection[name]) {
      collection[name] = { ...card, count: 0 };
    }
    collection[name].count += packCounts[name];
  }

  saveCollection();
  renderCollection();

  /* ---- RENDER + ANIMATION ---- */
  pulls.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<img src="${card.image}" alt="${card.name}">`;
    pack.appendChild(div);

    setTimeout(() => {
      div.classList.add("show");
    }, index * 350);
  });
}

/* ---------------- RESET ---------------- */

document.getElementById("resetData").onclick = () => {
  if (!confirm("This will erase all packs opened and your collection. Are you sure?")) return;

  localStorage.removeItem("packStats");
  localStorage.removeItem("collection");

  stats = { packsOpened: 0, rarities: {} };
  collection = {};

  updateStatsDisplay();
  renderCollection();
};

document.getElementById("openPack").onclick = openPack;

updateStatsDisplay();
renderCollection();
