import { useState, useEffect, useRef } from "react";
import {
  Home, Calendar, User, Bell, Search, ChevronLeft, ChevronRight,
  Phone, Video, Building2, Star, Heart, Brain, Users, Activity,
  Shield, HelpCircle, Globe, CreditCard, Info, FileText,
  Check, X, Filter, EyeOff, Sparkles, BellDot, Copy, Sun, Moon,
  Stethoscope, HeartHandshake, MessageCircle, ChevronDown, Layers, Palette,
  Type, Move, Square, ToggleRight, Navigation, Pill, Hexagon, BookOpen
} from "lucide-react";

/* ═══════════════════════════════════════════════
   TOKENS
   ═══════════════════════════════════════════════ */
const C = {
  pri: "#1D4ED8", priDk: "#0037B0", priLt: "#EFF6FF",
  sec: "#84CC16", secDk: "#65A30D", secLt: "#F7FEE7",
  bg: "#F7F9FB", bgLow: "#F2F4F6", white: "#FFFFFF", bgHi: "#E6E8EA",
  txt: "#191C1E", txtSec: "#64748B", txtMut: "#C4C5D7",
  ok: "#059669", warn: "#F59E0B", err: "#DC2626", purp: "#7C3AED",
  glass: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(255,255,255,0.45)",
};
const F = "'IBM Plex Sans Arabic', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

/* ═══════════════════════════════════════════════
   NAV ITEMS
   ═══════════════════════════════════════════════ */
const NAV = [
  { id: "brand", label: "Brand", icon: Hexagon },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "type", label: "Typography", icon: Type },
  { id: "space", label: "Spacing", icon: Move },
  { id: "surfaces", label: "Surfaces", icon: Layers },
  { id: "buttons", label: "Buttons", icon: Square },
  { id: "inputs", label: "Inputs", icon: ToggleRight },
  { id: "nav", label: "Navigation", icon: Navigation },
  { id: "cards", label: "Cards", icon: Square },
  { id: "pills", label: "Pills", icon: Pill },
  { id: "icons", label: "Icons", icon: Hexagon },
  { id: "rules", label: "Guidelines", icon: BookOpen },
];

/* ═══════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════ */
const Glass = ({ children, style, padding = 28, radius = 20 }) => (
  <div style={{
    background: C.glass, backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    borderRadius: radius, padding,
    border: `1px solid ${C.glassBorder}`,
    ...style,
  }}>{children}</div>
);

const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom: 32, paddingTop: 12 }}>
    <h2 style={{ fontSize: 32, fontWeight: 700, color: C.txt, margin: 0, letterSpacing: -0.5, lineHeight: 1.2 }}>{title}</h2>
    {sub && <p style={{ fontSize: 15, color: C.txtSec, marginTop: 8, lineHeight: 1.6 }}>{sub}</p>}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: C.txtSec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>{children}</div>
);

const Swatch = ({ color, name, hex, wide }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{
      width: "100%", aspectRatio: wide ? "2.5" : "1", borderRadius: 16,
      background: color, border: color === "#FFFFFF" ? `1px solid ${C.bgLow}` : "none",
      marginBottom: 10, transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      cursor: "default",
    }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />
    <div style={{ fontSize: 12, fontWeight: 600, color: C.txt }}>{name}</div>
    <div style={{ fontSize: 11, color: C.txtSec, fontFamily: "monospace" }}>{hex}</div>
  </div>
);

const Rule = ({ type, text }) => (
  <div style={{
    display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 18px",
    borderRadius: 14, marginBottom: 8,
    background: type === "do" ? `${C.ok}08` : `${C.err}08`,
    border: `1px solid ${type === "do" ? `${C.ok}15` : `${C.err}15`}`,
  }}>
    <div style={{
      width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
      background: type === "do" ? `${C.ok}15` : `${C.err}15`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {type === "do" ? <Check size={12} color={C.ok} strokeWidth={3} /> : <X size={12} color={C.err} strokeWidth={3} />}
    </div>
    <span style={{ fontSize: 13, color: C.txt, lineHeight: 1.6 }}>{text}</span>
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════ */
export default function DesignSystem() {
  const [active, setActive] = useState("brand");
  const [seg, setSeg] = useState(0);
  const [tog, setTog] = useState(true);
  const [hovBtn, setHovBtn] = useState(null);

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    NAV.forEach(n => {
      const el = document.getElementById(n.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: F, background: C.bg, minHeight: "100vh", color: C.txt }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; scroll-padding-top: 90px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.bgHi}; border-radius: 6px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.txtMut}; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* ═══ HERO HEADER ═══ */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${C.priDk} 0%, ${C.pri} 40%, #6366F1 70%, ${C.purp} 100%)`,
        padding: "60px 40px 50px", marginBottom: 0,
      }}>
        {/* Mesh gradient blobs */}
        <div style={{ position: "absolute", top: -80, right: -60, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${C.sec}44 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: -40, left: "20%", width: 250, height: 250, borderRadius: "50%", background: `radial-gradient(circle, ${C.purp}33 0%, transparent 70%)`, filter: "blur(50px)" }} />
        <div style={{ position: "absolute", top: "30%", left: -30, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, #06B6D444 0%, transparent 70%)`, filter: "blur(40px)" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "float 4s ease-in-out infinite",
                }}>
                  <Stethoscope size={24} color="#FFF" strokeWidth={1.5} />
                </div>
                <div>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>Design System</span>
                </div>
              </div>
              <h1 style={{
                fontSize: 44, fontWeight: 700, color: "#FFF",
                letterSpacing: -1.5, lineHeight: 1.15, margin: 0,
              }}>
                CareKit<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}> /</span> كيركت
              </h1>
              <p style={{ fontSize: 17, color: "rgba(255,255,255,0.65)", marginTop: 12, lineHeight: 1.6, maxWidth: 480 }}>
                The Clinical Curator — Premium medical interface guidelines. RTL-first, accessibility-tested, built for Arabic healthcare.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["v2.0", "rgba(255,255,255,0.12)"], ["RTL-First", `${C.sec}33`], ["WCAG AAA", "rgba(255,255,255,0.12)"]].map(([t, bg], i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#FFF", background: bg, padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0, position: "relative" }}>

        {/* ── SIDEBAR ── */}
        <nav style={{
          width: 220, flexShrink: 0, padding: "28px 12px 28px 20px",
          position: "sticky", top: 0, height: "100vh", overflowY: "auto",
        }}>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.txtSec, textTransform: "uppercase", letterSpacing: 1.5 }}>Components</span>
          </div>
          {NAV.map(n => {
            const isActive = active === n.id;
            return (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                padding: "9px 14px", marginBottom: 2, borderRadius: 12,
                border: "none", cursor: "pointer",
                background: isActive ? C.white : "transparent",
                boxShadow: isActive ? "0 2px 8px rgba(0,21,81,0.06)" : "none",
                color: isActive ? C.pri : C.txtSec,
                fontSize: 13, fontWeight: isActive ? 600 : 400, fontFamily: F,
                transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
              }}>
                <n.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                {n.label}
              </button>
            );
          })}
        </nav>

        {/* ── CONTENT ── */}
        <main style={{ flex: 1, padding: "44px 44px 100px 32px", minWidth: 0 }}>

          {/* ════════════════════ BRAND ════════════════════ */}
          <section id="brand" style={{ marginBottom: 72 }}>
            <SectionTitle title="Brand Identity" sub="White-label medical platform. Logo and brand name change per client — these are defaults." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <Glass>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 80, height: 80, borderRadius: 22, background: `linear-gradient(135deg,${C.priDk},${C.pri})`, margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 30px ${C.pri}33` }}>
                    <Stethoscope size={36} color="#FFF" strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, direction: "rtl" }}>كيركت</div>
                  <div style={{ fontSize: 14, color: C.txtSec, fontFamily: "'DM Sans', sans-serif" }}>CareKit</div>
                  <div style={{ marginTop: 14, fontSize: 11, color: C.txtMut, background: C.bgLow, padding: "4px 12px", borderRadius: 6, display: "inline-block" }}>Light Background</div>
                </div>
              </Glass>
              <div style={{
                background: `linear-gradient(135deg,${C.priDk},${C.pri})`,
                borderRadius: 20, padding: 28, textAlign: "center",
              }}>
                <div style={{ width: 80, height: 80, borderRadius: 22, background: "rgba(255,255,255,0.12)", margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                  <Stethoscope size={36} color="#FFF" strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#FFF", direction: "rtl" }}>كيركت</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif" }}>CareKit</div>
                <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: 6, display: "inline-block" }}>Dark Background</div>
              </div>
              <Glass>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg,${C.priDk},${C.pri})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Stethoscope size={20} color="#FFF" strokeWidth={1.5} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>CareKit</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.txtMut, background: C.bgLow, padding: "4px 12px", borderRadius: 6 }}>Compact / Nav</div>
                  <div style={{ marginTop: 8, padding: "8px 16px", background: `${C.warn}12`, borderRadius: 10, fontSize: 12, color: C.warn, fontWeight: 500 }}>⚡ White-Label — Logo per client</div>
                </div>
              </Glass>
            </div>
          </section>

          {/* ════════════════════ COLORS ════════════════════ */}
          <section id="colors" style={{ marginBottom: 72 }}>
            <SectionTitle title="Color System" sub="Royal Blue authority paired with Apple Green vitality. Tinted shadows, never pure black." />
            
            <Label>PRIMARY</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
              <Swatch color={C.priDk} name="Dark" hex="#0037B0" />
              <Swatch color={C.pri} name="Primary" hex="#1D4ED8" />
              <Swatch color={`${C.pri}55`} name="33%" hex="opacity" />
              <Swatch color={`${C.pri}22`} name="13%" hex="opacity" />
              <Swatch color={C.priLt} name="Tint" hex="#EFF6FF" />
            </div>

            <Label>SECONDARY — APPLE GREEN</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
              <Swatch color={C.secDk} name="Dark" hex="#65A30D" />
              <Swatch color={C.sec} name="Secondary" hex="#84CC16" />
              <Swatch color={`${C.sec}55`} name="33%" hex="opacity" />
              <Swatch color={`${C.sec}22`} name="13%" hex="opacity" />
              <Swatch color={C.secLt} name="Tint" hex="#F7FEE7" />
            </div>

            <Label>SEMANTIC</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
              <Swatch color={C.ok} name="Success" hex="#059669" />
              <Swatch color={C.warn} name="Warning" hex="#F59E0B" />
              <Swatch color={C.err} name="Error" hex="#DC2626" />
              <Swatch color={C.purp} name="Purple" hex="#7C3AED" />
              <Swatch color="#0D9488" name="Teal" hex="#0D9488" />
            </div>

            <Label>GRADIENTS</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ height: 64, borderRadius: 16, background: `linear-gradient(135deg,${C.priDk},${C.pri})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${C.pri}33` }}>
                <code style={{ color: "#FFF", fontSize: 12, opacity: 0.8 }}>135° #0037B0 → #1D4ED8</code>
              </div>
              <div style={{ height: 64, borderRadius: 16, background: `linear-gradient(135deg,${C.secDk},${C.sec})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${C.sec}33` }}>
                <code style={{ color: "#FFF", fontSize: 12, opacity: 0.8 }}>135° #65A30D → #84CC16</code>
              </div>
            </div>
          </section>

          {/* ════════════════════ TYPOGRAPHY ════════════════════ */}
          <section id="type" style={{ marginBottom: 72 }}>
            <SectionTitle title="Typography" sub="IBM Plex Sans Arabic for Arabic content. DM Sans for English. Never two bold weights adjacent." />
            
            <Glass style={{ marginBottom: 24 }}>
              <div style={{ direction: "rtl" }}>
                {[
                  [36, 700, "رعاية صحية على أعلى مستوى", "Display — 36px Bold"],
                  [28, 700, "مواعيد اليوم", "Display SM — 28px Bold"],
                  [20, 600, "المعالجين المميزين", "Heading — 20px Semibold"],
                  [16, 600, "التخصصات", "Subheading — 16px Semibold"],
                  [14, 400, "جلسة فردية مع معالج نفسي متخصص — ٤٥ دقيقة", "Body — 14px Regular"],
                  [13, 400, "آخر زيارة: ١٥ شوال ١٤٤٧", "Body SM — 13px Regular / Secondary color"],
                ].map(([size, weight, text, label], i) => (
                  <div key={i} style={{ padding: "16px 0", borderBottom: i < 5 ? `1px solid ${C.bgLow}` : "none" }}>
                    <div style={{ fontSize: size, fontWeight: weight, color: i === 5 ? C.txtSec : C.txt, lineHeight: 1.4, marginBottom: 6 }}>{text}</div>
                    <span style={{ fontSize: 11, color: C.txtMut, fontFamily: "monospace" }}>{label}</span>
                  </div>
                ))}
                {/* Label special */}
                <div style={{ padding: "16px 0 0" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.txtSec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>مواعيد اليوم</div>
                  <span style={{ fontSize: 11, color: C.txtMut, fontFamily: "monospace" }}>Label — 11px Semibold / Uppercase / +5% tracking</span>
                </div>
              </div>
            </Glass>

            {/* Hierarchy rule */}
            <div style={{ background: `${C.warn}0A`, border: `1px solid ${C.warn}20`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.txt }}>Hierarchy Rule — Never stack bold on bold</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Glass padding={18} radius={14}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: `${C.ok}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={11} color={C.ok} strokeWidth={3} /></div>
                    <span style={{ fontSize: 11, color: C.ok, fontWeight: 600 }}>CORRECT</span>
                  </div>
                  <div style={{ direction: "rtl" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>د. أحمد الشمري</div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: C.txtSec }}>استشاري الطب النفسي</div>
                  </div>
                </Glass>
                <Glass padding={18} radius={14}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: `${C.err}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} color={C.err} strokeWidth={3} /></div>
                    <span style={{ fontSize: 11, color: C.err, fontWeight: 600 }}>WRONG</span>
                  </div>
                  <div style={{ direction: "rtl" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>د. أحمد الشمري</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>استشاري الطب النفسي</div>
                  </div>
                </Glass>
              </div>
            </div>
          </section>

          {/* ════════════════════ SPACING ════════════════════ */}
          <section id="space" style={{ marginBottom: 72 }}>
            <SectionTitle title="Spacing & Radius" sub="Consistent 4px base grid. Generous breathing room for clinical calm." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Glass>
                <Label>SPACING SCALE</Label>
                {[["4", "Tight", "icon gaps"], ["8", "Compact", "pills, small gaps"], ["12", "Default", "list items, card gaps"], ["16", "Standard", "card padding"], ["20", "Comfortable", "inner padding"], ["24", "Generous", "safe area, headers"], ["32", "Section", "section breaks"], ["48", "Major", "page sections"]].map(([px, name, use], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", borderBottom: i < 7 ? `1px solid ${C.bgLow}44` : "none" }}>
                    <code style={{ fontSize: 13, fontWeight: 700, color: C.pri, width: 36, textAlign: "right" }}>{px}</code>
                    <div style={{ width: parseInt(px) * 1.5, height: 8, borderRadius: 4, background: `linear-gradient(90deg,${C.pri},${C.pri}66)`, transition: "width 0.3s" }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.txt, minWidth: 70 }}>{name}</span>
                    <span style={{ fontSize: 11, color: C.txtSec }}>{use}</span>
                  </div>
                ))}
              </Glass>
              <Glass>
                <Label>CORNER RADIUS</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {[["6", "Small", "Tags, chips"], ["8", "Medium", "Cards, buttons"], ["16", "Large", "Banners, modals"], ["999", "Full", "Pills, avatars"]].map(([r, name, use], i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{
                        width: 72, height: 72, margin: "0 auto 10px",
                        borderRadius: r === "999" ? "50%" : parseInt(r),
                        background: `linear-gradient(135deg, ${C.priLt}, ${C.bgLow})`,
                        border: `2px dashed ${C.pri}33`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <code style={{ fontSize: 13, fontWeight: 700, color: C.pri }}>{r}px</code>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 11, color: C.txtSec }}>{use}</div>
                    </div>
                  ))}
                </div>
              </Glass>
            </div>
          </section>

          {/* ════════════════════ SURFACES ════════════════════ */}
          <section id="surfaces" style={{ marginBottom: 72 }}>
            <SectionTitle title="Surfaces & Elevation" sub="Depth through tonal layering, not shadows. Frosted glass for floating elements." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                [C.bg, "Base", "#F7F9FB", "Page bg"],
                [C.bgLow, "Low", "#F2F4F6", "Sections"],
                [C.white, "Lowest", "#FFFFFF", "Cards"],
                ["glass", "Bright", "blur(40px)", "Floating"],
              ].map(([bg, name, hex, use], i) => (
                <div key={i} style={{
                  background: bg === "glass" ? C.glass : bg,
                  backdropFilter: bg === "glass" ? "blur(12px)" : "none",
                  borderRadius: 16, padding: 24,
                  border: bg === "glass" ? `1px solid ${C.glassBorder}` : i === 2 ? `1px solid ${C.bgLow}` : "none",
                  boxShadow: bg === "glass" ? "0 4px 24px rgba(0,21,81,0.04)" : "none",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Surface {name}</div>
                  <code style={{ fontSize: 11, color: C.txtSec }}>{hex}</code>
                  <div style={{ fontSize: 12, color: C.txtSec, marginTop: 8 }}>{use}</div>
                </div>
              ))}
            </div>
            <Label>SHADOW SYSTEM</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                ["None", "Cards — lift by contrast", "none"],
                ["Ambient", "Search bar, dropdowns", "0 4px 24px rgba(0,21,81,0.04)"],
                ["Elevated", "Modals, popovers", "0 8px 32px rgba(0,21,81,0.06)"],
              ].map(([name, use, shadow], i) => (
                <Glass key={i} padding={20}>
                  <div style={{ width: 64, height: 64, borderRadius: 14, background: C.white, margin: "0 auto 14px", boxShadow: shadow }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: 11, color: C.txtSec, marginTop: 4 }}>{use}</div>
                    {shadow !== "none" && <code style={{ fontSize: 9, color: C.txtMut, display: "block", marginTop: 6 }}>{shadow}</code>}
                  </div>
                </Glass>
              ))}
            </div>
          </section>

          {/* ════════════════════ BUTTONS ════════════════════ */}
          <section id="buttons" style={{ marginBottom: 72 }}>
            <SectionTitle title="Buttons" sub="Gradient primary, never drop shadows. Apple Green secondary for positive actions." />
            <Glass>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>VARIANT</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>DEFAULT</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>SMALL</span>
              </div>
              {[
                ["Primary", `linear-gradient(135deg,${C.priDk},${C.pri})`, "#FFF", "none", "احجز موعد", "احجز"],
                ["Secondary", `linear-gradient(135deg,${C.secDk},${C.sec})`, "#FFF", "none", "ابدأ الآن", "متاح"],
                ["Outline", "transparent", C.pri, `1.5px solid ${C.pri}33`, "إضافة للتقويم", "عرض"],
                ["Ghost", "transparent", C.pri, "none", "عرض التفاصيل", "المزيد"],
                ["Danger", "transparent", C.err, "none", "إلغاء الحجز", "إلغاء"],
                ["Disabled", C.bgHi, "#94A3B8", "none", "التالي", "—"],
              ].map(([label, bg, color, border, text, sm], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 16, alignItems: "center", padding: "14px 0", borderTop: `1px solid ${C.bgLow}44` }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                  <div>
                    <button
                      onMouseEnter={() => setHovBtn(`${i}-d`)}
                      onMouseLeave={() => setHovBtn(null)}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: bg, color, border, borderRadius: 10,
                        padding: "12px 26px", fontSize: 14, fontWeight: 600, fontFamily: F,
                        cursor: i === 5 ? "not-allowed" : "pointer", opacity: i === 5 ? 0.6 : 1,
                        direction: "rtl",
                        transform: hovBtn === `${i}-d` && i < 5 ? "scale(1.03)" : "scale(1)",
                        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                      }}>{text}</button>
                  </div>
                  <div>
                    {sm !== "—" && <button style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: bg, color, border, borderRadius: 8,
                      padding: "8px 18px", fontSize: 13, fontWeight: 600, fontFamily: F,
                      cursor: "pointer", direction: "rtl",
                    }}>{sm}</button>}
                  </div>
                </div>
              ))}
            </Glass>
          </section>

          {/* ════════════════════ INPUTS ════════════════════ */}
          <section id="inputs" style={{ marginBottom: 72 }}>
            <SectionTitle title="Inputs & Controls" sub="Fill-based inputs (no outline by default). Focus = faint primary border. Toggle ON = Apple Green." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Glass>
                <Label>TEXT INPUT</Label>
                <div style={{ direction: "rtl" }}>
                  <label style={{ display: "block", fontSize: 12, color: C.txtSec, marginBottom: 6 }}>البريد الإلكتروني</label>
                  <div style={{ background: C.bgHi, borderRadius: 10, border: "1.5px solid transparent", padding: "13px 16px", fontSize: 14, color: C.txt }}>tariq@email.com</div>
                  <label style={{ display: "block", fontSize: 12, color: C.txtSec, marginBottom: 6, marginTop: 14 }}>Focus State</label>
                  <div style={{ background: C.bgHi, borderRadius: 10, border: `1.5px solid ${C.pri}55`, padding: "13px 16px", fontSize: 14, color: C.txtMut }}>اكتب هنا...</div>
                </div>
              </Glass>
              <Glass>
                <Label>SEARCH BAR</Label>
                <div style={{ background: C.white, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,21,81,0.04)", padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, direction: "rtl" }}>
                  <Search size={18} strokeWidth={1.5} color={C.txtSec} />
                  <span style={{ color: C.txtMut, fontSize: 14 }}>ابحث عن معالج أو خدمة...</span>
                </div>
                <div style={{ fontSize: 11, color: C.txtMut, marginTop: 10 }}>White fill + ambient shadow, no border</div>
              </Glass>
              <Glass>
                <Label>OTP</Label>
                <div style={{ display: "flex", gap: 10, direction: "ltr", justifyContent: "center" }}>
                  {[1, 4, "", "", "", ""].map((d, i) => (
                    <div key={i} style={{ width: 48, height: 54, borderRadius: 12, background: C.bgHi, border: i === 2 ? `2px solid ${C.pri}55` : "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: C.txt, transition: "border 0.2s" }}>{d}</div>
                  ))}
                </div>
              </Glass>
              <Glass>
                <Label>TOGGLE & SEGMENT</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 14, direction: "rtl", marginBottom: 20 }}>
                  <button onClick={() => setTog(!tog)} style={{ width: 50, height: 28, borderRadius: 14, background: tog ? C.sec : C.bgHi, border: "none", cursor: "pointer", position: "relative", padding: 0, transition: "background 0.3s" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", position: "absolute", top: 3, right: tog ? 3 : "auto", left: tog ? "auto" : 3, transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} />
                  </button>
                  <span style={{ fontSize: 14 }}>{tog ? "مفعّل" : "معطّل"}</span>
                  <code style={{ fontSize: 11, color: C.txtMut }}>ON={C.sec}</code>
                </div>
                <div style={{ display: "flex", background: C.bgLow, borderRadius: 999, padding: 3, gap: 2, direction: "rtl" }}>
                  {["القادمة", "السابقة", "الملغاة"].map((o, i) => (
                    <button key={i} onClick={() => setSeg(i)} style={{ flex: 1, padding: "9px 14px", borderRadius: 999, border: "none", cursor: "pointer", background: seg === i ? C.white : "transparent", boxShadow: seg === i ? "0 2px 8px rgba(0,21,81,0.06)" : "none", color: seg === i ? C.pri : C.txtSec, fontSize: 13, fontWeight: seg === i ? 600 : 400, fontFamily: F, transition: "all 0.25s" }}>{o}</button>
                  ))}
                </div>
              </Glass>
            </div>
          </section>

          {/* ════════════════════ NAVIGATION ════════════════════ */}
          <section id="nav" style={{ marginBottom: 72 }}>
            <SectionTitle title="Navigation" sub="5-tab bottom bar with elevated center AI button. Frosted glass background. No top border." />
            <Glass style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}>
              <div style={{ background: C.bg, borderRadius: 20, padding: "12px 8px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", direction: "rtl" }}>
                  {[
                    { icon: Home, label: "الرئيسية", active: true },
                    { icon: Calendar, label: "مواعيدي" },
                    { ai: true },
                    { icon: BellDot, label: "الإشعارات" },
                    { icon: User, label: "حسابي" },
                  ].map((t, i) => {
                    if (t.ai) return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginTop: -16 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${C.priDk},${C.pri})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${C.pri}33` }}>
                          <Sparkles size={20} strokeWidth={1.8} color="#FFF" />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.pri }}>المساعد</span>
                      </div>
                    );
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: t.active ? C.pri : C.txtSec, padding: "4px 0" }}>
                        <t.icon size={22} strokeWidth={t.active ? 2 : 1.5} />
                        <span style={{ fontSize: 10, fontWeight: t.active ? 600 : 400 }}>{t.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: C.txtMut }}>Glassmorphism • No top border • Center AI elevated with gradient + shadow</div>
            </Glass>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
              <Glass padding={16}>
                <Label>TOP BAR — DETAIL</Label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", direction: "rtl", padding: "6px 4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ChevronRight size={22} strokeWidth={1.5} /><span style={{ fontSize: 18, fontWeight: 700 }}>المعالجين</span></div>
                  <Filter size={20} strokeWidth={1.5} color={C.txtSec} />
                </div>
              </Glass>
              <Glass padding={16}>
                <Label>FILTER CHIPS</Label>
                <div style={{ display: "flex", gap: 8, direction: "rtl" }}>
                  {["الكل", "متاح اليوم", "الأعلى تقييماً"].map((o, i) => (
                    <span key={i} style={{ padding: "8px 16px", borderRadius: 999, background: i === 0 ? C.pri : C.white, color: i === 0 ? "#FFF" : C.txt, fontSize: 13, fontWeight: 500, boxShadow: i > 0 ? "0 1px 4px rgba(0,21,81,0.04)" : "none" }}>{o}</span>
                  ))}
                </div>
              </Glass>
            </div>
          </section>

          {/* ════════════════════ CARDS ════════════════════ */}
          <section id="cards" style={{ marginBottom: 72 }}>
            <SectionTitle title="Cards & Containers" sub="No borders. White cards on gray background. Selected state = faint blue tint + border." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Glass>
                <Label>STANDARD & SELECTION</Label>
                {[false, true].map((sel, i) => (
                  <div key={i} style={{ background: sel ? `${C.pri}08` : C.white, borderRadius: 12, padding: 16, border: sel ? `1.5px solid ${C.pri}40` : "1.5px solid transparent", marginBottom: 10, direction: "rtl", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s", cursor: "pointer" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${C.pri}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><Phone size={18} color={C.pri} strokeWidth={1.5} /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>استشارة هاتفية</div><div style={{ fontSize: 12, color: C.txtSec }}>{sel ? "Selected" : "Default"}</div></div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.pri }}>١٨٠ ر.س</span>
                  </div>
                ))}
              </Glass>
              <Glass>
                <Label>PROMO BANNER</Label>
                <div style={{ background: `linear-gradient(135deg,${C.priDk},${C.pri})`, borderRadius: 16, padding: 22, direction: "rtl", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#FFF", marginBottom: 6 }}>احجز استشارتك الأولى بخصم ٢٠٪</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>عرض محدود للمستخدمين الجدد</div>
                  <button style={{ background: C.sec, color: "#FFF", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>احجز الآن</button>
                </div>
              </Glass>
            </div>
          </section>

          {/* ════════════════════ PILLS ════════════════════ */}
          <section id="pills" style={{ marginBottom: 72 }}>
            <SectionTitle title="Status Pills" sub="Full-round. Background at 10% opacity. Solid text color. 12px semibold." />
            <Glass>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                {[
                  ["مؤكد", C.ok], ["متاح اليوم", C.sec], ["قادم", C.pri], ["مكتمل", C.ok],
                  ["بانتظار التأكيد", C.warn], ["ملغي", C.err], ["لاحقاً", C.txtSec], ["مرئي", C.purp],
                  ["عيادة", C.pri], ["هاتفي", "#0D9488"],
                ].map(([text, c], i) => (
                  <span key={i} style={{ display: "inline-flex", background: `${c}1A`, color: c, borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 600, transition: "transform 0.2s", cursor: "default" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>{text}</span>
                ))}
              </div>
              <div style={{ background: C.bgLow, borderRadius: 12, padding: 16 }}>
                <code style={{ fontSize: 12, color: C.txtSec, lineHeight: 1.8 }}>background: color + 10% opacity&emsp;|&emsp;color: solid&emsp;|&emsp;radius: 9999px&emsp;|&emsp;padding: 6px 16px&emsp;|&emsp;font: 12px/600</code>
              </div>
            </Glass>
          </section>

          {/* ════════════════════ ICONS ════════════════════ */}
          <section id="icons" style={{ marginBottom: 72 }}>
            <SectionTitle title="Iconography" sub="Lucide icons exclusively. 1.5px stroke. Default #64748B, active #1D4ED8." />
            <Glass>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 14 }}>
                {[
                  [Home, "Home"], [Calendar, "Calendar"], [Bell, "Bell"], [User, "User"],
                  [Search, "Search"], [Phone, "Phone"], [Video, "Video"], [Building2, "Building"],
                  [Star, "Star"], [Heart, "Heart"], [Brain, "Brain"], [Users, "Users"],
                  [Activity, "Activity"], [Sparkles, "AI"], [Filter, "Filter"], [CreditCard, "Card"],
                  [Shield, "Shield"], [Globe, "Globe"], [Info, "Info"], [Copy, "Copy"],
                  [Check, "Check"], [X, "Close"], [ChevronLeft, "Left"], [ChevronRight, "Right"],
                ].map(([Ic, name], i) => (
                  <div key={i} style={{ textAlign: "center", cursor: "default" }} onMouseEnter={e => e.currentTarget.querySelector('div').style.background = `${C.pri}12`} onMouseLeave={e => e.currentTarget.querySelector('div').style.background = C.white}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: C.white, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,21,81,0.03)" }}>
                      <Ic size={22} strokeWidth={1.5} color={C.txtSec} />
                    </div>
                    <span style={{ fontSize: 10, color: C.txtSec }}>{name}</span>
                  </div>
                ))}
              </div>
            </Glass>
            <div style={{ marginTop: 16 }}>
              <Label>SPECIALTY ICONS</Label>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  [Brain, "الطب النفسي", C.pri], [Heart, "علاج الإدمان", C.sec], [Users, "الأسري", C.purp],
                  [Activity, "السلوكي", "#0D9488"], [MessageCircle, "الإرشاد", "#EC4899"], [HeartHandshake, "الزوجي", C.warn],
                ].map(([Ic, label, c], i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 80 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${c}14`, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)", cursor: "default" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      <Ic size={24} strokeWidth={1.5} color={c} />
                    </div>
                    <span style={{ fontSize: 12, color: C.txt, textAlign: "center", direction: "rtl" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════ RULES ════════════════════ */}
          <section id="rules" style={{ marginBottom: 72 }}>
            <SectionTitle title="Design Guidelines" sub="The non-negotiable rules that make CareKit feel clinical yet premium." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.ok}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} color={C.ok} strokeWidth={2.5} /></div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.ok }}>Do</span>
                </div>
                <Rule type="do" text="Use tonal shifts (white cards on gray) for visual hierarchy" />
                <Rule type="do" text="Use 12-16px spacing gaps instead of divider lines" />
                <Rule type="do" text="Use gradient (135°) for primary buttons and hero areas" />
                <Rule type="do" text="Use Lucide icons at 1.5px stroke consistently" />
                <Rule type="do" text="Right-align everything for RTL Arabic layout" />
                <Rule type="do" text="Use safe area padding (16-20px) on all edges" />
                <Rule type="do" text="Use #191C1E for text — never pure black" />
                <Rule type="do" text="Use Apple Green #84CC16 for positive states & toggles" />
                <Rule type="do" text="Use frosted glass for floating elements (nav, modals)" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.err}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} color={C.err} strokeWidth={2.5} /></div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.err }}>Don't</span>
                </div>
                <Rule type="dont" text="Never use 1px solid borders on sections or cards" />
                <Rule type="dont" text="Never use horizontal dividers between list items" />
                <Rule type="dont" text="Never use drop shadows on buttons" />
                <Rule type="dont" text="Never use pure black (#000000) for text" />
                <Rule type="dont" text="Never place two bold weights adjacent to each other" />
                <Rule type="dont" text="Never use pure black shadows — use #001551 tint" />
                <Rule type="dont" text="Never use flat fills for large primary areas — use gradients" />
                <Rule type="dont" text="Never put a top border on the bottom tab bar" />
                <Rule type="dont" text="Never use inconsistent icon stroke weights" />
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
