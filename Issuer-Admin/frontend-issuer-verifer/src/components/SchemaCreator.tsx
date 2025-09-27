import { useState } from "react";
import { createSchema } from "../api/backend";

const SchemaCreator = () => {
  const [schemaName, setSchemaName] = useState("");
  const [schemaDescription, setSchemaDescription] = useState("");
  const [fields, setFields] = useState([{ name: "", type: "string", required: false }]);

  const handleFieldChange = (index: number, key: string, value: string | boolean) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], [key]: value };
    setFields(updatedFields);
  };

  const addField = () => {
    setFields([...fields, { name: "", type: "string", required: false }]);
  };

  const handleCreateSchema = async () => {
    const schemaData = {
      name: schemaName,
      description: schemaDescription,
      fields: fields.map(({ name, type }) => ({ name, type })),
    };
    const response = await createSchema(schemaData);
    alert(`Schema Created: ${response.schema.name}`);
  };

  return (
    <div>
      <h2>Create Schema</h2>
      <input
        type="text"
        placeholder="Schema Name"
        value={schemaName}
        onChange={(e) => setSchemaName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Schema Description"
        value={schemaDescription}
        onChange={(e) => setSchemaDescription(e.target.value)}
      />

      <h3>Fields</h3>
      {fields.map((field, index) => (
        <div key={index}>
          <input
            type="text"
            placeholder="Field Name"
            value={field.name}
            onChange={(e) => handleFieldChange(index, "name", e.target.value)}
          />
          <select
            value={field.type}
            onChange={(e) => handleFieldChange(index, "type", e.target.value)}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="object">Object</option>
            <option value="array">Array</option>
          </select>
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => handleFieldChange(index, "required", e.target.checked)}
          /> Required
        </div>
      ))}
      <button onClick={addField}>Add Field</button>
      <button onClick={handleCreateSchema}>Create Schema</button>
    </div>
  );
};

export default SchemaCreator;

