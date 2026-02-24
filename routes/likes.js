import express from "express";
import { createClient } from "@libsql/client";
import "dotenv/config";

const router = express.Router();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// LIKE
router.post("/like", async (req, res) => {
  const { userId, songId, title, artist, artwork, url } = req.body;

  console.log("LIKE REQUEST:", userId, songId);

  if (!userId || !songId) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }

  try {
    const result = await db.execute({
      sql: `
        INSERT INTO likes (user_id, song_id, title, artist, artwork, url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, song_id) DO NOTHING
      `,
      args: [userId, songId, title, artist, artwork, url],
    });

    console.log("LIKE RESULT:", result);

    res.json({ success: true });

  } catch (err) {
    console.log("LIKE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});



// UNLIKE
router.post("/unlike", async (req, res) => {
  const { userId, songId } = req.body;

  await db.execute({
    sql: `DELETE FROM likes WHERE user_id = ? AND song_id = ?`,
    args: [userId, songId],
  });

  res.json({ success: true });
});



// Correct route
router.get("/likes/check", async (req, res) => {
  const { userId, songId } = req.query;

 console.log("CHECKING:", userId, songId);
  if (!userId || !songId) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }
  const result = await db.execute({
    sql: `SELECT 1 FROM likes WHERE user_id = ? AND song_id = ? LIMIT 1`,
    args: [userId, songId],
  });

  res.json({ liked: result.rows.length > 0 });
});


// GET LIKES
router.get("/likes/:userId", async (req, res) => {
  const { userId } = req.params;

  const result = await db.execute({
    sql: `
      SELECT song_id, title, artist, artwork, url, created_at
      FROM likes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `,
    args: [userId],
  });

  res.json({ success: true, songs: result.rows });
});

export default router;