import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { RefreshCw, Users, Shield, CheckCircle, Ban, AlertCircle } from "lucide-react";

interface BanUser extends User {
  isBanned?: boolean;
  banReason?: string | null;
}

export default function AdminUsersPage() {
  const [selectedUser, setSelectedUser] = useState<BanUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [showBanDialog, setShowBanDialog] = useState(false);
  const { toast } = useToast();

  const { data: users = [], isLoading, refetch } = useQuery<BanUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const banMutation = useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      return apiRequest("POST", "/api/admin/ban-user", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User banned successfully" });
      setShowBanDialog(false);
      setBanReason("");
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to ban user", variant: "destructive" });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", "/api/admin/unban-user", { userId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User unbanned successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unban user", variant: "destructive" });
    },
  });

  const handleBanClick = (user: BanUser) => {
    setSelectedUser(user);
    setBanReason("");
    setShowBanDialog(true);
  };

  const handleConfirmBan = () => {
    if (!selectedUser || !banReason.trim()) {
      toast({ title: "Error", description: "Please enter a ban reason", variant: "destructive" });
      return;
    }
    banMutation.mutate({ userId: selectedUser.id, reason: banReason });
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
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Users Management</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No users yet</p>
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.photoUrl || undefined} alt={user.firstName || "User"} />
                  <AvatarFallback>
                    {user.firstName?.[0] || user.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <CardTitle className="truncate text-base font-medium">
                    {user.firstName} {user.lastName}
                  </CardTitle>
                  <span className="truncate text-sm text-muted-foreground">
                    @{user.username || "user"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {user.isAdmin && (
                    <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Shield className="mr-1 h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                  {user.channelVerified && (
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                  {user.isBanned && (
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                      <Ban className="mr-1 h-3 w-3" />
                      Banned
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className="font-medium">Rs. {user.balance?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Telegram ID:</span>
                  <span className="font-mono text-xs">{user.telegramId}</span>
                </div>
                {user.isBanned && user.banReason && (
                  <div className="flex gap-2 rounded-sm bg-red-500/10 p-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{user.banReason}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {user.isBanned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => unbanMutation.mutate(user.id)}
                      disabled={unbanMutation.isPending}
                      data-testid={`button-unban-${user.id}`}
                    >
                      Unban
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleBanClick(user)}
                      data-testid={`button-ban-${user.id}`}
                    >
                      <Ban className="mr-1 h-3 w-3" />
                      Ban
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">User</p>
              <p className="text-sm text-muted-foreground">
                {selectedUser?.firstName} {selectedUser?.lastName} (@{selectedUser?.username})
              </p>
            </div>
            <div>
              <Label htmlFor="reason">Ban Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for banning this user..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="mt-1"
                data-testid="input-ban-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)} data-testid="button-cancel-ban">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBan}
              disabled={banMutation.isPending || !banReason.trim()}
              data-testid="button-confirm-ban"
            >
              {banMutation.isPending ? "Banning..." : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
