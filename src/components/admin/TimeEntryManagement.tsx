import { useState, useEffect } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
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
import { Plus, Pencil, Trash2, Clock, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminTimeEntryDialog, TimeEntryData } from "./AdminTimeEntryDialog";
import { TimeEntriesDelete } from "@/services/TimeEntriesService";
import { TableSkeleton } from "@/components/ui/skeletons";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
}

interface TimeEntry {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  status: string;
  team: string | null;
  shift_type: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export const TimeEntryManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryData | null>(null);
  const [createForUserId, setCreateForUserId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [selectedUserId, startDate, endDate]);

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
        .from("time_entries")
        .select(
          `
          id,
          user_id,
          start_time,
          end_time,
          total_hours,
          status,
          team,
          shift_type,
          profiles!time_entries_user_id_fkey (first_name, last_name, email)
        `
        )
        .gte("start_time", startOfDay(new Date(startDate)).toISOString())
        .lte("start_time", endOfDay(new Date(endDate)).toISOString())
        .order("start_time", { ascending: false });

      if (selectedUserId !== "all") {
        query = query.eq("user_id", selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast({
        title: "Error",
        description: "Failed to load time entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (selectedUserId === "all") {
      // Show user selection first
      setCreateForUserId(null);
      setEditingEntry(null);
      setDialogOpen(true);
    } else {
      setCreateForUserId(selectedUserId);
      setEditingEntry(null);
      setDialogOpen(true);
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    setCreateForUserId(entry.user_id);
    setEditingEntry({
      id: entry.id,
      start_time: entry.start_time,
      end_time: entry.end_time,
      total_hours: entry.total_hours,
      status: entry.status,
      team: entry.team,
      shift_type: entry.shift_type,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const error = await TimeEntriesDelete(deleteId);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Time entry deleted",
      });
      fetchEntries();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete time entry",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      active: "bg-blue-100 text-blue-800",
      auto_ended: "bg-yellow-100 text-yellow-800",
    };
    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status.replace("_", " ")}
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Entry Management
          </CardTitle>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Add Time Entry
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
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
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
        </div>

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No time entries found for the selected criteria.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>
                      {format(new Date(entry.start_time), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(entry.start_time), "h:mm a")}
                    </TableCell>
                    <TableCell>
                      {entry.end_time
                        ? format(new Date(entry.end_time), "h:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {entry.total_hours?.toFixed(2) || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
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

      {/* Time Entry Dialog - need to select user if creating for "all" */}
      {dialogOpen && selectedUserId === "all" && !createForUserId ? (
        <SelectUserDialog
          users={users}
          onSelect={(userId) => setCreateForUserId(userId)}
          onClose={() => setDialogOpen(false)}
        />
      ) : (
        <AdminTimeEntryDialog
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
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
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
  users: User[];
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
            Choose an employee to create a time entry for.
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
