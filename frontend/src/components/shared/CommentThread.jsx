import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useComments, usePostComment } from '../../hooks/useCollaboration';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../services/apiClient';
import { ORG_ROLE_LABELS } from '../../constants/roles';
import { fmtDateTime } from '../../utils/format';
import { TextArea } from '../ui/FormField';
import { Button } from '../ui/Button';
import './shared.css';

const MAX = 1000;

/**
 * The conversation on one record, report or amendment. The server decides who may read or post
 * (the same people who can already see the item), so this component just renders what it is given.
 * entityType: 'resource_record' | 'report' | 'amendment'
 */
export function CommentThread({ entityType, entityId }) {
  const { data: comments = [], isLoading, isError } = useComments(entityType, entityId);
  const post = usePostComment(entityType, entityId);
  const { showToast } = useToast();
  const [text, setText] = useState('');

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      await post.mutateAsync(body);
      setText('');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not post the comment.', 'error');
    }
  };

  return (
    <section aria-label="Comments">
      <h3 className="section-title inline-icon" style={{ gap: 8, alignItems: 'center' }}>
        <MessageSquare size={16} aria-hidden="true" /> Comments{comments.length ? ` (${comments.length})` : ''}
      </h3>

      {isLoading && <p className="text-muted">Loading comments…</p>}
      {isError && <p className="text-muted">Comments could not be loaded.</p>}
      {!isLoading && !isError && comments.length === 0 && <p className="text-muted">No comments yet. Ask a question or leave a note for the next person.</p>}

      {comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment__meta">
                <strong>{c.authorName}</strong>
                <span className="text-muted"> · {ORG_ROLE_LABELS[c.authorRole] ?? c.authorRole} · {fmtDateTime(c.createdAt)}</span>
              </div>
              <p className="comment__body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
        <TextArea rows={2} maxLength={MAX} placeholder="Write a comment…" aria-label="New comment" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{text.length}/{MAX} · visible to everyone who can open this item; comments can't be edited.</span>
          <Button size="sm" icon={Send} onClick={send} loading={post.isPending} disabled={!text.trim()}>Post</Button>
        </div>
      </div>
    </section>
  );
}
