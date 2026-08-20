import { useRef, useState, useCallback } from 'react';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface ProductImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Compact photo picker for a single catalog item, backed by the `product-images` bucket. */
export default function ProductImageUpload({ value, onChange }: ProductImageUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      setError('Sign in to upload a photo.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File is too large. Maximum size is 5 MB.');
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, GIF, WebP, or SVG.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/product-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
      onChange(pub.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [user, onChange]);

  return (
    <div>
      <label className="label">Photo (optional)</label>
      <div className="flex items-center gap-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:bg-slate-100 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : value ? (
            <img src={value} alt="Item preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-slate-300" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-secondary text-sm py-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? 'Replace' : 'Upload'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Remove photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
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
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
