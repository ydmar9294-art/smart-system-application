/**
 * Optimistic Conflict Detection
 * Checks updated_at before writes to prevent silent data overwrites
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export class ConflictError extends Error {
  constructor(
    public readonly table: string,
    public readonly recordId: string,
    public readonly clientUpdatedAt: string,
    public readonly serverUpdatedAt: string
  ) {
    super(`تعارض بيانات: تم تحديث السجل بواسطة جهاز آخر`);
    this.name = 'ConflictError';
  }
}

/**
 * Check if a record has been modified since the client last read it.
 * Call before UPDATE operations on tables with `updated_at`.
 */
export async function checkConflict(
  table: 'products' | 'profiles',
  recordId: string,
  clientUpdatedAt: string | number
): Promise<void> {
  const clientTs = typeof clientUpdatedAt === 'number'
    ? new Date(clientUpdatedAt).toISOString()
    : clientUpdatedAt;

  const { data, error } = await supabase
    .from(table)
    .select('updated_at')
    .eq('id', recordId)
    .maybeSingle();

  if (error) {
    logger.warn(`[Conflict] Failed to check ${table}/${recordId}: ${error.message}`, 'ConflictDetection');
    return; // Fail open — don't block the update
  }

  if (!data) return; // Record doesn't exist

  const serverTs = data.updated_at;
  if (serverTs && serverTs !== clientTs && new Date(serverTs) > new Date(clientTs)) {
    throw new ConflictError(table, recordId, clientTs, serverTs);
  }
}
