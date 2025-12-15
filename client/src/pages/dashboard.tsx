import { useQuery } from "@tanstack/react-query";
import { Users, CheckCircle, Clock, AlertCircle, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GroupJoin, ActivityLog } from "@shared/schema";

interface StatsData {
  totalGroups: number;
  pendingJoins: number;
  verifiedToday: number;
  failedJoins: number;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  variant = "default" 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  description: string;
  variant?: "default" | "success" | "warning" | "destructive";
}) {
  const iconClasses = {
    default: "text-primary",
    success: "text-green-500 dark:text-green-400",
    warning: "text-amber-500 dark:text-amber-400",
    destructive: "text-red-500 dark:text-red-400",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClasses[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" data-testid={`stat-${title.toLowerCase().replace(' ', '-')}`}>
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ log }: { log: ActivityLog }) {
  const actionIcons: Record<string, React.ElementType> = {
    join_requested: Clock,
    joined: Users,
    verified: CheckCircle,
    failed: AlertCircle,
  };

  const actionColors: Record<string, string> = {
    join_requested: "bg-amber-500/10 text-amber-500",
    joined: "bg-blue-500/10 text-blue-500",
    verified: "bg-green-500/10 text-green-500",
    failed: "bg-red-500/10 text-red-500",
  };

  const Icon = actionIcons[log.action] || Activity;
  const colorClass = actionColors[log.action] || "bg-muted text-muted-foreground";

  const timeAgo = log.createdAt ? formatTimeAgo(new Date(log.createdAt)) : "";

  return (
    <div 
      className="flex items-start gap-3 rounded-md p-3 hover-elevate"
      data-testid={`activity-item-${log.id}`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{log.description}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function RecentGroupItem({ group }: { group: GroupJoin }) {
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    joined: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    verified: "bg-green-500/10 text-green-600 dark:text-green-400",
    failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <div 
      className="flex items-center justify-between gap-4 rounded-md border border-border p-3"
      data-testid={`group-item-${group.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {group.groupName || "Unknown Group"}
        </p>
        <p className="truncate text-xs text-muted-foreground font-mono">
          {group.groupLink}
        </p>
      </div>
      <Badge 
        variant="secondary" 
        className={`shrink-0 capitalize ${statusColors[group.status] || ""}`}
      >
        {group.status}
      </Badge>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activities"],
  });

  const { data: recentGroups, isLoading: groupsLoading } = useQuery<GroupJoin[]>({
    queryKey: ["/api/groups", "recent"],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your bot activity and group joins
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Total Groups"
              value={stats?.totalGroups || 0}
              icon={Users}
              description="All groups tracked"
            />
            <StatCard
              title="Pending Joins"
              value={stats?.pendingJoins || 0}
              icon={Clock}
              description="Awaiting action"
              variant="warning"
            />
            <StatCard
              title="Verified Today"
              value={stats?.verifiedToday || 0}
              icon={CheckCircle}
              description="Successfully verified"
              variant="success"
            />
            <StatCard
              title="Failed Joins"
              value={stats?.failedJoins || 0}
              icon={AlertCircle}
              description="Need attention"
              variant="destructive"
            />
          </>
        )}
      </div>

      {/* Activity and Recent Groups */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest bot actions and events</CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-1">
                  {activities.map((log) => (
                    <ActivityItem key={log.id} log={log} />
                  ))}
                </div>
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center text-center">
                  <Activity className="mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground">
                    Activity will appear here as your bot processes groups
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Group Joins</CardTitle>
            <CardDescription>Latest groups sent to your bot</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {groupsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 p-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentGroups && recentGroups.length > 0 ? (
                <div className="space-y-2">
                  {recentGroups.map((group) => (
                    <RecentGroupItem key={group.id} group={group} />
                  ))}
                </div>
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center text-center">
                  <Users className="mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No groups yet</p>
                  <p className="text-xs text-muted-foreground">
                    Send a group link to your bot to get started
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
