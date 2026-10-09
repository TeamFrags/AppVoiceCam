import { ManageCookiesButton } from '@/components/CookieConsent';
import { rich } from '@/i18n/format';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';
import { CONTACT_EMAIL } from '@/lib/site';

// Identity of the publisher: required before going live (see docs/deployment.md).
const PUBLISHER = process.env.NEXT_PUBLIC_LEGAL_PUBLISHER;

export const privacy: View = {
  metadata(locale) {
    const t = getMessages(locale).privacy;
    return pageMetadata(locale, '/privacy/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).privacy;
    const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
    return (
      <section>
        <div className="container narrow">
          <h1>{t.title}</h1>

          <h2>{t.controllerTitle}</h2>
          <p>
            {PUBLISHER ?? t.publisherFallback}. {t.contact} {mail}.
          </p>

          <h2>{t.collectTitle}</h2>
          <ul>
            {t.collect.map((item) => (
              <li key={item}>{rich(item, { b: (text) => <strong>{text}</strong> })}</li>
            ))}
          </ul>
          <p>{t.noMedia}</p>

          <h2>{t.basisTitle}</h2>
          <ul>
            {t.basis.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.recipientsTitle}</h2>
          <p>{t.recipients}</p>

          <h2 id="cookies">{t.cookiesTitle}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.table.name}</th>
                  <th>{t.table.role}</th>
                  <th>{t.table.duration}</th>
                  <th>{t.table.consent}</th>
                </tr>
              </thead>
              <tbody>
                {(['rt', 'vid'] as const).map((cookie) => (
                  <tr key={cookie}>
                    <td>{cookie}</td>
                    <td>{t[cookie].role}</td>
                    <td>{t[cookie].duration}</td>
                    <td>{t[cookie].consent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{rich(t.choice, { manage: () => <ManageCookiesButton /> })}</p>

          <h2>{t.retentionTitle}</h2>
          <ul>
            {t.retention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.rightsTitle}</h2>
          <p>{rich(t.rights, { mail: () => mail })}</p>
        </div>
      </section>
    );
  },
};
