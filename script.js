let cards=[], availableRarities={}, collection=JSON.parse(localStorage.getItem("collection"))||{};
let stats=JSON.parse(localStorage.getItem("packStats"))||{packsOpened:0,totalCards:0,rarities:{}};

const regularRarities=["Common","Uncommon","Rare","Double Rare"];
const masterRarities=["Common","Uncommon","Rare","Double Rare","Illustration Rare","Ultra Rare","Special Illustration Rare","Hyper Rare"];

const startScreen=document.getElementById("start-screen");
const openPackPage=document.getElementById("openPackPage");
const collectionStatsPage=document.getElementById("collectionStatsPage");
const packDiv=document.getElementById("pack");
const collectionDiv=document.getElementById("collection");
const filterSelect=document.getElementById("rarityFilter");
const loading=document.getElementById("loading");

/* LOAD SETS LIST */
const setSelector=document.getElementById("setSelector");
const loadSetBtn=document.getElementById("loadSetBtn");

fetch("sets/index.json").then(r=>r.json()).then(data=>{
  setSelector.innerHTML="";
  data.forEach(f=>{const opt=document.createElement("option"); opt.value=f; opt.textContent=f.replace(".json",""); setSelector.appendChild(opt);});
});

loadSetBtn.onclick=()=>loadSet(`sets/${setSelector.value}`);
document.getElementById("importSet").onclick=()=>document.getElementById("fileInput").click();
document.getElementById("fileInput").addEventListener("change",e=>{
  const reader=new FileReader();
  reader.onload=ev=>initSet(JSON.parse(ev.target.result).data);
  reader.readAsText(e.target.files[0]);
});

function loadSet(path){
  loading.style.display="block";
  fetch(path).then(r=>r.json()).then(j=>initSet(j.data)).catch(()=>alert("Failed to load set."));
}

function initSet(data){
  cards=data;
  availableRarities={};
  cards.forEach(c=>{if(!availableRarities[c.rarity]) availableRarities[c.rarity]=[]; availableRarities[c.rarity].push(c);});
  buildFilter();
  startScreen.classList.add("hidden");
  openPackPage.classList.remove("hidden");
  document.getElementById("openPack").disabled=false;
  renderCollection(); updateStats(); updateCompletion();
  loading.style.display="none";
}

/* HELPERS */
function randomFrom(arr){if(!arr||!arr.length)return null; return arr[Math.floor(Math.random()*arr.length)];}
function saveCollection(){localStorage.setItem("collection",JSON.stringify(collection));}
function saveStats(){localStorage.setItem("packStats",JSON.stringify(stats));}
function pullWeighted(table){const valid=table.filter(e=>availableRarities[e.rarity]?.length); if(!valid.length)return randomFrom(cards); const total=valid.reduce((s,e)=>s+e.weight,0); let roll=Math.random()*total; for(let e of valid){if(roll<e.weight)return randomFrom(availableRarities[e.rarity]); roll-=e.weight;} return randomFrom(cards);}

/* OPEN PACK */
document.getElementById("openPack").onclick=()=>{
  packDiv.innerHTML="";
  const pulls=[];
  for(let i=0;i<4;i++) pulls.push(randomFrom(availableRarities["Common"]||cards));
  for(let i=0;i<3;i++) pulls.push(randomFrom(availableRarities["Uncommon"]||cards));
  pulls.push(pullWeighted([{rarity:"Common",weight:55},{rarity:"Uncommon",weight:32},{rarity:"Rare",weight:11},{rarity:"Illustration Rare",weight:1.5},{rarity:"Special Illustration Rare",weight:0.4},{rarity:"Hyper Rare",weight:0.1}]));
  pulls.push(pullWeighted([{rarity:"Common",weight:35},{rarity:"Uncommon",weight:43},{rarity:"Rare",weight:18},{rarity:"Illustration Rare",weight:12},{rarity:"Special Illustration Rare",weight:2.3},{rarity:"Hyper Rare",weight:0.7}]));
  pulls.push(pullWeighted([{rarity:"Rare",weight:11},{rarity:"Double Rare",weight:3},{rarity:"Ultra Rare",weight:1}]));

  stats.packsOpened++; stats.totalCards+=pulls.length;
  pulls.forEach(c=>{stats.rarities[c.rarity]=(stats.rarities[c.rarity]||0)+1; const k=c.name+"_"+c.number; if(!collection[k])collection[k]={...c,count:0}; collection[k].count++;});

  saveCollection(); saveStats();
  renderPack(pulls); renderCollection(); updateStats(); updateCompletion();
};

/* RENDER PACK */
function renderPack(pulls){pulls.forEach((c,i)=>{const cls=c.rarity.replace(/\s+/g,"-"); const div=document.createElement("div"); div.className=`card rarity-${cls}`; div.innerHTML=`<img src="${c.image}">`; packDiv.appendChild(div); setTimeout(()=>div.classList.add("show"),i*250);});}

/* COLLECTION */
function renderCollection(){
  const filter=filterSelect.value||"All";
  const arr=Object.values(collection).filter(c=>filter==="All"||c.rarity===filter)
  .sort((a,b)=>{const mA=a.number.match(/^(\d+)([a-z]?)$/i);const mB=b.number.match(/^(\d+)([a-z]?)$/i);const nA=parseInt(mA[1]),nB=parseInt(mB[1]);const lA=mA[2]||"",lB=mB[2]||""; if(nA!==nB)return nA-nB; if(lA<lB)return -1; if(lA>lB)return 1; return 0;});
  collectionDiv.innerHTML=""; arr.forEach(c=>{const cls=c.rarity.replace(/\s+/g,"-"); const div=document.createElement("div"); div.className=`card rarity-${cls} show`; div.innerHTML=`<img src="${c.image}"><div>${c.name} ×${c.count}</div>`; collectionDiv.appendChild(div);});
}

/* FILTER */
function buildFilter(){filterSelect.innerHTML=`<option value="All">All</option>`; Object.keys(availableRarities).forEach(r=>{const opt=document.createElement("option"); opt.value=r; opt.textContent=r; filterSelect.appendChild(opt);});}
filterSelect.onchange=renderCollection;

/* STATS */
function updateStats(){const s=document.getElementById("stats"); let html=`<h3>Packs Opened: ${stats.packsOpened}</h3><h3>Total Cards: ${stats.totalCards}</h3><ul>`; Object.entries(stats.rarities).forEach(([r,c])=>html+=`<li>${r}: ${c}</li>`); html+="</ul>"; s.innerHTML=html;}

/* COMPLETION */
function updateCompletion(){
  const uO=Object.keys(collection);
  const tR=cards.filter(c=>regularRarities.includes(c.rarity)).length;
  const oR=uO.filter(k=>regularRarities.includes(collection[k].rarity)).length;
  const rPct=Math.floor((oR/tR)*100);
  document.getElementById("regularLabel").textContent=`Regular: ${oR}/${tR} (${rPct}%)`;
  document.getElementById("regularBar").style.width=rPct+"%";
  const tM=cards.length; const oM=uO.length; const mPct=Math.floor((oM/tM)*100);
  const masterBox=document.getElementById("masterContainer"); masterBox.style.display=tM>0?"block":"none";
  document.getElementById("masterLabel").textContent=`Master: ${oM}/${tM} (${mPct}%)`;
  document.getElementById("masterBar").style.width=mPct+"%";
}

/* NAVIGATION */
document.getElementById("viewCollectionStats").onclick=()=>{openPackPage.classList.add("hidden"); collectionStatsPage.classList.remove("hidden"); renderCollection(); updateStats(); updateCompletion();};
document.getElementById("backToOpenPack").onclick=()=>{collectionStatsPage.classList.add("hidden"); openPackPage.classList.remove("hidden");};
document.getElementById("backToStart").onclick=()=>{openPackPage.classList.add("hidden"); startScreen.classList.remove("hidden");};

/* RESET */
document.getElementById("resetData").onclick=()=>{
  if(!confirm("Reset all data?")) return;
  localStorage.clear(); stats={packsOpened:0,totalCards:0,rarities:{}}; collection={};
  renderCollection(); updateStats(); updateCompletion();
};
