import { theme } from "@/lib/theme";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-50/50 via-white to-purple-50/50">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100/20 p-8">
          {children}
        </div>
      </div>
    </div>
  );
} 