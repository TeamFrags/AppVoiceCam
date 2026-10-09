import Image from 'next/image';
import Link from 'next/link';
import { Demo } from '@/components/Demo';
import { Icon, type IconName } from '@/components/Icon';
import { JsonLd } from '@/components/JsonLd';
import { localePath } from '@/i18n/config';
import { getMessages, tagline } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';
import { APPS, brand, PREMIUM_PRICE, SITE_URL } from '@/lib/site';

// Same order as `home.steps` and `home.features` in the messages.
const STEP_ICONS: IconName[] = ['download', 'spark', 'devices'];
const FEATURE_ICONS: IconName[] = ['face', 'voice', 'devices', 'shield'];

export const home: View = {
  metadata: (locale) => pageMetadata(locale, '/'),
  Page({ locale }) {
    const t = getMessages(locale).home;
    const href = (path: string) => localePath(locale, path);
    return (
      <>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: brand.name,
            url: `${SITE_URL}${href('/')}`,
            inLanguage: locale,
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Windows',
            description: tagline(locale),
            offers: [
              { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'EUR' },
              {
                '@type': 'Offer',
                name: 'Premium',
                price: String(PREMIUM_PRICE),
                priceCurrency: 'EUR',
              },
            ],
          }}
        />

        <section className="hero">
          <div className="container">
            <div className="hero-copy">
              <p className="live">{t.live}</p>
              <h1>
                <span className="gradient-text">{tagline(locale)}</span>
              </h1>
              <p className="lead">{t.lead}</p>
              <div className="actions">
                <Link href={href('/register/')} className="btn">
                  {t.ctaRegister}
                </Link>
                <Link href={href('/features/')} className="btn ghost">
                  {t.ctaFeatures}
                </Link>
              </div>
            </div>
            <div className="hero-art">
              <Image src="/mascot.svg" alt={t.mascotAlt} width={340} height={340} priority />
            </div>
          </div>
        </section>

        <section>
          <div className="container">
            <div className="section-head" data-reveal>
              <h2>{t.demoTitle}</h2>
              <p className="lead">{t.demoText}</p>
            </div>
            <Demo you={t.demoYou} them={t.demoThem} alt={t.demoAlt} />
          </div>
        </section>

        <section>
          <div className="container">
            <h2 data-reveal>{t.appsTitle}</h2>
            <ul className="apps">
              {APPS.map((app) => (
                <li key={app.slug} className="app-tile" data-reveal>
                  <Image src={`/apps/${app.slug}.svg`} alt="" width={320} height={200} />
                  <div>
                    <strong>{app.name}</strong>
                    <span className="muted">{t.apps[app.slug]}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="muted" data-reveal>
              {t.appsOther}
            </p>
          </div>
        </section>

        <section>
          <div className="container">
            <h2 data-reveal>{t.stepsTitle}</h2>
            <ol className="steps">
              {t.steps.map((step, i) => (
                <li key={step.title} className="card" data-reveal>
                  <span className="step-number" aria-hidden="true">
                    {i + 1}
                  </span>
                  <Icon name={STEP_ICONS[i] ?? 'spark'} />
                  <h3>{step.title}</h3>
                  <p className="muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section>
          <div className="container">
            <h2 data-reveal>{t.featuresTitle}</h2>
            <div className="grid pairs">
              {t.features.map((feature, i) => (
                <article key={feature.title} className="card" data-reveal>
                  <Icon name={FEATURE_ICONS[i] ?? 'spark'} />
                  <h3>{feature.title}</h3>
                  <p className="muted">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="container narrow cta-band" data-reveal>
            <h2>{t.pricingTitle}</h2>
            <p className="lead">{t.pricingText}</p>
            <Link href={href('/pricing/')} className="btn">
              {t.pricingCta}
            </Link>
          </div>
        </section>
      </>
    );
  },
};
