// OpenRouter Service for AI interpretation of OCR text
// PRIORITY: OCR-based regex parsing is PRIMARY, AI parsing is SECONDARY fallback
// Uses free models via OpenRouter for bill parsing and analysis when OCR parsing fails
import apiKeysService from './apiKeysService';

interface BillItem {
  id: string;
  name: string;
  price: number; // Total amount (rate * quantity)
  rate?: number; // Rate per unit (optional)
  quantity: number;
  selectedBy: string[];
}

interface ParsedBillData {
  items: BillItem[];
  totalAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  serviceChargeAmount: number;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private static API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';
  private static readonly MODEL = "google/gemma-2-9b-it:free";
  private static readonly BASE_URL = "https://openrouter.ai/api/v1";

  // Alternative free models to try if the primary fails
  private static readonly FALLBACK_MODELS = [
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "nousresearch/nous-capybara-7b:free"
  ];

  /**
   * Initialize API key from Firestore
   */
  static async initializeApiKey(): Promise<void> {
    try {
      this.API_KEY = await apiKeysService.getApiKey('OPENROUTER_API_KEY', this.API_KEY);
      console.log('OpenRouter API key initialized in OpenRouterService');
    } catch (error) {
      console.error('Failed to initialize OpenRouter API key in OpenRouterService:', error);
    }
  }

  /**
   * Parse OCR text into structured bill data - OCR results are primary, AI is secondary
   * @param ocrText - Raw text extracted from OCR
   * @returns Promise with parsed bill data
   */
  static async parseBillText(ocrText: string): Promise<ParsedBillData> {
    try {
      // Initialize API key if needed
      await this.initializeApiKey();
      
      // Primary: Use OCR-based regex parsing (more reliable)
      console.log('Using primary OCR-based parsing...');
      const ocrResult = this.fallbackParsing(ocrText);
      
      // If OCR parsing finds sufficient items, return it
      if (ocrResult.items.length > 0) {
        console.log(`OCR parsing found ${ocrResult.items.length} items`);
        return ocrResult;
      }
      
      // Secondary: Try AI parsing only if OCR finds no items
      console.log('OCR found no items, trying AI parsing as fallback...');
      return await this.parseWithFallback(ocrText);
      
    } catch (error) {
      console.error('All parsing methods failed:', error);
      
      // Final fallback: Return empty structure
      return {
        items: [],
        totalAmount: 0,
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        gstAmount: 0,
        serviceChargeAmount: 0
      };
    }
  }

  /**
   * Create a structured prompt for bill parsing
   */
  private static createBillParsingPrompt(ocrText: string): string {
    return `You are an expert bill parser. Parse this restaurant/cafe bill text and extract ALL food/drink items with their details.

BILL TEXT TO PARSE:
${ocrText}

PARSING INSTRUCTIONS:
1. Find ALL food and beverage items in the bill
2. Look for various formats and abbreviations:
   - "Item Name ₹Price"
   - "Item × Qty ₹Amount" or "Item x Qt ₹Amt"
   - "Item Rate Qty Amount" or "Item Rt Qt Am"
   - "Item @ ₹Rate Qty ₹Total"
   - Common abbreviations: Qty/Qt/Qu (Quantity), Amt/Am (Amount), Rt (Rate), Chg (Charge), Tot (Total), Svc (Service)
3. Extract tax details (CGST, SGST, GST, VAT) - watch for abbreviations
4. Find service charges, delivery fees, etc. (Service Chg, Svc Chg, Del Chg, Pack Chg)
5. Identify the final total amount (Total, Tot, Grand Total, Amt Payable)

IMPORTANT PARSING RULES:
- Include ALL consumable items (food, drinks, desserts, etc.)
- DO NOT include: taxes, service charges, subtotals, discounts, tips
- For rate-based items: rate = price per unit, price = total amount for that item
- For simple items: price = total amount, rate can be calculated or omitted
- Always include quantity (default to 1 if not specified)
- Parse numbers carefully, removing currency symbols

RESPONSE FORMAT - Return ONLY this JSON structure:
{
  "items": [
    {
      "id": "item_1",
      "name": "Item Name",
      "price": total_amount_for_item,
      "rate": price_per_unit_or_null,
      "quantity": number_of_units,
      "selectedBy": []
    }
  ],
  "totalAmount": final_bill_total,
  "taxAmount": sum_of_all_taxes,
  "cgstAmount": cgst_value_or_0,
  "sgstAmount": sgst_value_or_0,
  "gstAmount": gst_or_vat_value_or_0,
  "serviceChargeAmount": service_charges_total
}

EXAMPLES OF ITEMS TO EXTRACT:
✓ "Butter Chicken ₹320" → name: "Butter Chicken", price: 320, quantity: 1
✓ "Naan 2 × ₹30 ₹60" → name: "Naan", price: 60, rate: 30, quantity: 2
✓ "Pizza Margherita Qty 1 @ ₹450 Amt ₹450" → name: "Pizza Margherita", price: 450, rate: 450, quantity: 1
✓ "Cold Coffee Rt 80 Qt 2 Am 160" → name: "Cold Coffee", price: 160, rate: 80, quantity: 2
✓ "Samosa Qt 3 Am 45" → name: "Samosa", price: 45, quantity: 3
✓ "Tea Rate 20 Quantity 2 Amount 40" → name: "Tea", price: 40, rate: 20, quantity: 2

EXAMPLES TO IGNORE:
✗ "CGST @ 9%", "Service Chg", "Tot", "Subtotal", "Disc", "Svc Charge"

Be thorough - extract every food/drink item you can identify, even if formatting is unclear.

Return only the JSON object with no additional text:`;
  }

  /**
   * Extract JSON from AI response
   */
  private static extractJSONFromResponse(response: string): ParsedBillData | null {
    try {
      // Find JSON in the response
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        console.log('No JSON found in response:', response);
        return null;
      }
      
      const jsonString = response.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonString);
      
      return parsed;
    } catch (error) {
      console.error('Error extracting JSON from AI response:', error);
      console.log('AI Response:', response);
      return null;
    }
  }

  /**
   * Validate and clean parsed data
   */
  private static validateParsedData(data: any): ParsedBillData {
    const validatedData: ParsedBillData = {
      items: [],
      totalAmount: 0,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      gstAmount: 0,
      serviceChargeAmount: 0
    };

    // Validate items
    if (Array.isArray(data.items)) {
      validatedData.items = data.items
        .filter((item: any) => item.name && typeof item.price === 'number')
        .map((item: any, index: number) => {
          const quantity = Number(item.quantity) || 1;
          const rate = Number(item.rate) || undefined;
          const price = Number(item.price) || 0;
          
          // If rate is provided, ensure price = rate * quantity
          const calculatedPrice = rate ? rate * quantity : price;
          
          return {
            id: item.id || `item_${index + 1}`,
            name: String(item.name).trim(),
            price: calculatedPrice,
            rate: rate,
            quantity: quantity,
            selectedBy: []
          };
        });
    }

    // Validate amounts
    validatedData.totalAmount = Number(data.totalAmount) || 0;
    validatedData.taxAmount = Number(data.taxAmount) || 0;
    validatedData.cgstAmount = Number(data.cgstAmount) || 0;
    validatedData.sgstAmount = Number(data.sgstAmount) || 0;
    validatedData.gstAmount = Number(data.gstAmount) || 0;
    validatedData.serviceChargeAmount = Number(data.serviceChargeAmount) || 0;
    
    // Ensure taxAmount is the sum of individual components
    const calculatedTax = validatedData.cgstAmount + validatedData.sgstAmount + validatedData.gstAmount;
    if (calculatedTax > 0) {
      validatedData.taxAmount = calculatedTax;
    }

    return validatedData;
  }

  /**
   * Primary OCR-based parsing using regex patterns (more reliable and faster)
   */
  private static fallbackParsing(ocrText: string): ParsedBillData {
    console.log('Using primary OCR-based regex parsing for OCR text:', ocrText.substring(0, 200) + '...');
    
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const items: BillItem[] = [];
    let totalAmount = 0;
    let serviceChargeAmount = 0;

    // Enhanced patterns for parsing various bill formats - preserve exact item names
    const itemLinePatterns = [
      // Format: "Item Name    Qty    Rate    Amount" (with multiple spaces)
      /^([A-Za-z][A-Za-z\s&'./-]{1,40}?)\s+(\d+)\s+(\d+(?:\.\d{1,2})?)\s+(\d+(?:\.\d{1,2})?)$/,
      
      // Format: "Item Name    Amount" (when qty and rate are missing, amount only)
      /^([A-Za-z][A-Za-z\s&'./-]{2,40}?)\s+(\d+(?:\.\d{1,2})?)$/,
      
      // Format: "Item Name x Qty ₹Rate ₹Total" (e.g., "Masala Dosa x 2 ₹120 ₹240")
      /^(.+?)\s+x\s+(\d+)\s+₹?\s*(\d+(?:\.\d{1,2})?)\s+₹?\s*(\d+(?:\.\d{1,2})?)$/i,
      
      // Format: "Item Name Qty x ₹Rate ₹Total" (e.g., "Coffee 2 x ₹50 ₹100")
      /^(.+?)\s+(\d+)\s*x\s*₹?\s*(\d+(?:\.\d{1,2})?)\s+₹?\s*(\d+(?:\.\d{1,2})?)$/i,
      
      // Format: "Item Name @ ₹Rate Qty ₹Total" (e.g., "Tea @ ₹20 3 ₹60")
      /^(.+?)\s*@\s*₹?\s*(\d+(?:\.\d{1,2})?)\s+(\d+)\s+₹?\s*(\d+(?:\.\d{1,2})?)$/i,
      
      // Format: "Item Name Rate Qty Amount" (e.g., "Samosa 15 3 45")
      /^([A-Za-z][A-Za-z\s&'-]{1,30}?)\s+(\d+(?:\.\d{1,2})?)\s+(\d+)\s+(\d+(?:\.\d{1,2})?)$/,
      
      // Format: "Item Name Rt Rate Qt Qty Am Amount" (abbreviated)
      /^(.+?)\s+(?:rt|rate)\s+(\d+(?:\.\d{1,2})?)\s+(?:qt|qty)\s+(\d+)\s+(?:am|amt)\s+(\d+(?:\.\d{1,2})?)$/i,
      
      // Format: "Item Name Qt Qty Am Amount" (no rate)
      /^(.+?)\s+(?:qt|qty)\s+(\d+)\s+(?:am|amt)\s+(\d+(?:\.\d{1,2})?)$/i,
      
      // Format: "Item Name Qty Amount" (simple quantity format)
      /^([A-Za-z][A-Za-z\s&'-]{1,30}?)\s+(?:qty\s+)?(\d+)\s+₹?\s*(\d+(?:\.\d{1,2})?)$/i,
      
      // Format: "Item Name ₹Price" (simple format, quantity = 1)
      /^([A-Za-z][A-Za-z\s&'-]{1,40}?)\s+₹?\s*(\d+(?:\.\d{1,2})?)$/,
      
      // Format: "Item Name Price" (no currency symbol)
      /^([A-Za-z][A-Za-z\s&'-]{2,40})\s+(\d{2,4}(?:\.\d{1,2})?)$/
    ];
    
    const totalPatterns = [
      /(?:total|grand\s*total|net\s*total|amount\s*payable|final\s*amount|bill\s*total|tot|amt\s*payable)\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
      /(?:amount|total|amt|tot)\s*₹?\s*(\d+(?:\.\d{1,2})?)\s*$/i,
    ];
    
    const taxPatterns = [
      // CGST patterns
      /(?:cgst|central\s*gst)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
      // SGST patterns  
      /(?:sgst|state\s*gst)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
      // General GST/VAT patterns
      /(?:gst|vat|tax)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
      // IGST patterns
      /(?:igst|integrated\s*gst)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
    ];
    
    const servicePatterns = [
      /(?:service\s*charge|service\s*chg|svc\s*charge|svc\s*chg|delivery\s*charge|delivery\s*chg|del\s*chg|packing\s*charge|packing\s*chg|pack\s*chg|convenience\s*fee|conv\s*fee)\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
    ];

    // Initialize tax amounts
    let cgstAmount = 0;
    let sgstAmount = 0;
    let gstAmount = 0;
    let igstAmount = 0;
    let taxAmount = 0;

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for total amount
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          totalAmount = parseFloat(match[1]);
          break;
        }
      }

      // Check for specific tax types
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('cgst')) {
        const match = line.match(/₹?\s*(\d+(?:\.\d{1,2})?)/);
        if (match) cgstAmount += parseFloat(match[1]);
      } else if (lowerLine.includes('sgst')) {
        const match = line.match(/₹?\s*(\d+(?:\.\d{1,2})?)/);
        if (match) sgstAmount += parseFloat(match[1]);
      } else if (lowerLine.includes('igst')) {
        const match = line.match(/₹?\s*(\d+(?:\.\d{1,2})?)/);
        if (match) igstAmount += parseFloat(match[1]);
      } else if (lowerLine.includes('gst') || lowerLine.includes('vat') || lowerLine.includes('tax')) {
        const match = line.match(/₹?\s*(\d+(?:\.\d{1,2})?)/);
        if (match) {
          const amount = parseFloat(match[1]);
          // Only add to general GST if it's not already counted as CGST/SGST/IGST
          if (!lowerLine.includes('cgst') && !lowerLine.includes('sgst') && !lowerLine.includes('igst')) {
            gstAmount += amount;
          }
        }
      }

      // Check for service charges
      for (const pattern of servicePatterns) {
        const match = line.match(pattern);
        if (match) {
          serviceChargeAmount += parseFloat(match[1]);
          break;
        }
      }

      // Check for items (exclude tax and service lines)
      if (line.toLowerCase().includes('receipt') ||
          line.toLowerCase().includes('bill') ||
          line.toLowerCase().includes('total') ||
          line.toLowerCase().includes('tax') ||
          line.toLowerCase().includes('gst') ||
          line.toLowerCase().includes('cgst') ||
          line.toLowerCase().includes('sgst') ||
          line.toLowerCase().includes('igst') ||
          line.toLowerCase().includes('vat') ||
          line.toLowerCase().includes('service') ||
          line.toLowerCase().includes('charge') ||
          line.toLowerCase().includes('discount') ||
          line.toLowerCase().includes('subtotal') ||
          line.toLowerCase().includes('date') ||
          line.toLowerCase().includes('time') ||
          line.length < 3) {
        continue;
      }

      // Try to match item patterns - preserve exact item names and correct quantity parsing
      for (let patternIndex = 0; patternIndex < itemLinePatterns.length; patternIndex++) {
        const pattern = itemLinePatterns[patternIndex];
        const match = line.match(pattern);
        
        if (match) {
          // Always get the exact item name as written in the bill (no trimming extra spaces)
          let itemName = match[1].replace(/\s+/g, ' ').trim();
          let itemPrice = 0;
          let quantity = 1;
          let rate: number | undefined = undefined;

          // Parse based on specific pattern index to ensure correct quantity reading
          switch (patternIndex) {
            case 0: // "Item Name    Qty    Rate    Amount" (with multiple spaces)
              quantity = parseInt(match[2]) || 1;
              rate = parseFloat(match[3]) || 0;
              itemPrice = parseFloat(match[4]) || (rate * quantity);
              break;
              
            case 1: // "Item Name    Amount" (when qty and rate missing)
              quantity = 1;
              itemPrice = parseFloat(match[2]) || 0;
              break;
              
            case 2: // "Item Name x Qty ₹Rate ₹Total"
              quantity = parseInt(match[2]) || 1;
              rate = parseFloat(match[3]) || 0;
              itemPrice = parseFloat(match[4]) || (rate * quantity);
              break;
              
            case 3: // "Item Name Qty x ₹Rate ₹Total"
              quantity = parseInt(match[2]) || 1;
              rate = parseFloat(match[3]) || 0;
              itemPrice = parseFloat(match[4]) || (rate * quantity);
              break;
              
            case 4: // "Item Name @ ₹Rate Qty ₹Total"
              rate = parseFloat(match[2]) || 0;
              quantity = parseInt(match[3]) || 1;
              itemPrice = parseFloat(match[4]) || (rate * quantity);
              break;
              
            case 5: // "Item Name Rate Qty Amount"
              rate = parseFloat(match[2]) || 0;
              quantity = parseInt(match[3]) || 1;
              itemPrice = parseFloat(match[4]) || (rate * quantity);
              break;
              
            case 6: // "Item Name Rt Rate Qt Qty Am Amount"
              rate = parseFloat(match[2]) || 0;
              quantity = parseInt(match[3]) || 1;
              itemPrice = parseFloat(match[4]) || (rate * quantity);
              break;
              
            case 7: // "Item Name Qt Qty Am Amount"
              quantity = parseInt(match[2]) || 1;
              itemPrice = parseFloat(match[3]) || 0;
              if (quantity > 1) {
                rate = itemPrice / quantity;
              }
              break;
              
            case 8: // "Item Name Qty Amount" 
              quantity = parseInt(match[2]) || 1;
              itemPrice = parseFloat(match[3]) || 0;
              if (quantity > 1) {
                rate = itemPrice / quantity;
              }
              break;
              
            case 9: // "Item Name ₹Price" (quantity = 1)
              quantity = 1;
              itemPrice = parseFloat(match[2]) || 0;
              break;
              
            case 10: // "Item Name Price" (no currency symbol)
              quantity = 1;
              itemPrice = parseFloat(match[2]) || 0;
              break;
          }

          // Validate the extracted data with stricter validation
          if (itemName && 
              itemPrice > 0 && 
              itemPrice < 50000 && 
              quantity > 0 && 
              quantity <= 50 && 
              itemName.length >= 2) {
            
            // Exclude lines that are clearly not food items (more precise filtering)
            const excludePatterns = /^(tax|gst|cgst|sgst|igst|vat|service|charge|discount|subtotal|total|amount|payable|net|bill|receipt|address|phone|table|order|time|date|chg|amt|tot|svc|del|conv|fee|disc|sub|grand|final)$/i;
            const isValidFoodItem = !excludePatterns.test(itemName.toLowerCase()) && 
                                  !itemName.toLowerCase().includes('total') &&
                                  !itemName.toLowerCase().includes('tax') &&
                                  !itemName.toLowerCase().includes('service');
            
            if (isValidFoodItem) {
              // Calculate rate if not provided but we have quantity > 1
              if (!rate && quantity > 1 && itemPrice > 0) {
                rate = Math.round((itemPrice / quantity) * 100) / 100; // Round to 2 decimal places
              }
              
              items.push({
                id: `item_${items.length + 1}`,
                name: itemName, // Preserve exact name from bill
                price: itemPrice,
                rate: rate,
                quantity: quantity,
                selectedBy: []
              });
              
              console.log(`✓ Parsed: "${itemName}" | Qty: ${quantity} | Price: ₹${itemPrice}${rate ? ` | Rate: ₹${rate}` : ''}`);
            }
          }
          break; // Found a match, stop trying other patterns
        }
      }
    }

    // Calculate total tax amount
    taxAmount = cgstAmount + sgstAmount + gstAmount + igstAmount;

    // If no total found, calculate from items + taxes + service charges
    if (totalAmount === 0) {
      const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      totalAmount = itemsTotal + taxAmount + serviceChargeAmount;
    }

    return {
      items,
      totalAmount,
      taxAmount,
      cgstAmount,
      sgstAmount,
      gstAmount: gstAmount + igstAmount, // Combine GST and IGST
      serviceChargeAmount
    };
  }

  /**
   * Check if OpenRouter service is available
   */
  static isAvailable(): boolean {
    return !!this.API_KEY && this.API_KEY.length > 20;
  }

  /**
   * Get user-friendly error message
   */
  static getErrorMessage(error: Error): string {
    const message = error.message;
    
    if (message.includes('401') || message.includes('authentication')) {
      return 'OpenRouter API authentication failed. Please check your API key.';
    }
    
    if (message.includes('402') || message.includes('credit')) {
      return 'OpenRouter API credits exhausted. Please add credits to your account.';
    }
    
    if (message.includes('429') || message.includes('rate_limit')) {
      return 'OpenRouter API rate limit exceeded. Please try again later.';
    }
    
    if (message.includes('not a valid model') || message.includes('Model not available')) {
      return 'AI model is not available. The app will use fallback parsing instead.';
    }
    
    if (message.includes('quota') || message.includes('limit')) {
      return 'API quota exceeded. Using fallback parsing instead.';
    }
    
    if (message.includes('All AI models failed')) {
      return 'All AI models are currently unavailable. Using basic text parsing instead.';
    }
    
    return message || 'An unknown error occurred during AI processing. Using fallback parsing.';
  }

  /**
   * Try parsing with different models if the primary fails
   */
  private static async parseWithFallback(ocrText: string): Promise<ParsedBillData> {
    let lastError: Error | null = null;
    
    // Try primary model first
    try {
      return await this.parseWithModel(ocrText, this.MODEL);
    } catch (error) {
      console.warn(`Primary model ${this.MODEL} failed:`, error);
      lastError = error as Error;
    }
    
    // Try fallback models
    for (const model of this.FALLBACK_MODELS) {
      if (model === this.MODEL) continue; // Skip if same as primary
      
      try {
        console.log(`Trying fallback model: ${model}`);
        return await this.parseWithModel(ocrText, model);
      } catch (error) {
        console.warn(`Fallback model ${model} failed:`, error);
        lastError = error as Error;
      }
    }
    
    // If all models fail, throw the last error
    throw lastError || new Error('All AI models failed to parse the bill text');
  }

  /**
   * Parse bill text using a specific model
   */
  private static async parseWithModel(ocrText: string, model: string): Promise<ParsedBillData> {
    const prompt = this.createBillParsingPrompt(ocrText);
    
    const response = await fetch(`${this.BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://yogo-campus.app',
        'X-Title': 'YOGO Campus Bill Splitter',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that parses restaurant bills and extracts structured data. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API Error Response:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message?.includes('not a valid model')) {
          throw new Error(`Model not available: ${model}`);
        }
        if (errorData.error?.message?.includes('insufficient_quota') || 
            errorData.error?.message?.includes('rate_limit')) {
          throw new Error(`Quota exceeded for model: ${model}`);
        }
      } catch (parseError) {
        // If we can't parse the error, just use the raw text
      }
      
      throw new Error(`API error for model ${model}: ${response.status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error(`No response from model: ${model}`);
    }

    const aiResponse = data.choices[0].message.content;
    const parsedData = this.extractJSONFromResponse(aiResponse);
    
    if (!parsedData) {
      throw new Error(`Failed to parse JSON response from model: ${model}`);
    }

    return this.validateParsedData(parsedData);
  }

  /**
   * Test which models are currently available
   */
  static async testAvailableModels(): Promise<string[]> {
    const availableModels: string[] = [];
    const testText = "Test bill: Item 1 ₹100, Tax ₹10, Total ₹110";
    
    const modelsToTest = [this.MODEL, ...this.FALLBACK_MODELS];
    
    for (const model of modelsToTest) {
      try {
        console.log(`Testing model: ${model}`);
        await this.parseWithModel(testText, model);
        availableModels.push(model);
        console.log(`✓ Model ${model} is available`);
      } catch (error) {
        console.log(`✗ Model ${model} failed:`, error);
      }
    }
    
    console.log('Available models:', availableModels);
    return availableModels;
  }
}

export default OpenRouterService;
