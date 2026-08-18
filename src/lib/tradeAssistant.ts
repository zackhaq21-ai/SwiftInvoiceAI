import type { InvoiceItem, ItemType } from './types';
import { getIndustryTemplate, type IndustryId } from './industryTemplates';

export interface SuggestedItem {
  description: string;
  quantity: number;
  unit_price: number;
  item_type: ItemType;
  unit: string;
  notes?: string | null;
  confidence: number;
}

export interface TradeSuggestion {
  items: SuggestedItem[];
  fields: Record<string, string>;
  technician?: string;
  workOrder?: string;
  warranty?: string;
  notes?: string;
}

interface TradeItemDef {
  keywords: string[];
  description: string;
  unit_price?: number;
  quantity?: number;
  unit?: string;
  item_type?: ItemType;
}


const TRADE_ITEM_LIBRARY: Record<string, TradeItemDef[]> = {
  hvac: [
    { keywords: ['furnace'], description: 'Furnace repair / diagnostic', unit_price: 250, item_type: 'service', unit: 'ea' },
    { keywords: ['ac unit', 'air conditioner', 'ac repair', 'cooling'], description: 'AC unit repair', unit_price: 320, item_type: 'service', unit: 'ea' },
    { keywords: ['capacitor'], description: 'Capacitor replacement', unit_price: 180, unit: 'ea', item_type: 'product' },
    { keywords: ['contactors', 'contactor'], description: 'Contactor replacement', unit_price: 150, unit: 'ea', item_type: 'product' },
    { keywords: ['thermostat'], description: 'Thermostat installation', unit_price: 145, unit: 'ea', item_type: 'service' },
    { keywords: ['filter', 'air filter'], description: 'Replacement air filter', unit_price: 35, unit: 'ea', item_type: 'product' },
    { keywords: ['refrigerant', 'recharge', 'freon'], description: 'Refrigerant recharge', unit_price: 200, unit: 'lb', item_type: 'product' },
    { keywords: ['coil', 'evaporator', 'condenser'], description: 'Coil cleaning / repair', unit_price: 225, unit: 'ea', item_type: 'service' },
    { keywords: ['ductwork', 'duct', 'ductless', 'mini-split'], description: 'Ductwork / mini-split service', unit_price: 400, unit: 'ea', item_type: 'service' },
    { keywords: ['heat pump'], description: 'Heat pump service', unit_price: 350, unit: 'ea', item_type: 'service' },
    { keywords: ['compressor'], description: 'Compressor replacement', unit_price: 650, unit: 'ea', item_type: 'product' },
    { keywords: ['maintenance', 'tune-up', 'tuneup', 'inspection', 'seasonal'], description: 'Seasonal maintenance / tune-up', unit_price: 120, unit: 'ea', item_type: 'service' },
    { keywords: ['labor', 'diagnostic', 'trip'], description: 'Diagnostic / service call', unit_price: 95, unit: 'hr', item_type: 'labor' },
  ],
  plumbing: [
    { keywords: ['faucet'], description: 'Faucet repair / replacement', unit_price: 165, unit: 'ea', item_type: 'service' },
    { keywords: ['toilet'], description: 'Toilet repair / installation', unit_price: 185, unit: 'ea', item_type: 'service' },
    { keywords: ['leak', 'pipe leak'], description: 'Leak repair', unit_price: 175, unit: 'ea', item_type: 'service' },
    { keywords: ['water heater'], description: 'Water heater service / replacement', unit_price: 850, unit: 'ea', item_type: 'service' },
    { keywords: ['tankless'], description: 'Tankless water heater service', unit_price: 250, unit: 'ea', item_type: 'service' },
    { keywords: ['drain', 'clog', 'snake', 'rooter'], description: 'Drain cleaning / snaking', unit_price: 195, unit: 'ea', item_type: 'service' },
    { keywords: ['garbage disposal'], description: 'Garbage disposal repair / install', unit_price: 220, unit: 'ea', item_type: 'service' },
    { keywords: ['sump pump'], description: 'Sump pump service', unit_price: 300, unit: 'ea', item_type: 'service' },
    { keywords: ['hydro-jet', 'hydrojet', 'jetting'], description: 'Hydro-jetting service', unit_price: 450, unit: 'ea', item_type: 'service' },
    { keywords: ['camera inspection', 'sewer camera'], description: 'Sewer camera inspection', unit_price: 250, unit: 'ea', item_type: 'service' },
    { keywords: ['shower valve'], description: 'Shower valve replacement', unit_price: 195, unit: 'ea', item_type: 'service' },
    { keywords: ['pex', 'pvc', 'copper pipe', 'repipe', 'pipe'], description: 'Pipe repair / replacement', unit_price: 12, unit: 'ft', item_type: 'product' },
    { keywords: ['labor', 'service call', 'trip'], description: 'Service call / labor', unit_price: 95, unit: 'hr', item_type: 'labor' },
  ],
  electrical: [
    { keywords: ['outlet', 'receptacle'], description: 'Outlet / receptacle installation', unit_price: 85, unit: 'ea', item_type: 'service' },
    { keywords: ['switch'], description: 'Switch installation', unit_price: 75, unit: 'ea', item_type: 'service' },
    { keywords: ['panel', 'breaker box', 'subpanel'], description: 'Electrical panel service', unit_price: 450, unit: 'ea', item_type: 'service' },
    { keywords: ['breaker'], description: 'Breaker replacement', unit_price: 120, unit: 'ea', item_type: 'product' },
    { keywords: ['light', 'lighting', 'fixture', 'led'], description: 'Light fixture installation', unit_price: 95, unit: 'ea', item_type: 'service' },
    { keywords: ['ceiling fan'], description: 'Ceiling fan installation', unit_price: 125, unit: 'ea', item_type: 'service' },
    { keywords: ['gfci', 'afci'], description: 'GFCI / AFCI outlet installation', unit_price: 110, unit: 'ea', item_type: 'service' },
    { keywords: ['surge'], description: 'Surge protector installation', unit_price: 280, unit: 'ea', item_type: 'service' },
    { keywords: ['generator', 'transfer switch'], description: 'Generator / transfer switch service', unit_price: 600, unit: 'ea', item_type: 'service' },
    { keywords: ['conduit', 'romex', 'wiring'], description: 'Wiring / conduit run', unit_price: 8, unit: 'ft', item_type: 'product' },
    { keywords: ['junction box'], description: 'Junction box installation', unit_price: 65, unit: 'ea', item_type: 'service' },
    { keywords: ['labor', 'service call', 'trip', 'diagnostic'], description: 'Service call / labor', unit_price: 100, unit: 'hr', item_type: 'labor' },
  ],
  construction: [
    { keywords: ['drywall', 'sheetrock'], description: 'Drywall installation / repair', unit_price: 3, unit: 'sq ft', item_type: 'service' },
    { keywords: ['painting', 'paint'], description: 'Interior painting', unit_price: 2.5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['framing'], description: 'Framing', unit_price: 5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['roof', 'roofing', 'shingle'], description: 'Roofing', unit_price: 4.5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['siding'], description: 'Siding installation', unit_price: 6, unit: 'sq ft', item_type: 'service' },
    { keywords: ['concrete'], description: 'Concrete work', unit_price: 9, unit: 'sq ft', item_type: 'service' },
    { keywords: ['deck'], description: 'Deck construction / repair', unit_price: 35, unit: 'sq ft', item_type: 'service' },
    { keywords: ['fence'], description: 'Fence installation', unit_price: 25, unit: 'ft', item_type: 'service' },
    { keywords: ['tile', 'tiling'], description: 'Tile installation', unit_price: 8, unit: 'sq ft', item_type: 'service' },
    { keywords: ['flooring'], description: 'Flooring installation', unit_price: 5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['trim', 'baseboard', 'casing'], description: 'Trim / finish carpentry', unit_price: 4, unit: 'ft', item_type: 'service' },
    { keywords: ['demolition', 'demo'], description: 'Demolition', unit_price: 2, unit: 'sq ft', item_type: 'service' },
    { keywords: ['insulation'], description: 'Insulation', unit_price: 1.5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['labor', 'crew'], description: 'Labor', unit_price: 65, unit: 'hr', item_type: 'labor' },
  ],
  landscaping: [
    { keywords: ['mowing', 'mow', 'lawn'], description: 'Lawn mowing', unit_price: 45, unit: 'lot', item_type: 'service' },
    { keywords: ['edging'], description: 'Edging', unit_price: 25, unit: 'lot', item_type: 'service' },
    { keywords: ['hedge', 'trimming', 'pruning', 'prune'], description: 'Hedge trimming / pruning', unit_price: 75, unit: 'hr', item_type: 'service' },
    { keywords: ['mulch'], description: 'Mulch installation', unit_price: 65, unit: 'lot', item_type: 'service' },
    { keywords: ['sod'], description: 'Sod installation', unit_price: 1.5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['irrigation', 'sprinkler'], description: 'Irrigation / sprinkler service', unit_price: 120, unit: 'ea', item_type: 'service' },
    { keywords: ['tree', 'arborist', 'stump'], description: 'Tree service / removal', unit_price: 400, unit: 'ea', item_type: 'service' },
    { keywords: ['weed'], description: 'Weed control', unit_price: 50, unit: 'lot', item_type: 'service' },
    { keywords: ['planting', 'flower', 'plant'], description: 'Planting / garden bed', unit_price: 35, unit: 'ea', item_type: 'service' },
    { keywords: ['retaining wall', 'paver', 'patio'], description: 'Hardscaping', unit_price: 25, unit: 'sq ft', item_type: 'service' },
    { keywords: ['leaf removal', 'leaves'], description: 'Leaf removal', unit_price: 85, unit: 'lot', item_type: 'service' },
    { keywords: ['aeration', 'aerate'], description: 'Aeration', unit_price: 90, unit: 'lot', item_type: 'service' },
    { keywords: ['fertiliz'], description: 'Fertilization', unit_price: 60, unit: 'lot', item_type: 'service' },
  ],
  automotive: [
    { keywords: ['oil change', 'oil'], description: 'Oil change', unit_price: 55, unit: 'ea', item_type: 'service' },
    { keywords: ['brake pad', 'brakes', 'brake'], description: 'Brake service', unit_price: 180, unit: 'ea', item_type: 'service' },
    { keywords: ['rotor'], description: 'Rotor replacement', unit_price: 90, unit: 'ea', item_type: 'product' },
    { keywords: ['tire', 'tires'], description: 'Tire service / replacement', unit_price: 120, unit: 'ea', item_type: 'product' },
    { keywords: ['alignment'], description: 'Wheel alignment', unit_price: 95, unit: 'ea', item_type: 'service' },
    { keywords: ['battery'], description: 'Battery replacement', unit_price: 130, unit: 'ea', item_type: 'product' },
    { keywords: ['alternator'], description: 'Alternator replacement', unit_price: 350, unit: 'ea', item_type: 'service' },
    { keywords: ['starter'], description: 'Starter replacement', unit_price: 280, unit: 'ea', item_type: 'service' },
    { keywords: ['radiator'], description: 'Radiator service', unit_price: 400, unit: 'ea', item_type: 'service' },
    { keywords: ['transmission'], description: 'Transmission service', unit_price: 150, unit: 'ea', item_type: 'service' },
    { keywords: ['spark plug', 'ignition'], description: 'Spark plug / ignition service', unit_price: 80, unit: 'ea', item_type: 'service' },
    { keywords: ['suspension', 'strut', 'shock'], description: 'Suspension / strut service', unit_price: 220, unit: 'ea', item_type: 'service' },
    { keywords: ['diagnostic', 'scan'], description: 'Diagnostic scan', unit_price: 100, unit: 'ea', item_type: 'service' },
    { keywords: ['labor'], description: 'Labor', unit_price: 95, unit: 'hr', item_type: 'labor' },
  ],
  cleaning: [
    { keywords: ['deep clean', 'deep'], description: 'Deep cleaning', unit_price: 200, unit: 'lot', item_type: 'service' },
    { keywords: ['move-out', 'move-in', 'move in', 'move out'], description: 'Move-in / move-out cleaning', unit_price: 250, unit: 'lot', item_type: 'service' },
    { keywords: ['recurring', 'regular', 'weekly', 'biweekly'], description: 'Recurring cleaning', unit_price: 120, unit: 'lot', item_type: 'service' },
    { keywords: ['carpet', 'carpet cleaning'], description: 'Carpet cleaning', unit_price: 0.3, unit: 'sq ft', item_type: 'service' },
    { keywords: ['power wash', 'pressure wash', 'powerwash'], description: 'Power washing', unit_price: 0.5, unit: 'sq ft', item_type: 'service' },
    { keywords: ['window', 'windows'], description: 'Window cleaning', unit_price: 8, unit: 'ea', item_type: 'service' },
    { keywords: ['sanitize', 'disinfect'], description: 'Sanitization / disinfection', unit_price: 150, unit: 'lot', item_type: 'service' },
    { keywords: ['office', 'commercial'], description: 'Office / commercial cleaning', unit_price: 0.15, unit: 'sq ft', item_type: 'service' },
    { keywords: ['supplies', 'products'], description: 'Cleaning supplies', unit_price: 25, unit: 'lot', item_type: 'product' },
    { keywords: ['labor'], description: 'Labor', unit_price: 45, unit: 'hr', item_type: 'labor' },
  ],
};

const GENERIC_ITEM_DEFS: TradeItemDef[] = [
  { keywords: ['labor', 'work', 'service call', 'trip charge'], description: 'Labor', unit_price: 75, unit: 'hr', item_type: 'labor' },
  { keywords: ['materials', 'parts', 'supplies'], description: 'Materials / parts', unit_price: 50, unit: 'lot', item_type: 'product' },
  { keywords: ['consultation', 'consult', 'advice'], description: 'Consultation', unit_price: 100, unit: 'hr', item_type: 'service' },
  { keywords: ['delivery', 'shipping'], description: 'Delivery', unit_price: 35, unit: 'lot', item_type: 'service' },
  { keywords: ['fee', 'service fee'], description: 'Service fee', unit_price: 50, unit: 'ea', item_type: 'service' },
  { keywords: ['deposit'], description: 'Deposit', unit_price: 200, unit: 'ea', item_type: 'service' },
];

const DEFAULT_TYPE_PRESET: Record<IndustryId, { itemType: ItemType; unit: string }> = {
  general: { itemType: 'service', unit: 'ea' },
  hvac: { itemType: 'service', unit: 'ea' },
  plumbing: { itemType: 'service', unit: 'ea' },
  electrical: { itemType: 'service', unit: 'ea' },
  construction: { itemType: 'service', unit: 'sq ft' },
  landscaping: { itemType: 'service', unit: 'lot' },
  automotive: { itemType: 'service', unit: 'ea' },
  cleaning: { itemType: 'service', unit: 'lot' },
  retail: { itemType: 'product', unit: 'ea' },
  wholesale: { itemType: 'product', unit: 'case' },
  boutique: { itemType: 'product', unit: 'ea' },
  freelance: { itemType: 'service', unit: 'hr' },
  consulting: { itemType: 'service', unit: 'hr' },
  photography: { itemType: 'service', unit: 'hr' },
  catering: { itemType: 'service', unit: 'person' },
};

export function defaultItemPresetFor(industryId: IndustryId): { itemType: ItemType; unit: string } {
  return DEFAULT_TYPE_PRESET[industryId] || DEFAULT_TYPE_PRESET.general;
}

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  refrigerant_type: [/(r-?\d{3}[a-z]?)/i, /refrigerant\s*[:#]?\s*(r-?\d{3}[a-z]?)/i],
  system_tonnage: [/(\d(?:\.\d)?)\s*-?\s*ton/i, /(\d(?:\.\d)?)\s*tons?/i],
  labor_hours: [/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\s*(?:of\s*)?(?:labor|work)?/i, /labor\s*[:#]?\s*(\d+(?:\.\d+)?)\s*hrs?/i],
  hours_worked: [/(\d+(?:\.\d+)?)\s*hrs?/i, /(\d+(?:\.\d+)?)\s*hours?/i],
  hours: [/(\d+(?:\.\d+)?)\s*hrs?/i, /(\d+(?:\.\d+)?)\s*hours?\s*(?:coverage)?/i],
  vin: [/\b([A-HJ-NPR-Z0-9]{17})\b/i],
  mileage: [/(\d[\d,]+)\s*miles?/i, /odometer\s*[:#]?\s*(\d[\d,]*)/i, /mileage\s*[:#]?\s*(\d[\d,]*)/i],
  vehicle_make: [/\b(20\d{2}|19\d{2})\s+([A-Za-z]+\s+[A-Za-z]+)/],
  permit_number: [/permit\s*(?:no|number|#)?\s*[:#]?\s*([\w-]+)/i],
  guest_count: [/(\d+)\s*guests?/i, /(\d+)\s*people/i],
  event_date: [/(?:event|shoot)\s*date\s*[:#]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i],
  shoot_date: [/(?:event|shoot)\s*date\s*[:#]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i],
  circuits_added: [/(\d+)\s*circuits?/i],
  water_pressure: [/(\d+)\s*psi/i, /pressure\s*[:#]?\s*(\d+)/i],
  area_size: [/([\d.]+)\s*(?:acres?|sq\s?ft|square\s*feet)/i],
  guest_count_alt: [/(\d+)\s*guests?/i],
};

export function extractFieldsFromText(text: string, industryId: IndustryId): Record<string, string> {
  if (!text) return {};
  const template = getIndustryTemplate(industryId);
  const result: Record<string, string> = {};
  const lower = text.toLowerCase();

  for (const field of template.customFields) {
    const patterns = FIELD_PATTERNS[field.key];
    if (!patterns) continue;
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        result[field.key] = match[1] || match[0];
        break;
      }
    }
  }

  if (result.vehicle_make) {
    const m = text.match(/\b(20\d{2}|19\d{2})\s+([A-Za-z]+\s+[A-Za-z]+)/);
    if (m) result.vehicle_make = `${m[1]} ${m[2]}`;
  }

  return result;
}

function extractQuantity(text: string, def: TradeItemDef): number {
  if (def.quantity) return def.quantity;
  const lower = text.toLowerCase();
  const keyword = def.keywords[0];
  const qtyPattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?${keyword}`, 'i');
  const match = lower.match(qtyPattern);
  if (match) return parseFloat(match[1]);
  const genericQty = lower.match(new RegExp(`${keyword}\\s*[:#]?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
  if (genericQty) return parseFloat(genericQty[1]);
  if (def.unit === 'hr' || def.unit === 'day') {
    const hrMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)/i);
    if (hrMatch) return parseFloat(hrMatch[1]);
  }
  if (def.unit === 'sq ft' || def.unit === 'ft') {
    const areaMatch = lower.match(/([\d,]+)\s*(?:sq\s?ft|square\s*feet|sqft)/i);
    if (areaMatch) return parseFloat(areaMatch[1].replace(/,/g, ''));
  }
  return 1;
}

function extractTechnician(text: string): string | undefined {
  const patterns = [
    /(?:technician|tech|mechanic|plumber|electrician|contractor|foreman|crew\s*lead|cleaner|photographer|consultant|coordinator|rep|associate|freelancer)\s*[:#]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /\b(?:by|tech|technician)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function extractWorkOrder(text: string): string | undefined {
  const patterns = [
    /(?:work\s*order|job|ro|po|project|engagement|session|event|order)\s*(?:no|number|#)?\s*[:#]?\s*([\w-]+)/i,
    /\b(wo|ro|po)-?(\d+)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1] + (m[2] ? m[2] : '') || m[0];
  }
  return undefined;
}

export function suggestFromNotes(
  notes: string,
  industryId: IndustryId,
  existingItems: InvoiceItem[] = [],
): TradeSuggestion {
  const text = notes || '';
  const lower = text.toLowerCase();
  const library = TRADE_ITEM_LIBRARY[industryId] || [];
  const defs = [...library, ...GENERIC_ITEM_DEFS];

  const suggestedItems: SuggestedItem[] = [];
  const seenDescriptions = new Set<string>();

  const existingDescs = new Set(existingItems.map(i => i.description.toLowerCase().trim()));

  for (const def of defs) {
    let matched = false;
    let bestKeyword = '';
    for (const keyword of def.keywords) {
      if (lower.includes(keyword)) {
        matched = true;
        bestKeyword = keyword;
        break;
      }
    }
    if (!matched) continue;

    const descLower = def.description.toLowerCase();
    if (seenDescriptions.has(descLower)) continue;
    if (existingDescs.has(descLower)) continue;

    const quantity = extractQuantity(text, def);
    const priceMatch = lower.match(new RegExp(`${bestKeyword}[^\\d]*(\\d+(?:\\.\\d{2})?))`, 'i'));
    const unit_price = priceMatch ? parseFloat(priceMatch[1]) : (def.unit_price || 0);

    const confidence = priceMatch ? 0.95 : 0.7;

    suggestedItems.push({
      description: def.description,
      quantity,
      unit_price,
      item_type: def.item_type || 'service',
      unit: def.unit || 'ea',
      notes: null,
      confidence,
    });
    seenDescriptions.add(descLower);
  }

  const fields = extractFieldsFromText(text, industryId);
  const technician = extractTechnician(text);
  const workOrder = extractWorkOrder(text);
  const warranty = extractWarranty(text);

  return { items: suggestedItems, fields, technician, workOrder, warranty };
}

function extractWarranty(text: string): string | undefined {
  const patterns = [
    /(\d+)[- ]?day\s*warranty[^.]*/i,
    /(\d+)[- ]?year\s*warranty[^.]*/i,
    /(\d+)[- ]?month\s*warranty[^.]*/i,
    /warranty\s*[:#]\s*([^.]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return undefined;
}

export function fullTemplateConfig(industryId: IndustryId): {
  terms: string;
  warranty: string;
  defaultUnit: string;
  defaultItemType: ItemType;
  fields: Record<string, string>;
} {
  const template = getIndustryTemplate(industryId);
  const preset = defaultItemPresetFor(industryId);
  return {
    terms: template.defaultTerms,
    warranty: template.defaultWarranty,
    defaultUnit: preset.unit,
    defaultItemType: preset.itemType,
    fields: {},
  };
}
