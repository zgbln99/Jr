export function Footer({ foundationUrl }: { foundationUrl?: string }) {
  return (
    <footer className="bg-vf-charcoal text-white">
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2 max-w-md">
            <div className="flex items-center gap-3 mb-5">
              <span className="relative inline-block h-9 w-9 rounded-full bg-vf-red">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white" />
              </span>
              <span className="text-[15px] font-bold uppercase tracking-wider">jrjr.pl</span>
            </div>
            <p className="text-white/70 text-[14px] leading-relaxed">
              Strona nieoficjalna, fanowska. Nie jest powiązana z Łatwogang, Bedoes ani Fundacją Cancer Fighters. Powstała tylko po to, żeby zwiększyć zasięg akcji charytatywnej.
            </p>
          </div>

          <div>
            <p className="eyebrow text-white/60 mb-4">Akcja</p>
            <ul className="space-y-3">
              <li><a href="#o-akcji" className="text-white/90 hover:text-vf-red text-[14px]">O akcji</a></li>
              <li><a href="#goscie" className="text-white/90 hover:text-vf-red text-[14px]">Goście</a></li>
              <li><a href="#media" className="text-white/90 hover:text-vf-red text-[14px]">Media</a></li>
              <li><a href="#live" className="text-white/90 hover:text-vf-red text-[14px]">Live</a></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow text-white/60 mb-4">Fundacja</p>
            <ul className="space-y-3">
              {foundationUrl ? (
                <li>
                  <a
                    href={foundationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/90 hover:text-vf-red text-[14px]"
                  >
                    Cancer Fighters
                  </a>
                </li>
              ) : null}
              <li><a href="#pomoc" className="text-white/90 hover:text-vf-red text-[14px]">Jak pomóc</a></li>
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
