import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  hourly_rate: number;
  team: string | null;
  sub_team: string | null;
  role: "admin" | "manager" | "ccm" | "crm" | null;
}

interface UserTableProps {
  users: User[];
  onSelectEmployee: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserTable = ({
  users,
  onSelectEmployee,
  onDeleteUser,
}: UserTableProps) => {
  const roleColors = {
    admin: "bg-red-100 text-red-800",
    manager: "bg-blue-100 text-blue-800",
    ccm: "bg-green-100 text-green-800",
    crm: "bg-purple-100 text-purple-800",
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Sub Team</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Button
                variant="link"
                className="p-0 h-auto font-normal text-left"
                onClick={() => onSelectEmployee(user.id)}
              >
                {user.first_name || user.last_name
                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                  : "No name set"}
              </Button>
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              {user.team ? (
                <Badge variant="outline">{user.team}</Badge>
              ) : (
                <span className="text-gray-500 text-sm">No team</span>
              )}
            </TableCell>
            <TableCell>
              {user.sub_team ? (
                <Badge variant="outline">{user.sub_team}</Badge>
              ) : (
                <span className="text-gray-500 text-sm">No sub team</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {user.role ? (
                  <Badge className={roleColors[user.role]}>
                    {user.role.toUpperCase()}
                  </Badge>
                ) : (
                  <span className="text-gray-500 text-sm">No role</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectEmployee(user.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this user? This action
                        cannot be undone. This will also delete all their time
                        entries and KPIs.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteUser(user.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
