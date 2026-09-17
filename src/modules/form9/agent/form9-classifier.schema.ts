import { z } from 'zod';

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

export const form9ClassificationSchema = z.object({
  reportable: z
    .enum(FORM9_REPORTABLE_VALUES)
    .describe(
      'The gate. "Complaint" if the customer/merchant hit a deficiency attributable to Glomo, its platform, or a partner acting for Glomo. "Service request" if there is a real inbound needing an answer but no deficiency (config, how-it-works, TAT/eligibility explained). "Not applicable" if there is no service question or the cause sits wholly outside Glomo with no Glomo failing. When genuinely torn, choose Complaint.',
    ),
  serviceType: z
    .enum(FORM9_SERVICE_TYPE_VALUES)
    .describe(
      'The regulated activity the ticket arose under, determined by the rail, not by who complained. "Cross border money transfer" = all LRS. "Merchant acquisition" = all merchant-facing (Cards, Bank Transfer, Merchant Integration, Payouts and Settlements). "Account issuance" and "Escrow" are not currently used. "Not applicable" only for L1 Not an Issue.',
    ),
  complaintType: z
    .enum(FORM9_COMPLAINT_TYPE_VALUES)
    .describe(
      'The prescribed complaint type. Only meaningful when reportable = "Complaint"; otherwise "NA Not applicable". Do not stretch a specific type to avoid "13 Others" — a wrong specific type is worse than an honest Others.',
    ),
  othersDetail: z
    .string()
    .describe(
      'Only when complaintType = "13 Others": an "L2 > L3" category label (e.g. "Payin Failure - Bank Authentication > Bank maintenance page shown"). Empty string for every other complaintType. This is a category label, NOT a case note — never put customer names, amounts, account numbers, PANs, emails, phone numbers, or ticket-specific detail here.',
    ),
  reasoning: z
    .string()
    .describe(
      'One short sentence stating the rule that drove the classification. Never include customer names, amounts, account numbers, PANs, emails, or phone numbers.',
    ),
});

export type Form9Classification = z.infer<typeof form9ClassificationSchema>;
