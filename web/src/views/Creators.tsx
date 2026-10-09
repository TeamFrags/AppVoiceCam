import { CreatorForm } from '@/components/CreatorForm';
import { Icon, type IconName } from '@/components/Icon';
import { rich } from '@/i18n/format';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';
import { legalTags } from './legal';

// One icon per offer, in the order of the texts.
const OFFER_ICONS: IconName[] = ['spark', 'face', 'voice'];

export const creators: View = {
  metadata(locale) {
    const t = getMessages(locale).creators;
    return pageMetadata(locale, '/creators/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).creators;
    const tags = legalTags(locale);
    return (
      <>
        <section className="hero">
          <div className="container">
            <div className="hero-copy">
              <span className="live">{t.badge}</span>
              <h1>
                {rich(t.heading, { b: (text) => <span className="gradient-text">{text}</span> })}
              </h1>
              <p className="lead">{t.lead}</p>
              <div className="actions">
                <a className="btn" href="#apply">
                  {t.cta}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="container">
            <h2>{t.offerTitle}</h2>
            <div className="grid">
              {t.offers.map((offer, i) => (
                <div className="card" key={offer.title} data-reveal>
                  <Icon name={OFFER_ICONS[i] ?? 'spark'} />
                  <h3>{offer.title}</h3>
                  <p className="muted">{offer.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="container">
            <div className="grid pairs">
              <div className="card" data-reveal>
                <h2>{t.whoTitle}</h2>
                <ul className="checks">
                  {t.who.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="card" data-reveal>
                <h2>{t.rulesTitle}</h2>
                <ul className="checks">
                  {t.rules.map((item) => (
                    <li key={item}>{rich(item, tags)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="apply" className="anchor">
          <div className="container">
            <div className="auth auth-card">
              <h2>{t.formTitle}</h2>
              <p className="muted">{t.formLead}</p>
              <CreatorForm />
            </div>
          </div>
        </section>
      </>
    );
  },
};
