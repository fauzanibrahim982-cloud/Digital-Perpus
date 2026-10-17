(() => {
  "use strict";
  // Paste your Supabase Project URL and publishable/anon key here.
  // Never put a service_role/secret key in browser JavaScript.
  const SUPABASE_URL = 'https://ppsgonkgibvlvlnvsmrp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_aE-dagEXDuxWb7FFHYkK5Q_qCyBlomq';
  const BUCKET = "book-pdfs";
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const configured = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("PASTE_YOUR") && SUPABASE_ANON_KEY.length > 30 &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR");
  let supabase = null;
  let currentUser = null;
  let profile = {display_name:"Pengunjung", avatar:"👤"};
  let books = [];
  let favorites = new Set();
  let ratings = new Map();
  let currentBook = null;
  let authMode = "register";
  let searchQuery = "";
  let toastTimer;

  const welcomeSlides = [
    ["SELAMAT DATANG · 1 DARI 4","Welcome Digital Perpus!","Temukan bacaan baru, bagikan buku digital, dan bangun perpustakaanmu sendiri.","📚"],
    ["LANGKAH 2 · 2 DARI 4","Buat akun dengan mudah","Buka Profil Saya, pilih Buat akun, lalu daftarkan email dan kata sandi.","🙋"],
    ["LANGKAH 3 · 3 DARI 4","Jelajahi dan baca buku","Cari buku, simpan dengan ikon hati, beri rating, lalu pilih Baca Buku Ini. Kamu harus login untuk membaca.","📖"],
    ["LANGKAH 4 · 4 DARI 4","Bagikan buku PDF","Unggah PDF yang kamu punya hak atau izin untuk bagikan. Selamat membaca!","📤"]
  ];
  let welcomeIndex = 0;

  function toast(message) {
    const el=$("#noticeToast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3000);
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function initialsName() { return profile.display_name || currentUser?.email?.split("@")[0] || "Pembaca"; }
  function goToPage(name) {
    const page=$(`#page-${name}`); if(!page)return;
    $$(".page").forEach(p=>p.classList.remove("active")); page.classList.add("active");
    $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
    if(name==="profile")renderProfile();
    if(name==="favorites")renderAll();
    if(name==="search"){ $("#pageSearch").value=searchQuery; renderAll(); }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function showWelcome() {
    const s=welcomeSlides[welcomeIndex];
    $("#welcomeStep").textContent=s[0];$("#welcomeTitle").textContent=s[1];$("#welcomeText").textContent=s[2];$("#welcomeSymbol").textContent=s[3];
    $$(".step-dots span").forEach((d,i)=>d.classList.toggle("active",i===welcomeIndex));
    $("#nextWelcome").textContent=welcomeIndex===welcomeSlides.length-1?"Mulai membaca →":"Berikutnya →";
    $("#skipWelcome").textContent=welcomeIndex===welcomeSlides.length-1?"Tutup":"Lewati panduan";
  }
  function closeWelcome(){ $("#welcomeOverlay").classList.add("dismissed"); try{sessionStorage.setItem("dp_welcome_seen","yes")}catch{} }
  function averageRating(book) {
    const rows=ratings.get(book.id)||[];
    if(!rows.length) return {avg:null,count:0};
    return {avg:rows.reduce((s,r)=>s+r.rating,0)/rows.length,count:rows.length};
  }
  function cover(book) {
    const colors=["","#5473d5","#d27b62","#388f8b","#b08cde","#b08c4e","#536d7e"];
    const idx=Number(book.cover_style)||1;
    const bg=colors[idx]||"#5267b8";
    return `<div class="book-cover" style="background:linear-gradient(145deg,${bg},#202d62)"><span class="cover-symbol">${escapeHTML(book.cover_emoji||"📘")}</span><span class="cover-band">DIGITAL PERPUS</span></div>`;
  }
  function card(book) {
    const rating=averageRating(book), liked=favorites.has(book.id);
    const myRating=(ratings.get(book.id)||[]).find(r=>r.user_id===currentUser?.id)?.rating||"";
    return `<article class="book-card"><div class="book-card-top">${cover(book)}<div class="book-details"><span class="book-category">${escapeHTML(book.category||"Umum")}</span><h3 class="book-title">${escapeHTML(book.title)}</h3><p class="book-author">oleh ${escapeHTML(book.author)}</p><p class="book-description">${escapeHTML(book.description||"Buku digital dari komunitas Digital Perpus.")}</p><div class="book-meta"><span class="rating-star">★</span><span class="rating-number">${rating.avg===null?"Baru":rating.avg.toFixed(1)}</span><span class="rating-count">(${rating.count})</span></div></div></div><div class="book-card-bottom"><button class="heart-btn ${liked?"liked":""}" data-favorite="${book.id}" aria-label="Favorit">${liked?"♥":"♡"}</button><button class="btn btn-primary read-btn" data-read="${book.id}">Baca Buku Ini</button><select class="rate-select" data-rate="${book.id}" aria-label="Beri rating"><option value="">★ Rating</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${String(myRating)===String(n)?"selected":""}>${"★".repeat(n)} ${n}/5</option>`).join("")}</select></div></article>`;
  }
  function renderGrid(selector, list, emptySelector) {
    $(selector).innerHTML=list.map(card).join("");
    if(emptySelector)$(emptySelector).classList.toggle("hidden",list.length>0);
  }
  function renderAll() {
    const q=searchQuery.trim().toLocaleLowerCase("id");
    const matches=books.filter(b=>`${b.title} ${b.author} ${b.category||""} ${b.description||""}`.toLocaleLowerCase("id").includes(q));
    renderGrid("#bookGrid",matches,"#emptyHome");
    renderGrid("#searchGrid",matches,"#emptySearch");
    $("#searchResultsLabel").textContent=`${matches.length} buku ditemukan`;
    renderGrid("#favoritesGrid",books.filter(b=>favorites.has(b.id)),"#emptyFavorites");
    $("#favoriteCount").textContent=String(favorites.size);
    renderProfile();
  }
  function renderProfile() {
    $("#headerAvatar").textContent=profile.avatar||"👤";
    $("#profileAvatar").textContent=profile.avatar||"👤";
    $("#profileNameDisplay").textContent=initialsName();
    $("#profileEmailDisplay").textContent=currentUser?currentUser.email:"Belum login";
    $("#profileName").value=profile.display_name||"";
    $("#profileEmoji").value=profile.avatar||"👤";
    $("#profileBookCount").textContent=books.filter(b=>b.user_id===currentUser?.id).length;
    $("#profileFavoriteCount").textContent=favorites.size;
    $("#openRegister").classList.toggle("hidden",!!currentUser);
    $("#openLogin").classList.toggle("hidden",!!currentUser);
    $("#logoutBtn").classList.toggle("hidden",!currentUser);
    $("#accountHelp").textContent=currentUser?"Kamu sudah login. Profil, favorit, dan buku tersimpan di Supabase.":"Daftar atau login untuk membaca buku dan menyimpan favorit.";
  }
  async function loadBooks() {
    if(!supabase)return;
    const {data,error}=await supabase.from("books").select("id,user_id,title,author,category,description,cover_emoji,cover_style,storage_path,created_at").eq("is_approved",true).order("created_at",{ascending:false});
    if(error){console.error(error);toast("Buku gagal dimuat. Periksa setup database dan kebijakan RLS.");return;}
    books=data||[];
    if(currentUser) {
      const [favRes,rateRes]=await Promise.all([
        supabase.from("favorites").select("book_id").eq("user_id",currentUser.id),
        supabase.from("ratings").select("book_id,user_id,rating")
      ]);
      if(favRes.error)console.warn(favRes.error);
      if(rateRes.error)console.warn(rateRes.error);
      favorites=new Set((favRes.data||[]).map(x=>x.book_id));
      ratings=new Map();
      for(const r of rateRes.data||[]){if(!ratings.has(r.book_id))ratings.set(r.book_id,[]);ratings.get(r.book_id).push(r);}
    } else { favorites=new Set(); ratings=new Map(); }
    renderAll();
  }
  async function loadProfile() {
    if(!supabase||!currentUser){profile={display_name:"Pengunjung",avatar:"👤"};renderProfile();return;}
    const {data,error}=await supabase.from("profiles").select("display_name,avatar").eq("id",currentUser.id).maybeSingle();
    if(error)console.warn(error);
    profile=data||{display_name:currentUser.email?.split("@")[0]||"Pembaca",avatar:"👤"};
    renderProfile();
  }
  async function refreshSession() {
    if(!supabase)return;
    const {data,error}=await supabase.auth.getSession();
    if(error)console.error(error);
    currentUser=data.session?.user||null;
    await loadProfile();
    await loadBooks();
  }
  function openAuth(mode) {
    authMode=mode;$("#authModal").classList.remove("hidden");
    $("#authTitle").textContent=mode==="register"?"Buat akun":"Login";
    $("#authDescription").textContent=mode==="register"?"Daftar untuk mulai membaca dan berbagi buku.":"Masuk dengan akun Digital Perpus kamu.";
    $("#authNameWrap").classList.toggle("hidden",mode!=="register");
    $("#authName").required=mode==="register";
    $("#authPassword").autocomplete=mode==="register"?"new-password":"current-password";
    $("#authSubmit").textContent=mode==="register"?"Buat akun":"Login";
    $("#switchAuth").textContent=mode==="register"?"Sudah punya akun? Login":"Belum punya akun? Daftar";
    $("#authMessage").textContent="";
  }
  function closeAuth(){$("#authModal").classList.add("hidden");}
  async function handleAuth(e) {
    e.preventDefault();
    if(!supabase){toast("Supabase belum dikonfigurasi.");return;}
    const email=$("#authEmail").value.trim().toLowerCase(), password=$("#authPassword").value;
    $("#authSubmit").disabled=true;$("#authMessage").textContent="Memproses...";
    try {
      let result;
      if(authMode==="register") {
        const display_name=$("#authName").value.trim()||email.split("@")[0];
        result=await supabase.auth.signUp({email,password,options:{data:{display_name}}});
        if(result.error)throw result.error;
        if(result.data.session) {
          currentUser=result.data.user;
          await supabase.from("profiles").upsert({id:currentUser.id,display_name,avatar:"👤"},{onConflict:"id"});
          closeAuth();await refreshSession();toast("Akun berhasil dibuat!");
        } else {
          $("#authMessage").textContent="Pendaftaran diterima. Periksa email untuk verifikasi, lalu login.";
          $("#authMessage").style.color="#21865d";
        }
      } else {
        result=await supabase.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        currentUser=result.data.user;closeAuth();await refreshSession();toast("Login berhasil!");
        if(currentBook)await openReader(currentBook.id);
      }
    } catch(err) { $("#authMessage").textContent=err.message||"Autentikasi gagal.";$("#authMessage").style.color="#c43d55"; }
    finally { $("#authSubmit").disabled=false; }
  }
  async function toggleFavorite(bookId) {
    if(!currentUser){toast("Register terlebih dahulu ya!");openAuth("register");return;}
    if(favorites.has(bookId)) {
      const {error}=await supabase.from("favorites").delete().eq("user_id",currentUser.id).eq("book_id",bookId);
      if(error){toast(error.message);return;}favorites.delete(bookId);toast("Buku dihapus dari favorit.");
    } else {
      const {error}=await supabase.from("favorites").insert({user_id:currentUser.id,book_id:bookId});
      if(error){toast(error.message);return;}favorites.add(bookId);toast("Buku disimpan ke Favorite Books.");
    }
    renderAll();
  }
  async function rateBook(bookId,value) {
    if(!value)return;
    if(!currentUser){toast("Register terlebih dahulu ya!");openAuth("register");return;}
    const {error}=await supabase.from("ratings").upsert({user_id:currentUser.id,book_id:bookId,rating:Number(value)},{onConflict:"user_id,book_id"});
    if(error){toast("Rating gagal disimpan: "+error.message);return;}
    const {data}=await supabase.from("ratings").select("book_id,user_id,rating");
    ratings=new Map();for(const r of data||[]){if(!ratings.has(r.book_id))ratings.set(r.book_id,[]);ratings.get(r.book_id).push(r);}
    renderAll();toast("Rating kamu berhasil disimpan.");
  }
  async function openReader(book) {
    if(!currentUser){currentBook=book;toast("Register terlebih dahulu ya!");openAuth("register");return;}
    currentBook=book;
    $("#readerContent").innerHTML=`<div class="reader-card"><div class="reader-head">${cover(book)}<div class="reader-copy"><span class="book-category">${escapeHTML(book.category||"Umum")}</span><h1>${escapeHTML(book.title)}</h1><p>oleh ${escapeHTML(book.author)}</p><p>${escapeHTML(book.description||"Buku digital dari komunitas.")}</p><div class="reader-actions"><button class="btn btn-outline" data-favorite="${book.id}">${favorites.has(book.id)?"♥ Tersimpan":"♡ Favorit"}</button><span class="muted">PDF · akses pengguna login</span></div></div></div><div id="readerArea"><p class="muted">Membuka file PDF...</p></div></div>`;
    goToPage("reader");
    const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(book.storage_path,300);
    if(error){$("#readerArea").innerHTML='<div class="reader-locked"><span>🔒</span><h2>PDF tidak bisa dibuka</h2><p>Pastikan file tersedia di Storage dan kebijakan penyimpanannya sudah dipasang.</p></div>';console.error(error);return;}
    $("#readerArea").innerHTML=`<iframe class="pdf-frame" title="Pembaca PDF ${escapeHTML(book.title)}" src="${data.signedUrl}#toolbar=1&navpanes=0"></iframe><p class="muted">Tautan baca sementara berlaku sekitar 5 menit. Jika kedaluwarsa, buka kembali buku ini.</p>`;
  }
  async function handleUpload(e) {
    e.preventDefault();
    if(!currentUser){toast("Login terlebih dahulu untuk mengunggah buku.");openAuth("register");return;}
    const file=$("#bookFile").files[0], message=$("#uploadMessage");
    message.textContent="";message.style.color="#21865d";
    if(!file)return;
    if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){message.textContent="File harus berformat PDF.";message.style.color="#c43d55";return;}
    if(file.size>MAX_PDF_BYTES){message.textContent="Ukuran PDF maksimal 10 MB.";message.style.color="#c43d55";return;}
    const title=$("#bookTitle").value.trim(), author=$("#bookAuthor").value.trim();
    if(!title||!author){message.textContent="Judul dan penulis wajib diisi.";message.style.color="#c43d55";return;}
    const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]/g,"-").slice(-100);
    const path=`${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
    const submit=e.submitter; if(submit)submit.disabled=true;
    message.textContent="Mengunggah PDF...";
    try {
      const upload=await supabase.storage.from(BUCKET).upload(path,file,{contentType:"application/pdf",upsert:false});
      if(upload.error)throw upload.error;
      const row={user_id:currentUser.id,title,author,category:$("#bookCategory").value,description:$("#bookDescription").value.trim(),storage_path:path,cover_emoji:"📄",cover_style:1,is_approved:true};
      const {data,error}=await supabase.from("books").insert(row).select("id").single();
      if(error){await supabase.storage.from(BUCKET).remove([path]);throw error;}
      message.textContent="Buku berhasil diunggah dan ditambahkan ke koleksi!";
      $("#uploadForm").reset();await loadBooks();toast("Buku berhasil diunggah!");goToPage("home");
    } catch(err) {message.textContent="Gagal mengunggah: "+(err.message||"Periksa Storage, database, dan kebijakan RLS.");message.style.color="#c43d55";}
    finally {if(submit)submit.disabled=false;}
  }
  async function saveProfile(e) {
    e.preventDefault();
    if(!currentUser){toast("Login terlebih dahulu untuk menyimpan profil.");openAuth("register");return;}
    const display_name=$("#profileName").value.trim(), avatar=$("#profileEmoji").value;
    if(!display_name){$("#profileMessage").textContent="Nama tampilan wajib diisi.";return;}
    const {error}=await supabase.from("profiles").upsert({id:currentUser.id,display_name,avatar,updated_at:new Date().toISOString()},{onConflict:"id"});
    if(error){$("#profileMessage").textContent="Gagal menyimpan: "+error.message;$("#profileMessage").style.color="#c43d55";return;}
    profile={display_name,avatar};$("#profileMessage").textContent="Profil berhasil disimpan.";$("#profileMessage").style.color="#21865d";renderProfile();toast("Profil diperbarui.");
  }
  async function logout() {
    if(!supabase)return;
    const {error}=await supabase.auth.signOut();
    if(error){toast(error.message);return;}
    currentUser=null;favorites=new Set();ratings=new Map();await loadProfile();await loadBooks();goToPage("home");toast("Kamu berhasil logout.");
  }
  function setConnection(text, good=false) {
    $("#connectionLabel").textContent=text;
    $(".status-dot").style.background=good?"#39bb86":"#e6a23c";
  }
  async function init() {
    if(!configured||!window.supabase?.createClient) {
      $("#setupWarning").classList.remove("hidden");setConnection("Belum dikonfigurasi",false);
      $("#bookGrid").innerHTML="";$("#searchGrid").innerHTML="";
      $("#emptyHome").classList.remove("hidden");$("#emptySearch").classList.remove("hidden");
      $("#searchResultsLabel").textContent="Supabase belum dikonfigurasi";
    } else {
      supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
      try {
        setConnection("Terhubung",true);await refreshSession();
        supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;setTimeout(async()=>{await loadProfile();await loadBooks();},0);});
      } catch(err){console.error(err);setConnection("Koneksi gagal",false);toast("Koneksi Supabase gagal. Periksa URL dan key.");}
    }
    try {if(sessionStorage.getItem("dp_welcome_seen")==="yes")closeWelcome();else showWelcome();}catch{showWelcome();}
  }
  document.addEventListener("click",async e=>{
    const nav=e.target.closest("[data-page]");if(nav){e.preventDefault();goToPage(nav.dataset.page);return;}
    const fav=e.target.closest("[data-favorite]");if(fav){await toggleFavorite(fav.dataset.favorite);return;}
    const read=e.target.closest("[data-read]");if(read){const book=books.find(b=>b.id===read.dataset.read);if(book)await openReader(book);return;}
  });
  document.addEventListener("change",e=>{const sel=e.target.closest("[data-rate]");if(sel)rateBook(sel.dataset.rate,sel.value);});
  $("#globalSearch").addEventListener("input",e=>{searchQuery=e.target.value;$("#pageSearch").value=searchQuery;renderAll();if(searchQuery)goToPage("search");});
  $("#pageSearch").addEventListener("input",e=>{searchQuery=e.target.value;$("#globalSearch").value=searchQuery;renderAll();});
  $("#closeWelcome").addEventListener("click",closeWelcome);$("#skipWelcome").addEventListener("click",closeWelcome);
  $("#nextWelcome").addEventListener("click",()=>{if(welcomeIndex<welcomeSlides.length-1){welcomeIndex++;showWelcome();}else closeWelcome();});
  $("#headerAvatar").addEventListener("click",()=>goToPage("profile"));
  $("#openRegister").addEventListener("click",()=>openAuth("register"));$("#openLogin").addEventListener("click",()=>openAuth("login"));
  $("#closeAuth").addEventListener("click",closeAuth);$("#switchAuth").addEventListener("click",()=>openAuth(authMode==="register"?"login":"register"));
  $("#authModal").addEventListener("click",e=>{if(e.target===$("#authModal"))closeAuth();});
  $("#authForm").addEventListener("submit",handleAuth);$("#uploadForm").addEventListener("submit",handleUpload);$("#profileForm").addEventListener("submit",saveProfile);$("#logoutBtn").addEventListener("click",logout);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeAuth();closeWelcome();}});
  init();
})();
