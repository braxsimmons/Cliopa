import { useBack } from "@/hooks/useBack";
import { TimeOffApproval } from "@/components/admin/TimeOffApproval";

const TimeOffApprovalPage = () => {
  const handleBack = useBack();
  return <TimeOffApproval onBack={handleBack} />;
};

export default TimeOffApprovalPage;
