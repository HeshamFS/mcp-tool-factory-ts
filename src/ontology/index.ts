/**
 * Ontology module for MCP Tool Factory.
 *
 * Provides parsing and MCP server generation from RDF/OWL (Turtle),
 * JSON-LD, and custom YAML ontology definitions.
 *
 * @packageDocumentation
 */

export { OntologyParser } from './parser.js';
export { OntologyServerGenerator } from './generator.js';
export type {
  OntologyDefinition,
  OntologyClass,
  OntologyProperty,
  OntologyIndividual,
} from './types.js';
