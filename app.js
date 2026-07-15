import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCK3hB5I7XP4EETba2PjqChBeQR1rbbGdU",
  authDomain: "shelvd-d99e0.firebaseapp.com",
  projectId: "shelvd-d99e0",
  storageBucket: "shelvd-d99e0.firebasestorage.app",
  messagingSenderId: "392384969338",
  appId: "1:392384969338:web:35a290865aa081c7fad9c3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let currentUser = null;
let profil = { avatarUrl: "" }; // NICKNAME SİLİNDİ
let kategoriler = []; let altKategoriler = []; let icerikler = [];
let aktifKat = null; let aktifAltKat = null; let acikIcerikId = null;

// KROPPER İZOLASYONU
let aktifKropModu = null; // 'klasor' veya 'profil' olarak işaretlenecek
let klasorIcinGeciciResim = null;
let profilIcinGeciciResim = null;
let cropper = null;

const authEkrani = document.getElementById('authEkrani'); 
const anaUygulama = document.getElementById('anaUygulama');
const grid = document.getElementById('kutuphaneGrid'); 
const breadcrumb = document.getElementById('breadcrumb');
const geriDonBtn = document.getElementById('geriDonBtn');
const yukleniyorUyari = document.getElementById('yukleniyorUyari');

// Şifre Göster/Gizle
function toggleSifre(inputIds, toggleId) {
    const isPassword = document.getElementById(inputIds[0]).type === 'password';
    inputIds.forEach(id => document.getElementById(id).type = isPassword ? 'text' : 'password');
    document.getElementById(toggleId).innerText = isPassword ? 'Gizle' : 'Göster';
}
document.getElementById('toggleGirisSifre')?.addEventListener('click', () => toggleSifre(['girisSifre'], 'toggleGirisSifre'));
if(document.getElementById('toggleKayitSifre')) {
    document.getElementById('toggleKayitSifre').addEventListener('click', () => toggleSifre(['kayitSifre', 'kayitSifreTekrar'], 'toggleKayitSifre'));
    document.getElementById('toggleKayitSifreTekrar').addEventListener('click', () => toggleSifre(['kayitSifre', 'kayitSifreTekrar'], 'toggleKayitSifreTekrar'));
}

// 1. GÜVENLİ KAYIT VE MAİL DOĞRULAMA
document.getElementById('kayitBtn').addEventListener('click', async () => {
    const email = document.getElementById('kayitEmail').value.trim();
    const sifre = document.getElementById('kayitSifre').value;
    const sifre2 = document.getElementById('kayitSifreTekrar').value;
    const btn = document.getElementById('kayitBtn');
    
    if(!email || !sifre) return alert("Lütfen tüm alanları doldurun.");
    if(sifre !== sifre2) return alert("Şifreler eşleşmiyor!");
    
    // ŞİFRE GÜVENLİK TESTİ (Min 8 karakter, 1 Büyük Harf, 1 Rakam)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/;
    if (!passwordRegex.test(sifre)) {
        return alert("Güvenlik Hatası: Şifreniz en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir.");
    }
    
    btn.innerText = "Hesap Oluşturuluyor..."; btn.disabled = true;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
        
        // Veritabanı iskeletini oluştur (Nickname yok)
        await setDoc(doc(db, "users", userCredential.user.uid), { 
            kategoriler: [], altKategoriler: [], icerikler: [], profil: { avatarUrl: "" } 
        });
        
        // Doğrulama Maili Gönder
        await sendEmailVerification(userCredential.user);
        
        alert("Hesap başarıyla oluşturuldu! Lütfen giriş yapmadan önce e-posta adresinize gelen linke tıklayarak hesabınızı doğrulayın.");
        
        await signOut(auth); // Doğrulamadan girmesini engellemek için çıkış yap
        
        document.getElementById('kayitFormu').style.display = 'none'; 
        document.getElementById('girisFormu').style.display = 'block';
        btn.innerText = "Hesap Oluştur"; btn.disabled = false;
        
    } catch (error) {
        alert("Kayıt başarısız: " + error.message);
        btn.innerText = "Hesap Oluştur"; btn.disabled = false;
    }
});

// GİRİŞ YAPMA (DOĞRULAMA KONTROLÜ İLE)
document.getElementById('girisBtn').addEventListener('click', async () => {
    const email = document.getElementById('girisEmail').value.trim();
    const sifre = document.getElementById('girisSifre').value;
    const hatirla = document.getElementById('beniHatirla').checked;
    const persType = hatirla ? browserLocalPersistence : browserSessionPersistence;
    
    try {
        await setPersistence(auth, persType);
        const userCredential = await signInWithEmailAndPassword(auth, email, sifre);
        
        // Mail onaylanmamışsa içeri alma
        if (!userCredential.user.emailVerified) {
            alert("Giriş Engellendi: Lütfen e-posta adresinize gelen doğrulama linkine tıklayarak hesabınızı aktifleştirin.");
            await signOut(auth);
            return;
        }
    } catch (error) {
        alert("Giriş başarısız. Bilgilerinizi kontrol edin.");
    }
});

// Şifre Sıfırlama
document.getElementById('sifreSifirlaBtn').addEventListener('click', () => {
    const email = document.getElementById('sifreSifirlaEmail').value.trim();
    if(!email) return alert("E-posta adresinizi girin.");
    sendPasswordResetEmail(auth, email).then(() => {
        alert("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
        document.getElementById('sifreFormu').style.display = 'none'; document.getElementById('girisFormu').style.display = 'block';
    }).catch(e => alert("Hata: " + e.message));
});

onAuthStateChanged(auth, async (user) => {
    if (user && user.emailVerified) { 
        currentUser = user; 
        authEkrani.style.display = 'none'; 
        anaUygulama.style.display = 'block'; 
        await verileriBuluttanGetir(); 
    } else { 
        currentUser = null; 
        authEkrani.style.display = 'flex'; 
        anaUygulama.style.display = 'none'; 
        gitAnaSayfa(); 
    }
});

// 2. SENKRONİZASYON TAMİRİ
async function verileriBuluttanGetir() {
    if (!currentUser) return;
    
    yukleniyorUyari.style.display = 'block'; // Yükleniyor yazısını göster
    grid.innerHTML = '';
    
    try { 
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) { 
            const data = docSnap.data(); 
            kategoriler = data.kategoriler || []; 
            altKategoriler = data.altKategoriler || []; 
            icerikler = data.icerikler || []; 
            profil = data.profil || { avatarUrl: "" };
        } else {
            await setDoc(docRef, { kategoriler: [], altKategoriler: [], icerikler: [], profil: { avatarUrl: "" } });
            kategoriler = []; altKategoriler = []; icerikler = []; profil = { avatarUrl: "" };
        }
        yukleniyorUyari.style.display = 'none'; // Yükleniyor yazısını kaldır
        profilArayuzunuGuncelle();
        ekranıGuncelle();
    } catch (e) { 
        console.error("Bulut Bağlantı Hatası:", e); 
        yukleniyorUyari.innerText = "Bulut bağlantısında sorun oluştu. Sayfayı yenileyin.";
    }
}

async function verileriBulutaKaydet() { 
    if (currentUser) {
        try { await setDoc(doc(db, "users", currentUser.uid), { kategoriler, altKategoriler, icerikler, profil }); } 
        catch (e) { console.error("Veri kaydetme hatası:", e); }
    }
}

// 3. PROFİL İŞLEMLERİ (SADELEŞTİRİLDİ)
function profilArayuzunuGuncelle() {
    // Nickname olmadığı için mailin @ işaretinden önceki kısmını alıyoruz
    const displayIsim = currentUser.email.split('@')[0];
    document.getElementById('headerNick').innerText = displayIsim;
    
    const defaultSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238AA1B1'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    
    document.getElementById('headerAvatar').src = profil.avatarUrl || defaultSvg;
    document.getElementById('profilAvatarOnizleme').src = profil.avatarUrl || defaultSvg;
}

document.getElementById('profilAcBtn').addEventListener('click', () => {
    profilIcinGeciciResim = null; // Menü açılırken hafızayı temizle
    document.getElementById('profilModal').style.display = 'flex';
});

document.getElementById('cikisBtn').addEventListener('click', () => signOut(auth));

document.getElementById('profilKaydetBtn').addEventListener('click', async () => {
    const btn = document.getElementById('profilKaydetBtn');
    
    // Sadece eğer yeni bir resim seçilip KIRPILDIYSA işlem yap
    if (profilIcinGeciciResim) {
        btn.innerText = "Fotoğraf Yükleniyor..."; btn.disabled = true;
        const yol = ref(storage, `users/${currentUser.uid}/profile/avatar_${Date.now()}.jpg`);
        await uploadBytes(yol, profilIcinGeciciResim);
        profil.avatarUrl = await getDownloadURL(yol);
        profilIcinGeciciResim = null; // İşlem bitti, hafızayı sil
        await verileriBulutaKaydet();
    }
    
    profilArayuzunuGuncelle();
    btn.innerText = "Değişiklikleri Kaydet"; btn.disabled = false;
    document.getElementById('profilModal').style.display = 'none';
});

// 4. KROPPER (İki Sistemi Birbirinden %100 Ayırma)
const cropperImage = document.getElementById('cropperImage');
const cropperModal = document.getElementById('cropperModal');

// Ortak çalıştırıcı fonksiyon
function baslatCropper(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            cropperImage.src = event.target.result; cropperModal.style.display = 'flex';
            if(cropper) cropper.destroy(); 
            cropper = new Cropper(cropperImage, { aspectRatio: 1, viewMode: 1 });
            
            // Eğer profil seçiliyorsa arka plandaki profil modalını gizle
            if (aktifKropModu === 'profil') document.getElementById('profilModal').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// Hangi input'tan geldiyse modu belirle ve başlat
document.getElementById('klasorResimInput').addEventListener('change', (e) => { aktifKropModu = 'klasor'; baslatCropper(e); });
document.getElementById('duzenleResimInput').addEventListener('change', (e) => { aktifKropModu = 'klasor'; baslatCropper(e); });
document.getElementById('profilAvatarInput').addEventListener('change', (e) => { aktifKropModu = 'profil'; baslatCropper(e); });

// Kırpma Onayı
document.getElementById('cropUygulaBtn').addEventListener('click', () => { 
    if(!cropper) return;
    cropper.getCroppedCanvas({width: 600, height: 600}).toBlob((blob) => { 
        cropperModal.style.display = 'none'; 
        
        // Hangi moddaysak sadece onun hafızasına yaz. Diğerine ASLA dokunma.
        if(aktifKropModu === 'profil') {
            profilIcinGeciciResim = blob;
            document.getElementById('profilModal').style.display = 'flex'; // Profil modalını geri aç
            document.getElementById('profilAvatarOnizleme').src = URL.createObjectURL(blob); // Önizlemeyi göster
        } 
        else if (aktifKropModu === 'klasor') {
            klasorIcinGeciciResim = blob;
        }
        
    }, 'image/jpeg', 0.8); 
});

// ARAYÜZ, KLASÖR VE İÇERİK YÖNETİMİ (Değişmedi)
function ekranıGuncelle() {
    grid.innerHTML = ''; 
    let navHtml = `<span class="yol-elemani" onclick="gitAnaSayfa()">Ana Sayfa</span>`;
    if (aktifKat) navHtml += `<span class="ayirici">/</span><span class="yol-elemani" onclick="gitKategori()">${aktifKat.ad}</span>`;
    if (aktifAltKat) navHtml += `<span class="ayirici">/</span><span class="yol-elemani">${aktifAltKat.ad}</span>`;
    breadcrumb.innerHTML = navHtml;
    
    if (aktifAltKat) { geriDonBtn.style.display = 'block'; geriDonBtn.onclick = () => gitKategori(); } 
    else if (aktifKat) { geriDonBtn.style.display = 'block'; geriDonBtn.onclick = () => gitAnaSayfa(); } 
    else { geriDonBtn.style.display = 'none'; }

    if (!aktifKat) {
        kategoriler.forEach(kat => {
            const card = document.createElement('div'); card.className = 'card';
            card.innerHTML = `<button class="sil-btn" onclick="silKategori(event, ${kat.id})">&times;</button>
                              <button class="duzenle-btn" onclick="duzenleKategori(event, ${kat.id}, 'ana')">✏️</button>
                              <div class="folder-icon">📁</div><h2 class="title">${kat.ad}</h2>`;
            card.onclick = () => { aktifKat = kat; ekranıGuncelle(); }; grid.appendChild(card);
        });
    } else if (!aktifAltKat) {
        altKategoriler.filter(ak => ak.ustId === aktifKat.id).forEach(altKat => {
            const card = document.createElement('div'); card.className = 'card';
            if (altKat.imgUrl) {
                card.style.backgroundImage = `linear-gradient(to bottom, rgba(11, 19, 43, 0.4), rgba(11, 19, 43, 0.9)), url('${altKat.imgUrl}')`;
                card.style.backgroundSize = 'cover'; card.style.backgroundPosition = 'center'; card.style.color = 'white';
                card.innerHTML = `<button class="sil-btn" onclick="silAltKategori(event, ${altKat.id})">&times;</button>
                                  <button class="duzenle-btn" onclick="duzenleKategori(event, ${altKat.id}, 'alt')">✏️</button>
                                  <h2 class="title" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${altKat.ad}</h2>`;
            } else { 
                card.innerHTML = `<button class="sil-btn" onclick="silAltKategori(event, ${altKat.id})">&times;</button>
                                  <button class="duzenle-btn" onclick="duzenleKategori(event, ${altKat.id}, 'alt')">✏️</button>
                                  <div class="folder-icon">📂</div><h2 class="title">${altKat.ad}</h2>`; 
            }
            card.onclick = () => { aktifAltKat = altKat; ekranıGuncelle(); }; grid.appendChild(card);
        });
    } else {
        icerikler.filter(ic => ic.altId === aktifAltKat.id).forEach(icerik => {
            const card = document.createElement('div'); card.className = 'card'; 
            const etiket = icerik.tur === 'pdf' ? "PDF" : "Not";
            card.innerHTML = `<button class="sil-btn" onclick="silIcerik(event, ${icerik.id})">&times;</button><span class="tag">${etiket}</span><h2 class="title">${icerik.baslik}</h2>`;
            card.onclick = () => detaylariAc(icerik); grid.appendChild(card);
        });
    }
}

window.gitAnaSayfa = () => { aktifKat = null; aktifAltKat = null; ekranıGuncelle(); };
window.gitKategori = () => { aktifAltKat = null; ekranıGuncelle(); };
window.silKategori = (e, id) => { e.stopPropagation(); if(confirm("Klasör silinsin mi?")) { kategoriler = kategoriler.filter(k => k.id !== id); altKategoriler = altKategoriler.filter(ak => ak.ustId !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };
window.silAltKategori = (e, id) => { e.stopPropagation(); if(confirm("Alt klasör silinsin mi?")) { altKategoriler = altKategoriler.filter(ak => ak.id !== id); icerikler = icerikler.filter(ic => ic.altId !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };
window.silIcerik = (e, id) => { e.stopPropagation(); if(confirm("İçerik silinsin mi?")) { icerikler = icerikler.filter(ic => ic.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };

let duzenlenenId = null; let duzenlenenTur = null;
window.duzenleKategori = (e, id, tur) => {
    e.stopPropagation(); duzenlenenId = id; duzenlenenTur = tur; klasorIcinGeciciResim = null; document.getElementById('duzenleResimInput').value = '';
    if (tur === 'ana') {
        const kat = kategoriler.find(k => k.id === id); document.getElementById('duzenleAdInput').value = kat.ad; document.getElementById('duzenleResimAlani').style.display = 'none';
    } else {
        const altKat = altKategoriler.find(ak => ak.id === id); document.getElementById('duzenleAdInput').value = altKat.ad; document.getElementById('duzenleResimAlani').style.display = 'block';
    }
    document.getElementById('klasorDuzenleModal').style.display = 'flex';
};

document.getElementById('klasorGuncelleBtn').addEventListener('click', async () => {
    const yeniAd = document.getElementById('duzenleAdInput').value.trim(); if (!yeniAd) return;
    const btn = document.getElementById('klasorGuncelleBtn');
    
    if (duzenlenenTur === 'ana') {
        const kat = kategoriler.find(k => k.id === duzenlenenId); if(kat) kat.ad = yeniAd;
    } else {
        const altKat = altKategoriler.find(ak => ak.id === duzenlenenId);
        if(altKat) {
            altKat.ad = yeniAd;
            // SADECE klasör hafızasında resim varsa Firebase'e yükle
            if (klasorIcinGeciciResim) {
                btn.innerText = "Yükleniyor..."; btn.disabled = true;
                const yol = ref(storage, `users/${currentUser.uid}/folders/${Date.now()}_guncel.jpg`);
                await uploadBytes(yol, klasorIcinGeciciResim); altKat.imgUrl = await getDownloadURL(yol);
                btn.innerText = "Değişiklikleri Kaydet"; btn.disabled = false;
                klasorIcinGeciciResim = null; // Temizle
            }
        }
    }
    verileriBulutaKaydet(); document.getElementById('klasorDuzenleModal').style.display = 'none'; ekranıGuncelle();
});

document.getElementById('yeniEkleBtn').addEventListener('click', () => {
    if (!aktifKat || !aktifAltKat) {
        document.getElementById('klasorModalBaslik').innerText = !aktifKat ? "Yeni Ana Klasör" : "Yeni Alt Klasör";
        document.getElementById('klasorResimAlani').style.display = (!aktifKat) ? 'none' : 'block';
        klasorIcinGeciciResim = null; document.getElementById('klasorResimInput').value = ''; document.getElementById('klasorAdInput').value = '';
        document.getElementById('klasorModal').style.display = 'flex';
    } else { document.getElementById('yeniIcerikModal').style.display = 'flex'; }
});

document.getElementById('klasorOlusturBtn').addEventListener('click', async () => {
    const ad = document.getElementById('klasorAdInput').value.trim(); if(!ad) return;
    const btn = document.getElementById('klasorOlusturBtn');
    const folderId = Date.now();

    if (!aktifKat) { kategoriler.push({ id: folderId, ad }); } 
    else if (!aktifAltKat) { 
        let imgUrl = null;
        if (klasorIcinGeciciResim) { 
            btn.innerText = "Yükleniyor..."; btn.disabled = true;
            const yol = ref(storage, `users/${currentUser.uid}/folders/${folderId}.jpg`);
            await uploadBytes(yol, klasorIcinGeciciResim); imgUrl = await getDownloadURL(yol);
            btn.innerText = "Oluştur"; btn.disabled = false;
            klasorIcinGeciciResim = null;
        }
        altKategoriler.push({ id: folderId, ad, ustId: aktifKat.id, imgUrl }); 
    }
    verileriBulutaKaydet(); document.getElementById('klasorModal').style.display = 'none'; ekranıGuncelle();
});

document.querySelectorAll('input[name="icerikTuru"]').forEach(btn => { 
    btn.addEventListener('change', (e) => { 
        document.getElementById('yaziliNotAlani').style.display = e.target.value === 'not' ? 'block' : 'none'; 
        document.getElementById('pdfYuklemeAlani').style.display = e.target.value === 'not' ? 'none' : 'block'; 
    }); 
});

document.getElementById('olusturBtn').addEventListener('click', async () => {
    const baslik = document.getElementById('yeniBaslik').value.trim(); 
    const tur = document.querySelector('input[name="icerikTuru"]:checked').value; 
    if(!baslik) return;
    const btn = document.getElementById('olusturBtn'); const icerikId = Date.now(); 
    let yeni = { id: icerikId, baslik, altId: aktifAltKat.id, tur, notlar: "", kaldigiSayfa: 1, toplamSayfa: 0 };

    if (tur === 'not') { 
        yeni.notlar = document.getElementById('yeniNot').value; 
    } else { 
        const file = document.getElementById('yeniPdfDosya').files[0]; 
        if(!file) return alert("Lütfen PDF seçin.");
        btn.innerText = "Hesaplanıyor..."; btn.disabled = true;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfData = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            yeni.toplamSayfa = pdfData.numPages;
            
            btn.innerText = "Buluta Yükleniyor...";
            const yol = ref(storage, `users/${currentUser.uid}/pdfs/${icerikId}_${file.name}`);
            await uploadBytes(yol, file); yeni.pdfUrl = await getDownloadURL(yol);
        } catch (e) { alert("Yükleme Hatası!"); console.error(e); btn.innerText = "Buluta Yükle ve Oluştur"; btn.disabled = false; return; }
    }
    icerikler.push(yeni); verileriBulutaKaydet(); 
    document.getElementById('yeniIcerikModal').style.display = 'none'; ekranıGuncelle();
    btn.innerText = "Buluta Yükle ve Oluştur"; btn.disabled = false;
});

// PDF OKUYUCU MANTIĞI
let pdfDoc = null; let sayfaNo = 1; let okunanPdfUrl = null;
const canvasSol = document.getElementById('pdfCanvasSol'); const ctxSol = canvasSol.getContext('2d');
const canvasSag = document.getElementById('pdfCanvasSag'); const ctxSag = canvasSag.getContext('2d');
const pdfKitapModal = document.getElementById('pdfKitapModal');

function detaylariAc(icerik) {
    acikIcerikId = icerik.id; 
    document.getElementById('modalBaslik').innerText = icerik.baslik; 
    document.getElementById('modalNotlar').value = icerik.notlar || "";
    const pdfAcBtn = document.getElementById('pdfAcBtn');
    const cemberAlani = document.getElementById('pdfİlerlemeAlani');
    
    if (icerik.tur === 'pdf') { 
        pdfAcBtn.style.display = 'block'; okunanPdfUrl = icerik.pdfUrl; cemberAlani.style.display = 'block';
        const toplam = icerik.toplamSayfa || 1;
        const kalinan = icerik.kaldigiSayfa || 1;
        const yuzde = Math.round((kalinan / toplam) * 100);
        document.getElementById('ilerlemeYuzdeYazi').innerText = `%${yuzde}`;
        document.getElementById('ilerlemeCemberi').style.background = `conic-gradient(var(--folder-color) ${yuzde}%, var(--tag-bg) 0%)`;
    } else { 
        pdfAcBtn.style.display = 'none'; okunanPdfUrl = null; cemberAlani.style.display = 'none';
    }
    document.getElementById('detayModal').style.display = 'flex';
}

document.getElementById('pdfAcBtn').addEventListener('click', () => {
    pdfKitapModal.style.display = 'flex'; document.getElementById('pdfSayfaBilgi').innerText = "Yükleniyor...";
    pdfjsLib.getDocument(okunanPdfUrl).promise.then(pdf => { 
        pdfDoc = pdf; const ic = icerikler.find(i => i.id === acikIcerikId);
        sayfaNo = ic.kaldigiSayfa || 1; pdfSayfalariCiz(); 
    }).catch(err => { console.error(err); alert("PDF yüklenirken sorun oluştu."); });
});

function pdfSayfalariCiz() {
    if(!pdfDoc) return;
    const genisEkran = window.innerWidth > 768; 
    const hY = document.getElementById('pdfHeaderArea').offsetHeight;
    const maksH = window.innerHeight - hY - 40; 
    pdfDoc.getPage(sayfaNo).then(page => { 
        const hamViewport = page.getViewport({ scale: 1.0 }); const dScale = maksH / hamViewport.height; 
        const viewport = page.getViewport({ scale: dScale }); 
        canvasSol.height = viewport.height; canvasSol.width = viewport.width; page.render({ canvasContext: ctxSol, viewport: viewport }); 
    });
    if (genisEkran && sayfaNo + 1 <= pdfDoc.numPages) {
        canvasSag.style.display = 'block';
        pdfDoc.getPage(sayfaNo + 1).then(page => { 
            const hamViewport = page.getViewport({ scale: 1.0 }); const dScale = maksH / hamViewport.height;
            const viewport = page.getViewport({ scale: dScale }); 
            canvasSag.height = viewport.height; canvasSag.width = viewport.width; page.render({ canvasContext: ctxSag, viewport: viewport }); 
        });
        document.getElementById('pdfSayfaBilgi').innerText = `Sayfa ${sayfaNo} - ${sayfaNo + 1} / ${pdfDoc.numPages}`;
    } else { canvasSag.style.display = 'none'; document.getElementById('pdfSayfaBilgi').innerText = `Sayfa ${sayfaNo} / ${pdfDoc.numPages}`; }
}

window.addEventListener('resize', () => { if(pdfKitapModal.style.display === 'flex') pdfSayfalariCiz(); });

document.getElementById('pdfKitapKapatBtn').addEventListener('click', () => {
    pdfKitapModal.style.display = 'none'; const ic = icerikler.find(i => i.id === acikIcerikId);
    if(ic) { ic.kaldigiSayfa = sayfaNo; verileriBulutaKaydet(); detaylariAc(ic); }
});

function pdfIleriGit() { const adim = window.innerWidth > 768 ? 2 : 1; if (sayfaNo + adim <= pdfDoc.numPages) { sayfaNo += adim; pdfSayfalariCiz(); } }
function pdfGeriGit() { const adim = window.innerWidth > 768 ? 2 : 1; if (sayfaNo - adim >= 1) { sayfaNo -= adim; pdfSayfalariCiz(); } }
document.getElementById('pdfIleriBtn').addEventListener('click', pdfIleriGit);
document.getElementById('pdfGeriBtn').addEventListener('click', pdfGeriGit);
window.addEventListener('keydown', (e) => {
    if (pdfKitapModal.style.display === 'flex') { if (e.key === 'ArrowRight') pdfIleriGit(); if (e.key === 'ArrowLeft') pdfGeriGit(); }
});

document.getElementById('kaydetBtn').addEventListener('click', () => { const ic = icerikler.find(i => i.id === acikIcerikId); if(ic) { ic.notlar = document.getElementById('modalNotlar').value; verileriBulutaKaydet(); document.getElementById('detayModal').style.display = 'none'; } });

// MODAL KAPATMALARI VE UI LİNKLERİ
['kapatDetayBtn', 'kapatYeniBtn', 'kapatKlasorBtn', 'kapatDuzenleBtn', 'kapatProfilBtn'].forEach(id => { document.getElementById(id)?.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none'); });
document.getElementById('gitKayitOl').onclick = () => { document.getElementById('girisFormu').style.display = 'none'; document.getElementById('kayitFormu').style.display = 'block'; };
document.getElementById('gitGirisYap').onclick = () => { document.getElementById('kayitFormu').style.display = 'none'; document.getElementById('girisFormu').style.display = 'block'; };
document.getElementById('gitSifreSifirla').onclick = () => { document.getElementById('girisFormu').style.display = 'none'; document.getElementById('sifreFormu').style.display = 'block'; };
document.getElementById('gitGirisYap2').onclick = () => { document.getElementById('sifreFormu').style.display = 'none'; document.getElementById('girisFormu').style.display = 'block'; };

const temaBtn = document.getElementById('temaBtn');
temaBtn.addEventListener('click', () => { document.body.classList.toggle('light-mode'); const isLight = document.body.classList.contains('light-mode'); localStorage.setItem('kutuphaneTema', isLight ? 'light' : 'dark'); temaBtn.innerText = isLight ? "🌙 Koyu Mod" : "☀️ Açık Mod"; });
if (localStorage.getItem('kutuphaneTema') === 'light') { document.body.classList.add('light-mode'); temaBtn.innerText = "🌙 Koyu Mod"; } else { temaBtn.innerText = "☀️ Açık Mod"; }
