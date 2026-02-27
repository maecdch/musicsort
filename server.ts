import express from "express";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";

import NeteaseApi from "NeteaseCloudMusicApi";

async function startServer() {
  console.log("Starting server...");
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- NetEase API Proxy Routes ---

  // 1. Get Playlist Details
  app.get("/api/playlist/:id", async (req, res) => {
    console.log(`Fetching playlist: ${req.params.id}`);
    try {
      const result = await NeteaseApi.playlist_detail({
        id: req.params.id,
        cookie: (req.query.cookie as string) || req.headers.cookie || "",
      });
      res.json(result.body);
    } catch (error: any) {
      console.error(`Playlist fetch error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. QR Login: Get Key
  app.get("/api/login/qr/key", async (req, res) => {
    console.log("Getting QR key...");
    try {
      const result = await NeteaseApi.login_qr_key({
        timestamp: Date.now(),
      } as any);
      console.log("QR Key Result:", JSON.stringify(result.body));
      res.json(result.body);
    } catch (error: any) {
      console.error(`QR key error: ${error.message}`, error);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  });

  // 3. QR Login: Create QR
  app.get("/api/login/qr/create", async (req, res) => {
    console.log(`Creating QR for key: ${req.query.key}`);
    try {
      const result = await NeteaseApi.login_qr_create({
        key: req.query.key as string,
        qrimg: true,
        timestamp: Date.now(),
      } as any);
      console.log("QR Create Result:", JSON.stringify(result.body));
      res.json(result.body);
    } catch (error: any) {
      console.error(`QR create error: ${error.message}`, error);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  });

  // 4. QR Login: Check Status
  app.get("/api/login/qr/check", async (req, res) => {
    try {
      const result = await NeteaseApi.login_qr_check({
        key: req.query.key as string,
        timestamp: Date.now(),
      } as any);
      if (result.body.code === 803) {
        console.log("QR Login Success!");
      }
      res.json(result.body);
    } catch (error: any) {
      console.error(`QR check error: ${error.message}`, error);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  });

  // 5. Get User Info (to verify login)
  app.get("/api/user/account", async (req, res) => {
    try {
      const result = await NeteaseApi.user_account({
        cookie: req.query.cookie as string,
      });
      res.json(result.body);
    } catch (error: any) {
      console.error(`User account error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // 6. Create Playlist
  app.post("/api/playlist/create", async (req, res) => {
    console.log(`Creating playlist: ${req.body.name}`);
    try {
      const { name, cookie } = req.body;
      const result = await NeteaseApi.playlist_create({
        name,
        privacy: 0,
        cookie,
      });
      console.log("Playlist created:", result.body);
      res.json(result.body);
    } catch (error: any) {
      console.error(`Playlist create error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // 7. Add Tracks to Playlist
  app.post("/api/playlist/tracks", async (req, res) => {
    console.log(`Adding tracks to playlist: ${req.body.pid}`);
    try {
      const { pid, ids, cookie } = req.body;
      const result = await NeteaseApi.playlist_tracks({
        op: 'add',
        pid,
        tracks: ids, // comma separated string
        cookie,
      });
      console.log("Tracks added:", result.body);
      res.json(result.body);
    } catch (error: any) {
      console.error(`Playlist tracks error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // 8. AI Categorization (DeepSeek)
  app.post("/api/ai/categorize", async (req, res) => {
    try {
      const { songs } = req.body;
      const apiKey = process.env.DEEPSEEK_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in environment variables." });
      }

      const songListText = songs.map((s: any) => `${s.name} - ${s.artists.join(', ')}`).join('\n');

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "你是一个音乐专家。请分析用户提供的歌曲列表，并将它们分类到不同的音乐风格或情绪类别中。返回 JSON 数组，每个对象包含 category (类别名称), songIds (属于该类别的歌曲在原始列表中的索引数组), description (简短描述)。"
            },
            {
              role: "user",
              content: `歌曲列表：\n${songListText}`
            }
          ],
          response_format: {
            type: "json_object"
          }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || "DeepSeek API Error");
      }

      // DeepSeek returns a string in content, we need to parse it
      const content = data.choices[0].message.content;
      let result;
      try {
        // Sometimes models wrap JSON in markdown blocks
        const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        result = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse DeepSeek JSON content:", content);
        throw new Error("AI 返回了无效的 JSON 格式");
      }

      // Normalize result: if it's an object with a property containing the array, extract it
      let categories = Array.isArray(result) ? result : (result.categories || result.items || []);

      res.json(categories);
    } catch (error: any) {
      console.error(`AI categorization error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Start listening first
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started on http://0.0.0.0:${PORT}`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware initialized.");
  } else {
    app.use(express.static("dist"));
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
