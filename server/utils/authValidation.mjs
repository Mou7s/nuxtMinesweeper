const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.trim();
  if (username.length < 2 || username.length > 24 || CONTROL_CHARACTERS.test(username)) return null;
  return username;
}

export function isValidPassword(value, minimumLength = 1) {
  return typeof value === 'string' && value.length >= minimumLength && value.length <= 128;
}
