import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import crypto from "crypto";


const router = Router();

// Ensure __dirname works in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaFilePath = path.join(__dirname, '../data/schemas.json');
console.log(`Schema file path: ${schemaFilePath}`);

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'));
}

// Ensure schemas.json exists
if (!fs.existsSync(schemaFilePath)) {
  fs.writeFileSync(schemaFilePath, '[]', 'utf-8');
}

// Define the schema type

interface Schema {
  $id: string;
  $schema: string;
  name: string;
  description?: string;
  type: "object";
  properties: {
    [key: string]: { type: "string" | "number" | "boolean" };
  };
  required: string[];
}

// Helper function to load schemas from file
const loadSchemas = (): Schema[] => {
  /*try {
    const data = fs.readFileSync(schemaFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading schemas file:', error);
    return [];
  }*/
  
    if (fs.existsSync(schemaFilePath)) {
      return JSON.parse(fs.readFileSync(schemaFilePath, "utf-8"));
    }
    return [];
};

// Helper function to save schemas to file
const saveSchemas = (schemas: Schema[]): void => {
  try {
    fs.writeFileSync(schemaFilePath, JSON.stringify(schemas, null, 2));
  } catch (error) {
    console.error('Error writing to schemas file:', error);
  }
};

// ✅ Create a new schema
router.post('/create', (req: Request, res: Response): void => {
  
  const { name, description, fields } = req.body;

  if (!name || !fields || !Array.isArray(fields)) {
    res.status(400).json({ success: false, message: "Invalid schema format" });
    return;
  }

  const properties: Record<string, any> = {};
  const required: string[] = [];

  fields.forEach((field: { name: string; type: string }) => {
    properties[field.name] = { type: field.type };
    required.push(field.name);
  });

  const schema: Schema = {
    $id: crypto.randomUUID(),
    $schema: 'http://json-schema.org/draft-07/schema#',
    name,
    description,
    type: "object",
    properties,
    required,
  };

  const schemas = loadSchemas();
  schemas.push(schema);
  saveSchemas(schemas);

  res.json({ success: true, schema });
});

// ✅ List all schemas
router.get('/list', (req: Request, res: Response): void => {
  const schemas = loadSchemas();
  res.json({ success: true, schemas });
});

// ✅ Fetch a specific schema by ID
router.get('/:id', (req: Request, res: Response): void => {
  const schemas = loadSchemas();
  const schema = schemas.find(s => s.$id === req.params.id);

  if (!schema) {
    res.status(404).json({ success: false, message: 'Schema not found' });
    return;
  }

  res.json({ success: true, schema });
});

// ✅ Delete a schema by ID
router.delete('/:id', (req: Request, res: Response): void => {
  let schemas = loadSchemas();
  const initialLength = schemas.length;
  schemas = schemas.filter(s => s.$id !== req.params.id);

  if (schemas.length === initialLength) {
    res.status(404).json({ success: false, message: 'Schema not found' });
    return;
  }

  saveSchemas(schemas);
  res.json({ success: true, message: 'Schema deleted successfully' });
});

export default router;
