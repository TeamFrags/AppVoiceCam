'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './config';
import type { Messages } from './messages/en';

/** Only what interactive components display: the rest of the texts never reaches the browser twice. */
export type ClientMessages = Pick<
  Messages,
  'nav' | 'footer' | 'auth' | 'creatorForm' | 'account' | 'admin' | 'consent' | 'errors'
>;

const I18nContext = createContext<{ locale: Locale; t: ClientMessages } | null>(null);

export function I18nProvider(props: {
  locale: Locale;
  messages: ClientMessages;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale: props.locale, t: props.messages }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n needs the I18nProvider of SiteShell');
  return context;
}
