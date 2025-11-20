import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { createUser } from "@/lib/createUser";
import { UserRole } from "@/hooks/useUserRoles";

interface BulkUserUploadProps {
  onSuccess: () => void;
}

interface CsvRow {
  [key: string]: string;
}

const parseCsv = (text: string): CsvRow[] => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
};

export const BulkUserUpload = ({ onSuccess }: BulkUserUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      let created = 0;
      for (const row of rows) {
        try {
          await createUser({
            email: row.email,
            password: row.password,
            first_name: row.first_name,
            last_name: row.last_name,
            hourly_rate: parseFloat(row.hourly_rate) || 15,
            role: row.role as UserRole,
            employment_type: row.employment_type
          });
          created++;
        } catch (err) {
          console.error("Error creating user from CSV", err);
        }
      }
      toast({
        title: "Bulk Upload Complete",
        description: `Created ${created} of ${rows.length} users`,
      });
      setFile(null);
      onSuccess();
    } catch (err: any) {
      console.error("Bulk upload failed", err);
      toast({
        title: "Error",
        description: err.message || "Failed to process CSV",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="csv">CSV File</Label>
        <Input
          id="csv"
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      <Button type="submit" disabled={!file || loading} className="w-full">
        {loading ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
};
