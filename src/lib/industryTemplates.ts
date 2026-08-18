import type { BusinessType } from './types';

export type IndustryId =
  | 'general'
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'construction'
  | 'landscaping'
  | 'automotive'
  | 'cleaning'
  | 'retail'
  | 'wholesale'
  | 'boutique'
  | 'freelance'
  | 'consulting'
  | 'photography'
  | 'catering';

export interface IndustryField {
  key: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'number' | 'date';
  full?: boolean;
  optional?: boolean;
}

export interface IndustryTemplate {
  id: IndustryId;
  label: string;
  icon: string;
  businessType: BusinessType;
  tagline: string;
  detailLabels: {
    workOrder?: string;
    technician?: string;
    notes?: string;
    warranty?: string;
    terms?: string;
  };
  customFields: IndustryField[];
  defaultTerms: string;
  defaultWarranty: string;
  defaultUnits: string[];
  detectionKeywords: string[];
}

export const INDUSTRY_TEMPLATES: Record<IndustryId, IndustryTemplate> = {
  general: {
    id: 'general',
    label: 'General',
    icon: 'FileText',
    businessType: 'other',
    tagline: 'Flexible invoice for any business',
    detailLabels: {
      workOrder: 'Work order #',
      technician: 'Technician',
      notes: 'Work Done',
      warranty: 'Warranty / Guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [],
    defaultTerms: 'Payment due within 30 days of issue.',
    defaultWarranty: '',
    defaultUnits: ['ea', 'hr', 'day', 'lot'],
    detectionKeywords: [],
  },
  hvac: {
    id: 'hvac',
    label: 'HVAC',
    icon: 'Wind',
    businessType: 'trades',
    tagline: 'Heating, cooling & refrigeration',
    detailLabels: {
      workOrder: 'Work order #',
      technician: 'HVAC technician',
      notes: 'Work performed',
      warranty: 'Equipment & labor warranty',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'equipment_installed', label: 'Equipment installed', placeholder: 'e.g. Goodman 3-ton AC unit', type: 'text', full: true },
      { key: 'refrigerant_type', label: 'Refrigerant type', placeholder: 'e.g. R-410A', type: 'text' },
      { key: 'system_tonnage', label: 'System tonnage', placeholder: 'e.g. 3 tons', type: 'text' },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 4.5', type: 'number' },
    ],
    defaultTerms: 'Payment due within 30 days of issue. Labor warranty valid for 1 year from install date.',
    defaultWarranty: '10-year parts warranty on equipment. 1-year labor warranty.',
    defaultUnits: ['ea', 'hr', 'day'],
    detectionKeywords: [
      'hvac', 'furnace', 'air conditioner', 'ac unit', 'air conditioning', 'heating',
      'cooling', 'refrigerant', 'r-410a', 'r-22', 'compressor', 'condenser', 'evaporator',
      'thermostat', 'ductwork', 'ductless', 'mini-split', 'heat pump', 'ton ac', 'ton unit',
      'goodman', 'carrier', 'trane', 'lennox', 'rheem', 'ruud', 'york', 'american standard',
      'air handler', 'coil', 'capacitor', 'contactors',
    ],
  },
  plumbing: {
    id: 'plumbing',
    label: 'Plumbing',
    icon: 'Wrench',
    businessType: 'trades',
    tagline: 'Pipes, fixtures & water systems',
    detailLabels: {
      workOrder: 'Job #',
      technician: 'Plumber',
      notes: 'Work performed',
      warranty: 'Warranty / Guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'fixtures_installed', label: 'Fixtures installed', placeholder: 'e.g. Moen kitchen faucet, Kohler toilet', type: 'text', full: true },
      { key: 'pipe_material', label: 'Pipe material', placeholder: 'e.g. PEX, PVC, copper', type: 'text' },
      { key: 'pipe_size', label: 'Pipe size', placeholder: 'e.g. 1/2"', type: 'text' },
      { key: 'water_heater_details', label: 'Water heater details', placeholder: 'e.g. Rheem 50-gal gas', type: 'text', full: true },
      { key: 'water_pressure', label: 'Water pressure (psi)', placeholder: 'e.g. 65', type: 'number', optional: true },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 3', type: 'number' },
    ],
    defaultTerms: 'Payment due within 30 days of issue.',
    defaultWarranty: '1-year warranty on labor. Manufacturer warranty on fixtures.',
    defaultUnits: ['ea', 'hr', 'ft', 'lot'],
    detectionKeywords: [
      'plumb', 'pipe', 'faucet', 'toilet', 'sink', 'drain', 'leak', 'water heater',
      'tankless', 'garbage disposal', 'sewer', 'septic', 'sump pump', 'shower valve',
      'pex', 'pvc', 'copper pipe', 'cpvc', 'abs pipe', 'trap', 'flange', 'wax ring',
      'moen', 'kohler', 'delta', 'american standard', 'rinnai', 'navien', 'ao smith',
      'hydro-jet', 'snake', 'camera inspection', 'backflow',
    ],
  },
  electrical: {
    id: 'electrical',
    label: 'Electrical',
    icon: 'Zap',
    businessType: 'trades',
    tagline: 'Wiring, panels & lighting',
    detailLabels: {
      workOrder: 'Job #',
      technician: 'Electrician',
      notes: 'Work performed',
      warranty: 'Warranty / Guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'panel_details', label: 'Panel details', placeholder: 'e.g. 200A main, Square D', type: 'text', full: true },
      { key: 'wiring_type', label: 'Wiring type', placeholder: 'e.g. 12/2 Romex', type: 'text' },
      { key: 'fixtures_installed', label: 'Fixtures installed', placeholder: 'e.g. 6 LED recessed lights', type: 'text', full: true },
      { key: 'circuits_added', label: 'Circuits added', placeholder: 'e.g. 2', type: 'number' },
      { key: 'voltage', label: 'Voltage', placeholder: 'e.g. 120V', type: 'text', optional: true },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 5', type: 'number' },
    ],
    defaultTerms: 'Payment due within 30 days of issue.',
    defaultWarranty: '1-year warranty on labor and materials.',
    defaultUnits: ['ea', 'hr', 'ft', 'lot'],
    detectionKeywords: [
      'electric', 'wiring', 'panel', 'breaker', 'outlet', 'receptacle', 'switch',
      'light', 'lighting', 'fixture', 'led', 'ceiling fan', 'gfci', 'afci', 'surge',
      'generator', 'transfer switch', 'conduit', 'romex', 'junction box', 'meter base',
      'amp', 'voltage', '120v', '240v', 'circuit', 'grounding', 'ground rod',
      'square d', 'siemens', 'leviton', 'lutron',
    ],
  },
  construction: {
    id: 'construction',
    label: 'Construction',
    icon: 'HardHat',
    businessType: 'trades',
    tagline: 'Building, remodeling & contracting',
    detailLabels: {
      workOrder: 'Job #',
      technician: 'Contractor / foreman',
      notes: 'Work performed',
      warranty: 'Warranty / Guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'project_scope', label: 'Project scope', placeholder: 'e.g. Kitchen remodel — demo through finish', type: 'text', full: true },
      { key: 'materials_supplied', label: 'Materials supplied', placeholder: 'e.g. Drywall, paint, trim, tile', type: 'text', full: true },
      { key: 'permit_number', label: 'Permit number', placeholder: 'e.g. BLD-2026-0451', type: 'text' },
      { key: 'inspection_date', label: 'Inspection date', type: 'date', optional: true },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 40', type: 'number' },
      { key: 'site_address', label: 'Site address', placeholder: 'e.g. 123 Main St, Springfield', type: 'text', full: true, optional: true },
    ],
    defaultTerms: '50% deposit due upon contract signing. Balance due within 30 days of completion.',
    defaultWarranty: '1-year warranty on workmanship. Manufacturer warranties on materials.',
    defaultUnits: ['ea', 'hr', 'day', 'sq ft', 'ft', 'lot'],
    detectionKeywords: [
      'construction', 'remodel', 'renovation', 'build', 'framing', 'drywall', 'sheetrock',
      'roof', 'roofing', 'siding', 'concrete', 'foundation', 'deck', 'fence', 'masonry',
      'tiling', 'flooring', 'painting', 'contractor', 'foreman', 'permit', 'inspection',
      'demolition', 'carpentry', 'insulation', 'stucco', 'gutter',
    ],
  },
  landscaping: {
    id: 'landscaping',
    label: 'Landscaping',
    icon: 'Trees',
    businessType: 'trades',
    tagline: 'Lawn, garden & outdoor services',
    detailLabels: {
      workOrder: 'Job #',
      technician: 'Crew lead',
      notes: 'Work performed',
      warranty: 'Warranty / Guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'services_performed', label: 'Services performed', placeholder: 'e.g. Mowing, edging, hedge trimming', type: 'text', full: true },
      { key: 'plants_materials', label: 'Plants / materials', placeholder: 'e.g. 5 boxwoods, 2 yards mulch', type: 'text', full: true },
      { key: 'area_size', label: 'Area size', placeholder: 'e.g. 1.2 acres', type: 'text', optional: true },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 6', type: 'number' },
    ],
    defaultTerms: 'Payment due within 15 days of service.',
    defaultWarranty: 'Plants guaranteed for 90 days with proper care.',
    defaultUnits: ['ea', 'hr', 'day', 'sq ft', 'lot'],
    detectionKeywords: [
      'landscap', 'lawn', 'mowing', 'mow', 'garden', 'hedge', 'trimming', 'mulch',
      'sod', 'irrigation', 'sprinkler', 'tree', 'arborist', 'stump', 'weed', 'pruning',
      'planting', 'flower bed', 'retaining wall', 'paver', 'patio', 'drainage',
      'leaf removal', 'aeration', 'fertiliz',
    ],
  },
  automotive: {
    id: 'automotive',
    label: 'Automotive',
    icon: 'Car',
    businessType: 'services',
    tagline: 'Auto repair & maintenance',
    detailLabels: {
      workOrder: 'RO #',
      technician: 'Mechanic',
      notes: 'Work performed',
      warranty: 'Warranty / Guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'vehicle_make', label: 'Vehicle make / model', placeholder: 'e.g. 2018 Honda Civic', type: 'text', full: true },
      { key: 'vin', label: 'VIN', placeholder: 'e.g. 1HGBH41JXMN109186', type: 'text' },
      { key: 'mileage', label: 'Mileage', placeholder: 'e.g. 87,500', type: 'text' },
      { key: 'license_plate', label: 'License plate', placeholder: 'e.g. ABC-1234', type: 'text', optional: true },
      { key: 'parts_replaced', label: 'Parts replaced', placeholder: 'e.g. Front brake pads, rotors', type: 'text', full: true },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 2.5', type: 'number' },
    ],
    defaultTerms: 'Payment due upon vehicle pickup.',
    defaultWarranty: '12-month / 12,000-mile warranty on parts and labor.',
    defaultUnits: ['ea', 'hr'],
    detectionKeywords: [
      'auto', 'car', 'vehicle', 'mechanic', 'repair', 'brake', 'brakes', 'oil change',
      'transmission', 'engine', 'tire', 'alignment', 'battery', 'alternator', 'starter',
      'radiator', 'exhaust', 'muffler', 'catalytic converter', 'spark plug', 'ignition',
      'suspension', 'strut', 'shock', 'rotor', 'caliper', 'diagnostic', 'scan',
      'vin', 'odometer', 'mileage', 'dealership', 'shop',
    ],
  },
  cleaning: {
    id: 'cleaning',
    label: 'Cleaning',
    icon: 'Sparkles',
    businessType: 'services',
    tagline: 'Residential & commercial cleaning',
    detailLabels: {
      workOrder: 'Job #',
      technician: 'Cleaner',
      notes: 'Services performed',
      warranty: 'Satisfaction guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'service_type', label: 'Service type', placeholder: 'e.g. Deep clean, move-out, recurring', type: 'text', full: true },
      { key: 'area_cleaned', label: 'Area cleaned', placeholder: 'e.g. 2,000 sq ft, 3 bed / 2 bath', type: 'text', full: true },
      { key: 'supplies_provided', label: 'Supplies provided', placeholder: 'e.g. All cleaning products included', type: 'text', full: true, optional: true },
      { key: 'labor_hours', label: 'Labor hours', placeholder: 'e.g. 5', type: 'number' },
    ],
    defaultTerms: 'Payment due within 7 days of service.',
    defaultWarranty: '100% satisfaction guaranteed — we will re-clean any area within 48 hours.',
    defaultUnits: ['ea', 'hr', 'sq ft', 'lot'],
    detectionKeywords: [
      'clean', 'cleaning', 'janitorial', 'maid', 'housekeeping', 'deep clean',
      'move-out', 'move-in', 'carpet cleaning', 'power wash', 'pressure wash',
      'window cleaning', 'sanitize', 'disinfect', 'office cleaning',
    ],
  },
  retail: {
    id: 'retail',
    label: 'Retail',
    icon: 'ShoppingBag',
    businessType: 'retail',
    tagline: 'Product sales & retail stores',
    detailLabels: {
      workOrder: 'Order #',
      technician: 'Sales associate',
      notes: 'Order notes',
      warranty: 'Return policy',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'payment_method', label: 'Payment method', placeholder: 'Cash, card, online', type: 'text', optional: true },
      { key: 'shipping_method', label: 'Shipping / pickup', placeholder: 'In-store pickup', type: 'text', optional: true },
    ],
    defaultTerms: 'All sales final. Returns accepted within 14 days with receipt.',
    defaultWarranty: '',
    defaultUnits: ['ea', 'box', 'set', 'lot'],
    detectionKeywords: [
      'retail', 'store', 'shop', 'sale', 'product', 'merchandise', 'inventory',
      'customer purchase', 'sold', 'sku', 'barcode',
    ],
  },
  wholesale: {
    id: 'wholesale',
    label: 'Wholesale',
    icon: 'Package',
    businessType: 'wholesale',
    tagline: 'Bulk sales & distribution',
    detailLabels: {
      workOrder: 'PO #',
      technician: 'Account rep',
      notes: 'Order notes',
      warranty: 'Return policy',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'po_number', label: 'Customer PO #', placeholder: 'PO-2026-0156', type: 'text' },
      { key: 'delivery_date', label: 'Delivery date', type: 'date', optional: true },
      { key: 'shipping_terms', label: 'Shipping terms', placeholder: 'FOB destination', type: 'text', optional: true },
    ],
    defaultTerms: 'Net 30. 1.5% discount if paid within 10 days.',
    defaultWarranty: '',
    defaultUnits: ['ea', 'box', 'case', 'pallet', 'kg', 'lb'],
    detectionKeywords: [
      'wholesale', 'bulk', 'distributor', 'distribution', 'supplier', 'purchase order',
      'po number', 'net 30', 'case', 'pallet', 'freight', 'b2b',
    ],
  },
  boutique: {
    id: 'boutique',
    label: 'Boutique',
    icon: 'Shirt',
    businessType: 'boutique',
    tagline: 'Fashion & specialty retail',
    detailLabels: {
      workOrder: 'Order #',
      technician: 'Associate',
      notes: 'Order notes',
      warranty: 'Return policy',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'size_info', label: 'Size / fit notes', placeholder: 'M, tailored length', type: 'text', optional: true, full: true },
      { key: 'payment_method', label: 'Payment method', placeholder: 'Card, cash', type: 'text', optional: true },
    ],
    defaultTerms: 'Returns accepted within 14 days with tags attached.',
    defaultWarranty: '',
    defaultUnits: ['ea', 'set'],
    detectionKeywords: [
      'boutique', 'fashion', 'clothing', 'apparel', 'dress', 'shirt', 'garment',
      'accessories', 'jewelry', 'size', 'tailor', 'alteration',
    ],
  },
  freelance: {
    id: 'freelance',
    label: 'Freelance',
    icon: 'Laptop',
    businessType: 'services',
    tagline: 'Design, writing & creative work',
    detailLabels: {
      workOrder: 'Project #',
      technician: 'Freelancer',
      notes: 'Work delivered',
      warranty: 'Revisions policy',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'project_name', label: 'Project name', placeholder: 'e.g. Brand identity design', type: 'text', full: true },
      { key: 'deliverables', label: 'Deliverables', placeholder: 'e.g. Logo, brand guide, 3 mockups', type: 'text', full: true },
      { key: 'hours_worked', label: 'Hours worked', placeholder: 'e.g. 24', type: 'number' },
      { key: 'revision_rounds', label: 'Revision rounds', placeholder: 'e.g. 2 of 3 used', type: 'text', optional: true },
    ],
    defaultTerms: '50% deposit due before work begins. Balance due within 15 days of delivery.',
    defaultWarranty: 'Includes 2 rounds of revisions. Additional revisions billed at hourly rate.',
    defaultUnits: ['hr', 'day', 'lot', 'ea'],
    detectionKeywords: [
      'freelance', 'freelancer', 'design', 'designer', 'graphic design', 'logo',
      'branding', 'website', 'web design', 'development', 'developer', 'writing',
      'copywriting', 'content', 'creative', 'illustration', 'ui ux', 'project',
      'deliverables', 'client', 'portfolio', 'fiverr', 'upwork',
    ],
  },
  consulting: {
    id: 'consulting',
    label: 'Consulting',
    icon: 'Briefcase',
    businessType: 'services',
    tagline: 'Professional advisory services',
    detailLabels: {
      workOrder: 'Engagement #',
      technician: 'Consultant',
      notes: 'Services rendered',
      warranty: 'Engagement terms',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'engagement_type', label: 'Engagement type', placeholder: 'e.g. Strategy audit, monthly retainer', type: 'text', full: true },
      { key: 'period_covered', label: 'Period covered', placeholder: 'e.g. July 2026', type: 'text' },
      { key: 'hours_billed', label: 'Hours billed', placeholder: 'e.g. 40', type: 'number' },
      { key: 'rate', label: 'Hourly rate', placeholder: 'e.g. 200', type: 'number', optional: true },
    ],
    defaultTerms: 'Payment due within 30 days of issue.',
    defaultWarranty: '',
    defaultUnits: ['hr', 'day', 'lot'],
    detectionKeywords: [
      'consult', 'consulting', 'consultant', 'advisory', 'strategy', 'audit',
      'retainer', 'engagement', 'professional services', 'coaching', 'mentor',
    ],
  },
  photography: {
    id: 'photography',
    label: 'Photography',
    icon: 'Camera',
    businessType: 'services',
    tagline: 'Photo sessions & events',
    detailLabels: {
      workOrder: 'Session #',
      technician: 'Photographer',
      notes: 'Session details',
      warranty: 'Usage rights',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'shoot_type', label: 'Shoot type', placeholder: 'e.g. Wedding, portrait, event', type: 'text', full: true },
      { key: 'shoot_date', label: 'Shoot date', type: 'date' },
      { key: 'location', label: 'Location', placeholder: 'e.g. Riverside Park, Springfield', type: 'text', full: true, optional: true },
      { key: 'deliverables', label: 'Deliverables', placeholder: 'e.g. 50 edited photos, online gallery', type: 'text', full: true },
      { key: 'hours', label: 'Hours coverage', placeholder: 'e.g. 6', type: 'number' },
    ],
    defaultTerms: '50% deposit to reserve date. Balance due on delivery of photos.',
    defaultWarranty: 'Personal print and social media rights included. Commercial use requires separate license.',
    defaultUnits: ['hr', 'day', 'ea', 'lot'],
    detectionKeywords: [
      'photo', 'photograph', 'photographer', 'photography', 'shoot', 'session',
      'wedding', 'portrait', 'event coverage', 'camera', 'lens', 'editing',
      'gallery', 'prints', 'studio',
    ],
  },
  catering: {
    id: 'catering',
    label: 'Catering',
    icon: 'Utensils',
    businessType: 'services',
    tagline: 'Food service & events',
    detailLabels: {
      workOrder: 'Event #',
      technician: 'Event coordinator',
      notes: 'Service details',
      warranty: 'Satisfaction guarantee',
      terms: 'Terms & Conditions',
    },
    customFields: [
      { key: 'event_type', label: 'Event type', placeholder: 'e.g. Wedding, corporate lunch, party', type: 'text', full: true },
      { key: 'event_date', label: 'Event date', type: 'date' },
      { key: 'guest_count', label: 'Guest count', placeholder: 'e.g. 75', type: 'number' },
      { key: 'menu_summary', label: 'Menu summary', placeholder: 'e.g. Buffet: chicken, pasta, salad, dessert', type: 'text', full: true },
      { key: 'service_staff', label: 'Service staff', placeholder: 'e.g. 3 servers, 1 chef', type: 'text', optional: true },
    ],
    defaultTerms: '50% deposit due to reserve date. Final headcount due 7 days before event. Balance due day of event.',
    defaultWarranty: '',
    defaultUnits: ['ea', 'person', 'lot', 'tray'],
    detectionKeywords: [
      'cater', 'catering', 'food', 'event', 'wedding catering', 'buffet', 'menu',
      'guest', 'plate', 'tray', 'chef', 'server', 'banquet', 'corporate lunch',
      'party', 'rehearsal dinner',
    ],
  },
};

export const INDUSTRY_LIST: IndustryTemplate[] = Object.values(INDUSTRY_TEMPLATES);

export function getIndustryTemplate(id: IndustryId | string | null | undefined): IndustryTemplate {
  if (id && id in INDUSTRY_TEMPLATES) return INDUSTRY_TEMPLATES[id as IndustryId];
  return INDUSTRY_TEMPLATES.general;
}

export function detectIndustry(text: string): IndustryId {
  if (!text) return 'general';
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const template of INDUSTRY_LIST) {
    if (template.id === 'general') continue;
    let score = 0;
    for (const keyword of template.detectionKeywords) {
      if (lower.includes(keyword)) {
        score += keyword.length > 6 ? 2 : 1;
      }
    }
    if (score > 0) scores[template.id] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0 || sorted[0][1] < 2) return 'general';
  return sorted[0][0] as IndustryId;
}

export function detectIndustryFromItems(
  descriptions: string[],
  notes: string,
  technician: string,
  workOrder: string,
): IndustryId {
  const combined = [notes, technician, workOrder, ...descriptions].join(' ');
  return detectIndustry(combined);
}

export function extractIndustryFields(text: string, template: IndustryTemplate): Record<string, string> {
  if (!text) return {};
  const result: Record<string, string> = {};
  const lower = text.toLowerCase();

  const fieldPatterns: Record<string, RegExp[]> = {
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
  };

  for (const field of template.customFields) {
    const patterns = fieldPatterns[field.key];
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
