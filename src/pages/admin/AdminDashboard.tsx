import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Crown, Image as ImageIcon, BookOpen, DollarSign, Loader2 } from "lucide-react";
import { adminApi } from "@/api/admin.api";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        // Load the combined overview from our new backend API
        const data = await adminApi.getDashboardOverview();
        if (mounted) {
          setOverviewData(data);
        }
      } catch (err) {
        console.error("Failed to load admin dashboard overview", err);
        toast.error("Failed to load dashboard metrics");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!overviewData) return null;

  const { users, subscriptions, revenue, usage, costs } = overviewData;

  const kpis = [
    { title: "Total Users", value: users.total, icon: Users, color: "text-blue-500" },
    { title: "Premium Users", value: subscriptions.premium, icon: Crown, color: "text-amber-500" },
    { title: "Stories Generated", value: usage.stories, icon: BookOpen, color: "text-purple-500" },
    { title: "Illustrations", value: usage.illustrations, icon: ImageIcon, color: "text-pink-500" },
    { title: "AI Cost", value: `$${costs.totalAiCost.toFixed(2)}`, icon: DollarSign, color: "text-red-500" },
    { title: "Monthly Revenue", value: `$${revenue.monthly.toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
  ];

  // Data for charts
  const subscriptionData = [
    { name: "Free", value: subscriptions.free },
    { name: "Premium", value: subscriptions.premium },
  ];
  const COLORS = ['#94a3b8', '#f59e0b']; // Slate for free, Amber for premium

  const usageData = [
    { name: "Stories", count: usage.stories },
    { name: "Illustrations", count: usage.illustrations },
    { name: "PDFs", count: usage.pdfExports },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Admin SaaS Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monetization & Operations Overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {subscriptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
