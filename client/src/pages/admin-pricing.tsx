import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { YearPricing } from "@shared/schema";
import { RefreshCw, DollarSign, Trash2, Power, PowerOff, Edit2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface YearPricingFormData {
  startYear: number;
  endYear: number | null;
  month: number | null;
  category: string;
  pricePerGroup: number;
}

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
  const [editingId, setEditingId] = useState<number | null>(null);

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

  // Helper functions to find pricing
  const findPricing = (startYear: number, endYear: number | null = null, month: number | null = null, category: string) => {
    return yearPricingList.find(p => 
      p.startYear === startYear && 
      p.endYear === endYear && 
      p.month === month && 
      p.category === category
    );
  };

  const getPricingByPeriod = (startYear: number, endYear: number | null = null, month: number | null = null) => {
    return yearPricingList.filter(p => 
      p.startYear === startYear && 
      p.endYear === endYear && 
      p.month === month
    );
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
        <DollarSign className="h-6 w-6" />
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Pricing Configuration</h1>
      </div>

      {/* 2016-22 Range Pricing Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2016 - 2022 (Same Rate)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Set pricing for groups created between 2016-2022</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <PricingInputCard
              label="Used Groups"
              pricing={findPricing(2016, 2022, null, "used")}
              onSave={(price) => {
                const existing = findPricing(2016, 2022, null, "used");
                if (existing) {
                  togglePricingMutation.mutate({ id: existing.id, isActive: true });
                } else {
                  createPricingMutation.mutate({
                    startYear: 2016,
                    endYear: 2022,
                    month: null,
                    category: "used",
                    pricePerGroup: price,
                  });
                }
              }}
              onDelete={(id) => deletePricingMutation.mutate(id)}
              onToggle={(id, active) => togglePricingMutation.mutate({ id, isActive: active })}
              isPending={createPricingMutation.isPending || togglePricingMutation.isPending || deletePricingMutation.isPending}
            />
            <PricingInputCard
              label="Unused Groups"
              pricing={findPricing(2016, 2022, null, "unused")}
              onSave={(price) => {
                const existing = findPricing(2016, 2022, null, "unused");
                if (existing) {
                  togglePricingMutation.mutate({ id: existing.id, isActive: true });
                } else {
                  createPricingMutation.mutate({
                    startYear: 2016,
                    endYear: 2022,
                    month: null,
                    category: "unused",
                    pricePerGroup: price,
                  });
                }
              }}
              onDelete={(id) => deletePricingMutation.mutate(id)}
              onToggle={(id, active) => togglePricingMutation.mutate({ id, isActive: active })}
              isPending={createPricingMutation.isPending || togglePricingMutation.isPending || deletePricingMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2023 Yearly Pricing Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2023 (Yearly)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Set pricing for groups created in 2023</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <PricingInputCard
              label="Used Groups"
              pricing={findPricing(2023, null, null, "used")}
              onSave={(price) => {
                const existing = findPricing(2023, null, null, "used");
                if (existing) {
                  togglePricingMutation.mutate({ id: existing.id, isActive: true });
                } else {
                  createPricingMutation.mutate({
                    startYear: 2023,
                    endYear: null,
                    month: null,
                    category: "used",
                    pricePerGroup: price,
                  });
                }
              }}
              onDelete={(id) => deletePricingMutation.mutate(id)}
              onToggle={(id, active) => togglePricingMutation.mutate({ id, isActive: active })}
              isPending={createPricingMutation.isPending || togglePricingMutation.isPending || deletePricingMutation.isPending}
            />
            <PricingInputCard
              label="Unused Groups"
              pricing={findPricing(2023, null, null, "unused")}
              onSave={(price) => {
                const existing = findPricing(2023, null, null, "unused");
                if (existing) {
                  togglePricingMutation.mutate({ id: existing.id, isActive: true });
                } else {
                  createPricingMutation.mutate({
                    startYear: 2023,
                    endYear: null,
                    month: null,
                    category: "unused",
                    pricePerGroup: price,
                  });
                }
              }}
              onDelete={(id) => deletePricingMutation.mutate(id)}
              onToggle={(id, active) => togglePricingMutation.mutate({ id, isActive: active })}
              isPending={createPricingMutation.isPending || togglePricingMutation.isPending || deletePricingMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2024 Monthly Pricing Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2024 (Monthly Pricing)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Set pricing for each month in 2024</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {months.map((month) => (
              <div key={month.value} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-base">{month.label}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <PricingInputCard
                    label={`${month.label} - Used Groups`}
                    pricing={findPricing(2024, null, month.value, "used")}
                    onSave={(price) => {
                      const existing = findPricing(2024, null, month.value, "used");
                      if (existing) {
                        togglePricingMutation.mutate({ id: existing.id, isActive: true });
                      } else {
                        createPricingMutation.mutate({
                          startYear: 2024,
                          endYear: null,
                          month: month.value,
                          category: "used",
                          pricePerGroup: price,
                        });
                      }
                    }}
                    onDelete={(id) => deletePricingMutation.mutate(id)}
                    onToggle={(id, active) => togglePricingMutation.mutate({ id, isActive: active })}
                    isPending={createPricingMutation.isPending || togglePricingMutation.isPending || deletePricingMutation.isPending}
                    isCompact
                  />
                  <PricingInputCard
                    label={`${month.label} - Unused Groups`}
                    pricing={findPricing(2024, null, month.value, "unused")}
                    onSave={(price) => {
                      const existing = findPricing(2024, null, month.value, "unused");
                      if (existing) {
                        togglePricingMutation.mutate({ id: existing.id, isActive: true });
                      } else {
                        createPricingMutation.mutate({
                          startYear: 2024,
                          endYear: null,
                          month: month.value,
                          category: "unused",
                          pricePerGroup: price,
                        });
                      }
                    }}
                    onDelete={(id) => deletePricingMutation.mutate(id)}
                    onToggle={(id, active) => togglePricingMutation.mutate({ id, isActive: active })}
                    isPending={createPricingMutation.isPending || togglePricingMutation.isPending || deletePricingMutation.isPending}
                    isCompact
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PricingInputCard({
  label,
  pricing,
  onSave,
  onDelete,
  onToggle,
  isPending,
  isCompact = false,
}: {
  label: string;
  pricing: YearPricing | undefined;
  onSave: (price: number) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, active: boolean) => void;
  isPending: boolean;
  isCompact?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(pricing?.pricePerGroup.toString() || "");

  const handleSave = () => {
    if (inputValue.trim()) {
      onSave(parseFloat(inputValue));
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setInputValue(pricing?.pricePerGroup.toString() || "");
    setIsEditing(false);
  };

  if (!pricing && isEditing) {
    return (
      <div className={`border rounded-lg p-3 ${isCompact ? "p-2" : ""}`}>
        <label className={`text-sm font-medium block mb-2 ${isCompact ? "text-xs mb-1" : ""}`}>{label}</label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Enter price"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            data-testid={`input-price-${label}`}
          />
          <Button
            size={isCompact ? "sm" : "default"}
            onClick={handleSave}
            disabled={isPending}
            data-testid={`button-save-${label}`}
          >
            Save
          </Button>
          <Button
            size={isCompact ? "sm" : "default"}
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className={`border border-dashed rounded-lg p-3 flex items-center justify-center min-h-20 ${isCompact ? "p-2 min-h-16" : ""}`}>
        <Button
          variant="outline"
          size={isCompact ? "sm" : "default"}
          onClick={() => setIsEditing(true)}
          disabled={isPending}
          data-testid={`button-add-${label}`}
        >
          <Edit2 className={`${isCompact ? "h-3 w-3" : "h-4 w-4"} mr-1`} />
          {isCompact ? "Add" : "Add Pricing"}
        </Button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 ${isCompact ? "p-2" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <label className={`text-sm font-medium ${isCompact ? "text-xs" : ""}`}>{label}</label>
        <div className="flex items-center gap-1">
          <Switch
            checked={pricing.isActive}
            onCheckedChange={(active) => onToggle(pricing.id, active)}
            disabled={isPending}
            data-testid={`switch-active-${pricing.id}`}
          />
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 ${isCompact ? "h-6 w-6" : ""}`}
            onClick={() => onDelete(pricing.id)}
            disabled={isPending}
            data-testid={`button-delete-${pricing.id}`}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
      
      <div className={`flex items-center gap-2 ${isCompact ? "gap-1" : ""}`}>
        {isEditing ? (
          <>
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={`flex-1 ${isCompact ? "text-sm h-8" : ""}`}
              data-testid={`input-edit-${pricing.id}`}
            />
            <Button
              size={isCompact ? "sm" : "default"}
              onClick={handleSave}
              disabled={isPending}
              className={`${isCompact ? "h-8" : ""}`}
            >
              Save
            </Button>
            <Button
              size={isCompact ? "sm" : "default"}
              variant="outline"
              onClick={handleCancel}
              className={`${isCompact ? "h-8" : ""}`}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className={`text-2xl font-bold text-primary ${isCompact ? "text-lg" : ""}`}>
              ₹{pricing.pricePerGroup}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className={`h-7 w-7 ${isCompact ? "h-6 w-6" : ""}`}
              onClick={() => {
                setInputValue(pricing.pricePerGroup.toString());
                setIsEditing(true);
              }}
              disabled={isPending}
              data-testid={`button-edit-${pricing.id}`}
            >
              <Edit2 className={`${isCompact ? "h-3 w-3" : "h-4 w-4"}`} />
            </Button>
            <Badge variant={pricing.isActive ? "default" : "outline"} className={isCompact ? "text-xs" : ""}>
              {pricing.isActive ? (
                <><Power className="h-2 w-2 mr-1" /> Active</>
              ) : (
                <><PowerOff className="h-2 w-2 mr-1" /> Stopped</>
              )}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}
