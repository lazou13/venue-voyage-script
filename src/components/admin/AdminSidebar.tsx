import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, MapPin, ShoppingCart, Store, HeartPulse, Sparkles, Database, Camera, Library, Shield, BarChart3, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/admin/dashboard', label: 'Tableau de bord', icon: BarChart3 },
  { to: '/admin/medina-pois', label: 'Bibliothèque POI', icon: MapPin },
  { to: '/admin/poi-pipeline', label: 'Pipeline POI', icon: Database },
  { to: '/admin/watchdog', label: 'Watchdog Qualité', icon: Shield },
  { to: '/admin/media-library', label: 'Médiathèque', icon: Camera },
  { to: '/admin/quest-library', label: 'Visites', icon: Library },
  { to: '/admin/orders', label: 'Commandes', icon: ShoppingCart },
  { to: '/admin/catalog', label: 'Catalogue', icon: Store },
  { to: '/admin/health', label: 'Santé', icon: HeartPulse },
  { to: '/admin/experience-page', label: 'Page Expérience', icon: Sparkles },
  { to: '/admin/enums', label: 'Enums', icon: List },
  { to: '/admin/docs', label: 'Documentation', icon: BookOpen },
];

export function AdminSidebar() {
  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <NavLink to="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-semibold">Hunt Planer Pro</span>
        </NavLink>
        <p className="text-xs text-muted-foreground mt-1">Panneau Admin</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">Admin v2.0</p>
      </div>
    </aside>
  );
}
