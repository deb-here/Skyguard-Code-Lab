import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { MonacoBinding } from 'y-monaco';
import { supabase } from '../lib/supabaseClient';

// fileId doubles as the Yjs "documentName" / room id the collab
// server uses to authorize + load/persist state (see schema.sql).
export default function CollabEditor({ fileId }) {
  const editorRef = useRef(null);
  const bindingRef = useRef(null);
  const providerRef = useRef(null);
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    let ydoc;
    let provider;

    async function connect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      ydoc = new Y.Doc();
      provider = new HocuspocusProvider({
        url: process.env.NEXT_PUBLIC_COLLAB_WS_URL, // e.g. wss://collab.yourapp.com
        name: fileId,
        document: ydoc,
        token: session.access_token, // verified server-side in onAuthenticate
      });

      provider.awareness.setLocalStateField('user', {
        id: session.user.id,
        email: session.user.email,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      });

      provider.awareness.on('change', () => {
        const states = [...provider.awareness.getStates().values()];
        setConnectedUsers(states.map((s) => s.user).filter(Boolean));
      });

      providerRef.current = provider;

      if (editorRef.current) bindEditor(ydoc, provider);
    }

    connect();
    return () => {
      bindingRef.current?.destroy();
      provider?.destroy();
      ydoc?.destroy();
    };
  }, [fileId]);

  function bindEditor(ydoc, provider) {
    const yText = ydoc.getText('monaco');
    bindingRef.current = new MonacoBinding(
      yText,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );
  }

  function handleMount(editor) {
    editorRef.current = editor;
    if (providerRef.current) bindEditor(providerRef.current.document, providerRef.current);
  }

  return (
    <div>
      <div style={{ padding: '4px 8px', fontSize: 12, color: '#888' }}>
        {connectedUsers.length > 0
          ? `Online: ${connectedUsers.map((u) => u.email).join(', ')}`
          : 'Connecting…'}
      </div>
      <Editor
        height="70vh"
        defaultLanguage="python"
        theme="vs-dark"
        onMount={handleMount}
        options={{ automaticLayout: true, minimap: { enabled: false } }}
      />
    </div>
  );
}
