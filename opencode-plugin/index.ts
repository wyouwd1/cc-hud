import { type PluginContext, define } from '@opencode-ai/plugin/v2/promise';
import { createOpencodeClient } from '@opencode-ai/sdk';
import { SessionCollector } from './session.js';
import { buildRenderData } from './adapter.js';
import { writeStatusFile, setStatusPath } from './status-writer.js';
import { loadConfig } from './config.js';

const POLL_MS = 2000;

export default define({
  id: 'cc-hud',

  setup: async (_context: PluginContext) => {
    const config = loadConfig();
    if (config.statusFile) {
      setStatusPath(config.statusFile);
    }

    const collector = new SessionCollector();
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSessionData = '';

    const flushRender = async () => {
      try {
        const output = await buildRenderData(collector);
        if (output !== lastSessionData) {
          lastSessionData = output;
          await writeStatusFile(output);
        }
      } catch {
        // 静默降级
      }
    };

    let client: ReturnType<typeof createOpencodeClient> | null = null;
    try {
      client = createOpencodeClient();
    } catch {
      // client 创建失败时继续
    }

    const poll = async () => {
      if (!client) return;

      try {
        const active = await client.session.active();
        const sessionIds = Object.keys(active.data);
        if (sessionIds.length > 0) {
          for (const sid of sessionIds) {
            const sessionResp = await client.session.get({ sessionID: sid });
            const session = sessionResp.data as Record<string, unknown>;
            if (session) {
              collector.ingest({
                type: 'session.updated',
                properties: {
                  sessionID: sid,
                  info: session,
                },
              });
            }
          }
        }
      } catch {
        // 静默降级
      }

      await flushRender();

      pollTimer = setTimeout(() => { void poll(); }, POLL_MS);
      pollTimer.unref();
    };

    void poll();

  },
});
