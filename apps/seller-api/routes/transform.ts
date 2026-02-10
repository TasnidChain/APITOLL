import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

function formatPayment(ctx: ReturnType<typeof getX402Context>) {
  if (!ctx?.receipt) return null;
  return { txHash: ctx.receipt.txHash, amount: ctx.receipt.amount, chain: ctx.receipt.chain };
}


router.post("/api/transform/csv", (req: Request, res: Response) => {
  const { csv, delimiter = ",", hasHeaders = true } = req.body || {};
  if (!csv || typeof csv !== "string") {
    return res.status(400).json({ error: "Provide { csv: string } in request body" });
  }
  if (csv.length > 1_000_000) {
    return res.status(400).json({ error: "CSV must be under 1MB" });
  }

  const lines = csv.split(/\r?\n/).filter((l: string) => l.trim());
  if (lines.length === 0) {
    return res.status(400).json({ error: "Empty CSV" });
  }

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  if (hasHeaders) {
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map((line: string) => {
      const values = parseLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      return obj;
    });

    res.json({
      rows: rows.length,
      columns: headers.length,
      headers,
      data: rows,
      payment: formatPayment(getX402Context(req)),
    });
  } else {
    const rows = lines.map((line: string) => parseLine(line));
    res.json({
      rows: rows.length,
      columns: rows[0]?.length || 0,
      data: rows,
      payment: formatPayment(getX402Context(req)),
    });
  }
});


router.post("/api/transform/json-to-csv", (req: Request, res: Response) => {
  const { data, delimiter = "," } = req.body || {};
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: "Provide { data: object[] } in request body" });
  }
  if (data.length > 10000) {
    return res.status(400).json({ error: "Maximum 10,000 rows" });
  }

  const headers = [...new Set(data.flatMap((row: any) => Object.keys(row)))];

  const escape = (val: any): string => {
    const str = val == null ? "" : String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escape).join(delimiter),
    ...data.map((row: any) =>
      headers.map((h) => escape(row[h])).join(delimiter)
    ),
  ];

  res.json({
    rows: data.length,
    columns: headers.length,
    headers,
    csv: lines.join("\n"),
    payment: formatPayment(getX402Context(req)),
  });
});


function parseSimpleXml(xml: string): any {
  // Remove XML declaration and comments
  const cleaned = xml.replace(/<\?[^?]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();

  function parseNode(str: string): any {
    const tagMatch = str.match(/^<([a-zA-Z][\w:.-]*)((?:\s+[^>]*?)?)>([\s\S]*)<\/\1>$/);
    if (!tagMatch) {
      // Leaf text node
      return str.trim();
    }

    const [, tag, , inner] = tagMatch;
    const children: Record<string, any[]> = {};

    // Find child elements
    const childRegex = /<([a-zA-Z][\w:.-]*)((?:\s+[^>]*?)?)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    let hasChildren = false;

    while ((match = childRegex.exec(inner)) !== null) {
      hasChildren = true;
      const childTag = match[1];
      const childContent = match[0];
      if (!children[childTag]) children[childTag] = [];
      children[childTag].push(parseNode(childContent));
    }

    if (!hasChildren) {
      return inner.trim();
    }

    const result: Record<string, any> = {};
    for (const [key, values] of Object.entries(children)) {
      result[key] = values.length === 1 ? values[0] : values;
    }
    return result;
  }

  // Find root element
  const rootMatch = cleaned.match(/^<([a-zA-Z][\w:.-]*)((?:\s+[^>]*?)?)>([\s\S]*)<\/\1>$/);
  if (!rootMatch) {
    return { _text: cleaned };
  }

  return { [rootMatch[1]]: parseNode(cleaned) };
}

router.post("/api/transform/xml", (req: Request, res: Response) => {
  const { xml } = req.body || {};
  if (!xml || typeof xml !== "string") {
    return res.status(400).json({ error: "Provide { xml: string } in request body" });
  }
  if (xml.length > 1_000_000) {
    return res.status(400).json({ error: "XML must be under 1MB" });
  }

  try {
    const result = parseSimpleXml(xml);
    res.json({
      data: result,
      inputSize: xml.length,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse XML", details: (err as Error).message });
  }
});


function parseSimpleYaml(yaml: string): any {
  const lines = yaml.split(/\r?\n/);
  const result: Record<string, any> = {};
  let currentKey = "";

  for (const line of lines) {
    // Skip comments and empty lines
    if (/^\s*#/.test(line) || !line.trim()) continue;

    // Key-value pair
    const kvMatch = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (kvMatch) {
      const [, , key, value] = kvMatch;
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();

      if (trimmedValue) {
        // Remove quotes
        let parsed: any = trimmedValue;
        if (/^["'].*["']$/.test(parsed)) {
          parsed = parsed.slice(1, -1);
        } else if (parsed === "true") parsed = true;
        else if (parsed === "false") parsed = false;
        else if (parsed === "null") parsed = null;
        else if (/^-?\d+(\.\d+)?$/.test(parsed)) parsed = Number(parsed);

        result[trimmedKey] = parsed;
      } else {
        currentKey = trimmedKey;
        result[currentKey] = {};
      }
    } else if (line.match(/^\s*-\s+/)) {
      // Array item
      const val = line.replace(/^\s*-\s+/, "").trim();
      if (currentKey && !Array.isArray(result[currentKey])) {
        result[currentKey] = [];
      }
      if (currentKey) {
        (result[currentKey] as any[]).push(val);
      }
    }
  }

  return result;
}

router.post("/api/transform/yaml", (req: Request, res: Response) => {
  const { yaml } = req.body || {};
  if (!yaml || typeof yaml !== "string") {
    return res.status(400).json({ error: "Provide { yaml: string } in request body" });
  }
  if (yaml.length > 500_000) {
    return res.status(400).json({ error: "YAML must be under 500KB" });
  }

  try {
    const result = parseSimpleYaml(yaml);
    res.json({
      data: result,
      inputSize: yaml.length,
      payment: formatPayment(getX402Context(req)),
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse YAML", details: (err as Error).message });
  }
});

export default router;
