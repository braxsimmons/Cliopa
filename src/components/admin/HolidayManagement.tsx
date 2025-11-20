import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayroll } from "@/hooks/usePayroll";
import { BulkHolidayImport } from "./BulkHolidayImport";
import { format, parseISO } from "date-fns";

interface HolidayManagementProps {
  onBack: () => void;
}

export const HolidayManagement = ({ onBack }: HolidayManagementProps) => {
  const { holidays, loading, addHoliday, bulkAddHolidays, deleteHoliday } =
    usePayroll();
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (holidayDate && holidayName) {
      await addHoliday(holidayDate, holidayName);
      setHolidayDate("");
      setHolidayName("");
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (confirm("Are you sure you want to delete this holiday?")) {
      await deleteHoliday(holidayId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading holidays...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Payroll
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Holiday Management
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Bulk Import Section */}
        <BulkHolidayImport onImport={bulkAddHolidays} loading={loading} />

        {/* Add Single Holiday Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Single Holiday
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="holidayDate">Holiday Date</Label>
                  <Input
                    id="holidayDate"
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="holidayName">Holiday Name</Label>
                  <Input
                    id="holidayName"
                    type="text"
                    placeholder="e.g., New Year's Day"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Holidays List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Company Holidays ({holidays.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holidays.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell>
                        {format(parseISO(holiday.holiday_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {holiday.holiday_name}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(holiday.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No holidays configured. Add holidays above to include them in
                payroll calculations.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
