import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  TimeEntriesSelectForUser,
  TimeEntriesDelete,
} from "@/services/TimeEntriesService";
import { AdminTimeEntryDialog, TimeEntryData } from "./AdminTimeEntryDialog";

interface EmployeeTimeEntriesProps {
  userId: string;
}

export const EmployeeTimeEntries = ({ userId }: EmployeeTimeEntriesProps) => {
  const [entries, setEntries] = useState<TimeEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntryData | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryData | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [userId, startDate, endDate]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await TimeEntriesSelectForUser(userId, startDate, endDate);
      if (error) {
        console.error("Error fetching time entries:", error);
        toast({
          title: "Error",
          description: "Failed to load time entries",
          variant: "destructive",
        });
      } else {
        setEntries(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = () => {
    setSelectedEntry(null);
    setShowDialog(true);
  };

  const handleEditEntry = (entry: TimeEntryData) => {
    setSelectedEntry(entry);
    setShowDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteEntry?.id) return;

    try {
      const { error } = await TimeEntriesDelete(deleteEntry.id);
      if (error) {
        throw error;
      }
      toast({
        title: "Success",
        description: "Time entry deleted successfully",
      });
      fetchEntries();
    } catch (error) {
      console.error("Error deleting time entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete time entry",
        variant: "destructive",
      });
    } finally {
      setDeleteEntry(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "auto_ended":
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            <AlertCircle className="h-3 w-3 mr-1" />
            Auto Ended
          </Badge>
        );
      case "active":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            <Clock className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "MMM d, yyyy h:mm a");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Entries
            </CardTitle>
            <Button size="sm" onClick={handleAddEntry}>
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Date filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="start-date" className="text-xs">From</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="end-date" className="text-xs">To</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No time entries found for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
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
                      <TableCell>{entry.team || "-"}</TableCell>
                      <TableCell className="capitalize">
                        {entry.shift_type || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditEntry(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteEntry(entry)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <AdminTimeEntryDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        userId={userId}
        entry={selectedEntry}
        onSuccess={fetchEntries}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry from{" "}
              {deleteEntry?.start_time
                ? format(new Date(deleteEntry.start_time), "MMM d, yyyy")
                : ""}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
