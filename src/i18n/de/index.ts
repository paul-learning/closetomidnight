// Deutsche Texte, zusammengesetzt aus den Teilen. Für Englisch: Ordner en/ mit gleicher Struktur.
import { client } from "./client.ts";
import { content } from "./content.ts";
import { history } from "./history.ts";
import { newspaper } from "./newspaper.ts";
import { server } from "./server.ts";

export const DE = { ...content, ...server, ...newspaper, ...history, ...client };
