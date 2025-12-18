import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { YearPricing } from "@shared/schema";
import { RefreshCw, DollarSign, Plus, Trash2, Power, PowerOff, Calendar } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface YearPricingFormData {
  startYear: number;
  endYear: number | null;
  month: number | null;
  category: string;
  pricePerGroup: number;
}

const currentYear = new Date().getFullYear();
const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function AdminPricingPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [pricingType, setPricingType] = useState<"range" | "yearly" | "monthly">("range");

  const form = useForm<YearPricingFormData>({
    defaultValues: {
      startYear: 2016,
      endYear: 2022,
      month: null,
      category: "used",
      pricePerGroup: 100,
    },
  });

  const { data: yearPricingList = [], isLoading } = useQuery<YearPricing[]>({
    queryKey: ["/api/admin/year-pricing"],
  });

  const createPricingMutation = useMutation({
    mutationFn: async (data: YearPricingFormData) => {
      const response = await apiRequest("POST", "/api/admin/year-pricing", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/year-pricing"] });
      toast({ title: "Pricing added successfully" });
      setShowForm(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add pricing", variant: "destructive" });
    },
  });

  const togglePricingMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/year-pricing/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/year-pricing"] });
      toast({ title: "Pricing status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update pricing", variant: "destructive" });
    },
  });

  const deletePricingMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/year-pricing/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/year-pricing"] });
      toast({ title: "Pricing deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete pricing", variant: "destructive" });
    },
  });

  const onSubmit = (data: YearPricingFormData) => {
    const submitData = { ...data };
    
    if (pricingType === "range") {
      submitData.month = null;
    } else if (pricingType === "yearly") {
      submitData.endYear = null;
      submitData.month = null;
    }
    
    createPricingMutation.mutate(submitData);
  };

  const formatPricingPeriod = (pricing: YearPricing) => {
    if (pricing.month) {
      const monthName = months.find(m => m.value === pricing.month)?.label || "";
      return `${monthName} ${pricing.startYear}`;
    }
    if (pricing.endYear && pricing.endYear !== pricing.startYear) {
      return `${pricing.startYear} - ${pricing.endYear}`;
    }
    return `${pricing.startYear}`;
  };

  const usedPricing = yearPricingList.filter(p => p.category === "used");
  const unusedPricing = yearPricingList.filter(p => p.category === "unused");

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
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Year-Based Pricing</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-pricing">
          <Plus className="mr-1 h-4 w-4" />
          Add Pricing
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Add Year-Based Pricing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={pricingType === "range" ? "default" : "outline"}
                  onClick={() => {
                    setPricingType("range");
                    form.setValue("endYear", 2022);
                    form.setValue("month", null);
                  }}
                  data-testid="button-type-range"
                >
                  Year Range (e.g. 2016-2022)
                </Button>
                <Button
                  type="button"
                  variant={pricingType === "yearly" ? "default" : "outline"}
                  onClick={() => {
                    setPricingType("yearly");
                    form.setValue("endYear", null);
                    form.setValue("month", null);
                  }}
                  data-testid="button-type-yearly"
                >
                  Single Year (e.g. 2023)
                </Button>
                <Button
                  type="button"
                  variant={pricingType === "monthly" ? "default" : "outline"}
                  onClick={() => {
                    setPricingType("monthly");
                    form.setValue("startYear", currentYear);
                    form.setValue("endYear", null);
                  }}
                  data-testid="button-type-monthly"
                >
                  Monthly ({currentYear})
                </Button>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="startYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{pricingType === "range" ? "Start Year" : "Year"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-start-year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {pricingType === "range" && (
                    <FormField
                      control={form.control}
                      name="endYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Year</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              value={field.value ?? ""} 
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              data-testid="input-end-year"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {pricingType === "monthly" && (
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month</FormLabel>
                          <Select
                            value={field.value?.toString() || ""}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-month">
                                <SelectValue placeholder="Select month" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month.value} value={month.value.toString()}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="used">Used</SelectItem>
                            <SelectItem value="unused">Unused</SelectItem>
                          </SelectContent>
                        </Select>
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
                    Save Pricing
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

      <Tabs defaultValue="used" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="used" data-testid="tab-used">
            Used Groups ({usedPricing.length})
          </TabsTrigger>
          <TabsTrigger value="unused" data-testid="tab-unused">
            Unused Groups ({unusedPricing.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="used" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usedPricing.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">No pricing for Used groups. Add one to get started.</p>
                </CardContent>
              </Card>
            ) : (
              usedPricing.map((pricing) => (
                <PricingCard 
                  key={pricing.id} 
                  pricing={pricing}
                  onToggle={(isActive) => togglePricingMutation.mutate({ id: pricing.id, isActive })}
                  onDelete={() => deletePricingMutation.mutate(pricing.id)}
                  formatPeriod={formatPricingPeriod}
                  isPending={togglePricingMutation.isPending || deletePricingMutation.isPending}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="unused" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unusedPricing.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">No pricing for Unused groups. Add one to get started.</p>
                </CardContent>
              </Card>
            ) : (
              unusedPricing.map((pricing) => (
                <PricingCard 
                  key={pricing.id} 
                  pricing={pricing}
                  onToggle={(isActive) => togglePricingMutation.mutate({ id: pricing.id, isActive })}
                  onDelete={() => deletePricingMutation.mutate(pricing.id)}
                  formatPeriod={formatPricingPeriod}
                  isPending={togglePricingMutation.isPending || deletePricingMutation.isPending}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PricingCard({ 
  pricing, 
  onToggle, 
  onDelete, 
  formatPeriod,
  isPending 
}: { 
  pricing: YearPricing;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
  formatPeriod: (pricing: YearPricing) => string;
  isPending: boolean;
}) {
  const period = formatPeriod(pricing);
  const isMonthly = pricing.month !== null;

  return (
    <Card 
      className={!pricing.isActive ? "opacity-60" : ""}
      data-testid={`card-pricing-${pricing.id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-lg font-medium">
            Rs. {pricing.pricePerGroup}
          </CardTitle>
          {isMonthly && (
            <Badge variant="secondary" className="text-xs">Monthly</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={pricing.isActive}
            onCheckedChange={onToggle}
            disabled={isPending}
            data-testid={`switch-active-${pricing.id}`}
          />
          <Button 
            size="icon" 
            variant="ghost"
            onClick={onDelete}
            disabled={isPending}
            data-testid={`button-delete-${pricing.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {period}
          </p>
          <Badge variant={pricing.isActive ? "default" : "outline"}>
            {pricing.isActive ? (
              <><Power className="h-3 w-3 mr-1" /> Active</>
            ) : (
              <><PowerOff className="h-3 w-3 mr-1" /> Stopped</>
            )}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
