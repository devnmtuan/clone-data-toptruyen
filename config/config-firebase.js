const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const firebaseConfig = {
  apiKey: "AIzaSyDgX8xgAQgtkmd5r6F21sxK4hlC7rGn4oo",
  authDomain: "toon-firebase.firebaseapp.com",
  projectId: "toon-firebase",
  storageBucket: "toon-firebase.appspot.com",
  messagingSenderId: "870578199961",
  appId: "1:870578199961:web:e9f889f824be41f30c4708"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
module.exports = db;