import { supabase } from './client';
import { query, type ApiResult } from './result';

export interface SubmitFeedbackArgs {
  user_id: string | null;
  user_name: string | null;
  exam_type: string | null;
  feedback_message: string;
}

/**
 * Submit user feedback to the feedbacks table.
 * Ports `submitFeedback` from web's supabase.js.
 */
export function submitFeedback(args: SubmitFeedbackArgs): Promise<ApiResult<null>> {
  return query<null>(
    supabase.from('feedbacks').insert({
      user_id: args.user_id,
      user_name: args.user_name,
      exam_type: args.exam_type,
      feedback_message: args.feedback_message.trim(),
    }),
  );
}
