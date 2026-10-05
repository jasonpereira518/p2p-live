import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const { createApiServer } = require('../../server/index.cjs');

let server: ReturnType<typeof createApiServer> | null = null;

async function startApi() {
  const gmvService = {
    getNetwork: async () => ({ routes: [{ id: 'P2P_EXPRESS' }], stops: [{ id: 'union' }] }),
    getSnapshot: async () => ({ status: 'live', vehicles: [{ id: 'bus-1' }], arrivalsByStop: {}, messages: [{ id: 'service-alert' }] }),
  };
  server = createApiServer({ gmvService });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP server address');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (!server) return;
  server.close();
  await once(server, 'close');
  server = null;
});

describe('public rider API', () => {
  it('continues serving GMV network, arrivals, vehicles, and service status data', async () => {
    const baseUrl = await startApi();
    const [network, snapshot] = await Promise.all([
      fetch(`${baseUrl}/api/live/network`),
      fetch(`${baseUrl}/api/live/snapshot`),
    ]);

    expect(network.status).toBe(200);
    await expect(network.json()).resolves.toMatchObject({ routes: [{ id: 'P2P_EXPRESS' }], stops: [{ id: 'union' }] });
    expect(snapshot.status).toBe(200);
    await expect(snapshot.json()).resolves.toMatchObject({ status: 'live', vehicles: [{ id: 'bus-1' }], messages: [{ id: 'service-alert' }] });
  });

  it('does not expose retired auth, messaging, operations, or AI endpoints', async () => {
    const baseUrl = await startApi();
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/auth/login`, { method: 'POST' }),
      fetch(`${baseUrl}/api/messages`),
      fetch(`${baseUrl}/api/ops/complaints/summary`, { method: 'POST' }),
      fetch(`${baseUrl}/api/admin-optimization-summary`, { method: 'POST' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404]);
  });
});
