/**
 * License Service - License and subscription management
 */
import { safeRpc, validateUUID, validateRequiredString, validatePositiveNumber } from '@/lib/safeQuery';

export const licenseService = {
  async issueLicense(orgName: string, type: string, days: number, maxEmployees: number, ownerPhone?: string): Promise<string> {
    validateRequiredString(orgName, 'اسم المنشأة');
    validatePositiveNumber(days, 'عدد الأيام');
    validatePositiveNumber(maxEmployees, 'عدد الموظفين');

    return safeRpc<string>('issue_license_rpc', {
      p_org_name: orgName, p_type: type, p_days: days,
      p_max_employees: maxEmployees, p_owner_phone: ownerPhone || null,
    }, { label: 'issueLicense' });
  },

  async updateLicenseStatus(id: string, status: string): Promise<void> {
    validateUUID(id, 'معرف الترخيص');
    await safeRpc('update_license_status_rpc', { p_license_id: id, p_status: status }, { label: 'updateLicenseStatus' });
  },

  async updateLicenseMaxEmployees(licenseId: string, maxEmployees: number): Promise<any> {
    validateUUID(licenseId, 'معرف الترخيص');
    validatePositiveNumber(maxEmployees, 'عدد الموظفين');

    return safeRpc<any>('update_license_max_employees_rpc', {
      p_license_id: licenseId, p_max_employees: maxEmployees,
    }, { label: 'updateLicenseMaxEmployees' });
  },
};
