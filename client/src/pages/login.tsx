import { useEffect, useRef, useState } from "react";
import { SiTelegram } from "react-icons/si";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    TelegramLoginWidget: {
      dataOnauth: (user: TelegramUser) => void;
    };
  }
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface LoginPageProps {
  onLogin: (user: TelegramUser) => void;
  botUsername?: string;
}

export default function LoginPage({ onLogin, botUsername }: LoginPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [telegramId, setTelegramId] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  useEffect(() => {
    if (!botUsername) return;

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    window.TelegramLoginWidget = {
      dataOnauth: (user: TelegramUser) => {
        onLogin(user);
      },
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    
    script.onerror = () => setWidgetError(true);
    
    const checkWidget = setTimeout(() => {
      if (containerRef.current && containerRef.current.children.length <= 1) {
        setWidgetError(true);
      }
    }, 3000);

    containerRef.current?.appendChild(script);

    return () => {
      clearTimeout(checkWidget);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botUsername, onLogin]);

  const handleDevLogin = async () => {
    if (!telegramId) {
      toast({ title: "Error", description: "Please enter your Telegram ID", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const mockUser: TelegramUser = {
      id: parseInt(telegramId),
      first_name: username || "User",
      username: username || undefined,
      auth_date: Math.floor(Date.now() / 1000),
      hash: "dev_mode_hash",
    };
    onLogin(mockUser);
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
            <SiTelegram className="h-12 w-12 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Telegram Bot Admin
          </CardTitle>
          <CardDescription className="text-base">
            Sign in with your Telegram account to manage your bot
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {botUsername && !widgetError ? (
            <div ref={containerRef} className="flex justify-center" data-testid="telegram-login-widget" />
          ) : null}
          
          {(!botUsername || widgetError) && (
            <div className="w-full space-y-4">
              <div className="rounded-md bg-amber-500/10 p-3 text-center text-sm text-amber-600 dark:text-amber-400">
                {!botUsername 
                  ? "Bot not configured. Use manual login below." 
                  : "Telegram widget not loading. Use manual login."}
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="telegramId">Telegram ID</Label>
                  <Input
                    id="telegramId"
                    type="number"
                    placeholder="Enter your Telegram ID"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username (optional)</Label>
                  <Input
                    id="username"
                    placeholder="Your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleDevLogin} 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </div>
            </div>
          )}
          
          <div className="text-center text-xs text-muted-foreground">
            <p>
              By signing in, you agree to allow this bot to access your Telegram account
              for group management purposes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
