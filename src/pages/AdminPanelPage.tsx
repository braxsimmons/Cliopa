import { AdminPage } from "@/components/admin/AdminPage";
import { useBack } from "@/hooks/useBack";

const AdminPanelPage = () => {
  const handleBack = useBack();
  return <AdminPage onBack={handleBack} />;
};

export default AdminPanelPage;
