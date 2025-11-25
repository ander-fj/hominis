/*
  # Add barcode field to shopping items

  1. Changes
    - Add `barcode` column to `shopping_items` table
    - Add index on barcode for fast lookups
  
  2. Purpose
    - Allow storing barcode information with items
    - Enable searching items by barcode
    - Support duplicate barcode entries (same product, different purchases)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_items' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE shopping_items ADD COLUMN barcode text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shopping_items_barcode ON shopping_items(barcode) WHERE barcode IS NOT NULL;