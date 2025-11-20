import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/hooks/useAuth";

export const RoleDebug = () => {
  const { user } = useAuth();
  const { userRoles, loading, canManageUsers, canManageAllTimeEntries, isAdmin } = useUserRoles();

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">🐛 Debug Info</h3>
      <div className="space-y-1">
        <p><strong>User ID:</strong> {user?.id || 'none'}</p>
        <p><strong>Email:</strong> {user?.email || 'none'}</p>
        <p><strong>Loading:</strong> {loading ? 'yes' : 'no'}</p>
        <p><strong>Roles Array:</strong> {JSON.stringify(userRoles)}</p>
        <p><strong>isAdmin():</strong> {isAdmin() ? 'YES' : 'NO'}</p>
        <p><strong>canManageUsers():</strong> {canManageUsers() ? 'YES' : 'NO'}</p>
        <p><strong>canManageAllTimeEntries():</strong> {canManageAllTimeEntries() ? 'YES' : 'NO'}</p>
      </div>
    </div>
  );
};
