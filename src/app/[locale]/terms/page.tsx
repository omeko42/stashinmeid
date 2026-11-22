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
    title: isEn ? 'Terms of Service — StashinMe' : 'Syarat & Ketentuan — StashinMe',
    description: isEn
      ? 'Terms of Service for using StashinMe at https://stashinme.biz.id.'
      : 'Syarat & Ketentuan penggunaan layanan StashinMe di https://stashinme.biz.id.',
    alternates: {
      canonical: `https://stashinme.biz.id/${locale === 'id' ? '' : `${locale}/`}terms`,
      languages: {
        id: 'https://stashinme.biz.id/terms',
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

  const sections: LegalSection[] = isEn
    ? [
        {
          title: '1. Using StashinMe',
          body: [
            'By creating an account or using StashinMe (https://stashinme.biz.id), you agree to these Terms of Service and our Privacy Policy. If you do not agree, please stop using the service.',
          ],
        },
        {
          title: '2. What StashinMe Provides',
          body: [
            'StashinMe helps you track personal and shared finances, manage wallets across currencies, set budgets, scan receipts, and collaborate with colleagues in group workspaces.',
            'StashinMe is a record-keeping and budgeting tool. We are not a bank, investment advisor, tax consultant, or financial custodian.',
          ],
        },
        {
          title: '3. Your Account & Security',
          body: [
            'Please keep your sign-in details secure and let us know immediately at support@stashinme.biz.id if you believe someone accessed your account without permission.',
            'You are responsible for the accuracy of the records you enter and for managing who you invite into your shared groups.',
          ],
        },
        {
          title: '4. Fair & Responsible Use',
          body: [
            'Please use StashinMe lawfully and respectfully. Do not attempt to disrupt the service, abuse automated access, or upload harmful content.',
          ],
        },
        {
          title: '5. Membership Plans',
          body: [
            'StashinMe offers a Free plan alongside paid plans (Standard, Pro, Business, and Enterprise Custom) with transparent pricing and group limits.',
            'If a paid plan expires and is not renewed, your account simply returns to the Free plan — your existing financial records remain safe and are never deleted automatically.',
          ],
        },
        {
          title: '6. Ownership of Your Data',
          body: [
            'Everything you record in StashinMe remains yours. You only give us permission to store and display your records back to you and the group members you approve.',
          ],
        },
        {
          title: '7. Service Availability',
          body: [
            'We work hard to keep StashinMe reliable and available, though occasional maintenance or third-party outages may happen. StashinMe is provided as-is, and we are not responsible for financial decisions made based on manual input errors.',
          ],
        },
        {
          title: '8. Closing Your Account',
          body: [
            'You are free to close and delete your account whenever you wish from Settings. We may also suspend accounts that violate these terms or harm other users.',
          ],
        },
      ]
    : [
        {
          title: '1. Menggunakan StashinMe',
          body: [
            'Dengan membuat akun atau menggunakan StashinMe (https://stashinme.biz.id), Anda menyetujui Syarat & Ketentuan ini serta Kebijakan Privasi kami. Jika Anda tidak setuju, silakan hentikan penggunaan layanan.',
          ],
        },
        {
          title: '2. Layanan yang Kami Sediakan',
          body: [
            'StashinMe membantu Anda mencatat keuangan pribadi maupun bersama, mengelola dompet lintas mata uang, mengatur anggaran, memindai struk belanja, serta berkolaborasi dalam grup bersama kolega.',
            'StashinMe adalah alat bantu pencatatan dan perencanaan keuangan. Kami bukan bank, penasihat investasi, konsultan pajak, maupun lembaga penyimpan dana.',
          ],
        },
        {
          title: '3. Akun & Keamanan Anda',
          body: [
            'Mohon jaga kerahasiaan akses masuk akun Anda dan segera hubungi kami di support@stashinme.biz.id jika merasa ada aktivitas yang tidak Anda kenali.',
            'Anda bertanggung jawab atas ketepatan data yang Anda catat serta siapa saja yang Anda undang ke dalam grup bersama.',
          ],
        },
        {
          title: '4. Penggunaan yang Wajar',
          body: [
            'Gunakan StashinMe secara wajar dan sesuai hukum yang berlaku. Dilarang mengganggu operasional layanan, menyalahgunakan akses otomatis, atau mengunggah konten yang membahayakan.',
          ],
        },
        {
          title: '5. Paket Keanggotaan',
          body: [
            'StashinMe menyediakan paket Gratis (Free) serta paket berbayar (Standard, Pro, Business, dan Enterprise Custom) dengan harga dan kuota grup yang transparan.',
            'Jika masa berlaku paket berbayar berakhir tanpa perpanjangan, akun Anda otomatis kembali ke paket Gratis — seluruh catatan keuangan yang sudah tersimpan tetap aman dan tidak dihapus.',
          ],
        },
        {
          title: '6. Kepemilikan Data Anda',
          body: [
            'Seluruh catatan yang Anda buat di StashinMe tetap sepenuhnya milik Anda. Anda hanya memberi kami izin untuk menyimpan dan menampilkan catatan tersebut kepada Anda serta anggota grup yang Anda setujui.',
          ],
        },
        {
          title: '7. Ketersediaan Layanan',
          body: [
            'Kami berupaya menjaga StashinMe tetap stabil dan mudah diakses setiap saat, meski pemeliharaan berkala atau gangguan pihak ketiga dapat saja terjadi. Layanan disediakan sebagaimana adanya dan kami tidak bertanggung jawab atas keputusan keuangan dari kesalahan pencatatan manual.',
          ],
        },
        {
          title: '8. Penutupan Akun',
          body: [
            'Anda bebas menutup dan menghapus akun kapan saja melalui menu Pengaturan. Kami juga berhak menangguhkan akun yang melanggar ketentuan ini atau merugikan pengguna lain.',
          ],
        },
      ];

  return (
    <LegalDocumentLayout
      isEn={isEn}
      activePage="terms"
      title={isEn ? 'Terms of Service' : 'Syarat & Ketentuan'}
      updatedLabel={
        isEn
          ? 'Last updated: November 22, 2026 · stashinme.biz.id'
          : 'Terakhir diperbarui: 22 November 2026 · stashinme.biz.id'
      }
      intro={
        isEn
          ? 'These terms outline the ground rules for using StashinMe in clear, straightforward language.'
          : 'Ketentuan ini menjelaskan aturan dasar penggunaan StashinMe dengan bahasa yang ringkas dan mudah dipahami.'
      }
      sections={sections}
    />
  );
}
