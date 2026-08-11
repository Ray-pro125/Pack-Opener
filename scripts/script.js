// State Variables
let currentSetName = "";
let currentSetData = null; // Holds the cards definition for currentSetName
let recentCardsList = [];

// DOM Elements
const startScreen = document.getElementById("startScreen");
const openPackPage = document.getElementById("openPackPage");
const collectionPage = document.getElementById("collectionPage");

const availableSetsDiv = document.getElementById("availableSets");
const importSetBtn = document.getElementById("importSet");
const jsonInput = document.getElementById("jsonInput");
const setURLInput = document.getElementById("setURL");
const importURLSetBtn = document.getElementById("importURLSet");

const openPackBtn = document.getElementById("openPack");
const packDiv = document.getElementById("pack");
const viewCollectionBtn = document.getElementById("viewCollection");
const resetDataBtn = document.getElementById("resetData");
const backToStartBtn = document.getElementById("backToStart");

const backToOpenPackBtn = document.getElementById("backToOpenPack");
const collectionFilter = document.getElementById("collectionFilter");
const collectionDiv = document.getElementById("collection");
const statsDiv = document.getElementById("stats");
const currentSetDisplay = document.getElementById("currentSetDisplay");

const regularProgress = document.getElementById("regularProgress");
const masterProgress = document.getElementById("masterProgress");
const toggleRecentCardsBtn = document.getElementById("toggleRecentCards");
const recentCardsDiv = document.getElementById("recentCards");

// Pre-defined Z-Genesis Sets
const PRESET_SETS = [
  { name: "Z1 Genesis", url: "https://master.meta-ptcg.org/sets/z1.json" },
  { name: "Z2 Genesis", url: "https://master.meta-ptcg.org/sets/z2.json" },
  { name: "Z3 Genesis", url: "https://master.meta-ptcg.org/sets/z3.json" },
  { name: "Z4 Genesis", url: "https://master.meta-ptcg.org/sets/z4.json" },
  { name: "Z5 Genesis", url: "https://master.meta-ptcg.org/sets/z5.json" },
  { name: "Z6 Genesis", url: "https://master.meta-ptcg.org/sets/z6.json" }
];

/* ---------- INITIALIZATION ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderAvailableSets();
  setupEventListeners();

  // Restore active set if available from previous session
  const savedActiveSet = localStorage.getItem("activeSetName");
  if (savedActiveSet && getSetData(savedActiveSet)) {
    activateSet(savedActiveSet);
  }
});

function setupEventListeners() {
  importSetBtn.onclick = () => jsonInput.click();
  jsonInput.onchange = handleJSONImport;
  importURLSetBtn.onclick = handleURLImport;

  openPackBtn.onclick = openPack;
  viewCollectionBtn.onclick = showCollectionPage;
  backToStartBtn.onclick = showStartScreen;
  backToOpenPackBtn.onclick = showOpenPackPage;

  resetDataBtn.onclick = resetCurrentSetData;
  collectionFilter.onchange = () => renderCollection(collectionFilter.value);

  toggleRecentCardsBtn.onclick = () => {
    recentCardsDiv.classList.toggle("hidden");
    toggleRecentCardsBtn.textContent = recentCardsDiv.classList.contains("hidden") 
      ? "Show Recent Cards" 
      : "Hide Recent Cards";
  };
}

/* ---------- SET MANAGEMENT & CACHING ---------- */
function saveSetData(setName, data) {
  try {
    localStorage.setItem(`setData_${setName}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Storage quota exceeded caching set data", e);
  }
}

function getSetData(setName) {
  const cached = localStorage.getItem(`setData_${setName}`);
  return cached ? JSON.parse(cached) : null;
}

function getKnownSets() {
  const sets = new Set();
  
  // Always include Preset Sets
  PRESET_SETS.forEach(set => sets.add(set.name));

  // Include user imported / local storage sets
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("collection_")) {
      sets.add(key.replace("collection_", ""));
    } else if (key.startsWith("setData_")) {
      sets.add(key.replace("setData_", ""));
    }
  }
  return Array.from(sets);
}

// Synchronizes active set between Opening Packs & Collection views
function activateSet(setName, setDataObj = null) {
  if (setDataObj) {
    saveSetData(setName, setDataObj);
    currentSetData = setDataObj;
  } else {
    currentSetData = getSetData(setName);
  }

  currentSetName = setName;
  localStorage.setItem("activeSetName", setName);
  if (currentSetDisplay) currentSetDisplay.textContent = setName;
}

/* ---------- START SCREEN & LOADING ---------- */
function renderAvailableSets() {
  availableSetsDiv.innerHTML = "";

  // Render Preset Z-Genesis buttons
  PRESET_SETS.forEach(set => {
    const btn = document.createElement("button");
    btn.textContent = set.name;
    btn.onclick = () => fetchAndLoadSet(set.name, set.url);
    availableSetsDiv.appendChild(btn);
  });

  // Render buttons for additional custom imported sets stored in localStorage
  const knownSets = getKnownSets().filter(name => !PRESET_SETS.some(p => p.name === name));
  knownSets.forEach(setName => {
    const btn = document.createElement("button");
    btn.textContent = setName;
    btn.onclick = () => {
      activateSet(setName);
      showOpenPackPage();
    };
    availableSetsDiv.appendChild(btn);
  });
}

async function fetchAndLoadSet(name, url) {
  try {
    // If we already have the set cached in localStorage, load it instantly
    const cachedData = getSetData(name);
    if (cachedData) {
      activateSet(name, cachedData);
      showOpenPackPage();
      return;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch set JSON.");
    const data = await response.json();
    const setDisplayName = data.name || name;
    activateSet(setDisplayName, data);
    renderAvailableSets();
    showOpenPackPage();
  } catch (err) {
    alert(`Error loading set: ${err.message}`);
  }
}

function handleJSONImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const setName = data.name || file.name.replace(".json", "");
      activateSet(setName, data);
      renderAvailableSets();
      showOpenPackPage();
    } catch (err) {
      alert("Invalid JSON set file.");
    }
  };
  reader.readAsText(file);
}

function handleURLImport() {
  const url = setURLInput.value.trim();
  if (!url) return alert("Please enter a JSON URL.");
  const setName = "Custom Set";
  fetchAndLoadSet(setName, url);
}

/* ---------- OPEN PACK ---------- */
function openPack() {
  if (!currentSetData || !currentSetData.cards || !currentSetData.cards.length) {
    alert("No card pool loaded for this set!");
    return;
  }

  const cards = currentSetData.cards;
  const packCards = getRandomPackCards(cards);

  // Update localStorage for current active set
  const collectionKey = `collection_${currentSetName}`;
  const statsKey = `packStats_${currentSetName}`;

  let userCol = JSON.parse(localStorage.getItem(collectionKey) || "{}");
  let userStats = JSON.parse(localStorage.getItem(statsKey) || '{"packsOpened":0}');

  userStats.packsOpened = (userStats.packsOpened || 0) + 1;

  packCards.forEach(card => {
    userCol[card.id] = (userCol[card.id] || 0) + 1;
  });

  localStorage.setItem(collectionKey, JSON.stringify(userCol));
  localStorage.setItem(statsKey, JSON.stringify(userStats));

  // Render Pack UI
  renderPackUI(packCards);
  recentCardsList.unshift(...packCards);
  recentCardsList = recentCardsList.slice(0, 20); // Keep last 20 cards
}

function getRandomPackCards(cardPool) {
  const pack = [];
  const byRarity = {};

  cardPool.forEach(card => {
    const r = card.rarity || "Common";
    if (!byRarity[r]) byRarity[r] = [];
    byRarity[r].push(card);
  });

  const getCard = (rarity) => {
    const pool = byRarity[rarity] || byRarity["Common"] || cardPool;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // 6 Commons, 3 Uncommons, 1 Rare+
  for (let i = 0; i < 6; i++) pack.push(getCard("Common"));
  for (let i = 0; i < 3; i++) pack.push(getCard("Uncommon"));

  // Rare slot pull probabilities
  const roll = Math.random();
  if (roll < 0.02 && byRarity["Hyper Rare"]) pack.push(getCard("Hyper Rare"));
  else if (roll < 0.06 && byRarity["Special Illustration Rare"]) pack.push(getCard("Special Illustration Rare"));
  else if (roll < 0.12 && byRarity["Ultra Rare"]) pack.push(getCard("Ultra Rare"));
  else if (roll < 0.20 && byRarity["Illustration Rare"]) pack.push(getCard("Illustration Rare"));
  else if (roll < 0.35 && byRarity["Double Rare"]) pack.push(getCard("Double Rare"));
  else pack.push(getCard("Rare"));

  return pack;
}

function renderPackUI(cards) {
  packDiv.innerHTML = "";
  cards.forEach((card, index) => {
    const cardEl = createCardElement(card);
    packDiv.appendChild(cardEl);
    setTimeout(() => cardEl.classList.add("show"), index * 80);
  });
}

function createCardElement(card, count = null) {
  const div = document.createElement("div");
  const rarityClass = `rarity-${(card.rarity || "Common").replace(/\s+/g, "-")}`;
  div.className = `card ${rarityClass}`;

  const img = document.createElement("img");
  img.src = card.image || card.images?.small || "";
  img.alt = card.name;
  img.loading = "lazy";

  const info = document.createElement("div");
  info.textContent = `${card.name} ${count !== null ? `(x${count})` : ""}`;

  div.appendChild(img);
  div.appendChild(info);
  return div;
}

/* ---------- COLLECTION & TABS ---------- */
function showCollectionPage() {
  startScreen.classList.add("hidden");
  openPackPage.classList.add("hidden");
  collectionPage.classList.remove("hidden");

  renderSetTabs();
  updateStatsDisplay();
  renderCollection(collectionFilter.value);
  renderRecentCards();
}

function renderSetTabs() {
  const container = document.getElementById("collectionSetTabs");
  if (!container) return;
  container.innerHTML = "";

  const knownSets = getKnownSets();
  if (!knownSets.length) {
    container.innerHTML = "<p><em>No set collections stored yet. Open a pack to get started!</em></p>";
    return;
  }

  knownSets.forEach(setName => {
    const btn = document.createElement("button");
    btn.textContent = setName;

    if (setName === currentSetName) {
      btn.classList.add("active-set");
    }

    btn.onclick = async () => {
      // Check if it's a preset set that hasn't been fetched yet
      const preset = PRESET_SETS.find(p => p.name === setName);
      if (preset && !getSetData(setName)) {
        await fetchAndLoadSet(preset.name, preset.url);
      } else {
        activateSet(setName);
      }

      renderSetTabs();
      updateStatsDisplay();
      renderCollection(collectionFilter.value);
    };

    container.appendChild(btn);
  });
}

function renderCollection(filterRarity = "") {
  collectionDiv.innerHTML = "";
  if (!currentSetData || !currentSetData.cards) return;

  const userCol = JSON.parse(localStorage.getItem(`collection_${currentSetName}`) || "{}");

  currentSetData.cards.forEach(card => {
    if (filterRarity && card.rarity !== filterRarity) return;

    const count = userCol[card.id] || 0;
    const cardEl = createCardElement(card, count);

    if (count === 0) {
      cardEl.style.filter = "grayscale(100%) opacity(0.4)";
    }

    collectionDiv.appendChild(cardEl);
    setTimeout(() => cardEl.classList.add("show"), 20);
  });
}

function updateStatsDisplay() {
  if (!currentSetData || !currentSetData.cards) {
    statsDiv.innerHTML = "<p>No set data loaded.</p>";
    return;
  }

  const userCol = JSON.parse(localStorage.getItem(`collection_${currentSetName}`) || "{}");
  const userStats = JSON.parse(localStorage.getItem(`packStats_${currentSetName}`) || '{"packsOpened":0}');

  const totalCardsInSet = currentSetData.cards.length;
  const uniqueCollected = Object.keys(userCol).filter(id => userCol[id] > 0).length;
  const totalCardsCollected = Object.values(userCol).reduce((a, b) => a + b, 0);

  const regularCompletion = Math.min(100, Math.round((uniqueCollected / totalCardsInSet) * 100));
  const masterCompletion = Math.min(100, Math.round((uniqueCollected / totalCardsInSet) * 100));

  regularProgress.value = regularCompletion;
  masterProgress.value = masterCompletion;

  statsDiv.innerHTML = `
    <strong>Set:</strong> ${currentSetName}<br>
    <strong>Packs Opened:</strong> ${userStats.packsOpened || 0}<br>
    <strong>Unique Cards:</strong> ${uniqueCollected} / ${totalCardsInSet}<br>
    <strong>Total Cards Collected:</strong> ${totalCardsCollected}
  `;
}

function renderRecentCards() {
  recentCardsDiv.innerHTML = "";
  recentCardsList.forEach(card => {
    const cardEl = createCardElement(card);
    recentCardsDiv.appendChild(cardEl);
    cardEl.classList.add("show");
  });
}

function resetCurrentSetData() {
  if (!currentSetName) return;
  if (confirm(`Are you sure you want to reset all collection data for "${currentSetName}"?`)) {
    localStorage.removeItem(`collection_${currentSetName}`);
    localStorage.removeItem(`packStats_${currentSetName}`);
    updateStatsDisplay();
    renderCollection();
    alert(`Data for ${currentSetName} has been reset.`);
  }
}

/* ---------- NAVIGATION ---------- */
function showStartScreen() {
  openPackPage.classList.add("hidden");
  collectionPage.classList.add("hidden");
  startScreen.classList.remove("hidden");
  renderAvailableSets();
}

function showOpenPackPage() {
  if (!currentSetName) {
    alert("Please select a set first!");
    return;
  }
  startScreen.classList.add("hidden");
  collectionPage.classList.add("hidden");
  openPackPage.classList.remove("hidden");
  if (currentSetDisplay) currentSetDisplay.textContent = currentSetName;
}
