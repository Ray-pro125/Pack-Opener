let cards = [];
let availableRarities = {};
let currentSetName = ""; // Tracks the currently active set

const AUTO_REVEAL_RARITIES = ["Common", "Uncommon", "Rare"];
const SPECIAL_GLOW_RARITIES = [
  "Double Rare",
  "Ultra Rare",
  "Illustration Rare",
  "Special Illustration Rare",
  "Hyper Rare"
];

// Set-specific state variables
let stats = { packsOpened: 0, totalCards: 0, rarities: {} };
let collection = {};
let recentCards = [];

let lightbox = null;
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

// Inject / Handle Set Selector Dropdown in Collection Page
let collectionSetSelect = document.getElementById("collectionSetSelect");
if (!collectionSetSelect) {
  const filterParent = collectionFilter ? collectionFilter.parentElement : collectionPage;
  collectionSetSelect = document.createElement("select");
  collectionSetSelect.id = "collectionSetSelect";
  if (filterParent) {
    filterParent.insertBefore(collectionSetSelect, collectionFilter);
  }
}

collectionSetSelect.addEventListener("change", (e) => {
  if (e.target.value) {
    setActiveSet(e.target.value);
  }
});

/* ---------------- SET STORAGE MANAGEMENT ---------------- */

// Load set-specific data from localStorage
function loadSetStorage(setName) {
  if (!setName) return;
  
  // Track set in list of known sets
  let knownSets = JSON.parse(localStorage.getItem("knownSets")) || [];
  if (!knownSets.includes(setName)) {
    knownSets.push(setName);
    localStorage.setItem("knownSets", JSON.stringify(knownSets));
  }
  updateSetDropdown();

  stats = JSON.parse(localStorage.getItem(`packStats_${setName}`)) || { packsOpened: 0, totalCards: 0, rarities: {} };
  collection = JSON.parse(localStorage.getItem(`collection_${setName}`)) || {};
  recentCards = JSON.parse(localStorage.getItem(`recentCards_${setName}`)) || [];
}

function saveStats() { 
  if (currentSetName) localStorage.setItem(`packStats_${currentSetName}`, JSON.stringify(stats)); 
}

function saveCollection() { 
  if (currentSetName) localStorage.setItem(`collection_${currentSetName}`, JSON.stringify(collection)); 
}

function saveRecentCards() {
  if (currentSetName) localStorage.setItem(`recentCards_${currentSetName}`, JSON.stringify(recentCards));
}

// Populate the collection set dropdown
function updateSetDropdown() {
  const knownSets = JSON.parse(localStorage.getItem("knownSets")) || [];
  collectionSetSelect.innerHTML = "";
  
  knownSets.forEach(setName => {
    const opt = document.createElement("option");
    opt.value = setName;
    opt.textContent = setName;
    if (setName === currentSetName) opt.selected = true;
    collectionSetSelect.appendChild(opt);
  });
}

function setActiveSet(setName) {
  currentSetName = setName;
  loadSetStorage(setName);
  updateStatsDisplay();
  renderCollection(collectionFilter ? collectionFilter.value : null);
  if (recentCardsDiv && !recentCardsDiv.classList.contains("hidden")) {
    renderRecentCards();
  }
}

/* ---------------- STATS & COLLECTION ---------------- */

function updateStatsDisplay() {
  let html = `<h3>Set: ${currentSetName || "None"}</h3>
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

function renderCollection(filterRarity = null) {
  collectionDiv.innerHTML = "";
  let arr = Object.values(collection);
  if (filterRarity) arr = arr.filter(c => c.rarity === filterRarity);

  arr.sort((a, b) => {
    const ma = a.number.match(/^(\d+)([a-z]?)$/i) || [0, "0", ""];
    const mb = b.number.match(/^(\d+)([a-z]?)$/i) || [0, "0", ""];
    const na = parseInt(ma[1]), nb = parseInt(mb[1]);
    const la = ma[2] || '', lb = mb[2] || '';
    if (na !== nb) return na - nb;
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
  });

  arr.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g, '-')} show`;
    div.innerHTML = `<img src="${c.image}" onerror="this.src='cardback.png'"><div>${c.name} ×${c.count}</div>`;
    collectionDiv.appendChild(div);
    attachLightboxHandlers(div, c, arr, i);
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

function processSetData(jsonData, setName) {
  cards = jsonData.data || [];
  
  // Infer set name if not explicitly given
  const resolvedSetName = setName || jsonData.name || "Custom Set";
  setActiveSet(resolvedSetName);

  buildAvailableRarities();
  loadingDiv.style.display = "none";
  openPackBtn.disabled = false;
  packDiv.innerHTML = ""; 
  firstPackOpened = false; 
  if (openPackCenter) openPackCenter.classList.remove("hidden");
  if (openPackBtn.parentElement !== openPackCenter && openPackCenter) {
    openPackCenter.appendChild(openPackBtn);
  }
  startScreen.classList.add("hidden");
  openPackPage.classList.remove("hidden");
}

function loadSet(fileOrJSON, setNameHint = null) {
  loadingDiv.style.display = "block";
  if (typeof fileOrJSON === "string") {
    const trimmed = fileOrJSON.trim();
    const isJsonString = trimmed.startsWith('{') || trimmed.startsWith('[');
    
    if (isJsonString) {
      try {
        const j = JSON.parse(fileOrJSON);
        processSetData(j, setNameHint);
      } catch { 
        loadingDiv.style.display = "none";
        alert("Invalid JSON"); 
      }
    } else {
      // derive set name from path if not provided
      const inferredName = setNameHint || fileOrJSON.split('/').pop().replace('.json', '');
      const isLocalPath = fileOrJSON.startsWith('sets/') || fileOrJSON.startsWith('./') || (!fileOrJSON.startsWith('http://') && !fileOrJSON.startsWith('https://') && !fileOrJSON.startsWith('//'));
      const fetchFn = (!isLocalPath && typeof URLResolver !== 'undefined' && URLResolver.importJson) 
        ? (url) => URLResolver.importJson(url)
        : (url) => fetch(url).then(r => r.json());

      fetchFn(fileOrJSON).then(j => {
        processSetData(j, inferredName);
      }).catch(err => {
        loadingDiv.style.display = "none";
        alert(`Failed to load set: ${err.message || err}`);
      });
    }
  } else {
    try {
      const j = JSON.parse(fileOrJSON);
      processSetData(j, setNameHint);
    } catch { alert("Invalid JSON"); }
  }
}

/* ---------------- HELPERS ---------------- */
function randomFrom(arr) { if (!arr || !arr.length) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function getByRarity(r) { return availableRarities[r] || []; }
function weightedRoll(table) { const f = table.filter(e => getByRarity(e.rarity).length); if (!f.length) return null; let total = f.reduce((s, e) => s + e.weight, 0), roll = Math.random() * total; for (let e of f) { if (roll < e.weight) return e.rarity; roll -= e.weight; } return f[f.length - 1].rarity; }

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
      if (roll < e.weight) {
        selectedRarity = e.rarity;
        break;
      }
      roll -= e.weight;
    }
    if (!selectedRarity) selectedRarity = filteredTable[filteredTable.length - 1].rarity;
    
    const available = filterUnpulled(getByRarity(selectedRarity));
    return available.length > 0 ? randomFrom(available) : randomFrom(filterUnpulled(cards));
  };
  
  // Pull cards
  for (let i = 0; i < 4; i++) {
    const card = pullUnique("Common");
    if (card) { pulls.push(card); pulledKeys.add(getCardKey(card)); }
  }
  for (let i = 0; i < 3; i++) {
    const card = pullUnique("Uncommon");
    if (card) { pulls.push(card); pulledKeys.add(getCardKey(card)); }
  }
  
  const card8 = pullWeightedUnique([{ rarity:"Common", weight:55},{ rarity:"Uncommon", weight:32},{ rarity:"Rare", weight:11},{ rarity:"Illustration Rare", weight:1.5},{ rarity:"Special Illustration Rare", weight:0.4},{ rarity:"Hyper Rare", weight:0.1}]);
  if (card8) { pulls.push(card8); pulledKeys.add(getCardKey(card8)); }
  
  const card9 = pullWeightedUnique([{ rarity:"Common", weight:35},{ rarity:"Uncommon", weight:43},{ rarity:"Rare", weight:18},{ rarity:"Illustration Rare", weight:12},{ rarity:"Special Illustration Rare", weight:2.3},{ rarity:"Hyper Rare", weight:0.7}]);
  if (card9) { pulls.push(card9); pulledKeys.add(getCardKey(card9)); }
  
  const card10 = pullWeightedUnique([{ rarity:"Rare", weight:11},{ rarity:"Double Rare", weight:3},{ rarity:"Ultra Rare", weight:1}]);
  if (card10) { pulls.push(card10); pulledKeys.add(getCardKey(card10)); }

  stats.packsOpened++;
  stats.totalCards += pulls.length;
  pulls.forEach(c => stats.rarities[c.rarity] = (stats.rarities[c.rarity] || 0) + 1);
  pulls.forEach(c => { 
    const key = `${c.name}_${c.number}`; 
    if (!collection[key]) collection[key] = { ...c, count: 0 }; 
    collection[key].count++; 
    
    recentCards.unshift({...c, timestamp: Date.now()});
    if (recentCards.length > 20) recentCards.pop();
  });

  saveRecentCards();
  saveCollection();
  renderCollection(collectionFilter ? collectionFilter.value : null);
  saveStats();
  updateStatsDisplay();

  // Render pack pulls
  pulls.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g, '-')}`;

    const isLastThree = i >= pulls.length - 3;
    const autoReveal = AUTO_REVEAL_RARITIES.includes(c.rarity);

    if (!isLastThree || autoReveal) {
      const img = document.createElement("img");
      img.src = c.image;
      img.alt = c.name;
      div.appendChild(img);
    } else {
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

initStartScreen();

/* ---------------- IMPORT ---------------- */
if (importSetBtn) importSetBtn.onclick = () => jsonInput.click();
if (jsonInput) {
  jsonInput.onchange = (e) => {
    const f = jsonInput.files[0];
    if (!f || !f.name.endsWith(".json")) return alert("Please select a JSON file");
    const setName = f.name.replace(".json", "");
    const r = new FileReader();
    r.onload = ev => { loadSet(ev.target.result, setName); };
    r.readAsText(f);
  };
}

if (importURLBtn) {
  importURLBtn.onclick = () => {
    const url = urlInput.value.trim();
    if (!url) return alert("Please enter a URL");
    const inferredName = url.split('/').pop().replace('.json', '') || "Imported Set";
    loadSet(url, inferredName);
  };
}

/* ---------------- COLLECTION FILTER ---------------- */
if (collectionFilter) {
  collectionFilter.addEventListener("change", () => {
    renderCollection(collectionFilter.value || null);
  });
}

/* ---------------- NAVIGATION ---------------- */
if (viewCollectionBtn) {
  viewCollectionBtn.onclick = () => { 
    lightboxEnabled = true;
    packDiv.innerHTML = "";
    openPackPage.classList.add("hidden"); 
    collectionPage.classList.remove("hidden"); 
    updateSetDropdown();
  };
}

if (backToOpenPackBtn) {
  backToOpenPackBtn.onclick = () => {
    lightboxEnabled = false;
    packDiv.innerHTML = "";
    collectionPage.classList.add("hidden"); 
    openPackPage.classList.remove("hidden"); 
  };
}

if (backToStartBtn) {
  backToStartBtn.onclick = () => { 
    packDiv.innerHTML = ""; 
    openPackPage.classList.add("hidden"); 
    startScreen.classList.remove("hidden"); 
  };
}

if (openPackBtn) {
  openPackBtn.onclick = () => {
    lightboxEnabled = false;
    openPack();
  };
}

/* ---------------- RESET CURRENT SET DATA ---------------- */
if (resetBtn) {
  resetBtn.onclick = () => {
    if (!currentSetName) return;
    if (!confirm(`Erase data for set: "${currentSetName}"?`)) return;
    
    localStorage.removeItem(`packStats_${currentSetName}`);
    localStorage.removeItem(`collection_${currentSetName}`);
    localStorage.removeItem(`recentCards_${currentSetName}`);
    
    stats = { packsOpened: 0, totalCards: 0, rarities: {} };
    collection = {};
    recentCards = [];
    
    updateStatsDisplay();
    renderCollection();
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

/* ---------------- INITIALIZE PAGE ---------------- */
startScreen.classList.remove("hidden");
openPackPage.classList.add("hidden");
collectionPage.classList.add("hidden");
