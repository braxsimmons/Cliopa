import { useBack } from "@/hooks/useBack";
import { UTOReport } from "@/components/admin/UTOReport";

const UTOReportPage = () => {
  const handleBack = useBack();
  return <UTOReport onBack={handleBack} />;
};

export default UTOReportPage;
