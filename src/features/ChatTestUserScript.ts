// Script to add a test user to Firestore 'users' collection for DM testing
// Usage: Run in a Node.js or Expo environment with Firebase initialized
// Make sure your Firebase config is set up in ../services/firebase

import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

async function createTestUser() {
  const testUser = {
    name: 'Test User',
    username: 'testuser',
    bio: 'This is a test user for DM testing.',
    college: 'Test College',
    branch: 'Test Branch',
    rank: 999,
    badgesObtained: 0,
    accountCreatedOn: new Date().toISOString(),
    connections: 0,
    profileImage: 'https://i.pravatar.cc/150?u=testuser',
    email: 'testuser@yogo-campus.app',
    yearOfStudy: '1st Year',
  };
  try {
    const docRef = await addDoc(collection(db, 'users'), testUser);
    console.log('Test user created with ID:', docRef.id);
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

// Run the script if executed directly
if (require.main === module) {
  createTestUser();
} 