/**
 * Delivers a message to a tenant. This is the only place that talks to the outside world
 * (the "Email / SMS Gateway" in the component diagram), so a real gateway can be plugged in here
 * without touching the reminder rules.
 *
 * By default the message is written to the server log, which is enough for the demo.
 * It must resolve with { channel } when delivered, and throw when delivery fails.
 */
async function notify({ tenant, message }) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[reminder] to ${tenant.name} <${tenant.email}>: ${message}`);
  }
  return { channel: 'log' };
}

module.exports = { notify };
