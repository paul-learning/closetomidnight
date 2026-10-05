// Spieler-Passwörter: erzeugen, als Hash speichern, prüfen. Kein Klartext in der Datenbank.
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

// Ohne leicht verwechselbare Zeichen (0/o, 1/l/i), damit man es vom Handy abtippen kann.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** z. B. "k7mp-x3qa-9tfe": drei Vierergruppen, rund 59 Bit Zufall. */
export function generatePassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return [group(), group(), group()].join("-");
}

/** Groß/klein und Leerzeichen spielen keine Rolle, die Bindestriche sind optional. */
const normalize = (pw: string) => pw.toLowerCase().replace(/[\s-]/g, "");

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(normalize(pw), salt, 32).toString("base64url")}`;
}

export function verifyPassword(pw: unknown, stored: string | null): boolean {
  if (typeof pw !== "string" || !stored || pw.length > 200) return false;
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = scryptSync(normalize(pw), Buffer.from(salt, "base64url"), want.length);
  return timingSafeEqual(got, want);
}
