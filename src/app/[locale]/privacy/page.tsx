import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import {
  LegalDocumentLayout,
  type LegalSection,
} from '@/components/legal/LegalDocumentLayout';

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
      ? 'How StashinMe collects, uses, and protects your account and financial records at https://stashinme.biz.id.'
      : 'Penjelasan mengenai cara StashinMe mengumpulkan, menggunakan, dan menjaga data akun serta catatan keuangan Anda di https://stashinme.biz.id.',
    alternates: {
      canonical: `https://stashinme.biz.id/${locale === 'id' ? '' : `${locale}/`}privacy`,
      languages: {
        id: 'https://stashinme.biz.id/privacy',
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

  const sections: LegalSection[] = isEn
    ? [
        {
          title: '1. Information You Share With Us',
          body: [
            'When you create an account using your email or Google account, we receive basic profile details — your email address, display name, and profile photo — so we can identify your account and personalize your workspace.',
            'We also store the financial records you choose to enter, such as transactions, wallets, budgets, savings goals, shared group notes, and receipt photos you upload.',
          ],
        },
        {
          title: '2. Sign In With Google',
          body: [
            'If you choose to continue with Google, StashinMe only requests access to your email address and basic profile name/photo. We never ask for access to your emails, Google Drive files, contacts, or calendar.',
            'Information received from Google is used strictly to sign you in and manage your StashinMe account in accordance with the Google API Services User Data Policy, including Limited Use requirements. We never sell your Google data or use it for advertising.',
          ],
        },
        {
          title: '3. How We Use Your Data',
          body: [
            'We use your information only to run your personal and shared financial workspaces, display currency conversions, and send important account emails (such as verification codes or password resets) from noreply@stashinme.biz.id.',
            'We also keep basic activity records inside your account settings so you can review changes and keep your workspace secure.',
          ],
        },
        {
          title: '4. Keeping Your Records Private',
          body: [
            'Your financial notes belong strictly to you. Personal records are private to your account, and group records are only visible to colleagues you explicitly invite and approve.',
            'We protect your data during transfer and storage using industry-standard security practices and never sell or rent your personal information to third parties.',
          ],
        },
        {
          title: '5. Preferences & Cookies',
          body: [
            'We use essential browser storage to keep you signed in and remember your chosen language, display theme, and primary currency. We do not use third-party advertising trackers.',
          ],
        },
        {
          title: '6. Export & Deleting Your Account',
          body: [
            'You can export your records or permanently delete your account at any time from the Settings menu inside StashinMe.',
            'If you prefer manual assistance, send a request from your registered email to support@stashinme.biz.id and we will complete it within 7 business days.',
          ],
        },
        {
          title: '7. Updates to This Policy',
          body: [
            'We may update this Privacy Policy from time to time as StashinMe evolves. When we do, we will update the date at the top of this page.',
          ],
        },
      ]
    : [
        {
          title: '1. Informasi yang Anda Berikan',
          body: [
            'Saat Anda mendaftar menggunakan email atau akun Google, kami menerima informasi dasar berupa alamat email, nama, dan foto profil agar kami dapat mengenali akun serta menyesuaikan tampilan ruang kerja Anda.',
            'Kami juga menyimpan catatan keuangan yang Anda masukkan sendiri, seperti transaksi, daftar dompet, anggaran, target tabungan, catatan grup bersama, serta foto struk yang Anda unggah.',
          ],
        },
        {
          title: '2. Masuk Menggunakan Akun Google',
          body: [
            'Jika Anda memilih masuk dengan Google, StashinMe hanya meminta alamat email serta nama dan foto profil dasar Anda. Kami tidak pernah meminta akses ke isi Gmail, file Google Drive, kontak, maupun kalender Anda.',
            'Data yang diterima dari Google hanya digunakan untuk proses masuk dan pengelolaan akun StashinMe sesuai dengan Google API Services User Data Policy, termasuk ketentuan Limited Use. Kami tidak pernah menjual data akun Google Anda atau menggunakannya untuk iklan.',
          ],
        },
        {
          title: '3. Cara Kami Menggunakan Data Anda',
          body: [
            'Data Anda digunakan semata-mata untuk menjalankan pencatatan keuangan pribadi dan grup, menampilkan konversi mata uang, serta mengirimkan email penting terkait akun (seperti verifikasi atau atur ulang kata sandi) dari noreply@stashinme.biz.id.',
            'Kami juga menyimpan riwayat aktivitas penting agar Anda dapat memantau perubahan dan menjaga keamanan akun.',
          ],
        },
        {
          title: '4. Menjaga Kerahasiaan Catatan Anda',
          body: [
            'Seluruh catatan keuangan Anda sepenuhnya milik Anda. Catatan pribadi hanya dapat dilihat oleh Anda sendiri, sedangkan catatan grup hanya dapat diakses oleh kolega yang Anda undang dan setujui.',
            'Kami melindungi data Anda dengan standar keamanan yang baik selama pengiriman maupun penyimpanan, dan tidak pernah menjual atau menyewakan data pribadi Anda kepada pihak lain.',
          ],
        },
        {
          title: '5. Preferensi & Cookie',
          body: [
            'Kami hanya menyimpan informasi penting di browser agar Anda tetap masuk ke akun serta mengingat pilihan bahasa, tema tampilan, dan mata uang utama Anda. Kami tidak memasang pelacak iklan pihak ketiga.',
          ],
        },
        {
          title: '6. Ekspor Data & Penghapusan Akun',
          body: [
            'Anda dapat mengekspor seluruh catatan atau menghapus akun secara permanen kapan saja langsung dari menu Pengaturan di dalam StashinMe.',
            'Jika membutuhkan bantuan manual, kirimkan permintaan dari alamat email terdaftar Anda ke support@stashinme.biz.id dan kami akan memprosesnya maksimal dalam 7 hari kerja.',
          ],
        },
        {
          title: '7. Perubahan Kebijakan',
          body: [
            'Kebijakan Privasi ini dapat diperbarui sewaktu-waktu seiring perkembangan layanan StashinMe. Setiap pembaruan akan ditandai dengan perubahan tanggal di bagian atas halaman ini.',
          ],
        },
      ];

  return (
    <LegalDocumentLayout
      isEn={isEn}
      activePage="privacy"
      title={isEn ? 'Privacy Policy' : 'Kebijakan Privasi'}
      updatedLabel={
        isEn
          ? 'Last updated: November 22, 2026 · stashinme.biz.id'
          : 'Terakhir diperbarui: 22 November 2026 · stashinme.biz.id'
      }
      intro={
        isEn
          ? 'Your financial records are personal. This page explains in plain language what information StashinMe collects, how we use it, and how you stay in control of your data.'
          : 'Catatan keuangan bersifat pribadi. Halaman ini menjelaskan secara sederhana data apa saja yang dikumpulkan StashinMe, bagaimana kami menggunakannya, serta kendali penuh yang Anda miliki atas data Anda.'
      }
      sections={sections}
    />
  );
}
