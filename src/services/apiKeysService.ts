import { db, doc, getDoc, collection } from '../services/firebase';

/**
 * Service to manage API keys stored in Firestore
 * This centralizes API key management and prevents hardcoding keys in the codebase
 */
class ApiKeysService {
  private static instance: ApiKeysService;
  private apiKeys: Record<string, string> = {};
  private initialized = false;
  private initializing = false;

  // Collection name in Firestore
  private readonly COLLECTION_NAME = 'api_keys';

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): ApiKeysService {
    if (!ApiKeysService.instance) {
      ApiKeysService.instance = new ApiKeysService();
    }
    return ApiKeysService.instance;
  }

  /**
   * Initialize the service by loading all API keys from Firestore
   */
  public async initialize(): Promise<void> {
    if (this.initialized || this.initializing) return;
    
    try {
      this.initializing = true;
      console.log('Initializing API keys service...');
      
      const keysRef = collection(db, this.COLLECTION_NAME);
      const keysDoc = await getDoc(doc(keysRef, 'keys'));
      
      if (keysDoc.exists()) {
        this.apiKeys = keysDoc.data() as Record<string, string>;
        console.log('API keys loaded successfully');
      } else {
        console.warn('API keys document not found in Firestore');
        // Initialize with empty object
        this.apiKeys = {};
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing API keys service:', error);
      // Initialize with empty object on error
      this.apiKeys = {};
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Get an API key by name
   * @param keyName The name of the API key to retrieve
   * @param defaultValue Optional default value if key is not found
   */
  public async getApiKey(keyName: string, defaultValue: string = ''): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.apiKeys[keyName] || defaultValue;
  }

  /**
   * Get all API keys
   */
  public async getAllApiKeys(): Promise<Record<string, string>> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return { ...this.apiKeys };
  }

  /**
   * Check if an API key exists
   * @param keyName The name of the API key to check
   */
  public async hasApiKey(keyName: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return keyName in this.apiKeys;
  }

  /**
   * Refresh API keys from Firestore
   */
  public async refreshApiKeys(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }
}

// Export singleton instance
export default ApiKeysService.getInstance();