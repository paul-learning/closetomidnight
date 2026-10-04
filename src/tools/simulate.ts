// Bot-Simulator zum Balancing. Aufruf: node src/tools/simulate.ts [Spiele]
import { newGame, resolveDay, total } from "../engine/index.ts";
import { rng } from "../engine/rng.ts";
import { botMove, PERSONAS } from "../bots/bots.ts";
import type { Persona } from "../bots/bots.ts";

function play(seed: number, personas: Persona[]) {
  let s = newGame(seed); const rnd = rng(seed * 7 + 1);
  while (!s.over) s = resolveDay(s, s.players.map((_, i) => botMove(s, i, personas[i], rnd)));
  return s;
}

function scenario(label: string, games: number, pick: (g: number) => Persona[]) {
  let exposed = 0, survived = 0, defectorGames = 0, defectorWins = 0, totalSum = 0, daySum = 0;
  const endings: Record<string, number> = {}; const winsBy: Record<string, number> = {}; const seatsBy: Record<string, number> = {};
  const nationWins: Record<string, number> = {};
  for (let g = 0; g < games; g++) {
    const personas = pick(g); const s = play(1000 + g, personas);
    personas.forEach(p => seatsBy[p] = (seatsBy[p] ?? 0) + 1);
    endings[s.ending!] = (endings[s.ending!] ?? 0) + 1;
    if (s.ending === "vernunft") survived++;
    totalSum += total(s.tracks); daySum += s.day;
    const def = s.players.findIndex(p => p.defector);
    if (def >= 0) { defectorGames++; if (s.players[def].exposed) exposed++; if (s.winners?.includes(s.players[def].nation)) defectorWins++; }
    s.winners?.forEach(n => { nationWins[n] = (nationWins[n] ?? 0) + 1; const pi = s.players.findIndex(p => p.nation === n); winsBy[personas[pi]] = (winsBy[personas[pi]] ?? 0) + 1; });
  }
  const pct = (n: number, d = games) => `${Math.round((100 * n) / d)}%`;
  console.log(`\n== ${label} (${games} Spiele) ==`);
  console.log(`Überlebt: ${pct(survived)} | Enden: ${Object.entries(endings).map(([k, v]) => `${k} ${pct(v)}`).join(", ")} | Ø Tag am Ende: ${(daySum / games).toFixed(1)} | Ø Doom am Ende: ${(totalSum / games).toFixed(1)}/24`);
  console.log(`Überläufer in ${pct(defectorGames)} der Spiele, gewinnt davon ${defectorGames ? pct(defectorWins, defectorGames) : "-"}, enttarnt ${defectorGames ? pct(exposed, defectorGames) : "-"}`);
  console.log(`Siegquote je Persona (pro Sitz): ${Object.keys(seatsBy).map(p => `${p} ${pct(winsBy[p] ?? 0, seatsBy[p])}`).join(", ")}`);
  console.log(`Siege je Nation: ${Object.entries(nationWins).map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
}

const N = Number(process.argv[2] ?? 5000);
scenario("Alle kooperativ", N, () => ["kooperativ", "kooperativ", "kooperativ", "kooperativ"]);
scenario("Alle Egoisten", N, () => ["egoist", "egoist", "egoist", "egoist"]);
scenario("Alle Taktiker", N, () => ["taktiker", "taktiker", "taktiker", "taktiker"]);
const mixRnd = rng(42);
scenario("Gemischt (zufällig)", N, () => [0, 1, 2, 3].map(() => PERSONAS[Math.floor(mixRnd() * 3)]));

// Wie früh endet ein gemischtes Spiel?
{
  const r = rng(7); const hist: Record<number, number> = {};
  for (let g = 0; g < N; g++) { const s = play(5000 + g, [0, 1, 2, 3].map(() => PERSONAS[Math.floor(r() * 3)])); const k = s.ending === "vernunft" ? 8 : s.day; hist[k] = (hist[k] ?? 0) + 1; }
  console.log(`\nGemischt, Spielende nach Tag (8 = überlebt): ${Object.entries(hist).map(([d, n]) => `${d}: ${Math.round(100 * n / N)}%`).join(", ")}`);
}
