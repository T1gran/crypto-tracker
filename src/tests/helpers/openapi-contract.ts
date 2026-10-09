import { expect } from "@jest/globals";
import { openApiSpec } from "../../openapi";

type Schema = {
  $ref?: string;
  type?: string;
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  items?: Schema;
  enum?: unknown[];
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
};

export function resolveRef<T extends { $ref?: string }>(value: T): T {
  if (!value.$ref) return value;
  expect(value.$ref.startsWith("#/" )).toBe(true);
  let target: unknown = openApiSpec;
  for (const part of value.$ref.slice(2).split("/")) {
    target = (target as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    expect(target).toBeDefined();
  }
  return resolveRef(target as T);
}

// Checks the schema features used by this API; not a general OpenAPI validator.
export function expectSchema(value: unknown, input: Schema): void {
  const schema = resolveRef(input);
  if (value === null && schema.nullable) return;
  if (schema.enum) expect(schema.enum).toContainEqual(value);
  switch (schema.type) {
    case "object": {
      expect(value).not.toBeNull();
      expect(typeof value).toBe("object");
      expect(Array.isArray(value)).toBe(false);
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) expect(record).toHaveProperty(key);
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        if (key in record) expectSchema(record[key], child);
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) expect(schema.properties).toHaveProperty(key);
      }
      break;
    }
    case "array":
      expect(Array.isArray(value)).toBe(true);
      for (const item of value as unknown[]) expectSchema(item, schema.items!);
      break;
    case "string":
      expect(typeof value).toBe("string");
      if (schema.pattern) expect(value).toMatch(new RegExp(schema.pattern));
      if (schema.format === "date-time") {
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(Number.isFinite(Date.parse(value as string))).toBe(true);
      }
      break;
    case "integer":
      expect(Number.isInteger(value)).toBe(true);
      break;
    case "number":
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
      break;
    case "boolean":
      expect(typeof value).toBe("boolean");
      break;
    default:
      throw new Error(`Unsupported contract schema type: ${schema.type}`);
  }
  if (schema.minimum !== undefined) expect(value).toBeGreaterThanOrEqual(schema.minimum);
  if (schema.maximum !== undefined) expect(value).toBeLessThanOrEqual(schema.maximum);
}

type ResponseSpec = { $ref?: string; content?: Record<string, { schema: Schema }> };
type Operation = { responses: Record<string, ResponseSpec>; security?: unknown[] };
export const paths = openApiSpec.paths as unknown as Record<string, Record<string, Operation>>;

export function expectResponse(path: string, method: string, response: {
  status: number; type: string; body: unknown; text: string;
}): void {
  const documented = paths[path][method].responses[String(response.status)];
  expect(documented).toBeDefined();
  const spec = resolveRef(documented);
  expect(spec.content).toHaveProperty(response.type);
  expectSchema(response.type === "application/json" ? response.body : response.text, spec.content![response.type].schema);
}
