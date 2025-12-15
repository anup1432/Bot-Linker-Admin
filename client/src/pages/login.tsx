import { useState, useEffect } from "react";
import { SiTelegram } from "react-icons/si";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Shield, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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

interface AdminLoginConfig {
  isConfigured: boolean;
  otpEnabled: boolean;
  twoStepEnabled: boolean;
}

export default function LoginPage({ onLogin, botUsername }: LoginPageProps) {
  const { toast } = useToast();
  const [telegramId, setTelegramId] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [adminConfig, setAdminConfig] = useState<AdminLoginConfig | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "password">("phone");
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    fetch("/api/admin-login/check")
      .then((res) => res.json())
      .then((data) => setAdminConfig(data))
      .catch(() => setAdminConfig(null));
  }, []);

  const handleTelegramLogin = async () => {
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

  const handleRequestOtp = async () => {
    if (!phoneNumber) {
      toast({ title: "Error", description: "Phone number daalo", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin-login/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "OTP send nahi hua");
      }

      setSessionId(data.sessionId);
      setStep("otp");
      toast({ title: "OTP bhej diya gaya", description: "Apne phone pe check karo" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast({ title: "Error", description: "6 digit OTP daalo", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin-login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, 
          otp,
          password: needsPassword ? password : undefined,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.needsPassword) {
          setNeedsPassword(true);
          setStep("password");
          toast({ title: "Password Required", description: "2-step verification ke liye password daalo" });
          return;
        }
        throw new Error(data.error || "OTP verify nahi hua");
      }

      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      toast({ title: "Error", description: "Password daalo", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin-login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, otp, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Login fail");
      }

      window.location.reload();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
          {adminConfig?.otpEnabled ? (
            <Tabs defaultValue="otp" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="otp" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone OTP
                </TabsTrigger>
                <TabsTrigger value="telegram" className="flex items-center gap-2">
                  <SiTelegram className="h-4 w-4" />
                  Telegram
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="otp" className="space-y-4 mt-4">
                {step === "phone" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+91XXXXXXXXXX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Registered admin phone number daalo
                      </p>
                    </div>
                    <Button 
                      onClick={handleRequestOtp} 
                      className="w-full" 
                      disabled={isLoading || !phoneNumber}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Send OTP
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {step === "otp" && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <Label>Enter 6-digit OTP</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        {phoneNumber} pe OTP bheja gaya
                      </p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <Button 
                      onClick={handleVerifyOtp} 
                      className="w-full" 
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify OTP"
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => { setStep("phone"); setOtp(""); }}
                    >
                      Back
                    </Button>
                  </div>
                )}

                {step === "password" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="pass">Password (2-Step Verification)</Label>
                      <Input
                        id="pass"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                      />
                    </div>
                    <Button 
                      onClick={handlePasswordSubmit} 
                      className="w-full" 
                      disabled={isLoading || !password}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="telegram" className="space-y-4 mt-4">
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
                      onKeyDown={(e) => e.key === "Enter" && handleTelegramLogin()}
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
                      onKeyDown={(e) => e.key === "Enter" && handleTelegramLogin()}
                    />
                  </div>
                  <Button 
                    onClick={handleTelegramLogin} 
                    className="w-full" 
                    disabled={isLoading || !telegramId}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
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
                    onKeyDown={(e) => e.key === "Enter" && handleTelegramLogin()}
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
                    onKeyDown={(e) => e.key === "Enter" && handleTelegramLogin()}
                  />
                </div>
                <Button 
                  onClick={handleTelegramLogin} 
                  className="w-full" 
                  disabled={isLoading || !telegramId}
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
