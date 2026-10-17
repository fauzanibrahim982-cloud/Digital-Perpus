(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = { favorites: "dp_favorites_v1", ratings: "dp_ratings_v1", profile: "dp_profile_v1", accounts: "dp_accounts_v1", session: "dp_session_v1", welcome: "dp_welcome_seen_v1" };
  const sampleBooks = [
    {id:"sample-1",title:"Langit di Ujung Senja",author:"Nara Pradipta",category:"Novel",description:"Sebuah kisah tentang harapan, persahabatan, dan keberanian memulai lagi setelah kehilangan arah.",symbol:"🌅",cover:1,rating:4.8,ratingCount:128,sample:true},
    {id:"sample-2",title:"Jejak Peradaban Nusantara",author:"Aditya Wibowo",category:"Sejarah",description:"Menelusuri kerajaan, budaya, dan perjalanan panjang yang membentuk sejarah kepulauan Indonesia.",symbol:"🏛️",cover:2,rating:4.6,ratingCount:94,sample:true},
    {id:"sample-3",title:"Belajar Coding dari Nol",author:"Raka Mahendra",category:"Teknologi",description:"Panduan pengantar pemrograman untuk pemula, mulai dari logika sampai membuat proyek pertamamu.",symbol:"💻",cover:3,rating:4.9,ratingCount:213,sample:true},
    {id:"sample-4",title:"Kebun Kecil Penuh Mimpi",author:"Alya Kirana",category:"Pengembangan Diri",description:"Catatan ringan tentang kebiasaan kecil, ketekunan, dan cara merawat mimpi setiap hari.",symbol:"🌿",cover:4,rating:4.7,ratingCount:76,sample:true},
    {id:"sample-5",title:"Atlas Bintang untuk Pemula",author:"Dimas Angkasa",category:"Pendidikan",description:"Kenali planet, bintang, dan benda langit melalui penjelasan sederhana untuk pembaca muda.",symbol:"🌌",cover:5,rating:4.8,ratingCount:153,sample:true},
    {id:"sample-6",title:"Misteri Rumah di Bukit",author:"Bima Santoso",category:"Novel",description:"Petualangan penuh teka-teki yang mengajak pembaca menyusun petunjuk dan menemukan rahasia.",symbol:"🏡",cover:6,rating:4.5,ratingCount:61,sample:true}
  ];
  const welcomeSlides = [
    {label:"SELAMAT DATANG · 1 DARI 4",title:"Welcome Digital Perpus!",text:"Temukan bacaan baru, bagikan buku digital, dan bangun perpustakaanmu sendiri.",symbol:"📚"},
    {label:"LANGKAH 2 · 2 DARI 4",title:"Buat akun dengan mudah",text:"Buka menu Profil Saya, pilih Buat akun demo, lalu isi nama, email, dan kata sandi demo." ,symbol:"🙋"},
    {label:"LANGKAH 3 · 3 DARI 4",title:"Jelajahi dan baca buku",text:"Cari buku dari kolom pencarian, simpan dengan ikon hati, beri rating, dan pilih Baca Buku Ini. Login diperlukan untuk membaca.",symbol:"📖"},
    {label:"LANGKAH 4 · 4 DARI 4",title:"Bagikan buku berformat PDF",text:"Buka Upload Buku PDF, isi informasi buku, lalu pilih file PDF yang kamu punya izin untuk bagikan. Selamat membaca!",symbol:"📤"}
  ];
  const state = {
    books: [...sampleBooks], favorites: readJSON(STORAGE.favorites, []), ratings: readJSON(STORAGE.ratings, {}),
    profile: readJSON(STORAGE.profile, {name:"Pengunjung",avatar:"👤"}), accounts: readJSON(STORAGE.accounts, []),
    session: readJSON(STORAGE.session, null), currentBook: null, authMode:"register", welcomeIndex:0, search:"", toastTimer:null
  };
  function readJSON(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function persist(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast("Penyimpanan browser penuh. Coba hapus beberapa file PDF."); return false; } }
  function safeText(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
  function toast(message) { const el=$("#noticeToast"); el.textContent=message; el.classList.add("show"); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>el.classList.remove("show"),2600); }
  function getBook(id) { return state.books.find(book=>book.id===id); }
  function currentUser() { return state.session ? state.accounts.find(account=>account.email===state.session.email) || null : null; }
  function isLoggedIn() { return Boolean(currentUser()); }
  function ratingFor(book) { const values=state.ratings[book.id] || {}; const nums=Object.values(values).filter(Number.isFinite); if(!nums.length)return {rating:book.rating||0,count:book.ratingCount||0}; return {rating:nums.reduce((a,b)=>a+b,0)/nums.length,count:(book.ratingCount||0)+nums.length}; }
  function coverMarkup(book) { return `<div class="book-cover ${book.cover ? `cover-${book.cover}` : "cover-user"}"><span class="cover-symbol">${safeText(book.symbol||"📘")}</span><span class="cover-band">DIGITAL PERPUS</span></div>`; }
  function bookCard(book) {
    const rating=ratingFor(book), liked=state.favorites.includes(book.id), ownRating=state.ratings[book.id]?.[state.session?.email] || "";
    return `<article class="book-card"><div class="book-card-top">${coverMarkup(book)}<div class="book-details"><span class="book-category">${safeText(book.category||"Umum")}</span><h3 class="book-title">${safeText(book.title)}</h3><p class="book-author">oleh ${safeText(book.author)}</p><p class="book-description">${safeText(book.description||"Buku digital yang dibagikan ke koleksi.")}</p><div class="book-meta"><span class="rating-star">★</span><span class="rating-number">${rating.rating ? rating.rating.toFixed(1) : "Baru"}</span><span class="rating-count">(${rating.count})</span></div></div></div><div class="book-card-bottom"><button class="heart-btn ${liked?"liked":""}" data-favorite="${safeText(book.id)}" aria-label="${liked?"Hapus dari":"Tambah ke"} favorit" title="${liked?"Hapus dari favorit":"Tambah ke favorit"}">${liked?"♥":"♡"}</button><button class="btn btn-primary read-btn" data-read="${safeText(book.id)}">Baca Buku Ini</button><select class="rate-select" data-rate="${safeText(book.id)}" aria-label="Beri rating untuk ${safeText(book.title)}"><option value="">★ Rating</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${String(ownRating)===String(n)?"selected":""}>${"★".repeat(n)} ${n}/5</option>`).join("")}</select></div></article>`;
  }
  function renderGrid(target, books, emptyTarget) {
    const container=$(target); container.innerHTML=books.map(bookCard).join("");
    if(emptyTarget) $(emptyTarget).classList.toggle("hidden",books.length>0);
  }
  function allUserBooks() { return state.books.filter(book=>!book.sample); }
  function renderAll() {
    const query=state.search.trim().toLocaleLowerCase("id");
    renderGrid("#bookGrid",state.books.filter(b=>!query||`${b.title} ${b.author} ${b.category}`.toLocaleLowerCase("id").includes(query)),"#emptyHome");
    const matches=state.books.filter(b=>!query||`${b.title} ${b.author} ${b.category} ${b.description||""}`.toLocaleLowerCase("id").includes(query));
    renderGrid("#searchGrid",matches,"#emptySearch");
    $("#searchResultsLabel").textContent=`${matches.length} buku ditemukan`;
    const favs=state.books.filter(b=>state.favorites.includes(b.id));
    renderGrid("#favoritesGrid",favs,"#emptyFavorites");
    $("#favoriteCount").textContent=String(state.favorites.length);
    renderProfile();
  }
  function renderProfile() {
    const user=currentUser(), name=state.profile.name || user?.name || "Pengunjung";
    $("#headerAvatar").textContent=state.profile.avatar||"👤"; $("#profileAvatar").textContent=state.profile.avatar||"👤";
    $("#profileNameDisplay").textContent=name; $("#profileEmailDisplay").textContent=user?user.email:"Belum login · Mode demo";
    $("#profileName").value=name; $("#profileEmoji").value=state.profile.avatar||"👤";
    $("#profileBookCount").textContent=allUserBooks().filter(b=>user&&b.uploader===user.email).length;
    $("#profileFavoriteCount").textContent=state.favorites.length;
    $("#openRegister").classList.toggle("hidden",Boolean(user)); $("#openLogin").classList.toggle("hidden",Boolean(user)); $("#logoutBtn").classList.toggle("hidden",!user);
  }
  function goToPage(name) {
    const page=$(`#page-${name}`); if(!page)return;
    $$(".page").forEach(p=>p.classList.remove("active")); page.classList.add("active");
    $$("[data-nav]").forEach(btn=>btn.classList.toggle("active",btn.dataset.nav===name));
    if(name==="profile")renderProfile();
    if(name==="favorites")renderAll();
    if(name==="search"){ $("#pageSearch").value=state.search; renderAll(); }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function openWelcome() { $("#welcomeOverlay").classList.remove("dismissed"); state.welcomeIndex=0; renderWelcomeSlide(); }
  function closeWelcome() { $("#welcomeOverlay").classList.add("dismissed"); try{localStorage.setItem(STORAGE.welcome,"yes");}catch{} }
  function renderWelcomeSlide() {
    const slide=welcomeSlides[state.welcomeIndex]; $("#welcomeStep").textContent=slide.label; $("#welcomeTitle").textContent=slide.title; $("#welcomeText").textContent=slide.text; $(".art-book").textContent=slide.symbol;
    $$("#stepDots span").forEach((dot,i)=>dot.classList.toggle("active",i===state.welcomeIndex));
    $("#nextWelcome").innerHTML=state.welcomeIndex===welcomeSlides.length-1?"Mulai membaca <span>→</span>":"Berikutnya <span>→</span>";
    $("#skipWelcome").textContent=state.welcomeIndex===welcomeSlides.length-1?"Tutup":"Lewati panduan";
  }
  function openAuth(mode) {
    state.authMode=mode; $("#authModal").classList.remove("hidden"); $("#authTitle").textContent=mode==="register"?"Buat akun demo":"Login demo";
    $("#authDescription").textContent=mode==="register"?"Daftar untuk mencoba pengalaman membaca.":"Masuk dengan akun demo yang sudah kamu buat.";
    $("#authName").classList.toggle("hidden",mode!=="register"); $("#authName").required=mode==="register";
    $("#authSubmit").textContent=mode==="register"?"Buat akun":"Login"; $("#authMessage").textContent="";
    $("#switchAuth").textContent=mode==="register"?"Sudah punya akun? Login":"Belum punya akun? Daftar";
    $("#authPassword").value=""; $("#authEmail").value=""; $("#authName").value="";
  }
  function closeAuth() { $("#authModal").classList.add("hidden"); }
  function updateFavorite(id) {
    if(state.favorites.includes(id)) { state.favorites=state.favorites.filter(x=>x!==id); toast("Buku dihapus dari favorit."); }
    else { state.favorites.push(id); toast("Buku ditambahkan ke Favorite Books."); }
    persist(STORAGE.favorites,state.favorites); renderAll();
  }
  function rateBook(id,value) {
    if(!isLoggedIn()){toast("Login atau register dulu untuk memberi rating.");openAuth("register");renderAll();return;}
    if(!value)return;
    state.ratings[id]=state.ratings[id]||{}; state.ratings[id][state.session.email]=Number(value);
    persist(STORAGE.ratings,state.ratings); renderAll(); toast("Terima kasih! Rating demo tersimpan.");
  }
  function openReader(id) {
    const book=getBook(id); if(!book)return;
    if(!isLoggedIn()) { toast("Register terlebih dahulu ya!"); openAuth("register"); return; }
    state.currentBook=id; const target=$("#readerContent");
    const action=book.fileData?`<button class="btn btn-primary" id="downloadPdf">Unduh PDF</button>`:"";
    target.innerHTML=`<div class="reader-card"><div class="reader-head">${coverMarkup(book)}<div class="reader-copy"><span class="book-category">${safeText(book.category||"Umum")}</span><h1>${safeText(book.title)}</h1><p>oleh ${safeText(book.author)}</p><p>${safeText(book.description||"Buku digital dari koleksi komunitas.")}</p><div class="reader-actions"><button class="btn btn-outline" data-favorite="${safeText(book.id)}">${state.favorites.includes(book.id)?"♥ Tersimpan":"♡ Favorit"}</button>${action}</div></div></div><div id="readerBody"></div></div>`;
    const body=$("#readerBody");
    if(book.fileData) { body.innerHTML=`<iframe class="pdf-frame" title="Pembaca PDF: ${safeText(book.title)}"></iframe>`; const blobURL=URL.createObjectURL(dataURLtoBlob(book.fileData)); $("iframe",body).src=blobURL; $("#downloadPdf").addEventListener("click",()=>{const a=document.createElement("a");a.href=blobURL;a.download=`${book.title.replace(/[^a-z0-9-_ ]/gi,"").trim()||"buku"}.pdf`;a.click();}); }
    else { body.innerHTML=`<div class="sample-reader"><h2>${safeText(book.title)}</h2><div class="sample-sub">Contoh tampilan pembaca · konten demonstrasi</div><p>Selamat datang di halaman baca Digital Perpus. Buku ini adalah contoh katalog untuk memperlihatkan cara kerja antarmuka membaca.</p><p>Dalam versi demo ini, sampul dan informasi buku contoh tidak menyertakan naskah lengkap. Untuk membaca isi PDF sungguhan, unggah file PDF melalui menu Upload Buku PDF.</p><p>Semoga pengalaman membaca membuatmu menemukan pengetahuan, imajinasi, dan ide baru. Selamat menjelajah halaman demi halaman!</p></div>`; }
    goToPage("reader");
  }
  function dataURLtoBlob(dataURL) { const parts=dataURL.split(","); const mime=(parts[0].match(/:(.*?);/)||[])[1]||"application/pdf"; const binary=atob(parts[1]); const bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i); return new Blob([bytes],{type:mime}); }
  function handleAuth(event) {
    event.preventDefault(); const email=$("#authEmail").value.trim().toLowerCase(), password=$("#authPassword").value, name=$("#authName").value.trim();
    if(state.authMode==="register") {
      if(state.accounts.some(a=>a.email===email)){ $("#authMessage").textContent="Email demo sudah terdaftar. Silakan login."; return; }
      const account={email,password,name:name||"Pembaca"}; state.accounts.push(account); persist(STORAGE.accounts,state.accounts); state.session={email}; persist(STORAGE.session,state.session); state.profile={...state.profile,name:account.name}; persist(STORAGE.profile,state.profile); closeAuth(); renderAll(); toast("Akun demo berhasil dibuat. Selamat membaca!"); if(state.currentBook)openReader(state.currentBook);
    } else {
      const account=state.accounts.find(a=>a.email===email&&a.password===password);
      if(!account){ $("#authMessage").textContent="Email atau kata sandi demo tidak cocok."; return; }
      state.session={email}; persist(STORAGE.session,state.session); state.profile={...state.profile,name:account.name||"Pembaca"}; persist(STORAGE.profile,state.profile); closeAuth(); renderAll(); toast("Login demo berhasil!"); if(state.currentBook)openReader(state.currentBook);
    }
  }
  function logout() { state.session=null; persist(STORAGE.session,null); renderAll(); goToPage("home"); toast("Kamu sudah logout dari akun demo."); }
  function handleUpload(event) {
    event.preventDefault(); const file=$("#bookFile").files[0], msg=$("#uploadMessage"); msg.textContent="";
    if(!file)return;
    if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){msg.style.color="#c43d55";msg.textContent="File harus berformat PDF.";return;}
    if(file.size>10*1024*1024){msg.style.color="#c43d55";msg.textContent="Ukuran file maksimal 10 MB.";return;}
    if(!isLoggedIn()){toast("Login atau register terlebih dahulu untuk mengunggah buku.");openAuth("register");return;}
    const reader=new FileReader();
    reader.onerror=()=>{msg.style.color="#c43d55";msg.textContent="File gagal dibaca. Coba pilih PDF lain.";};
    reader.onload=()=>{
      const book={id:"user-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:$("#bookTitle").value.trim(),author:$("#bookAuthor").value.trim(),category:$("#bookCategory").value,description:$("#bookDescription").value.trim(),symbol:"📄",cover:0,rating:0,ratingCount:0,sample:false,uploader:state.session.email,fileName:file.name,fileData:reader.result};
      state.books.push(book);
      try { sessionStorage.setItem("dp_uploaded_"+book.id,reader.result); } catch {}
      // Store metadata separately: PDF data can be large and browser storage is limited.
      const metadata={id:book.id,title:book.title,author:book.author,category:book.category,description:book.description,symbol:book.symbol,cover:book.cover,rating:0,ratingCount:0,sample:false,uploader:book.uploader,fileName:book.fileName};
      const saved=readJSON("dp_user_books_v1",[]); saved.push(metadata); persist("dp_user_books_v1",saved);
      state.books=state.books.map(b=>b.id===book.id?{...b,fileData:reader.result}:b);
      msg.style.color="#21865d";msg.textContent="Buku berhasil ditambahkan ke koleksi demo di browser ini.";
      $("#uploadForm").reset();renderAll();toast("Buku PDF berhasil ditambahkan!");goToPage("home");
    };
    reader.readAsDataURL(file);
  }
  function initStoredBooks() {
    const metadata=readJSON("dp_user_books_v1",[]);
    for(const item of metadata) {
      if(state.books.some(b=>b.id===item.id))continue;
      let fileData=null; try{fileData=sessionStorage.getItem("dp_uploaded_"+item.id);}catch{}
      state.books.push({...item,fileData});
    }
  }
  document.addEventListener("click",event=>{
    const nav=event.target.closest("[data-nav]"); if(nav){event.preventDefault();goToPage(nav.dataset.nav);return;}
    const favorite=event.target.closest("[data-favorite]"); if(favorite){updateFavorite(favorite.dataset.favorite);return;}
    const read=event.target.closest("[data-read]"); if(read){openReader(read.dataset.read);return;}
  });
  document.addEventListener("change",event=>{const select=event.target.closest("[data-rate]");if(select)rateBook(select.dataset.rate,select.value);});
  $("#globalSearch").addEventListener("input",e=>{state.search=e.target.value;$("#pageSearch").value=state.search;renderAll();if(state.search)goToPage("search");});
  $("#pageSearch").addEventListener("input",e=>{state.search=e.target.value;$("#globalSearch").value=state.search;renderAll();});
  $("#closeWelcome").addEventListener("click",closeWelcome);$("#skipWelcome").addEventListener("click",closeWelcome);
  $("#nextWelcome").addEventListener("click",()=>{if(state.welcomeIndex<welcomeSlides.length-1){state.welcomeIndex++;renderWelcomeSlide();}else closeWelcome();});
  $("#headerAvatar").addEventListener("click",()=>goToPage("profile"));
  $("#openRegister").addEventListener("click",()=>openAuth("register"));$("#openLogin").addEventListener("click",()=>openAuth("login"));
  $("#closeAuth").addEventListener("click",closeAuth);$("#switchAuth").addEventListener("click",()=>openAuth(state.authMode==="register"?"login":"register"));
  $("#authModal").addEventListener("click",e=>{if(e.target===$("#authModal"))closeAuth();});
  $("#authForm").addEventListener("submit",handleAuth);$("#profileForm").addEventListener("submit",e=>{e.preventDefault();state.profile.name=$("#profileName").value.trim()||"Pengunjung";state.profile.avatar=$("#profileEmoji").value;persist(STORAGE.profile,state.profile);renderProfile();toast("Profil demo berhasil diperbarui.");});
  $("#logoutBtn").addEventListener("click",logout);$("#uploadForm").addEventListener("submit",handleUpload);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeAuth();closeWelcome();}});
  initStoredBooks();
  renderAll();
  if(!localStorage.getItem(STORAGE.welcome))openWelcome();else closeWelcome();
})();