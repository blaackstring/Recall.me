import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001';

interface GraphViewProps {
  userId: string;
  isFullScreen?: boolean;
}

export function GraphView({ userId, isFullScreen }: GraphViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphUrl, setGraphUrl] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/graph/${userId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to load graph' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      // The endpoint returns HTML directly
      const html = await res.text();
      // Create a blob URL to display the HTML in an iframe
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setGraphUrl(url);
    } catch (err: any) {
      console.error('Graph fetch error:', err);
      setError(err.message || 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
    return () => {
      // Cleanup blob URL on unmount
      if (graphUrl) URL.revokeObjectURL(graphUrl);
    };
  }, [userId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#09090b',
      flex: 1
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontWeight: 600,
            fontSize: '14px',
            color: 'white',
          }}>Knowledge Graph</span>
          <span style={{
            fontSize: '11px',
            color: '#71717a',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '2px 8px',
            borderRadius: '4px',
          }}>Cognee Memory</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchGraph}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: loading ? '#71717a' : 'white',
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 200ms',
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            backgroundColor: '#09090b',
            zIndex: 10,
          }}>
            <Loader2 className="animate-spin" color="#a78bfa" size={32} />
            <span style={{ color: '#71717a', fontSize: '14px' }}>Loading knowledge graph...</span>
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            backgroundColor: '#09090b',
            padding: '24px',
          }}>
            <AlertCircle size={48} color="#ef4444" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
                Failed to load graph
              </div>
              <div style={{ color: '#71717a', fontSize: '13px', maxWidth: '400px' }}>
                {error}
              </div>
              <div style={{ color: '#52525b', fontSize: '12px', marginTop: '12px' }}>
                Capture some screenshots first to build your knowledge graph.
              </div>
            </div>
            <button
              onClick={fetchGraph}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                color: '#d8b4fe',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {graphUrl && !loading && !error && (
          <iframe
            src={graphUrl}
            style={{
              width: '100%',
              height: '100%',
              minHeight: isFullScreen ? '800px' : '550px',
              border: 'none',
              backgroundColor: '#09090b',
              flex: 1,
              display: 'block'
            }}
            title="Knowledge Graph"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
