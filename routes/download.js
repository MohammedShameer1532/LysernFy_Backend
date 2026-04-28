import express from "express";

const router = express.Router();
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import axios from "axios";
import NodeID3 from "node-id3";

ffmpeg.setFfmpegPath(ffmpegPath);

router.post("/download", async (req, res) => {
  try {
    const { mp3Url, imageUrl, title, artist, album, year } = req.body;

    const tempInput = path.join("temp_input.mp3");
    const tempOutput = path.join("temp_output.mp3");

    // ✅ 1. Download raw file
    const mp3Res = await axios.get(mp3Url, { responseType: "arraybuffer" });
    fs.writeFileSync(tempInput, mp3Res.data);

    // ✅ 2. Rebuild MP3 using FFmpeg (THIS FIXES EVERYTHING)
    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .audioCodec("libmp3lame")
        .audioBitrate(192)
        .format("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(tempOutput);
    });

    let cleanBuffer = fs.readFileSync(tempOutput);

    // ✅ 3. Download image
    let imageBuffer = null;
    if (imageUrl) {
      try {
        const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
        imageBuffer = Buffer.from(img.data);
      } catch { }
    }

    // ✅ 4. Add metadata
    const taggedBuffer = NodeID3.write(
      {
        title,
        artist,
        album,
        year: String(year || ""),
        ...(imageBuffer && {
          APIC: {
            mime: "image/jpeg",
            type: { id: 3, name: "Front Cover" },
            imageBuffer,
          },
        }),
      },
      cleanBuffer
    );

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${title}.mp3"`,
    });

    res.send(taggedBuffer);

    // cleanup
    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;