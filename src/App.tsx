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
  Filter,
  Phone,
  Lock,
  Key,
  HelpCircle,
  X,
  Copy,
  Download,
  Sparkles,
  PlayCircle
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
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'qr' | 'phone' | 'cookie'>('qr');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [manualCookie, setManualCookie] = useState('');
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
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
          setShowLoginModal(false);
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

  useEffect(() => {
    if (showLoginModal && loginMethod === 'qr' && !qrUrl) {
      startQrLogin();
    }
  }, [showLoginModal, loginMethod]);

  const startQrLogin = async () => {
    setQrUrl(null);
    setQrStatus(801);
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

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;
    setLoginLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login/cellphone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (data.code === 200) {
        setCookie(data.cookie);
        localStorage.setItem('netease_cookie', data.cookie);
        fetchUserAccount(data.cookie);
        setShowLoginModal(false);
      } else {
        throw new Error(data.message || '登录失败');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCookieLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCookie) return;
    setCookie(manualCookie);
    localStorage.setItem('netease_cookie', manualCookie);
    fetchUserAccount(manualCookie);
    setManualCookie('');
    setShowLoginModal(false);
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
        
        // Fetch more tracks if needed
        let allTracks = (data.playlist.tracks && data.playlist.tracks.length > 0) ? data.playlist.tracks : [];
        if (allTracks.length < 500) {
          try {
            const tracksRes = await fetch(`/api/playlist/tracks/all?id=${id}&cookie=${encodeURIComponent(cookie || '')}`);
            if (tracksRes.ok) {
              const tracksData = await tracksRes.json();
              if (tracksData.songs && tracksData.songs.length > allTracks.length) {
                allTracks = tracksData.songs;
              }
            }
          } catch (e) {
            console.warn("Failed to fetch all tracks, falling back to basic playlist tracks", e);
          }
        }

        // Limit to 500 songs for a more comprehensive analysis
        const songList: Song[] = allTracks.slice(0, 500).map((t: any) => ({
          id: t.id,
          name: t.name,
          artists: t.ar.map((a: any) => a.name),
          album: t.al.name
        }));
        
        setSongs(songList);
        
        // Batch processing: 50 songs per batch
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < songList.length; i += BATCH_SIZE) {
          batches.push(songList.slice(i, i + BATCH_SIZE));
        }

        const mergedCategories: CategorizedSongs[] = [];
        setProgress({ current: 0, total: batches.length });

        for (let i = 0; i < batches.length; i++) {
          try {
            // Update loading state with progress
            setLoading(true); // Ensure loading is true
            const batchResult = await categorizeSongs(batches[i]);
            
            // Merge results
            batchResult.forEach(newCat => {
              const existingCat = mergedCategories.find(c => 
                c.category.toLowerCase() === newCat.category.toLowerCase() ||
                newCat.category.toLowerCase().includes(c.category.toLowerCase()) ||
                c.category.toLowerCase().includes(newCat.category.toLowerCase())
              );

              if (existingCat) {
                // Merge song IDs, avoiding duplicates
                const uniqueIds = new Set([...existingCat.songIds, ...newCat.songIds]);
                existingCat.songIds = Array.from(uniqueIds);
              } else {
                mergedCategories.push(newCat);
              }
            });

            // Update UI incrementally
            setCategories([...mergedCategories]);
            setProgress({ current: i + 1, total: batches.length });
          } catch (batchError) {
            console.error(`Error processing batch ${i}:`, batchError);
            // Continue with next batch if one fails
          }
        }
      } else {
        throw new Error(data.error || '歌单不存在或无法访问');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, message: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
      setShowImportGuide(true); // Show guide after copying
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      showToast('复制失败，请手动选择复制', 'error');
    });
  };

  const downloadAsFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`已开始下载: ${filename}`);
  };

  const exportCategory = async (cat: CategorizedSongs) => {
    if (!cookie) {
      setShowLoginModal(true);
      setToast({ message: '请先登录网易云音乐以直接导出歌单', type: 'error' });
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
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/30 selection:text-primary relative pb-20 overflow-x-hidden">
      {/* 音乐宇宙 (Music Universe) Background Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-tertiary/20 rounded-full blur-[150px] mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[30%] left-[40%] w-[40%] h-[40%] bg-secondary-fixed/10 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
        {/* Grid Pattern for Tech Feel */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-10 left-1/2 z-[200] px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border glass-panel",
              toast.type === 'success' ? "border-secondary-fixed/30 text-secondary-fixed" : "border-error/30 text-error"
            )}
          >
            {toast.type === 'success' ? <span className="material-symbols-outlined text-secondary-fixed">check_circle</span> : <span className="material-symbols-outlined text-error">error</span>}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] hero-gradient blur-[120px] rounded-full opacity-50" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary-fixed/10 blur-[120px] rounded-full opacity-30" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 glass-panel border-b border-outline-variant/30 z-40 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sonic-gradient-primary rounded-xl flex items-center justify-center sonic-pulse">
            <span className="material-symbols-outlined text-on-primary">graphic_eq</span>
          </div>
          <h1 className="text-xl font-headline font-bold tracking-tight text-on-surface">
            音流脉冲 <span className="text-primary font-light">Sonic Flux</span>
          </h1>
        </div>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-surface-container rounded-full border border-outline-variant/30">
                <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full shadow-sm" />
                <span className="text-sm font-medium text-on-surface hidden md:block">{user.nickname}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-outline hover:text-error hover:bg-error/10 rounded-full transition-colors"
                title="退出登录"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              disabled={loginLoading}
              className="px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-full hover:bg-primary-fixed transition-all shadow-md hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center gap-2"
            >
              {loginLoading ? <Loader2 className="animate-spin" size={16} /> : <span className="material-symbols-outlined text-[18px]">login</span>}
              登录网易云
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 pt-40 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
        {/* Input Section */}
        {!playlistData && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto mt-8 md:mt-16 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>AI 驱动的歌单整理助手</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-headline font-bold tracking-tight mb-6 leading-[1.1]">
              重塑你的<br />
              <span className="text-transparent bg-clip-text sonic-gradient-primary">
                音乐宇宙
              </span>
            </h2>
            <p className="text-lg text-on-surface-variant mb-12 max-w-xl mx-auto leading-relaxed">
              输入网易云歌单链接，AI 将根据情绪、场景和曲风，为你生成多维度的智能分类。
            </p>

            <div className="relative group max-w-2xl mx-auto">
              <div className="absolute -inset-1 sonic-gradient-primary rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
              <div className="relative glass-card p-2 rounded-[2rem] flex items-center">
                <div className="pl-6 pr-4 text-outline">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  type="text"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="在此粘贴网易云歌单链接..."
                  className="flex-1 bg-transparent border-none outline-none text-lg text-on-surface placeholder:text-outline py-4"
                  onKeyDown={(e) => e.key === 'Enter' && fetchPlaylist()}
                />
                <button
                  onClick={fetchPlaylist}
                  disabled={!playlistUrl.trim() || loading}
                  className="px-8 py-4 bg-primary text-on-primary rounded-[1.5rem] font-bold hover:bg-primary-fixed transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
                >
                  开始分析
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 bg-error-container/20 border border-error/30 rounded-xl flex items-center gap-3 text-error"
          >
            <span className="material-symbols-outlined shrink-0">error</span>
            <p className="text-sm font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 hover:bg-error/20 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </motion.div>
        )}

        {/* Login Modal */}
        <AnimatePresence>
          {showLoginModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-card rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden sonic-glow"
              >
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="absolute top-6 right-6 p-2 text-outline hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-headline font-bold text-on-surface mb-2">连接网易云</h3>
                  <p className="text-on-surface-variant text-sm">选择最适合您的登录方式</p>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-surface-container-high rounded-xl mb-8">
                  <button 
                    onClick={() => setLoginMethod('qr')}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all",
                      loginMethod === 'qr' ? "bg-surface-container-highest text-on-surface shadow-sm" : "text-outline hover:text-on-surface-variant"
                    )}
                  >
                    扫码登录
                  </button>
                  <button 
                    onClick={() => setLoginMethod('phone')}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all",
                      loginMethod === 'phone' ? "bg-surface-container-highest text-on-surface shadow-sm" : "text-outline hover:text-on-surface-variant"
                    )}
                  >
                    手机登录
                  </button>
                  <button 
                    onClick={() => setLoginMethod('cookie')}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all",
                      loginMethod === 'cookie' ? "bg-surface-container-highest text-on-surface shadow-sm" : "text-outline hover:text-on-surface-variant"
                    )}
                  >
                    Cookie
                  </button>
                </div>

                {/* Content */}
                <div className="min-h-[280px] flex flex-col items-center justify-center">
                  {loginMethod === 'qr' && (
                    <div className="text-center w-full">
                      {qrUrl ? (
                        <div className="relative inline-block p-4 bg-white rounded-2xl mb-6 group">
                          <QRCodeSVG value={qrUrl} size={180} />
                          
                          {qrStatus === 800 && (
                            <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                              <p className="text-sm font-bold text-error mb-3">二维码已过期</p>
                              <button 
                                onClick={startQrLogin} 
                                className="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold hover:bg-primary-fixed transition-all"
                              >
                                点击刷新
                              </button>
                            </div>
                          )}
                          {qrStatus === 802 && (
                            <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                              <span className="material-symbols-outlined text-secondary-fixed mb-2 text-4xl">check_circle</span>
                              <p className="text-sm font-bold text-surface">扫描成功</p>
                              <p className="text-xs text-surface-variant mt-1">请在手机上确认登录</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-[212px] h-[212px] bg-surface-container-high rounded-2xl flex items-center justify-center mb-6 border border-outline-variant/30">
                          <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="h-6 flex items-center justify-center">
                          {qrStatus === 801 && <p className="text-sm text-outline">等待扫码...</p>}
                          {qrStatus === 802 && <p className="text-sm text-secondary-fixed font-medium">已扫码，请确认</p>}
                          {qrStatus === 803 && <p className="text-sm text-secondary-fixed font-medium">登录成功</p>}
                        </div>

                        <div className="flex flex-col gap-3">
                          <a 
                            href={`orpheus://openurl?url=${encodeURIComponent(qrUrl || '')}`}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary-fixed transition-all shadow-md"
                          >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            在网易云 App 中打开
                          </a>
                          <div className="p-3 bg-surface-container-high rounded-xl border border-outline-variant/30">
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                              <strong>QQ 登录提示：</strong> 请在网易云 App 中先绑定 QQ，然后使用 App 扫码即可同步登录。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {loginMethod === 'phone' && (
                    <form onSubmit={handlePhoneLogin} className="w-full space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-outline ml-1">手机号码</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[18px]">phone_iphone</span>
                          <input 
                            type="text" 
                            placeholder="请输入手机号"
                            className="w-full pl-12 pr-4 py-3.5 bg-surface-container-high border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-on-surface placeholder:text-outline"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-outline ml-1">登录密码</label>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[18px]">lock</span>
                          <input 
                            type="password" 
                            placeholder="请输入密码"
                            className="w-full pl-12 pr-4 py-3.5 bg-surface-container-high border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-on-surface placeholder:text-outline"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <button 
                        type="submit"
                        disabled={loginLoading || !phone || !password}
                        className="w-full py-4 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary-fixed transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                      >
                        {loginLoading ? <Loader2 className="animate-spin" size={18} /> : '立即登录'}
                      </button>
                      <p className="text-xs text-outline text-center">我们不会存储您的密码，仅用于获取登录凭证</p>
                    </form>
                  )}

                  {loginMethod === 'cookie' && (
                    <form onSubmit={handleCookieLogin} className="w-full space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-medium text-outline">MUSIC_U Cookie</label>
                          <a 
                            href="https://github.com/Binaryify/NeteaseCloudMusicApi/issues/1118#issuecomment-853144882" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">help</span>
                            如何获取？
                          </a>
                        </div>
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-4 top-4 text-outline text-[18px]">key</span>
                          <textarea 
                            placeholder="粘贴您的网易云 Cookie (MUSIC_U=...)"
                            className="w-full pl-12 pr-4 py-4 bg-surface-container-high border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm text-on-surface placeholder:text-outline min-h-[120px] resize-none"
                            value={manualCookie}
                            onChange={(e) => setManualCookie(e.target.value)}
                          />
                        </div>
                      </div>
                      <button 
                        type="submit"
                        disabled={!manualCookie}
                        className="w-full py-4 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary-fixed transition-all disabled:opacity-50 shadow-md"
                      >
                        导入凭证
                      </button>
                      <div className="p-4 bg-secondary-fixed/10 rounded-2xl border border-secondary-fixed/20">
                        <p className="text-[10px] text-secondary-fixed leading-relaxed">
                          <strong>最稳方案：</strong> 浏览器登录网易云后，在 F12 控制台输入 <code>document.cookie</code>，复制 <code>MUSIC_U</code> 这一段即可。这不经过登录握手，直接生效。
                        </p>
                      </div>
                    </form>
                  )}
                </div>

                {/* Stability Note & Diagnosis */}
                <div className="mt-8 pt-6 border-t border-outline-variant/30 space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-outline shrink-0 text-[16px]">info</span>
                    <div className="space-y-1">
                      <p className="text-[10px] text-outline leading-relaxed">
                        由于服务器部署在海外，登录请求可能会受到网络波动影响。
                      </p>
                      <p className="text-[10px] text-secondary-fixed font-medium leading-relaxed">
                        已开启 Real-IP 模拟优化，尝试绕过地域限制。
                      </p>
                      <p className="text-[10px] text-outline leading-relaxed">
                        如果多次尝试失败，强烈建议使用 <strong>Cookie 导入</strong>。
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const start = Date.now();
                      try {
                        const res = await fetch('/api/health');
                        const end = Date.now();
                        if (res.ok) {
                          setToast({ message: `连接成功！延迟: ${end - start}ms`, type: 'success' });
                        } else {
                          setToast({ message: '连接失败，请检查网络', type: 'error' });
                        }
                      } catch (e) {
                        setToast({ message: '无法连接到服务器', type: 'error' });
                      }
                    }}
                    className="w-full py-2 border border-outline-variant/30 rounded-xl text-[10px] font-medium text-outline hover:bg-surface-container-high transition-all"
                  >
                    测试服务器连接
                  </button>
                </div>
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
              <div className="w-20 h-20 bg-surface-container-high rounded-[2rem] flex items-center justify-center text-outline mb-6 sonic-glow">
                <span className="material-symbols-outlined text-[40px]">queue_music</span>
              </div>
              <h3 className="text-xl font-display font-bold text-on-surface mb-2">准备好整理了吗？</h3>
              <p className="text-outline text-sm max-w-xs mx-auto">粘贴歌单链接并点击“开始分析”，DeepSeek AI 将为您智能分类。</p>
            </motion.div>
          )}

          {playlistData && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-outline-variant/30 flex flex-col md:flex-row items-center gap-10"
            >
              <div className="relative group">
                <img 
                  src={playlistData.coverImgUrl} 
                  alt={playlistData.name} 
                  className="w-48 h-48 md:w-56 md:h-56 rounded-[2rem] shadow-2xl object-cover flex-shrink-0 relative z-10 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-secondary-fixed/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                   <div className="w-16 h-16 bg-surface-container/50 backdrop-blur-md rounded-full flex items-center justify-center text-on-surface shadow-lg">
                     <span className="material-symbols-outlined text-[32px] ml-1">play_circle</span>
                   </div>
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <span className="px-4 py-1.5 bg-primary/10 text-primary text-[11px] font-black rounded-full uppercase tracking-widest border border-primary/20">Original Playlist</span>
                  <span className="text-outline-variant">•</span>
                  <span className="text-outline text-sm font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">queue_music</span>
                    {playlistData.trackCount} 首歌
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-display font-black mb-4 tracking-tight text-on-surface">{playlistData.name}</h3>
                <p className="text-outline text-sm md:text-base line-clamp-2 mb-8 max-w-2xl leading-relaxed">{playlistData.description}</p>
                
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <div className="flex -space-x-3">
                    {playlistData.subscribers.slice(0, 5).map((sub: any) => (
                      <img key={sub.userId} src={sub.avatarUrl} className="w-10 h-10 rounded-full border-2 border-surface shadow-sm" />
                    ))}
                  </div>
                  <span className="text-xs text-outline font-bold uppercase tracking-wider">
                    {playlistData.subscribedCount.toLocaleString()} 位收藏者
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Categories Grid */}
          {categories.length > 0 && (
            <div className="space-y-8">
              {/* Tutorial Card */}
              <AnimatePresence>
                {showImportGuide && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-secondary-fixed/10 border border-secondary-fixed/20 rounded-[2rem] p-8 relative">
                      <button 
                        onClick={() => setShowImportGuide(false)}
                        className="absolute top-6 right-6 text-outline hover:text-on-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-secondary-fixed text-on-secondary-fixed rounded-2xl flex items-center justify-center shadow-lg shadow-secondary-fixed/20">
                          <span className="material-symbols-outlined text-[20px]">help</span>
                        </div>
                        <h4 className="text-lg font-display font-bold text-on-surface">如何使用“文本导入”？</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {[
                          { step: '01', title: '点击复制', desc: '点击分类卡片右侧的复制图标，获取歌曲列表文本。' },
                          { step: '02', title: '打开网易云', desc: '打开电脑端或手机 App，进入“我的音乐”或任意歌单。' },
                          { step: '03', title: '文本导入', desc: '点击“导入外部歌单” -> “文本导入”，粘贴并确认即可。' }
                        ].map((item, i) => (
                          <div key={i} className="space-y-2">
                            <div className="text-[10px] font-black text-secondary-fixed/70 tracking-widest">{item.step}</div>
                            <div className="text-sm font-bold text-on-surface">{item.title}</div>
                            <div className="text-xs text-outline leading-relaxed">{item.desc}</div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-4 border-t border-secondary-fixed/20 flex items-start gap-2">
                        <span className="text-secondary-fixed mt-0.5">💡</span>
                        <p className="text-xs text-outline leading-relaxed">
                          <strong className="font-bold text-on-surface">进阶玩法：</strong> 复制的文本格式非常通用，您也可以将其粘贴到 <a href="https://www.tunemymusic.com/" target="_blank" rel="noreferrer" className="underline hover:text-secondary-fixed">TuneMyMusic</a> 等第三方工具中，将分类好的歌单无缝转移至 <strong>Spotify</strong> 或 <strong>Apple Music</strong>。
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-display font-black text-on-surface mb-2">分类结果</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-outline text-sm">AI 已将歌曲划分为 {categories.length} 个维度</p>
                    <span className="text-outline-variant">|</span>
                    <button 
                      onClick={() => setShowImportGuide(!showImportGuide)}
                      className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">help</span>
                      {showImportGuide ? '隐藏教程' : '查看文本导入教程'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const allText = categories.map(cat => {
                        const songList = cat.songIds.map(id => {
                          const s = songs.find(song => song.id === id);
                          return s ? `${s.name} - ${s.artists.join(', ')}` : '';
                        }).filter(Boolean).join('\n');
                        return `### ${cat.category} ###\n${songList}`;
                      }).join('\n\n');
                      copyToClipboard(allText, '已复制所有分类的歌曲列表', 'all');
                    }}
                    className={cn(
                      "px-5 py-2.5 border rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm",
                      copiedId === 'all' 
                        ? "bg-secondary-fixed/10 border-secondary-fixed/30 text-secondary-fixed" 
                        : "bg-surface-container border-outline-variant/30 text-on-surface hover:bg-surface-container-high"
                    )}
                  >
                    {copiedId === 'all' ? <span className="material-symbols-outlined text-[16px]">check_circle</span> : <span className="material-symbols-outlined text-[16px]">content_copy</span>}
                    {copiedId === 'all' ? '已复制' : '复制全部文本'}
                  </button>
                  <button 
                    onClick={() => {
                      const allContent = categories.map(cat => {
                        const songList = cat.songIds.map(id => {
                          const s = songs.find(song => song.id === id);
                          return s ? `${cat.category},${s.name},${s.artists.join(' & ')}` : '';
                        }).filter(Boolean).join('\n');
                        return songList;
                      }).filter(Boolean).join('\n');
                      downloadAsFile(`${playlistData?.name || 'export'}_all.csv`, `分类,歌曲名,歌手\n${allContent}`);
                    }}
                    className="px-5 py-2.5 bg-surface-container border border-outline-variant/30 text-on-surface rounded-xl text-sm font-bold hover:bg-surface-container-high transition-all flex items-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    下载全部 CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat, idx) => (
              <motion.div 
                key={cat.category}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card rounded-[2rem] p-8 flex flex-col h-full border border-outline-variant/30 hover:border-primary/50 transition-all duration-300 group hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="max-w-[75%]">
                    <h4 className="text-2xl font-display font-black text-on-surface mb-2 group-hover:text-primary transition-colors">{cat.category}</h4>
                    <p className="text-sm text-outline leading-relaxed">{cat.description}</p>
                  </div>
                  <div className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-black border border-primary/20">
                    {cat.songIds.length}
                  </div>
                </div>

                <div className="flex-1 space-y-3 mb-8">
                  {cat.songIds.slice(0, 3).map(songId => {
                    const song = songs.find(s => s.id === songId);
                    return song ? (
                      <div key={song.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container-high transition-all duration-300 group/song border border-transparent hover:border-outline-variant/30">
                        <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center text-outline group-hover/song:bg-primary/10 group-hover/song:shadow-sm group-hover/song:text-primary transition-all">
                          <span className="material-symbols-outlined text-[16px] group-hover/song:scale-110 transition-transform">music_note</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate text-on-surface transition-colors">{song.name}</p>
                          <p className="text-xs text-outline font-medium truncate mt-0.5">{song.artists.join(', ')}</p>
                        </div>
                      </div>
                    ) : null;
                  })}
                  {cat.songIds.length > 3 && (
                    <div className="flex items-center gap-2 pl-4 pt-2">
                      <div className="w-1 h-1 bg-outline-variant rounded-full" />
                      <p className="text-xs text-outline font-bold">
                        + {cat.songIds.length - 3} 首歌曲
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-auto">
                  <button 
                    onClick={() => exportCategory(cat)}
                    className="flex-1 py-3.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary-fixed transition-all flex items-center justify-center gap-2 group/btn shadow-md"
                  >
                    导出到网易云
                    <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                  <button 
                    onClick={() => {
                      const text = cat.songIds.map(id => {
                        const s = songs.find(song => song.id === id);
                        return s ? `${s.name} - ${s.artists.join(', ')}` : '';
                      }).filter(Boolean).join('\n');
                      copyToClipboard(text, `已复制 ${cat.category} 的歌曲列表，可在网易云“文本导入”中使用`, cat.category);
                    }}
                    title="复制文本列表 (支持网易云文本导入)"
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                      copiedId === cat.category
                        ? "bg-secondary-fixed/10 text-secondary-fixed border-secondary-fixed/30"
                        : "bg-surface-container text-outline border-outline-variant/30 hover:bg-surface-container-high hover:text-on-surface"
                    )}
                  >
                    {copiedId === cat.category ? <span className="material-symbols-outlined text-[18px]">check_circle</span> : <span className="material-symbols-outlined text-[18px]">content_copy</span>}
                  </button>
                  <button 
                    onClick={() => {
                      const content = cat.songIds.map(id => {
                        const s = songs.find(song => song.id === id);
                        return s ? `${s.name},${s.artists.join(' & ')}` : '';
                      }).filter(Boolean).join('\n');
                      downloadAsFile(`${cat.category}.csv`, `歌曲名,歌手\n${content}`);
                    }}
                    title="下载 CSV 文件"
                    className="w-12 h-12 bg-surface-container text-outline rounded-xl flex items-center justify-center hover:bg-surface-container-high hover:text-on-surface transition-all border border-outline-variant/30"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </button>
                </div>
              </motion.div>
            ))}

            {loading && categories.length === 0 && songs.length > 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center">
                <div className="relative mb-8">
                  <div className="w-24 h-24 border-4 border-surface-container-high border-t-primary rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary animate-pulse text-[32px]">music_note</span>
                  </div>
                </div>
                <h3 className="text-2xl font-display font-bold text-on-surface mb-2">DeepSeek AI 正在深度分析中</h3>
                <p className="text-outline text-sm animate-pulse mb-4">正在识别 {songs.length} 首歌曲的曲风、情绪与节奏...</p>
                {progress.total > 0 && (
                  <div className="w-64 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                    <p className="text-[10px] text-outline mt-2 font-bold uppercase tracking-widest text-center">
                      已完成 {progress.current} / {progress.total} 批次
                    </p>
                  </div>
                )}
                
                {/* Skeleton Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-16 opacity-40">
                  {[1, 2].map(i => (
                    <div key={i} className="glass-card rounded-[2rem] p-8 border border-outline-variant/30 h-64 animate-pulse">
                      <div className="flex justify-between mb-8">
                        <div className="space-y-2">
                          <div className="h-6 w-32 bg-surface-container-high rounded-lg" />
                          <div className="h-4 w-48 bg-surface-container rounded-lg" />
                        </div>
                        <div className="h-10 w-10 bg-surface-container-high rounded-xl" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-12 w-full bg-surface-container rounded-2xl" />
                        <div className="h-12 w-full bg-surface-container rounded-2xl" />
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
      <footer className="mt-20 border-t border-outline-variant/30 py-12 text-center">
        <p className="text-outline text-sm">© 2026 MusicSorter • Designed by mayicheng • Powered by DeepSeek AI & NetEase API</p>
      </footer>
    </div>
  );
}
