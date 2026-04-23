"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

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
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dark = !scrolled; // transparent nav over hero → white text

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "bg-white border-b border-black/5"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-[1440px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="block">
          <Logo
            size={36}
            textClassName={`font-bold text-[15px] tracking-wider uppercase ${
              dark ? "text-white" : "text-vf-charcoal"
            }`}
          />
        </Link>

        <ul className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className={`text-[15px] font-medium transition-colors ${
                  dark
                    ? "text-white/90 hover:text-white"
                    : "text-vf-charcoal hover:text-vf-red"
                }`}
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
              className="hidden sm:inline-flex items-center h-10 px-5 rounded-full bg-vf-red text-white text-[13px] font-bold uppercase tracking-wider hover:bg-[#b80000] transition-colors"
            >
              Wpłać
            </a>
          ) : null}
          <button
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`md:hidden inline-flex items-center justify-center h-10 w-10 rounded-[2px] border ${
              dark ? "border-white/30 text-white" : "border-vf-charcoal/30 text-vf-charcoal"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="md:hidden bg-white border-t border-black/5">
          <ul className="px-6 py-5 flex flex-col gap-5">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-[17px] text-vf-charcoal font-medium"
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
                  className="inline-flex items-center h-11 px-5 rounded-full bg-vf-red text-white text-[14px] font-bold uppercase tracking-wider"
                >
                  Wpłać
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
