/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Music, 
  ListMusic, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  QrCode,
  LogOut,
  ExternalLink,
  Plus,
  ArrowRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { categorizeSongs, Song, CategorizedSongs } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [playlistData, setPlaylistData] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [categories, setCategories] = useState<CategorizedSongs[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Login State
  const [cookie, setCookie] = useState<string | null>(localStorage.getItem('netease_cookie'));
  const [user, setUser] = useState<any>(null);
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<number>(0); // 800: expired, 801: waiting, 802: confirming, 803: success
  const qrCheckTimer = useRef<any>(null);

  useEffect(() => {
    if (cookie) {
      fetchUserAccount(cookie);
    }
    return () => {
      if (qrCheckTimer.current) clearInterval(qrCheckTimer.current);
    };
  }, [cookie]);

  const fetchUserAccount = async (ck: string) => {
    try {
      const res = await fetch(`/api/user/account?cookie=${encodeURIComponent(ck)}`);
      const data = await res.json();
      if (data.profile) {
        setUser(data.profile);
      } else if (data.code === 401 || data.code === -1) {
        // Only clear if explicitly unauthorized
        setCookie(null);
        localStorage.removeItem('netease_cookie');
      }
    } catch (e) {
      console.error('Fetch user account error:', e);
    }
  };

  const startQrLogin = async () => {
    setLoginLoading(true);
    setError(null);
    try {
      const keyRes = await fetch('/api/login/qr/key');
      const keyData = await keyRes.json();
      
      if (keyRes.status !== 200) {
        throw new Error(keyData.error || '获取登录 Key 失败');
      }
      
      if (keyData.code && keyData.code !== 200) {
        throw new Error(keyData.message || `获取 Key 失败 (代码 ${keyData.code})`);
      }
      
      if (!keyData.data?.unikey) {
        throw new Error(keyData.message || '获取登录 Key 失败: API 未返回 unikey');
      }
      
      const unikey = keyData.data.unikey;
      setQrKey(unikey);

      const qrRes = await fetch(`/api/login/qr/create?key=${unikey}`);
      const qrData = await qrRes.json();
      
      if (qrRes.status !== 200) {
        throw new Error(qrData.error || '生成二维码失败');
      }

      if (qrData.code && qrData.code !== 200) {
        throw new Error(qrData.message || `生成二维码失败 (代码 ${qrData.code})`);
      }
      
      const qrUrlValue = qrData.data?.url || qrData.data?.qrurl;
      if (!qrUrlValue) {
        throw new Error(qrData.message || `生成二维码失败: API 未返回 URL (Data: ${JSON.stringify(qrData.data)})`);
      }
      
      setQrUrl(qrUrlValue);
      setQrStatus(801);

      if (qrCheckTimer.current) clearInterval(qrCheckTimer.current);
      qrCheckTimer.current = setInterval(() => checkQrStatus(unikey), 3000);
    } catch (e: any) {
      console.error('QR Login Start Error:', e);
      setError(`登录失败: ${e.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const checkQrStatus = async (key: string) => {
    try {
      const res = await fetch(`/api/login/qr/check?key=${key}`);
      const data = await res.json();
      setQrStatus(data.code);
      if (data.code === 803) {
        clearInterval(qrCheckTimer.current);
        setCookie(data.cookie);
        localStorage.setItem('netease_cookie', data.cookie);
        setQrUrl(null);
        setQrKey(null);
        fetchUserAccount(data.cookie);
      } else if (data.code === 800) {
        clearInterval(qrCheckTimer.current);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    setCookie(null);
    setUser(null);
    localStorage.removeItem('netease_cookie');
  };

  const fetchPlaylist = async () => {
    if (!playlistUrl) return;
    setLoading(true);
    setError(null);
    setCategories([]);
    
    try {
      const idMatch = playlistUrl.match(/[?&]id=(\d+)/);
      let id = idMatch ? idMatch[1] : playlistUrl.split('/').pop();
      
      // Handle cases where the ID might be at the end of a path like .../playlist/12345
      if (id && id.includes('?')) id = id.split('?')[0];

      if (!id || !/^\d+$/.test(id)) {
        throw new Error('无效的歌单链接或 ID。请确保链接中包含 id=数字');
      }

      const res = await fetch(`/api/playlist/${id}?cookie=${encodeURIComponent(cookie || '')}`);
      const data = await res.json();
      
      if (data.playlist) {
        setPlaylistData(data.playlist);
        const trackIds = data.playlist.trackIds.slice(0, 50).map((t: any) => t.id); // Limit to 50 for AI analysis speed
        
        const songList: Song[] = data.playlist.tracks.slice(0, 50).map((t: any) => ({
          id: t.id,
          name: t.name,
          artists: t.ar.map((a: any) => a.name),
          album: t.al.name
        }));
        
        setSongs(songList);
        
        // Start AI Categorization
        const categorized = await categorizeSongs(songList);
        setCategories(categorized);
      } else {
        throw new Error(data.error || '歌单不存在或无法访问');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCategory = async (cat: CategorizedSongs) => {
    if (!cookie) {
      setError('请先登录网易云音乐');
      return;
    }

    if (!playlistData) {
      setError('请先加载歌单数据');
      return;
    }

    if (cat.songIds.length === 0) {
      setError('该类别下没有有效的歌曲 ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // 1. Create Playlist
      // NetEase playlist names have a limit, usually around 40 characters.
      // We'll be more conservative to avoid "title length anomaly" errors.
      let playlistName = `${playlistData.name} - ${cat.category}`;
      if (playlistName.length > 35) {
        playlistName = `${cat.category} (${playlistData.name.slice(0, 20)}...)`;
      }
      // Final safety slice
      playlistName = playlistName.slice(0, 35);

      const createRes = await fetch('/api/playlist/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistName, cookie: cookie.trim() })
      });
      const createData = await createRes.json();
      
      if (createData.id || createData.playlist?.id) {
        const newPlaylistId = createData.id || createData.playlist?.id;
        // 2. Add Tracks
        const addRes = await fetch('/api/playlist/tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            pid: newPlaylistId, 
            ids: cat.songIds.join(','), 
            cookie: cookie.trim() 
          })
        });
        const addData = await addRes.json();
        if (addData.code === 200 || addData.status === 200) {
          alert(`成功创建并导出歌单: ${cat.category}`);
        } else {
          throw new Error(addData.message || '添加歌曲失败，请检查是否已达到歌单歌曲上限或网络问题');
        }
      } else {
        throw new Error(createData.message || '创建歌单失败，请检查登录状态或网络问题');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-zinc-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-200">
              <Filter size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MusicSorter</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">AI 歌单智能分类</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-zinc-100 pl-1 pr-3 py-1 rounded-full border border-zinc-200">
                <img src={user.avatarUrl} alt={user.nickname} className="w-8 h-8 rounded-full" />
                <span className="text-sm font-medium">{user.nickname}</span>
                <button onClick={handleLogout} className="p-1 hover:text-red-500 transition-colors">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={startQrLogin}
                disabled={loginLoading}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
              >
                {loginLoading ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}
                登录网易云
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-12">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4"
          >
            整理你的音乐世界
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 text-base md:text-lg max-w-xl mx-auto"
          >
            粘贴网易云歌单链接，让 DeepSeek AI 为你自动分类歌曲风格，并一键导出。
          </motion.p>
        </section>

        {/* Search Input */}
        <div className="flex flex-col md:relative group mb-12 gap-3 md:gap-0">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-red-500 transition-colors">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              placeholder="粘贴歌单链接..."
              className="w-full pl-14 pr-6 md:pr-32 py-4 md:py-5 bg-white border-2 border-zinc-100 rounded-2xl shadow-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-base md:text-lg"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPlaylist()}
            />
          </div>
          <button 
            onClick={fetchPlaylist}
            disabled={loading || !playlistUrl}
            className="md:absolute md:right-3 md:top-3 md:bottom-3 px-6 py-4 md:py-0 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:bg-zinc-200 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : '开始分析'}
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600"
          >
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {/* QR Login Modal */}
        <AnimatePresence>
          {qrUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
              >
                <h3 className="text-xl font-bold mb-2">扫码登录</h3>
                <p className="text-zinc-500 text-sm mb-6">请使用网易云音乐 App 扫描下方二维码</p>
                
                <div className="relative inline-block p-4 bg-zinc-50 rounded-2xl border border-zinc-100 mb-6">
                  <QRCodeSVG value={qrUrl} size={200} />
                  {qrStatus === 800 && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                      <p className="text-sm font-bold text-red-500 mb-2">二维码已过期</p>
                      <button onClick={startQrLogin} className="text-xs text-zinc-900 underline">点击刷新</button>
                    </div>
                  )}
                  {qrStatus === 802 && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                      <CheckCircle2 className="text-green-500 mb-2" size={32} />
                      <p className="text-sm font-bold">扫描成功</p>
                      <p className="text-xs text-zinc-500">请在手机上确认登录</p>
                    </div>
                  )}
                </div>

                <div className="mb-6 space-y-4">
                  <div>
                    {qrStatus === 801 && <p className="text-xs text-zinc-400 italic">等待扫码...</p>}
                    {qrStatus === 802 && <p className="text-xs text-blue-500 font-medium">已扫码，请确认</p>}
                    {qrStatus === 803 && <p className="text-xs text-green-500 font-medium">登录成功！正在跳转...</p>}
                  </div>

                  {/* Mobile Deep Link */}
                  <div className="block md:hidden">
                    <a 
                      href={`orpheus://openurl?url=${encodeURIComponent(qrUrl)}`}
                      className="inline-block px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      在网易云音乐 App 中打开
                    </a>
                    <p className="text-[10px] text-zinc-400 mt-2">点击上方按钮可直接跳转 App 确认</p>
                  </div>
                </div>

                <button 
                  onClick={() => setQrUrl(null)}
                  className="w-full py-3 text-zinc-500 text-sm font-medium hover:text-zinc-900 transition-colors"
                >
                  取消登录
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="space-y-12">
          {playlistData && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col md:flex-row gap-8 items-start"
            >
              <img 
                src={playlistData.coverImgUrl} 
                alt={playlistData.name} 
                className="w-48 h-48 rounded-3xl shadow-xl object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase tracking-wider">Playlist</span>
                  <span className="text-zinc-400 text-sm">•</span>
                  <span className="text-zinc-500 text-sm">{playlistData.trackCount} 首歌</span>
                </div>
                <h3 className="text-3xl font-bold mb-4">{playlistData.name}</h3>
                <p className="text-zinc-500 text-sm line-clamp-2 mb-6">{playlistData.description}</p>
                
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {playlistData.subscribers.slice(0, 5).map((sub: any) => (
                      <img key={sub.userId} src={sub.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white" />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">等 {playlistData.subscribedCount} 人收藏</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat, idx) => (
              <motion.div 
                key={cat.category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="glass-card rounded-3xl p-6 flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-zinc-900">{cat.category}</h4>
                    <p className="text-sm text-zinc-500 mt-1">{cat.description}</p>
                  </div>
                  <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold">
                    {cat.songIds.length} 首
                  </span>
                </div>

                <div className="flex-1 space-y-3 mb-6">
                  {cat.songIds.slice(0, 3).map(songId => {
                    const song = songs.find(s => s.id === songId);
                    return song ? (
                      <div key={song.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400">
                          <Music size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{song.name}</p>
                          <p className="text-xs text-zinc-400 truncate">{song.artists.join(', ')}</p>
                        </div>
                      </div>
                    ) : null;
                  })}
                  {cat.songIds.length > 3 && (
                    <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest pl-11">
                      + {cat.songIds.length - 3} 更多歌曲
                    </p>
                  )}
                </div>

                <button 
                  onClick={() => exportCategory(cat)}
                  className="w-full py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group"
                >
                  导出到网易云
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ))}

            {loading && categories.length === 0 && songs.length > 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-400">
                <Loader2 className="animate-spin mb-4" size={40} />
                <p className="text-lg font-medium">DeepSeek AI 正在深度分析中...</p>
                <p className="text-sm">这可能需要几秒钟时间</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-zinc-100 py-12 text-center">
        <p className="text-zinc-400 text-sm">© 2026 MusicSorter • Designed by maec • Powered by DeepSeek AI & NetEase API</p>
      </footer>
    </div>
  );
}
