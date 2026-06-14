// FIREBASE MODÜLLERİ (Storage Eklendi)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// BURAYA KENDİ FIREBASE ANAHTARLARINI YAPIŞTIR
const firebaseConfig = {
    apiKey: "SENIN_API_KEY",
    authDomain: "SENIN_DOMAIN",
    projectId: "SENIN_PROJECT_ID",
    storageBucket: "SENIN_STORAGE_BUCKET",
    messagingSenderId: "SENIN_SENDER_ID",
    appId: "SENIN_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Storage modülünü başlattık

let currentUser = null;
let kategoriler = []; let altKategoriler = []; let icerikler = [];
let aktifKat = null; let aktifAltKat = null; let acikIcerikId = null;

const authEkrani = document.getElementById('authEkrani');
const anaUygulama = document.getElementById('anaUygulama');
const girisFormu = document.getElementById('girisFormu');
const kayitFormu = document.getElementById('kayitFormu');
const sifreFormu = document.getElementById('sifreFormu');
const authMesaj = document.getElementById('authMesaj');

// BİLDİRİM VE ŞİFRE MANTIĞI (Senkronize Sistem)
function mesajGoster(metin, tur) {
    authMesaj.innerText = metin;
    authMesaj.className = tur === 'hata' ? 'mesaj-hata' : 'mesaj-basari'; // Apple Bilgi Mavisi
    authMesaj.style.display = 'block';
}

const girisSifre = document.getElementById('girisSifre');
const toggleGirisSifre = document.getElementById('toggleGirisSifre');
if (toggleGirisSifre && girisSifre) {
    toggleGirisSifre.addEventListener('click', () => {
        const isPassword = girisSifre.type === 'password';
        girisSifre.type = isPassword ? 'text' : 'password';
        toggleGirisSifre.innerText = isPassword ? 'Gizle' : 'Göster';
    });
}

const kayitSifre = document.getElementById('kayitSifre');
const kayitSifreTekrar = document.getElementById('kayitSifreTekrar');
const toggleKayitSifre = document.getElementById('toggleKayitSifre');
const toggleKayitSifreTekrar = document.getElementById('toggleKayitSifreTekrar');

function kayitSifreleriniToggleEt() {
    if (kayitSifre && kayitSifreTekrar) {
        const isPassword = kayitSifre.type === 'password';
        const yeniTip = isPassword ? 'text' : 'password';
        const yeniMetin = isPassword ? 'Gizle' : 'Göster';
        
        kayitSifre.type = yeniTip; kayitSifreTekrar.type = yeniTip;
        if (toggleKayitSifre) toggleKayitSifre.innerText = yeniMetin;
        if (toggleKayitSifreTekrar) toggleKayitSifreTekrar.innerText = yeniMetin;
    }
}
if (toggleKayitSifre) toggleKayitSifre.addEventListener('click', kayitSifreleriniToggleEt);
if (toggleKayitSifreTekrar) toggleKayitSifreTekrar.addEventListener('click', kayitSifreleriniToggleEt);

document.getElementById('gitKayitOl').onclick = () => { girisFormu.style.display = 'none'; kayitFormu.style.display = 'block'; authMesaj.style.display = 'none'; };
document.getElementById('gitGirisYap').onclick = () => { kayitFormu.style.display = 'none'; girisFormu.style.display = 'block'; authMesaj.style.display = 'none'; };
document.getElementById('gitSifreSifirla').onclick = () => { girisFormu.style.display = 'none'; sifreFormu.style.display = 'block'; authMesaj.style.display = 'none'; };
document.getElementById('gitGirisYap2').onclick = () => { sifreFormu.style.display = 'none'; girisFormu.style.display = 'block'; authMesaj.style.display = 'none'; };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user; authEkrani.style.display = 'none'; anaUygulama.style.display = 'block';
        await verileriBuluttanGetir();
    } else {
        currentUser = null; authEkrani.style.display = 'flex'; anaUygulama.style.display = 'none';
        kategoriler = []; altKategoriler = []; icerikler = [];
    }
});

const gucMetni = document.getElementById('gucMetni');
const barlar = [document.getElementById('bar1'), document.getElementById('bar2'), document.getElementById('bar3'), document.getElementById('bar4'), document.getElementById('bar5')];
if(kayitSifre) {
    kayitSifre.addEventListener('input', (e) => {
        const val = e.target.value; let score = 0;
        if (val.length > 0) score++; if (val.length >= 6) score++;
        if (val.length >= 8 && /[A-Z]/.test(val)) score++;
        if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
        if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;
        barlar.forEach(b => b.style.backgroundColor = "var(--border-color)");
        const renkler = ["#ff3b30", "#ff9f0a", "#ffd60a", "#34c759", "#30b058"];
        const metinler = ["Çok Zayıf", "Zayıf", "Uyumlu", "Güvenli", "Çok Güvenli"];
        if (score > 0) { for (let i = 0; i < score; i++) barlar[i].style.backgroundColor = renkler[score - 1]; gucMetni.innerText = metinler[score - 1]; gucMetni.style.color = renkler[score - 1]; } 
        else { gucMetni.innerText = "Şifre Gücü"; gucMetni.style.color = "var(--text-muted)"; }
    });
}

document.getElementById('kayitBtn').addEventListener('click', () => {
    const email = document.getElementById('kayitEmail').value; const sifre = kayitSifre.value; const sifreTekrar = document.getElementById('kayitSifreTekrar').value;
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(sifre)) { mesajGoster("Şifreniz zayıf! Lütfen kurallara uygun bir şifre belirleyin.", "hata"); return; }
    if (sifre !== sifreTekrar) { mesajGoster("Şifreler uyuşmuyor! Lütfen iki alana da aynı şifreyi girin.", "hata"); return; }
    createUserWithEmailAndPassword(auth, email, sifre).then(() => mesajGoster("Hesap başarıyla oluşturuldu! Giriş yapılıyor...", "basari")).catch(error => mesajGoster("Kayıt Hatası: " + error.message, "hata"));
});

document.getElementById('girisBtn').addEventListener('click', () => {
    const email = document.getElementById('girisEmail').value; const sifre = girisSifre.value;
    signInWithEmailAndPassword(auth, email, sifre).catch(error => mesajGoster("Giriş Hatası: Bilgiler hatalı veya hesap yok.", "hata"));
});

document.getElementById('sifreSifirlaBtn').addEventListener('click', () => {
    const email = document.getElementById('sifreSifirlaEmail').value;
    if (!email) { mesajGoster("Lütfen kayıtlı e-posta adresinizi girin.", "hata"); return; }
    sendPasswordResetEmail(auth, email).then(() => mesajGoster("Şifre sıfırlama linki e-posta adresinize gönderildi.", "basari")).catch(error => mesajGoster("Hata: " + error.message, "hata"));
});

document.getElementById('cikisBtn').addEventListener('click', () => signOut(auth));

// BULUT VERİTABANI VE İŞLEMLER
const grid = document.getElementById('kutuphaneGrid'); const breadcrumb = document.getElementById('breadcrumb');
const detayModal = document.getElementById('detayModal'); const yeniIcerikModal = document.getElementById('yeniIcerikModal'); const klasorModal = document.getElementById('klasorModal');

async function verileriBuluttanGetir() {
    if (!currentUser) return;
    try { const docRef = doc(db, "users", currentUser.uid); const docSnap = await getDoc(docRef);
        if (docSnap.exists()) { const data = docSnap.data(); kategoriler = data.kategoriler || []; altKategoriler = data.altKategoriler || []; icerikler = data.icerikler || []; }
        ekranıGuncelle();
    } catch (e) { console.error("Veri çekme hatası:", e); }
}

async function verileriBulutaKaydet() {
    if (!currentUser) return;
    try { await setDoc(doc(db, "users", currentUser.uid), { kategoriler, altKategoriler, icerikler }); } catch (e) { console.error("Kaydetme hatası:", e); }
}

let localDB; const request = indexedDB.open("StuffdDB", 1);
request.onupgradeneeded = (e) => { localDB = e.target.result; if (!localDB.objectStoreNames.contains("pdfs")) localDB.createObjectStore("pdfs"); };
request.onsuccess = (e) => { localDB = e.target.result; };
function pdfKaydet(id, file) { const transaction = localDB.transaction(["pdfs"], "readwrite"); transaction.objectStore("pdfs").put(file, id); }
function pdfSil(id) { const transaction = localDB.transaction(["pdfs"], "readwrite"); transaction.objectStore("pdfs").delete(id); }

function ekranıGuncelle() {
    grid.innerHTML = '';
    let navHtml = `<span class="yol-elemani" onclick="gitAnaSayfa()">Ana Sayfa</span>`;
    if (aktifKat) navHtml += `<span class="ayirici">/</span><span class="yol-elemani" onclick="gitKategori()">${aktifKat.ad}</span>`;
    if (aktifAltKat) navHtml += `<span class="ayirici">/</span><span class="yol-elemani">${aktifAltKat.ad}</span>`;
    breadcrumb.innerHTML = navHtml;

    if (!aktifKat) {
        if(kategoriler.length === 0) grid.innerHTML = '<p style="color:var(--text-muted);">Henüz klasör yok. Yeni ekle butonundan başlayabilirsin.</p>';
        kategoriler.forEach(kat => {
            const card = document.createElement('div'); card.className = 'card';
            card.innerHTML = `<button class="sil-btn" onclick="silKategori(event, ${kat.id})">&times;</button><div class="folder-icon">📁</div><h2 class="title">${kat.ad}</h2>`;
            card.onclick = () => { aktifKat = kat; ekranıGuncelle(); }; grid.appendChild(card);
        });
    } else if (!aktifAltKat) {
        const buKlasordekiler = altKategoriler.filter(ak => ak.ustId === aktifKat.id);
        if(buKlasordekiler.length === 0) grid.innerHTML = '<p style="color:var(--text-muted);">Bu klasör boş.</p>';
        buKlasordekiler.forEach(altKat => {
            const card = document.createElement('div'); card.className = 'card';
            
            // Eğer fotoğraflı bir alt menü ise arka plana fotoğrafı basıyoruz
            if (altKat.imgUrl) {
                card.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url('${altKat.imgUrl}')`;
                card.style.backgroundSize = 'cover';
                card.style.backgroundPosition = 'center';
                card.style.color = 'white';
                card.innerHTML = `<button class="sil-btn" onclick="silAltKategori(event, ${altKat.id})">&times;</button><div class="folder-icon" style="opacity:0;">📂</div><h2 class="title" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${altKat.ad}</h2>`;
            } else {
                card.innerHTML = `<button class="sil-btn" onclick="silAltKategori(event, ${altKat.id})">&times;</button><div class="folder-icon">📂</div><h2 class="title">${altKat.ad}</h2>`;
            }
            card.onclick = () => { aktifAltKat = altKat; ekranıGuncelle(); }; grid.appendChild(card);
        });
    } else {
        const buIcerikler = icerikler.filter(ic => ic.altId === aktifAltKat.id);
        if(buIcerikler.length === 0) grid.innerHTML = '<p style="color:var(--text-muted);">Henüz içerik eklenmemiş.</p>';
        buIcerikler.forEach(icerik => {
            const card = document.createElement('div'); card.className = 'card'; const etiketMetni = icerik.tur === 'pdf' ? "📄 PDF" : "📝 Not";
            card.innerHTML = `<button class="sil-btn" onclick="silIcerik(event, ${icerik.id})">&times;</button><span class="tag">${etiketMetni}</span><h2 class="title">${icerik.baslik}</h2>`;
            card.onclick = () => detaylariAc(icerik); grid.appendChild(card);
        });
    }
}

window.gitAnaSayfa = () => { aktifKat = null; aktifAltKat = null; ekranıGuncelle(); };
window.gitKategori = () => { aktifAltKat = null; ekranıGuncelle(); };
window.silKategori = (e, id) => { e.stopPropagation(); if(confirm("Klasör silinsin mi?")) { kategoriler = kategoriler.filter(k => k.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };
window.silAltKategori = (e, id) => { e.stopPropagation(); if(confirm("Alt klasör silinsin mi?")) { altKategoriler = altKategoriler.filter(ak => ak.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };
window.silIcerik = (e, id) => { e.stopPropagation(); if(confirm("İçerik silinsin mi?")) { const silinecek = icerikler.find(ic => ic.id === id); if (silinecek && silinecek.tur === 'pdf') pdfSil(id); icerikler = icerikler.filter(ic => ic.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };

document.getElementById('yeniEkleBtn').addEventListener('click', () => {
    if (!aktifKat || !aktifAltKat) {
        document.getElementById('klasorModalBaslik').innerText = !aktifKat ? "Yeni Ana Klasör" : "Yeni Alt Klasör";
        document.getElementById('klasorAdInput').value = "";
        
        // Eğer Alt Klasör ekranındaysak fotoğraf yükleme kutusunu göster
        const resimAlani = document.getElementById('klasorResimAlani');
        const resimInput = document.getElementById('klasorResimInput');
        if (aktifKat && !aktifAltKat) { resimAlani.style.display = 'block'; resimInput.value = ''; } 
        else { resimAlani.style.display = 'none'; resimInput.value = ''; }
        
        klasorModal.style.display = 'flex';
    } else {
        yeniIcerikModal.style.display = 'flex'; document.getElementById('yeniBaslik').value = ''; document.getElementById('yeniNot').value = ''; document.getElementById('yeniPdfDosya').value = '';
    }
});

// FOTOĞRAFLI ALT KLASÖR OLUŞTURMA MANTIĞI
document.getElementById('klasorOlusturBtn').addEventListener('click', async () => {
    const ad = document.getElementById('klasorAdInput').value.trim(); if(!ad) return;
    const btn = document.getElementById('klasorOlusturBtn');
    
    if (!aktifKat) { 
        kategoriler.push({ id: Date.now(), ad }); 
        verileriBulutaKaydet(); klasorModal.style.display = 'none'; ekranıGuncelle();
    } else if (!aktifAltKat) { 
        let imgUrl = null;
        const resimInput = document.getElementById('klasorResimInput');
        
        // Eğer fotoğraf seçilmişse Storage'a yüklüyoruz
        if (resimInput.files.length > 0) {
            btn.innerText = "Fotoğraf Yükleniyor..."; btn.disabled = true;
            const file = resimInput.files[0];
            const depolamaYolu = ref(storage, `users/${currentUser.uid}/folders/${Date.now()}_${file.name}`);
            try {
                await uploadBytes(depolamaYolu, file);
                imgUrl = await getDownloadURL(depolamaYolu);
            } catch (error) {
                console.error("Resim yükleme hatası:", error);
                alert("Resim yüklenemedi. Lütfen daha küçük bir dosya seçin.");
            }
            btn.innerText = "Oluştur"; btn.disabled = false;
        }
        
        altKategoriler.push({ id: Date.now(), ad, ustId: aktifKat.id, imgUrl: imgUrl });
        verileriBulutaKaydet(); klasorModal.style.display = 'none'; ekranıGuncelle();
    }
});

document.querySelectorAll('input[name="icerikTuru"]').forEach(btn => {
    btn.addEventListener('change', (e) => { document.getElementById('yaziliNotAlani').style.display = e.target.value === 'not' ? 'block' : 'none'; document.getElementById('pdfYuklemeAlani').style.display = e.target.value === 'not' ? 'none' : 'block'; });
});

document.getElementById('olusturBtn').addEventListener('click', () => {
    const baslik = document.getElementById('yeniBaslik').value; const tur = document.querySelector('input[name="icerikTuru"]:checked').value; if(!baslik) return;
    const icerikId = Date.now(); let yeni = { id: icerikId, baslik: baslik, altId: aktifAltKat.id, tur: tur, notlar: "" };
    if (tur === 'not') yeni.notlar = document.getElementById('yeniNot').value;
    else { const fileInput = document.getElementById('yeniPdfDosya'); if (fileInput.files.length > 0) pdfKaydet(icerikId, fileInput.files[0]); else { alert("Lütfen bir PDF seçin."); return; } }
    icerikler.push(yeni); verileriBulutaKaydet(); yeniIcerikModal.style.display = 'none'; ekranıGuncelle();
});

function detaylariAc(icerik) {
    acikIcerikId = icerik.id; document.getElementById('modalBaslik').innerText = icerik.baslik; document.getElementById('modalNotlar').value = icerik.notlar || "";
    const pdfGoruntule = document.getElementById('pdfGoruntuleAlani'); const pdfAcBtn = document.getElementById('pdfAcBtn'); const pdfIframe = document.getElementById('pdfIframe');
    if (icerik.tur === 'pdf') {
        pdfGoruntule.style.display = 'block'; pdfIframe.style.display = 'none'; pdfAcBtn.style.display = 'block';
        pdfAcBtn.onclick = (e) => { e.preventDefault(); const req = localDB.transaction(["pdfs"], "readonly").objectStore("pdfs").get(icerik.id); req.onsuccess = (e) => { if (e.target.result) { pdfIframe.src = URL.createObjectURL(e.target.result) + "#view=FitH"; pdfIframe.style.display = 'block'; pdfAcBtn.style.display = 'none'; } else alert("PDF bulunamadı."); }; };
    } else { pdfGoruntule.style.display = 'none'; pdfIframe.src = ""; }
    detayModal.style.display = 'flex';
}

document.getElementById('kaydetBtn').addEventListener('click', () => { const ic = icerikler.find(i => i.id === acikIcerikId); if(ic) { ic.notlar = document.getElementById('modalNotlar').value; verileriBulutaKaydet(); detayModal.style.display = 'none'; } });
['kapatDetayBtn', 'kapatYeniBtn', 'kapatKlasorBtn'].forEach(id => { document.getElementById(id).addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none'); });

const temaBtn = document.getElementById('temaBtn');
temaBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode'); const isLight = document.body.classList.contains('light-mode');
    temaBtn.innerText = isLight ? "🌙 Koyu Mod" : "☀️ Açık Mod"; localStorage.setItem('kutuphaneTema', isLight ? 'light' : 'dark');
});
if (localStorage.getItem('kutuphaneTema') === 'light') { document.body.classList.add('light-mode'); temaBtn.innerText = "🌙 Koyu Mod"; } 
else { document.body.classList.remove('light-mode'); temaBtn.innerText = "☀️ Açık Mod"; }
