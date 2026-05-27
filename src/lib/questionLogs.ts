import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type QuestionAnswerStatus = "answered" | "not_covered" | "error";

type MatchedSource = {
  id: string;
  title: string;
  source?: string;
  category?: string;
  updatedAt?: string;
};

type LogQuestionArgs = {
  question: string;
  answerStatus: QuestionAnswerStatus;
  matchedSources?: MatchedSource[];
  errorMessage?: string;
};

export async function logQuestion({
  question,
  answerStatus,
  matchedSources = [],
  errorMessage,
}: LogQuestionArgs) {
  try {
    console.log("[question_logs] logQuestion called", question);
    console.log(
      "[question_logs] SUPABASE_URL exists:",
      Boolean(process.env.SUPABASE_URL)
    );
    console.log(
      "[question_logs] SUPABASE_SERVICE_ROLE_KEY exists:",
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );

    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return;
    }

    const payload = {
      question,
      matched_sources: matchedSources,
      answer_status: answerStatus,
      error_message: errorMessage,
    };

    console.log("[question_logs] insert payload", payload);

    const { error } = await supabase.from("question_logs").insert(payload);

    if (error) {
      console.error("[question_logs] insert failed", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return;
    }

    console.log("[question_logs] insert success");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Supabase question logging error";

    console.error("[question_logs] logQuestion error", message);
  }
}
