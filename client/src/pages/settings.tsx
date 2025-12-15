import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Bot, Bell, MessageSquare, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BotSettings } from "@shared/schema";

const settingsSchema = z.object({
  welcomeMessage: z.string().min(1, "Welcome message is required").max(1000),
  verificationMessage: z.string().min(1, "Verification message is required").max(500),
  autoJoin: z.boolean(),
  notifyOnJoin: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface BotInfo {
  username: string;
  firstName: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading: settingsLoading } = useQuery<BotSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: botInfo, isLoading: botLoading } = useQuery<BotInfo>({
    queryKey: ["/api/bot/info"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      welcomeMessage: "Welcome! Send me a group invite link and I will join it for you.",
      verificationMessage: "Verification complete!",
      autoJoin: true,
      notifyOnJoin: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        welcomeMessage: settings.welcomeMessage || "",
        verificationMessage: settings.verificationMessage || "",
        autoJoin: settings.autoJoin ?? true,
        notifyOnJoin: settings.notifyOnJoin ?? true,
      });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your bot settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Could not save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-page-title">
          Bot Settings
        </h1>
        <p className="text-muted-foreground">
          Configure your Telegram bot behavior and messages
        </p>
      </div>

      {/* Bot Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Bot Status</CardTitle>
                <CardDescription>Your Telegram bot connection</CardDescription>
              </div>
            </div>
            {botLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : botInfo?.isActive ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-red-500/10 text-red-600 dark:text-red-400">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-red-500" />
                Inactive
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {botLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : botInfo ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Bot Username</p>
                <p className="font-mono text-sm" data-testid="text-bot-username">
                  @{botInfo.username}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bot Name</p>
                <p className="text-sm" data-testid="text-bot-name">
                  {botInfo.firstName}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bot not configured. Please set your bot token.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bot Configuration</CardTitle>
          <CardDescription>
            Customize messages and behavior for your bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <div className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="welcomeMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Welcome Message
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the message users see when they start the bot..."
                          className="min-h-[100px] resize-none"
                          data-testid="input-welcome-message"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This message is sent when users use the /start command
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="verificationMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Verification Message
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the message sent after verification..."
                          className="min-h-[80px] resize-none"
                          data-testid="input-verification-message"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This message is sent in the group after ownership is verified
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="autoJoin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-2 text-base">
                            <Zap className="h-4 w-4" />
                            Auto Join
                          </FormLabel>
                          <FormDescription>
                            Automatically process group join requests
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-join"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notifyOnJoin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-2 text-base">
                            <Bell className="h-4 w-4" />
                            Notifications
                          </FormLabel>
                          <FormDescription>
                            Get notified when bot joins a group
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-notify-on-join"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending || !form.formState.isDirty}
                    data-testid="button-save-settings"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saveMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
