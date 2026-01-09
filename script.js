let cards = [], availableRarities = {};
let stats = JSON.parse(localStorage.getItem("packStats")) || { packsOpened:0,totalCards:0,rarities:{} };
let collection = JSON.parse(localStorage.getItem("collection")) || {};

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

const availableSetsDiv = document.getElementById("availableSets");
const importSetBtn = document.getElementById("importSet");
const jsonInput = document.getElementById("jsonInput");

/* URL import elements (only used if they exist) */
const importSetUrlBtn = document.getElementById("importSetUrl");
const setUrlInput = document.getElementById("setUrlInput");
const setUrlWrapper = document.getElementById("setUrlWrapper");

const collectionFilter = document.getElementById("collectionFilter");

/* ---------------- VALIDATION ---------------- */
function validateSetJSON(j){
  if (!j || typeof j !== "object") return "Root is not an object";
  if (!Array.isArray(j.data)) return 'Missing or invalid "data" array';

  for (let i = 0; i < j.data.length; i++) {
    const c = j.data[i];
    if (!c.name) return `Card ${i} missing name`;
    if (!c.number) return `Card ${i} missing number`;
    if (!c.rarity) return `Card ${i} missing rarity`;
    if (!c.image) return `Card ${i} missing image`;
  }
  return null;
}

/* ---------------- STATS & COLLECTION ---------------- */
function saveStats(){ localStorage.setItem("packStats",JSON.stringify(stats)); }
function saveCollection(){ localStorage.setItem("collection",JSON.stringify(collection)); }

function updateStatsDisplay(){
  let html=`<h3>Packs Opened: ${stats.packsOpened}</h3>
            <h3>Total cards: ${stats.totalCards}</h3><ul>`;
  ["Common","Uncommon","Rare","Double Rare","Illustration Rare","Ultra Rare","Special Illustration Rare","Hyper Rare"]
    .forEach(r=>html+=`<li>${r}: ${stats.rarities[r]||0}</li>`);
  html+="</ul>";
  statsDiv.innerHTML=html;

  // ---------- Progress Bar Calculation ----------
  // Regular set includes Common, Uncommon, Rare, Double Rare
  const regularRarities = ["Common","Uncommon","Rare","Double Rare"];
  const regularMax = cards.filter(c => regularRarities.includes(c.rarity)).length;
  const regularCollected = Object.values(collection).filter(c => c.count > 0 && regularRarities.includes(c.rarity)).length;

  // Master set includes all rarities
  const masterMax = cards.length;
  const masterCollected = Object.values(collection).filter(c => c.count > 0).length;

  // Update the progress bars
  document.getElementById("regularProgress").value = (regularCollected / regularMax) * 100;
  document.getElementById("masterProgress").value = (masterCollected / masterMax) * 100;
}

function renderCollection(filterRarity=null){
  collectionDiv.innerHTML="";
  let arr = Object.values(collection);
  if(filterRarity) arr = arr.filter(c => c.rarity === filterRarity);

  arr.sort((a,b)=>{
    const ma=a.number.match(/^(\d+)([a-z]?)$/i);
    const mb=b.number.match(/^(\d+)([a-z]?)$/i);
    const na=parseInt(ma[1]), nb=parseInt(mb[1]);
    const la=ma[2]||'', lb=mb[2]||'';
    if(na!==nb) return na-nb;
    if(la<lb) return -1;
    if(la>lb) return 1;
    return 0;
  });

  arr.forEach(c=>{
    const div=document.createElement("div");
    div.className=`card rarity-${c.rarity.replace(/\s+/g,'-')} show`;
    div.innerHTML=`<img src="${c.image}"><div>${c.name} ×${c.count}</div>`;
    collectionDiv.appendChild(div);
  });
}

/* ---------------- LOAD SET ---------------- */
function buildAvailableRarities(){
  availableRarities={};
  cards.forEach(c=>{
    if(!availableRarities[c.rarity]) availableRarities[c.rarity]=[];
    availableRarities[c.rarity].push(c);
  });
}

function applySetJSON(j){
  const err = validateSetJSON(j);
  if (err) { alert("Invalid set:\n" + err); return; }

  cards = j.data;
  buildAvailableRarities();
  loadingDiv.style.display="none";
  openPackBtn.disabled=false;
  startScreen.classList.add("hidden");
  openPackPage.classList.remove("hidden");
}

function loadSet(fileOrJSON){
  loadingDiv.style.display="block";

  if (typeof fileOrJSON === "string" && fileOrJSON.trim().startsWith("{")) {
    try { applySetJSON(JSON.parse(fileOrJSON)); }
    catch { alert("Invalid JSON"); loadingDiv.style.display="none"; }
    return;
  }

  if (typeof fileOrJSON === "string") {
    fetch(fileOrJSON)
      .then(r=>r.json())
      .then(applySetJSON)
      .catch(()=>{ alert("Failed to load set"); loadingDiv.style.display="none"; });
  }
}

/* ---------------- HELPERS ---------------- */
function randomFrom(arr){ if(!arr||!arr.length) return null; return arr[Math.floor(Math.random()*arr.length)]; }
function getByRarity(r){ return availableRarities[r]||[]; }
function weightedRoll(table){ const f=table.filter(e=>getByRarity(e.rarity).length); if(!f.length) return null; let total=f.reduce((s,e)=>s+e.weight,0),roll=Math.random()*total; for(let e of f){ if(roll<e.weight) return e.rarity; roll-=e.weight;} return f[f.length-1].rarity; }
function pullWeighted(table){ const r=weightedRoll(table); return randomFrom(getByRarity(r))||randomFrom(cards); }

/* ---------------- OPEN PACK ---------------- */
function openPack() {
  if (!cards.length) { alert("Set not loaded"); return; }
  packDiv.innerHTML = "";

  const pulls = [];

  // Pull cards
  for (let i = 0; i < 4; i++) pulls.push(randomFrom(getByRarity("Common")) || randomFrom(cards));
  for (let i = 0; i < 3; i++) pulls.push(randomFrom(getByRarity("Uncommon")) || randomFrom(cards));
  pulls.push(pullWeighted([{ rarity:"Common", weight:55},{ rarity:"Uncommon", weight:32},{ rarity:"Rare", weight:11},{ rarity:"Illustration Rare", weight:1.5},{ rarity:"Special Illustration Rare", weight:0.4},{ rarity:"Hyper Rare", weight:0.1}]));
  pulls.push(pullWeighted([{ rarity:"Common", weight:35},{ rarity:"Uncommon", weight:43},{ rarity:"Rare", weight:18},{ rarity:"Illustration Rare", weight:12},{ rarity:"Special Illustration Rare", weight:2.3},{ rarity:"Hyper Rare", weight:0.7}]));
  pulls.push(pullWeighted([{ rarity:"Rare", weight:11},{ rarity:"Double Rare", weight:3},{ rarity:"Ultra Rare", weight:1}]));

  stats.packsOpened++;
  stats.totalCards += pulls.length;
  pulls.forEach(c => stats.rarities[c.rarity] = (stats.rarities[c.rarity] || 0) + 1);
  pulls.forEach(c => { 
    const key = `${c.name}_${c.number}`; 
    if (!collection[key]) collection[key] = { ...c, count: 0 }; 
    collection[key].count++; 
  });

  saveCollection();
  renderCollection(collectionFilter.value || null);
  saveStats();
  updateStatsDisplay();

  /* -------- Reveal Cards -------- */
  const normalCardsCount = pulls.length - 3;

  pulls.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g,'-')}`;
    div.innerHTML = `<img src="${c.image}" alt="${c.name}">`;
    packDiv.appendChild(div);

    if (i < normalCardsCount) {
      // First cards: normal reveal
      setTimeout(() => div.classList.add("show"), i * 350);
    } else {
      // Last 3 cards: hidden, glow, click-to-reveal
      div.classList.add("last-three-hidden");
      div.querySelector("img").style.visibility = "hidden";

      // Stagger glow for anticipation
      setTimeout(() => {
        div.classList.add("glow");
      }, (i - normalCardsCount) * 800); // each card glows in sequence

      // Click to fully reveal
      div.addEventListener("click", function reveal() {
        div.classList.add("show");
        div.classList.remove("last-three-hidden", "glow");
        div.querySelector("img").style.visibility = "visible";
        div.removeEventListener("click", reveal);
      });
    }
  });
}

/* ---------------- START SCREEN ---------------- */
function initStartScreen() {
  ["Z-Genesis_Melemele","Soaring_Titans"].forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s;
    btn.onclick = () => loadSet(`sets/${s}.json`);
    availableSetsDiv.appendChild(btn);
  });
}

// Run once on page load
initStartScreen();

/* ---------------- IMPORT ---------------- */
importSetBtn.onclick=()=>jsonInput.click();
jsonInput.onchange=(e)=>{
  const f=jsonInput.files[0];
  if(!f||!f.name.endsWith(".json")) return alert("Please select a JSON file");
  const r=new FileReader();
  r.onload=ev=>{ loadSet(ev.target.result); };
  r.readAsText(f);
};

/* URL IMPORT (only if elements exist) */
if (importSetUrlBtn && setUrlInput && setUrlWrapper) {
  importSetUrlBtn.onclick = async () => {

    // First click: reveal input
    if (setUrlWrapper.style.display === "none") {
      setUrlWrapper.style.display = "block";
      setUrlInput.focus();
      return;
    }

    // Second click: attempt import
    const url = setUrlInput.value.trim();
    if (!url) return alert("Enter a URL");

    try {
      const r = await fetch(url);
      const j = await r.json();
      applySetJSON(j);
    } catch {
      alert("Failed to load set from URL");
    }
  };
}

/* ---------------- COLLECTION FILTER ---------------- */
collectionFilter.addEventListener("change", ()=>{
  renderCollection(collectionFilter.value||null);
});

/* ---------------- NAVIGATION ---------------- */
viewCollectionBtn.onclick=()=>{ openPackPage.classList.add("hidden"); collectionPage.classList.remove("hidden"); };
backToOpenPackBtn.onclick=()=>{ collectionPage.classList.add("hidden"); openPackPage.classList.remove("hidden"); };
backToStartBtn.onclick=()=>{ openPackPage.classList.add("hidden"); startScreen.classList.remove("hidden"); };
openPackBtn.onclick=openPack;

/* ---------------- RESET ---------------- */
resetBtn.onclick=()=>{
  if(!confirm("Erase all data?")) return;
  localStorage.removeItem("packStats");
  localStorage.removeItem("collection");
  stats={packsOpened:0,totalCards:0,rarities:{}};
  collection={};
  updateStatsDisplay();
  renderCollection();
};

/* ---------------- INITIAL ---------------- */
startScreen.classList.remove("hidden");
openPackPage.classList.add("hidden");
collectionPage.classList.add("hidden");
updateStatsDisplay();
renderCollection();

