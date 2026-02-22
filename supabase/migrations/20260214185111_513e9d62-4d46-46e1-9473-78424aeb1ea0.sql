
-- Fix #7: Allow Accountant to manage purchase returns
CREATE POLICY "Accountants can manage purchase returns"
ON public.purchase_returns
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_employee_type(auth.uid(), 'ACCOUNTANT'::employee_type)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_employee_type(auth.uid(), 'ACCOUNTANT'::employee_type)
);

CREATE POLICY "Accountants can manage purchase return items"
ON public.purchase_return_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM purchase_returns pr
    WHERE pr.id = purchase_return_items.return_id
    AND pr.organization_id = get_user_organization_id(auth.uid())
    AND has_employee_type(auth.uid(), 'ACCOUNTANT'::employee_type)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM purchase_returns pr
    WHERE pr.id = purchase_return_items.return_id
    AND pr.organization_id = get_user_organization_id(auth.uid())
    AND has_employee_type(auth.uid(), 'ACCOUNTANT'::employee_type)
  )
);
