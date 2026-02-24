import { useState } from "react";
import { ExternalLink, Calendar, Eye, Image as ImageIcon } from "lucide-react";

export interface Screenshot {
  id: string;
  image_url: string;
  summary: string;
  tags: string[];
  created_at: string;
}

interface ResultCardProps {
  item: Screenshot;
  index: number;
}

export function ResultCard({ item, index }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Hover states for inline styling
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isLinkHovered, setIsLinkHovered] = useState(false);
  const [isViewHovered, setIsViewHovered] = useState(false);

  const date = new Date(item.created_at);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const visibleTags = item.tags.slice(0, 3);
  const extraCount = item.tags.length - visibleTags.length;

  return (
    <div
      onClick={() => setExpanded((e) => !e)}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      style={{
        position: "relative",
        backgroundColor: "rgba(9, 9, 11, 0.8)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: isCardHovered ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(255, 255, 255, 0.08)",
        marginBottom: "24px",
        borderRadius: "1rem",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: isCardHovered
          ? "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
          : "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
        transition: "all 500ms ease-out",
        transform: isCardHovered ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      {/* ── Image Section ── */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        backgroundColor: "rgba(24, 24, 27, 0.5)"
      }}>
        {/* Index badge */}
        <div style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "28px",
          height: "28px",
          padding: "0 8px",
          borderRadius: "9999px",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.025em",
          color: "rgba(255, 255, 255, 0.7)",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
        }}>
          #{index + 1}
        </div>

        {/* Top Right Action (External Link) */}
        <button
          onMouseEnter={(e) => { e.stopPropagation(); setIsLinkHovered(true); }}
          onMouseLeave={(e) => { e.stopPropagation(); setIsLinkHovered(false); }}
          onClick={(e) => { e.stopPropagation(); window.open(item.image_url, "_blank"); }}
          title="Open Original Image"
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "9999px",
            backgroundColor: isLinkHovered ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: isLinkHovered ? "white" : "rgba(255, 255, 255, 0.7)",
            opacity: isCardHovered ? 1 : 0,
            transition: "all 300ms ease",
            cursor: "pointer"
          }}
        >
          <ExternalLink size={14} />
        </button>

        {/* Image */}
        {imgError ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            color: "#52525b",
            backgroundColor: "rgba(24, 24, 27, 0.5)"
          }}>
            <ImageIcon size={32} style={{ marginBottom: "8px", opacity: 0.3 }} />
            <span style={{ fontSize: "12px", fontWeight: 500 }}>Image unavailable</span>
          </div>
        ) : (
          <img
            src={item.image_url}
            alt={item.summary || "Screenshot"}
            onError={() => setImgError(true)}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 700ms ease-out",
              transform: isCardHovered ? "scale(1.05)" : "scale(1)"
            }}
          />
        )}

        {/* Multi-layered Gradient for depth */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.2), transparent)",
          opacity: 0.8,
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "50%",
          background: "linear-gradient(to top, #09090b, transparent)",
          opacity: 0.5,
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.1)",
          opacity: isCardHovered ? 1 : 0,
          transition: "opacity 300ms",
          pointerEvents: "none"
        }} />

        {/* Hover View Button */}
        <button
          onMouseEnter={(e) => { e.stopPropagation(); setIsViewHovered(true); }}
          onMouseLeave={(e) => { e.stopPropagation(); setIsViewHovered(false); }}
          onClick={(e) => { e.stopPropagation(); window.open(item.image_url, "_blank"); }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, ${isCardHovered ? "-50%" : "1rem"})`,
            opacity: isCardHovered ? 1 : 0,
            transition: "all 500ms ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: isViewHovered ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            padding: "10px 20px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 500,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            cursor: "pointer"
          }}
        >
          <Eye size={14} />
          <span>View Image</span>
        </button>

        {/* Floating Tags over image bottom */}
        <div style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          right: "16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "flex-end",
          zIndex: 10,
          pointerEvents: "none"
        }}>
          {visibleTags.map((tag) => (
            <span
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.025em",
                color: "#e4e4e7",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
              }}
            >
              {tag}
            </span>
          ))}
          {extraCount > 0 && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 8px",
              borderRadius: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "10px",
              fontWeight: 500,
              color: "#a1a1aa"
            }}>
              +{extraCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Card Body ── */}
      <div style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        background: "linear-gradient(to bottom, rgba(9, 9, 11, 0.8), #09090b)"
      }}>
        {/* Meta info row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.05em",
          color: "#71717a",
          textTransform: "uppercase"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={12} color="#52525b" />
            <span>{dateStr}</span>
          </div>
          <div style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "#3f3f46" }} />
          <span>{timeStr}</span>
        </div>

        {/* Summary text */}
        <div style={{ position: "relative" }}>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.625,
              color: "#d4d4d8",
              transition: "all 300ms",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {item.summary || "No description provided."}
          </p>
          {!expanded && (item.summary?.length > 150) && (
            <div style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              left: 0,
              height: "32px",
              background: "linear-gradient(to top, #09090b, transparent)",
              pointerEvents: "none"
            }} />
          )}
        </div>
      </div>
    </div>
  );
}