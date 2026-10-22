/**
 * ============================================================================
 * SAKUKU - LOGIKA APLIKASI
 * Navigasi (hash), saldo & batas harian, grafik mingguan, catat uang,
 * riwayat (cari/filter/urut/ekspor), celengan, notifikasi, dan LocalStorage.
 * Data lama (sakuku_transaksi, sakuku_celengan, sakuku_limit) tetap terbaca.
 * ============================================================================
 */
'use strict';

/* ============================================================================
   1. UTILITAS
   ============================================================================ */
const KUNCI = {
    transaksi: 'sakuku_transaksi',
    celengan: 'sakuku_celengan',
    limit: 'sakuku_limit',
    nama: 'sakuku_nama',
    sembunyi: 'sakuku_sembunyi'
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// Tanggal lokal YYYY-MM-DD (toISOString() memakai UTC, bisa salah hari di WIB dini hari)
function tanggalLokal(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function jamSekarang() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function parseTanggal(str) {
    const [y, m, d] = String(str).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
function formatTanggalPendek(str) {
    return parseTanggal(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatRupiah(angka) {
    const v = Math.round(Number(angka) || 0);
    return (v < 0 ? '-' : '') + 'Rp ' + Math.abs(v).toLocaleString('id-ID');
}
function formatSingkat(v) {
    if (v >= 1e6) return String(+(v / 1e6).toFixed(1)).replace('.', ',') + 'Jt';
    if (v >= 1e3) return String(+(v / 1e3).toFixed(1)).replace('.', ',') + 'K';
    return String(v);
}
function esc(teks) {
    return String(teks).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ikon(id) { return `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`; }
const jumlahNominal = arr => arr.reduce((a, t) => a + (Number(t.nominal) || 0), 0);

// Input uang: tampil "12.500", nilai asli diambil lewat ambilUang()
function pasangInputUang(input) {
    input.addEventListener('input', () => {
        const digit = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
        input.value = digit ? Number(digit).toLocaleString('id-ID') : '';
    });
}
function ambilUang(input) { return Number(input.value.replace(/\D/g, '')) || 0; }
function isiUang(input, angka) { input.value = angka ? Number(angka).toLocaleString('id-ID') : ''; }

/* ============================================================================
   2. DATA & LOCALSTORAGE
   ============================================================================ */
function bacaStorage(kunci, cadangan) {
    try {
        const mentah = localStorage.getItem(kunci);
        return mentah === null ? cadangan : JSON.parse(mentah);
    } catch { return cadangan; }
}
function tulisStorage(kunci, nilai) {
    try { localStorage.setItem(kunci, JSON.stringify(nilai)); } catch { /* penyimpanan penuh / diblokir */ }
}

let transaksi = [], celengan = [], batasHarian = 25000, namaUser = 'Fathan', sembunyiSaldo = false;

function muatState() {
    const hariIni = tanggalLokal();
    transaksi = bacaStorage(KUNCI.transaksi, [
        { id: 1, tanggal: hariIni, waktu: '07:00', keterangan: 'Uang Saku Mingguan', kategori: 'Uang Saku', jenis: 'pemasukan', nominal: 100000 },
        { id: 2, tanggal: hariIni, waktu: '12:30', keterangan: 'Makan Siang di Kantin', kategori: 'Makan & Jajan', jenis: 'pengeluaran', nominal: 12000 },
        { id: 3, tanggal: hariIni, waktu: '08:15', keterangan: 'Ongkos Angkot PP', kategori: 'Transportasi', jenis: 'pengeluaran', nominal: 8000 }
    ]);
    celengan = bacaStorage(KUNCI.celengan, [
        { id: 101, nama: 'Headset Buat Ngoding', target: 150000, terkumpul: 75000 },
        { id: 102, nama: 'Patungan Kas Kelas', target: 50000, terkumpul: 30000 }
    ]);
    if (!Array.isArray(transaksi)) transaksi = [];
    if (!Array.isArray(celengan)) celengan = [];
    transaksi = transaksi.filter(t => t && t.tanggal && t.jenis).map(t => ({ ...t, nominal: Number(t.nominal) || 0 }));
    celengan = celengan.filter(c => c && c.nama).map(c => ({ ...c, target: Number(c.target) || 1, terkumpul: Number(c.terkumpul) || 0 }));
    batasHarian = Number(bacaStorage(KUNCI.limit, 25000)) || 25000;
    namaUser = String(bacaStorage(KUNCI.nama, 'Fathan') || 'Fathan');
    sembunyiSaldo = bacaStorage(KUNCI.sembunyi, false) === true;
}
function simpanKeStorage() {
    tulisStorage(KUNCI.transaksi, transaksi);
    tulisStorage(KUNCI.celengan, celengan);
    tulisStorage(KUNCI.limit, batasHarian);
    tulisStorage(KUNCI.nama, namaUser);
    tulisStorage(KUNCI.sembunyi, sembunyiSaldo);
}

/* ============================================================================
   3. KATEGORI
   ============================================================================ */
const KATEGORI = {
    pengeluaran: [
        { nama: 'Makan & Jajan', ikon: 'i-food', warna: 'c-makan' },
        { nama: 'Transportasi', ikon: 'i-bus', warna: 'c-transport' },
        { nama: 'Belanja', ikon: 'i-bag', warna: 'c-belanja' },
        { nama: 'Pendidikan', ikon: 'i-grad', warna: 'c-pendidikan' },
        { nama: 'Kesehatan', ikon: 'i-health', warna: 'c-kesehatan' },
        { nama: 'Hiburan', ikon: 'i-game', warna: 'c-hiburan' },
        { nama: 'Lainnya', ikon: 'i-more', warna: 'c-lain' }
    ],
    pemasukan: [
        { nama: 'Uang Saku', ikon: 'i-wallet', warna: 'c-saku' },
        { nama: 'Hasil Usaha', ikon: 'i-cash', warna: 'c-usaha' },
        { nama: 'Hadiah', ikon: 'i-gift', warna: 'c-hadiah' },
        { nama: 'Lainnya', ikon: 'i-more', warna: 'c-lain' }
    ]
};
// Nama kategori versi lama -> versi baru (agar data lama tetap rapi)
const ALIAS_KATEGORI = { 'Keperluan Sekolah': 'Pendidikan', 'Kuota & Hiburan': 'Hiburan' };

function infoKategori(nama, jenis) {
    const n = ALIAS_KATEGORI[nama] || nama;
    const urut = jenis === 'pemasukan' ? ['pemasukan', 'pengeluaran'] : ['pengeluaran', 'pemasukan'];
    for (const j of urut) {
        const ketemu = KATEGORI[j].find(k => k.nama === n);
        if (ketemu) return ketemu;
    }
    return { nama: n || 'Lainnya', ikon: 'i-more', warna: 'c-lain' };
}

/* ============================================================================
   4. NAVIGASI (berbasis hash agar tombol Back & refresh tetap benar)
   ============================================================================ */
const HALAMAN = {
    beranda: { judul: () => `Halo, ${namaUser} 👋`, sub: 'Semoga hari ini penuh hal baik dan saldo makin bertambah!' },
    catat: { judul: () => 'Catat Uang', sub: 'Tambahkan pemasukan atau pengeluaranmu hari ini.' },
    riwayat: { judul: () => 'Riwayat Data', sub: 'Lihat, cari, dan saring semua transaksimu.' },
    celengan: { judul: () => 'Celengan', sub: 'Tabung uang untuk mimpi dan kebutuhanmu.' }
};
let halamanAktif = 'beranda';

function tampilkanHalaman() {
    const nama = (location.hash || '#beranda').slice(1);
    halamanAktif = HALAMAN[nama] ? nama : 'beranda';

    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + halamanAktif));
    $$('[data-view]').forEach(a => {
        if (a.dataset.view === halamanAktif) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    document.body.dataset.view = halamanAktif;
    renderJudul();
    tutupPopover();
    window.scrollTo({ top: 0 });
    if (halamanAktif === 'catat') perbaruiPreview();
}
function renderJudul() {
    const h = HALAMAN[halamanAktif];
    $('#page-title').textContent = h.judul();
    $('#page-sub').textContent = h.sub;
    document.title = (halamanAktif === 'beranda' ? 'SakuKu' : h.judul() + ' - SakuKu') + ' | Catatan Keuangan Siswa PPLG';
}
function pindahHalaman(nama) {
    if (location.hash === '#' + nama) tampilkanHalaman();
    else location.hash = nama;
}

/* ============================================================================
   5. PERHITUNGAN
   ============================================================================ */
function hitungRingkasan() {
    const hariIni = tanggalLokal();
    const masuk = jumlahNominal(transaksi.filter(t => t.jenis === 'pemasukan'));
    const keluar = jumlahNominal(transaksi.filter(t => t.jenis !== 'pemasukan'));
    const keluarHariIni = jumlahNominal(transaksi.filter(t => t.jenis !== 'pemasukan' && t.tanggal === hariIni));
    return { masuk, keluar, saldo: masuk - keluar, keluarHariIni, hariIni };
}
function statusLimit(keluarHariIni) {
    const persen = Math.min((keluarHariIni / batasHarian) * 100, 100);
    if (keluarHariIni > batasHarian) return { kode: 'boros', teks: 'Boros', persen };
    if (persen >= 75) return { kode: 'waspada', teks: 'Waspada', persen };
    return { kode: 'aman', teks: 'Aman', persen };
}
function urutkan(daftar, cara = 'terbaru') {
    const kunci = t => t.tanggal + ' ' + (t.waktu || '00:00');
    const salin = daftar.slice();
    if (cara === 'terbesar') return salin.sort((a, b) => b.nominal - a.nominal || b.id - a.id);
    const arah = cara === 'terlama' ? 1 : -1;
    return salin.sort((a, b) => {
        const k = kunci(a).localeCompare(kunci(b));
        return (k || a.id - b.id) * arah;
    });
}

/* ============================================================================
   6. RENDER BERANDA
   ============================================================================ */
function renderBeranda() {
    const r = hitungRingkasan();

    $('#val-saldo').textContent = sembunyiSaldo ? 'Rp ••••••' : formatRupiah(r.saldo);
    $('#val-pemasukan').textContent = formatRupiah(r.masuk);
    $('#val-pengeluaran').textContent = formatRupiah(r.keluar);
    $('#eye-use').setAttribute('href', sembunyiSaldo ? '#i-eye-off' : '#i-eye');
    const mata = $('#btn-eye');
    mata.setAttribute('aria-pressed', String(sembunyiSaldo));
    mata.setAttribute('aria-label', sembunyiSaldo ? 'Tampilkan saldo' : 'Sembunyikan saldo');

    // Batas jajan harian
    const st = statusLimit(r.keluarHariIni);
    $('#limit-card').dataset.status = st.kode;
    $('#val-jajan-hari-ini').textContent = formatRupiah(r.keluarHariIni);
    $('#val-batas-harian').textContent = formatRupiah(batasHarian);
    $('#bar-limit').style.width = st.persen + '%';
    $('#bar-limit-wrap').setAttribute('aria-valuenow', String(Math.round(st.persen)));
    $('#status-text').textContent = st.teks;
    const sisa = formatRupiah(batasHarian - r.keluarHariIni);
    $('#status-limit').textContent =
        st.kode === 'boros' ? 'Waduh! Jajanmu hari ini sudah melewati batas harian.' :
        st.kode === 'waspada' ? `Hati-hati, sisa jatah jajan hari ini tinggal ${sisa}.` :
        `Masih aman! Sisa jatah jajan hari ini ${sisa}.`;

    renderGrafik();
    renderTerakhir();
}

function barisTransaksi(t, { hapus = false, klik = false } = {}) {
    const k = infoKategori(t.kategori, t.jenis);
    const masuk = t.jenis === 'pemasukan';
    const waktu = t.waktu ? `, ${esc(t.waktu)}` : '';
    const catatan = t.keterangan && t.keterangan !== k.nama ? `<span class="tx-note">${esc(t.keterangan)}</span>` : '';
    return `
        <li class="tx-row${klik ? ' klik' : ''}" ${klik ? 'data-ke-riwayat="1"' : ''}>
            <span class="cat-ic ${k.warna}">${ikon(k.ikon)}</span>
            <div class="tx-body">
                <b>${esc(k.nama)}</b>${catatan}
                <small>${formatTanggalPendek(t.tanggal)}${waktu}</small>
            </div>
            <strong class="amt ${masuk ? 'in' : 'out'}">${masuk ? '+' : '-'} ${formatRupiah(t.nominal)}</strong>
            ${hapus ? `<button type="button" class="del-btn" data-hapus="${t.id}" aria-label="Hapus transaksi ${esc(t.keterangan || k.nama)}">${ikon('i-trash')}</button>` : ''}
        </li>`;
}
function kosongHTML(judul, teks) {
    return `<li class="kosong">${ikon('i-note')}<b>${esc(judul)}</b>${esc(teks)}</li>`;
}
function renderTerakhir() {
    const daftar = urutkan(transaksi).slice(0, 3);
    $('#list-terakhir').innerHTML = daftar.length
        ? daftar.map(t => barisTransaksi(t, { klik: true })).join('')
        : kosongHTML('Belum ada catatan', 'Mulai catat uang masuk & keluarmu.');
}

/* ---------- Grafik mingguan (SVG dibuat dari data asli) ---------- */
function stepCantik(x) {
    const p = 10 ** Math.floor(Math.log10(x));
    const n = x / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function renderGrafik() {
    const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const sekarang = new Date();
    const selisih = (sekarang.getDay() + 6) % 7; // Senin = 0
    const tanggalHari = NAMA_HARI.map((_, i) => tanggalLokal(new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() - selisih + i)));
    const masuk = tanggalHari.map(tg => jumlahNominal(transaksi.filter(t => t.tanggal === tg && t.jenis === 'pemasukan')));
    const keluar = tanggalHari.map(tg => jumlahNominal(transaksi.filter(t => t.tanggal === tg && t.jenis !== 'pemasukan')));

    const maks = Math.max(...masuk, ...keluar, 0);
    const step = stepCantik((maks || 40000) / 4);
    const atas = step * Math.max(1, Math.ceil(maks / step));

    const W = 440, H = 220, kiri = 46, kanan = 14, atasPad = 14, bawah = 30;
    const lebar = W - kiri - kanan, tinggi = H - atasPad - bawah;
    const x = i => kiri + (i * lebar) / 6;
    const y = v => atasPad + (1 - v / atas) * tinggi;

    // Kurva halus tanpa overshoot (kontrol horizontal)
    const kurva = data => data.map((v, i) => {
        if (i === 0) return `M${x(0)} ${y(v)}`;
        const tengah = (x(i - 1) + x(i)) / 2;
        return `C${tengah} ${y(data[i - 1])} ${tengah} ${y(v)} ${x(i)} ${y(v)}`;
    }).join(' ');

    let garis = '';
    for (let v = 0; v <= atas; v += step) {
        garis += `<line class="grid" x1="${kiri}" x2="${W - kanan}" y1="${y(v)}" y2="${y(v)}"/>` +
                 `<text class="ax" x="${kiri - 8}" y="${y(v) + 4}" text-anchor="end">${formatSingkat(v)}</text>`;
    }
    const hariIniIdx = selisih;
    const label = NAMA_HARI.map((h, i) => `<text class="ax${i === hariIniIdx ? ' hari' : ''}" x="${x(i)}" y="${H - 8}" text-anchor="middle">${h}</text>`).join('');
    const titik = (data, warna, ket) => data.map((v, i) =>
        `<circle class="pt" cx="${x(i)}" cy="${y(v)}" r="${i === hariIniIdx ? 4.5 : 3}" fill="#fff" stroke="${warna}" stroke-width="2.2"><title>${ket} ${NAMA_HARI[i]}: ${formatRupiah(v)}</title></circle>`).join('');
    const area = data => `${kurva(data)} L${x(6)} ${y(0)} L${x(0)} ${y(0)} Z`;

    $('#grafik').innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pemasukan dan pengeluaran minggu ini">
            <defs>
                <linearGradient id="gMasuk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity=".28"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></linearGradient>
                <linearGradient id="gKeluar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef3b4b" stop-opacity=".16"/><stop offset="1" stop-color="#ef3b4b" stop-opacity="0"/></linearGradient>
            </defs>
            ${garis}${label}
            <path d="${area(masuk)}" fill="url(#gMasuk)"/>
            <path d="${area(keluar)}" fill="url(#gKeluar)"/>
            <path d="${kurva(masuk)}" fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round"/>
            <path d="${kurva(keluar)}" fill="none" stroke="#ef3b4b" stroke-width="2.6" stroke-linecap="round"/>
            ${titik(masuk, '#22c55e', 'Pemasukan')}${titik(keluar, '#ef3b4b', 'Pengeluaran')}
        </svg>`;
}

/* ---------- Tips ---------- */
const TIPS = [
    'Jangan lupa catat pengeluaran kecil, ya!',
    'Sisihkan sebagian uang saku di awal minggu, bukan sisa di akhir.',
    'Bawa bekal dari rumah, hematnya terasa dalam sebulan.',
    'Bedakan kebutuhan dan keinginan sebelum membeli.',
    'Tunggu 24 jam sebelum membeli barang yang bukan kebutuhan.',
    'Target kecil yang tercapai lebih memotivasi daripada target besar yang ditunda.',
    'Cek riwayat tiap akhir pekan untuk melihat pengeluaran paling boros.',
    'Menabung Rp 5.000 per hari = Rp 150.000 sebulan!'
];
let indeksTips = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5) % TIPS.length;
function renderTips() { $('#tips-text').textContent = TIPS[indeksTips]; }

/* ============================================================================
   7. CATAT UANG
   ============================================================================ */
const inputNominal = $('#input-nominal');
const inputTanggal = $('#input-tanggal');
const inputKet = $('#input-keterangan');
pasangInputUang(inputNominal);

function jenisDipilih() { return $('input[name="jenis"]:checked').value; }

function renderGridKategori() {
    const jenis = jenisDipilih();
    const sebelumnya = ($('input[name="kategori"]:checked') || {}).value;
    const daftar = KATEGORI[jenis];
    const terpilih = daftar.some(k => k.nama === sebelumnya) ? sebelumnya : daftar[0].nama;
    $('#cat-grid').innerHTML = daftar.map(k => `
        <label class="cat-tile ${k.warna}">
            <input type="radio" name="kategori" value="${esc(k.nama)}"${k.nama === terpilih ? ' checked' : ''}>
            <span class="tile-ic">${ikon(k.ikon)}</span>
            <span class="tile-t">${esc(k.nama)}</span>
        </label>`).join('');
}
function perbaruiPreview() {
    const nominal = ambilUang(inputNominal);
    const { saldo } = hitungRingkasan();
    const el = $('#preview-saldo');
    if (!nominal) {
        el.className = 'preview';
        el.innerHTML = `Saldo sekarang <b>${formatRupiah(saldo)}</b>`;
        return;
    }
    const sesudah = saldo + (jenisDipilih() === 'pemasukan' ? nominal : -nominal);
    el.className = 'preview' + (sesudah < 0 ? ' minus' : '');
    el.innerHTML = `Saldo setelah disimpan <b>${formatRupiah(sesudah)}</b>`;
}
function tampilkanGalatForm(pesan) {
    const el = $('#err-form');
    el.textContent = pesan || '';
    el.hidden = !pesan;
}

$$('input[name="jenis"]').forEach(r => r.addEventListener('change', () => { renderGridKategori(); perbaruiPreview(); }));
inputNominal.addEventListener('input', () => { tampilkanGalatForm(''); perbaruiPreview(); });
$$('.chip[data-nominal]').forEach(chip => chip.addEventListener('click', () => {
    isiUang(inputNominal, chip.dataset.nominal);
    tampilkanGalatForm('');
    perbaruiPreview();
    inputNominal.focus();
}));

$('#form-transaksi').addEventListener('submit', e => {
    e.preventDefault();
    const jenis = jenisDipilih();
    const nominal = ambilUang(inputNominal);
    const kategori = ($('input[name="kategori"]:checked') || {}).value || 'Lainnya';
    const tanggal = inputTanggal.value;

    if (nominal < 500) { tampilkanGalatForm('Nominal minimal Rp 500.'); inputNominal.focus(); return; }
    if (!tanggal) { tampilkanGalatForm('Pilih tanggal transaksi dulu, ya.'); inputTanggal.focus(); return; }

    transaksi.push({
        id: Date.now(),
        tanggal,
        waktu: tanggal === tanggalLokal() ? jamSekarang() : '',
        keterangan: inputKet.value.trim() || kategori,
        kategori, jenis, nominal
    });
    perbaruiTampilan();

    const r = hitungRingkasan();
    let pesan = '✅ Catatan berhasil disimpan!';
    if (jenis === 'pengeluaran' && r.saldo < 0) pesan = '⚠️ Tersimpan, tapi saldomu jadi minus.';
    else if (jenis === 'pengeluaran' && r.keluarHariIni > batasHarian) pesan = '⚠️ Tersimpan, jajan hari ini melewati batas.';

    e.target.reset();
    inputTanggal.value = tanggalLokal();
    renderGridKategori();
    tampilkanGalatForm('');
    perbaruiPreview();
    tampilkanNotifikasi(pesan);
    pindahHalaman('beranda');
});

/* ============================================================================
   8. RIWAYAT: CARI, FILTER, URUT, HAPUS, EKSPOR
   ============================================================================ */
const filter = { kata: '', jenis: 'semua', bulan: 'semua', kategori: 'semua', urut: 'terbaru' };

function isiOpsiFilter() {
    const bulanAda = [...new Set(transaksi.map(t => t.tanggal.slice(0, 7)))].sort().reverse();
    if (filter.bulan !== 'semua' && !bulanAda.includes(filter.bulan)) filter.bulan = 'semua';
    $('#filter-bulan').innerHTML = '<option value="semua">Semua waktu</option>' + bulanAda.map(b => {
        const nama = parseTanggal(b + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        return `<option value="${b}"${b === filter.bulan ? ' selected' : ''}>${nama}</option>`;
    }).join('');

    const kategoriAda = [...new Set(transaksi.map(t => infoKategori(t.kategori, t.jenis).nama))].sort();
    if (filter.kategori !== 'semua' && !kategoriAda.includes(filter.kategori)) filter.kategori = 'semua';
    $('#filter-kategori').innerHTML = '<option value="semua">Semua kategori</option>' + kategoriAda.map(k =>
        `<option value="${esc(k)}"${k === filter.kategori ? ' selected' : ''}>${esc(k)}</option>`).join('');
    $('#filter-urut').value = filter.urut;
}

function dataTersaring() {
    const kata = filter.kata.trim().toLowerCase();
    return urutkan(transaksi.filter(t => {
        const k = infoKategori(t.kategori, t.jenis).nama;
        const cocokKata = !kata || (t.keterangan || '').toLowerCase().includes(kata) || k.toLowerCase().includes(kata);
        const cocokJenis = filter.jenis === 'semua' || t.jenis === filter.jenis;
        const cocokBulan = filter.bulan === 'semua' || t.tanggal.startsWith(filter.bulan);
        const cocokKat = filter.kategori === 'semua' || k === filter.kategori;
        return cocokKata && cocokJenis && cocokBulan && cocokKat;
    }), filter.urut);
}

function renderRiwayat() {
    isiOpsiFilter();
    const data = dataTersaring();

    $('#rw-total').textContent = formatRupiah(jumlahNominal(data));
    if (data.length) {
        const tgl = data.map(t => t.tanggal).sort();
        const awal = formatTanggalPendek(tgl[0]), akhir = formatTanggalPendek(tgl[tgl.length - 1]);
        $('#rw-range').textContent = `${data.length} transaksi • ${awal === akhir ? awal : awal + ' - ' + akhir}`;
    } else {
        $('#rw-range').textContent = 'Tidak ada transaksi';
    }

    $('#list-riwayat').innerHTML = data.length
        ? data.map(t => barisTransaksi(t, { hapus: true })).join('')
        : kosongHTML(transaksi.length ? 'Tidak ada hasil' : 'Belum ada transaksi', transaksi.length ? 'Coba ubah kata kunci atau filter.' : 'Catat pemasukan atau pengeluaran pertamamu.');

    $$('.tab').forEach(tab => {
        const aktif = tab.dataset.jenis === filter.jenis;
        tab.classList.toggle('active', aktif);
        tab.setAttribute('aria-selected', String(aktif));
    });
}

$('#search-transaksi').addEventListener('input', e => { filter.kata = e.target.value; renderRiwayat(); });
$('#tabs-jenis').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    filter.jenis = tab.dataset.jenis;
    renderRiwayat();
});
$('#filter-bulan').addEventListener('change', e => { filter.bulan = e.target.value; renderRiwayat(); });
$('#filter-kategori').addEventListener('change', e => { filter.kategori = e.target.value; renderRiwayat(); });
$('#filter-urut').addEventListener('change', e => { filter.urut = e.target.value; renderRiwayat(); });
$('#btn-filter').addEventListener('click', () => {
    const panel = $('#filter-panel');
    panel.hidden = !panel.hidden;
    $('#btn-filter').setAttribute('aria-expanded', String(!panel.hidden));
});
$('#btn-reset-filter').addEventListener('click', () => {
    Object.assign(filter, { kata: '', jenis: 'semua', bulan: 'semua', kategori: 'semua', urut: 'terbaru' });
    $('#search-transaksi').value = '';
    renderRiwayat();
});

$('#list-riwayat').addEventListener('click', e => {
    const tombol = e.target.closest('[data-hapus]');
    if (tombol) hapusTransaksi(Number(tombol.dataset.hapus));
});
$('#list-terakhir').addEventListener('click', e => {
    if (e.target.closest('[data-ke-riwayat]')) pindahHalaman('riwayat');
});

function hapusTransaksi(id) {
    const idx = transaksi.findIndex(t => t.id === id);
    if (idx < 0) return;
    const [item] = transaksi.splice(idx, 1);
    perbaruiTampilan();
    tampilkanNotifikasi('🗑️ Catatan dihapus.', {
        label: 'Urungkan',
        fn: () => { transaksi.splice(Math.min(idx, transaksi.length), 0, item); perbaruiTampilan(); }
    });
}

$('#btn-reset-data').addEventListener('click', () => {
    if (!transaksi.length) { tampilkanNotifikasi('Riwayat sudah kosong.'); return; }
    bukaModal({
        judul: 'Hapus semua riwayat?',
        desc: `${transaksi.length} transaksi akan dihapus dari perangkat ini. Pertimbangkan ekspor CSV dulu sebagai cadangan.`,
        submit: 'Ya, hapus semua', bahaya: true,
        onSubmit: () => {
            const cadangan = transaksi;
            transaksi = [];
            perbaruiTampilan();
            tampilkanNotifikasi('Semua riwayat telah dikosongkan.', {
                label: 'Urungkan', fn: () => { transaksi = cadangan; perbaruiTampilan(); }
            });
        }
    });
});

function eksporCSV() {
    if (!transaksi.length) { tampilkanNotifikasi('Belum ada data untuk diekspor.'); return; }
    const sel = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const baris = [['Tanggal', 'Waktu', 'Jenis', 'Kategori', 'Keterangan', 'Nominal'].map(sel).join(',')];
    urutkan(transaksi).forEach(t => baris.push([t.tanggal, t.waktu || '', t.jenis, infoKategori(t.kategori, t.jenis).nama, t.keterangan, t.nominal].map(sel).join(',')));
    const blob = new Blob(['\ufeff' + baris.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sakuku-${tanggalLokal()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    tampilkanNotifikasi('📄 Data berhasil diekspor.');
}
$('#btn-ekspor').addEventListener('click', eksporCSV);
$('#btn-ekspor-cepat').addEventListener('click', eksporCSV);

/* ============================================================================
   9. CELENGAN
   ============================================================================ */
const persenCelengan = c => Math.min(Math.round((c.terkumpul / c.target) * 100), 100);

function renderCelengan() {
    const wadah = $('#celengan-isi');

    if (!celengan.length) {
        wadah.innerHTML = `
            <div class="hero-empty">
                <svg class="leaf-l" aria-hidden="true"><use href="#art-leaf"/></svg><svg class="leaf-r" aria-hidden="true"><use href="#art-leaf"/></svg>
                <svg class="piggy" aria-hidden="true"><use href="#art-piggy"/></svg>
                <h2>Mulai menabung sekarang!</h2>
                <p>Setiap rupiah yang kamu tabung adalah langkah menuju impianmu.</p>
                <button type="button" class="btn-primary" data-aksi="celengan-baru">${ikon('i-plus-s')} Tambah Tabungan</button>
            </div>
            <article class="card benefit">
                <h3 class="card-title">Keuntungan Menabung</h3>
                <ul>
                    <li><span class="b-ic c-saku" style="background:var(--cb);color:var(--c)">${ikon('i-target')}</span>Bantu capai tujuan impian</li>
                    <li><span class="b-ic c-kesehatan" style="background:var(--cb);color:var(--c)">${ikon('i-shield')}</span>Jaga keuangan tetap aman</li>
                    <li><span class="b-ic c-makan" style="background:var(--cb);color:var(--c)">${ikon('i-flame')}</span>Latih disiplin finansial</li>
                </ul>
            </article>`;
        return;
    }

    const total = jumlahTerkumpul();
    const unggulan = celengan.filter(c => persenCelengan(c) < 100).sort((a, b) => persenCelengan(b) - persenCelengan(a))[0] || celengan[0];
    const pu = persenCelengan(unggulan);

    wadah.innerHTML = `
        <div class="cel-top">
            <article class="cel-total">
                <small>Total Tabungan</small>
                <h2>${formatRupiah(total)}</h2>
                <button type="button" class="btn-outline-light" data-aksi="tabung-umum">${ikon('i-plus-s')} Tambah Tabungan</button>
                <svg class="cel-art" aria-hidden="true"><use href="#art-piggy"/></svg>
            </article>
            <article class="card cel-feature">
                <div class="cf-top"><span class="round-ic">${ikon('i-target')}</span><div><small>Target Impian</small><b>${esc(unggulan.nama)}</b></div></div>
                <div class="cf-nums"><strong>${formatRupiah(unggulan.terkumpul)}</strong><span>/ ${formatRupiah(unggulan.target)}</span></div>
                <div class="cf-bar"><div class="bar"><i style="width:${pu}%"></i></div><b>${pu}%</b></div>
                <button type="button" class="cf-btn" data-nabung="${unggulan.id}">Lihat Detail ${ikon('i-chev')}</button>
            </article>
        </div>
        <article class="card">
            <div class="goal-head">
                <div><h3>Daftar Tabungan</h3><small>${ikon('i-target')} ${celengan.length} Target Impian</small></div>
                <button type="button" class="btn-primary sm" data-aksi="celengan-baru">${ikon('i-plus-s')} Tambah Celengan</button>
            </div>
            ${celengan.map(c => {
                const p = persenCelengan(c);
                return `
                <div class="goal-row${p >= 100 ? ' done' : ''}" data-nabung="${c.id}" role="button" tabindex="0" aria-label="Tabung ke ${esc(c.nama)}">
                    <span class="goal-ic">${ikon(p >= 100 ? 'i-check' : 'i-piggy')}</span>
                    <div class="goal-body">
                        <div class="goal-line"><b>${esc(c.nama)}${p >= 100 ? '<span class="badge-done">Tercapai 🎉</span>' : ''}</b><strong>${formatRupiah(c.terkumpul)} <small>/ ${formatRupiah(c.target)}</small></strong></div>
                        <div class="bar"><i style="width:${p}%"></i></div>
                        <div class="goal-sub"><span>Tabungan pribadi</span><span>${p}%</span></div>
                    </div>
                    <button type="button" class="del-btn" data-hapus-celengan="${c.id}" aria-label="Hapus ${esc(c.nama)}">${ikon('i-trash')}</button>
                </div>`;
            }).join('')}
        </article>`;
}
function jumlahTerkumpul() { return celengan.reduce((a, c) => a + c.terkumpul, 0); }

$('#celengan-isi').addEventListener('click', e => {
    const hapus = e.target.closest('[data-hapus-celengan]');
    if (hapus) { e.stopPropagation(); konfirmasiHapusCelengan(Number(hapus.dataset.hapusCelengan)); return; }
    const nabung = e.target.closest('[data-nabung]');
    if (nabung) { bukaModalNabung(Number(nabung.dataset.nabung)); return; }
    const aksi = e.target.closest('[data-aksi]');
    if (!aksi) return;
    if (aksi.dataset.aksi === 'celengan-baru') bukaModalCelenganBaru();
    if (aksi.dataset.aksi === 'tabung-umum') bukaModalTabungUmum();
});
$('#celengan-isi').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.goal-row')) {
        e.preventDefault();
        bukaModalNabung(Number(e.target.dataset.nabung));
    }
});

function nabung(id, nominal) {
    const c = celengan.find(x => x.id === id);
    if (!c) return;
    const sebelum = c.terkumpul;
    c.terkumpul = Math.min(c.terkumpul + nominal, c.target);
    perbaruiTampilan();
    const masuk = c.terkumpul - sebelum;
    tampilkanNotifikasi(c.terkumpul >= c.target
        ? `🎉 Target "${c.nama}" tercapai!`
        : `🎉 Berhasil menabung ${formatRupiah(masuk)} untuk ${c.nama}!`);
}
function bukaModalNabung(id) {
    const c = celengan.find(x => x.id === id);
    if (!c) return;
    const p = persenCelengan(c);
    if (c.terkumpul >= c.target) {
        bukaModal({ judul: c.nama, desc: 'Selamat, target tabunganmu sudah tercapai! 🎉', ringkasan: ringkasanCelengan(c, p), submit: 'Tutup', tanpaBatal: true, onSubmit: () => {} });
        return;
    }
    bukaModal({
        judul: `Tabung ke ${c.nama}`,
        ringkasan: ringkasanCelengan(c, p),
        fields: [{ id: 'nominal', label: 'Nominal tabungan', tipe: 'uang', chips: [5000, 10000, 20000, 50000] }],
        submit: 'Tabung',
        onSubmit: v => {
            if (v.nominal < 500) return 'Nominal minimal Rp 500.';
            nabung(id, v.nominal);
        }
    });
}
function ringkasanCelengan(c, p) {
    return `<div class="modal-sum">
        <div class="cf-bar"><div class="bar"><i style="width:${p}%"></i></div><b>${p}%</b></div>
        <span>Terkumpul <b>${formatRupiah(c.terkumpul)}</b> dari ${formatRupiah(c.target)}</span>
        <span>Sisa yang dibutuhkan <b>${formatRupiah(Math.max(c.target - c.terkumpul, 0))}</b></span>
    </div>`;
}
function bukaModalTabungUmum() {
    const aktif = celengan.filter(c => c.terkumpul < c.target);
    if (!aktif.length) { bukaModalCelenganBaru(); return; }
    bukaModal({
        judul: 'Tambah Tabungan',
        desc: 'Pilih celengan dan masukkan nominalnya.',
        fields: [
            { id: 'celengan', label: 'Celengan', tipe: 'pilih', opsi: aktif.map(c => ({ v: c.id, t: `${c.nama} (${persenCelengan(c)}%)` })) },
            { id: 'nominal', label: 'Nominal tabungan', tipe: 'uang', chips: [5000, 10000, 20000, 50000] }
        ],
        submit: 'Tabung',
        onSubmit: v => {
            if (v.nominal < 500) return 'Nominal minimal Rp 500.';
            nabung(Number(v.celengan), v.nominal);
        }
    });
}
function bukaModalCelenganBaru() {
    bukaModal({
        judul: 'Buat Target Tabungan Baru',
        desc: 'Punya barang impian? Catat targetmu dan nabung sedikit demi sedikit!',
        fields: [
            { id: 'nama', label: 'Nama barang', tipe: 'teks', placeholder: 'Misal: Headset Baru', maks: 40 },
            { id: 'target', label: 'Target harga', tipe: 'uang', chips: [50000, 100000, 250000, 500000] }
        ],
        submit: 'Buat Target',
        onSubmit: v => {
            if (!v.nama) return 'Isi nama barang dulu, ya.';
            if (v.target < 5000) return 'Target minimal Rp 5.000.';
            celengan.push({ id: Date.now(), nama: v.nama, target: v.target, terkumpul: 0 });
            perbaruiTampilan();
            tampilkanNotifikasi('✨ Target tabungan baru ditambahkan!');
        }
    });
}
function konfirmasiHapusCelengan(id) {
    const c = celengan.find(x => x.id === id);
    if (!c) return;
    bukaModal({
        judul: 'Hapus target tabungan?',
        desc: `"${c.nama}" dengan tabungan ${formatRupiah(c.terkumpul)} akan dihapus.`,
        submit: 'Ya, hapus', bahaya: true,
        onSubmit: () => {
            const idx = celengan.findIndex(x => x.id === id);
            const [item] = celengan.splice(idx, 1);
            perbaruiTampilan();
            tampilkanNotifikasi('🗑️ Target tabungan dihapus.', {
                label: 'Urungkan', fn: () => { celengan.splice(Math.min(idx, celengan.length), 0, item); perbaruiTampilan(); }
            });
        }
    });
}

/* ============================================================================
   10. MODAL (satu <dialog> dipakai bersama)
   ============================================================================ */
const modal = $('#modal');

function htmlField(f) {
    const id = 'mf-' + f.id;
    let input;
    if (f.tipe === 'pilih') {
        input = `<select id="${id}" class="input">${f.opsi.map(o => `<option value="${esc(o.v)}"${String(o.v) === String(f.nilai) ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
    } else if (f.tipe === 'uang') {
        input = `<div class="money sm"><span class="rp">Rp</span><input id="${id}" inputmode="numeric" autocomplete="off" placeholder="0"></div>` +
            (f.chips ? `<div class="chips">${f.chips.map(n => `<button type="button" class="chip" data-isi="${n}" data-untuk="${id}">${Number(n).toLocaleString('id-ID')}</button>`).join('')}</div>` : '');
    } else {
        input = `<div class="field"><input id="${id}" type="text" maxlength="${f.maks || 60}" placeholder="${esc(f.placeholder || '')}" value="${esc(f.nilai || '')}" autocomplete="off"></div>`;
    }
    return `<div class="field-group"><label class="lbl" for="${id}">${esc(f.label)}</label>${input}</div>`;
}

function bukaModal({ judul, desc = '', ringkasan = '', fields = [], submit = 'Simpan', bahaya = false, tanpaBatal = false, onSubmit }) {
    if (modal.open) modal.close();
    const form = document.createElement('form');
    form.className = 'modal-box';
    form.noValidate = true;
    form.innerHTML = `
        <div class="modal-head"><h3 id="modal-judul">${esc(judul)}</h3><button type="button" class="icon-btn sm ghost" data-tutup aria-label="Tutup">${ikon('i-x')}</button></div>
        ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
        ${ringkasan}
        ${fields.map(htmlField).join('')}
        <p class="err" role="alert" hidden></p>
        <div class="modal-actions">
            ${tanpaBatal ? '' : '<button type="button" class="btn-ghost" data-tutup>Batal</button>'}
            <button type="submit" class="btn-primary${bahaya ? ' danger' : ''}">${esc(submit)}</button>
        </div>`;

    fields.forEach(f => {
        const el = $('#mf-' + f.id, form);
        if (f.tipe === 'uang') { pasangInputUang(el); if (f.nilai) isiUang(el, f.nilai); }
    });
    form.addEventListener('click', e => {
        if (e.target.closest('[data-tutup]')) { modal.close(); return; }
        const chip = e.target.closest('.chip[data-isi]');
        if (chip) { isiUang($('#' + chip.dataset.untuk, form), chip.dataset.isi); $('#' + chip.dataset.untuk, form).focus(); }
    });
    form.addEventListener('submit', e => {
        e.preventDefault();
        const nilai = {};
        fields.forEach(f => {
            const el = $('#mf-' + f.id, form);
            nilai[f.id] = f.tipe === 'uang' ? ambilUang(el) : el.value.trim();
        });
        const galat = onSubmit(nilai);
        const boxGalat = $('.err', form);
        if (typeof galat === 'string' && galat) { boxGalat.textContent = galat; boxGalat.hidden = false; return; }
        modal.close();
    });

    modal.replaceChildren(form);
    modal.showModal();
    const pertama = $('input, select', form);
    if (pertama) setTimeout(() => pertama.focus(), 60);
}
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
modal.addEventListener('close', () => { if (!modal.open) modal.replaceChildren(); });

/* ============================================================================
   11. HEADER: NOTIFIKASI, NAMA PENGGUNA, SEMBUNYIKAN SALDO, BATAS HARIAN
   ============================================================================ */
function bangunNotifikasi() {
    const r = hitungRingkasan();
    const st = statusLimit(r.keluarHariIni);
    const daftar = [];
    if (st.kode === 'boros') daftar.push({ tipe: 'danger', ikon: 'i-flame', teks: `Jajan hari ini ${formatRupiah(r.keluarHariIni)}, melewati batas ${formatRupiah(batasHarian)}.` });
    else if (st.kode === 'waspada') daftar.push({ tipe: 'warn', ikon: 'i-target', teks: `Jatah jajan hari ini tinggal ${formatRupiah(batasHarian - r.keluarHariIni)}.` });
    if (r.saldo < 0) daftar.push({ tipe: 'danger', ikon: 'i-wallet', teks: `Saldo kamu minus ${formatRupiah(Math.abs(r.saldo))}. Cek lagi catatanmu.` });
    else if (r.saldo === 0 && transaksi.length) daftar.push({ tipe: 'warn', ikon: 'i-wallet', teks: 'Saldo kamu sudah habis.' });
    if (!transaksi.some(t => t.tanggal === r.hariIni)) daftar.push({ tipe: 'info', ikon: 'i-note', teks: 'Kamu belum mencatat transaksi hari ini.' });
    celengan.forEach(c => {
        const p = persenCelengan(c);
        if (p >= 100) daftar.push({ tipe: 'ok', ikon: 'i-check', teks: `Target "${c.nama}" sudah tercapai! 🎉` });
        else if (p >= 80) daftar.push({ tipe: 'info', ikon: 'i-piggy', teks: `"${c.nama}" tinggal sedikit lagi (${p}%).` });
    });
    if (!daftar.length) daftar.push({ tipe: 'ok', ikon: 'i-check', teks: 'Semua aman. Tidak ada pemberitahuan baru.' });
    return daftar;
}
function renderNotifikasi() {
    const daftar = bangunNotifikasi();
    $('#bell-dot').hidden = !daftar.some(n => n.tipe === 'warn' || n.tipe === 'danger');
    $('#notif-pop').innerHTML = `<h4>Notifikasi</h4>` + daftar.map(n =>
        `<div class="notif ${n.tipe}"><span class="n-ic">${ikon(n.ikon)}</span><span>${esc(n.teks)}</span></div>`).join('');
}
function tutupPopover() {
    $('#notif-pop').hidden = true;
    $('#btn-bell').setAttribute('aria-expanded', 'false');
}
$('#btn-bell').addEventListener('click', e => {
    e.stopPropagation();
    const pop = $('#notif-pop');
    pop.hidden = !pop.hidden;
    $('#btn-bell').setAttribute('aria-expanded', String(!pop.hidden));
});
document.addEventListener('click', e => { if (!e.target.closest('.pop-wrap')) tutupPopover(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupPopover(); });

$('#btn-eye').addEventListener('click', () => { sembunyiSaldo = !sembunyiSaldo; perbaruiTampilan(); });
$('#btn-back').addEventListener('click', () => pindahHalaman('beranda'));
$('#tips-card').addEventListener('click', () => { indeksTips = (indeksTips + 1) % TIPS.length; renderTips(); });

$('#btn-user').addEventListener('click', () => {
    bukaModal({
        judul: 'Ubah nama', desc: 'Nama ini dipakai untuk sapaan di Beranda.',
        fields: [{ id: 'nama', label: 'Namamu', tipe: 'teks', nilai: namaUser, maks: 20 }],
        submit: 'Simpan',
        onSubmit: v => {
            if (!v.nama) return 'Nama tidak boleh kosong.';
            namaUser = v.nama;
            perbaruiTampilan();
            tampilkanNotifikasi('👋 Halo, ' + namaUser + '!');
        }
    });
});
$('#btn-ubah-limit').addEventListener('click', () => {
    bukaModal({
        judul: 'Atur batas jajan harian', desc: 'Berapa maksimal uang yang boleh kamu keluarkan per hari?',
        fields: [{ id: 'limit', label: 'Batas harian', tipe: 'uang', nilai: batasHarian, chips: [15000, 20000, 25000, 30000, 50000] }],
        submit: 'Simpan',
        onSubmit: v => {
            if (v.limit < 1000) return 'Batas minimal Rp 1.000.';
            batasHarian = v.limit;
            perbaruiTampilan();
            tampilkanNotifikasi('🔥 Batas jajan harian diperbarui!');
        }
    });
});

/* ============================================================================
   12. TOAST
   ============================================================================ */
let timerToast;
function tampilkanNotifikasi(pesan, aksi) {
    const toast = $('#toast'), tombol = $('#toast-aksi');
    $('#toast-text').textContent = pesan;
    tombol.hidden = !aksi;
    tombol.textContent = aksi ? aksi.label : '';
    tombol.onclick = aksi ? () => { toast.classList.remove('show'); aksi.fn(); } : null;
    toast.classList.add('show');
    clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove('show'), aksi ? 5000 : 2600);
}

/* ============================================================================
   13. RENDER MENYELURUH & START
   ============================================================================ */
function renderTanggalHeader() {
    const sekarang = new Date();
    $('#date-day').textContent = sekarang.toLocaleDateString('id-ID', { weekday: 'long' }) + ',';
    $('#date-full').textContent = sekarang.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function renderSemua() {
    $('#user-name').textContent = namaUser;
    renderTanggalHeader();
    renderJudul();
    renderBeranda();
    renderRiwayat();
    renderCelengan();
    renderNotifikasi();
    perbaruiPreview();
}
function perbaruiTampilan() {
    simpanKeStorage();
    renderSemua();
}

// Sinkron antar tab & saat tab dibuka kembali (tanggal bisa sudah berganti)
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('sakuku_')) { muatState(); renderSemua(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderSemua(); });
window.addEventListener('hashchange', tampilkanHalaman);

muatState();
inputTanggal.value = tanggalLokal();
renderGridKategori();
renderTips();
perbaruiTampilan();
tampilkanHalaman();