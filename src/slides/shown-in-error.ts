// An untrusted value in an error message, cut to 64 characters. Not part of the barrel.
export function shownInError(value: string): string {
  return value.length > 64 ? `${value.slice(0, 64)}…` : value;
}
