// KI-Text in schlichten Text verwandeln. Die Zeitung wird als reiner Text angezeigt (Seite, Bild, Export);
// manche Modelle formatieren trotz Auftrag mit Markdown, die Zeichen stünden dann wörtlich da.
export function toPlainText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/^```[^\n]*\n?|\n?```$/gm, "")            // Codeblock-Zäune
    .split("\n")
    .map(line => line
      .replace(/^\s{0,3}#{1,6}\s+/, "")                // Überschriften
      .replace(/^\s{0,3}(?:[-*+]|•)\s+/, "• ")         // Aufzählungen einheitlich mit •
      .replace(/^\s{0,3}>\s?/, "")                      // Zitatblöcke
      .replace(/^\s{0,3}(?:[-*_]\s*){3,}$/, "")         // Trennlinien
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")      // fett
      .replace(/(^|[\s(„"])\*(?!\s)(.+?)(?<!\s)\*(?=[\s).,;:!?“"]|$)/g, "$1$2") // kursiv mit *
      .replace(/(^|[\s(„"])_(?!\s)(.+?)(?<!\s)_(?=[\s).,;:!?“"]|$)/g, "$1$2")   // kursiv mit _
      .replace(/`([^`]+)`/g, "$1")                      // Code
      .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")      // Links: nur der Text
      .trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
