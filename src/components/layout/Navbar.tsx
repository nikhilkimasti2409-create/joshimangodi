import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Users,
  Factory,
  Package,
  BadgeIndianRupee,
  Tag,
  RotateCcw,
  CheckCircle2,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAppState, store } from '../../lib/store';
import { t } from '../../lib/i18n';

export default function Navbar() {
  const { activeCustomer, activeChannel, cart, products } = useAppState();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const navItems = [
    {
      to: '/pos',
      label: 'POS & Billing',
      desc: 'Quick Counter Checkout & Invoices',
      icon: ShoppingBag,
      count: cart.length,
    },
    {
      to: '/products',
      label: 'Products',
      desc: 'Add & Manage Custom SKUs',
      icon: Tag,
      badge: `${products.length} SKUs`,
    },
    {
      to: '/customers',
      label: 'Customers',
      desc: 'CRM, Udhar Ledger & Payments',
      icon: Users,
    },
    {
      to: '/production',
      label: 'Production',
      desc: 'Shrinkage Math & Labor Payouts',
      icon: Factory,
    },
    {
      to: '/inventory',
      label: 'Inventory',
      desc: 'Raw Dal, FEFO & Finished SKUs',
      icon: Package,
    },
    {
      to: '/finance',
      label: 'Finance',
      desc: 'P&L, Cash Drawer & Dispatch',
      icon: BadgeIndianRupee,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/98 backdrop-blur-md select-none">
        {/* Top Info Bar (Desktop only) */}
        <div className="hidden sm:flex bg-ink text-white px-6 py-1 text-xs items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="font-semibold text-xs tracking-wide">Joshi Mangodi Operations</span>
            <span className="text-white/60 text-[11px]">· Fatehpur, Sikar (Rajasthan)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <CheckCircle2 size={12} /> {t('online_status')}
            </span>
            <button
              onClick={() => {
                if (confirm('Reset real sales data & catalog to initial state?')) {
                  store.resetToDefaults();
                }
              }}
              className="text-white/60 hover:text-white inline-flex items-center gap-1 transition cursor-pointer"
              title="Reset Data"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Left: Mobile Hamburger + Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card text-ink hover:bg-surface active:scale-95 transition cursor-pointer"
            >
              <Menu size={20} strokeWidth={2} />
            </button>

            <NavLink to="/pos" className="flex items-center gap-2.5 group">
              <img
                src="/assets/brand logo.png"
                alt="Joshi Mangodi Logo"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain rounded-lg border border-border bg-card p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <span className="font-bold text-base sm:text-lg text-ink tracking-tight">
                  Joshi Mangodi
                </span>
                <p className="text-[11px] font-medium text-ink-muted -mt-0.5 hidden sm:block">
                  Moong Dal Mangodi · Operations Platform
                </p>
              </div>
            </NavLink>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-ink-muted hover:bg-surface hover:text-ink'
                    }`
                  }
                >
                  <Icon size={15} strokeWidth={2} />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="bg-white/20 text-[11px] px-1.5 py-0.5 rounded-full font-semibold min-w-[18px] text-center">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right: Channel Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
              <button
                onClick={() => store.setChannel('RETAIL')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeChannel === 'RETAIL'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Retail
              </button>
              <button
                onClick={() => store.setChannel('WHOLESALE_T1')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeChannel === 'WHOLESALE_T1'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
                title="Tier 1 Wholesale (₹175/kg)"
              >
                WS-1
              </button>
              <button
                onClick={() => store.setChannel('WHOLESALE_T2')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeChannel === 'WHOLESALE_T2'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
                title="Tier 2 Bulk (₹165/kg)"
              >
                WS-2
              </button>
            </div>
          </div>
        </div>

        {/* Attached Active Customer Bar */}
        {activeCustomer && (
          <div className="bg-primary-soft border-t border-primary/20 px-4 sm:px-6 py-2 text-xs flex items-center justify-between text-ink">
            <div className="flex items-center gap-2 truncate">
              <span className="font-medium text-ink-muted">Customer:</span>
              <span className="font-bold text-ink truncate">{activeCustomer.name}</span>
              <span className="hidden sm:inline text-ink-muted font-mono text-[11px]">({activeCustomer.phone})</span>
              <span className="text-xs bg-card px-2 py-0.5 rounded-md border border-border font-semibold text-ink">
                Due: ₹{activeCustomer.totalOutstandingInr.toLocaleString('en-IN')}
              </span>
            </div>
            <button
              onClick={() => store.setActiveCustomer(null)}
              className="text-xs font-semibold text-danger hover:underline cursor-pointer ml-3 shrink-0"
            >
              Detach
            </button>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* MOBILE SIDEBAR DRAWER                                        */}
      {/* ============================================================ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          {/* Backdrop */}
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-ink/40 transition-opacity"
            aria-hidden="true"
          />

          {/* Sidebar Panel */}
          <div className="relative w-[85%] max-w-[320px] bg-card border-r border-border shadow-xl flex flex-col justify-between h-full z-10 overflow-y-auto">
            {/* Header */}
            <div>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/brand logo.png"
                    alt="Logo"
                    className="h-9 w-9 object-contain rounded-lg border border-border p-0.5"
                  />
                  <div>
                    <h2 className="font-bold text-base text-ink leading-tight">
                      Joshi Mangodi
                    </h2>
                    <p className="text-[11px] font-medium text-ink-muted">Operations Platform</p>
                  </div>
                </div>

                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-ink hover:bg-card cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Channel Selector */}
              <div className="p-3 bg-surface border-b border-border">
                <div className="text-[11px] font-semibold text-ink-muted tracking-wide mb-2">
                  Pricing Channel
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => store.setChannel('RETAIL')}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                      activeChannel === 'RETAIL'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-ink-muted border-border'
                    }`}
                  >
                    Retail
                  </button>
                  <button
                    onClick={() => store.setChannel('WHOLESALE_T1')}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                      activeChannel === 'WHOLESALE_T1'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-ink-muted border-border'
                    }`}
                  >
                    WS-1
                  </button>
                  <button
                    onClick={() => store.setChannel('WHOLESALE_T2')}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition cursor-pointer text-center ${
                      activeChannel === 'WHOLESALE_T2'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-ink-muted border-border'
                    }`}
                  >
                    WS-2
                  </button>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="p-3 space-y-1" aria-label="Main navigation">
                <div className="text-[11px] font-semibold text-ink-muted tracking-wide px-2 mb-1">
                  Modules
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-primary-soft border-primary/20 text-ink'
                          : 'bg-card border-border text-ink-muted hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isActive ? 'bg-primary text-white' : 'bg-surface text-ink-muted'
                          }`}
                        >
                          <Icon size={18} strokeWidth={2} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-ink leading-tight">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-ink-muted font-medium mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.count !== undefined && item.count > 0 && (
                          <span className="bg-danger text-white text-[11px] px-1.5 py-0.5 rounded-full font-semibold">
                            {item.count}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-ink-faint" />
                      </div>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Bottom: Active Customer & Quick Actions */}
            <div className="p-3 border-t border-border bg-surface space-y-2">
              {activeCustomer ? (
                <div className="p-3 rounded-lg bg-primary-soft border border-primary/20 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-muted">Active Customer:</span>
                    <span className="font-bold text-ink">{activeCustomer.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1 text-ink-muted">
                    <span>Phone: {activeCustomer.phone}</span>
                    <span className="font-semibold">Due: ₹{activeCustomer.totalOutstandingInr}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-card border border-border text-xs text-center text-ink-muted font-medium">
                  Counter Walk-in Sale Active
                </div>
              )}

              <button
                onClick={() => {
                  if (confirm('Reset real sales data & catalog to initial state?')) {
                    store.resetToDefaults();
                    setSidebarOpen(false);
                  }
                }}
                className="w-full py-2 rounded-lg border border-border text-xs font-medium text-ink-muted hover:bg-card flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={13} /> Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
