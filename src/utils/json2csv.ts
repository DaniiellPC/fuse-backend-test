/**
 * Escapes a value to be included in a CSV.
 * If the value contains commas, double quotes, or line breaks,
 * it is wrapped in double quotes and internal double quotes are duplicated.
 * @param value The value to escape.
 * @returns The escaped value for CSV.
 */
function escapeCsvValue(value: any): string {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  let stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    stringValue = stringValue.replace(/"/g, '""');
    return `"${stringValue}"`;
  }
  return stringValue;
}

/**
 * Generates a CSV string from an array of objects.
 * @param data The array of objects to convert to CSV.
 * @param fields (Optional) An array of field names to include in the CSV and define the order.
 * If null/undefined, all keys from the first object will be used as headers.
 * @returns A string representing the contents of the CSV file.
 */
export function generateCsv<T extends object>(
  data: T[],
  fields?: (keyof T)[] | null
): string {
  if (!data || data.length === 0) {
    return "";
  }

  const csvFields = fields || (Object.keys(data[0]) as (keyof T)[]);

  const headerRow = csvFields
    .map((field) => escapeCsvValue(String(field)))
    .join(",");

  const dataRows = data.map((item) => {
    return csvFields
      .map((field) => {
        const value = item[field];
        return escapeCsvValue(value);
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}
