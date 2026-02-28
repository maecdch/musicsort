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
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  // Login State
  const [cookie, setCookie] = useState<string | null>(localStorage.getItem('netease_cookie'));
  const [user, setUser] = useState<any>(null);
  const [qrKey, setQrKey] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<number>(0); // 800: expired, 801: waiting, 802: confirming, 803: success
  const qrCheckTimer = useRef<any>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (categories.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [categories]);

  useEffect(() => {
    if (cookie) {
      fetchUserAccount(cookie);
    }
    return () => {
      if (qrCheckTimer.current) clearInterval(qrCheckTimer.current);
    };
  }, [cookie]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUserAccount = async (ck: string) => {
    try {
      const res = await fetch(`/api/user/account?cookie=${encodeURIComponent(ck)}`);
      const text = await res.text();
      
      if (!res.ok) {
        console.warn(`User account fetch failed (${res.status}):`, text.slice(0, 100));
        return;
      }
      
      try {
        const data = JSON.parse(text);
        if (data.profile) {
          setUser(data.profile);
        } else if (data.code === 401 || data.code === -1) {
          setCookie(null);
          localStorage.removeItem('netease_cookie');
        }
      } catch (e) {
        console.error('Failed to parse user account JSON:', text.slice(0, 100));
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
      
      if (!keyRes.ok) {
        const text = await keyRes.text();
        throw new Error(`获取 Key 失败 (${keyRes.status}): ${text.slice(0, 50)}...`);
      }

      let keyData;
      try {
        keyData = await keyRes.json();
      } catch (e) {
        const text = await keyRes.text();
        throw new Error(`获取 Key 返回了非 JSON 数据: ${text.slice(0, 50)}...`);
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
      
      if (!qrRes.ok) {
        const text = await qrRes.text();
        throw new Error(`生成二维码失败 (${qrRes.status}): ${text.slice(0, 50)}...`);
      }

      let qrData;
      try {
        qrData = await qrRes.json();
      } catch (e) {
        const text = await qrRes.text();
        throw new Error(`生成二维码返回了非 JSON 数据: ${text.slice(0, 50)}...`);
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
      if (!res.ok) return;
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        return;
      }
      
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
      const text = await res.text();
      
      if (!res.ok) {
        throw new Error(`服务器返回错误 (${res.status}): ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('JSON Parse Error. Response text:', text);
        throw new Error(`数据解析失败。服务器返回了非 JSON 格式的内容。内容摘要: ${text.slice(0, 50)}...`);
      }
      
      if (data.playlist) {
        setPlaylistData(data.playlist);
        const trackIds = data.playlist.trackIds.slice(0, 30).map((t: any) => t.id); // Limit to 30 for AI stability
        
        const songList: Song[] = data.playlist.tracks.slice(0, 30).map((t: any) => ({
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
      
      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`创建歌单失败 (${createRes.status}): ${text.slice(0, 50)}...`);
      }

      let createData;
      try {
        createData = await createRes.json();
      } catch (e) {
        const text = await createRes.text();
        throw new Error(`创建歌单返回了非 JSON 数据: ${text.slice(0, 50)}...`);
      }
      
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
        
        if (!addRes.ok) {
          const text = await addRes.text();
          throw new Error(`添加歌曲失败 (${addRes.status}): ${text.slice(0, 50)}...`);
        }

        let addData;
        try {
          addData = await addRes.json();
        } catch (e) {
          const text = await addRes.text();
          throw new Error(`添加歌曲返回了非 JSON 数据: ${text.slice(0, 50)}...`);
        }
        
        if (addData.code === 200 || addData.status === 200) {
          showToast(`成功创建并导出歌单: ${cat.category}`);
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
    <div className="min-h-screen pb-20 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-10 left-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'success' ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-red-500/90 border-red-400 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Background */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-red-50/50 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-zinc-200/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-zinc-200">
              <Filter size={20} />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">MusicSorter</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">AI Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-white/50 backdrop-blur-sm pl-1 pr-3 py-1 rounded-full border border-zinc-200/50 shadow-sm">
                <img src={user.avatarUrl} alt={user.nickname} className="w-8 h-8 rounded-full border border-white" />
                <span className="text-sm font-medium text-zinc-700">{user.nickname}</span>
                <button onClick={handleLogout} className="p-1 text-zinc-400 hover:text-red-500 transition-colors">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button 
                onClick={startQrLogin}
                disabled={loginLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-zinc-200"
              >
                {loginLoading ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}
                登录网易云
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-20 relative z-10">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 border border-red-100"
          >
            Smart Playlist Organizer
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-display font-bold text-zinc-900 mb-6 tracking-tight"
          >
            整理你的 <span className="text-red-500">音乐</span> 世界
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 text-base md:text-xl max-w-2xl mx-auto leading-relaxed"
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
              placeholder="粘贴网易云歌单链接..."
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
                className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-zinc-100"
              >
                <h3 className="text-xl font-display font-bold mb-2 text-zinc-900">扫码登录</h3>
                <p className="text-zinc-500 text-sm mb-8">请使用网易云音乐 App 扫描下方二维码</p>
                
                <div className="relative inline-block p-4 bg-zinc-50 rounded-2xl border border-zinc-100 mb-8">
                  <QRCodeSVG value={qrUrl} size={180} />
                  
                  {qrStatus === 800 && (
                    <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                      <p className="text-sm font-bold text-red-500 mb-3">二维码已过期</p>
                      <button 
                        onClick={startQrLogin} 
                        className="px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-bold hover:bg-zinc-800 transition-all"
                      >
                        点击刷新
                      </button>
                    </div>
                  )}
                  {qrStatus === 802 && (
                    <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                      <CheckCircle2 className="text-green-500 mb-2" size={32} />
                      <p className="text-sm font-bold text-zinc-900">扫描成功</p>
                      <p className="text-xs text-zinc-500 mt-1">请在手机上确认登录</p>
                    </div>
                  )}
                </div>

                <div className="mb-8 space-y-4">
                  <div className="h-6 flex items-center justify-center">
                    {qrStatus === 801 && <p className="text-xs text-zinc-400 italic">等待扫码...</p>}
                    {qrStatus === 802 && <p className="text-xs text-blue-500 font-bold">已扫码，请确认</p>}
                    {qrStatus === 803 && <p className="text-xs text-green-500 font-bold">登录成功</p>}
                  </div>

                  {/* Mobile Deep Link */}
                  <div className="block md:hidden">
                    <a 
                      href={`orpheus://openurl?url=${encodeURIComponent(qrUrl)}`}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                    >
                      <ExternalLink size={14} />
                      在 App 中打开
                    </a>
                  </div>
                </div>

                <button 
                  onClick={() => setQrUrl(null)}
                  className="w-full py-3 text-zinc-400 text-sm font-medium hover:text-zinc-900 transition-colors"
                >
                  取消登录
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div ref={resultsRef} className="space-y-12 pt-10">
          {!playlistData && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 flex flex-col items-center justify-center text-center"
            >
              <div className="w-20 h-20 bg-zinc-100 rounded-[2rem] flex items-center justify-center text-zinc-300 mb-6">
                <ListMusic size={40} />
              </div>
              <h3 className="text-xl font-display font-bold text-zinc-900 mb-2">准备好整理了吗？</h3>
              <p className="text-zinc-400 text-sm max-w-xs mx-auto">粘贴歌单链接并点击“开始分析”，DeepSeek AI 将为您智能分类。</p>
            </motion.div>
          )}

          {playlistData && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-zinc-100 shadow-xl flex flex-col md:flex-row gap-8 items-center md:items-start"
            >
              <div className="relative group">
                <img 
                  src={playlistData.coverImgUrl} 
                  alt={playlistData.name} 
                  className="w-48 h-48 rounded-3xl shadow-xl object-cover flex-shrink-0 relative z-10 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute -inset-4 bg-red-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <span className="px-3 py-1 bg-zinc-900 text-white text-[10px] font-bold rounded-full uppercase tracking-widest">Original Playlist</span>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-500 text-sm font-medium">{playlistData.trackCount} 首歌</span>
                </div>
                <h3 className="text-3xl font-display font-bold mb-4 tracking-tight">{playlistData.name}</h3>
                <p className="text-zinc-500 text-sm md:text-base line-clamp-2 mb-8 max-w-xl">{playlistData.description}</p>
                
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <div className="flex -space-x-3">
                    {playlistData.subscribers.slice(0, 5).map((sub: any) => (
                      <img key={sub.userId} src={sub.avatarUrl} className="w-10 h-10 rounded-full border-4 border-white shadow-sm" />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    {playlistData.subscribedCount.toLocaleString()} 位收藏者
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((cat, idx) => (
              <motion.div 
                key={cat.category}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-[2rem] p-8 flex flex-col h-full border border-zinc-100 hover:border-zinc-300 transition-all duration-300 group hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="max-w-[70%]">
                    <h4 className="text-2xl font-display font-bold text-zinc-900 mb-2 group-hover:text-red-500 transition-colors">{cat.category}</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">{cat.description}</p>
                  </div>
                  <div className="px-4 py-2 bg-zinc-50 text-zinc-900 rounded-2xl text-xs font-black border border-zinc-100">
                    {cat.songIds.length}
                  </div>
                </div>

                <div className="flex-1 space-y-4 mb-10">
                  {cat.songIds.slice(0, 3).map(songId => {
                    const song = songs.find(s => s.id === songId);
                    return song ? (
                      <div key={song.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-all duration-300 group/song">
                        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 group-hover/song:bg-white group-hover/song:shadow-md group-hover/song:text-red-500 transition-all">
                          <Music size={16} className="group-hover/song:scale-110 transition-transform" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate text-zinc-800 group-hover/song:text-zinc-900 transition-colors">{song.name}</p>
                          <p className="text-[10px] text-zinc-400 font-medium truncate uppercase tracking-wider">{song.artists.join(', ')}</p>
                        </div>
                        <div className="opacity-0 group-hover/song:opacity-100 transition-opacity">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-white">
                            <Plus size={12} />
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })}
                  {cat.songIds.length > 3 && (
                    <div className="flex items-center gap-2 pl-4">
                      <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                      <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-[0.2em]">
                        + {cat.songIds.length - 3} More Tracks
                      </p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => exportCategory(cat)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 group/btn shadow-lg shadow-zinc-100"
                >
                  导出到网易云
                  <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ))}

            {loading && categories.length === 0 && songs.length > 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center">
                <div className="relative mb-8">
                  <div className="w-24 h-24 border-4 border-zinc-100 border-t-red-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="text-red-500 animate-pulse" size={32} />
                  </div>
                </div>
                <h3 className="text-2xl font-display font-bold text-zinc-900 mb-2">DeepSeek AI 正在深度分析中</h3>
                <p className="text-zinc-400 text-sm animate-pulse">正在识别曲风、情绪与节奏...</p>
                
                {/* Skeleton Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-16 opacity-40">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-[2rem] p-8 border border-zinc-100 h-64 animate-pulse">
                      <div className="flex justify-between mb-8">
                        <div className="space-y-2">
                          <div className="h-6 w-32 bg-zinc-100 rounded-lg" />
                          <div className="h-4 w-48 bg-zinc-50 rounded-lg" />
                        </div>
                        <div className="h-10 w-10 bg-zinc-100 rounded-xl" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-12 w-full bg-zinc-50 rounded-2xl" />
                        <div className="h-12 w-full bg-zinc-50 rounded-2xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-zinc-100 py-12 text-center">
        <p className="text-zinc-400 text-sm">© 2026 MusicSorter • Designed by mayicheng • Powered by DeepSeek AI & NetEase API</p>
      </footer>
    </div>
  );
}
