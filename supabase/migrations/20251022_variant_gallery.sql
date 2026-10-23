-- Galería de fotos por color/modelo en product_variants.
-- Cada talla guarda la MISMA galería de su color/modelo.
-- `image` se mantiene como foto principal (POS, inventario, tarjetas).
--
-- Ejecutar antes de desplegar el frontend que usa `images`.
-- Es idempotente: una segunda ejecución no colapsa las galerías.
-- El bloque final aborta la transacción si algún grupo queda inconsistente.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}'::text[];

-- Marca interna para que la migración sea idempotente. Si se ejecuta dos veces,
-- la segunda no colapsa las galerías a la foto principal.
CREATE TABLE IF NOT EXISTS public._migration_flags (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._migration_flags ENABLE ROW LEVEL SECURITY;

-- Respaldo de la foto principal actual en un esquema no expuesto por la API.
-- Si el rol no puede crear el esquema, se avisa pero la migración continúa.
DO $$
BEGIN
  CREATE SCHEMA IF NOT EXISTS backups;
  DROP TABLE IF EXISTS backups.product_variants_images_20251022;
  CREATE TABLE backups.product_variants_images_20251022 AS
  SELECT id, product_id, color, variant_name, image
  FROM public.product_variants;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'No se pudo crear el respaldo de imágenes; se continúa sin backup.';
END $$;

-- 1) Cada variante arranca con su foto actual como galería.
UPDATE public.product_variants
SET images = ARRAY[image]
WHERE image IS NOT NULL
  AND cardinality(images) = 0;

-- 2) Agrupa las fotos únicas por color/modelo y las comparte entre todas las tallas.
--    No borra fotos: si un color tenía una foto por talla, todas pasan a ser su galería.
--    La marca evita que una segunda ejecución colapse la galería a la foto principal.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public._migration_flags WHERE name = 'variant_gallery_20251022') THEN
    RAISE NOTICE 'La galería por color ya fue migrada; se omite la agrupación.';
    RETURN;
  END IF;

  EXECUTE $sql$
    WITH unique_images AS (
      SELECT
        product_id,
        coalesce(color, '') AS color_key,
        coalesce(variant_name, '') AS model_key,
        image,
        min(created_at) AS first_seen,
        min(sku) AS first_sku
      FROM public.product_variants
      WHERE image IS NOT NULL
      GROUP BY product_id, coalesce(color, ''), coalesce(variant_name, ''), image
    ),
    grouped AS (
      SELECT
        product_id,
        color_key,
        model_key,
        array_agg(image ORDER BY first_seen NULLS LAST, first_sku) AS images
      FROM unique_images
      GROUP BY product_id, color_key, model_key
    )
    UPDATE public.product_variants pv
    SET images = g.images,
        image = g.images[1]
    FROM grouped g
    WHERE pv.product_id = g.product_id
      AND coalesce(pv.color, '') = g.color_key
      AND coalesce(pv.variant_name, '') = g.model_key
  $sql$;

  INSERT INTO public._migration_flags (name) VALUES ('variant_gallery_20251022');
END $$;

-- 3) Verificación. Si algo queda inconsistente, se aborta y no se confirma nada.
DO $$
DECLARE
  inconsistent_groups int;
  mismatched_principals int;
BEGIN
  SELECT count(*) INTO inconsistent_groups
  FROM (
    SELECT product_id, coalesce(color, ''), coalesce(variant_name, '')
    FROM public.product_variants
    GROUP BY 1, 2, 3
    HAVING count(DISTINCT images) > 1
  ) x;

  SELECT count(*) INTO mismatched_principals
  FROM public.product_variants
  WHERE cardinality(images) > 0
    AND image IS DISTINCT FROM images[1];

  IF inconsistent_groups > 0 OR mismatched_principals > 0 THEN
    RAISE EXCEPTION 'Migración de fotos inconsistente: % grupos, % principales', inconsistent_groups, mismatched_principals;
  END IF;
END $$;

-- Rollback manual (si hiciera falta):
-- UPDATE public.product_variants pv
-- SET image = b.image
-- FROM backups.product_variants_images_20251022 b
-- WHERE pv.id = b.id;
-- ALTER TABLE public.product_variants DROP COLUMN IF EXISTS images;
