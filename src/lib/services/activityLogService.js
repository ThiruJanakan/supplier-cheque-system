export async function logActivity(supabase, { userId = null, username = null, action, entityType, entityId = null, details = null }) {
  // If we have a user ID but no username, we can fetch it, but usually the caller has it from session.
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      username: username || 'admin',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ? JSON.stringify(details) : null
    });
  if (error) {
    console.error('Error logging activity:', error);
  }
}

export async function listActivity(supabase, { entityType, limit = 300 } = {}) {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data.map(row => {
    return {
      ...row,
      // Format timestamps for frontend display consistency
      created_at: new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 19),
    };
  });
}
