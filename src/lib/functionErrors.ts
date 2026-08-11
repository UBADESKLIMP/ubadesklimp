import { FunctionsHttpError } from '@supabase/supabase-js';

export const extractFunctionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {
      // resposta de erro não era JSON — usa o fallback
    }
  }
  return error instanceof Error ? error.message : fallback;
};
