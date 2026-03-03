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

export interface PlaylistPersona {
  title: string;
  description: string;
  tags: string[];
}

export async function generatePersona(songs: Song[]): Promise<PlaylistPersona> {
  try {
    const response = await fetch('/api/ai/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs })
    });

    if (!response.ok) {
      throw new Error('AI 人设生成失败');
    }

    return await response.json();
  } catch (e: any) {
    console.error("AI persona generation failed", e);
    throw e;
  }
}

export async function categorizeSongs(songs: Song[]): Promise<CategorizedSongs[]> {
  try {
    const response = await fetch('/api/ai/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs })
    });

    if (!response.ok) {
      let errorMsg = 'AI 分类请求失败';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        const text = await response.text();
        errorMsg = `服务器返回错误 (${response.status}): ${text.slice(0, 50)}...`;
      }
      throw new Error(errorMsg);
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      throw new Error(`AI 返回了非 JSON 数据: ${text.slice(0, 50)}...`);
    }
    
    // Map indices back to actual IDs
    return data.map((item: any) => ({
      ...item,
      songIds: item.songIds.map((idx: number) => songs[idx]?.id).filter(Boolean)
    }));
  } catch (e: any) {
    console.error("AI categorization failed", e);
    throw e;
  }
}
