import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const IntakeForm = lazy(() => import("./pages/IntakeForm"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminEnums = lazy(() => import("./pages/admin/AdminEnums"));
const AdminDocs = lazy(() => import("./pages/admin/AdminDocs"));
const AdminMedinaPOIs = lazy(() => import("./pages/admin/AdminMedinaPOIs"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const QuestPlay = lazy(() => import("./pages/QuestPlay"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog"));
const AdminHealth = lazy(() => import("./pages/admin/AdminHealth"));
const AdminExperiencePage = lazy(() => import("./pages/admin/AdminExperiencePage"));
const AdminPOIPipeline = lazy(() => import("./pages/admin/AdminPOIPipeline"));
const AdminMediaLibrary = lazy(() => import("./pages/admin/AdminMediaLibrary"));
const AdminQuestLibrary = lazy(() => import("./pages/admin/AdminQuestLibrary"));
const AdminWatchdog = lazy(() => import("./pages/admin/AdminWatchdog"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminClientFeedback = lazy(() => import("./pages/admin/AdminClientFeedback"));
const AdminApiKeys = lazy(() => import("./pages/admin/AdminApiKeys"));
const AdminAgentChat = lazy(() => import("./pages/admin/AdminAgentChat"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/intake/:projectId" element={<IntakeForm />} />
              
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="medina-pois" element={<AdminMedinaPOIs />} />
                <Route path="poi-pipeline" element={<AdminPOIPipeline />} />
                <Route path="watchdog" element={<AdminWatchdog />} />
                <Route path="media-library" element={<AdminMediaLibrary />} />
                <Route path="quest-library" element={<AdminQuestLibrary />} />
                <Route path="client-feedback" element={<AdminClientFeedback />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="catalog" element={<AdminCatalog />} />
                <Route path="health" element={<AdminHealth />} />
                <Route path="experience-page" element={<AdminExperiencePage />} />
                <Route path="agent-chat" element={<AdminAgentChat />} />
                <Route path="api-keys" element={<AdminApiKeys />} />
                <Route path="enums" element={<AdminEnums />} />
                <Route path="docs" element={<AdminDocs />} />
              </Route>
              
              <Route path="/play" element={<QuestPlay />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
