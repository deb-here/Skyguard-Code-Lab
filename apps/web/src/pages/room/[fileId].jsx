import { useRouter } from 'next/router';
import { useState } from 'react';
import CollabEditor from '../../components/CollabEditor';
import { supabase } from '../../lib/supabaseClient';

export default function RoomPage() {
  const router = useRouter();
  const { fileId } = router.query;
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);

  async function runCode() {
    setRunning(true);
    const { data: { session } } = await supabase.auth.getSession();
    // In a real app, pull the current buffer from the shared Y.Text
    // rather than re-reading the DOM; simplified here for brevity.
    const code = document.querySelector('.monaco-editor textarea')?.value || '';

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ fileId, code }),
    });
    setOutput(await res.json());
    setRunning(false);
  }

  if (!fileId) return null;

  return (
    <div>
      <CollabEditor fileId={fileId} />
      <button onClick={runCode} disabled={running}>
        {running ? 'Running…' : 'Run'}
      </button>
      {output && (
        <pre>{output.stdout || output.stderr || `Exit code: ${output.exit_code}`}</pre>
      )}
    </div>
  );
}
