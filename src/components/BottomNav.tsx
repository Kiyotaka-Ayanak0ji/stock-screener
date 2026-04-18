import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, User, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, requiresAuth: false },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase, requiresAuth: true },
  { path: "/profile", label: "Profile", icon: User, requiresAuth: true },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isActive } = useSubscription();

  const isCurrentPath = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          if (item.requiresAuth && !user) return null;
          if (item.path === "/portfolio" && !isActive) return null;

          const active = isCurrentPath(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                "active:bg-muted/50",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-[22px] w-[22px]", active && "drop-shadow-sm")} />
              <span className={cn("text-[11px] font-medium leading-none", active && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
