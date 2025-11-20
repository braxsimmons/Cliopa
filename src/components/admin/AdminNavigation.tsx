import { Button } from "@/components/ui/button";
import { FileText, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const AdminNavigation = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 py-3">
          <Button variant="outline" onClick={() => navigate("/shift-report")}>
            <FileText className="h-4 w-4 mr-2" />
            Shift Report
          </Button>
          <Button variant="outline" onClick={() => navigate("/uto-report")}>
            <Calendar className="h-4 w-4 mr-2" />
            PTO/UTO Report
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/time-off-approvals")}
          >
            <Clock className="h-4 w-4 mr-2" />
            See time-off requests
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/time-correction-approvals")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Review Time Corrections
          </Button>
        </div>
      </div>
    </div>
  );
};
