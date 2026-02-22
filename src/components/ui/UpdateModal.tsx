/**
 * Update Modal Component
 * Shows force or optional update dialog for hybrid app.
 */

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { type VersionInfo } from '@/lib/versionCheck';

interface UpdateModalProps {
  open: boolean;
  isForce: boolean;
  versionInfo?: VersionInfo;
  currentVersion?: string;
  onDismiss: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  isForce,
  versionInfo,
  currentVersion,
  onDismiss,
}) => {
  const handleUpdate = () => {
    if (versionInfo?.updateUrl) {
      window.open(versionInfo.updateUrl, '_blank');
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent dir="rtl" className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">
            {isForce ? '⚠️ تحديث إجباري مطلوب' : '🔄 تحديث جديد متاح'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right space-y-2">
            <p>
              الإصدار الحالي: <strong>{currentVersion}</strong>
            </p>
            <p>
              الإصدار الجديد: <strong>{versionInfo?.latestVersion}</strong>
            </p>
            {versionInfo?.releaseNotes && (
              <p className="text-xs text-muted-foreground mt-2">
                {versionInfo.releaseNotes}
              </p>
            )}
            {isForce && (
              <p className="text-destructive font-semibold mt-2">
                يجب تحديث التطبيق للمتابعة
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogAction onClick={handleUpdate}>
            تحديث الآن
          </AlertDialogAction>
          {!isForce && (
            <AlertDialogCancel onClick={onDismiss}>لاحقاً</AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UpdateModal;
