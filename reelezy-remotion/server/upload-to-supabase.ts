import fs from 'node:fs';

export async function uploadRenderToSupabase(filePath: string, userId: string, renderId: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const fileName = `${userId}/renders/${renderId}.mp4`;
  const fileBuffer = fs.readFileSync(filePath);

  // Upload using raw fetch — no WebSocket dependency
  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/video-uploads/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body: fileBuffer,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Supabase upload failed: ${err}`);
  }

  // Generate signed URL using raw fetch
  const signRes = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/video-uploads/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 31536000 }),
    }
  );

  if (!signRes.ok) {
    const err = await signRes.text();
    throw new Error(`Failed to create signed URL: ${err}`);
  }

  const { signedURL } = await signRes.json();
  return `${supabaseUrl}/storage/v1${signedURL}`;
}
