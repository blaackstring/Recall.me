import { useState, useEffect, useRef } from 'react';
import { Camera, Search, Loader2, LogOut, Maximize2, Sparkles, X, Check, Bot, Plus, Mail, Unlink, Network } from 'lucide-react';
import axios from 'axios';
import Markdown from 'react-markdown';
import { ResultCard } from './ResultCard';
import { GraphView } from './GraphView';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Auth from './Auth';
import { onFirebaseAuthChanged, firebaseSignOut, connectGmail, getGmailStatus, disconnectGmail } from './auth.service';
import type { User } from 'firebase/auth';

// const API_BASE_URL = 'http://13.232.183.4:3001';
const API_BASE_URL = 'http://localhost:3001';

interface Screenshot {
  id: string;
  image_url: string;
  summary: string;
  tags: string[];
  created_at: string;
}

interface ChatMessage {
  id: string;
  query: string;
  answer?: string;
  results?: Screenshot[];
  isLoading?: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Screenshot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'agent' | 'graph'>('agent');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [showConnectMenu, setShowConnectMenu] = useState(false);
  const connectMenuRef = useRef<HTMLDivElement>(null);

  // ─── Firebase Auth listener ──────────────────────────────────
  useEffect(() => {
    setIsFullScreen(window.innerWidth > 600);

    const unsubscribe = onFirebaseAuthChanged((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Payment Session Handler ─────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const orderId = params.get('order_id');
    const plan = params.get('plan') || 'basic';
    
    if (sessionId) {
      const initCheckout = async () => {
        // @ts-ignore
        if (window.Cashfree) {
          // @ts-ignore
          const cashfree = window.Cashfree({
            mode: "production",
          });
          
          try {
            const result = await cashfree.checkout({
              paymentSessionId: sessionId,
              redirectTarget: "popup",
            });

            if (result?.paymentDetails) {
              try {
                const verifyRes = await axios.get(`${API_BASE_URL}/payment/verify/${orderId}?plan=${plan}`);
                if (verifyRes.data?.success) {
                  toast.success('🎉 Payment Successful! Subscription activated.');
                } else {
                  toast.error('Payment could not be verified. Contact support.');
                }
              } catch {
                toast.error('Verification failed. Contact support.');
              }
            } else {
              toast.error('Payment was not completed.');
            }
          } catch (err) {
            console.error('Checkout error:', err);
            toast.error('Payment failed. Please try again.');
          }
        } else {
          setTimeout(initCheckout, 500);
        }
      };
      
      initCheckout();
    }
  }, []);

  // ─── Initial search when user available ───────────────────────
  useEffect(() => {
    if (user) {
      // handleSearch();
      // Check Gmail connection status
      getGmailStatus().then(setGmailConnected).catch(() => setGmailConnected(false));
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

  // ─── Close connect menu on outside click ─────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (connectMenuRef.current && !connectMenuRef.current.contains(e.target as Node)) {
        setShowConnectMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

            const result = await axios.post(`${API_BASE_URL}/process-screenshot`, formData);

            // Show warning if last capture
            if (result.data.warning) {
              toast.warning(result.data.warning);
            } else {
              toast.success(`Memory Captured! (${result.data.remaining} left)`);
            }
            handleSearch();
          } catch (apiError: any) {
            if (apiError.response?.data?.error === 'limit_exhausted') {
              toast.error(apiError.response.data.message);
              setShowPlans(true); // Auto-open upgrade modal
            } else {
              const msg = apiError.response?.data?.error || apiError.message;
              toast.error(`Backend Error: ${msg}`);
            }
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
    if (!searchQuery.trim() && activeTab === 'agent') return;

    setLoading(true);
    const currentQuery = searchQuery || "show all";
    const messageId = Date.now().toString();

    if (activeTab === 'agent') {
      setChatHistory(prev => [...prev, { id: messageId, query: currentQuery, isLoading: true }]);
      setSearchQuery('');
    }

    try {
      // Always use Agent mode (chatMode) — query mode removed
      const { data } = await axios.post(`${API_BASE_URL}/search`, {
        query: currentQuery,
        userId: user.uid,
        mode: 'chatMode',
        sessionId
      });

      if (data.results) {
        setSessionId(data.results.sessionId);
        const mappedResults: Screenshot[] = (data.results.structuredResponse || [])
          .filter((r: any) => r.imageUrl)
          .map((r: any, idx: number) => ({
            id: `agent-${messageId}-${idx}`,
            image_url: r.imageUrl,
            summary: r.description,
            tags: r.tags || [],
            created_at: new Date().toISOString()
        }));

        if (activeTab === 'agent') {
          setChatHistory(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, isLoading: false, answer: data.results.answer, results: mappedResults } 
              : msg
          ));
        } else {
          // Library/Graph tabs: show results as cards
          setResults(mappedResults);
          const answer = data.results?.answer;
          if (answer && typeof answer === 'string' && answer.trim()) {
            toast.info(
              <div style={{ maxWidth: '400px' }}>
                <Markdown>{answer}</Markdown>
              </div>,
              { autoClose: 8000 }
            );
          }
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Search failed.');
      if (activeTab === 'agent') {
         setChatHistory(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, isLoading: false, answer: "I'm sorry, I encountered an error while searching your memory." } : msg
         ));
      }
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
      setGmailConnected(false);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  // ─── Gmail Connection Handlers ──────────────────────────────
  const handleConnectGmail = async () => {
    setGmailLoading(true);
    setShowConnectMenu(false);
    try {
      await connectGmail();
      setGmailConnected(true);
      toast.success("Gmail connected! Your agent can now search emails.");
    } catch (err: any) {
      if (!err.message?.includes("cancelled") && !err.message?.includes("closed")) {
        toast.error(err.message || "Failed to connect Gmail");
      }
    } finally {
      setGmailLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setGmailLoading(true);
    setShowConnectMenu(false);
    try {
      await disconnectGmail();
      setGmailConnected(false);
      toast.success("Gmail disconnected.");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect Gmail");
    } finally {
      setGmailLoading(false);
    }
  };

  const handlePayment = async (planId: 'BASIC' | 'STANDARD' | 'PREMIUM') => {
    if (!user) return toast.error("Please login first");
    
    setPaymentLoading(planId);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/payment/create-order`, {
        planId,
        customer_details: {
          customer_id: user.uid,
          customer_name: user.displayName || "User",
          customer_email: user.email || "example@gmail.com",
          customer_phone: "9999999999", // Placeholder or from user profile if available
        },
        order_meta: {}
      });

      if (data.payment_session_id) {
        // Pass session_id, order_id and planId so verify can activate the right plan
        const checkoutUrl = chrome.runtime.getURL(`index.html?session_id=${data.payment_session_id}&order_id=${data.order_id}&plan=${planId.toLowerCase()}`);
        chrome.tabs.create({ url: checkoutUrl });
        setShowPlans(false);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Payment failed to initialize");
    } finally {
      setPaymentLoading(null);
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
          
          <button 
            onClick={() => setShowPlans(true)}
            className="upgrade-btn-glow"
          >
            <Sparkles size={14} />
            Upgrade
          </button>

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

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.2)'
      }}>
        {/* <button
          onClick={() => setActiveTab('library')}
          style={{
            flex: 1,
            padding: '16px',
            backgroundColor: activeTab === 'library' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            color: activeTab === 'library' ? 'white' : '#a1a1aa',
            border: 'none',
            borderBottom: activeTab === 'library' ? '2px solid white' : '2px solid transparent',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 200ms'
          }}
        >
          Library
        </button> */}
        <button
          onClick={() => setActiveTab('agent')}
          style={{
            flex: 1,
            padding: '16px',
            backgroundColor: activeTab === 'agent' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
            color: activeTab === 'agent' ? '#d8b4fe' : '#a1a1aa',
            border: 'none',
            borderBottom: activeTab === 'agent' ? '2px solid #c084fc' : '2px solid transparent',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 200ms',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Bot size={16} /> Agent
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          style={{
            flex: 1,
            padding: '16px',
            backgroundColor: activeTab === 'graph' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
            color: activeTab === 'graph' ? '#22c55e' : '#a1a1aa',
            border: 'none',
            borderBottom: activeTab === 'graph' ? '2px solid #22c55e' : '2px solid transparent',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 200ms',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Network size={16} /> Graph
        </button>
      </div>

      {activeTab === 'library' ? (
        <>
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
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '0px' }}>
          {/* Chat History Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: 'center', color: '#71717a', marginTop: '40px' }}>
                <Bot size={48} color="rgba(168, 85, 247, 0.5)" style={{ margin: '0 auto 16px auto' }} />
                <p>Hello! I am your visual memory agent.</p>
                <p style={{ fontSize: '14px' }}>Ask me to find specific memories or answer questions based on what you've seen.</p>
              </div>
            )}
            
            {chatHistory.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* User Query Bubble */}
                <div style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '16px', borderBottomRightRadius: '4px', maxWidth: '80%', color: 'white', fontSize: '15px', lineHeight: 1.5 }}>
                  {msg.query}
                </div>
                
                {/* Agent Response */}
                <div style={{ display: 'flex', gap: '12px', maxWidth: '90%' }}>
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    <Bot size={24} color="#c084fc" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                    {msg.isLoading ? (
                      <div style={{ color: '#a1a1aa', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
                        <Loader2 className="animate-spin" size={16} /> Thinking and searching...
                      </div>
                    ) : (
                      <>
                        {msg.answer && (
                          <div className="agent-markdown" style={{ color: '#e9d5ff', fontSize: '15px', lineHeight: 1.7 }}>
                            <Markdown
                              components={{
                                p: ({ children }) => <p style={{ margin: '0 0 12px 0' }}>{children}</p>,
                                h1: ({ children }) => <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '16px 0 8px 0', color: 'white' }}>{children}</h1>,
                                h2: ({ children }) => <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '14px 0 6px 0', color: 'white' }}>{children}</h2>,
                                h3: ({ children }) => <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '12px 0 4px 0', color: 'white' }}>{children}</h3>,
                                ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                                ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
                                li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
                                strong: ({ children }) => <strong style={{ color: 'white', fontWeight: 600 }}>{children}</strong>,
                                em: ({ children }) => <em style={{ color: '#d8b4fe' }}>{children}</em>,
                                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline' }}>{children}</a>,
                                code: ({ children, className }) => {
                                  const isInline = !className;
                                  return isInline
                                    ? <code style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#d8b4fe' }}>{children}</code>
                                    : <code className={className} style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', overflowX: 'auto', fontSize: '13px' }}>{children}</code>;
                                },
                                pre: ({ children }) => <pre style={{ margin: '8px 0', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'auto' }}>{children}</pre>,
                                img: ({ src, alt }) => (
                                  <img
                                    src={src}
                                    alt={alt || 'Memory image'}
                                    style={{ maxWidth: '100%', borderRadius: '8px', margin: '8px 0', border: '1px solid rgba(255,255,255,0.1)' }}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ),
                              }}
                            >
                              {msg.answer}
                            </Markdown>
                          </div>
                        )}
                        {msg.results && msg.results.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: isFullScreen ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: '16px' }}>
                            {msg.results.map((r, i) => (
                              <ResultCard key={r.id} item={r} index={i} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area (Bottom) */}
          <div style={{ padding: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              {/* Connect Tools Button */}
              <div ref={connectMenuRef} style={{ position: 'absolute', left: '8px', zIndex: 10 }}>
                <button
                   title="Connect tools"
                   onClick={() => setShowConnectMenu(!showConnectMenu)}
                   style={{
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     width: '32px',
                     height: '32px',
                     borderRadius: '8px',
                     backgroundColor: gmailConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                     border: `1px solid ${gmailConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                     color: gmailConnected ? '#22c55e' : '#a1a1aa',
                     cursor: 'pointer',
                     transition: 'all 200ms'
                   }}
                   onMouseOver={(e) => { e.currentTarget.style.backgroundColor = gmailConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = 'white' }}
                   onMouseOut={(e) => { e.currentTarget.style.backgroundColor = gmailConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = gmailConnected ? '#22c55e' : '#a1a1aa' }}
                >
                  <Plus size={16} />
                </button>

                {/* Dropdown Menu */}
                {showConnectMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '40px',
                    left: 0,
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '8px',
                    minWidth: '200px',
                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
                  }}>
                    <div style={{ padding: '8px 12px', fontSize: '11px', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Connectors
                    </div>

                    {/* Gmail Connector */}
                    <button
                      onClick={gmailConnected ? handleDisconnectGmail : handleConnectGmail}
                      disabled={gmailLoading}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: gmailLoading ? 'not-allowed' : 'pointer',
                        transition: 'background-color 200ms',
                        opacity: gmailLoading ? 0.6 : 1,
                      }}
                      onMouseOver={(e) => { if (!gmailLoading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)' }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <Mail size={16} color={gmailConnected ? '#22c55e' : '#a1a1aa'} />
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Gmail</div>
                        <div style={{ fontSize: '11px', color: '#71717a' }}>
                          {gmailConnected ? 'Connected' : gmailLoading ? 'Connecting...' : 'Search & send emails'}
                        </div>
                      </div>
                      {gmailConnected && <Unlink size={14} color="#71717a" />}
                    </button>

                    <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.06)', margin: '4px 8px' }} />

                    <div style={{ padding: '8px 12px', fontSize: '11px', color: '#52525b', lineHeight: 1.4 }}>
                      Connect tools to let your agent search across apps.
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Ask your agent to perform tasks or find memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(168, 85, 247, 0.05)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 16px 16px 48px',
                  color: 'white',
                  fontSize: '15px',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                  transition: 'all 200ms',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(168, 85, 247, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                  e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.05)';
                  e.currentTarget.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)';
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'graph' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '550px' }}>
          <GraphView userId={user.uid} isFullScreen={isFullScreen} />
        </div>
      )}

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
      <a href='https://www.linkedin.com/in/mohd-shahan-siddiqui-669a16253/' target="_blank" rel="noopener noreferrer" style={{ color: '#52525b', textDecoration: 'none' }}>
        Made by Shahan siddiqui
      </a>
        </footer>
      )}
      <ToastContainer position="bottom-right" autoClose={2500} theme="dark" />

      {/* Plans Modal */}
      {showPlans && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#09090b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '500px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <button 
              onClick={() => setShowPlans(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                color: '#a1a1aa',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>Upgrade Your Memory</h2>
              <p style={{ color: '#a1a1aa', textAlign: 'center', marginBottom: '32px', fontSize: '14px' }}>Choose a plan that fits your digital brain.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { id: 'BASIC', name: 'Basic', price: '99', desc: 'Sync across 2 devices' },
                  { id: 'STANDARD', name: 'Standard', price: '149', desc: 'Sync across 5 devices' },
                  { id: 'PREMIUM', name: 'Premium', price: '199', desc: 'Unlimited everything' }
                ].map((plan) => (
                  <div key={plan.id} style={{
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 200ms'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>{plan.name}</div>
                      <div style={{ color: '#71717a', fontSize: '13px' }}>{plan.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 800, fontSize: '18px' }}>₹{plan.price}</span>
                      <button 
                        onClick={() => handlePayment(plan.id as any)}
                        disabled={!!paymentLoading}
                        style={{
                          backgroundColor: 'white',
                          color: 'black',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          minWidth: '80px'
                        }}
                      >
                        {paymentLoading === plan.id ? <Loader2 className="animate-spin" size={14} /> : 'Select'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ 
              padding: '16px', 
              borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.01)'
            }}>
              <p style={{ color: '#52525b', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Check size={12} /> Secure payments by Cashfree
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
