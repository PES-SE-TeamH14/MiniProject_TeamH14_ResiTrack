// The login session kept in the browser (FR-02).
// Agreed with #6: the token lives in localStorage under resitrack_token, the user under resitrack_user.
const TOKEN_KEY = 'resitrack_token';
const USER_KEY = 'resitrack_user';
const SESSION_EVENT = 'resitrack:session';

function notifySessionChange() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Saves the token and user after a successful login. */
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySessionChange();
}

/** Replaces the token with the fresh one the server sends back (sliding session, NFR-05). */
export function updateToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (e.g. private mode); the current token keeps working until it expires
  }
}

/** Logs out: forgets the token and the user. */
export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // nothing stored
  }
  notifySessionChange();
}

/** Calls listener whenever the session changes, in this tab or another one. Returns an unsubscribe function. */
export function onSessionChange(listener) {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
