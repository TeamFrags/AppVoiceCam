'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { hasSessionHint, SESSION_EVENT } from '@/lib/api';

/** Shows "My account" to returning users without calling the API on every public page. */
export function AccountLink() {
  const { locale, t } = useI18n();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const sync = () => setSignedIn(hasSessionHint());
    sync();
    // The header outlives page changes, so it has to hear about sign-in and sign-out.
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);

  return signedIn ? (
    <Link href={localePath(locale, '/account/')} className="btn small ghost">
      {t.nav.account}
    </Link>
  ) : (
    <Link href={localePath(locale, '/login/')} className="btn small ghost">
      {t.nav.signIn}
    </Link>
  );
}
