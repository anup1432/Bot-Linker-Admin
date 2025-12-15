import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminSettings } from "@shared/schema";
import { RefreshCw, Settings, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useEffect } from "react";

interface SettingsFormData {
  requiredChannelId: string;
  requiredChannelUsername: string;
  welcomeMessage: string;
  minGroupAgeDays: number;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();

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

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("PUT", "/api/admin/settings", data);
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

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
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
