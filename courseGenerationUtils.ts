
import { GenerateOutlineResponse } from '@/types/course';
import { toast } from 'sonner';
import { generateModuleContent } from '@/services/openai';
import { saveCourseToSupabase } from '@/services/api';
import { Dispatch, SetStateAction } from 'react';
import { UnitStatus, setUnitToGenerating, setUnitToComplete } from './unitStatusUtils';
import { supabase } from '@/integrations/supabase/client';
import { generateHardcodedDSAModuleContent } from './dsaDemoContent';

export const generateCourseContent = async (
  outlineData: GenerateOutlineResponse,
  setIsLoading: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setCourseContent: Dispatch<SetStateAction<any>>,
  setUnitStatuses: Dispatch<SetStateAction<UnitStatus[]>>,
  setTotalProgress: (progress: number, unitIndex?: number) => void,
  onCourseComplete?: (courseId: string) => void,
  isDemoMode: boolean = false,
  isDSADemoMode: boolean = false
) => {
  if (!outlineData || !Array.isArray(outlineData.units) || outlineData.units.length === 0) {
    setError("Invalid outline structure");
    setIsLoading(false);
    return;
  }

  console.log("Starting course structure generation with outline:", outlineData);
  console.log("DSA Demo mode:", isDSADemoMode ? "enabled" : "disabled");
  
  const units = outlineData.units;
  const modules: any[] = [];
  let isCancelled = false;

  const handleGenerationStop = (event: Event) => {
    console.log("Received generation stop event");
    isCancelled = true;
  };
  document.addEventListener('courseGenerationStop', handleGenerationStop);

  try {
    // Process units in batches for faster generation
    const batchSize = 2; // Process 2 units at a time
    for (let i = 0; i < units.length; i += batchSize) {
      if (isCancelled) {
        setError("Course generation was cancelled");
        setIsLoading(false);
        document.removeEventListener('courseGenerationStop', handleGenerationStop);
        return;
      }

      const batch = units.slice(i, Math.min(i + batchSize, units.length));
      const batchPromises = batch.map(async (unit, batchIndex) => {
        const unitIndex = i + batchIndex;
        console.log(`Generating structure for unit ${unitIndex + 1}/${units.length}: ${unit.title}`);
        setUnitToGenerating(unitIndex, setUnitStatuses);

        try {
          let unitContent;
          
          if (isDSADemoMode) {
            // Use hardcoded DSA content
            unitContent = generateHardcodedDSAModuleContent(unitIndex);
          } else {
            // Use normal generation
            unitContent = await generateModuleContent(outlineData, unitIndex, isDemoMode);
          }

          if (unitContent && !unitContent.error && unitContent.currentUnit) {
            modules[unitIndex] = unitContent.currentUnit;
            setUnitToComplete(unitIndex, setUnitStatuses);

            // Update progress
            const currentProgress = Math.round(((unitIndex + 1) / units.length) * 100);
            setTotalProgress(currentProgress, unitIndex);

            return unitContent.currentUnit;
          } else {
            throw new Error(unitContent?.error || "Failed to generate unit structure");
          }
        } catch (error) {
          console.error(`Error generating unit ${unitIndex + 1}:`, error);
          throw error;
        }
      });

      try {
        await Promise.all(batchPromises);
        
        // Update course content after each batch
        const updatedCourse = {
          title: outlineData.title || "Generated Course",
          description: `Course on ${outlineData.title || "selected topic"}`,
          modules: modules.filter(m => m) // Remove empty slots
        };
        setCourseContent(updatedCourse);
      } catch (error) {
        console.error(`Error processing batch starting at unit ${i + 1}:`, error);
        toast.error(`Failed to generate structure for some units`);
        setError(`Failed to generate structure for units starting at: ${units[i].title}`);
        setIsLoading(false);
        document.removeEventListener('courseGenerationStop', handleGenerationStop);
        return;
      }
    }

    // Check if user is authenticated before trying to save
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // User is not authenticated - complete generation without saving to database
      console.log("User not authenticated, completing generation without database save");
      const finalCourse = {
        title: outlineData.title || "Generated Course",
        description: `Course on ${outlineData.title || "selected topic"}`,
        modules: modules
      };
      
      toast.success("🎉 Course structure generated successfully!");
      setIsLoading(false);
      
      // Generate a temporary course ID for the onCourseComplete callback
      if (onCourseComplete) {
        const tempCourseId = `temp-${Date.now()}`;
        onCourseComplete(tempCourseId);
      }
      return;
    }

    // Save the course structure to database only if user is authenticated
    try {
      const finalCourse = {
        title: outlineData.title || "Generated Course",
        description: `Course on ${outlineData.title || "selected topic"}`,
        modules: modules
      };

      console.log("Saving course structure to database:", finalCourse);
      const response = await saveCourseToSupabase(finalCourse);
      
      if (response?.courseId) {
        toast.success("🎉 Course structure generated successfully!");
        setIsLoading(false);
        if (onCourseComplete) {
          onCourseComplete(response.courseId);
        }
      } else {
        throw new Error("No course ID returned from save operation");
      }
    } catch (error) {
      console.error("Error saving course:", error);
      setError("Failed to save course structure");
      toast.error("Failed to save course structure");
    }

  } catch (error) {
    console.error("Error in course generation:", error);
    setError("Course generation failed");
    setIsLoading(false);
    toast.error("Course generation failed");
  } finally {
    document.removeEventListener('courseGenerationStop', handleGenerationStop);
  }
};
