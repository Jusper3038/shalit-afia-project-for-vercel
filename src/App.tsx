import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
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
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["admin"]} requireSensitiveVerification><Dashboard /></ProtectedRoute>} />
              <Route path="/drugs" element={<ProtectedRoute allowedRoles={["admin"]}><DrugsPage /></ProtectedRoute>} />
              <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute allowedRoles={["admin"]} requireSensitiveVerification><PaymentsPage /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={["admin"]} requireSensitiveVerification><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requirePlatformOwner requireSensitiveVerification redirectTo="/dashboard"><UsersPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]} requireSensitiveVerification><SettingsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
