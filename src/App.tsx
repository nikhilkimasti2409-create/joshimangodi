import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import { ToastContainer } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import ProductionPage from './pages/ProductionPage';
import InventoryPage from './pages/InventoryPage';
import FinancePage from './pages/FinancePage';

export default function App() {
  return (
    <ErrorBoundary level="root">
      <BrowserRouter>
        <div className="min-h-screen bg-surface text-ink flex flex-col font-sans">
          <ToastContainer />
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/pos" replace />} />
              <Route
                path="/pos"
                element={
                  <ErrorBoundary level="page" pageName="Point of Sale">
                    <POSPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/products"
                element={
                  <ErrorBoundary level="page" pageName="Products Catalog">
                    <ProductsPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/customers"
                element={
                  <ErrorBoundary level="page" pageName="Customer Ledger">
                    <CustomersPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/production"
                element={
                  <ErrorBoundary level="page" pageName="Manufacturing & Production">
                    <ProductionPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ErrorBoundary level="page" pageName="Inventory & Materials">
                    <InventoryPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/finance"
                element={
                  <ErrorBoundary level="page" pageName="Finance & Cash Drawer">
                    <FinancePage />
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/pos" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
