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
      label: 'Products & Upload',
      desc: 'Add & Manage Custom SKUs',
      icon: Tag,
      badge: `${products.length} SKUs`,
    },
    {
      to: '/customers',
      label: 'Customer Khata',
      desc: 'CRM, Udhar Ledger & Payments',
      icon: Users,
    },
    {
      to: '/production',
      label: 'Production & Batches',
      desc: 'Shrinkage Math & Labor Payouts',
      icon: Factory,
    },
    {
      to: '/inventory',
      label: 'Stock & Inventory',
      desc: 'Raw Dal, FEFO & Finished SKUs',
      icon: Package,
    },
    {
      to: '/finance',
      label: 'Finance & Logistics',
      desc: 'P&L, Cash Drawer & Dispatch',
      icon: BadgeIndianRupee,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#FCE7F3] bg-[#FFF9FA]/98 backdrop-blur-md shadow-xs select-none">
        {/* Top Info Bar (Desktop only for a clean open feel) */}
        <div className="hidden sm:flex bg-[#31102A] text-[#FFF9FA] px-6 py-1.5 text-xs items-center justify-between font-medium">
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-xs tracking-wide">JOSHI MANGODI OPERATIONS PLATFORM</span>
            <span className="text-pink-200 text-[11px]">· Fatehpur, Sikar (Rajasthan)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <CheckCircle2 size={13} /> {t('online_status')}
            </span>
            <button
              onClick={() => {
                if (confirm('Reset real sales data & catalog to initial state?')) {
                  store.resetToDefaults();
                }
              }}
              className="text-pink-200 hover:text-white inline-flex items-center gap-1 transition cursor-pointer"
              title="Reset Data"
            >
              <RotateCcw size={12} /> Reset Real Data
            </button>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Left: Mobile 3-Lines (Hamburger) Button + Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Navigation Menu"
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-2xl border border-[#FCE7F3] bg-white text-[#31102A] shadow-xs hover:bg-[#FEFCE8] active:scale-95 transition cursor-pointer"
            >
              <Menu size={22} strokeWidth={2.3} />
            </button>

            <NavLink to="/pos" className="flex items-center gap-3 group">
              <img
                src="/assets/brand logo.png"
                alt="Joshi Mangodi Logo"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-2xl border border-[#FCE7F3] bg-white p-0.5 shadow-sm transition group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif-brand font-extrabold text-lg sm:text-2xl text-[#31102A] tracking-tight">
                    JOSHI MANGODI
                  </span>
                  <span className="hidden lg:inline-block text-[10px] uppercase font-black bg-[#FBCFE8] text-[#31102A] px-2.5 py-0.5 rounded-full border border-[#E5B6D3]">
                    Ops v2
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-[#632055] -mt-0.5 hidden sm:block">
                  Handmade Moong Dal Mangodi · Billing & Manufacturing
                </p>
              </div>
            </NavLink>
          </div>

          {/* Center: Desktop Navigation Tabs (Spacious & Modern) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#FCE7F3] shadow-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#FBCFE8] text-[#31102A] shadow-xs border border-[#E5B6D3]'
                        : 'text-[#632055] hover:bg-[#FEFCE8] hover:text-[#31102A]'
                    }`
                  }
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="bg-[#9F1239] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right: Channel Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-[#FCE7F3] rounded-2xl p-1 shadow-xs">
              <button
                onClick={() => store.setChannel('RETAIL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeChannel === 'RETAIL'
                    ? 'bg-[#FBCFE8] text-[#31102A] shadow-xs font-extrabold'
                    : 'text-[#632055] hover:text-[#31102A]'
                }`}
              >
                Retail
              </button>
              <button
                onClick={() => store.setChannel('WHOLESALE_T1')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeChannel === 'WHOLESALE_T1'
                    ? 'bg-[#FEF08A] text-[#31102A] shadow-xs font-extrabold'
                    : 'text-[#632055] hover:text-[#31102A]'
                }`}
                title="Tier 1 Wholesale (₹175/kg)"
              >
                WS-1
              </button>
              <button
                onClick={() => store.setChannel('WHOLESALE_T2')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeChannel === 'WHOLESALE_T2'
                    ? 'bg-[#FEF08A] text-[#31102A] shadow-xs font-extrabold'
                    : 'text-[#632055] hover:text-[#31102A]'
                }`}
                title="Tier 2 Bulk (₹165/kg)"
              >
                WS-2
              </button>
            </div>
          </div>
        </div>

        {/* Attached Active Customer Bar (Clean & airy) */}
        {activeCustomer && (
          <div className="bg-[#FEFCE8] border-t border-[#FDE047] px-4 sm:px-6 py-2 text-xs flex items-center justify-between text-[#31102A]">
            <div className="flex items-center gap-2.5 truncate">
              <span className="font-bold text-[#632055]">Attached Customer:</span>
              <span className="font-black text-[#9F1239] text-sm truncate">{activeCustomer.name}</span>
              <span className="hidden sm:inline text-gray-600 font-mono">({activeCustomer.phone})</span>
              <span className="text-[11px] bg-white px-2.5 py-0.5 rounded-lg border border-[#FDE047] font-extrabold text-[#31102A]">
                Due: ₹{activeCustomer.totalOutstandingInr.toLocaleString('en-IN')}
              </span>
            </div>
            <button
              onClick={() => store.setActiveCustomer(null)}
              className="text-xs font-bold text-[#9F1239] hover:underline cursor-pointer ml-3 shrink-0"
            >
              Detach ✕
            </button>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* 🌟 SLIDE-OUT MOBILE SIDEBAR DRAWER (3-Line Menu Target) */}
      {/* ============================================================ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Blur */}
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-[#31102A]/50 backdrop-blur-sm transition-opacity"
          />

          {/* Sidebar Drawer Panel */}
          <div className="relative w-[85%] max-w-[340px] bg-[#FFF9FA] border-r-2 border-[#FCE7F3] shadow-2xl flex flex-col justify-between h-full z-10 overflow-y-auto animate-in slide-in-from-left duration-200">
            {/* Top: Header with Logo & Close Button */}
            <div>
              <div className="p-5 border-b border-[#FCE7F3] bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/assets/brand logo.png"
                    alt="Logo"
                    className="h-11 w-11 object-contain rounded-xl border border-[#FCE7F3] p-0.5"
                  />
                  <div>
                    <h2 className="font-serif-brand font-black text-lg text-[#31102A] leading-tight">
                      JOSHI MANGODI
                    </h2>
                    <p className="text-[11px] font-semibold text-[#632055]">Operations Platform</p>
                  </div>
                </div>

                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-10 h-10 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] flex items-center justify-center text-[#31102A] font-bold hover:bg-[#FEFCE8] cursor-pointer"
                  aria-label="Close Sidebar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Channel Selector Section */}
              <div className="p-4 bg-[#FEFCE8]/60 border-b border-[#FDE047]">
                <div className="text-[10px] font-black uppercase text-[#632055] tracking-wider mb-2">
                  Pricing Channel
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => store.setChannel('RETAIL')}
                    className={`py-2 px-1 rounded-xl text-xs font-black border transition cursor-pointer text-center ${
                      activeChannel === 'RETAIL'
                        ? 'bg-[#31102A] text-white border-[#31102A] shadow-xs'
                        : 'bg-white text-[#632055] border-[#FCE7F3]'
                    }`}
                  >
                    Retail
                  </button>
                  <button
                    onClick={() => store.setChannel('WHOLESALE_T1')}
                    className={`py-2 px-1 rounded-xl text-xs font-black border transition cursor-pointer text-center ${
                      activeChannel === 'WHOLESALE_T1'
                        ? 'bg-[#31102A] text-white border-[#31102A] shadow-xs'
                        : 'bg-white text-[#632055] border-[#FCE7F3]'
                    }`}
                  >
                    WS-1
                  </button>
                  <button
                    onClick={() => store.setChannel('WHOLESALE_T2')}
                    className={`py-2 px-1 rounded-xl text-xs font-black border transition cursor-pointer text-center ${
                      activeChannel === 'WHOLESALE_T2'
                        ? 'bg-[#31102A] text-white border-[#31102A] shadow-xs'
                        : 'bg-white text-[#632055] border-[#FCE7F3]'
                    }`}
                  >
                    WS-2
                  </button>
                </div>
              </div>

              {/* Navigation Links (Spacious & Clean) */}
              <div className="p-4 space-y-2">
                <div className="text-[10px] font-black uppercase text-[#632055] tracking-wider px-2 mb-1">
                  Main Modules
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-[#FBCFE8] border-[#E5B6D3] text-[#31102A] shadow-xs'
                          : 'bg-white border-[#FCE7F3] text-[#632055] hover:bg-[#FEFCE8]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isActive ? 'bg-[#31102A] text-white' : 'bg-[#FFF9FA] text-[#9F1239]'
                          }`}
                        >
                          <Icon size={20} strokeWidth={2.2} />
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-[#31102A] leading-tight">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-[#632055] font-medium mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.count !== undefined && item.count > 0 && (
                          <span className="bg-[#9F1239] text-white text-xs px-2 py-0.5 rounded-full font-black">
                            {item.count}
                          </span>
                        )}
                        <ChevronRight size={16} className="text-[#632055]" />
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Bottom: Active Customer & Quick Actions */}
            <div className="p-4 border-t border-[#FCE7F3] bg-white space-y-3">
              {activeCustomer ? (
                <div className="p-3 rounded-xl bg-[#FEFCE8] border border-[#FDE047] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#632055]">Active Customer:</span>
                    <span className="font-extrabold text-[#9F1239]">{activeCustomer.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1">
                    <span>Phone: {activeCustomer.phone}</span>
                    <span className="font-bold">Due: ₹{activeCustomer.totalOutstandingInr}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-xs text-center text-[#632055] font-semibold">
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
                className="w-full py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={14} /> Reset Real Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
