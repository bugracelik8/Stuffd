import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
let kategoriler = []; let altKategoriler = []; let icerikler = [];
let aktifKat = null; let aktifAltKat = null; let acikIcerikId = null;

const authEkrani = document.getElementById('authEkrani'); const anaUygulama = document.getElementById('anaUygulama');

function toggleSifre(inputIds, toggleId) {
    const isPassword = document.getElementById(inputIds[0]).type === 'password';
    inputIds.forEach(id => document.getElementById(id).type = isPassword ? 'text' : 'password');
    document.getElementById(toggleId).innerText = isPassword ? 'Gizle' : 'Göster';
}
if(document.getElementById('toggleGirisSifre')) document.getElementById('toggleGirisSifre').addEventListener('click', () => toggleSifre(['girisSifre'], 'toggleGirisSifre'));
if(document.getElementById('toggleKayitSifre')) {
    document.getElementById('toggleKayitSifre').addEventListener('click', () => toggleSifre(['kayitSifre', 'kayitSifreTekrar'], 'toggleKayitSifre'));
    document.getElementById('toggleKayitSifreTekrar').addEventListener('click', () => toggleSifre(['kayitSifre', 'kayitSifreTekrar'], 'toggleKayitSifreTekrar'));
}

document.getElementById('girisBtn').addEventListener('click', () => {
    const email = document.getElementById('girisEmail').value.trim();
    const sifre = document.getElementById('girisSifre').value;
    const hatirla = document.getElementById('beniHatirla').checked;
    
    const persType = hatirla ? browserLocalPersistence : browserSessionPersistence;
    
    setPersistence(auth, persType)
        .then(() => signInWithEmailAndPassword(auth, email, sifre))
        .catch(error => { alert("Giriş başarısız. Bilgilerinizi kontrol edin."); console.error(error); });
});

document.getElementById('cikisBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) { currentUser = user; authEkrani.style.display = 'none'; anaUygulama.style.display = 'block'; await verileriBuluttanGetir(); } 
    else { currentUser = null; authEkrani.style.display = 'flex'; anaUygulama.style.display = 'none'; }
});

const grid = document.getElementById('kutuphaneGrid'); const breadcrumb = document.getElementById('breadcrumb');

async function verileriBuluttanGetir() {
    if (!currentUser) return;
    try { const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (docSnap.exists()) { const data = docSnap.data(); kategoriler = data.kategoriler || []; altKategoriler = data.altKategoriler || []; icerikler = data.icerikler || []; }
        ekranıGuncelle();
    } catch (e) { console.error(e); }
}

async function verileriBulutaKaydet() { if (currentUser) await setDoc(doc(db, "users", currentUser.uid), { kategoriler, altKategoriler, icerikler }); }

function ekranıGuncelle() {
    grid.innerHTML = ''; let navHtml = `<span class="yol-elemani" onclick="gitAnaSayfa()">Ana Sayfa</span>`;
    if (aktifKat) navHtml += `<span class="ayirici">/</span><span class="yol-elemani" onclick="gitKategori()">${aktifKat.ad}</span>`;
    if (aktifAltKat) navHtml += `<span class="ayirici">/</span><span class="yol-elemani">${aktifAltKat.ad}</span>`;
    breadcrumb.innerHTML = navHtml;

    if (!aktifKat) {
        kategoriler.forEach(kat => {
            const card = document.createElement('div'); card.className = 'card';
            card.innerHTML = `<button class="sil-btn" onclick="silKategori(event, ${kat.id})">&times;</button>
                              <button class="duzenle-btn" onclick="duzenleKategori(event, ${kat.id}, 'ana')"></button>
                              <div class="icon-folder"></div><h2 class="title">${kat.ad}</h2>`;
            card.onclick = () => { aktifKat = kat; ekranıGuncelle(); }; grid.appendChild(card);
        });
    } else if (!aktifAltKat) {
        altKategoriler.filter(ak => ak.ustId === aktifKat.id).forEach(altKat => {
            const card = document.createElement('div'); card.className = 'card';
            if (altKat.imgUrl) {
                card.style.backgroundImage = `linear-gradient(to bottom, rgba(11, 19, 43, 0.4), rgba(11, 19, 43, 0.9)), url('${altKat.imgUrl}')`;
                card.style.backgroundSize = 'cover'; card.style.backgroundPosition = 'center'; card.style.color = 'white';
                card.innerHTML = `<button class="sil-btn" onclick="silAltKategori(event, ${altKat.id})">&times;</button>
                                  <button class="duzenle-btn" onclick="duzenleKategori(event, ${altKat.id}, 'alt')"></button>
                                  <h2 class="title" style="text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${altKat.ad}</h2>`;
            } else { 
                card.innerHTML = `<button class="sil-btn" onclick="silAltKategori(event, ${altKat.id})">&times;</button>
                                  <button class="duzenle-btn" onclick="duzenleKategori(event, ${altKat.id}, 'alt')"></button>
                                  <div class="icon-folder"></div><h2 class="title">${altKat.ad}</h2>`; 
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
window.silKategori = (e, id) => { e.stopPropagation(); if(confirm("Klasör silinsin mi?")) { kategoriler = kategoriler.filter(k => k.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };
window.silAltKategori = (e, id) => { e.stopPropagation(); if(confirm("Alt klasör silinsin mi?")) { altKategoriler = altKategoriler.filter(ak => ak.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };
window.silIcerik = (e, id) => { e.stopPropagation(); if(confirm("İçerik silinsin mi?")) { icerikler = icerikler.filter(ic => ic.id !== id); verileriBulutaKaydet(); ekranıGuncelle(); } };

let resimBlob = null; let cropper = null;
function resimSecmeIslemi(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('cropperImage').src = event.target.result; document.getElementById('cropperModal').style.display = 'flex';
            if(cropper) cropper.destroy(); cropper = new Cropper(document.getElementById('cropperImage'), { aspectRatio: 1, viewMode: 1 });
        };
        reader.readAsDataURL(file);
    }
}
document.getElementById('klasorResimInput').addEventListener('change', resimSecmeIslemi); document.getElementById('duzenleResimInput').addEventListener('change', resimSecmeIslemi);
document.getElementById('cropUygulaBtn').addEventListener('click', () => { cropper.getCroppedCanvas({width: 600, height: 600}).toBlob((blob) => { resimBlob = blob; document.getElementById('cropperModal').style.display = 'none'; }, 'image/jpeg', 0.8); });

document.getElementById('yeniEkleBtn').addEventListener('click', () => {
    if (!aktifKat || !aktifAltKat) {
        document.getElementById('klasorModalBaslik').innerText = !aktifKat ? "Yeni Ana Klasör" : "Yeni Alt Klasör";
        document.getElementById('klasorResimAlani').style.display = (!aktifKat) ? 'none' : 'block';
        resimBlob = null; document.getElementById('klasorResimInput').value = ''; document.getElementById('klasorAdInput').value = '';
        document.getElementById('klasorModal').style.display = 'flex';
    } else { document.getElementById('yeniIcerikModal').style.display = 'flex'; }
});

document.getElementById('klasorOlusturBtn').addEventListener('click', async () => {
    const ad = document.getElementById('klasorAdInput').value.trim(); if(!ad) return;
    const btn = document.getElementById('klasorOlusturBtn');
    if (!aktifKat) { kategoriler.push({ id: Date.now(), ad }); verileriBulutaKaydet(); document.getElementById('klasorModal').style.display = 'none'; ekranıGuncelle(); } 
    else if (!aktifAltKat) { 
        let imgUrl = null;
        if (resimBlob) {
            btn.innerText = "Yükleniyor..."; btn.disabled = true;
            const yol = ref(storage, `users/${currentUser.uid}/folders/${Date.now()}.jpg`);
            await uploadBytes(yol, resimBlob); imgUrl = await getDownloadURL(yol);
            btn.innerText = "Oluştur"; btn.disabled = false;
        }
        altKategoriler.push({ id: Date.now(), ad, ustId: aktifKat.id, imgUrl }); verileriBulutaKaydet(); document.getElementById('klasorModal').style.display = 'none'; ekranıGuncelle();
    }
});

let duzenlenenId = null; let duzenlenenTur = null;
window.duzenleKategori = (e, id, tur) => {
    e.stopPropagation(); duzenlenenId = id; duzenlenenTur = tur; resimBlob = null; document.getElementById('duzenleResimInput').value = '';
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
            if (resimBlob) {
                btn.innerText = "Yükleniyor..."; btn.disabled = true;
                const yol = ref(storage, `users/${currentUser.uid}/folders/${Date.now()}_guncel.jpg`);
                await uploadBytes(yol, resimBlob); altKat.imgUrl = await getDownloadURL(yol);
                btn.innerText = "Değişiklikleri Kaydet"; btn.disabled = false;
            }
        }
    }
    verileriBulutaKaydet(); document.getElementById('klasorDuzenleModal').style.display = 'none'; ekranıGuncelle();
});

document.querySelectorAll('input[name="icerikTuru"]').forEach(btn => { btn.addEventListener('change', (e) => { document.getElementById('yaziliNotAlani').style.display = e.target.value === 'not' ? 'block' : 'none'; document.getElementById('pdfYuklemeAlani').style.display = e.target.value === 'not' ? 'none' : 'block'; }); });

document.getElementById('olusturBtn').addEventListener('click', async () => {
    const baslik = document.getElementById('yeniBaslik').value; const tur = document.querySelector('input[name="icerikTuru"]:checked').value; if(!baslik) return;
    const btn = document.getElementById('olusturBtn'); const icerikId = Date.now(); 
    let yeni = { id: icerikId, baslik, altId: aktifAltKat.id, tur, notlar: "" };
    if (tur === 'not') { yeni.notlar = document.getElementById('yeniNot').value; } 
    else { 
        const file = document.getElementById('yeniPdfDosya').files[0]; if(!file) { alert("Lütfen PDF seçin."); return; }
        btn.innerText = "Yükleniyor..."; btn.disabled = true;
        const yol = ref(storage, `users/${currentUser.uid}/pdfs/${icerikId}_${file.name}`);
        await uploadBytes(yol, file); yeni.pdfUrl = await getDownloadURL(yol);
        btn.innerText = "Buluta Yükle ve Oluştur"; btn.disabled = false;
    }
    icerikler.push(yeni); verileriBulutaKaydet(); document.getElementById('yeniIcerikModal').style.display = 'none'; ekranıGuncelle();
});

let pdfDoc = null; let sayfaNo = 1; let okunanPdfUrl = null;
const canvasSol = document.getElementById('pdfCanvasSol'); const ctxSol = canvasSol.getContext('2d');
const canvasSag = document.getElementById('pdfCanvasSag'); const ctxSag = canvasSag.getContext('2d');

function detaylariAc(icerik) {
    acikIcerikId = icerik.id; document.getElementById('modalBaslik').innerText = icerik.baslik; document.getElementById('modalNotlar').value = icerik.notlar || "";
    const pdfAcBtn = document.getElementById('pdfAcBtn');
    if (icerik.tur === 'pdf') { pdfAcBtn.style.display = 'block'; okunanPdfUrl = icerik.pdfUrl; } else { pdfAcBtn.style.display = 'none'; okunanPdfUrl = null; }
    document.getElementById('detayModal').style.display = 'flex';
}

document.getElementById('pdfAcBtn').addEventListener('click', () => {
    document.getElementById('pdfKitapModal').style.display = 'flex'; document.getElementById('pdfSayfaBilgi').innerText = "Yükleniyor...";
    pdfjsLib.getDocument(okunanPdfUrl).promise.then(pdf => { pdfDoc = pdf; sayfaNo = 1; pdfSayfalariCiz(); }).catch(err => { console.error(err); alert("PDF yüklenirken bir sorun oluştu."); });
});

function pdfSayfalariCiz() {
    if(!pdfDoc) return;
    const genisEkran = window.innerWidth > 768;
    const headerYukseklik = document.getElementById('pdfHeaderArea').offsetHeight;
    const boslukPayi = 40; 
    const maksimumYukseklik = window.innerHeight - headerYukseklik - boslukPayi;

    pdfDoc.getPage(sayfaNo).then(page => { 
        const hamViewport = page.getViewport({ scale: 1.0 }); 
        const dinamikScale = maksimumYukseklik / hamViewport.height; 
        const viewport = page.getViewport({ scale: dinamikScale }); 
        
        canvasSol.height = viewport.height; canvasSol.width = viewport.width; 
        page.render({ canvasContext: ctxSol, viewport: viewport }); 
    });
    
    if (genisEkran && sayfaNo + 1 <= pdfDoc.numPages) {
        canvasSag.style.display = 'block';
        pdfDoc.getPage(sayfaNo + 1).then(page => { 
            const hamViewport = page.getViewport({ scale: 1.0 }); 
            const dinamikScale = maksimumYukseklik / hamViewport.height;
            const viewport = page.getViewport({ scale: dinamikScale }); 
            
            canvasSag.height = viewport.height; canvasSag.width = viewport.width; 
            page.render({ canvasContext: ctxSag, viewport: viewport }); 
        });
        document.getElementById('pdfSayfaBilgi').innerText = `Sayfa ${sayfaNo} - ${sayfaNo + 1} / ${pdfDoc.numPages}`;
    } else { canvasSag.style.display = 'none'; document.getElementById('pdfSayfaBilgi').innerText = `Sayfa ${sayfaNo} / ${pdfDoc.numPages}`; }
}

window.addEventListener('resize', () => { if(document.getElementById('pdfKitapModal').style.display === 'flex') pdfSayfalariCiz(); });

document.getElementById('pdfIleriBtn').addEventListener('click', () => { const adim = window.innerWidth > 768 ? 2 : 1; if (sayfaNo + adim <= pdfDoc.numPages) { sayfaNo += adim; pdfSayfalariCiz(); } });
document.getElementById('pdfGeriBtn').addEventListener('click', () => { const adim = window.innerWidth > 768 ? 2 : 1; if (sayfaNo - adim >= 1) { sayfaNo -= adim; pdfSayfalariCiz(); } });
document.getElementById('pdfKitapKapatBtn').addEventListener('click', () => document.getElementById('pdfKitapModal').style.display = 'none');
document.getElementById('kaydetBtn').addEventListener('click', () => { const ic = icerikler.find(i => i.id === acikIcerikId); if(ic) { ic.notlar = document.getElementById('modalNotlar').value; verileriBulutaKaydet(); document.getElementById('detayModal').style.display = 'none'; } });

['kapatDetayBtn', 'kapatYeniBtn', 'kapatKlasorBtn', 'kapatDuzenleBtn'].forEach(id => { document.getElementById(id).addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none'); });

document.getElementById('gitKayitOl').onclick = () => { document.getElementById('girisFormu').style.display = 'none'; document.getElementById('kayitFormu').style.display = 'block'; };
document.getElementById('gitGirisYap').onclick = () => { document.getElementById('kayitFormu').style.display = 'none'; document.getElementById('girisFormu').style.display = 'block'; };
document.getElementById('gitSifreSifirla').onclick = () => { document.getElementById('girisFormu').style.display = 'none'; document.getElementById('sifreFormu').style.display = 'block'; };
document.getElementById('gitGirisYap2').onclick = () => { document.getElementById('sifreFormu').style.display = 'none'; document.getElementById('girisFormu').style.display = 'block'; };

const temaBtn = document.getElementById('temaBtn');
temaBtn.addEventListener('click', () => { document.body.classList.toggle('light-mode'); localStorage.setItem('kutuphaneTema', document.body.classList.contains('light-mode') ? 'light' : 'dark'); });
if (localStorage.getItem('kutuphaneTema') === 'light') document.body.classList.add('light-mode');
