const { SimplePdf, PAGE_WIDTH } = require('../utils/simplePdf');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const shorten = (value, max) => (value.length > max ? `${value.slice(0, max - 3)}...` : value);

/** "2026-11" -> "November 2026" */
function monthLabel(month) {
  const [year, number] = month.split('-');
  return `${MONTH_NAMES[Number(number) - 1]} ${year}`;
}

/** Calendar date in UTC, e.g. "05 Nov 2026" */
function formatDate(date) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Receipt number such as RCPT-202611-A1B2C3 (the rent month and the end of the payment id). */
function receiptNumber(payment) {
  return `RCPT-${payment.month.replace('-', '')}-${String(payment._id).slice(-6).toUpperCase()}`;
}

/** File name used for the download, e.g. receipt-A-101-2026-11.pdf */
function receiptFileName(payment) {
  const flat = String(payment.flat?.flatNumber || 'flat').replace(/[^A-Za-z0-9_-]/g, '');
  return `receipt-${flat}-${payment.month}.pdf`;
}

/**
 * Builds the printable monthly rent receipt (FR-15, UC-15) and returns it as a PDF Buffer.
 * The payment must have its tenant (name) and flat (flatNumber, block) populated.
 * The PDF shows the tenant name, flat, amount and payment date (TC-15).
 */
function buildReceiptPdf(payment) {
  const pdf = new SimplePdf();
  const left = 60;
  const right = PAGE_WIDTH - 60;

  pdf.rect(40, 40, PAGE_WIDTH - 80, 762);
  pdf.text(left, 750, 'ResiTrack', { size: 26, bold: true });
  pdf.text(left, 728, 'Apartment / Residencies Organizer', { size: 11 });
  pdf.text(right - 118, 750, 'RENT RECEIPT', { size: 16, bold: true });
  pdf.line(left, 712, right, 712, 1.5);

  pdf.text(left, 685, `Receipt no: ${receiptNumber(payment)}`, { size: 11 });
  pdf.text(right - 140, 685, `Date paid: ${formatDate(payment.paidOn)}`, { size: 11 });

  const flat = payment.flat || {};
  const flatText = [flat.block ? `Block ${flat.block}` : '', flat.flatNumber ? `Flat ${flat.flatNumber}` : '']
    .filter(Boolean)
    .join(', ');
  const rows = [
    ['Received from', shorten(payment.tenant?.name || '-', 55)],
    ['Flat', flatText || '-'],
    ['Rent for', monthLabel(payment.month)],
    ['Payment date', formatDate(payment.paidOn)],
    ['Payment method', payment.method || '-'],
  ];
  if (payment.reference) rows.push(['Reference', shorten(payment.reference, 55)]);

  let y = 630;
  for (const [label, value] of rows) {
    pdf.text(left, y, label, { size: 12, bold: true });
    pdf.text(left + 150, y, value, { size: 12 });
    pdf.line(left, y - 10, right, y - 10, 0.4);
    y -= 38;
  }

  y -= 10;
  pdf.rect(left, y - 24, right - left, 54, { fill: 0.93 });
  pdf.text(left + 15, y - 2, 'Amount received', { size: 13, bold: true });
  pdf.text(left + 190, y - 6, formatAmount(payment.amount), { size: 22, bold: true });

  pdf.text(left, 130, 'Received with thanks.', { size: 12 });
  pdf.line(left, 70 + 40, right, 70 + 40, 0.4);
  pdf.text(left, 90, 'This is a computer-generated receipt and does not need a signature.', { size: 9 });

  return pdf.toBuffer();
}

module.exports = { buildReceiptPdf, receiptNumber, receiptFileName, formatAmount, formatDate, monthLabel };
