import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import * as Y from 'yjs';

// Supabase service-role client: only this server talks to Supabase with
// elevated privileges. Never ship the service-role key to the browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// How often (ms) to snapshot + diff a document into code_history.
const HISTORY_INTERVAL_MS = 15_000;

const server = new Server({
  port: process.env.PORT || 1234,

  // --- Auth: verify the Supabase JWT the client sends when opening the socket ---
  async onAuthenticate({ token, documentName }) {
    if (!token) throw new Error('Missing auth token');

    let payload;
    try {
      payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    } catch {
      throw new Error('Invalid or expired token');
    }

    const userId = payload.sub;

    // documentName is the file/room id — check membership before allowing the join.
    const { data: membership, error } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', documentName)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !membership) throw new Error('Not authorized for this room');

    // Attach context so later hooks (onChange, onStoreDocument) know who is connected.
    return { user: { id: userId, email: payload.email } };
  },

  // --- Load existing document state from Supabase on first connection ---
  async onLoadDocument({ documentName, document }) {
    const { data: file } = await supabase
      .from('files')
      .select('current_yjs_state')
      .eq('id', documentName)
      .maybeSingle();

    if (file?.current_yjs_state) {
      const update = Buffer.from(file.current_yjs_state, 'base64');
      Y.applyUpdate(document, update);
    }
    return document;
  },

  // --- Persist on every debounced update ---
  async onStoreDocument({ documentName, document, context }) {
    const state = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64');

    await supabase
      .from('files')
      .update({ current_yjs_state: state, updated_at: new Date().toISOString() })
      .eq('id', documentName);
  },

  // --- Coarse-grained history: snapshot the doc's text periodically per room,
  // tagged with whoever is actively connected. See README for the fine-grained
  // (per-character) alternative if you need git-blame-style attribution. ---
  async onConnect({ documentName, context }) {
    if (!server.documents.get(documentName)?._historyTimer) {
      const timer = setInterval(async () => {
        const doc = server.documents.get(documentName);
        if (!doc) return clearInterval(timer);

        const text = doc.getText('monaco').toString();
        const activeUsers = [...doc.awareness.getStates().values()]
          .map((s) => s.user?.id)
          .filter(Boolean);

        if (activeUsers.length === 0) return;

        await supabase.from('code_history').insert(
          activeUsers.map((userId) => ({
            file_id: documentName,
            user_id: userId,
            snapshot: text,
          }))
        );
      }, HISTORY_INTERVAL_MS);

      const doc = server.documents.get(documentName);
      if (doc) doc._historyTimer = timer;
    }
  },
});

server.listen();
console.log(`Collab server listening on port ${process.env.PORT || 1234}`);
