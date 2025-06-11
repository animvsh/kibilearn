
import { BaseModule } from './base';

export interface ArticleModule extends BaseModule {
  type: 'article';
  content?: string;
  content_json?: any; // Add content_json property to support the expanded article format
  id?: string; // Explicitly add id
}

export interface LectureModule extends BaseModule {
  type: 'lecture';
  videoId?: string;
  searchKeyword?: string;
  id?: string; // Explicitly add id
  content?: {
    video?: {
      video_id: string;
      title: string;
      duration?: string;
      channel?: string;
      published_at?: string;
    };
    transcript?: string;
  };
}

export interface InteractiveLectureModule extends BaseModule {
  type: 'lecture_interactive';
  videoId: string;
  checkpoints?: number[];
  transcript?: TranscriptItem[];
  id?: string; // Explicitly add id
}

export interface TranscriptItem {
  time: number;
  text: string;
}

// This ArticleSection is specifically for the content modules
export interface ArticleSection {
  heading: string;
  content: string;
  visual?: {
    type: string;
    description: string;
    url: string;
  };
  quiz?: {
    question_text: string;
    options: string[];
    correct_option: string;
  };
  code_prompt?: {
    language: string;
    objective: string;
    starter_code: string;
  };
  chart?: {
    type: string;
    description: string;
    data: {
      labels: string[];
      values: number[];
    };
  };
  flashcards?: import('./interactive').Flashcard[];
  summary_image?: {
    type: string;
    description: string;
    url: string;
  };
}
