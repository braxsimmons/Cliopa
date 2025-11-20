import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserManagement } from "@/hooks/useUserManagement";
import { EmployeeProfile } from "./EmployeeProfile";
import { AdminHeader } from "./AdminHeader";
import { AdminNavigation } from "./AdminNavigation";
import { AdminDialogs } from "./AdminDialogs";
import { UserTable } from "./UserTable";

interface AdminPageProps {
  onBack: () => void;
}

export const AdminPage = ({ onBack }: AdminPageProps) => {
  const { users, loading, deleteUser, fetchUsers } = useUserManagement();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const handleUserCreated = () => {
    setShowCreateUser(false);
    setShowBulkUpload(false);
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteUser(userId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading users...</div>
      </div>
    );
  }

  // Show employee profile if selected
  if (selectedEmployeeId) {
    return (
      <EmployeeProfile
        userId={selectedEmployeeId}
        onBack={() => setSelectedEmployeeId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader onBack={onBack} />
      <AdminNavigation />
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Users ({users.length})</CardTitle>
            <AdminDialogs
              showCreateUser={showCreateUser}
              setShowCreateUser={setShowCreateUser}
              showBulkUpload={showBulkUpload}
              setShowBulkUpload={setShowBulkUpload}
              onUserCreated={handleUserCreated}
            />
          </CardHeader>
          <CardContent>
            <UserTable
              users={users}
              onSelectEmployee={setSelectedEmployeeId}
              onDeleteUser={handleDeleteUser}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
