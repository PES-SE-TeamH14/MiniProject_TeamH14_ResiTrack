/**
 * A very small PDF writer for one-page documents made of text, lines and boxes.
 * It uses the built-in Helvetica fonts, so no font files or extra packages are needed.
 * Only plain Latin text is supported: other characters are replaced with "?".
 * Coordinates are in points (1/72 inch) from the bottom-left corner of an A4 page.
 */
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

// Keep printable ASCII and escape the characters that have a meaning inside a PDF string
const escapeText = (value) =>
  String(value)
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');

class SimplePdf {
  constructor() {
    this.ops = [];
  }

  text(x, y, value, { size = 12, bold = false } = {}) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapeText(value)}) Tj ET`);
    return this;
  }

  line(x1, y1, x2, y2, width = 1) {
    this.ops.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    return this;
  }

  /** Outlined box, or a box filled with a grey level between 0 (black) and 1 (white). */
  rect(x, y, width, height, { fill = null, lineWidth = 1 } = {}) {
    if (fill !== null) {
      this.ops.push(`${fill} g ${x} ${y} ${width} ${height} re f 0 g`);
    } else {
      this.ops.push(`${lineWidth} w ${x} ${y} ${width} ${height} re S`);
    }
    return this;
  }

  toBuffer() {
    const content = this.ops.join('\n'); // ASCII only, so characters and bytes are the same
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];

    let out = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefAt = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}

module.exports = { SimplePdf, escapeText, PAGE_WIDTH, PAGE_HEIGHT };
