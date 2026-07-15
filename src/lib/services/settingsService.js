export async function getSetting(supabase, key) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) return null;
  return data ? data.value : null;
}

export async function setSetting(supabase, key, value) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value: String(value) });
  if (error) throw new Error(error.message);
}

export async function getAllSettings(supabase) {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value');
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}
