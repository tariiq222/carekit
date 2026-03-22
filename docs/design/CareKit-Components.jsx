import { useState } from "react";
import {
  Home, Calendar, MessageCircle, User, Bell, Search, ChevronLeft, ChevronRight,
  Phone, Video, Building2, Star, Clock, Heart, Brain, Users, Activity,
  Shield, HelpCircle, Globe, CreditCard, FileText, Info,
  Camera, Upload, Paperclip, Send, Plus, Trash2, Copy, Check, X,
  Filter, Eye, EyeOff, Stethoscope, HeartHandshake,
  Bot, Sparkles, BellDot
} from "lucide-react";

const T = {
  primary: "#1D4ED8", primaryDark: "#0037B0",
  secondary: "#84CC16", secondaryDark: "#65A30D", secondaryOn: "#365314",
  surface: "#F7F9FB", surfaceLow: "#F2F4F6", white: "#FFFFFF", surfaceHigh: "#E6E8EA",
  text: "#191C1E", textSec: "#64748B", textMuted: "#C4C5D7",
  success: "#059669", warning: "#F59E0B", error: "#DC2626", purple: "#7C3AED",
  shadow: "0 4px 24px rgba(0,21,81,0.04)",
};
const F = "'IBM Plex Sans Arabic', 'DM Sans', system-ui, sans-serif";

function Btn({ children, v = "primary", sm, full, icon: Ic, disabled, onClick }) {
  const bg = { primary: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, secondary: `linear-gradient(135deg,${T.secondaryDark},${T.secondary})`, ghost: "transparent", outline: "transparent", danger: "transparent" };
  const clr = { primary: "#FFF", secondary: "#FFF", ghost: T.primary, outline: T.primary, danger: T.error };
  const bdr = v === "outline" ? `1.5px solid ${T.primary}33` : "none";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      fontFamily: F, fontWeight: 600, border: bdr, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, width: full ? "100%" : "auto", direction: "rtl",
      background: bg[v], color: clr[v], borderRadius: 8,
      padding: sm ? "8px 16px" : "11px 22px", fontSize: sm ? 13 : 14, transition: "all 0.2s",
    }}>
      {children}
      {Ic && <Ic size={sm ? 14 : 16} strokeWidth={1.5} />}
    </button>
  );
}

function Card({ children, style, onClick, selected, p = 16 }) {
  return (
    <div onClick={onClick} style={{
      background: T.white, borderRadius: 8, padding: p, cursor: onClick ? "pointer" : "default",
      border: selected ? `1.5px solid ${T.primary}4D` : "1.5px solid transparent",
      backgroundColor: selected ? `${T.primary}08` : T.white, transition: "all 0.2s", ...style,
    }}>{children}</div>
  );
}

function Input({ label, placeholder, type = "text", suffixIcon: SI }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ direction: "rtl", marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: T.textSec, marginBottom: 6, fontFamily: F, textAlign: "right" }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <input type={type} placeholder={placeholder} onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ width: "100%", boxSizing: "border-box", background: T.surfaceHigh, borderRadius: 8, border: f ? `1.5px solid ${T.primary}66` : "1.5px solid transparent", padding: "12px 14px", paddingLeft: SI ? 40 : 14, fontSize: 14, color: T.text, fontFamily: F, direction: "rtl", outline: "none" }} />
        {SI && <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec }}><SI size={18} strokeWidth={1.5} /></div>}
      </div>
    </div>
  );
}

function Pill({ text, color = T.success }) {
  return <span style={{ display: "inline-flex", background: `${color}1A`, color, borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, fontFamily: F }}>{text}</span>;
}

function Avatar({ size = 48, name = "", color = T.primary }) {
  return (
    <div style={{ width: size, height: size, minWidth: size, borderRadius: "50%", background: `linear-gradient(135deg,${color}22,${color}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color, fontFamily: F }}>
      {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
    </div>
  );
}

function Seg({ options, active, onChange }) {
  return (
    <div style={{ display: "flex", background: T.surfaceLow, borderRadius: 999, padding: 3, gap: 2, direction: "rtl" }}>
      {options.map((o, i) => (
        <button key={i} onClick={() => onChange(i)} style={{
          flex: 1, padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer",
          background: active === i ? T.white : "transparent", boxShadow: active === i ? T.shadow : "none",
          color: active === i ? T.primary : T.textSec, fontSize: 13, fontWeight: active === i ? 600 : 400, fontFamily: F,
        }}>{o}</button>
      ))}
    </div>
  );
}

function Chips({ options, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, direction: "rtl", overflowX: "auto", paddingBottom: 4 }}>
      {options.map((o, i) => (
        <button key={i} onClick={() => onChange(i)} style={{
          whiteSpace: "nowrap", padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer",
          background: active === i ? T.primary : T.white, color: active === i ? "#FFF" : T.text,
          fontSize: 13, fontWeight: 500, fontFamily: F,
        }}>{o}</button>
      ))}
    </div>
  );
}

function TabBar({ tabs, active, onChange, onAI }) {
  const icons = { "الرئيسية": Home, "مواعيدي": Calendar, "الإشعارات": BellDot, "حسابي": User, "اليوم": Home, "التقويم": Calendar, "المرضى": Users };
  const all = [{ l: tabs[0] }, { l: tabs[1] }, { l: "AI", ai: true }, { l: tabs[2] }, { l: tabs[3] }];
  return (
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: "6px 0 10px", direction: "rtl" }}>
      {all.map((item, i) => {
        if (item.ai) return (
          <button key={i} onClick={onAI} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", marginTop: -14 }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${T.primary}33` }}>
              <Sparkles size={20} strokeWidth={1.8} color="#FFF" />
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: T.primary, fontFamily: F, marginTop: 2 }}>المساعد</span>
          </button>
        );
        const ti = i < 2 ? i : i - 1;
        const act = active === ti;
        const Ic = icons[item.l] || Home;
        return (
          <button key={i} onClick={() => onChange(ti)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: act ? T.primary : T.textSec, fontSize: 10, fontWeight: act ? 600 : 400, fontFamily: F, padding: "4px 0" }}>
            <Ic size={22} strokeWidth={act ? 2 : 1.5} /><span>{item.l}</span>
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ title, back, leftIcon: LI }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {back && <ChevronRight size={22} strokeWidth={1.5} color={T.text} style={{ cursor: "pointer" }} />}
        <span style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: F }}>{title}</span>
      </div>
      {LI && <LI size={22} strokeWidth={1.5} color={T.text} style={{ cursor: "pointer" }} />}
    </div>
  );
}

function MenuRow({ icon: Ic, label, value, danger }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.white, borderRadius: 8, padding: "14px 16px", direction: "rtl", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Ic size={20} strokeWidth={1.5} color={danger ? T.error : T.textSec} />
        <span style={{ fontSize: 14, color: danger ? T.error : T.text, fontFamily: F }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {value && <span style={{ fontSize: 13, color: T.textSec, fontFamily: F }}>{value}</span>}
        {!danger && <ChevronLeft size={16} color={T.textMuted} />}
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 44, height: 24, borderRadius: 12, background: on ? T.secondary : T.surfaceHigh, border: "none", cursor: "pointer", position: "relative", padding: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#FFF", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", position: "absolute", top: 3, right: on ? 3 : "auto", left: on ? "auto" : 3, transition: "all 0.25s" }} />
    </button>
  );
}

function AIChatOverlay({ onClose }) {
  const msgs = [
    { bot: true, t: "أهلاً! أنا المساعد الذكي لمركز كير كت. كيف أقدر أساعدك؟ 🏥" },
    { bot: false, t: "أبي أحجز موعد نفسي" },
    { bot: true, t: "بالتأكيد! عندنا ٣ معالجين متاحين في الطب النفسي. تبي أعرضهم لك؟" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: T.surface, display: "flex", flexDirection: "column", zIndex: 100, maxWidth: 390, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", direction: "rtl", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={18} color="#FFF" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: F }}>المساعد الذكي</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.secondary }} />
              <span style={{ fontSize: 11, color: T.secondary, fontFamily: F }}>متصل</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={22} strokeWidth={1.5} color={T.textSec} /></button>
      </div>
      <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, direction: "rtl" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.bot ? "flex-start" : "flex-end", maxWidth: "82%", background: m.bot ? `${T.primary}12` : T.white, boxShadow: !m.bot ? T.shadow : "none", borderRadius: m.bot ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "11px 15px", fontSize: 14, color: T.text, fontFamily: F, lineHeight: 1.6 }}>{m.t}</div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {["نعم، اعرضهم", "ابحث بالاسم", "خدمات ثانية"].map((q, i) => (
            <button key={i} style={{ padding: "7px 14px", borderRadius: 999, background: T.white, border: "none", color: T.primary, fontSize: 12, fontWeight: 500, fontFamily: F, cursor: "pointer", boxShadow: T.shadow }}>{q}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "12px 20px 16px", direction: "rtl", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", gap: 10 }}>
        <Paperclip size={20} strokeWidth={1.5} color={T.textSec} style={{ cursor: "pointer" }} />
        <div style={{ flex: 1, background: T.surfaceLow, borderRadius: 999, padding: "10px 16px", fontSize: 14, color: T.textMuted, fontFamily: F }}>اكتب رسالتك...</div>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Send size={16} color="#FFF" strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
        </div>
      </div>
    </div>
  );
}

const SECS = ["الألوان", "الأزرار", "البطاقات", "المدخلات", "التنقل", "المعالجين", "الحالات", "عناصر أخرى"];

const FontLoader = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');`}</style>
);

export default function App() {
  const [sec, setSec] = useState(0);
  const [seg, setSeg] = useState(0);
  const [chip, setChip] = useState(0);
  const [tab, setTab] = useState(0);
  const [slot, setSlot] = useState(2);
  const [tog, setTog] = useState(true);
  const [sel, setSel] = useState(1);
  const [ai, setAi] = useState(false);

  const H3 = ({ children }) => <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12, fontFamily: F }}>{children}</h3>;
  const Lbl = ({ children }) => <span style={{ fontSize: 11, color: T.textSec, textTransform: "uppercase", letterSpacing: 1, display: "block", margin: "16px 0 8px" }}>{children}</span>;

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", background: T.surface, minHeight: "100vh", fontFamily: F, direction: "rtl", position: "relative" }}>
      <FontLoader />
      {ai && <AIChatOverlay onClose={() => setAi(false)} />}

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, padding: "28px 20px 20px", borderRadius: "0 0 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Stethoscope size={22} strokeWidth={1.5} color="#FFF" />
          <span style={{ fontSize: 22, fontWeight: 700, color: "#FFF" }}>CareKit</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#FFF", background: T.secondary, borderRadius: 4, padding: "2px 8px" }}>v2</span>
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>IBM Plex Sans Arabic + DM Sans — Component Library</span>
      </div>

      {/* Section Nav */}
      <div style={{ display: "flex", gap: 6, padding: "16px 20px 8px", overflowX: "auto" }}>
        {SECS.map((s, i) => (
          <button key={i} onClick={() => setSec(i)} style={{ whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", background: sec === i ? T.primary : T.white, color: sec === i ? "#FFF" : T.text, fontSize: 12, fontWeight: 500, fontFamily: F }}>{s}</button>
        ))}
      </div>

      <div style={{ padding: "12px 20px 100px" }}>
        {/* COLORS */}
        {sec === 0 && <div>
          <H3>الألوان الأساسية</H3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["Primary", "#1D4ED8", T.primary], ["Primary Dark", "#0037B0", T.primaryDark], ["Secondary تفاحي", "#84CC16", T.secondary], ["Secondary Dark", "#65A30D", T.secondaryDark]].map(([n, h, c], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: c }} />
                <div><div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{n}</div><div style={{ fontSize: 11, color: T.textSec }}>{h}</div></div>
              </div>
            ))}
          </div>
          <Lbl>ألوان دلالية</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["Success", "#059669", T.success], ["Warning", "#F59E0B", T.warning], ["Error", "#DC2626", T.error], ["Purple", "#7C3AED", T.purple], ["Text", "#191C1E", T.text], ["Text Sec", "#64748B", T.textSec]].map(([n, h, c], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: c }} />
                <div><div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{n}</div><div style={{ fontSize: 11, color: T.textSec }}>{h}</div></div>
              </div>
            ))}
          </div>
          <Lbl>التدرجات</Lbl>
          <div style={{ height: 48, borderRadius: 12, background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><span style={{ color: "#FFF", fontSize: 12 }}>Primary — #0037B0 → #1D4ED8</span></div>
          <div style={{ height: 48, borderRadius: 12, background: `linear-gradient(135deg,${T.secondaryDark},${T.secondary})`, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#FFF", fontSize: 12 }}>Secondary — #65A30D → #84CC16</span></div>
        </div>}

        {/* BUTTONS */}
        {sec === 1 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <H3>الأزرار</H3>
          <Lbl>PRIMARY أزرق</Lbl>
          <Btn full>احجز موعد</Btn>
          <Btn sm>احجز الآن</Btn>
          <Lbl>SECONDARY تفاحي</Lbl>
          <Btn v="secondary" full>ابدأ الآن</Btn>
          <Btn v="secondary" sm>متاح</Btn>
          <Lbl>OUTLINE</Lbl>
          <Btn v="outline" full icon={Calendar}>إضافة للتقويم</Btn>
          <Lbl>GHOST + DANGER</Lbl>
          <div style={{ display: "flex", gap: 12 }}><Btn v="ghost">عرض التفاصيل</Btn><Btn v="danger">إلغاء</Btn></div>
          <Lbl>DISABLED</Lbl>
          <Btn full disabled>التالي</Btn>
        </div>}

        {/* CARDS */}
        {sec === 2 && <div>
          <H3>البطاقات</H3>
          <Card><div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4, fontFamily: F }}>بطاقة بدون حدود</div><div style={{ fontSize: 13, color: T.textSec, fontFamily: F }}>أبيض على رمادي — بدون أي border</div></Card>
          <Lbl>بطاقات اختيار</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ ic: Building2, t: "موعد عيادة", d: "زيارة شخصية", p: "٢٥٠ ر.س" }, { ic: Phone, t: "استشارة هاتفية", d: "المعالج يتصل بك", p: "١٨٠ ر.س" }, { ic: Video, t: "استشارة مرئية", d: "عبر Zoom", p: "٢٢٠ ر.س" }].map((item, i) => (
              <Card key={i} selected={sel === i} onClick={() => setSel(i)} p={18}>
                <div style={{ display: "flex", gap: 14, direction: "rtl" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${T.primary}14`, display: "flex", alignItems: "center", justifyContent: "center" }}><item.ic size={20} strokeWidth={1.5} color={T.primary} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: F }}>{item.t}</div><div style={{ fontSize: 12, color: T.textSec, fontFamily: F }}>{item.d}</div></div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.primary, fontFamily: F }}>{item.p}</div>
                </div>
              </Card>
            ))}
          </div>
          <Lbl>بانر ترويجي</Lbl>
          <div style={{ background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, borderRadius: 12, padding: "20px 18px", direction: "rtl" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFF", marginBottom: 4, fontFamily: F }}>احجز استشارتك الأولى بخصم ٢٠٪</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 12, fontFamily: F }}>عرض محدود</div>
            <button style={{ background: T.secondary, color: "#FFF", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>احجز الآن</button>
          </div>
        </div>}

        {/* INPUTS */}
        {sec === 3 && <div>
          <H3>المدخلات</H3>
          <Input label="البريد الإلكتروني" placeholder="example@email.com" />
          <Input label="كلمة المرور" placeholder="••••••••" type="password" suffixIcon={EyeOff} />
          <Input label="الاسم الكامل" placeholder="أدخل اسمك الكامل" />
          <Lbl>شريط البحث</Lbl>
          <div style={{ background: T.white, borderRadius: 8, boxShadow: T.shadow, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, direction: "rtl" }}>
            <Search size={18} strokeWidth={1.5} color={T.textSec} /><span style={{ color: T.textMuted, fontSize: 14, fontFamily: F }}>ابحث عن معالج أو خدمة...</span>
          </div>
          <Lbl>OTP</Lbl>
          <div style={{ display: "flex", gap: 10, direction: "ltr", justifyContent: "center" }}>
            {[1, 4, "", "", "", ""].map((d, i) => (
              <div key={i} style={{ width: 46, height: 52, borderRadius: 8, background: T.surfaceHigh, border: i === 2 ? `1.5px solid ${T.primary}66` : "1.5px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: T.text, fontFamily: F }}>{d}</div>
            ))}
          </div>
        </div>}

        {/* NAVIGATION */}
        {sec === 4 && <div>
          <H3>عناصر التنقل</H3>
          <Lbl>شريط علوي</Lbl>
          <Card p={0}><div style={{ padding: "0 12px" }}><TopBar title="المعالجين" back leftIcon={Filter} /></div></Card>
          <Lbl>التبويب المجزأ</Lbl>
          <Seg options={["القادمة", "السابقة", "الملغاة"]} active={seg} onChange={setSeg} />
          <Lbl>فلاتر</Lbl>
          <Chips options={["الكل", "متاح اليوم", "الأعلى تقييماً", "الأقل سعراً"]} active={chip} onChange={setChip} />
          <Lbl>✅ شريط سفلي — 5 عناصر + AI وسط</Lbl>
          <Card p={0} style={{ overflow: "hidden" }}>
            <TabBar tabs={["الرئيسية", "مواعيدي", "الإشعارات", "حسابي"]} active={tab} onChange={setTab} onAI={() => setAi(true)} />
          </Card>
          <div style={{ fontSize: 12, color: T.secondary, fontFamily: F, marginTop: 8, textAlign: "center" }}>👆 اضغط زر المساعد في الوسط لتجربة الشات</div>
          <Lbl>التخصصات</Lbl>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {[[Brain, "الطب النفسي", T.primary], [Heart, "علاج الإدمان", T.secondary], [Users, "العلاج الأسري", T.purple], [Activity, "السلوكي", "#0D9488"]].map(([Ic, n, c], i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 76, padding: "12px 8px", background: T.white, borderRadius: 20, cursor: "pointer" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${c}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={20} strokeWidth={1.5} color={c} /></div>
                <span style={{ fontSize: 11, color: T.text, fontWeight: 500, fontFamily: F, textAlign: "center" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>}

        {/* PRACTITIONERS */}
        {sec === 5 && <div>
          <H3>بطاقات المعالجين</H3>
          {[{ n: "د. أحمد الشمري", s: "طب نفسي", r: "٤.٨", rv: "١٢٣", p: "٢٥٠", a: true }, { n: "د. سارة الأحمد", s: "العلاج الأسري", r: "٤.٦", rv: "٨٧", p: "٣٥٠", a: false }].map((d, i) => (
            <Card key={i} style={{ direction: "rtl", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <Avatar size={48} name={d.n} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: F }}>{d.n}</div>
                  <div style={{ fontSize: 13, color: T.textSec, fontFamily: F, marginBottom: 4 }}>{d.s}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                    <Star size={13} fill={T.warning} color={T.warning} /><span style={{ fontSize: 13, color: T.text, fontFamily: F }}>{d.r}</span><span style={{ fontSize: 12, color: T.textSec, fontFamily: F }}>({d.rv} تقييم)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.primary, fontFamily: F }}>{d.p} ر.س</span>
                      <Pill text={d.a ? "متاح اليوم" : "أقرب موعد: الأحد"} color={d.a ? T.secondary : T.warning} />
                    </div>
                    <Btn sm>احجز الآن</Btn>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <Lbl>مصغرة (سكرول أفقي)</Lbl>
          <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
            {[["د. أحمد", "طب نفسي", "٤.٨", "٢٥٠"], ["د. نورة", "إرشاد", "٤.٩", "٢٠٠"], ["د. فهد", "سلوكي", "٤.٧", "٢٨٠"]].map(([n, s, r, p], i) => (
              <Card key={i} style={{ minWidth: 155, direction: "rtl" }} p={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Avatar size={36} name={n} color={[T.primary, T.secondary, T.purple][i]} />
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: F }}>{n}</div><div style={{ fontSize: 11, color: T.textSec, fontFamily: F }}>{s}</div></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}><Star size={12} fill={T.warning} color={T.warning} /><span style={{ fontSize: 12, fontFamily: F }}>{r}</span></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, fontFamily: F }}>من {p} ر.س</span>
                </div>
              </Card>
            ))}
          </div>
          <Lbl>الأفاتار</Lbl>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Avatar size={32} name="طارق م" /><Avatar size={48} name="أحمد ش" color={T.secondary} /><Avatar size={64} name="سارة أ" color={T.purple} /><Avatar size={80} name="نورة خ" color={T.secondaryDark} />
          </div>
        </div>}

        {/* STATUS */}
        {sec === 6 && <div>
          <H3>حالات الشارات</H3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            <Pill text="مؤكد" color={T.success} /><Pill text="بانتظار التأكيد" color={T.warning} /><Pill text="ملغي" color={T.error} /><Pill text="قادم" color={T.primary} /><Pill text="متاح اليوم" color={T.secondary} /><Pill text="مكتمل" color={T.success} /><Pill text="لاحقاً" color={T.textSec} /><Pill text="مرئي" color={T.purple} />
          </div>
          <H3>الإشعارات</H3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[[Check, T.primary, "تم تأكيد حجزك مع د. أحمد — الأحد ١٠:٠٠ ص", "منذ ساعة", true], [CreditCard, T.secondary, "تم استلام الدفعة ٢٠٧ ر.س بنجاح", "منذ ساعة", true], [Bell, T.warning, "تذكير: موعدك مع د. سارة غداً", "أمس ٤:٠٠ م", false]].map(([Ic, c, t, tm, u], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: T.white, borderRadius: 8, padding: "14px 16px", direction: "rtl", position: "relative" }}>
                {u && <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, position: "absolute", top: 16, right: 8 }} />}
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${c}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: u ? 8 : 0 }}><Ic size={16} strokeWidth={1.5} color={c} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: u ? T.text : T.textSec, fontFamily: F, fontWeight: u ? 500 : 400 }}>{t}</div><div style={{ fontSize: 11, color: T.textSec, fontFamily: F, marginTop: 2 }}>{tm}</div></div>
              </div>
            ))}
          </div>
          <Lbl>شاشة النجاح</Lbl>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: T.secondary, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={32} color="#FFF" strokeWidth={2.5} /></div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: F }}>تم الحجز بنجاح! ✅</div>
            <div style={{ fontSize: 13, color: T.textSec, fontFamily: F, marginTop: 4 }}>رقم المرجع: CK-2026-00451</div>
          </div>
        </div>}

        {/* OTHER */}
        {sec === 7 && <div>
          <H3>عناصر أخرى</H3>
          <Lbl>فتحات الوقت</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
            {["٩:٠٠ ص", "٩:٣٠ ص", "١٠:٠٠ ص", "١٠:٣٠ ص", "١١:٠٠ ص", "٢:٠٠ م"].map((t, i) => (
              <button key={i} onClick={i !== 4 ? () => setSlot(i) : undefined} style={{
                padding: "10px 8px", borderRadius: 8, border: "none", cursor: i === 4 ? "not-allowed" : "pointer",
                background: slot === i ? `linear-gradient(135deg,${T.primaryDark},${T.primary})` : i === 4 ? T.surfaceLow : T.white,
                color: slot === i ? "#FFF" : i === 4 ? T.textMuted : T.text, fontSize: 13, fontWeight: slot === i ? 600 : 400, fontFamily: F,
              }}>{t}</button>
            ))}
          </div>
          <Lbl>مفتاح التبديل</Lbl>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, direction: "rtl" }}>
            <Toggle on={tog} onChange={setTog} />
            <span style={{ fontSize: 14, color: T.text, fontFamily: F }}>{tog ? "مفعّل" : "معطّل"}</span>
          </div>
          <Lbl>قائمة الحساب</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <MenuRow icon={User} label="معلوماتي الشخصية" /><MenuRow icon={CreditCard} label="المدفوعات والفواتير" /><MenuRow icon={Bell} label="الإشعارات" /><MenuRow icon={Globe} label="اللغة" value="العربية" /><MenuRow icon={Info} label="عن المركز" />
          </div>
          <Lbl>فقاعات الشات</Lbl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, direction: "rtl" }}>
            <div style={{ alignSelf: "flex-start", maxWidth: "80%", background: `${T.primary}12`, borderRadius: "16px 16px 4px 16px", padding: "10px 14px", fontSize: 14, color: T.text, fontFamily: F }}>أهلاً! كيف أقدر أساعدك؟ 🏥</div>
            <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: T.white, boxShadow: T.shadow, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 14, color: T.text, fontFamily: F }}>أبي أحجز موعد نفسي</div>
          </div>
          <Lbl>التقييم بالنجوم</Lbl>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={36} strokeWidth={1.5} fill={i <= 4 ? T.warning : "none"} color={i <= 4 ? T.warning : T.surfaceHigh} />)}
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: T.text, fontFamily: F, marginTop: 6 }}>جيد جداً</div>
        </div>}
      </div>

      {!ai && <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", maxWidth: 390, width: "100%" }}>
        <TabBar tabs={["الرئيسية", "مواعيدي", "الإشعارات", "حسابي"]} active={tab} onChange={setTab} onAI={() => setAi(true)} />
      </div>}
    </div>
  );
}
