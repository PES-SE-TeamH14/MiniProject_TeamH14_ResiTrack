require('dotenv').config();

const cluster = require('cluster');

// NFR-01 (#22): one Node process only uses one CPU core. WEB_CONCURRENCY=n starts n worker
// processes that share the same port, so the API can use n cores. Default: 1 (no cluster).
const WORKERS = Math.max(1, Math.floor(Number(process.env.WEB_CONCURRENCY)) || 1);

function startWorker() {
  const app = require('./app');
  const connectDB = require('./config/db');
  const PORT = process.env.PORT || 5000;

  async function start() {
    await connectDB(process.env.MONGODB_URI);
    app.listen(PORT, () => {
      const who = cluster.isWorker ? ` (worker ${process.pid})` : '';
      console.log(`ResiTrack API listening on http://localhost:${PORT}${who}`);
    });

    // FR-07 (#17): the daily rent-reminder job runs in one process only (the first worker, if clustered)
    if (!cluster.isWorker || cluster.worker.id === 1) {
      require('./services/reminderScheduler').startReminderScheduler();
    }
  }

  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

function startPrimary() {
  // Hand out connections in turn (this is already the default everywhere except Windows)
  cluster.schedulingPolicy = cluster.SCHED_RR;
  console.log(`Starting ${WORKERS} API worker processes (WEB_CONCURRENCY=${WORKERS})`);

  let stopping = false;
  for (let i = 0; i < WORKERS; i += 1) cluster.fork();

  cluster.on('listening', (worker) => {
    worker.wasListening = true;
  });
  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return;
    // Replace a worker that crashed while serving; if one cannot even start (e.g. bad MONGODB_URI), stop
    if (worker.wasListening) {
      console.error(`Worker ${worker.process.pid} stopped (${signal || code}), starting a new one`);
      cluster.fork();
    } else {
      console.error(`Worker ${worker.process.pid} could not start, shutting down.`);
      stopping = true;
      for (const other of Object.values(cluster.workers)) other.kill();
      process.exit(1);
    }
  });

  const stop = () => {
    stopping = true;
    for (const worker of Object.values(cluster.workers)) worker.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (WORKERS > 1 && cluster.isPrimary) {
  startPrimary();
} else {
  startWorker();
}
