import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { CheckCircle2, AlertTriangle, MessageCircle } from 'lucide-react';

import { Header } from './components/Header';
import { ChatWidget } from './components/ChatWidget';
import { HeroSection } from './components/HeroSection';
import { TodaySpecialOffers } from './components/TodaySpecialOffers';
import { HowItWorks } from './components/HowItWorks';
import { AboutSection } from './components/AboutSection';
import { Footer } from './components/Footer';
import { OrderTypeSelection } from './components/OrderTypeSelection';
import { DietTypeSelection } from './components/DietTypeSelection';
import { DeliveryTypeSelection } from './components/DeliveryTypeSelection';
import { GuestDetailsModal } from './components/GuestDetailsModal';
import { MenuSection } from './components/MenuSection';
import { PlanPreview } from './components/PlanPreview';
import { PlanReviewStep } from './components/PlanReviewStep';
import { CartDrawer } from './components/CartDrawer';
import { OrderReview } from './components/OrderReview';
import { TermsModal } from './components/TermsModal';
import { AboutPage } from './components/AboutPage';
import { OrderHistoryPage } from './components/OrderHistoryPage';

import { LANGUAGES, useTranslation } from './i18n/translations';
import { addOrderToHistory, getOrderHistory } from './lib/orderHistory';
import { formatOrderNumber } from './lib/orderNumber';

// ── Flow steps ────────────────────────────────────────────────────────────────
// 'hero'            → landing page (Hero + Special Offers + How it works + About)
// 'order_type'      → Select an order type screen (12-day plan / one-time)
// 'diet_type_select'→ (12-day) pick which restaurant/diet-type's plan to preview
// 'plan_preview'    → (12-day) real date-based plan: day tabs at the top, guest can
//                     swap each meal slot among admin's ≤3 options, plus an always-
//                     visible "recommended extra" section → Confirm → guest details
// 'plan_review'     → (12-day) day-by-day summary + terms + Pay → Hipay checkout
// 'menu'            → (one-time) full menu, cart, "Continue" once cart has items
// 'delivery_type'   → (one-time) hotel room vs current location
// 'confirmation'    → order/plan confirmed (payment collected via Hipay)
// 'order_history'   → browser-remembered list of this guest's past orders (Header button)
// ─────────────────────────────────────────────────────────────────────────────
const FLOW_STEPS = ['hero', 'about_us', 'order_type', 'diet_type_select', 'plan_preview', 'plan_review', 'menu', 'delivery_type', 'order_review', 'confirmation', 'order_history'];
const pathForStep = (step) => (step === 'hero' ? '/' : `/${step}`) + window.location.search;

// orderType/deliveryType/selectedDietTypeId live only in memory, so a refresh mid-flow
// (e.g. a guest reloading the page on a hotel wifi) used to reach the guest-details step
// with orderType still null, which the backend rejects. Persist them alongside the
// URL-based flowStep restoration above so a reload doesn't leave that state stale.
const FLOW_STATE_KEY = 'guest_flow_state';
const loadFlowState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(FLOW_STATE_KEY)) || {};
  } catch {
    return {};
  }
};

export default function App() {
  // ─── Core state ─────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null); // 'paid' | 'new' | 'canceled' | 'expired' | 'invalid' | 'unknown' | 'error' | null
  const [hasOrderHistory, setHasOrderHistory] = useState(() => getOrderHistory().length > 0);

  // ─── UI/Flow state ───────────────────────────────────────────────────────────
  const [language, setLanguage] = useState('en');
  const [flowStep, setFlowStep] = useState('hero');
  const [orderType, setOrderType] = useState(null);   // 'twelve_day' | 'one_time'
  const [deliveryType, setDeliveryType] = useState(null);   // 'hotel' | 'current_location'
  const [selectedDietTypeId, setSelectedDietTypeId] = useState(null);

  // ─── 12-day plan state: selections made in PlanPreview, carried through the
  // guest-details modal + addon step to the final review/pay screen ─────────────
  const [planSelections, setPlanSelections] = useState([]); // [{ plan_date, meal_time, menu_item_id }]
  const [planReviewItems, setPlanReviewItems] = useState([]); // [{ date, meal, name, price_usd }] — display only
  const [planAddonId, setPlanAddonId] = useState(null);
  const [guestDetailsOpen, setGuestDetailsOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // ─── Current-location delivery: captured inline on the review page (no popup) ─
  const [pendingGuestName, setPendingGuestName] = useState('');
  const [pendingAddress, setPendingAddress] = useState('');
  const [pendingGeo, setPendingGeo] = useState(null);
  // ─── Deferred allergy info — stashed here until the session is actually created ─
  const [pendingAllergyTags, setPendingAllergyTags] = useState([]);
  const [pendingAllergyOther, setPendingAllergyOther] = useState('');

  const tr = useTranslation(language);

  // ─── Apply RTL for Arabic ────────────────────────────────────────────────────
  useEffect(() => {
    const dir = LANGUAGES.find(l => l.code === language)?.dir || 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  // ─── Browser Back/Forward: keep flow steps in sync with history ──────────────
  // The app has no real routes (single-page state machine), so without this the
  // Back button leaves the site entirely instead of stepping back through the
  // checkout flow. goToStep() pushes a history entry per step change; popstate
  // (fired by Back/Forward) restores flowStep without pushing again.
  const goToStep = useCallback((step) => {
    window.history.pushState({ flowStep: step }, '', pathForStep(step));
    setFlowStep(step);
  }, []);

  useEffect(() => {
    // Support deep-linking / refresh on a step's URL (e.g. /menu) — the server
    // SPA fallback (src/index.js) already returns index.html for any unknown
    // path, so this just needs to pick up wherever the browser landed.
    const searchParams = new URLSearchParams(window.location.search);
    const paymentParam = searchParams.get('payment');
    const orderIdParam = searchParams.get('order_id');

    const pathStep = window.location.pathname.replace(/^\//, '');
    // Returning from Hipay's hosted payment page lands back on '/' with
    // ?order_id=&payment=<status> (set by the backend's /hipay/redirect
    // handler, which has already independently re-verified the payment with
    // Hipay — see settleHipayCheckout in src/routes/payments.js). Route
    // straight to the confirmation screen instead of the normal
    // path-based restoration below.
    const initial = paymentParam ? 'confirmation' : (FLOW_STEPS.includes(pathStep) ? pathStep : 'hero');
    window.history.replaceState({ flowStep: initial }, '', pathForStep(initial));
    setFlowStep(initial);

    if (paymentParam) {
      setPaymentResult(paymentParam);
      if (orderIdParam) {
        fetch(`/api/orders/${orderIdParam}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => { if (data) setActiveOrder(data); })
          .catch(() => {});
      }
    }

    const saved = loadFlowState();
    if (saved.orderType) setOrderType(saved.orderType);
    if (saved.deliveryType) setDeliveryType(saved.deliveryType);
    if (saved.selectedDietTypeId != null) setSelectedDietTypeId(saved.selectedDietTypeId);

    const handlePopState = (e) => {
      setFlowStep(e.state?.flowStep || 'hero');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ orderType, deliveryType, selectedDietTypeId }));
    } catch { /* ignore */ }
  }, [orderType, deliveryType, selectedDietTypeId]);

  // ─── Initial load: menu items + restore language ──────────────────────────────
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('guest_language');
      if (savedLanguage) setLanguage(savedLanguage);
    } catch { /* ignore */ }

    fetch('/api/menu')
      .then(r => r.json())
      .then(items => {
        if (Array.isArray(items)) setMenuItems(items);
      })
      .catch(console.error);
  }, []);

  // ─── Persist language choice ──────────────────────────────────────────────────
  const handleSetLanguage = (code) => {
    setLanguage(code);
    localStorage.setItem('guest_language', code);
  };

  // ─── Cart operations ──────────────────────────────────────────────────────────
  const handleAddToCart = useCallback((item) => {
    setCart(prev => {
      const id = item.id || item.menu_item_id;
      const existing = prev.find(i => i.menu_item_id === id);
      if (existing) {
        return prev.map(i => i.menu_item_id === id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menu_item_id: id, name: item.name, price_usd: item.price_usd || item.price, quantity: 1 }];
    });
    showToast(`"${item.name}" added to cart`);
  }, [showToast]);

  const handleRemoveFromCart = useCallback((itemId) => {
    setCart(prev => {
      const ex = prev.find(i => i.menu_item_id === itemId);
      if (ex && ex.quantity > 1) return prev.map(i => i.menu_item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.menu_item_id !== itemId);
    });
  }, []);

  // ─── Socket.io: real-time order updates ───────────────────────────────────────
  useEffect(() => {
    if (!session?.id) return;
    const socket = io(window.location.origin);
    if (session.room_number) socket.emit('join:room', session.room_number);
    socket.on('order:updated', ({ orderId, status }) => {
      if (activeOrder?.id === orderId) {
        setActiveOrder(prev => ({ ...prev, status }));
        showToast(`Order status: ${status.toUpperCase()}`);
      }
    });
    return () => socket.disconnect();
  }, [session, activeOrder, showToast]);

  // ─── "Get Started" handler ────────────────────────────────────────────────────
  const handleGetStarted = () => {
    goToStep('order_type');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Order type selected: 12-day → diet-type picker, one-time → full menu ─────
  // OrderTypeSelection emits its own internal values ('12-day' | 'one-time');
  // map them to the order_type vocabulary used by the rest of the app + API.
  const handleOrderTypeContinue = (selected) => {
    const type = selected === '12-day' ? 'twelve_day' : 'one_time';
    setOrderType(type);
    goToStep(type === 'twelve_day' ? 'diet_type_select' : 'menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── 12-day: diet type chosen (or null if no restaurant is reconciled yet) ────
  const handleDietTypeContinue = (dietTypeId) => {
    setSelectedDietTypeId(dietTypeId);
    goToStep('plan_preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── 12-day plan: Confirm (with the guest's chosen day/meal selections + optional
  // recommended addon, both picked on the same plan_preview page) → ask guest
  // details (room always, no delivery choice) ────────────────────────────────────
  const handleConfirmPlan = (selections, total, reviewItems, addonId) => {
    setPlanSelections(selections);
    setPlanReviewItems(reviewItems);
    setPlanAddonId(addonId);
    setDeliveryType(null);
    setGuestDetailsOpen(true);
  };

  // ─── One-time: cart has items → ask delivery type ─────────────────────────────
  const handleContinueToDelivery = () => {
    setCartOpen(false);
    goToStep('delivery_type');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeliveryTypeContinue = (type) => {
    setDeliveryType(type);
    setGuestDetailsOpen(true);
  };

  // ─── Start a fresh order from the confirmation screen ─────────────────────────
  const handleBackToHome = () => {
    setOrderType(null);
    setDeliveryType(null);
    setSelectedDietTypeId(null);
    try { sessionStorage.removeItem(FLOW_STATE_KEY); } catch { /* ignore */ }
    setSession(null);
    setActiveOrder(null);
    setPaymentResult(null);
    setCart([]);
    setAgreeTerms(false);
    setPendingGuestName('');
    setPendingAddress('');
    setPendingGeo(null);
    setPendingAllergyTags([]);
    setPendingAllergyOther('');
    setPlanSelections([]);
    setPlanReviewItems([]);
    setPlanAddonId(null);
    goToStep('hero');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Guest details submit → create session, then (one-time) place the order ──
  // Exception: 'current_location' deliveries defer session creation until the guest
  // confirms their location with the map picker on the order review screen — no
  // separate popup is used to capture it.
  const handleGuestDetailsSubmit = async ({ guest_name, hotel_name, room_number, delivery_address, allergy_tags, allergy_other }) => {
    if (orderType === 'one_time' && deliveryType === 'current_location') {
      setPendingGuestName(guest_name);
      setPendingAllergyTags(allergy_tags);
      setPendingAllergyOther(allergy_other);
      setGuestDetailsOpen(false);
      goToStep('order_review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        guest_name,
        order_type: orderType,
        delivery_type: orderType === 'one_time' ? deliveryType : null,
        hotel_name,
        room_number,
        delivery_address,
        diet_type_id: orderType === 'twelve_day' ? selectedDietTypeId : null,
        allergy_tags,
        allergy_other,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check-in failed');

    const sess = data.session;
    setSession(sess);
    setGuestDetailsOpen(false);

    if (orderType === 'twelve_day') {
      goToStep('plan_review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // One-time: review the order (with refund notice + terms) before paying.
    goToStep('order_review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Shared tail for both checkout flows: start the Hipay checkout for an
  // already-created order and hand the browser off to Hipay's hosted payment
  // page. Hipay redirects back to '/?order_id=...&payment=...' (handled by the
  // mount effect above) once the guest finishes there.
  const payForOrder = async (orderData) => {
    setActiveOrder(orderData);
    addOrderToHistory(orderData.id);
    setHasOrderHistory(true);

    const paymentRes = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ order_id: orderData.id, gateway_provider: 'hipay' }),
    });
    const paymentData = await paymentRes.json();
    if (!paymentRes.ok || !paymentData.payment_form_url) {
      throw new Error(paymentData.error || 'Payment could not be started');
    }
    window.location.href = paymentData.payment_form_url;
  };

  // ─── 12-day plan review: agree to terms → create the plan order, then pay ─────
  const handlePlanPayNow = async () => {
    if (!agreeTerms || !session) return;
    setSubmitting(true);
    try {
      const orderRes = await fetch('/api/orders/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ selections: planSelections, addon_menu_item_id: planAddonId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Order failed');
      await payForOrder(orderData);
      setAgreeTerms(false);
    } catch (err) {
      showToast(err.message || 'Order failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Order review: agree to terms → place the order ──────────────────────────
  // For 'current_location', the session is only created here (once the map-picked
  // address is available), then the order is placed against it right away.
  const handlePayNow = async () => {
    if (!agreeTerms) return;
    if (!session && (!pendingAddress.trim() || !pendingGeo)) return;

    setSubmitting(true);
    try {
      let activeSession = session;

      if (!activeSession) {
        const sessRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            guest_name: pendingGuestName,
            order_type: orderType,
            delivery_type: 'current_location',
            room_number: null,
            delivery_address: pendingAddress.trim(),
            geo_lat: pendingGeo?.lat ?? null,
            geo_lng: pendingGeo?.lng ?? null,
            allergy_tags: pendingAllergyTags,
            allergy_other: pendingAllergyOther,
          }),
        });
        const sessData = await sessRes.json();
        if (!sessRes.ok) throw new Error(sessData.error || 'Check-in failed');
        activeSession = sessData.session;
        setSession(activeSession);
      }

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map(c => ({ menu_item_id: c.menu_item_id, quantity: c.quantity, guest_name: activeSession.guest_name })),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Order failed');
      await payForOrder(orderData);
      setCart([]);
      setAgreeTerms(false);
    } catch (err) {
      showToast(err.message || 'Order failed');
    } finally {
      setSubmitting(false);
    }
  };

  const planAddonItem = planAddonId ? menuItems.find(i => i.id === planAddonId) : null;

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + Number(i.price_usd) * i.quantity, 0);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      <Header
        session={session}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setCartOpen(true)}
        language={language}
        onSetLanguage={handleSetLanguage}
        showCart={flowStep === 'menu'}
        tr={tr}
        onOpenAbout={() => { goToStep('about_us'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onOpenMenu={() => { setOrderType('one_time'); goToStep('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onBackToHome={handleBackToHome}
        hasOrderHistory={hasOrderHistory}
        onOpenHistory={() => { goToStep('order_history'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      <ChatWidget tr={tr} />

      <main style={{ flex: 1 }}>
        {toast && <div className="toast">{toast}</div>}

        {/* ── HERO FLOW ─────────────────────────────────────────────────────── */}
        {flowStep === 'hero' && (
          <>
            <HeroSection tr={tr} onGetStarted={handleGetStarted} />
            <TodaySpecialOffers menuItems={menuItems} tr={tr} onGetStarted={handleGetStarted} />
            <HowItWorks tr={tr} />
            <AboutSection tr={tr} onAboutClick={() => { goToStep('about_us'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </>
        )}

        {/* ── ABOUT US PAGE ─────────────────────────────────────────────────── */}
        {flowStep === 'about_us' && (
          <AboutPage tr={tr} onBackToHome={handleBackToHome} />
        )}

        {/* ── ORDER TYPE SELECTION ──────────────────────────────────────────── */}
        {flowStep === 'order_type' && (
          <OrderTypeSelection
            tr={tr}
            onBack={() => goToStep('hero')}
            onContinue={handleOrderTypeContinue}
          />
        )}

        {/* ── 12-DAY: DIET TYPE SELECTION ─────────────────────────────────────── */}
        {flowStep === 'diet_type_select' && (
          <DietTypeSelection
            tr={tr}
            onBack={() => goToStep('order_type')}
            onContinue={handleDietTypeContinue}
          />
        )}

        {/* ── 12-DAY PLAN PREVIEW ────────────────────────────────────────────── */}
        {flowStep === 'plan_preview' && (
          <div className="container" style={{ paddingTop: 8, paddingBottom: 60 }}>
            <PlanPreview
              dietTypeId={selectedDietTypeId}
              menuItems={menuItems}
              tr={tr}
              language={language}
              onConfirmPlan={handleConfirmPlan}
              onBack={() => goToStep('diet_type_select')}
            />
          </div>
        )}

        {/* ── 12-DAY: FINAL REVIEW + PAY ───────────────────────────────────────── */}
        {flowStep === 'plan_review' && (
          <div className="container">
            <PlanReviewStep
              reviewItems={planReviewItems}
              addonItem={planAddonItem}
              session={session}
              language={language}
              tr={tr}
              agreeTerms={agreeTerms}
              onToggleAgree={setAgreeTerms}
              onOpenTerms={() => setTermsModalOpen(true)}
              onPay={handlePlanPayNow}
              isSubmitting={submitting}
              onBack={() => goToStep('plan_preview')}
            />
          </div>
        )}

        {/* ── ONE-TIME: FULL MENU ─────────────────────────────────────────────── */}
        {flowStep === 'menu' && (
          <div className="container" style={{ paddingTop: 8, paddingBottom: 60 }}>
            <MenuSection
              menuItems={menuItems}
              cart={cart}
              tr={tr}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
              onContinueToDelivery={handleContinueToDelivery}
              onBack={() => goToStep('order_type')}
            />
          </div>
        )}

        {/* ── DELIVERY TYPE SELECTION (one-time only) ─────────────────────────── */}
        {flowStep === 'delivery_type' && (
          <DeliveryTypeSelection
            tr={tr}
            onBack={() => goToStep('menu')}
            onContinue={handleDeliveryTypeContinue}
          />
        )}

        {/* ── ORDER REVIEW (refund notice + agree to terms + pay) ─────────────── */}
        {flowStep === 'order_review' && (
          <div className="container">
            <OrderReview
              cart={cart}
              session={session}
              deliveryType={deliveryType}
              pendingGuestName={pendingGuestName}
              pendingAddress={pendingAddress}
              pendingGeo={pendingGeo}
              onLocationChange={({ lat, lng, address }) => {
                setPendingAddress(address);
                setPendingGeo(lat != null && lng != null ? { lat, lng } : null);
              }}
              agreeTerms={agreeTerms}
              onToggleAgree={setAgreeTerms}
              onOpenTerms={() => setTermsModalOpen(true)}
              onPay={handlePayNow}
              isSubmitting={submitting}
              onEditDetails={() => setGuestDetailsOpen(true)}
              onBack={() => goToStep('menu')}
              tr={tr}
            />
          </div>
        )}

        {/* ── CONFIRMATION ─────────────────────────────────────────────────────── */}
        {flowStep === 'confirmation' && (
          <div className="container" style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {paymentResult && paymentResult !== 'paid' ? (
                <AlertTriangle size={64} color="#dc2626" />
              ) : (
                <CheckCircle2 size={64} color="var(--brand-green)" />
              )}
            </div>
            <h1 className="heading-lg" style={{ marginBottom: 12 }}>
              {paymentResult === 'paid' ? tr.paymentSuccessTitle
                : paymentResult === 'new' ? tr.paymentPendingTitle
                : paymentResult ? tr.paymentFailedTitle
                : tr.orderConfirmedTitle}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {paymentResult === 'paid' ? tr.paymentSuccessDesc
                : paymentResult === 'new' ? tr.paymentPendingDesc
                : paymentResult ? tr.paymentFailedDesc
                : tr.orderConfirmedDesc}
            </p>
            {activeOrder && (
              <>
                <div style={{
                  display: 'flex', gap: 12, textAlign: 'left',
                  background: 'var(--bg-yellow-light)', border: '1px solid var(--accent-yellow)',
                  borderRadius: 'var(--r-md)', padding: '16px 18px', marginBottom: 20,
                }}>
                  <MessageCircle size={20} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ color: 'var(--text-dark)', fontSize: '0.85rem', lineHeight: 1.65, fontWeight: 500 }}>
                    {tr.orderConfirmedChatNote}
                  </p>
                </div>

                <div className="card" style={{ padding: 24, textAlign: 'left', marginBottom: 24 }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {tr.orderIdLabel}
                  </p>
                  <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: 4, marginBottom: 16, letterSpacing: '0.04em' }}>
                    {formatOrderNumber(activeOrder.order_number)}
                  </p>

                  <p style={{ fontWeight: 700 }}>{tr.orderStatus}: <strong style={{ textTransform: 'uppercase' }}>{activeOrder.status}</strong></p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 6 }}>Total: ${Number(activeOrder.total_usd).toFixed(2)}</p>

                  {Array.isArray(activeOrder.items) && activeOrder.items.length > 0 && (
                    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.9rem', marginBottom: 10 }}>
                        {tr.reviewItemsTitle}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {activeOrder.items.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 0', borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
                              <strong style={{ color: 'var(--text-dark)' }}>{item.quantity}×</strong> {item.name}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                              ${(Number(item.unit_price_usd) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <button className="btn-outline" onClick={handleBackToHome} style={{ margin: '0 auto' }}>
              {tr.backToHomeBtn}
            </button>
          </div>
        )}

        {/* ── ORDER HISTORY ────────────────────────────────────────────────────── */}
        {flowStep === 'order_history' && (
          <OrderHistoryPage
            tr={tr}
            onBack={() => { goToStep('hero'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        )}
      </main>

      {/* Footer — shown on hero only */}
      {flowStep === 'hero' && <Footer tr={tr} />}

      {/* Guest Details Modal */}
      <GuestDetailsModal
        isOpen={guestDetailsOpen}
        tr={tr}
        deliveryType={orderType === 'one_time' ? deliveryType : null}
        onSubmit={handleGuestDetailsSubmit}
        onClose={() => setGuestDetailsOpen(false)}
      />

      {/* Terms & Policies modal (opened from the order review step) */}
      <TermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        tr={tr}
      />

      {/* Cart Drawer (one-time flow) */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onAddToCart={handleAddToCart}
        onRemoveFromCart={handleRemoveFromCart}
        onClearCart={() => setCart([])}
        onPlaceOrder={handleContinueToDelivery}
        isSubmitting={submitting}
        tr={tr}
      />
    </div>
  );
}
