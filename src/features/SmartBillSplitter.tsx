import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
  FlatList,
  Dimensions,
  Image,
  ActivityIndicator,
  Linking, // <-- Add this import
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import OCRService from '../services/ocrService';
import OpenRouterService from '../services/openRouterService';

// Firebase Console Action: Create 'billSplits' collection in Firestore with read/write rules
// OCR.space Setup: Get API key from https://ocr.space/ocrapi
// OpenRouter Setup: Get API key from https://openrouter.ai/ for DeepSeek R1 model

// TypeScript interfaces
interface BillItem {
  id: string;
  name: string;
  price: number; // This will be the total amount (rate * quantity)
  rate?: number; // Rate per unit (optional, for detailed bills)
  quantity: number;
  selectedBy: string[]; // Array of person IDs who selected this item
}

interface Person {
  id: string;
  name: string;
  totalAmount: number;
  itemsSelected: string[]; // Array of item IDs
  shareOfTax: number;
  finalAmount: number;
}

interface BillSplit {
  id: string;
  billImageUri: string;
  billName: string;
  totalAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  items: BillItem[];
  people: Person[];
  createdAt: Date;
  createdBy: string;
  isSettled: boolean;
  ocrData?: any; // Raw OCR data for debugging
}

interface OCRResult {
  items: BillItem[];
  totalAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  serviceChargeAmount: number;
}

const { width, height } = Dimensions.get('window');

const SmartBillSplitter: React.FC = () => {
  const navigation = useNavigation();
  const [billSplits, setBillSplits] = useState<BillSplit[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showCreateBill, setShowCreateBill] = useState<boolean>(false);
  
  // Bill creation state
  const [billImage, setBillImage] = useState<string>('');
  const [billName, setBillName] = useState<string>('');
  const [extractedItems, setExtractedItems] = useState<BillItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [cgstAmount, setCgstAmount] = useState<number>(0);
  const [sgstAmount, setSgstAmount] = useState<number>(0);
  const [gstAmount, setGstAmount] = useState<number>(0);
  const [serviceChargeAmount, setServiceChargeAmount] = useState<number>(0);
  const [isOCRProcessing, setIsOCRProcessing] = useState<boolean>(false);
  const [showAddPerson, setShowAddPerson] = useState<boolean>(false);
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'upload' | 'extract' | 'assign' | 'review'>('upload');
  const [isManualTotal, setIsManualTotal] = useState<boolean>(false);

  // Load bill splits from Firestore
  useEffect(() => {
    loadBillSplits();
  }, []);

  // Auto-calculate total amount when items change (only if not manual mode)
  useEffect(() => {
    if (!isManualTotal) {
      const itemsTotal = extractedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      // Calculate total tax amount from individual components
      const totalTax = cgstAmount + sgstAmount + gstAmount;
      setTaxAmount(totalTax);
      setTotalAmount(itemsTotal + totalTax + serviceChargeAmount);
    } else {
      // Still update tax amount even in manual mode
      const totalTax = cgstAmount + sgstAmount + gstAmount;
      setTaxAmount(totalTax);
    }
  }, [extractedItems, cgstAmount, sgstAmount, gstAmount, serviceChargeAmount, isManualTotal]);

  const loadBillSplits = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'billSplits'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const splits: BillSplit[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        splits.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
        } as BillSplit);
      });
      
      setBillSplits(splits);
    } catch (error) {
      console.error('Error loading bill splits:', error);
      Alert.alert('Error', 'Failed to load bill splits');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need camera roll permissions to upload bill images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBillImage(result.assets[0].uri);
        setCurrentStep('extract');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need camera permissions to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBillImage(result.assets[0].uri);
        setCurrentStep('extract');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const processImageWithOCR = async () => {
    if (!billImage) return;

    setIsOCRProcessing(true);
    try {
      // Show security warning in development
      if (__DEV__) {
        OCRService.showSecurityWarning();
      }

      let ocrResult: { text: string; confidence: number };

      // Try real OCR first, fallback to mock if not available
      if (OCRService.isAvailable()) {
        console.log('Using real OCR service...');
        ocrResult = await OCRService.extractTextFromImage(billImage);
      } else {
        console.log('OCR service not available, using mock data...');
        Alert.alert(
          'Demo Mode',
          'OCR service is not configured. Using mock bill data for demonstration.',
          [{ text: 'OK' }]
        );
        ocrResult = await OCRService.mockOCR(billImage);
      }

      console.log('OCR Result:', ocrResult);
      console.log('Extracted text:', ocrResult.text);
      
      // Use OpenRouter AI to parse the OCR text
      let parsedResult;
      if (OpenRouterService.isAvailable()) {
        console.log('Using OpenRouter AI for text interpretation...');
        parsedResult = await OpenRouterService.parseBillText(ocrResult.text);
      } else {
        console.log('OpenRouter not available, using fallback parsing...');
        parsedResult = parseOCRText(ocrResult.text);
      }
      
      // If no items were parsed, create some default items for manual editing
      if (parsedResult.items.length === 0) {
        parsedResult.items = [
          {
            id: Date.now().toString() + '1',
            name: 'Item 1',
            price: 0,
            quantity: 1,
            selectedBy: [],
          },
          {
            id: Date.now().toString() + '2',
            name: 'Item 2',
            price: 0,
            quantity: 1,
            selectedBy: [],
          },
        ];
      }
      
      setExtractedItems(parsedResult.items);
      setTotalAmount(parsedResult.totalAmount);
      setTaxAmount(parsedResult.taxAmount);
      setCgstAmount(parsedResult.cgstAmount);
      setSgstAmount(parsedResult.sgstAmount);
      setGstAmount(parsedResult.gstAmount);
      setServiceChargeAmount(parsedResult.serviceChargeAmount);
      setIsManualTotal(false); // Reset to auto-calculation when OCR processes
      setCurrentStep('assign');
      
      // Show success message with extracted info
      Alert.alert(
        'OCR Success!', 
        `Extracted ${parsedResult.items.length} items. Total: ₹${parsedResult.totalAmount.toFixed(2)}. You can edit the details before proceeding.`
      );
      
    } catch (error) {
      console.error('OCR Error:', error);
      const errorMessage = error instanceof Error ? OCRService.getErrorMessage(error) : 'Unknown error occurred';
      
      // Handle specific OCR API errors
      if (error instanceof Error && (
        error.message === 'OCR_API_QUOTA_EXCEEDED' || 
        error.message.includes('quota exceeded') || 
        error.message.includes('limit')
      )) {
        Alert.alert(
          'OCR API Quota Exceeded',
          'OCR.space API quota has been exceeded. You can:\n\n1. Wait for quota reset\n2. Use mock data for testing\n3. Enter bill details manually',
          [
            {
              text: 'Setup Instructions',
              onPress: () => {
                Alert.alert(
                  'Setup Instructions',
                  OCRService.getSetupInstructions(),
                  [
                    { text: 'Use Mock Data', onPress: () => useMockData() },
                    { text: 'Manual Entry', onPress: () => useManualEntry() },
                    { text: 'OK' }
                  ]
                );
              },
            },
            {
              text: 'Use Mock Data',
              onPress: () => useMockData(),
            },
            {
              text: 'Manual Entry',
              onPress: () => useManualEntry(),
            },
          ]
        );
        return;
      }
      
      // Handle other errors
      Alert.alert(
        'OCR Processing Failed', 
        `${errorMessage}\n\nYou can manually enter the bill details instead.`,
        [
          {
            text: 'Use Mock Data',
            onPress: () => useMockData(),
          },
          {
            text: 'Manual Entry',
            onPress: () => useManualEntry(),
          },
          {
            text: 'Try Again',
            onPress: () => {
              // Reset to upload step
              setCurrentStep('upload');
              setBillImage('');
            },
          },
        ]
      );
    } finally {
      setIsOCRProcessing(false);
    }
  };

  // Helper function to use mock data
  const useMockData = async () => {
    try {
      const mockResult = await OCRService.mockOCR(billImage);
      
      // Use OpenRouter AI to parse the mock OCR text if available
      let parsedResult;
      if (OpenRouterService.isAvailable()) {
        console.log('Using OpenRouter AI for mock text interpretation...');
        parsedResult = await OpenRouterService.parseBillText(mockResult.text);
      } else {
        console.log('OpenRouter not available, using fallback parsing for mock data...');
        parsedResult = parseOCRText(mockResult.text);
      }
      
      setExtractedItems(parsedResult.items);
      setTotalAmount(parsedResult.totalAmount);
      setTaxAmount(parsedResult.taxAmount);
      setCgstAmount(parsedResult.cgstAmount);
      setSgstAmount(parsedResult.sgstAmount);
      setGstAmount(parsedResult.gstAmount);
      setServiceChargeAmount(parsedResult.serviceChargeAmount);
      setIsManualTotal(false); // Reset to auto-calculation when mock data loads
      setCurrentStep('assign');
      
      Alert.alert(
        'Mock Data Loaded',
        `Loaded ${parsedResult.items.length} sample items. Total: ₹${parsedResult.totalAmount.toFixed(2)}. You can edit these details.`
      );
    } catch (mockError) {
      console.error('Mock OCR failed:', mockError);
      useManualEntry();
    }
  };

  // Helper function to use manual entry
  const useManualEntry = () => {
    setExtractedItems([
      {
        id: Date.now().toString() + '1',
        name: 'Item 1',
        price: 0,
        quantity: 1,
        selectedBy: [],
      },
    ]);
    setTotalAmount(0);
    setTaxAmount(0);
    setServiceChargeAmount(0);
    setCurrentStep('assign');
  };

  const parseOCRText = (text: string): OCRResult => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const items: BillItem[] = [];
    let totalAmount = 0;
    let taxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let gstAmount = 0;
    let serviceChargeAmount = 0;

    console.log('Parsing OCR text:', text);
    console.log('Lines to process:', lines);

    // Improved regex patterns for better bill parsing
    const pricePattern = /₹?\s*(\d+(?:\.\d{1,2})?)/g;
    const itemLinePatterns = [
      // Pattern 1: "Item Name ₹100.00" or "Item Name 100.00"
      /^(.+?)\s+₹?\s*(\d+(?:\.\d{1,2})?)$/,
      // Pattern 2: "Item Name ₹100" with quantity
      /^(.+?)\s+(\d+)\s*x\s*₹?\s*(\d+(?:\.\d{1,2})?)$/,
      // Pattern 3: "Item Name" on one line, price on next
      /^(.+?)$/,
    ];
    
    const totalPatterns = [
      /(?:total|grand\s*total|net\s*total|amount\s*payable|amount)\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
      /₹?\s*(\d+(?:\.\d{1,2})?)\s*(?:total|grand\s*total)/i,
    ];
    
    // Specific tax patterns for CGST, SGST, and GST
    const cgstPatterns = [
      /(?:cgst)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
    ];
    
    const sgstPatterns = [
      /(?:sgst)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
    ];
    
    const gstPatterns = [
      /(?:gst|tax|vat|igst)\s*[\(@]?[\d.%]*\s*[\)%]?\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
      /₹?\s*(\d+(?:\.\d{1,2})?)\s*(?:gst|tax|vat)/i,
    ];
    
    const servicePatterns = [
      /(?:service\s*charge|delivery\s*charge|packing\s*charge)\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/i,
    ];

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      
      console.log(`Processing line ${i}: "${line}"`);
      
      // Check for total amount
      let foundTotal = false;
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1]);
          if (amount > totalAmount) { // Take the highest total found
            totalAmount = amount;
            foundTotal = true;
            console.log(`Found total: ₹${amount}`);
            break;
          }
        }
      }
      if (foundTotal) continue;

      // Check for CGST
      let foundCgst = false;
      for (const pattern of cgstPatterns) {
        const match = line.match(pattern);
        if (match) {
          cgstAmount += parseFloat(match[1]);
          foundCgst = true;
          console.log(`Found CGST: ₹${parseFloat(match[1])}`);
          break;
        }
      }
      if (foundCgst) continue;

      // Check for SGST
      let foundSgst = false;
      for (const pattern of sgstPatterns) {
        const match = line.match(pattern);
        if (match) {
          sgstAmount += parseFloat(match[1]);
          foundSgst = true;
          console.log(`Found SGST: ₹${parseFloat(match[1])}`);
          break;
        }
      }
      if (foundSgst) continue;

      // Check for GST (only if CGST/SGST not found)
      let foundGst = false;
      for (const pattern of gstPatterns) {
        const match = line.match(pattern);
        if (match) {
          gstAmount += parseFloat(match[1]);
          foundGst = true;
          console.log(`Found GST: ₹${parseFloat(match[1])}`);
          break;
        }
      }
      if (foundGst) continue;

      // Check for service charges
      let foundService = false;
      for (const pattern of servicePatterns) {
        const match = line.match(pattern);
        if (match) {
          serviceChargeAmount += parseFloat(match[1]);
          foundService = true;
          console.log(`Found service charge: ₹${parseFloat(match[1])}`);
          break;
        }
      }
      if (foundService) continue;

      // Check for items
      // Skip lines that are clearly not food/drink items
      if (line.toLowerCase().includes('receipt') ||
          line.toLowerCase().includes('bill') ||
          line.toLowerCase().includes('invoice') ||
          line.toLowerCase().includes('date') ||
          line.toLowerCase().includes('time') ||
          line.toLowerCase().includes('cashier') ||
          line.toLowerCase().includes('thank you') ||
          line.toLowerCase().includes('welcome') ||
          line.toLowerCase().includes('total') ||
          line.toLowerCase().includes('subtotal') ||
          line.toLowerCase().includes('tax') ||
          line.toLowerCase().includes('gst') ||
          line.toLowerCase().includes('cgst') ||
          line.toLowerCase().includes('sgst') ||
          line.toLowerCase().includes('igst') ||
          line.toLowerCase().includes('vat') ||
          line.toLowerCase().includes('service') ||
          line.toLowerCase().includes('charge') ||
          line.toLowerCase().includes('discount') ||
          line.toLowerCase().includes('amount payable') ||
          line.toLowerCase().includes('net amount') ||
          line.length < 3) {
        continue;
      }

      // Try to match item patterns
      for (const pattern of itemLinePatterns) {
        const match = line.match(pattern);
        if (match) {
          let itemName = '';
          let itemPrice = 0;
          let quantity = 1;

          if (pattern.source.includes('x')) {
            // Pattern with quantity: "Item Name 2 x ₹50"
            itemName = match[1].trim();
            quantity = parseInt(match[2]);
            itemPrice = parseFloat(match[3]);
          } else if (match.length === 3) {
            // Pattern: "Item Name ₹100"
            itemName = match[1].trim();
            itemPrice = parseFloat(match[2]);
          } else {
            // Single item name, check next line for price
            itemName = match[1].trim();
            const priceMatch = nextLine.match(/^₹?\s*(\d+(?:\.\d{1,2})?)$/);
            if (priceMatch) {
              itemPrice = parseFloat(priceMatch[1]);
              i++; // Skip the next line as we've processed it
            }
          }

          // Validate the item
          if (itemName && itemPrice > 0 && itemPrice < 10000) { // Reasonable price limit
            // Additional validation: exclude tax-like items by name
            const isValidFoodItem = !itemName.toLowerCase().match(
              /\b(tax|gst|cgst|sgst|igst|vat|service|charge|discount|subtotal|total|amount|payable|net)\b/
            );
            
            if (!isValidFoodItem) {
              console.log(`Skipping non-food item: ${itemName}`);
              break;
            }
            
            // Check if it's not a duplicate or similar to existing items
            const isDuplicate = items.some(item => 
              item.name.toLowerCase() === itemName.toLowerCase() ||
              Math.abs(item.price - itemPrice) < 0.01
            );

            if (!isDuplicate) {
              items.push({
                id: Date.now().toString() + Math.random().toString().substr(2, 9),
                name: itemName,
                price: itemPrice,
                quantity: quantity,
                selectedBy: [],
              });
              console.log(`Added item: ${itemName} - ₹${itemPrice} (qty: ${quantity})`);
            }
          }
          break;
        }
      }
    }

    // Calculate total tax amount from individual components
    taxAmount = cgstAmount + sgstAmount + gstAmount;

    // If no total found, calculate from items + taxes + service charges
    if (totalAmount === 0) {
      const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      totalAmount = itemsTotal + taxAmount + serviceChargeAmount;
      console.log(`Calculated total: ₹${totalAmount} (items: ₹${itemsTotal}, tax: ₹${taxAmount}, service: ₹${serviceChargeAmount})`);
    }

    // Validate results
    const calculatedItemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (totalAmount > 0 && calculatedItemsTotal > totalAmount * 1.2) {
      // Items total is much higher than stated total, might be parsing errors
      console.warn('Items total seems too high compared to bill total, might have parsing errors');
    }

    console.log(`Final result: ${items.length} items, total: ₹${totalAmount}, tax: ₹${taxAmount} (CGST: ₹${cgstAmount}, SGST: ₹${sgstAmount}, GST: ₹${gstAmount}), service: ₹${serviceChargeAmount}`);

    return {
      items,
      totalAmount,
      taxAmount,
      cgstAmount,
      sgstAmount,
      gstAmount,
      serviceChargeAmount,
    };
  };

  const addPerson = () => {
    if (newPersonName.trim()) {
      const newPerson: Person = {
        id: Date.now().toString(),
        name: newPersonName.trim(),
        totalAmount: 0,
        itemsSelected: [],
        shareOfTax: 0,
        finalAmount: 0,
      };
      setPeople([...people, newPerson]);
      setNewPersonName('');
      setShowAddPerson(false);
    }
  };

  const removePerson = (personId: string) => {
    setPeople(people.filter(p => p.id !== personId));
    // Remove person from all selected items
    setExtractedItems(extractedItems.map(item => ({
      ...item,
      selectedBy: item.selectedBy.filter(id => id !== personId)
    })));
  };

  const toggleItemSelection = (itemId: string, personId: string) => {
    setExtractedItems(extractedItems.map(item => {
      if (item.id === itemId) {
        const isSelected = item.selectedBy.includes(personId);
        return {
          ...item,
          selectedBy: isSelected 
            ? item.selectedBy.filter(id => id !== personId)
            : [...item.selectedBy, personId]
        };
      }
      return item;
    }));
  };

  const calculateSplit = () => {
    const updatedPeople = people.map(person => {
      // Calculate items total for this person
      const itemsTotal = extractedItems
        .filter(item => item.selectedBy.includes(person.id))
        .reduce((sum, item) => {
          const itemTotal = item.price * item.quantity;
          const sharePerPerson = itemTotal / item.selectedBy.length;
          return sum + sharePerPerson;
        }, 0);

      // Calculate tax share (equally split among all people)
      const taxShare = (taxAmount + serviceChargeAmount) / people.length;

      const finalAmount = itemsTotal + taxShare;

      return {
        ...person,
        totalAmount: itemsTotal,
        shareOfTax: taxShare,
        finalAmount: finalAmount,
        itemsSelected: extractedItems
          .filter(item => item.selectedBy.includes(person.id))
          .map(item => item.id)
      };
    });

    setPeople(updatedPeople);
    setCurrentStep('review');
  };

  const addManualItem = () => {
    const newItem: BillItem = {
      id: Date.now().toString() + Math.random(),
      name: 'New Item',
      price: 0,
      quantity: 1,
      selectedBy: [],
    };
    setExtractedItems([...extractedItems, newItem]);
  };

  const updateItem = (itemId: string, field: keyof BillItem, value: any) => {
    setExtractedItems(extractedItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value };
        
        // If rate or quantity is updated and both are available, recalculate price
        if ((field === 'rate' || field === 'quantity') && updatedItem.rate) {
          updatedItem.price = updatedItem.rate * updatedItem.quantity;
        }
        // If price is updated and quantity > 1, calculate rate
        else if (field === 'price' && updatedItem.quantity > 1) {
          updatedItem.rate = updatedItem.price / updatedItem.quantity;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setExtractedItems(extractedItems.filter(item => item.id !== itemId));
  };

  const saveBillSplit = async () => {
    if (!billName.trim() || people.length === 0 || extractedItems.length === 0) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const billSplit: Omit<BillSplit, 'id'> = {
        billImageUri: billImage,
        billName: billName.trim(),
        totalAmount,
        taxAmount,
        serviceChargeAmount,
        items: extractedItems,
        people,
        createdAt: new Date(),
        createdBy: 'Current User', // Replace with actual user
        isSettled: false,
      };

      await addDoc(collection(db, 'billSplits'), {
        ...billSplit,
        createdAt: Timestamp.fromDate(billSplit.createdAt),
      });

      Alert.alert('Success', 'Bill split created successfully!');
      resetForm();
      setShowCreateBill(false);
      loadBillSplits();
    } catch (error) {
      console.error('Error saving bill split:', error);
      Alert.alert('Error', 'Failed to save bill split');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBillImage('');
    setBillName('');
    setExtractedItems([]);
    setPeople([]);
    setTotalAmount(0);
    setTaxAmount(0);
    setCgstAmount(0);
    setSgstAmount(0);
    setGstAmount(0);
    setServiceChargeAmount(0);
    setCurrentStep('upload');
    setIsManualTotal(false);
  };

  const settleBillSplit = async (splitId: string) => {
    try {
      await updateDoc(doc(db, 'billSplits', splitId), {
        isSettled: true,
      });
      loadBillSplits();
      Alert.alert('Success', 'Bill split settled!');
    } catch (error) {
      console.error('Error settling bill:', error);
      Alert.alert('Error', 'Failed to settle bill split');
    }
  };

  const renderBillSplitCard = ({ item }: { item: BillSplit }) => (
    <View style={styles.billCard}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
        style={styles.billCardGradient}
      >
        <View style={styles.billHeader}>
          <View style={styles.billImageContainer}>
            {item.billImageUri ? (
              <Image source={{ uri: item.billImageUri }} style={styles.billThumbnail} />
            ) : (
              <View style={styles.billPlaceholder}>
                <Ionicons name="receipt-outline" size={24} color="#8E8E93" />
              </View>
            )}
          </View>
          <View style={styles.billInfo}>
            <Text style={styles.billTitle}>{item.billName}</Text>
            <Text style={styles.billDate}>
              {item.createdAt.toLocaleDateString()}
            </Text>
            <Text style={styles.billAmount}>₹{item.totalAmount.toFixed(2)}</Text>
          </View>
          {item.isSettled && (
            <View style={styles.settledBadge}>
              <Text style={styles.settledText}>Settled</Text>
            </View>
          )}
        </View>

        <View style={styles.peopleList}>
          {item.people.map((person) => (
            <View key={person.id} style={styles.personSummary}>
              <Text style={styles.personName}>{person.name}</Text>
              <Text style={styles.personAmount}>₹{person.finalAmount.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {!item.isSettled && (
          <TouchableOpacity
            style={styles.settleButton}
            onPress={() => settleBillSplit(item.id)}
          >
            <Text style={styles.settleButtonText}>Mark as Settled</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );

  const renderUploadStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Upload Bill Photo</Text>
      <Text style={styles.stepDescription}>
        Take a photo or select from gallery to extract bill details automatically
      </Text>

      {billImage ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: billImage }} style={styles.previewImage} />
          <TouchableOpacity
            style={styles.changeImageButton}
            onPress={() => setBillImage('')}
          >
            <Ionicons name="close-circle" size={24} color="#F44336" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.uploadOptions}>
          <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
            <LinearGradient colors={['#4E54C8', '#8B5FBF']} style={styles.uploadButtonGradient}>
              <Ionicons name="camera" size={32} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Take Photo</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <LinearGradient colors={['#45B7D1', '#96CEB4']} style={styles.uploadButtonGradient}>
              <Ionicons name="images" size={32} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {billImage && (
        <View style={styles.billNameInput}>
          <Text style={styles.label}>Bill Name</Text>
          <TextInput
            style={styles.textInput}
            value={billName}
            onChangeText={setBillName}
            placeholder="e.g., Dinner at Pizza Hut"
          />
        </View>
      )}
    </View>
  );

  const renderExtractStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Extract Bill Details</Text>
      <Text style={styles.stepDescription}>
        We'll automatically extract items and prices from your bill
      </Text>

      <TouchableOpacity
        style={styles.extractButton}
        onPress={processImageWithOCR}
        disabled={isOCRProcessing}
      >
        <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.extractButtonGradient}>
          {isOCRProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="scan" size={24} color="#FFFFFF" />
          )}
          <Text style={styles.extractButtonText}>
            {isOCRProcessing ? 'Processing...' : 'Extract Bill Details'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => setCurrentStep('assign')}
      >
        <Text style={styles.manualButtonText}>Enter Items Manually</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAssignStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Assign Items & Add People</Text>
      <Text style={styles.stepDescription}>
        Add people and select who ate what items
      </Text>

      {/* People Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddPerson(true)}
          >
            <Ionicons name="add" size={20} color="#4E54C8" />
            <Text style={styles.addButtonText}>Add Person</Text>
          </TouchableOpacity>
        </View>

        {people.map((person) => (
          <View key={person.id} style={styles.personRow}>
            <Text style={styles.personRowName}>{person.name}</Text>
            <TouchableOpacity onPress={() => removePerson(person.id)}>
              <Ionicons name="close-circle" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Items Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Items</Text>
          <TouchableOpacity style={styles.addButton} onPress={addManualItem}>
            <Ionicons name="add" size={20} color="#4E54C8" />
            <Text style={styles.addButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {extractedItems.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <TextInput
                style={styles.itemNameInput}
                value={item.name}
                onChangeText={(text) => updateItem(item.id, 'name', text)}
                placeholder="Item name"
              />
              <TouchableOpacity onPress={() => removeItem(item.id)}>
                <Ionicons name="trash" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>

            {/* Price, Rate, Quantity, and Total row */}
            <View style={styles.itemDetailsRow}>
              <View style={styles.itemField}>
                <Text style={styles.fieldLabel}>Price</Text>
                <View style={styles.itemPriceContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.itemPriceInput}
                    value={item.price.toString()}
                    onChangeText={(text) => updateItem(item.id, 'price', parseFloat(text) || 0)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {item.rate && (
                <View style={styles.itemField}>
                  <Text style={styles.fieldLabel}>Rate</Text>
                  <View style={styles.itemPriceContainer}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      style={styles.itemPriceInput}
                      value={item.rate.toString()}
                      onChangeText={(text) => updateItem(item.id, 'rate', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}

              <View style={styles.itemField}>
                <Text style={styles.fieldLabel}>Qty</Text>
                <TextInput
                  style={styles.quantityInput}
                  value={item.quantity.toString()}
                  onChangeText={(text) => updateItem(item.id, 'quantity', parseInt(text) || 1)}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.itemField}>
                <Text style={styles.fieldLabel}>Total</Text>
                <Text style={styles.totalDisplay}>₹{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            </View>

            {people.length > 0 && (
              <View style={styles.itemAssignment}>
                <Text style={styles.assignmentLabel}>Who ate this?</Text>
                <View style={styles.peopleButtons}>
                  {people.map((person) => (
                    <TouchableOpacity
                      key={person.id}
                      style={[
                        styles.personButton,
                        item.selectedBy.includes(person.id) && styles.selectedPersonButton
                      ]}
                      onPress={() => toggleItemSelection(item.id, person.id)}
                    >
                      <Text style={[
                        styles.personButtonText,
                        item.selectedBy.includes(person.id) && styles.selectedPersonButtonText
                      ]}>
                        {person.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Tax and Service Charge */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Charges</Text>
        
        {/* Tax Breakdown Section */}
        <View style={styles.taxBreakdownContainer}>
          <Text style={styles.taxBreakdownTitle}>Tax Breakdown</Text>
          
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>CGST:</Text>
            <View style={styles.chargeInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.chargeInput}
                value={cgstAmount.toString()}
                onChangeText={(text) => setCgstAmount(parseFloat(text) || 0)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>SGST:</Text>
            <View style={styles.chargeInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.chargeInput}
                value={sgstAmount.toString()}
                onChangeText={(text) => setSgstAmount(parseFloat(text) || 0)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>GST/Other Tax:</Text>
            <View style={styles.chargeInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.chargeInput}
                value={gstAmount.toString()}
                onChangeText={(text) => setGstAmount(parseFloat(text) || 0)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View style={[styles.chargeRow, styles.totalTaxRow]}>
            <Text style={styles.totalTaxLabel}>Total Tax:</Text>
            <Text style={styles.totalTaxValue}>₹{taxAmount.toFixed(2)}</Text>
          </View>
        </View>
        
        <View style={styles.chargeRow}>
          <Text style={styles.chargeLabel}>Service Charge:</Text>
          <View style={styles.chargeInputContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.chargeInput}
              value={serviceChargeAmount.toString()}
              onChangeText={(text) => setServiceChargeAmount(parseFloat(text) || 0)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>
        
        {/* Total Amount Section */}
        <View style={styles.totalAmountSection}>
          <View style={styles.totalAmountHeader}>
            <Text style={styles.totalAmountTitle}>Bill Total</Text>
            <TouchableOpacity 
              style={styles.editToggleButton}
              onPress={() => setIsManualTotal(!isManualTotal)}
            >
              <Text style={styles.editToggleText}>
                {isManualTotal ? 'Auto' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {isManualTotal ? (
            <View style={styles.editableTotalRow}>
              <Text style={styles.editableTotalLabel}>Total Amount:</Text>
              <View style={styles.chargeInputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={[styles.chargeInput, styles.totalInput]}
                  value={totalAmount.toString()}
                  onChangeText={(text) => setTotalAmount(parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : (
            <View style={[styles.chargeRow, styles.finalTotalRow]}>
              <Text style={styles.finalTotalLabel}>Total Amount:</Text>
              <Text style={styles.finalTotalValue}>₹{totalAmount.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </View>

      {people.length > 0 && extractedItems.length > 0 && (
        <TouchableOpacity style={styles.calculateButton} onPress={calculateSplit}>
          <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.calculateButtonGradient}>
            <Text style={styles.calculateButtonText}>Calculate Split</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review & Save</Text>
      <Text style={styles.stepDescription}>
        Review the calculated split and save the bill
      </Text>

      <View style={styles.summaryCard}>
        <LinearGradient colors={['#F8F9FA', '#FFFFFF']} style={styles.summaryGradient}>
          <Text style={styles.summaryTitle}>Bill Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items Total:</Text>
            <Text style={styles.summaryValue}>
              ₹{extractedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
            </Text>
          </View>
          
          {/* Tax Breakdown */}
          {(cgstAmount > 0 || sgstAmount > 0 || gstAmount > 0) && (
            <>
              {cgstAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>CGST:</Text>
                  <Text style={styles.summaryValue}>₹{cgstAmount.toFixed(2)}</Text>
                </View>
              )}
              
              {sgstAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>SGST:</Text>
                  <Text style={styles.summaryValue}>₹{sgstAmount.toFixed(2)}</Text>
                </View>
              )}
              
              {gstAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>GST/Other Tax:</Text>
                  <Text style={styles.summaryValue}>₹{gstAmount.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Tax:</Text>
                <Text style={styles.summaryValue}>₹{taxAmount.toFixed(2)}</Text>
              </View>
            </>
          )}
          
          {taxAmount === 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax/GST:</Text>
              <Text style={styles.summaryValue}>₹{taxAmount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Charge:</Text>
            <Text style={styles.summaryValue}>₹{serviceChargeAmount.toFixed(2)}</Text>
          </View>
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.splitResults}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={styles.splitTitle}>Individual Split</Text>
          <TouchableOpacity style={styles.whatsappButtonRow} onPress={() => { /* Placeholder for group remind action */ }}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" style={{ marginRight: 4 }} />
            <Text style={styles.whatsappButtonTextRow}>Remind via WhatsApp</Text>
          </TouchableOpacity>
        </View>
        {people.map((person) => {
          // Get the items for this person
          const personItems = extractedItems.filter(item => person.itemsSelected.includes(item.id));
          // Build the message
          const itemList = personItems.map(item => `• ${item.name} (₹${(item.price * item.quantity).toFixed(2)})`).join('\n');
          const message =
            `Hey ${person.name}! 👋\n` +
            `You owe me for our recent bill split: *${billName}*\n` +
            (itemList ? `Here are your items:\n${itemList}\n` : '') +
            `Your share of tax & charges: ₹${person.shareOfTax.toFixed(2)}\n` +
            `*Total amount you owe: ₹${person.finalAmount.toFixed(2)}*\n` +
            `Let me know if you have any questions. Thanks! 😊`;
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
          return (
            <View key={person.id} style={styles.personSplit}>
              <LinearGradient colors={['#E8F5E8', '#F0FFF0']} style={styles.personSplitGradient}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.personSplitName}>{person.name}</Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(whatsappUrl)}
                    style={styles.whatsappButtonRow}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  </TouchableOpacity>
                </View>
                <View style={styles.personSplitDetails}>
                  <Text style={styles.personSplitLabel}>Items: ₹{person.totalAmount.toFixed(2)}</Text>
                  <Text style={styles.personSplitLabel}>Tax Share: ₹{person.shareOfTax.toFixed(2)}</Text>
                  <Text style={styles.personSplitTotal}>Total: ₹{person.finalAmount.toFixed(2)}</Text>
                </View>
              </LinearGradient>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveBillSplit}>
        <LinearGradient colors={['#4E54C8', '#8B5FBF']} style={styles.saveButtonGradient}>
          <Text style={styles.saveButtonText}>Save Bill Split</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderCreateBillModal = () => (
    <Modal
      visible={showCreateBill}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <LinearGradient colors={['#F8FAFF', '#FFFFFF']} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCreateBill(false);
              resetForm();
            }}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Bill Split</Text>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>
                {currentStep === 'upload' && '1/4'}
                {currentStep === 'extract' && '2/4'}
                {currentStep === 'assign' && '3/4'}
                {currentStep === 'review' && '4/4'}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {currentStep === 'upload' && renderUploadStep()}
            {currentStep === 'extract' && renderExtractStep()}
            {currentStep === 'assign' && renderAssignStep()}
            {currentStep === 'review' && renderReviewStep()}
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>

      {/* Add Person Modal */}
      <Modal visible={showAddPerson} transparent animationType="fade">
        <BlurView intensity={50} style={styles.blurBackground}>
          <View style={styles.addPersonModal}>
            <Text style={styles.addPersonTitle}>Add Person</Text>
            <TextInput
              style={styles.personNameInput}
              value={newPersonName}
              onChangeText={setNewPersonName}
              placeholder="Enter name"
              autoFocus
            />
            <View style={styles.addPersonActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddPerson(false);
                  setNewPersonName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={addPerson}>
                <Text style={styles.confirmButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <LinearGradient colors={['#F8FAFF', '#FFFFFF', '#F0F8FF']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Smart Bill Splitter</Text>
          <TouchableOpacity
            style={styles.addBillButton}
            onPress={() => setShowCreateBill(true)}
          >
            <Ionicons name="camera" size={24} color="#4E54C8" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4E54C8" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={billSplits}
            renderItem={renderBillSplitCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="camera-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>No bills yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Upload your first bill to start smart splitting
                </Text>
              </View>
            }
          />
        )}

        {renderCreateBillModal()}
      </LinearGradient>

      {/* Firebase Console Action Comment */}
      {/* 
      Firebase Console Actions needed:
      1. Go to Firebase Console > Firestore Database
      2. Create collection 'billSplits' with the following structure:
         - billImageUri: string
         - billName: string
         - totalAmount: number
         - taxAmount: number
         - serviceChargeAmount: number
         - items: array of objects
         - people: array of objects
         - createdAt: timestamp
         - createdBy: string
         - isSettled: boolean
      3. Set up Firestore security rules to allow read/write for authenticated users
      */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  addBillButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  billCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  billCardGradient: {
    padding: 20,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  billImageContainer: {
    marginRight: 12,
  },
  billThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  billPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  settledBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  settledText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  peopleList: {
    marginBottom: 16,
  },
  personSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  personName: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  personAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  settleButton: {
    backgroundColor: '#4E54C8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  settleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  stepIndicator: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stepText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
    lineHeight: 24,
  },
  uploadOptions: {
    gap: 16,
  },
  uploadButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imagePreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewImage: {
    width: width * 0.8,
    height: width * 0.8 * 1.2,
    borderRadius: 16,
  },
  changeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 4,
  },
  billNameInput: {
    marginTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  extractButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  extractButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  extractButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  manualButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  manualButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 8,
  },
  personRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  itemNameInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  itemPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginRight: 4,
  },
  itemPriceInput: {
    fontSize: 16,
    color: '#1C1C1E',
    width: 60,
    textAlign: 'right',
  },
  itemDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  itemField: {
    flex: 1,
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  quantityInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#1C1C1E',
    textAlign: 'center',
    width: 50,
  },
  totalDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    minWidth: 80,
  },
  itemAssignment: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 16,
  },
  assignmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
  },
  peopleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectedPersonButton: {
    backgroundColor: '#4E54C8',
  },
  personButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  selectedPersonButtonText: {
    color: '#FFFFFF',
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chargeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  chargeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chargeInput: {
    fontSize: 16,
    color: '#1C1C1E',
    width: 80,
    textAlign: 'right',
  },
  taxBreakdownContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  taxBreakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  totalTaxRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalTaxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  totalTaxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4E54C8',
  },
  finalTotalRow: {
    backgroundColor: '#4E54C8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 0,
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  finalTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalAmountSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  totalAmountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalAmountTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  editToggleButton: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editableTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  totalInput: {
    width: 100,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  calculateButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  calculateButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  calculateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryGradient: {
    padding: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E54C8',
  },
  splitResults: {
    marginBottom: 24,
  },
  splitTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  personSplit: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  personSplitGradient: {
    padding: 16,
  },
  personSplitName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  personSplitDetails: {
    gap: 4,
  },
  personSplitLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  personSplitTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 4,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  blurBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  addPersonModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: width * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  addPersonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  personNameInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  addPersonActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4E54C8',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  whatsappButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  whatsappButtonTextRow: {
    color: '#25D366',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SmartBillSplitter;
