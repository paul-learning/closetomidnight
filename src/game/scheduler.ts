// Zeitplan: Auflösung zur festen Stunde, vorher eine Erinnerung an alle, die noch nicht festgelegt haben.
import { CONFIG } from "../config.ts";
import { notifyReminder } from "./notifications.ts";
import { resolveGame } from "./service.ts";
import { store } from "./store.ts";
import { localNow } from "./time.ts";

async function tick() {
  const now = localNow();
  for (const g of store.activeGames()) {
    try {
      if (now.hour >= CONFIG.resolveHour && g.lastResolved !== now.date) {
        await resolveGame(g.id);
      } else if (now.hour >= CONFIG.remindHour && now.hour < CONFIG.resolveHour && g.lastReminded !== now.date) {
        store.setReminded(g.id, now.date);
        const moves = store.moves(g.id, g.state.day);
        const notLocked = [0, 1, 2, 3].filter(i => !moves[i]?.locked);
        if (notLocked.length) await notifyReminder(g.id, notLocked, CONFIG.resolveHour - now.hour);
      }
    } catch (e) { console.error("Zeitplan-Fehler", g.id, e); }
  }
}

export function startScheduler() {
  setInterval(tick, 60_000);
}
