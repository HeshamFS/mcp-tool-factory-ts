/**
 * Ontology Parser for MCP Tool Factory.
 *
 * Parses RDF/OWL (Turtle), JSON-LD, and custom YAML ontology formats
 * into a unified OntologyDefinition.
 */

import type {
  OntologyDefinition,
  OntologyClass,
  OntologyProperty,
  OntologyIndividual,
} from './types.js';

// Well-known RDF/OWL namespace URIs
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

/**
 * Extract a local name from a URI (the part after # or last /).
 */
function localName(uri: string): string {
  const hashIdx = uri.lastIndexOf('#');
  if (hashIdx >= 0) return uri.slice(hashIdx + 1);
  const slashIdx = uri.lastIndexOf('/');
  if (slashIdx >= 0) return uri.slice(slashIdx + 1);
  return uri;
}

/**
 * Map an XSD / RDF range URI to a simple type string.
 */
function rangeToSimpleType(range: string): string {
  const ln = localName(range).toLowerCase();
  if (['string', 'anyuri', 'normalizedstring', 'token', 'language'].includes(ln)) return 'string';
  if (['integer', 'int', 'long', 'short', 'byte', 'nonnegativeinteger', 'positiveinteger'].includes(ln)) return 'integer';
  if (['float', 'double', 'decimal'].includes(ln)) return 'number';
  if (['boolean'].includes(ln)) return 'boolean';
  if (['date', 'datetime', 'time'].includes(ln)) return 'string';
  return 'string';
}

/**
 * Multi-format ontology parser that converts RDF/OWL, JSON-LD, and custom YAML
 * ontology definitions into a unified {@link OntologyDefinition} structure.
 *
 * Use {@link parse} for automatic format detection, or call format-specific
 * methods directly.
 *
 * @example
 * ```typescript
 * const parser = new OntologyParser();
 * const definition = await parser.parse(content); // auto-detects format
 * const definition = await parser.parseRDF(turtleContent);
 * const definition = parser.parseJsonLD(jsonLdContent);
 * ```
 */
export class OntologyParser {
  /**
   * Parse RDF/OWL content in Turtle format.
   *
   * Requires the `n3` package (dynamically imported).
   * Extracts owl:Class, owl:DatatypeProperty, owl:ObjectProperty, and individuals.
   *
   * @param content - Turtle/N3 format RDF string
   * @returns Parsed ontology definition
   * @throws If the `n3` package is not installed
   */
  async parseRDF(content: string): Promise<OntologyDefinition> {
    // Dynamic import to keep n3 optional
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let n3: any;
    try {
      const moduleName = 'n3';
      n3 = await import(/* webpackIgnore: true */ moduleName);
    } catch {
      throw new Error(
        'n3 package is required for RDF/OWL parsing. Install with: npm install n3'
      );
    }

    const parser = new n3.Parser();
    const quads = parser.parse(content) as Array<{ subject: { value: string }; predicate: { value: string }; object: { value: string } }>;

    // Index quads by subject for fast lookup
    const bySubject = new Map<string, Array<{ predicate: string; object: string }>>();
    for (const quad of quads) {
      const s = quad.subject.value;
      if (!bySubject.has(s)) bySubject.set(s, []);
      bySubject.get(s)!.push({ predicate: quad.predicate.value, object: quad.object.value });
    }

    // Helper to get a single value for a subject+predicate
    const getValue = (subject: string, predicate: string): string | undefined => {
      const triples = bySubject.get(subject);
      if (!triples) return undefined;
      const found = triples.find((t) => t.predicate === predicate);
      return found?.object;
    };

    // Collect classes (rdfs:Class and owl:Class)
    const classUris = new Set<string>();
    for (const quad of quads) {
      if (
        quad.predicate.value === `${RDF}type` &&
        (quad.object.value === `${RDFS}Class` || quad.object.value === `${OWL}Class`)
      ) {
        classUris.add(quad.subject.value);
      }
    }

    // Collect properties
    const dataPropertyUris = new Set<string>();
    const objectPropertyUris = new Set<string>();
    for (const quad of quads) {
      if (quad.predicate.value === `${RDF}type`) {
        if (quad.object.value === `${OWL}DatatypeProperty` || quad.object.value === `${RDF}Property`) {
          dataPropertyUris.add(quad.subject.value);
        }
        if (quad.object.value === `${OWL}ObjectProperty`) {
          objectPropertyUris.add(quad.subject.value);
        }
      }
    }

    // Build property objects
    const allProperties: OntologyProperty[] = [];

    for (const uri of dataPropertyUris) {
      const label = getValue(uri, `${RDFS}label`) ?? localName(uri);
      const description = getValue(uri, `${RDFS}comment`) ?? '';
      const domain = getValue(uri, `${RDFS}domain`);
      const range = getValue(uri, `${RDFS}range`) ?? `${XSD}string`;
      allProperties.push({ uri, label, description, domain, range: rangeToSimpleType(range), type: 'data' });
    }

    for (const uri of objectPropertyUris) {
      const label = getValue(uri, `${RDFS}label`) ?? localName(uri);
      const description = getValue(uri, `${RDFS}comment`) ?? '';
      const domain = getValue(uri, `${RDFS}domain`);
      const range = getValue(uri, `${RDFS}range`) ?? '';
      allProperties.push({ uri, label, description, domain, range, type: 'object' });
    }

    // Build class objects
    const classes: OntologyClass[] = [];
    for (const uri of classUris) {
      const label = getValue(uri, `${RDFS}label`) ?? localName(uri);
      const description = getValue(uri, `${RDFS}comment`) ?? '';
      const superClass = getValue(uri, `${RDFS}subClassOf`);

      const dataProps = allProperties.filter((p) => p.type === 'data' && p.domain === uri);
      const objProps = allProperties.filter((p) => p.type === 'object' && p.domain === uri);

      classes.push({ uri, label, description, superClass, dataProperties: dataProps, objectProperties: objProps });
    }

    // Collect individuals (instances of known classes)
    const individuals: OntologyIndividual[] = [];
    for (const quad of quads) {
      if (quad.predicate.value === `${RDF}type` && classUris.has(quad.object.value)) {
        const indUri = quad.subject.value;
        const indLabel = getValue(indUri, `${RDFS}label`) ?? localName(indUri);
        const props: Record<string, string | number | boolean> = {};

        const triples = bySubject.get(indUri) ?? [];
        for (const t of triples) {
          if (t.predicate === `${RDF}type` || t.predicate === `${RDFS}label`) continue;
          const propName = localName(t.predicate);
          // Try to parse as number or boolean
          if (t.object === 'true' || t.object === 'false') {
            props[propName] = t.object === 'true';
          } else if (!isNaN(Number(t.object)) && t.object.trim() !== '') {
            props[propName] = Number(t.object);
          } else {
            props[propName] = t.object;
          }
        }

        individuals.push({ uri: indUri, label: indLabel, classUri: quad.object.value, properties: props });
      }
    }

    // Derive ontology name from the owl:Ontology declaration or first class
    let ontologyName = 'Ontology';
    for (const quad of quads) {
      if (quad.predicate.value === `${RDF}type` && quad.object.value === `${OWL}Ontology`) {
        ontologyName = getValue(quad.subject.value, `${RDFS}label`) ?? localName(quad.subject.value);
        break;
      }
    }

    return {
      name: ontologyName,
      description: `Ontology with ${classes.length} classes and ${allProperties.length} properties`,
      classes,
      properties: allProperties,
      individuals,
    };
  }

  /**
   * Parse JSON-LD format into an OntologyDefinition.
   *
   * Supports `@graph` arrays and inline `@context`. Recognizes both
   * prefixed (`rdfs:Class`) and full URI (`http://...#Class`) type references.
   *
   * @param content - JSON-LD string
   * @returns Parsed ontology definition
   */
  parseJsonLD(content: string): OntologyDefinition {
    const doc = JSON.parse(content);

    const context = doc['@context'] ?? {};
    const graph: Array<Record<string, unknown>> = doc['@graph'] ?? (Array.isArray(doc) ? doc : [doc]);

    const classes: OntologyClass[] = [];
    const allProperties: OntologyProperty[] = [];
    const individuals: OntologyIndividual[] = [];
    const classUris = new Set<string>();

    for (const node of graph) {
      const nodeType = node['@type'];
      const types = Array.isArray(nodeType) ? nodeType : nodeType ? [nodeType] : [];
      const id = (node['@id'] as string) ?? '';

      const isClass =
        types.includes('rdfs:Class') ||
        types.includes('owl:Class') ||
        types.includes(`${RDFS}Class`) ||
        types.includes(`${OWL}Class`);

      const isDataProp =
        types.includes('owl:DatatypeProperty') ||
        types.includes(`${OWL}DatatypeProperty`) ||
        types.includes('rdf:Property') ||
        types.includes(`${RDF}Property`);

      const isObjectProp =
        types.includes('owl:ObjectProperty') ||
        types.includes(`${OWL}ObjectProperty`);

      if (isClass) {
        classUris.add(id);
        const label = this.extractStringValue(node, 'rdfs:label', `${RDFS}label`) ?? localName(id);
        const description = this.extractStringValue(node, 'rdfs:comment', `${RDFS}comment`) ?? '';
        const superClass = this.extractStringValue(node, 'rdfs:subClassOf', `${RDFS}subClassOf`);

        classes.push({
          uri: id,
          label,
          description,
          superClass: superClass ?? undefined,
          dataProperties: [],
          objectProperties: [],
        });
      } else if (isDataProp) {
        const label = this.extractStringValue(node, 'rdfs:label', `${RDFS}label`) ?? localName(id);
        const description = this.extractStringValue(node, 'rdfs:comment', `${RDFS}comment`) ?? '';
        const domain = this.extractStringValue(node, 'rdfs:domain', `${RDFS}domain`);
        const range = this.extractStringValue(node, 'rdfs:range', `${RDFS}range`) ?? 'string';

        allProperties.push({
          uri: id,
          label,
          description,
          domain: domain ?? undefined,
          range: rangeToSimpleType(range),
          type: 'data',
        });
      } else if (isObjectProp) {
        const label = this.extractStringValue(node, 'rdfs:label', `${RDFS}label`) ?? localName(id);
        const description = this.extractStringValue(node, 'rdfs:comment', `${RDFS}comment`) ?? '';
        const domain = this.extractStringValue(node, 'rdfs:domain', `${RDFS}domain`);
        const range = this.extractStringValue(node, 'rdfs:range', `${RDFS}range`) ?? '';

        allProperties.push({
          uri: id,
          label,
          description,
          domain: domain ?? undefined,
          range,
          type: 'object',
        });
      }
    }

    // Assign properties to classes by domain
    for (const cls of classes) {
      cls.dataProperties = allProperties.filter((p) => p.type === 'data' && p.domain === cls.uri);
      cls.objectProperties = allProperties.filter((p) => p.type === 'object' && p.domain === cls.uri);
    }

    // Collect individuals (nodes typed as a known class)
    for (const node of graph) {
      const nodeType = node['@type'];
      const types = Array.isArray(nodeType) ? nodeType : nodeType ? [nodeType] : [];
      const id = (node['@id'] as string) ?? '';

      for (const t of types) {
        if (classUris.has(t)) {
          const label = this.extractStringValue(node, 'rdfs:label', `${RDFS}label`) ?? localName(id);
          const props: Record<string, string | number | boolean> = {};
          for (const [key, value] of Object.entries(node)) {
            if (key.startsWith('@')) continue;
            if (key === 'rdfs:label' || key === `${RDFS}label`) continue;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              props[key] = value;
            }
          }
          individuals.push({ uri: id, label, classUri: t, properties: props });
          break;
        }
      }
    }

    const ontologyName = (context as Record<string, unknown>)['@base']
      ? localName(String((context as Record<string, unknown>)['@base']))
      : 'Ontology';

    return {
      name: ontologyName,
      description: `Ontology with ${classes.length} classes and ${allProperties.length} properties`,
      classes,
      properties: allProperties,
      individuals,
    };
  }

  /**
   * Parse a custom YAML ontology format.
   *
   * Requires the `js-yaml` package (dynamically imported).
   *
   * @param content - YAML string in the custom ontology format shown below
   * @returns Parsed ontology definition
   * @throws If the `js-yaml` package is not installed
   *
   * @example Expected YAML format:
   * ```yaml
   * name: MyOntology
   * description: Description
   * classes:
   *   - name: Person
   *     description: A person
   *     properties:
   *       - name: firstName
   *         type: string
   *         description: First name
   *     relationships:
   *       - name: knows
   *         target: Person
   *         description: Knows another person
   * ```
   */
  async parseYAML(content: string): Promise<OntologyDefinition> {
    let yaml: typeof import('js-yaml');
    try {
      yaml = await import('js-yaml');
    } catch {
      throw new Error(
        'js-yaml package is required for YAML parsing. Install with: npm install js-yaml'
      );
    }

    const doc = yaml.load(content) as Record<string, unknown>;
    const name = (doc.name as string) ?? 'Ontology';
    const description = (doc.description as string) ?? '';
    const rawClasses = (doc.classes as Array<Record<string, unknown>>) ?? [];

    const classes: OntologyClass[] = [];
    const allProperties: OntologyProperty[] = [];
    const individuals: OntologyIndividual[] = [];

    for (const rawCls of rawClasses) {
      const clsName = (rawCls.name as string) ?? 'Unknown';
      const clsDesc = (rawCls.description as string) ?? '';
      const clsUri = `#${clsName}`;
      const superClass = rawCls.extends ? `#${rawCls.extends as string}` : undefined;

      const rawProps = (rawCls.properties as Array<Record<string, unknown>>) ?? [];
      const rawRels = (rawCls.relationships as Array<Record<string, unknown>>) ?? [];

      const dataProps: OntologyProperty[] = rawProps.map((p) => {
        const propUri = `#${p.name as string}`;
        const prop: OntologyProperty = {
          uri: propUri,
          label: (p.name as string) ?? '',
          description: (p.description as string) ?? '',
          domain: clsUri,
          range: (p.type as string) ?? 'string',
          type: 'data',
        };
        allProperties.push(prop);
        return prop;
      });

      const objProps: OntologyProperty[] = rawRels.map((r) => {
        const relUri = `#${r.name as string}`;
        const prop: OntologyProperty = {
          uri: relUri,
          label: (r.name as string) ?? '',
          description: (r.description as string) ?? '',
          domain: clsUri,
          range: `#${r.target as string}`,
          type: 'object',
        };
        allProperties.push(prop);
        return prop;
      });

      classes.push({
        uri: clsUri,
        label: clsName,
        description: clsDesc,
        superClass,
        dataProperties: dataProps,
        objectProperties: objProps,
      });

      // Parse pre-defined individuals
      const rawIndividuals = (rawCls.individuals as Array<Record<string, unknown>>) ?? [];
      for (const ind of rawIndividuals) {
        const indName = (ind.name as string) ?? 'unknown';
        const props: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(ind)) {
          if (key === 'name') continue;
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            props[key] = value;
          }
        }
        individuals.push({
          uri: `#${indName}`,
          label: indName,
          classUri: clsUri,
          properties: props,
        });
      }
    }

    return { name, description: description || `Ontology with ${classes.length} classes`, classes, properties: allProperties, individuals };
  }

  /**
   * Auto-detect the ontology format and parse accordingly.
   *
   * Detection order: explicit `format` parameter, then JSON-LD (starts with `{`/`[`
   * and has `@context`/`@graph`), then YAML (has `name:` or `classes:` lines),
   * then falls back to RDF/Turtle.
   *
   * @param content - Raw ontology content string
   * @param format - Optional explicit format override
   * @returns Parsed ontology definition
   */
  async parse(content: string, format?: 'rdf' | 'jsonld' | 'yaml'): Promise<OntologyDefinition> {
    if (format === 'rdf') return this.parseRDF(content);
    if (format === 'jsonld') return this.parseJsonLD(content);
    if (format === 'yaml') return this.parseYAML(content);

    // Auto-detect
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // Could be JSON-LD or plain JSON
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed['@context'] || parsed['@graph'] || parsed['@type']) {
          return this.parseJsonLD(content);
        }
      } catch {
        // Not valid JSON, try other formats
      }
    }

    // Try YAML if it looks like YAML (has key: value patterns)
    if (/^name\s*:/m.test(trimmed) || /^classes\s*:/m.test(trimmed)) {
      return this.parseYAML(content);
    }

    // Default to RDF/Turtle
    return this.parseRDF(content);
  }

  /**
   * Extract a string value from a JSON-LD node, checking multiple key variants.
   */
  private extractStringValue(node: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const val = node[key];
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object') {
        // Handle {"@value": "..."} or {"@id": "..."}
        const obj = val as Record<string, unknown>;
        if (typeof obj['@value'] === 'string') return obj['@value'];
        if (typeof obj['@id'] === 'string') return obj['@id'];
      }
    }
    return null;
  }
}
