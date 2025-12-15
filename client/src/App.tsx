import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import GroupsPage from "@/pages/groups";
import SettingsPage from "@/pages/settings";
import AdminGroupsPage from "@/pages/admin-groups";
import AdminUsersPage from "@/pages/admin-users";
import AdminWithdrawalsPage from "@/pages/admin-withdrawals";
import AdminPricingPage from "@/pages/admin-pricing";
import AdminSettingsPage from "@/pages/admin-settings";
import type { User } from "@shared/schema";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface BotInfo {
  username: string;
  firstName: string;
  isActive: boolean;
}

function AuthenticatedApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [, setLocation] = useLocation();

  const { data: botInfo } = useQuery<BotInfo>({
    queryKey: ["/api/bot/info"],
  });

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} onLogout={onLogout} />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {botInfo && (
                <Badge 
                  variant="secondary" 
                  className={botInfo.isActive 
                    ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }
                >
                  <span className={`mr-1.5 h-2 w-2 rounded-full ${botInfo.isActive ? "bg-green-500" : "bg-red-500"}`} />
                  Bot {botInfo.isActive ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/groups" component={GroupsPage} />
              <Route path="/settings" component={SettingsPage} />
              {user.isAdmin && (
                <>
                  <Route path="/admin/groups" component={AdminGroupsPage} />
                  <Route path="/admin/users" component={AdminUsersPage} />
                  <Route path="/admin/withdrawals" component={AdminWithdrawalsPage} />
                  <Route path="/admin/pricing" component={AdminPricingPage} />
                  <Route path="/admin/settings" component={AdminSettingsPage} />
                </>
              )}
              <Route component={NotFound} />
            </Switch>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const { data: botInfo } = useQuery<BotInfo>({
    queryKey: ["/api/bot/info"],
    retry: false,
  });

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Session check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (telegramUser: TelegramUser) => {
      const response = await apiRequest("POST", "/api/auth/telegram", telegramUser);
      return response.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      setLocation("/dashboard");
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });

  const handleLogin = useCallback((telegramUser: TelegramUser) => {
    loginMutation.mutate(telegramUser);
  }, [loginMutation]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    setLocation("/");
  }, [setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} botUsername={botInfo?.username} />;
  }

  return <AuthenticatedApp user={user} onLogout={handleLogout} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="tg-admin-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
