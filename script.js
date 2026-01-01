let cards = [];

/* ---------------- STATS ---------------- */
let stats = JSON.parse(localStorage.getItem("packStats")) || {
  packsOpened: 0,
  totalCards: 0,
  rarities: {}
};

// Fixed rarity order for display
const rarityOrder = [
  "Common",
  "Uncommon",
  "Rare",
  "Double Rare",
  "Illustration Rare",
  "Ultra Rare",
  "Special Illustration Rare",
  "Hyper Rare"
];

function saveStats() {
  localStorage.setItem("packStats", JSON.stringify(stats));
}

function updateStatsDisplay() {
  const statsDiv = document.getElementById("stats");
  let html = `<h3>Packs Opened: ${stats.packsOpened}</h3><h3>Total cards: ${stats.totalCards}</h3><ul>`;

  // Loop through rarities in fixed order, show 0 if none
  rarityOrder.forEach(rarity => {
    const count = stats.rarities[rarity] || 0;
    html += `<li>${rarity}: ${count}</li>`;
  });

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

  // Convert collection object to array for sorting
  const collectionArray = Object.values(collection);

  // Sort by 'number' (handle letters like 87a, 87b)
  collectionArray.sort((a, b) => {
    const matchA = a.number.match(/^(\d+)([a-z]?)$/i);
    const matchB = b.number.match(/^(\d+)([a-z]?)$/i);

    const numA = parseInt(matchA[1]);
    const numB = parseInt(matchB[1]);

    const letterA = matchA[2] || '';
    const letterB = matchB[2] || '';

    if (numA !== numB) return numA - numB;
    if (letterA < letterB) return -1;
    if (letterA > letterB) return 1;
    return 0;
  });

  // Render sorted cards
  collectionArray.forEach(card => {
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
function loadSetFromUrl(set) {
  fetch(`sets/${set}.json`)
    .then(res => res.json())
    .then(json => {
      cards = json.data;
      document.getElementById("openPack").disabled = false;
      document.getElementById("loading").style.display = "none";
    });
}

document.getElementById("loadPackFromFile").addEventListener("click", () => {
  document.getElementById("jsonInput").click();
});

document.getElementById("jsonInput").addEventListener("change", () => {
  const file = document.getElementById("jsonInput").files[0];
  if (!file) return;

  if (!file.name.endsWith(".json")) {
    alert("Please upload a JSON file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);

      // same logic as loadSetFromUrl
      cards = json.data;
      document.getElementById("openPack").disabled = false;
      document.getElementById("loading").style.display = "none";
    } catch (err) {
      alert("Invalid JSON file.");
      console.error(err);
    }
  };

  reader.readAsText(file);
});

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
  if (!cards.length) {
    alert("Set not loaded yet. Please wait.");
    return;
  }

  const pack = document.getElementById("pack");
  pack.innerHTML = ""; // clear previous pack

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

  // Update stats
  stats.packsOpened++;
  stats.totalCards += 10;
  pulls.forEach(card => {
    stats.rarities[card.rarity] = (stats.rarities[card.rarity] || 0) + 1;
  });

  // Update collection
  for (let card of pulls) {
    // Unique key: name + number
    const key = `${card.name}_${card.number}`;
    if (!collection[key]) {
      collection[key] = { ...card, count: 0 };
    }
    collection[key].count += 1;
  }

  saveCollection();
  renderCollection();

  // Render pack with animation
  pulls.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<img src="${card.image}" alt="${card.name}">`;
    pack.appendChild(div);

    setTimeout(() => {
      div.classList.add("show");
    }, index * 350);
  });

  // Update stats AFTER pack is rendered
  saveStats();
  updateStatsDisplay();
}

/* ---------------- RESET ---------------- */
document.getElementById("resetData").onclick = () => {
  if (!confirm("This will erase all packs opened and your collection. Are you sure?")) return;

  localStorage.removeItem("packStats");
  localStorage.removeItem("collection");

  stats = { packsOpened: 0, totalCards: 0, rarities: {} };
  collection = {};

  updateStatsDisplay();
  renderCollection();
};

document.getElementById("openPack").onclick = openPack;

/* ---- INITIAL RENDER ---- */
loadSetFromUrl("Z-Genesis_Melemele");
updateStatsDisplay();
renderCollection();
