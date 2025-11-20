import { useAuth } from "@/hooks/useAuth";
import { AgentDashboard } from "@/components/dashboard/AgentDashboard";

const Index = () => {
  const { user } = useAuth();

  if (user) {
    return <AgentDashboard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <img src="/cliopa.png" alt="Cliopa.io" className="w-24 h-24 object-contain mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-4">Cliopa.io</h1>
        <p className="text-xl text-gray-600">AI-Powered Workforce Management</p>
        <p className="text-sm text-gray-500 mt-2">
          Please sign in to access your dashboard
        </p>
      </div>
    </div>
  );
};

export default Index;
