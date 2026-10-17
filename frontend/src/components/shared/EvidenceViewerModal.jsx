import { useState, useEffect } from 'react';
import { ExternalLink, Download, FileText, Image as ImageIcon, FileSpreadsheet, Paperclip, Loader2, AlertCircle, X } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { useEvidence } from '../../hooks/useRoleData';
import { resourceRecordsService } from '../../services/resourceRecordsService';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRange } from '../../utils/format';
import { ApiError } from '../../services/apiClient';

export function EvidenceViewerModal({ record, initialEvidenceId, onClose }) {
  const { data: fetchedEvidence = [], isLoading: isListLoading } = useEvidence(record?.id);
  const evidenceList = fetchedEvidence;

  const [selectedId, setSelectedId] = useState(initialEvidenceId || null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Set default selected file once evidence list is loaded
  useEffect(() => {
    if (evidenceList.length > 0 && (!selectedId || !evidenceList.some((e) => e.id === selectedId))) {
      setSelectedId(evidenceList[0].id);
    }
  }, [evidenceList, selectedId]);

  const activeEvidence = evidenceList.find((e) => e.id === selectedId) || evidenceList[0];

  // Fetch blob whenever active evidence changes
  useEffect(() => {
    if (!record?.id || !activeEvidence?.id) return;

    let active = true;
    let createdUrl = null;

    setLoadingFile(true);
    setFileError(null);
    setBlobUrl(null);
    setTextContent(null);

    resourceRecordsService
      .getEvidenceBlob(record.id, activeEvidence.id)
      .then(async (rawBlob) => {
        if (!active) return;
        const mime = activeEvidence.mimeType || rawBlob.type || 'application/pdf';
        const fileBlob = new Blob([rawBlob], { type: mime });
        createdUrl = URL.createObjectURL(fileBlob);
        setBlobUrl(createdUrl);

        if (mime === 'text/csv' || mime.startsWith('text/')) {
          try {
            const text = await rawBlob.text();
            if (active) setTextContent(text);
          } catch {
            // text parse failure is non-fatal
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setFileError(err instanceof ApiError ? err.message : 'Unable to load evidence file.');
      })
      .finally(() => {
        if (active) setLoadingFile(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [record?.id, activeEvidence?.id]);

  if (!record) return null;

  const handleDownload = () => {
    if (activeEvidence) {
      resourceRecordsService.downloadEvidence(record.id, activeEvidence);
    }
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  const isPdf = activeEvidence?.mimeType === 'application/pdf' || activeEvidence?.fileName?.toLowerCase().endsWith('.pdf');
  const isImage = activeEvidence?.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(activeEvidence?.fileName || '');
  const isCsv = activeEvidence?.mimeType === 'text/csv' || activeEvidence?.fileName?.toLowerCase().endsWith('.csv');

  return (
    <Drawer
      open
      onClose={onClose}
      variant="modal"
      width={940}
      title={activeEvidence ? `Evidence: ${activeEvidence.fileName}` : 'Supporting Evidence'}
      subtitle={`${record.departmentName} · ${record.resourceTypeName} (${fmtRange(record.periodStart, record.periodEnd)})`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            <strong>Submission:</strong> {fmtNumber(record.quantity, 2)} {record.unit} · {fmtMoney(record.cost)} · Status: <strong>{record.status}</strong>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* If multiple files, allow switching between them */}
        {evidenceList.length > 1 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
            {evidenceList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`button button--sm ${item.id === activeEvidence?.id ? 'button--primary' : 'button--secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Paperclip size={13} /> {item.fileName}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar & metadata strip */}
        {activeEvidence && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {isPdf ? <FileText size={18} style={{ color: 'var(--color-danger, #ef4444)' }} /> : isImage ? <ImageIcon size={18} style={{ color: 'var(--color-primary)' }} /> : isCsv ? <FileSpreadsheet size={18} style={{ color: 'var(--color-success)' }} /> : <Paperclip size={18} />}
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{activeEvidence.fileName}</span>
              <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                ({fmtNumber(activeEvidence.fileSizeBytes / 1024, 0)} KB · Uploaded {fmtDate(activeEvidence.uploadedAt)})
              </span>
              {activeEvidence.sha256 && (
                <span
                  title={`SHA-256 Cryptographic Integrity Hash: ${activeEvidence.sha256}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--color-success)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  SHA-256: {activeEvidence.sha256.slice(0, 10)}…
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                disabled={!blobUrl || loadingFile}
                onClick={handleOpenNewTab}
                title="Open document in a separate browser tab"
              >
                Open in new tab
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={handleDownload}
                title="Download original file"
              >
                Download
              </Button>
            </div>
          </div>
        )}

        {/* Viewer display area */}
        <div style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
          {isListLoading || loadingFile ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-6)' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--color-primary)' }} />
              <p className="text-muted">Loading evidence document for review...</p>
            </div>
          ) : fileError ? (
            <div className="callout callout--danger" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Unable to preview file:</strong>
                <p style={{ margin: '4px 0 0' }}>{fileError}</p>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Button size="sm" variant="secondary" onClick={handleDownload}>
                    Try downloading instead
                  </Button>
                </div>
              </div>
            </div>
          ) : !activeEvidence ? (
            <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
              <Paperclip size={36} className="text-muted" />
              <p className="text-muted">No evidence files found for this record.</p>
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title={activeEvidence.fileName}
              style={{
                width: '100%',
                height: '64vh',
                minHeight: '480px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#ffffff',
              }}
            />
          ) : isImage && blobUrl ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '420px',
                maxHeight: '64vh',
                overflow: 'auto',
                background: 'var(--color-bg-secondary, #0f1e18)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                border: '1px solid var(--color-border)',
              }}
            >
              <img
                src={blobUrl}
                alt={activeEvidence.fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
            </div>
          ) : isCsv && textContent ? (
            <div
              style={{
                maxHeight: '64vh',
                overflow: 'auto',
                background: 'var(--color-surface)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontFamily: 'monospace',
                fontSize: 'var(--font-size-sm)',
                whiteSpace: 'pre',
              }}
            >
              {textContent}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-6)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                textAlign: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <FileSpreadsheet size={48} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)' }}>{activeEvidence.fileName}</h4>
                <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)' }}>
                  This file format ({activeEvidence.mimeType || 'binary'}) cannot be rendered inline.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <Button variant="primary" icon={Download} onClick={handleDownload}>
                  Download file to inspect
                </Button>
                {blobUrl && (
                  <Button variant="secondary" icon={ExternalLink} onClick={handleOpenNewTab}>
                    Open in browser
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
