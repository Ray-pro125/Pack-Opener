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

function getMaxSetNumber() {
  if (!cards || !cards.length) return 0;
  let max = 0;
  cards.forEach(c => {
    const numStr = String(c.number || "");
    const match = numStr.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > max) max = num;
    }
  });
  return max;
}

// Recalculates grid columns whenever a landscape card loads
function updatePackSlotCount() {
  const pack = document.getElementById("pack");
  if (!pack) return;
  const totalCards = pack.children.length;
  const horizontalCount = pack.querySelectorAll(".card.horizontal").length;
  
  // Total slots = (Base card count) + (1 extra slot per horizontal card)
  const totalSlots = totalCards + horizontalCount;
  pack.style.setProperty("--pack-slots", totalSlots || 5);
}

// Pre-detects if a card image is horizontal and adds .horizontal to the card div
function applyCardOrientation(cardData, cardDiv) {
  if (!cardData || !cardData.image) return;
  const img = new Image();
  img.src = cardData.image;
  img.onload = () => {
    if (img.naturalWidth > img.naturalHeight) {
      cardDiv.classList.add("horizontal");
      updatePackSlotCount();
    }
  };
}

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
    
    applyCardOrientation(c, div);

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
  if (loadingDiv) loadingDiv.style.display = "block";

  const onSetLoaded = (data, nameFromData) => {
    cards = Array.isArray(data) ? data : (data ? data.data || [] : []);
    buildAvailableRarities();

    currentSetName = explicitSetName || nameFromData || "Custom Set";
    localStorage.setItem("activeSetName", currentSetName);
    if (currentSetDisplay) currentSetDisplay.textContent = currentSetName;

    loadCollectionAndStats();
    updateStatsDisplay();
    renderCollection(collectionFilter ? collectionFilter.value : null);
    renderSetTabs();

    if (loadingDiv) loadingDiv.style.display = "none";
    openPackBtn.disabled = false;
    packDiv.innerHTML = "";
    firstPackOpened = false;
    if (openPackCenter) openPackCenter.classList.remove("hidden");
    if (openPackBtn.parentElement !== openPackCenter && openPackCenter) {
      openPackCenter.appendChild(openPackBtn);
    }
    showScreen(openPackPage);
  };

  if (typeof fileOrJSON === "string") {
    const trimmed = fileOrJSON.trim();
    const isJsonString = trimmed.startsWith('{') || trimmed.startsWith('[');

    if (isJsonString) {
      try {
        const j = JSON.parse(fileOrJSON);
        onSetLoaded(j.data || j, j.name);
      } catch {
        if (loadingDiv) loadingDiv.style.display = "none";
        alert("Invalid JSON");
      }
    } else {
      const isLocalPath = fileOrJSON.startsWith('sets/') || fileOrJSON.startsWith('./') || (!fileOrJSON.startsWith('http://') && !fileOrJSON.startsWith('https://') && !fileOrJSON.startsWith('//'));
      const fetchFn = (!isLocalPath && typeof URLResolver !== 'undefined' && URLResolver.importJson)
        ? (url) => URLResolver.importJson(url)
        : (url) => fetch(url).then(r => r.json());

      fetchFn(fileOrJSON).then(j => {
        const inferredName = explicitSetName || fileOrJSON.replace(/^sets\//, '').replace(/\.json$/, '');
        onSetLoaded(j.data || j, j.name || inferredName);
      }).catch(err => {
        if (loadingDiv) loadingDiv.style.display = "none";
        alert(`Failed to load set: ${err.message || err}`);
      });
    }
  } else {
    try {
      onSetLoaded(fileOrJSON.data || fileOrJSON, fileOrJSON.name);
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
  
  packDiv.innerHTML = "";

  if (!firstPackOpened) {
    firstPackOpened = true;
    const controls = document.getElementById("controls");
    if (controls && openPackCenter) {
      openPackCenter.classList.add("hidden");
      controls.insertBefore(openPackBtn, controls.firstChild);
    }
  }

  const pulls = [];
  const pulledKeys = new Set();

  const getCardKey = (c) => c ? `${c.name}_${c.number}` : null;
  const filterUnpulled = (arr) => arr ? arr.filter(c => {
    const key = getCardKey(c);
    return key && !pulledKeys.has(key);
  }) : [];

  const pullUnique = (rarity) => {
    const available = filterUnpulled(getByRarity(rarity));
    if (available.length === 0) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }
    return randomFrom(available);
  };

  const pullWeightedUnique = (table) => {
    const filteredTable = table.filter(e => filterUnpulled(getByRarity(e.rarity)).length > 0);
    if (!filteredTable.length) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }

    let total = filteredTable.reduce((s, e) => s + e.weight, 0);
    if (total === 0) {
      const fallback = filterUnpulled(cards);
      return fallback.length > 0 ? randomFrom(fallback) : null;
    }

    let roll = Math.random() * total;
    let selectedRarity = null;
    for (let e of filteredTable) {
      if (roll < e.weight) { selectedRarity = e.rarity; break; }
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

  const maxSetNum = getMaxSetNumber();
  const is5CardPack = maxSetNum <= 60;

  if (is5CardPack) {
    for (let i = 0; i < 2; i++) {
      const c = pullUnique("Common");
      if (c) { pulls.push(c); pulledKeys.add(getCardKey(c)); }
    }
    const c3 = pullUnique("Uncommon");
    if (c3) { pulls.push(c3); pulledKeys.add(getCardKey(c3)); }
    
    const c4 = pullWeightedUnique([
      { rarity: "Rare", weight: 21 },
      { rarity: "Uncommon", weight: 63 },
      { rarity: "Common", weight: 42 },
      { rarity: "Illustration Rare", weight: 7 },
      { rarity: "Special Illustration Rare", weight: 2 },
      { rarity: "Hyper Rare", weight: 1 }
    ]);
    if (c4) { pulls.push(c4); pulledKeys.add(getCardKey(c4)); }

    const c5 = pullWeightedUnique([
      { rarity: "Rare", weight: 58 },
      { rarity: "Double Rare", weight: 12 },
      { rarity: "Ultra Rare", weight: 5 }
    ]);
    if (c5) { pulls.push(c5); pulledKeys.add(getCardKey(c5)); }

  } else {
    for (let i = 0; i < 4; i++) {
      const c = pullUnique("Common");
      if (c) { pulls.push(c); pulledKeys.add(getCardKey(c)); }
    }
    for (let i = 0; i < 3; i++) {
      const c = pullUnique("Uncommon");
      if (c) { pulls.push(c); pulledKeys.add(getCardKey(c)); }
    }

    const card8 = pullWeightedUnique([
      { rarity: "Rare", weight: 21 },
      { rarity: "Uncommon", weight: 63 },
      { rarity: "Common", weight: 42 },
      { rarity: "Illustration Rare", weight: 7 },
      { rarity: "Special Illustration Rare", weight: 2 },
      { rarity: "Hyper Rare", weight: 1 }
    ]);
    if (card8) { pulls.push(card8); pulledKeys.add(getCardKey(card8)); }

    const card9 = pullWeightedUnique([
      { rarity: "Rare", weight: 63 },
      { rarity: "Uncommon", weight: 42 },
      { rarity: "Common", weight: 21 },
      { rarity: "Illustration Rare", weight: 7 },
      { rarity: "Special Illustration Rare", weight: 2 },
      { rarity: "Hyper Rare", weight: 1 }
    ]);
    if (card9) { pulls.push(card9); pulledKeys.add(getCardKey(card9)); }

    const card10 = pullWeightedUnique([
      { rarity: "Rare", weight: 58 },
      { rarity: "Double Rare", weight: 12 },
      { rarity: "Ultra Rare", weight: 5 }
    ]);
    if (card10) { pulls.push(card10); pulledKeys.add(getCardKey(card10)); }
  }

  stats.packsOpened++;
  stats.totalCards += pulls.length;
  pulls.forEach(c => stats.rarities[c.rarity] = (stats.rarities[c.rarity] || 0) + 1);
  pulls.forEach(c => {
    const key = `${c.name}_${c.number}`;
    if (!collection[key]) collection[key] = { ...c, count: 0 };
    collection[key].count++;
    recentCards.unshift({ ...c, timestamp: Date.now() });
    if (recentCards.length > 20) recentCards.pop();
  });

  localStorage.setItem("recentCards", JSON.stringify(recentCards));
  saveCollection();
  renderCollection(collectionFilter ? collectionFilter.value : null);
  saveStats();
  updateStatsDisplay();

  pulls.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g, '-')}`;

    applyCardOrientation(c, div);

    const isLastThree = i >= pulls.length - 3;
    const autoReveal = AUTO_REVEAL_RARITIES.includes(c.rarity);

    if (!isLastThree || autoReveal) {
      const img = document.createElement("img");
      img.src = c.image;
      img.alt = c.name;
      div.appendChild(img);
    } else {
      div.dataset.revealed = "false";

      const img = document.createElement("img");
      img.src = "cardback.png";
      img.alt = "Hidden Card";
      div.appendChild(img);

      if (i === pulls.length - 3 || i === pulls.length - 2) {
        div.classList.add("glow-mystery-slots-8-9");
      } else if (i === pulls.length - 1) {
        div.classList.add("glow-mystery-slot-10");
      }

      div.addEventListener("click", () => {
        if (div.dataset.revealed === "true") return;

        img.src = c.image;
        img.alt = c.name;
        div.dataset.revealed = "true";
        div.classList.remove("glow-mystery-slots-8-9", "glow-mystery-slot-10");
        div.classList.add("revealed");
      }, { once: true });
    }

    packDiv.appendChild(div);
    setTimeout(() => div.classList.add("show"), i * 350);
    attachLightboxHandlers(div, c, pulls, i);
  });
}

/* ---------------- START SCREEN ---------------- */
function initStartScreen() {
  if (!availableSetsDiv) return;
  availableSetsDiv.innerHTML = "";
  ["Z-Genesis Melemele", "Z-Genesis Akala"].forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s;
    btn.onclick = () => loadSet(`sets/${s}.json`, s);
    availableSetsDiv.appendChild(btn);
  });
}

/* ---------------- IMPORT ---------------- */
if (importSetBtn && jsonInput) {
  importSetBtn.onclick = () => jsonInput.click();
  jsonInput.onchange = () => {
    const f = jsonInput.files[0];
    if (!f || !f.name.endsWith(".json")) return alert("Please select a JSON file");
    const r = new FileReader();
    r.onload = ev => { loadSet(ev.target.result, f.name.replace(".json", "")); };
    r.readAsText(f);
  };
}

if (importURLBtn && urlInput) {
  importURLBtn.onclick = () => {
    const url = urlInput.value.trim();
    if (!url) return alert("Please enter a URL");
    loadSet(url, "Custom Set");
  };
}

/* ---------------- COLLECTION FILTER ---------------- */
if (collectionFilter) {
  collectionFilter.addEventListener("change", () => {
    renderCollection(collectionFilter.value || null);
  });
}

/* ---------------- SCREEN HELPER ---------------- */
function showScreen(screenToShow) {
  startScreen.classList.add("hidden");
  openPackPage.classList.add("hidden");
  collectionPage.classList.add("hidden");
  screenToShow.classList.remove("hidden");
}

/* ---------------- NAVIGATION ---------------- */
if (viewCollectionBtn) {
  viewCollectionBtn.onclick = () => {
    lightboxEnabled = true;
    packDiv.innerHTML = "";
    showScreen(collectionPage);
    renderSetTabs();
    updateStatsDisplay();
    renderCollection(collectionFilter ? collectionFilter.value : null);
  };
}

if (backToOpenPackBtn) {
  backToOpenPackBtn.onclick = () => {
    lightboxEnabled = false;
    packDiv.innerHTML = "";
    showScreen(openPackPage);
  };
}

if (backToStartBtn) {
  backToStartBtn.onclick = () => {
    packDiv.innerHTML = "";
    showScreen(startScreen);
  };
}

if (openPackBtn) {
  openPackBtn.onclick = () => {
    lightboxEnabled = false;
    openPack();
  };
}

/* ---------------- RESET ---------------- */
if (resetBtn) {
  resetBtn.onclick = () => {
    if (!confirm(`Erase all collection data for "${currentSetName}"?`)) return;
    localStorage.removeItem(getCollectionKey());
    localStorage.removeItem(getStatsKey());
    stats = { packsOpened: 0, totalCards: 0, rarities: {} };
    collection = {};
    updateStatsDisplay();
    renderCollection(collectionFilter ? collectionFilter.value : null);
  };
}

/* ---------------- LIGHTBOX INITIALIZATION ---------------- */
if (typeof MetaLightbox !== 'undefined') {
  lightbox = new MetaLightbox({
    theme: 'dark',
    showMetadata: false,
    showNavigation: true,
    showCounter: false,
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

/* ---------------- INITIAL BOOT ---------------- */
initStartScreen();
showScreen(startScreen);
