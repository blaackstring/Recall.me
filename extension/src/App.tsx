import { useState, useEffect } from 'react';
import { Camera, Search, Loader2, LogOut, Maximize2, } from 'lucide-react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { ResultCard } from './ResultCard';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Supabase config
const supabase = createClient(
  'https://eotndfctzhzrzkyestfg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdG5kZmN0emh6cnpreWVzdGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNDE2OTksImV4cCI6MjA3MjcxNzY5OX0.toIFc50uBuSb0rFQ5-XPK90oha1AettVbWALvRlSDQo'
);

const API_BASE_URL = 'http://localhost:3001';

interface Screenshot {
  id: string;
  image_url: string;
  summary: string;
  tags: string[];
  created_at: string;
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Screenshot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    // Detect if we are in full-screen mode (tab vs popup)
    setIsFullScreen(window.innerWidth > 600);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        // Bypass login for testing: Use a mock user ID
        setUser({ id: '00000000-0000-0000-0000-000000000000', email: 'test@example.com' });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initial search when user is loaded
  useEffect(() => {
    if (user) {
      handleSearch();
    }
  }, [user]);
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      console.log("KeyUp:", e.key, e.code);

      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44) {
        console.log("PrintScreen pressed");
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return;
    }

    const handleBackgroundToast = (message: any) => {
      if (message?.action !== "backgroundCaptureToast" || typeof message.message !== "string") {
        return;
      }

      if (message.level === "success") {
        toast.success(message.message);
        return;
      }

      if (message.level === "error") {
        toast.error(message.message);
        return;
      }

      toast.info(message.message);
    };

    chrome.runtime.onMessage.addListener(handleBackgroundToast);
    return () => chrome.runtime.onMessage.removeListener(handleBackgroundToast);
  }, []);

  const handleLogin = async () => {
    const email = prompt('Enter your email');
    if (!email) return;

    setLoading(true);
    try {
      const redirectUrl = typeof chrome !== 'undefined' && chrome.identity
        ? chrome.identity.getRedirectURL()
        : window.location.origin;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl }
      });

      if (error) alert(`Login failed: ${error.message}`);
      else alert(`Check your email!`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
            formData.append('userId', user.id);

            await axios.post(`${API_BASE_URL}/process-screenshot`, formData);
            alert('Memory Captured!');
            handleSearch();
          } catch (apiError: any) {
            const msg = apiError.response?.data?.error || apiError.message;
            alert(`Backend Error: ${msg}`);
          }
        } else {
          alert('Failed to capture screenshot');
        }
        setIsProcessing(false);
      });
    } catch (error) {
      alert('Error processing screenshot');
      setIsProcessing(false);
    }
  };

  const handleSearch = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/search`, {
        query: searchQuery || "show all",
        userId: user.id
      });
      console.log(data)
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

  const displayedResults = searchQuery ? results : results.slice(0, 5);

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
        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            backgroundColor: 'white',
            color: 'black',
            fontWeight: 700,
            padding: '14px',
            borderRadius: '12px',
            transition: 'all 200ms',
            boxShadow: '0 10px 15px -3px rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            border: 'none',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e4e4e7'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Get Started
        </button>
        <ToastContainer position="bottom-right" autoClose={2500} theme="dark" />
      </div>
    );
  }

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
            onClick={() => supabase.auth.signOut()}
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

      {/* Hero Section (only when not searching) */}
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
