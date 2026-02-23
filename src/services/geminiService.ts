import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Song {
  id: number;
  name: string;
  artists: string[];
  album: string;
}

export interface CategorizedSongs {
  category: string;
  songIds: number[];
  description: string;
}

export async function categorizeSongs(songs: Song[]): Promise<CategorizedSongs[]> {
  const songListText = songs.map(s => `${s.name} - ${s.artists.join(', ')}`).join('\n');

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `请分析以下歌曲列表，并将它们分类到不同的音乐风格或情绪类别中。
每个类别应包含类别名称、该类别下的歌曲索引（从0开始）以及简短的类别描述。
尽量细分，但不要产生太多只有一个歌曲的类别。

歌曲列表：
${songListText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "类别名称，如 '摇滚', '治愈系', '电子' 等" },
            songIds: { 
              type: Type.ARRAY, 
              items: { type: Type.INTEGER },
              description: "属于该类别的歌曲在原始列表中的索引" 
            },
            description: { type: Type.STRING, description: "对该类别的简短描述" }
          },
          required: ["category", "songIds", "description"]
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "[]");
    // Map indices back to actual IDs
    return data.map((item: any) => ({
      ...item,
      songIds: item.songIds.map((idx: number) => songs[idx]?.id).filter(Boolean)
    }));
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
