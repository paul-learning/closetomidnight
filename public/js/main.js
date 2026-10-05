// Einstieg: wählt anhand der Adresse Spieler-, Admin- oder Startseite.
import { $, T, esc } from "./util.js";
import { startPlayer } from "./player.js";
import { startAdmin } from "./admin.js";
import { startStart } from "./start.js";

document.title = T.client.title;
$("#app").innerHTML = `<p class="hint">${T.client.loading}</p>`;
const [, mode, key] = location.pathname.split("/");
const start = mode === "p" ? () => startPlayer(key) : mode === "a" ? () => startAdmin(key) : async () => startStart();
start().catch(e => {
  $("#app").innerHTML = `<div class="err" role="alert">${esc(e.message)}</div>${mode ? `<p><a class="link" href="/">${T.client.toStart}</a></p>` : ""}`;
});
