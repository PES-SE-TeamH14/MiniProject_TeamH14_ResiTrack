import api from './client.js';

/**
 * Downloads a rent receipt (PDF) for a payment (FR-15).
 * The request needs the login token, so a plain link cannot be used: the PDF is fetched
 * with Axios and saved through a temporary download link.
 */
export async function downloadReceipt(payment) {
  const res = await api.get(`/payments/${payment._id}/receipt`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${payment.flat?.flatNumber || 'flat'}-${payment.month}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
