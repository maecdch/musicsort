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
  try {
    const response = await fetch('/api/ai/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'AI 分类请求失败');
    }

    const data = await response.json();
    
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
