import { useState } from "react";
import { Upload, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkHolidayImportProps {
  onImport: (holidays: Array<{ date: string; name: string }>) => Promise<void>;
  loading: boolean;
}

export const BulkHolidayImport = ({
  onImport,
  loading,
}: BulkHolidayImportProps) => {
  const [csvInput, setCsvInput] = useState("");
  const [preview, setPreview] = useState<
    Array<{ date: string; name: string; error?: string }>
  >([]);
  const [showPreview, setShowPreview] = useState(false);

  const parseCsvInput = () => {
    const lines = csvInput
      .trim()
      .split("\n")
      .filter((line) => line.trim());
    const parsed = lines.map((line, index) => {
      const [date, ...nameParts] = line.split(",").map((part) => part.trim());
      const name = nameParts.join(","); // Rejoin in case holiday name had commas

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      let error;

      if (!date || !dateRegex.test(date)) {
        error = "Invalid date format (use YYYY-MM-DD)";
      } else if (!name) {
        error = "Missing holiday name";
      } else {
        // Try to parse the date to ensure it's valid
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          error = "Invalid date";
        }
      }

      return {
        date,
        name,
        error,
        line: index + 1,
      };
    });

    setPreview(parsed);
    setShowPreview(true);
  };

  const handleImport = async () => {
    const validHolidays = preview.filter((holiday) => !holiday.error);
    if (validHolidays.length > 0) {
      await onImport(validHolidays);
      setCsvInput("");
      setPreview([]);
      setShowPreview(false);
    }
  };

  const hasErrors = preview.some((holiday) => holiday.error);
  const validCount = preview.filter((holiday) => !holiday.error).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Import Holidays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="csvInput">CSV Data</Label>
          <Textarea
            id="csvInput"
            placeholder="2025-01-01,New Year's Day&#10;2025-07-04,Independence Day&#10;2025-12-25,Christmas Day"
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-1">
            Format: One holiday per line as "YYYY-MM-DD,Holiday Name"
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={parseCsvInput}
            disabled={!csvInput.trim()}
            variant="outline"
          >
            <FileText className="h-4 w-4 mr-2" />
            Preview
          </Button>

          {showPreview && !hasErrors && validCount > 0 && (
            <Button onClick={handleImport} disabled={loading}>
              <Upload className="h-4 w-4 mr-2" />
              {loading ? "Importing..." : `Import ${validCount} Holidays`}
            </Button>
          )}
        </div>

        {showPreview && (
          <div className="space-y-2">
            <h4 className="font-medium">Preview ({preview.length} entries)</h4>

            {hasErrors && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some entries have errors. Please fix them before importing.
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-60 overflow-y-auto border rounded-md">
              {preview.map((holiday, index) => (
                <div
                  key={index}
                  className={`p-2 border-b last:border-b-0 ${
                    holiday.error ? "bg-red-50 border-red-200" : "bg-green-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{holiday.date}</span> -{" "}
                      {holiday.name}
                    </div>
                    {holiday.error && (
                      <span className="text-red-600 text-sm">
                        {holiday.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {validCount > 0 && (
              <p className="text-sm text-green-600">
                ✓ {validCount} valid holidays ready to import
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
