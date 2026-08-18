import { useState, useRef, useCallback } from 'react';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface LogoUploadProps {
  value: string;
  onChange: (url: string) => void;
  accent: string;
}

const MAX_SIZE = 2 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];

export default function LogoUpload({ value, onChange, accent }: LogoUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      setError('Sign in to upload a logo.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File is too large. Maximum size is 2 MB.');
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError('Unsupported file type. Use PNG, JPG, GIF, WebP, or SVG.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
      onChange(pub.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [user, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleRemove = useCallback(() => {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  }, [onChange]);

  return (
    <div>
      <label className="label">Business logo</label>

      {value ? (
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={value} alt="Logo preview" className="max-w-full max-h-full object-contain p-1" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600">Logo uploaded. It appears on your invoices and emails.</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-sm font-medium hover:underline"
                style={{ color: accent }}
              >
                Replace
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={handleRemove}
                className="text-sm font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all py-8 flex flex-col items-center justify-center gap-2 ${
            dragOver ? 'border-transparent bg-slate-50 scale-[1.01]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
          style={dragOver ? { borderColor: accent } : undefined}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `${accent}12` }}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} />
            ) : (
              <Upload className="w-5 h-5" style={{ color: accent }} />
            )}
          </div>
          <p className="text-sm font-medium text-slate-700">
            {uploading ? 'Uploading...' : 'Drag and drop your logo here'}
          </p>
          <p className="text-xs text-slate-400">
            or click to browse · PNG, JPG, SVG · up to 2 MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-500 mt-2 flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
