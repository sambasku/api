UPDATE `legal_documents` SET `status` = 'archived', `updated_at` = unixepoch() * 1000 WHERE `document_type` = 'privacy' AND `version` = '2026-09-26' AND `status` = 'published';--> statement-breakpoint
UPDATE `legal_documents` SET `status` = 'archived', `updated_at` = unixepoch() * 1000 WHERE `document_type` = 'terms' AND `version` = '2026-09-26' AND `status` = 'published';--> statement-breakpoint
INSERT INTO `legal_documents` (`id`, `document_type`, `version`, `title`, `body_markdown`, `status`, `published_at`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES
(
	'01LEGALPRIVACY20261004001',
	'privacy',
	'2026-10-04',
	'Kebijakan Privasi',
	'# Kebijakan Privasi SambasKu

**Terakhir diperbarui:** 4 Oktober 2026

Privasimu penting bagi kami. Dokumen ini menjelaskan data apa yang kami proses di SambasKu, untuk apa, dan hak-hakmu.

## Data yang Kami Proses

- Data akun: nama, username, dan email saat kamu mendaftar.
- Konten kontribusi: kata yang kamu usulkan, contoh kalimat, rekaman suara, dan komentar yang kamu tulis.
- Aktivitas: penilaian pada kata dan kata yang kamu simpan.
- Log server: data teknis standar (alamat IP, waktu akses) untuk menjaga keamanan layanan. Log permintaan API disimpan paling lama 90 hari.

Rekaman suara dipublikasikan hanya dengan persetujuan penutur yang bersuara, diminta saat pengunggahan. Suara adalah data pribadi, dan pemiliknya bisa minta hapus kapan saja.

## Data Anak

Layanan SambasKu tidak ditujukan untuk anak di bawah 18 tahun tanpa persetujuan orang tua. Kalau kamu orang tua dan mendapati anakmu punya akun di SambasKu, hubungi kami dan datanya kami hapus. Untuk pemakaian di sekolah, pendampingan guru atau orang tua berlaku sebagai pemberi persetujuan.

## Tujuan Pemrosesan

Data hanya dipakai untuk:

- menjalankan layanan kamus dan fitur komunitas (profil, mention, notifikasi);
- memeriksa usulan kata dan moderasi komentar;
- merespons pertanyaan dan laporan.

## Yang Tidak Kami Lakukan

- Kami tidak menjual data pengguna.
- Kami tidak memasang iklan.
- Kami tidak membagikan data ke pihak ketiga untuk keperluan pemasaran.

## Pihak Ketiga yang Membantu

Beberapa layanan pihak ketiga membantu SambasKu berjalan, dan sebagian datamu diproses oleh mereka sebatas keperluan layanan:

- penyedia hosting untuk situs dan API;
- Google, melalui Google Play (distribusi aplikasi) dan Firebase Cloud Messaging (notifikasi);
- Cloudflare, untuk perlindungan dan pengiriman konten;
- Turso, untuk penyimpanan data;
- Resend, untuk layanan pengiriman email.

Mereka tidak boleh memakai datamu untuk iklan atau pemasaran. Aplikasi pihak ketiga yang kamu izinkan lewat OAuth SambasKu bisa mengakses datamu sesuai lingkup yang kamu setujui di layar izin, dan kamu bisa mencabutnya kapan saja.

## Penyimpanan dan Penghapusan

Data disimpan selama akunmu aktif. Kalau kamu ingin menghapus akun dan datanya, buka halaman Hapus Akun di situs atau aplikasi SambasKu, atau kirim permintaan ke mail@sambasku.com. Permintaan kami proses paling lama 30 hari kerja. Log server disimpan paling lama 90 hari untuk keamanan.

Menghapus akun menghapus data pribadi dan rekaman suaramu. Kontribusi kata yang sudah terbit tetap ada sebagai sumbangan anonim agar kamus tetap utuh.

## Hakmu

Terhadap datamu sendiri, kamu bisa minta:

- melihat dan mendapat salinan data yang kami simpan;
- memperbaiki data yang salah;
- menghapus akun dan datanya;
- menarik persetujuan pemrosesan.

Semua permintaan lewat mail@sambasku.com, gratis.

## Perubahan Kebijakan

Kalau isi kebijakan ini berubah penting, kami umumkan lewat situs dan aplikasi SambasKu.

## Kontak

Pertanyaan soal privasi: mail@sambasku.com.
',
	'published',
	unixepoch() * 1000,
	NULL,
	NULL,
	unixepoch() * 1000,
	unixepoch() * 1000
),
(
	'01LEGALSTERMS202610040001',
	'terms',
	'2026-10-04',
	'Syarat dan Ketentuan',
	'# Syarat dan Ketentuan SambasKu

**Berlaku efektif:** 4 Oktober 2026

Dengan membuat akun atau menggunakan SambasKu, kamu menyetujui syarat berikut.

## 1. Layanan

SambasKu adalah kamus digital kolaboratif bahasa Melayu Sambas dan Indonesia, dikelola komunitas secara sukarela. Fitur mencakup pencarian, kontribusi, komentar, pemberian suara (upvote/downvote), diskusi, dan notifikasi.

## 2. Akun

Kamu bertanggung jawab menjaga kerahasiaan kredensial. Akun yang melanggar ketentuan dapat dinonaktifkan.

## 3. Kontribusi dan konten

Konten yang kamu kirim harus sesuai hukum dan norma komunitas. Setiap usulan kami periksa lebih dulu sebelum ditayangkan, dan kami dapat meninjau, menolak, atau menghapus konten yang melanggar.

## 4. Lisensi konten

Setiap kontributor merilis kontribusinya di kamus SambasKu, seperti kata, contoh kalimat, dan rekaman suara, di bawah lisensi CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/deed.id). Siapa saja boleh memakai dan mengolahnya selama mencantumkan sumber dan membagikan hasilnya dengan lisensi yang sama. Kontributor menjamin konten yang dikirim bukan salinan dari sumber yang melarang penggunaan ulang.

## 5. Pemberian suara

Arah suara (naik/turun) harus mencerminkan penilaianmu yang jujur. Memanipulasi suara secara sistematis atau menyesatkan pengguna lain tentang arti aksi di aplikasi dilarang.

## 6. Aplikasi pihak ketiga

Akses tulis atas namamu hanya diizinkan melalui aplikasi resmi SambasKu atau aplikasi pihak ketiga yang kamu izinkan secara eksplisit lewat layar izin OAuth SambasKu. Menyalahgunakan API atau menampilkan label aksi yang menyesatkan dilarang dan dapat berakibat pencabutan akses aplikasi serta penonaktifan akun.

## 7. Gratis, tanpa iklan, tanpa komersialisasi

Mencari dan membaca kamus SambasKu gratis. SambasKu tidak memasang iklan, tidak menjual data pengguna, dan tidak menjual konten. Kontributor aktif bisa menerima uang terima kasih; besarnya tergantung pertimbangan pengelola dan sisa dana kas. Pajak atas uang tersebut menjadi tanggung jawab masing-masing penerima.

## 8. Konten disediakan sebagaimana adanya

Konten kamus disusun komunitas dan dilisensikan sebagaimana adanya. SambasKu tidak menjamin keakuratan setiap entri untuk keperluan hukum atau akademik formal.

## 9. Tata tertib komunitas

Interaksi di fitur komunitas SambasKu mengikuti Kode Etik yang tersedia di sambaskan.com dan di repositori publik kami.

## 10. Perubahan

Kami dapat memperbarui syarat ini. Versi aktif ditampilkan di layanan; perubahan material dapat meminta kamu menyetujui ulang sebelum melanjutkan penggunaan fitur tertentu.
',
	'published',
	unixepoch() * 1000,
	NULL,
	NULL,
	unixepoch() * 1000,
	unixepoch() * 1000
);--> statement-breakpoint
UPDATE `app_settings` SET `value` = '2026-10-04', `updated_at` = unixepoch() * 1000 WHERE `key` = 'legal.terms_version';--> statement-breakpoint
UPDATE `app_settings` SET `value` = '2026-10-04', `updated_at` = unixepoch() * 1000 WHERE `key` = 'legal.privacy_version';
