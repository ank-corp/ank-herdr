// The ank --json contract this mod understands (ADR-98bd). Pure: no herdr import (ADR-5872).
export const CONTRACT = 1;

// Parses the stdout of `ank <verb> --json` and returns the object when its
// contract is the one this mod accepts, or null otherwise.
export function acceptContract(stdout) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object") return null;
  return value.contract === CONTRACT ? value : null;
}
