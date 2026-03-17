-- Chat history per account + server-side AI runtime settings

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_conversations'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

    UPDATE public.chat_conversations c
    SET title = LEFT(REGEXP_REPLACE(COALESCE(m.content, ''), '\s+', ' ', 'g'), 80)
    FROM LATERAL (
      SELECT content
      FROM public.chat_messages
      WHERE conversation_id = c.id AND role = 'user'
      ORDER BY created_at ASC
      LIMIT 1
    ) m
    WHERE COALESCE(c.title, '') = '';

    UPDATE public.chat_conversations c
    SET company_id = p.company_id
    FROM public.profiles p
    WHERE c.company_id IS NULL
      AND c.user_id = p.user_id
      AND p.company_id IS NOT NULL;

    UPDATE public.chat_conversations c
    SET company_id = cm.company_id
    FROM (
      SELECT DISTINCT ON (user_id)
        user_id,
        company_id
      FROM public.company_members
      WHERE status = 'active'
      ORDER BY user_id,
        CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC
    ) cm
    WHERE c.company_id IS NULL
      AND c.user_id = cm.user_id;

    DELETE FROM public.chat_messages
    WHERE conversation_id IN (
      SELECT id
      FROM public.chat_conversations
      WHERE company_id IS NULL
    );

    DELETE FROM public.chat_conversations
    WHERE company_id IS NULL;

    ALTER TABLE public.chat_conversations
      ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chat_runtime_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rag_base_url TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  columns_to_answer TEXT[] NOT NULL DEFAULT '{}',
  number_docs_retrieval INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_company_updated
  ON public.chat_conversations(user_id, company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_runtime_settings_company_updated
  ON public.chat_runtime_settings(company_id, updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_chat_runtime_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_chat_runtime_settings_updated_at
    BEFORE UPDATE ON public.chat_runtime_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMIT;
