import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';

// Color tokens — light steel + hazard amber identity, zero shadcn/tailwind dependency.
const C = {
  bg:        'oklch(0.98 0.004 256)',
  surface:   'oklch(0.93 0.007 256)',
  border:    'oklch(0.86 0.008 256)',
  ink:       'oklch(0.14 0.012 256)',
  muted:     'oklch(0.42 0.014 256)',
  amber:     'oklch(0.705 0.172 58)',
  amberText: 'oklch(0.52 0.16  58)',
  amberFg:   'oklch(0.12 0.02  60)',
  amberBg:   'oklch(0.705 0.172 58 / 0.09)',
} as const;

// Scroll-reveal: transform-only for feature sections (always visible for full-page
// screenshots where IntersectionObserver never fires); opacity+transform for hero.
function useReveal(delayMs = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const tid = setTimeout(() => setVisible(true), delayMs);
          obs.disconnect();
          return () => clearTimeout(tid);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delayMs]);

  return { ref, visible };
}

// Tracks the user's motion preference reactively so choreography can stand down.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// Page-scoped motion CSS. Inline styles can't express :hover/:active/keyframes,
// so the interaction + atmospheric layer lives here. Reduced-motion strips the
// movement but keeps the shadow cue, so affordances still read.
const MOTION_CSS = `
.ts-cta {
  transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s cubic-bezier(.16,1,.3,1);
}
.ts-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 28px oklch(0.705 0.172 58 / 0.34); }
.ts-cta:active { transform: translateY(0) scale(.97); box-shadow: 0 3px 10px oklch(0.705 0.172 58 / 0.26); }

.ts-frame {
  box-shadow: 0 24px 72px oklch(0.14 0.012 256 / 0.13);
  transition: transform .45s cubic-bezier(.16,1,.3,1), box-shadow .45s cubic-bezier(.16,1,.3,1);
}
.ts-frame:hover { transform: translateY(-6px); box-shadow: 0 40px 100px oklch(0.14 0.012 256 / 0.2); }

@keyframes ts-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.ts-pulse { animation: ts-pulse 2.4s cubic-bezier(.45,0,.55,1) infinite; }

@media (prefers-reduced-motion: reduce) {
  .ts-cta:hover, .ts-cta:active, .ts-frame:hover { transform: none !important; }
  .ts-cta, .ts-frame { transition: box-shadow .2s linear !important; }
  .ts-pulse { animation: none !important; }
}
`;

// Browser chrome — wraps screenshots with a light steel frame and depth shadow.
function AppFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      className="ts-frame"
      style={{
        overflow: 'hidden',
        borderRadius: '10px',
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 14px',
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span style={{ display: 'block', width: 12, height: 12, borderRadius: '50%', background: 'oklch(0.65 0.19 22)' }} />
        <span style={{ display: 'block', width: 12, height: 12, borderRadius: '50%', background: 'oklch(0.72 0.18 70)' }} />
        <span style={{ display: 'block', width: 12, height: 12, borderRadius: '50%', background: 'oklch(0.60 0.19 145)' }} />
        <span
          style={{
            marginLeft: 10,
            height: 18,
            width: 160,
            borderRadius: 4,
            background: C.border,
            display: 'block',
          }}
        />
      </div>
      <img src={src} alt={alt} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}

// Sale receipt — white card with UK brands and VAT/Bank Transfer fields.
function SaleReceipt() {
  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        fontFamily: '"JetBrains Mono Variable", monospace',
        boxShadow: '0 20px 56px oklch(0.14 0.012 256 / 0.11)',
        background: 'oklch(0.99 0.002 256)',
      }}
    >
      {/* Receipt header */}
      <div
        style={{
          padding: '14px 18px',
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted }}>
          TyreStock POS
        </span>
        <span style={{ fontSize: 10, color: C.muted }}>INV-2026-0081</span>
      </div>

      {/* Line items */}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { sku: 'MCH-PRIM4-19565R15', qty: 2, unit: '£89.99', total: '£179.98' },
          { sku: 'DUN-SP-MAXX-20560R16', qty: 1, unit: '£112.50', total: '£112.50' },
        ].map((item) => (
          <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.ink, margin: 0 }}>{item.sku}</p>
              <p style={{ fontSize: 11, color: C.muted, margin: '3px 0 0' }}>
                {item.qty} × {item.unit}
              </p>
            </div>
            <span style={{ fontSize: 13, color: C.ink, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {item.total}
            </span>
          </div>
        ))}

        {/* Totals */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: C.muted }}>VAT (20%)</span>
            <span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>£58.50</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.amberText }}>Grand total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.amberText, fontVariantNumeric: 'tabular-nums' }}>£350.98</span>
          </div>
        </div>

        {/* Payment pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 999,
            background: C.amberBg,
            border: `1px solid oklch(0.705 0.172 58 / 0.3)`,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: C.amberText,
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          <span className="ts-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, display: 'block', flexShrink: 0 }} />
          Bank Transfer · Confirmed
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 600);
  const reduced = usePrefersReducedMotion();

  const hero    = useReveal(0);
  const heroImg = useReveal(120);
  const feat1   = useReveal(0);
  const feat2   = useReveal(0);
  const feat3   = useReveal(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 599px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const px = 'clamp(1.5rem, 5vw, 3.5rem)';
  const sectionPy = 'clamp(4rem, 10vh, 7rem)';

  const revealStyle = (v: { visible: boolean }, opacity = true) => {
    if (reduced) return undefined;
    return {
      ...(opacity ? { opacity: v.visible ? 1 : 0 } : {}),
      transform: v.visible ? 'none' : 'translateY(28px)',
      transition: v.visible
        ? `${opacity ? 'opacity 0.5s ease, ' : ''}transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)`
        : 'none',
    } as React.CSSProperties;
  };

  // Hero choreography: the left column reveals as a sequence (eyebrow → headline →
  // body → CTA), each child offset by `i` so the fold composes itself on load
  // instead of arriving as one slab. The signature page-load moment.
  const heroChild = (i: number): React.CSSProperties | undefined => {
    if (reduced) return undefined;
    const delay = `${i * 90}ms`;
    return {
      opacity: hero.visible ? 1 : 0,
      transform: hero.visible ? 'none' : 'translateY(18px)',
      transition: hero.visible
        ? `opacity 0.55s ease ${delay}, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}`
        : 'none',
    };
  };

  const featureGrid: React.CSSProperties = {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
    gap: 'clamp(3rem, 7vw, 5rem)',
    alignItems: 'center',
  };

  const h2Style: React.CSSProperties = {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.025em',
    marginBottom: '1.25rem',
    textWrap: 'balance',
    color: C.ink,
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: '1rem',
    lineHeight: 1.75,
    color: C.muted,
    maxWidth: '44ch',
    marginBottom: '1.5rem',
  };

  const ctaLink: React.CSSProperties = {
    display: 'inline-block',
    padding: '14px 30px',
    background: C.amber,
    color: C.amberFg,
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 4,
    textDecoration: 'none',
    fontFamily: '"Archivo Variable", system-ui, sans-serif',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: '"Archivo Variable", system-ui, sans-serif', minHeight: '100vh' }}>
      <style>{MOTION_CSS}</style>

      {/* Amber brand stripe at the very top of the page */}
      <div style={{ height: 3, background: C.amber, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }} />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'fixed',
          top: 3, left: 0, right: 0,
          zIndex: 40,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${px}`,
          background: scrolled ? 'oklch(0.99 0.002 256 / 0.95)' : 'oklch(0.98 0.004 256 / 0.92)',
          borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
          backdropFilter: 'blur(12px)',
          boxShadow: scrolled ? '0 1px 12px oklch(0.14 0.012 256 / 0.06)' : 'none',
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 32, height: 2, background: C.amber }} />
          <span
            style={{
              fontFamily: '"JetBrains Mono Variable", monospace',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: C.amberText,
            }}
          >
            TyreStock
          </span>
        </div>
        <Link
          to="/login"
          className="ts-cta"
          style={{
            padding: '8px 18px',
            background: C.amber,
            color: C.amberFg,
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 4,
            textDecoration: 'none',
            fontFamily: 'inherit',
          }}
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          padding: `clamp(5rem, 12vh, 9rem) ${px} clamp(4rem, 8vh, 6rem)`,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
            gap: 'clamp(3rem, 8vw, 6rem)',
            alignItems: 'center',
          }}
        >
          {/* Left */}
          <div ref={hero.ref}>
            <p
              style={{
                fontFamily: '"JetBrains Mono Variable", monospace',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: C.amberText,
                marginBottom: '1.5rem',
                ...heroChild(0),
              }}
            >
              Inventory · POS · Stock alerts
            </p>
            <h1
              style={{
                fontSize: 'clamp(2.6rem, 6.5vw, 4.75rem)',
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: '-0.03em',
                marginBottom: '1.5rem',
                textWrap: 'balance',
                color: C.ink,
                ...heroChild(1),
              } as React.CSSProperties}
            >
              Stop guessing{' '}
              <span style={{ position: 'relative', color: C.amberText, whiteSpace: 'nowrap' }}>
                what's on
                {/* Underline draws itself in, left to right, once the headline settles. */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '0.05em',
                    height: 3,
                    background: C.amber,
                    transformOrigin: 'left center',
                    transform: reduced || hero.visible ? 'scaleX(1)' : 'scaleX(0)',
                    transition: reduced ? 'none' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
                  }}
                />
              </span>
              {' '}the rack.
            </h1>
            <p
              style={{
                fontSize: '1.125rem',
                lineHeight: 1.7,
                color: C.muted,
                maxWidth: '48ch',
                marginBottom: '2.5rem',
                ...heroChild(2),
              }}
            >
              TyreStock replaces the paper stock book and the spreadsheet.
              Track every tyre variant, ring up sales in under a minute, and
              get low-stock alerts before the shelf is empty.
            </p>
            <div style={heroChild(3)}>
              <Link to="/login" className="ts-cta" style={ctaLink}>
                Sign in to your shop
              </Link>
            </div>
          </div>

          {/* Right — dashboard screenshot */}
          <div ref={heroImg.ref} style={revealStyle(heroImg)}>
            <AppFrame
              src="/screenshots/dashboard.png"
              alt="TyreStock dashboard showing KPI cards, sales trend chart, and top-selling brand rankings"
            />
          </div>
        </div>
      </section>

      {/* ── Feature 1: Inventory ─────────────────────────────────────────────── */}
      <section style={{ padding: `${sectionPy} ${px}`, borderTop: `1px solid ${C.border}` }}>
        <div ref={feat1.ref} style={{ ...featureGrid, ...revealStyle(feat1, false) }}>
          <div>
            <h2 style={h2Style}>
              Every variant,<br />right where you expect it.
            </h2>
            <p style={bodyStyle}>
              Search by brand, size, or SKU. See on-hand quantity, reorder level,
              and rack location at a glance. Rows flag low or zero stock in amber and red
              so nothing slips through.
            </p>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 2.5rem' }}>
              {([
                ['SKU search', 'Find any variant in seconds'],
                ['Rack location', 'Know exactly where it lives'],
                ['Bulk adjust', 'Correct counts after a stocktake'],
                ['Audit trail', 'Full movement log per SKU'],
              ] as const).map(([label, desc]) => (
                <div key={label}>
                  <dt style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: C.ink }}>{label}</dt>
                  <dd style={{ fontSize: 13, color: C.muted, margin: 0 }}>{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
          <AppFrame
            src="/screenshots/inventory.png"
            alt="Inventory table showing tyre variants with quantities, reorder thresholds, and status badges"
          />
        </div>
      </section>

      {/* ── Feature 2: POS ───────────────────────────────────────────────────── */}
      <section style={{ padding: `${sectionPy} ${px}`, borderTop: `1px solid ${C.border}` }}>
        <div ref={feat2.ref} style={{ ...featureGrid, ...revealStyle(feat2, false) }}>
          {/* Receipt appears left on desktop */}
          <div>
            <SaleReceipt />
          </div>
          <div>
            <h2 style={h2Style}>
              A sale in under<br />a minute.
            </h2>
            <p style={bodyStyle}>
              Search tyres, add to cart, select payment method.
              A VAT-ready invoice is generated on checkout and stock adjusts
              automatically. No double entry, no paper ledger to update later.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Prints a VAT-ready invoice on checkout',
                'Cash, card, and bank transfer built in',
                'Customer history attached to every sale',
              ].map((item) => (
                <li
                  key={item}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: C.muted }}
                >
                  <span style={{ flexShrink: 0, display: 'block', width: 16, height: 2, background: C.amber }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Feature 3: Alerts ────────────────────────────────────────────────── */}
      <section style={{ padding: `${sectionPy} ${px}`, borderTop: `1px solid ${C.border}` }}>
        <div ref={feat3.ref} style={{ ...featureGrid, ...revealStyle(feat3, false) }}>
          <div>
            <h2 style={h2Style}>
              Know before<br />you run out.
            </h2>
            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              Set a reorder level per variant once. TyreStock watches every
              stock movement and raises an alert the moment a SKU dips below
              its threshold. Acknowledge it, place the order, mark it resolved.
            </p>
          </div>
          <AppFrame
            src="/screenshots/alerts.png"
            alt="Alerts page listing low-stock and out-of-stock items with current quantities and thresholds"
          />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: `1.5rem ${px}`,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 12 : 0,
          background: C.bg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 2, background: C.amber }} />
          <span
            style={{
              fontFamily: '"JetBrains Mono Variable", monospace',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: C.amberText,
            }}
          >
            TyreStock
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <p
            style={{
              fontFamily: '"JetBrains Mono Variable", monospace',
              fontSize: 11,
              color: C.muted,
              margin: 0,
            }}
          >
            © 2026 TyreStock
          </p>
          <Link
            to="/admin/login"
            style={{
              fontFamily: '"JetBrains Mono Variable", monospace',
              fontSize: 10,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'oklch(0.42 0.014 256 / 0.45)',
              textDecoration: 'none',
            }}
          >
            Platform admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
