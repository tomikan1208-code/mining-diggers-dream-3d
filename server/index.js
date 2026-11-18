import { execFile } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { action, advanceClock, createMatch, stateFor } from './match.js';
import { canPlay } from '../src/game-data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { maxHttpBufferSize: 8192 });
const developer = process.argv.includes('--developer');
const bindDeveloper = developer ? (await import('./developer.js')).bindDeveloper : null;
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const appId = 'mining-diggers-dream-3d';
const mode = developer ? 'developer' : 'normal';
app.get('/health', (_request, response) => response.json({ app: appId, mode }));

function roomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sendRoom(room) {
  const now = Date.now();
  for (const [index, member] of room.members.entries()) {
    member.socket?.emit('room', {
      code: room.preview ? null : room.code, session: room.code, preview: room.preview, index,
      names: room.members.map(player => player.name),
      match: room.match && stateFor(room.match, index, now),
    });
  }
}

function message(socket, text) {
  socket.emit('notice', text);
}

function leaveRoom(socket, reason) {
  const room = socket.data.room;
  if (!room) return;
  rooms.delete(room.code);
  for (const member of room.members) {
    if (!member.socket) continue;
    member.socket.data.room = null;
    if (member.socket !== socket) member.socket.emit('room-closed', reason);
  }
}

function enter(socket, room, name) {
  room.members.push({ socket, name });
  socket.data.room = room;
  sendRoom(room);
}

function createRoom(socket, name, preview) {
  leaveRoom(socket, '相手が退出しました');
  const room = {
    code: roomCode(), members: [], match: null, preview, botNext: 0,
  };
  rooms.set(room.code, room);
  if (preview) {
    room.members = [{ socket, name }, { socket: null, name: '赤の鉱夫' }];
    room.match = createMatch(room.members.map(member => member.name), Date.now(), true);
    socket.data.room = room;
    sendRoom(room);
    return;
  }
  enter(socket, room, name);
}

const nameOf = (value, fallback) =>
  (typeof value === 'string' ? value.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 16) : '') || fallback;

io.on('connection', socket => {
  if (bindDeveloper) {
    bindDeveloper(socket);
    return;
  }
  socket.on('create-room', name => createRoom(socket, nameOf(name, '青の鉱夫'), false));

  socket.on('join-room', request => {
    if (!request || typeof request.code !== 'string') return message(socket, '部屋番号を入力してください');
    const room = rooms.get(request.code.trim().toUpperCase());
    if (!room || room.preview) return message(socket, '部屋が見つかりません');
    if (room === socket.data.room) return sendRoom(room);
    if (room.members.length === 2 || room.match) return message(socket, 'この部屋は満員です');
    leaveRoom(socket, '相手が退出しました');
    enter(socket, room, nameOf(request.name, '赤の鉱夫'));
  });

  socket.on('preview', () => createRoom(socket, '青の鉱夫', true));
  socket.on('leave-room', () => leaveRoom(socket, '相手が退出しました'));
  socket.on('disconnect', () => leaveRoom(socket, '相手との接続が切れました'));

  socket.on('start-match', () => {
    const room = socket.data.room;
    if (!room || room.members[0].socket !== socket || room.match || room.members.length !== 2) return;
    room.match = createMatch(room.members.map(member => member.name), Date.now());
    sendRoom(room);
  });

  socket.on('action', request => {
    const room = socket.data.room;
    if (!room?.match || !request || typeof request !== 'object') return;
    const index = room.members.findIndex(member => member.socket === socket);
    const error = action(room.match, index, request, Date.now());
    if (error) message(socket, error);
    sendRoom(room);
  });

  socket.on('preview-dusk', () => {
    const room = socket.data.room;
    if (!room?.preview || room.match.phase !== 'turn') return;
    room.match.deadline = Math.min(room.match.deadline, Date.now() + 4100);
    sendRoom(room);
  });
});

let previousSecond = 0;
const clock = setInterval(() => {
  const now = Date.now();
  const second = Math.floor(now / 1000);
  for (const room of rooms.values()) {
    const game = room.match;
    if (!game || game.phase === 'finished') continue;
    const turned = advanceClock(game, now);
    const botTurn = room.preview && game.active === 1 && game.phase === 'turn';
    if (turned && botTurn) room.botNext = now + 1900;
    if (botTurn && now >= room.botNext) {
      const bot = game.players[1];
      const index = bot.hand.findIndex(id =>
        ['wooden_pickaxe', 'golden_pickaxe', 'oak_fence', 'gunpowder'].includes(id) && canPlay(bot, id));
      if (index >= 0) {
        action(game, 1, { type: 'play', index, id: bot.hand[index] }, now);
        room.botNext = now + 1700;
      } else {
        action(game, 1, { type: 'end' }, now);
      }
      sendRoom(room);
    } else if (turned || second !== previousSecond) {
      sendRoom(room);
    }
  }
  previousSecond = second;
}, 50);
clock.unref();

let vite;
if (process.argv.includes('--dev')) {
  const { createServer: createVite } = await import('vite');
  vite = await createVite({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
} else if (existsSync(dist + 'index.html')) {
  app.use(express.static(dist));
} else {
  console.error('npm run build を実行してください。');
  process.exit(1);
}

const port = developer ? Number(process.env.DEVELOPER_PORT || 4174) : Number(process.env.PORT || 4173);
const host = developer ? '127.0.0.1' : process.env.HOST || '127.0.0.1';
const address = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host.includes(':') ? '[' + host + ']' : host;
const openOnStart = process.argv.includes('--open') && process.platform === 'win32';
const urlFor = value => 'http://' + address + ':' + value + '/';
const openBrowser = url => execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true });

server.on('error', async error => {
  await vite?.close();
  if (openOnStart && error.code === 'EADDRINUSE') {
    const url = urlFor(port);
    try {
      const response = await fetch(url + 'health', { signal: AbortSignal.timeout(1600) });
      const running = response.ok && await response.json();
      if (running?.app === appId && (running.mode ?? 'normal') === mode) {
        openBrowser(url);
        return;
      }
    } catch {
      // A different service might own this port.
    }
  }
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  const url = urlFor(server.address().port);
  console.log('炭鉱掘りは夢を見る 3D' + (developer ? ' 開発者版  ' : '  ') + url);
  if (openOnStart) openBrowser(url);
});
