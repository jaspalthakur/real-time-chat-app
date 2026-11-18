import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chatterbox-serverless-jwt-secret-key-2026';
const DB_URL = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

// ==========================================
// In-Memory Fallback Store (if DB_URL not set)
// ==========================================
let memUsers = [];
let memRooms = [
  { id: 1, name: 'General', description: 'General discussion for everyone', created_at: new Date().toISOString() },
  { id: 2, name: 'Random', description: 'Off-topic banter and casual chat', created_at: new Date().toISOString() },
  { id: 3, name: 'Tech', description: 'Tech talk, coding, and architecture', created_at: new Date().toISOString() },
];
let memRoomMembers = [
  // { roomId, userId }
];
let memMessages = [
  {
    id: 1,
    room_id: 1,
    sender_id: 0,
    sender_name: 'ChatterBox Bot',
    sender_avatar_color: '#6366f1',
    content: 'Welcome to ChatterBox! 🎉 Send a message to start chatting.',
    created_at: new Date().toISOString(),
  }
];
let idCounter = 100;

// ==========================================
// DB Initialization (Postgres via Neon)
// ==========================================
let sql = null;
let dbInitialized = false;

if (DB_URL) {
  try {
    sql = neon(DB_URL);
  } catch (err) {
    console.error('Failed to initialize Neon client:', err);
  }
}

async function initDb() {
  if (!sql || dbInitialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(150) UNIQUE NOT NULL,
        email VARCHAR(255) DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        avatar_color VARCHAR(20) DEFAULT '#6366f1',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (room_id, user_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
        sender_id INT REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Seed default rooms
    await sql`INSERT INTO rooms (name, description) VALUES ('General', 'General discussion for everyone') ON CONFLICT (name) DO NOTHING;`;
    await sql`INSERT INTO rooms (name, description) VALUES ('Random', 'Off-topic banter and casual chat') ON CONFLICT (name) DO NOTHING;`;
    await sql`INSERT INTO rooms (name, description) VALUES ('Tech', 'Tech talk, coding, and architecture') ON CONFLICT (name) DO NOTHING;`;

    dbInitialized = true;
  } catch (err) {
    console.error('Error initializing tables:', err);
  }
}

// ==========================================
// Helpers
// ==========================================
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function jsonResponse(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(data),
  };
}

// ==========================================
// Main Serverless Handler
// ==========================================
export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: '',
    };
  }

  await initDb();

  // Normalize path by stripping /.netlify/functions/api or /api
  let path = event.path || '';
  path = path.replace(/^\/\.netlify\/functions\/api/, '');
  path = path.replace(/^\/api/, '');
  if (!path.startsWith('/')) path = '/' + path;
  if (!path.endsWith('/')) path = path + '/';

  const method = event.httpMethod;
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = {};
    }
  }

  // 1. Root info
  if (path === '/' && method === 'GET') {
    return jsonResponse({
      name: 'ChatterBox API',
      version: '1.0.0',
      status: 'running',
      database: sql ? 'Postgres (Neon)' : 'In-Memory Fallback',
    });
  }

  // 2. Register
  if (path === '/register/' && method === 'POST') {
    const { username, email, password } = body;
    if (!username || !password) {
      return jsonResponse({ error: 'Username and password are required' }, 400);
    }
    if (password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    const color = pickColor();
    const hash = await bcrypt.hash(password, 10);

    if (sql) {
      try {
        const existing = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
        if (existing.length > 0) {
          return jsonResponse({ username: ['Username already taken.'] }, 400);
        }

        const [newUser] = await sql`
          INSERT INTO users (username, email, password_hash, avatar_color, last_seen)
          VALUES (${username}, ${email || ''}, ${hash}, ${color}, NOW())
          RETURNING id, username, email, avatar_color, created_at, last_seen;
        `;

        // Auto join General room
        const [genRoom] = await sql`SELECT id FROM rooms WHERE name = 'General' LIMIT 1`;
        if (genRoom) {
          await sql`INSERT INTO room_members (room_id, user_id) VALUES (${genRoom.id}, ${newUser.id}) ON CONFLICT DO NOTHING;`;
        }

        const token = jwt.sign({ user_id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
        return jsonResponse({
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            avatar_color: newUser.avatar_color,
            is_online: true,
          },
          tokens: { access: token, refresh: token },
        }, 201);
      } catch (err) {
        console.error(err);
        return jsonResponse({ error: 'Registration failed' }, 500);
      }
    } else {
      if (memUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return jsonResponse({ username: ['Username already taken.'] }, 400);
      }
      const newUser = {
        id: ++idCounter,
        username,
        email: email || '',
        password_hash: hash,
        avatar_color: color,
        created_at: new Date().toISOString(),
        last_seen: Date.now(),
      };
      memUsers.push(newUser);
      memRoomMembers.push({ roomId: 1, userId: newUser.id });

      const token = jwt.sign({ user_id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
      return jsonResponse({
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          avatar_color: newUser.avatar_color,
          is_online: true,
        },
        tokens: { access: token, refresh: token },
      }, 201);
    }
  }

  // 3. Login
  if (path === '/login/' && method === 'POST') {
    const { username, password } = body;
    if (!username || !password) {
      return jsonResponse({ error: 'Username and password required' }, 400);
    }

    if (sql) {
      const users = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
      if (users.length === 0) {
        return jsonResponse({ error: 'Invalid credentials' }, 401);
      }
      const user = users[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return jsonResponse({ error: 'Invalid credentials' }, 401);
      }

      await sql`UPDATE users SET last_seen = NOW() WHERE id = ${user.id}`;
      const token = jwt.sign({ user_id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      return jsonResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_color: user.avatar_color,
          is_online: true,
        },
        tokens: { access: token, refresh: token },
      });
    } else {
      const user = memUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) return jsonResponse({ error: 'Invalid credentials' }, 401);
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return jsonResponse({ error: 'Invalid credentials' }, 401);

      user.last_seen = Date.now();
      const token = jwt.sign({ user_id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      return jsonResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_color: user.avatar_color,
          is_online: true,
        },
        tokens: { access: token, refresh: token },
      });
    }
  }

  // Auth protection for following endpoints
  const authUser = verifyToken(event.headers.authorization || event.headers.Authorization);
  if (!authUser) {
    return jsonResponse({ detail: 'Authentication credentials were not provided.' }, 401);
  }

  // 4. Me
  if (path === '/me/' && method === 'GET') {
    if (sql) {
      const users = await sql`SELECT id, username, email, avatar_color, created_at, last_seen FROM users WHERE id = ${authUser.user_id} LIMIT 1`;
      if (users.length === 0) return jsonResponse({ error: 'User not found' }, 404);
      await sql`UPDATE users SET last_seen = NOW() WHERE id = ${authUser.user_id}`;
      return jsonResponse({ ...users[0], is_online: true });
    } else {
      const user = memUsers.find(u => u.id === authUser.user_id);
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      user.last_seen = Date.now();
      return jsonResponse({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_color: user.avatar_color,
        is_online: true,
      });
    }
  }

  // 5. Rooms list
  if (path === '/rooms/' && method === 'GET') {
    if (sql) {
      const rooms = await sql`
        SELECT r.id, r.name, r.description, r.created_at,
          (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count
        FROM rooms r
        ORDER BY r.id ASC;
      `;

      const enriched = await Promise.all(
        rooms.map(async (r) => {
          const last = await sql`
            SELECT m.content, m.created_at as timestamp, u.username as sender
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = ${r.id}
            ORDER BY m.id DESC LIMIT 1;
          `;
          return {
            ...r,
            member_count: parseInt(r.member_count || '1', 10),
            last_message: last[0] || null,
          };
        })
      );
      return jsonResponse(enriched);
    } else {
      const result = memRooms.map(r => {
        const msgs = memMessages.filter(m => m.room_id === r.id);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const members = memRoomMembers.filter(rm => rm.roomId === r.id);
        return {
          ...r,
          member_count: Math.max(members.length, 1),
          last_message: lastMsg ? { content: lastMsg.content, sender: lastMsg.sender_name, timestamp: lastMsg.created_at } : null,
        };
      });
      return jsonResponse(result);
    }
  }

  // 6. Create Room
  if (path === '/rooms/create/' && method === 'POST') {
    const { name, description } = body;
    if (!name || !name.trim()) {
      return jsonResponse({ error: 'Room name is required' }, 400);
    }
    const cleanName = name.trim();

    if (sql) {
      let [room] = await sql`SELECT * FROM rooms WHERE name = ${cleanName} LIMIT 1`;
      if (!room) {
        [room] = await sql`INSERT INTO rooms (name, description) VALUES (${cleanName}, ${description || ''}) RETURNING *;`;
      }
      await sql`INSERT INTO room_members (room_id, user_id) VALUES (${room.id}, ${authUser.user_id}) ON CONFLICT DO NOTHING;`;
      return jsonResponse({ ...room, member_count: 1, last_message: null }, 201);
    } else {
      let room = memRooms.find(r => r.name.toLowerCase() === cleanName.toLowerCase());
      if (!room) {
        room = { id: ++idCounter, name: cleanName, description: description || '', created_at: new Date().toISOString() };
        memRooms.push(room);
      }
      memRoomMembers.push({ roomId: room.id, userId: authUser.user_id });
      return jsonResponse({ ...room, member_count: 1, last_message: null }, 201);
    }
  }

  // 7. Join Room: /rooms/:id/join/
  const joinMatch = path.match(/^\/rooms\/(\d+)\/join\/$/);
  if (joinMatch && method === 'POST') {
    const roomId = parseInt(joinMatch[1], 10);
    if (sql) {
      await sql`INSERT INTO room_members (room_id, user_id) VALUES (${roomId}, ${authUser.user_id}) ON CONFLICT DO NOTHING;`;
      const [room] = await sql`SELECT * FROM rooms WHERE id = ${roomId}`;
      return jsonResponse(room || {});
    } else {
      memRoomMembers.push({ roomId, userId: authUser.user_id });
      const room = memRooms.find(r => r.id === roomId);
      return jsonResponse(room || {});
    }
  }

  // 8. Room Messages: /rooms/:id/messages/
  const messagesMatch = path.match(/^\/rooms\/(\d+)\/messages\/$/);
  if (messagesMatch) {
    const roomId = parseInt(messagesMatch[1], 10);

    // GET messages
    if (method === 'GET') {
      if (sql) {
        const msgs = await sql`
          SELECT m.id, m.room_id as room, m.content, m.created_at as timestamp,
                 u.id as sender, u.username as sender_name, u.avatar_color as sender_avatar_color
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.room_id = ${roomId}
          ORDER BY m.id ASC
          LIMIT 100;
        `;
        return jsonResponse(msgs);
      } else {
        const msgs = memMessages
          .filter(m => m.room_id === roomId)
          .map(m => ({
            id: m.id,
            room: m.room_id,
            content: m.content,
            timestamp: m.created_at,
            sender: m.sender_id,
            sender_name: m.sender_name,
            sender_avatar_color: m.sender_avatar_color,
          }));
        return jsonResponse(msgs);
      }
    }

    // POST send message
    if (method === 'POST') {
      const { content } = body;
      if (!content || !content.trim()) {
        return jsonResponse({ error: 'Message content required' }, 400);
      }

      if (sql) {
        const [user] = await sql`SELECT id, username, avatar_color FROM users WHERE id = ${authUser.user_id}`;
        const [saved] = await sql`
          INSERT INTO messages (room_id, sender_id, content, created_at)
          VALUES (${roomId}, ${authUser.user_id}, ${content.trim()}, NOW())
          RETURNING id, room_id, content, created_at;
        `;
        await sql`UPDATE users SET last_seen = NOW() WHERE id = ${authUser.user_id}`;

        return jsonResponse({
          id: saved.id,
          room: saved.room_id,
          content: saved.content,
          timestamp: saved.created_at,
          sender: user.id,
          sender_name: user.username,
          sender_avatar_color: user.avatar_color,
        }, 201);
      } else {
        const user = memUsers.find(u => u.id === authUser.user_id) || {
          id: authUser.user_id,
          username: authUser.username,
          avatar_color: '#6366f1',
        };
        const newMsg = {
          id: ++idCounter,
          room_id: roomId,
          sender_id: user.id,
          sender_name: user.username,
          sender_avatar_color: user.avatar_color,
          content: content.trim(),
          created_at: new Date().toISOString(),
        };
        memMessages.push(newMsg);
        user.last_seen = Date.now();

        return jsonResponse({
          id: newMsg.id,
          room: newMsg.room_id,
          content: newMsg.content,
          timestamp: newMsg.created_at,
          sender: newMsg.sender_id,
          sender_name: newMsg.sender_name,
          sender_avatar_color: newMsg.sender_avatar_color,
        }, 201);
      }
    }
  }

  // 9. Online users: /users/online/
  if (path === '/users/online/' && method === 'GET') {
    if (sql) {
      // Users active within the last 3 minutes
      const users = await sql`
        SELECT id, username, email, avatar_color, created_at, last_seen
        FROM users
        WHERE last_seen > NOW() - INTERVAL '3 minutes'
        ORDER BY username ASC;
      `;
      return jsonResponse(users.map(u => ({ ...u, is_online: true })));
    } else {
      const now = Date.now();
      const online = memUsers
        .filter(u => u.last_seen && (now - u.last_seen < 3 * 60 * 1000))
        .map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          avatar_color: u.avatar_color,
          is_online: true,
        }));
      return jsonResponse(online);
    }
  }

  // 10. All users: /users/
  if (path === '/users/' && method === 'GET') {
    if (sql) {
      const users = await sql`
        SELECT id, username, email, avatar_color, created_at, last_seen,
          (last_seen > NOW() - INTERVAL '3 minutes') as is_online
        FROM users
        WHERE id != ${authUser.user_id}
        ORDER BY username ASC;
      `;
      return jsonResponse(users);
    } else {
      const now = Date.now();
      const users = memUsers
        .filter(u => u.id !== authUser.user_id)
        .map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          avatar_color: u.avatar_color,
          is_online: u.last_seen ? (now - u.last_seen < 3 * 60 * 1000) : false,
        }));
      return jsonResponse(users);
    }
  }

  return jsonResponse({ error: 'Endpoint not found', path }, 404);
};
