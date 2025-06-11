
// Re-export all module types from their respective files
export * from './modules/base';
export * from './modules/content';
export * from './modules/interactive';
export * from './modules/props';

// Explicitly re-export InteractiveArticleModule to avoid ambiguity
export type { 
  InteractiveArticleModule, 
  InteractiveArticleContent,
  ArticleInteraction,
  ArticleSummary
} from './modules/interactive-article';

// Export a renamed version of ArticleSection from interactive-article to avoid naming conflicts
export type { 
  ArticleSection as InteractiveArticleSection 
} from './modules/interactive-article';

// Define GenerateOutlineResponse type with optional id
export interface GenerateOutlineResponse {
  title: string;
  units: Array<{
    title: string;
    subunits: string[];
  }>;
  id?: string | number; // Make id optional and accept string or number
}

