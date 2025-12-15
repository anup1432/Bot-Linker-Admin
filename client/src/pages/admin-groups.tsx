import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GroupJoin, User } from "@shared/schema";
import { Check, X, DollarSign, RefreshCw, Users } from "lucide-react";
import { useState } from "react";

interface GroupWithUser extends GroupJoin {
  user?: User;
}

export default function AdminGroupsPage() {
  const { toast } = useToast();
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

  const { data: groups = [], isLoading } = useQuery<GroupWithUser[]>({
    queryKey: ["/api/admin/groups"],
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GroupJoin> }) => {
      const response = await apiRequest("PATCH", `/api/admin/groups/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      toast({ title: "Group updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update group", variant: "destructive" });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const response = await apiRequest("POST", `/api/admin/groups/${id}/payment`, { amount });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Payment added to user balance" });
    },
    onError: () => {
      toast({ title: "Failed to add payment", variant: "destructive" });
    },
  });

  const handleApprove = (id: string) => {
    updateGroupMutation.mutate({ id, data: { verificationStatus: "approved", status: "approved" } });
  };

  const handleReject = (id: string) => {
    updateGroupMutation.mutate({ id, data: { verificationStatus: "rejected", status: "rejected" } });
  };

  const handleOwnershipVerified = (id: string) => {
    updateGroupMutation.mutate({ id, data: { ownershipTransferred: true } });
  };

  const handleAddPayment = (id: string) => {
    const amount = parseFloat(paymentAmounts[id] || "0");
    if (amount > 0) {
      addPaymentMutation.mutate({ id, amount });
      setPaymentAmounts((prev) => ({ ...prev, [id]: "" }));
    }
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
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Admin Groups Management</h1>
      </div>

      <div className="grid gap-4">
        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No groups submitted yet</p>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.id} data-testid={`card-group-${group.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {group.groupName || "Unknown Group"}
                </CardTitle>
                {getStatusBadge(group.verificationStatus || group.status)}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Link:</span>
                    <a 
                      href={group.groupLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {group.groupLink}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User:</span>
                    <span>@{group.user?.username || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Group Age:</span>
                    <span>{group.groupAge ? `${group.groupAge} days` : "Not verified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ownership Transferred:</span>
                    <span>{group.ownershipTransferred ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Added:</span>
                    <span>{group.paymentAdded ? `Rs. ${group.paymentAmount}` : "No"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  {group.verificationStatus === "pending" && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(group.id)}
                        disabled={updateGroupMutation.isPending}
                        data-testid={`button-approve-${group.id}`}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleReject(group.id)}
                        disabled={updateGroupMutation.isPending}
                        data-testid={`button-reject-${group.id}`}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}

                  {group.verificationStatus === "approved" && !group.ownershipTransferred && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOwnershipVerified(group.id)}
                      disabled={updateGroupMutation.isPending}
                      data-testid={`button-ownership-${group.id}`}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Mark Ownership Transferred
                    </Button>
                  )}

                  {group.ownershipTransferred && !group.paymentAdded && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Amount"
                        className="w-24"
                        value={paymentAmounts[group.id] || ""}
                        onChange={(e) => setPaymentAmounts((prev) => ({ ...prev, [group.id]: e.target.value }))}
                        data-testid={`input-payment-${group.id}`}
                      />
                      <Button 
                        size="sm"
                        onClick={() => handleAddPayment(group.id)}
                        disabled={addPaymentMutation.isPending || !paymentAmounts[group.id]}
                        data-testid={`button-payment-${group.id}`}
                      >
                        <DollarSign className="mr-1 h-4 w-4" />
                        Add Payment
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
