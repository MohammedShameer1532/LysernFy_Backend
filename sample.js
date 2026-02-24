import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 Turso DB
const db = createClient({
  url: "libsql://lysernfy-mohammedshameer1532.aws-ap-south-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ------------------------------------
// 🔐 LOGIN / REGISTER DEVICE
// ------------------------------------
// app.post("/api/session/login", async (req, res) => {
//   try {
//     const { uid, deviceId, deviceName } = req.body;

//     if (!uid || !deviceId) {
//       return res.status(400).json({ allowed: false });
//     }

//     // Get active sessions
//     const sessions = await db.execute({
//       sql: `
//         SELECT * FROM user_sessions
//         WHERE uid = ? AND is_active = 1
//         ORDER BY last_login ASC
//       `,
//       args: [uid],
//     });

//     let kickedDeviceId = null;

//     // // 🔥 Limit: 2 devices (change to 1 if you want)
//     // if (sessions.rows.length >= 1) {
//     //   const oldest = sessions.rows[0];
//     //   kickedDeviceId = oldest.device_id;

//     //   await db.execute({
//     //     sql: `
//     //       UPDATE user_sessions
//     //       SET is_active = 0
//     //       WHERE id = ?
//     //     `,
//     //     args: [oldest.id],
//     //   });
//     // }

//     // Register new session
//     await db.execute({
//       sql: `
//         INSERT INTO user_sessions (uid, device_id, device_name)
//         VALUES (?, ?, ?)
//       `,
//       args: [uid, deviceId, deviceName],
//     });

//     res.json({
//       allowed: true,
//       kickedDeviceId,
//     });
//   } catch (err) {
//     console.error("LOGIN ERROR", err);
//     res.status(500).json({ allowed: false });
//   }
// });
app.post("/api/session/login", async (req, res) => {
  const { uid, deviceId, deviceName } = req.body;

  if (!uid || !deviceId) {
    return res.status(400).json({ success: false });
  }

  // Check if already logged in from this device
  const existing = await db.execute({
    sql: `
      SELECT id FROM user_sessions
      WHERE uid = ? AND device_id = ? AND is_active = 1
    `,
    args: [uid, deviceId],
  });

  if (existing.rows.length === 0) {
    await db.execute({
      sql: `
        INSERT INTO user_sessions (uid, device_id, device_name)
        VALUES (?, ?, ?)
      `,
      args: [uid, deviceId, deviceName],
    });
  }

  // Count active devices
  const count = await db.execute({
    sql: `
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE uid = ? AND is_active = 1
    `,
    args: [uid],
  });

  res.json({
    success: true,
    activeDevices: count.rows[0].count,
  });
});



// ------------------------------------
// 📱 GET ACTIVE DEVICES
// ------------------------------------
app.get("/api/session/devices/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    const result = await db.execute({
      sql: `
        SELECT id, device_id, device_name, last_login
        FROM user_sessions
        WHERE uid = ? AND is_active = 1
        ORDER BY last_login DESC
      `,
      args: [uid],
    });

    res.json(result.rows);
  } catch (err) {
    console.error("GET DEVICES ERROR", err);
    res.status(500).json([]);
  }
});

// ------------------------------------
// 🚪 LOGOUT SPECIFIC DEVICE
// ------------------------------------
app.post("/api/session/logout", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false });
    }

    await db.execute({
      sql: `
        UPDATE user_sessions
        SET is_active = 0
        WHERE id = ?
      `,
      args: [sessionId],
    });

    res.json({ success: true });
  } catch (err) {
    console.error("LOGOUT ERROR", err);
    res.status(500).json({ success: false });
  }
});

// ------------------------------------
// 🔍 CHECK IF THIS DEVICE IS STILL ACTIVE
// ------------------------------------
app.post("/api/session/check", async (req, res) => {
  try {
    const { uid, deviceId } = req.body;

    const result = await db.execute({
      sql: `
        SELECT id FROM user_sessions
        WHERE uid = ? AND device_id = ? AND is_active = 1
      `,
      args: [uid, deviceId],
    });

    if (result.rows.length === 0) {
      return res.json({ active: false });
    }

    res.json({ active: true });
  } catch (err) {
    res.status(500).json({ active: false });
  }
});

// ------------------------------------
// 🩺 HEALTH CHECK
// ------------------------------------
app.get("/", (req, res) => {
  res.send("🔥 Session backend running");
});

// ------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});