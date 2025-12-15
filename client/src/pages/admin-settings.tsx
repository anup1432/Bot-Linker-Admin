import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminSettings } from "@shared/schema";
import { RefreshCw, Settings, Save, Shield, Phone, Key, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";

interface SettingsFormData {
  requiredChannelId: string;
  requiredChannelUsername: string;
  welcomeMessage: string;
  minGroupAgeDays: number;
}

interface AuthSettings {
  adminPhoneNumber: string;
  hasPassword: boolean;
  hasTwilioCredentials: boolean;
  otpEnabled: boolean;
  twoStepEnabled: boolean;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");

  const form = useForm<SettingsFormData>({
    defaultValues: {
      requiredChannelId: "",
      requiredChannelUsername: "",
      welcomeMessage: "Welcome! Please join our channel first to use this bot.",
      minGroupAgeDays: 30,
    },
  });

  const { data: settings, isLoading } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const { data: authSettings, isLoading: authLoading } = useQuery<AuthSettings>({
    queryKey: ["/api/admin/auth-settings"],
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        requiredChannelId: settings.requiredChannelId || "",
        requiredChannelUsername: settings.requiredChannelUsername || "",
        welcomeMessage: settings.welcomeMessage || "",
        minGroupAgeDays: settings.minGroupAgeDays || 30,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    if (authSettings) {
      setPhoneNumber(authSettings.adminPhoneNumber || "");
    }
  }, [authSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("POST", "/api/admin/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await apiRequest("POST", "/api/admin/phone", { phoneNumber: phone });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth-settings"] });
      toast({ title: "Phone number saved" });
    },
    onError: () => {
      toast({ title: "Failed to save phone number", variant: "destructive" });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (pass: string) => {
      const response = await apiRequest("POST", "/api/admin/password", { password: pass });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth-settings"] });
      setPassword("");
      toast({ title: "Password saved" });
    },
    onError: () => {
      toast({ title: "Failed to save password", variant: "destructive" });
    },
  });

  const updateTwilioMutation = useMutation({
    mutationFn: async (data: { accountSid: string; authToken: string; phoneNumber: string }) => {
      const response = await apiRequest("POST", "/api/admin/twilio", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth-settings"] });
      setTwilioSid("");
      setTwilioToken("");
      setTwilioPhone("");
      toast({ title: "Twilio credentials saved" });
    },
    onError: () => {
      toast({ title: "Failed to save Twilio credentials", variant: "destructive" });
    },
  });

  const toggleSecurityMutation = useMutation({
    mutationFn: async (data: { otpEnabled?: boolean; twoStepEnabled?: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/security-toggle", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth-settings"] });
      toast({ title: "Security settings updated" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Failed to update settings", variant: "destructive" });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Global Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Configure admin login security with OTP and 2-step verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="font-medium">Admin Phone Number</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="+91XXXXXXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <Button 
                onClick={() => updatePhoneMutation.mutate(phoneNumber)}
                disabled={updatePhoneMutation.isPending || !phoneNumber}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Phone number jahan OTP aayega (format: +91XXXXXXXXXX)
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="font-medium">Admin Password (2-Step)</span>
              {authSettings?.hasPassword && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Set</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={authSettings?.hasPassword ? "Enter new password to change" : "Set password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button 
                onClick={() => updatePasswordMutation.mutate(password)}
                disabled={updatePasswordMutation.isPending || !password}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="font-medium">Twilio API Credentials</span>
              {authSettings?.hasTwilioCredentials && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Configured</span>
              )}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Account SID (ACxxxxxxxx...)"
                value={twilioSid}
                onChange={(e) => setTwilioSid(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Auth Token"
                value={twilioToken}
                onChange={(e) => setTwilioToken(e.target.value)}
              />
              <Input
                placeholder="Twilio Phone Number (+1234567890)"
                value={twilioPhone}
                onChange={(e) => setTwilioPhone(e.target.value)}
              />
              <Button 
                onClick={() => updateTwilioMutation.mutate({
                  accountSid: twilioSid,
                  authToken: twilioToken,
                  phoneNumber: twilioPhone,
                })}
                disabled={updateTwilioMutation.isPending || !twilioSid || !twilioToken || !twilioPhone}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Twilio Credentials
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Twilio.com se Account SID aur Auth Token le. Trial account me free credits milte hain.
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <span className="font-medium">Enable Security Features</span>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">OTP Verification</p>
                <p className="text-sm text-muted-foreground">Login ke liye phone OTP required</p>
              </div>
              <Switch
                checked={authSettings?.otpEnabled || false}
                onCheckedChange={(checked) => toggleSecurityMutation.mutate({ otpEnabled: checked })}
                disabled={toggleSecurityMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">2-Step Verification</p>
                <p className="text-sm text-muted-foreground">OTP + Password dono required</p>
              </div>
              <Switch
                checked={authSettings?.twoStepEnabled || false}
                onCheckedChange={(checked) => toggleSecurityMutation.mutate({ twoStepEnabled: checked })}
                disabled={toggleSecurityMutation.isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot Configuration</CardTitle>
          <CardDescription>Configure the bot behavior and requirements</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="requiredChannelUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required Channel Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="@yourchannel" 
                        {...field} 
                        data-testid="input-channel-username"
                      />
                    </FormControl>
                    <FormDescription>
                      Users must join this channel before using the bot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiredChannelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required Channel ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="-1001234567890" 
                        {...field} 
                        data-testid="input-channel-id"
                      />
                    </FormControl>
                    <FormDescription>
                      The numeric ID of the required channel (for verification)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minGroupAgeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Group Age (days)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-min-group-age"
                      />
                    </FormControl>
                    <FormDescription>
                      Groups must be at least this many days old to be approved
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Welcome message for new users..." 
                        className="min-h-24"
                        {...field} 
                        data-testid="input-welcome-message"
                      />
                    </FormControl>
                    <FormDescription>
                      Shown to users when they first start the bot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateSettingsMutation.isPending}
                data-testid="button-save-settings"
              >
                <Save className="mr-1 h-4 w-4" />
                Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
