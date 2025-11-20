import { useBack } from "@/hooks/useBack";
import { ShiftReport } from "@/components/admin/ShiftReport";

const ShiftReportPage = () => {
  const handleBack = useBack();
  return <ShiftReport onBack={handleBack} />;
};

export default ShiftReportPage;
