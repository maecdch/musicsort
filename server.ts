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
    try {
      const result = await NeteaseApi.playlist_detail({
        id: req.params.id,
        cookie: (req.query.cookie as string) || req.headers.cookie || "",
      });
      res.json(result.body);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 2. QR Login: Get Key
  app.get("/api/login/qr/key", async (req, res) => {
    try {
      const result = await NeteaseApi.login_qr_key({});
      res.json(result.body);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 3. QR Login: Create QR
  app.get("/api/login/qr/create", async (req, res) => {
    try {
      const result = await NeteaseApi.login_qr_create({
        key: req.query.key as string,
        qrimg: true,
      });
      res.json(result.body);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. QR Login: Check Status
  app.get("/api/login/qr/check", async (req, res) => {
    try {
      const result = await NeteaseApi.login_qr_check({
        key: req.query.key as string,
      });
      // The API returns the cookie in the body if successful
      res.json(result.body);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // 6. Create Playlist
  app.post("/api/playlist/create", async (req, res) => {
    try {
      const { name, cookie } = req.body;
      const result = await NeteaseApi.playlist_create({
        name,
        privacy: 0,
        cookie,
      });
      res.json(result.body);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 7. Add Tracks to Playlist
  app.post("/api/playlist/tracks", async (req, res) => {
    try {
      const { pid, ids, cookie } = req.body;
      const result = await NeteaseApi.playlist_tracks({
        op: 'add',
        pid,
        tracks: ids, // comma separated string
        cookie,
      });
      res.json(result.body);
    } catch (error: any) {
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
