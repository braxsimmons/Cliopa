import { supabase } from '@/integrations/supabase/client';

export type AuditDimension =
  | 'compliance'
  | 'accuracy'
  | 'communication'
  | 'resolution'
  | 'empathy'
  | 'tone';

export interface AuditCriterion {
  id: string;
  name: string;
  description: string;
  dimension: AuditDimension;
  weight: number;
}

export interface AuditTemplate {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  criteria: AuditCriterion[];
  created_at: string;
  updated_at: string;
}

export interface AuditTemplateInsert {
  name: string;
  description?: string;
  is_default?: boolean;
  criteria: AuditCriterion[];
}

export interface AuditTemplateUpdate {
  name?: string;
  description?: string;
  is_default?: boolean;
  criteria?: AuditCriterion[];
}

// Get all audit templates
export async function getAuditTemplates(): Promise<{
  templates: AuditTemplate[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('audit_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;

    return { templates: (data as AuditTemplate[]) || [], error: null };
  } catch (error) {
    console.error('Error fetching audit templates:', error);
    return { templates: [], error: error as Error };
  }
}

// Get a single audit template by ID
export async function getAuditTemplateById(id: string): Promise<{
  template: AuditTemplate | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('audit_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { template: data as AuditTemplate, error: null };
  } catch (error) {
    console.error('Error fetching audit template:', error);
    return { template: null, error: error as Error };
  }
}

// Get the default audit template
export async function getDefaultTemplate(): Promise<{
  template: AuditTemplate | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('audit_templates')
      .select('*')
      .eq('is_default', true)
      .single();

    if (error) throw error;

    return { template: data as AuditTemplate, error: null };
  } catch (error) {
    console.error('Error fetching default template:', error);
    return { template: null, error: error as Error };
  }
}

// Create a new audit template
export async function createAuditTemplate(template: AuditTemplateInsert): Promise<{
  template: AuditTemplate | null;
  error: Error | null;
}> {
  try {
    // If this is set as default, unset other defaults first
    if (template.is_default) {
      await supabase
        .from('audit_templates')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('audit_templates')
      .insert({
        name: template.name,
        description: template.description || null,
        is_default: template.is_default || false,
        criteria: template.criteria as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    if (error) throw error;

    return { template: data as AuditTemplate, error: null };
  } catch (error) {
    console.error('Error creating audit template:', error);
    return { template: null, error: error as Error };
  }
}

// Update an audit template
export async function updateAuditTemplate(
  id: string,
  updates: AuditTemplateUpdate
): Promise<{
  template: AuditTemplate | null;
  error: Error | null;
}> {
  try {
    // If setting as default, unset other defaults first
    if (updates.is_default) {
      await supabase
        .from('audit_templates')
        .update({ is_default: false })
        .neq('id', id)
        .eq('is_default', true);
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.is_default !== undefined) updateData.is_default = updates.is_default;
    if (updates.criteria !== undefined) updateData.criteria = updates.criteria;

    const { data, error } = await supabase
      .from('audit_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { template: data as AuditTemplate, error: null };
  } catch (error) {
    console.error('Error updating audit template:', error);
    return { template: null, error: error as Error };
  }
}

// Delete an audit template
export async function deleteAuditTemplate(id: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  try {
    const { error } = await supabase
      .from('audit_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting audit template:', error);
    return { success: false, error: error as Error };
  }
}

// Duplicate an audit template
export async function duplicateAuditTemplate(id: string, newName: string): Promise<{
  template: AuditTemplate | null;
  error: Error | null;
}> {
  try {
    const { template: original, error: fetchError } = await getAuditTemplateById(id);
    if (fetchError || !original) {
      throw fetchError || new Error('Template not found');
    }

    const { data, error } = await supabase
      .from('audit_templates')
      .insert({
        name: newName,
        description: original.description ? `Copy of: ${original.description}` : null,
        is_default: false,
        criteria: original.criteria as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    if (error) throw error;

    return { template: data as AuditTemplate, error: null };
  } catch (error) {
    console.error('Error duplicating audit template:', error);
    return { template: null, error: error as Error };
  }
}

// Get dimension color for UI
export function getDimensionColor(dimension: AuditDimension): string {
  const colors: Record<AuditDimension, string> = {
    compliance: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    accuracy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    communication: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    resolution: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    empathy: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    tone: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };
  return colors[dimension] || 'bg-gray-100 text-gray-800';
}

// Get all available dimensions
export function getAvailableDimensions(): { value: AuditDimension; label: string }[] {
  return [
    { value: 'compliance', label: 'Compliance' },
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'communication', label: 'Communication' },
    { value: 'resolution', label: 'Resolution' },
    { value: 'empathy', label: 'Empathy' },
    { value: 'tone', label: 'Tone' },
  ];
}

// Bulk import templates from JSON
export async function bulkImportTemplates(templates: AuditTemplateInsert[]): Promise<{
  imported: number;
  errors: { index: number; name: string; error: string }[];
}> {
  const results = {
    imported: 0,
    errors: [] as { index: number; name: string; error: string }[],
  };

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    try {
      // Validate template
      if (!template.name?.trim()) {
        results.errors.push({ index: i, name: template.name || 'Unknown', error: 'Template name is required' });
        continue;
      }
      if (!template.criteria || template.criteria.length === 0) {
        results.errors.push({ index: i, name: template.name, error: 'At least one criterion is required' });
        continue;
      }

      // Validate criteria
      const criteriaIds = template.criteria.map(c => c.id);
      const duplicateIds = criteriaIds.filter((id, idx) => criteriaIds.indexOf(id) !== idx);
      if (duplicateIds.length > 0) {
        results.errors.push({ index: i, name: template.name, error: `Duplicate criterion IDs: ${duplicateIds.join(', ')}` });
        continue;
      }

      // Create template (never set as default during bulk import)
      const { error } = await createAuditTemplate({
        ...template,
        is_default: false,
      });

      if (error) {
        results.errors.push({ index: i, name: template.name, error: error.message });
      } else {
        results.imported++;
      }
    } catch (err) {
      results.errors.push({ index: i, name: template.name, error: (err as Error).message });
    }
  }

  return results;
}

// Export templates to JSON format
export function exportTemplatesToJSON(templates: AuditTemplate[]): string {
  const exportData = templates.map(t => ({
    name: t.name,
    description: t.description,
    is_default: t.is_default,
    criteria: t.criteria,
  }));
  return JSON.stringify(exportData, null, 2);
}

// Export templates to CSV format (flattened)
export function exportTemplatesToCSV(templates: AuditTemplate[]): string {
  const headers = [
    'template_name',
    'template_description',
    'is_default',
    'criterion_id',
    'criterion_name',
    'criterion_description',
    'criterion_dimension',
    'criterion_weight',
  ];

  const rows: string[][] = [headers];

  templates.forEach(template => {
    template.criteria.forEach((criterion, idx) => {
      rows.push([
        idx === 0 ? template.name : '',
        idx === 0 ? template.description || '' : '',
        idx === 0 ? template.is_default.toString() : '',
        criterion.id,
        criterion.name,
        criterion.description,
        criterion.dimension,
        criterion.weight.toString(),
      ]);
    });
  });

  return rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

// Parse CSV import for templates
export function parseTemplatesFromCSV(csvContent: string): {
  templates: AuditTemplateInsert[];
  errors: string[];
} {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const errors: string[] = [];
  const templatesMap = new Map<string, AuditTemplateInsert>();

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);

    if (columns.length < 8) {
      errors.push(`Row ${i + 1}: Invalid number of columns (expected 8, got ${columns.length})`);
      continue;
    }

    const [
      templateName,
      templateDescription,
      isDefault,
      criterionId,
      criterionName,
      criterionDescription,
      criterionDimension,
      criterionWeight,
    ] = columns;

    // Start new template or add to existing
    const name = templateName.trim() || Array.from(templatesMap.keys()).pop() || '';
    if (!name) {
      errors.push(`Row ${i + 1}: No template name found`);
      continue;
    }

    if (!templatesMap.has(name)) {
      templatesMap.set(name, {
        name,
        description: templateDescription.trim() || undefined,
        is_default: isDefault.toLowerCase() === 'true',
        criteria: [],
      });
    }

    // Validate dimension
    const validDimensions: AuditDimension[] = ['compliance', 'accuracy', 'communication', 'resolution', 'empathy', 'tone'];
    const dimension = criterionDimension.trim().toLowerCase() as AuditDimension;
    if (!validDimensions.includes(dimension)) {
      errors.push(`Row ${i + 1}: Invalid dimension "${criterionDimension}". Valid options: ${validDimensions.join(', ')}`);
      continue;
    }

    // Add criterion
    const template = templatesMap.get(name)!;
    template.criteria.push({
      id: criterionId.trim().toUpperCase().replace(/\s+/g, '_'),
      name: criterionName.trim(),
      description: criterionDescription.trim(),
      dimension,
      weight: parseFloat(criterionWeight) || 1.0,
    });
  }

  return {
    templates: Array.from(templatesMap.values()),
    errors,
  };
}

// Helper to parse CSV line respecting quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// Generate CSV template for download
export function generateCSVTemplate(): string {
  const headers = [
    'template_name',
    'template_description',
    'is_default',
    'criterion_id',
    'criterion_name',
    'criterion_description',
    'criterion_dimension',
    'criterion_weight',
  ];

  const exampleRows = [
    ['Collections Audit Template', 'Standard audit for collections calls', 'false', 'VCI', 'Verify Customer Identity', 'Agent verifies customer name and account number', 'compliance', '1.0'],
    ['', '', '', 'QQ', 'Qualifying Questions', 'Agent asks qualifying questions about the situation', 'communication', '1.0'],
    ['', '', '', 'EMPATHY', 'Empathy Displayed', 'Agent shows understanding and empathy', 'empathy', '1.5'],
    ['Sales Audit Template', 'Audit for sales calls', 'false', 'GREETING', 'Professional Greeting', 'Agent greets customer professionally', 'communication', '1.0'],
  ];

  return [headers, ...exampleRows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}
