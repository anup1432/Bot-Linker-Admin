import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PricingSettings } from "@shared/schema";
import { RefreshCw, DollarSign, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface PricingFormData {
  minAgeDays: number;
  maxAgeDays: number | null;
  pricePerGroup: number;
}

export default function AdminPricingPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<PricingFormData>({
    defaultValues: {
      minAgeDays: 30,
      maxAgeDays: null,
      pricePerGroup: 100,
    },
  });

  const { data: pricingSettings = [], isLoading } = useQuery<PricingSettings[]>({
    queryKey: ["/api/admin/pricing"],
  });

  const createPricingMutation = useMutation({
    mutationFn: async (data: PricingFormData) => {
      const response = await apiRequest("POST", "/api/admin/pricing", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      toast({ title: "Pricing tier added successfully" });
      setShowForm(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add pricing tier", variant: "destructive" });
    },
  });

  const deletePricingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/pricing/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      toast({ title: "Pricing tier deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete pricing tier", variant: "destructive" });
    },
  });

  const onSubmit = (data: PricingFormData) => {
    createPricingMutation.mutate(data);
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Pricing Settings</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-pricing">
          <Plus className="mr-1 h-4 w-4" />
          Add Tier
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Pricing Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="minAgeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Age (days)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-min-age"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxAgeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Age (days, leave empty for unlimited)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ""} 
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-max-age"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricePerGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (Rs.)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            data-testid="input-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createPricingMutation.isPending} data-testid="button-save-pricing">
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pricingSettings.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No pricing tiers configured. Add one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          pricingSettings.map((pricing) => (
            <Card key={pricing.id} data-testid={`card-pricing-${pricing.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">
                  Rs. {pricing.pricePerGroup}
                </CardTitle>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => deletePricingMutation.mutate(pricing.id)}
                  disabled={deletePricingMutation.isPending}
                  data-testid={`button-delete-${pricing.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Group age: {pricing.minAgeDays} - {pricing.maxAgeDays ?? "unlimited"} days
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
