-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create organization_legal_info table for storing legal details
CREATE TABLE public.organization_legal_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  commercial_registration TEXT,
  industrial_registration TEXT,
  tax_identification TEXT,
  trademark_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookup
CREATE INDEX idx_org_legal_info_org_id ON public.organization_legal_info(organization_id);

-- Enable RLS
ALTER TABLE public.organization_legal_info ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block unauthenticated access to organization_legal_info" 
  ON public.organization_legal_info 
  FOR SELECT 
  TO anon 
  USING (false);

-- Owners can manage their organization's legal info (CRUD)
CREATE POLICY "Owners can manage their org legal info" 
  ON public.organization_legal_info 
  FOR ALL 
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'OWNER')
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'OWNER')
  );

-- Distributors (FIELD_AGENT) can READ their org's legal info for printing
CREATE POLICY "Distributors can read their org legal info" 
  ON public.organization_legal_info 
  FOR SELECT 
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
  );

-- Developers can view all for support
CREATE POLICY "Developers can view all legal info" 
  ON public.organization_legal_info 
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'DEVELOPER'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_org_legal_info_updated_at
  BEFORE UPDATE ON public.organization_legal_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();