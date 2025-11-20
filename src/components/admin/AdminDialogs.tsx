import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Upload } from "lucide-react";
import { CreateUserForm } from "./CreateUserForm";
import { BulkUserUpload } from "./BulkUserUpload";

interface AdminDialogsProps {
  showCreateUser: boolean;
  setShowCreateUser: (show: boolean) => void;
  showBulkUpload: boolean;
  setShowBulkUpload: (show: boolean) => void;
  onUserCreated: () => void;
}

export const AdminDialogs = ({
  showCreateUser,
  setShowCreateUser,
  showBulkUpload,
  setShowBulkUpload,
  onUserCreated,
}: AdminDialogsProps) => {
  return (
    <div className="flex items-center gap-2">
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with email and password.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm onSuccess={onUserCreated} />
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Upload Users</DialogTitle>
            <DialogDescription>
              Upload a CSV file to create users in bulk.
            </DialogDescription>
          </DialogHeader>
          <BulkUserUpload onSuccess={onUserCreated} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
