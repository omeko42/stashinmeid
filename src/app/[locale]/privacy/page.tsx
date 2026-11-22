import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { ArrowLeft, ShieldCheck, Mail, Globe } from 'lucide-react';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';
  return {
    title: isEn ? 'Privacy Policy — StashinMe' : 'Kebijakan Privasi — StashinMe',
    description: isEn
      ? 'Official Privacy Policy for StashinMe (https://stashinme.biz.id), detailing how we collect, use, protect, and manage your personal and Google account data.'
      : 'Kebijakan Privasi resmi StashinMe (https://stashinme.biz.id) mengenai pengumpulan, penggunaan, perlindungan, dan pengelolaan data pribadi serta akun Google Anda.',
    alternates: {
      canonical: `https://stashinme.biz.id/${locale}/privacy`,
      languages: {
        id: 'https://stashinme.biz.id/id/privacy',
        en: 'https://stashinme.biz.id/en/privacy',
      },
    },
  };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!routing.locales.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const isEn = locale === 'en';
  const otherLocale = isEn ? 'id' : 'en';

  const sections = isEn
    ? [
        {
          title: '1. Introduction & Scope',
          body: [
            'StashinMe ("StashinMe", "stashinmeid", "we", "our") operates the web application accessible at https://stashinme.biz.id. This Privacy Policy explains how we collect, use, store, and safeguard your information when you create an account, sign in with Google or email/password, and manage personal or collaborative financial workspaces on our platform.',
            'By accessing or using StashinMe, you agree to the collection and use of information in accordance with this policy.',
          ],
        },
        {
          title: '2. Information We Collect',
          body: [
            'Account & Authentication Data: When you register or sign in using Email/Password or Google OAuth (Sign in with Google), we receive your email address, display name, and profile photo URL (avatar) solely to authenticate your identity and personalize your workspace.',
            'Financial & Workspace Data: Transactions, wallets, budgets, savings goals, debt/receivable records, colleague group spaces, and optional receipt images you upload for AI-assisted receipt extraction.',
            'Security & Audit Logs: Essential technical metadata such as session timestamps, passkey/MFA registration status, and workspace audit trail entries to protect your account against unauthorized access.',
          ],
        },
        {
          title: '3. Google User Data & Limited Use Policy',
          body: [
            'When you choose "Continue with Google", StashinMe only requests standard, non-sensitive OpenID Connect scopes (email and basic profile information). We never request access to your Gmail messages, Google Drive files, Google Contacts, or Google Calendar.',
            'StashinMe\'s use and transfer of information received from Google APIs adheres strictly to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell, rent, or use your Google account data for advertising, profiling, or training third-party AI models.',
          ],
        },
        {
          title: '4. How We Use Your Information',
          body: [
            'To provide, operate, and maintain your personal and group financial dashboards, multi-currency conversion, and collaborative invitations.',
            'To send essential transactional emails (account verification, OTP, password reset, and security notices) from noreply@stashinme.biz.id.',
            'To protect platform integrity using bot protection (Cloudflare Turnstile), rate limiting, and encrypted session management.',
            'To respond to customer support and enterprise inquiries sent to support@stashinme.biz.id.',
          ],
        },
        {
          title: '5. Infrastructure, Storage & Security',
          body: [
            'All data in transit is encrypted via HTTPS/TLS. Database records are stored in PostgreSQL hosted on Supabase with Row-Level Security (RLS) policies ensuring strict data isolation per user and authorized group members.',
            'We partner with trusted infrastructure providers including Vercel (application hosting), Supabase (authentication & database), Cloudflare (DNS, email routing, Turnstile security), and Resend (transactional email delivery). Each provider processes data solely to deliver its core infrastructure service.',
          ],
        },
        {
          title: '6. Data Retention, Export & Account Deletion',
          body: [
            'You retain full ownership of your financial records. At any time inside Settings, you can export your account data or permanently delete your account and associated workspace records.',
            'You may also request manual data export or complete account erasure by emailing support@stashinme.biz.id from your registered email address. Verified requests are processed within 7 business days.',
          ],
        },
        {
          title: '7. Cookies & Local Storage',
          body: [
            'StashinMe uses strictly necessary cookies and browser storage to maintain your authenticated session, remember your preferred language (ID/EN), theme preference, and primary display currency. We do not use invasive cross-site advertising trackers.',
          ],
        },
        {
          title: '8. Policy Updates & Contact Information',
          body: [
            'We may update this Privacy Policy periodically to reflect product or regulatory improvements. Material changes will be reflected by updating the effective date at the top of this page.',
            'If you have any questions about this Privacy Policy or how your data is handled, please contact our team at support@stashinme.biz.id.',
          ],
        },
      ]
    : [
        {
          title: '1. Pendahuluan & Ruang Lingkup',
          body: [
            'StashinMe ("StashinMe", "stashinmeid", "kami") mengoperasikan aplikasi web yang dapat diakses melalui https://stashinme.biz.id. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi informasi Anda saat mendaftar, masuk menggunakan Google atau email/kata sandi, serta mengelola ruang keuangan pribadi maupun grup kolega di platform kami.',
            'Dengan mengakses atau menggunakan StashinMe, Anda menyetujui pengumpulan dan penggunaan informasi sesuai dengan kebijakan ini.',
          ],
        },
        {
          title: '2. Informasi yang Kami Kumpulkan',
          body: [
            'Data Akun & Autentikasi: Saat Anda mendaftar atau masuk menggunakan Email/Kata Sandi atau Google OAuth (Masuk dengan Google), kami hanya menerima alamat email, nama tampilan, dan URL foto profil (avatar) untuk mengautentikasi identitas dan mempersonalisasi akun Anda.',
            'Data Keuangan & Ruang Kerja: Catatan transaksi, dompet/rekening, pagu anggaran, target tabungan, catatan utang/piutang, ruang grup bersama kolega, serta foto struk opsional yang Anda unggah untuk pemindaian struk berbasis AI.',
            'Log Keamanan & Audit: Metadata teknis esensial seperti waktu sesi, status pendaftaran Passkey/MFA, dan riwayat log aktivitas untuk melindungi akun Anda dari akses tidak sah.',
          ],
        },
        {
          title: '3. Data Pengguna Google & Kebijakan Limited Use',
          body: [
            'Saat Anda memilih "Lanjutkan dengan Google", StashinMe hanya meminta izin standar non-sensitif OpenID Connect (email dan profil dasar). Kami tidak pernah meminta akses ke isi Gmail, file Google Drive, Kontak Google, maupun Google Calendar Anda.',
            'Penggunaan informasi yang diterima dari Google API oleh StashinMe sepenuhnya mematuhi Google API Services User Data Policy, termasuk ketentuan Limited Use. Kami tidak pernah menjual, menyewakan, atau menggunakan data akun Google Anda untuk iklan, profiling pihak ketiga, maupun pelatihan model AI.',
          ],
        },
        {
          title: '4. Cara Kami Menggunakan Informasi Anda',
          body: [
            'Menyediakan, mengoperasikan, dan memelihara dasbor keuangan pribadi maupun grup, konversi multi-mata uang, serta fitur undangan kolaborasi.',
            'Mengirimkan email transaksional penting (verifikasi akun, kode OTP, atur ulang kata sandi, dan notifikasi keamanan) dari alamat resmi noreply@stashinme.biz.id.',
            'Menjaga keamanan platform menggunakan proteksi anti-bot (Cloudflare Turnstile), pembatasan laju permintaan, dan pengelolaan sesi terenkripsi.',
            'Menanggapi pertanyaan dukungan pelanggan maupun permintaan layanan Enterprise yang dikirim ke support@stashinme.biz.id.',
          ],
        },
        {
          title: '5. Infrastruktur, Penyimpanan & Keamanan',
          body: [
            'Seluruh transmisi data dienkripsi menggunakan protokol HTTPS/TLS. Data tersimpan di basis data PostgreSQL pada Supabase dengan kebijakan Row-Level Security (RLS) yang menjamin isolasi data secara ketat untuk setiap pengguna dan anggota grup yang berwenang.',
            'Kami menggunakan mitra infrastruktur tepercaya termasuk Vercel (hosting aplikasi), Supabase (autentikasi & basis data), Cloudflare (DNS, routing email, keamanan Turnstile), dan Resend (pengiriman email transaksional).',
          ],
        },
        {
          title: '6. Retensi Data, Ekspor & Penghapusan Akun',
          body: [
            'Anda memegang kepemilikan penuh atas seluruh data keuangan Anda. Kapan saja melalui menu Pengaturan, Anda dapat mengekspor data akun atau menghapus akun beserta seluruh catatan ruang kerja Anda secara permanen.',
            'Anda juga dapat mengajukan permintaan ekspor atau penghapusan data secara manual melalui email ke support@stashinme.biz.id dari alamat email terdaftar Anda. Permintaan yang terverifikasi akan diproses maksimal dalam 7 hari kerja.',
          ],
        },
        {
          title: '7. Cookie & Penyimpanan Lokal',
          body: [
            'StashinMe hanya menggunakan cookie dan penyimpanan browser yang esensial untuk menjaga sesi login Anda, mengingat pilihan bahasa (ID/EN), preferensi tema, serta mata uang utama tampilan. Kami tidak memasang pelacak iklan lintas situs.',
          ],
        },
        {
          title: '8. Pembaruan Kebijakan & Kontak',
          body: [
            'Kami dapat memperbarui Kebijakan Privasi ini sewaktu-waktu seiring pengembangan fitur atau penyesuaian regulasi. Setiap perubahan penting akan ditandai dengan pembaruan tanggal berlaku di bagian atas halaman ini.',
            'Jika Anda memiliki pertanyaan terkait Kebijakan Privasi ini atau pengelolaan data Anda, silakan hubungi tim kami di support@stashinme.biz.id.',
          ],
        },
      ];

  return (
    <div className="min-h-screen bg-[#0a0f14] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0f14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <Image
              src="/logo-icon.png"
              alt="StashinMe"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-[15px] font-bold tracking-tight text-white">
              StashinMe
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/${otherLocale}/privacy`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              <Globe className="size-3.5" />
              {isEn ? 'Bahasa Indonesia' : 'English'}
            </Link>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              <ArrowLeft className="size-3.5" />
              {isEn ? 'Back to Home' : 'Kembali ke Beranda'}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <div className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6 sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="size-3.5" />
            {isEn ? 'Official Legal Document' : 'Dokumen Legal Resmi'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {isEn ? 'Privacy Policy' : 'Kebijakan Privasi'}
          </h1>
          <p className="mt-2 text-[13px] text-zinc-400">
            {isEn
              ? 'Effective Date: November 22, 2026 · Applies to https://stashinme.biz.id'
              : 'Tanggal Berlaku: 22 November 2026 · Berlaku untuk https://stashinme.biz.id'}
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
            >
              <h2 className="text-[16px] font-semibold text-white">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-zinc-300">
                {section.body.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.08] pt-8 text-[13px] text-zinc-400 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-emerald-400" />
            <span>{isEn ? 'Privacy & Data Contact:' : 'Kontak Privasi & Data:'}</span>
            <a
              href="mailto:support@stashinme.biz.id"
              className="font-medium text-emerald-300 hover:underline"
            >
              support@stashinme.biz.id
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/terms`}
              className="text-zinc-300 transition hover:text-white"
            >
              {isEn ? 'Terms of Service' : 'Syarat & Ketentuan'}
            </Link>
            <Link
              href={`/${locale}`}
              className="text-zinc-300 transition hover:text-white"
            >
              {isEn ? 'Home' : 'Beranda'}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
