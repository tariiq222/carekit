const ARABIC_INDIC_OFFSET = 0x0660;
const EXTENDED_ARABIC_INDIC_OFFSET = 0x06f0;

export function toAsciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= ARABIC_INDIC_OFFSET && code <= ARABIC_INDIC_OFFSET + 9) {
      out += String(code - ARABIC_INDIC_OFFSET);
    } else if (code >= EXTENDED_ARABIC_INDIC_OFFSET && code <= EXTENDED_ARABIC_INDIC_OFFSET + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_OFFSET);
    } else {
      out += ch;
    }
  }
  return out;
}
