
import { CourseModule } from './course';
import { QuizQuestion } from './modules/interactive';

export interface ExtendedCourseUnit {
  id: string;
  title: string;
  introduction: string;
  content: ExtendedCourseSubunit[];
}

export interface ExtendedCourseSubunit {
  id: string;
  title: string;
  modules?: ExtendedCourseModule[];
}

// Expand the ExtendedCourseModule to include all necessary properties
export interface ExtendedCourseModule {
  id: string;
  title: string;
  type: 'article' | 'lecture' | 'lecture_interactive' | 'code' | 'simulation' | 'quiz' | 'flashcard' | 'review' | 'article_interactive';
  sections?: any[];
  content_json?: any; // Explicitly add content_json property
  
  // Add common properties that might be used across different module types
  content?: string | any;
  description?: string;
  prompt?: string;
  searchKeyword?: string;
  videoId?: string;
  questions?: QuizQuestion[]; // Add explicit type for quiz questions
  
  // Add properties from each module type
  cards?: any[]; // For flashcard modules
  summary?: string; // For review modules
  keyTakeaways?: string[]; // For review modules
  
  // Add placeholder property for structure generation
  placeholder?: boolean;
}

export interface ExtendedCourse {
  id: string;
  title: string;
  description: string;
  modules: ExtendedCourseUnit[];
  user_id: string;
  is_public: boolean;
  is_paid_only: boolean;
  share_token: string | null;
}
