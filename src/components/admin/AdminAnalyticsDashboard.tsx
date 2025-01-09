import { AnalyticsCard } from './AnalyticsCard';

const mockData = [
  {
    name: 'Jan',
    users: 400,
    messages: 240,
    credits: 100,
  },
  // ... add more mock data as needed
];

export function AdminAnalyticsDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <AnalyticsCard
        title="User Activity"
        data={mockData}
        categories={['users', 'messages', 'credits']}
      />
      {/* Add more analytics cards as needed */}
    </div>
  );
} 