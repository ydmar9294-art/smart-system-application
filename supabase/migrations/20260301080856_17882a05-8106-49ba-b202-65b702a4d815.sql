
-- Create a trigger function to notify developers when org deletion request is submitted
CREATE OR REPLACE FUNCTION public.notify_developer_on_deletion_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dev_id UUID;
  v_org_name TEXT;
  v_owner_name TEXT;
BEGIN
  -- Get org name
  SELECT name INTO v_org_name FROM organizations WHERE id = NEW.organization_id;
  -- Get owner name
  SELECT full_name INTO v_owner_name FROM profiles WHERE id = NEW.owner_id;

  -- Notify all developers
  FOR v_dev_id IN SELECT id FROM profiles WHERE role = 'DEVELOPER' AND is_active = true LOOP
    INSERT INTO user_notifications (user_id, title, description, type, data)
    VALUES (
      v_dev_id,
      'طلب حذف منشأة',
      'قدّم ' || COALESCE(v_owner_name, 'مالك') || ' طلب حذف المنشأة "' || COALESCE(v_org_name, '') || '". يرجى مراجعته.',
      'warning',
      jsonb_build_object('request_id', NEW.id, 'action', 'org_deletion_request', 'org_name', v_org_name)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on deletion_requests table
DROP TRIGGER IF EXISTS trg_notify_dev_on_deletion_request ON deletion_requests;
CREATE TRIGGER trg_notify_dev_on_deletion_request
  AFTER INSERT ON deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_developer_on_deletion_request();
