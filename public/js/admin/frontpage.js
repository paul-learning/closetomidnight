// Titelseite als Bild (PNG), auf dem Gerät gezeichnet. Teilen über das Teilen-Menü, sonst Download.
import { T, fmt } from "../util.js";

const C = T.client;
const W = 1080, PAD = 72, INK = "#1c1f1f", PAPER = "#ece6d6", RED = "#c8352b", MUTE = "#5a605f";
const STENCIL = '"Big Shoulders Stencil Display", "Arial Black", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

/** Rohtext der Zeitung in Schlagzeile und Absätze zerlegen (KI-Text oder schlichte Zusammenfassung). */
function parse(text) {
  const lines = text.replace(/^🗞\s*/, "").split("\n")
    .map(l => l.replace(/\*\*|__|^#+\s*/g, "").trim())
    .filter(l => !/weltuntergangs-kurier/i.test(l));
  while (lines.length && !lines[0]) lines.shift();
  const headline = (lines.shift() ?? "").replace(/^(Krise|Schlagzeile):\s*/i, "");
  // Eine Zeile = eine Meldung; die Uhrzeit steht schon im Kopf
  const paragraphs = lines.filter(l => l && !/^(Uhr:|Die Uhr steht auf)/i.test(l));
  return { headline, paragraphs };
}

function wrap(ctx, text, maxWidth) {
  const out = []; let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

/** Zeichnet die Titelseite; Höhe passt sich dem Text an. */
export async function drawFrontPage(paper, days) {
  await document.fonts?.load(`800 120px ${STENCIL}`).catch(() => {});
  const { headline, paragraphs } = parse(paper.text);
  const measure = document.createElement("canvas").getContext("2d");
  const inner = W - 2 * PAD;

  measure.font = `bold 64px ${SERIF}`;
  const headLines = wrap(measure, headline, inner);
  measure.font = `34px ${SERIF}`;
  const body = paragraphs.map(p => wrap(measure, p, inner));
  const height = 360 + headLines.length * 74 + 40 + body.reduce((h, ls) => h + ls.length * 48 + 22, 0) + 120;

  const canvas = Object.assign(document.createElement("canvas"), { width: W, height });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";

  // Kopf
  ctx.font = `800 118px ${STENCIL}`;
  ctx.fillText(C.paperTitle, W / 2, 170, inner);
  ctx.fillRect(PAD, 205, inner, 6); ctx.fillRect(PAD, 219, inner, 2);
  ctx.font = `600 34px ${SERIF}`;
  ctx.textAlign = "left"; ctx.fillText(fmt(C.dayOf, { day: paper.day, days }), PAD, 272);
  ctx.textAlign = "right"; ctx.fillStyle = RED; ctx.font = `800 52px ${STENCIL}`;
  ctx.fillText(paper.midnight ? C.shareMidnight : fmt(C.shareClock, { clock: paper.clock }), W - PAD, 276);
  ctx.fillStyle = INK; ctx.fillRect(PAD, 304, inner, 2);

  // Schlagzeile
  let y = 384;
  ctx.textAlign = "left"; ctx.font = `bold 64px ${SERIF}`;
  for (const l of headLines) { ctx.fillText(l, PAD, y); y += 74; }
  y += 24;

  // Meldungen
  ctx.font = `34px ${SERIF}`;
  for (const lines of body) {
    for (const l of lines) { ctx.fillText(l, PAD, y); y += 48; }
    y += 22;
  }

  // Fuß
  ctx.fillRect(PAD, height - 86, inner, 2);
  ctx.fillStyle = MUTE; ctx.font = `600 26px ${SERIF}`; ctx.textAlign = "center";
  ctx.fillText(C.shareFooter, W / 2, height - 44);
  return canvas;
}

export async function shareFrontPage(paper, days) {
  const canvas = await drawFrontPage(paper, days);
  const blob = await new Promise(ok => canvas.toBlob(ok, "image/png"));
  const file = new File([blob], `weltuntergangs-kurier-tag-${paper.day}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: C.paperTitle }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: file.name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded";
}
