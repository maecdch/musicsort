import express from "express";
import { createRequire } from "module";

import NeteaseApi from "NeteaseCloudMusicApi";

const app = express();
app.use(express.json());
const PORT = 3000;

// Default China IP to bypass regional restrictions
const DEFAULT_CHINA_IP = "116.25.146.177";

// Helper to get API config with realIP
const getApiConfig = (req: express.Request, extra: any = {}) => {
  const cookie = (req.query.cookie as string) || (req.body.cookie as string) || req.headers.cookie || "";
  // Try to get user's real IP from headers, or use a default China IP
  const realIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || DEFAULT_CHINA_IP;
  
  return {
    cookie,
    realIP,
    ...extra
  };
};

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Helper: Retry Logic for Network Instability ---
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  throw lastError;
}

// --- NetEase API Proxy Routes ---

// 1. Get Playlist Details
app.get("/api/playlist/:id", async (req, res) => {
  console.log(`Fetching playlist: ${req.params.id}`);
  try {
    const result = await withRetry(() => NeteaseApi.playlist_detail(getApiConfig(req, {
      id: req.params.id,
    })));
    res.json(result.body);
  } catch (error: any) {
    console.error(`Playlist fetch error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 1.1 Get All Tracks in a Playlist
app.get("/api/playlist/tracks/all", async (req, res) => {
  console.log(`Fetching all tracks for playlist: ${req.query.id}`);
  try {
    const result = await withRetry(() => NeteaseApi.playlist_track_all(getApiConfig(req, {
      id: req.query.id as string,
      limit: 500,
      offset: 0,
    })));
    res.json(result.body);
  } catch (error: any) {
    console.error(`Playlist tracks all error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 2. QR Login: Get Key
app.get("/api/login/qr/key", async (req, res) => {
  console.log("Getting QR key...");
  try {
    const result = await withRetry(() => NeteaseApi.login_qr_key(getApiConfig(req, {
      timestamp: Date.now(),
    })));
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
    const result = await withRetry(() => NeteaseApi.login_qr_create(getApiConfig(req, {
      key: req.query.key as string,
      qrimg: true,
      timestamp: Date.now(),
    })));
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
    const result = await withRetry(() => NeteaseApi.login_qr_check(getApiConfig(req, {
      key: req.query.key as string,
      timestamp: Date.now(),
    })));
    if (result.body.code === 803) {
      console.log("QR Login Success!");
    }
    res.json(result.body);
  } catch (error: any) {
    console.error(`QR check error: ${error.message}`, error);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

// 4.1 Cellphone Login
app.post("/api/login/cellphone", async (req, res) => {
  console.log(`Attempting cellphone login for: ${req.body.phone}`);
  try {
    const { phone, password, countrycode } = req.body;
    const result = await withRetry(() => NeteaseApi.login_cellphone(getApiConfig(req, {
      phone,
      password,
      countrycode: countrycode || '86',
    })));
    res.json(result.body);
  } catch (error: any) {
    console.error(`Cellphone login error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 4.2 Login Status
app.get("/api/login/status", async (req, res) => {
  try {
    const result = await withRetry(() => NeteaseApi.login_status(getApiConfig(req)));
    res.json(result.body);
  } catch (error: any) {
    console.error(`Login status error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get User Info (to verify login)
app.get("/api/user/account", async (req, res) => {
  try {
    const result = await withRetry(() => NeteaseApi.user_account(getApiConfig(req)));
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
    const { name } = req.body;
    const result = await withRetry(() => NeteaseApi.playlist_create(getApiConfig(req, {
      name,
      privacy: 0,
    })));
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
    const { pid, ids } = req.body;
    const result = await withRetry(() => NeteaseApi.playlist_tracks(getApiConfig(req, {
      op: 'add',
      pid,
      tracks: ids, // comma separated string
    })));
    console.log("Tracks added:", result.body);
    res.json(result.body);
  } catch (error: any) {
    console.error(`Playlist tracks error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 8. AI Categorization (DeepSeek)
app.post("/api/ai/persona", async (req, res) => {
  try {
    const { songs } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in environment variables." });
    }

    // Take a random sample of up to 50 songs to generate the persona
    const sampleSize = Math.min(50, songs.length);
    const shuffled = [...songs].sort(() => 0.5 - Math.random());
    const sampleSongs = shuffled.slice(0, sampleSize);
    const songListText = sampleSongs.map((s: any) => `${s.name} - ${s.artists.join(', ')}`).join('\n');

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
            content: `你是一个世界顶级的音乐心理分析师。请根据用户提供的歌单样本，为这个歌单生成一个极具个性化的“音乐人设”（Musical Persona）。
返回一个纯净的 JSON 对象，包含：
- 'title' (人设标题，例如："赛博朋克漫游者"、"深夜emo收割机"、"日落大道驾驶员"，限10字以内)
- 'description' (一段关于这个歌单整体氛围、听歌人性格或情绪状态的优美描述，50字左右，要像网易云年度报告一样走心)
- 'tags' (3个描述该歌单核心情绪或风格的标签，例如：["迷幻", "失眠", "电子"])`
          },
          {
            role: "user",
            content: `歌单样本：\n${songListText}`
          }
        ],
        response_format: {
          type: "json_object"
        },
        max_tokens: 500
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "DeepSeek API Error");

    const content = data.choices[0].message.content;
    const cleanedContent = content.replace(/```json\n?|```/g, '').trim();
    const result = JSON.parse(cleanedContent);
    res.json(result);
  } catch (error: any) {
    console.error(`AI Persona error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 9. AI Categorization (DeepSeek)
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
            content: `你是一个世界顶级的音乐策展人（Music Curator）和情感分析大师。
请分析用户提供的歌曲列表，并将它们分类到极具画面感、情绪化或场景化的美学类别中（例如："凌晨三点的城市环线"、"赛博朋克漫游者"、"日落大道微醺"、"燃向踩点/肾上腺素"）。
不要使用干瘪的流派名词（如"流行"、"摇滚"）。

要求：
1. 必须确保列表中的每一首歌都被分配到至少一个类别中。
2. 每个类别的 'songIds' 数组中的歌曲，请按照**情绪递进**（例如从平静到高潮）的顺序进行排列。
3. 返回一个纯净的 JSON 对象，包含一个名为 'categories' 的数组。
4. 数组中的每个对象必须包含：
   - 'category' (极具美感的类别名称，限15字以内)
   - 'songIds' (属于该类别的歌曲在原始列表中的索引数组，从0开始，按情绪排序)
   - 'description' (一段关于该分类场景或情绪的优美描述，30字左右)

不要遗漏任何歌曲，不要包含任何额外的文字说明。`
          },
          {
            role: "user",
            content: `歌曲列表：\n${songListText}`
          }
        ],
        response_format: {
          type: "json_object"
        },
        max_tokens: 2048
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "DeepSeek API Error");
    }

    const content = data.choices[0].message.content;
    let result;
    try {
      // 1. Try direct parse after basic cleaning
      const cleanedContent = content.replace(/```json\n?|```/g, '').trim();
      try {
        result = JSON.parse(cleanedContent);
      } catch (innerError) {
        // 2. Try to extract JSON using regex if direct parse fails
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw innerError;
        }
      }
    } catch (e) {
      console.error("Failed to parse DeepSeek JSON content:", content);
      // Provide a bit more info in the error message for debugging
      const snippet = content.length > 50 ? content.slice(0, 50) + "..." : content;
      throw new Error(`AI 返回了无效的格式 (${snippet})。请尝试减少歌单歌曲数量或稍后再试。`);
    }

    // Normalize result: ensure we return an array
    let categories = [];
    if (Array.isArray(result)) {
      categories = result;
    } else if (result.categories && Array.isArray(result.categories)) {
      categories = result.categories;
    } else if (result.items && Array.isArray(result.items)) {
      categories = result.items;
    } else {
      // If it's an object but not in the expected format, try to find any array property
      const arrayProp = Object.values(result).find(val => Array.isArray(val));
      categories = arrayProp || [];
    }

    res.json(categories);
  } catch (error: any) {
    console.error(`AI categorization error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development (only if not in production/Vercel)
async function setupVite() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    console.log("Initializing Vite middleware...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
    } catch (e) {
      console.error("Failed to initialize Vite middleware:", e);
    }
  }
}

// Only start the server if this file is run directly (not as a serverless function)
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  setupVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server successfully started on http://0.0.0.0:${PORT}`);
    });
  });
} else {
  // In Vercel, we just export the app
  // No need to call setupVite() as it's only for dev middleware
}

export default app;

