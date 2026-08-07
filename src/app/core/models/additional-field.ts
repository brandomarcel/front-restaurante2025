export interface AdditionalField {
  name?: string;
  value?: string;
  field_name?: string;
  field_value?: string;
}

export interface AdditionalFieldPayload {
  field_name: string;
  field_value: string;
}

export function normalizeAdditionalFields(value: unknown): AdditionalFieldPayload[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((field: AdditionalField) => ({
      field_name: `${field?.field_name ?? field?.name ?? ''}`.trim(),
      field_value: `${field?.field_value ?? field?.value ?? ''}`.trim()
    }))
    .filter(field => field.field_name || field.field_value);
}
