import { useState, useEffect } from 'react';
import { Camera, Search, Loader2, LogOut, Maximize2 } from 'lucide-react';
import axios from 'axios';
import { ResultCard } from './ResultCard';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Auth from './Auth';
import { onFirebaseAuthChanged, firebaseSignOut } from './auth.service';
import type { User } from 'firebase/auth';

const API_BASE_URL = 'http://13.232.183.4:3001';

interface Screenshot {
  id: string;
  image_url: string;
  summary: string;
  tags: string[];
  created_at: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Screenshot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // ─── Firebase Auth listener ──────────────────────────────────
  useEffect(() => {
    setIsFullScreen(window.innerWidth > 600);

    const unsubscribe = onFirebaseAuthChanged((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Initial search when user available ───────────────────────
  useEffect(() => {
    if (user) {
      handleSearch();
    }
  }, [user]);

  // ─── PrintScreen listener ────────────────────────────────────
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
        console.log("PrintScreen pressed");
      }
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);

  // ─── Background → UI toast bridge ───────────────────────────
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const handleBackgroundToast = (message: any) => {
      if (message?.action !== "backgroundCaptureToast" || typeof message.message !== "string") return;
      if (message.level === "success") { toast.success(message.message); return; }
      if (message.level === "error") { toast.error(message.message); return; }
      toast.info(message.message);
    };

    chrome.runtime.onMessage.addListener(handleBackgroundToast);
    return () => chrome.runtime.onMessage.removeListener(handleBackgroundToast);
  }, []);

  // ─── Capture screenshot ─────────────────────────────────────
  const handleCapture = async () => {
    if (!user) return alert('Please login first');
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return alert('Extension error: Please open this from the Chrome menu, not as a website.');
    }

    setIsProcessing(true);
    try {
      chrome.runtime.sendMessage({ action: "captureVisibleTab" }, async (response) => {
        if (response?.dataUrl) {
          try {
            const res = await fetch(response.dataUrl);
            const blob = await res.blob();
            const formData = new FormData();
            formData.append('screenshot', blob, 'screenshot.png');
            formData.append('userId', user.uid);

            await axios.post(`${API_BASE_URL}/process-screenshot`, formData);
            toast.success('Memory Captured!');
            handleSearch();
          } catch (apiError: any) {
            const msg = apiError.response?.data?.error || apiError.message;
            toast.error(`Backend Error: ${msg}`);
          }
        } else {
          toast.error('Failed to capture screenshot');
        }
        setIsProcessing(false);
      });
    } catch (error) {
      toast.error('Error processing screenshot');
      setIsProcessing(false);
    }
  };

  // ─── Search ─────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/search`, {
        query: searchQuery || "show all",
        userId: user.uid
      });
      setResults(data.results || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openFullScreen = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'index.html' });
    } else {
      window.open(window.location.href, '_blank');
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      setUser(null);
      setResults([]);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const displayedResults = searchQuery ? results : results.slice(0, 5);

  // ─── Loading state ──────────────────────────────────────────
  if (authLoading) {
    return (
      <div
        style={{
          backgroundColor: '#09090b',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '500px',
        }}
      >
        <Loader2 className="animate-spin" color="rgba(255, 255, 255, 0.5)" size={32} />
      </div>
    );
  }

  // ─── Login screen ───────────────────────────────────────────
  if (!user) {
    return (
      <div
        style={{
          backgroundColor: '#09090b',
          color: 'white',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '500px',
          textAlign: 'center'
        }}
      >
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          padding: '20px',
          borderRadius: '24px',
          marginBottom: '32px',
          boxShadow: '0 0 40px -10px rgba(255,255,255,0.2)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(24px)'
        }}>
          <Camera size={48} color="white" style={{ filter: 'drop-shadow(0 4px 3px rgb(0 0 0 / 0.07))' }} />
        </div>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 800,
          marginBottom: '12px',
          letterSpacing: '-0.025em',
          background: 'linear-gradient(to bottom right, white, #71717a)',
          WebkitBackgroundClip: 'text',
          color: 'transparent'
        }}>Recall.me</h1>
        <p style={{
          color: '#a1a1aa',
          marginBottom: '40px',
          maxWidth: '320px',
          lineHeight: 1.625,
          fontSize: '14px'
        }}>Your semantic visual memory. Capture once, find forever.</p>

        <div style={{ width: '100%', maxWidth: '320px' }}>
          <Auth />
        </div>

        <ToastContainer position="bottom-right" autoClose={2500} theme="dark" />
      </div>
    );
  }

  // ─── Main app (authenticated) ───────────────────────────────
  return (
    <div
      style={{
        backgroundColor: '#09090b',
        minHeight: '100vh',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: isFullScreen ? '72rem' : 'none',
        margin: isFullScreen ? '0 auto' : '0'
      }}
    >
      {/* Header */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(40px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '6px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
          }}>
            <Camera size={18} color="white" />
          </div>
          <span style={{
            fontWeight: 700,
            fontSize: '18px',
            letterSpacing: '-0.025em',
            background: 'linear-gradient(to bottom right, white, #a1a1aa)',
            WebkitBackgroundClip: 'text',
            color: 'transparent'
          }}>Recall.me</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User avatar & email */}
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt="avatar"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            />
          )}
          {isFullScreen && user.email && (
            <span style={{ color: '#a1a1aa', fontSize: '13px' }}>{user.email}</span>
          )}
          {!isFullScreen && (
            <button
              onClick={openFullScreen}
              title="Open Full Screen"
              style={{
                padding: '8px',
                color: '#a1a1aa',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '12px',
                transition: 'all 200ms',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)' }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Maximize2 size={16} />
            </button>
          )}
          <button
            onClick={handleSignOut}
            title="Sign Out"
            style={{
              padding: '8px',
              color: '#a1a1aa',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '12px',
              transition: 'all 200ms',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Hero Section (fullscreen, no active search) */}
      {!searchQuery && isFullScreen && (
        <section style={{ padding: '64px 24px', textAlign: 'center' }}>
          <h2 style={{
            fontSize: '60px',
            fontWeight: 900,
            marginBottom: '24px',
            background: 'linear-gradient(to bottom, white, #e4e4e7, #52525b)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-0.025em'
          }}>
            Your Digital Brain
          </h2>
          <p style={{
            color: '#a1a1aa',
            fontSize: '20px',
            marginBottom: '32px',
            maxWidth: '672px',
            margin: '0 auto',
            fontWeight: 500
          }}>
            Everything you've seen, indexed and searchable by meaning.
          </p>
        </section>
      )}

      {/* UI Controls */}
      <div style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: isFullScreen ? '48rem' : 'none',
        margin: isFullScreen ? '0 auto' : '0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: 'white',
              color: 'black',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 700,
              boxShadow: '0 0 30px -5px rgba(255,255,255,0.2)',
              transition: 'all 200ms',
              border: 'none',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1
            }}
            onMouseOver={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = '#e4e4e7' }}
            onMouseOut={(e) => { if (!isProcessing) e.currentTarget.style.backgroundColor = 'white' }}
            onMouseDown={(e) => { if (!isProcessing) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { if (!isProcessing) e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
            Capture This Tab
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#71717a',
            pointerEvents: 'none'
          }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by topic, keyword, or feeling..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px 16px 16px 48px',
              color: 'white',
              fontSize: '15px',
              boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
              transition: 'all 200ms',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = '0 0 0 4px rgba(255, 255, 255, 0.05)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)';
            }}
          />
        </div>
      </div>

      {/* Results Grid */}
      <main style={{
        flex: 1,
        padding: '8px 24px 24px 24px',
        display: isFullScreen ? 'grid' : 'flex',
        flexDirection: isFullScreen ? 'initial' : 'column',
        gridTemplateColumns: isFullScreen ? 'repeat(auto-fit, minmax(300px, 1fr))' : 'none',
        gap: '24px',
        maxWidth: isFullScreen ? '80rem' : 'none',
        margin: isFullScreen ? '0 auto' : '0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {loading ? (
          <div style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '96px 0',
            gap: '20px'
          }}>
            <Loader2 className="animate-spin" color="rgba(255, 255, 255, 0.5)" size={40} />
            <p style={{
              color: '#71717a',
              fontWeight: 500,
              fontSize: '14px',
              letterSpacing: '0.025em'
            }}>Consulting your memory...</p>
          </div>
        ) : displayedResults.length > 0 ? (
          displayedResults.map((item, index) => (
            <div key={item.id} style={{ animationDelay: `${index * 100}ms` }}>
              <ResultCard item={item} index={index} />
            </div>
          ))
        ) : (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '96px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            margin: '0 auto',
            width: '100%',
            maxWidth: '448px'
          }}>
            <div style={{ color: '#d4d4d8', fontWeight: 600, fontSize: '18px', marginBottom: '8px' }}>No memories found</div>
            <p style={{ color: '#71717a', fontSize: '14px' }}>Capture something to start building your brain.</p>
          </div>
        )}

        {!searchQuery && results.length > 5 && !isFullScreen && (
          <button
            onClick={openFullScreen}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#a1a1aa',
              fontWeight: 500,
              fontSize: '14px',
              transition: 'all 200ms',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'white' }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.color = '#a1a1aa' }}
          >
            Show {results.length - 5} more memories in Full Screen →
          </button>
        )}
      </main>

      {/* Footer (Full Screen only) */}
      {isFullScreen && (
        <footer style={{
          padding: '32px',
          marginTop: 'auto',
          textAlign: 'center',
          color: '#52525b',
          fontSize: '12px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          fontWeight: 600,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px)'
        }}>
          Made with ❤️ by Antigravity AI
        </footer>
      )}
      <ToastContainer position="bottom-right" autoClose={2500} theme="dark" />
    </div>
  );
}

export default App;
