import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Trash2, Calendar, Sun, Umbrella } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  ApprovedTimeOffSelectForUser,
  AdminDeleteApprovedTimeOff,
} from "@/services/ApprovedTimeOffService";
import { AdminTimeOffDialog, TimeOffData } from "./AdminTimeOffDialog";

interface EmployeeTimeOffProps {
  userId: string;
}

export const EmployeeTimeOff = ({ userId }: EmployeeTimeOffProps) => {
  const [entries, setEntries] = useState<TimeOffData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeOffData | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TimeOffData | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [userId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await ApprovedTimeOffSelectForUser(userId);
      if (error) {
        console.error("Error fetching time off:", error);
        toast({
          title: "Error",
          description: "Failed to load time off entries",
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

  const handleEditEntry = (entry: TimeOffData) => {
    setSelectedEntry(entry);
    setShowDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteEntry?.id) return;

    try {
      const { error } = await AdminDeleteApprovedTimeOff(deleteEntry.id);
      if (error) {
        throw error;
      }
      toast({
        title: "Success",
        description: "Time off deleted successfully",
      });
      fetchEntries();
    } catch (error) {
      console.error("Error deleting time off:", error);
      toast({
        title: "Error",
        description: "Failed to delete time off",
        variant: "destructive",
      });
    } finally {
      setDeleteEntry(null);
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === "PTO") {
      return (
        <Badge variant="default" className="bg-purple-500">
          <Sun className="h-3 w-3 mr-1" />
          PTO
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-orange-500 text-white">
        <Umbrella className="h-3 w-3 mr-1" />
        UTO
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "MMM d, yyyy");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Time Off (PTO/UTO)
            </CardTitle>
            <Button size="sm" onClick={handleAddEntry}>
              <Plus className="h-4 w-4 mr-1" />
              Add Time Off
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No time off entries found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{getTypeBadge(entry.request_type)}</TableCell>
                      <TableCell>{formatDate(entry.start_date)}</TableCell>
                      <TableCell>{formatDate(entry.end_date)}</TableCell>
                      <TableCell>{entry.days_taken}</TableCell>
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
      <AdminTimeOffDialog
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
            <AlertDialogTitle>Delete Time Off</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteEntry?.request_type} from{" "}
              {deleteEntry?.start_date
                ? format(new Date(deleteEntry.start_date), "MMM d, yyyy")
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
