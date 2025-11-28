/**
 * Export Utilities for CSV and PDF generation
 */

// CSV Export
export interface CSVColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | null | undefined);
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Build header row
  const headers = columns.map((col) => `"${col.header}"`).join(',');

  // Build data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        let value: string | number | null | undefined;
        if (typeof col.accessor === 'function') {
          value = col.accessor(row);
        } else {
          value = row[col.accessor] as string | number | null | undefined;
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
          return '""';
        }

        // Handle numbers
        if (typeof value === 'number') {
          return value.toString();
        }

        // Escape quotes in strings
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',');
  });

  // Combine and create blob
  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Download
  downloadBlob(blob, `${filename}.csv`);
}

// Simple PDF Export (using browser print)
export function exportToPDF(
  elementId: string,
  title: string
): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  // Get computed styles
  const styles = Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  // Build print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        ${styles}
        @media print {
          body {
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: 600; }
        }
        body {
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .print-header { margin-bottom: 20px; }
        .print-date { color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>${title}</h1>
        <p class="print-date">Generated on ${new Date().toLocaleString()}</p>
      </div>
      ${element.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
}

// Generate printable table HTML
export function generatePrintableTable<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[],
  title: string
): string {
  const headerCells = columns.map((col) => `<th>${col.header}</th>`).join('');

  const rows = data.map((row) => {
    const cells = columns.map((col) => {
      let value: string | number | null | undefined;
      if (typeof col.accessor === 'function') {
        value = col.accessor(row);
      } else {
        value = row[col.accessor] as string | number | null | undefined;
      }
      return `<td>${value ?? '-'}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <div class="print-header">
      <h1>${title}</h1>
      <p class="print-date">Generated on ${new Date().toLocaleString()}</p>
    </div>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Print table data directly
export function printTableData<T extends Record<string, unknown>>(
  data: T[],
  columns: CSVColumn<T>[],
  title: string
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  const tableHTML = generatePrintableTable(data, columns, title);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          body { padding: 20px; }
          .no-print { display: none !important; }
        }
        body {
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        h1 { font-size: 24px; margin-bottom: 10px; color: #333; }
        .print-header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .print-date { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: 600; color: #333; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #f5f5f5; }
      </style>
    </head>
    <body>
      ${tableHTML}
    </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

// Download blob helper
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Format date for export
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// Format datetime for export
export function formatDateTimeForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format hours for export
export function formatHoursForExport(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '0';
  return hours.toFixed(2);
}

// Format currency for export
export function formatCurrencyForExport(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return `$${amount.toFixed(2)}`;
}
