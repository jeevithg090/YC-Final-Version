import { Alert } from 'react-native';
import apiKeysService from './apiKeysService';

// OCR Service for Smart Bill Splitter using OCR.space API
// WARNING: In production, API keys should be stored securely on your backend
// This is a client-side implementation for development/demo purposes

interface OCRTextResponse {
  text: string;
  confidence: number;
}

interface OCRSpaceResponse {
  ParsedResults?: Array<{
    TextOverlay?: { Lines: Array<{ LineText: string }> };
    ParsedText?: string;
    ErrorMessage?: string;
    ErrorDetails?: string;
  }>;
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

export class OCRService {
  // OCR.space API key - replace with environment variable in production
  private static OCR_API_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY ?? '';
  
  /**
   * Initialize API key from Firestore
   */
  static async initializeApiKey(): Promise<void> {
    try {
      this.OCR_API_KEY = await apiKeysService.getApiKey('OCR_API_KEY', this.OCR_API_KEY);
      console.log('OCR API key initialized');
    } catch (error) {
      console.error('Failed to initialize OCR API key:', error);
    }
  }
  
  /**
   * Extract text from image using OCR.space API
   * @param imageUri - Local URI of the image
   * @returns Promise with extracted text
   */
  static async extractTextFromImage(imageUri: string): Promise<OCRTextResponse> {
    try {
      // Initialize API key if needed
      await this.initializeApiKey();
      
      // Convert image to base64
      const base64 = await this.convertImageToBase64(imageUri);
      
      // Prepare form data for OCR.space API
      const formData = new FormData();
      formData.append('apikey', this.OCR_API_KEY);
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('isTable', 'true');
      formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy
      
      // Call OCR.space API
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          // Note: Don't set Content-Type header when using FormData
          // The browser will set it automatically with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OCR API request failed: ${response.status} ${response.statusText}`);
      }

      const data: OCRSpaceResponse = await response.json();
      
      // Handle API errors
      if (data.IsErroredOnProcessing) {
        const errorMessage = data.ErrorMessage || data.ErrorDetails || 'Unknown OCR error';
        
        // Handle specific errors
        if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
          throw new Error('OCR_API_QUOTA_EXCEEDED');
        }
        
        if (errorMessage.includes('invalid') && errorMessage.includes('key')) {
          throw new Error('OCR_API_AUTH_ERROR');
        }
        
        throw new Error(`OCR API Error: ${errorMessage}`);
      }

      if (!data.ParsedResults || data.ParsedResults.length === 0) {
        throw new Error('No text detected in the image');
      }

      const result = data.ParsedResults[0];
      
      if (result.ErrorMessage) {
        throw new Error(`OCR Processing Error: ${result.ErrorMessage}`);
      }

      const extractedText = result.ParsedText || '';
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text detected in the image');
      }

      // Calculate confidence based on OCR.space results
      // OCR.space doesn't provide confidence directly, so we estimate based on text quality
      let confidence = 0.8; // Default confidence
      
      // Higher confidence if we have structured data
      if (extractedText.includes('₹') || extractedText.includes('Rs') || 
          extractedText.includes('Total') || extractedText.includes('Amount')) {
        confidence = 0.9;
      }
      
      // Lower confidence if text is very short or seems garbled
      if (extractedText.length < 50 || extractedText.split(' ').length < 5) {
        confidence = 0.6;
      }

      return {
        text: extractedText,
        confidence,
      };

    } catch (error) {
      console.error('OCR Service Error:', error);
      throw error;
    }
  }

  /**
   * Convert image URI to base64 string
   * @param imageUri - Local image URI
   * @returns Promise with base64 string
   */
  private static async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:image/jpeg;base64, prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Failed to convert image to base64'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('Failed to process image');
    }
  }

  /**
   * Mock OCR for testing purposes (when API is not available)
   * @param imageUri - Image URI (not used in mock)
   * @returns Promise with mock text response
   */
  static async mockOCR(imageUri: string): Promise<OCRTextResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockBillText = `RESTAURANT BILL
Date: 2025-06-28
Time: 12:30 PM

Paneer Butter Masala ₹280.00
Chicken Biryani ₹320.00
Dal Tadka ₹180.00
Garlic Naan 2 ₹120.00
Lassi ₹80.00
Masala Dosa ₹65.00

Total Amount ₹1045.00

Thank you for dining with us!`;

    return {
      text: mockBillText,
      confidence: 0.95,
    };
  }

  /**
   * Check if OCR service is available
   * @returns boolean indicating if service is available
   */
  static isAvailable(): boolean {
    return !!this.OCR_API_KEY && this.OCR_API_KEY.length > 10;
  }

  /**
   * Show warning about API key security
   */
  static showSecurityWarning(): void {
    console.warn(
      'OCR Service: API key is embedded in client code. ' +
      'In production, implement OCR processing on your secure backend.'
    );
  }

  /**
   * Get user-friendly error message for common API errors
   */
  static getErrorMessage(error: Error): string {
    const message = error.message;
    
    if (message === 'OCR_API_QUOTA_EXCEEDED') {
      return 'OCR.space API quota exceeded. Please check your usage limits or try again later.';
    }
    
    if (message === 'OCR_API_AUTH_ERROR') {
      return 'OCR.space API authentication failed. Please check your API key configuration.';
    }
    
    if (message.includes('invalid') && message.includes('key')) {
      return 'Invalid API key. Please check your OCR.space API key configuration.';
    }
    
    if (message.includes('quota exceeded') || message.includes('limit')) {
      return 'API quota exceeded. Please try again later or upgrade your plan.';
    }
    
    if (message.includes('No text detected')) {
      return 'No text detected in the image. Please ensure the bill is clearly visible and well-lit.';
    }
    
    return message || 'An unknown error occurred during OCR processing.';
  }

  /**
   * Get setup instructions for OCR.space API
   */
  static getSetupInstructions(): string {
    return `OCR.space API Setup:

1. Go to https://ocr.space/ocrapi
2. Sign up for a free account
3. Get your API key from the dashboard
4. Replace the API key in the code

Current API key: ${this.OCR_API_KEY.substring(0, 8)}...

Alternative: Use mock data for testing by selecting "Use Mock Data" when OCR fails.`;
  }
}

export default OCRService;