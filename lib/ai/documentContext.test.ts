import { describe, it, expect } from 'vitest';
import { DOCUMENT_CONTEXTS, type DomainContextKey } from './documentContext';
import { base64DataUrlToFile } from './aiDocumentExtractor';

describe('documentContext Schema & Quality Contracts', () => {
  const REQUIRED_CONTEXT_KEYS: DomainContextKey[] = [
    'facility',
    'process',
    'activity',
    'supplier',
    'mitigation',
    'vn_mrv',
    'data_gap',
    'climate_location',
    'export_invoice',
    'export_packing_list',
    'export_bol',
    'export_customs',
    'factor_proposal',
    'iot_meter',
    'supplier_carbon',
    'production_batch',
    'allowance_quota',
  ];

  it('defines all 17 expected domain contexts', () => {
    expect(REQUIRED_CONTEXT_KEYS.length).toBe(17);
    for (const key of REQUIRED_CONTEXT_KEYS) {
      const config = DOCUMENT_CONTEXTS[key];
      expect(config, `Context [${key}] must be defined`).toBeDefined();
      expect(config.key).toBe(key);
      expect(config.title).toBeTruthy();
      expect(config.subtitle).toBeTruthy();
      expect(config.hintKind).toBeTruthy();
      expect(config.badgeLabel).toBeTruthy();
      expect(config.acceptedMimeTypes.length).toBeGreaterThan(0);
      expect(config.expectedFields.length).toBeGreaterThan(0);
      expect(config.samplePresets.length).toBeGreaterThan(0);
      expect(config.systemInstruction).toBeTruthy();
    }
  });

  it('ensures each expected field has key, label, type, and description', () => {
    for (const key of REQUIRED_CONTEXT_KEYS) {
      const config = DOCUMENT_CONTEXTS[key];
      const fieldKeys = new Set<string>();

      for (const field of config.expectedFields) {
        expect(field.key).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(['string', 'number', 'date', 'select']).toContain(field.type);
        expect(field.description).toBeTruthy();

        // No duplicate field keys within one context
        expect(fieldKeys.has(field.key), `Duplicate field key [${field.key}] in [${key}]`).toBe(false);
        fieldKeys.add(field.key);

        if (field.type === 'select') {
          expect(field.options).toBeDefined();
          expect(field.options?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('ensures each sample preset provides valid non-empty data matching expected fields', () => {
    for (const key of REQUIRED_CONTEXT_KEYS) {
      const config = DOCUMENT_CONTEXTS[key];
      const expectedFieldKeys = config.expectedFields.map((f) => f.key);

      for (const preset of config.samplePresets) {
        expect(preset.id).toBeTruthy();
        expect(preset.label).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(typeof preset.data).toBe('object');
        expect(Object.keys(preset.data).length).toBeGreaterThan(0);

        // At least one preset field must match expected fields
        const presetKeys = Object.keys(preset.data);
        const hasMatchingField = presetKeys.some((pk) => expectedFieldKeys.includes(pk));
        expect(
          hasMatchingField,
          `Preset [${preset.id}] in [${key}] must contain at least one field from expectedFields`
        ).toBe(true);
      }
    }
  });

  it('verifies factor_proposal specific schema and presets', () => {
    const factorConfig = DOCUMENT_CONTEXTS.factor_proposal;
    expect(factorConfig.expectedFields.some((f) => f.key === 'factorValue')).toBe(true);
    expect(factorConfig.expectedFields.some((f) => f.key === 'unit')).toBe(true);
    expect(factorConfig.expectedFields.some((f) => f.key === 'gwpBasis')).toBe(true);
    expect(factorConfig.samplePresets.some((p) => p.data.factorValue === '0.0152')).toBe(true);
  });

  it('verifies iot_meter specific schema and presets', () => {
    const meterConfig = DOCUMENT_CONTEXTS.iot_meter;
    expect(meterConfig.expectedFields.some((f) => f.key === 'hierarchyReference')).toBe(true);
    expect(meterConfig.expectedFields.some((f) => f.key === 'tolerancePercent')).toBe(true);
    expect(meterConfig.expectedFields.some((f) => f.key === 'effectiveFrom')).toBe(true);
    expect(meterConfig.samplePresets.some((p) => p.data.meterModel === 'Schneider Electric PowerLogic PM5350')).toBe(true);
  });

  it('verifies supplier_carbon specific schema and presets', () => {
    const scConfig = DOCUMENT_CONTEXTS.supplier_carbon;
    expect(scConfig.expectedFields.some((f) => f.key === 'intensityKgCo2e')).toBe(true);
    expect(scConfig.expectedFields.some((f) => f.key === 'methodologyReference')).toBe(true);
    expect(scConfig.samplePresets.some((p) => p.data.intensityKgCo2e === 2.45)).toBe(true);
  });

  it('verifies production_batch specific schema and presets', () => {
    const batchConfig = DOCUMENT_CONTEXTS.production_batch;
    expect(batchConfig.expectedFields.some((f) => f.key === 'orderReference')).toBe(true);
    expect(batchConfig.expectedFields.some((f) => f.key === 'productCode')).toBe(true);
    expect(batchConfig.expectedFields.some((f) => f.key === 'batchSize')).toBe(true);
    expect(batchConfig.samplePresets.some((p) => p.data.batchSize === 10000)).toBe(true);
  });

  it('verifies allowance_quota specific schema and presets', () => {
    const quotaConfig = DOCUMENT_CONTEXTS.allowance_quota;
    expect(quotaConfig.expectedFields.some((f) => f.key === 'quantityTco2e')).toBe(true);
    expect(quotaConfig.expectedFields.some((f) => f.key === 'vintageYear')).toBe(true);
    expect(quotaConfig.samplePresets.some((p) => p.data.quantityTco2e === 45000)).toBe(true);
  });
});

describe('base64DataUrlToFile helper', () => {
  it('correctly converts base64 PNG data URL to File object', () => {
    // 1x1 transparent PNG data URL
    const pngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const file = base64DataUrlToFile(pngDataUrl, 'test-capture.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('test-capture.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });

  it('correctly converts base64 JPEG data URL to File object with default filename', () => {
    const jpegDataUrl =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const file = base64DataUrlToFile(jpegDataUrl);

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('camera-scan.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBeGreaterThan(0);
  });
});
