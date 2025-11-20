import { useState, useEffect } from "react";
import { Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTimeCorrections } from "@/hooks/useTimeCorrections";
import { Button } from "../ui/button";

// TODO-future project: update this page to allow agent to have ability to update pending time off requests here

export const MyTimeCorrections = () => {
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchMyCorrections } = useTimeCorrections();

  useEffect(() => {
    loadMyCorrections();
  }, []);

  const loadMyCorrections = async () => {
    setLoading(true);
    try {
      const data = await fetchMyCorrections();
      setCorrections(data);
    } catch (error) {
      console.error("Error loading my corrections:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "denied":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "denied":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateExtraHours = (
    currentStart: string | null,
    currentEnd: string | null,
    requestedStart: string | null,
    requestedEnd: string | null
  ) => {
    const currentStartTime = new Date(currentStart);
    const currentEndTime = new Date(currentEnd);
    const requestedStartTime = new Date(requestedStart);
    const requestedEndTime = new Date(requestedEnd);

    let diff = 0;

    if (requestedEnd) {
      diff += requestedEndTime.getTime() - currentEndTime.getTime();
    }
    if (requestedStart) {
      diff += currentStartTime.getTime() - requestedStartTime.getTime();
    }
    const differenceInSeconds = diff / 1000;
    const differenceInMinutes = differenceInSeconds / 60;
    const absoluteMinutes = Math.abs(differenceInMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = Math.round(absoluteMinutes % 60);
    const sign = differenceInMinutes < 0 ? "-" : "+";

    if (hours === 0) {
      return `${sign}${minutes} mins`;
    } else if (hours === 1) {
      return `${sign}${hours} hour ${minutes} mins`;
    } else {
      return `${sign}${hours} hours ${minutes} mins`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading your time corrections...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          My Time Correction Requests ({corrections.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {corrections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No time correction requests found.
          </div>
        ) : (
          <div className="space-y-4">
            {corrections.map((correction) => (
              <div
                key={correction.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(correction.status)}
                      <Badge className={getStatusColor(correction.status)}>
                        {correction.status.toUpperCase()}
                      </Badge>

                      <span className="text-sm text-gray-500">
                        Submitted{" "}
                        {format(
                          new Date(correction.created_at),
                          "MMM dd, yyyy 'at' h:mm a"
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">
                          Original Start Time:
                        </span>
                        <p className="text-gray-600">
                          {format(
                            new Date(correction.original_start_time),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Original End Time:
                        </span>
                        <p className="text-gray-600">
                          {format(
                            new Date(correction.original_end_time),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Original Shift Type:
                        </span>
                        <p className="text-gray-600">
                          {correction.original_shift_type}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Current Start Time:
                        </span>
                        <p className="text-gray-600">
                          {format(
                            new Date(correction.current_start_time),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Current End Time:
                        </span>
                        <p className="text-gray-600">
                          {format(
                            new Date(correction.current_end_time),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Current Shift Type:
                        </span>
                        <p className="text-gray-600">
                          {correction.current_shift_type}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Requested Start Time:
                        </span>
                        <p className="text-gray-600">
                          {correction.requested_start_time
                            ? format(
                                new Date(correction.requested_start_time),
                                "MMM dd, yyyy 'at' h:mm a"
                              )
                            : "----------"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Requested End Time:
                        </span>
                        <p className="text-gray-600">
                          {correction.requested_end_time
                            ? format(
                                new Date(correction.requested_end_time),
                                "MMM dd, yyyy 'at' h:mm a"
                              )
                            : "----------"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Requested Shift Type:
                        </span>
                        <p className="text-gray-600">
                          {correction.requested_shift_type
                            ? correction.requested_shift_type
                            : "----------"}
                        </p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <span className="font-medium text-gray-700">
                        Additional Hours:
                      </span>
                      <span className="ml-2 text-blue-600 font-medium">
                        {calculateExtraHours(
                          correction.current_start_time,
                          correction.current_end_time,
                          correction.requested_start_time,
                          correction.requested_end_time
                        )}
                      </span>
                    </div>

                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Reason:</span>
                      <p className="mt-1 text-gray-600 bg-gray-50 p-2 rounded">
                        {correction.reason}
                      </p>
                    </div>

                    {correction.status === "approved" &&
                      correction.approved_at && (
                        <div className="text-sm text-green-600">
                          <span className="font-medium">Approved:</span>
                          <span className="ml-2">
                            {format(
                              new Date(correction.approved_at),
                              "MMM dd, yyyy 'at' h:mm a"
                            )}{" "}
                            - {correction.approved_by}
                          </span>
                          {correction.review_notes && (
                            <p className="mt-1 text-gray-600 bg-green-50 p-2 rounded">
                              <span className="font-medium">Notes:</span>{" "}
                              {correction.review_notes}
                            </p>
                          )}
                        </div>
                      )}

                    {correction.status === "denied" &&
                      correction.review_notes && (
                        <div className="text-sm text-red-600">
                          <span className="font-medium">Denied:</span>
                          <p className="mt-1 text-gray-600 bg-red-50 p-2 rounded">
                            <span className="font-medium">Reason:</span>{" "}
                            {correction.review_notes}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
