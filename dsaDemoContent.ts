
import { GenerateOutlineResponse } from '@/types/course';

export const getHardcodedDSACourse = (): GenerateOutlineResponse => {
  return {
    title: "Mastering Data Structures and Algorithms",
    description: "A comprehensive course covering fundamental and advanced data structures and algorithms essential for programming interviews and software development.",
    units: [
      {
        title: "Introduction to Data Structures and Algorithms",
        subunits: [
          "Overview of Data Structures",
          "Importance of Algorithms",
          "Time and Space Complexity"
        ]
      },
      {
        title: "Basic Data Structures",
        subunits: [
          "Arrays and Matrices",
          "Linked Lists",
          "Stacks and Queues"
        ]
      },
      {
        title: "Advanced Data Structures",
        subunits: [
          "Trees and Graphs",
          "Hash Tables",
          "Heaps and Priority Queues"
        ]
      },
      {
        title: "Algorithm Design Techniques",
        subunits: [
          "Divide and Conquer",
          "Dynamic Programming",
          "Greedy Algorithms"
        ]
      }
    ]
  };
};

export const generateHardcodedDSAModuleContent = (unitIndex: number) => {
  const course = getHardcodedDSACourse();
  const unit = course.units[unitIndex];
  
  if (!unit) {
    return {
      status: "complete",
      message: "All units processed successfully"
    };
  }

  const unitContent = {
    title: unit.title,
    introduction: `This unit covers key concepts in ${unit.title}.`,
    content: unit.subunits.map((subunit: string, subunitIndex: number) => ({
      title: subunit,
      modules: [
        {
          id: `${unitIndex}-${subunitIndex}-0`,
          type: "article",
          title: `Introduction to ${subunit}`,
          description: `Learn the fundamental concepts and principles of ${subunit}. This module provides a comprehensive overview of the topic with detailed explanations and examples.`,
          placeholder: true
        },
        {
          id: `${unitIndex}-${subunitIndex}-1`,
          type: "lecture",
          title: `${subunit} Deep Dive`,
          description: `Video lecture covering advanced topics and practical demonstrations for ${subunit}. Watch detailed explanations with visual examples and coding demonstrations.`,
          placeholder: true
        },
        {
          id: `${unitIndex}-${subunitIndex}-2`,
          type: "quiz",
          title: `${subunit} Assessment`,
          description: `Test your understanding of ${subunit} concepts with this comprehensive quiz. Assess your learning progress with challenging questions and scenarios.`,
          placeholder: true
        },
        {
          id: `${unitIndex}-${subunitIndex}-3`,
          type: "review",
          title: `${subunit} Summary`,
          description: `Review and consolidate your learning about ${subunit}. Summary of key points, best practices, and important takeaways for real-world application.`,
          placeholder: true
        }
      ]
    }))
  };

  const calculatedProgress = Math.round(((unitIndex + 1) / course.units.length) * 100);

  return {
    status: "processing",
    unitIndex: unitIndex,
    totalUnits: course.units.length,
    currentUnit: unitContent,
    progress: calculatedProgress
  };
};
