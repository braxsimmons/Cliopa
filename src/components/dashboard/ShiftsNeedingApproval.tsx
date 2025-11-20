import { History, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useWeeklyHours } from "@/hooks/useWeeklyHours";

export const ShiftsNeedingApprovalTable = () => {
  const { entries, loading, VerifyWeeklyHours } = useWeeklyHours();

  const toggleVerified = (unverified_ids: string[]) => {
    VerifyWeeklyHours(unverified_ids);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Weekly Hours
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Week Of</TableHead>
                  <TableHead className="min-w-[100px]">Monday</TableHead>
                  <TableHead className="min-w-[100px]">Tuesday</TableHead>
                  <TableHead className="min-w-[100px]">Wednesday</TableHead>
                  <TableHead className="min-w-[100px]">Thursday</TableHead>
                  <TableHead className="min-w-[80px]">Friday</TableHead>
                  <TableHead className="min-w-[80px]">Total</TableHead>
                  <TableHead className="text-center min-w-[80px]">
                    Confirm
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries && entries.length > 0 ? entries.slice(0, 5).map((entry) => {
                  // Shows the last 5 weeks
                  return (
                    <TableRow key={entry.week_start_date}>
                      <TableCell>{entry.week_start_date}</TableCell>
                      <TableCell>{entry.monday_hours}</TableCell>
                      <TableCell>{entry.tuesday_hours}</TableCell>
                      <TableCell>{entry.wednesday_hours}</TableCell>
                      <TableCell>{entry.thursday_hours}</TableCell>
                      <TableCell>{entry.friday_hours}</TableCell>
                      <TableCell>{entry.total_week_hours}</TableCell>
                      <TableCell className="text-center">
                        {!entry.has_pending_entries ? (
                          !entry.all_verified ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toggleVerified(entry.unverified_ids)
                              }
                              aria-label="Verify shift"
                            >
                              <span className="text-xs text-gray-600">
                                Confirm?
                              </span>
                            </Button>
                          ) : (
                            <div className="flex justify-center">
                              <Check className="h-6 w-6 text-green-600" />
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-600">
                            Pending Correction
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }) : null}
                {!loading && (!entries || entries.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-gray-500"
                    >
                      No shifts recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
