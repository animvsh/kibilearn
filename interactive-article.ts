
import { BaseModule } from './base';

export interface ArticleSection {
  title: string;
  content_markdown: string;
  interaction?: ArticleInteraction;
}

export interface ArticleQuizInteraction {
  type: 'quiz';
  question: string;
  choices: string[];
  correct_answer: string;
}

export interface ArticleShortAnswerInteraction {
  type: 'short-answer';
  prompt: string;
}

export type ArticleInteraction = ArticleQuizInteraction | ArticleShortAnswerInteraction;

export interface ArticleSummary {
  key_takeaways: string[];
  review_task: string;
}

export interface InteractiveArticleContent {
  sections: ArticleSection[];
  summary: ArticleSummary;
}

// Fix the circular reference by making InteractiveArticleModule extend BaseModule directly
export interface InteractiveArticleModule extends BaseModule {
  id?: string;
  type: 'article_interactive';
  content: InteractiveArticleContent | null;
}
