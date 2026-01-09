import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Calendar, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminTimeOffDialog, TimeOffData } from "./AdminTimeOffDialog";
import { AdminDeleteApprovedTimeOff } from "@/services/ApprovedTimeOffService";
import { TableSkeleton } from "@/components/ui/skeletons";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  available_pto?: number;
  available_uto?: number;
}

interface TimeOffEntry {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_taken: number;
  request_type: "PTO" | "UTO";
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  time_off_requests?: {
    reason?: string;
    status?: string;
  } | null;
}

export const TimeOffManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeOffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [requestType, setRequestType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeOffData | null>(null);
  const [createForUserId, setCreateForUserId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchEntries();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [selectedUserId, requestType]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, team")
      .order("first_name");
    if (data) setUsers(data);
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("approved_time_off")
        .select(
          `
          id,
          user_id,
          start_date,
          end_date,
          days_taken,
          request_type,
          created_at,
          request_id,
          profiles!approved_time_off_user_id_fkey (first_name, last_name, email),
          time_off_requests!approved_time_off_request_id_fkey (reason, status)
        `
        )
        .order("start_date", { ascending: false });

      if (selectedUserId !== "all") {
        query = query.eq("user_id", selectedUserId);
      }

      if (requestType !== "all") {
        query = query.eq("request_type", requestType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast({
        title: "Error",
        description: "Failed to load time off entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (selectedUserId === "all") {
      setCreateForUserId(null);
      setEditingEntry(null);
      setDialogOpen(true);
    } else {
      setCreateForUserId(selectedUserId);
      setEditingEntry(null);
      setDialogOpen(true);
    }
  };

  const handleEdit = (entry: TimeOffEntry) => {
    setCreateForUserId(entry.user_id);
    setEditingEntry({
      id: entry.id,
      start_date: entry.start_date,
      end_date: entry.end_date,
      days_taken: entry.days_taken,
      request_type: entry.request_type,
      time_off_requests: entry.time_off_requests,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const error = await AdminDeleteApprovedTimeOff(deleteId);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Time off entry deleted",
      });
      fetchEntries();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete time off entry",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge
        className={
          type === "PTO"
            ? "bg-green-100 text-green-800"
            : "bg-orange-100 text-orange-800"
        }
      >
        {type}
      </Badge>
    );
  };

  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const name = `${entry.profiles?.first_name || ""} ${entry.profiles?.last_name || ""}`.toLowerCase();
    const email = (entry.profiles?.email || "").toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  // Calculate totals
  const totalPTO = filteredEntries
    .filter((e) => e.request_type === "PTO")
    .reduce((sum, e) => sum + e.days_taken, 0);
  const totalUTO = filteredEntries
    .filter((e) => e.request_type === "UTO")
    .reduce((sum, e) => sum + e.days_taken, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            PTO / UTO Management
          </CardTitle>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Add Time Off
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label>Employee</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PTO">PTO Only</SelectItem>
                <SelectItem value="UTO">UTO Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-600 space-y-1">
              <div>
                Total PTO: <span className="font-semibold">{totalPTO} days</span>
              </div>
              <div>
                Total UTO: <span className="font-semibold">{totalUTO} days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No time off entries found for the selected criteria.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {entry.profiles?.first_name} {entry.profiles?.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.profiles?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(entry.request_type)}</TableCell>
                    <TableCell>
                      {format(new Date(entry.start_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(entry.end_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{entry.days_taken}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.time_off_requests?.reason || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(entry.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredEntries.length} entries
        </div>
      </CardContent>

      {/* Time Off Dialog */}
      {dialogOpen && selectedUserId === "all" && !createForUserId ? (
        <SelectUserDialog
          users={users}
          onSelect={(userId) => setCreateForUserId(userId)}
          onClose={() => setDialogOpen(false)}
        />
      ) : (
        <AdminTimeOffDialog
          isOpen={dialogOpen && !!createForUserId}
          onClose={() => {
            setDialogOpen(false);
            setCreateForUserId(null);
            setEditingEntry(null);
          }}
          userId={createForUserId || ""}
          entry={editingEntry}
          onSuccess={fetchEntries}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Off Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time off entry? This will also
              update the employee's available balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

// Helper dialog for selecting user when creating entry for "all"
const SelectUserDialog = ({
  users,
  onSelect,
  onClose,
}: {
  users: { id: string; email: string; first_name: string | null; last_name: string | null }[];
  onSelect: (userId: string) => void;
  onClose: () => void;
}) => {
  const [selectedUser, setSelectedUser] = useState<string>("");

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Select Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Choose an employee to create time off for.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => selectedUser && onSelect(selectedUser)}
            disabled={!selectedUser}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
