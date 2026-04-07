import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Eagerly loaded pages (landing + lightweight)
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const IntakeForm = lazy(() => import("./pages/IntakeForm"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminEnums = lazy(() => import("./pages/admin/AdminEnums"));
const AdminPresets = lazy(() => import("./pages/admin/AdminPresets"));
const AdminFields = lazy(() => import("./pages/admin/AdminFields"));
const AdminRules = lazy(() => import("./pages/admin/AdminRules"));
const AdminLabels = lazy(() => import("./pages/admin/AdminLabels"));
const AdminPublish = lazy(() => import("./pages/admin/AdminPublish"));
const AdminDocs = lazy(() => import("./pages/admin/AdminDocs"));
const AdminMedinaPOIs = lazy(() => import("./pages/admin/AdminMedinaPOIs"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminMedinaCustomBuilder = lazy(() => import("./pages/admin/AdminMedinaCustomBuilder"));
const QuestPlay = lazy(() => import("./pages/QuestPlay"));
const PublicExperienceBuilder = lazy(() => import("./pages/PublicExperienceBuilder"));
const PublicExperiencesList = lazy(() => import("./pages/PublicExperiencesList"));
const PublicExperienceDetail = lazy(() => import("./pages/PublicExperienceDetail"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog"));
const AdminHealth = lazy(() => import("./pages/admin/AdminHealth"));
const AdminExperiencePage = lazy(() => import("./pages/admin/AdminExperiencePage"));
const AdminPOIPipeline = lazy(() => import("./pages/admin/AdminPOIPipeline"));
const AdminMediaLibrary = lazy(() => import("./pages/admin/AdminMediaLibrary"));
const AdminQuestLibrary = lazy(() => import("./pages/admin/AdminQuestLibrary"));
const AdminWatchdog = lazy(() => import("./pages/admin/AdminWatchdog"));
const PublicExperienceWizard = lazy(() => import("./pages/PublicExperienceWizard"));
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
              <Route path="/admin/config" element={<Navigate to="/admin/enums" replace />} />
              
              {/* Auth */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Admin Panel Routes - require admin role */}
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin/medina-pois" replace />} />
                <Route path="enums" element={<AdminEnums />} />
                <Route path="presets" element={<AdminPresets />} />
                <Route path="fields" element={<AdminFields />} />
                <Route path="rules" element={<AdminRules />} />
                <Route path="labels" element={<AdminLabels />} />
                <Route path="publish" element={<AdminPublish />} />
                <Route path="docs" element={<AdminDocs />} />
                <Route path="medina-pois" element={<AdminMedinaPOIs />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="medina-custom" element={<AdminMedinaCustomBuilder />} />
                <Route path="catalog" element={<AdminCatalog />} />
                <Route path="health" element={<AdminHealth />} />
                <Route path="experience-page" element={<AdminExperiencePage />} />
                <Route path="poi-pipeline" element={<AdminPOIPipeline />} />
                <Route path="media-library" element={<AdminMediaLibrary />} />
                <Route path="quest-library" element={<AdminQuestLibrary />} />
                <Route path="watchdog" element={<AdminWatchdog />} />
              </Route>
              
              <Route path="/creez-votre-experience" element={<PublicExperienceWizard />} />
              
              <Route path="/experience" element={<PublicExperienceBuilder />} />
              <Route path="/experiences" element={<PublicExperiencesList />} />
              <Route path="/experiences/:slug" element={<PublicExperienceDetail />} />
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
