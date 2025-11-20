import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

// Dummy data for KPIs - will be replaced with real data later
const mockKPIs = [
  {
    metric_name: "Call Resolution Rate",
    metric_value: 92.5,
    bonus_amount: 50.0,
    period_start: "2024-01-01",
    period_end: "2024-01-31",
  },
  {
    metric_name: "Customer Satisfaction",
    metric_value: 4.8,
    bonus_amount: 75.0,
    period_start: "2024-01-01",
    period_end: "2024-01-31",
  },
  {
    metric_name: "Average Handle Time",
    metric_value: 4.2,
    bonus_amount: 25.0,
    period_start: "2024-01-01",
    period_end: "2024-01-31",
  },
];

export const KPITable = () => {
  const formatValue = (metricName: string, value: number) => {
    if (metricName.includes("Rate")) {
      return `${value}%`;
    }
    if (metricName.includes("Satisfaction")) {
      return `${value}/5.0`;
    }
    if (metricName.includes("Time")) {
      return `${value}min`;
    }
    return value.toString();
  };

  const getBadgeVariant = (bonus: number) => {
    if (bonus >= 50) return "default";
    if (bonus >= 25) return "secondary";
    return "outline";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent KPIs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead>Period</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockKPIs.map((kpi, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{kpi.metric_name}</TableCell>
                <TableCell>
                  {formatValue(kpi.metric_name, kpi.metric_value)}
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(kpi.bonus_amount)}>
                    ${kpi.bonus_amount.toFixed(2)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {new Date(kpi.period_start).toLocaleDateString()} -{" "}
                  {new Date(kpi.period_end).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
