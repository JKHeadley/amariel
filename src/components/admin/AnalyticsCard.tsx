import { Card } from '@/components/ui/card';
import { theme } from '@/config/theme';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsCardProps {
  title: string;
  data: any[];
  categories: string[];
  loading?: boolean;
}

export function AnalyticsCard({
  title,
  data,
  categories,
  loading = false,
}: AnalyticsCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/4 bg-gray-200 rounded" />
          <div className="h-[200px] bg-gray-100 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            {categories.map((category, index) => (
              <Bar
                key={category}
                dataKey={category}
                fill={theme.colors.chartColors[index % theme.colors.chartColors.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
} 