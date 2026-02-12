/**
 * Ontology type definitions for MCP Tool Factory.
 *
 * These interfaces model RDF/OWL ontology concepts in a format suitable
 * for generating MCP servers. Supports classes, data/object properties,
 * and pre-populated individuals.
 *
 * @packageDocumentation
 */

/**
 * A property within an ontology class (either a data property or an object relationship).
 */
export interface OntologyProperty {
  /** Full URI of the property (e.g., `http://example.org/schema#firstName`) */
  uri: string;
  /** Human-readable label */
  label: string;
  /** Description of what this property represents */
  description: string;
  /** URI of the class this property belongs to (rdfs:domain) */
  domain?: string;
  /** The value type: a simple type name for data properties, or a class URI for object properties */
  range: string;
  /** Whether this is a data property (literal value) or object property (relationship to another class) */
  type: 'data' | 'object';
}

/**
 * An ontology class, which maps to a resource and a set of CRUD tools in the generated MCP server.
 */
export interface OntologyClass {
  /** Full URI of the class */
  uri: string;
  /** Human-readable label used for tool/resource naming */
  label: string;
  /** Description of the class */
  description: string;
  /** URI of the parent class (rdfs:subClassOf), if any */
  superClass?: string;
  /** Properties with literal values (string, number, boolean) */
  dataProperties: OntologyProperty[];
  /** Properties representing relationships to other classes */
  objectProperties: OntologyProperty[];
}

/**
 * A pre-defined instance (individual) of an ontology class, used to seed the in-memory store.
 */
export interface OntologyIndividual {
  /** Full URI of this individual */
  uri: string;
  /** Human-readable label */
  label: string;
  /** URI of the class this individual belongs to */
  classUri: string;
  /** Property values for this individual */
  properties: Record<string, string | number | boolean>;
}

/**
 * A complete parsed ontology, serving as the input for {@link OntologyServerGenerator}.
 */
export interface OntologyDefinition {
  /** Name of the ontology (from owl:Ontology label or YAML `name` field) */
  name: string;
  /** Human-readable description */
  description: string;
  /** All classes defined in the ontology */
  classes: OntologyClass[];
  /** All properties (both data and object) defined in the ontology */
  properties: OntologyProperty[];
  /** Pre-defined individuals to seed the generated server's data store */
  individuals: OntologyIndividual[];
}
