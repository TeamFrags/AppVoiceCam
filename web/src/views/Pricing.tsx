import Link from 'next/link';
import { localePath } from '@/i18n/config';
import { euros, getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';
import { PREMIUM_PRICE } from '@/lib/site';

export const pricing: View = {
  metadata(locale) {
    const t = getMessages(locale).pricing;
    return pageMetadata(locale, '/pricing/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).pricing;
    return (
      <section>
        <div className="container">
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
          <div className="grid">
            <article className="card" data-reveal>
              <div className="badge">{t.free}</div>
              <div className="price">{euros(locale, 0)}</div>
              <ul className="checks">
                {t.freeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link href={localePath(locale, '/register/')} className="btn ghost">
                {t.freeCta}
              </Link>
            </article>
            <article className="card premium" data-reveal>
              <div className="badge premium">{t.premium}</div>
              <div className="price">
                {euros(locale, PREMIUM_PRICE)} <small>{t.perMonth}</small>
              </div>
              <ul className="checks">
                {t.premiumItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button type="button" className="btn" disabled>
                {t.soon}
              </button>
            </article>
          </div>
          <p className="muted" style={{ marginTop: 24 }}>
            {t.note}
          </p>
        </div>
      </section>
    );
  },
};
