/**
 * Seeds the local Firebase emulators with demo data (no real people or
 * contact details) so every screen has something to show during development.
 *
 * Usage:
 *   npx firebase-tools emulators:start --project demo-yogo   # terminal 1
 *   npm run seed:emulator                                     # terminal 2
 *
 * Then sign in with demo@yogo.test / demo1234.
 * It refuses to run unless the project ID starts with "demo-", so it can
 * never write to a real Firebase project.
 */
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { Timestamp, addDoc, collection, connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-yogo';
const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';

if (!projectId.startsWith('demo-')) {
  console.error(`Refusing to seed "${projectId}": use a demo-* project ID with the emulators.`);
  process.exit(1);
}

const app = initializeApp({ apiKey: 'demo-key', projectId, authDomain: `${projectId}.firebaseapp.com` });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
connectFirestoreEmulator(db, host, 8080);

const DEMO_USERS = [
  {
    email: 'demo@yogo.test',
    name: 'Demo Student',
    userName: 'demo.student',
    branch: 'Computer Science and Engineering (CSE)',
  },
  {
    email: 'riya@yogo.test',
    name: 'Riya S.',
    userName: 'riya.s',
    branch: 'Electronics and Communication Engineering (ECE)',
  },
  { email: 'kabir@yogo.test', name: 'Kabir M.', userName: 'kabir.m', branch: 'Mechanical Engineering (ME)' },
];
const PASSWORD = 'demo1234';

async function signInOrCreate(user) {
  try {
    return (await createUserWithEmailAndPassword(auth, user.email, PASSWORD)).user;
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error;
    return (await signInWithEmailAndPassword(auth, user.email, PASSWORD)).user;
  }
}

const daysAgo = (n, hours = 0) => Timestamp.fromDate(new Date(Date.now() - n * 864e5 - hours * 36e5));
const daysFromNow = (n) => Timestamp.fromDate(new Date(Date.now() + n * 864e5));

async function main() {
  const uids = {};
  for (const user of DEMO_USERS) {
    const fbUser = await signInOrCreate(user);
    await updateProfile(fbUser, { displayName: user.name });
    await setDoc(doc(db, 'users', fbUser.uid), {
      name: user.name,
      userName: user.userName,
      mobileNumber: '+910000000000',
      college: 'Manipal Institute of Technology Manipal (MIT)',
      branch: user.branch,
      email: user.email,
      accountCreatedOn: new Date().toISOString(),
    });
    uids[user.email] = fbUser.uid;
  }
  // The remaining writes only need *a* signed-in user.
  await signInWithEmailAndPassword(auth, DEMO_USERS[0].email, PASSWORD);
  const riya = uids['riya@yogo.test'];
  const kabir = uids['kabir@yogo.test'];

  const products = [
    {
      title: 'Engineering Graphics drafter kit',
      price: 450,
      category: 'Books & Stationery',
      condition: 'Like New',
      location: 'Library',
      seller: 'Riya S.',
      sellerId: riya,
      description: 'Mini-drafter, set squares and a carry case. Used for one semester.',
    },
    {
      title: 'Casio fx-991ES Plus calculator',
      price: 700,
      category: 'Electronics',
      condition: 'Good',
      location: 'Academic Block 5',
      seller: 'Kabir M.',
      sellerId: kabir,
      description: 'Works perfectly, allowed in exams. Battery replaced last month.',
    },
    {
      title: 'Hero Sprint bicycle',
      price: 3200,
      category: 'Vehicles',
      condition: 'Good',
      location: 'Hostel Block 14',
      seller: 'Riya S.',
      sellerId: riya,
      description: 'Single speed, new tyres. Great for getting to early classes.',
    },
    {
      title: 'Study table lamp (LED)',
      price: 350,
      category: 'Furniture',
      condition: 'Like New',
      location: 'Hostel Block 9',
      seller: 'Kabir M.',
      sellerId: kabir,
      description: 'Three brightness levels, USB powered.',
    },
  ];
  for (const [i, p] of products.entries()) {
    await addDoc(collection(db, 'products'), {
      ...p,
      isNegotiable: i % 2 === 0,
      images: [],
      status: 'active',
      timestamp: daysAgo(i, 3),
    });
  }

  const questions = [
    {
      title: 'Best resources for Data Structures mid-sems?',
      description: 'Looking for notes or playlists that match the syllabus, especially trees and graphs.',
      category: 'Academics',
      tags: ['dsa', 'midsem'],
      author: 'Riya S.',
      authorId: riya,
    },
    {
      title: 'Which mess has the best Sunday breakfast?',
      description: 'New here. Is it worth walking to the other mess on weekends?',
      category: 'Campus Life',
      tags: ['mess', 'food'],
      author: 'Kabir M.',
      authorId: kabir,
    },
    {
      title: 'How do I apply for the summer research internship?',
      description: 'Is there a portal, or do we email professors directly?',
      category: 'Career',
      tags: ['internship', 'research'],
      author: 'Riya S.',
      authorId: riya,
    },
  ];
  for (const [i, q] of questions.entries()) {
    await addDoc(collection(db, 'qna_questions'), {
      ...q,
      upvotes: [],
      downvotes: [],
      points: 3 - i,
      answersCount: i,
      views: 12 + i * 7,
      imageUrl: null,
      timestamp: daysAgo(i, 5),
      lastActivity: daysAgo(i, 1),
    });
  }

  const lostFound = [
    {
      type: 'lost',
      title: 'Blue water bottle',
      description: 'Steel bottle with stickers, left in the reading room.',
      location: 'Library',
      itemCategory: 'Accessories',
      contactInfo: 'Message in app',
    },
    {
      type: 'found',
      title: 'Set of hostel keys',
      description: 'Two keys on a red keyring, found near the food court.',
      location: 'Food Court',
      itemCategory: 'Keys',
      contactInfo: 'Message in app',
    },
  ];
  for (const [i, item] of lostFound.entries()) {
    await addDoc(collection(db, 'lost_and_found'), {
      ...item,
      // Free text, as typed into the app's "Date lost/found" field.
      dateLost: new Date(Date.now() - i * 864e5).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      secretPhrase: '',
      status: 'active',
      createdAt: daysAgo(i),
      createdBy: i ? kabir : riya,
    });
  }

  const events = [
    {
      title: 'Tech Innovation Meetup',
      category: 'tech',
      location: 'Innovation Centre',
      time: '5:30 PM',
      organizer: 'Coding Club',
      in: 2,
    },
    {
      title: 'Open Mic Night',
      category: 'cultural',
      location: 'Student Plaza',
      time: '7:00 PM',
      organizer: 'Music Club',
      in: 5,
    },
    {
      title: 'Inter-hostel Football Finals',
      category: 'sports',
      location: 'Main Ground',
      time: '4:00 PM',
      organizer: 'Sports Council',
      in: 9,
    },
  ];
  for (const e of events) {
    await addDoc(collection(db, 'events'), {
      title: e.title,
      description: `${e.title} hosted by the ${e.organizer}.`,
      fullDescription: `Join the ${e.organizer} for ${e.title}. Everyone is welcome.`,
      date: daysFromNow(e.in),
      time: e.time,
      location: e.location,
      venue: { name: e.location },
      isOnline: false,
      category: e.category,
      organizer: e.organizer,
      registrationRequired: false,
      currentParticipants: 0,
      contactPerson: { name: e.organizer, email: 'events@yogo.test' },
      tags: [e.category],
      likes: 0,
      views: 0,
    });
  }

  console.log(`Seeded ${DEMO_USERS.length} users, ${products.length} products, ${questions.length} questions,`);
  console.log(`${lostFound.length} lost & found posts and ${events.length} events into "${projectId}".`);
  console.log(`Sign in with ${DEMO_USERS[0].email} / ${PASSWORD}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Seeding failed. Are the emulators running?', error);
  process.exit(1);
});
