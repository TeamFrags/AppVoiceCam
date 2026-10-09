import { JsonLd } from '@/components/JsonLd';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';

export const faq: View = {
  metadata(locale) {
    const t = getMessages(locale).faq;
    return pageMetadata(locale, '/faq/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).faq;
    return (
      <section>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: locale,
            mainEntity: t.items.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          }}
        />
        <div className="container narrow">
          <h1>{t.title}</h1>
          {t.items.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    );
  },
};
