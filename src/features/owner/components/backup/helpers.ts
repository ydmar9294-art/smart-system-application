/**
 * Pure helpers for BackupTab — no React, no side effects.
 */
export function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return iso; }
}

export function translateAction(action: string, entity: string, t: any): string {
  const actionMap: Record<string, string> = {
    'INSERT': t('backup.auditInsert'),
    'UPDATE': t('backup.auditUpdate'),
    'DELETE': t('backup.auditDelete'),
    'CREATE': t('backup.auditCreate'),
    'VOID': t('backup.auditVoid'),
    'REVERSE': t('backup.auditReverse'),
  };
  const entityMap: Record<string, string> = {
    'sale': t('backup.auditSale'),
    'collection': t('backup.auditCollection'),
    'product': t('backup.auditProduct'),
    'customer': t('backup.auditCustomer'),
    'delivery': t('backup.auditDelivery'),
    'purchase': t('backup.auditPurchase'),
    'profile': t('backup.auditProfile'),
    'license': t('backup.auditLicense'),
  };
  return `${actionMap[action] || action} ${entityMap[entity] || entity}`;
}

export function translateField(field: string, t: any): string {
  const map: Record<string, string> = {
    'cost_price': t('backup.auditCostPrice'),
    'base_price': t('backup.auditBasePrice'),
    'consumer_price': t('backup.auditConsumerPrice'),
  };
  return map[field] || field;
}

export function summarizeAuditDetails(details: any, action: string, t: any): string {
  if (!details) return action;
  if (typeof details === 'string') return details;
  try {
    if (details.customer_name) return `${t('backup.auditCustomerLabel')}: ${details.customer_name}`;
    if (details.product_name) return `${t('backup.auditProductLabel')}: ${details.product_name}`;
    if (details.amount) return `${t('backup.auditAmountLabel')}: ${Number(details.amount).toLocaleString()}`;
    return JSON.stringify(details).slice(0, 60);
  } catch { return action; }
}
