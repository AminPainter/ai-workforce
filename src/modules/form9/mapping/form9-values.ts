// Exact Form 9 picklist strings, straight from form9_mapping.csv. These are the
// values the deterministic lookup returns and that get written to Zoho.
export const FORM9_REPORTABLE_VALUES = [
  'Complaint',
  'Service request',
  'Not applicable',
] as const;

export const FORM9_SERVICE_TYPE_VALUES = [
  'Cross border money transfer',
  'Merchant acquisition',
  'Account issuance',
  'Escrow',
  'Not applicable',
] as const;

export const FORM9_COMPLAINT_TYPE_VALUES = [
  '01 Fees/charges/disclosures',
  '02 Transaction drop',
  '03 Fraudulent/unauthorised use',
  '04 Non-updation of mobile number/address',
  '05 Amount not credited back to source',
  '06 Cash back queries',
  '07 Promo code not working',
  '08 Limits on wallet/account',
  '09 Inability to use wallet/account',
  '10 Password or login reset',
  '11 Delay in loading/crediting',
  '12 Non-delivery of goods/services from merchant',
  '13 Others',
  'NA Not applicable',
] as const;

export type Form9Reportable = (typeof FORM9_REPORTABLE_VALUES)[number];
export type Form9ServiceType = (typeof FORM9_SERVICE_TYPE_VALUES)[number];
export type Form9ComplaintType = (typeof FORM9_COMPLAINT_TYPE_VALUES)[number];
