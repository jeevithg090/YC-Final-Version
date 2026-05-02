import { ClassEntry } from '../types/timetable';
import apiKeysService from './apiKeysService';

let OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class AINotificationService {
  private primaryModel = 'google/gemma-2-9b-it:free'; // Works best based on testing
  private backupModels = [
    'qwen/qwen-2-7b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free', // May have availability issues
    'microsoft/phi-3-mini-128k-instruct:free' // May have availability issues
  ];
  
  constructor() {
    // Initialize API key from Firestore
    this.initializeApiKey();
  }
  
  private async initializeApiKey(): Promise<void> {
    try {
      OPENROUTER_API_KEY = await apiKeysService.getApiKey('OPENROUTER_API_KEY', OPENROUTER_API_KEY);
      console.log('OpenRouter API key initialized in aiNotificationService');
    } catch (error) {
      console.error('Failed to initialize OpenRouter API key in aiNotificationService:', error);
    }
  }

  private async callOpenRouter(prompt: string, model: string): Promise<string> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://yogo-campus.app',
          'X-Title': 'YOGO Campus'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a friendly and motivational AI assistant for college students. Create engaging, positive, and brief notification messages for class reminders. Keep responses under 50 words and include relevant emojis. Be encouraging and use terminology related to the subject when possible.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data: OpenRouterResponse = await response.json();
      return data.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
      throw error;
    }
  }

  async generateClassReminder(classEntry: ClassEntry, isFirstClass: boolean = false): Promise<string> {
    const prompt = isFirstClass 
      ? `Generate a motivational "start of new day" notification for the first class: "${classEntry.subject}" at ${classEntry.startTime}. Make it feel like a fresh beginning and include subject-related terminology. Keep it encouraging and under 50 words.`
      : `Generate a friendly class reminder notification for: "${classEntry.subject}" starting at ${classEntry.startTime}. Include subject-related words and keep it positive and brief (under 50 words).`;

    // Try primary model first, then fallback to backup models
    const modelsToTry = [this.primaryModel, ...this.backupModels];
    
    for (const model of modelsToTry) {
      try {
        console.log(`Attempting to generate reminder with model: ${model}`);
        const message = await this.callOpenRouter(prompt, model);
        
        if (message && message.length > 10) {
          console.log(`Successfully generated message with ${model}:`, message);
          return message;
        }
      } catch (error) {
        console.error(`Failed with model ${model}, trying next...`);
        continue;
      }
    }

    // Fallback to default messages if all AI models fail
    console.log('All AI models failed, using fallback message');
    return this.getFallbackMessage(classEntry, isFirstClass);
  }

  private getFallbackMessage(classEntry: ClassEntry, isFirstClass: boolean): string {
    if (isFirstClass) {
      const dayStarters = [
        `🌅 Good morning! Time to start your day with ${classEntry.subject}!`,
        `☀️ Rise and shine! Your ${classEntry.subject} class awaits at ${classEntry.startTime}`,
        `🎯 New day, new opportunities! ${classEntry.subject} starts in 20 minutes`,
        `💪 Let's conquer the day! ${classEntry.subject} is coming up at ${classEntry.startTime}`
      ];
      return dayStarters[Math.floor(Math.random() * dayStarters.length)];
    } else {
      const regularReminders = [
        `📚 Don't forget! ${classEntry.subject} starts in 20 minutes`,
        `⏰ Heads up! ${classEntry.subject} class at ${classEntry.startTime}`,
        `🎓 Time for ${classEntry.subject}! Class starts in 20 minutes`,
        `📖 ${classEntry.subject} reminder: Class begins at ${classEntry.startTime}`
      ];
      return regularReminders[Math.floor(Math.random() * regularReminders.length)];
    }
  }

  // Test the AI service
  async testAIService(): Promise<boolean> {
    try {
      const testClass: ClassEntry = {
        subject: 'Computer Science',
        startTime: '9:00 AM',
        endTime: '10:00 AM'
      };

      const message = await this.generateClassReminder(testClass, true);
      console.log('AI Test successful:', message);
      return true;
    } catch (error) {
      console.error('AI Test failed:', error);
      return false;
    }
  }
}

export default new AINotificationService();
