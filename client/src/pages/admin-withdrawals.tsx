import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Withdrawal, User } from "@shared/schema";
import { Check, X, RefreshCw, Wallet } from "lucide-react";

interface WithdrawalWithUser extends Withdrawal {
  user?: User;
}

export default function AdminWithdrawalsPage() {
  const { toast } = useToast();

  const { data: withdrawals = [], isLoading } = useQuery<WithdrawalWithUser[]>({
    queryKey: ["/api/admin/withdrawals"],
  });

  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/withdrawals/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Withdrawal updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update withdrawal", variant: "destructive" });
    },
  });

  const handleApprove = (id: string) => {
    updateWithdrawalMutation.mutate({ id, status: "approved" });
  };

  const handleReject = (id: string) => {
    updateWithdrawalMutation.mutate({ id, status: "rejected" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Rejected</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
        <Wallet className="h-6 w-6" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Withdrawals Management</h1>
      </div>

      <div className="grid gap-4">
        {withdrawals.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No withdrawal requests yet</p>
            </CardContent>
          </Card>
        ) : (
          withdrawals.map((withdrawal) => (
            <Card key={withdrawal.id} data-testid={`card-withdrawal-${withdrawal.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  Rs. {withdrawal.amount?.toFixed(2)}
                </CardTitle>
                {getStatusBadge(withdrawal.status)}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User:</span>
                    <span>@{withdrawal.user?.username || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span>{withdrawal.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Details:</span>
                    <span className="text-right max-w-48 truncate">{withdrawal.paymentDetails}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested:</span>
                    <span>{new Date(withdrawal.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {withdrawal.status === "pending" && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button 
                      size="sm" 
                      onClick={() => handleApprove(withdrawal.id)}
                      disabled={updateWithdrawalMutation.isPending}
                      data-testid={`button-approve-${withdrawal.id}`}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleReject(withdrawal.id)}
                      disabled={updateWithdrawalMutation.isPending}
                      data-testid={`button-reject-${withdrawal.id}`}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
