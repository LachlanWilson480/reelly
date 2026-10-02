import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

export async function uploadRenderToSupabase(filePath: string, userId: string, renderId: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fileName = `${userId}/renders/${renderId}.mp4`;
  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from('video-uploads')
    .upload(fileName, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  // Generate a signed URL valid for 1 year (31536000 seconds)
  const { data: signedData, error: signError } = await supabase.storage
    .from('video-uploads')
    .createSignedUrl(fileName, 31536000);

  if (signError || !signedData) throw new Error(`Failed to create signed URL: ${signError?.message}`);

  return signedData.signedUrl;
}
