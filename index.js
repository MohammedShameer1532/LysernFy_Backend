import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";
import likes from './routes/likes.js'

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', likes);

// 🔗 Turso DB
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});


app.post("/api/session/create", async (req, res) => {
  const { userId, deviceId, deviceName, platform } = req.body;

  if (!userId || !deviceId) {
    return res.status(400).json({
      success: false,
      message: "Missing userId or deviceId",
    });
  }

  // Insert or update session
  await db.execute({
    sql: `
      INSERT INTO user_sessions 
      (user_id, device_id, device_name, platform, is_active, device_active, last_login)
      VALUES (?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, device_id)
      DO UPDATE SET
        device_name = excluded.device_name,
        platform = excluded.platform,
        last_login = CURRENT_TIMESTAMP,
        is_active = 1,
        device_active = 1
    `,
    args: [userId, deviceId, deviceName, platform],
  });

  // 🔥 Fetch ONLY devices that are currently active
  const sessions = await db.execute({
    sql: `
      SELECT device_id, device_name, platform, last_login
      FROM user_sessions
      WHERE user_id = ?
        AND is_active = 1
        AND device_active = 1
      ORDER BY last_login DESC
    `,
    args: [userId],
  });

  const activeDevices = sessions.rows.length;

  // 🔥 If logged in from more than 1 device
  if (activeDevices > 2) {
    return res.json({
      success: true,
      activeDevices,
      userId,
      showModal: true,
      sessions: sessions.rows,

    });
  }

  // If only one device
  return res.json({
    success: true,
    activeDevices,
    userId,
    showModal: false,
  });
});


app.post("/api/session/logout", async (req, res) => {
  const { userId, deviceId } = req.body;

  await db.execute({
    sql: `
      UPDATE user_sessions
      SET device_active = false
      WHERE user_id = ? AND device_id = ?
    `,
    args: [userId, deviceId],
  });

  res.json({ success: true });
});


app.post("/api/session/logout-device", async (req, res) => {
  const { userId, deviceId } = req.body;

  if (!userId || !deviceId) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }

  await db.execute({
    sql: `
      UPDATE user_sessions
      SET is_active = 0,
          device_active = 0
      WHERE user_id = ? AND device_id = ?
    `,
    args: [userId, deviceId],
  });

  res.json({ success: true, message: "Device logged out" });
});


app.post("/api/session/validate", async (req, res) => {
  const { userId, deviceId } = req.body;

  const result = await db.execute({
    sql: `
      SELECT device_active
      FROM user_sessions
      WHERE user_id = ? AND device_id = ?
    `,
    args: [userId, deviceId],
  });

  if (!result.rows.length) {
    return res.json({ valid: false });
  }

  const isActive = result.rows[0].device_active;

  res.json({ valid: isActive === 1 });
});

// 🩺 HEALTH CHECK
app.get("/", (req, res) => {
  res.send("🔥 Session backend running");
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});