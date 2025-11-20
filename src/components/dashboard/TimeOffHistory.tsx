import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTimeOffRequests } from "@/hooks/useTimeOffRequests";
import { format, parseISO } from "date-fns";

export const TimeOffHistory = () => {
  const { requests, loading, deleteRequest } = useTimeOffRequests();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        );
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      case "exception":
        return (
          <Badge variant="default" className="bg-green-100 text-white-400">
            Exception
          </Badge>
        );
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Time Off History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Time Off History</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No time off requests found.
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {request.request_type}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {format(parseISO(request.start_date), "MMM dd, yyyy")} -{" "}
                        {format(parseISO(request.end_date), "MMM dd, yyyy")}
                      </div>
                      <div className="text-sm text-gray-600">
                        {request.days_requested} day
                        {request.days_requested !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      <div>
                        Submitted{" "}
                        {format(new Date(request.created_at), "MMM dd, yyyy")}
                      </div>
                      {new Date(request.start_date) > new Date() && (
                        <div className="mt-2 ml-24">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => await deleteRequest(request.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {request.reason && (
                    <div className="text-sm">
                      <span className="font-medium">Reason:</span>{" "}
                      {request.reason}
                    </div>
                  )}
                  {request.approval_notes && (
                    <div className="text-sm bg-blue-50 border border-blue-200 rounded p-2">
                      <span className="font-medium text-blue-900">
                        Manager Note:
                      </span>
                      <p className="text-blue-800 mt-1">
                        {request.approval_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
