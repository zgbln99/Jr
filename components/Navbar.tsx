"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#o-akcji", label: "O akcji" },
  { href: "#inicjatorzy", label: "Inicjatorzy" },
  { href: "#fundacja", label: "Fundacja" },
  { href: "#goscie", label: "Goście" },
  { href: "#media", label: "Media" },
  { href: "#live", label: "Live" },
];

export function Navbar({ donationUrl }: { donationUrl?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors ${
        scrolled
          ? "bg-white/80 nav-blur border-b border-stripe-border"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-stripe-navy text-[15px] font-normal tracking-tight"
        >
          <span className="inline-block h-6 w-6 rounded-[6px] bg-gradient-to-br from-stripe-purple to-stripe-ruby" />
          <span>jrjr.pl</span>
        </Link>

        <ul className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[14px] text-stripe-navy hover:text-stripe-purple transition-colors"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {donationUrl ? (
            <a
              href={donationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center px-4 h-9 rounded-[4px] bg-stripe-purple text-white text-[14px] font-normal hover:bg-stripe-purple-hover transition-colors"
            >
              Wpłać teraz
            </a>
          ) : null}
          <button
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-[6px] border border-stripe-border text-stripe-navy"
          >
            <span className="sr-only">Menu</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 5h14M2 9h14M2 13h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="md:hidden border-t border-stripe-border bg-white">
          <ul className="px-6 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-[15px] text-stripe-navy"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
            {donationUrl ? (
              <li>
                <a
                  href={donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 h-9 rounded-[4px] bg-stripe-purple text-white text-[14px]"
                >
                  Wpłać teraz
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
