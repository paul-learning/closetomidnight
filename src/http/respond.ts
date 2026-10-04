// Antworten senden, Anfragen lesen, HTTP-Fehler.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../i18n/index.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function send(res: ServerResponse, status: number, body: string, type = "application/json") {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

export const json = (res: ServerResponse, body: unknown, status = 200) => send(res, status, JSON.stringify(body));

export function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((ok, fail) => {
    let d = "";
    req.setEncoding("utf8"); // sonst zerreißen Umlaute an Chunk-Grenzen
    req.on("data", c => { d += c; if (d.length > 100_000) { req.destroy(); fail(new HttpError(413, T.errors.badRequest)); } });
    req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch { fail(new HttpError(400, T.errors.badRequest)); } });
  });
}
