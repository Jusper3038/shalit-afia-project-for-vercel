import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const PharmacyPage = lazy(() => import("./pages/Pharmacy"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DrugsPage = lazy(() => import("./pages/Drugs"));
const PatientsPage = lazy(() => import("./pages/Patients"));
const BillingPage = lazy(() => import("./pages/Billing"));
const PaymentsPage = lazy(() => import("./pages/Payments"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogs"));
const UsersPage = lazy(() => import("./pages/Users"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading page...</span>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/home" element={<Index keepLandingVisible />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/pharmacy" element={<ProtectedRoute><PharmacyPage /></ProtectedRoute>} />
              <Route path="/pharmacy/dashboard" element={<ProtectedRoute requiredApp="dashboard" requireSensitiveVerification><Dashboard /></ProtectedRoute>} />
              <Route path="/pharmacy/inventory" element={<ProtectedRoute requiredApp="inventory"><DrugsPage /></ProtectedRoute>} />
              <Route path="/pharmacy/patients" element={<ProtectedRoute requiredApp="patients"><PatientsPage /></ProtectedRoute>} />
              <Route path="/pharmacy/billing" element={<ProtectedRoute requiredApp="billing"><BillingPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute requiredApp="dashboard"><Navigate to="/pharmacy/dashboard" replace /></ProtectedRoute>} />
              <Route path="/drugs" element={<ProtectedRoute requiredApp="inventory"><Navigate to="/pharmacy/inventory" replace /></ProtectedRoute>} />
              <Route path="/patients" element={<ProtectedRoute requiredApp="patients"><Navigate to="/pharmacy/patients" replace /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute requiredApp="billing"><Navigate to="/pharmacy/billing" replace /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute requiredApp="payments" requireSensitiveVerification><PaymentsPage /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute requiredApp="settings"><Navigate to="/settings" replace /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute requiredApp="audit_logs" requireSensitiveVerification><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requirePlatformOwner><UsersPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredApp="settings" requireSensitiveVerification><SettingsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
