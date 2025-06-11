
// --- Question Types ---
export interface BaseQuizQuestion {
  id: string; // Unique identifier for tracking responses
  type: string;
  question_text: string;
}

export interface MultipleChoiceQuestion extends BaseQuizQuestion {
  type: "multiple_choice";
  options: string[];
  correct_option: string;
  explanation?: string;
}

export interface TrueFalseQuestion extends BaseQuizQuestion {
  type: "true_false";
  answer: boolean;
  explanation?: string;
}

export interface FillBlankQuestion extends BaseQuizQuestion {
  type: "fill_blank";
  answer: string;
  alternatives?: string[];
  explanation?: string;
}

export interface MatchTermsQuestion extends BaseQuizQuestion {
  type: "match_terms";
  pairs: { [term: string]: string };
  explanation?: string;
}

export interface ReflectionQuestion extends BaseQuizQuestion {
  type: "reflection";
  expected_elements: string[];
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | MatchTermsQuestion
  | ReflectionQuestion;

export interface QuizModule {
  id: string;
  title: string;
  questions: QuizQuestion[];
  type?: string; // Add type for compatibility
}

// --- Attempt Result for Analytics/Store ---
export interface QuizAttemptResult {
  moduleId: string;
  userId: string;
  score: number;
  status: "complete" | "in_progress";
  completedAt?: Date;
  responses: {
    questionId: string;
    userAnswer: any;
    isCorrect: boolean;
  }[];
}
