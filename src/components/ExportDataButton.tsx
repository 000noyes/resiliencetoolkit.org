import React, { useState } from 'react';
import { exportAllData } from '@/lib/storage';
import { Download, Check, AlertCircle } from 'lucide-react';

interface ExportDataButtonProps {
  className?: string;
}

/**
 * Button to export all user data as a JSON file
 * Uses the existing exportAllData() function from storage
 */
export default function ExportDataButton({ className = '' }: ExportDataButtonProps) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');

  async function handleExport() {
    setStatus('exporting');

    try {
      const data = await exportAllData();

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `resilience-toolkit-data-${timestamp}.json`;

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Record export timestamp for status panel + dashboard
      localStorage.setItem('lastExportTimestamp', new Date().toISOString());

      setStatus('success');

      // Reset to idle after 2 seconds
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to export data:', error);
      setStatus('error');

      // Reset to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  const isDisabled = status === 'exporting';

  return (
    <button
      onClick={handleExport}
      disabled={isDisabled}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
        status === 'success'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : status === 'error'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
      } ${className}`}
    >
      {status === 'exporting' ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Exporting...
        </>
      ) : status === 'success' ? (
        <>
          <Check className="w-4 h-4" />
          Downloaded!
        </>
      ) : status === 'error' ? (
        <>
          <AlertCircle className="w-4 h-4" />
          Export failed
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Export My Data
        </>
      )}
    </button>
  );
}
