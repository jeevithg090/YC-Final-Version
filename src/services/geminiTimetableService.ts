import { GoogleGenerativeAI } from '@google/generative-ai';
import { TimetableData } from '../types/timetable';
import { GEMINI_API_KEY } from '../constants/app';

export class GeminiTimetableService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  async processTimetableImage(imageUri: string): Promise<TimetableData | null> {
    try {
      console.log('Starting timetable image processing...');
      const base64Image = await this.convertImageToBase64(imageUri);
      
      const prompt = `This is a timetable image. Please extract the schedule information and return it as a JSON object with the following structure:
{
  "days": [
    {
      "day": "string",
      "classes": [
        {
          "subject": "string",
          "startTime": "string",
          "endTime": "string",
          "room": "string (optional)",
          "professor": "string (optional)"
        }
      ]
    }
  ]
}

Important instructions:
1. The timetable columns always go from earliest (left) to latest (right) in the day.
2. If AM/PM is not specified, assume the first class is in the morning (AM), and times increase through the day to afternoon/evening (PM).
3. For times after 12:00, use PM. For times before 8:00, use AM. For times between 8:00 and 12:00, use AM unless it is clear from context that it is PM.
4. Never assign PM to a time before 12:00, and never assign AM to a time after 12:00 unless it is midnight.
5. If a time is missing, infer it from the context of the timetable (e.g., based on the previous or next class, or the column order).
6. Do not include breaks or lunch breaks.
7. Use 12-hour format with AM/PM for times (e.g., "9:30 AM", "2:30 PM").
8. Return only the JSON object, no additional text.
9. Ensure day names are in short form (MON, TUE, WED, THU, FRI, SAT, SUN).
10. Make sure to extract all visible information from the image.`;

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      console.log('Received response from Gemini:', text);
      const jsonMatch = this.extractJSONFromResponse(text);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const timetableData: TimetableData = JSON.parse(jsonMatch);
      
      if (!this.validateTimetableData(timetableData)) {
        throw new Error('Invalid timetable data structure');
      }

      console.log('Successfully extracted timetable data:', timetableData);
      return timetableData;

    } catch (error) {
      console.error('Error processing timetable image:', error);
      return null;
    }
  }

  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }

  private extractJSONFromResponse(text: string): string | null {
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;

      if (jsonStart === -1 || jsonEnd === 0) {
        console.error('No JSON found in response');
        return null;
      }

      const jsonString = text.substring(jsonStart, jsonEnd);
      JSON.parse(jsonString);
      return jsonString;
    } catch (error) {
      console.error('Error extracting JSON from response:', error);
      return null;
    }
  }

  private validateTimetableData(data: any): data is TimetableData {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.days)) return false;

    for (const day of data.days) {
      if (!day.day || typeof day.day !== 'string') return false;
      if (!Array.isArray(day.classes)) return false;

      for (const classEntry of day.classes) {
        if (!classEntry.subject || typeof classEntry.subject !== 'string') return false;
        if (!classEntry.startTime || typeof classEntry.startTime !== 'string') return false;
        if (!classEntry.endTime || typeof classEntry.endTime !== 'string') return false;
      }
    }

    return true;
  }
}

export default GeminiTimetableService;
