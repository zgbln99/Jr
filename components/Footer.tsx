export function Footer({ foundationUrl }: { foundationUrl?: string }) {
  return (
    <footer className="bg-white border-t border-stripe-border">
      <div className="max-w-[1180px] mx-auto px-6 py-12 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <div className="flex items-center gap-2 text-stripe-navy text-[15px]">
            <span className="inline-block h-6 w-6 rounded-[6px] bg-gradient-to-br from-stripe-purple to-stripe-ruby" />
            jrjr.pl
          </div>
          <p className="mt-3 text-[13px] text-stripe-body leading-relaxed">
            Strona nieoficjalna, fanowska. Nie jest powiązana z Łatwogang,
            Bedoes ani Fundacją Cancer Fighters. Powstała wyłącznie po to, żeby
            zwiększyć zasięg akcji charytatywnej.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-[13px]">
          <div>
            <p className="text-stripe-label uppercase tracking-[0.14em] text-[11px]">
              Akcja
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#o-akcji" className="text-stripe-body hover:text-stripe-purple">
                  O akcji
                </a>
              </li>
              <li>
                <a href="#goscie" className="text-stripe-body hover:text-stripe-purple">
                  Goście
                </a>
              </li>
              <li>
                <a href="#live" className="text-stripe-body hover:text-stripe-purple">
                  Live
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-stripe-label uppercase tracking-[0.14em] text-[11px]">
              Fundacja
            </p>
            <ul className="mt-3 space-y-2">
              {foundationUrl ? (
                <li>
                  <a
                    href={foundationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stripe-body hover:text-stripe-purple"
                  >
                    Cancer Fighters
                  </a>
                </li>
              ) : null}
              <li>
                <a href="#pomoc" className="text-stripe-body hover:text-stripe-purple">
                  Jak pomóc
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-stripe-border">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between text-[12px] text-stripe-body">
          <span>© {new Date().getFullYear()} jrjr.pl</span>
          <span>Zrobione z serca · nie dla zysku</span>
        </div>
      </div>
    </footer>
  );
}
