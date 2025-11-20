import { useBack } from "@/hooks/useBack";
import { TimeOffReport } from "@/components/admin/TimeOffReport";

const TimeOffReportPage = () => {
  const handleBack = useBack();
  return <TimeOffReport onBack={handleBack} />;
};

export default TimeOffReportPage;
