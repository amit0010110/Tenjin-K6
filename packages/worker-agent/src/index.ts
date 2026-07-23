import { createAgent } from './agent.js';

const PORT = parseInt(process.env.AGENT_PORT || '6566', 10);
const AGENT_NAME = process.env.AGENT_NAME || `agent-${PORT}`;
const CENTRAL_API_URL = process.env.CENTRAL_API_URL || 'http://localhost:3001';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '10000', 10);

async function main() {
  const agent = createAgent({
    name: AGENT_NAME,
    centralApiUrl: CENTRAL_API_URL,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL,
    port: PORT,
  });

  await agent.start();
  console.log(`Worker agent "${AGENT_NAME}" running on port ${PORT}`);
  console.log(`Central API: ${CENTRAL_API_URL}`);

  // Keep event loop alive indefinitely until shutdown or SIGTERM
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error('Failed to start agent:', err);
  process.exit(1);
});
