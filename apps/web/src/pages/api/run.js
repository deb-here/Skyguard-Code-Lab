import { createClient } from '@supabase/supabase-js';

// Server-side only: keep the sandbox and service-role key off the client.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId, code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const runRes = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'python',
      version: '3.10.0',
      files: [{ content: code }],
    }),
  });
  const result = await runRes.json();

  await supabaseAdmin.from('run_results').insert({
    file_id: fileId,
    user_id: user.id,
    stdout: result.run?.stdout,
    stderr: result.run?.stderr,
    exit_code: result.run?.code,
  });

  res.status(200).json({
    stdout: result.run?.stdout,
    stderr: result.run?.stderr,
    exit_code: result.run?.code,
  });
}
