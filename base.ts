
export interface BaseModule {
  id?: string; // Add id as optional property
  title: string;
  type: string;
}

export interface Progress {
  id: string;
  user_id: string;
  course_id: string;
  current_unit_id: string | null;
  current_subunit_id: string | null;
  current_module_id: string | null;
  completed_modules: string[];
  in_progress_modules?: string[];
  subunit_mastery: Record<string, { mastery_score: number; status: string }>;
  last_active: string;
}

export interface Course {
  title: string;
  description: string;
  modules: CourseUnit[];
}

export interface CourseUnit {
  title: string;
  introduction: string;
  content: CourseSubunit[];
}

export interface CourseSubunit {
  title: string;
  modules?: CourseModule[];
}

// We'll import all module types here to avoid circular dependencies
import { 
  ArticleModule, 
  LectureModule, 
  InteractiveLectureModule,
} from './content';
import { 
  CodeModule, 
  SimulationModule, 
  QuizModule, 
  FlashcardModule, 
  ReviewSummaryModule 
} from './interactive';
import { InteractiveArticleModule } from './interactive-article';

export type CourseModule = 
  | ArticleModule 
  | LectureModule 
  | InteractiveLectureModule
  | CodeModule 
  | SimulationModule
  | QuizModule
  | FlashcardModule
  | ReviewSummaryModule
  | InteractiveArticleModule;

export interface GenerateOutlineResponse {
  title: string;
  units: {
    title: string;
    subunits: string[];
  }[];
}
