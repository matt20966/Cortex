const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schemasDir = path.join(__dirname, '..', 'schemas');
const schemaCache = new Map();

function loadSchema(schemaId) {
  if (schemaCache.has(schemaId)) {
    return schemaCache.get(schemaId);
  }

  const indexPath = path.join(schemasDir, 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const entry = (index.schemas || []).find((s) => s.id === schemaId);
  if (!entry) {
    throw new Error(`Unknown schema id: ${schemaId}`);
  }

  const schemaPath = path.join(schemasDir, entry.file);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  schemaCache.set(schemaId, schema);
  return schema;
}

function validate(schemaId, data) {
  const schema = loadSchema(schemaId);
  const validateFn = ajv.compile(schema);
  const valid = validateFn(data);
  return {
    valid,
    errors: valid ? [] : (validateFn.errors || []).map((e) => ({
      path: e.instancePath || '/',
      message: e.message
    }))
  };
}

module.exports = { validate, loadSchema };
