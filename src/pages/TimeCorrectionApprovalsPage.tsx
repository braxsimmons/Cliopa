import { useBack } from "@/hooks/useBack";
import { TimeCorrectionApprovals } from "@/components/admin/TimeCorrectionApprovals";

const TimeCorrectionApprovalsPage = () => {
  const handleBack = useBack();
  return <TimeCorrectionApprovals onBack={handleBack} />;
};

export default TimeCorrectionApprovalsPage;
