import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";
import likes from './routes/likes.js';
import playlist from './routes/playlist.js'
import proxy from './routes/proxy.js';


const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', likes);
app.use('/api', playlist);
app.use('/api', proxy);

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


// ============================================================
// USER LANGUAGE PREFERENCE
// ============================================================

// Get user's saved language
app.get("/api/preferences/:userId", async (req, res) => {
  try {
    const userId = req.params.userId?.trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const result = await db.execute({
      sql: `
        SELECT user_id, music_language
        FROM user_preferences
        WHERE user_id = ?
        LIMIT 1
      `,
      args: [userId],
    });

    // Fresh user - no preference selected yet
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        isNewUser: true,
        needsLanguageSelection: true,
        userId,
        language: null,
      });
    }

    // Existing user
    return res.json({
      success: true,
      isNewUser: false,
      needsLanguageSelection: false,
      userId,
      language: result.rows[0].music_language,
    });

  } catch (error) {
    console.error("Get language preference error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get language preference",
    });
  }
});


// Save / update user's language
app.post("/api/preferences/language", async (req, res) => {
  try {
    const { userId, language } = req.body;

    if (!userId || !language) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or language",
      });
    }

    const normalizedUserId = userId.trim().toLowerCase();
    const normalizedLanguage = language.trim().toLowerCase();

    await db.execute({
      sql: `
        INSERT INTO user_preferences (
          user_id,
          music_language,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(user_id)
        DO UPDATE SET
          music_language = excluded.music_language,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        normalizedUserId,
        normalizedLanguage,
      ],
    });

    return res.json({
      success: true,
      userId: normalizedUserId,
      language: normalizedLanguage,
      message: "Language preference saved",
    });

  } catch (error) {
    console.error("Save language preference error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save language preference",
    });
  }
});

// 🩺 HEALTH CHECK
app.get("/", (req, res) => {
  res.send("🔥 Session backend running");
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});