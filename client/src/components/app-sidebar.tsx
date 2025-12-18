import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, Settings, LogOut, Shield, Wallet, DollarSign, Cog } from "lucide-react";
import { SiTelegram } from "react-icons/si";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Group Joins",
    url: "/groups",
    icon: Users,
  },
  {
    title: "Bot Settings",
    url: "/settings",
    icon: Settings,
  },
];

const adminMenuItems = [
  {
    title: "Manage Groups",
    url: "/admin/groups",
    icon: Users,
  },
  {
    title: "Manage Users",
    url: "/admin/users",
    icon: Shield,
  },
  {
    title: "Withdrawals",
    url: "/admin/withdrawals",
    icon: Wallet,
  },
  {
    title: "Pricing",
    url: "/admin/pricing",
    icon: DollarSign,
  },
  {
    title: "Global Settings",
    url: "/admin/settings",
    icon: Cog,
  },
];

interface AppSidebarProps {
  user: User | null;
  onLogout: () => void;
}

export function AppSidebar({ user, onLogout }: AppSidebarProps) {
  const [location] = useLocation();

  const normalizeLocation = (loc: string) => {
    return loc.endsWith('/') && loc !== '/' ? loc.slice(0, -1) : loc;
  };

  const normalizedLocation = normalizeLocation(location);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <SiTelegram className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">TG Bot Admin</span>
            <span className="text-xs text-muted-foreground">Control Panel</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={normalizedLocation === item.url || (item.url === '/' && normalizedLocation === '')}
                    data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={normalizedLocation === item.url}
                      data-testid={`link-admin-${item.title.toLowerCase().replace(' ', '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        {user && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-md bg-sidebar-accent p-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.photoUrl || undefined} alt={user.firstName || "User"} />
                <AvatarFallback className="text-xs">
                  {user.firstName?.[0] || user.username?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium">
                  {user.firstName} {user.lastName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  @{user.username || "user"}
                </span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={onLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
