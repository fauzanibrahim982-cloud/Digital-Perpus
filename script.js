(() => {
  "use strict";
  // Paste your Supabase Project URL and publishable/anon key here.
  // Never put a service_role/secret key in browser JavaScript.
  const SUPABASE_URL = "https://ppsgonkgibvlvlnvsmrp.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_aE-dagEXDuxWb7FFHYkK5Q_qCyBlomq";
  const BUCKET = "book-pdfs";
  const ASSET_BUCKET = "dp-assets";
  const PROOF_BUCKET = "payment-proofs";
  let purchaseBook = null;
  let memberBooksCache = [];
  let activePdf = null;
  let activePdfPage = 1;
  let activePdfUrl = null;
  let isAdmin = false;
  let siteBannerUrl = null;
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const configured = SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("PASTE_YOUR") && SUPABASE_ANON_KEY.length > 30 &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR");
  let supabase = null;
  let currentUser = null;
  let profile = {display_name:"Pengunjung", avatar:"👤", avatar_url:null, banner_url:null, qris_image_url:null};
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
    document.body.classList.toggle("hide-global-search", name==="profile" || name==="upload" || name==="perpus" || name==="reader");
    if(name==="profile")renderProfile();
    if(name==="perpus")loadMemberCenter();
    if(name==="admin")loadAdminPage();
    if(name==="favorites")renderAll();
    if(name==="search"){ $("#pageSearch").value=searchQuery; renderAll(); }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function showWelcome() {
    const overlay = $("#welcomeOverlay");
    if (!overlay) { console.error("Digital Perpus: elemen welcomeOverlay tidak ditemukan."); return; }
    overlay.classList.remove("dismissed");
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
    const idx=Number(book.cover_style)||1, bg=colors[idx]||"#5267b8";
    if(book.cover_image_url) return `<div class="book-cover image-cover"><img src="${escapeHTML(book.cover_image_url)}" alt="Sampul ${escapeHTML(book.title)}" loading="lazy"></div>`;
    return `<div class="book-cover" style="background:linear-gradient(145deg,${bg},#202d62)"><span class="cover-symbol">${escapeHTML(book.cover_emoji||"📘")}</span><span class="cover-band">DIGITAL PERPUS</span></div>`;
  }
  function money(value){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value)||0)}
  function reviewList(bookId){return (ratings.get(bookId)||[]).filter(r=>(r.review||"").trim());}
  function ratingStars(value){return `<span class="stars-static" aria-label="${value} dari 5">${[1,2,3,4,5].map(n=>n<=value?"★":"☆").join("")}</span>`;}
  function card(book) {
    const rating=averageRating(book), liked=favorites.has(book.id);
    const myRating=(ratings.get(book.id)||[]).find(r=>r.user_id===currentUser?.id)?.rating||"";
    const forSale=!!book.is_for_sale, isOwner=book.user_id===currentUser?.id;
    return `<article class="book-card"><div class="book-card-top">${cover(book)}<div class="book-details"><span class="book-category">${escapeHTML(book.category||"Umum")}</span><h3 class="book-title">${escapeHTML(book.title)}</h3><p class="book-author">oleh ${escapeHTML(book.author)}</p><p class="book-description">${escapeHTML(book.description||"Buku digital dari komunitas Digital Perpus.")}</p><div class="book-meta"><span class="rating-star">★</span><span class="rating-number">${rating.avg===null?"Baru":rating.avg.toFixed(1)}</span><span class="rating-count">(${rating.count})</span></div>${forSale?`<strong class="sale-price">${money(book.price)}</strong>`:`<span class="free-label">GRATIS</span>`}</div></div><div class="book-card-bottom"><button class="heart-btn ${liked?"liked":""}" data-favorite="${book.id}" aria-label="Favorit">${liked?"♥":"♡"}</button><button class="btn btn-primary read-btn" data-read="${book.id}">${forSale&&!isOwner?"Beli Buku Ini":"Baca Buku Ini"}</button>${isOwner?`<button class="btn btn-danger" data-delete-book="${book.id}" title="Hapus buku">Hapus</button>`:""}</div></article>`;
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
    if(profile.avatar_url){$("#headerAvatar").innerHTML=`<img src="${escapeHTML(profile.avatar_url)}" alt="Foto profil">`;$("#profileAvatar").innerHTML=`<img src="${escapeHTML(profile.avatar_url)}" alt="Foto profil">`;}
    else {$("#headerAvatar").textContent=profile.avatar||"👤";$("#profileAvatar").textContent=profile.avatar||"👤";}
    const banner=$(".profile-banner"); if(banner) banner.style.background=profile.banner_url?`center/cover no-repeat url("${profile.banner_url}")` : "";
    const qrisWrap=$("#profileQrisPreviewWrap"), qrisPreview=$("#profileQrisPreview"); if(profile.qris_image_url&&qrisWrap&&qrisPreview){qrisPreview.src=profile.qris_image_url;qrisWrap.classList.remove("hidden");}
    $("#profileNameDisplay").textContent=initialsName();
    $("#profileEmailDisplay").textContent=currentUser?currentUser.email:"Belum login";
    $("#profileName").value=profile.display_name||"";
    $("#profileBookCount").textContent=books.filter(b=>b.user_id===currentUser?.id).length;
    $("#profileFavoriteCount").textContent=favorites.size;
    $("#openRegister").classList.toggle("hidden",!!currentUser);
    $("#openLogin").classList.toggle("hidden",!!currentUser);
    $("#logoutBtn").classList.toggle("hidden",!currentUser);
    $("#accountHelp").textContent=currentUser?"Kamu sudah login. Profil, favorit, dan buku tersimpan di Supabase.":"Daftar atau login untuk membaca buku dan menyimpan favorit.";
  }
  async function loadBooks() {
    if(!supabase)return;
    const {data,error}=await supabase.from("books").select("id,user_id,title,author,category,description,cover_emoji,cover_style,cover_image_url,storage_path,created_at,is_for_sale,price").eq("is_approved",true).order("created_at",{ascending:false});
    if(error){console.error(error);toast("Buku gagal dimuat. Periksa setup database dan kebijakan RLS.");return;}
    books=data||[];
    if(currentUser) {
      const [favRes,rateRes]=await Promise.all([
        supabase.from("favorites").select("book_id").eq("user_id",currentUser.id),
        supabase.from("ratings").select("book_id,user_id,rating,review,created_at")
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
    const {data,error}=await supabase.from("profiles").select("display_name,avatar,avatar_url,banner_url,qris_image_url").eq("id",currentUser.id).maybeSingle();
    if(error)console.warn(error);
    profile=data||{display_name:currentUser.email?.split("@")[0]||"Pembaca",avatar:"👤",avatar_url:null,banner_url:null,qris_image_url:null};
    renderProfile();
  }
  async function refreshSession() {
    if(!supabase)return;
    const {data,error}=await supabase.auth.getSession();
    if(error)console.error(error);
    currentUser=data.session?.user||null;
    await loadProfile();
    await loadBooks();
    await loadAdminState();
    await loadSiteBanner();
  }
  async function loadAdminState(){
    isAdmin=false;$("#adminNav").classList.add("hidden");
    if(!supabase||!currentUser)return;
    const {data,error}=await supabase.from("admin_users").select("user_id").eq("user_id",currentUser.id).maybeSingle();
    if(error){console.warn("Admin check:",error.message);return;}
    isAdmin=!!data;$("#adminNav").classList.toggle("hidden",!isAdmin);
  }
  async function loadSiteBanner(){
    if(!supabase)return;
    const {data,error}=await supabase.from("site_settings").select("value").eq("key","site_banner_url").maybeSingle();
    if(error){console.warn("Site banner:",error.message);return;}
    siteBannerUrl=data?.value||null;
    const wrap=$("#siteBannerWrap"),img=$("#siteBannerImage");if(siteBannerUrl){img.src=siteBannerUrl;wrap.classList.remove("hidden");}else wrap.classList.add("hidden");
  }
  async function loadAdminPage(){
    if(!currentUser){toast("Login dulu untuk membuka Admin Panel.");goToPage("profile");openAuth("login");return;}
    await loadAdminState();if(!isAdmin){toast("Akun ini belum terdaftar sebagai admin.");goToPage("home");return;}
    if(siteBannerUrl){$("#siteBannerPreview").src=siteBannerUrl;$("#siteBannerPreviewWrap").classList.remove("hidden");}
  }
  async function saveSiteBanner(){
    if(!currentUser||!isAdmin){toast("Akses admin diperlukan.");return;}
    const file=$("#siteBannerFile").files[0];if(!file&&!siteBannerUrl){$("#adminMessage").textContent="Pilih gambar banner terlebih dahulu.";return;}
    const msg=$("#adminMessage");msg.textContent="Menyimpan banner...";msg.style.color="#21865d";
    try{
      let url=siteBannerUrl;if(file)url=await uploadImage(file,"site-banner");
      const {error}=await supabase.from("site_settings").upsert({key:"site_banner_url",value:url,updated_at:new Date().toISOString()},{onConflict:"key"});if(error)throw error;
      siteBannerUrl=url;await loadSiteBanner();$("#siteBannerPreview").src=url;$("#siteBannerPreviewWrap").classList.remove("hidden");msg.textContent="Banner utama berhasil diperbarui.";toast("Banner website diperbarui.");
    }catch(err){msg.textContent="Gagal menyimpan: "+(err.message||"Pastikan SQL upgrade sudah dijalankan dan akunmu admin.");msg.style.color="#ff9aa9";}
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
        if(currentBook)await openReader(currentBook);
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
  async function rateBook(bookId,value,review="") {
    if(!currentUser){toast("Login terlebih dahulu untuk memberi rating.");openAuth("register");return;}
    const {error}=await supabase.from("ratings").upsert({user_id:currentUser.id,book_id:bookId,rating:Number(value),review:review.trim()},{onConflict:"user_id,book_id"});
    if(error){toast("Rating gagal disimpan: "+error.message);return;}
    await reloadRatings();renderAll();toast("Rating dan ulasan berhasil disimpan.");
    if(currentBook?.id===bookId) await openReader(books.find(b=>b.id===bookId)||currentBook);
  }
  async function reloadRatings(){const {data,error}=await supabase.from("ratings").select("book_id,user_id,rating,review,created_at");if(error){console.warn(error);return;}ratings=new Map();for(const r of data||[]){if(!ratings.has(r.book_id))ratings.set(r.book_id,[]);ratings.get(r.book_id).push(r);}}
  async function uploadImage(file,folder){
    if(!file)return null;
    if(!file.type.startsWith("image/")){throw new Error("Pilih file gambar ya.");}
    if(file.size>5*1024*1024)throw new Error("Ukuran gambar maksimal 5 MB.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${currentUser.id}/${folder}-${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from(ASSET_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    return supabase.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  async function deleteBook(bookId){
    if(!currentUser)return;
    const book=books.find(b=>b.id===bookId);if(!book||book.user_id!==currentUser.id){toast("Kamu hanya bisa menghapus buku milikmu.");return;}
    if(!confirm(`Hapus buku “${book.title}”? Tindakan ini tidak bisa dibatalkan.`))return;
    const {error}=await supabase.from("books").delete().eq("id",bookId).eq("user_id",currentUser.id);
    if(error){toast("Buku gagal dihapus: "+error.message);return;}
    await supabase.storage.from(BUCKET).remove([book.storage_path]);
    books=books.filter(b=>b.id!==bookId);await loadBooks();await loadMemberCenter();toast("Buku berhasil dihapus.");
  }
  async function submitPurchase(e){
    e.preventDefault();if(!currentUser){openAuth("register");return;}if(!purchaseBook)return;
    if(purchaseBook.user_id===currentUser.id){toast("Ini buku yang kamu unggah sendiri.");return;}
    if(!purchaseBook.qris_image_url){toast("Penjual belum memasang QRIS. Hubungi penjual dulu.");return;}
    const file=$("#paymentProofFile").files[0];if(!file)return;
    const msg=$("#purchaseMessage");msg.textContent="Mengirim bukti pembayaran...";
    try{
      if(!file.type.startsWith("image/")||file.size>5*1024*1024)throw new Error("Bukti harus berupa gambar maksimal 5 MB.");
      const path=`${currentUser.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(-80)}`;
      const up=await supabase.storage.from(PROOF_BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;
      const {error}=await supabase.from("purchases").upsert({book_id:purchaseBook.id,buyer_id:currentUser.id,seller_id:purchaseBook.user_id,proof_path:path,status:"pending"},{onConflict:"book_id,buyer_id"});
      if(error){await supabase.storage.from(PROOF_BUCKET).remove([path]);throw error;}
      msg.textContent="Bukti terkirim! Tunggu penjual memeriksa pembayaran.";toast("Bukti pembayaran terkirim.");
    }catch(err){msg.textContent="Gagal: "+(err.message||"Coba lagi.");msg.style.color="#c43d55";}
  }
  async function loadMemberCenter(){
    if(!supabase||!currentUser){$("#memberBooks").innerHTML='<p class="muted">Login untuk melihat buku dan ulasan milikmu.</p>';$("#memberReviews").innerHTML="";$("#memberPurchases").innerHTML="";return;}
    const q=($("#memberBookSearch")?.value||"").trim().toLowerCase();
    const mine=books.filter(b=>b.user_id===currentUser.id&&`${b.title} ${b.author}`.toLowerCase().includes(q));memberBooksCache=mine;
    $("#memberBooks").innerHTML=mine.length?mine.map(b=>`<div class="member-book-row">${cover(b)}<div><strong>${escapeHTML(b.title)}</strong><p>${b.is_for_sale?money(b.price):"Gratis"}</p><button class="btn btn-danger" data-delete-book="${b.id}">Hapus buku</button></div></div>`).join(""):'<p class="muted">Belum ada buku yang cocok.</p>';
    const reviews=[];for(const b of books.filter(x=>x.user_id===currentUser.id)){for(const r of (ratings.get(b.id)||[])){if((r.review||"").trim())reviews.push({b,r});}}
    $("#memberReviews").innerHTML=reviews.length?reviews.map(({b,r})=>`<article class="review-card"><strong>${escapeHTML(b.title)}</strong><div>${ratingStars(r.rating)} <span>${r.rating}/5</span></div><p>${escapeHTML(r.review)}</p><small>Ulasan member</small></article>`).join(""):'<p class="muted">Belum ada ulasan tertulis untuk buku milikmu. Rating tanpa ulasan tetap dihitung.</p>';
    const {data:orders,error}=await supabase.from("purchases").select("id,book_id,buyer_id,proof_path,status,created_at").eq("seller_id",currentUser.id).order("created_at",{ascending:false});
    if(error){$("#memberPurchases").innerHTML='<p class="muted">Permintaan pembelian belum bisa dimuat. Pastikan SQL upgrade sudah dijalankan.</p>';return;}
    const orderRows=orders||[];const bookMap=new Map(books.map(b=>[b.id,b]));
    $("#memberPurchases").innerHTML=orderRows.length?(await Promise.all(orderRows.map(async o=>{const b=bookMap.get(o.book_id);let proof="#";const signed=await supabase.storage.from(PROOF_BUCKET).createSignedUrl(o.proof_path,300);if(!signed.error)proof=signed.data.signedUrl;return `<article class="review-card"><strong>${escapeHTML(b?.title||"Buku")}</strong><p>Status: <b>${escapeHTML(o.status)}</b></p><a href="${escapeHTML(proof)}" target="_blank" rel="noopener">Lihat bukti pembayaran</a>${o.status==="pending"?`<div class="inline-actions"><button class="btn btn-primary" data-approve-purchase="${o.id}">Setujui</button><button class="btn btn-danger" data-reject-purchase="${o.id}">Tolak</button></div>`:""}</article>`;}))).join(""):'<p class="muted">Belum ada permintaan pembelian.</p>';
  }
  async function updatePurchase(id,status){const {error}=await supabase.from("purchases").update({status}).eq("id",id).eq("seller_id",currentUser.id);if(error){toast("Status pembelian gagal diperbarui: "+error.message);return;}toast(status==="approved"?"Pembelian disetujui. Akses buku dibuka.":"Pembelian ditolak.");await loadMemberCenter();}
  async function openReader(book) {
    if(!currentUser){currentBook=book;toast("Login terlebih dahulu untuk membaca buku.");openAuth("register");return;}
    currentBook=book;
    if(book.is_for_sale&&book.user_id!==currentUser.id){
      const {data:purchase}=await supabase.from("purchases").select("status").eq("book_id",book.id).eq("buyer_id",currentUser.id).maybeSingle();
      if(purchase?.status!=="approved"){
        purchaseBook=book;$("#purchaseBookTitle").textContent=book.title;$("#purchasePrice").textContent=money(book.price);
        const {data:seller}=await supabase.from("profiles").select("qris_image_url,display_name").eq("id",book.user_id).maybeSingle();
        const qr=seller?.qris_image_url;purchaseBook.qris_image_url=qr||null;
        $("#purchaseSellerQris").innerHTML=qr?`<p>Bayar ke QRIS milik ${escapeHTML(seller?.display_name||"penjual")}:</p><img src="${escapeHTML(qr)}" alt="QRIS penjual">`:'<p class="muted">Penjual belum mengunggah QRIS.</p>';
        $("#purchaseMessage").textContent=purchase?.status==="pending"?"Bukti pembayaranmu sedang diperiksa penjual.":"Bayar sesuai harga lalu kirim bukti pembayaran.";
        $("#purchaseModal").classList.remove("hidden");return;
      }
    }
    const rating=averageRating(book), mine=(ratings.get(book.id)||[]).find(r=>r.user_id===currentUser.id);
    const reviewRows=(ratings.get(book.id)||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    $("#readerContent").innerHTML=`<div class="reader-card"><div class="reader-head">${cover(book)}<div class="reader-copy"><span class="book-category">${escapeHTML(book.category||"Umum")}</span><h1>${escapeHTML(book.title)}</h1><p>oleh ${escapeHTML(book.author)}</p><p>${escapeHTML(book.description||"Buku digital dari komunitas.")}</p><div class="reader-actions"><button class="btn btn-outline" data-favorite="${book.id}">${favorites.has(book.id)?"♥ Tersimpan":"♡ Favorit"}</button><span class="muted">PDF · akses sesuai status buku</span></div></div></div>
      <div class="reader-rating"><div><h2>Rating Buku</h2><p>${rating.avg===null?"Belum ada rating":`${rating.avg.toFixed(1)} dari 5 · ${rating.count} rating`}</p></div><form id="readerRatingForm" data-rating-book="${book.id}"><div class="rating-picker" role="radiogroup" aria-label="Pilih rating">${[1,2,3,4,5].map(n=>`<button type="button" class="star-pick ${(mine?.rating||0)>=n?"selected":""}" data-star-pick="${n}" aria-label="${n} bintang">★</button>`).join("")}<span id="ratingPickLabel">${mine?.rating?`${mine.rating}/5`:"Pilih bintang"}</span></div><input id="readerRatingValue" type="hidden" value="${mine?.rating||""}"><label class="field-label">Ulasan (opsional)<textarea id="readerReviewText" rows="3" maxlength="1000" placeholder="Ceritakan buku ini bagus, menarik, atau bagian yang perlu diperbaiki...">${escapeHTML(mine?.review||"")}</textarea></label><button class="btn btn-primary" type="submit">Simpan rating</button></form></div>
      <div class="reader-reviews"><h2>Rating dan ulasan pembaca</h2>${reviewRows.length?reviewRows.map(r=>`<article class="review-card"><div>${ratingStars(r.rating)} <strong>${r.rating}/5</strong></div>${r.review?.trim()?`<p>${escapeHTML(r.review)}</p>`:'<p class="muted">Member memberi rating tanpa ulasan tertulis.</p>'}</article>`).join(""):'<p class="muted">Belum ada yang memberi rating. Jadilah yang pertama!</p>'}</div><div id="readerArea"><p class="muted">Membuka file PDF...</p></div></div>`;
    goToPage("reader");
    const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(book.storage_path,300);
    if(error){$("#readerArea").innerHTML='<div class="reader-locked"><span>🔒</span><h2>PDF tidak bisa dibuka</h2><p>Pastikan SQL upgrade dan kebijakan Storage sudah dipasang.</p></div>';console.error(error);return;}
    activePdfUrl=data.signedUrl;activePdf=null;activePdfPage=1;
    $("#readerArea").innerHTML=`<div class="pdf-page-toolbar"><button class="btn btn-outline" id="pdfPrev" disabled>‹ Sebelumnya</button><span id="pdfPageLabel">Memuat halaman...</span><button class="btn btn-outline" id="pdfNext" disabled>Berikutnya ›</button></div><div class="pdf-canvas-wrap"><canvas id="pdfCanvas"></canvas></div><p class="muted">Gunakan tombol sebelumnya/berikutnya untuk berpindah halaman.</p>`;
    if(!window.pdfjsLib){$("#readerArea").innerHTML='<p class="muted">Pembaca PDF gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.</p>';return;}
    window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    try{activePdf=await window.pdfjsLib.getDocument(data.signedUrl).promise;await renderPdfPage(1);}catch(err){console.error(err);$("#readerArea").innerHTML='<p class="muted">PDF tidak bisa dirender. Pastikan file benar-benar PDF dan akses Storage sudah benar.</p>';return;}
    $("#pdfPrev").addEventListener("click",()=>renderPdfPage(activePdfPage-1));$("#pdfNext").addEventListener("click",()=>renderPdfPage(activePdfPage+1));
  }
  async function renderPdfPage(pageNumber){
    if(!activePdf)return;activePdfPage=Math.max(1,Math.min(activePdf.numPages,pageNumber));
    const page=await activePdf.getPage(activePdfPage),canvas=$("#pdfCanvas"),context=canvas.getContext("2d");
    const base=page.getViewport({scale:1});const maxWidth=Math.min(1000,Math.max(280,document.querySelector(".pdf-canvas-wrap")?.clientWidth||800));const scale=Math.min(1.7,maxWidth/base.width);const viewport=page.getViewport({scale});
    canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:context,viewport}).promise;
    $("#pdfPageLabel").textContent=`Halaman ${activePdfPage} dari ${activePdf.numPages}`;$("#pdfPrev").disabled=activePdfPage<=1;$("#pdfNext").disabled=activePdfPage>=activePdf.numPages;
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
      let coverUrl=null;const coverFile=$("#bookCoverFile").files[0];if(coverFile)coverUrl=await uploadImage(coverFile,"cover");
      const forSale=$("#bookForSale").checked;const price=Number($("#bookPrice").value||0);
      if(forSale&&(!Number.isFinite(price)||price<1000)){await supabase.storage.from(BUCKET).remove([path]);throw new Error("Harga buku minimal Rp1.000.");}
      const row={user_id:currentUser.id,title,author,category:$("#bookCategory").value,description:$("#bookDescription").value.trim(),storage_path:path,cover_emoji:"📄",cover_style:1,cover_image_url:coverUrl,is_for_sale:forSale,price:forSale?price:0,is_approved:true};
      const {data,error}=await supabase.from("books").insert(row).select("id").single();
      if(error){await supabase.storage.from(BUCKET).remove([path]);throw error;}
      message.textContent="Buku berhasil diunggah dan ditambahkan ke koleksi!";
      $("#uploadForm").reset();await loadBooks();toast("Buku berhasil diunggah!");goToPage("home");
    } catch(err) {message.textContent="Gagal mengunggah: "+(err.message||"Periksa Storage, database, dan kebijakan RLS.");message.style.color="#c43d55";}
    finally {if(submit)submit.disabled=false;}
  }
  async function saveProfile(e) {
    e.preventDefault();if(!currentUser){toast("Login terlebih dahulu untuk menyimpan profil.");openAuth("register");return;}
    const display_name=$("#profileName").value.trim();if(!display_name){$("#profileMessage").textContent="Nama tampilan wajib diisi.";return;}
    const msg=$("#profileMessage");msg.textContent="Menyimpan profil dan gambar...";msg.style.color="#21865d";
    try{
      let avatar_url=profile.avatar_url||null,banner_url=profile.banner_url||null,qris_image_url=profile.qris_image_url||null;
      const avatarFile=$("#profilePhotoFile").files[0],bannerFile=$("#profileBannerFile").files[0],qrisFile=$("#profileQrisFile").files[0];
      if(avatarFile)avatar_url=await uploadImage(avatarFile,"avatar");if(bannerFile)banner_url=await uploadImage(bannerFile,"banner");if(qrisFile)qris_image_url=await uploadImage(qrisFile,"qris");
      const {error}=await supabase.from("profiles").upsert({id:currentUser.id,display_name,avatar:"👤",avatar_url,banner_url,qris_image_url,updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error;
      profile={...profile,display_name,avatar:"👤",avatar_url,banner_url,qris_image_url};msg.textContent="Profil, foto, banner, dan QRIS berhasil disimpan.";renderProfile();toast("Profil diperbarui.");
    }catch(err){msg.textContent="Gagal menyimpan: "+(err.message||"Periksa SQL upgrade dan bucket dp-assets.");msg.style.color="#c43d55";}
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
        supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;setTimeout(async()=>{await loadProfile();await loadBooks();await loadAdminState();await loadSiteBanner();},0);});
      } catch(err){console.error(err);setConnection("Koneksi gagal",false);toast("Koneksi Supabase gagal. Periksa URL dan key.");}
    }
    try {if(sessionStorage.getItem("dp_welcome_seen")==="yes")closeWelcome();else showWelcome();}catch{showWelcome();}
  }
  document.addEventListener("click",async e=>{
    const nav=e.target.closest("[data-page]");if(nav){e.preventDefault();goToPage(nav.dataset.page);return;}
    const fav=e.target.closest("[data-favorite]");if(fav){await toggleFavorite(fav.dataset.favorite);return;}
    const read=e.target.closest("[data-read]");if(read){const book=books.find(b=>b.id===read.dataset.read);if(book)await openReader(book);return;}
    const del=e.target.closest("[data-delete-book]");if(del){await deleteBook(del.dataset.deleteBook);return;}
    const star=e.target.closest("[data-star-pick]");if(star){const form=star.closest("form");form.querySelector("#readerRatingValue").value=star.dataset.starPick;form.querySelectorAll(".star-pick").forEach(b=>b.classList.toggle("selected",Number(b.dataset.starPick)<=Number(star.dataset.starPick)));form.querySelector("#ratingPickLabel").textContent=star.dataset.starPick+"/5";return;}
    const approve=e.target.closest("[data-approve-purchase]");if(approve){await updatePurchase(approve.dataset.approvePurchase,"approved");return;}
    const reject=e.target.closest("[data-reject-purchase]");if(reject){await updatePurchase(reject.dataset.rejectPurchase,"rejected");return;}
  });
  document.addEventListener("change",e=>{const sale=e.target.closest("#bookForSale");if(sale)$("#bookPriceWrap").classList.toggle("hidden",!sale.checked);const sel=e.target.closest("[data-rate]");if(sel)rateBook(sel.dataset.rate,sel.value);});
  document.addEventListener("submit",async e=>{if(e.target.id==="readerRatingForm"){e.preventDefault();const value=$("#readerRatingValue").value;if(!value){toast("Pilih bintang 1 sampai 5 dulu ya.");return;}await rateBook(e.target.dataset.ratingBook,value,$("#readerReviewText").value);}});
  $("#globalSearch").addEventListener("input",e=>{searchQuery=e.target.value;$("#pageSearch").value=searchQuery;renderAll();if(searchQuery)goToPage("search");});
  $("#pageSearch").addEventListener("input",e=>{searchQuery=e.target.value;$("#globalSearch").value=searchQuery;renderAll();});
  $("#closePurchase").addEventListener("click",()=>$("#purchaseModal").classList.add("hidden"));
  $("#purchaseModal").addEventListener("click",e=>{if(e.target===$("#purchaseModal"))$("#purchaseModal").classList.add("hidden");});
  $("#purchaseForm").addEventListener("submit",submitPurchase);
  $("#saveSiteBanner").addEventListener("click",saveSiteBanner);
  $("#siteBannerFile").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;$("#siteBannerPreview").src=URL.createObjectURL(f);$("#siteBannerPreviewWrap").classList.remove("hidden");});
  $("#memberBookSearch").addEventListener("input",loadMemberCenter);
  for(const [inputId,previewId,wrapId] of [["bookCoverFile","bookCoverPreview","coverPreviewWrap"],["profilePhotoFile","profilePhotoPreview","profilePhotoPreviewWrap"],["profileBannerFile","profileBannerPreview","profileBannerPreviewWrap"],["profileQrisFile","profileQrisPreview","profileQrisPreviewWrap"]]){$("#"+inputId).addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);$("#"+previewId).src=url;$("#"+wrapId).classList.remove("hidden");});}
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
