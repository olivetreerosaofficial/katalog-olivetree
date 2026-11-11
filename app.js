(function () {
  'use strict';

  var PRODUCTS = window.PRODUCTS;
  var TOKO = window.TOKO || {};
  var IG = String(TOKO.instagram || '').replace(/^@/, '').trim();

  function $(id) { return document.getElementById(id); }

  var grid = $('grid-produk');
  var nav = $('kategori-nav');
  var hamburger = $('hamburger-btn');
  var emptyState = $('empty-state');
  var overlay = $('modal-overlay');
  var tombolBeli = $('modal-beli');
  var kartuList = [];
  var produkAktif = null;
  var pemicuModal = null;

  // ---------- Helper ----------
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function rupiah(n) {
    return 'Rp ' + Number(n).toLocaleString('id-ID');
  }

  function adaHarga(p) {
    return Number(p.harga) > 0;
  }

  function daftarFoto(p) {
    if (Array.isArray(p.foto)) return p.foto.filter(Boolean);
    return p.foto ? [p.foto] : [];
  }

  // null = stok tidak dicatat (tombol beli tetap aktif, stok tidak ditampilkan)
  function stokProduk(p) {
    if (p.jumlah === undefined || p.jumlah === null || p.jumlah === '') return null;
    return Number(p.jumlah) || 0;
  }

  function kunciKategori(p) {
    return String(p.kategori || '').trim().toLowerCase();
  }

  function tampilkanPesan(teks) {
    emptyState.textContent = teks;
    emptyState.hidden = false;
  }

  // Kalau file data/products.js salah ketik (kurang koma / tanda kutip), PRODUCTS tidak terbaca
  if (!Array.isArray(PRODUCTS)) {
    tampilkanPesan('Data produk tidak terbaca. Cek file data/products.js, kemungkinan ada koma atau tanda kutip yang kurang.');
    nav.hidden = true;
    hamburger.hidden = true;
    return;
  }

  // ---------- Kartu produk ----------
  function buatKartu(p) {
    var kartu = el('div', 'card clickable');
    kartu.setAttribute('role', 'button');
    kartu.setAttribute('aria-label', 'Lihat detail ' + (p.nama || 'produk'));
    kartu.tabIndex = 0;
    kartu.dataset.kategori = kunciKategori(p);

    var foto = daftarFoto(p);
    if (foto.length) {
      var img = el('img');
      img.src = foto[0];
      img.alt = p.nama || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        img.replaceWith(el('div', 'no-image', 'Tidak ada gambar'));
      });
      kartu.appendChild(img);
    } else {
      kartu.appendChild(el('div', 'no-image', 'Tidak ada gambar'));
    }

    var body = el('div', 'card-body');
    if (p.sku) body.appendChild(el('div', 'sku-label', p.sku));
    body.appendChild(el('h3', null, p.nama));
    if (adaHarga(p)) body.appendChild(el('div', 'harga', rupiah(p.harga)));
    kartu.appendChild(body);

    kartu.addEventListener('click', function () { bukaModal(p, kartu); });
    kartu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        bukaModal(p, kartu);
      }
    });
    return kartu;
  }

  // ---------- Kategori ----------
  function buatTombolKategori(kunci, label, aktif) {
    var b = el('button', 'kategori-btn' + (aktif ? ' active' : ''), label);
    b.type = 'button';
    b.dataset.kategori = kunci;
    b.addEventListener('click', function () { pilihKategori(kunci, b); });
    return b;
  }

  function bangunNav() {
    var urutan = [];
    var terlihat = {};
    function tambah(k) {
      k = String(k || '').trim().toLowerCase();
      if (k && !terlihat[k]) { terlihat[k] = true; urutan.push(k); }
    }
    // Urutan kategori bisa diatur lewat TOKO.urutanKategori, sisanya mengikuti urutan produk
    (Array.isArray(TOKO.urutanKategori) ? TOKO.urutanKategori : []).forEach(tambah);
    PRODUCTS.forEach(function (p) { tambah(kunciKategori(p)); });

    if (!urutan.length) {
      nav.hidden = true;
      hamburger.hidden = true;
      return;
    }
    nav.appendChild(buatTombolKategori('all', 'ALL PRODUCTS', true));
    urutan.forEach(function (k) {
      nav.appendChild(buatTombolKategori(k, k.toUpperCase(), false));
    });
  }

  function tutupNavMobile() {
    nav.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }

  function pilihKategori(kunci, tombol) {
    nav.querySelectorAll('.kategori-btn').forEach(function (b) { b.classList.remove('active'); });
    tombol.classList.add('active');

    var tampil = 0;
    kartuList.forEach(function (k) {
      var cocok = kunci === 'all' || k.dataset.kategori === kunci;
      k.hidden = !cocok;
      if (cocok) tampil++;
    });

    if (tampil === 0) tampilkanPesan('Tidak ada produk di kategori ini.');
    else emptyState.hidden = true;

    tutupNavMobile();
  }

  hamburger.addEventListener('click', function () {
    var buka = nav.classList.toggle('open');
    hamburger.classList.toggle('open', buka);
    hamburger.setAttribute('aria-expanded', buka ? 'true' : 'false');
  });

  // ---------- Modal ----------
  function bukaModal(p, pemicu) {
    produkAktif = p;
    pemicuModal = pemicu || null;

    var foto = daftarFoto(p);
    var utama = $('modal-gambar-utama');
    var thumbs = $('modal-thumbs');
    thumbs.textContent = '';
    utama.onerror = function () { utama.style.display = 'none'; };

    if (foto.length) {
      utama.src = foto[0];
      utama.alt = p.nama || '';
      utama.style.display = 'block';
      if (foto.length > 1) {
        foto.forEach(function (f, i) {
          var t = el('img', 'thumb' + (i === 0 ? ' active' : ''));
          t.src = f;
          t.alt = 'Foto ' + (i + 1);
          t.tabIndex = 0;
          var pilih = function () {
            utama.src = f;
            utama.style.display = 'block';
            thumbs.querySelectorAll('.thumb').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
          };
          t.addEventListener('click', pilih);
          t.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilih(); }
          });
          thumbs.appendChild(t);
        });
      }
    } else {
      utama.removeAttribute('src');
      utama.style.display = 'none';
    }

    var stok = stokProduk(p);
    var tersedia = stok === null || stok > 0;

    $('modal-sku').textContent = p.sku ? 'SKU: ' + p.sku : '';
    $('modal-nama').textContent = p.nama || '';
    $('modal-harga').textContent = adaHarga(p) ? rupiah(p.harga) : '';
    $('modal-deskripsi').textContent = p.deskripsi || '';
    $('modal-stok').textContent = stok === null ? '' : (stok > 0 ? 'Stok: ' + stok : 'Stok habis');

    tombolBeli.style.display = IG ? 'block' : 'none';
    tombolBeli.disabled = !tersedia;
    tombolBeli.textContent = tersedia ? 'Beli via Instagram' : 'Stok habis';

    overlay.querySelector('.modal-box').scrollTop = 0;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('modal-close').focus();
  }

  function tutupModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    produkAktif = null;
    if (pemicuModal && pemicuModal.focus) pemicuModal.focus();
    pemicuModal = null;
  }

  $('modal-close').addEventListener('click', tutupModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) tutupModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) tutupModal();
  });

  // ---------- Tombol Beli (DM Instagram) ----------
  function pesanBeli(p) {
    var baris = ['Halo kak, saya ingin membeli:', 'Produk: ' + p.nama];
    if (p.sku) baris.push('SKU: ' + p.sku);
    if (adaHarga(p)) baris.push('Harga: ' + rupiah(p.harga));
    baris.push('', 'Apakah masih tersedia? Terima kasih 🙏');
    return baris.join('\n');
  }

  function salinTeks(teks) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(teks).then(function () { return true; }, function () { return false; });
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = teks;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  var timerToast = null;
  function tampilToast(teks) {
    var t = $('toast');
    t.textContent = teks;
    t.classList.add('show');
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { t.classList.remove('show'); }, 4000);
  }

  tombolBeli.addEventListener('click', function () {
    var p = produkAktif;
    if (!p || !IG || !(stokProduk(p) === null || stokProduk(p) > 0)) return;

    var pesan = pesanBeli(p);
    var url = 'https://ig.me/m/' + encodeURIComponent(IG) + '?text=' + encodeURIComponent(pesan);

    // Harus dipanggil langsung di dalam klik supaya tidak diblokir browser
    window.open(url, '_blank', 'noopener');

    // Pesan juga disalin sebagai cadangan, kalau Instagram tidak mengisi kolom chat otomatis
    salinTeks(pesan).then(function (ok) {
      if (ok) tampilToast('Pesan sudah disalin. Kalau kolom chat kosong, tempel (paste) lalu kirim ya.');
    });
  });

  // ---------- Mulai ----------
  bangunNav();
  PRODUCTS.forEach(function (p) {
    var kartu = buatKartu(p);
    kartuList.push(kartu);
    grid.appendChild(kartu);
  });
  if (!PRODUCTS.length) tampilkanPesan('Belum ada produk.');
})();
