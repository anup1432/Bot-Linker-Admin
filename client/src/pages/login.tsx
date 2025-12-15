import { useEffect, useRef } from "react";
import { SiTelegram } from "react-icons/si";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  useEffect(() => {
    if (!botUsername) return;

    // Clear previous widget
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    // Create callback
    window.TelegramLoginWidget = {
      dataOnauth: (user: TelegramUser) => {
        onLogin(user);
      },
    };

    // Create script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    containerRef.current?.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botUsername, onLogin]);

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
          {botUsername ? (
            <div ref={containerRef} className="flex justify-center" data-testid="telegram-login-widget" />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-md bg-muted p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Bot not configured. Please set up your Telegram bot token first.
              </p>
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
