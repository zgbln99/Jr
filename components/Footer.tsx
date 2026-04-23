import Link from "next/link";
import { Logo } from "./Logo";

export function Footer({ foundationUrl }: { foundationUrl?: string }) {
  return (
    <footer className="bg-vf-charcoal text-white">
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2 max-w-md">
            <div className="mb-5">
              <Logo
                size={36}
                textClassName="text-[15px] font-bold uppercase tracking-wider"
              />
            </div>
            <p className="text-white/70 text-[14px] leading-relaxed">
              Strona nieoficjalna, fanowska. Nie jest powiązana z Łatwogang, Bedoes ani Fundacją Cancer Fighters. Powstała tylko po to, żeby zwiększyć zasięg akcji charytatywnej.
            </p>
          </div>

          <div>
            <p className="eyebrow text-white/60 mb-4">Akcja</p>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-white/90 hover:text-vf-red text-[14px]">
                  Licznik
                </Link>
              </li>
              <li>
                <Link href="/o-akcji" className="text-white/90 hover:text-vf-red text-[14px]">
                  O akcji
                </Link>
              </li>
              <li>
                <Link
                  href="/o-akcji#goscie"
                  className="text-white/90 hover:text-vf-red text-[14px]"
                >
                  Goście
                </Link>
              </li>
              <li>
                <Link
                  href="/o-akcji#media"
                  className="text-white/90 hover:text-vf-red text-[14px]"
                >
                  Media
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow text-white/60 mb-4">Dla streamerów</p>
            <ul className="space-y-3">
              <li>
                <a
                  href="/widget"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 hover:text-vf-red text-[14px]"
                >
                  Widget OBS
                </a>
              </li>
              {foundationUrl ? (
                <li>
                  <a
                    href={foundationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 hover:text-vf-red text-[14px]"
                  >
                    Fundacja
                  </a>
                </li>
              ) : null}
              <li>
                <Link
                  href="/o-akcji#pomoc"
                  className="text-white/90 hover:text-vf-red text-[14px]"
                >
                  Jak pomóc
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/20 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/60">
          <span>© {new Date().getFullYear()} jrjr.pl</span>
          <span className="uppercase tracking-wider">Zrobione z serca · nie dla zysku</span>
        </div>
      </div>
    </footer>
  );
}
