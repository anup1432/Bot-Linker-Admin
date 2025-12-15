import { useState } from "react";
import { SiTelegram } from "react-icons/si";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [telegramId, setTelegramId] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!telegramId) {
      toast({ title: "Error", description: "Please enter your Telegram ID", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const user: TelegramUser = {
      id: parseInt(telegramId),
      first_name: username || "User",
      username: username || undefined,
      auth_date: Math.floor(Date.now() / 1000),
      hash: "dev_mode_hash",
    };
    onLogin(user);
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
            Sign in to manage your bot
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-full space-y-4">
            {botUsername && (
              <div className="rounded-md bg-green-500/10 p-3 text-center text-sm text-green-600 dark:text-green-400">
                Bot @{botUsername} is active
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label htmlFor="telegramId">Telegram ID</Label>
                <Input
                  id="telegramId"
                  type="number"
                  placeholder="Enter your Telegram ID"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Get your ID from @userinfobot on Telegram
                </p>
              </div>
              <div>
                <Label htmlFor="username">Username (optional)</Label>
                <Input
                  id="username"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <Button 
                onClick={handleLogin} 
                className="w-full" 
                disabled={isLoading || !telegramId}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          </div>
          
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
