import { Badge } from "@/components/ui/badge";

export const CalendarLegend = () => {
  return (
    <div className="border-t pt-4">
      <div className="text-sm text-gray-600 mb-2">Legend:</div>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="default">PTO</Badge>
          <span>Paid Time Off</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">UTO</Badge>
          <span>Unpaid Time Off</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
            3
          </div>
          <span>Number of people out</span>
        </div>
      </div>
    </div>
  );
};
