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

const collectionFilter = document.getElementById("collectionFilter");

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
  cards.forEach(c=>{ if(!availableRarities[c.rarity]) availableRarities[c.rarity]=[]; availableRarities[c.rarity].push(c); });
}

function loadSet(fileOrJSON){
  loadingDiv.style.display="block";
  if(typeof fileOrJSON==="string"){
    fetch(fileOrJSON).then(r=>r.json()).then(j=>{
      cards=j.data;
      buildAvailableRarities();
      loadingDiv.style.display="none";
      openPackBtn.disabled=false;
      startScreen.classList.add("hidden");
      openPackPage.classList.remove("hidden");
    });
  } else {
    try{
      const j=JSON.parse(fileOrJSON);
      cards=j.data;
      buildAvailableRarities();
      loadingDiv.style.display="none";
      openPackBtn.disabled=false;
      startScreen.classList.add("hidden");
      openPackPage.classList.remove("hidden");
    }catch{ alert("Invalid JSON"); }
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

  /* ------- 3 Last Cards -------- */
  pulls.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = `card rarity-${c.rarity.replace(/\s+/g, '-')}`;
    div.innerHTML = `<img src="${c.image}" alt="${c.name}">`;

    if (i < pulls.length - 3) {
      // First 7 cards: normal reveal
      setTimeout(() => div.classList.add("show"), i * 350);
      packDiv.appendChild(div);
    } else {
      // Last 3 cards: add after first 7 cards
      setTimeout(() => {
        packDiv.appendChild(div);
        // Glow and click-to-reveal appear 1s after first 7
        setTimeout(() => {
          div.classList.add("last-three-hidden"); // start glow
          div.querySelector("img").style.visibility = "hidden";

          void div.offsetWidth; // force reflow for animation

          div.addEventListener("click", function reveal() {
            div.classList.add("show");
            div.classList.remove("last-three-hidden");
            div.querySelector("img").style.visibility = "visible";
            div.removeEventListener("click", reveal);
          });
        }, 1000); // glow delay
      }, (pulls.length - 3) * 350); // placement after first 7
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
