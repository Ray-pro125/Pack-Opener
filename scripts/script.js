let cards = [], availableRarities = {};
const AUTO_REVEAL_RARITIES = ["Common", "Uncommon", "Rare"];
const SPECIAL_GLOW_RARITIES = [
  "Double Rare",
  "Ultra Rare",
  "Illustration Rare",
  "Special Illustration Rare",
  "Hyper Rare"
];

/* ---------------- ACTIVE SET & LOCAL STORAGE ---------------- */
let currentSetName = localStorage.getItem("activeSetName") || "Z-Genesis Melemele";

function getCollectionKey() { return `collection_${currentSetName}`; }
function getStatsKey() { return `packStats_${currentSetName}`; }

let stats = { packsOpened: 0, totalCards: 0, rarities: {} };
let collection = {};

function loadCollectionAndStats() {
  stats = JSON.parse(localStorage.getItem(getStatsKey())) || { packsOpened: 0, totalCards: 0, rarities: {} };
  collection = JSON.parse(localStorage.getItem(getCollectionKey())) || {};
}
loadCollectionAndStats();

let lightbox = null, hoverTimeout = null;
let recentCards = JSON.parse(localStorage.getItem("recentCards")) || [];
let firstPackOpened = false;
let lightboxEnabled = false;

// DOM elements
const startScreen = document.getElementById("startScreen");
const openPackPage = document.getElementById("openPackPage");
const collectionPage = document.getElementById("collectionPage");

const openPackBtn = document.getElementById("openPack");
const viewCollectionBtn = document.getElementById("viewCollection");
const backToStartBtn = document.getElementById("backToStart");
const backToOpenPackBtn = document.getElementById("backToOpenPack");
const resetBtn = document.getElementById("resetData");

const packDiv = document.getElementById("pack");
const collectionDiv = document.getElementById("collection");
const statsDiv = document.getElementById("stats");
const loadingDiv = document.getElementById("loading");
const openPackCenter = document.getElementById("openPackCenter");

const availableSetsDiv = document.getElementById("availableSets");
const importSetBtn = document.getElementById("importSet");
const jsonInput = document.getElementById("jsonInput");

const urlInput = document.getElementById("setURL");
const importURLBtn = document.getElementById("importURLSet");

const collectionFilter = document.getElementById("collectionFilter");
const recentCardsDiv = document.getElementById("recentCards");
const toggleRecentCardsBtn = document.getElementById("toggleRecentCards");
const currentSetDisplay = document.getElementById("currentSetDisplay");

/* ---------------- STATS & COLLECTION ---------------- */
function saveStats() { localStorage.setItem(getStatsKey(), JSON.stringify(stats)); }
function saveCollection() { localStorage.setItem(getCollectionKey(), JSON.stringify(collection)); }

function updateStatsDisplay() {
  let html = `<h3>Set: ${currentSetName}</h3>
              <h3>Packs Opened: ${stats.packsOpened}</h3>
              <h3>Total cards: ${stats.totalCards}</h3><ul>`;
  ["Common", "Uncommon", "Rare", "Double Rare", "Illustration Rare", "Ultra Rare", "Special Illustration Rare", "Hyper Rare"]
    .forEach(r => html += `<li>${r}: ${stats.rarities[r] || 0}</li>`);
  html += "</ul>";
  statsDiv.innerHTML = html;

  const regularRarities = ["Common", "Uncommon", "Rare", "Double Rare"];
  const regularMax = cards.filter(c => regularRarities.includes(c.rarity)).length;
  const regularCollected = Object.values(collection).filter(c => c.count > 0 && regularRarities.includes(c.rarity)).length;

  const masterMax = cards.length;
  const masterCollected = Object.values(collection).filter(c => c.count > 0).length;

  // Prevent division by zero
  const regularProgress = regularMax > 0 ? (regularCollected / regularMax) * 100 : 0;
  const masterProgress = masterMax > 0 ? (masterCollected / masterMax) * 100 : 0;

  const regEl = document.getElementById("regularProgress");
  const mastEl = document.getElementById("masterProgress");
  if (regEl) regEl.value = regularProgress;
  if (mastEl) mastEl.value = masterProgress;
}

function renderSetTabs() {
  const container = document.getElementById("collectionSetTabs");
  if (!container) return;
  container.innerHTML = "";

  const knownSets = new Set(["Z-Genesis Melemele", "Z-Genesis Akala"]);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("collection_")) {
      knownSets.add(key.replace("collection_", ""));
    }
  }

  knownSets.forEach(setName => {
    const btn = document.createElement("button");
    btn.textContent = setName;
    if (setName === currentSetName) btn.classList.add("active-set");

    btn.onclick = () => {
      if (setName.startsWith("Z-Genesis")) {
        loadSet(`sets/${setName}.json`, setName);
      } else {
        currentSetName = setName;
        localStorage.setItem("activeSetName", setName);
        loadCollectionAndStats();
        updateStatsDisplay();
        renderCollection(collectionFilter.value || null);
      }
      renderSetTabs();
    };

    container.appendChild(btn);
  });
}

function renderCollection(filterRarity = null) {
  collectionDiv.innerHTML = "";
  
  // Build card binder view from set data if loaded, otherwise fallback to pulled cards
  let listToRender = [];
  if (cards && cards.length > 0) {
    cards.forEach(c => {
      const key = `${c.name}_${c.number}`;
      const owned = collection[key];
      const count = owned ? owned.count : 0;
      listToRender.push({ ...c, count });
    });
  } else {
    listToRender = Object.values(collection);
  }

  if (filterRarity) listToRender = listToRender.filter(c => c.rarity === filterRarity);

  listToRender.sort((a, b) => {
    const ma = (a.number || "").toString().match(/^(\d+)([a-z]?)$/i);
    const mb = (b.number || "").toString().match(/^(\d+)([a-z]?)$/i);
    if (!ma || !mb) return 0;
    const na = parseInt(ma[1]), nb = parseInt(mb[1]);
    const la = ma[2] || '', lb = mb[2] || '';
    if (na !== nb) return na - nb;
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
  });

  listToRender.forEach((c, i) => {
    const div = document.createElement("div");
    const count = c.count || 0;
    div.className = `card rarity-${(c.rarity || 'Common').replace(/\s+/g, '-')} show`;
    
    if (count === 0) {
      div.style.filter = "grayscale(100%) opacity(0.4)";
    }

    div.innerHTML = `<img src="${c.image || 'cardback.png'}" onerror="this.src='cardback.png'"><div>${c.name} ×${count}</div>`;
    collectionDiv.appendChild(div);
    attachLightboxHandlers(div, c, listToRender, i);
  });
}

/* ---------------- LOAD SET ---------------- */
function buildAvailableRarities() {
  availableRarities = {};
  cards.forEach(c => { if (!availableRarities[c.rarity]) availableRarities[c.rarity] = []; availableRarities[c.rarity].push(c); });
}

function loadSet(fileOrJSON, explicitSetName = null) {
  loadingDiv.style.display = "block";

  const onSetLoaded = (data, nameFromData) => {
    cards = data;
    buildAvailableRarities();

    // Set Active Set Name
    currentSetName = explicitSetName || nameFromData || "Custom Set";
    localStorage.setItem("activeSetName", currentSetName);
    if (currentSetDisplay) currentSetDisplay.textContent = currentSetName;

    loadCollectionAndStats();
    updateStatsDisplay();
    renderCollection(collectionFilter.value || null);
    renderSetTabs();

    loadingDiv.style.display = "none";
    openPackBtn.disabled = false;
    packDiv.innerHTML = ""; // Clear any previous pack
    firstPackOpened = false; // Reset for new set
    if (openPackCenter) openPackCenter.classList.remove("hidden");
    if (openPackBtn.parentElement !== openPackCenter && openPackCenter) {
      openPackCenter.appendChild(openPackBtn);
    }
    startScreen.classList.add("hidden");
    openPackPage.classList.remove("hidden");
  };

  if (typeof fileOrJSON === "string") {
    const trimmed = fileOrJSON.trim();
    const isJsonString = trimmed.startsWith('{') || trimmed.startsWith('[');

    if (isJsonString) {
      try {
        const j = JSON.parse(fileOrJSON);
        onSetLoaded(j.data, j.name);
      } catch {
        loadingDiv.style.display = "none";
        alert("Invalid JSON");
      }
    } else {
      const isLocalPath = fileOrJSON.startsWith('sets/') || fileOrJSON.startsWith('./') || (!fileOrJSON.startsWith('http://') && !fileOrJSON.startsWith('https://') && !fileOrJSON.startsWith('//'));
      const fetchFn = (!isLocalPath && typeof URLResolver !== 'undefined' && URLResolver.importJson)
        ? (url) => URLResolver.importJson(url)
        : (url) => fetch(url).then(r => r.json());

      fetchFn(fileOrJSON).then(j => {
        const inferredName = explicitSetName || fileOrJSON.replace(/^sets\//, '').replace(/\.json$/, '');
        onSetLoaded(j.data, j.name || inferredName);
      }).catch(err => {
        loadingDiv.style.display = "none";
        alert(`Failed to load set: ${err.message || err}`);
      });
    }
  } else {
    try {
      const j = JSON.parse(fileOrJSON);
      onSetLoaded(j.data, j.name);
    } catch { alert("Invalid JSON"); }
  }
}

/* ---------------- HELPERS ---------------- */
function randomFrom(arr) { if (!arr || !arr.length) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function getByRarity(r) { return availableRarities[r] || []; }
function weightedRoll(table) { const f = table.filter(e => getByRarity(e.rarity).length); if (!f.length) return null; let total = f.reduce((s, e) => s + e.weight, 0), roll = Math.random() * total; for (let e of f) { if (roll < e.weight) return e.rarity; roll -= e.weight; } return f[f.length - 1].rarity; }
function pullWeighted(table) { const r = weightedRoll(table); return randomFrom(getByRarity(r)) || randomFrom(cards); }

/* ---------------- OPEN PACK ---------------- */
function openPack() {
  if (!cards.length) { alert("Set not loaded"); return; }

  // Clear previous pack display
  packDiv.innerHTML = "";

  // Move button to controls after first pack and hide center container
  if (!firstPackOpened) {
    firstPackOpened = true;
    const controls = document.getElementById("controls");
    if (controls && openPackCenter) {
      openPackCenter.classList.add("hidden");
      controls.insertBefore(openPackBtn, controls.firstChild);
    }
  }

  const pulls = [];
  const pulledKeys = new Set(); // Track cards already pulled in this pack

  // Helper to get card key
  const getCardKey = (c) => c ? `${c.name}_${c.number}` : null;

  // Helper to filter out already pulled cards
  const filterUnpulled = (arr) => arr ? arr.filter(c => {
    const key = getCardKey(c);
    return key && !pulledKeys.has(key);
  }) : [];

  // Helper to pull random card excluding already pulled ones
  const pullUnique = (rarity) => {
    const available = filterUnpulled(getByRarity(rarity));
    if (available.length === 0) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }
    return randomFrom(available);
  };

  // Helper to pull weighted excluding already pulled ones
  const pullWeightedUnique = (table) => {
    // Create filtered table with only rarities that have unpulled cards
    const filteredTable = table.filter(e => {
      const available = filterUnpulled(getByRarity(e.rarity));
      return available.length > 0;
    });

    if (!filteredTable.length) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }

    // Custom weighted roll that uses filtered cards
    let total = filteredTable.reduce((s, e) => s + e.weight, 0);
    if (total === 0) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }

    let roll = Math.random() * total;
    let selectedRarity = null;
    for (let e of filteredTable) {
      if (roll < e.weight) {
        selectedRarity = e.rarity;
        break;
      }
      roll -= e.weight;
    }
    if (!selectedRarity) selectedRarity = filteredTable[filteredTable.length - 1].rarity;

    const available = filterUnpulled(getByRarity(selectedRarity));
    if (available.length === 0) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }
    return randomFrom(available);
  };

  // Pull 4 Common (unique)
  for (let i = 0; i < 4; i++) {
    const card = pullUnique("Common");
    if (card) {
      pulls.push(card);
      pulledKeys.add(getCardKey(card));
    }
  }

  // Pull 3 Uncommon (unique)
  for (let i = 0; i < 3; i++) {
    const card = pullUnique("Uncommon");
    if (card) {
      pulls.push(card);
      pulledKeys.add(getCardKey(card));
    }
  }

  // Pull remaining slots (unique)
  const card8 = pullWeightedUnique([{ rarity: "Common", weight: 55 }, { rarity: "Uncommon", weight: 32 }, { rarity: "Rare", weight: 11 }, { rarity: "Illustration Rare", weight: 1.5 }, { rarity: "Special Illustration Rare", weight: 0.4 }, { rarity: "Hyper Rare", weight: 0.1 }]);
  if (card8) { pulls.push(card8); pulledKeys.add(getCardKey(card8)); }

  const card9 = pullWeightedUnique([{ rarity: "Common", weight: 35 }, { rarity: "Uncommon", weight: 43 }, { rarity: "Rare", weight: 18 }, { rarity: "Illustration Rare", weight: 12 }, { rarity: "Special Illustration Rare", weight: 2.3 }, { rarity: "Hyper Rare", weight: 0.7 }]);
  if (card9) { pulls.push(card9); pulledKeys.add(getCardKey(card9)); }

  const card10 = pullWeightedUnique([{ rarity: "Rare", weight: 11 }, { rarity: "Double Rare", weight: 3 }, { rarity: "Ultra Rare", weight: 1 }]);
  if (card10) { pulls.push(card10); pulledKeys.add(getCardKey(card10)); }

  stats.packsOpened++;
  stats.totalCards += pulls.length;
  pulls.forEach(c => stats.rarities[c.rarity] = (stats.rarities[c.rarity] || 0) + 1);
  pulls.forEach(c => {
    const key = `${c.name}_${c.number}`;
    if (!collection[key]) collection[key] = { ...c, count: 0 };
    collection[key].count++;
    // Add to recent cards (keep last 20)
    recentCards.unshift({ ...c, timestamp: Date.now() });
    if (recentCards.length > 20) recentCards.pop();
  });
  localStorage.setItem("recentCards", JSON.stringify(recentCards));

  saveCollection();
  renderCollection(collectionFilter.value || null);
  saveStats();
  updateStatsDisplay();

  // ------- REVEAL: rarity-aware last 3 cards with glow hint -------
  pulls.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g, '-')}`;

    const isLastThree = i >= pulls.length - 3;
    const autoReveal = AUTO_REVEAL_RARITIES.includes(c.rarity);

    if (!isLastThree || autoReveal) {
      // Normal reveal
      const img = document.createElement("img");
      img.src = c.image;
      img.alt = c.name;
      div.appendChild(img);
    } else {
      // Special rarity in last 3 → hidden, only glow hint
      div.dataset.revealed = "false";

      if (SPECIAL_GLOW_RARITIES.includes(c.rarity)) {
        div.classList.add("glow-hint");
      }

      div.addEventListener("click", () => {
        if (div.dataset.revealed === "true") return;

        const img = document.createElement("img");
        img.src = c.image;
        img.alt = c.name;
        div.appendChild(img);
        div.dataset.revealed = "true";
        div.classList.remove("glow-hint");
        div.classList.add("revealed");
      }, { once: true });
    }

    // Add to DOM and show placeholder div immediately
    packDiv.appendChild(div);
    setTimeout(() => div.classList.add("show"), i * 350);
    attachLightboxHandlers(div, c, pulls, i);
  });
}

/* ---------------- START SCREEN ---------------- */
function initStartScreen() {
  availableSetsDiv.innerHTML = "";
  ["Z-Genesis Melemele", "Z-Genesis Akala"].forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s;
    btn.onclick = () => loadSet(`sets/${s}.json`, s);
    availableSetsDiv.appendChild(btn);
  });
}

// Run once on page load
initStartScreen();

/* ---------------- IMPORT ---------------- */
importSetBtn.onclick = () => jsonInput.click();
jsonInput.onchange = (e) => {
  const f = jsonInput.files[0];
  if (!f || !f.name.endsWith(".json")) return alert("Please select a JSON file");
  const r = new FileReader();
  r.onload = ev => { loadSet(ev.target.result, f.name.replace(".json", "")); };
  r.readAsText(f);
};

// ---------------- URL IMPORT ----------------
importURLBtn.onclick = () => {
  const url = urlInput.value.trim();
  if (!url) return alert("Please enter a URL");
  loadSet(url, "Custom Set");
};

/* ---------------- COLLECTION FILTER ---------------- */
collectionFilter.addEventListener("change", () => {
  renderCollection(collectionFilter.value || null);
});

/* ---------------- NAVIGATION ---------------- */
viewCollectionBtn.onclick = () => {
  lightboxEnabled = true;
  packDiv.innerHTML = "";
  openPackPage.classList.add("hidden");
  collectionPage.classList.remove("hidden");
  renderSetTabs();
  updateStatsDisplay();
  renderCollection(collectionFilter.value || null);
};
backToOpenPackBtn.onclick = () => {
  lightboxEnabled = false;
  packDiv.innerHTML = "";
  collectionPage.classList.add("hidden");
  openPackPage.classList.remove("hidden");
};
backToStartBtn.onclick = () => {
  packDiv.innerHTML = ""; // Clear pack when going back
  openPackPage.classList.add("hidden");
  startScreen.classList.remove("hidden");
};
openPackBtn.onclick = () => {
  lightboxEnabled = false;
  openPack();
};

/* ---------------- RESET ---------------- */
resetBtn.onclick = () => {
  if (!confirm(`Erase all collection data for "${currentSetName}"?`)) return;
  localStorage.removeItem(getCollectionKey());
  localStorage.removeItem(getStatsKey());
  stats = { packsOpened: 0, totalCards: 0, rarities: {} };
  collection = {};
  updateStatsDisplay();
  renderCollection(collectionFilter.value || null);
};

/* ---------------- LIGHTBOX INITIALIZATION ---------------- */
if (typeof MetaLightbox !== 'undefined') {
  lightbox = new MetaLightbox({
    theme: 'dark',
    showMetadata: false,  // Hide metadata to make it smaller
    showNavigation: true,
    showCounter: false,  // Hide counter
    closeOnBackdropClick: true,
    closeOnEscape: true,
    overlayOpacity: 0.95,
    apiBaseUrl: null,
    apiEndpoint: null
  });
}

/* ---------------- CARD LIGHTBOX HANDLERS ---------------- */
function attachLightboxHandlers(cardElement, cardData, allCards, cardIndex) {
  if (!lightbox || !lightboxEnabled) return;

  cardElement.dataset.cardIndex = cardIndex;
  cardElement.style.cursor = 'pointer';

  cardElement.addEventListener('click', (e) => {
    e.stopPropagation();
    if (allCards && allCards.length > 0) {
      lightbox.open(allCards, cardIndex);
    } else {
      lightbox.open([cardData], 0);
    }
  });
}

/* ---------------- RECENT CARDS ---------------- */
function renderRecentCards() {
  if (!recentCardsDiv || !recentCards.length) return;
  recentCardsDiv.innerHTML = "";
  recentCardsDiv.style.display = "flex";
  recentCardsDiv.style.flexWrap = "wrap";
  recentCardsDiv.style.gap = "14px";
  recentCardsDiv.style.justifyContent = "center";

  recentCards.slice(0, 10).forEach((c, i) => {
    if (!c || !c.image) return;
    const div = document.createElement("div");
    div.className = `card rarity-${(c.rarity || 'Common').replace(/\s+/g, '-')} show`;
    div.innerHTML = `<img src="${c.image}" alt="${c.name || ''}" onerror="this.src='cardback.png'">`;
    recentCardsDiv.appendChild(div);
    attachLightboxHandlers(div, c, recentCards.slice(0, 10), i);
  });
}

if (toggleRecentCardsBtn) {
  toggleRecentCardsBtn.onclick = () => {
    if (recentCardsDiv.classList.contains("hidden")) {
      recentCardsDiv.classList.remove("hidden");
      renderRecentCards();
      toggleRecentCardsBtn.textContent = "Hide Recent Cards";
    } else {
      recentCardsDiv.classList.add("hidden");
      toggleRecentCardsBtn.textContent = "Show Recent Cards";
    }
  };
}

/* ---------------- INITIAL ---------------- */
startScreen.classList.remove("hidden");
openPackPage.classList.add("hidden");
collectionPage.classList.add("hidden");
updateStatsDisplay();
renderCollection();
