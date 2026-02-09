import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}

interface ValidationError {
  path: string;
  message: string;
}

function validateAgainstSchema(data: unknown, schema: Record<string, unknown>, path = "", depth = 0): ValidationError[] {
  const errors: ValidationError[] = [];

  // Prevent stack overflow from deeply nested schemas
  if (depth > 10) {
    errors.push({ path: path || "$", message: "Schema nesting too deep (max 10 levels)" });
    return errors;
  }

  if (schema.type) {
    const type = schema.type as string;
    const actualType = Array.isArray(data) ? "array" : data === null ? "null" : typeof data;

    if (type === "integer") {
      if (typeof data !== "number" || !Number.isInteger(data)) {
        errors.push({ path: path || "$", message: `Expected integer, got ${actualType}` });
        return errors;
      }
    } else if (type !== actualType) {
      errors.push({ path: path || "$", message: `Expected ${type}, got ${actualType}` });
      return errors;
    }
  }

  // Object validation
  if (schema.type === "object" && typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required || []) as string[];

    for (const req of required) {
      if (!(req in obj)) {
        errors.push({ path: `${path}.${req}`, message: `Required property missing` });
      }
    }

    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in obj) {
        errors.push(...validateAgainstSchema(obj[key], propSchema, `${path}.${key}`, depth + 1));
      }
    }
  }

  // Array validation
  if (schema.type === "array" && Array.isArray(data)) {
    if (schema.minItems && data.length < (schema.minItems as number)) {
      errors.push({ path: path || "$", message: `Array must have at least ${schema.minItems} items` });
    }
    if (schema.maxItems && data.length > (schema.maxItems as number)) {
      errors.push({ path: path || "$", message: `Array must have at most ${schema.maxItems} items` });
    }
    if (schema.items) {
      data.slice(0, 50).forEach((item, i) => {
        errors.push(...validateAgainstSchema(item, schema.items as Record<string, unknown>, `${path}[${i}]`, depth + 1));
      });
    }
  }

  // String validation
  if (schema.type === "string" && typeof data === "string") {
    if (schema.minLength && data.length < (schema.minLength as number)) {
      errors.push({ path: path || "$", message: `String must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength && data.length > (schema.maxLength as number)) {
      errors.push({ path: path || "$", message: `String must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern) {
      try {
        const pat = schema.pattern as string;
        // Limit pattern length to prevent ReDoS
        if (pat.length > 200) {
          errors.push({ path: path || "$", message: "Pattern too long (max 200 chars)" });
        } else {
          // Test with a timeout guard — run synchronously but limit input size
          const testData = data.slice(0, 1000); // Limit data tested against pattern
          if (!new RegExp(pat).test(testData)) {
            errors.push({ path: path || "$", message: `String does not match pattern ${pat}` });
          }
        }
      } catch {
        errors.push({ path: path || "$", message: `Invalid pattern: ${schema.pattern}` });
      }
    }
    if (schema.enum && !(schema.enum as string[]).includes(data)) {
      errors.push({ path: path || "$", message: `Value must be one of: ${(schema.enum as string[]).join(", ")}` });
    }
  }

  // Number validation
  if ((schema.type === "number" || schema.type === "integer") && typeof data === "number") {
    if (schema.minimum !== undefined && data < (schema.minimum as number)) {
      errors.push({ path: path || "$", message: `Value must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > (schema.maximum as number)) {
      errors.push({ path: path || "$", message: `Value must be <= ${schema.maximum}` });
    }
  }

  return errors;
}

router.post("/api/json/validate", (req: Request, res: Response) => {
  const { data, schema } = req.body || {};

  if (data === undefined) return res.status(400).json({ error: "Provide { data: any, schema: object }" });
  if (!schema || typeof schema !== "object") return res.status(400).json({ error: "schema must be a JSON Schema object" });

  const bodyStr = JSON.stringify(req.body);
  if (bodyStr.length > 500000) return res.status(400).json({ error: "Request body too large (max 500KB)" });

  try {
    const errors = validateAgainstSchema(data, schema);

    res.json({
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(500).json({ error: "Validation failed", details: (err as Error).message });
  }
});

export default router;
