// Visitor's choice about audience-measurement cookies.
// Storing the choice itself needs no consent; it is asked again after six months.

export type ConsentChoice = 'accepted' | 'refused';

const STORAGE_KEY = 'cookie-consent';
const VALIDITY_MS = 183 * 24 * 3600 * 1000;
export const VISITOR_COOKIE = 'vid';
export const CONSENT_EVENT = 'consentchange';
export const OPEN_CONSENT_EVENT = 'openconsent';

export function getConsent(): ConsentChoice | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      choice?: ConsentChoice;
      at?: number;
    } | null;
    if (!stored?.choice || !stored.at || Date.now() - stored.at > VALIDITY_MS) return null;
    return stored.choice;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode): the banner simply comes back on the next page.
  }
  if (choice === 'refused') {
    // Withdrawing consent removes the identifier immediately.
    document.cookie = `${VISITOR_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
