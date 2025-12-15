import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";
import { RefreshCw, Users, Shield, CheckCircle } from "lucide-react";

export default function AdminUsersPage() {
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

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
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className="font-medium">Rs. {user.balance?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Telegram ID:</span>
                  <span className="font-mono text-xs">{user.telegramId}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
