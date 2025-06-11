
import { 
  ArticleModule, 
  LectureModule, 
  InteractiveLectureModule 
} from './content';
import { 
  CodeModule, 
  SimulationModule, 
  QuizModule, 
  FlashcardModule, 
  ReviewSummaryModule 
} from './interactive';
import { InteractiveArticleModule } from './interactive-article';
import { CourseModule } from './base';

export interface ModuleComponentProps {
  module: CourseModule;
  moduleIdx: number;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface ArticleModuleProps extends ModuleComponentProps {
  module: ArticleModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface LectureModuleProps extends ModuleComponentProps {
  module: LectureModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface InteractiveLectureModuleProps extends ModuleComponentProps {
  module: InteractiveLectureModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface CodeModuleProps extends ModuleComponentProps {
  module: CodeModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface SimulationModuleProps extends ModuleComponentProps {
  module: SimulationModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface QuizModuleProps extends ModuleComponentProps {
  module: QuizModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface FlashcardModuleProps extends ModuleComponentProps {
  module: FlashcardModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface ReviewSummaryModuleProps extends ModuleComponentProps {
  module: ReviewSummaryModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}

export interface InteractiveArticleModuleProps extends ModuleComponentProps {
  module: InteractiveArticleModule;
  onComplete?: () => void;
  isCompleted?: boolean;
}
