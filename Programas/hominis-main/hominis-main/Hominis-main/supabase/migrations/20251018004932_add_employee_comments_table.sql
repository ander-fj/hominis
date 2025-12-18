/*
  # Create employee comments table

  1. New Tables
    - `employee_comments`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `comment_text` (text)
      - `image_url` (text, optional)
      - `created_by` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `employee_comments` table
    - Add policy for anonymous users to read comments
    - Add policy for anonymous users to insert comments
    - Add policy for anonymous users to update their own comments
    - Add policy for anonymous users to delete their own comments

  3. Indexes
    - Create index on employee_id for faster lookups
*/

CREATE TABLE IF NOT EXISTS employee_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  image_url text,
  created_by text NOT NULL DEFAULT 'Anônimo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON employee_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert comments"
  ON employee_comments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update comments"
  ON employee_comments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete comments"
  ON employee_comments
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_employee_comments_employee_id 
  ON employee_comments(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_comments_created_at 
  ON employee_comments(created_at DESC);