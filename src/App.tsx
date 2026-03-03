import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import IntakeForm from "./pages/IntakeForm";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminEnums from "./pages/admin/AdminEnums";
import AdminPresets from "./pages/admin/AdminPresets";
import AdminFields from "./pages/admin/AdminFields";
import AdminRules from "./pages/admin/AdminRules";
import AdminLabels from "./pages/admin/AdminLabels";
import AdminPublish from "./pages/admin/AdminPublish";
import AdminDocs from "./pages/admin/AdminDocs";
import AdminMedinaPOIs from "./pages/admin/AdminMedinaPOIs";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMedinaCustomBuilder from "./pages/admin/AdminMedinaCustomBuilder";
import QuestPlay from "./pages/QuestPlay";
import PublicExperienceBuilder from "./pages/PublicExperienceBuilder";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/intake/:projectId" element={<IntakeForm />} />
          <Route path="/admin/config" element={<Navigate to="/admin/enums" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Admin Panel Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/enums" replace />} />
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
          </Route>
          
          <Route path="/experience" element={<PublicExperienceBuilder />} />
          <Route path="/play" element={<QuestPlay />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
