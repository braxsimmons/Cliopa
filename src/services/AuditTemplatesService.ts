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
