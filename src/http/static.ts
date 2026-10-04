// Dateien aus public/ und die Texte für den Browser.
import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { T } from "../i18n/index.ts";
import { HttpError, send } from "./respond.ts";

const PUBLIC = fileURLToPath(new URL("../../public/", import.meta.url));
const TYPES: Record<string, string> = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const BINARY = new Set([".png"]);

// Alles außer den reinen Server-Abschnitten
const { errors: _e, push: _u, paper: _p, prompt: _q, ...clientStrings } = T;
const STRINGS_JS = `window.T = ${JSON.stringify(clientStrings)};`;

export const serveStrings = (res: ServerResponse) => send(res, 200, STRINGS_JS, "text/javascript");

export async function serveStatic(res: ServerResponse, path: string) {
  const file = normalize(join(PUBLIC, path));
  if (!file.startsWith(PUBLIC)) throw new HttpError(404, T.errors.notFound);
  const ext = extname(file);
  try {
    const body = await readFile(file);
    if (BINARY.has(ext)) { res.writeHead(200, { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=86400" }); return res.end(body); }
    send(res, 200, body.toString("utf8"), TYPES[ext] ?? "text/plain");
  }
  catch { throw new HttpError(404, T.errors.notFound); }
}
