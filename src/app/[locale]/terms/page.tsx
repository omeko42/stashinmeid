import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { ArrowLeft, FileText, Mail, Globe } from 'lucide-react';

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
    title: isEn ? 'Terms of Service — StashinMe' : 'Syarat & Ketentuan — StashinMe',
    description: isEn
      ? 'Official Terms of Service for StashinMe (https://stashinme.biz.id), governing account usage, collaborative financial workspaces, memberships, and acceptable use.'
      : 'Syarat & Ketentuan resmi penggunaan aplikasi StashinMe (https://stashinme.biz.id) untuk akun pribadi, ruang keuangan grup, langganan, dan aturan penggunaan.',
    alternates: {
      canonical: `https://stashinme.biz.id/${locale}/terms`,
      languages: {
        id: 'https://stashinme.biz.id/id/terms',
        en: 'https://stashinme.biz.id/en/terms',
      },
    },
  };
}

export default async function TermsOfServicePage({
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
          title: '1. Acceptance of Terms',
          body: [
            'Welcome to StashinMe (https://stashinme.biz.id). By accessing, registering, or using our web application, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree with any part of these terms, please discontinue use of the service.',
          ],
        },
        {
          title: '2. Description of Service',
          body: [
            'StashinMe provides digital tools for personal and collaborative financial tracking, multi-currency wallet management, budgeting, AI-assisted receipt scanning, and colleague group workspaces.',
            'StashinMe is a financial record-keeping and productivity platform — we do not provide banking, investment brokerage, tax advisory, or regulated financial custodian services.',
          ],
        },
        {
          title: '3. Account Registration & Security',
          body: [
            'You are responsible for maintaining the confidentiality of your account credentials (email/password, Google OAuth, Passkeys, or MFA) and for all activities occurring under your account.',
            'You agree to provide accurate registration information and notify us immediately at support@stashinme.biz.id if you suspect unauthorized access to your account.',
          ],
        },
        {
          title: '4. Collaborative Spaces & Acceptable Use',
          body: [
            'When inviting colleagues to shared financial groups, you are responsible for managing member permissions and ensuring you have the right to share records within that workspace.',
            'You agree not to misuse StashinMe for unlawful activities, automated abuse, credential stuffing, attempting to bypass rate limits or security controls, or uploading malicious content.',
          ],
        },
        {
          title: '5. Membership Plans & Billing',
          body: [
            'StashinMe offers Free, Standard, Pro, Business, and Enterprise Custom tiers with clearly published workspace quotas and pricing.',
            'Paid plan durations and renewal dates are displayed transparently inside your account settings. Upon expiration of a paid plan without renewal, your account automatically reverts to the Free tier without deleting your existing records.',
          ],
        },
        {
          title: '6. Intellectual Property & User Content',
          body: [
            'You retain full ownership of all financial data, notes, and receipts you enter into StashinMe. You grant us a limited license solely to host, process, and display your content back to you and your authorized group members.',
            'The StashinMe brand, logo, interface design, and platform software remain the property of StashinMe and its contributors.',
          ],
        },
        {
          title: '7. Availability & Limitation of Liability',
          body: [
            'We strive to maintain high availability and data reliability, but the service is provided on an "as-is" and "as-available" basis. To the maximum extent permitted by applicable law, StashinMe shall not be liable for indirect or consequential financial losses arising from user input errors or third-party service interruptions.',
          ],
        },
        {
          title: '8. Termination & Contact',
          body: [
            'You may terminate your account at any time from Settings. We reserve the right to suspend accounts that violate these Terms or threaten platform security.',
            'Questions regarding these Terms of Service can be directed to support@stashinme.biz.id.',
          ],
        },
      ]
    : [
        {
          title: '1. Penerimaan Syarat & Ketentuan',
          body: [
            'Selamat datang di StashinMe (https://stashinme.biz.id). Dengan mengakses, mendaftar, atau menggunakan aplikasi web kami, Anda menyetujui untuk terikat oleh Syarat & Ketentuan ini serta Kebijakan Privasi kami. Jika Anda tidak menyetujui bagian mana pun dari ketentuan ini, mohon hentikan penggunaan layanan.',
          ],
        },
        {
          title: '2. Deskripsi Layanan',
          body: [
            'StashinMe menyediakan perangkat lunak pencatatan keuangan pribadi maupun kolaboratif, pengelolaan dompet multi-mata uang, perencanaan anggaran, pemindaian struk berbasis AI, serta ruang grup bersama kolega.',
            'StashinMe adalah platform pencatatan dan produktivitas keuangan — kami bukan bank, pialang investasi, konsultan pajak, maupun lembaga penyimpanan dana berizin.',
          ],
        },
        {
          title: '3. Pendaftaran & Keamanan Akun',
          body: [
            'Anda bertanggung jawab penuh menjaga kerahasiaan kredensial akun Anda (email/kata sandi, Google OAuth, Passkey, atau MFA) beserta seluruh aktivitas yang terjadi di dalam akun Anda.',
            'Anda setuju memberikan informasi pendaftaran yang akurat dan segera menghubungi kami di support@stashinme.biz.id apabila mencurigai adanya akses tidak sah pada akun Anda.',
          ],
        },
        {
          title: '4. Ruang Kolaborasi & Aturan Penggunaan',
          body: [
            'Saat mengundang kolega ke ruang grup keuangan bersama, Anda bertanggung jawab mengatur izin anggota serta memastikan data yang dibagikan di dalam grup tersebut telah sesuai.',
            'Anda dilarang menyalahgunakan StashinMe untuk aktivitas melanggar hukum, penyalahgunaan otomatis/bot, upaya membobol keamanan sistem, atau mengunggah konten berbahaya.',
          ],
        },
        {
          title: '5. Paket Keanggotaan & Penagihan',
          body: [
            'StashinMe menyediakan paket Free, Standard, Pro, Business, serta Enterprise Custom dengan kuota grup dan harga yang ditampilkan secara transparan.',
            'Durasi dan masa berlaku paket berbayar ditampilkan langsung di menu pengaturan akun Anda. Apabila masa berlaku paket berbayar berakhir tanpa perpanjangan, akun otomatis kembali ke paket Free tanpa menghapus catatan keuangan Anda yang sudah ada.',
          ],
        },
        {
          title: '6. Hak Kekayaan Intelektual & Data Pengguna',
          body: [
            'Anda tetap menjadi pemilik penuh atas seluruh catatan transaksi, data, dan struk yang Anda masukkan ke StashinMe. Anda memberikan izin terbatas kepada kami hanya untuk menyimpan, memproses, dan menampilkan data tersebut kepada Anda serta anggota grup yang Anda izinkan.',
            'Merek StashinMe, logo, desain antarmuka, dan perangkat lunak platform merupakan milik StashinMe beserta para kontributornya.',
          ],
        },
        {
          title: '7. Ketersediaan Layanan & Batasan Tanggung Jawab',
          body: [
            'Kami berupaya menjaga ketersediaan dan keandalan sistem sebaik mungkin, namun layanan disediakan sebagaimana adanya ("as-is"). Sejauh diizinkan oleh hukum yang berlaku, StashinMe tidak bertanggung jawab atas kerugian tidak langsung akibat kesalahan pencatatan pengguna maupun gangguan layanan pihak ketiga.',
          ],
        },
        {
          title: '8. Penghentian Akun & Kontak',
          body: [
            'Anda dapat menghentikan dan menghapus akun Anda kapan saja melalui menu Pengaturan. Kami berhak menangguhkan akun yang melanggar ketentuan ini atau membahayakan keamanan platform.',
            'Pertanyaan terkait Syarat & Ketentuan ini dapat dikirimkan ke support@stashinme.biz.id.',
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
              href={`/${otherLocale}/terms`}
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
            <FileText className="size-3.5" />
            {isEn ? 'Official Legal Document' : 'Dokumen Legal Resmi'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {isEn ? 'Terms of Service' : 'Syarat & Ketentuan'}
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
            <span>{isEn ? 'Legal & Support Contact:' : 'Kontak Legal & Dukungan:'}</span>
            <a
              href="mailto:support@stashinme.biz.id"
              className="font-medium text-emerald-300 hover:underline"
            >
              support@stashinme.biz.id
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/privacy`}
              className="text-zinc-300 transition hover:text-white"
            >
              {isEn ? 'Privacy Policy' : 'Kebijakan Privasi'}
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
