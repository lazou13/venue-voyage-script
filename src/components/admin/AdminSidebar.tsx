import { NavLink } from 'react-router-dom';
import { List, Rocket, LayoutDashboard, Sliders, Settings2, ShieldCheck, Languages, BookOpen, MapPin, ShoppingCart, Wand2, Store, HeartPulse, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AdminSidebarProps {
  hasUnsavedChanges?: boolean;
}

const navItems = [
  { to: '/admin/enums', label: 'Enums', icon: List },
  { to: '/admin/presets', label: 'Préréglages', icon: Sliders },
  { to: '/admin/fields', label: 'Champs', icon: Settings2 },
  { to: '/admin/rules', label: 'Règles', icon: ShieldCheck },
  { to: '/admin/labels', label: 'Labels', icon: Languages },
  { to: '/admin/publish', label: 'Publier', icon: Rocket },
  { to: '/admin/docs', label: 'Documentation', icon: BookOpen },
  { to: '/admin/medina-pois', label: 'Bibliothèque Médina', icon: MapPin },
  { to: '/admin/medina-custom', label: 'Sur-mesure', icon: Wand2 },
  { to: '/admin/orders', label: 'Commandes', icon: ShoppingCart },
  { to: '/admin/catalog', label: 'Catalogue', icon: Store },
  { to: '/admin/health', label: 'Santé', icon: HeartPulse },
  { to: '/admin/experience-page', label: 'Page Expérience', icon: Sparkles },
];

export function AdminSidebar({ hasUnsavedChanges }: AdminSidebarProps) {
  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <NavLink to="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-semibold">QuestRides</span>
        </NavLink>
        <p className="text-xs text-muted-foreground mt-1">Panneau Admin</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
            {to === '/admin/publish' && hasUnsavedChanges && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Draft
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>
      
      {/* Footer */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Admin v1.0
        </p>
      </div>
    </aside>
  );
}
