#!/usr/bin/env node
/**
 * xiaozhi-music-railway — Real music MCP WebSocket server
 *
 * Uses Meting (metowolf/Meting) to search and fetch playable URLs
 * from Netease, Tencent/QQ, Kugou, and Kuwo music platforms.
 *
 * Protocol: MCP JSON-RPC 2.0 over WebSocket
 * Designed for Railway.app deployment (env PORT)
 *
 * 新增模式（v1.1）：
 * - 若设置了环境变量 MCP_ENDPOINT（小智后台的 MCP 接入点地址，
 *   形如 wss://api.xiaozhi.me/mcp/?token=xxx），则以客户端模式
 *   主动连接小智接入点，把小智发来的 MCP 请求在这里响应（音乐工具）。
 * - 未设置 MCP_ENDPOINT 时保持原样：作为被动 WebSocket 服务端等待连接。
 */
import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import Meting from './lib/meting/meting.js';

// ─── Config ────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8765', 10);
const HOST = process.env.HOST || '0.0.0.0';
const XIAOZHI_ENDPOINT = process.env.MCP_ENDPOINT || '';

// ─── Meting client factory ──────────────────────────────────────
function createClient(platform) {
  const meting = new Meting(platform);
  meting.format(true);

  // Optional cookies from env
  const cookieVar = `METING_${platform.toUpperCase()}_COOKIE`;
  const cookie = process.env[cookieVar] || process.env.METING_COOKIE;
  if (cookie) {
    meting.cookie(cookie);
  }

  return meting;
}

// ─── Tool definitions ───────────────────────────────────────────
const PLATFORMS = ['netease', 'tencent', 'kugou', 'kuwo'];

const TOOLS = [
  {
    name: 'platforms',
    description: 'List supported music platforms (netease, tencent, kugou, kuwo).',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return JSON.stringify({ ok: true, data: PLATFORMS.map(p => ({
        code: p,
        name: { netease: 'NetEase Cloud Music', tencent: 'Tencent QQ Music', kugou: 'KuGou Music', kuwo: 'Kuwo Music' }[p]
      }))}, null, 2);
    }
  },
  {
    name: 'search',
    description: 'Search songs, albums or artists on a specific music platform.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        keyword: { type: 'string', description: 'Search keyword (song/artist name)' },
        page: { type: 'integer', description: 'Page number', default: 1 },
        limit: { type: 'integer', description: 'Results per page', default: 20 }
      },
      required: ['platform', 'keyword']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const options = {};
      if (args.page) options.page = args.page;
      if (args.limit) options.limit = args.limit;
      const raw = await client.search(args.keyword, options);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'song',
    description: 'Get song details by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Song ID' }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.song(args.id);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'url',
    description: 'Get playable audio URL for a song by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Song ID' },
        br: { type: 'integer', description: 'Bitrate (e.g. 128, 320)', default: 320 }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.url(args.id, args.br || 320);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'album',
    description: 'Get album details by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Album ID' }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.album(args.id);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'artist',
    description: 'Get artist songs by artist ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Artist ID' },
        limit: { type: 'integer', description: 'Max results', default: 50 }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.artist(args.id, args.limit || 50);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'playlist',
    description: 'Get playlist details by playlist ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Playlist ID' }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.playlist(args.id);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'lyric',
    description: 'Get song lyrics by song ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Song ID' }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.lyric(args.id);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  },
  {
    name: 'pic',
    description: 'Get cover/picture URL by resource ID.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: PLATFORMS, description: 'Music platform' },
        id: { type: 'string', description: 'Picture/resource ID' },
        size: { type: 'integer', description: 'Image size in pixels', default: 300 }
      },
      required: ['platform', 'id']
    },
    handler: async (args) => {
      const client = createClient(args.platform);
      const raw = await client.pic(args.id, args.size || 300);
      return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    }
  }
];

// ─── MCP JSON-RPC handler ───────────────────────────────────────
async function handleMessage(data) {
  const { id, method, params = {} } = data;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: 'xiaozhi-music-railway', version: '1.1.0' }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0', id,
          result: {
            tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
          }
        };

      case 'tools/call': {
        const tool = TOOLS.find(t => t.name === params.name);
        if (!tool) {
          return {
            jsonrpc: '2.0', id,
            error: { code: -32601, message: `Unknown tool: ${params.name}` }
          };
        }
        const text = await tool.handler(params.arguments || {});
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text }] }
        };
      }

      case 'notifications/initialized':
        // 通知类消息无需响应
        return null;

      default:
        return {
          jsonrpc: '2.0', id,
          error: { code: -32601, message: `Unknown method: ${method}` }
        };
    }
  } catch (err) {
    console.error(`Error handling ${method}:`, err);
    return {
      jsonrpc: '2.0', id,
      error: { code: -32603, message: err.message || 'Internal error' }
    };
  }
}

function sendJson(ws, obj) {
  if (obj && ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (e) {
      console.error('[send]', e.message);
    }
  }
}

async function onMessage(ws, raw) {
  let data;
  try {
    data = JSON.parse(raw.toString());
  } catch {
    sendJson(ws, {
      jsonrpc: '2.0', id: null,
      error: { code: -32700, message: 'Parse error' }
    });
    return;
  }
  const response = await handleMessage(data);
  if (response) {
    sendJson(ws, response);
  }
}

// ─── WebSocket server (passive mode, keep original) ─────────────
const wss = new WebSocketServer({ port: PORT, host: HOST });

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress;
  console.log(`[connect] ${addr}`);

  ws.on('message', async (raw) => {
    await onMessage(ws, raw);
  });

  ws.on('close', () => {
    console.log(`[disconnect] ${addr}`);
  });

  ws.on('error', (err) => {
    console.error(`[error] ${addr}:`, err.message);
  });
});

console.log(`[ready] wss://${HOST}:${PORT}  |  Music MCP Server (Meting)`);
console.log(`[ready] Platforms: ${PLATFORMS.join(', ')}`);

// ─── Xiaozhi endpoint client mode (new in v1.1) ─────────────────
// 若设置了 MCP_ENDPOINT，主动连接小智后台接入点并响应其 MCP 请求。
if (XIAOZHI_ENDPOINT) {
  let retry = 0;

  function connectXiaozhi() {
    let ws;
    try {
      ws = new WebSocket(XIAOZHI_ENDPOINT);
    } catch (e) {
      console.error(`[xiaozhi] invalid endpoint: ${e.message}`);
      return;
    }

    ws.on('open', () => {
      retry = 0;
      console.log(`[xiaozhi] connected to ${XIAOZHI_ENDPOINT.replace(/\?token=.*$/, '?token=***')}`);
    });

    ws.on('message', async (raw) => {
      await onMessage(ws, raw);
    });

    ws.on('close', (code, reason) => {
      console.log(`[xiaozhi] disconnected (${code} ${reason || ''}), retry in ${Math.min(30, 2 ** retry)}s`);
      retry += 1;
      setTimeout(connectXiaozhi, Math.min(30, 2 ** retry) * 1000);
    });

    ws.on('error', (err) => {
      console.error(`[xiaozhi] error: ${err.message}`);
    });
  }

  console.log(`[xiaozhi] client mode enabled, connecting to Xiaozhi endpoint...`);
  connectXiaozhi();
}
