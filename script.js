const gameData = [
  {id:"ml",name:"Mobile Legends",category:"Populer",type:"Mobile",emoji:"⚔️",bg:"linear-gradient(135deg,#183e73,#542c82)",tag:"POPULER",products:[{group:"Diamond",items:[["5 Diamonds",1500],["12 Diamonds",3500],["28 Diamonds",8000],["59 Diamonds",16000],["85 Diamonds",23000],["170 Diamonds",45000],["257 Diamonds",67000],["344 Diamonds",89000]]}]},
  {id:"ff",name:"Free Fire",category:"Populer",type:"Mobile",emoji:"🔥",bg:"linear-gradient(135deg,#8b321d,#e99b36)",tag:"POPULER",products:[{group:"Diamond",items:[["5 Diamonds",1000],["12 Diamonds",2000],["50 Diamonds",8000],["70 Diamonds",10000],["140 Diamonds",20000],["355 Diamonds",50000],["720 Diamonds",99000]]}]},
  {id:"wuwa",name:"Wuthering Waves",category:"Populer",type:"Mobile",emoji:"🌌",bg:"linear-gradient(135deg,#1a3152,#49306f)",tag:"CEPAT",userLabel:"User ID",server:true,products:[{group:"Membership",items:[["Lunite Subscription",78398]]},{group:"Umum",items:[["60 Lunites",15499],["300 Lunites + 30 Bonus",78398],["980 Lunites + 110 Bonus",238714],["1980 Lunites + 260 Bonus",477278],["3280 Lunites + 600 Bonus",791208],["6480 Lunites + 1600 Bonus",1556432]]}]},
  {id:"genshin",name:"Genshin Impact",category:"Populer",type:"Mobile",emoji:"✨",bg:"linear-gradient(135deg,#346e8c,#4d427d)",tag:"POPULER",server:true,products:[{group:"Blessing & Genesis Crystals",items:[["Blessing of the Welkin Moon",78398],["60 Genesis Crystals",15499],["300 + 30 Genesis Crystals",78398],["980 + 110 Genesis Crystals",238714],["1980 + 260 Genesis Crystals",477278]]}]},
  {id:"valorant",name:"Valorant",category:"Populer",type:"PC",emoji:"🎯",bg:"linear-gradient(135deg,#842b46,#3b193d)",tag:"PC",products:[{group:"Valorant Points",items:[["125 VP",18000],["420 VP",55000],["700 VP",90000],["1375 VP",170000],["2400 VP",290000]]}]},
  {id:"steam",name:"Steam Wallet (IDR)",category:"PC",type:"PC",emoji:"🎮",bg:"linear-gradient(135deg,#254d68,#17202d)",tag:"WALLET",products:[{group:"Steam Wallet",items:[["Rp 12.000",12000],["Rp 45.000",45000],["Rp 90.000",90000],["Rp 120.000",120000]]}]},
  {id:"sus",name:"Super Sus",category:"Populer",type:"Mobile",emoji:"🚀",bg:"linear-gradient(135deg,#b36a1f,#47377d)",tag:"MOBILE",products:[{group:"Gold",items:[["60 Gold",15000],["300 Gold",70000],["600 Gold",135000]]}]},
  {id:"haikyuu",name:"Haikyuu Fly High",category:"Mobile",type:"Mobile",emoji:"🏐",bg:"linear-gradient(135deg,#b36a23,#3b5882)",tag:"MOBILE",products:[{group:"Item",items:[["Paket kecil",15000],["Paket sedang",50000],["Paket besar",100000]]}]},
  {id:"heartopia",name:"Heartopia",category:"Mobile",type:"Mobile",emoji:"🌷",bg:"linear-gradient(135deg,#a8558e,#416e9c)",tag:"MOBILE",products:[{group:"Paket",items:[["Paket kecil",15000],["Paket sedang",50000],["Paket besar",100000]]}]},
  {id:"hok",name:"Honor of Kings",category:"Mobile",type:"Mobile",emoji:"🛡️",bg:"linear-gradient(135deg,#2c6590,#c18a3e)",tag:"MOBILE",products:[{group:"Token",items:[["16 Tokens",5000],["80 Tokens",20000],["240 Tokens",60000],["400 Tokens",100000]]}]},
  {id:"vidio",name:"Vidio",category:"PC",type:"PC",emoji:"▶️",bg:"linear-gradient(135deg,#d31855,#771c51)",tag:"VOUCHER",products:[{group:"Langganan",items:[["Vidio paket 1 bulan",39900],["Vidio paket 3 bulan",109000]]}]},
  {id:"viu",name:"Viu",category:"PC",type:"PC",emoji:"▶",bg:"linear-gradient(135deg,#e8a51c,#bd5c18)",tag:"VOUCHER",products:[{group:"Langganan",items:[["Viu Premium 1 bulan",33000],["Viu Premium 3 bulan",99000]]}]}
];
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n).replace(/\u00a0/g," ");
let activeCategory="Semua", selectedGame=null, selectedProduct=null, selectedPayment="", discount=0, orderText="";
const gameGrid=document.getElementById("gameGrid"), productGroups=document.getElementById("productGroups");
const topupSection=document.getElementById("topupSection"), gamesSection=document.getElementById("games");
document.getElementById("year").textContent=new Date().getFullYear();

function renderGames(){
 const q=document.getElementById("gameSearch").value.trim().toLowerCase();
 const filtered=gameData.filter(g=>(activeCategory==="Semua"||(activeCategory==="Populer"?g.category==="Populer":g.type===activeCategory))&&g.name.toLowerCase().includes(q));
 gameGrid.innerHTML="";
 if(!filtered.length){gameGrid.innerHTML='<div class="empty-state">Game tidak ditemukan. Coba kata kunci lain.</div>';return}
 filtered.forEach(g=>{
  const card=document.createElement("button");card.className="game-card";card.type="button";
  card.innerHTML=`<div class="game-art" style="--gamebg:${g.bg}"><span class="game-tag">${g.tag||g.type.toUpperCase()}</span><span class="game-emoji">${g.emoji}</span></div><div class="game-info"><h3>${g.name}</h3><p>${g.type==="PC"?"PC & voucher digital":"Top up game mobile"}</p><div class="game-bottom"><span>Lihat nominal</span><span class="arrow-circle">↗</span></div></div>`;
  card.addEventListener("click",()=>selectGame(g.id));gameGrid.appendChild(card);
 });
}
function selectGame(id){
 selectedGame=gameData.find(g=>g.id===id);selectedProduct=null;selectedPayment="";discount=0;
 document.getElementById("selectedGameName").textContent=selectedGame.name;
 document.getElementById("summaryGame").textContent=selectedGame.name;
 document.getElementById("summaryIcon").textContent=selectedGame.emoji;
 document.getElementById("userIdField").querySelector("label").innerHTML=`${selectedGame.userLabel||"User ID"} <em>*</em>`;
 document.getElementById("serverIdField").hidden=!selectedGame.server;
 document.getElementById("serverId").required=!!selectedGame.server;
 document.getElementById("serverId").placeholder=selectedGame.server?"Masukkan Server ID":"Tidak diperlukan untuk game ini";
 document.getElementById("userId").placeholder=selectedGame.type==="PC"?"Masukkan ID akun / email jika diperlukan":"Masukkan User ID";
 document.getElementById("voucher").value="";document.getElementById("voucherMessage").textContent="Demo: kode voucher belum terhubung ke sistem promo asli.";
 document.getElementById("discountLine").hidden=true;
 renderProducts();updateSummary();
 gamesSection.hidden=true;topupSection.hidden=false;topupSection.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderProducts(){
 productGroups.innerHTML="";
 selectedGame.products.forEach((group,gi)=>{
  const wrap=document.createElement("div");wrap.className="product-group";
  const title=document.createElement("h4");title.textContent=group.group;wrap.appendChild(title);
  const grid=document.createElement("div");grid.className="product-grid";
  group.items.forEach((item,ii)=>{
   const btn=document.createElement("button");btn.type="button";btn.className="product-option";
   btn.dataset.key=`${gi}-${ii}`;
   btn.innerHTML=`<span class="product-name">${item[0]}</span><span class="product-price">${rupiah(item[1])}</span>`;
   btn.addEventListener("click",()=>{
    selectedProduct={name:item[0],price:item[1],key:`${gi}-${ii}`};
    productGroups.querySelectorAll(".product-option").forEach(el=>el.classList.toggle("selected",el.dataset.key===selectedProduct.key));
    discount=0;document.getElementById("discountLine").hidden=true;updateSummary();
   });
   grid.appendChild(btn);
  });
  wrap.appendChild(grid);productGroups.appendChild(wrap);
 });
}
function updateSummary(){
 const price=selectedProduct?selectedProduct.price:0,fee=selectedProduct?0:0,total=Math.max(0,price+fee-discount);
 document.getElementById("summaryProduct").textContent=selectedProduct?selectedProduct.name:"Pilih nominal terlebih dahulu";
 document.getElementById("summaryPrice").textContent=rupiah(price);
 document.getElementById("serviceFee").textContent=rupiah(fee);
 document.getElementById("summaryTotal").textContent=rupiah(total);
 document.getElementById("discountValue").textContent="−"+rupiah(discount);
}
document.getElementById("categoryRow").addEventListener("click",e=>{
 const btn=e.target.closest("[data-category]");if(!btn)return;
 activeCategory=btn.dataset.category;document.querySelectorAll(".category").forEach(b=>b.classList.toggle("active",b===btn));renderGames();
});
document.getElementById("gameSearch").addEventListener("input",renderGames);
document.getElementById("searchToggle").addEventListener("click",()=>{
 const box=document.getElementById("searchBox");box.scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("gameSearch").focus();
});
document.getElementById("menuToggle").addEventListener("click",()=>{
 const choice=prompt("Menu FauzzStore\nKetik: game untuk daftar game, atau akun untuk informasi akun demo.");
 if(choice&&choice.toLowerCase()==="game"){topupSection.hidden=true;gamesSection.hidden=false;gamesSection.scrollIntoView({behavior:"smooth"});}
 else if(choice&&choice.toLowerCase()==="akun"){showToast("Fitur akun memerlukan sistem register/login dan database.");}
});
document.getElementById("backToGames").addEventListener("click",()=>{topupSection.hidden=true;gamesSection.hidden=false;gamesSection.scrollIntoView({behavior:"smooth"});});
document.getElementById("paymentGrid").addEventListener("click",e=>{
 const btn=e.target.closest("[data-payment]");if(!btn)return;selectedPayment=btn.dataset.payment;
 document.querySelectorAll(".payment-option").forEach(b=>b.classList.toggle("selected",b===btn));
});
document.getElementById("applyVoucher").addEventListener("click",()=>{
 const v=document.getElementById("voucher").value.trim().toUpperCase(),msg=document.getElementById("voucherMessage");
 if(!v){msg.textContent="Masukkan kode voucher terlebih dahulu.";return}
 if(v==="FAUZZ10"&&selectedProduct){discount=Math.min(Math.round(selectedProduct.price*.1),20000);msg.textContent="Kode demo FAUZZ10 diterapkan: diskon 10% (maksimal Rp20.000).";document.getElementById("discountLine").hidden=false;updateSummary();}
 else{discount=0;document.getElementById("discountLine").hidden=true;updateSummary();msg.textContent="Kode tidak valid untuk demo. Coba FAUZZ10 setelah memilih nominal.";}
});
function showToast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),2600);}
document.getElementById("createOrder").addEventListener("click",()=>{
 if(!selectedGame){showToast("Pilih game terlebih dahulu.");return}
 if(!selectedProduct){showToast("Pilih nominal terlebih dahulu.");productGroups.scrollIntoView({behavior:"smooth",block:"center"});return}
 const phone=document.getElementById("phone").value.replace(/[^\d]/g,""),userId=document.getElementById("userId").value.trim(),serverId=document.getElementById("serverId").value.trim(),nickname=document.getElementById("nickname").value.trim();
 if(phone.length<9||phone.length>15){showToast("Masukkan nomor WhatsApp yang valid.");document.getElementById("phone").focus();return}
 if(!userId){showToast("Isi User ID terlebih dahulu.");document.getElementById("userId").focus();return}
 if(selectedGame.server&&!serverId){showToast("Isi Server ID untuk game ini.");document.getElementById("serverId").focus();return}
 if(!selectedPayment){showToast("Pilih metode pembayaran.");document.getElementById("paymentGrid").scrollIntoView({behavior:"smooth",block:"center"});return}
 const total=Math.max(0,selectedProduct.price-discount);
 const details=[
  ["Game",selectedGame.name],["Nominal",selectedProduct.name],["User ID",userId],...(selectedGame.server?[["Server ID",serverId]]:[]),["Nickname",nickname||"—"],["WhatsApp","+62 "+phone],["Pembayaran",selectedPayment],["Harga",rupiah(selectedProduct.price)],["Diskon",discount?rupiah(discount):rupiah(0)],["TOTAL",rupiah(total)]
 ];
 orderText="FAUZZSTORE — PRATINJAU PESANAN\n"+details.map(x=>x[0]+": "+x[1]).join("\n")+"\n\nIni hanya pratinjau demo; belum ada pembayaran.";
 document.getElementById("orderDetails").innerHTML=details.map(([k,v],i)=>`<div class="order-detail-row"><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join("");
 document.getElementById("orderModal").hidden=false;
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
document.getElementById("closeModal").addEventListener("click",()=>document.getElementById("orderModal").hidden=true);
document.getElementById("orderModal").addEventListener("click",e=>{if(e.target.id==="orderModal")e.currentTarget.hidden=true;});
document.getElementById("copyOrder").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(orderText);showToast("Detail pesanan berhasil disalin.");}
 catch(e){const ta=document.createElement("textarea");ta.value=orderText;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();showToast("Detail pesanan disalin.");}
});
renderGames();
