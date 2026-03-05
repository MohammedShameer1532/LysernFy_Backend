import express from "express";
import { createClient } from "@libsql/client";
import "dotenv/config";
import { nanoid } from "nanoid";

const router = express.Router();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});


// Utility: error handler wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);




// ✅ Create a new playlist

router.post("/playlists", asyncHandler(async (req, res) => {
  const { userId, name } = req.body;
  if (!userId || !name) {
    return res.status(400).json({ success: false, error: "Missing userId or name" });
  }

  const playlistId = nanoid(8); // e.g. "A1b9Xz"

  await db.execute({
    sql: `INSERT INTO playlists (id, name, user_id) VALUES (?, ?, ?)`,
    args: [playlistId, name, userId],
  });

  res.status(201).json({
    success: true,
    playlistId,
    name,
    userId,
  });
}));





// ✅ Update playlist name
router.put("/users/:userId/playlists/:playlistId/", asyncHandler(async (req, res) => {
  const { userId, playlistId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: "Missing name" });
  }

  // ✅ store result
  const result = await db.execute({
    sql: `UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?`,
    args: [name, playlistId, userId],
  });

  if (result.rowsAffected === 0) {
    return res.status(404).json({
      success: false,
      error: "Playlist not found",
    });
  }

  res.json({
    success: true,
    name,
    message: "Playlist updated successfully",
    playlistId
  });
}));




// ✅ Add song to playlist
router.post("/playlists/:id/add", asyncHandler(async (req, res) => {
  const { id } = req.params; // playlistId
  const { userId, songId, title, artist, artwork, url } = req.body;

  const existing = await db.execute({
    sql: `SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
    args: [id, songId],
  });

  if (existing.rows.length > 0) {
    return res.json({ success: true, message: "Song already exists" });
  }

  if (!userId || !songId || !title || !artist || !url) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  // Verify playlist belongs to this user
  const playlistCheck = await db.execute({
    sql: `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });

  if (playlistCheck.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Playlist not found for this user" });
  }

  // Find next position
  const pos = await db.execute({
    sql: `SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlist_id = ?`,
    args: [id],
  });

  const nextPosition = (pos.rows[0]?.maxPos ?? -1) + 1;

  // Insert song
  await db.execute({
    sql: `
      INSERT INTO playlist_songs
      (playlist_id, song_id, title, artist, artwork, url, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, songId, title, artist, artwork, url, nextPosition],
  });

  res.status(201).json({
    success: true,
    song: { songId, title, artist, artwork, url, position: nextPosition },
  });
}));




// ✅ Delete playlist
router.delete("/users/:userId/playlists/:playlistId", asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  await db.execute({
    sql: `DELETE FROM playlists WHERE id = ?  `,
    args: [playlistId],
  });

  res.json({
    success: true,
    message: "Playlist removed successfully",
  });
}));



// ✅ Delete song from playlist
router.delete("/users/:userId/playlists/:playlistId/song/:songId", asyncHandler(async (req, res) => {
  const { userId, playlistId, songId } = req.params;

  const playlistCheck = await db.execute({
    sql: `SELECT id FROM playlists WHERE id = ? AND user_id = ?`,
    args: [playlistId, userId],
  });

  if (playlistCheck.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: "Playlist not found for this user",
    });
  }

  await db.execute({
    sql: `DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
    args: [playlistId, songId],
  });

  res.json({ success: true });
})
);


// ✅ Get songs in a playlist (with user validation)
router.get("/users/:userId/playlists/:playlistId", asyncHandler(async (req, res) => {
  const { userId, playlistId } = req.params;

  // 1️⃣ Check playlist belongs to this user
  const playlistCheck = await db.execute({
    sql: `
        SELECT id 
        FROM playlists
        WHERE id = ? AND user_id = ?
      `,
    args: [playlistId, userId],
  });

  if (playlistCheck.rows.length === 0) {
    return res.status(403).json({
      success: false,
      message: "Playlist not found or unauthorized",
    });
  }

  // 2️⃣ Get songs
  const result = await db.execute({
    sql: `
        SELECT song_id, title, artist, artwork, url, position
        FROM playlist_songs
        WHERE playlist_id = ?
        ORDER BY position ASC
      `,
    args: [playlistId],
  });

  res.json({
    success: true,
    playlistId,
    songs: result.rows,
  });
})
);


// ✅ Get all playlists for a user
router.get("/users/:userId/playlists", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { songId } = req.query; // optional

  // If no songId → normal playlist fetch
  if (!songId) {
    const result = await db.execute({
      sql: `SELECT id, name FROM playlists WHERE user_id = ?`,
      args: [userId],
    });

    return res.json({
      success: true,
      playlists: result.rows.map(p => ({
        id: p.id,
        name: p.name,
        hasSongExist: false,
      })),
    });
  }

  const result = await db.execute({
    sql: `
    SELECT 
      p.id,
      p.name,
      COUNT(ps.song_id) as totalSongs,
      GROUP_CONCAT(ps.artwork) as artworks,
      CASE 
        WHEN SUM(CASE WHEN ps.song_id = ? THEN 1 ELSE 0 END) > 0 
        THEN 1 ELSE 0 
      END AS hasSongExist
    FROM playlists p
    LEFT JOIN playlist_songs ps
      ON p.id = ps.playlist_id
    WHERE p.user_id = ?
    GROUP BY p.id
  `,
    args: [songId ?? "", userId],
  });

  res.json({
    success: true,
    playlists: result.rows.map(p => ({
      id: p.id,
      name: p.name,
      totalSongs: p.totalSongs,
      artworks: p.artworks ? p.artworks.split(",") : [],
      hasSongExist: !!p.hasSongExist,
    })),
  });
}));


//Get All Playlists With Songs
router.get("/users/:userId/playlists-with-songs", asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const result = await db.execute({
    sql: `
        SELECT 
          p.id as playlist_id,
          p.name as playlist_name,
          ps.song_id,
          ps.title,
          ps.artist,
          ps.artwork,
          ps.url,
          ps.position
        FROM playlists p
        LEFT JOIN playlist_songs ps
          ON p.id = ps.playlist_id
        WHERE p.user_id = ?
        ORDER BY p.id, ps.position ASC
      `,
    args: [userId],
  });

  // 🔥 Group playlists with their songs
  const playlistsMap = {};

  for (const row of result.rows) {
    if (!playlistsMap[row.playlist_id]) {
      playlistsMap[row.playlist_id] = {
        id: row.playlist_id,
        name: row.playlist_name,
        songs: [],
      };
    }

    if (row.song_id) {
      playlistsMap[row.playlist_id].songs.push({
        songId: row.song_id,
        title: row.title,
        artist: row.artist,
        artwork: row.artwork,
        url: row.url,
        position: row.position,
      });
    }
  }

  res.json({
    success: true,
    playlists: Object.values(playlistsMap),
  });
})
);

// Global error handler
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

export default router;
