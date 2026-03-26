/**
 * useAppSettings - Fetch and update app_settings from Supabase
 * Used for developer-controlled global configuration like ShamCash address.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const SHAMCASH_FALLBACK = 'efd5411a5f29e0cdb279363de2dd62b3';

/** Read-only hook to get the ShamCash address (for non-developer screens) */
export const useShamcashAddress = () => {
  const [address, setAddress] = useState(SHAMCASH_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('app_settings')
          .select('value')
          .eq('key', 'shamcash_address')
          .maybeSingle();
        if (!error && data?.value && mounted) {
          setAddress(data.value);
        }
      } catch {
        // fallback
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();

    // Listen for realtime changes
    const channel = supabase
      .channel('app-settings-shamcash')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_settings',
        filter: 'key=eq.shamcash_address',
      }, (payload: any) => {
        if (payload.new?.value && mounted) {
          setAddress(payload.new.value);
          logger.info('ShamCash address updated via realtime', 'AppSettings');
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { address, loading };
};

/** Full CRUD hook for developer settings management */
export const useAppSettingsAdmin = () => {
  const [shamcashAddress, setShamcashAddress] = useState(SHAMCASH_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('app_settings')
        .select('key, value')
        .in('key', ['shamcash_address']);
      if (!error && data) {
        for (const row of data) {
          if (row.key === 'shamcash_address') setShamcashAddress(row.value);
        }
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateShamcashAddress = useCallback(async (newAddress: string) => {
    const nextAddress = newAddress.trim();
    if (!nextAddress) {
      setErrorMessage('عنوان شام كاش لا يمكن أن يكون فارغاً');
      return false;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const nowIso = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: updatedRows, error: updateError } = await (supabase as any)
        .from('app_settings')
        .update({
          value: nextAddress,
          updated_at: nowIso,
          updated_by: user?.id || null,
        })
        .eq('key', 'shamcash_address')
        .select('key');

      if (updateError) {
        throw updateError;
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertError } = await (supabase as any)
          .from('app_settings')
          .insert({
            key: 'shamcash_address',
            value: nextAddress,
            updated_at: nowIso,
            updated_by: user?.id || null,
          });

        if (insertError) {
          throw insertError;
        }
      }

      setShamcashAddress(nextAddress);
      setErrorMessage(null);
      return true;
    } catch (err) {
      const details = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || '')
        : String(err || '');

      setErrorMessage(details || 'فشل حفظ عنوان شام كاش، تأكد من صلاحيات المطور ثم أعد المحاولة');
      logger.error('Failed to update ShamCash address', 'AppSettings', { error: String(err) });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { shamcashAddress, loading, saving, errorMessage, updateShamcashAddress, refetch: fetchSettings };
};
