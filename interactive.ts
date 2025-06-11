
import { BaseModule } from './base';

export interface CodeModule extends BaseModule {
  type: 'code';
  description?: string;
  prompt?: string;
  id?: string;
}

export interface SimulationModule extends BaseModule {
  type: 'simulation';
  description?: string;
  id?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  id?: string;  // Add id to match the quiz component's expectation
}

export interface QuizModule extends BaseModule {
  type: 'quiz';
  questions: QuizQuestion[];
  content_json?: { questions: QuizQuestion[] }; // Add content_json property for compatibility
  id?: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardModule extends BaseModule {
  type: 'flashcard';
  cards: Flashcard[];
  id?: string;
}

export interface ReviewSummaryModule extends BaseModule {
  type: 'review';
  summary: string;
  keyTakeaways: string[];
  id?: string;
}
