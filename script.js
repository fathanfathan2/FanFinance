/**
 * ============================================================================
 * LOGIKA JAVASCRIPT APLIKASI SAKUKU
 * Mencakup: Navigasi Sidebar, Hitung Saldo, Filter Data, Celengan, & LocalStorage
 * ============================================================================
 */

// 1. INISIALISASI DATA DARI LOCALSTORAGE (Atau gunakan data contoh jika masih kosong)
let daftarTransaksi = JSON.parse(localStorage.getItem('sakuku_transaksi')) || [
    { id: 1, tanggal: dapatkanTanggalHariIni(), keterangan: 'Uang Saku Mingguan', kategori: 'Uang Saku', jenis: 'pemasukan', nominal: 100000 },
    { id: 2, tanggal: dapatkanTanggalHariIni(), keterangan: 'Makan Siang di Kantin', kategori: 'Makan & Jajan', jenis: 'pengeluaran', nominal: 12000 },
    { id: 3, tanggal: dapatkanTanggalHariIni(), keterangan: 'Ongkos Angkot PP', kategori: 'Transportasi', jenis: 'pengeluaran', nominal: 8000 }
];

let daftarCelengan = JSON.parse(localStorage.getItem('sakuku_celengan')) || [
    { id: 101, nama: 'Headset Buat Ngoding', target: 150000, terkumpul: 75000 },
    { id: 102, nama: 'Patungan Kas Kelas', target: 50000, terkumpul: 30000 }
];

let batasHarian = Number(localStorage.getItem('sakuku_limit')) || 25000;

// Fungsi pembantu mendapatkan tanggal hari ini dalam format YYYY-MM-DD
function dapatkanTanggalHariIni() {
    return new Date().toISOString().split('T')[0];
}

// Fungsi pembantu memformat angka menjadi Rupiah (contoh: Rp 15.000)
function formatRupiah(angka) {
    return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

// Fungsi menampilkan notifikasi Toast
function tampilkanNotifikasi(pesan) {
    const toast = document.getElementById('toast');
    toast.textContent = pesan;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// Fungsi menyimpan semua perubahan ke LocalStorage browser
function simpanKeStorage() {
    localStorage.setItem('sakuku_transaksi', JSON.stringify(daftarTransaksi));
    localStorage.setItem('sakuku_celengan', JSON.stringify(daftarCelengan));
    localStorage.setItem('sakuku_limit', batasHarian);
}

// ============================================================================
// 2. LOGIKA NAVIGASI SIDEBAR (SPA Tab Switching)
// ============================================================================
const tombolNav = document.querySelectorAll('.nav-btn');
const semuaHalaman = document.querySelectorAll('.view-section');
const judulHalaman = document.getElementById('page-title');

const petaJudul = {
    'view-beranda': 'Ringkasan Uang Saku',
    'view-catat': 'Catat Transaksi Baru',
    'view-riwayat': 'Data Riwayat Transaksi',
    'view-celengan': 'Celengan Target Impian'
};

function pindahHalaman(idTarget) {
    // Matikan semua halaman dan tombol aktif
    semuaHalaman.forEach(sec => sec.classList.remove('active'));
    tombolNav.forEach(btn => btn.classList.remove('active'));

    // Aktifkan halaman dan tombol yang dipilih
    document.getElementById(idTarget).classList.add('active');
    const tombolAktif = document.querySelector(`.nav-btn[data-target="${idTarget}"]`);
    if (tombolAktif) tombolAktif.classList.add('active');

    // Ubah judul header
    judulHalaman.textContent = petaJudul[idTarget] || 'SakuKu';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

tombolNav.forEach(btn => {
    btn.addEventListener('click', () => pindahHalaman(btn.dataset.target));
});

// Tombol jalan pintas "+ Catat Cepat" & "Lihat Semua"
document.getElementById('btn-shortcut-catat').addEventListener('click', () => pindahHalaman('view-catat'));
document.getElementById('btn-lihat-semua').addEventListener('click', () => pindahHalaman('view-riwayat'));

// ============================================================================
// 3. PERHITUNGAN SALDO, BATAS HARIAN, & RENDER BERANDA
// ============================================================================
function perbaruiTampilan() {
    simpanKeStorage();

    // A. Hitung Total Pemasukan, Pengeluaran, dan Sisa Saldo
    let totalMasuk = 0;
    let totalKeluar = 0;
    let keluarHariIni = 0;
    const hariIni = dapatkanTanggalHariIni();

    daftarTransaksi.forEach(item => {
        if (item.jenis === 'pemasukan') {
            totalMasuk += item.nominal;
        } else {
            totalKeluar += item.nominal;
            if (item.tanggal === hariIni) {
                keluarHariIni += item.nominal;
            }
        }
    });

    const sisaSaldo = totalMasuk - totalKeluar;

    // Tampilkan ke kartu Beranda
    document.getElementById('val-saldo').textContent = formatRupiah(sisaSaldo);
    document.getElementById('val-pemasukan').textContent = formatRupiah(totalMasuk);
    document.getElementById('val-pengeluaran').textContent = formatRupiah(totalKeluar);

    // B. Perbarui Indikator Batas Jajan Harian
    document.getElementById('val-jajan-hari-ini').textContent = formatRupiah(keluarHariIni);
    document.getElementById('val-batas-harian').textContent = formatRupiah(batasHarian);

    const persentaseLimit = Math.min((keluarHariIni / batasHarian) * 100, 100);
    const barLimit = document.getElementById('bar-limit');
    const statusLimit = document.getElementById('status-limit');

    barLimit.style.width = persentaseLimit + '%';

    if (keluarHariIni > batasHarian) {
        barLimit.style.backgroundColor = '#ef4444'; // Merah
        statusLimit.textContent = '⚠️ Waduh! Jajanmu hari ini sudah melewati batas harian.';
        statusLimit.style.color = '#ef4444';
    } else if (persentaseLimit >= 75) {
        barLimit.style.backgroundColor = '#f59e0b'; // Kuning
        statusLimit.textContent = `💡 Hati-hati, sisa jatah jajan hari ini tinggal ${formatRupiah(batasHarian - keluarHariIni)}.`;
        statusLimit.style.color = '#d97706';
    } else {
        barLimit.style.backgroundColor = '#10b981'; // Hijau
        statusLimit.textContent = `✅ Masih aman! Sisa jatah jajan hari ini ${formatRupiah(batasHarian - keluarHariIni)}.`;
        statusLimit.style.color = '#059669';
    }

    // C. Render 3 Transaksi Terakhir di Beranda
    renderTransaksiTerakhir();

    // D. Render Tabel Riwayat Lengkap
    renderTabelRiwayat();

    // E. Render Daftar Celengan
    renderCelengan();
}

function renderTransaksiTerakhir() {
    const listEl = document.getElementById('list-terakhir');
    listEl.innerHTML = '';

    const tigaTerakhir = daftarTransaksi.slice().reverse().slice(0, 3);

    if (tigaTerakhir.length === 0) {
        listEl.innerHTML = '<li class="text-muted">Belum ada catatan transaksi.</li>';
        return;
    }

    tigaTerakhir.forEach(item => {
        const tanda = item.jenis === 'pemasukan' ? '+' : '-';
        const warna = item.jenis === 'pemasukan' ? 'text-success' : 'text-danger';

        const li = document.createElement('li');
        li.className = 'recent-item';
        li.innerHTML = `
            <div>
                <p class="recent-title">${item.keterangan}</p>
                <span class="recent-meta">${item.tanggal} &bull; ${item.kategori}</span>
            </div>
            <strong class="${warna}">${tanda} ${formatRupiah(item.nominal)}</strong>
        `;
        listEl.appendChild(li);
    });
}

// ============================================================================
// 4. FITUR TAMBAH TRANSAKSI & TOMBOL NOMINAL CEPAT
// ============================================================================
const inputNominal = document.getElementById('input-nominal');
const inputTanggal = document.getElementById('input-tanggal');
inputTanggal.value = dapatkanTanggalHariIni();

// Event Listener untuk Tombol Nominal Cepat (Rp 5.000, Rp 10.000, dst)
document.querySelectorAll('.chip').forEach(tombol => {
    tombol.addEventListener('click', () => {
        inputNominal.value = tombol.dataset.nominal;
        inputNominal.focus();
    });
});

// Event Listener Submit Form Transaksi
document.getElementById('form-transaksi').addEventListener('submit', function(e) {
    e.preventDefault();

    const jenis = document.querySelector('input[name="jenis"]:checked').value;
    const nominal = Number(inputNominal.value);
    const kategori = document.getElementById('input-kategori').value;
    const tanggal = inputTanggal.value;
    const keterangan = document.getElementById('input-keterangan').value.trim();

    if (!keterangan || nominal <= 0) return;

    const transaksiBaru = {
        id: Date.now(),
        tanggal,
        keterangan,
        kategori,
        jenis,
        nominal
    };

    daftarTransaksi.push(transaksiBaru);
    perbaruiTampilan();

    // Reset form dan pindah ke Beranda
    this.reset();
    inputTanggal.value = dapatkanTanggalHariIni();
    tampilkanNotifikasi('✅ Catatan berhasil disimpan!');
    pindahHalaman('view-beranda');
});

// Tombol Ubah Batas Jajan Harian
document.getElementById('btn-ubah-limit').addEventListener('click', () => {
    const inputBaru = prompt('Masukkan batas jajan harian baru (Rp):', batasHarian);
    if (inputBaru !== null && !isNaN(inputBaru) && Number(inputBaru) >= 1000) {
        batasHarian = Number(inputBaru);
        perbaruiTampilan();
        tampilkanNotifikasi('🔥 Batas jajan harian diperbarui!');
    }
});

// ============================================================================
// 5. FITUR TABEL RIWAYAT, FILTER, PENCARIAN, & HAPUS
// ============================================================================
const searchInput = document.getElementById('search-transaksi');
const filterSelect = document.getElementById('filter-jenis');

function renderTabelRiwayat() {
    const tbody = document.getElementById('tabel-riwayat-body');
    tbody.innerHTML = '';

    const kataKunci = searchInput.value.toLowerCase();
    const filterJenis = filterSelect.value;

    // Saring data berdasarkan pencarian dan dropdown jenis
    const dataTersaring = daftarTransaksi.slice().reverse().filter(item => {
        const cocokKata = item.keterangan.toLowerCase().includes(kataKunci) || item.kategori.toLowerCase().includes(kataKunci);
        const cocokJenis = filterJenis === 'semua' || item.jenis === filterJenis;
        return cocokKata && cocokJenis;
    });

    if (dataTersaring.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;" class="text-muted">Tidak ada data transaksi yang cocok.</td></tr>';
        return;
    }

    dataTersaring.forEach(item => {
        const tanda = item.jenis === 'pemasukan' ? '+' : '-';
        const kelasWarna = item.jenis === 'pemasukan' ? 'text-success' : 'text-danger';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.tanggal}</td>
            <td><strong>${item.keterangan}</strong></td>
            <td><span class="badge-kategori">${item.kategori}</span></td>
            <td class="${kelasWarna}"><strong>${tanda} ${formatRupiah(item.nominal)}</strong></td>
            <td>
                <button type="button" class="btn-hapus" onclick="hapusTransaksi(${item.id})">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Fungsi Hapus 1 Transaksi
window.hapusTransaksi = function(id) {
    daftarTransaksi = daftarTransaksi.filter(item => item.id !== id);
    perbaruiTampilan();
    tampilkanNotifikasi('🗑️ Catatan dihapus.');
};

// Event Listener Pencarian & Filter Real-time
searchInput.addEventListener('input', renderTabelRiwayat);
filterSelect.addEventListener('change', renderTabelRiwayat);

// Tombol Reset Semua Data
document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm('Yakin ingin menghapus seluruh riwayat transaksi?')) {
        daftarTransaksi = [];
        perbaruiTampilan();
        tampilkanNotifikasi('Semua data riwayat telah dikosongkan.');
    }
});

// ============================================================================
// 6. FITUR CELENGAN (TARGET TABUNGAN INTERAKTIF)
// ============================================================================
function renderCelengan() {
    const container = document.getElementById('list-celengan');
    container.innerHTML = '';

    daftarCelengan.forEach(item => {
        const persen = Math.min(Math.round((item.terkumpul / item.target) * 100), 100);

        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
            <div class="goal-card-head">
                <h4>🎯 ${item.nama}</h4>
                <strong>${persen}%</strong>
            </div>
            <p class="text-muted mb-1">Terkumpul <strong>${formatRupiah(item.terkumpul)}</strong> dari ${formatRupiah(item.target)}</p>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${persen}%; background-color: #4f46e5;"></div>
            </div>
            <div class="goal-actions">
                <button type="button" class="btn-small" onclick="tambahTabungan(${item.id}, 10000)">+ Nabung Rp 10.000</button>
                <button type="button" class="btn-hapus" onclick="hapusCelengan(${item.id})">Hapus</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Tambah Target Celengan Baru
document.getElementById('form-celengan').addEventListener('submit', function(e) {
    e.preventDefault();
    const nama = document.getElementById('goal-nama').value.trim();
    const target = Number(document.getElementById('goal-target').value);

    if (!nama || target <= 0) return;

    daftarCelengan.push({
        id: Date.now(),
        nama,
        target,
        terkumpul: 0
    });

    this.reset();
    perbaruiTampilan();
    tampilkanNotifikasi('🎯 Target tabungan baru ditambahkan!');
});

// Fungsi Nabung ke Celengan
window.tambahTabungan = function(id, nominal) {
    const celengan = daftarCelengan.find(c => c.id === id);
    if (celengan) {
        celengan.terkumpul = Math.min(celengan.terkumpul + nominal, celengan.target);
        perbaruiTampilan();
        tampilkanNotifikasi(`🎉 Berhasil menabung ${formatRupiah(nominal)} untuk ${celengan.nama}!`);
    }
};

// Fungsi Hapus Celengan
window.hapusCelengan = function(id) {
    daftarCelengan = daftarCelengan.filter(c => c.id !== id);
    perbaruiTampilan();
    tampilkanNotifikasi('🗑️ Target tabungan dihapus.');
};

// ============================================================================
// 7. JALANKAN SAAT HALAMAN PERTAMA KALI DIBUKA
// ============================================================================
document.getElementById('current-date').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

perbaruiTampilan();