ALTER TABLE renders
ADD COLUMN IF NOT EXISTS remotion_render_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS composition_props JSONB;

CREATE INDEX IF NOT EXISTS idx_renders_remotion_id ON renders(remotion_render_id);

COMMENT ON COLUMN renders.remotion_render_id IS 'Remotion Lambda render ID for new renders';
COMMENT ON COLUMN renders.composition_props IS 'Serialized composition props for re-rendering';
