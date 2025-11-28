import React from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  exportToCSV,
  printTableData,
  CSVColumn,
  formatDateForExport,
  formatDateTimeForExport,
  formatHoursForExport,
  formatCurrencyForExport,
} from '@/lib/export-utils';

export interface ExportButtonsProps<T extends Record<string, unknown>> {
  data: T[];
  columns: CSVColumn<T>[];
  filename: string;
  title: string;
  disabled?: boolean;
}

export function ExportButtons<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  title,
  disabled = false,
}: ExportButtonsProps<T>) {
  const { toast } = useToast();

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There is no data available to export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      exportToCSV(data, columns, filename);
      toast({
        title: 'Export successful',
        description: `${filename}.csv has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'An error occurred while exporting data.',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    if (data.length === 0) {
      toast({
        title: 'No data to print',
        description: 'There is no data available to print.',
        variant: 'destructive',
      });
      return;
    }

    try {
      printTableData(data, columns, title);
    } catch (error) {
      toast({
        title: 'Print failed',
        description: 'An error occurred while preparing print view.',
        variant: 'destructive',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || data.length === 0}
          className="border-[var(--color-border)] text-[var(--color-text)]"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[var(--color-surface)] border-[var(--color-border)]"
      >
        <DropdownMenuItem
          onClick={handleExportCSV}
          className="cursor-pointer text-[var(--color-text)] focus:bg-[var(--color-bg)]"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handlePrint}
          className="cursor-pointer text-[var(--color-text)] focus:bg-[var(--color-bg)]"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Re-export utilities for convenience
export {
  formatDateForExport,
  formatDateTimeForExport,
  formatHoursForExport,
  formatCurrencyForExport,
};
export type { CSVColumn };
