'use client';

import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/shell/LocaleSwitcher';
import { ThemeToggle } from '@/components/shell/ThemeToggle';

export interface LegalSection {
  title: string;
  body: string[];
}

interface LegalDocumentLayoutProps {
  isEn: boolean;
  activePage: 'privacy' | 'terms';
  title: string;
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
}

export function LegalDocumentLayout({
  isEn,
  activePage,
  title,
  updatedLabel,
  intro,
  sections,
}: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight text-[var(--text)] transition hover:opacity-80"
            >
              <Image
                src="/logo-icon.png"
                alt="StashinMe"
                width={26}
                height={26}
                className="rounded-md"
              />
              <span>StashinMe</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher compact />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text)] transition hover:border-[var(--brand)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">
                {isEn ? 'Back to Home' : 'Beranda'}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <div className="border-b border-[var(--line)] pb-8">
          <p className="text-[12px] font-medium text-[var(--muted)]">
            {isEn ? 'StashinMe · Legal' : 'StashinMe · Dokumen Legal'}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-[13px] text-[var(--muted)]">{updatedLabel}</p>
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--text)]/90">
            {intro}
          </p>
        </div>

        <article className="divide-y divide-[var(--line)]">
          {sections.map((section) => (
            <section key={section.title} className="py-7">
              <h2 className="text-[16px] font-semibold tracking-tight text-[var(--text)]">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[14.5px] leading-7 text-[var(--muted)]">
                {section.body.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <footer className="mt-4 flex flex-col items-start justify-between gap-4 border-t border-[var(--line)] pt-8 text-[13px] text-[var(--muted)] sm:flex-row sm:items-center">
          <div>
            <span>{isEn ? 'Questions? Reach us at ' : 'Ada pertanyaan? Hubungi '}</span>
            <a
              href="mailto:support@stashinme.biz.id"
              className="font-medium text-[var(--text)] underline decoration-[var(--line)] underline-offset-4 transition hover:text-[var(--brand)]"
            >
              support@stashinme.biz.id
            </a>
          </div>
          <nav className="flex items-center gap-5">
            {activePage === 'privacy' ? (
              <Link
                href="/terms"
                className="font-medium text-[var(--text)] transition hover:text-[var(--brand)]"
              >
                {isEn ? 'Terms of Service' : 'Syarat & Ketentuan'}
              </Link>
            ) : (
              <Link
                href="/privacy"
                className="font-medium text-[var(--text)] transition hover:text-[var(--brand)]"
              >
                {isEn ? 'Privacy Policy' : 'Kebijakan Privasi'}
              </Link>
            )}
            <Link
              href="/"
              className="transition hover:text-[var(--text)]"
            >
              {isEn ? 'Home' : 'Beranda'}
            </Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
